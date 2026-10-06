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

// ---- Turo Starting five, mėnesio MVP ir karčiausia mėnesio komanda ----
const stars = fp => fp >= 40 ? 5 : fp >= 32 ? 4 : fp >= 25 ? 3 : fp >= 18 ? 2 : 1;
const vilniusMonth = t => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit" }).format(new Date(t)).slice(0, 7);
function roundMonth(d) { const ts = (d.games || []).map(g => new Date(g.start).getTime()).filter(Boolean); return ts.length ? vilniusMonth(Math.min(...ts)) : null; }
// geriausias penketas: 2 gynėjai, 2 puolėjai, 1 centras (trūkstant pozicijų – geriausi likę)
function bestFive(list) {
  const pool = list.filter(p => p.fp != null).sort((a, b) => b.fp - a.fp), used = new Set(), out = [];
  const take = (pos, n) => { for (const p of pool) { if (out.filter(x => x.slot === pos).length >= n) break; if (!used.has(p) && p.pos === pos) { used.add(p); out.push({ ...p, slot: pos }); } } };
  take("G", 2); take("F", 2); take("C", 1);
  for (const p of pool) { if (out.length >= 5) break; if (!used.has(p)) { used.add(p); out.push({ ...p, slot: p.pos || "?" }); } }
  const order = { G: 0, F: 1, C: 2 };
  return out.sort((a, b) => (order[a.slot] ?? 3) - (order[b.slot] ?? 3) || b.fp - a.fp).map(p => ({ name: p.name, club: p.club, pos: p.pos, fp: p.fp, own: p.own, stars: stars(p.fp) }));
}
function extras(archs) { // archs: [{lg, d}]
  const rounds = {}, months = {};
  archs.forEach(({ lg, d }) => {
    const r = d.round, m = roundMonth(d);
    const score = t => d.format === "h2h" ? (t.official ?? t.total) : t.total;
    const R = rounds[r] = rounds[r] || {};
    d.teams.forEach(t => t.players.filter(p => p.fp != null).forEach(p => { const k = p.name + "|" + p.club; const x = R[k] = R[k] || { name: p.name, club: p.club, pos: p.pos, fp: p.fp, own: [] }; x.own.push({ team: t.title.trim(), lg }); }));
    if (!m) return;
    const M = months[m] = months[m] || { rounds: new Set(), pl: {}, tm: {} };
    M.rounds.add(r);
    d.teams.forEach(t => {
      const tk = lg + "|" + t.title; const T = M.tm[tk] = M.tm[tk] || { team: t.title.trim(), lg, pts: 0, n: 0, w: 0, l: 0 };
      T.pts = r2(T.pts + score(t)); T.n++;
      if (d.format === "h2h" && d.matchups) { const mu = d.matchups.find(x => x.a === t.title || x.b === t.title); if (mu) { const A = d.teams.find(x => x.title === mu.a), B = d.teams.find(x => x.title === mu.b); const sa = mu.as > 0 || mu.bs > 0 ? mu.as : score(A), sb = mu.as > 0 || mu.bs > 0 ? mu.bs : score(B); const mine = mu.a === t.title ? sa : sb, opp = mu.a === t.title ? sb : sa; if (mine > opp) T.w++; else if (opp > mine) T.l++; } }
      t.players.filter(p => p.fp != null).forEach(p => { const k = p.name + "|" + p.club; const P = M.pl[k] = M.pl[k] || { name: p.name, club: p.club, pos: p.pos, fp: 0, n: 0, best: 0, seen: new Set(), own: {} }; if (!P.seen.has(r)) { P.seen.add(r); P.fp = r2(P.fp + p.fp); P.n++; P.best = Math.max(P.best, p.fp); } P.own[lg] = t.title.trim(); });
    });
  });
  const dream = {}; Object.keys(rounds).forEach(r => { dream[r] = bestFive(Object.values(rounds[r])); });
  const mon = {}; Object.entries(months).forEach(([m, M]) => {
    const pl = Object.values(M.pl).sort((a, b) => b.fp - a.fp).map(({ seen, own, ...x }) => ({ ...x, own: Object.entries(own).map(([lg, team]) => ({ lg, team })) })), tm = Object.values(M.tm).filter(x => x.n === M.rounds.size).sort((a, b) => a.pts - b.pts);
    mon[m] = { rounds: [...M.rounds].sort((a, b) => a - b), mvp: pl.slice(0, 3), bitter: tm.slice(0, 3), top: [...tm].sort((a, b) => b.pts - a.pts).slice(0, 3) };
  });
  return { dream, months: mon };
}

