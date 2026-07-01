import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
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

// ---- WebSocket: stream the graph node-by-node, allow cancellation ----
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

wss.on("connection", (ws) => {
  ws.controller = null; // AbortController for the in-flight run, if any

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "cancel") {
      ws.controller?.abort();
      return;
    }
    if (msg.type !== "chat") return;

    const { message, agent, threadId } = msg;
    if (typeof message !== "string" || !message.trim()) {
      return send(ws, { type: "error", error: "Field 'message' is required." });
    }

    ws.controller?.abort(); // cancel any previous run on this socket
    const controller = new AbortController();
    ws.controller = controller;

    send(ws, { type: "start" });
    let route;
    let reply;
    try {
      const stream = await graph.stream(
        { messages: [new HumanMessage(message.trim())], agentChoice: agent || "auto" },
        { configurable: { thread_id: threadId || "default" }, streamMode: "updates", signal: controller.signal },
      );
      // Each chunk is { nodeName: nodeUpdate } — emitted as the node finishes.
      for await (const chunk of stream) {
        for (const [node, update] of Object.entries(chunk)) {
          if (update?.route) route = update.route;
          if (update?.reply) reply = update.reply;
          send(ws, { type: "node", node, route: update?.route, reply: update?.reply });
        }
      }
      send(ws, { type: "done", reply, route });
    } catch (err) {
      if (controller.signal.aborted) send(ws, { type: "cancelled" });
      else send(ws, { type: "error", error: String(err?.message ?? err) });
    } finally {
      if (ws.controller === controller) ws.controller = null;
    }
  });

  // Stop the graph if the client disconnects mid-run.
  ws.on("close", () => ws.controller?.abort());
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Chat server (LangGraph + WebSocket) on http://localhost:${PORT}`);
});
