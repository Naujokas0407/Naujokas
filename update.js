// Paleidžiamas GitHub Actions: node update.js
// Rungtynių informacija ir statistika – iš oficialios Eurolygos (live.euroleague.net).
// Sudėtys, kapitonai, fantasy taškai ir H2H poros – iš BasketNews Fantasy.
const fs = require("fs");
const path = require("path");

const CONFIG = {
  bn: "https://fantasy.basketnews.com/backend/graphql",
  el: "https://live.euroleague.net/api",
  season: "E2026",
  leagueId: "6a7ae0128b647e038c999860", // Eurolyga BN sistemoje
  pointCalcSystem: "modern"
};
// Lygos. Norint pridėti naują – įrašykite dar vieną eilutę.
const LEAGUES = [
  { slug: "bn", title: "BN Fantasy 🏆", fantasyLeagueId: "6a9b0e7499d3c87221c70fe4", format: "classic", myTeam: "Naujokas" },
  { slug: "hla1", title: "HLA 1 Divizionas", fantasyLeagueId: "6aa7fe67c95ed14589bf170d", format: "h2h", myTeam: null },
  { slug: "hla2", title: "HLA 2 Divizionas", fantasyLeagueId: "6a9b0b72d2094d97fda188b7", format: "h2h", myTeam: "Naujokas" },
  { slug: "hla3", title: "HLA 3 Divizionas", fantasyLeagueId: "6aa3f0f51f38d9ba866b20d3", format: "h2h", myTeam: null },
  { slug: "hla4", title: "HLA 4 Divizionas", fantasyLeagueId: "6a9811b0536d72db0c77997b", format: "classic", myTeam: null }
];
const DIR = path.join(__dirname, "data");

// BN santrumpa -> Eurolygos klubo kodas
const BN2EL = { BKN: "BAS", VAL: "PAM", FEN: "ULK", VIRT: "VIR", EA7: "MIL", BAY: "MUN", "ŽAL": "ZAL", CZV: "RED",
  RMB: "MAD", PBB: "PRS", MTA: "TEL", EFS: "IST", PAO: "PAN", BJK: "BES", BAR: "BAR", PAR: "PAR", OLY: "OLY",
  DUB: "DUB", ASV: "ASV", HTA: "HTA" };
const toEl = bn => BN2EL[bn] || bn;
// Eurolygos klubo kodas -> TV santrumpa, kuri rodoma puslapyje
const TV = { BAS: "KBA", PAM: "VBC", ULK: "FBT", VIR: "VIR", MIL: "MIL", MUN: "BAY", ZAL: "ZAL", RED: "CZV", MAD: "RMB",
  PRS: "PBB", TEL: "MTA", IST: "EFS", PAN: "PAO", BES: "BJK", BAR: "BAR", PAR: "PAR", OLY: "OLY", DUB: "DUB", ASV: "ASV", HTA: "HTA" };

async function http(url, opts = {}, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...opts, headers: { "user-agent": "Mozilla/5.0 (fantasy-league-page)", ...(opts.headers || {}) } });
      if (!res.ok) throw new Error(url + " HTTP " + res.status);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}
