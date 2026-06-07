import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Idea = {
  name: string;
  evidence_strength: "Strong" | "Medium" | "Weak";
  target_audience: string;
  core_problem: string;
  evidence_summary: string;
  source_links: Array<{ url: string; title: string; platform: string; engagement?: string }>;
  strongest_signal: string;
  why_fits_user: string;
  usage_frequency: string;
  why_people_keep_paying: string;
  fast_mvp: string;
  unique_angle: string;
  churn_risk: string;
  validation_test: string;
  scores: { pain: number; willingness_to_pay: number; simplicity: number; retention: number; fit: number };
  final_verdict: string;
};

export type ScoredIdea = {
  name: string;
  scores: {
    pain_level: number;
    build_ease: number;
    monetization_potential: number;
    content_potential: number;
    conversation_potential: number;
    founder_offer_potential: number;
  };
  total: number;
  verdict: string;
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const COSTS = { discover: 8, score: 4, blueprint: 10, launch: 8 } as const;
type Action = keyof typeof COSTS;

async function callAI(opts: {
  system: string;
  user: string;
  tool?: { name: string; description: string; parameters: Record<string, unknown> };
}): Promise<unknown> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.tool) {
    body.tools = [{ type: "function", function: opts.tool }];
    body.tool_choice = { type: "function", function: { name: opts.tool.name } };
  }

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("AI rate limit exceeded — try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings → Workspace.");
    throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  if (opts.tool) {
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("AI returned no tool call");
    return JSON.parse(call.function.arguments);
  }
  return data.choices?.[0]?.message?.content ?? "";
}

async function chargeCredits(ctx: { supabase: any; userId: string }, projectId: string, action: Action) {
  const cost = COSTS[action];
  // Atomic deduction via security-definer RPC — prevents TOCTOU race
  const { error: dErr } = await supabaseAdmin.rpc("deduct_credits", {
    _user_id: ctx.userId,
    _cost: cost,
  });
  if (dErr) {
    if ((dErr.message || "").includes("insufficient_credits")) {
      throw new Error(`Not enough credits — need ${cost}`);
    }
    throw new Error("Could not deduct credits");
  }
  // Audit log via service role (INSERT on credit_usage is denied for end users)
  await supabaseAdmin.from("credit_usage").insert({
    user_id: ctx.userId, project_id: projectId, action, credits_used: cost, ai_model: DEFAULT_MODEL,
  });
}

async function refundCredits(userId: string, action: Action) {
  await supabaseAdmin.rpc("refund_credits", { _user_id: userId, _amount: COSTS[action] });
}

async function withRefundOnFailure<T>(userId: string, action: Action, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    await refundCredits(userId, action);
    throw e;
  }
}

const projectIdInput = z.object({ projectId: z.string().uuid() });

// ============= 1. Generate Ideas =============
export const generateIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    projectId: z.string().uuid(),
    researchNotes: z.string().max(20000).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects").select("profile_data, manual_research").eq("id", data.projectId).single();
    if (error || !project?.profile_data) throw new Error("Profile must be saved first");

    // Prefer freshly-passed notes; fall back to whatever is saved on the project
    const manual = data.researchNotes.trim() || project.manual_research?.trim() || "";
    if (data.researchNotes.trim()) {
      await context.supabase.from("projects")
        .update({ manual_research: data.researchNotes })
        .eq("id", data.projectId);
    }

    await chargeCredits(context, data.projectId, "discover");

    const profile = project.profile_data as Record<string, string>;
    const system = `You are an expert app idea researcher and micro-SaaS strategist for solopreneurs.
Rules:
- Each idea must be buildable by a solo builder in 1-7 days
- No generic ideas like "habit tracker" or "AI chatbot for X" without specificity
- Avoid ideas needing marketplace liquidity, regulation, hardware, or enterprise sales
- If research notes are provided, anchor each idea in a specific quoted pain from those notes
- If no research, use AI reasoning grounded in the user's profile + audience`;

    const user = `USER PROFILE:
- What they do: ${profile.expertise}
- Who they help: ${profile.audience}
- What they sell: ${profile.offer}
- Problem area: ${profile.topic || "(not specified)"}
- Preferred tool type: ${profile.tool_type}
- Skill level: ${profile.skill_level}
- Time per week: ${profile.time_per_week}

${manual ? `MANUAL RESEARCH NOTES (paste-in from Reddit/YouTube/calls/emails):\n"""\n${manual}\n"""` : "MODE: Fast AI — no manual research. Lean on the profile + your reasoning."}

Generate 5-7 practical digital tool ideas.`;

    const tool = {
      name: "return_ideas",
      description: "Return researched tool ideas",
      parameters: {
        type: "object",
        properties: {
          ideas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                promise: { type: "string", description: "One sentence: X helps Y do Z" },
                problem: { type: "string" },
                evidence: { type: "string", description: "Quote or paraphrase from research, or reasoning if no research" },
                target_user: { type: "string" },
                why_they_care: { type: "string" },
                usage_frequency: { type: "string", enum: ["daily", "weekly", "monthly", "occasional"] },
                monetization_angle: { type: "string" },
                build_difficulty_1_10: { type: "number" },
                content_angle: { type: "string" },
              },
              required: ["name", "promise", "problem", "evidence", "target_user", "why_they_care", "usage_frequency", "monetization_angle", "build_difficulty_1_10", "content_angle"],
            },
          },
        },
        required: ["ideas"],
      },
    };

    const result = (await callAI({ system, user, tool })) as { ideas: Idea[] };
    await context.supabase.from("projects").update({ ideas: result.ideas as never, status: "discover" }).eq("id", data.projectId);
    return { ideas: result.ideas };
  });

