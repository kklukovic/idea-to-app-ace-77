import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_MODEL = "gemini-2.5-flash";
const COST = 4;

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

    // 4. Read credits — service role bypasses the column-level grant
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (profErr || !prof) return fail("Could not read credits", 500);
    if (prof.credits < COST) {
      return fail(`Not enough credits — need ${COST}, have ${prof.credits}`, 402);
    }

    // 5. Build prompt (exact system prompt from spec)
    const profile = project.profile_data as Record<string, string>;
    const prompt =
      `You are evaluating digital tool ideas for a solo founder.
IDEAS: ${JSON.stringify(project.ideas)}
CONTEXT: skill level ${profile.skill_level}, time available ${profile.time_per_week}, audience ${profile.audience}.
Score each idea 1-10 on: pain_level, build_ease (given their skill+time), monetization_potential, content_potential, conversation_potential, founder_offer_potential.
Return ONLY a JSON array sorted by total descending, each: { name, scores: {pain_level, build_ease, monetization_potential, content_potential, conversation_potential, founder_offer_potential}, total (sum), verdict (1-2 sentences), rank (number) }. No prose outside JSON.`;

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
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
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
    // responseMimeType:"application/json" is set, but Gemini occasionally still wraps
    // output in ```json fences or adds leading text. The regex below extracts the
    // content between any fences first; if no fences are found it uses the raw text.
    let scored: Array<{ name: string; total: number }>;
    try {
      const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const toParse = (fenced ? fenced[1] : rawText).trim();
      if (!toParse) throw new Error("empty response");
      const parsed = JSON.parse(toParse);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      scored = parsed;
    } catch (parseErr) {
      console.error("JSON parse failed:", parseErr, "| Raw (first 500):", rawText.slice(0, 500));
      return fail("AI returned invalid JSON — try again.", 502);
    }

    // Ensure sort order even if Gemini didn't comply
    scored.sort((a, b) => b.total - a.total);

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
