import { chat, MODEL, hasKey } from "./llm.js";
import { makeTestData } from "./testData.js";

// The custom Adaptive Card chart elements the React renderer understands.
// This contract is shared with client/src/adaptiveCharts.js — keep them in sync.
const CHART_SCHEMA = `
Optional custom chart ELEMENTS (use ONLY when the user asks for a chart/graph/plot).
Place them anywhere inside the card "body". Use ONLY these shapes:

- { "type": "Chart.VerticalBar", "title": "string?",
    "data": [ { "x": "Q1", "y": 280000, "color": "#2563eb?" }, ... ] }

- { "type": "Chart.Line", "title": "string?",
    "series": [ { "legend": "Users", "color": "#16a34a?",
                  "values": [ { "x": "Q1", "y": 40100 }, ... ] }, ... ] }

- { "type": "Chart.Donut", "title": "string?",
    "data": [ { "legend": "Direct", "value": 45, "color": "#2563eb?" }, ... ] }

- { "type": "Chart.Pie", "title": "string?",
    "data": [ { "legend": "EMEA", "value": 410000 }, ... ] }

"color" is optional; omit it to use the default palette. "x"/"legend" are labels,
"y"/"value" are numbers.`;

const TABLE_SCHEMA = `
Real multi-column TABLE (renders natively):
{ "type": "Table", "firstRowAsHeaders": true,
  "columns": [ { "width": 1 }, { "width": 1 } ],
  "rows": [
    { "type": "TableRow", "cells": [
      { "type": "TableCell", "items": [ { "type": "TextBlock", "text": "Report name", "weight": "Bolder" } ] },
      { "type": "TableCell", "items": [ { "type": "TextBlock", "text": "Status", "weight": "Bolder" } ] }
    ]},
    { "type": "TableRow", "cells": [
      { "type": "TableCell", "items": [ { "type": "TextBlock", "text": "Q4 revenue", "wrap": true } ] },
      { "type": "TableCell", "items": [ { "type": "TextBlock", "text": "Ready" } ] }
    ]}
  ]
}`;

function systemPrompt(data) {
  return (
    `You build Microsoft Adaptive Cards (schema http://adaptivecards.io/schemas/adaptive-card.json, version "1.5").\n\n` +
    `Build a card that does EXACTLY what the user asks — no more, no less. Read their wording and match it:\n` +
    `- Asked for a table? Return a table with the columns they named. Asked for a chart? Return that chart.\n` +
    `- Asked for both? Include both. Otherwise DO NOT add extra elements.\n` +
    `- A chart is OPTIONAL: include a chart element ONLY when the user asks for a chart / graph / plot / ` +
    `visualization (or clearly wants one). If they ask only for a table or only for text, do NOT add any chart.\n\n` +
    `Respond with a single JSON object and NOTHING ELSE, in exactly this shape:\n` +
    `{ "summary": "one short sentence for the chat", "card": { ...the Adaptive Card... } }\n` +
    `Output the raw JSON object only — no markdown, no code fences, no prose before or after it.\n\n` +
    `Elements you can use: TextBlock, ColumnSet/Column, FactSet, Container, the Table element, and the ` +
    `optional chart elements. Pick only the ones the request calls for.\n\n` +
    `DATA: a sample dataset is provided below. Use it when the request relates to it (revenue, quarters, ` +
    `channels, regions). If the user asks for something the sample doesn't contain (e.g. a list of reports ` +
    `with names and statuses), generate a few realistic, clearly-illustrative rows yourself.\n\n` +
    `SAMPLE DATA (JSON):\n${JSON.stringify(data, null, 2)}\n` +
    TABLE_SCHEMA +
    "\n" +
    CHART_SCHEMA
  );
}

// Adaptive-card agent. Receives the conversation history (OpenAI message format,
// already includes the latest user turn) so follow-ups like "add a chart to that"
// have context. Returns { summary, card }.
export async function generateCard(history, latestText) {
  const data = makeTestData();

  if (!hasKey()) {
    return {
      summary: "Demo card (no GROQ_API_KEY set) — add a key to server/.env to generate cards with the model.",
      card: buildFallbackCard(latestText, data, "No API key — showing a static demo card."),
    };
  }

  try {
    const resp = await chat({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: "system", content: systemPrompt(data) }, ...history],
    });
    const parsed = extractJson(resp.choices[0]?.message?.content ?? "");
    if (!parsed?.card) throw new Error("Model returned no 'card' field.");
    return { summary: parsed.summary || "Built an Adaptive Card from your prompt.", card: parsed.card };
  } catch (err) {
    console.error("[cardAgent] falling back:", err?.message ?? err);
    return {
      summary: `Model call failed (${String(err?.message ?? err)}) — showing a static demo card.`,
      card: buildFallbackCard(latestText, data, "Model unavailable — static demo card."),
    };
  }
}

// Pull the JSON object out of a model reply, tolerating code fences / stray prose.
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in the model reply.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

// ---- Deterministic fallback card (also documents the exact JSON the renderer expects) ----

function buildFallbackCard(message, data, note) {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      { type: "TextBlock", size: "Large", weight: "Bolder", text: `${data.company} — ${data.period}`, wrap: true },
      { type: "TextBlock", text: note, wrap: true, isSubtle: true, spacing: "None", color: "Attention" },
      { type: "TextBlock", text: `Prompt: ${message}`, wrap: true, isSubtle: true, spacing: "Small" },
      {
        type: "ColumnSet",
        spacing: "Medium",
        columns: [
          metricColumn("Revenue", `$${num(data.kpis.revenue)}`),
          metricColumn("Growth", `+${data.kpis.growthPct}%`),
          metricColumn("Active users", num(data.kpis.activeUsers)),
        ],
      },
      {
        type: "Chart.VerticalBar",
        title: "Revenue by quarter",
        data: data.quarterly.map((q) => ({ x: q.quarter, y: q.revenue })),
      },
      {
        type: "Chart.Line",
        title: "Active users trend",
        series: [{ legend: "Users", values: data.quarterly.map((q) => ({ x: q.quarter, y: q.users })) }],
      },
      {
        type: "Chart.Donut",
        title: "Revenue by channel",
        data: data.channels.map((c) => ({ legend: c.name, value: c.share })),
      },
      {
        type: "FactSet",
        facts: data.regions.map((r) => ({ title: r.region, value: `$${num(r.revenue)}` })),
      },
    ],
    actions: [{ type: "Action.OpenUrl", title: "About Adaptive Cards", url: "https://adaptivecards.io" }],
  };
}

function metricColumn(label, value) {
  return {
    type: "Column",
    width: "stretch",
    items: [
      { type: "TextBlock", text: label, isSubtle: true, size: "Small", wrap: true },
      { type: "TextBlock", text: value, size: "ExtraLarge", weight: "Bolder", wrap: true },
    ],
  };
}

function num(n) {
  return Number(n).toLocaleString("en-US");
}
