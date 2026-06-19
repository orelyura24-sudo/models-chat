// Custom Adaptive Card chart elements.
//
// The open-source `adaptivecards` renderer does not draw Chart.* elements (those
// only render inside Microsoft Teams). So we register our own element classes via
// the official extensibility point (GlobalRegistry) and draw them as inline SVG.
// The accepted JSON shapes match server/agents/complexAgent.js (CHART_SCHEMA).

import * as AdaptiveCards from "adaptivecards";

const PALETTE = [
  "#2563eb", "#16a34a", "#f59e0b", "#db2777",
  "#7c3aed", "#0891b2", "#dc2626", "#65a30d",
];

let registered = false;

export function registerChartElements() {
  if (registered) return;
  registered = true;
  for (const typeName of ["Chart.VerticalBar", "Chart.Line", "Chart.Donut", "Chart.Pie"]) {
    AdaptiveCards.GlobalRegistry.elements.register(typeName, makeChartElement(typeName));
  }
}

function makeChartElement(typeName) {
  return class ChartElement extends AdaptiveCards.CardElement {
    getJsonTypeName() {
      return typeName;
    }
    // Capture the raw element JSON so we can read our custom fields.
    internalParse(source, context) {
      super.internalParse(source, context);
      this.spec = source || {};
    }
    internalRender() {
      const host = document.createElement("div");
      host.className = "ac-chart";
      try {
        host.innerHTML = renderChart(typeName, this.spec || {});
      } catch (e) {
        host.className = "ac-chart-error";
        host.textContent = `Chart render error: ${e.message}`;
      }
      return host;
    }
  };
}

// ---------------------------------------------------------------- rendering

function renderChart(type, spec) {
  switch (type) {
    case "Chart.VerticalBar":
      return barChart(spec);
    case "Chart.Line":
      return lineChart(spec);
    case "Chart.Donut":
      return pieChart(spec, true);
    case "Chart.Pie":
      return pieChart(spec, false);
    default:
      return `<div class="ac-chart-error">Unknown chart type: ${esc(type)}</div>`;
  }
}

function barChart(spec) {
  const data = Array.isArray(spec.data) ? spec.data : [];
  const W = 440, H = 260, mL = 48, mR = 14, mT = 16, mB = 42;
  const pW = W - mL - mR, pH = H - mT - mB;
  const maxY = Math.max(1, ...data.map((d) => num(d.y)));
  const n = Math.max(1, data.length);
  const slot = pW / n;
  const bw = Math.min(52, slot * 0.6);

  let grid = "";
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const val = (maxY * i) / ticks;
    const y = mT + pH - (val / maxY) * pH;
    grid += `<line x1="${mL}" y1="${y}" x2="${mL + pW}" y2="${y}" stroke="#e2e8f0"/>`;
    grid += `<text x="${mL - 6}" y="${y + 3}" text-anchor="end" fill="#94a3b8">${fmt(val)}</text>`;
  }

  let bars = "";
  data.forEach((d, i) => {
    const v = num(d.y);
    const bh = (v / maxY) * pH;
    const x = mL + slot * i + (slot - bw) / 2;
    const y = mT + pH - bh;
    const color = d.color || PALETTE[i % PALETTE.length];
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, bh).toFixed(1)}" rx="3" fill="${esc(color)}"><title>${esc(d.x)}: ${fmt(v)}</title></rect>`;
    bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" fill="#475569">${fmt(v)}</text>`;
    bars += `<text x="${(mL + slot * i + slot / 2).toFixed(1)}" y="${H - mB + 16}" text-anchor="middle" fill="#64748b">${esc(d.x)}</text>`;
  });

  const axis = `<line x1="${mL}" y1="${mT + pH}" x2="${mL + pW}" y2="${mT + pH}" stroke="#cbd5e1"/>`;
  return title(spec) + svg(grid + axis + bars, W, H);
}

