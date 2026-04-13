// ╔══════════════════════════════════════════════════════════════════════════╗
// ║          ResourceBalancer PRO — Tribal Wars  v2.0                       ║
// ║  Merged & improved from:                                                ║
// ║   • Costache Madalin  (K-means clustering, AM integration, map view)    ║
// ║   • Sophie "Shinko to Kuma" (village priorities, sitter, multi-lang)    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// ═══ PERFECT SETUP GUIDE ═══════════════════════════════════════════════════
//  reserveMerchants : 0 (farming), 2-3 (active war — keep traders free)
//  constructionHours: 0 if no AM. 4-8 = your typical AM queue length.
//  averageFactor    : 1.0 = exact equalization. 0.8 = leave 20% buffer.
//                     Use 0.6-0.7 for attack accounts (hard to spy)
//  nrClusters       : 1 cluster per ~15-20 villages. 50 vills → 3 clusters.
//  merchantCapacity : 1000 (default), 1500 (PT/ES servers only)
//  lowPoints        : villages still building (<3000) → fill to needsMorePct
//  highPoints       : done building (>9000) → drain to builtOutPct
//  highFarm         : farm maxed (>24000 pop) → treated as built-out
//  builtOutPct      : 0.20-0.25  (keep only 20-25% in WH for done villages)
//  needsMorePct     : 0.80-0.90  (fill small/building villages to 80-90%)
// ═══════════════════════════════════════════════════════════════════════════

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
              saved:"Saved — re-run script", by:"ResourceBalancer PRO v2" },
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
              saved:"Gespeichert — Skript neu starten", by:"ResourceBalancer PRO v2" },
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
              saved:"Salvat — reporneste scriptul", by:"ResourceBalancer PRO v2" },
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
/* ── Mobile-first base ───────────────────────────────────── */
.rbpro-container {
    position:fixed; top:4px; left:2vw; width:96vw;
    background:${T.bg}; border:2px solid ${T.border}; border-radius:6px;
    color:${T.text}; font-family:Arial,sans-serif; font-size:13px;
    z-index:99999; display:flex; flex-direction:column; max-height:92vh; }
.rbpro-header {
    background:${T.header}; padding:8px 10px; border-radius:4px 4px 0 0;
    display:flex; align-items:center; justify-content:space-between;
    cursor:move; flex-shrink:0; }
.rbpro-header h2 { margin:0; font-size:14px; color:${T.text}; }
.rbpro-body { padding:8px; overflow-y:auto; flex:1; min-height:0;
    -webkit-overflow-scrolling:touch; }
.rbpro-footer { background:${T.header}; padding:4px 10px; border-radius:0 0 4px 4px;
    font-size:11px; color:${T.text}; opacity:.7; flex-shrink:0; }
/* ── Tables ─────────────────────────────────────────────── */
.rbpro-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; width:100%; }
.rbpro-table { width:100%; border-collapse:collapse; margin:6px 0; min-width:280px; }
.rbpro-table td, .rbpro-table th { padding:5px 6px; border:1px solid ${T.border};
    white-space:nowrap; }
.rbpro-table tr:nth-child(even) { background:${T.table}; }
.rbpro-table tr:nth-child(odd)  { background:${T.inner}; }
.rbpro-table th { background:${T.header}; color:${T.text}; }
/* ── Settings rows (div-based, responsive) ──────────────── */
.rbpro-cfg { width:100%; }
.rbpro-cfg-head { background:${T.header}; color:${T.text}; padding:5px 8px;
    font-weight:bold; border:1px solid ${T.border}; margin-bottom:1px; }
.rbpro-cfg-row { display:flex; flex-wrap:wrap; align-items:center;
    border:1px solid ${T.border}; border-top:none; padding:4px 8px; gap:6px;
    background:${T.inner}; }
.rbpro-cfg-row:nth-child(even) { background:${T.table}; }
.rbpro-cfg-label { flex:1 1 140px; font-size:12px; }
.rbpro-cfg-ctrl  { flex:0 0 auto; }
/* ── Inputs ─────────────────────────────────────────────── */
.rbpro-input { background:${T.input}; color:${T.text}; border:1px solid ${T.border};
    padding:6px 8px; width:100px; border-radius:3px;
    font-size:14px; min-height:36px; box-sizing:border-box; }
input[type=checkbox].rbpro-check { width:20px; height:20px; cursor:pointer; }
/* ── Buttons ─────────────────────────────────────────────── */
.rbpro-btn { background:${T.header}; color:${T.text}; border:1px solid ${T.border};
    padding:8px 14px; border-radius:4px; cursor:pointer; margin:3px;
    font-size:13px; min-height:38px; touch-action:manipulation; }
.rbpro-btn:hover { background:${T.table}; }
.rbpro-btn-send { background:#1a4a1a; color:#aaffaa; border:1px solid #2d6e2d;
    padding:7px 12px; border-radius:3px; cursor:pointer;
    min-height:36px; font-size:13px; touch-action:manipulation; white-space:nowrap; }
