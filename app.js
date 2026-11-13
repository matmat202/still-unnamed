// Still Unnamed: draws site/data/site.json, searches site/data/genes.json.
const ROOTS = [
  { key: "orf", label: "C#orf# (open reading frame)", color: "var(--s1)" },
  { key: "FAM", label: "FAM# (family with sequence similarity)", color: "var(--s2)" },
  { key: "KIAA", label: "KIAA# (clone number)", color: "var(--s3)" },
];
const fmt = n => n.toLocaleString("en-US");
const yearOf = d => +d.slice(0, 4) + (d.endsWith("12-31") ? 1 : (+d.slice(5, 7) - 1) / 12);

// Stacked layers: for each root, [x, y0, y1] per point, bottom to top.
function stack(series) {
  return ROOTS.map((r, i) => series.map(p => {
    const y0 = ROOTS.slice(0, i).reduce((s, q) => s + p[q.key], 0);
    return [yearOf(p.date), y0, y0 + p[r.key]];
  }));
}

// The symbol a user typed, matched against a current or previous symbol.
function lookup(genes, q) {
  q = q.trim().toUpperCase();
  if (!q) return null;
  return genes.find(g => g.s.toUpperCase() === q)
    || genes.find(g => g.p.some(p => p.toUpperCase() === q))
    || null;
}

