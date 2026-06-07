import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";

// Credit cost — single constant, trivial to change.
const RESEARCH_IDEAS_CREDIT_COST = 10;

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
    const body = await req.json();
    const { projectId, mode = "personalized", roughIdea = "" } = body;
    if (!projectId) return fail("projectId required", 400);
    if (!["personalized", "surprise", "validate"].includes(mode)) {
      return fail("Invalid mode — must be personalized | surprise | validate", 400);
    }
    if (typeof roughIdea !== "string") return fail("roughIdea must be a string", 400);
    if (roughIdea.length > 20000) return fail("roughIdea too long (max 20000 chars)", 400);

    // 3. Load project (RLS enforces ownership)
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("profile_data")
      .eq("id", projectId)
      .single();

    if (projErr || !project) return fail("Project not found", 404);

    // 4. Atomic credit deduction via service role (prevents TOCTOU race)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: deductErr } = await admin.rpc("deduct_credits", {
      _user_id: user.id,
      _cost: RESEARCH_IDEAS_CREDIT_COST,
    });
    if (deductErr) {
      if ((deductErr.message || "").includes("insufficient_credits")) {
        return fail(`Not enough credits — need ${RESEARCH_IDEAS_CREDIT_COST}`, 402);
      }
      return fail("Could not deduct credits", 500);
    }

    const refund = async () => {
      await admin.rpc("refund_credits", { _user_id: user.id, _amount: RESEARCH_IDEAS_CREDIT_COST });
    };

    const profile = (project.profile_data ?? {}) as Record<string, string>;

    // ── STAGE 1: Hypothesis + community evidence generation ───────────────────
    const { system: s1System, prompt: s1Prompt } = buildStage1(mode, profile, roughIdea);

    let s1Result, s2Result;
    try {
      s1Result = await callAI({
        system: s1System,
        prompt: s1Prompt,
        jsonMode: true,
        temperature: 0.8,
        maxTokens: 16384,
      });

      if (!s1Result.text.trim()) {
        await refund();
        return fail("Research stage returned no content — try again.", 502);
      }

      // ── STAGE 2: Scoring + card generation ───────────────────────────────────
      const { system: s2System, prompt: s2Prompt } = buildStage2(profile, s1Result.text);

      s2Result = await callAI({
        system: s2System,
        prompt: s2Prompt,
        jsonMode: true,
        temperature: 0.3,
        maxTokens: 16384,
      });
    } catch (aiErr) {
      await refund();
      throw aiErr;
    }

    // Parse JSON robustly — strip markdown fences and any preamble/trailing text
    let ideas: unknown[];
    try {
      let raw = s2Result.text.trim();

      // 1. Strip markdown code fences if present
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenced) raw = fenced[1].trim();

      // 2. Trim anything before the first { or [ and after the matching last } or ]
      const firstObj = raw.indexOf("{");
      const firstArr = raw.indexOf("[");
      const candidates = [firstObj, firstArr].filter((i) => i >= 0);
      if (candidates.length === 0) throw new Error("no JSON start token found");
      const start = Math.min(...candidates);
      const opener = raw[start];
      const closer = opener === "[" ? "]" : "}";
      const end = raw.lastIndexOf(closer);
      if (end <= start) throw new Error("no JSON end token found");
      raw = raw.slice(start, end + 1);

      const parsed = JSON.parse(raw);
      ideas = Array.isArray(parsed) ? parsed : parsed?.ideas;
      if (!Array.isArray(ideas)) throw new Error("not an array");
    } catch (e) {
      console.error(
        "JSON parse failed:",
        e instanceof Error ? e.message : String(e),
        "| provider:", s2Result.provider,
        "| model:", s2Result.model,
        "| raw length:", s2Result.text.length,
        "| FULL raw text:\n", s2Result.text,
      );
      await refund();
      return fail("AI returned invalid JSON — try again.", 502);
    }

    // Sort: Strong → Medium → Weak
    const evidenceOrder: Record<string, number> = { Strong: 0, Medium: 1, Weak: 2 };
    ideas.sort(
      (a: any, b: any) =>
        (evidenceOrder[a.evidence_strength] ?? 1) -
        (evidenceOrder[b.evidence_strength] ?? 1),
    );

    // Audit log (service role bypasses RLS — user inserts are blocked by policy)
    await admin.from("credit_usage").insert({
      user_id: user.id,
      project_id: projectId,
      action: "research_ideas",
      credits_used: RESEARCH_IDEAS_CREDIT_COST,
      ai_model: s2Result.model,
    });

    await supabase
      .from("projects")
      .update({ ideas, status: "discover", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return ok({ ideas });
  } catch (e) {
    // Surface the real error — includes full provider status + body from callAI
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-ideas unhandled:", msg);
    return fail(msg, 500);
  }
});

// ── Prompts ───────────────────────────────────────────────────────────────────

function profileStr(profile: Record<string, string>): string {
  const has = Object.values(profile).some((v) => v?.trim());
  if (!has) return "No user profile provided — generate ideas broadly.";
  return `USER PROFILE:
- Niche: ${profile.niche || "not specified"}
- Expertise: ${profile.expertise || "not specified"}
- Audience: ${profile.audience || "not specified"}
- Current offer: ${profile.offer || "not specified"}
- Preferred tool type: ${profile.tool_type || "not specified"}
- Build skill level: ${profile.skill_level || "beginner"}
- Time per week: ${profile.time_per_week || "5-10h"}`;
}

