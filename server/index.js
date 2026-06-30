import "dotenv/config";
import express from "express";
import cors from "cors";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./graph.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const AGENTS = [
  { id: "auto", name: "Auto (router)", description: "A LangGraph node picks the agent for you." },
  { id: "simple", name: "Simple Agent", description: "Plain-text reply." },
  { id: "complex", name: "Complex Agent", description: "Adaptive Card with native charts/tables." },
];

app.get("/api/agents", (_req, res) => res.json(AGENTS));

app.post("/api/chat", async (req, res) => {
  const { message, agent, threadId } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Field 'message' is required." });
  }
  try {
    const result = await graph.invoke(
      { messages: [new HumanMessage(message.trim())], agentChoice: agent || "auto" },
      { configurable: { thread_id: threadId || "default" } },
    );
    res.json({ ...result.reply, route: result.route });
  } catch (err) {
    console.error("[graph error]", err);
    res.status(500).json({ error: "Graph failed", detail: String(err?.message ?? err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Chat server (LangGraph) on http://localhost:${PORT}`);
});
