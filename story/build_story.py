#!/usr/bin/env python3
"""site/data/genes.json -> site/story/story.json: are the last placeholders the hard ones?

    python3 build_story.py          # BUILD_OUT=... writes elsewhere (publish.sh compares)

Everything comes from the file the page already ships. HGNC dates only a gene's LAST rename,
so a rename date is the day a gene left its placeholder only if every symbol it ever had
before was a placeholder too. The waiting-time chapters therefore use only those genes
("clean"); a gene with a real name somewhere in its past (ABRAXAS1 was CCDC98, then
FAM175A) is left out of them, and the count left out is in `check`.

  assigned  [year, placeholders assigned that year (all 2,304), of them still placeholders]
  years     [year, clean placeholders on the books on 1 January, of them renamed that year]
  ages      for time at risk from 2010 on: [band, renamed, years at risk] by how long the
            gene had held its placeholder (AGES), so an old gene and a new one are compared
            in the same calendar years; `recent` the same from RECENT on

test/story.test.mjs recomputes every array from genes.json in JS and requires the `check`
block below, computed here in python, to agree with the page's own layout.js stats().
"""
import json
import os
import re
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "site", "data", "genes.json")
SITE = os.path.join(HERE, "site", "data", "site.json")
OUT = os.environ.get("BUILD_OUT", os.path.join(HERE, "site", "story", "story.json"))
PH = re.compile(r"^(C(\d+|X|Y)orf\d+|FAM\d+[A-Z]?\d*|KIAA\d+)$")  # build.py's ROOTS
AGES = ((0, 3), (3, 6), (6, 10), (10, 15), (15, 99))
FROM = 2010
RECENT = 2018  # the same, from 2018 only: is the old-age drop just the calendar?
YEARS = (2001, 2025)  # whole calendar years in the rate chart


def yrs(a, b): return (b - a).days / 365.25


def clean(g): return bool(g["a"]) and (g["still"] or bool(g["c"])) and all(PH.match(p) for p in g["p"])


def hazard(C, a, end, T, since):
    """[band, renamed, years at risk] for time at risk from 1 January `since` to T"""
    ages = [[f"{lo}-{hi}" if hi < 99 else f"{lo}+", 0, 0.0] for lo, hi in AGES]
    t0 = date(since, 1, 1)
    for g in C:
        s, e = a[g["id"]], end[g["id"]]
        lo_t = max(yrs(s, t0), 0.0)  # its age when the window opens (0 if assigned later)
        hi_t = yrs(s, e)
        for i, (lo, hi) in enumerate(AGES):
            ages[i][2] += max(0.0, min(hi_t, hi) - max(lo_t, lo))
        if not g["still"] and e >= t0:
            ages[next(i for i, (lo, hi) in enumerate(AGES) if lo <= hi_t < hi)][1] += 1
    for r in ages:
        r[2] = round(r[2], 2)
    return ages


def main():
    G = json.load(open(SRC))
    T = date.fromisoformat(json.load(open(SITE))["asof"])
    C = [g for g in G if clean(g)]
    a = {g["id"]: date.fromisoformat(g["a"]) for g in C}
    end = {g["id"]: T if g["still"] else date.fromisoformat(g["c"]) for g in C}

    first = min(int(g["a"][:4]) for g in G)
    assigned = [[y, sum(1 for g in G if g["a"][:4] == str(y)), sum(1 for g in G if g["still"] and g["a"][:4] == str(y))]
                for y in range(first, T.year + 1)]
    years = []
    for y in range(YEARS[0], YEARS[1] + 1):
        j, k = date(y, 1, 1), date(y + 1, 1, 1)
        pool = [g for g in C if a[g["id"]] < j <= end[g["id"]]]
        years.append([y, len(pool), sum(1 for g in pool if not g["still"] and end[g["id"]] < k)])
    ages, recent = hazard(C, a, end, T, FROM), hazard(C, a, end, T, RECENT)
    still = [g for g in G if g["still"]]
    D = {
        "source": "HGNC complete set, as Still Unnamed ships it in site/data/genes.json",
        "asof": T.isoformat(), "from": FROM,
        "recent_from": RECENT, "clean": len(C), "left_out": len(G) - len(C),
        "assigned": assigned, "years": years, "ages": ages, "recent": recent,
    }
    by_day = {}
    for g in C:
        if not g["still"] and g["c"][:4] == str(max(years, key=lambda r: r[2])[0]):
            by_day[g["c"]] = by_day.get(g["c"], 0) + 1
    D["busiest_day"] = max(by_day.values())  # the most renames on one day of the busiest year
    rate = [r / p for _, p, r in years]
    busiest = max(range(len(years)), key=lambda i: years[i][2])
    H = [r[1] / r[2] for r in ages]
    D["check"] = {
        "genes": len(G), "still": len(still),
        "still_before": sum(1 for g in still if int(g["a"][:4]) < FROM),
        "assigned_since": sum(n for y, n, _ in assigned if y >= FROM),
        "still_median_assigned": sorted(int(g["a"][:4]) for g in still)[len(still) // 2],
        "busiest": years[busiest][0], "busiest_n": years[busiest][2], "busiest_rate": rate[busiest],
        "h_new": H[0], "h_old": H[-1], "h_max": max(H), "peak": max(range(len(H)), key=H.__getitem__),
        "r_old": recent[-1][1] / recent[-1][2], "r_prev": recent[-2][1] / recent[-2][2],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(D, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("  ".join(f"{k} {v:.3f}" if isinstance(v, float) else f"{k} {v}" for k, v in D["check"].items()))
    print("years", years)
    for k in ("ages", "recent"):
        print(k, [(b, n, py, round(100 * n / py, 1)) for b, n, py in D[k]])


if __name__ == "__main__":
    main()
