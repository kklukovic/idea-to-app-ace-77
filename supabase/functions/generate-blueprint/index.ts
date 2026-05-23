import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_MODEL = "gemini-2.5-flash";
const COST = 10;

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
    const { projectId, chosenIdeaName } = await req.json();
    if (!projectId) return fail("projectId required", 400);
    if (!chosenIdeaName) return fail("chosenIdeaName required", 400);

    // 3. Load project (RLS enforces ownership)
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("ideas, profile_data")
      .eq("id", projectId)
      .single();

    if (projErr || !project) return fail("Project not found", 404);
    if (!project.ideas) return fail("Generate ideas first", 400);
    if (!project.profile_data) return fail("Profile data missing", 400);

    // 4. Find chosen idea
    const chosen = (project.ideas as Array<{ name: string }>).find(
      (i) => i.name === chosenIdeaName,
    );
    if (!chosen) return fail("Chosen idea not found", 400);

    // 5. Read credits — service role bypasses the column-level grant
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

    // 6. Build Gemini prompt
    const profile = project.profile_data as Record<string, string>;
    const system = `You are a senior PM generating a build-ready PRD for a solo founder using AI builders (Lovable, Bolt). Be concrete. No filler.`;
    const user = `CHOSEN IDEA:
${JSON.stringify(chosen, null, 2)}

CONTEXT: skill=${profile.skill_level}, time=${profile.time_per_week}, stack=Lovable+Supabase

Generate a complete PRD in Markdown with these exact sections:
# {Tool Name}
## One-Sentence Promise
## Problem Statement
## Target User Persona
## MVP Version (IN — max 5 / OUT — max 5)
## Full Version (v2+)
## Core Features (prioritized)
## User Flow
## Screens Needed
## Database Schema (Supabase Postgres)
## Tech Stack
## Success Metrics

Then at the very end:
## Lovable Build Prompt
\`\`\`
[A complete, copy-paste-ready Lovable prompt, 300-500 words]
\`\`\`

Return ONLY the markdown, no preamble.`;

    // 7. Call Gemini 2.5 Flash
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return fail("GEMINI_API_KEY not configured", 500);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "model", parts: [{ text: system }] },
            { role: "user", parts: [{ text: user }] },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
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
    const md: string =
      geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!md || md.trim().length < 50) {
      console.error("Gemini returned empty or near-empty text");
      return fail("AI returned empty response — try again.", 502);
    }

    // 8. Success path — deduct credits first, then write audit + project
    const { error: deductErr } = await admin
      .from("profiles")
      .update({ credits: prof.credits - COST })
      .eq("id", user.id);

    if (deductErr) return fail("Could not deduct credits", 500);

    await admin.from("credit_usage").insert({
      user_id: user.id,
      project_id: projectId,
      action: "blueprint",
      credits_used: COST,
      ai_model: GEMINI_MODEL,
    });

    await supabase
      .from("projects")
      .update({
        blueprint_markdown: md,
        chosen_idea: chosen,
        status: "blueprint",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return ok({ markdown: md });
  } catch (e) {
    console.error("generate-blueprint unhandled:", e);
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
