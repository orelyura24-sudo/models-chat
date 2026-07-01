// REST: just the agents list. Chat now flows over the WebSocket (see App.jsx).
export async function fetchAgents() {
  const res = await fetch("/api/agents");
  if (!res.ok) throw new Error("Failed to load agents");
  return res.json();
}
