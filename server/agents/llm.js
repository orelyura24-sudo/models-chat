// Shared LLM client. Groq is OpenAI-compatible, so we use the official `openai`
// SDK and just point it at Groq's base URL.
import OpenAI from "openai";

export const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export const hasKey = () => Boolean(process.env.GROQ_API_KEY);

function getClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    // Force Node's built-in fetch (undici). The SDK's bundled node-fetch shim
    // throws "Premature close" against Groq/Cloudflare on Node 24; global fetch
    // is reliable. (Verified: raw global fetch -> 200, node-fetch shim -> close.)
    fetch: (...args) => fetch(...args),
    maxRetries: 0, // we retry ourselves below
    timeout: 60000,
  });
}

// One chat call with explicit retries for the occasional transient drop.
export async function chat(params, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await getClient().chat.completions.create(params);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}