async function gql(query, variables) {
  const j = await http(CONFIG.bn, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
  if (j.errors) throw new Error("BasketNews: " + j.errors.map(e => e.message).join("; "));
  return j.data;
}
const el = (what, code) => http(`${CONFIG.el}/${what}?gamecode=${code}&seasoncode=${CONFIG.season}`, {}, 2).catch(() => null);

const PLAYER = `id firstName lastName
  team(leagueId:$l,fantasyRound:$r){ team{ abbreviation games(fantasyRound:$r,currentRound:false){ basketnewsApiGameId team1{team{abbreviation}} team2{team{abbreviation}} } } }
  fantasy_pts(leagueId:$l,fantasyRound:$r,pointCalcSystem:$p)`;
const Q_LINEUPS = `query($l:String!,$f:String!,$r:Int,$p:String){ draftLeagueFantasyTeamLineupsFromClient(fantasyLeagueId:$f){
  fantasyTeamId fantasyTeam{ title } players{ cardIdentifier position captain player{ ${PLAYER} } } } }`;
const Q_POOL = `query($l:String!,$r:Int,$p:String){ playersSearchRecordsFromClient(leagueId:$l,fantasyRound:$r){ records{ ${PLAYER} } } }`;
const Q_SCHED = `query($l:String){ leagueRoundScheduleFromClient(leagueId:$l,locale:"lt"){ rounds{ matchdays{ games{ basketnewsApiGameId start canceled } } } } }`;
const Q_H2H = `query($f:String,$r:Int){ allHeadToHeadScheduleRecordsFromClient(fantasyLeagueId:$f,fantasyRound:$r){ records{ fantasyTeam1{ title } fantasyTeam2{ title } fantasyTeam1ScorePoints fantasyTeam2ScorePoints } } }`;

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/đ/g, "d")
  .toLowerCase().replace(/[^a-z ]/g, " ").replace(/\b(jr|sr|ii|iii|iv)\b/g, " ").replace(/\s+/g, " ").trim();
