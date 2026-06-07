import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_MODEL = "gemini-2.5-flash";
const COST = 4;
const SCORE_KEYS = [
  "pain_level",
  "build_ease",
  "monetization_potential",
  "content_potential",
  "conversation_potential",
  "founder_offer_potential",
] as const;

type ScoreKey = typeof SCORE_KEYS[number];

type ScoredIdea = {
  name: string;
  scores: Record<ScoreKey, number>;
  total: number;
  verdict: string;
  rank: number;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // 1. Verify JWT
    const auth = req.headers.get("Authorization");
    if (!auth) return fail("Missing authorization", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return fail("Unauthorized", 401);

    // 2. Parse body
    const { projectId } = await req.json();
    if (!projectId) return fail("projectId required", 400);

    // 3. Load project (RLS enforces ownership)
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("ideas, profile_data")
      .eq("id", projectId)
      .single();

    if (projErr || !project) return fail("Project not found", 404);
    if (!project.ideas) return fail("Generate ideas first", 400);
    if (!project.profile_data) return fail("Profile data missing", 400);

    // 4. Atomic credit deduction (prevents TOCTOU race)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: deductErr } = await admin.rpc("deduct_credits", {
      _user_id: user.id,
      _cost: COST,
    });
    if (deductErr) {
      if ((deductErr.message || "").includes("insufficient_credits")) {
        return fail(`Not enough credits — need ${COST}`, 402);
      }
      return fail("Could not deduct credits", 500);
    }
    const refund = async () => {
      await admin.rpc("refund_credits", { _user_id: user.id, _amount: COST });
    };

    // 5. Build prompt (exact system prompt from spec)
    const profile = project.profile_data as Record<string, string>;
    const prompt =
      `You are evaluating digital tool ideas for a solo founder.
IDEAS: ${JSON.stringify(project.ideas)}
CONTEXT: skill level ${profile.skill_level}, time available ${profile.time_per_week}, audience ${profile.audience}.
Score each idea 1-10 on: pain_level, build_ease (given their skill+time), monetization_potential, content_potential, conversation_potential, founder_offer_potential.
Return ONLY a JSON array sorted by total descending, each: { name, scores: {pain_level, build_ease, monetization_potential, content_potential, conversation_potential, founder_offer_potential}, total (sum), verdict (max 12 words), rank (number) }. No prose outside JSON.`;

    // 6. Call Gemini 2.5 Flash
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return fail("GEMINI_API_KEY not configured", 500);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  scores: {
                    type: "object",
                    properties: Object.fromEntries(
                      SCORE_KEYS.map((key) => [key, { type: "number" }]),
                    ),
                    required: [...SCORE_KEYS],
                  },
                  total: { type: "number" },
                  verdict: { type: "string" },
                  rank: { type: "number" },
                },
                required: ["name", "scores", "total", "verdict", "rank"],
              },
            },
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const body = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, body);
      return fail(`AI error ${geminiRes.status} — try again.`, 502);
    }

    const geminiJson = await geminiRes.json();
    const rawText: string =
      geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // 7. Parse JSON safely.
    // responseMimeType/responseSchema are set, but providers can still return
    // fenced JSON, an object wrapper, or number strings. Normalize before saving.
    let scored: ScoredIdea[];
    try {
      scored = normalizeScoredIdeas(parseJsonFromModel(rawText));
    } catch (parseErr) {
      console.error("JSON parse failed:", parseErr, "| Raw (first 500):", rawText.slice(0, 500));
      return fail("AI returned invalid JSON — try again.", 502);
    }

    // Ensure sort order even if Gemini didn't comply
    scored.sort((a, b) => b.total - a.total);
    scored = scored.map((idea, index) => ({ ...idea, rank: index + 1 }));

    // 8. Deduct credits (only reached on successful parse)
    const { error: deductErr } = await admin
      .from("profiles")
      .update({ credits: prof.credits - COST })
      .eq("id", user.id);
    if (deductErr) return fail("Could not deduct credits", 500);

    // 9. Audit log
    await admin.from("credit_usage").insert({
      user_id: user.id,
      project_id: projectId,
      action: "score",
      credits_used: COST,
      ai_model: GEMINI_MODEL,
    });

    // 10. Persist results
    await supabase
      .from("projects")
      .update({
        scored_ideas: scored,
        status: "score",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return ok({ scored });
  } catch (e) {
    console.error("score-ideas unhandled:", e);
    return fail(e instanceof Error ? e.message : "Internal error", 500);
  }
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function fail(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function parseJsonFromModel(rawText: string): unknown {
  const text = rawText.trim();
  if (!text) throw new Error("empty response");

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return JSON.parse(fenced[1].trim());

  try {
    return JSON.parse(text);
  } catch {
    const extracted = extractFirstJsonValue(text);
    if (!extracted) throw new Error("no JSON value found");
    return JSON.parse(extracted);
  }
}

function extractFirstJsonValue(text: string): string | null {
  const start = text.search(/[\[{]/);
  if (start === -1) return null;

  const opener = text[start];
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === opener) {
      depth++;
    } else if (char === closer) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function normalizeScoredIdeas(value: unknown): ScoredIdea[] {
  const maybeWrapped = value as { scored?: unknown; ideas?: unknown };
  const list = Array.isArray(value)
    ? value
    : Array.isArray(maybeWrapped?.scored)
      ? maybeWrapped.scored
      : Array.isArray(maybeWrapped?.ideas)
        ? maybeWrapped.ideas
        : null;

  if (!list) throw new Error("not an array");

  return list.map((item, index) => {
    const idea = item as {
      name?: unknown;
      scores?: Partial<Record<ScoreKey, unknown>>;
      total?: unknown;
      verdict?: unknown;
      rank?: unknown;
    };

    if (typeof idea.name !== "string" || !idea.name.trim()) {
      throw new Error(`idea ${index + 1} missing name`);
    }
    if (!idea.scores || typeof idea.scores !== "object") {
      throw new Error(`idea ${idea.name} missing scores`);
    }

    const scores = Object.fromEntries(
      SCORE_KEYS.map((key) => {
        const score = Number(idea.scores?.[key]);
        if (!Number.isFinite(score)) throw new Error(`idea ${idea.name} missing ${key}`);
        return [key, Math.max(1, Math.min(10, Math.round(score)))];
      }),
    ) as Record<ScoreKey, number>;

    const calculatedTotal = SCORE_KEYS.reduce((sum, key) => sum + scores[key], 0);
    const suppliedTotal = Number(idea.total);

    return {
      name: idea.name.trim(),
      scores,
      total: Number.isFinite(suppliedTotal) ? suppliedTotal : calculatedTotal,
      verdict: typeof idea.verdict === "string" && idea.verdict.trim()
        ? idea.verdict.trim()
        : "Needs more validation.",
      rank: Number.isFinite(Number(idea.rank)) ? Number(idea.rank) : index + 1,
    };
  });
}
