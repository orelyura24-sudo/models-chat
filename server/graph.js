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
async function classifyRoute(messages) {
  if (!hasKey()) return "simple";
  try {
    const resp = await chat({
      model: MODEL,
      max_tokens: 4,
      messages: [
        {
          role: "system",
          content:
            "Decide what the user wants. Reply with exactly one word: 'complex' if they want a visual " +
            "card, table, chart, dashboard, or any rendered UI; otherwise 'simple' for a plain text answer.",
        },
        { role: "user", content: lastUserText(messages) },
      ],
    });
    return (resp.choices[0]?.message?.content || "").toLowerCase().includes("complex") ? "complex" : "simple";
  } catch {
    return "simple";
  }
}

async function routerNode(state) {
  const choice = state.agentChoice || "auto";
  if (choice === "simple" || choice === "complex") return { route: choice };
  return { route: await classifyRoute(state.messages) };
}

// ---- Leaf nodes ----
async function textNode(state) {
  let text;
  try {
    text = await generateText(toOpenAI(state.messages));
  } catch (err) {
    text = `⚠️ Text agent error: ${String(err?.message ?? err)}`;
  }
  return { messages: [new AIMessage(text)], reply: { type: "text", text } };
}

async function cardNode(state) {
  const latest = lastUserText(state.messages);
  const { summary, card } = await generateCard(toOpenAI(state.messages), latest);
  // Store a short text trace in memory (not the whole card JSON).
  return {
    messages: [new AIMessage(`[card] ${summary}`)],
    reply: { type: "adaptive_card", prompt: latest, summary, card },
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