function lineChart(spec) {
  const series = Array.isArray(spec.series) ? spec.series : [];
  const W = 440, H = 274, mL = 48, mR = 14, mT = 30, mB = 42;
  const pW = W - mL - mR, pH = H - mT - mB;
  const cats = (series[0]?.values || []).map((p) => p.x);
  const allY = series.flatMap((s) => (s.values || []).map((p) => num(p.y)));
  const maxY = Math.max(1, ...allY);
  const n = Math.max(1, cats.length);
  const xAt = (i) => mL + (n === 1 ? pW / 2 : (pW * i) / (n - 1));
  const yAt = (v) => mT + pH - (v / maxY) * pH;

  let grid = "";
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const val = (maxY * i) / ticks;
    const y = yAt(val);
    grid += `<line x1="${mL}" y1="${y}" x2="${mL + pW}" y2="${y}" stroke="#e2e8f0"/>`;
    grid += `<text x="${mL - 6}" y="${y + 3}" text-anchor="end" fill="#94a3b8">${fmt(val)}</text>`;
  }

  let xlabels = "";
  cats.forEach((c, i) => {
    xlabels += `<text x="${xAt(i).toFixed(1)}" y="${H - mB + 16}" text-anchor="middle" fill="#64748b">${esc(c)}</text>`;
  });

  let lines = "", legend = "";
  series.forEach((s, si) => {
    const color = s.color || PALETTE[si % PALETTE.length];
    const pts = (s.values || []).map((p, i) => `${xAt(i).toFixed(1)},${yAt(num(p.y)).toFixed(1)}`).join(" ");
    lines += `<polyline fill="none" stroke="${esc(color)}" stroke-width="2.5" points="${pts}"/>`;
    (s.values || []).forEach((p, i) => {
      lines += `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(num(p.y)).toFixed(1)}" r="3.5" fill="${esc(color)}"><title>${esc(s.legend || "")} ${esc(p.x)}: ${fmt(p.y)}</title></circle>`;
    });
    legend += `<g transform="translate(${mL + si * 130},10)"><rect width="11" height="11" rx="2" fill="${esc(color)}"/><text x="16" y="10" fill="#475569">${esc(s.legend || "Series " + (si + 1))}</text></g>`;
  });

  const axis = `<line x1="${mL}" y1="${mT + pH}" x2="${mL + pW}" y2="${mT + pH}" stroke="#cbd5e1"/>`;
  return title(spec) + svg(legend + grid + axis + lines + xlabels, W, H);
}

function pieChart(spec, donut) {
  const data = Array.isArray(spec.data) ? spec.data : [];
  const W = 440, H = 240;
  const cx = 118, cy = H / 2, r = 90, rInner = donut ? r * 0.58 : 0;
  const total = data.reduce((a, d) => a + num(d.value), 0) || 1;

  let slices = "";
  if (data.length === 1) {
    const color = data[0].color || PALETTE[0];
    slices = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${esc(color)}"/>`;
    if (donut) slices += `<circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#ffffff"/>`;
  } else {
    let acc = 0;
    data.forEach((d, i) => {
      const val = num(d.value);
      const start = (acc / total) * 360;
      acc += val;
      const end = Math.min((acc / total) * 360, start + 359.999);
      const color = d.color || PALETTE[i % PALETTE.length];
      slices += `<path d="${arcPath(cx, cy, r, rInner, start, end)}" fill="${esc(color)}" stroke="#fff" stroke-width="1.5"><title>${esc(d.legend)}: ${fmt(val)} (${pct(val, total)}%)</title></path>`;
    });
  }

  let legend = "";
  data.forEach((d, i) => {
    const color = d.color || PALETTE[i % PALETTE.length];
    legend += `<g transform="translate(248,${34 + i * 24})"><rect width="12" height="12" rx="2" fill="${esc(color)}"/><text x="18" y="11" fill="#334155">${esc(d.legend)} — ${pct(num(d.value), total)}%</text></g>`;
  });

  return title(spec) + svg(slices + legend, W, H);
}

// ---------------------------------------------------------------- helpers

function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, startAngle);
  const [x2, y2] = polar(cx, cy, rOuter, endAngle);
  if (rInner <= 0) {
    return `M ${cx} ${cy} L ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} Z`;
  }
  const [x3, y3] = polar(cx, cy, rInner, endAngle);
  const [x4, y4] = polar(cx, cy, rInner, startAngle);
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
}

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function svg(inner, w, h) {
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet" style="max-width:${w}px;height:auto;display:block;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:11px;">${inner}</svg>`;
}

function title(spec) {
  return spec.title ? `<div class="ac-chart-title">${esc(spec.title)}</div>` : "";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(v, total) {
  return Math.round((v / total) * 100);
}

function fmt(v) {
  const n = num(v);
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n * 100) / 100);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
