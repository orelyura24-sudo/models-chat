# Chat + Adaptive Cards

A small chat app:

- **Left:** a React chat. Type a message, pick an agent from the dropdown.
- **Right:** Adaptive Cards (with **native** charts) rendered from the agent's reply.
- **Server:** Node / Express.

## Two agents

Both agents call the same model (via **Groq**, which is free and OpenAI-compatible). The only difference is the system prompt and the output constraint:

| Agent | What it does | How the answer is shaped |
|-------|--------------|--------------------------|
| **Simple** | Returns plain text. | System prompt only — `response.content` is used as-is. |
| **Complex** | Fills the fixed *test data* into a dashboard and returns an **Adaptive Card** JSON with native charts. | **JSON mode** (`response_format: json_object`) forces a `{ summary, card }` object — no fragile text parsing. |

If `GROQ_API_KEY` is not set (or the model is unreachable), the complex agent falls back to a clearly-labelled **static demo card**, and the simple agent returns a demo message — so the UI works end-to-end before you wire up a key.

### Native Adaptive Cards charts

The open-source [`adaptivecards`](https://www.npmjs.com/package/adaptivecards) renderer does not draw `Chart.*` elements (those only render inside Microsoft Teams). So this app registers **custom Adaptive Card elements** via the official `GlobalRegistry` extensibility point and draws them as inline SVG. Supported types (shapes defined once in `client/src/adaptiveCharts.js` and mirrored in the server prompt):

```jsonc
{ "type": "Chart.VerticalBar", "title": "...", "data": [ { "x": "Q1", "y": 280000 } ] }
{ "type": "Chart.Line",        "title": "...", "series": [ { "legend": "Users", "values": [ { "x": "Q1", "y": 40100 } ] } ] }
{ "type": "Chart.Donut",       "title": "...", "data": [ { "legend": "Direct", "value": 45 } ] }
{ "type": "Chart.Pie",         "title": "...", "data": [ { "legend": "EMEA", "value": 410000 } ] }
```

## Run it

Requires Node 18+.

```bash
# 1. install everything (root tooling + server + client)
npm run install:all

# 2. (optional but recommended) add a free Groq key
#    get one at https://console.groq.com -> API Keys (no credit card)
#    copy server/.env.example -> server/.env and fill in GROQ_API_KEY

# 3. start the server (port 3001) and client (port 5173) together
npm run dev
```

Then open http://localhost:5173. The Vite dev server proxies `/api` to the Node server, so there are no CORS issues.

> Prefer two terminals? Run `npm run dev:server` and `npm run dev:client` separately.

## Project layout

```
server/
  index.js               Express app: /api/agents, /api/chat
  agents/llm.js          shared Groq (OpenAI-compatible) client
  agents/simpleAgent.js  plain-text agent
  agents/complexAgent.js JSON-mode card generation + static fallback card
  agents/testData.js     the fixed test data substituted into prompts
client/
  src/App.jsx            two-pane layout + chat state
  src/adaptiveCharts.js  custom Chart.* Adaptive Card elements (SVG)
  src/components/        AdaptiveCardView, RenderPanel, MessageList, AgentSelector
```

## Try these prompts (Complex agent)

- `Quarterly revenue dashboard with a channel breakdown`
- `Show the active-users trend as a line chart and key KPIs`
- `Compare revenue by region`