exports.run = function (DIR, slugs) {
  const hla = [];
  for (const slug of slugs) {
    let cur; try { cur = JSON.parse(fs.readFileSync(path.join(DIR, slug + ".json"), "utf8")); } catch (e) { continue; }
    const arch = [];
    let fpHist = {}; try { fpHist = JSON.parse(fs.readFileSync(path.join(DIR, "fp-hist.json"), "utf8")); } catch (e) {}
    for (let r = 1; r <= cur.round; r++) {
      let d; try { d = JSON.parse(fs.readFileSync(path.join(DIR, slug + "-r" + r + ".json"), "utf8")); } catch (e) { continue; }
      const allFinal = d.games && d.games.length && d.games.every(g => g.status === "final");
      if (!allFinal && !(r < cur.round && d.games && d.games.some(g => g.status !== "scheduled"))) continue;
      if (!allFinal) {
        // praėjęs turas, užfiksuotas dar nepasibaigus (pvz., kai stringa atnaujinimai): taškai papildomi oficialiais BN taškais
        const H = fpHist[r] || {};
        d.teams.forEach(t => { t.players.forEach(p => { if (p.id && H[p.id] != null) p.fp = H[p.id]; }); t.total = r2(t.players.reduce((a, p) => a + (p.fp ?? 0) * p.mult, 0)); });
        if (d.format === "h2h" && d.matchups) d.matchups.forEach(m => { const x = (cur.results || []).find(z => z.r === r && z.a === m.a && z.b === m.b); if (x) { m.as = x.as; m.bs = x.bs; const A = d.teams.find(t => t.title === m.a), B = d.teams.find(t => t.title === m.b); if (A) A.official = x.as; if (B) B.official = x.bs; } });
        d.games.forEach(g => g.status = "final");
      }
      arch.push(d);
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
    // komandos kortelei: geriausi žaidėjai ir taškai pagal turus
    const teamTop = {}; Object.values(playerPts).forEach(p => { (teamTop[p.team] = teamTop[p.team] || []).push(p); });
    Object.keys(teamTop).forEach(t => { teamTop[t] = teamTop[t].sort((a, b) => b.pts - a.pts).slice(0, 5); });
    const teamRounds = {}; arch.forEach(d => d.teams.forEach(t => { (teamRounds[t.title] = teamRounds[t.title] || []).push({ r: d.round, pts: d.format === "h2h" ? (t.official ?? t.total) : t.total }); }));
    const ex = extras(arch.map(d => ({ lg: slug, d })));
    if (/^hla/.test(slug)) arch.forEach(d => hla.push({ lg: slug, d }));
    const out = { rounds: arch.map(d => d.round), teams, players, deals: deals.slice(0, 10), ranks: rankHist, teamTop, teamRounds, dream: ex.dream, months: ex.months };
    const file = path.join(DIR, slug + "-season.json"), txt = JSON.stringify(out);
    let old = null; try { old = fs.readFileSync(file, "utf8"); } catch (e) {}
    if (old !== txt) fs.writeFileSync(file, txt);
  }
  // HLA bendri (taurei): Starting five ir mėnesio apdovanojimai iš visų 32 komandų
  if (hla.length) {
    const ex = extras(hla), file = path.join(DIR, "hla-extra.json"), txt = JSON.stringify(ex);
    let old = null; try { old = fs.readFileSync(file, "utf8"); } catch (e) {}
    if (old !== txt) fs.writeFileSync(file, txt);
  }
};
