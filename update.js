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

const PLAYER = `id firstName lastName health
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
// Pozicija -> G / F / C
function posLetter(v) {
  const s = String(v || "").trim().toLowerCase(); if (!s) return "";
  if (/cent|^c\b|^c$|^c\/|^c-/.test(s)) return "C";
  if (/forw|puol|^(sf|pf|f)\b|^f\/|^f-/.test(s)) return "F";
  if (/guard|gyn|^(pg|sg|g)\b|^g\/|^g-/.test(s)) return "G";
  const c = s.charAt(0).toUpperCase(); return "GFC".includes(c) ? c : "";
}
// BN žaidėjo pozicijos laukas (randamas per GraphQL introspekciją)
async function discoverPosField() {
  const TR = "name kind ofType{ name kind ofType{ name kind ofType{ name kind } } }";
  const un = t => { while (t && !t.name && t.ofType) t = t.ofType; return t && t.name; };
  const typeFields = async n => ((await gql(`{ __type(name:"${n}"){ fields{ name type{ ${TR} } } } }`)).__type || {}).fields || [];
  const q = await typeFields("Query");
  const f1 = q.find(f => f.name === "playersSearchRecordsFromClient"); if (!f1) return null;
  const rec = (await typeFields(un(f1.type))).find(f => f.name === "records"); if (!rec) return null;
  const pf = (await typeFields(un(rec.type))).filter(f => /pos/i.test(f.name));
  console.log("BN žaidėjo pozicijos laukai:", pf.map(f => f.name + ":" + un(f.type)).join(", ") || "nėra");
  for (const f of pf) {
    let k = f.type; while (k && (k.kind === "NON_NULL" || k.kind === "LIST") && k.ofType) k = k.ofType;
    if (k.kind === "SCALAR" || k.kind === "ENUM") return f.name;
    const sub = await typeFields(un(f.type)), s = sub.find(x => /^(abbreviation|short|shortName|code|name|title)$/.test(x.name));
    if (s) return `${f.name}{ ${s.name} }`;
  }
  return null;
}
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

// Lietuvos laiko juostos poslinkis (ms) duotu momentu
function vilniusOffset(t) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Vilnius", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(t));
  const g = k => +f.find(x => x.type === k).value;
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(t / 1000) * 1000;
}
// Kitos dienos 12:00 Lietuvos laiku po momento t
function noonNextDayVilnius(t) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t)).split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d + 1, 12);
  return guess - vilniusOffset(guess);
}
// Į kitą turą perjungiama kitą dieną 12:00 Lietuvos laiku, bet ne vėliau kaip 2 val. 30 min. iki pirmųjų naujo turo rungtynių
// (ir ne anksčiau nei ~2 val. 30 min. po paskutinių ankstesnio turo rungtynių pradžios)
const H = 3600e3;
function switchAt(rounds, i) {
  const ts = k => rounds[k].matchdays.flatMap(m => m.games).filter(g => !g.canceled).map(g => new Date(g.start).getTime()).filter(Boolean);
  const prev = ts(i - 1), next = ts(i);
  if (!prev.length) return null;
  const lastPrev = Math.max(...prev);
  let t = noonNextDayVilnius(lastPrev);
  if (next.length) t = Math.min(t, Math.min(...next) - 2.5 * H);
  return Math.max(t, lastPrev + 2.5 * H);
}
function pickRound(rounds, now) {
  let r = 0;
  for (let i = 1; i < rounds.length; i++) {
    const t = switchAt(rounds, i);
    if (t != null && now >= t) r = i; else break;
  }
  return r;
}

// ---------- Bendra visoms lygoms: turas, rungtynės, Eurolygos statistika ----------
async function buildShared() {
  // Einamasis turas: žr. switchAt()
  const sched = await gql(Q_SCHED, { l: CONFIG.leagueId });
  const r = pickRound(sched.leagueRoundScheduleFromClient.rounds, Date.now());
  const pool = await gql(Q_POOL, { l: CONFIG.leagueId, r, p: CONFIG.pointCalcSystem });
  const fpByKey = {}, fpByLast = {}, bnGames = {}, idByKey = {}, idByLast = {};
  for (const pl of pool.playersSearchRecordsFromClient.records) {
    const t = pl.team && pl.team.team;
    if (t) for (const g of t.games || []) bnGames[g.basketnewsApiGameId] = [toEl(g.team1.team.abbreviation), toEl(g.team2.team.abbreviation)];
    fpByKey[clubOf(pl) + "|" + norm(fullName(pl))] = pl.fantasy_pts;
    fpByLast[clubOf(pl) + "|" + norm(pl.lastName)] = pl.fantasy_pts;
    idByKey[clubOf(pl) + "|" + norm(fullName(pl))] = pl.id;
    idByLast[clubOf(pl) + "|" + norm(pl.lastName)] = pl.id;
  }

  // Ankstesnių turų fantasy taškai (sezono vidurkiams). Kiekvienas turas parsiunčiamas vieną kartą ir saugomas data/fp-hist.json
  const histFile = path.join(DIR, "fp-hist.json");
  let fpHist = {};
  try { fpHist = JSON.parse(fs.readFileSync(histFile, "utf8")); } catch (e) {}
  for (let i = 0; i < r; i++) {
    if (fpHist[i + 1]) continue;
    try {
      const d = await gql(Q_POOL, { l: CONFIG.leagueId, r: i, p: CONFIG.pointCalcSystem });
      const m = {};
      for (const pl of d.playersSearchRecordsFromClient.records) if (pl.fantasy_pts != null) m[pl.id] = pl.fantasy_pts;
      if (Object.keys(m).length) fpHist[i + 1] = m;
    } catch (e) { console.log("Nepavyko gauti " + (i + 1) + " turo taškų", e.message); }
  }
  fs.writeFileSync(histFile, JSON.stringify(fpHist));
  const avgOf = id => {
    const v = Object.keys(fpHist).filter(k => +k <= r).map(k => fpHist[k][id]).filter(x => x != null);
    return v.length ? { avg: round2(v.reduce((a, b) => a + b, 0) / v.length), gp: v.length, last: fpHist[r] ? (fpHist[r][id] ?? null) : null } : { avg: null, gp: 0, last: null };
  };
  // Traumos: BN žaidėjo būsena (ready / expected / uncertain / doubtful / out). Pokyčiai įrašomi į naujienas.
  const injFile = path.join(DIR, "injuries.json");
  let inj = null;
  try { inj = JSON.parse(fs.readFileSync(injFile, "utf8")); } catch (e) {}
  const baseline = !inj;
  inj = inj || { state: {}, news: [] };
  const nowIso = new Date().toISOString();
  let injChanged = baseline;
  for (const pl of pool.playersSearchRecordsFromClient.records) {
    const h = pl.health || "ready", prev = inj.state[pl.id];
    const info = { name: fullName(pl), club: clubOf(pl) };
    if (!prev) {
      inj.state[pl.id] = { h, since: nowIso, ...info }; injChanged = true;
      if (!baseline && h !== "ready") inj.news.unshift({ t: nowIso, id: pl.id, ...info, from: null, to: h });
    } else if (prev.h !== h) {
      inj.news.unshift({ t: nowIso, id: pl.id, ...info, from: prev.h, to: h });
      inj.state[pl.id] = { h, since: nowIso, ...info }; injChanged = true;
    }
  }
  inj.news = inj.news.slice(0, 80);
  if (injChanged) { inj.updated = nowIso; fs.writeFileSync(injFile, JSON.stringify(inj)); }

  const bnPlayers = pool.playersSearchRecordsFromClient.records.map(pl => ({ id: pl.id, name: fullName(pl), club: clubOf(pl), fp: pl.fantasy_pts }));
  const bnSched = (sched.leagueRoundScheduleFromClient.rounds[r] || { matchdays: [] }).matchdays.flatMap(m => m.games).filter(g => !g.canceled);

  // Visų lygų sudėtys (vienas užklausimas lygai per paleidimą)
  const lu = {};
  for (const L of LEAGUES) { try { lu[L.slug] = await gql(Q_LINEUPS, { l: CONFIG.leagueId, f: L.fantasyLeagueId, r, p: CONFIG.pointCalcSystem }); } catch (e) { console.log(L.slug + ": nepavyko gauti sudėčių", e.message); } }

  // Žaidėjų pozicijos: data/pos.json (iš sudėčių ir iš BN žaidėjų sąrašo)
  let posOf = () => null, minOf = () => null;
  try {
  const posFile = path.join(DIR, "pos.json");
  let PS = { field: undefined, map: {} };
  try { PS = { ...PS, ...JSON.parse(fs.readFileSync(posFile, "utf8")) }; } catch (e) {}
  const pos0 = JSON.stringify(PS);
  Object.values(lu).forEach(d => d.draftLeagueFantasyTeamLineupsFromClient.forEach(t => t.players.forEach(p => { const x = posLetter(p.position); if (x) PS.map[p.player.id] = x; })));
  if (bnPlayers.some(p => !PS.map[p.id])) {
    try {
      if (PS.field === undefined) PS.field = await discoverPosField();
      if (PS.field) {
        const d = await gql(`query($l:String!,$r:Int){ playersSearchRecordsFromClient(leagueId:$l,fantasyRound:$r){ records{ id ${PS.field} } } }`, { l: CONFIG.leagueId, r });
        const fn = PS.field.split("{")[0].trim(), sub = (PS.field.match(/\{\s*(\w+)/) || [])[1];
        for (const pl of d.playersSearchRecordsFromClient.records) { let v = pl[fn]; if (Array.isArray(v)) v = v[0]; if (v && sub) v = v[sub]; const x = posLetter(v); if (x) PS.map[pl.id] = x; }
      }
    } catch (e) { console.log("Pozicijų nepavyko gauti:", e.message); if (PS.field === undefined) PS.field = null; }
  }
  // Atsarginis šaltinis – Eurolygos žaidėjų sąrašas (bandoma ne dažniau kaip kas 6 val.)
  const missing = () => bnPlayers.filter(p => !PS.map[p.id]).length;
  if (missing() && (!PS.elTried || Date.now() - PS.elTried > 6 * 3600e3)) {
    PS.elTried = Date.now(); PS.debug = [];
    const urls = [
      `https://api-live.euroleague.net/v2/competitions/E/seasons/${CONFIG.season}/people?personType=J&limit=1000`,
      `https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons/${CONFIG.season}/people?personType=J&limit=1000`
    ];
    for (const u of urls) {
      try {
        const res = await fetch(u, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
        const j = res.ok ? await res.json() : null;
        const arr = !j ? [] : Array.isArray(j) ? j : (j.data || j.people || j.items || []);
        let hit = 0;
        for (const it of arr) {
          const person = it.person || it, club = String((it.club && it.club.code) || it.clubCode || "").trim();
          const nm = person.name || [person.firstName, person.lastName].filter(Boolean).join(" ");
          const name = /,/.test(nm) ? elName(nm) : nm, last = /,/.test(nm) ? nm.split(",")[0] : String(nm).split(" ").slice(-1)[0];
          const x = posLetter(it.positionName || it.position || person.position);
          const id = idByKey[club + "|" + norm(name)] ?? idByLast[club + "|" + norm(last)];
          if (id && x && !PS.map[id]) { PS.map[id] = x; hit++; }
        }
        PS.debug.push({ u: u.split("/")[2], status: res.status, n: arr.length, hit, keys: arr[0] ? Object.keys(arr[0]).slice(0, 15) : null, pos: arr[0] ? [arr[0].positionName, arr[0].position] : null });
        if (hit) break;
      } catch (e) { PS.debug.push({ u: u.split("/")[2], err: e.message }); }
    }
    console.log("Eurolygos pozicijos:", JSON.stringify(PS.debug), "trūksta:", missing());
  }
  if (JSON.stringify(PS) !== pos0) fs.writeFileSync(posFile, JSON.stringify(PS));
  posOf = id => PS.map[id] || null;
  } catch (e) { console.log("Pozicijos:", e.message); }
  try {

  // Žaidimo minutės: data/min-hist.json – kiekvieno baigto turo sekundės pagal BN žaidėjo id
  const minFile = path.join(DIR, "min-hist.json");
  let minHist = {};
  try { minHist = JSON.parse(fs.readFileSync(minFile, "utf8")); } catch (e) {}
  let minChanged = false;
  for (let i = 1; i <= r; i++) {
    if (minHist[i]) continue;
    const bx = await Promise.all(Array.from({ length: 12 }, (_, k) => el("Boxscore", (i - 1) * 10 + k + 1)));
    const ok = bx.filter(b => b && b.Stats); if (ok.length < 9) { console.log(i + " turo minučių dar nėra (" + ok.length + ")"); continue; }
    const m = {};
    ok.forEach(b => b.Stats.forEach(side => (side.PlayersStats || []).forEach(p => {
      const club = String(p.Team || "").trim(), name = elName(p.Player), sec = secs(p.Minutes);
      const id = idByKey[club + "|" + norm(name)] ?? idByLast[club + "|" + norm(String(p.Player).split(",")[0])];
      if (id && sec > 0) m[id] = sec;
    })));
    minHist[i] = m; minChanged = true;
  }
  if (minChanged) fs.writeFileSync(minFile, JSON.stringify(minHist));
  minOf = id => { const v = Object.keys(minHist).filter(k => +k <= r).map(k => minHist[k][id]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  } catch (e) { console.log("Minutės:", e.message); }

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
  return { r, games, elPlayers, fpByKey, fpByLast, idByKey, idByLast, avgOf, bnPlayers, lu, posOf, minOf };
}

// ---------- Viena lyga ----------
async function buildLeague(S, L) {
  const { r, games } = S;
  const elPlayers = S.elPlayers.map(e => ({ ...e }));
  const lu = S.lu[L.slug] || await gql(Q_LINEUPS, { l: CONFIG.leagueId, f: L.fantasyLeagueId, r, p: CONFIG.pointCalcSystem });
  const findEl = (club, name, last) => elPlayers.find(e => e.key === club + "|" + norm(name)) ||
    elPlayers.find(e => e.lastKey === club + "|" + norm(last));
  const gameOfClub = club => (games.find(g => g.h === club || g.a === club) || {}).id || null;

  const teams = lu.draftLeagueFantasyTeamLineupsFromClient.map((t, ti) => {
    const players = t.players.map(p => {
      const pl = p.player, club = clubOf(pl), name = fullName(pl);
      const e = findEl(club, name, pl.lastName);
      const mult = multiplier(p.cardIdentifier, p.captain);
      const fp = pl.fantasy_pts == null ? null : pl.fantasy_pts;
      const A = S.avgOf(pl.id);
      const out = { id: pl.id, avg: A.avg, gp: A.gp, health: pl.health || "ready", name, club, pos: posLetter(p.position) || S.posOf(pl.id) || "", min: S.minOf(pl.id), card: p.cardIdentifier, cap: !!p.captain, mult,
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
    const id = o ? o.id : (S.idByKey[e.key] ?? S.idByLast[e.lastKey] ?? null);
    return { id, name: o ? o.name : e.name, club: e.club, pos: o ? o.pos : (id ? S.posOf(id) : null), min: id ? S.minOf(id) : null, game: e.game, fp, avg: id ? S.avgOf(id).avg : null, st: e.st, s: e.s, oc: e.oc,
      owner: e.owner ?? null, card: o ? o.card : null, cap: o ? o.cap : false };
  });

  // Geriausi laisvi žaidėjai pagal sezono vidurkį
  const ownedIds = new Set(teams.flatMap(t => t.players.map(p => p.id)));
  const fa = S.bnPlayers.filter(p => !ownedIds.has(p.id)).map(p => ({ id: p.id, name: p.name, club: p.club, pos: S.posOf(p.id), min: S.minOf(p.id), fp: p.fp, ...S.avgOf(p.id) }))
    .filter(p => p.gp > 0 || p.fp != null).sort((a, b) => (b.avg ?? b.fp ?? -99) - (a.avg ?? a.fp ?? -99));

  const data = { slug: L.slug, title: L.title, format: L.format, round: r + 1, myTeam: L.myTeam, tv: TV, games, teams, pool, fa };

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

// Perėjimai ir mainai: lyginamos komandų sudėtys tarp paleidimų. Žurnalas – data/<lyga>-tx.json
async function trackRoster(S, L) {
  const file = path.join(DIR, L.slug + "-tx.json");
  let tx = null;
  try { tx = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {}
  const lu = S.lu[L.slug] || await gql(Q_LINEUPS, { l: CONFIG.leagueId, f: L.fantasyLeagueId, r: S.r, p: CONFIG.pointCalcSystem });
  const cur = {}, names = {}, titles = {};
  for (const t of lu.draftLeagueFantasyTeamLineupsFromClient) {
    titles[t.fantasyTeamId] = t.fantasyTeam.title;
    for (const p of t.players) { cur[p.player.id] = t.fantasyTeamId; names[p.player.id] = { name: fullName(p.player), club: clubOf(p.player) }; }
  }
  if (!Object.keys(cur).length) return;
  if (!tx) { fs.writeFileSync(file, JSON.stringify({ roster: cur, names, titles, log: [] })); return; }
  const prev = tx.roster || {}, now = new Date().toISOString(), round = S.r + 1;
  const nm = id => names[id] || tx.names[id] || { name: "?", club: "" };
  const ttl = id => titles[id] || (tx.titles || {})[id] || "?";
  const moves = {}, adds = {}, drops = {};
  for (const [pid, tid] of Object.entries(cur)) {
    const was = prev[pid];
    if (!was) (adds[tid] = adds[tid] || []).push(pid);
    else if (was !== tid) { const k = [was, tid].sort().join("|"); (moves[k] = moves[k] || []).push({ pid, from: was, to: tid }); }
  }
  for (const [pid, tid] of Object.entries(prev)) if (!cur[pid]) (drops[tid] = drops[tid] || []).push(pid);
  const ev = [];
  for (const [k, list] of Object.entries(moves)) {
    const [a, b] = k.split("|");
    ev.push({ t: now, r: round, type: "trade", a: ttl(a), b: ttl(b),
      aGets: list.filter(x => x.to === a).map(x => nm(x.pid)), bGets: list.filter(x => x.to === b).map(x => nm(x.pid)) });
  }
  for (const tid of new Set([...Object.keys(adds), ...Object.keys(drops)])) {
    ev.push({ t: now, r: round, type: "fa", team: ttl(tid), in: (adds[tid] || []).map(nm), out: (drops[tid] || []).map(nm) });
  }
  const changed = ev.length || JSON.stringify(titles) !== JSON.stringify(tx.titles || {});
  if (!changed) return;
  tx.log = [...ev, ...(tx.log || [])].slice(0, 150);
  tx.roster = cur; tx.names = { ...tx.names, ...names }; tx.titles = titles; tx.updated = now;
  fs.writeFileSync(file, JSON.stringify(tx));
  if (ev.length) console.log(L.slug + ": sudėčių pokyčiai – " + ev.length);
}

// Turų archyvas: data/<lyga>-r<N>.json. Jei kurio nors praėjusio turo failo nėra, jis atkuriamas iš git istorijos.
const { execSync } = require("child_process");
const arch = (slug, r) => path.join(DIR, slug + "-r" + r + ".json");
function restoreFromGit(slug, round) {
  try {
    const hs = execSync("git log --format=%H -- data/" + slug + ".json", { cwd: __dirname }).toString().trim().split("\n").filter(Boolean);
    for (const h of hs) {
      let d; try { d = JSON.parse(execSync("git show " + h + ":data/" + slug + ".json", { cwd: __dirname, maxBuffer: 1e8 }).toString()); } catch (e) { continue; }
      if (d && d.round === round) { fs.writeFileSync(arch(slug, round), JSON.stringify(d)); console.log(slug + ": atkurtas " + round + " turo archyvas"); return; }
    }
  } catch (e) { console.log(slug + ": nepavyko atkurti " + round + " turo", e.message); }
}

// Pataisomas archyvas, išsaugotas dar nesibaigus turui (pvz., per GitHub sutrikimą): galutiniai rezultatai, statistika ir oficialūs taškai
async function repairArchive(L, round) {
  const f = arch(L.slug, round);
  let d; try { d = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return; }
  if (!d.games || d.games.every(g => g.status === "final")) return;
  let fpHist = {}; try { fpHist = JSON.parse(fs.readFileSync(path.join(DIR, "fp-hist.json"), "utf8")); } catch (e) {}
  const H = fpHist[round] || {};
  const box = {};
  for (const g of d.games) {
    if (g.status === "final" || typeof g.id !== "number") continue;
    const [h, bx] = await Promise.all([el("Header", g.id), el("Boxscore", g.id)]);
    if (!h || h.Live || !bx || !bx.Stats) { console.log(L.slug + ": " + round + " turo rungtynių " + g.id + " dar nepavyko pataisyti"); return; }
    g.hs = parseInt(h.ScoreA, 10); g.as = parseInt(h.ScoreB, 10); g.status = "final"; g.q = ""; g.clock = "";
    for (const side of bx.Stats) for (const p of side.PlayersStats || []) {
      const club = String(p.Team || "").trim(), name = elName(p.Player);
      const v = { st: statArray(p), dnp: p.Minutes === "DNP" || !p.Minutes, s: p.IsStarter ? 1 : 0, game: g.id };
      box[club + "|" + norm(name)] = v; box["L|" + club + "|" + norm(String(p.Player).split(",")[0])] = v;
    }
  }
  const find = (club, name) => box[club + "|" + norm(name)] || box["L|" + club + "|" + norm(String(name).split(" ").slice(-1)[0])];
  d.teams.forEach(t => {
    t.players.forEach(p => {
      const b = find(p.club, p.name);
      if (b) { p.st = b.dnp ? null : b.st; p.dnp = b.dnp; p.s = b.s; p.oc = 0; }
      if (H[p.id] != null) p.fp = H[p.id];
      p.total = p.fp == null ? 0 : round2(p.fp * p.mult);
    });
    t.total = round2(t.players.reduce((s, p) => s + p.total, 0));
  });
  (d.pool || []).forEach(p => { const b = find(p.club, p.name); if (b && !b.dnp) { p.st = b.st; p.oc = 0; } if (p.id && H[p.id] != null) p.fp = H[p.id]; });
  // H2H: oficialūs to turo rezultatai iš dabartinio lygos failo
  try {
    const cur = JSON.parse(fs.readFileSync(path.join(DIR, L.slug + ".json"), "utf8"));
    const res = (cur.results || []).filter(m => m.r === round);
    if (d.matchups && res.length) {
      d.matchups.forEach(m => { const x = res.find(z => z.a === m.a && z.b === m.b); if (x) { m.as = x.as; m.bs = x.bs; } });
      const off = {}; res.forEach(m => { off[m.a] = m.as; off[m.b] = m.bs; });
      d.teams.forEach(t => { if (off[t.title] != null) t.official = off[t.title]; });
    }
  } catch (e) {}
  const totals = Object.fromEntries(d.teams.map(t => [t.title, t.total]));
  if (L.format === "classic") d.history = { ...(d.history || {}), [String(round)]: totals };
  fs.writeFileSync(f, JSON.stringify(d));
  console.log(L.slug + ": pataisytas " + round + " turo archyvas");
  return totals;
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
    try { await trackRoster(S, L); } catch (e) { console.log(L.slug + ": nepavyko patikrinti sudėčių", e.message); }
    for (let r = 1; r <= S.r; r++) if (!fs.existsSync(arch(L.slug, r))) restoreFromGit(L.slug, r);
    for (let r = 1; r <= S.r; r++) {
      try {
        const tot = await repairArchive(L, r);
        if (tot && old && L.format === "classic") { old.history = { ...(old.history || {}), [String(r)]: tot }; fs.writeFileSync(file, JSON.stringify(old)); }
      } catch (e) { console.log(L.slug + ": archyvo taisymas", e.message); }
    }
    if (old && old.round && old.round !== S.r + 1 && !fs.existsSync(arch(L.slug, old.round))) fs.writeFileSync(arch(L.slug, old.round), JSON.stringify(old));
    if (frozen) {
      // užfiksuotam turui papildomai įrašomos pozicijos ir minutės
      const before = JSON.stringify(old);
      (old.fa || []).forEach(p => { p.pos = p.pos || S.posOf(p.id); p.min = S.minOf(p.id); });
      (old.pool || []).forEach(p => { if (p.id) { p.pos = p.pos || S.posOf(p.id); p.min = S.minOf(p.id); } });
      (old.teams || []).forEach(t => t.players.forEach(p => { p.min = S.minOf(p.id); }));
      if (JSON.stringify(old) !== before && fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(old));
      if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ ...old, slug: L.slug, title: L.title, format: L.format, myTeam: L.myTeam }));
      if (!fs.existsSync(arch(L.slug, old.round))) fs.writeFileSync(arch(L.slug, old.round), JSON.stringify(old));
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
      fs.writeFileSync(arch(L.slug, data.round), JSON.stringify(data));
      console.log(L.slug + ": atnaujinta, turas " + data.round + " | " + data.teams.map(t => t.title + " " + t.total).join(", "));
    } catch (e) {
      console.error(L.slug + ": klaida", e);
      process.exitCode = 1;
    }
  }
  try { require("./coach.js").run(DIR, LEAGUES.map(l => l.slug)); } catch (e) { console.log("Trenerių komentarai:", e.message); }
  try { require("./season.js").run(DIR, LEAGUES.map(l => l.slug)); } catch (e) { console.log("Sezono suvestinė:", e.message); }
  // Patarimai prieš turą: data/advice.md – tik kai turas prasideda per 30 val. (kitaip tuščias), data/advice-full.md – visada
  try {
    const adv = require("./advisor.js");
    const w = (f, s) => { const fp = path.join(DIR, f); let o = null; try { o = fs.readFileSync(fp, "utf8"); } catch (e) {} if (o !== s) fs.writeFileSync(fp, s); };
    w("advice.md", adv.main(["--check", "--hours=30"]));
    w("advice-full.md", adv.main([]));
  } catch (e) { console.log("Patarimai:", e.message); }
})().catch(err => { console.error(err); process.exit(1); });
