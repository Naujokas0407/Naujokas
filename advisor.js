// Prieš turą patarimai komandai: kapitonas, sudėtis, forma, varžovų gynyba, laisvieji žaidėjai.
// Naudojimas: node advisor.js [--check] [--hours=24] [lyga:komanda ...]
//   be lygų – imamos visos lygos, kur update.js nurodyta myTeam.
//   --check – nieko neišveda, jei artimiausios rungtynės ne per --hours valandų (arba turas jau prasidėjęs).
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "data");
const rd = f => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch (e) { return null; } };


const TV = { BAS: "KBA", PAM: "VBC", ULK: "FBT", MUN: "BAY", RED: "CZV", MAD: "RMB" };
const tv = c => TV[c] || c;
const num = x => String(Math.round(x * 10) / 10).replace(".", ",");
let fpHist = {}, posMap = {};
const HEALTH = { out: 0, doubtful: 0.35, "game-time": 0.7, uncertain: 0.7, expected: 0.95, ready: 1 };
const HL = { out: "nežais", doubtful: "abejotinas", "game-time": "paaiškės prieš rungtynes", uncertain: "neaišku", expected: "tikėtina žais" };
const POSN = { G: "gynėjams", F: "puolėjams", C: "centrams" };

// ---- Varžovų gynyba: kiek FP vidutiniškai praleidžia kiekvienas Eurolygos klubas pagal poziciją ----
function defense(curRound, slug) {
  const allowed = {}, games = {};
  for (let r = 1; r < curRound; r++) {
    const a = rd(`${slug}-r${r}.json`); if (!a || !a.pool) continue;
    const H = fpHist[r] || {};
    const opp = {}; (a.games || []).forEach(g => { opp[g.id + "|" + g.h] = g.a; opp[g.id + "|" + g.a] = g.h; });
    const seen = new Set();
    a.pool.forEach(p => {
      const o = opp[p.game + "|" + p.club]; if (!o) return;
      const fp = (p.id && H[p.id] != null) ? H[p.id] : p.fp; const pos = posMap[p.id] || p.pos;
      if (fp == null || !pos) return;
      allowed[o] = allowed[o] || { G: 0, F: 0, C: 0 }; allowed[o][pos] += fp;
      if (!seen.has(o)) { seen.add(o); games[o] = (games[o] || 0) + 1; }
    });
  }
  const clubs = Object.keys(allowed);
  const avg = {}; ["G", "F", "C"].forEach(k => { const v = clubs.map(c => allowed[c][k] / games[c]); avg[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
  const factor = (club, pos) => {
    if (!allowed[club] || !avg[pos]) return 1;
    const n = games[club], per = allowed[club][pos] / n;
    const sm = (per * n + avg[pos] * 2) / (n + 2);              // atsargiai: mažai duomenų – arčiau vidurkio
    return Math.min(1.25, Math.max(0.8, sm / avg[pos]));
  };
  const rank = pos => clubs.map(c => ({ c, v: allowed[c][pos] / games[c] })).sort((a, b) => b.v - a.v);
  return { factor, rank, n: clubs.length };
}

function formOf(id, upto) {
  const rs = Object.keys(fpHist).map(Number).filter(r => r <= upto).sort((a, b) => a - b).slice(-3);
  const v = rs.map(r => fpHist[r][id]).filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function analyse(slug, teamName) {
  const D = rd(slug + ".json"); if (!D) return null;
  const key = s => String(s).normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  const T = D.teams.find(t => key(t.title) === key(teamName)) || D.teams.find(t => key(t.title).startsWith(key(teamName))); if (!T) return null;
  const games = D.games || [];
  const sched = games.filter(g => g.status === "scheduled").map(g => new Date(g.start).getTime()).sort((a, b) => a - b);
  const started = games.some(g => g.status !== "scheduled");
  const first = sched[0];
  const DEF = defense(D.round, slug);
  const gameOf = club => games.find(g => g.h === club || g.a === club);
  const proj = p => {
    const pos = p.pos || posMap[p.id];
    const g = gameOf(p.club);
    const f = formOf(p.id, D.round - 1);
    const base = p.avg == null ? 0 : f == null ? p.avg : 0.6 * f + 0.4 * p.avg;
    if (!g) return { v: 0, why: "šį turą nežaidžia", g: null, f, pos };
    if (g.status === "final" || g.status === "live") return { v: p.fp ?? base, why: "jau žaidė", g, f, pos, played: true };
    const opp = g.h === p.club ? g.a : g.h, home = g.h === p.club;
    const df = pos ? DEF.factor(opp, pos) : 1, hf = HEALTH[p.health || "ready"] ?? 1;
    return { v: base * df * hf, g, f, pos, opp, home, df, hf };
  };
  const players = T.players.map(p => ({ p, ...proj(p) }));

  // geriausia sudėtis: 5 startas (C 1–2, F 1–3, G 1–3), kapitonas ×2, 6-as ×1, likę ×0,5, „Out“ – tiek pat kiek dabar
  const outN = T.players.filter(p => String(p.card).startsWith("i")).length;
  const n = players.length; let best = null;
  for (let m = 0; m < (1 << n); m++) {
    let bits = 0; for (let k = m; k; k &= k - 1) bits++; if (bits !== 5) continue;
    const S = [], R = []; players.forEach((x, i) => (m >> i & 1 ? S : R).push(x));
    const c = S.filter(x => x.pos === "C").length, f = S.filter(x => x.pos === "F").length, g = S.filter(x => x.pos === "G").length;
    if (c < 1 || c > 2 || f < 1 || f > 3 || g < 1 || g > 3) continue;
    R.sort((a, b) => b.v - a.v);
    const cap = S.reduce((a, b) => b.v > a.v ? b : a);
    const bench = R.slice(0, R.length - outN), out = R.slice(R.length - outN);
    const val = S.reduce((s, x) => s + x.v, 0) + cap.v + (bench[0] ? bench[0].v : 0) + 0.5 * bench.slice(1).reduce((s, x) => s + x.v, 0);
    if (!best || val > best.val) best = { val, S, cap, sixth: bench[0], bench: bench.slice(1), out };
  }
  const curVal = players.reduce((s, x) => s + x.v * x.p.mult, 0);

  // laisvieji žaidėjai
  const fa = (D.fa || []).map(p => ({ p, ...proj({ ...p, health: p.health || "ready" }) })).filter(x => !x.played && x.g).sort((a, b) => b.v - a.v).slice(0, 15);
  const weakest = [...players].filter(x => !x.played).sort((a, b) => a.v - b.v);

  // H2H varžovas
  let h2h = null;
  if (D.format === "h2h" && D.matchups) {
    const m = D.matchups.find(x => x.a === T.title || x.b === T.title);
    if (m) {
      const O = D.teams.find(t => t.title === (m.a === T.title ? m.b : m.a));
      if (O) h2h = { name: O.title, v: O.players.reduce((s, p) => s + proj(p).v * p.mult, 0) };
    }
  }
  return { D, T, players, best, curVal, fa, weakest, h2h, DEF, first, started };
}

function report(slug, team) {
  const A = analyse(slug, team); if (!A) return "";
  const { D, T, players, best, curVal, fa, weakest, h2h, DEF } = A;
  const L = [];
  const lbl = x => `${x.p.name} (${tv(x.p.club)}${x.pos ? ", " + x.pos : ""})`;
  const vs = x => x.g ? `${x.home ? "vs" : "@"} ${tv(x.opp)}` : "";
  L.push(`## ${D.title} – ${T.title} · ${D.round} turas`);
  if (A.first) L.push(`Pirmos rungtynės: ${new Date(A.first).toLocaleString("lt-LT", { timeZone: "Europe/Vilnius", weekday: "long", hour: "2-digit", minute: "2-digit" })}`);
  // kapitonas
  const capC = players.filter(x => !x.played && x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3);
  L.push(`\n**👑 Kapitonas**`);
  capC.forEach((x, i) => L.push(`${i + 1}. ${lbl(x)} – ~${num(x.v)} FP ${vs(x)}${x.df && Math.abs(x.df - 1) >= 0.07 ? (x.df > 1 ? ` · varžovas silpnai gina ${POSN[x.pos]}` : ` · varžovas gerai gina ${POSN[x.pos]}`) : ""}${x.f != null && x.p.avg != null && Math.abs(x.f - x.p.avg) >= 3 ? (x.f > x.p.avg ? " · 🔥 geros formos" : " · 🧊 formos duobė") : ""}`));
  const curCap = players.find(x => x.p.cap);
  if (curCap && capC[0] && curCap.p.id !== capC[0].p.id) L.push(`Dabar kapitonas – ${curCap.p.name} (~${num(curCap.v)} FP). Siūlau keisti į ${capC[0].p.name}.`);
  else if (curCap) L.push(`Dabartinis kapitonas ${curCap.p.name} – geriausias pasirinkimas. ✅`);
  // sudėtis
  if (best) {
    L.push(`\n**📋 Siūloma sudėtis** (prognozė ~${num(best.val)} FP, dabartinė ~${num(curVal)} FP${best.val - curVal > 1 ? `, **+${num(best.val - curVal)}**` : ""})`);
    L.push(`Startas: ${best.S.sort((a, b) => b.v - a.v).map(x => `${x.p.name}${x === best.cap ? " (C)" : ""} ~${num(x.v)}`).join(", ")}`);
    if (best.sixth) L.push(`6-as: ${best.sixth.p.name} ~${num(best.sixth.v)}`);
    if (best.bench.length) L.push(`Suolas: ${best.bench.map(x => `${x.p.name} ~${num(x.v)}`).join(", ")}`);
    if (best.out.length) L.push(`Out: ${best.out.map(x => `${x.p.name}${x.why ? " (" + x.why + ")" : ""}`).join(", ")}`);
    const S = new Set(best.S.map(x => x.p.id)), inS = [], outS = [];
    players.forEach(x => { const isS = ["c", "f", "g"].includes(String(x.p.card)[0]); if (S.has(x.p.id) && !isS) inS.push(x.p.name); if (!S.has(x.p.id) && isS) outS.push(x.p.name); });
    if (inS.length) L.push(`Pakeitimai: į startą – ${inS.join(", ")}; iš starto – ${outS.join(", ")}.`);
    else L.push(`Startinis penketas jau optimalus. ✅`);
  }
  // traumos
  const hurt = players.filter(x => (x.p.health || "ready") !== "ready");
  if (hurt.length) { L.push(`\n**🩹 Traumos**`); hurt.forEach(x => L.push(`- ${x.p.name}: ${HL[x.p.health] || x.p.health}${x.p.mult > 0 ? " – šiuo metu sudėtyje!" : ""}`)); }
  const noGame = players.filter(x => !x.g);
  if (noGame.length) L.push(`⚠️ Šį turą nežaidžia: ${noGame.map(x => x.p.name).join(", ")}`);
  // forma
  const hot = players.filter(x => x.f != null && x.p.avg != null && x.f - x.p.avg >= 4).map(x => `${x.p.name} (${num(x.f)} vs ${num(x.p.avg)})`);
  const cold = players.filter(x => x.f != null && x.p.avg != null && x.p.avg - x.f >= 4).map(x => `${x.p.name} (${num(x.f)} vs ${num(x.p.avg)})`);
  if (hot.length || cold.length) { L.push(`\n**📈 Forma** (paskutinių 3 turų vidurkis vs sezono)`); if (hot.length) L.push(`🔥 ${hot.join(", ")}`); if (cold.length) L.push(`🧊 ${cold.join(", ")}`); }
  // varžovų gynyba
  if (DEF.n >= 6) {
    L.push(`\n**🛡 Varžovų gynyba šį turą**`);
    players.filter(x => x.df && Math.abs(x.df - 1) >= 0.08).sort((a, b) => b.df - a.df).forEach(x => L.push(`- ${x.p.name} ${vs(x)}: ${x.df > 1 ? "palankus" : "sunkus"} varžovas (${x.df > 1 ? "+" : "−"}${Math.round(Math.abs(x.df - 1) * 100)} % ${POSN[x.pos]})`));
  }
  // laisvieji
  const low = weakest[0];
  const goodFa = fa.filter(x => low && x.v > low.v + 3).slice(0, 3);
  if (goodFa.length) { L.push(`\n**🛒 Laisvoji rinka**`); goodFa.forEach(x => L.push(`- ${lbl(x)} ~${num(x.v)} FP ${vs(x)} (vietoj ${low.p.name} ~${num(low.v)})`)); }
  if (h2h) L.push(`\n**⚔️ Prieš ${h2h.name}:** prognozė ~${num(best ? best.val : curVal)} : ~${num(h2h.v)}`);
  return L.join("\n");
}

function main(args) {
fpHist = rd("fp-hist.json") || {};
posMap = ((rd("pos.json") || {}).map) || {};
const CHECK = args.includes("--check");
const HOURS = +((args.find(a => a.startsWith("--hours=")) || "").split("=")[1] || 24);
let targets = args.filter(a => !a.startsWith("--")).map(a => { const i = a.indexOf(":"); return { slug: a.slice(0, i), team: a.slice(i + 1) }; });
if (!targets.length) {
  const src = fs.readFileSync(path.join(__dirname, "update.js"), "utf8");
  targets = [...src.matchAll(/slug:\s*"([^"]+)"[^\n]*myTeam:\s*"([^"]+)"/g)].map(m => ({ slug: m[1], team: m[2] }));
}
const out = [];
for (const { slug, team } of targets) {
  const A = analyse(slug, team); if (!A) continue;
  if (CHECK) {
    if (A.started || !A.first) continue;
    const h = (A.first - Date.now()) / 3600e3;
    if (h < 0 || h > HOURS) continue;
  }
  out.push(report(slug, team));
}
return out.length ? out.join("\n\n---\n\n") + "\n\n_Prognozė: 60 % paskutinių 3 turų forma + 40 % sezono vidurkis, pakoreguota pagal varžovo gynybą prieš tą poziciją ir traumas._\n" : "";
}
module.exports = { main };
if (require.main === module) { const s = main(process.argv.slice(2)); if (s) process.stdout.write(s); }