// ============= 2. Score Ideas =============
export const scoreIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => projectIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("projects").select("profile_data, ideas").eq("id", data.projectId).single();
    if (!project?.ideas) throw new Error("Generate ideas first");

    await chargeCredits(context, data.projectId, "score");

    const profile = project.profile_data as Record<string, string>;
    const system = `You evaluate digital tool ideas for a solo founder. Score honestly — most ideas should land 25-45/60.`;
    const user = `USER: skill=${profile.skill_level}, time=${profile.time_per_week}, audience=${profile.audience}

IDEAS:
${JSON.stringify(project.ideas, null, 2)}

Score each 1-10 on: pain_level, build_ease, monetization_potential, content_potential, conversation_potential, founder_offer_potential.`;

    const tool = {
      name: "return_scores",
      description: "Score ideas",
      parameters: {
        type: "object",
        properties: {
          scored: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                scores: {
                  type: "object",
                  properties: {
                    pain_level: { type: "number" },
                    build_ease: { type: "number" },
                    monetization_potential: { type: "number" },
                    content_potential: { type: "number" },
                    conversation_potential: { type: "number" },
                    founder_offer_potential: { type: "number" },
                  },
                  required: ["pain_level", "build_ease", "monetization_potential", "content_potential", "conversation_potential", "founder_offer_potential"],
                },
                total: { type: "number" },
                verdict: { type: "string" },
              },
              required: ["name", "scores", "total", "verdict"],
            },
          },
        },
        required: ["scored"],
      },
    };

    const result = (await callAI({ system, user, tool })) as { scored: ScoredIdea[] };
    result.scored.sort((a, b) => b.total - a.total);
    await context.supabase.from("projects").update({ scored_ideas: result.scored as never, status: "score" }).eq("id", data.projectId);
    return { scored: result.scored };
  });

// ============= 3. Generate Blueprint =============
export const generateBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => projectIdInput.extend({ chosenIdeaName: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("projects").select("profile_data, ideas").eq("id", data.projectId).single();
    if (!project?.ideas) throw new Error("Ideas missing");

    const chosen = (project.ideas as Array<{ name: string }>).find((i) => i.name === data.chosenIdeaName);
    if (!chosen) throw new Error("Chosen idea not found");

    await chargeCredits(context, data.projectId, "blueprint");

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

    const md = (await callAI({ system, user })) as string;
    await context.supabase.from("projects").update({
      blueprint_markdown: md, chosen_idea: chosen, status: "blueprint",
    }).eq("id", data.projectId);
    return { markdown: md };
  });

// ============= 4. Generate Launch Plan =============
export const generateLaunchPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => projectIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("projects").select("profile_data, chosen_idea, blueprint_markdown").eq("id", data.projectId).single();
    if (!project?.chosen_idea) throw new Error("Blueprint must be created first");

    await chargeCredits(context, data.projectId, "launch");

    const profile = project.profile_data as Record<string, string>;
    const idea = project.chosen_idea as Record<string, string>;
    const system = `You are a launch strategist for a solo founder using build-in-public + escalating founders pricing. Every line should be copy-pasteable. No filler.`;
    const user = `PROJECT:
- Tool: ${idea.name}
- Promise: ${idea.promise}
- Target: ${idea.target_user}
- Monetization angle: ${idea.monetization_angle}

FOUNDER:
- Audience: ${profile.audience}
- Reach: solo, organic (FB + LinkedIn + X)
- Time: ${profile.time_per_week}

Generate a complete Launch Kit as Markdown with sections:
## Founder Offer (price, limit, ladder, bonuses)
## Launch Posts
### Facebook (200-300 words, story-driven)
### LinkedIn (150-200 words)
### X / Twitter (hook + 1-2 follow-ups)
## DM Script (initial reply + follow-up + close)
## 7-Day Build-in-Public Calendar
## 30-Day Launch Plan
## $1 Auction Template (Travis Sago style)
## Email Sequence (3 emails)
## 5 Content Angles for Ongoing Posts
## First 10 Actions Today

Return ONLY the markdown, no preamble.`;

    const md = (await callAI({ system, user })) as string;
    await context.supabase.from("projects").update({
      launch_kit_markdown: md, status: "launch",
    }).eq("id", data.projectId);
    return { markdown: md };
  });

// ============= 5. Save profile (no AI) =============
export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    projectId: z.string().uuid(),
    profile: z.object({
      expertise: z.string().min(1).max(2000),
      audience: z.string().min(1).max(500),
      offer: z.string().min(1).max(2000),
      topic: z.string().max(500).optional().default(""),
      tool_type: z.string(),
      skill_level: z.string(),
      time_per_week: z.string(),
    }),
    manual_research: z.string().max(20000).optional().default(""),
    name: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const update = {
      profile_data: data.profile as never,
      manual_research: data.manual_research,
      status: "profile",
      ...(data.name && data.name.trim() ? { name: data.name.trim() } : {}),
    };
    const { error } = await context.supabase.from("projects").update(update).eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Mark completed
export const markCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => projectIdInput.parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("projects").update({ status: "completed" }).eq("id", data.projectId);
    return { ok: true };
  });
