export default function AgentSelector({ agents, value, onChange }) {
  return (
    <label className="agent-selector">
      <span className="agent-selector-label">Agent</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {agents.length === 0 && <option value="simple">Simple Agent</option>}
        {agents.map((a) => (
          <option key={a.id} value={a.id} title={a.description}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