function buildStage1(
  mode: string,
  profile: Record<string, string>,
  roughIdea: string,
): { system: string; prompt: string } {
  const taskInstr =
    mode === "personalized"
      ? `Based on the user profile, generate 8-10 specific micro-SaaS idea hypotheses tailored to their niche, audience, and goals. Each must be a practical digital tool buildable by a solo developer in 1-7 days.`
      : mode === "surprise"
      ? `Generate 8-10 diverse practical micro-SaaS idea hypotheses across different niches. Be creative but grounded — each must solve a specific recurring pain that people pay to solve. Not generic categories — specific tools for specific people in specific situations.`
      : `The user has this rough idea: "${roughIdea}"

Generate 8-10 stronger, more specific variants and adjacent ideas. Some refine the original, others challenge it with better angles or different audiences. All must be practically buildable solo.`;

  const system =
    `You are a senior micro-SaaS market researcher. You have deep knowledge of online communities, Reddit threads, niche forums, Indie Hackers discussions, and the recurring pain patterns people discuss across the internet. You output valid JSON arrays only.`;

  const prompt =
    `${profileStr(profile)}

TASK: ${taskInstr}

For EACH hypothesis, draw on your knowledge of online communities to describe WHERE this pain is discussed. Name specific subreddits, forums, or communities. Describe the types of threads (complaints, how-do-I questions, tool comparisons) and characterize what the audience actually says.

EVIDENCE QUALITY RULES:
- Only name communities that genuinely exist and discuss this topic
- Describe thread patterns you know are real
- Use representative/typical post titles rather than exact titles
- For URLs: use community-level links (https://reddit.com/r/[subreddit]) unless certain of a specific post
- For engagement: describe typical patterns ("posts like this get 50-200 comments") not invented exact numbers
- If a community genuinely does NOT discuss this topic, set evidence_found: false

Return ONLY a JSON array. Each item:
{
  "hypothesis": "concise problem statement",
  "audience": "specific who",
  "app_type": "what the tool does",
  "monetization": "pricing model that fits",
  "evidence_found": true,
  "evidence": [
    {
      "platform": "Reddit",
      "community": "r/freelance",
      "post_title": "representative post type",
      "url": "https://reddit.com/r/freelance",
      "engagement": "typical: 80-150 comments on this topic",
      "key_observation": "what the audience actually asks for or complains about"
    }
  ],
  "no_evidence_note": ""
}`;

  return { system, prompt };
}

function buildStage2(
  profile: Record<string, string>,
  stage1Output: string,
): { system: string; prompt: string } {
  const has = Object.values(profile).some((v) => v?.trim());
  const founderCtx = has
    ? `niche=${profile.niche || "?"}, audience=${profile.audience || "?"}, skill=${profile.skill_level || "beginner"}, time=${profile.time_per_week || "5-10h"}`
    : "no profile — score fit neutrally";

  const system =
    `You are a micro-SaaS strategist who turns raw market research into ranked, commercially honest idea cards for solo founders. You output valid JSON arrays only.`;

  const prompt =
    `FOUNDER CONTEXT: ${founderCtx}

STAGE 1 RESEARCH — hypotheses with community evidence:
${stage1Output}

SCORING DIMENSIONS (each 1–10):
- pain: urgency — many complaints, workarounds, repeated questions = high
- willingness_to_pay: price mentions, existing paid tools, "worth it" signals = high
- simplicity: solo dev ships useful MVP in under a week? fewer integrations = higher
- retention: recurring return? data lock-in, workflow dependency, habit = high
- fit: how well does this match the founder profile, skills, and audience?

EVIDENCE STRENGTH RULES:
- Strong: 3+ real community sources with meaningful engagement, recurring pain pattern clear
- Medium: 1–2 real sources, OR strong reasoning with some evidence
- Weak: evidence_found=false OR only 1 low-engagement source — still include, tag Weak

For ideas where evidence_found=false: fill evidence_summary from hypothesis reasoning; set source_links to []; set evidence_strength to "Weak".

Return ONLY a JSON array sorted Strong first, Medium second, Weak last. Each card:
{
  "name": "App Name (2–5 marketable words)",
  "evidence_strength": "Strong|Medium|Weak",
  "target_audience": "specific description of who",
  "core_problem": "the exact pain in 1–2 sentences",
  "evidence_summary": "what real people said or complained about — cite community names (2–3 sentences)",
  "source_links": [
    { "url": "...", "title": "...", "platform": "...", "engagement": "..." }
  ],
  "strongest_signal": "the single most compelling data point found",
  "why_fits_user": "why this idea suits the founder profile, skills, and audience",
  "usage_frequency": "daily|weekly|monthly",
  "why_people_keep_paying": "what creates lock-in or recurring value",
  "fast_mvp": "smallest useful version that proves the concept — what IN, what OUT",
  "unique_angle": "how this stands out from existing tools or approaches",
  "churn_risk": "main reason users might leave and how to prevent it",
  "validation_test": "fastest way to validate demand before building anything",
  "scores": {
    "pain": 0,
    "willingness_to_pay": 0,
    "simplicity": 0,
    "retention": 0,
    "fit": 0
  },
  "final_verdict": "one commercially focused sentence on whether to build this"
}`;

  return { system, prompt };
}

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
