import { useEffect, useState } from "react";
import { fetchAgents, sendMessage } from "./api.js";
import AgentSelector from "./components/AgentSelector.jsx";
import MessageList from "./components/MessageList.jsx";
import RenderPanel from "./components/RenderPanel.jsx";

let idCounter = 0;
const nextId = () => `${Date.now()}-${idCounter++}`;

const newThreadId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}`;

export default function App() {
  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState("auto");
  const [messages, setMessages] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // One conversation thread per page load — this is the key the graph's memory
  // (MemorySaver) uses to keep history.
  const [threadId] = useState(newThreadId);

  useEffect(() => {
    fetchAgents()
      .then(setAgents)
      .catch(() => {});
  }, []);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((m) => [...m, { id: nextId(), role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendMessage(text, agent, threadId);
      // For "auto" show what the router decided; otherwise show the chosen agent.
      const meta = agent === "auto" ? `auto → ${reply.route ?? "?"}` : agent;

      if (reply.type === "adaptive_card") {
        const artifact = { id: nextId(), prompt: reply.prompt, card: reply.card };
        setArtifacts((a) => [artifact, ...a]);
        setMessages((m) => [...m, { id: nextId(), role: "assistant", meta, text: `📊 ${reply.summary}` }]);
      } else {
        setMessages((m) => [...m, { id: nextId(), role: "assistant", meta, text: reply.text }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { id: nextId(), role: "error", text: err.message }]);
    } finally {
      setLoading(false);
    }
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
          <h1>Chat</h1>
          <AgentSelector agents={agents} value={agent} onChange={setAgent} />
        </header>
        <MessageList messages={messages} loading={loading} />
        <form className="composer" onSubmit={handleSend}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            aria-label="Message"
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </section>
      <RenderPanel artifacts={artifacts} />
    </div>
  );
}
