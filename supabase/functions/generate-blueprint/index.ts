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

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData.user;
    if (authErr || !user) return fail("Unauthorized", 401);

    // 2. Parse body
    const { projectId } = await req.json();
    if (!projectId) return fail("projectId required", 400);

    // 3. Load project (RLS enforces ownership)
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("chosen_idea, profile_data")
      .eq("id", projectId)
      .single();

    if (projErr || !project) return fail("Project not found", 404);
    if (!project.chosen_idea) return fail("Choose an idea first", 400);
    if (!project.profile_data) return fail("Profile data missing", 400);

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
    const idea = project.chosen_idea as Record<string, unknown>;
    const profile = project.profile_data as Record<string, string>;

    const prompt =
      `You are a senior product manager writing a build-ready blueprint for a solo founder using AI builders (Lovable, Codex).
CHOSEN IDEA: ${JSON.stringify(idea)}
CONTEXT: skill level ${profile.skill_level}, stack Lovable + Supabase, time ${profile.time_per_week}.
Output Markdown with these exact sections:
# Tool Name
## One-Sentence Promise
## Problem Statement
(3-5 sentences)
## Target User Persona
(job, pain, current workaround, willingness to pay)
## MVP Version
IN (max 5 features), OUT (max 5 explicit exclusions)
## Full Version
5-7 v2+ features
## Core Features
Prioritized list, MVP features marked
## User Flow
Numbered steps: landing → conversion → core use
## Screens Needed
Each screen with a one-line purpose
## Database Schema
Supabase tables with key columns
## Tech Stack
Builder + Supabase + AI model if any + 3rd party APIs
## Success Metrics
First 30 days

## Lovable Build Prompt
\`\`\`
[A complete, copy-paste-ready Lovable build prompt, 300-500 words. Be concrete and specific — describe every screen, data model, and feature. No generic filler.]
\`\`\`

Be concrete and buildable. No generic filler.`;

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
    const markdown: string =
      geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!markdown.trim()) {
      return fail("AI returned empty response — try again.", 502);
    }

    // 7. Deduct credits (only after successful generation)
    const { error: deductErr } = await admin
      .from("profiles")
      .update({ credits: prof.credits - COST })
      .eq("id", user.id);
    if (deductErr) return fail("Could not deduct credits", 500);

    // 8. Audit log
    await admin.from("credit_usage").insert({
      user_id: user.id,
      project_id: projectId,
      action: "blueprint",
      credits_used: COST,
      ai_model: GEMINI_MODEL,
    });

    // 9. Persist results
    await supabase
      .from("projects")
      .update({
        blueprint_markdown: markdown,
        status: "blueprint",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return ok({ markdown });
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
