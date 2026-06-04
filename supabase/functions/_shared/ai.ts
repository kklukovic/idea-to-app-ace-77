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
  jsonMode?: boolean;    // force JSON output
  temperature?: number;  // 0–1 recommended (Gemini supports up to 2)
  maxTokens?: number;
};

export type AIResult = {
  text: string;
  provider: Provider;
  model: string;         // exact model string, use this for credit_usage logging
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call the AI with automatic provider fallback.
 * Tries each provider in AI_PROVIDER_ORDER in sequence.
 * Only throws if ALL providers fail — never exposes raw provider errors to callers.
 */
export async function callAI(opts: CallAIOpts): Promise<AIResult> {
  const failures: string[] = [];

  for (const provider of AI_PROVIDER_ORDER) {
    try {
      return await dispatch(provider, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ai] provider=${provider} failed:`, msg);
      failures.push(`${provider}: ${msg}`);
    }
  }

  throw new Error(`AI unavailable — all providers failed. ${failures.join(" | ")}`);
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
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not configured");

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
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Empty response");

  return { text, provider: "gemini", model: GEMINI_MODEL };
}

// ── Anthropic adapter ─────────────────────────────────────────────────────────

async function callAnthropic(opts: CallAIOpts): Promise<AIResult> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  // Anthropic has no native jsonMode — enforce via system instruction.
  const system = opts.jsonMode
    ? `${opts.system}\n\nCRITICAL: Output ONLY valid JSON. No markdown fences, no prose, no explanation before or after.`
    : opts.system;

  // Clamp temperature to Anthropic's 0–1 range.
  const temperature = Math.min(opts.temperature ?? 0.5, 1.0);

  // Haiku 4.5 max output is 8192 tokens — never exceed it.
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
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json.content?.[0]?.text ?? "";
  if (!text) throw new Error("Empty response");

  return { text, provider: "anthropic", model: ANTHROPIC_MODEL };
}
