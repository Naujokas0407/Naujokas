// Paleidžiamas GitHub Actions: node update.js
// Rungtynių informacija ir statistika – iš oficialios Eurolygos (live.euroleague.net).
// Sudėtys, kapitonai ir fantasy taškai – iš BasketNews Fantasy.
const fs = require("fs");
const path = require("path");

const CONFIG = {
  bn: "https://fantasy.basketnews.com/backend/graphql",
  el: "https://live.euroleague.net/api",
  season: "E2026",
  leagueId: "6a7ae0128b647e038c999860",        // Eurolyga BN sistemoje
  fantasyLeagueId: "6a9b0e7499d3c87221c70fe4", // jūsų draft lyga
  pointCalcSystem: "modern",
  myTeamTitle: "Naujokas"
};
const FILE = path.join(__dirname, "data.json");
let FREEZE = null;

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
const el = (what, code) => http(`${CONFIG.el}/${what}?gamecode=${code}&seasoncode=${CONFIG.season}`).catch(() => null);

// ---------- BasketNews: sudėtys ir fantasy taškai ----------
const PLAYER = `id firstName lastName
  team(leagueId:$l,fantasyRound:$r){ team{ abbreviation games(fantasyRound:$r,currentRound:false){ basketnewsApiGameId team1{team{abbreviation}} team2{team{abbreviation}} } } }
  fantasy_pts(leagueId:$l,fantasyRound:$r,pointCalcSystem:$p)`;
const Q_ROUND = `query($f:String!){ draftLeagueFantasyTeamLineupsFromClient(fantasyLeagueId:$f){ fantasyRound } }`;
const Q_LINEUPS = `query($l:String!,$f:String!,$r:Int,$p:String){ draftLeagueFantasyTeamLineupsFromClient(fantasyLeagueId:$f){
  fantasyTeamId fantasyTeam{ title } players{ cardIdentifier position captain player{ ${PLAYER} } } } }`;
const Q_POOL = `query($l:String!,$r:Int,$p:String){ playersSearchRecordsFromClient(leagueId:$l,fantasyRound:$r){ records{ ${PLAYER} } } }`;
const Q_SCHED = `query($l:String){ leagueRoundScheduleFromClient(leagueId:$l,locale:"lt"){ rounds{ matchdays{ games{ basketnewsApiGameId start canceled } } } } }`;

// ---------- pagalbinės ----------
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

