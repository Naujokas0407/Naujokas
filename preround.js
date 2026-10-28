// Paleidžiamas GitHub Actions (.github/workflows/preround.yml): node preround.js
// GitHub suplanuoti paleidimai („cron“) dažnai vėluoja valandą ir daugiau, todėl sudėtys ne visada atsinaujina prieš turą.
// Šis skriptas pats laukia tikslaus laiko ir paleidžia pagrindinį atnaujinimą (update.yml):
//  • likus 2 val. 30 min. iki pirmųjų turo rungtynių (jau naujo turo sudėtys);
//  • likus 5 min. iki kiekvienos turo dienos (D1, D2…) pirmųjų rungtynių – paskutinės sudėtys prieš startą;
//  • rungtynių metu – kas 10 min. (iki 2 val. 30 min. po paskutinių dienos rungtynių pradžios).
const { execSync } = require("child_process");
const BN = "https://fantasy.basketnews.com/backend/graphql", LEAGUE = "6a7ae0128b647e038c999860";
const Q = `query($l:String){ leagueRoundScheduleFromClient(leagueId:$l,locale:"lt"){ rounds{ matchdays{ games{ start canceled } } } } }`;
const MIN = 60e3, H = 60 * MIN;
const HORIZON = +(process.env.HORIZON_MIN || 330) * MIN; // kiek laiko šis paleidimas gali laukti
const T0 = Date.now(), DEADLINE = T0 + HORIZON;
const fmt = t => new Date(t).toLocaleString("lt-LT", { timeZone: "Europe/Vilnius" });
const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

async function schedule() {
  const r = await fetch(BN, { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (draftlive)" }, body: JSON.stringify({ query: Q, variables: { l: LEAGUE } }) });
  const j = await r.json(); if (j.errors) throw new Error(j.errors.map(e => e.message).join("; "));
  return j.data.leagueRoundScheduleFromClient.rounds.map(rd => rd.matchdays.map(md => md.games.filter(g => !g.canceled && g.start).map(g => new Date(g.start).getTime()).sort((a, b) => a - b)).filter(x => x.length));
}
function targets(rounds) {
  const out = [];
  rounds.forEach((mds, ri) => mds.forEach((ts, mi) => {
    const first = ts[0], last = ts[ts.length - 1];
    if (mi === 0) out.push({ t: first - 2.5 * H + 3 * MIN, why: `${ri + 1} turas: likus 2,5 val. iki pirmųjų rungtynių` });
    out.push({ t: first - 5 * MIN, why: `${ri + 1} turas, D${mi + 1}: paskutinės sudėtys prieš pirmąsias dienos rungtynes` });
    for (let t = first + 10 * MIN; t <= last + 2.5 * H; t += 10 * MIN) out.push({ t, why: `${ri + 1} turas, D${mi + 1}: rungtynių metu` });
  }));
  return out.sort((a, b) => a.t - b.t);
}
function dispatch(why) {
  try { execSync("gh workflow run update.yml --ref main", { stdio: "inherit" }); console.log(`${fmt(Date.now())} paleistas atnaujinimas – ${why}`); }
  catch (e) { console.log("Nepavyko paleisti atnaujinimo:", e.message); }
}
(async () => {
  let list = targets(await schedule()).filter(x => x.t > T0 - 2 * MIN && x.t <= DEADLINE);
  if (!list.length) { console.log("Per artimiausias " + Math.round(HORIZON / H) + " val. atnaujinimų prieš rungtynes nereikia."); return; }
  console.log("Suplanuota:\n" + list.map(x => "  " + fmt(x.t) + " – " + x.why).join("\n"));
  for (const x of list) {
    await sleep(x.t - Date.now());
    if (Date.now() > x.t + 15 * MIN) continue; // praleistas (pvz., ilgai laukė eilėje) – kitas jau netoli
    dispatch(x.why);
  }
})().catch(e => { console.error(e); process.exit(1); });
