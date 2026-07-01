import { chat, MODEL, hasKey } from "./llm.js";

// Plain-text agent. Receives the conversation history (OpenAI message format,
// already includes the latest user turn) so it has memory of earlier messages.
// `signal` allows the call to be cancelled.
export async function generateText(history, signal) {
  if (!hasKey()) {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    return (
      `(demo — no GROQ_API_KEY set) You said: "${lastUser?.content ?? ""}".\n\n` +
      `Add a free Groq key to server/.env to get real answers from the model.`
    );
  }

  const resp = await chat(
    {
      model: MODEL,
      messages: [
        { role: "system", content: "You are a friendly, concise assistant. Reply in plain text." },
        ...history,
      ],
    },
    { signal },
  );

  return resp.choices[0]?.message?.content ?? "";
}
