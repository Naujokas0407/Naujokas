// Trenerių komentarai (išgalvoti, humoristiniai).
// Kiekvienas komentaras parenkamas vieną kartą ir įrašomas į data/coach.json.
// Tas pats tekstas niekada nepasikartoja – nei toje pačioje lygoje, nei kitose lygose, nei kituose turuose.
const fs = require("fs");
const path = require("path");

const CORES = {
  fav: [
    "Mes pasiruošę. Komanda „{opp}“ – nežinau, bet jiems to linkiu.",
    "Popieriuje mes stipresni. Tiesa, popieriuje aš ir sportuoju kasdien.",
    "Pagal vidurkius esame favoritai. Vidurkiai dar niekada nepralaimėjo – pralaimi treneriai.",
    "Su visa pagarba komandai „{opp}“. Tik pagarbos šįkart bus nedaug.",
    "Mūsų sudėtis sustatyta kruopščiai. Varžovų – tiesiog sustatyta.",
    "Komanda „{opp}“ turėtų džiaugtis, jei pralaimės mažiau nei trisdešimt. Tai ne grasinimas, tai prognozė.",
    "Spaudimo nejaučiam. Jaučiam tik lengvą gailestį komandai „{opp}“.",
    "Nenorime per daug kalbėti. Tegul kalba taškai – jų turėsim daugiau.",
    "Mūsų vienintelis priešas šį turą – mes patys. Ir galbūt BasketNews serveris.",
    "Kapitonas {cap} jau apšildytas. Varžovai, tikiuosi, irgi – bent jau emociškai.",
    "Prognozė sako +{gap}. Aš sakau – kuklu.",
    "Komandai „{opp}“ patarčiau šį turą praleisti. Bet taisyklės neleidžia.",
    "Jei pralaimėsim, kaltas bus oras. Bet nepralaimėsim."
  ],
  dog: [
    "Tikimybės prieš mus. Bet tikimybės dar nematė mūsų kapitono {cap}.",
    "Visi mus jau nurašė. Puiku – mėgstam žaisti be spaudimo ir, kaip matot, be lūkesčių.",
    "Taip, jie favoritai. Titanikas irgi buvo favoritas.",
    "Mūsų planas paprastas: tikėtis, kad jų kapitonas {oppCap} pamirš, kad šiandien rungtynės.",
    "Komanda „{opp}“ turi geresnius žaidėjus, o mes turim tikėjimą. Ir kapitoną {cap}. Daugiausia tikėjimą.",
    "Skirtumas tarp mūsų – tik ~{gap} tšk. Na, ir talentas. Ir sudėties logika.",
    "Prognozės sako, kad pralaimėsim. Prognozės taip pat sakė, kad šiandien nelis.",
    "Mes kaip tas kaimynas su senu „Golfu“ – niekas netiki, bet kartais aplenkiam.",
    "Jei laimėsim, tai bus stebuklas. Stebuklai kartais nutinka. Dažniausiai ne mums.",
    "Dovydas irgi nebuvo favoritas. Tiesa, jis turėjo svaidyklę, o mes – kapitoną {cap}.",
    "Esam autsaideriai. Tai reiškia, kad pralaimėti gėdos nėra, o laimėti – bus ką papasakoti."
  ],
  even: [
    "Lygi dvikova. Laimės tas, kurio kapitonas nesugalvos mėtyti tritaškių nuo pirmos minutės.",
    "Pagal prognozę – beveik lygiosios. Pagal mano nuojautą – mes. Nuojauta klysta tik kartais.",
    "Šansai 50 prieš 50. Kaip ir mano kapitono baudų metimai.",
    "Bus įtempta. Jau nusipirkau raminamosios arbatos. Dvi pakuotes.",
    "Jėgos lygios, todėl viską lems detalės. Pavyzdžiui, ar mano kapitonas nepamirš sportbačių.",
    "Abi komandos stiprios. Na, bent jau abi turi po penkis startinius.",
    "Šitą dvikovą lems vienas tritaškis. Tikiuosi, ne į mūsų krepšį.",
    "Kapitonų dvikova: {cap} prieš {oppCap}. Iš anksto užsisakiau picą."
  ],
  wstreak: [
    "{n} pergalės iš eilės. Pradedu įtarti, kad tikrai kažką išmanau.",
    "Serija tęsiasi. Prašau nieko nekeisti – net kojinių nekeičiu nuo serijos pradžios.",
    "Pergalių serija – kaip gera kava: kuo ilgiau, tuo sunkiau sustoti.",
    "{n} iš eilės. Komandai „{opp}“ tenka garbė bandyti mus sustabdyti."
  ],
  lstreak: [
    "{n} pralaimėjimai iš eilės? Tai ne krizė, tai ilgalaikė strategija.",
    "Mūsų pralaimėjimų serija tokia ilga, kad jau galima kurti dokumentinį serialą.",
    "Serija ilga, bet mes kantrūs. Ir, matyt, labai kantrūs.",
    "Kažkada ši serija baigsis. Statistiškai. Tikiuosi, prieš komandą „{opp}“."
  ],
  inj: [
    "{inj} traumuotas? Puiku, bent vienas mūsų žaidėjas šį turą pailsės oficialiai.",
    "Be žaidėjo {inj} bus sunku. Su juo irgi buvo sunku, tai didelio skirtumo nepajusim.",
    "Traumų sąrašas pas mus ilgesnis už pergalių sąrašą. Bet čia tik kol kas.",
    "{inj} sveiksta. Aš irgi – po praeito turo."
  ],
  revenge: [
    "Praeitą kartą komanda „{opp}“ mus apgavo. Šįkart sudėtį dėliojau du vakarus. Ir vieną naktį.",
    "Kerštas – patiekalas, kuris patiekiamas šaltas. Mes jį patieksim su FP padažu.",
    "Praeitos dvikovos rezultatą prisimenu kiekvieną rytą. Šiandien atsiskaitysim.",
    "Su komanda „{opp}“ turim neužbaigtų reikalų. Ir labai užbaigtą sudėtį."
  ],
  bigwin: [
    "Rezultatą rėminsiu ir pakabinsiu virtuvėje.",
    "Šiandien mūsų žaidėjai žaidė taip, lyg kas nors būtų jiems pažadėjęs premijas.",
    "Nenoriu būti nekuklus, bet +{diff} – tai jau ne pergalė, tai edukacija.",
    "Komandai „{opp}“ siūlyčiau šios apžvalgos neskaityti. Ir statistikos. Ir kurį laiką neiti į BasketNews.",
    "Buvo lengviau, nei tikėjomės. O tikėjomės, kad bus lengva.",
    "Varžovams atsiųsiu padėkos laišką už svetingumą.",
    "Tokios pergalės būna tik mano sapnuose. Šįkart nubudau ir vis tiek laimėjom.",
    "Pralaimėti tokiai komandai kaip mūsų – jokia gėda. Tiesiog statistika."
  ],
  closewin: [
    "Laimėjom vos {diff} tšk. skirtumu. Širdis dar nenurimo, bet taškai – mūsų.",
    "Gražu nebuvo, bet lentelėje „gražumo“ stulpelio nėra.",
    "Paskutines rungtynes žiūrėjau pro pirštus. Rekomenduoju – taip pergalės atrodo gražiau.",
    "Laimėjom ant plauko. Plaukų po šito turo liko mažiau.",
    "Sakoma, kad svarbu ne kaip laimi, o kad laimi. Labai patogus posakis šiandien.",
    "Komandai „{opp}“ – pagarba. Bet taškai vis tiek mūsų."
  ],
  win: [
    "Komanda „{opp}“ kovojo gražiai. Mes – efektyviai.",
    "Šiandien viskas sulipo: kapitonas, suolas ir net mano nuojauta.",
    "Tokias pergales mėgstu labiausiai – be nervų ir be paaiškinimų.",
    "Dar vienas žingsnis link taurės. Taurės dar neturim, bet žingsnis jau yra.",
    "{star} šiandien buvo mūsų variklis. Kiti buvo ratai – kai kurie nuleisti, bet važiavom.",
    "Užtikrinta pergalė. Komandai „{opp}“ linkiu sėkmės kitame ture – ypač jei žais ne prieš mus.",
    "Kai kapitonas {cap} atneša {capPts}, atrodo, kad viską taip ir planavau.",
    "Pergalė yra pergalė. O pergalė prieš komandą „{opp}“ – dviguba šventė.",
    "Sudėtį dėliojau su kalkuliatorium ir trupučiu intuicijos. Daugiausia intuicijos.",
    "Jei kas klaus – visa tai buvo suplanuota nuo pat drafto."
  ],
  lowwin: [
    "Taip, surinkom nedaug. Bet užteko. Tai vadinasi efektyvumas, o ne sėkmė. Beveik.",
    "Surinkom mažai, bet užteko. Varžovams siunčiu padėką už kuklumą.",
    "Laimėti su tokiais taškais – irgi menas. Abstraktus, bet menas."
  ],
  bigloss: [
    "Rezultatas skaudus, bet mokomasis. Daugiausia – skaudus.",
    "Jeigu kas klaus – mūsų šiandien ten nebuvo.",
    "Šiandien net mano kavos aparatas būtų surinkęs daugiau FP.",
    "−{diff}? Tikiuosi, niekas nežiūrėjo. Jei žiūrėjot – niekam nepasakokit.",
    "Komanda „{opp}“ buvo geresnė. Ir greitesnė. Ir protingesnė. Ir, tiesą sakant, viskuo.",
    "Pradedu abejoti, ar mano žaidėjai žino, kad sezonas jau prasidėjo.",
    "Po tokio rezultato net telefonas pasiūlė ištrinti BasketNews programėlę.",
    "Šį turą vadinsim „mokomuoju“. Mokė, žinoma, komanda „{opp}“."
  ],
  closeloss: [
    "Kai pralaimi taip nedaug, norisi kaltinti bent orą. Kaltinu orą.",
    "Pralaimėti {diff} tšk. skirtumu – tas pats, kas pamesti raktus prie pat namų durų.",
    "Pusė taško čia, pusė ten... Kitą kartą kapitoną rinksiu burtų keliu.",
    "Teisėjams pretenzijų neturim. BasketNews algoritmui – turim.",
    "Taip arti, o taip toli. Kaip savaitgalis pirmadienio ryte.",
    "Vieno tritaškio trūko. Ir, tiesą sakant, dar vieno kapitono."
  ],
  loss: [
    "Viską bandėm. Neveikė nieko, bet bandėm.",
    "Rytoj bus geriau. Blogiau tiesiog nebūna.",
    "Varžovai šiandien buvo geresni. Mes – optimistiškesni.",
    "Pralaimėjom, bet žaidėjai atidavė viską. Deja, to „viskas“ buvo nedaug.",
    "Šiandien komanda „{opp}“ buvo stipresnė. Kitą kartą būsim mes. Arba ne. Bet bandysim.",
    "Po tokio turo sudėtį keisiu rimtai. Pradėsiu nuo trenerio.",
    "Moralinė pergalė – mūsų. Deja, lentelėje jos neskaičiuoja.",
    "Kiekvienas pralaimėjimas – pamoka. Šį sezoną jau esam labai išsilavinę."
  ],
  highloss: [
    "Surinkom daugiau nei turo vidurkis ir vis tiek pralaimėjom. Varžovai matyt pasirašė sutartį su kosmosu.",
    "Surinkom tiek, kad su bet kuo kitu būtume laimėję. Loterija, ne lyga.",
    "Gerai sužaidėm. Tiesiog komanda „{opp}“ šiandien buvo iš kitos planetos."
  ],
  capflop: [
    "Kapitonas {cap}? Kitą turą jam juostą duosiu tik kelnėms prilaikyti.",
    "Kapitoną rinkausi pagal vardą. Kitą kartą rinksiuosi pagal statistiką.",
    "Mūsų kapitonas {cap} šįkart buvo kapitonas tik popieriuje. Labai ploname popieriuje."
  ],
  bench: [
    "Ant suolo palikau {lost} tšk. Suolas buvo geresnis už startą – kitam turui turim naują taktiką.",
    "Suolas surinko daugiau nei startas. Pradedu galvoti, kad sustatymas – ne mano stiprioji pusė.",
    "Didžiausi mūsų taškai šįkart sėdėjo ant suolo ir gėrė vandenį."
  ],
  gpre: [
    "Pasiruošę esam. Ar pasiruošę varžovai – ne mūsų problema.",
    "Sudėtis sudėliota, kapitonas išrinktas, kava išgerta. Belieka laukti.",
    "Nieko nežadėsim. Bet jei laimėsim – priminsim visiems.",
    "Šis turas bus lemiamas. Kaip ir kiekvienas kitas, apie kurį taip sakau.",
    "Varžovus gerbiam, bet taškų jiems dalinti neplanuojam.",
    "Savaitę ruošėmės kaip finalui. Tiesa, finalo šioje lygoje dar nėra.",
    "Mano žaidėjai motyvuoti. Bent jau taip sakė jų agentai.",
    "Turim planą A ir planą B. Planas B – tikėtis, kad planas A suveiks.",
    "Komandai „{opp}“ linkiu sėkmės. Bet ne per daug.",
    "Taktika slapta. Tokia slapta, kad jos kol kas nežinau ir aš.",
    "Visi kalba apie prognozes. Aš kalbu apie charakterį. Ir truputį apie prognozes.",
    "Šįkart jokių staigmenų. Nebent malonių."
  ],
  gpost: [
    "Turas baigėsi, emocijos liko. Taškai – irgi, kažkur.",
    "Krepšinis yra krepšinis. O fantasy – dar keistesnis.",
    "Šiandien viskas buvo aišku nuo pirmų rungtynių. Na, beveik nuo paskutinių.",
    "Rezultatą priimam oriai. Tiesa, vieną pagalvę jau sukandžiojau.",
    "Mano žaidėjai šiandien parodė charakterį. Kokį – dar aiškinamės.",
    "Po tokio turo reikia dviejų dalykų: poilsio ir naujos sudėties.",
    "Skaičiai nemeluoja. Kartais tik labai skaudžiai pasako tiesą.",
    "Šitą turą prisiminsim ilgai. Kai kurie – deja.",
    "Kiekvienas turas mus kažko išmoko. Šis – kantrybės.",
    "Sirgaliai matė viską. Atsiprašau arba prašom – priklausomai nuo to, kieno sirgalius esat.",
    "Komanda „{opp}“ – rimtas varžovas. Tai sakau ir dabar, ir sakysiu kitą kartą.",
    "Turas kaip kalneliai: aukštyn, žemyn ir galvos svaigimas."
  ],
  clead: [
    "Pirmoji vieta patogi. Tik kad visi kiti nori į ją atsisėsti.",
    "Lyderio marškinėliai kiek spaudžia, bet nusivilkti jų neplanuojam.",
    "Žiūrim ne atgal, o į priekį. Nors atgal žiūrėti šiuo metu labai malonu.",
    "Atotrūkis {gap} tšk.? Gražus skaičius. Norėtųsi didesnio.",
    "Būti pirmiems lengva. Sunku – nepasakoti apie tai kiekvieną dieną.",
    "Lentelės viršuje oras grynesnis. Rekomenduoju, bet vietų nėra.",
    "Pirmą vietą saugom kaip paskutinį picos gabalą."
  ],
  cchase: [
    "Lyderis „{leader}“ jau jaučia mūsų kvėpavimą. Ir kavos kvapą.",
    "Iki pirmos vietos – {gap} tšk. Tai vienas geras kapitonas.",
    "Antroji vieta – pirmasis iš pralaimėjusių. Todėl šį turą puolam.",
    "Komanda „{leader}“ gali ramiai miegoti. Šiąnakt dar gali.",
    "Vejamės. Lėtai, bet užtikrintai. Daugiausia lėtai.",
    "Pirmoji vieta jau matosi. Per žiūronus, bet matosi."
  ],
  cmid: [
    "Lentelės vidurys – kaip pietų pertrauka: patogu, bet nieko ypatingo.",
    "{rank} vieta? Tai tik trumpa stotelė pakeliui į viršų.",
    "Iki lyderio {gap} tšk. Skamba daug, bet sezonas ilgas, o mano optimizmas – dar ilgesnis.",
    "Esam ten, kur niekas nežiūri. Puiku – ramiai ruošiam staigmeną.",
    "Viduryje saugu. Bet saugumas – ne mūsų stilius.",
    "Nei šis, nei tas. Šį turą planuojam būti „šis“."
  ],
  cbottom: [
    "Paskutinės vietos? Visi kažkur pradeda. Mes pradedam iš labai toli.",
    "Iš apačios tik vienas kelias – aukštyn. Arba šonu, bet šonu neįdomu.",
    "Lentelę skaitau iš apačios – taip greičiau randu savo komandą.",
    "Atsiliekam {gap} tšk. Tai ne atsilikimas, tai – iššūkis.",
    "Mus visi nuvertina. Tiesą sakant, ir aš kartais.",
    "Lentelės apačioje ramu. Per ramu. Laikas triukšmauti."
  ],
  cprojtop: [
    "Pagal prognozes šį turą surinksim daugiausia. Prognozėms – ačiū, konkurentams – užuojauta.",
    "Sudėtis šį turą tokia, kad net man pačiam baisu.",
    "Kapitonas {cap} jau žino, kad šis turas – jo.",
    "Šį turą turim viską: tvarkaraštį, sveikus žaidėjus ir labai gerą nuotaiką."
  ],
  cprojlow: [
    "Prognozės mums nežada daug. Gerai, kad prognozių niekas neskaičiuoja lentelėje.",
    "Šį turą tikslas paprastas – nesurinkti mažiausiai. Užduotis sudėtinga.",
    "Sudėtis šiek tiek kukli. Kaip ir mano lūkesčiai.",
    "Tvarkaraštis prieš mus, statistika prieš mus. Bet mes – už save."
  ],
  cgood: [
    "Geras turas. Ne puikus, bet geras. Puikus bus kitas.",
    "Surinkom {pts}. Galėjo būti daugiau, bet galėjo būti ir kaip kaimynų.",
    "{star} šiandien tempė visą komandą. Kiti bent jau netrukdė.",
    "Viršutinėje turo pusėje – ten, kur ir turim būti.",
    "Kapitonas {cap} davė {capPts}. Galim ramiai miegoti.",
    "Solidus turas. Nuobodu? Galbūt. Bet taškai nenuobodūs."
  ],
  cbad: [
    "Surinkom {pts}. Ne gėda, bet ir ne kuo girtis.",
    "Šis turas – kaip atšalusi kava: gerti galima, bet malonumo mažai.",
    "Buvo ir blogesnių turų. Ne daug, bet buvo.",
    "Kitą turą grįšim stipresni. Blogesni būti tiesiog sunku.",
    "Pusė lygos surinko daugiau. Apie tai kalbėti nenoriu.",
    "Turas praėjo. Ir gerai, kad praėjo."
  ],
  cup: [
    "Pakilom {places} vietomis. Lentelės viršau, ruoškis svečiams.",
    "Kylam kaip mielinė tešla. Tikiuosi, nesukrisim.",
    "Šuolis lentelėje – ne atsitiktinumas. Na, beveik ne.",
    "Plus {places} vietos. Taip ir toliau – ir sezono gale būsim mėnulyje."
  ],
  cdown: [
    "Nukritom {places} vietomis. Laikinai, kaip ir viskas šiame gyvenime.",
    "Lentelėje judam. Deja, ne ta kryptimi.",
    "Nuslydom žemyn. Kitą turą užsiauksim rimtesnius batus.",
    "Minus {places} vietos. Lentelė šiandien buvo ne mūsų draugė."
  ],
  cnewlead: [
    "Nauji lyderiai! Kas galėjo pagalvoti? Na, aš galėjau.",
    "Pirmoji vieta mūsų. Prašom nebeliesti.",
    "Sveiki atvykę į viršūnę. Mes čia pasiliksim ilgėliau."
  ],
  cwin: [
    "Turo nugalėtojai! Dabar reikia tik išmokti tai daryti kas savaitę.",
    "Daugiausia taškų šį turą. Kuklumą pasiliekam kitam kartui.",
    "Turo nugalėtojai? Nieko keisto. Keista, kad tik dabar.",
    "Surinkom daugiausia lygoje. Savo sudėtį jau siunčiu į muziejų.",
    "Daugiausia taškų lygoje? Tiesiog šiandien žvaigždės buvo mūsų pusėje. Ir visi mūsų žaidėjai.",
    "Kai viskas pavyksta, atrodo lengva. Nepasakosiu, kad buvo lengva. Buvo labai lengva."
  ],
  clast: [
    "Mažiausiai taškų lygoje. Bet kažkas gi turi būti paskutinis – šįkart pasiaukojom mes.",
    "Šio turo nėra ką analizuoti. Yra ką pamiršti.",
    "Paskutinė vieta šį turą. Bet žiūrint iš kito galo – esam pirmi.",
    "Šitą turą paprasčiausiai pamiršim. Ir, jei galima, jūs irgi.",
    "Paskutinė vieta – geriausia vieta pradėti kilti.",
    "Visiems nutinka blogų turų. Mums tiesiog nutiko visas."
  ]
};
const MORE = {
  gpre: [
    "Planas paprastas: daugiau taškų nei kiti. Detalės – komercinė paslaptis.",
    "Sudėtį dėliojau iki vėlumos. Žmona sako, kad su žaidėjais kalbu daugiau nei su ja.",
    "Šį turą žaidžiam protingai. Jei nepavyks protingai – žaisim laimingai.",
    "Mūsų strategija – nieko nesakyti varžovams. Todėl ir jums nieko nesakysiu.",
    "Treniruotėje viskas ėjosi. Gaila, kad taškai skaičiuojami ne už treniruotes.",
    "Jei kas klaus – esam favoritai. Jei neklaus – irgi esam.",
    "Sudėtis paruošta, nervai – dar ne visai.",
    "Į šį turą žiūrim kaip į naują galimybę. Senąsias jau išnaudojom.",
    "Kiekvienas turas – finalas. Tiesa, kai kurie finalai nuobodesni.",
    "Mano žaidėjai šią savaitę gerai miegojo. Tikiuosi, aikštėje nemiegos.",
    "Prognozių nedarau. Darau tik garsius pareiškimus.",
    "Šiam turui pasiruošėm geriau nei bet kada. Na, geriau nei praeitam.",
    "Varžovai mus pažįsta. Bet mes save pažįstam dar mažiau – tai ir yra mūsų ginklas.",
    "Telefoną išjungiu, lentelę atsidarau. Prasideda.",
    "Nėra lengvų turų. Yra tik turai, po kurių lengviau miegoti.",
    "Sakoma, kad sėkmė mėgsta drąsius. Šį turą būsim labai drąsūs."
  ],
  gpost: [
    "Taškai surinkti, nervai išeikvoti. Normalus turas.",
    "Lentelė neklysta. Kartais tik labai skaudžiai teisi.",
    "Šį turą išmokom daug. Ypač apie tai, ko nedaryti.",
    "Rezultatą priimam oriai. Viduje rėkiam, bet oriai.",
    "Kai kurie žaidėjai šiandien nustebino. Ne visi – maloniai.",
    "Turas baigtas, išvados padarytos, sudėtis galvoje perdėliota jau trečią kartą.",
    "Statistika sako viena, širdis – kita. Lentelė klauso statistikos.",
    "Galėjo būti geriau, galėjo būti blogiau. Buvo taip, kaip buvo.",
    "Fantasy – kaip oras Lietuvoje: niekada nežinai, ką gausi.",
    "Komanda kovojo. Kai kurie kovojo net prieš save.",
    "Šio turo įrašo per daug kartų neperžiūrėsim.",
    "Nusiteikimas geras. Taškai – kaip kada.",
    "Sirgaliai matė viską. Atsiprašau, kad matė viską.",
    "Esu patenkintas. Na, pusiau. Gerai, ketvirčiu.",
    "Šiandien krepšinio dievai buvo užsiėmę kitur.",
    "Kitą kartą bus kitaip. Dar nežinau kaip, bet kitaip."
  ],
  clead: [
    "Lyderiaujam {gap} tšk. Kol kas niekam nesakykit, kad tai lengva.",
    "Pirmoje vietoje nusipirkom kėdę su porankiais. Nusileisti neplanuojam.",
    "Visi vejasi mus. Jaučiamės kaip paskutinis autobusas penktadienio vakarą.",
    "Būti lyderiu – atsakomybė. Ir labai malonus jausmas tikrinant lentelę dešimt kartų per dieną.",
    "Lentelės viršūnėje vėjuota, bet vaizdas puikus.",
    "Pirmi esam {gap} tšk. persvara. Užtenka? Niekada neužtenka."
  ],
  cchase: [
    "Esam {rank}. Prizininkų pakopa jau užimta? Ne ilgam.",
    "Iki „{leader}“ – {gap} tšk. Taip arti, kad jau girdim jų nerimą.",
    "Vejamės lyderį taip atkakliai, kad kartais net patys savęs bijom.",
    "Lyderiai žiūri į priekį. Mes žiūrim į lyderius. Labai atidžiai.",
    "{gap} tšk. iki viršūnės – tai ne atstumas, tai motyvacija.",
    "Antroje gretoje patogu. Bet pirmoje – geresnis vaizdas."
  ],
  cmid: [
    "{rank} vieta – nei džiaugtis, nei liūdėti. Tai ir darom – nieko.",
    "Vidurys – puiki vieta iššokti. Arba užmigti. Renkamės iššokti.",
    "Iki lyderio {gap} tšk. Kalnas didelis, bet turim gerus batus.",
    "Lentelės vidury jaučiamės kaip sumuštinio sūris – svarbūs, bet nematomi.",
    "Mūsų laikas ateis. Tikiuosi, dar šį sezoną.",
    "Esam pilka pelytė. Pelytės, beje, labai greitai bėga.",
    "{rank} vieta. Sakykim, tai – taktinis pasislėpimas."
  ],
  cbottom: [
    "Apačioje mus mažai kas mato. Tuo ir pasinaudosim.",
    "Iki lyderio {gap} tšk. Gerai, kad sezonas ilgas. Labai ilgas.",
    "Mūsų vieta lentelėje – tai tik skaičius. Labai didelis skaičius.",
    "Apatinėje lentelės dalyje susikūrėm jaukų kampelį. Laikas kraustytis.",
    "Pradėti iš apačios – lyg filmo apie sportą pradžia. Laukit pabaigos.",
    "Visi mus nurašė. Mes irgi buvom beveik nurašę save. Beveik."
  ],
  cprojtop: [
    "Popieriuje šį turą esam stipriausi. Belieka, kad popierius nesuplyštų.",
    "Kapitonu išrinkom {cap}. Jei nepavyks – kaltas bus jis, ne aš.",
    "Pagal vidurkius mūsų sudėtis – geriausia lygoje. Vidurkiai, nenuvilkit.",
    "Šį turą planuojam tiesiog būti geriausi. Planai pas mus visada dideli.",
    "Tvarkaraštis palankus, žaidėjai sveiki, kava stipri. Daugiau nieko nereikia."
  ],
  cprojlow: [
    "Prognozės sako „mažai“. Mes sakom „pažiūrėsim“.",
    "Šį turą mūsų sudėtis kukli kaip studento stipendija.",
    "Kapitonas {cap} turės tempti už visus. Tikiuosi, jis pavalgęs.",
    "Statistikai mūsų nemėgsta. Bet mes ir nesam statistikos komanda.",
    "Lūkesčiai žemi – vadinasi, nustebinti bus lengva."
  ],
  cgood: [
    "Surinkom {pts}, lentelėje – {rank} vieta. Galim šypsotis.",
    "{star} – {starPts} FP. Tokiems žaidėjams reikia statyti paminklus. Mažus, bet paminklus.",
    "Geras turas. Dabar svarbiausia nesugadinti nuotaikos tikrinant kitų rezultatus.",
    "Viskas pagal planą. Retas jausmas, todėl mėgaujamės.",
    "{pts} tšk. – nei per mažai, nei per daug. Tiesiog gerai.",
    "Šis turas – kaip geras kebabas: sotus ir be staigmenų.",
    "Komanda dirbo kaip laikrodis. Tiesa, kai kurie sraigteliai šiek tiek vėlavo."
  ],
  cbad: [
    "{pts} tšk. Ne tai, ko norėjom, bet tai, ką turim.",
    "{flop} šiandien surinko {flopPts}. Pakalbėsim. Ilgai pakalbėsim.",
    "Lentelėje {rank} vieta. Kitam turui žadu tik viena – bus įdomiau.",
    "Turas buvo sunkus. Žiūrėti – dar sunkiau.",
    "Šiandien taškų rinkimas priminė grybavimą lapkritį.",
    "Nieko baisaus, tik šiek tiek gėdinga.",
    "Daug bandėm, mažai surinkom. Bandymus prašom įskaityti."
  ],
  cup: [
    "Pakilom į {rank} vietą. Lentelė pagaliau mus pastebėjo.",
    "Kylam {places} pakopomis aukštyn. Liftas pas mus veikia.",
    "{star} su {starPts} FP pakėlė mus lentelėje. Jam – pyragas.",
    "Dar {places} vietos aukštyn. Tęsiam kopimą, deguonies dar užtenka.",
    "Šuolis į {rank} vietą. Sakiau, kad mes dar pasirodysim."
  ],
  cdown: [
    "Nukritom į {rank} vietą. Nieko, nuo dugno atsispirti lengviausia.",
    "Praradom {places} vietas. Lentelė mums šiandien parodė nugarą.",
    "Slystam žemyn. Reikia barstyti smėlį.",
    "{rank} vieta. Ne ta, kurioje norėtume praleisti savaitgalį.",
    "Žemyn vis tiek lengviau nei aukštyn. Bet mums labiau patinka aukštyn."
  ],
  cnewlead: [
    "Pirmoji vieta! Prašom nesiųsti gėlių – siųskit taškus.",
    "Užlipom į viršūnę. Vėliavą jau įsmeigėm.",
    "Lyderiai – mes. Kartokit kartu: lyderiai – mes.",
    "Nauja savaitė, naujas lyderis. Ir jis – mūsų."
  ],
  cwin: [
    "{pts} tšk. ir pirmoji turo vieta. Šiandien vakarienė – ant manęs.",
    "{star} surinko {starPts}. Ačiū, kad žaidi pas mus, o ne pas kitus.",
    "Geriausias turo rezultatas. Lentelės viršau, ruošk kėdę.",
    "Turo čempionai! Medalių neduoda, bet pasigirti leidžiama.",
    "Šiandien mūsų sudėtis žaidė taip, lyg būtų perskaičiusi mano mintis.",
    "Daugiausia taškų? Kuklumas – ne šio vakaro tema."
  ],
  clast: [
    "{pts} tšk. – mažiausiai lygoje. Kai kurie dienoraščio puslapiai turi likti tušti.",
    "{flop} su {flopPts} FP – šio turo „herojus“. Kabutės ne atsitiktinės.",
    "Paskutinė vieta šį turą. Bent jau nereikės ilgai ieškoti savęs lentelėje.",
    "Šį turą buvom dosnūs – leidom aplenkti visiems.",
    "Mažiausiai taškų. Kitą turą grįšim su planu. Arba bent su sudėtimi.",
    "Kai nesiseka – nesiseka iš visų pusių. Šį turą nesisekė iš kokių penkių."
  ],
  capflop: [
    "Kapitonas {cap} šiandien atostogavo. Kartu su mūsų taškais.",
    "{cap} kapitono raištį nešė, o taškų – ne.",
    "Kapitono pasirinkimas buvo drąsus. Rezultatas – ne.",
    "Kitą kartą kapitoną rinksiu burtų keliu. Blogiau nebus.",
    "{cap} su raiščiu – {capPts}. Raištį, matyt, reikia išskalbti."
  ],
  bench: [
    "Ant suolo liko {lost} tšk. Suole, prašau, nebeprovokuok.",
    "Atsarginiai žaidė puikiai. Gaila, kad atsarginiai.",
    "Sudėtį reikėjo apversti aukštyn kojom. Įsidėmėsiu kitam kartui.",
    "Mano suolas šiandien stipresnis už kai kurių varžovų startą.",
    "Pamesti {lost} tšk. ant suolo – tam reikia talento."
  ],
  fav: [
    "Prognozėse esam favoritai prieš „{opp}“. Prognozės niekada neklysta. Na, beveik.",
    "Šįkart esam stipresni popieriuje. Žaisim ne ant popieriaus, bet vis tiek malonu.",
    "„{opp}“ – rimta komanda. Mes – rimtesnė.",
    "Esam favoritai, todėl visas spaudimas – mums. Spaudimą mėgstam."
  ],
  dog: [
    "Prieš „{opp}“ esam autsaideriai. Autsaideriams tenka gražiausios istorijos.",
    "Visi stato prieš mus. Labai gerai – laimėsim daugiau.",
    "Prognozėse atsiliekam {gap} tšk. Prognozėms reikia naujų akinių.",
    "„{opp}“ stipresni? Gal. Bet krepšinis žaidžiamas ne Excel'yje."
  ],
  even: [
    "Su „{opp}“ jėgos lygios. Lems kapitonai ir nervai.",
    "Lygi dvikova. Laimės tas, kurio žaidėjai rečiau mėtys baudas pro šalį.",
    "Popieriuje – lygiosios. Aikštėje lygiųjų neplanuojam.",
    "Bus įtempta. Jau dabar perku papildomą kavą."
  ],
  wstreak: [
    "{n} pergalės iš eilės. Mes neskaičiuojam, bet visi kiti skaičiuoja.",
    "Serija tęsiasi. Prašom niekam jos nenužiūrėti.",
    "Laimim iš eilės jau {n} kartus. Pradedu ir pats tuo tikėti."
  ],
  lstreak: [
    "{n} pralaimėjimai iš eilės. Būna ir gražesnių serijų.",
    "Pralaimėjimų serija kada nors baigiasi. Kodėl ne šiandien?",
    "Po {n} nesėkmių pagaliau turim, ką įrodyti."
  ],
  inj: [
    "{inj} šį turą nežais. Rasim, kas užkiš skylę. Tikiuosi.",
    "Be {inj} bus sunkiau. Bet sunkumai mus grūdina.",
    "{inj} gydosi, todėl likusieji turės dirbti už du."
  ],
  revenge: [
    "Praeitą kartą „{opp}“ mus įveikė. Atmintis pas mus gera.",
    "Su „{opp}“ turim neužbaigtų reikalų. Šįkart užbaigsim.",
    "Revanšas. Nieko asmeniško. Na, truputį asmeniško."
  ],
  bigwin: [
    "Pergalė {diff} tšk. skirtumu. „{opp}“, nieko asmeniško.",
    "{star} – {starPts} FP. Kai turi tokį žaidėją, gali ramiai gerti kavą.",
    "Tai buvo ne dvikova, o demonstracija."
  ],
  closewin: [
    "Laimėjom {diff} tšk. Širdis dar nesugrįžo į vietą.",
    "Pergalė per plauką. Plaukus, beje, jau baigiu prarasti.",
    "Įtampa iki paskutinių sekundžių. Todėl pergalė dar saldesnė."
  ],
  win: [
    "Įveikėm „{opp}“. Ramiai, dalykiškai, be fejerverkų.",
    "{star} surinko {starPts} ir parvežė pergalę.",
    "Dar viena pergalė į kraitį. Kraitis pildosi."
  ],
  lowwin: [
    "Surinkom nedaug, bet daugiau nei „{opp}“. O tik to ir reikia.",
    "Graži pergalė? Ne. Pergalė? Taip.",
    "Laimėjom ne grožiu, o rezultatu."
  ],
  bigloss: [
    "Pralaimėjom {diff} tšk. Daugiau nieko pridurti nenoriu.",
    "„{opp}“ šiandien buvo per stiprūs, o mes – per silpni. Jiems puiki kombinacija.",
    "Tokius turus geriau pamiršti dar jiems nepasibaigus."
  ],
  closeloss: [
    "Pralaimėjom {diff} tšk. Vienas metimas – ir būtų kita kalba.",
    "Taip arti ir taip toli. Tipinė fantasy diena.",
    "Per plauką. Kitą kartą tas plaukas bus mūsų."
  ],
  loss: [
    "„{opp}“ buvo geresni. Pripažįstam ir judam toliau.",
    "Pralaimėjimas. Dabar svarbiausia – nepanikuoti. Panikuosim vėliau.",
    "Šįkart nepavyko. Kitą kartą pavyks. Statistiškai turėtų."
  ],
  highloss: [
    "Surinkom daug, bet „{opp}“ – dar daugiau. Neteisinga, bet taip jau yra.",
    "Su tokiu rezultatu kitoje poroje būtume laimėję. Bet mes ne kitoje poroje.",
    "Daug taškų, nulis pergalių. Fantasy humoras."
  ]
};
for (const k of Object.keys(MORE)) for (const x of MORE[k]) if (!CORES[k].includes(x)) CORES[k].push(x);
CORES.ccapflop = CORES.capflop; CORES.cbench = CORES.bench;
const PRE_CATS = ["fav", "dog", "even", "wstreak", "lstreak", "inj", "revenge", "gpre", "clead", "cchase", "cmid", "cbottom", "cprojtop", "cprojlow"];
const FALLBACK = { ccapflop: ["cbad"], cbench: ["cbad"], cnewlead: ["cwin", "cup"], cup: ["cgood"], cdown: ["cbad"], cwin: ["cgood"], clast: ["cbad"], clead: ["cprojtop"], cchase: ["cmid"], cbottom: ["cmid"], cprojtop: ["cmid"], cprojlow: ["cmid"], bigwin: ["win"], closewin: ["win"], lowwin: ["win"], bigloss: ["loss"], closeloss: ["loss"], highloss: ["loss"], capflop: ["loss"], bench: ["loss"] };
const PREFIX = {
  pre: ["Atvirai?", "Trumpai ir aiškiai.", "Žurnalistams kartoju tą patį.", "Ką čia daug kalbėti.", "Sakysiu tiesiai.", "Na ką, pradedam.",
    "Visi klausia to paties, tai atsakysiu.", "Prieš turą visada sakau tą patį.", "Kalbėsiu kaip treneris, ne kaip sirgalius.", "Be didelių žodžių.",
    "Treniruotė buvo gera.", "Nuotaika komandoje puiki.", "Kava išgerta, sudėtis patvirtinta.", "Mano požiūris paprastas.", "Neslėpsiu.",
    "Pasakysiu vieną dalyką.", "Šįkart be diplomatijos.", "Kaip visada – realistiškai.", "Esu ramus.", "Rimtai kalbant."],
  post: ["Ką galiu pasakyti.", "Na ką.", "Trumpai.", "Atvirai?", "Po tokio turo žodžių nedaug.", "Emocijos dar neatslūgo.", "Kalbėsiu tiesiai.",
    "Pirmiausia – ačiū sirgaliams.", "Analizuosim, bet jau dabar aišku viena.", "Rezultatas kalba pats už save.", "Neslėpsiu.", "Sakysiu kaip yra.",
    "Kaip sakoma, krepšinis – toks krepšinis.", "Žiūrėjau visas rungtynes.", "Kavos prireiks daug.", "Tai buvo turas.", "Be pasiteisinimų.",
    "Pasakysiu vieną dalyką.", "Esu realistas.", "Mano išvada paprasta."]
};
const SUFFIX = {
  pre: ["Daugiau komentarų neturiu.", "Pasimatysim po turo.", "Ir čia ne juokai.", "Viskas, einu dėlioti sudėties.", "Taip ir užrašykit.",
    "Kitų klausimų nėra? Puiku.", "Tiek žinių iš stovyklos.", "Ačiū, kad klausot.", "Likusį pasakys aikštelė.", "Užteks kalbų.",
    "Čia citata, galit dėti į antraštę.", "Varžovams – sėkmės. Jos prireiks.", "Ramiai. Viskas bus gerai.", "Taip matau situaciją.", "Pažiūrėsim.",
    "Detalės – po rungtynių.", "Visa kita – spaudos konferencijoje.", "Einu ieškoti laimingų kojinių.", "Rezultatą prognozuoti nedrįstu.", "Belieka laukti."],
  post: ["Daugiau komentarų neturiu.", "Einam toliau.", "Kitas turas – nauja pradžia.", "Tiek šiandien.", "Ačiū visiems.", "Taip ir užrašykit.",
    "Pasimatysim kitame ture.", "Einu atsigerti vandens. Daug vandens.", "Detalės – rytoj.", "Galit cituoti.", "Kitų klausimų nėra? Puiku.",
    "Taškai lentelėje – tai svarbiausia.", "Mokomės ir judam pirmyn.", "Toks tas fantasy.", "Ramiai.", "Užteks kalbų.",
    "Dabar – poilsis.", "Viską aptarsim komandoje.", "Laikas persvarstyti sudėtį.", "Gero vakaro."]
};

