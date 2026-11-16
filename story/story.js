/* The scrolling story: each <section class="step"> names a layout in data-step; as the
 * reader scrolls into a step, the chart redraws in that layout. Numbers in the prose are
 * not typed in: a <b data-fact="..."> is computed here from story.json, and
 * test/story.test.mjs checks each against the `check` block build_story.py computed in
 * python. Modelled on fog-decades/site/story. */
import { layout, stats, STEPS } from './layout.js';

const fmt = (n) => n.toLocaleString('en-US');
const pct = (v) => `${Math.round(v * 100)}%`;
const pct1 = (v) => `${(v * 100).toFixed(1)}%`;

/* Unknown names throw: a typo must not render as blank */
export function fact(D, f) {
  const S = stats(D);
  switch (f) {
    case 'genes': case 'still': case 'still_before': case 'assigned_since': case 'busiest_n': return fmt(S[f]);
    case 'clean': case 'left_out': return fmt(D[f]);
    case 'busiest': case 'still_median_assigned': return String(S[f]);
    case 'from': case 'recent_from': return String(D[f]);
    case 'busiest_rate': return pct(S.busiest_rate);
    case 'slow1': case 'slow2': return String(S.slowest[f === 'slow1' ? 1 : 0]);  // in year order: the earlier first
    case 'slow1_rate': case 'slow2_rate': { const y = S.slowest[f === 'slow1_rate' ? 1 : 0]; return pct1(S.rate[D.years.findIndex((r) => r[0] === y)]); }
    case 'h_new': case 'h_old': case 'h_max': case 'r_old': case 'r_prev': return pct1(S[f]);
    case 'peak': return `${D.ages[S.peak][0]} years`;
    case 'asof': return D.asof;
    default: throw new Error(`unknown fact ${f}`);
  }
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

async function main() {
  const D = await (await fetch('story.json')).json();
  for (const e of document.querySelectorAll('[data-fact]')) e.textContent = fact(D, e.dataset.fact);
  const steps = [...document.querySelectorAll('.step')];
  for (const s of steps) if (!STEPS[s.dataset.step]) throw new Error(`unknown step ${s.dataset.step}`);
  const plot = document.getElementById('plot');
  const svg = el('svg', { id: 'chart' });
  const gAxis = el('g', { class: 'axis' }), gS = el('g'), gLab = el('g', { class: 'labels' });
  svg.append(gAxis, gS, gLab);
  plot.append(svg);
  const tick = (g, x, y, text, cls = 'tick') => { const t = el('text', { x, y, class: cls }); t.textContent = text; g.append(t); };
  const grid = (x1, y1, x2, y2, cls = 'grid') => gAxis.append(el('line', { x1, x2, y1, y2, class: cls }));

  let shown = -1;
  const draw = (i) => {
    const name = steps[i].dataset.step;
    const box = plot.getBoundingClientRect(), W = box.width, H = box.height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const L = layout(name, D, W, H);
    const narrow = W < 420;
    gAxis.replaceChildren(); gLab.replaceChildren();
    for (const [v, label] of L.yt) { grid(L.L, L.Y(v), L.R, L.Y(v)); tick(gAxis, L.L - 4, L.Y(v) + 4, label, 'tick end'); }
    for (const [v, label] of L.xt) tick(gAxis, L.X(v), L.B + 15, narrow && name === 'ages' ? label.replace(' y', '') : label, 'tick mid');
    grid(L.L, L.B, L.R, L.B, 'grid axisline');
    const cap = {
      assigned: narrow ? 'placeholders given, by year' : 'placeholders given out each year: grey, and still placeholders today: red',
      years: narrow ? 'share of placeholders renamed' : 'each year, the share of the placeholders on the books renamed',
      ages: narrow ? 'renamed a year, by years held' : `renamed a year, by years held: from ${D.from} grey, from ${D.recent_from} red`,
    }[name];
    tick(gAxis, L.L, L.T - 10, cap, 'tick cat');
    gS.replaceChildren();
    for (const m of L.marks) {
      const e = el('rect', { x: m.x, y: m.y, width: Math.max(0, m.w), height: Math.max(0, m.h), class: m.cls });
      if (m.tip) { e.append(el('title')); e.firstChild.textContent = m.tip; }
      gS.append(e);
    }
    document.body.dataset.step = i;
    window.__story = { step: i, name, shown: L.marks.length };
  };

  const pick = () => {
    const line = innerHeight * 0.5;
    let i = 0;
    for (let k = 0; k < steps.length; k++) if (steps[k].getBoundingClientRect().top < line) i = k;
    if (i !== shown) { shown = i; draw(i); }
  };
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', () => { shown = -1; pick(); });
  pick();
}

if (typeof document !== 'undefined') main().catch((e) => {
  document.body.classList.add('failed');
  document.getElementById('err').textContent = String(e.message || e);
  console.error(e);
});
