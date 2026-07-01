import { useEffect, useRef } from "react";

function chipLabel(t) {
  return t.node === "router" ? `router → ${t.route ?? "…"}` : t.node;
}

function Trace({ items, live }) {
  if (!items?.length) return null;
  return (
    <div className={`trace ${live ? "live" : ""}`}>
      {items.map((t, i) => (
        <span key={i} className="trace-chip">
          {chipLabel(t)} {live ? "✓" : ""}
        </span>
      ))}
    </div>
  );
}

export default function MessageList({ messages, loading, liveTrace }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, liveTrace]);

  return (
    <div className="messages">
      {messages.length === 0 && (
        <div className="empty">Pick an agent and send a message to get started.</div>
      )}
      {messages.map((m) => (
        <div key={m.id} className={`bubble ${m.role}`}>
          {m.role === "assistant" && m.meta && <div className="bubble-agent">{m.meta}</div>}
          <div className="bubble-text">{m.text}</div>
          {m.role === "assistant" && <Trace items={m.trace} />}
        </div>
      ))}
      {loading && (
        <div className="bubble assistant">
          {liveTrace?.length ? <Trace items={liveTrace} live /> : <div className="bubble-text typing">…</div>}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
