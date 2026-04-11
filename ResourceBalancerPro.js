// ╔══════════════════════════════════════════════════════════════════════════╗
// ║          ResourceBalancer PRO — Tribal Wars                             ║
// ║  Merged & improved from:                                                ║
// ║   • Costache Madalin  (K-means clustering, AM integration, map view)    ║
// ║   • Sophie "Shinko to Kuma" (village priorities, sitter, multi-lang)    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ─── Guard: prevent double-run ───────────────────────────────────────────────
if (window._rbProRunning) { document.getElementById("rbpro_container")?.remove(); }
window._rbProRunning = true;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. LANGUAGE
// ═══════════════════════════════════════════════════════════════════════════════
const LANG_MAP = {
    en_DK: { title:"Resource Balancer PRO", source:"Source", target:"Target",
              distance:"Distance", wood:"Wood", stone:"Clay", iron:"Iron",
              send:"Send", totalW:"Total wood", totalS:"Total clay", totalI:"Total iron",
              avgW:"Avg wood", avgS:"Avg clay", avgI:"Avg iron",
              surplus:"Surplus", deficit:"Deficit", clusters:"Clusters",
              results:"Results", settings:"Settings", start:"Start",
              merchants:"Reserve merchants", constrTime:"Construction time [h]",
              avgFactor:"Average factor [0–1]", nrClusters:"Nr of clusters",
              merchantCap:"Merchant capacity", maxConstr:"Auto-max construction",
              lowPoints:"Prioritise villages below (points)",
              highPoints:"Built-out above (points)",
              highFarm:"Built-out above (pop)",
              builtPct:"WH% for built-out villages",
              needsPct:"WH% for priority villages",
              minting:"Minting mode", sitter:"Account-sitter active",
              saveBtn:"Save", resetBtn:"Reset themes",
              done:"Done!", progress:"Processing…",
              saved:"Saved — re-run script", by:"ResourceBalancer PRO" },
    de_DE: { title:"Ressourcen-Ausgleich PRO", source:"Herkunft", target:"Ziel",
              distance:"Distanz", wood:"Holz", stone:"Lehm", iron:"Eisen",
              send:"Schicken", totalW:"Gesamt Holz", totalS:"Gesamt Lehm", totalI:"Gesamt Eisen",
              avgW:"Ø Holz", avgS:"Ø Lehm", avgI:"Ø Eisen",
              surplus:"Überschuss", deficit:"Defizit", clusters:"Cluster",
              results:"Ergebnisse", settings:"Einstellungen", start:"Start",
              merchants:"Reserve-Händler", constrTime:"Bauzeit [h]",
              avgFactor:"Durchschnittsfaktor [0–1]", nrClusters:"Anzahl Cluster",
              merchantCap:"Händlerkapazität", maxConstr:"Auto-Max-Bau",
              lowPoints:"Kleine Dörfer priorisieren (Punkte)",
              highPoints:"Fertig ausgebaut ab (Punkte)",
              highFarm:"Fertig ausgebaut ab (Bev.)",
              builtPct:"WH% für ausgebaute Dörfer",
              needsPct:"WH% für Prioritätsdörfer",
              minting:"Münz-Modus", sitter:"Account-Sitter aktiv",
              saveBtn:"Speichern", resetBtn:"Themes zurücksetzen",
              done:"Fertig!", progress:"Berechnung…",
              saved:"Gespeichert — Skript neu starten", by:"ResourceBalancer PRO" },
    ro_RO: { title:"Echilibrare Resurse PRO", source:"Origine", target:"Destinatie",
              distance:"Distanta", wood:"Lemn", stone:"Argila", iron:"Fier",
              send:"Trimite", totalW:"Total lemn", totalS:"Total argila", totalI:"Total fier",
              avgW:"Medie lemn", avgS:"Medie argila", avgI:"Medie fier",
              surplus:"Surplus", deficit:"Deficit", clusters:"Clustere",
              results:"Rezultate", settings:"Setari", start:"Start",
              merchants:"Comercianti rezerva", constrTime:"Timp constructie [h]",
              avgFactor:"Factor mediu [0–1]", nrClusters:"Nr clustere",
              merchantCap:"Capacitate comerciant", maxConstr:"Constructie maxima auto",
              lowPoints:"Prioritizeaza sate mici (puncte)",
              highPoints:"Sate finalizate (puncte)",
              highFarm:"Sate finalizate (pop)",
              builtPct:"% depozit sate finalizate",
              needsPct:"% depozit sate prioritare",
              minting:"Mod batere monede", sitter:"Sitter activ",
              saveBtn:"Salvare", resetBtn:"Reset teme",
              done:"Gata!", progress:"Procesare…",
              saved:"Salvat — reporneste scriptul", by:"ResourceBalancer PRO" },
};
const L = LANG_MAP[game_data.locale] || LANG_MAP.en_DK;

// ═══════════════════════════════════════════════════════════════════════════════
// 2. THEME
// ═══════════════════════════════════════════════════════════════════════════════
const THEMES = {
    dark:  { bg:"#2B193D", header:"#2C365E", table:"#484D6D", inner:"#4B8F8C", border:"#C5979D", text:"#E0E0E0", input:"#000000" },
    light: { bg:"#F4E4BC", header:"#c6a768", table:"#fff5da", inner:"#e8d5a0", border:"#803000", text:"#3a1a00", input:"#ffffff" },
    gray:  { bg:"#32353b",  header:"#202225", table:"#36393f", inner:"#5b5f66", border:"#40D0E0", text:"#ffffff",  input:"#111111" },
};
let T = THEMES[localStorage.getItem("rbpro_theme") || "dark"];

function applyTheme(name) {
    T = THEMES[name] || THEMES.dark;
    localStorage.setItem("rbpro_theme", name);
}

