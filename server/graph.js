// LangGraph.js graph: router -> (text | card), with conversation memory.
//
//          ┌────────┐
//  START → │ router │  agent="auto" -> LLM classifier; else manual choice
//          └───┬────┘
//      simple  │  complex
//        ┌─────┴─────┐
//        │           │
//     ┌──┴──┐     ┌──┴──┐
//     │text │     │card │  → END
//     └─────┘     └─────┘
//
// state.messages is the shared memory, persisted per thread by MemorySaver.

import { Annotation, MessagesAnnotation, StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { chat, MODEL, hasKey } from "./agents/llm.js";
import { generateText } from "./agents/textAgent.js";
import { generateCard } from "./agents/cardAgent.js";

// ---- State ----
const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec, // `messages`: conversation history (append reducer)
  agentChoice: Annotation(), // input: "auto" | "simple" | "complex"
  route: Annotation(), // resolved by the router: "simple" | "complex"
  reply: Annotation(), // output object returned to the client
  lastCard: Annotation(), // the most recent card JSON, so follow-ups can edit it
});

// ---- Helpers: LangChain messages <-> OpenAI chat format ----
function msgType(m) {
  return typeof m.getType === "function" ? m.getType() : m._getType();
}
function asString(content) {
  return typeof content === "string" ? content : JSON.stringify(content);
}
function toOpenAI(messages) {
  // keep the last few turns so the prompt stays small but has memory
  return messages.slice(-10).map((m) => {
    const t = msgType(m);
    return { role: t === "human" ? "user" : t === "ai" ? "assistant" : "system", content: asString(m.content) };
  });
}
function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (msgType(messages[i]) === "human") return asString(messages[i].content);
  }
  return "";
}

// ---- Router: pick the agent ----
async function classifyRoute(messages, signal) {
  if (!hasKey()) return "simple";
  // Give the classifier recent context, not just the last line — so feedback on a
  // card ("there's no data", "add a column") keeps routing to the card branch.
  // Assistant card turns are stored as "[card] ..." in the history.
  const recent = messages
    .slice(-5)
    .map((m) => `${msgType(m) === "human" ? "User" : "Assistant"}: ${asString(m.content)}`)
    .join("\n");
  try {
    const resp = await chat(
      {
        model: MODEL,
        max_tokens: 4,
        messages: [
          {
            role: "system",
            content:
              "You route a chat conversation. Reply with exactly ONE word.\n" +
              "Reply 'complex' if the latest user message wants a visual card, table, chart, or dashboard — " +
              "OR is feedback / a change request about a card the assistant just made (assistant card turns " +
              "look like '[card] ...'), e.g. 'no data', 'add a column', 'make it bigger'.\n" +
              "Reply 'simple' only for a standalone plain-text question or chit-chat.",
          },
          { role: "user", content: recent },
        ],
      },
      { signal },
    );
    return (resp.choices[0]?.message?.content || "").toLowerCase().includes("complex") ? "complex" : "simple";
  } catch (err) {
    if (signal?.aborted) throw err; // cancelled — let the graph stop
    return "simple";
  }
}

// Nodes receive (state, config); config.signal is the AbortSignal for cancellation.
async function routerNode(state, config) {
  const choice = state.agentChoice || "auto";
  if (choice === "simple" || choice === "complex") return { route: choice };
  return { route: await classifyRoute(state.messages, config?.signal) };
}

// ---- Leaf nodes ----
async function textNode(state, config) {
  let text;
  try {
    text = await generateText(toOpenAI(state.messages), config?.signal);
  } catch (err) {
    if (config?.signal?.aborted) throw err; // cancelled — propagate
    text = `⚠️ Text agent error: ${String(err?.message ?? err)}`;
  }
  return { messages: [new AIMessage(text)], reply: { type: "text", text } };
}

async function cardNode(state, config) {
  const latest = lastUserText(state.messages);
  // Pass the previous card so "add a button" edits it instead of regenerating.
  const { summary, card } = await generateCard(toOpenAI(state.messages), latest, config?.signal, state.lastCard);
  return {
    messages: [new AIMessage(`[card] ${summary}`)], // short trace in chat memory
    reply: { type: "adaptive_card", prompt: latest, summary, card },
    lastCard: card, // remember the full card for the next edit
  };
}

// ---- Wire the graph ----
const builder = new StateGraph(GraphState)
  .addNode("router", routerNode)
  .addNode("text", textNode)
  .addNode("card", cardNode)
  .addEdge(START, "router")
  .addConditionalEdges("router", (state) => state.route, { simple: "text", complex: "card" })
  .addEdge("text", END)
  .addEdge("card", END);

export const graph = builder.compile({ checkpointer: new MemorySaver() });
