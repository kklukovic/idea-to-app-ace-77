// ── Provider config ───────────────────────────────────────────────────────────
// Change this array to reorder or disable providers. First entry is tried first.
export const AI_PROVIDER_ORDER: Provider[] = ["gemini", "anthropic"];

// Model names — change here, not at call sites.
const GEMINI_MODEL = "gemini-2.5-flash";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Provider = "gemini" | "anthropic";

export type CallAIOpts = {
  system: string;
  prompt: string;
  jsonMode?: boolean;   // force JSON output
  temperature?: number; // 0–1 recommended (Gemini supports up to 2)
  maxTokens?: number;
};

export type AIResult = {
  text: string;
  provider: Provider;
  model: string; // exact model string, safe to log in credit_usage
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call the AI with automatic provider fallback.
 * Tries each provider in AI_PROVIDER_ORDER in sequence.
 * On failure: logs the FULL provider error (status + body) then falls through.
 * Only throws when ALL providers have failed, with each provider's full error included.
 */
export async function callAI(opts: CallAIOpts): Promise<AIResult> {
  const failures: string[] = [];
  const order = AI_PROVIDER_ORDER;

  console.log(`[ai] starting — provider order: ${order.join(", ")}`);

  for (let i = 0; i < order.length; i++) {
    const provider = order[i];
    const next = order[i + 1];

    try {
      console.log(`[ai] trying ${provider} (attempt ${i + 1}/${order.length})`);
      const result = await dispatch(provider, opts);
      console.log(`[ai] ${provider} succeeded — model=${result.model}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ai] ${provider} FAILED: ${msg}`);
      failures.push(`[${provider}] ${msg}`);
      if (next) {
        console.log(`[ai] falling through to ${next}...`);
      }
      // loop continues to next provider
    }
  }

  // Reached only when every provider has been tried and failed
  throw new Error(`All AI providers failed: ${failures.join(" || ")}`);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

function dispatch(provider: Provider, opts: CallAIOpts): Promise<AIResult> {
  switch (provider) {
    case "gemini":    return callGemini(opts);
    case "anthropic": return callAnthropic(opts);
  }
}

// ── Gemini adapter ────────────────────────────────────────────────────────────

async function callGemini(opts: CallAIOpts): Promise<AIResult> {
  // Read and validate key presence — log presence but never the key value
  const key = Deno.env.get("GEMINI_API_KEY");
  console.log(`[ai:gemini] key_present=${!!key}`);
  if (!key) throw new Error("GEMINI_API_KEY secret not set in Supabase");

  const genConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.5,
    maxOutputTokens: opts.maxTokens ?? 8192,
  };
  if (opts.jsonMode) genConfig.responseMimeType = "application/json";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: genConfig,
      }),
    },
  );

  if (!res.ok) {
    // Read full body so Google's actual error message is visible in logs and error
    const body = await res.text();
    console.error(`[ai:gemini] status=${res.status} body=${body}`);
    throw new Error(`Gemini ${res.status}: ${body}`);
  }

  const json = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    const raw = JSON.stringify(json).slice(0, 500);
    console.error(`[ai:gemini] empty text — raw response: ${raw}`);
    throw new Error(`Gemini returned empty text. Raw: ${raw}`);
  }

  return { text, provider: "gemini", model: GEMINI_MODEL };
}

// ── Anthropic adapter ─────────────────────────────────────────────────────────

async function callAnthropic(opts: CallAIOpts): Promise<AIResult> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  console.log(`[ai:anthropic] key_present=${!!key}`);
  if (!key) throw new Error("ANTHROPIC_API_KEY secret not set in Supabase");

  // Anthropic has no native jsonMode — enforce via system instruction
  const system = opts.jsonMode
    ? `${opts.system}

CRITICAL OUTPUT RULES — NON-NEGOTIABLE:
- Output ONLY raw JSON. Nothing else.
- Do NOT wrap the JSON in markdown code fences (no \`\`\`json, no \`\`\`).
- Do NOT include any preamble sentence like "Here is the JSON:" or "Sure, here's...".
- Do NOT include any explanation, commentary, or trailing text after the JSON.
- The FIRST character of your response MUST be { or [.
- The LAST character of your response MUST be } or ].
- Do not truncate. Close every bracket and brace.`
    : opts.system;

  // Clamp temperature to Anthropic's 0–1 range
  const temperature = Math.min(opts.temperature ?? 0.5, 1.0);

  // Haiku 4.5 hard limit is 8192 output tokens
  const max_tokens = Math.min(opts.maxTokens ?? 8192, 8192);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens,
      temperature,
      system,
      messages: [{ role: "user", content: opts.prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[ai:anthropic] status=${res.status} body=${body}`);
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const json = await res.json();
  const text: string = json.content?.[0]?.text ?? "";
  if (!text) {
    const raw = JSON.stringify(json).slice(0, 500);
    console.error(`[ai:anthropic] empty text — raw response: ${raw}`);
    throw new Error(`Anthropic returned empty text. Raw: ${raw}`);
  }

  return { text, provider: "anthropic", model: ANTHROPIC_MODEL };
}