const elName = s => { const [last, first] = String(s).split(",").map(x => x.trim()); return first ? first + " " + last : last; };
const title = s => s.toLowerCase().replace(/(^|[\s\-'.])([a-zÀ-ɏ])/g, (m, a, b) => a + b.toUpperCase());
const secs = m => { if (!m || m === "DNP") return 0; const [a, b] = m.split(":").map(Number); return a * 60 + (b || 0); };
const round2 = x => Math.round(x * 100) / 100;
function multiplier(card, captain) {
  const [k, n] = card.split("-");
  if (k === "i") return 0;
  if (k === "b") return n === "1" ? 1 : 0.5;
  return captain ? 2 : 1;
}
function statArray(p) { // [sek, pts, 2m, 2a, 3m, 3a, ftm, fta, or, dr, reb, ast, stl, blk, ba, to, pf, fd, pir]
  return [secs(p.Minutes), p.Points, p.FieldGoalsMade2, p.FieldGoalsAttempted2, p.FieldGoalsMade3, p.FieldGoalsAttempted3,
    p.FreeThrowsMade, p.FreeThrowsAttempted, p.OffensiveRebounds, p.DefensiveRebounds, p.TotalRebounds, p.Assistances,
    p.Steals, p.BlocksFavour, p.BlocksAgainst, p.Turnovers, p.FoulsCommited, p.FoulsReceived, p.Valuation].map(v => Number(v) || 0);
}
const clubOf = pl => pl.team && pl.team.team ? toEl(pl.team.team.abbreviation) : "";
const fullName = pl => [pl.firstName, pl.lastName].filter(Boolean).join(" ");

// ---------- Bendra visoms lygoms: turas, rungtynės, Eurolygos statistika ----------
async function buildShared() {
  // Einamasis turas: paskutinis prasidėjęs; į kitą perjungiama likus 12 val. iki pirmų jo rungtynių
  const sched = await gql(Q_SCHED, { l: CONFIG.leagueId });
  const now = Date.now();
  let r = 0;
  sched.leagueRoundScheduleFromClient.rounds.forEach((rd, i) => {
    const starts = rd.matchdays.flatMap(m => m.games).map(g => new Date(g.start).getTime()).filter(Boolean);
    if (starts.length && Math.min(...starts) - 12 * 3600e3 <= now) r = i;
  });
  const pool = await gql(Q_POOL, { l: CONFIG.leagueId, r, p: CONFIG.pointCalcSystem });
  const fpByKey = {}, fpByLast = {}, bnGames = {};
  for (const pl of pool.playersSearchRecordsFromClient.records) {
    const t = pl.team && pl.team.team;
    if (t) for (const g of t.games || []) bnGames[g.basketnewsApiGameId] = [toEl(g.team1.team.abbreviation), toEl(g.team2.team.abbreviation)];
    fpByKey[clubOf(pl) + "|" + norm(fullName(pl))] = pl.fantasy_pts;
    fpByLast[clubOf(pl) + "|" + norm(pl.lastName)] = pl.fantasy_pts;
  }
  const bnSched = (sched.leagueRoundScheduleFromClient.rounds[r] || { matchdays: [] }).matchdays.flatMap(m => m.games).filter(g => !g.canceled);

  const codes = Array.from({ length: 12 }, (_, i) => r * 10 + i + 1);
  const headers = await Promise.all(codes.map(c => el("Header", c)));
  const elByTeams = {};
  headers.forEach((h, i) => { if (h && h.CodeTeamA) elByTeams[h.CodeTeamA.trim() + "-" + h.CodeTeamB.trim()] = { code: codes[i], h }; });
  const games = [];
  for (const g of bnSched) {
    const t = bnGames[g.basketnewsApiGameId]; if (!t) continue;
    const [a, b] = t; const x = elByTeams[a + "-" + b]; const h = x && x.h;
    const hs = h ? parseInt(h.ScoreA, 10) : NaN, as = h ? parseInt(h.ScoreB, 10) : NaN;
    const started = !!h && (h.Live || hs > 0 || as > 0);
    games.push({ id: x ? x.code : "bn" + g.basketnewsApiGameId, start: g.start, h: a, a: b,
      hs: started ? hs : null, as: started ? as : null, status: h && h.Live ? "live" : started ? "final" : "scheduled",
      q: h ? String(h.Quarter || "").trim() : "", clock: h ? String(h.RemainingPartialTime || "").trim() : "" });
  }
  games.sort((x, y) => (x.start || "").localeCompare(y.start || ""));

  const boxes = await Promise.all(games.map(g => g.status === "scheduled" || typeof g.id !== "number" ? null : el("Boxscore", g.id)));
  const elPlayers = [];
  boxes.forEach((bx, i) => {
    if (!bx || !bx.Stats) return;
    for (const side of bx.Stats) for (const p of side.PlayersStats || []) {
      const club = String(p.Team || "").trim(); const name = elName(p.Player);
      elPlayers.push({ game: games[i].id, club, name: title(name), key: club + "|" + norm(name),
        lastKey: club + "|" + norm(String(p.Player).split(",")[0]), dnp: p.Minutes === "DNP" || !p.Minutes,
        st: statArray(p), s: p.IsStarter ? 1 : 0, oc: p.IsPlaying ? 1 : 0 });
    }
  });
  return { r, games, elPlayers, fpByKey, fpByLast };
}

// ---------- Viena lyga ----------
async function buildLeague(S, L) {
  const { r, games } = S;
  const elPlayers = S.elPlayers.map(e => ({ ...e }));
  const lu = await gql(Q_LINEUPS, { l: CONFIG.leagueId, f: L.fantasyLeagueId, r, p: CONFIG.pointCalcSystem });
  const findEl = (club, name, last) => elPlayers.find(e => e.key === club + "|" + norm(name)) ||
    elPlayers.find(e => e.lastKey === club + "|" + norm(last));
  const gameOfClub = club => (games.find(g => g.h === club || g.a === club) || {}).id || null;

  const teams = lu.draftLeagueFantasyTeamLineupsFromClient.map((t, ti) => {
    const players = t.players.map(p => {
      const pl = p.player, club = clubOf(pl), name = fullName(pl);
      const e = findEl(club, name, pl.lastName);
      const mult = multiplier(p.cardIdentifier, p.captain);
      const fp = pl.fantasy_pts == null ? null : pl.fantasy_pts;
      const out = { name, club, pos: (p.position || "").charAt(0).toUpperCase(), card: p.cardIdentifier, cap: !!p.captain, mult,
        game: gameOfClub(club), fp, total: fp == null ? 0 : round2(fp * mult),
        st: e && !e.dnp ? e.st : null, dnp: e ? e.dnp : false, s: e ? e.s : 0, oc: e ? e.oc : 0 };
      if (e) { e.owner = ti; e.ownedP = out; }
      return out;
    });
    return { id: t.fantasyTeamId, title: t.fantasyTeam.title, total: round2(players.reduce((s, p) => s + p.total, 0)), players };
  });

  const pool = elPlayers.filter(e => !e.dnp).map(e => {
    const o = e.ownedP;
    const fp = o ? o.fp : (S.fpByKey[e.key] ?? S.fpByLast[e.lastKey] ?? null);
    return { name: o ? o.name : e.name, club: e.club, game: e.game, fp, st: e.st, s: e.s, oc: e.oc,
      owner: e.owner ?? null, card: o ? o.card : null, cap: o ? o.cap : false };
  });

  const data = { slug: L.slug, title: L.title, format: L.format, round: r + 1, myTeam: L.myTeam, tv: TV, games, teams, pool };

  if (L.format === "h2h") {
    const rounds = await Promise.all(Array.from({ length: r + 1 }, (_, i) => gql(Q_H2H, { f: L.fantasyLeagueId, r: i }).catch(() => null)));
    data.results = []; // ankstesnių turų oficialūs rezultatai
    rounds.forEach((d, i) => {
      if (!d) return;
      const recs = d.allHeadToHeadScheduleRecordsFromClient.records;
      if (i < r) recs.forEach(m => data.results.push({ r: i + 1, a: m.fantasyTeam1.title, b: m.fantasyTeam2.title, as: m.fantasyTeam1ScorePoints, bs: m.fantasyTeam2ScorePoints }));
      else data.matchups = recs.map(m => ({ a: m.fantasyTeam1.title, b: m.fantasyTeam2.title, as: m.fantasyTeam1ScorePoints, bs: m.fantasyTeam2ScorePoints }));
    });
    // Kai turas baigtas ir BN jau paskelbė oficialius taškus – rodome juos (sudėtys po turo galėjo pasikeisti)
    if (games.length && games.every(g => g.status === "final") && data.matchups) {
      const off = {};
      data.matchups.forEach(m => { if (m.as > 0 || m.bs > 0) { off[m.a] = m.as; off[m.b] = m.bs; } });
      data.teams.forEach(t => { if (off[t.title] != null) t.official = off[t.title]; });
    }
  }
  return data;
}

(async () => {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);
  const S = await buildShared();
  for (const L of LEAGUES) {
    const file = path.join(DIR, L.slug + ".json");
    let old = null;
    try { old = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {
      // pirmą kartą perimame seną data.json (pirmoji lyga)
      if (L.slug === "bn") { try { old = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8")); } catch (e2) {} }
    }
    // Baigtas turas (visos rungtynės baigtos ir praėjo 4 val.) užfiksuojamas ir nebeperskaičiuojamas
    const frozen = !!old && old.round === S.r + 1 && old.games && old.games.length > 0 && old.teams &&
      old.games.every(g => g.status === "final") &&
      Date.now() - Math.max(...old.games.map(g => new Date(g.start).getTime() || 0)) > 4 * 3600e3 &&
      (!old.slug || old.slug === L.slug);
    if (frozen) {
      if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ ...old, slug: L.slug, title: L.title, format: L.format, myTeam: L.myTeam }));
      console.log(L.slug + ": turas baigtas, duomenys užfiksuoti."); continue;
    }
    try {
      const data = await buildLeague(S, L);
      const history = (old && old.history) || {};
      if (L.format === "classic") history[String(data.round)] = Object.fromEntries(data.teams.map(t => [t.title, t.total]));
      data.history = history;
      const strip = d => JSON.stringify({ ...d, updated: undefined });
      if (old && strip(old) === strip(data)) { console.log(L.slug + ": pakeitimų nėra."); continue; }
      data.updated = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify(data));
      console.log(L.slug + ": atnaujinta, turas " + data.round + " | " + data.teams.map(t => t.title + " " + t.total).join(", "));
    } catch (e) {
      console.error(L.slug + ": klaida", e);
      process.exitCode = 1;
    }
  }
})().catch(err => { console.error(err); process.exit(1); });