// Natural order, so C1orf2 sorts before C1orf10.
const natural = (a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

// Genes other than `skip` with a current or previous symbol starting with q, as
// [gene, the symbol that matched], in natural order of that symbol. Typing "FAM72"
// is a partial symbol, not a miss: it finds FAM72A-D, since renamed RUMY1-4.
function prefixed(genes, q, skip) {
  q = q.trim().toUpperCase();
  if (!q) return [];
  const out = [];
  for (const g of genes) {
    if (g === skip) continue;
    const hit = [g.s, ...g.p].find(s => s.toUpperCase().startsWith(q));
    if (hit) out.push([g, hit]);
  }
  return out.sort((a, b) => natural(a[1], b[1]));
}

// One gene's story as lines of text, oldest first.
function story(g) {
  const out = [`approved ${g.a || "on an unknown date"}${g.p.length ? ` as ${g.p.join(", then ")}` : ` as ${g.s}`}`];
  if (g.p.length) out.push(`renamed ${g.s} on ${g.c || "an undated day"}`);
  if (g.still) out.push("still a placeholder today");
  return out;
}

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function draw(site) {
  // drawn at the container's own pixel width, so text stays 11px on a phone
  const box = document.getElementById("chart");
  const W = Math.max(300, Math.round(box.clientWidth)), narrow = W < 560;
  const H = narrow ? 240 : 320, m = { l: 40, r: narrow ? 92 : 120, t: 10, b: 26 };
  const series = site.series, layers = stack(series);
  const x0 = yearOf(series[0].date), x1 = yearOf(series[series.length - 1].date);
  const ymax = Math.ceil(Math.max(...series.map(p => p.total), ...site.anchors.map(a => a.count)) / 200) * 200;
  const X = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r);
  const Y = y => H - m.b - y / ymax * (H - m.t - m.b);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": `Stacked area chart of placeholder gene symbols, ${series[0].date.slice(0, 4)} to today` });
  box.prepend(svg);
  for (let y = 0; y <= ymax; y += 200) {
    svgEl("line", { x1: m.l, x2: W - m.r, y1: Y(y), y2: Y(y), stroke: "var(--grid)" }, svg);
    svgEl("text", { x: m.l - 6, y: Y(y) + 4, "text-anchor": "end" }, svg).textContent = fmt(y);
  }
  for (let yr = 1990; yr <= x1; yr += narrow ? 10 : 5) {
    svgEl("text", { x: X(yr), y: H - 8, "text-anchor": "middle" }, svg).textContent = yr;
  }
  layers.forEach((pts, i) => {
    const top = pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[2]).toFixed(1)}`);
    const bot = pts.slice().reverse().map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`);
    svgEl("polygon", { points: top.concat(bot).join(" "), fill: ROOTS[i].color,
      stroke: "var(--card)", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
  });
  // direct labels at the right edge, centred on each layer's last band, then pushed apart:
  // a thin top band (KIAA# at phone height) otherwise lands on its neighbour's label
  const labs = layers.map((pts, i) => { const last = pts[pts.length - 1];
    return { i, y: Y((last[1] + last[2]) / 2) + 4, n: last[2] - last[1] }; });
  labs.sort((a, b) => b.y - a.y).forEach((l, k, all) => { if (k) l.y = Math.min(l.y, all[k - 1].y - 14); });
  for (const l of labs) {
    svgEl("text", { x: W - m.r + 8, y: l.y, class: "lab" }, svg)
      .textContent = `${ROOTS[l.i].key === "orf" ? "C#orf#" : ROOTS[l.i].key + "#"} ${fmt(l.n)}`;
  }
  for (const a of site.anchors) {
    svgEl("circle", { cx: X(yearOf(a.date)), cy: Y(a.count), r: 5, fill: "var(--card)",
      stroke: "var(--ink)", "stroke-width": 2 }, svg);
  }
  const cross = svgEl("line", { y1: m.t, y2: H - m.b, stroke: "var(--ink-3)", "stroke-width": 1, visibility: "hidden" }, svg);
  const tip = document.getElementById("tip");
  const hit = svgEl("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" }, svg);
  const show = ev => {
    const r = svg.getBoundingClientRect();
    const sx = (ev.clientX - r.left) / r.width * W;
    let best = 0;
    series.forEach((p, i) => { if (Math.abs(X(yearOf(p.date)) - sx) < Math.abs(X(yearOf(series[best].date)) - sx)) best = i; });
    const p = series[best], px = X(yearOf(p.date));
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${p.date.endsWith("12-31") ? "end of " + p.date.slice(0, 4) : p.date}</b><br>`
      + ROOTS.map(q => `${q.key === "orf" ? "C#orf#" : q.key + "#"}: <b>${fmt(p[q.key])}</b>`).join("<br>")
      + `<br>total <b>${fmt(p.total)}</b> of ${fmt(p.approved)} approved`;
    tip.style.display = "block";
    const left = px / W * r.width;
    const want = left > r.width / 2 ? left - tip.offsetWidth - 10 : left + 10;
    tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth, want)) + "px";
    tip.style.top = "10px";
  };
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointerleave", () => { tip.style.display = "none"; cross.setAttribute("visibility", "hidden"); });

  document.getElementById("legend").innerHTML = ROOTS.map(r => `<span><i style="background:${r.color}"></i>${r.label}</span>`).join("")
    + `<span><i class="anc"></i>HGNC's own published count</span>`;
  document.getElementById("anchor-note").innerHTML = "Checked against HGNC's own counts: "
    + site.anchors.map(a => `${a.date.slice(0, 7)}: rebuilt ${fmt(a.rebuilt)}, HGNC <a href="${a.src}">${a.approx ? "about " : ""}${fmt(a.count)}</a>`).join("; ") + ".";
  document.getElementById("table").innerHTML = "<table><thead><tr><th>As of</th>"
    + ROOTS.map(r => `<th>${r.key === "orf" ? "C#orf#" : r.key + "#"}</th>`).join("") + "<th>Total</th><th>Approved genes</th></tr></thead><tbody>"
    + series.map(p => `<tr><td>${p.date}</td>${ROOTS.map(r => `<td>${fmt(p[r.key])}</td>`).join("")}<td>${fmt(p.total)}</td><td>${fmt(p.approved)}</td></tr>`).join("")
    + "</tbody></table>";
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

const HITS = 12;
function hitsHTML(hits, cap) {
  return `<ul class="hits">${hits.slice(0, cap).map(([g]) => `<li><button type="button" data-s="${esc(g.s)}">`
    + `<code>${esc([...g.p, g.s].join(" → "))}</code>${g.still ? ' <span class="muted">still a placeholder</span>' : ""}`
    + `</button></li>`).join("")}</ul>`
    + (hits.length > cap ? `<p class="muted">and ${fmt(hits.length - cap)} more: keep typing.</p>` : "");
}

function geneHTML(g) {
  const link = `https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${esc(g.id)}`;
  return `<div><span class="sym">${esc(g.s)}</span> · ${esc(g.n)} · ${esc(g.loc)} · <a href="${link}">HGNC</a></div>`
    + `<ul class="hist">${story(g).map(l => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

async function main() {
  const site = await (await fetch("data/site.json")).json();
  document.getElementById("still").textContent = fmt(site.still);
  document.getElementById("still-s").textContent = `of ${fmt(site.protein_coding)} human protein-coding genes are still known only by a placeholder. `
    + `${fmt(site.ever - site.still)} more were placeholders once and have since been named.`;
  document.getElementById("asof").textContent = site.asof;
  draw(site);
  document.getElementById("recent").innerHTML = site.recent.map(g =>
    `<li><code>${esc(g.p.join(" → "))}</code> → <code><b>${esc(g.s)}</b></code>, ${esc(g.n)} <span class="muted">${esc(g.c)}</span></li>`).join("");
  const ex = site.excel;
  document.getElementById("excel-s").textContent = `Spreadsheets read SEPT1 as 1 September, so HGNC renamed ${ex.renamed.length} human genes `
    + `whose symbols looked like dates (most in 2020). ${ex.still.length ? `Still at risk: ${ex.still.join(", ")}.` : "No current symbol still looks like a date."}`;
  document.getElementById("excel").innerHTML = ex.renamed.map(g =>
    `<li><code>${esc(g.p.join(", "))}</code> → <code><b>${esc(g.s)}</b></code> <span class="muted">${esc(g.c)}</span></li>`).join("");

  let genes = null;
  const q = document.getElementById("q"), out = document.getElementById("gene");
  const run = async () => {
    genes = genes || await (await fetch("data/genes.json")).json();
    const t = q.value.trim(), g = lookup(genes, t), hits = prefixed(genes, t, g);
    const T = esc(t.toUpperCase());
    out.innerHTML = !t ? "" : g ? geneHTML(g)
        + (hits.length ? `<p class="muted">Also starting with ${T}:</p>` + hitsHTML(hits, 6) : "")
      : hits.length ? `<p class="muted">${fmt(hits.length)} gene${hits.length > 1 ? "s" : ""} start${hits.length > 1 ? "" : "s"} with ${T}:</p>` + hitsHTML(hits, HITS)
      : `<span class="muted">${T} was never a placeholder-named protein-coding gene.</span>`;
  };
  out.addEventListener("click", e => {
    const b = e.target.closest("button[data-s]");
    if (b) { q.value = b.dataset.s; run(); }
  });
  document.getElementById("f").addEventListener("submit", e => { e.preventDefault(); run(); });
  q.addEventListener("input", () => { if (q.value.trim().length >= 3) run(); else out.innerHTML = ""; });
}

if (typeof module !== "undefined") module.exports = { stack, lookup, prefixed, story, ROOTS };
else main();