.rbpro-btn-send:hover { background:#2d6e2d; }
/* ── Progress ───────────────────────────────────────────── */
.rbpro-progress-bar { width:100%; height:14px; background:${T.input};
    border-radius:6px; margin:6px 0; }
.rbpro-progress { height:14px; background:#4CAF50; border-radius:6px; transition:width .2s; }
/* ── Misc ───────────────────────────────────────────────── */
.rbpro-section { margin:8px 0; padding:6px; background:${T.table}; border-radius:4px; }
.rbpro-tag-good { color:#4eff4e; font-weight:bold; }
.rbpro-tag-bad  { color:#ff6060; font-weight:bold; }
a.rbpro-link { color:${T.border}; }
/* ── Desktop override ───────────────────────────────────── */
@media (min-width:600px) {
    .rbpro-container { width:54%; min-width:420px; top:50px; left:23%; }
    .rbpro-header h2 { font-size:15px; }
    .rbpro-cfg-label { flex-basis:180px; }
}
</style>`;

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
const SETTINGS_KEY = "rbpro_settings_" + game_data.world;
const DEFAULT_SETTINGS = {
    reserveMerchants:  0,
    constructionHours: 0,
    averageFactor:     1.0,
    nrClusters:        1,
    merchantCapacity:  1000,
    maxConstruction:   false,
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

// ── Coordinate cache: parse "123|456" strings only ONCE ──────────────────────
const _xyCache = new Map();
function xy(coord) {
    if (!_xyCache.has(coord)) {
        const p = coord.split("|");
        _xyCache.set(coord, [+p[0], +p[1]]);
    }
    return _xyCache.get(coord);
}

function dist(c1, c2) {
    const [x1,y1] = xy(c1), [x2,y2] = xy(c2);
    return Math.hypot(x1-x2, y1-y2);
}

// ── Async page fetch: replaces blocking synchronous httpGet() ─────────────────
// FIX: old httpGet() used synchronous XHR which froze the browser UI thread.
async function fetchPage(url) {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.text();
}

function ajaxGet(url, delayMs = 220) {
    return new Promise((res, rej) => {
        const t0 = Date.now();
        $.ajax({ url, method:"get", dataType:"text",
            success: data => setTimeout(() => res(data), Math.max(0, delayMs - (Date.now()-t0))),
            error:   err  => rej(err)
        });
    });
}

function getPages(htmlDoc, baseUrl) {
    const sel = $(htmlDoc.body).find(".paged-nav-item").parent().find("select");
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

// Sitter-aware URLs
const isSitter = game_data.player.sitter > 0;
const sitPrefix = isSitter ? `t=${game_data.player.id}&` : "";
const urlBase = game_data.link_base_pure;

function buildUrl(screen, extra = "") {
    return `${urlBase}${screen}&${sitPrefix}${extra}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. DATA FETCHING   (all async — no browser freeze)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchProduction() {
    const baseUrl = buildUrl("overview_villages&mode=prod", "page=-1");
    const firstPage = await fetchPage(baseUrl);                    // FIX: was httpGet
    const doc0 = new DOMParser().parseFromString(firstPage, "text/html");
    const pages = getPages(doc0, baseUrl);

    const villages  = [];
    const farmUsage = new Map();
    const isDesktop = game_data.device === "desktop";

    for (const url of pages) {
        const data = await ajaxGet(url);
        const doc  = new DOMParser().parseFromString(data, "text/html");

        if (isDesktop) {
            Array.from(doc.querySelectorAll(".row_a, .row_b")).forEach(row => {
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
            Array.from(doc.querySelectorAll(".overview-container-item")).forEach(row => {
                try {
                    const name   = $(row).find(".quickedit-label").text().trim();
                    const coord  = name.match(/\d+\|\d+/)?.[0];
                    if (!coord) return;
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
                                    merchants: merch, merchantsTotal: 500,
                                    capacity: cap, points, farmUsed: farmCur, farmTotal: farmMax });
                    farmUsage.set(coord, farmCur / farmMax);
                } catch(e) {}
            });
        }
    }
    return { villages, farmUsage };
}

async function fetchIncoming() {
    const baseUrl  = buildUrl("overview_villages&mode=trader&type=inc", "page=-1&type=inc");
    const firstPage = await fetchPage(baseUrl);                    // FIX: was httpGet
    const doc0  = new DOMParser().parseFromString(firstPage, "text/html");
    const pages = getPages(doc0, baseUrl);

    const incoming = new Map(); // coord → {wood,stone,iron}

    for (const url of pages) {
        const data = await ajaxGet(url);
        const doc  = new DOMParser().parseFromString(data, "text/html");
        Array.from(doc.querySelectorAll(".row_a, .row_b")).forEach(row => {
            try {
                let coord;
                if (game_data.device === "desktop") {
                    coord = row.children[4].innerText.match(/\d{3}\|\d{3}/)?.[0];
                } else {
                    const matches = row.children[3].innerText.match(/\d{3}\|\d{3}/g);
                    coord = matches && matches.length >= 2 ? matches[1] : matches?.[0];  // FIX: safe access
                }
                if (!coord) return;

                const w  = parseInt($(row).find(".wood").parent().text().replace(/\./g,""))  || 0;
                const s  = parseInt($(row).find(".stone").parent().text().replace(/\./g,"")) || 0;
                const fe = parseInt($(row).find(".iron").parent().text().replace(/\./g,""))  || 0;

                if (incoming.has(coord)) {
                    const e = incoming.get(coord);
                    e.wood += w; e.stone += s; e.iron += fe;
                } else {
                    incoming.set(coord, { wood:w, stone:s, iron:fe });
                }
            } catch(e) {}
        });
    }
    return incoming;
}

// ─── Account Manager integration ─────────────────────────────────────────────

// FIX: Only compute for the actually needed hours (lazy), not always 1-100.
// Pass maxHours = 1 if constructionHours is fixed; = 100 only for auto-max mode.
async function fetchAMData(farmUsage, maxHours = 100) {
    if (!game_data.features?.AccountManager?.active) {
        return Array.from({ length: 100 }, () => new Map()); // FIX: was fill(new Map()) → same ref
    }

    const { templates, coordMap, farmCapMap } = await fetchAMTemplates();
    const buildings  = await fetchBuildings();
    const constants  = await getbuildingConstants();

    const result = [];
    for (let hours = 1; hours <= maxHours; hours++) {
        const amMap = new Map();
        // FIX: proper Map clone — no JSON.stringify round-trip
        const bld = new Map(buildings);

        // Carry forward already-queued time
        for (const [k, v] of bld) {
            if (k.endsWith("_time_queued"))
                amMap.set(k.replace("_time_queued", ""), { wood:0, stone:0, iron:0, timeH: Math.round(v/3600) });
        }

        for (const [coord, tplName] of coordMap) {
            const tpl     = templates.get(tplName);
            const farmCap = (farmCapMap.get(tplName) || 99) / 100;
            if (!tpl) continue;

            let elapsed = bld.get(coord + "_time_queued") || 0;

            // Auto-upgrade farm if at capacity
            const farmLv = bld.get(coord + "_farm") || 0;
            if (farmLv < 30 && (farmUsage.get(coord) || 0) >= farmCap) {
                const hq  = bld.get(coord + "_main") || 1;
                const res = calcBuildingCost(hq, farmLv + 1, constants.get("farm"));
                if (res) {
                    elapsed += res[0];
                    const existing = amMap.get(coord) || { wood:0, stone:0, iron:0, timeH:0 };
                    existing.wood += res[1]; existing.stone += res[2]; existing.iron += res[3];
                    existing.timeH = elapsed / 3600;
                    amMap.set(coord, existing);
                }
            }

            for (const item of tpl) {
                const key   = coord + "_" + item.name;
                let   curLv = bld.get(key) || 0;
                if (item.level_absolute <= curLv) continue;

                for (let j = curLv; j < item.level_absolute; j++) {
                    const hq  = bld.get(coord + "_main") || 1;
                    const res = calcBuildingCost(hq, j + 1, constants.get(item.name));
                    if (!res) continue;
                    elapsed += res[0];

                    const existing = amMap.get(coord) || { wood:0, stone:0, iron:0, timeH:0 };
                    existing.wood += res[1]; existing.stone += res[2]; existing.iron += res[3];
                    existing.timeH = elapsed / 3600;
                    amMap.set(coord, existing);
                    bld.set(key, j + 1);

                    if (elapsed > hours * 3600) break;
                }
                if (elapsed > hours * 3600) break;
            }
        }
        result.push(amMap);
    }
    // Pad to length 100 if we computed fewer hours
    while (result.length < 100) result.push(result[result.length - 1] || new Map());
    return result;
}

async function fetchAMTemplates() {
    const baseUrl = buildUrl("am_village");
    const first   = await fetchPage(baseUrl);                      // FIX: was httpGet
    const doc0    = new DOMParser().parseFromString(first, "text/html");
    const pages   = getPages(doc0, baseUrl);

    const coordMap  = new Map();
    const templates = new Map();
    const farmCapMap= new Map();

    for (const url of pages) {
        const data = await ajaxGet(url);
        const doc  = new DOMParser().parseFromString(data, "text/html");
        Array.from(doc.querySelectorAll(".row_a, .row_b")).forEach(row => {
            try {
                const coord = row.children[0].innerText.match(/\d{3}\|\d{3}/)[0];
                const tpl   = row.children[1].innerText.trim();
                if (tpl) { coordMap.set(coord, tpl); templates.set(tpl, null); farmCapMap.set(tpl, 0); }
            } catch(e) {}
        });
    }

    const opts = Array.from(doc0.querySelectorAll("select[name='template'] option"));
    for (const opt of opts) {
        const rawName = opt.innerText.replace(/[\n\t]/g,"").replace(/\(\w+\)/,"").trim();
        if (!templates.has(rawName)) continue;

        const url  = buildUrl("am_village&mode=queue", `template=${opt.value}`);
        const data = await ajaxGet(url);
        const doc  = new DOMParser().parseFromString(data, "text/html");

        const rows = Array.from(doc.querySelectorAll(".sortable_row"));
        templates.set(rawName, rows.map(r => ({
            name:           r.getAttribute("data-building"),
            level_absolute: parseInt($(r).find(".level_absolute").text().match(/\d+/)[0])
        })));

        let farmCap = 99;
        if (doc.querySelector("input[name='farm_upgrade_toggle']")?.checked)
            farmCap = 100 - parseInt(doc.querySelector("select[name='population_upgrades']")?.value || "0");
        farmCapMap.set(rawName, farmCap);
    }

    return { templates, coordMap, farmCapMap };
}

async function fetchBuildings() {
    const baseUrl = buildUrl("overview_villages&mode=buildings");
    const first   = await fetchPage(baseUrl);                      // FIX: was httpGet
    const doc0    = new DOMParser().parseFromString(first, "text/html");
    const pages   = getPages(doc0, baseUrl);
    const bld     = new Map();

    for (const url of pages) {
        const data = await ajaxGet(url);
        const doc  = new DOMParser().parseFromString(data, "text/html");

        Array.from(doc.querySelectorAll(".row_a, .row_b")).forEach(row => {
            try {
                const coord = row.querySelector(".nowrap")?.textContent.match(/\d{3}\|\d{3}/)?.[0];
                if (!coord) return;

                const lastQ = $(row).find(".queue_icon img").last().attr("title");
                bld.set(coord + "_time_queued", lastQ ? getFinishedSeconds(lastQ) : 0);

                $(row).find(".upgrade_building").each((_, el) => {
                    const name  = el.classList[1].replace("b_","");
                    const level = parseInt(el.innerText);
                    bld.set(coord + "_" + name, level);
                });
                Array.from($(row).find(".queue_icon img"))
                    .map(e => e.src.match(/\w+\.(webp|png)/)[0].replace(/\.(webp|png)/,""))
                    .forEach(n => bld.set(coord + "_" + n, (bld.get(coord + "_" + n) || 0) + 1));
            } catch(e) {}
        });
    }
    return bld;
}

// FIX: async — was using synchronous httpGet
async function getbuildingConstants() {
    const key = game_data.world + "_rbpro_bldConst";
    if (localStorage.getItem(key)) return new Map(JSON.parse(localStorage.getItem(key)));

    const data = await fetchPage("/interface.php?func=get_building_info"); // FIX: was httpGet
    const doc  = new DOMParser().parseFromString(data, "text/xml");
    const config = doc.querySelector("config");
    if (!config) throw new Error("Building constants: <config> not found in response");
    const map  = new Map();
    Array.from(config.children).forEach(el => {
        const n = el.tagName.toLowerCase();
        map.set(n, {
            wood:              +el.querySelector("wood")?.textContent,
            stone:             +el.querySelector("stone")?.textContent,
            iron:              +el.querySelector("iron")?.textContent,
            wood_factor:       +el.querySelector("wood_factor")?.textContent,
            stone_factor:      +el.querySelector("stone_factor")?.textContent,
            iron_factor:       +el.querySelector("iron_factor")?.textContent,
            build_time:        +el.querySelector("build_time")?.textContent,
            build_time_factor: +el.querySelector("build_time_factor")?.textContent,
        });
    });
    localStorage.setItem(key, JSON.stringify(Array.from(map.entries())));
    return map;
}

function getFinishedSeconds(title) {
    try {
        const srv     = document.getElementById("serverDate").innerText.split("/");
        const srvDate = srv[1]+"/"+srv[0]+"/"+srv[2];
        const srvTime = document.getElementById("serverTime").innerText;
        const now     = new Date(srvDate+" "+srvTime);

        let dateStr = "";
        const todayKey    = lang["aea2b0aa9ae1534226518faaefffdaad"]?.replace(" %s","") || "Today";
        const tomorrowKey = lang["57d28d1b211fddbb7a499ead5bf23079"]?.replace(" %s","") || "Tomorrow";

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
        return Math.max(0, Math.round((fin - now) / 1000));
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
// 6. K-MEANS++  (replaces random init + O(n²) scoring)
// ═══════════════════════════════════════════════════════════════════════════════
// FIX 1: k-means++ initialization — much better starting positions than random.
//         Requires only 10-15 restarts vs. 40 for random init.
// FIX 2: SSE scoring (sum of squared dist to centroid) → O(n) instead of O(n²).
// FIX 3: clusters now correctly initialized to centers[i], not all to centers[0].

function kmeanspp(points, k) {
    // k-means++ initialization
    const centers = [];
    // Pick first center uniformly at random
    centers.push(points[Math.floor(Math.random() * points.length)].slice());

    for (let c = 1; c < k; c++) {
        // Each point weighted by squared distance to nearest existing center
        const weights = points.map(p => {
            let minD2 = Infinity;
            for (const cn of centers) {
                const d2 = (p[0]-cn[0])**2 + (p[1]-cn[1])**2;
                if (d2 < minD2) minD2 = d2;
            }
            return minD2;
        });
        const total = weights.reduce((a,w) => a+w, 0);
        let r = Math.random() * total;
        let chosen = points.length - 1;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) { chosen = i; break; }
        }
        centers.push(points[chosen].slice());
    }
    return centers;
}

function kmeans(points, k, maxIter = 100, restarts = 15) {
    if (points.length <= k) {
        // Trivial: each point is its own cluster
        return points.map(p => ({ center: [...p], points: [p] }));
    }

    let best = null, bestSSE = Infinity;

    for (let r = 0; r < restarts; r++) {
        const initCenters = kmeanspp(points, k);
        // FIX: each cluster gets its own correct center (was all centers[0] before)
        const clusters = initCenters.map(c => ({ center: [...c], points: [] }));

        let changed = true, iter = 0;
        while (changed && iter++ < maxIter) {
            clusters.forEach(c => c.points = []);
            changed = false;

            for (const p of points) {
                let bi = 0, bd = Infinity;
                for (let i = 0; i < k; i++) {
                    const d = (p[0]-clusters[i].center[0])**2 + (p[1]-clusters[i].center[1])**2;
                    if (d < bd) { bd = d; bi = i; }
                }
                clusters[bi].points.push(p);
            }

            clusters.forEach((c, i) => {
                if (!c.points.length) {
                    // Empty cluster: steal the point farthest from its centroid
                    let worst = null, worstD = -1;
                    for (const oc of clusters) {
                        if (oc.points.length <= 1) continue;
                        for (const p of oc.points) {
                            const d = (p[0]-oc.center[0])**2 + (p[1]-oc.center[1])**2;
                            if (d > worstD) { worstD = d; worst = p; }
                        }
                    }
                    if (worst) c.center = [...worst];
                    return;
                }
                const nx = c.points.reduce((a,p) => a+p[0], 0) / c.points.length;
                const ny = c.points.reduce((a,p) => a+p[1], 0) / c.points.length;
                if (Math.abs(nx-c.center[0]) > 0.01 || Math.abs(ny-c.center[1]) > 0.01) changed = true;
                c.center = [nx, ny];
            });
        }

        // FIX: SSE scoring = O(n) — was O(n²) max pairwise distance before
        let sse = 0;
        for (const c of clusters)
            for (const p of c.points)
                sse += (p[0]-c.center[0])**2 + (p[1]-c.center[1])**2;

        if (sse < bestSSE) { bestSSE = sse; best = clusters; }
    }
    return best;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PRIORITY EVALUATION
// ═══════════════════════════════════════════════════════════════════════════════
function getVillagePriority(v) {
    if (v.farmUsed > CFG.highFarm || v.points > CFG.highPoints) return "builtin";
    if (v.points < CFG.lowPoints)                                return "small";
    return "normal";
}

function getTargetAmounts(v, avgW, avgS, avgI) {
    const pri = getVillagePriority(v);
    const cap = v.capacity;
    if (pri === "small") {
        return { w: cap * CFG.needsMorePct, s: cap * CFG.needsMorePct, i: cap * CFG.needsMorePct };
    }
    if (pri === "builtin") {
        return { w: cap * CFG.builtOutPct, s: cap * CFG.builtOutPct, i: cap * CFG.builtOutPct };
    }
    return {
        w: Math.min(avgW * CFG.averageFactor, cap * CFG.needsMorePct),
        s: Math.min(avgS * CFG.averageFactor, cap * CFG.needsMorePct),
        i: Math.min(avgI * CFG.averageFactor, cap * CFG.needsMorePct),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. LAUNCH CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════
function calculateLaunches(villagesByCluster, incoming, amMaps, amHours) {
    const allLaunches  = [];
    const clusterStats = [];

    for (let ci = 0; ci < villagesByCluster.length; ci++) {
        const cluster = villagesByCluster[ci];
        const amMap   = amHours > 0 ? (amMaps[amHours-1] || new Map()) : new Map();

        const eff = cluster.map(v => {
            const inc = incoming.get(v.coord) || {wood:0,stone:0,iron:0};
            return {
                ...v,
                effW: Math.min(v.wood  + inc.wood,  v.capacity),
                effS: Math.min(v.stone + inc.stone, v.capacity),
                effI: Math.min(v.iron  + inc.iron,  v.capacity),
                amW:    amMap.get(v.coord)?.wood  || 0,
                amS:    amMap.get(v.coord)?.stone || 0,
                amI:    amMap.get(v.coord)?.iron  || 0,
                amTimeH:amMap.get(v.coord)?.timeH || 0,
            };
        });

        const n    = eff.length;
        const avgW = eff.reduce((a,v) => a+v.effW, 0) / n;
        const avgS = eff.reduce((a,v) => a+v.effS, 0) / n;
        const avgI = eff.reduce((a,v) => a+v.effI, 0) / n;

        const senders   = [];
        const receivers = [];

        for (const v of eff) {
            const tgt       = getTargetAmounts(v, avgW, avgS, avgI);
            const merchants = Math.max(0, v.merchants - CFG.reserveMerchants);
            const cap_travel= merchants * CFG.merchantCapacity;
            const cap_wh    = v.capacity * 0.95;

            const targetW = Math.round(tgt.w) + Math.round(v.amW);
            const targetS = Math.round(tgt.s) + Math.round(v.amS);
            const targetI = Math.round(tgt.i) + Math.round(v.amI);

            const surpW = Math.max(0, v.effW - targetW);
            const surpS = Math.max(0, v.effS - targetS);
            const surpI = Math.max(0, v.effI - targetI);
            const totalSurp = surpW + surpS + surpI;

            if (totalSurp > 0) {
                const scale = cap_travel < totalSurp ? cap_travel / totalSurp : 1;
                senders.push({
                    ...v,
                    sendW: Math.floor(surpW * scale),
                    sendS: Math.floor(surpS * scale),
                    sendI: Math.floor(surpI * scale),
                });
            }

            const needW = Math.max(0, targetW - v.effW);
            const needS = Math.max(0, targetS - v.effS);
            const needI = Math.max(0, targetI - v.effI);
            const freeW = Math.max(0, cap_wh - v.effW);
            const freeS = Math.max(0, cap_wh - v.effS);
            const freeI = Math.max(0, cap_wh - v.effI);

            if (needW + needS + needI > 0) {
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
        const supW = senders.reduce((a,s) => a+s.sendW, 0);
        const supS = senders.reduce((a,s) => a+s.sendS, 0);
        const supI = senders.reduce((a,s) => a+s.sendI, 0);
        const demW = receivers.reduce((a,r) => a+r.needW, 0);
        const demS = receivers.reduce((a,r) => a+r.needS, 0);
        const demI = receivers.reduce((a,r) => a+r.needI, 0);

        const nW = demW > supW && supW > 0 ? supW/demW : 1;
        const nS = demS > supS && supS > 0 ? supS/demS : 1;
        const nI = demI > supI && supI > 0 ? supI/demI : 1;
        receivers.forEach(r => {
            r.needW = Math.floor(r.needW * nW);
            r.needS = Math.floor(r.needS * nS);
            r.needI = Math.floor(r.needI * nI);
        });

        // Match senders → receivers by proximity
        // FIX: precompute distance from each sender to current receiver (cache coord parse)
        for (const rec of receivers) {
            // Sort senders by distance to this receiver (using cached xy())
            const [rx, ry] = xy(rec.coord);
            senders.sort((a, b) => {
                const [ax,ay] = xy(a.coord), [bx,by] = xy(b.coord);
                return Math.hypot(ax-rx,ay-ry) - Math.hypot(bx-rx,by-ry);
            });

            let remW = rec.needW, remS = rec.needS, remI = rec.needI;

            for (const sen of senders) {
                if (remW + remS + remI <= 0) break;
                if (sen.sendW + sen.sendS + sen.sendI <= 0) continue;
                if (sen.coord === rec.coord) continue;

                const giveW = Math.min(remW, sen.sendW);
                const giveS = Math.min(remS, sen.sendS);
                const giveI = Math.min(remI, sen.sendI);
                const total = giveW + giveS + giveI;
                if (total <= 0) continue;

                // Avoid partial-merchant sends below minimum load
                const minSend = CFG.merchantCapacity === 1500 ? 1200 : 700;
                const rem     = total % CFG.merchantCapacity;
                let adjW = giveW, adjS = giveS, adjI = giveI;
                if (rem > 0 && rem < minSend) {
                    const maxRes = Math.max(adjW, adjS, adjI);
                    if (adjW === maxRes)      adjW -= rem;
                    else if (adjS === maxRes) adjS -= rem;
                    else                      adjI -= rem;
                }
                if (adjW + adjS + adjI < minSend) continue;

                allLaunches.push({
                    coord_origin:      sen.coord, id_origin:      sen.id, name_origin:      sen.name,
                    coord_destination: rec.coord, id_destination: rec.id, name_destination: rec.name,
                    wood: adjW, stone: adjS, iron: adjI,
                    total: adjW + adjS + adjI,
                    distance: dist(sen.coord, rec.coord)
                });

                sen.sendW -= giveW; sen.sendS -= giveS; sen.sendI -= giveI;
                remW      -= giveW; remS      -= giveS; remI      -= giveI;
            }
        }

        // Cluster stats
        clusterStats.push({
            n,
            center: cluster.reduce((a,v) => {
                const [x,y] = xy(v.coord);
                return { x: a.x + x/n, y: a.y + y/n };
            }, {x:0, y:0}),
            avgW, avgS, avgI, supW, supS, supI, demW, demS, demI,
            maxDist: allLaunches
                .filter(l => cluster.some(v => v.coord === l.coord_origin))
                .reduce((a,l) => Math.max(a, l.distance), 0)
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
      <button class="rbpro-btn" onclick="document.getElementById('rbpro_container').remove();window._rbProRunning=false;if(window._rbKeyHandler){window.removeEventListener('keydown',window._rbKeyHandler);}">✕</button>
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
      <div class="rbpro-cfg">
        <div class="rbpro-cfg-head">${L.settings}</div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.merchants}</span><span class="rbpro-cfg-ctrl"><input id="cfg_res"  class="rbpro-input" type="number" value="${CFG.reserveMerchants}"  min="0"></span></div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.constrTime}</span><span class="rbpro-cfg-ctrl"><input id="cfg_ht"  class="rbpro-input" type="number" value="${CFG.constructionHours}" min="0" max="100"></span></div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.avgFactor}</span><span class="rbpro-cfg-ctrl"><input id="cfg_af"   class="rbpro-input" type="number" value="${CFG.averageFactor}"      min="0" max="1" step="0.05"></span></div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.nrClusters}</span><span class="rbpro-cfg-ctrl"><input id="cfg_nc"  class="rbpro-input" type="number" value="${CFG.nrClusters}"         min="1"></span></div>
        ${isSpecialCap ? `<div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.merchantCap}</span><span class="rbpro-cfg-ctrl"><input id="cfg_mc" class="rbpro-input" type="number" value="${CFG.merchantCapacity}" min="1000" max="1500"></span></div>` : `<input type="hidden" id="cfg_mc" value="${CFG.merchantCapacity}">`}
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.maxConstr}</span><span class="rbpro-cfg-ctrl"><input id="cfg_mc2" class="rbpro-check" type="checkbox" ${CFG.maxConstruction?"checked":""}></span></div>
        <div class="rbpro-cfg-head" style="margin-top:6px">Village Priorities</div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.lowPoints}</span><span class="rbpro-cfg-ctrl"><input id="cfg_lp"   class="rbpro-input" type="number" value="${CFG.lowPoints}"></span></div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.highPoints}</span><span class="rbpro-cfg-ctrl"><input id="cfg_hp"  class="rbpro-input" type="number" value="${CFG.highPoints}"></span></div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.highFarm}</span><span class="rbpro-cfg-ctrl"><input id="cfg_hf"    class="rbpro-input" type="number" value="${CFG.highFarm}"></span></div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.builtPct}</span><span class="rbpro-cfg-ctrl"><input id="cfg_bp"    class="rbpro-input" type="number" value="${CFG.builtOutPct}"  min="0" max="1" step="0.05"></span></div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.needsPct}</span><span class="rbpro-cfg-ctrl"><input id="cfg_np"    class="rbpro-input" type="number" value="${CFG.needsMorePct}" min="0" max="1" step="0.05"></span></div>
        <div class="rbpro-cfg-row"><span class="rbpro-cfg-label">${L.minting}</span><span class="rbpro-cfg-ctrl"><input id="cfg_mint" class="rbpro-check" type="checkbox" ${CFG.mintingMode?"checked":""}></span></div>
      </div>
      <button class="rbpro-btn" style="margin-top:6px" onclick="window._rbSaveCfg()">${L.saveBtn}</button>
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
    const $host = $("#contentContainer").length
        ? $("#contentContainer").eq(0)
        : ($("#mobileContent").length ? $("#mobileContent").eq(0) : $("body"));
    $host.prepend(html);

    try { $("#rbpro_container").draggable({ handle:"#rbpro_drag" }); } catch(e) {}
}

// ─── Global handlers ──────────────────────────────────────────────────────────
window._rbApplyTheme = name => {
    applyTheme(name);
    document.getElementById("rbpro_css")?.remove();
    $("head").append($(CSS()));
};

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
        // FIX: only compute as many hours as actually needed (lazy)
        const amMaxHours = CFG.maxConstruction ? 100 : Math.max(1, CFG.constructionHours || 1);
        let amMaps;
        try { amMaps = await fetchAMData(farmUsage, amMaxHours); }
        catch { amMaps = Array.from({ length: 100 }, () => new Map()); }

        setProgress(60, "Calculating clusters…");
        const coords = villages.map(v => xy(v.coord));
        const k = Math.max(1, Math.min(CFG.nrClusters, villages.length));
        const clusters = kmeans(coords, k);

        const villagesByCluster = clusters.map(c => {
            return c.points.map(p => {
                const coord = p[0] + "|" + p[1];
                return villages.find(v => v.coord === coord);
            }).filter(Boolean);
        });

        setProgress(75, "Calculating optimal transfers…");

        let amHours = CFG.constructionHours;
        if (CFG.maxConstruction && CFG.averageFactor <= 0.5) {
            for (let h = 1; h <= 100; h++) {
                const { launches } = calculateLaunches(villagesByCluster, incoming, amMaps, h);
                const surpW = launches.reduce((a,l) => a+l.wood, 0);
                const demW  = villagesByCluster.flat().reduce((a,v) => a+(amMaps[h-1]?.get(v.coord)?.wood||0), 0);
                if (demW > surpW) {
                    amHours = Math.max(0, h - 1); // FIX: was h (off-by-one)
                    break;
                }
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
// FIX: h muss im POST-Body sein (nicht in der URL) damit TW den CSRF-Token akzeptiert.
// FIX: dataType:"text" statt "json" — TW gibt je nach Version HTML oder JSON zurück.
//      Mit "json" bricht $.post lautlos ab wenn TW HTML sendet (z.B. Weiterleitung).
window._rbSend = (sourceId, targetId, wood, stone, iron, rowId) => {
    document.getElementById(rowId)?.remove();
    $.ajax({
        url:      `/game.php?village=${sourceId}&screen=market&ajaxaction=send_res`,
        type:     'POST',
        dataType: 'text',
        data: {
            target_village: targetId,
            wood:           wood,
            stone:          stone,
            iron:           iron,
            h:              csrf_token,
        },
    }).done((raw) => {
        try {
            const r = JSON.parse(raw);
            if (r.error) {
                UI.ErrorMessage(r.error, 2500);
            } else {
                UI.SuccessMessage(r.success || L.done, 800);
            }
        } catch {
            // TW hat HTML geantwortet (Weiterleitung zur Markt-Seite) → Rohstoffe gesendet
            UI.SuccessMessage(L.done, 800);
        }
    }).fail((xhr) => {
        console.error('[RBPro] _rbSend Fehler:', xhr.status, xhr.responseText?.slice(0, 300));
        UI.ErrorMessage('Fehler beim Senden (HTTP ' + xhr.status + ')', 2500);
    });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. RENDER RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
function renderResults(launches, clusterStats, villages, incoming, clusters) {
    const div = document.getElementById("rbpro_results");

    // Merge multi-send to same pair into one row
    const merged = new Map();
    for (const l of launches) {
        const k = l.id_origin + "_" + l.id_destination;
        if (!merged.has(k)) {
            merged.set(k, {...l});
        } else {
            const e = merged.get(k);
            e.wood += l.wood; e.stone += l.stone; e.iron += l.iron; e.total += l.total;
            // distance stays the same (same pair, same distance)
        }
    }
    const rows = [...merged.values()].sort((a,b) => a.distance - b.distance);

    // FIX: precompute post-transfer state once (O(V+R)) instead of O(V×R) per popup open
    const postState = new Map();
    villages.forEach(v => {
        const inc = incoming.get(v.coord) || {wood:0,stone:0,iron:0};
        postState.set(v.id, {
            w:  v.wood  + inc.wood,
            s:  v.stone + inc.stone,
            fe: v.iron  + inc.iron
        });
    });
    rows.forEach(r => {
        if (postState.has(r.id_origin)) {
            const p = postState.get(r.id_origin);
            p.w -= r.wood; p.s -= r.stone; p.fe -= r.iron;
        }
        if (postState.has(r.id_destination)) {
            const p = postState.get(r.id_destination);
            p.w += r.wood; p.s += r.stone; p.fe += r.iron;
        }
    });

    const totalW = villages.reduce((a,v) => a+v.wood,  0);
    const totalS = villages.reduce((a,v) => a+v.stone, 0);
    const totalI = villages.reduce((a,v) => a+v.iron,  0);
    const n = villages.length;

    let html = `
    <div class="rbpro-section">
      <div class="rbpro-scroll">
      <table class="rbpro-table">
        <tr><th></th><th>🪵 ${L.wood}</th><th>🪨 ${L.stone}</th><th>⚙ ${L.iron}</th></tr>
        <tr><td><b>Total</b></td><td>${fmt(totalW)}</td><td>${fmt(totalS)}</td><td>${fmt(totalI)}</td></tr>
        <tr><td><b>Avg/village</b></td><td>${fmt(totalW/n)}</td><td>${fmt(totalS/n)}</td><td>${fmt(totalI/n)}</td></tr>
        <tr><td><b>Sends</b></td>
          <td>${fmt(rows.reduce((a,r)=>a+r.wood,0))}</td>
          <td>${fmt(rows.reduce((a,r)=>a+r.stone,0))}</td>
          <td>${fmt(rows.reduce((a,r)=>a+r.iron,0))}</td>
        </tr>
      </table>
      </div>
      <button class="rbpro-btn" onclick="window._rbShowClusters()">📊 ${L.clusters}</button>
      <button class="rbpro-btn" onclick="window._rbShowResult()">📋 ${L.results}</button>
    </div>
    <div class="rbpro-scroll" style="max-height:460px;overflow-y:auto">
    <table class="rbpro-table" id="rbpro_sendtable">
      <tr>
        <th>#</th>
        <th>${L.source}</th><th>${L.target}</th>
        <th>${L.distance}</th><th>Total</th>
        <th>🪵</th><th>🪨</th><th>⚙</th>
        <th></th>
      </tr>`;

    rows.forEach((r, i) => {
        const rowId = "rbpro_row_" + i;
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

    window._rbData = { rows, clusterStats, villages, incoming, clusters, postState };

    // FIX: addEventListener instead of window.onkeydown (no more game handler override)
    if (window._rbKeyHandler) window.removeEventListener("keydown", window._rbKeyHandler);
    window._rbKeyHandler = e => {
        if (e.key === "Enter") {
            const first = document.querySelector(".rbpro-btn-send:not([disabled])");
            if (first) first.click();
        }
    };
    window.addEventListener("keydown", window._rbKeyHandler);
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
    const { villages, postState } = window._rbData;  // FIX: use precomputed postState
    let h = `<div style="max-height:600px;overflow-y:auto"><table class="rbpro-table">
      <tr><th>Village</th><th>Pts</th><th>Priority</th><th>🪵 after</th><th>🪨 after</th><th>⚙ after</th><th>WH cap</th></tr>`;

    villages.forEach(v => {
        const ps  = postState.get(v.id) || {w:0,s:0,fe:0};
        const w = ps.w, s = ps.s, fe = ps.fe;
        const pri      = getVillagePriority(v);
        const priColor = pri === "small" ? "#4eff4e" : pri === "builtin" ? "#ff9944" : "inherit";
        h += `<tr>
          <td><a class="rbpro-link" href="${urlBase}info_village&id=${v.id}">${v.coord}</a></td>
          <td>${fmt(v.points)}</td>
          <td style="color:${priColor}">${pri}</td>
          <td style="background:${w  < 0?"#6a0000":"inherit"}">${fmt(Math.max(0,w))}</td>
          <td style="background:${s  < 0?"#6a0000":"inherit"}">${fmt(Math.max(0,s))}</td>
          <td style="background:${fe < 0?"#6a0000":"inherit"}">${fmt(Math.max(0,fe))}</td>
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
UI.SuccessMessage("ResourceBalancer PRO v2 loaded — configure & click Start", 2000);