async function build() {
  // Einamasis turas pagal tvarkaraštį: rodomas paskutinis prasidėjęs turas,
  // į kitą perjungiama likus 12 val. iki pirmų jo rungtynių.
  const sched = await gql(Q_SCHED, { l: CONFIG.leagueId });
  const now = Date.now();
  let r = 0;
  sched.leagueRoundScheduleFromClient.rounds.forEach((rd, i) => {
    const starts = rd.matchdays.flatMap(m => m.games).map(g => new Date(g.start).getTime()).filter(Boolean);
    if (starts.length && Math.min(...starts) - 12 * 3600e3 <= now) r = i;
  });
  if (FREEZE && FREEZE(r)) return null;
  const vars = { l: CONFIG.leagueId, f: CONFIG.fantasyLeagueId, r, p: CONFIG.pointCalcSystem };
  const [lu, pool] = await Promise.all([ gql(Q_LINEUPS, vars), gql(Q_POOL, { l: vars.l, r, p: vars.p }) ]);

  // BN žaidėjų fantasy taškai pagal klubą + vardą
  const clubOf = pl => pl.team && pl.team.team ? toEl(pl.team.team.abbreviation) : "";
  const fullName = pl => [pl.firstName, pl.lastName].filter(Boolean).join(" ");
  const fpByKey = {}, fpByLast = {};
  const bnGames = {};
  const noteGames = pl => { const t = pl.team && pl.team.team; if (!t) return;
    for (const g of t.games || []) bnGames[g.basketnewsApiGameId] = [toEl(g.team1.team.abbreviation), toEl(g.team2.team.abbreviation)]; };
  for (const pl of pool.playersSearchRecordsFromClient.records) {
    noteGames(pl);
    fpByKey[clubOf(pl) + "|" + norm(fullName(pl))] = pl.fantasy_pts;
    fpByLast[clubOf(pl) + "|" + norm(pl.lastName)] = pl.fantasy_pts;
  }
  lu.draftLeagueFantasyTeamLineupsFromClient.forEach(t => t.players.forEach(p => noteGames(p.player)));

  // Turo rungtynės: laikas iš BN tvarkaraščio, visa kita iš Eurolygos
  const bnSched = (sched.leagueRoundScheduleFromClient.rounds[r] || { matchdays: [] }).matchdays.flatMap(m => m.games).filter(g => !g.canceled);
  const startByTeams = {};
  for (const g of bnSched) { const t = bnGames[g.basketnewsApiGameId]; if (t) startByTeams[t.join("-")] = g.start; }

  // Eurolygos antraštės (būna tik prasidėjusioms ar sužaistoms rungtynėms)
  const codes = Array.from({ length: 12 }, (_, i) => r * 10 + i + 1);
  const headers = await Promise.all(codes.map(c => el("Header", c)));
  const elByTeams = {};
  headers.forEach((h, i) => { if (h && h.CodeTeamA) elByTeams[h.CodeTeamA.trim() + "-" + h.CodeTeamB.trim()] = { code: codes[i], h }; });

  const games = [];
  for (const g of bnSched) {
    const t = bnGames[g.basketnewsApiGameId]; if (!t) continue;
    const [a, b] = t; const x = elByTeams[a + "-" + b];
    const h = x && x.h;
    const hs = h ? parseInt(h.ScoreA, 10) : NaN, as = h ? parseInt(h.ScoreB, 10) : NaN;
    const started = !!h && (h.Live || hs > 0 || as > 0);
    const status = h && h.Live ? "live" : started ? "final" : "scheduled";
    games.push({ id: x ? x.code : "bn" + g.basketnewsApiGameId, start: g.start, h: a, a: b,
      hs: started ? hs : null, as: started ? as : null, status,
      q: h ? String(h.Quarter || "").trim() : "", clock: h ? String(h.RemainingPartialTime || "").trim() : "" });
  }
  games.sort((x, y) => (x.start || "").localeCompare(y.start || ""));

  // Eurolygos statistika vykstančioms ir baigtoms rungtynėms
  const boxes = await Promise.all(games.map(g => g.status === "scheduled" || typeof g.id !== "number" ? null : el("Boxscore", g.id)));
  const elPlayers = []; // {game, club, name, key, lastKey, st, s, oc}
  boxes.forEach((bx, i) => {
    if (!bx || !bx.Stats) return;
    for (const side of bx.Stats) for (const p of side.PlayersStats || []) {
      const club = String(p.Team || "").trim();
      const name = elName(p.Player);
      elPlayers.push({ game: games[i].id, club, name: title(name), key: club + "|" + norm(name),
        lastKey: club + "|" + norm(String(p.Player).split(",")[0]), dnp: p.Minutes === "DNP" || !p.Minutes,
        st: statArray(p), s: p.IsStarter ? 1 : 0, oc: p.IsPlaying ? 1 : 0 });
    }
  });
  const findEl = (club, name, last) => elPlayers.find(e => e.key === club + "|" + norm(name)) ||
    elPlayers.find(e => e.lastKey === club + "|" + norm(last));
  const gameOfClub = club => (games.find(g => g.h === club || g.a === club) || {}).id || null;

  // Fantasy komandos
  const teams = lu.draftLeagueFantasyTeamLineupsFromClient.map((t, ti) => {
    const players = t.players.map(p => {
      const pl = p.player, club = clubOf(pl), name = fullName(pl);
      const e = findEl(club, name, pl.lastName);
      const mult = multiplier(p.cardIdentifier, p.captain);
      const fp = pl.fantasy_pts == null ? null : pl.fantasy_pts;
      return { name, club, pos: (p.position || "").charAt(0).toUpperCase(), card: p.cardIdentifier, cap: !!p.captain, mult,
        game: gameOfClub(club), fp, total: fp == null ? 0 : round2(fp * mult),
        st: e && !e.dnp ? e.st : null, dnp: e ? e.dnp : false, s: e ? e.s : 0, oc: e ? e.oc : 0 };
    });
    t.players.forEach((p, i) => { const e = findEl(players[i].club, players[i].name, p.player.lastName); if (e) { e.owner = ti; e.ownedP = players[i]; } });
    return { id: t.fantasyTeamId, title: t.fantasyTeam.title, total: round2(players.reduce((s, p) => s + p.total, 0)), players };
  });

  // Visi sužaidę žaidėjai (Eurolygos statistika + BN fantasy taškai + savininkas)
  const poolOut = elPlayers.filter(e => !e.dnp).map(e => {
    const o = e.ownedP;
    const fp = o ? o.fp : (fpByKey[e.key] ?? fpByLast[e.lastKey] ?? null);
    return { name: o ? o.name : e.name, club: e.club, game: e.game, fp, st: e.st, s: e.s, oc: e.oc,
      owner: e.owner ?? null, card: o ? o.card : null, cap: o ? o.cap : false };
  });

  return { round: r + 1, myTeam: CONFIG.myTeamTitle, tv: TV, games, teams, pool: poolOut };
}

(async () => {
  let old = null;
  try { old = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { /* pirmas paleidimas */ }
  // Baigtas turas (visos rungtynės baigtos ir praėjo 4 val. nuo paskutinių) užfiksuojamas ir nebeperskaičiuojamas
  FREEZE = r => !!old && old.round === r + 1 && old.games && old.games.length > 0 &&
    old.games.every(g => g.status === "final") &&
    Date.now() - Math.max(...old.games.map(g => new Date(g.start).getTime() || 0)) > 4 * 3600e3;
  const data = await build();
  if (!data) { console.log("Turas baigtas, duomenys užfiksuoti."); return; }
  const history = (old && old.history) || {};
  history[String(data.round)] = Object.fromEntries(data.teams.map(t => [t.title, t.total]));
  data.history = history;
  const strip = d => JSON.stringify({ ...d, updated: undefined });
  if (old && strip(old) === strip(data)) { console.log("Pakeitimų nėra."); return; }
  data.updated = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(data));
  console.log("data.json atnaujintas: turas " + data.round + " | " + data.games.map(g => g.h + "-" + g.a + " " + g.status).join(", "));
  console.log(data.teams.map(t => t.title + " " + t.total).join(", "));
})().catch(err => { console.error(err); process.exit(1); });