const CSS = () => `
<style id="rbpro_css">
.rbpro-container { position:fixed; width:52%; min-width:400px; background:${T.bg};
    border:2px solid ${T.border}; border-radius:6px; color:${T.text};
    font-family:Arial,sans-serif; font-size:13px; z-index:99999; top:60px; left:24%; }
.rbpro-header { background:${T.header}; padding:8px 12px; border-radius:4px 4px 0 0;
    display:flex; align-items:center; justify-content:space-between; cursor:move; }
.rbpro-header h2 { margin:0; font-size:15px; color:${T.text}; }
.rbpro-body { padding:10px; max-height:620px; overflow-y:auto; }
.rbpro-footer { background:${T.header}; padding:4px 12px; border-radius:0 0 4px 4px;
    font-size:11px; color:${T.text}; opacity:.7; }
.rbpro-table { width:100%; border-collapse:collapse; margin:6px 0; }
.rbpro-table td, .rbpro-table th { padding:4px 6px; border:1px solid ${T.border}; }
.rbpro-table tr:nth-child(even) { background:${T.table}; }
.rbpro-table tr:nth-child(odd)  { background:${T.inner}; }
.rbpro-table th { background:${T.header}; color:${T.text}; }
.rbpro-input { background:${T.input}; color:${T.text}; border:1px solid ${T.border};
    padding:3px 6px; width:90px; border-radius:3px; }
.rbpro-btn { background:${T.header}; color:${T.text}; border:1px solid ${T.border};
    padding:5px 14px; border-radius:4px; cursor:pointer; margin:3px; }
.rbpro-btn:hover { background:${T.table}; }
.rbpro-btn-send { background:#1a4a1a; color:#aaffaa; border:1px solid #2d6e2d;
    padding:3px 10px; border-radius:3px; cursor:pointer; }
.rbpro-btn-send:hover { background:#2d6e2d; }
.rbpro-progress-bar { width:100%; height:12px; background:${T.input}; border-radius:6px; margin:6px 0; }
.rbpro-progress { height:12px; background:#4CAF50; border-radius:6px; transition:width .2s; }
.rbpro-label { display:inline-block; width:200px; }
.rbpro-section { margin:8px 0; padding:6px; background:${T.table}; border-radius:4px; }
.rbpro-tag-good { color:#4eff4e; font-weight:bold; }
.rbpro-tag-bad  { color:#ff6060; font-weight:bold; }
a.rbpro-link { color:${T.border}; }
</style>`;

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SETTINGS  (merged: all options from both scripts)
// ═══════════════════════════════════════════════════════════════════════════════
const SETTINGS_KEY = "rbpro_settings_" + game_data.world;
const DEFAULT_SETTINGS = {
    reserveMerchants:  0,
    constructionHours: 0,
    averageFactor:     1.0,
    nrClusters:        1,
    merchantCapacity:  1000,
    maxConstruction:   false,
    // Sophie-style priorities
    lowPoints:         3000,
    highPoints:        9000,
    highFarm:          24000,
    builtOutPct:       0.25,
    needsMorePct:      0.85,
    mintingMode:       false,
};

