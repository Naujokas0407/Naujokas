// Paleidžiamas GitHub Actions: node update.js
// Paima lygos duomenis iš BasketNews Fantasy ir įrašo data.json.

const CONFIG = {
  endpoint: "https://fantasy.basketnews.com/backend/graphql",
  leagueId: "6a7ae0128b647e038c999860",        // Eurolyga
  fantasyLeagueId: "6a9b0e7499d3c87221c70fe4", // jūsų draft lyga
  pointCalcSystem: "modern",
  myTeamTitle: "Naujokas"
};

async function gql(query, variables) {
  const res = await fetch(CONFIG.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error("BasketNews HTTP " + res.status);
  const j = await res.json();
  if (j.errors) throw new Error("BasketNews: " + j.errors.map(e => e.message).join("; "));
  return j.data;
}

const STATS = "s_time s_pts s_2pm s_2pa s_3pm s_3pa s_ftm s_fta s_orb s_drb s_ast s_stl s_blk s_rbs s_tov s_pf s_rf s_eff s_gp";
const TEAM_GAMES = `team(leagueId:$l,fantasyRound:$r){ team{ id abbreviation games(fantasyRound:$r,currentRound:false){ basketnewsApiGameId team1{team{abbreviation}} team2{team{abbreviation}} } } }`;
const PLAYER = `id firstName lastName ${TEAM_GAMES} stats(leagueId:$l,fantasyRound:$r){ ${STATS} } fantasy_pts(leagueId:$l,fantasyRound:$r,pointCalcSystem:$p)`;

const Q_ROUND = `query($f:String!){ draftLeagueFantasyTeamLineupsFromClient(fantasyLeagueId:$f){ fantasyRound } }`;
const Q_LINEUPS = `query($l:String!,$f:String!,$r:Int,$p:String){
  draftLeagueFantasyTeamLineupsFromClient(fantasyLeagueId:$f){
    fantasyTeamId fantasyRound fantasyTeam{ title }
    players{ cardIdentifier position captain player{ ${PLAYER} } }
  } }`;
const Q_POOL = `query($l:String!,$r:Int,$p:String){ playersSearchRecordsFromClient(leagueId:$l,fantasyRound:$r){ records{ ${PLAYER} } } }`;
const Q_SCHED = `query($l:String){ leagueRoundScheduleFromClient(leagueId:$l,locale:"lt"){ rounds{ matchdays{ games{ basketnewsApiGameId start team1{score} team2{score} live completed canceled } } } } }`;

function statArray(s) {
  if (!s || !s.s_gp) return null;
  return [s.s_time, s.s_pts, s.s_2pm, s.s_2pa, s.s_3pm, s.s_3pa, s.s_ftm, s.s_fta, s.s_orb, s.s_drb,
          s.s_orb + s.s_drb, s.s_ast, s.s_stl, s.s_blk, s.s_rbs, s.s_tov, s.s_pf, s.s_rf, s.s_eff];
}
function multiplier(card, captain) {
  const [k, n] = card.split("-");
  if (k === "i") return 0;
  if (k === "b") return n === "1" ? 1 : 0.5;
  return captain ? 2 : 1;
}
const round2 = x => Math.round(x * 100) / 100;

async function build() {
  const first = await gql(Q_ROUND, { f: CONFIG.fantasyLeagueId });
  const r = first.draftLeagueFantasyTeamLineupsFromClient[0].fantasyRound;
  const vars = { l: CONFIG.leagueId, f: CONFIG.fantasyLeagueId, r, p: CONFIG.pointCalcSystem };

  const [lu, pool, sched] = await Promise.all([
    gql(Q_LINEUPS, vars),
    gql(Q_POOL, { l: vars.l, r, p: vars.p }),
    gql(Q_SCHED, { l: vars.l })
  ]);

  // Rungtynės: komandų santrumpos iš žaidėjų duomenų, rezultatai iš tvarkaraščio
  const gameClubs = {};
  const clubOf = pl => pl.team && pl.team.team;
  const noteGames = pl => {
    const c = clubOf(pl); if (!c) return;
    for (const g of c.games || []) gameClubs[g.basketnewsApiGameId] = [g.team1.team.abbreviation, g.team2.team.abbreviation];
  };
  pool.playersSearchRecordsFromClient.records.forEach(noteGames);
  lu.draftLeagueFantasyTeamLineupsFromClient.forEach(t => t.players.forEach(p => noteGames(p.player)));

  const roundSched = (sched.leagueRoundScheduleFromClient.rounds[r] || { matchdays: [] });
  const games = roundSched.matchdays.flatMap(m => m.games).filter(g => !g.canceled).map(g => {
    const [h, a] = gameClubs[g.basketnewsApiGameId] || ["?", "?"];
    const status = g.completed ? "final" : g.live ? "live" : "scheduled";
    return { id: g.basketnewsApiGameId, start: g.start, h, a, hs: status === "scheduled" ? null : g.team1.score, as: status === "scheduled" ? null : g.team2.score, status };
  }).sort((x, y) => x.start.localeCompare(y.start));

  const gameIdOf = pl => { const c = clubOf(pl); const g = c && c.games && c.games[0]; return g ? g.basketnewsApiGameId : null; };
  const name = pl => [pl.firstName, pl.lastName].filter(Boolean).join(" ");
  const posLetter = p => (p || "").charAt(0).toUpperCase();

  const teams = lu.draftLeagueFantasyTeamLineupsFromClient.map(t => {
    const players = t.players.map(p => {
      // cardIdentifier = tikra sudėtis (taip skaičiuoja BasketNews lentelė).
      // playedAs* yra BasketNews prognozė su automatiniais keitimais, jos nenaudojame.
      const card = p.cardIdentifier;
      const cap = p.captain;
      const mult = multiplier(card, cap);
      const fp = p.player.fantasy_pts;
      return {
        id: p.player.id, name: name(p.player), club: clubOf(p.player) ? clubOf(p.player).abbreviation : "",
        pos: posLetter(p.position), card, cap: !!cap, mult,
        game: gameIdOf(p.player), fp: fp == null ? null : fp,
        total: fp == null ? 0 : round2(fp * mult), st: statArray(p.player.stats)
      };
    });
    const total = round2(players.reduce((s, p) => s + p.total, 0));
    return { id: t.fantasyTeamId, title: t.fantasyTeam.title, total, players };
  });

  const owned = {};
  teams.forEach((t, ti) => t.players.forEach(p => { owned[p.id] = ti; }));
  const poolOut = pool.playersSearchRecordsFromClient.records
    .filter(pl => pl.stats && pl.stats.s_gp)
    .map(pl => ({ id: pl.id, name: name(pl), club: clubOf(pl) ? clubOf(pl).abbreviation : "", game: gameIdOf(pl), fp: pl.fantasy_pts, st: statArray(pl.stats), owner: owned[pl.id] ?? null }));

  return { round: r + 1, myTeam: CONFIG.myTeamTitle, games, teams, pool: poolOut };
}


const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "data.json");

(async () => {
  let old = null;
  try { old = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { /* pirmas paleidimas */ }

  const data = await build();

  // Turų istorija: { "1": { teamId: taškai }, "2": {...} }
  const history = (old && old.history) || {};
  history[String(data.round)] = Object.fromEntries(data.teams.map(t => [t.id, t.total]));
  data.history = history;

  const strip = d => JSON.stringify({ ...d, updated: undefined });
  if (old && strip(old) === strip(data)) {
    console.log("Pakeitimų nėra.");
    return;
  }
  data.updated = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(data));
  console.log("data.json atnaujintas: turas " + data.round + ", " + data.teams.map(t => t.title + " " + t.total).join(", "));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
