import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_MODEL = "gemini-2.5-flash";
const COST = 8;

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
    const { projectId, researchNotes = "" } = await req.json();
    if (!projectId) return fail("projectId required", 400);

    // 3. Load project (RLS enforces ownership)
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("profile_data, manual_research")
      .eq("id", projectId)
      .single();

    if (projErr || !project) return fail("Project not found", 404);
    if (!project.profile_data) return fail("Complete your Profile first", 400);

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

    // 5. Persist research notes if freshly provided
    const notes = String(researchNotes).trim() || project.manual_research?.trim() || "";
    if (String(researchNotes).trim()) {
      await supabase
        .from("projects")
        .update({ manual_research: researchNotes })
        .eq("id", projectId);
    }

    // 6. Build Gemini prompt (exact system prompt from spec)
    const prompt =
      `You are an expert app idea researcher and micro-SaaS strategist for solo founders.
USER PROFILE: ${JSON.stringify(project.profile_data)}
RESEARCH NOTES (may be empty): ${notes}
Generate 5-7 practical digital tool ideas. If research notes are provided, ground ideas in them; otherwise reason from the profile. Rules: no generic ideas; each buildable as a simple web/PWA tool by a solo builder in 1-7 days; avoid ideas needing marketplace liquidity, heavy regulation, medical/legal accuracy, enterprise sales, or hardware.
Return ONLY a JSON array of objects, no prose, each: { name (max 4 words), promise (one sentence), problem (2-3 sentences), evidence (what signal supports this — cite the research note if provided, else explain the reasoning), target_user, why_they_care, usage_frequency (daily/weekly/monthly/occasional), monetization_angle (lead magnet / $9-19/mo / $47-97 lifetime / $197+ premium), build_difficulty_1_10 (number), content_angle }.`;

    // 7. Call Gemini 2.5 Flash
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
            temperature: 1.0,
            maxOutputTokens: 8192,
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

    // 8. Parse JSON safely.
    // responseMimeType:"application/json" is set, but Gemini occasionally still wraps
    // output in ```json fences or adds leading text. The regex below extracts the
    // content between any fences first; if no fences are found it uses the raw text.
    let ideas: unknown[];
    try {
      const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const toParse = (fenced ? fenced[1] : rawText).trim();
      if (!toParse) throw new Error("empty response");
      const parsed = JSON.parse(toParse);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      ideas = parsed;
    } catch (parseErr) {
      console.error("JSON parse failed:", parseErr, "| Raw (first 500):", rawText.slice(0, 500));
      return fail("AI returned invalid JSON — try again.", 502);
    }

    // 9. Success path — deduct credits first, then write audit + project
    const { error: deductErr } = await admin
      .from("profiles")
      .update({ credits: prof.credits - COST })
      .eq("id", user.id);

    if (deductErr) return fail("Could not deduct credits", 500);

    await admin.from("credit_usage").insert({
      user_id: user.id,
      project_id: projectId,
      action: "discover",
      credits_used: COST,
      ai_model: GEMINI_MODEL,
    });

    await supabase
      .from("projects")
      .update({ ideas, status: "discover", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return ok({ ideas });
  } catch (e) {
    console.error("generate-ideas unhandled:", e);
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