function loadSettings() {
    try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
    catch { return {...DEFAULT_SETTINGS}; }
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

let CFG = loadSettings();

// ═══════════════════════════════════════════════════════════════════════════════
// 4. HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const fmt = n => new Intl.NumberFormat().format(Math.round(n));

function dist(c1, c2) {
    const [x1,y1] = c1.split("|").map(Number);
    const [x2,y2] = c2.split("|").map(Number);
    return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
}

function httpGet(url) {
    const x = new XMLHttpRequest();
    x.open("GET", url, false);
    x.send(null);
    return x.responseText;
}

function ajaxGet(url, delayMs = 220) {
    return new Promise((res, rej) => {
        const t0 = Date.now();
        $.ajax({ url, method:"get",
            success: data => setTimeout(() => res(data), Math.max(0, delayMs - (Date.now()-t0))),
            error:   err  => rej(err)
        });
    });
}

function getPages(htmlDoc, baseUrl) {
    const sel = $(htmlDoc).find(".paged-nav-item").parent().find("select");
    if (sel.length) {
        const opts = Array.from(sel.find("option")).map(o => o.value);
        opts.pop();
        return opts.reverse();
    }
    const items = htmlDoc.getElementsByClassName("paged-nav-item");
    if (items.length) {
        return Array.from(items).map((_, i) => baseUrl.split("page=")[0] + "page=" + i).reverse();
    }
    return [baseUrl];
}

// sitter-aware URLs
const isSitter = game_data.player.sitter > 0;
const sitPrefix = isSitter ? `t=${game_data.player.id}&` : "";
const urlBase = game_data.link_base_pure;

function buildUrl(screen, extra = "") {
    return `${urlBase}${screen}&${sitPrefix}${extra}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. DATA FETCHING
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchProduction() {
    const baseUrl = buildUrl("overview_villages&mode=prod", "page=-1");
    const firstPage = httpGet(baseUrl);
    const doc0 = new DOMParser().parseFromString(firstPage, "text/html");
    const pages = getPages(doc0, baseUrl);

    const villages = [];
    const farmUsage = new Map();
    const isDesktop = game_data.device === "desktop";

    for (const url of pages) {
        const data = await ajaxGet(url);
        const doc = new DOMParser().parseFromString(data, "text/html");

        if (isDesktop) {
            Array.from($(doc).find(".row_a, .row_b")).forEach(row => {
                try {
                    const qe     = row.querySelector(".quickedit-vn");
                    const coord  = qe.innerText.match(/\d{3}\|\d{3}/)[0];
                    const id     = qe.getAttribute("data-id");
                    const name   = qe.innerText.trim();
                    const wood   = parseInt(row.querySelector(".wood").innerText.replace(/\./g,""));
                    const stone  = parseInt(row.querySelector(".stone").innerText.replace(/\./g,""));
                    const iron   = parseInt(row.querySelector(".iron").innerText.replace(/\./g,""));
                    const mText  = row.querySelector("a[href*='market']").innerText;
                    const merch  = parseInt(mText.split("/")[0]);
                    const mTotal = parseInt(mText.split("/")[1]);
                    const cap    = parseInt(row.children[4].innerText.replace(/\./g,""));
                    const points = parseInt(row.children[2].innerText.replace(/\./g,""));
                    const farmCur= parseInt(row.children[6].innerText.split("/")[0]);
                    const farmMax= parseInt(row.children[6].innerText.split("/")[1]);

                    villages.push({ coord, id, name, wood, stone, iron,
                                    merchants:merch, merchantsTotal:mTotal,
                                    capacity:cap, points, farmUsed:farmCur, farmTotal:farmMax });
                    farmUsage.set(coord, farmCur / farmMax);
                } catch(e) {}
            });
        } else {
            Array.from($(doc).find(".overview-container-item")).forEach(row => {
                try {
                    const name   = $(row).find(".quickedit-label").text().trim();
                    const coord  = name.match(/\d+\|\d+/)[0];
                    const id     = $(row).find(".quickedit-vn").attr("data-id");
                    const wood   = parseInt(row.querySelector(".mwood").innerText.replace(/\./g,""));
                    const stone  = parseInt(row.querySelector(".mstone").innerText.replace(/\./g,""));
                    const iron   = parseInt(row.querySelector(".miron").innerText.replace(/\./g,""));
                    const merch  = parseInt($(row).find(".vertical_center").text().trim());
                    const cap    = parseInt(row.querySelector(".ressources").parentElement.innerText.replace(/\./g,""));
                    const points = parseInt($(row).find(".grey").parent().text().replace(/\./g,""));
                    const farmTxt= row.querySelector(".population").parentElement.innerText;
                    const farmCur= parseInt(farmTxt.split("/")[0]);
                    const farmMax= parseInt(farmTxt.split("/")[1]);

                    villages.push({ coord, id, name, wood, stone, iron,
                                    merchants:merch, merchantsTotal:500,
                                    capacity:cap, points, farmUsed:farmCur, farmTotal:farmMax });
                    farmUsage.set(coord, farmCur / farmMax);
                } catch(e) {}
            });
        }
    }
    return { villages, farmUsage };
}

async function fetchIncoming() {
    const baseUrl = buildUrl("overview_villages&mode=trader&type=inc", "page=-1&type=inc");
    const firstPage = httpGet(baseUrl);
    const doc0 = new DOMParser().parseFromString(firstPage, "text/html");
    const pages = getPages(doc0, baseUrl);

    const incoming = new Map(); // coord → {wood,stone,iron}

    for (const url of pages) {
        const data = await ajaxGet(url);
        const doc  = new DOMParser().parseFromString(data, "text/html");
        Array.from($(doc).find(".row_a, .row_b")).forEach(row => {
            try {
                const coord = (game_data.device === "desktop")
                    ? row.children[4].innerText.match(/\d{3}\|\d{3}/)[0]
                    : row.children[3].innerText.match(/\d{3}\|\d{3}/g)[1];

                const w = parseInt($(row).find(".wood").parent().text().replace(/\./g,"")) || 0;
                const s = parseInt($(row).find(".stone").parent().text().replace(/\./g,"")) || 0;
                const fe= parseInt($(row).find(".iron").parent().text().replace(/\./g,"")) || 0;

                if (incoming.has(coord)) {
                    const e = incoming.get(coord);
                    e.wood+=w; e.stone+=s; e.iron+=fe;
                } else {
                    incoming.set(coord, {wood:w, stone:s, iron:fe});
                }
            } catch(e) {}
        });
    }
    return incoming;
}

// ─── Account Manager integration (from Costache) ─────────────────────────────

async function fetchAMData(farmUsage) {
    if (!game_data.features?.AccountManager?.active) return new Array(100).fill(new Map());

    const { templates, coordMap, farmCapMap } = await fetchAMTemplates();
    const buildings = await fetchBuildings();
    const constants = getbuildingConstants();

    const result = [];
    for (let hours = 1; hours <= 100; hours++) {
        const amMap = new Map();
        const bld   = new Map(JSON.parse(JSON.stringify(Array.from(buildings.entries()))));

        // Carry forward queued time
        for (const [k,v] of bld) {
            if (k.endsWith("_time_queued"))
                amMap.set(k.replace("_time_queued",""), { wood:0, stone:0, iron:0, timeH: Math.round(v/3600) });
        }

        for (const [coord, tplName] of coordMap) {
            const tpl      = templates.get(tplName);
            const farmCap  = (farmCapMap.get(tplName) || 99) / 100;
            if (!tpl) continue;

            let elapsed = bld.get(coord+"_time_queued") || 0;

            // Auto-upgrade farm if needed
            const farmLv = bld.get(coord+"_farm") || 0;
            if (farmLv < 30 && (farmUsage.get(coord) || 0) >= farmCap) {
                const hq  = bld.get(coord+"_main") || 1;
                const res = calcBuildingCost(hq, farmLv+1, constants.get("farm"));
                elapsed  += res[0];
                const existing = amMap.get(coord) || {wood:0,stone:0,iron:0,timeH:0};
                existing.wood  += res[1]; existing.stone += res[2]; existing.iron += res[3];
                existing.timeH  = elapsed/3600;
                amMap.set(coord, existing);
            }

            for (const item of tpl) {
                const key   = coord+"_"+item.name;
                let   curLv = bld.get(key) || 0;
                if (item.level_absolute <= curLv) continue;

                for (let j = curLv; j < item.level_absolute; j++) {
                    const hq  = bld.get(coord+"_main") || 1;
                    const res = calcBuildingCost(hq, j+1, constants.get(item.name));
                    if (!res) continue;
                    elapsed  += res[0];

                    const existing = amMap.get(coord) || {wood:0,stone:0,iron:0,timeH:0};
                    existing.wood  += res[1]; existing.stone += res[2]; existing.iron += res[3];
                    existing.timeH  = elapsed/3600;
                    amMap.set(coord, existing);
                    bld.set(key, j+1);

                    if (elapsed > hours * 3600) break;
                }
                if (elapsed > hours * 3600) break;
            }
        }
        result.push(amMap);
    }
    return result;
}

async function fetchAMTemplates() {
    const baseUrl = buildUrl("am_village");
    const first   = httpGet(baseUrl);
    const doc0    = new DOMParser().parseFromString(first, "text/html");
    const pages   = getPages(doc0, baseUrl);

    const coordMap  = new Map();
    const templates = new Map();
    const farmCapMap= new Map();

    for (const url of pages) {
        const data = await ajaxGet(url);
        const doc  = new DOMParser().parseFromString(data, "text/html");
        Array.from($(doc).find(".row_a, .row_b")).forEach(row => {
            try {
                const coord = row.children[0].innerText.match(/\d{3}\|\d{3}/)[0];
                const tpl   = row.children[1].innerText.trim();
                if (tpl) { coordMap.set(coord, tpl); templates.set(tpl, null); farmCapMap.set(tpl, 0); }
            } catch(e) {}
        });
    }

    // Load each template's buildings
    const opts = Array.from($(doc0).find("select[name=template] option"));
    for (const opt of opts) {
        const rawName = opt.innerText.replace(/[\n\t]/g,"").replace(/\(\w+\)/,"").trim();
        if (!templates.has(rawName)) continue;

        const url  = buildUrl("am_village&mode=queue", `template=${opt.value}`);
        const data = await ajaxGet(url);
        const doc  = new DOMParser().parseFromString(data, "text/html");

        const rows = Array.from($(doc).find(".sortable_row"));
        templates.set(rawName, rows.map(r => ({
            name:           r.getAttribute("data-building"),
            level_absolute: parseInt($(r).find(".level_absolute").text().match(/\d+/)[0])
        })));

        let farmCap = 99;
        if ($(doc).find("input[name=farm_upgrade_toggle]").is(":checked"))
            farmCap = 100 - parseInt($(doc).find("select[name=population_upgrades]").val());
        farmCapMap.set(rawName, farmCap);
    }

    return { templates, coordMap, farmCapMap };
}

async function fetchBuildings() {
    const baseUrl = buildUrl("overview_villages&mode=buildings");
    const first   = httpGet(baseUrl);
    const doc0    = new DOMParser().parseFromString(first, "text/html");
    const pages   = getPages(doc0, baseUrl);
    const bld     = new Map();

    for (const url of pages) {
        const data = await ajaxGet(url);
        const doc  = new DOMParser().parseFromString(data, "text/html");

        if (game_data.device === "desktop") {
            Array.from($(doc).find(".row_a, .row_b")).forEach(row => {
                try {
                    const coord = $(row).find(".nowrap").text().match(/\d{3}\|\d{3}/)[0];
                    const lastQ = $(row).find(".queue_icon img").last().attr("title");
                    bld.set(coord+"_time_queued", lastQ ? getFinishedSeconds(lastQ) : 0);

                    $(row).find(".upgrade_building").each((_, el) => {
                        const name  = el.classList[1].replace("b_","");
                        const level = parseInt(el.innerText);
                        bld.set(coord+"_"+name, level);
                    });
                    // add queued
                    Array.from($(row).find(".queue_icon img"))
                        .map(e => e.src.match(/\w+\.(webp|png)/)[0].replace(/\.(webp|png)/,""))
                        .forEach(n => bld.set(coord+"_"+n, (bld.get(coord+"_"+n)||0)+1));
                } catch(e) {}
            });
        }
    }
    return bld;
}

function getbuildingConstants() {
    const key = game_data.world + "_rbpro_bldConst";
    if (localStorage.getItem(key)) return new Map(JSON.parse(localStorage.getItem(key)));

    const data = httpGet("/interface.php?func=get_building_info");
    const doc  = new DOMParser().parseFromString(data, "text/html");
    const map  = new Map();
    Array.from(doc.querySelector("config").children).forEach(el => {
        const n = el.tagName.toLowerCase();
        map.set(n, {
            wood: +el.querySelector("wood")?.textContent,
            stone:+el.querySelector("stone")?.textContent,
            iron: +el.querySelector("iron")?.textContent,
            wood_factor: +el.querySelector("wood_factor")?.textContent,
            stone_factor:+el.querySelector("stone_factor")?.textContent,
            iron_factor: +el.querySelector("iron_factor")?.textContent,
            build_time:  +el.querySelector("build_time")?.textContent,
            build_time_factor:+el.querySelector("build_time_factor")?.textContent,
        });
    });
    localStorage.setItem(key, JSON.stringify(Array.from(map.entries())));
    return map;
}

function getFinishedSeconds(title) {
    try {
        const srv = document.getElementById("serverDate").innerText.split("/");
        const srvDate = srv[1]+"/"+srv[0]+"/"+srv[2];
        const srvTime = document.getElementById("serverTime").innerText;
        const now = new Date(srvDate+" "+srvTime);

        let dateStr = "";
        const todayKey   = lang["aea2b0aa9ae1534226518faaefffdaad"]?.replace(" %s","") || "Today";
        const tomorrowKey= lang["57d28d1b211fddbb7a499ead5bf23079"]?.replace(" %s","") || "Tomorrow";

        if (title.includes(todayKey)) {
            dateStr = srvDate+" "+title.match(/\d+:\d+/)[0];
        } else if (title.includes(tomorrowKey)) {
            const t = new Date(srvDate); t.setDate(t.getDate()+1);
            dateStr = `${("0"+(t.getMonth()+1)).slice(-2)}/${("0"+t.getDate()).slice(-2)}/${t.getFullYear()} ${title.match(/\d+:\d+/)[0]}`;
        } else {
            const m = title.match(/(\d+)\.(\d+)/);
            if (m) dateStr = m[2]+"/"+m[1]+"/"+srv[2]+" "+title.match(/\d+:\d+/)[0];
        }
        const fin = new Date(dateStr);
        return Math.max(0, Math.round((fin-now)/1000));
    } catch { return 0; }
}

const HQ_CONSTANTS = {1:1,2:1,3:0.112292,4:0.289555,5:0.46113,6:0.606372,7:0.723059,
    8:0.815935,9:0.889947,10:0.948408,11:0.994718,12:1.031,13:1.059231,14:1.080939,
    15:1.09729,16:1.109156,17:1.117308,18:1.122392,19:1.124817,20:1.124917,
    21:1.123181,22:1.119778,23:1.114984,24:1.109038,25:1.102077,26:1.0942,
    27:1.085601,28:1.076369,29:1.066566,30:1.056291};

function calcBuildingCost(hq, level, c) {
    if (!c || level > 30) return null;
    const t = Math.round(c.build_time * Math.pow(1.2, level-1) * Math.pow(1.05, -hq) * (HQ_CONSTANTS[level]||1));
    return [t,
        Math.round(c.wood  * Math.pow(c.wood_factor,  level-1)),
        Math.round(c.stone * Math.pow(c.stone_factor, level-1)),
        Math.round(c.iron  * Math.pow(c.iron_factor,  level-1))];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. K-MEANS CLUSTERING  (from Costache, with deterministic restarts)
// ═══════════════════════════════════════════════════════════════════════════════
function kmeans(points, k, maxIter = 100, restarts = 40) {
    let best = null, bestScore = Infinity;
    for (let r = 0; r < restarts; r++) {
        const centers = points.slice().sort(()=>Math.random()-.5).slice(0,k).map(p=>[...p]);
        const clusters = Array.from({length:k},()=>({center:[...centers[0]],points:[]}));
        let changed = true, iter = 0;

        while (changed && iter++ < maxIter) {
            clusters.forEach(c => c.points = []);
            changed = false;
            for (const p of points) {
                let bi = 0, bd = Infinity;
                for (let i = 0; i < k; i++) {
                    const d = Math.hypot(p[0]-clusters[i].center[0], p[1]-clusters[i].center[1]);
                    if (d < bd) { bd=d; bi=i; }
                }
                clusters[bi].points.push(p);
            }
            clusters.forEach((c,i) => {
                if (!c.points.length) { c.center = points[Math.floor(Math.random()*points.length)].slice(); return; }
                const nx = c.points.reduce((a,p)=>a+p[0],0)/c.points.length;
                const ny = c.points.reduce((a,p)=>a+p[1],0)/c.points.length;
                if (Math.abs(nx-c.center[0])>0.01 || Math.abs(ny-c.center[1])>0.01) changed=true;
                c.center = [nx,ny];
            });
        }
        // max intra-cluster distance as score
        let score = 0;
        for (const c of clusters)
            for (let i=0;i<c.points.length;i++)
                for (let j=i+1;j<c.points.length;j++)
                    score = Math.max(score, Math.hypot(c.points[i][0]-c.points[j][0], c.points[i][1]-c.points[j][1]));

        if (score < bestScore) { bestScore=score; best=clusters; }
    }
    return best;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PRIORITY EVALUATION  (from Sophie — applied before balancing)
// ═══════════════════════════════════════════════════════════════════════════════
function getVillagePriority(v) {
    // Returns: 'small' | 'builtin' | 'normal'
    if (v.farmUsed > CFG.highFarm || v.points > CFG.highPoints) return "builtin";
    if (v.points < CFG.lowPoints)                                return "small";
    return "normal";
}

// Effective target amounts for each village based on priority
function getTargetAmounts(v, avgW, avgS, avgI) {
    const pri = getVillagePriority(v);
    const cap = v.capacity;
    if (pri === "small") {
        // Fill small villages to needsMorePct
        return {
            w: cap * CFG.needsMorePct,
            s: cap * CFG.needsMorePct,
            i: cap * CFG.needsMorePct
        };
    }
    if (pri === "builtin") {
        // Leave only builtOutPct in built-out villages
        return {
            w: cap * CFG.builtOutPct,
            s: cap * CFG.builtOutPct,
            i: cap * CFG.builtOutPct
        };
    }
    // Normal: use average factor, capped at needsMorePct
    return {
        w: Math.min(avgW * CFG.averageFactor, cap * CFG.needsMorePct),
        s: Math.min(avgS * CFG.averageFactor, cap * CFG.needsMorePct),
        i: Math.min(avgI * CFG.averageFactor, cap * CFG.needsMorePct),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. LAUNCH CALCULATION  (merged algorithm)
// ═══════════════════════════════════════════════════════════════════════════════
function calculateLaunches(villagesByCluster, incoming, amMaps, amHours) {
    const allLaunches = [];
    const clusterStats = [];

    for (let ci = 0; ci < villagesByCluster.length; ci++) {
        const cluster = villagesByCluster[ci];
        const amMap   = amHours > 0 ? (amMaps[amHours-1] || new Map()) : new Map();

        // Effective resources (current + incoming)
        const eff = cluster.map(v => {
            const inc = incoming.get(v.coord) || {wood:0,stone:0,iron:0};
            return {
                ...v,
                effW: Math.min(v.wood  + inc.wood,  v.capacity),
                effS: Math.min(v.stone + inc.stone, v.capacity),
                effI: Math.min(v.iron  + inc.iron,  v.capacity),
                amW: amMap.get(v.coord)?.wood  || 0,
                amS: amMap.get(v.coord)?.stone || 0,
                amI: amMap.get(v.coord)?.iron  || 0,
                amTimeH: amMap.get(v.coord)?.timeH || 0,
            };
        });

        // Cluster-wide averages for normal villages
        const n = eff.length;
        const avgW = eff.reduce((a,v)=>a+v.effW,0)/n;
        const avgS = eff.reduce((a,v)=>a+v.effS,0)/n;
        const avgI = eff.reduce((a,v)=>a+v.effI,0)/n;

        // Compute per-village send/receive
        const senders   = [];
        const receivers = [];

        for (const v of eff) {
            const tgt = getTargetAmounts(v, avgW, avgS, avgI);
            const merchants = Math.max(0, v.merchants - CFG.reserveMerchants);
            const cap_travel = merchants * CFG.merchantCapacity;
            const cap_wh     = v.capacity * 0.95;

            // What can this village SEND (surplus above target + AM needs)
            const targetW = Math.round(tgt.w) + Math.round(v.amW);
            const targetS = Math.round(tgt.s) + Math.round(v.amS);
            const targetI = Math.round(tgt.i) + Math.round(v.amI);

            const surpW = Math.max(0, v.effW - targetW);
            const surpS = Math.max(0, v.effS - targetS);
            const surpI = Math.max(0, v.effI - targetI);
            const totalSurp = surpW + surpS + surpI;

            if (totalSurp > 0) {
                // Scale down if not enough merchants
                const scale = cap_travel < totalSurp ? cap_travel/totalSurp : 1;
                senders.push({
                    ...v,
                    sendW: Math.floor(surpW*scale),
                    sendS: Math.floor(surpS*scale),
                    sendI: Math.floor(surpI*scale),
                });
            }

            // What does this village NEED (deficit below target)
            const needW = Math.max(0, targetW - v.effW);
            const needS = Math.max(0, targetS - v.effS);
            const needI = Math.max(0, targetI - v.effI);

            // Clamp to warehouse free space
            const freeW = Math.max(0, cap_wh - v.effW);
            const freeS = Math.max(0, cap_wh - v.effS);
            const freeI = Math.max(0, cap_wh - v.effI);

            if (needW+needS+needI > 0) {
                receivers.push({
                    ...v,
                    needW: Math.min(needW, freeW),
                    needS: Math.min(needS, freeS),
                    needI: Math.min(needI, freeI),
                    timeH: v.amTimeH,
                });
            }
        }

        // Normalize receivers if total need > total supply
        const supW = senders.reduce((a,s)=>a+s.sendW,0);
        const supS = senders.reduce((a,s)=>a+s.sendS,0);
        const supI = senders.reduce((a,s)=>a+s.sendI,0);
        const demW = receivers.reduce((a,r)=>a+r.needW,0);
        const demS = receivers.reduce((a,r)=>a+r.needS,0);
        const demI = receivers.reduce((a,r)=>a+r.needI,0);

        const nW = demW > supW && supW > 0 ? supW/demW : 1;
        const nS = demS > supS && supS > 0 ? supS/demS : 1;
        const nI = demI > supI && supI > 0 ? supI/demI : 1;
        receivers.forEach(r => { r.needW=Math.floor(r.needW*nW); r.needS=Math.floor(r.needS*nS); r.needI=Math.floor(r.needI*nI); });

        // Match senders to receivers by distance (nearest first)
        for (const rec of receivers) {
            senders.sort((a,b) => dist(a.coord,rec.coord) - dist(b.coord,rec.coord));

            let remW = rec.needW, remS = rec.needS, remI = rec.needI;

            for (const sen of senders) {
                if (remW+remS+remI <= 0) break;
                if (sen.sendW+sen.sendS+sen.sendI <= 0) continue;
                if (sen.coord === rec.coord) continue;

                const giveW = Math.min(remW, sen.sendW);
                const giveS = Math.min(remS, sen.sendS);
                const giveI = Math.min(remI, sen.sendI);
                const total = giveW+giveS+giveI;
                if (total <= 0) continue;

                // Avoid weird partial-merchant sends (min 700 or 1200 for PT)
                const minSend = CFG.merchantCapacity === 1500 ? 1200 : 700;
                const rem     = total % CFG.merchantCapacity;
                let adjW=giveW,adjS=giveS,adjI=giveI;
                if (rem > 0 && rem < minSend) {
                    // Shave off the remainder from the largest component
                    const maxRes = Math.max(adjW,adjS,adjI);
                    if (adjW===maxRes)      adjW -= rem;
                    else if (adjS===maxRes) adjS -= rem;
                    else                   adjI -= rem;
                }
                if (adjW+adjS+adjI < minSend) continue;

                allLaunches.push({
                    coord_origin:      sen.coord, id_origin:      sen.id, name_origin:      sen.name,
                    coord_destination: rec.coord, id_destination: rec.id, name_destination: rec.name,
                    wood:adjW, stone:adjS, iron:adjI,
                    total: adjW+adjS+adjI,
                    distance: dist(sen.coord, rec.coord)
                });

                sen.sendW -= giveW; sen.sendS -= giveS; sen.sendI -= giveI;
                remW -= giveW;      remS -= giveS;      remI -= giveI;
            }
        }

        // Cluster stats
        const maxDist = allLaunches.filter(l => cluster.some(v=>v.coord===l.coord_origin))
            .reduce((a,l)=>Math.max(a,l.distance),0);
        clusterStats.push({
            n, center: cluster.reduce((a,v)=>{
                const [x,y]=v.coord.split("|").map(Number);
                return {x:a.x+x/n,y:a.y+y/n}
            },{x:0,y:0}),
            avgW, avgS, avgI,
            supW, supS, supI, demW, demS, demI, maxDist
        });
    }

    return { launches: allLaunches, clusterStats };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. UI
// ═══════════════════════════════════════════════════════════════════════════════
function buildUI() {
    const isSpecialCap = ["pt_PT","de_DE"].includes(game_data.locale);
    const html = `
${CSS()}
<div id="rbpro_container" class="rbpro-container">
  <div class="rbpro-header" id="rbpro_drag">
    <h2>⚖ ${L.title}</h2>
    <span>
      <button class="rbpro-btn" onclick="document.getElementById('rbpro_themepanel').style.display=(document.getElementById('rbpro_themepanel').style.display=='none'?'':'none')">🎨</button>
      <button class="rbpro-btn" onclick="document.getElementById('rbpro_body').style.display=(document.getElementById('rbpro_body').style.display=='none'?'':'none')">_</button>
      <button class="rbpro-btn" onclick="document.getElementById('rbpro_container').remove();window._rbProRunning=false;">✕</button>
    </span>
  </div>

  <div id="rbpro_themepanel" style="display:none;padding:8px;background:${T.table}">
    <b>${L.settings} — Theme</b><br>
    <button class="rbpro-btn" onclick="window._rbApplyTheme('dark')">Dark</button>
    <button class="rbpro-btn" onclick="window._rbApplyTheme('light')">TW Classic</button>
    <button class="rbpro-btn" onclick="window._rbApplyTheme('gray')">Gray</button>
  </div>

  <div id="rbpro_body" class="rbpro-body">
    <div class="rbpro-section">
      <table class="rbpro-table">
        <tr><th colspan="2">${L.settings}</th></tr>
        <tr><td>${L.merchants}</td><td><input id="cfg_res"  class="rbpro-input" type="number" value="${CFG.reserveMerchants}"  min="0"></td></tr>
        <tr><td>${L.constrTime}</td><td><input id="cfg_ht"  class="rbpro-input" type="number" value="${CFG.constructionHours}" min="0" max="100"></td></tr>
        <tr><td>${L.avgFactor}</td><td><input id="cfg_af"   class="rbpro-input" type="number" value="${CFG.averageFactor}"      min="0" max="1" step="0.05"></td></tr>
        <tr><td>${L.nrClusters}</td><td><input id="cfg_nc"  class="rbpro-input" type="number" value="${CFG.nrClusters}"         min="1"></td></tr>
        ${isSpecialCap ? `<tr><td>${L.merchantCap}</td><td><input id="cfg_mc" class="rbpro-input" type="number" value="${CFG.merchantCapacity}" min="1000" max="1500"></td></tr>` : ""}
        <tr><td>${L.maxConstr}</td><td><input id="cfg_mc2" type="checkbox" ${CFG.maxConstruction?"checked":""}></td></tr>
        <tr><th colspan="2">Village Priorities (Sophie)</th></tr>
        <tr><td>${L.lowPoints}</td><td><input id="cfg_lp"  class="rbpro-input" type="number" value="${CFG.lowPoints}"></td></tr>
        <tr><td>${L.highPoints}</td><td><input id="cfg_hp"  class="rbpro-input" type="number" value="${CFG.highPoints}"></td></tr>
        <tr><td>${L.highFarm}</td><td><input id="cfg_hf"   class="rbpro-input" type="number" value="${CFG.highFarm}"></td></tr>
        <tr><td>${L.builtPct}</td><td><input id="cfg_bp"   class="rbpro-input" type="number" value="${CFG.builtOutPct}" min="0" max="1" step="0.05"></td></tr>
        <tr><td>${L.needsPct}</td><td><input id="cfg_np"   class="rbpro-input" type="number" value="${CFG.needsMorePct}" min="0" max="1" step="0.05"></td></tr>
        <tr><td>${L.minting}</td><td><input id="cfg_mint" type="checkbox" ${CFG.mintingMode?"checked":""}></td></tr>
      </table>
      <button class="rbpro-btn" onclick="window._rbSaveCfg()">${L.saveBtn}</button>
    </div>

    <center>
      <button class="rbpro-btn" style="font-size:15px;padding:8px 28px" onclick="window._rbStart()">▶ ${L.start}</button>
    </center>

    <div id="rbpro_progress" style="display:none">
      <div class="rbpro-progress-bar"><div class="rbpro-progress" id="rbpro_bar" style="width:0%"></div></div>
      <div id="rbpro_status" style="font-size:11px;color:${T.text}">${L.progress}</div>
    </div>

    <div id="rbpro_results" style="display:none;margin-top:8px"></div>
  </div>

  <div class="rbpro-footer">${L.by}</div>
</div>`;

    $("#rbpro_container").remove();
    $("#contentContainer").eq(0).prepend(html);
    $("#mobileContent").eq(0).prepend(html);

    // Make draggable
    try { $("#rbpro_container").draggable({ handle:"#rbpro_drag" }); } catch(e) {}
}

// ─── Global handlers ──────────────────────────────────────────────────────────
window._rbApplyTheme = name => { applyTheme(name); document.getElementById("rbpro_css")?.remove(); $("head").append($(CSS())); };
window._rbSaveCfg = () => {
    CFG.reserveMerchants  = parseInt(document.getElementById("cfg_res").value)  || 0;
    CFG.constructionHours = parseInt(document.getElementById("cfg_ht").value)   || 0;
    CFG.averageFactor     = parseFloat(document.getElementById("cfg_af").value) ?? 1;
    CFG.nrClusters        = parseInt(document.getElementById("cfg_nc").value)   || 1;
    CFG.merchantCapacity  = parseInt(document.getElementById("cfg_mc")?.value)  || 1000;
    CFG.maxConstruction   = document.getElementById("cfg_mc2").checked;
    CFG.lowPoints         = parseInt(document.getElementById("cfg_lp").value)   || 3000;
    CFG.highPoints        = parseInt(document.getElementById("cfg_hp").value)   || 9000;
    CFG.highFarm          = parseInt(document.getElementById("cfg_hf").value)   || 24000;
    CFG.builtOutPct       = parseFloat(document.getElementById("cfg_bp").value) || 0.25;
    CFG.needsMorePct      = parseFloat(document.getElementById("cfg_np").value) || 0.85;
    CFG.mintingMode       = document.getElementById("cfg_mint").checked;
    saveSettings(CFG);
    UI.SuccessMessage(L.saved, 1500);
};

window._rbStart = async () => {
    window._rbSaveCfg();
    const prog = document.getElementById("rbpro_progress");
    const bar  = document.getElementById("rbpro_bar");
    const stat = document.getElementById("rbpro_status");
    prog.style.display = "";

    function setProgress(pct, msg) {
        bar.style.width = pct + "%";
        stat.innerText  = msg;
    }

    try {
        setProgress(5,  "Fetching production data…");
        const { villages, farmUsage } = await fetchProduction();

        setProgress(25, "Fetching incoming transports…");
        const incoming = await fetchIncoming();

        setProgress(40, "Fetching AM data…");
        let amMaps;
        try { amMaps = await fetchAMData(farmUsage); }
        catch { amMaps = new Array(100).fill(new Map()); }

        setProgress(60, "Calculating clusters…");
        const coords = villages.map(v => v.coord.split("|").map(Number));
        const k = Math.max(1, Math.min(CFG.nrClusters, villages.length));
        const clusters = kmeans(coords, k);

        // Group villages by cluster
        const villagesByCluster = clusters.map(c => {
            return c.points.map(p => {
                const coord = p[0]+"|"+p[1];
                return villages.find(v => v.coord === coord);
            }).filter(Boolean);
        });

        setProgress(75, "Calculating optimal transfers…");

        let amHours = CFG.constructionHours;
        if (CFG.maxConstruction && CFG.averageFactor <= 0.5) {
            // Find max construction hours where supply > demand
            for (let h = 1; h <= 100; h++) {
                const { launches } = calculateLaunches(villagesByCluster, incoming, amMaps, h);
                const surpW = launches.reduce((a,l)=>a+l.wood,0);
                const demW  = villagesByCluster.flat().reduce((a,v)=>a+(amMaps[h-1]?.get(v.coord)?.wood||0),0);
                if (demW > surpW) { amHours = h; break; }
            }
        }

        const { launches, clusterStats } = calculateLaunches(villagesByCluster, incoming, amMaps, amHours);

        setProgress(90, "Building results…");
        renderResults(launches, clusterStats, villages, incoming, clusters);
        setProgress(100, L.done);

    } catch(err) {
        stat.innerText = "Error: " + err.message;
        console.error(err);
    }
};

// ─── Send resources ────────────────────────────────────────────────────────────
window._rbSend = (sourceId, targetId, wood, stone, iron, rowId) => {
    document.getElementById(rowId)?.remove();
    TribalWars.post("market",
        { village:sourceId, ajaxaction:"call", h:window.csrf_token },
        { [`resource[${sourceId}][wood]`]:wood, [`resource[${sourceId}][stone]`]:stone, [`resource[${sourceId}][iron]`]:iron },
        res  => { UI.SuccessMessage(res.success||"Sent!", 800); },
        err  => console.error(err)
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. RENDER RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
function renderResults(launches, clusterStats, villages, incoming, clusters) {
    const div = document.getElementById("rbpro_results");

    // Merge multi-send to same target into one row
    const merged = new Map();
    for (const l of launches) {
        const k = l.id_origin + "_" + l.id_destination;
        if (!merged.has(k)) {
            merged.set(k, {...l});
        } else {
            const e = merged.get(k);
            e.wood+=l.wood; e.stone+=l.stone; e.iron+=l.iron; e.total+=l.total;
            e.distance = Math.max(e.distance, l.distance);
        }
    }
    const rows = [...merged.values()].sort((a,b) => a.distance - b.distance);

    // Stats table
    const totalW = villages.reduce((a,v)=>a+v.wood,0);
    const totalS = villages.reduce((a,v)=>a+v.stone,0);
    const totalI = villages.reduce((a,v)=>a+v.iron,0);
    const n = villages.length;

    let html = `
    <div class="rbpro-section">
      <table class="rbpro-table">
        <tr><th></th><th>🪵 ${L.wood}</th><th>🪨 ${L.stone}</th><th>⚙ ${L.iron}</th></tr>
        <tr><td><b>Total</b></td><td>${fmt(totalW)}</td><td>${fmt(totalS)}</td><td>${fmt(totalI)}</td></tr>
        <tr><td><b>Avg/village</b></td><td>${fmt(totalW/n)}</td><td>${fmt(totalS/n)}</td><td>${fmt(totalI/n)}</td></tr>
        <tr><td><b>Sends</b></td><td>${fmt(rows.reduce((a,r)=>a+r.wood,0))}</td><td>${fmt(rows.reduce((a,r)=>a+r.stone,0))}</td><td>${fmt(rows.reduce((a,r)=>a+r.iron,0))}</td></tr>
      </table>
      <button class="rbpro-btn" onclick="window._rbShowClusters()">📊 ${L.clusters}</button>
      <button class="rbpro-btn" onclick="window._rbShowResult()">📋 ${L.results}</button>
    </div>
    <div style="max-height:460px;overflow-y:auto">
    <table class="rbpro-table" id="rbpro_sendtable">
      <tr>
        <th>#</th>
        <th>${L.source}</th><th>${L.target}</th>
        <th>${L.distance}</th><th>Total</th>
        <th>🪵</th><th>🪨</th><th>⚙</th>
        <th></th>
      </tr>`;

    rows.forEach((r,i) => {
        const rowId = "rbpro_row_"+i;
        html += `<tr id="${rowId}">
          <td>${i+1}</td>
          <td><a class="rbpro-link" href="${urlBase}info_village&id=${r.id_origin}">${r.name_origin}</a></td>
          <td><a class="rbpro-link" href="${urlBase}info_village&id=${r.id_destination}">${r.name_destination}</a></td>
          <td>${r.distance.toFixed(1)}</td>
          <td>${fmt(r.total)}</td>
          <td>${fmt(r.wood)}</td><td>${fmt(r.stone)}</td><td>${fmt(r.iron)}</td>
          <td><button class="rbpro-btn-send"
              onclick="window._rbSend('${r.id_origin}','${r.id_destination}',${r.wood},${r.stone},${r.iron},'${rowId}')">
              ${L.send}
          </button></td>
        </tr>`;
    });

    html += `</table></div>`;
    div.innerHTML = html;
    div.style.display = "";

    // Store for popups
    window._rbData = { rows, clusterStats, villages, incoming, clusters };

    // Keyboard shortcut: Enter = send first visible
    window.onkeydown = e => {
        if (e.key === "Enter") {
            const first = document.querySelector(".rbpro-btn-send:not([disabled])");
            if (first) first.click();
        }
    };
}

window._rbShowClusters = () => {
    if (!window._rbData) return;
    const { clusterStats } = window._rbData;
    let h = `<div style="max-height:600px;overflow-y:auto"><table class="rbpro-table">
      <tr><th>#</th><th>Villages</th><th>Center</th><th>Avg W/S/I</th><th>Surplus W/S/I</th><th>Max dist</th></tr>`;
    clusterStats.forEach((c,i) => {
        h += `<tr><td>${i+1}</td><td>${c.n}</td>
          <td>${Math.round(c.center.x)}|${Math.round(c.center.y)}</td>
          <td>${fmt(c.avgW)} / ${fmt(c.avgS)} / ${fmt(c.avgI)}</td>
          <td>${fmt(c.supW)} / ${fmt(c.supS)} / ${fmt(c.supI)}</td>
          <td>${c.maxDist.toFixed(1)}</td></tr>`;
    });
    h += `</table></div>`;
    Dialog.show("content", h);
};

window._rbShowResult = () => {
    if (!window._rbData) return;
    const { rows, villages, incoming } = window._rbData;
    let h = `<div style="max-height:600px;overflow-y:auto"><table class="rbpro-table">
      <tr><th>Village</th><th>Pts</th><th>Priority</th><th>🪵 after</th><th>🪨 after</th><th>⚙ after</th><th>WH cap</th></tr>`;

    villages.forEach((v,i) => {
        const inc = incoming.get(v.coord) || {wood:0,stone:0,iron:0};
        let w = v.wood+inc.wood, s = v.stone+inc.stone, fe = v.iron+inc.iron;
        rows.forEach(r => {
            if (r.id_origin      === v.id) { w-=r.wood; s-=r.stone; fe-=r.iron; }
            if (r.id_destination === v.id) { w+=r.wood; s+=r.stone; fe+=r.iron; }
        });
        const pri = getVillagePriority(v);
        const priColor = pri==="small"?"#4eff4e":pri==="builtin"?"#ff9944":"inherit";
        h += `<tr>
          <td><a class="rbpro-link" href="${urlBase}info_village&id=${v.id}">${v.coord}</a></td>
          <td>${fmt(v.points)}</td>
          <td style="color:${priColor}">${pri}</td>
          <td style="background:${w<0?"#6a0000":"inherit"}">${fmt(Math.max(0,w))}</td>
          <td style="background:${s<0?"#6a0000":"inherit"}">${fmt(Math.max(0,s))}</td>
          <td style="background:${fe<0?"#6a0000":"inherit"}">${fmt(Math.max(0,fe))}</td>
          <td>${fmt(v.capacity)}</td>
        </tr>`;
    });
    h += `</table></div>`;
    Dialog.show("content", h);
};

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════
buildUI();
UI.SuccessMessage("ResourceBalancer PRO loaded — configure & click Start", 2000);
