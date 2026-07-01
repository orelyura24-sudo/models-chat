import { useEffect, useRef, useState } from "react";
import { fetchAgents } from "./api.js";
import AgentSelector from "./components/AgentSelector.jsx";
import MessageList from "./components/MessageList.jsx";
import RenderPanel from "./components/RenderPanel.jsx";

let idCounter = 0;
const nextId = () => `${Date.now()}-${idCounter++}`;

const newThreadId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}`;

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

export default function App() {
  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState("auto");
  const [messages, setMessages] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveTrace, setLiveTrace] = useState([]); // nodes lighting up during a run
  const [connected, setConnected] = useState(false);
  const [threadId] = useState(newThreadId);

  const wsRef = useRef(null);
  const traceRef = useRef([]); // accumulates the in-flight trace (avoids stale closures)
  const agentRef = useRef(agent); // agent chosen when the request was sent

  // Open one WebSocket for the whole session.
  useEffect(() => {
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      let ev;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      handleEvent(ev);
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAgents().then(setAgents).catch(() => {});
  }, []);

  function handleEvent(ev) {
    if (ev.type === "start") {
      traceRef.current = [];
      setLiveTrace([]);
      setLoading(true);
    } else if (ev.type === "node") {
      traceRef.current = [...traceRef.current, { node: ev.node, route: ev.route }];
      setLiveTrace(traceRef.current);
    } else if (ev.type === "done") {
      finishTurn(ev.reply, ev.route);
    } else if (ev.type === "cancelled") {
      setMessages((m) => [...m, { id: nextId(), role: "error", text: "⏹ Stopped." }]);
      resetRun();
    } else if (ev.type === "error") {
      setMessages((m) => [...m, { id: nextId(), role: "error", text: ev.error }]);
      resetRun();
    }
  }

  function finishTurn(reply, route) {
    const meta = agentRef.current === "auto" ? `auto → ${route ?? "?"}` : agentRef.current;
    const trace = traceRef.current;
    if (reply?.type === "adaptive_card") {
      setArtifacts((a) => [{ id: nextId(), prompt: reply.prompt, card: reply.card }, ...a]);
      setMessages((m) => [...m, { id: nextId(), role: "assistant", meta, trace, text: `📊 ${reply.summary}` }]);
    } else {
      setMessages((m) => [...m, { id: nextId(), role: "assistant", meta, trace, text: reply?.text ?? "" }]);
    }
    resetRun();
  }

  function resetRun() {
    traceRef.current = [];
    setLiveTrace([]);
    setLoading(false);
  }

  function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setMessages((m) => [...m, { id: nextId(), role: "error", text: "Not connected to the server." }]);
      return;
    }
    agentRef.current = agent;
    setMessages((m) => [...m, { id: nextId(), role: "user", text }]);
    setInput("");
    ws.send(JSON.stringify({ type: "chat", message: text, agent, threadId }));
  }

  function handleStop() {
    wsRef.current?.send(JSON.stringify({ type: "cancel" }));
  }

  const placeholder =
    agent === "complex"
      ? "e.g. Show a quarterly revenue dashboard with a channel breakdown"
      : agent === "auto"
        ? "Ask anything — the router picks text vs card"
        : "Type a message…";

  return (
    <div className="app">
      <section className="chat-pane">
        <header className="chat-header">
          <h1>
            Chat <span className={`dot ${connected ? "on" : "off"}`} title={connected ? "connected" : "disconnected"} />
          </h1>
          <AgentSelector agents={agents} value={agent} onChange={setAgent} />
        </header>
        <MessageList messages={messages} loading={loading} liveTrace={liveTrace} />
        <form className="composer" onSubmit={handleSend}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            aria-label="Message"
          />
          {loading ? (
            <button type="button" className="stop" onClick={handleStop}>
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()}>
              Send
            </button>
          )}
        </form>
      </section>
      <RenderPanel artifacts={artifacts} />
    </div>
  );
}
