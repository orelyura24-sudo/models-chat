import "dotenv/config";
import { graph } from "./graph.js";
import { HumanMessage } from "@langchain/core/messages";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cfg = (t) => ({ configurable: { thread_id: t } });

function walk(node, fn) {
  if (!node || typeof node !== "object") return;
  fn(node);
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) v.forEach((x) => walk(x, fn));
    else if (v && typeof v === "object") walk(v, fn);
  }
}
function firstTableData(card) {
  let table = null;
  walk(card, (n) => {
    if (n.type === "Table" && !table) table = n;
  });
  if (!table?.rows) return null;
  const dataRow = table.firstRowAsHeaders ? table.rows[1] : table.rows[0];
  const tb = dataRow?.cells?.[0]?.items?.find((i) => i.type === "TextBlock");
  return tb?.text ?? null;
}
function hasButton(card) {
  let found = Array.isArray(card.actions) && card.actions.length > 0;
  walk(card, (n) => {
    if (typeof n.type === "string" && (n.type === "ActionSet" || n.type.startsWith("Action."))) found = true;
  });
  return found;
}
const bodyTypes = (card) => (card?.body || []).map((b) => b.type).join(", ");

let r1 = await graph.invoke(
  { messages: [new HumanMessage("Give me a table with random data")], agentChoice: "auto" },
  cfg("edit1"),
);
const d1 = firstTableData(r1.reply.card);
console.log(`TURN1 route=${r1.route} body=[${bodyTypes(r1.reply.card)}] firstData=${d1} button=${hasButton(r1.reply.card)}`);

await sleep(5000);

let r2 = await graph.invoke(
  { messages: [new HumanMessage("Probably a button also")], agentChoice: "auto" },
  cfg("edit1"),
);
const d2 = firstTableData(r2.reply.card);
console.log(
  `TURN2 route=${r2.route} body=[${bodyTypes(r2.reply.card)}] firstData=${d2} button=${hasButton(r2.reply.card)} dataPreserved=${d1 === d2}`,
);