const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const round2 = x => Math.round(x * 100) / 100;
const fmtN = x => String(round2(x));

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
    if (!best || val > best) best = val;
  }
  if (best == null) return null;
  const actual = t.players.reduce((s, p) => s + (p.fp ?? 0) * p.mult, 0);
  return { opt: best, lost: Math.max(0, best - actual) };
}
function perTeam(d, uptoRound) {
  const per = {};
  (d.results || []).filter(m => m.r < uptoRound).forEach(m => {
    const res = m.as > m.bs ? ["W", "L"] : m.bs > m.as ? ["L", "W"] : ["D", "D"];
    (per[m.a] = per[m.a] || []).push({ r: m.r, res: res[0], opp: m.b });
    (per[m.b] = per[m.b] || []).push({ r: m.r, res: res[1], opp: m.a });
  });
  Object.values(per).forEach(l => l.sort((x, y) => x.r - y.r));
  return per;
}
function curStreak(list) {
  if (!list || !list.length) return null;
  const last = list[list.length - 1].res; let n = 0;
  for (let i = list.length - 1; i >= 0 && list[i].res === last; i--) n++;
  return { res: last, n };
}

class Ledger {
  constructor(file) {
    this.file = file;
    try { this.db = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { this.db = { q: {} }; }
    this.changed = false;
    // v2: tas pats pagrindinis sakinys toje pačioje lygoje nebekartojamas – vėlesni pasikartojimai išmetami ir sugeneruojami iš naujo
    if (this.db.v !== 2) {
      const ph = k => k.split("|")[2] === "pre" ? 0 : 1;
      const keys = Object.keys(this.db.q).sort((a, b) => (+a.split("|")[1] - +b.split("|")[1]) || (ph(a) - ph(b)) || (a < b ? -1 : 1));
      const seen = {};
      for (const k of keys) {
        const slug = k.split("|")[0], title = k.split("|").slice(3).join("|"), c = this.db.q[k].c;
        if (CORES[title]) { delete this.db.q[k]; continue; }
        const s = seen[slug] = seen[slug] || new Set();
        if (s.has(c)) delete this.db.q[k]; else s.add(c);
      }
      this.db.v = 2; this.changed = true;
    }
    this.used = new Set(Object.values(this.db.q).map(x => x.t));
    this.coreCount = {}; this.coreRound = {}; this.coreLeague = {};
    for (const [k, x] of Object.entries(this.db.q)) {
      this.coreCount[x.c] = (this.coreCount[x.c] || 0) + 1;
      const rk = k.split("|")[1] + "|" + k.split("|")[2];
      (this.coreRound[rk] = this.coreRound[rk] || new Set()).add(x.c);
      const lg = this.coreLeague[k.split("|")[0]] = this.coreLeague[k.split("|")[0]] || {};
      lg[x.c] = (lg[x.c] || 0) + 1;
    }
  }
  has(key) { return !!this.db.q[key]; }
  assign(key, cat, vars) {
    if (this.db.q[key]) return;
    const phase = PRE_CATS.includes(cat) ? "pre" : "post";
    const [, round, ph] = key.split("|");
    const rk = round + "|" + ph;
    const roundSet = this.coreRound[rk] || new Set();
    const lg = this.coreLeague[key.split("|")[0]] = this.coreLeague[key.split("|")[0]] || {};
    const ok = c => (c.match(/\{(\w+)\}/g) || []).every(m => vars[m.slice(1, -1)] != null && vars[m.slice(1, -1)] !== "");
    const chain = [cat, ...(FALLBACK[cat] || []), phase === "pre" ? "gpre" : "gpost"];
    const rank = {}; chain.forEach((c, i) => CORES[c].forEach(x => { if (rank[x] == null) rank[x] = i; }));
    let cores = Object.keys(rank).filter(ok);
    // pirmiausia – šioje lygoje dar niekada nepanaudotas sakinys, tada – šiame ture kitose lygose nenaudotas, tada – savo kategorijos
    cores.sort((a, b) => ((lg[a] || 0) - (lg[b] || 0)) || (roundSet.has(a) - roundSet.has(b)) || (rank[a] - rank[b]) || ((this.coreCount[a] || 0) - (this.coreCount[b] || 0)) || (hash(key + a) - hash(key + b)));
    const P = ["", ...PREFIX[phase]], S = ["", ...SUFFIX[phase]];
    const combos = [];
    P.forEach((p, i) => S.forEach((s, j) => combos.push({ p, s, lvl: (i ? 1 : 0) + (j ? 1 : 0) })));
    for (const core of cores) {
      const body = core.replace(/\{(\w+)\}/g, (m, k) => "**" + vars[k] + "**");
      const list = combos.map(x => ({ ...x, h: hash(key + core + x.p + x.s) })).sort((a, b) => a.lvl - b.lvl || a.h - b.h);
      for (const x of list) {
        const text = [x.p, body, x.s].filter(Boolean).join(" ");
        if (this.used.has(text)) continue;
        this.db.q[key] = { t: text, c: core };
        this.used.add(text); this.coreCount[core] = (this.coreCount[core] || 0) + 1; lg[core] = (lg[core] || 0) + 1;
        (this.coreRound[rk] = this.coreRound[rk] || new Set()).add(core);
        this.changed = true; return;
      }
    }
  }
  save() { if (this.changed) fs.writeFileSync(this.file, JSON.stringify(this.db)); }
}

function preCat(d, T, O, per) {
  const proj = t => t.players.filter(p => p.mult > 0).reduce((s, p) => s + (p.avg != null ? p.avg * p.mult : 0), 0);
  const cap = T.players.find(p => p.cap), ocap = O.players.find(p => p.cap);
  const hurt = T.players.filter(p => p.mult > 0 && p.health === "out")[0] || T.players.filter(p => p.mult > 0 && ["doubtful", "uncertain"].includes(p.health))[0];
  const c = curStreak(per[T.title]);
  const prev = (d.results || []).filter(g => (g.a === T.title && g.b === O.title) || (g.a === O.title && g.b === T.title)).sort((x, y) => y.r - x.r)[0];
  const lostPrev = prev && ((prev.a === T.title && prev.as < prev.bs) || (prev.b === T.title && prev.bs < prev.as));
  const gap = proj(O) - proj(T);
  let cat;
  if (c && c.n >= 2 && c.res === "W") cat = "wstreak";
  else if (c && c.n >= 2 && c.res === "L") cat = "lstreak";
  else if (lostPrev) cat = "revenge";
  else if (hurt && hash(T.title + d.round) % 2) cat = "inj";
  else if (Math.abs(gap) < 8) cat = "even";
  else cat = gap < 0 ? "fav" : "dog";
  return { cat, vars: { opp: O.title.trim(), cap: cap && cap.name, oppCap: ocap && ocap.name, gap: fmtN(Math.abs(Math.round(gap))), n: c && c.n, inj: hurt && hurt.name } };
}
function postCat(d, T, O, sT, sO) {
  const dd = Math.abs(sT - sO);
  const cap = T.players.find(p => p.cap);
  const star = T.players.filter(p => p.mult > 0 && p.fp != null).sort((x, y) => y.fp * y.mult - x.fp * x.mult)[0];
  const avg = d.teams.reduce((a, t) => a + (t.official ?? t.total), 0) / d.teams.length;
  const o = optimal(T);
  const vars = { opp: O.title.trim(), diff: fmtN(dd), cap: cap && cap.name, capPts: cap && cap.fp != null ? fmtN(cap.fp * 2) : null, star: star && star.name, starPts: star ? fmtN(star.fp * star.mult) : null, lost: o ? fmtN(o.lost) : null };
  let cat;
  if (sT > sO) cat = dd >= 40 ? "bigwin" : dd < 6 ? "closewin" : sT < avg ? "lowwin" : "win";
  else if (sT === sO) cat = "closewin";
  else if (cap && cap.fp != null && cap.fp * 2 < 16) cat = "capflop";
  else if (o && o.lost > dd) cat = "bench";
  else cat = dd >= 40 ? "bigloss" : dd < 6 ? "closeloss" : sT > avg ? "highloss" : "loss";
  return { cat, vars };
}

function processLeagueRound(L, d, slug, isCur) {
  if (!d || !d.teams || !d.games) return;
  // prieš turą – kol turas neprasidėjo; einamajam turui trūkstamas (pvz., išmestas kaip pasikartojantis) sugeneruojamas ir vėliau
  const preMissing = isCur && d.teams.some(t => !L.has(`${slug}|${d.round}|pre|${t.title}`));
  const started = d.games.some(g => g.status !== "scheduled") && !preMissing;
  const done = d.games.length > 0 && d.games.every(g => g.status === "final");
  const r = d.round;
  if (d.format === "h2h" && d.matchups) {
    const per = perTeam(d, r);
    for (const m of d.matchups) {
      const A = d.teams.find(t => t.title === m.a), B = d.teams.find(t => t.title === m.b);
      if (!A || !B) continue;
      if (!started) {
        for (const [T, O] of [[A, B], [B, A]]) { const x = preCat(d, T, O, per); L.assign(`${slug}|${r}|pre|${T.title}`, x.cat, x.vars); }
      }
      if (done) {
        const off = m.as > 0 || m.bs > 0;
        const sa = off ? m.as : (A.official ?? A.total), sb = off ? m.bs : (B.official ?? B.total);
        for (const [T, O, sT, sO] of [[A, B, sa, sb], [B, A, sb, sa]]) { const x = postCat(d, T, O, sT, sO); L.assign(`${slug}|${r}|post|${T.title}`, x.cat, x.vars); }
      }
    }
  } else if (d.format === "classic") {
    const hist = d.history || {};
    const val = (t, rr) => rr === r ? t.total : ((hist[rr] || {})[t.title] ?? 0);
    const rounds = Object.keys(hist).map(Number).filter(x => x < r);
    const cum = (t, upto) => [...rounds, r].filter(x => x <= upto).reduce((s, x) => s + val(t, x), 0);
    const rankBy = upto => { const o = [...d.teams].sort((a, b) => cum(b, upto) - cum(a, upto)); return { o, rk: t => o.indexOf(t) + 1, c: t => cum(t, upto) }; };
    const n = d.teams.length;
    if (!started) {
      const R0 = rankBy(r - 1), hasHist = rounds.length > 0;
      const proj = t => t.players.filter(p => p.mult > 0).reduce((s, p) => s + (p.avg != null ? p.avg * p.mult : 0), 0);
      const po = [...d.teams].sort((a, b) => proj(b) - proj(a)), hasProj = d.teams.some(t => t.players.some(p => p.avg != null));
      for (const T of d.teams) {
        const rk = R0.rk(T), lead = R0.o[0], cap = T.players.find(p => p.cap);
        const hurt = T.players.filter(p => p.mult > 0 && p.health === "out")[0];
        const gap = rk === 1 ? R0.c(lead) - (R0.o[1] ? R0.c(R0.o[1]) : 0) : R0.c(lead) - R0.c(T);
        let cat;
        if (hurt && hash(T.title + r) % 3 === 0) cat = "inj";
        else if (hasHist && rk === 1) cat = "clead";
        else if (hasProj && po[0] === T) cat = "cprojtop";
        else if (hasProj && po[n - 1] === T) cat = "cprojlow";
        else if (hasHist && rk <= 3 && gap <= 40) cat = "cchase";
        else if (hasHist && rk >= n - 1) cat = "cbottom";
        else cat = "cmid";
        L.assign(`${slug}|${r}|pre|${T.title}`, cat, { rank: hasHist ? String(rk) : null, gap: hasHist ? fmtN(Math.round(gap)) : null, leader: lead && lead !== T ? lead.title.trim() : null, cap: cap && cap.name, inj: hurt && hurt.name });
      }
    }
    if (done) {
      const Rn = rankBy(r), Rp = rankBy(r - 1), hasPrev = rounds.length > 0;
      const br = [...d.teams].sort((a, b) => b.total - a.total);
      for (const T of d.teams) {
        const cap = T.players.find(p => p.cap), star = T.players.filter(p => p.mult > 0 && p.fp != null).sort((x, y) => y.fp * y.mult - x.fp * x.mult)[0];
        const o = optimal(T), moved = hasPrev ? Rp.rk(T) - Rn.rk(T) : 0, pos = br.indexOf(T);
        let cat;
        if (pos === 0) cat = "cwin";
        else if (pos === n - 1) cat = "clast";
        else if (hasPrev && Rn.rk(T) === 1 && Rp.rk(T) !== 1) cat = "cnewlead";
        else if (cap && cap.fp != null && cap.fp * 2 < 16) cat = "ccapflop";
        else if (moved >= 2) cat = "cup";
        else if (moved <= -2) cat = "cdown";
        else if (o && o.lost > 25) cat = "cbench";
        else cat = pos < n / 2 ? "cgood" : "cbad";
        const flop = T.players.filter(p => p.mult > 0 && p.fp != null && !String(p.card).startsWith("b")).sort((x, y) => x.fp - y.fp)[0];
        L.assign(`${slug}|${r}|post|${T.title}`, cat, { pts: fmtN(T.total), places: String(Math.abs(moved)), rank: String(Rn.rk(T)), cap: cap && cap.name, capPts: cap && cap.fp != null ? fmtN(cap.fp * 2) : null, star: star && star.name, starPts: star ? fmtN(star.fp * star.mult) : null, flop: flop && flop !== star && flop.fp < 8 ? flop.name : null, flopPts: flop ? fmtN(flop.fp) : null, lost: o ? fmtN(o.lost) : null });
      }
    }
  }
}

exports.run = function (DIR, slugs) {
  const L = new Ledger(path.join(DIR, "coach.json"));
  for (const slug of slugs) {
    let cur = null;
    try { cur = JSON.parse(fs.readFileSync(path.join(DIR, slug + ".json"), "utf8")); } catch (e) { continue; }
    // praėję turai (iš archyvo) – tik komentarai po turo
    for (let r = 1; r < cur.round; r++) {
      try { processLeagueRound(L, JSON.parse(fs.readFileSync(path.join(DIR, slug + "-r" + r + ".json"), "utf8")), slug); } catch (e) {}
    }
    processLeagueRound(L, cur, slug, true);
  }
  L.save();
  if (L.changed) console.log("Trenerių komentarai atnaujinti");
};
