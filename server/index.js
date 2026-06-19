import "dotenv/config";
import express from "express";
import cors from "cors";
import { runSimpleAgent } from "./agents/simpleAgent.js";
import { runComplexAgent } from "./agents/complexAgent.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const AGENTS = {
  simple: { run: runSimpleAgent, name: "Simple Agent", description: "Replies with plain text." },
  complex: {
    run: runComplexAgent,
    name: "Complex Agent",
    description: "Fills test data into your prompt and returns an Adaptive Card with native charts.",
  },
};

app.get("/api/agents", (_req, res) => {
  res.json(
    Object.entries(AGENTS).map(([id, a]) => ({ id, name: a.name, description: a.description })),
  );
});

app.post("/api/chat", async (req, res) => {
  const { message, agent } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Field 'message' is required." });
  }
  const selected = AGENTS[agent] ?? AGENTS.simple;
  try {
    const reply = await selected.run(message.trim());
    res.json(reply);
  } catch (err) {
    console.error("[agent error]", err);
    res.status(500).json({ error: "Agent failed", detail: String(err?.message ?? err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
});
