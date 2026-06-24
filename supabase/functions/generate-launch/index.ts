import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_MODEL = "gemini-2.5-flash";
const COST = 8;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify JWT
    const auth = req.headers.get("Authorization");
    if (!auth) return fail("Missing authorization", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData.user;
    if (authErr || !user) return fail("Unauthorized", 401);

    // 2. Parse body
    const { projectId } = await req.json();
    if (!projectId) return fail("projectId required", 400);

    // 3. Load project (RLS enforces ownership)
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("chosen_idea, profile_data, blueprint_markdown")
      .eq("id", projectId)
      .single();

    if (projErr || !project) return fail("Project not found", 404);
    if (!project.chosen_idea) return fail("Choose an idea first", 400);
    if (!project.profile_data) return fail("Profile data missing", 400);
    if (!project.blueprint_markdown) return fail("Generate a blueprint first", 400);

    // 4. Atomic credit deduction
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

    // 5. Build prompt
    const idea = project.chosen_idea as Record<string, string>;
    const profile = clampProfile(project.profile_data);
    const blueprintSummary = (project.blueprint_markdown as string).slice(0, 1200);

    const prompt =
      `You are a launch strategist for a solo founder using build-in-public + founder pricing.
PROJECT: tool ${idea.name}, promise ${idea.promise}, target ${idea.target_user}, monetization ${idea.monetization_angle}.
FOUNDER: audience ${profile.audience}, solo organic reach on Facebook + LinkedIn + X, time ${profile.time_per_week}.
BLUEPRINT CONTEXT (first 1200 chars): ${blueprintSummary}

Output Markdown sections:
## Founder Offer
(starting price $27-47, founder limit 20-50, 3-4 tier price ladder up to lifetime then monthly, 2-3 bonuses)
## Launch Posts
### Facebook
(200-300 words story-driven; pattern interrupt, real problem, offer + scarcity, CTA like 'Comment TOOL')
### LinkedIn
(150-200 words; pattern interrupt, real problem, offer + scarcity, CTA)
### X
(hook tweet + 2 follow-ups under 280 chars each; pattern interrupt, real problem, CTA)
## DM Script
(reply to commenters, follow-up, close with offer link)
## 7-Day Build-in-Public Calendar
(per day: platform, angle, format, CTA)
## 30-Day Launch Plan
(week 1 build + first founders, week 2 $1 auction + tier bump, week 3 polish + Product Hunt prep, week 4 scale + close)
## $1 Auction Template
(full auction post, winner reward, DM to all bidders, 3-message sequence for non-winners over 5 days)
## Email Sequence
(3 emails: launch / objection-handling / scarcity-close)
## 5 Ongoing Content Angles
## First 10 Actions Today
(concrete, time-boxed)

Be specific and copy-pasteable. No filler.`;

    // 6. Call Gemini 2.5 Flash (plain text output — no responseMimeType)
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
            temperature: 0.8,
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const body = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, body);
      await refund();
      return fail(`AI error ${geminiRes.status} — try again.`, 502);
    }

    const geminiJson = await geminiRes.json();
    const markdown: string =
      geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!markdown.trim()) {
      await refund();
      return fail("AI returned empty response — try again.", 502);
    }

    // Audit log (service role bypasses RLS)
    await admin.from("credit_usage").insert({
      user_id: user.id,
      project_id: projectId,
      action: "launch",
      credits_used: COST,
      ai_model: GEMINI_MODEL,
    });

    // 9. Persist results
    await supabase
      .from("projects")
      .update({
        launch_kit_markdown: markdown,
        status: "launch",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return ok({ markdown });
  } catch (e) {
    console.error("generate-launch unhandled:", e);
    return fail(e instanceof Error ? e.message : "Internal error", 500);
  }
});

const PROFILE_FIELD_MAX = 2000;
function clampProfile(raw: unknown): Record<string, string> {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = typeof v === "string" ? v.slice(0, PROFILE_FIELD_MAX) : "";
  }
  return out;
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
