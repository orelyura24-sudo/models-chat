import { useEffect, useRef } from "react";

export default function MessageList({ messages, loading }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="messages">
      {messages.length === 0 && (
        <div className="empty">Pick an agent and send a message to get started.</div>
      )}
      {messages.map((m) => (
        <div key={m.id} className={`bubble ${m.role}`}>
          {m.role === "assistant" && m.agent && (
            <div className="bubble-agent">{m.agent} agent</div>
          )}
          <div className="bubble-text">{m.text}</div>
        </div>
      ))}
      {loading && (
        <div className="bubble assistant">
          <div className="bubble-text typing">…</div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
