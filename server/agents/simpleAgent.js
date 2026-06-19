import { chat, MODEL, hasKey } from "./llm.js";

// The "simple" agent: a real LLM call that returns plain text.
// The only thing that makes it "simple" is its system prompt + no output constraints.
export async function runSimpleAgent(message) {
  if (!hasKey()) {
    return {
      type: "text",
      text:
        `(demo — no GROQ_API_KEY set) You said: "${message}".\n\n` +
        `Add a free Groq key to server/.env to get real answers from the model.`,
    };
  }

  const resp = await chat({
    model: MODEL,
    messages: [
      { role: "system", content: "You are a friendly, concise assistant. Reply in plain text." },
      { role: "user", content: message },
    ],
  });

  return { type: "text", text: resp.choices[0]?.message?.content ?? "" };
}
