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

function systemPrompt(data, previousCard) {
  const base = (
    `You build Microsoft Adaptive Cards (schema http://adaptivecards.io/schemas/adaptive-card.json, version "1.5").\n\n` +
    `Build a card that does EXACTLY what the user asks — no more, no less. Read their wording and match it:\n` +
    `- Asked for a table? Return a table with the columns they named. Asked for a chart? Return that chart.\n` +
    `- Asked for both? Include both. Otherwise DO NOT add extra elements.\n` +
    `- A chart is OPTIONAL: include a chart element ONLY when the user asks for a chart / graph / plot / ` +
    `visualization (or clearly wants one). If they ask only for a table or only for text, do NOT add any chart.\n\n` +
    `Respond with a single JSON object and NOTHING ELSE, in exactly this shape:\n` +
    `{ "summary": "one short sentence for the chat", "card": { ...the Adaptive Card... } }\n` +
    `Output the raw JSON object only — no markdown, no code fences, no prose before or after it.\n` +
    `- "card" MUST be a complete AdaptiveCard: { "type": "AdaptiveCard", "version": "1.5", "body": [ ... ] }. ` +
    `Never return a bare element (e.g. a Table) as the card — always wrap elements in "body".\n` +
    `- Any Table MUST have a header row plus at least 3-4 data rows. Never output an empty table.\n\n` +
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

  if (!previousCard) return base;
  return (
    base +
    `\n\nREFINEMENT MODE — the user is editing the EXISTING card below. Start from this exact card and apply ` +
    `ONLY the change they asked for. Copy every other element, text string, and number VERBATIM — ` +
    `character for character — do not reword, rename, re-randomize, or reorder anything. ` +
    `(e.g. "add a button" = the identical table plus a new button.) Return the full updated AdaptiveCard.\n` +
    `CURRENT CARD JSON:\n${JSON.stringify(previousCard)}`
  );
}

// Adaptive-card agent. Receives the conversation history (OpenAI message format,
// already includes the latest user turn) so follow-ups like "add a chart to that"
// have context. Returns { summary, card }.
export async function generateCard(history, latestText, signal, previousCard) {
  const data = makeTestData();

  if (!hasKey()) {
    return {
      summary: "Demo card (no GROQ_API_KEY set) — add a key to server/.env to generate cards with the model.",
      card: buildFallbackCard(latestText, data, "No API key — showing a static demo card."),
    };
  }

  try {
    const resp = await chat(
      {
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: "system", content: systemPrompt(data, previousCard) }, ...history],
      },
      { signal },
    );
    const parsed = extractJson(resp.choices[0]?.message?.content ?? "");
    const card = normalizeCard(parsed?.card);
    if (!card) throw new Error("Model returned no usable card.");
    return { summary: parsed.summary || "Built an Adaptive Card from your prompt.", card };
  } catch (err) {
    if (signal?.aborted) throw err; // cancelled — let the graph stop
    console.error("[cardAgent] falling back:", err?.message ?? err);
    return {
      summary: `Model call failed (${String(err?.message ?? err)}) — showing a static demo card.`,
      card: buildFallbackCard(latestText, data, "Model unavailable — static demo card."),
    };
  }
}

// Models sometimes return a bare element (e.g. a Table) or an array instead of a
// full AdaptiveCard. Wrap whatever we get into a valid AdaptiveCard so it renders.
function wrap(body) {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body,
  };
}

function normalizeCard(card) {
  if (!card || typeof card !== "object") return null;
  if (Array.isArray(card)) return wrap(card);
  if (card.type === "AdaptiveCard") {
    card.body = Array.isArray(card.body) ? card.body : [];
    card.version = card.version || "1.5";
    card.$schema = card.$schema || "http://adaptivecards.io/schemas/adaptive-card.json";
    return card;
  }
  if (Array.isArray(card.body)) return wrap(card.body); // has a body but missing the type
  return wrap([card]); // a single bare element like Table
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
