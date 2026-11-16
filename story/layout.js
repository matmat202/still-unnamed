/* Where every mark sits on each step of the story. Pure: no DOM, so test/story.test.mjs
 * runs every layout at several plot sizes. Modelled on fog-decades/site/story.
 *
 *   "assigned": placeholders given out each year (grey), and of them still placeholders today (red)
 *   "years":    each year's renames as a share of the placeholders on the books on 1 January
 *   "ages":     the yearly naming rate by how long a gene had held its placeholder, from 2010 (grey) and from 2018 (red)
 */
export const STEPS = { assigned: 'assigned', years: 'years', ages: 'ages' };

const memo = new WeakMap();
/* -> the numbers the story quotes; build_story.py's `check` holds the same */
export function stats(D) {
  if (memo.has(D)) return memo.get(D);
  const A = D.assigned, Y = D.years;
  const rate = Y.map(([, p, r]) => r / p);
  const H = D.ages.map(([, n, py]) => n / py), R = D.recent.map(([, n, py]) => n / py);
  const busiest = Y.reduce((b, y, i) => (y[2] > Y[b][2] ? i : b), 0);
  const S = {
    genes: A.reduce((s, r) => s + r[1], 0), still: A.reduce((s, r) => s + r[2], 0),
    still_before: A.filter((r) => r[0] < D.from).reduce((s, r) => s + r[2], 0),
    assigned_since: A.filter((r) => r[0] >= D.from).reduce((s, r) => s + r[1], 0),
    busiest: Y[busiest][0], busiest_n: Y[busiest][2], busiest_rate: rate[busiest],
    h_new: H[0], h_old: H.at(-1), h_max: Math.max(...H), peak: H.indexOf(Math.max(...H)),
    r_old: R.at(-1), r_prev: R.at(-2),
    rate, H, R, first_year: Y[0][0], last_year: Y.at(-1)[0],
  };
  // the median year a still-unnamed gene was given its placeholder
  const half = Math.floor(S.still / 2);
  let seen = 0;
  S.still_median_assigned = A.find((r) => (seen += r[2]) > half)[0];
  // the years with the smallest share renamed, smallest first
  S.slowest = rate.map((v, i) => [v, Y[i][0]]).sort((a, b) => a[0] - b[0]).map((r) => r[1]);
  memo.set(D, S);
  return S;
}

/* -> {X, Y, L, R, T, B, marks, xt: [[v, label]], yt: [[v, label]]} in px of w x h */
export function layout(name, D, w, h) {
  if (!STEPS[name]) throw new Error(`unknown step ${name}`);
  const S = stats(D);
  const L = 40, R = w - 10, T = 26, B = h - 22;
  let x0, x1, y1;
  if (name === 'assigned') { x0 = D.assigned[0][0] - 1; x1 = D.assigned.at(-1)[0] + 1; y1 = 450; }
  else if (name === 'years') { x0 = S.first_year - 1; x1 = S.last_year + 1; y1 = 25; }
  else { x0 = 0; x1 = D.ages.length; y1 = 12; }
  const X = (v) => L + ((v - x0) / (x1 - x0)) * (R - L);
  const Yp = (v) => B - (Math.min(v, y1) / y1) * (B - T);
  const marks = [];
  const bar = (cls, xa, xb, v, tip) => marks.push({ kind: 'bar', cls, x: xa, y: Yp(v), w: xb - xa, h: B - Yp(v), tip });
  if (name === 'assigned') {
    const bw = Math.max(1, X(1) - X(0) - 1);
    for (const [y, n, s] of D.assigned) {
      if (n) bar('bar', X(y) - bw / 2, X(y) + bw / 2, n, `${y}: ${n} placeholders given`);
      if (s) bar('hit', X(y) - bw / 2, X(y) + bw / 2, s, `${y}: ${s} of them still placeholders`);
    }
  } else if (name === 'years') {
    const bw = Math.max(1, X(1) - X(0) - 1);
    D.years.forEach(([y, p, r], i) => {
      const v = 100 * S.rate[i];
      bar(y === S.busiest ? 'hit' : S.slowest.slice(0, 2).includes(y) ? 'low' : 'bar', X(y) - bw / 2, X(y) + bw / 2, v,
        `${y}: ${r} of ${p} renamed (${v.toFixed(1)}%)`);
    });
  } else {
    D.ages.forEach(([band], i) => {
      const slot = X(i + 1) - X(i), gap = Math.min(16, slot * 0.2), half = (slot - gap) / 2, x = X(i) + gap / 2;
      bar('bar', x, x + half, 100 * S.H[i], `held ${band} years, from ${D.from}: ${(100 * S.H[i]).toFixed(1)}% a year`);
      bar('hit', x + half, x + 2 * half, 100 * S.R[i], `held ${band} years, from ${D.recent_from}: ${(100 * S.R[i]).toFixed(1)}% a year`);
    });
  }
  const xt = name === 'assigned' ? [1990, 2000, 2010, 2020].map((v) => [v, String(v)])
    : name === 'years' ? [2005, 2012, 2020].map((v) => [v, String(v)])
    : D.ages.map(([band], i) => [i + 0.5, `${band} y`]);
  const yt = name === 'assigned' ? [100, 200, 300, 400].map((v) => [v, String(v)])
    : name === 'years' ? [5, 10, 15, 20, 25].map((v) => [v, `${v}%`]) : [3, 6, 9, 12].map((v) => [v, `${v}%`]);
  return { kind: name, X, Y: Yp, L, R, T, B, xt, yt, marks };
}
