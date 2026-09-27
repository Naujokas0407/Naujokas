// Sezono suvestinė („Oskarai“): skaičiuojama iš baigtų turų archyvų data/<lyga>-r<N>.json
// ir perėjimų žurnalo data/<lyga>-tx.json. Rezultatas – data/<lyga>-season.json
const fs = require("fs");
const path = require("path");

const r2 = x => Math.round(x * 100) / 100;
function optimal(t) {
  const act = t.players.filter(p => !String(p.card).startsWith("i")).map(p => ({ p, v: p.fp ?? 0 }));
  const n = act.length; if (n < 6) return null;
  let best = null;
  for (let m = 0; m < (1 << n); m++) {
    let bits = 0; for (let k = m; k; k &= k - 1) bits++;
    if (bits !== 5) continue;
    const S = [], R = [];
    act.forEach((x, i) => (m >> i & 1 ? S : R).push(x));
    const c = S.filter(x => x.p.pos === "C").length, f = S.filter(x => x.p.pos === "F").length, g = S.filter(x => x.p.pos === "G").length;
    if (c < 1 || c > 2 || f < 1 || f > 3 || g < 1 || g > 3) continue;
    R.sort((a, b) => b.v - a.v);
    const cap = S.reduce((a, b) => b.v > a.v ? b : a);
    const val = S.reduce((s, x) => s + x.v, 0) + cap.v + (R[0] ? R[0].v : 0) + 0.5 * R.slice(1).reduce((s, x) => s + x.v, 0);
    if (best == null || val > best) best = val;
  }
  if (best == null) return null;
  const actual = t.players.reduce((s, p) => s + (p.fp ?? 0) * p.mult, 0);
  return Math.max(0, best - actual);
}
const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");

exports.run = function (DIR, slugs) {
  for (const slug of slugs) {
    let cur; try { cur = JSON.parse(fs.readFileSync(path.join(DIR, slug + ".json"), "utf8")); } catch (e) { continue; }
    const arch = [];
    for (let r = 1; r <= cur.round; r++) {
      let d; try { d = JSON.parse(fs.readFileSync(path.join(DIR, slug + "-r" + r + ".json"), "utf8")); } catch (e) { continue; }
      if (d.games && d.games.length && d.games.every(g => g.status === "final")) arch.push(d);
    }
    let tx = null; try { tx = JSON.parse(fs.readFileSync(path.join(DIR, slug + "-tx.json"), "utf8")); } catch (e) {}
    const teams = {}, playerPts = {}, rankHist = {};
    const T = title => teams[title] = teams[title] || { capPts: 0, capBest: null, capWorst: null, lost: 0, total: 0, n: 0, best: null, worst: null, w: 0, l: 0, d: 0 };
    let cumPts = {};
    for (const d of arch) {
      const r = d.round;
      const score = t => d.format === "h2h" ? (t.official ?? t.total) : t.total;
      for (const t of d.teams) {
        const x = T(t.title), s = score(t);
        x.total = r2(x.total + s); x.n++;
        if (!x.best || s > x.best.pts) x.best = { r, pts: s };
        if (!x.worst || s < x.worst.pts) x.worst = { r, pts: s };
        const cap = t.players.find(p => p.cap);
        if (cap && cap.fp != null) {
          const cp = cap.fp * 2; x.capPts = r2(x.capPts + cp);
          if (!x.capBest || cp > x.capBest.pts) x.capBest = { r, name: cap.name, pts: cp };
          if (!x.capWorst || cp < x.capWorst.pts) x.capWorst = { r, name: cap.name, pts: cp };
        }
        const lost = optimal(t); if (lost != null) x.lost = r2(x.lost + lost);
        for (const p of t.players) if (p.mult > 0 && p.fp != null) {
          const k = t.title + "|" + p.name;
          playerPts[k] = playerPts[k] || { team: t.title, name: p.name, club: p.club, pts: 0, n: 0 };
          playerPts[k].pts = r2(playerPts[k].pts + p.fp * p.mult); playerPts[k].n++;
        }
        cumPts[t.title] = (cumPts[t.title] || 0) + s;
      }
      if (d.format === "h2h" && d.matchups) for (const m of d.matchups) {
        const A = d.teams.find(t => t.title === m.a), B = d.teams.find(t => t.title === m.b);
        const sa = m.as > 0 || m.bs > 0 ? m.as : A ? score(A) : 0, sb = m.as > 0 || m.bs > 0 ? m.bs : B ? score(B) : 0;
        if (sa > sb) { T(m.a).w++; T(m.b).l++; } else if (sb > sa) { T(m.b).w++; T(m.a).l++; } else { T(m.a).d++; T(m.b).d++; }
      }
      const order = Object.keys(teams).sort((a, b) => d.format === "h2h"
        ? ((teams[b].w + teams[b].d / 2) - (teams[a].w + teams[a].d / 2)) || (cumPts[b] - cumPts[a])
        : cumPts[b] - cumPts[a]);
      order.forEach((t, i) => (rankHist[t] = rankHist[t] || []).push({ r, rank: i + 1 }));
    }
    // Sezono sandoris: po perėjimo/paėmimo įgyti žaidėjai ir jų taškai naujoje komandoje
    const deals = [];
    if (tx && tx.log) for (const e of tx.log) {
      const gets = e.type === "trade" ? [[e.a, e.aGets], [e.b, e.bGets]] : [[e.team, e.in]];
      for (const [team, list] of gets) for (const p of list || []) {
        let pts = 0, n = 0;
        for (const d of arch) if (d.round >= e.r) {
          const t = d.teams.find(x => x.title === team); if (!t) continue;
          const q = t.players.find(x => norm(x.name) === norm(p.name));
          if (q && q.mult > 0 && q.fp != null) { pts += q.fp * q.mult; n++; }
        }
        deals.push({ team, name: p.name, club: p.club, r: e.r, type: e.type, pts: r2(pts), n });
      }
    }
    deals.sort((a, b) => b.pts - a.pts);
    const players = Object.values(playerPts).sort((a, b) => b.pts - a.pts).slice(0, 10);
    const out = { rounds: arch.map(d => d.round), teams, players, deals: deals.slice(0, 10), ranks: rankHist };
    const file = path.join(DIR, slug + "-season.json"), txt = JSON.stringify(out);
    let old = null; try { old = fs.readFileSync(file, "utf8"); } catch (e) {}
    if (old !== txt) fs.writeFileSync(file, txt);
  }
};
