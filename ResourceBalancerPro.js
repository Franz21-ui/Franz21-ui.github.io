// ╔══════════════════════════════════════════════════════════════════════════╗
// ║       ResourceBalancer PRO — Tribal Wars  v2.2  (stämme.de)             ║
// ║  Shinko to Kuma (send logic) + Madalin (k-means) — optimized merge      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

if (window._rbProRunning) { document.getElementById("rbpro_container")?.remove(); }
window._rbProRunning = true;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. LANGUAGE
// ═══════════════════════════════════════════════════════════════════════════════
const LANG_MAP = {
    en_DK: { title:"Resource Balancer PRO", source:"Source", target:"Target",
              distance:"Dist", wood:"Wood", stone:"Clay", iron:"Iron", send:"Send",
              results:"Results", settings:"Settings", start:"Start",
              merchants:"Reserve merchants", constrTime:"Construction time [h]",
              avgFactor:"Average factor [0–1]", nrClusters:"Nr clusters",
              maxConstr:"AM: auto-max hours", lowPoints:"Small village below (pts)",
              highPoints:"Built-out above (pts)", highFarm:"Built-out above (pop)",
              builtPct:"WH% built-out", needsPct:"WH% small/priority",
              saveBtn:"Save", done:"Done!", progress:"Loading…",
              saved:"Saved", by:"ResourceBalancer PRO v2.2", clusters:"Clusters" },
    de_DE: { title:"Ressourcen-Ausgleich PRO", source:"Von", target:"Nach",
              distance:"Dist", wood:"Holz", stone:"Lehm", iron:"Eisen", send:"Senden",
              results:"Ergebnisse", settings:"Einstellungen", start:"Start",
              merchants:"Reserve-Händler", constrTime:"Bauzeit [h]",
              avgFactor:"Ausgleichsfaktor [0–1]", nrClusters:"Anzahl Cluster",
              maxConstr:"AM: Auto-Max Stunden", lowPoints:"Kleindorf unter (Punkte)",
              highPoints:"Ausgebaut ab (Punkte)", highFarm:"Ausgebaut ab (Bev.)",
              builtPct:"WH% ausgebaute Dörfer", needsPct:"WH% kleine Dörfer",
              saveBtn:"Speichern", done:"Fertig!", progress:"Lade…",
              saved:"Gespeichert", by:"ResourceBalancer PRO v2.2", clusters:"Cluster" },
    ro_RO: { title:"Echilibrare Resurse PRO", source:"Origine", target:"Dest",
              distance:"Dist", wood:"Lemn", stone:"Argila", iron:"Fier", send:"Trimite",
              results:"Rezultate", settings:"Setari", start:"Start",
              merchants:"Comercianti rezerva", constrTime:"Timp constructie [h]",
              avgFactor:"Factor mediu [0–1]", nrClusters:"Nr clustere",
              maxConstr:"AM: max auto ore", lowPoints:"Sat mic sub (puncte)",
              highPoints:"Finalizat peste (puncte)", highFarm:"Finalizat peste (pop)",
              builtPct:"% depozit finalizat", needsPct:"% depozit mic",
              saveBtn:"Salvare", done:"Gata!", progress:"Incarcare…",
              saved:"Salvat", by:"ResourceBalancer PRO v2.2", clusters:"Clustere" },
};
const L = LANG_MAP[game_data.locale] || LANG_MAP.en_DK;

// ═══════════════════════════════════════════════════════════════════════════════
// 2. THEME
// ═══════════════════════════════════════════════════════════════════════════════
const THEMES = {
    dark:  { bg:"#2B193D", hd:"#2C365E", tb:"#484D6D", in:"#4B8F8C", br:"#C5979D", tx:"#E0E0E0", ip:"#000000" },
    light: { bg:"#F4E4BC", hd:"#c6a768", tb:"#fff5da", in:"#e8d5a0", br:"#803000", tx:"#3a1a00", ip:"#ffffff" },
    gray:  { bg:"#32353b",  hd:"#202225", tb:"#36393f", in:"#5b5f66", br:"#40D0E0", tx:"#ffffff",  ip:"#111111" },
};
let T = THEMES[localStorage.getItem("rbpro_theme") || "dark"];

const CSS = () => `<style id="rbpro_css">
.rbc{position:fixed;top:4px;left:2vw;width:96vw;background:${T.bg};border:2px solid ${T.br};
 border-radius:6px;color:${T.tx};font-family:Arial,sans-serif;font-size:13px;
 z-index:99999;display:flex;flex-direction:column;max-height:92vh}
.rbh{background:${T.hd};padding:8px 10px;border-radius:4px 4px 0 0;display:flex;
 align-items:center;justify-content:space-between;cursor:move;flex-shrink:0}
.rbh h2{margin:0;font-size:14px;color:${T.tx}}
.rbb{padding:8px;overflow-y:auto;flex:1;min-height:0;-webkit-overflow-scrolling:touch}
.rbf{background:${T.hd};padding:4px 10px;border-radius:0 0 4px 4px;font-size:11px;color:${T.tx};opacity:.7;flex-shrink:0}
.rbs{overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%}
.rbt{width:100%;border-collapse:collapse;margin:4px 0;min-width:260px}
.rbt td,.rbt th{padding:4px 6px;border:1px solid ${T.br};white-space:nowrap}
.rbt tr:nth-child(even){background:${T.tb}} .rbt tr:nth-child(odd){background:${T.in}}
.rbt th{background:${T.hd};color:${T.tx}}
.rbcfg{width:100%}
.rbch{background:${T.hd};color:${T.tx};padding:5px 8px;font-weight:bold;
 border:1px solid ${T.br};margin-bottom:1px}
.rbcr{display:flex;flex-wrap:wrap;align-items:center;border:1px solid ${T.br};
 border-top:none;padding:4px 8px;gap:6px;background:${T.in}}
.rbcr:nth-child(even){background:${T.tb}}
.rbcl{flex:1 1 150px;font-size:12px} .rbcc{flex:0 0 auto}
.rbi{background:${T.ip};color:${T.tx};border:1px solid ${T.br};padding:5px 7px;
 width:95px;border-radius:3px;font-size:13px;min-height:34px;box-sizing:border-box}
input[type=checkbox].rbck{width:18px;height:18px;cursor:pointer}
.rbbtn{background:${T.hd};color:${T.tx};border:1px solid ${T.br};padding:7px 12px;
 border-radius:4px;cursor:pointer;margin:3px;font-size:13px;min-height:36px;touch-action:manipulation}
.rbbtn:hover{background:${T.tb}}
.rbsend{background:#1a4a1a;color:#aaffaa;border:1px solid #2d6e2d;padding:6px 10px;
 border-radius:3px;cursor:pointer;min-height:34px;font-size:13px;touch-action:manipulation}
.rbsend:hover{background:#2d6e2d}
.rbpb{width:100%;height:12px;background:${T.ip};border-radius:6px;margin:5px 0}
.rbp{height:12px;background:#4CAF50;border-radius:6px;transition:width .2s}
.rbsec{margin:6px 0;padding:6px;background:${T.tb};border-radius:4px}
a.rbl{color:${T.br}}
@media(min-width:600px){.rbc{width:52%;min-width:400px;top:50px;left:24%}.rbcl{flex-basis:180px}}
</style>`;

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
const SETTINGS_KEY = "rbpro_v2_" + game_data.world;
const DEFAULTS = {
    reserveMerchants: 0,  constructionHours: 0, averageFactor: 1.0,
    nrClusters: 1,        merchantCapacity: 1000, maxConstruction: false,
    lowPoints: 3000,      highPoints: 9000,       highFarm: 24000,
    builtOutPct: 0.25,    needsMorePct: 0.85,
};
let CFG = (() => {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
    catch { return {...DEFAULTS}; }
})();
const saveCFG = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(CFG));

// ═══════════════════════════════════════════════════════════════════════════════
// 4. HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const fmt   = n => new Intl.NumberFormat().format(Math.round(n));
const pNum  = s => parseInt(String(s ?? "").replace(/[.\s]/g, "").replace(",", ""), 10);

const _xy = new Map();
const xy  = coord => {
    if (!_xy.has(coord)) { const p = coord.split("|"); _xy.set(coord, [+p[0], +p[1]]); }
    return _xy.get(coord);
};
const dist     = (a, b) => { const [x1,y1]=xy(a),[x2,y2]=xy(b); return Math.hypot(x1-x2,y1-y2); };
const padCoord = (x, y) => `${Math.round(x)}`.padStart(3,"0")+"|"+`${Math.round(y)}`.padStart(3,"0");

// Single unified fetch helper — uses jQuery (proven on stämme.de, handles cookies)
const isSitter = game_data.player.sitter > 0;
const urlBase  = game_data.link_base_pure;
const sitParam = isSitter ? `t=${game_data.player.id}&` : "";

const twGet = url => new Promise((ok, fail) => $.get(url, ok).fail(fail));

// Build URL: sitParam before extra params so sitter mode works
const twUrl = (screen, extra = "") =>
    `game.php?${sitParam}screen=${screen}${extra ? "&"+extra : ""}`;

// Parse all pages — tries page=-1 first (single request). If TW returns pagination,
// fetches remaining pages in PARALLEL instead of sequentially.
async function fetchAllRows(screen, extra = "") {
    const singleUrl = twUrl(screen, (extra ? extra+"&" : "") + "page=-1");
    const html0 = await twGet(singleUrl);
    const doc0  = new DOMParser().parseFromString(html0, "text/html");

    // Check if server returned a pagination select (page=-1 not supported here)
    const pageSelect = doc0.querySelector("select.pagination, .paged-nav-item")
                    ?.closest("tr,div")?.querySelector("select");

    if (!pageSelect) {
        // page=-1 worked — all rows in one shot
        return [doc0];
    }

    // Fetch remaining pages in parallel (much faster than 220ms-throttled sequential)
    const pageValues = Array.from(pageSelect.options)
        .map(o => o.value).filter(v => v !== "-1");
    const rest = await Promise.all(
        pageValues.map(p => twGet(twUrl(screen, (extra ? extra+"&" : "") + "page="+p))
            .then(h => new DOMParser().parseFromString(h, "text/html")))
    );
    return rest;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. DATA FETCHING  (production + incoming fetched in PARALLEL)
// ═══════════════════════════════════════════════════════════════════════════════

// Column layout of overview_villages&mode=prod (verified against Shinko's script):
//  [0] village name (quickedit-vn)  [1] points  [2] resources (.wood/.stone/.iron)
//  [3] warehouse capacity           [4] market  [5] farm population
function parseProductionRow(row) {
    const qe = row.querySelector(".quickedit-vn");
    if (!qe) return null;
    const coordM = qe.textContent.match(/\d+\|\d+/);
    if (!coordM) return null;
    const coord = coordM[0];
    const id    = qe.getAttribute("data-id");
    if (!id) return null;

    const wood  = pNum(row.querySelector(".wood")?.textContent);
    const stone = pNum(row.querySelector(".stone")?.textContent);
    const iron  = pNum(row.querySelector(".iron")?.textContent);
    if (isNaN(wood) || isNaN(stone) || isNaN(iron)) return null;

    const mLink  = row.querySelector("a[href*='market']");
    const mText  = mLink?.textContent.trim() ?? "0/0";
    const merch  = parseInt(mText) || 0;        // "3/5" → 3

    // Correct indices per Shinko's verified parsing:
    const points = pNum(row.children[1]?.textContent) || 0;
    const cap    = pNum(row.children[3]?.textContent) || 1000;
    const farmTx = row.children[5]?.textContent.trim() ?? "0/1";
    const farmCur= parseInt(farmTx) || 0;
    const farmMax= parseInt(farmTx.split("/")[1]) || 1;

    return { coord, id, name: qe.textContent.trim(),
             wood, stone, iron, merchants: merch,
             capacity: cap, points, farmUsed: farmCur, farmTotal: farmMax };
}

async function fetchProduction() {
    const docs = await fetchAllRows("overview_villages", "mode=prod");
    const villages = [], farmUsage = new Map();
    for (const doc of docs) {
        doc.querySelectorAll(".row_a, .row_b").forEach(row => {
            const v = parseProductionRow(row);
            if (v) {
                villages.push(v);
                farmUsage.set(v.coord, v.farmUsed / Math.max(1, v.farmTotal));
            }
        });
    }
    return { villages, farmUsage };
}

async function fetchIncoming() {
    const docs = await fetchAllRows("overview_villages", "mode=trader&type=inc");
    const incoming = new Map();
    for (const doc of docs) {
        doc.querySelectorAll(".row_a, .row_b").forEach(row => {
            try {
                // Desktop: coord in children[4], mobile: children[3] (second match)
                const cell = row.children[4] ?? row.children[3];
                const all  = cell?.textContent.match(/\d+\|\d+/g) ?? [];
                const coord = all.length >= 2 ? all[1] : all[0];
                if (!coord) return;

                const w  = pNum($(row).find(".wood").closest("td").text())  || 0;
                const s  = pNum($(row).find(".stone").closest("td").text()) || 0;
                const fe = pNum($(row).find(".iron").closest("td").text())  || 0;

                const cur = incoming.get(coord) ?? { wood:0, stone:0, iron:0 };
                cur.wood += w; cur.stone += s; cur.iron += fe;
                incoming.set(coord, cur);
            } catch(_) {}
        });
    }
    return incoming;
}

// ─── Account Manager (optional — only runs when constructionHours > 0 or maxConstruction) ───

async function fetchAMData(farmUsage) {
    if (!game_data.features?.AccountManager?.active) return new Map();

    // Fetch AM templates + buildings in parallel
    const [amDocs, bldDocs, constants] = await Promise.all([
        fetchAllRows("am_village"),
        fetchAllRows("overview_villages", "mode=buildings"),
        getbuildingConstants(),
    ]);

    // Parse coordMap + templates
    const coordMap = new Map(), templates = new Map();
    for (const doc of amDocs) {
        doc.querySelectorAll(".row_a, .row_b").forEach(row => {
            try {
                const coord = row.children[0]?.textContent.match(/\d+\|\d+/)?.[0];
                const tpl   = row.children[1]?.textContent.trim();
                if (coord && tpl) { coordMap.set(coord, tpl); templates.set(tpl, null); }
            } catch(_) {}
        });
    }

    // Parse template queues (parallel fetch per template)
    const tplNames = [...templates.keys()];
    const tplData  = await Promise.all(tplNames.map(async name => {
        // find option value by name match
        const sel  = amDocs[0]?.querySelector("select[name='template']");
        const opt  = Array.from(sel?.options ?? []).find(o =>
            o.textContent.replace(/[\n\t\(\)\w]+/g,"").trim() === "" ? false :
            o.textContent.replace(/[\n\t]/g,"").replace(/\(\w+\)/,"").trim() === name
        );
        if (!opt) return [name, []];
        const doc  = new DOMParser().parseFromString(
            await twGet(twUrl("am_village", `mode=queue&template=${opt.value}`)), "text/html");
        const rows = doc.querySelectorAll(".sortable_row");
        return [name, Array.from(rows).map(r => ({
            name: r.getAttribute("data-building"),
            level: parseInt($(r).find(".level_absolute").text().match(/\d+/)?.[0] || "0"),
        }))];
    }));
    tplData.forEach(([n, items]) => templates.set(n, items));

    // Parse buildings
    const bld = new Map();
    for (const doc of bldDocs) {
        doc.querySelectorAll(".row_a, .row_b").forEach(row => {
            try {
                const coord = $(row).find(".nowrap").text().match(/\d+\|\d+/)?.[0];
                if (!coord) return;
                const lastQ = $(row).find(".queue_icon img").last().attr("title");
                bld.set(coord + "_time_queued", lastQ ? getFinishedSecs(lastQ) : 0);
                $(row).find(".upgrade_building").each((_, el) => {
                    const cls = el.classList[1];
                    if (cls) bld.set(coord + "_" + cls.replace("b_",""), parseInt(el.textContent) || 0);
                });
            } catch(_) {}
        });
    }

    const hours = CFG.maxConstruction ? 100 : CFG.constructionHours;
    const amMap = new Map();

    for (const [coord, tplName] of coordMap) {
        const tpl = templates.get(tplName);
        if (!tpl) continue;
        let elapsed = bld.get(coord + "_time_queued") || 0;
        const entry = { wood:0, stone:0, iron:0, timeH:0 };

        for (const item of tpl) {
            let curLv = bld.get(coord + "_" + item.name) || 0;
            if (item.level <= curLv) continue;
            for (let j = curLv; j < item.level; j++) {
                const hq  = bld.get(coord + "_main") || 1;
                const res = calcBuildCost(hq, j+1, constants.get(item.name));
                if (!res) continue;
                elapsed += res[0];
                entry.wood += res[1]; entry.stone += res[2]; entry.iron += res[3];
                entry.timeH = elapsed / 3600;
                bld.set(coord + "_" + item.name, j+1);
                if (elapsed > hours * 3600) break;
            }
            if (elapsed > hours * 3600) break;
        }
        if (entry.wood + entry.stone + entry.iron > 0) amMap.set(coord, entry);
    }
    return amMap;
}

async function getbuildingConstants() {
    const key = game_data.world + "_rbpro_bc2";
    const cached = localStorage.getItem(key);
    if (cached) return new Map(JSON.parse(cached));
    const html = await twGet("/interface.php?func=get_building_info");
    const doc  = new DOMParser().parseFromString(html, "text/xml");
    const map  = new Map();
    doc.querySelectorAll("config > *").forEach(el => {
        map.set(el.tagName.toLowerCase(), {
            wood: +el.querySelector("wood")?.textContent,               stone: +el.querySelector("stone")?.textContent,
            iron: +el.querySelector("iron")?.textContent,
            wood_factor:  +el.querySelector("wood_factor")?.textContent,
            stone_factor: +el.querySelector("stone_factor")?.textContent,
            iron_factor:  +el.querySelector("iron_factor")?.textContent,
            build_time:        +el.querySelector("build_time")?.textContent,
            build_time_factor: +el.querySelector("build_time_factor")?.textContent,
        });
    });
    localStorage.setItem(key, JSON.stringify([...map]));
    return map;
}

const HQ = {1:1,2:1,3:0.112292,4:0.289555,5:0.46113,6:0.606372,7:0.723059,8:0.815935,
    9:0.889947,10:0.948408,11:0.994718,12:1.031,13:1.059231,14:1.080939,15:1.09729,
    16:1.109156,17:1.117308,18:1.122392,19:1.124817,20:1.124917,21:1.123181,22:1.119778,
    23:1.114984,24:1.109038,25:1.102077,26:1.0942,27:1.085601,28:1.076369,29:1.066566,30:1.056291};
function calcBuildCost(hq, lv, c) {
    if (!c || lv > 30) return null;
    const t = Math.round(c.build_time * Math.pow(1.2,lv-1) * Math.pow(1.05,-hq) * (HQ[lv]||1));
    return [t, Math.round(c.wood*Math.pow(c.wood_factor,lv-1)),
               Math.round(c.stone*Math.pow(c.stone_factor,lv-1)),
               Math.round(c.iron*Math.pow(c.iron_factor,lv-1))];
}

function getFinishedSecs(title) {
    try {
        const srv  = document.getElementById("serverDate").textContent.split("/");
        const now  = new Date(`${srv[1]}/${srv[0]}/${srv[2]} ${document.getElementById("serverTime").textContent.trim()}`);
        const todayKey    = lang?.["aea2b0aa9ae1534226518faaefffdaad"]?.replace(" %s","") ?? "Today";
        const tomorrowKey = lang?.["57d28d1b211fddbb7a499ead5bf23079"]?.replace(" %s","") ?? "Tomorrow";
        let dateStr = "";
        if (title.includes(todayKey)) {
            dateStr = `${srv[1]}/${srv[0]}/${srv[2]} ${title.match(/\d+:\d+/)[0]}`;
        } else if (title.includes(tomorrowKey)) {
            const t = new Date(`${srv[1]}/${srv[0]}/${srv[2]}`); t.setDate(t.getDate()+1);
            dateStr = `${String(t.getMonth()+1).padStart(2,"0")}/${String(t.getDate()).padStart(2,"0")}/${t.getFullYear()} ${title.match(/\d+:\d+/)[0]}`;
        } else {
            const m = title.match(/(\d+)\.(\d+)/);
            if (m) dateStr = `${m[2]}/${m[1]}/${srv[2]} ${title.match(/\d+:\d+/)[0]}`;
        }
        return Math.max(0, Math.round((new Date(dateStr) - now) / 1000));
    } catch { return 0; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. K-MEANS++ (6 restarts — sufficient with k-means++ initialization)
// ═══════════════════════════════════════════════════════════════════════════════
function kmeans(pts, k, maxIter=100, restarts=6) {
    if (pts.length <= k) return pts.map(p => ({ center:[...p], points:[p] }));
    let best = null, bestSSE = Infinity;
    for (let r = 0; r < restarts; r++) {
        // k-means++ init
        const centers = [pts[Math.floor(Math.random()*pts.length)].slice()];
        while (centers.length < k) {
            const w = pts.map(p => Math.min(...centers.map(c => (p[0]-c[0])**2+(p[1]-c[1])**2)));
            const sum = w.reduce((a,x)=>a+x,0);
            let r2 = Math.random()*sum, ci = pts.length-1;
            for (let i=0;i<w.length;i++) { r2-=w[i]; if(r2<=0){ci=i;break;} }
            centers.push(pts[ci].slice());
        }
        const cl = centers.map(c => ({ center:[...c], points:[] }));
        let changed=true, it=0;
        while (changed && it++<maxIter) {
            cl.forEach(c=>c.points=[]);
            changed=false;
            for (const p of pts) {
                let bi=0, bd=Infinity;
                for (let i=0;i<k;i++){const d=(p[0]-cl[i].center[0])**2+(p[1]-cl[i].center[1])**2;if(d<bd){bd=d;bi=i;}}
                cl[bi].points.push(p);
            }
            cl.forEach(c => {
                if (!c.points.length) {
                    let worst=null,worstD=-1;
                    for(const oc of cl){if(oc.points.length<=1)continue;for(const p of oc.points){const d=(p[0]-oc.center[0])**2+(p[1]-oc.center[1])**2;if(d>worstD){worstD=d;worst=p;}}}
                    if(worst)c.center=[...worst];
                    return;
                }
                const nx=c.points.reduce((a,p)=>a+p[0],0)/c.points.length;
                const ny=c.points.reduce((a,p)=>a+p[1],0)/c.points.length;
                if(Math.abs(nx-c.center[0])>0.01||Math.abs(ny-c.center[1])>0.01)changed=true;
                c.center=[nx,ny];
            });
        }
        const sse=cl.reduce((a,c)=>a+c.points.reduce((b,p)=>b+(p[0]-c.center[0])**2+(p[1]-c.center[1])**2,0),0);
        if(sse<bestSSE){bestSSE=sse;best=cl;}
    }
    return best;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PRIORITY & CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════
const priority = v =>
    v.farmUsed > CFG.highFarm || v.points > CFG.highPoints ? "builtin" :
    v.points   < CFG.lowPoints                             ? "small"   : "normal";

function targetFor(v, avgW, avgS, avgI) {
    const p = priority(v), c = v.capacity;
    if (p === "small")   return { w:c*CFG.needsMorePct, s:c*CFG.needsMorePct, i:c*CFG.needsMorePct };
    if (p === "builtin") return { w:c*CFG.builtOutPct,  s:c*CFG.builtOutPct,  i:c*CFG.builtOutPct  };
    return {
        w: Math.min(avgW*CFG.averageFactor, c*CFG.needsMorePct),
        s: Math.min(avgS*CFG.averageFactor, c*CFG.needsMorePct),
        i: Math.min(avgI*CFG.averageFactor, c*CFG.needsMorePct),
    };
}

function calcLaunches(byCluster, incoming, amMap) {
    const launches = [], stats = [];

    for (const cluster of byCluster) {
        const eff = cluster.map(v => {
            const inc = incoming.get(v.coord) ?? {wood:0,stone:0,iron:0};
            const am  = amMap.get(v.coord)    ?? {wood:0,stone:0,iron:0};
            return { ...v,
                effW: Math.min(v.wood+inc.wood, v.capacity),
                effS: Math.min(v.stone+inc.stone, v.capacity),
                effI: Math.min(v.iron+inc.iron, v.capacity),
                amW: am.wood, amS: am.stone, amI: am.iron,
            };
        });

        const n = eff.length;
        const avgW = eff.reduce((a,v)=>a+v.effW,0)/n;
        const avgS = eff.reduce((a,v)=>a+v.effS,0)/n;
        const avgI = eff.reduce((a,v)=>a+v.effI,0)/n;

        const senders=[], receivers=[];
        for (const v of eff) {
            const tgt   = targetFor(v, avgW, avgS, avgI);
            const avail = Math.max(0, v.merchants - CFG.reserveMerchants) * CFG.merchantCapacity;
            const tW = Math.round(tgt.w)+v.amW, tS = Math.round(tgt.s)+v.amS, tI = Math.round(tgt.i)+v.amI;

            const surpW = Math.max(0, v.effW-tW), surpS = Math.max(0, v.effS-tS), surpI = Math.max(0, v.effI-tI);
            if (surpW+surpS+surpI > 0) {
                const sc = avail < surpW+surpS+surpI ? avail/(surpW+surpS+surpI) : 1;
                senders.push({...v, sendW:Math.floor(surpW*sc), sendS:Math.floor(surpS*sc), sendI:Math.floor(surpI*sc)});
            }
            const wh95 = v.capacity*0.95;
            const nW = Math.min(Math.max(0,tW-v.effW), Math.max(0,wh95-v.effW));
            const nS = Math.min(Math.max(0,tS-v.effS), Math.max(0,wh95-v.effS));
            const nI = Math.min(Math.max(0,tI-v.effI), Math.max(0,wh95-v.effI));
            if (nW+nS+nI > 0) receivers.push({...v, needW:nW, needS:nS, needI:nI});
        }

        // Normalize receivers to available supply
        const [supW,supS,supI] = [senders,senders,senders].map((s,r) => s.reduce((a,x)=>a+[x.sendW,x.sendS,x.sendI][r],0));
        const [demW,demS,demI] = [receivers,receivers,receivers].map((r2,r)=>r2.reduce((a,x)=>a+[x.needW,x.needS,x.needI][r],0));
        const nW=demW>supW&&supW>0?supW/demW:1, nS=demS>supS&&supS>0?supS/demS:1, nI=demI>supI&&supI>0?supI/demI:1;
        receivers.forEach(r=>{r.needW=Math.floor(r.needW*nW);r.needS=Math.floor(r.needS*nS);r.needI=Math.floor(r.needI*nI);});

        const minSend = CFG.merchantCapacity >= 1500 ? 1200 : 700;

        for (const rec of receivers) {
            // Sort senders by distance to this receiver (precomputed once per receiver)
            const [rx,ry] = xy(rec.coord);
            senders.sort((a,b)=>{const[ax,ay]=xy(a.coord),[bx,by]=xy(b.coord);return Math.hypot(ax-rx,ay-ry)-Math.hypot(bx-rx,by-ry);});
            let remW=rec.needW, remS=rec.needS, remI=rec.needI;
            for (const sen of senders) {
                if (remW+remS+remI<=0||sen.sendW+sen.sendS+sen.sendI<=0||sen.coord===rec.coord) continue;
                const gW=Math.min(remW,sen.sendW), gS=Math.min(remS,sen.sendS), gI=Math.min(remI,sen.sendI);
                let aW=gW, aS=gS, aI=gI;
                const rem=(aW+aS+aI)%CFG.merchantCapacity;
                if (rem>0&&rem<minSend) { const mx=Math.max(aW,aS,aI); if(aW===mx)aW-=rem;else if(aS===mx)aS-=rem;else aI-=rem; }
                if (aW+aS+aI<minSend) continue;
                launches.push({ coord_origin:sen.coord, id_origin:sen.id, name_origin:sen.name,
                                 coord_dest:rec.coord,   id_dest:rec.id,   name_dest:rec.name,
                                 wood:aW, stone:aS, iron:aI, total:aW+aS+aI, distance:dist(sen.coord,rec.coord) });
                sen.sendW-=gW; sen.sendS-=gS; sen.sendI-=gI;
                remW-=gW; remS-=gS; remI-=gI;
            }
        }

        stats.push({ n, avgW, avgS, avgI, supW, supS, supI, demW, demS, demI,
            center: cluster.reduce((a,v)=>{const[x,y]=xy(v.coord);return{x:a.x+x/n,y:a.y+y/n};},{x:0,y:0}),
            maxDist: launches.filter(l=>cluster.some(v=>v.coord===l.coord_origin)).reduce((a,l)=>Math.max(a,l.distance),0) });
    }
    return { launches, stats };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. UI
// ═══════════════════════════════════════════════════════════════════════════════
function buildUI() {
    const specialCap = ["pt_PT","de_DE"].includes(game_data.locale);
    const F = v => `<div class="rbcr"><span class="rbcl">`; // shorthand
    $("#rbpro_container").remove();
    const html = `${CSS()}
<div id="rbpro_container" class="rbc">
 <div class="rbh" id="rbpro_drag">
  <h2>&#9878; ${L.title}</h2>
  <span>
   <button class="rbbtn" onclick="document.getElementById('rbpro_tp').style.display=(document.getElementById('rbpro_tp').style.display=='none'?'':'none')">&#127912;</button>
   <button class="rbbtn" onclick="document.getElementById('rbpro_body').style.display=(document.getElementById('rbpro_body').style.display=='none'?'':'none')">&#8211;</button>
   <button class="rbbtn" onclick="document.getElementById('rbpro_container').remove();window._rbProRunning=false;if(window._rbKH)window.removeEventListener('keydown',window._rbKH)">&#10005;</button>
  </span>
 </div>
 <div id="rbpro_tp" style="display:none;padding:6px;background:${T.tb}">
  <b>Theme:</b>
  <button class="rbbtn" onclick="window._rbTheme('dark')">Dark</button>
  <button class="rbbtn" onclick="window._rbTheme('light')">Classic</button>
  <button class="rbbtn" onclick="window._rbTheme('gray')">Gray</button>
 </div>
 <div id="rbpro_body" class="rbb">
  <div class="rbsec">
   <div class="rbcfg">
    <div class="rbch">${L.settings}</div>
    <div class="rbcr"><span class="rbcl">${L.merchants}</span><span class="rbcc"><input id="c_rm" class="rbi" type="number" value="${CFG.reserveMerchants}" min="0"></span></div>
    <div class="rbcr"><span class="rbcl">${L.constrTime}</span><span class="rbcc"><input id="c_ch" class="rbi" type="number" value="${CFG.constructionHours}" min="0" max="100"></span></div>
    <div class="rbcr"><span class="rbcl">${L.avgFactor}</span><span class="rbcc"><input id="c_af" class="rbi" type="number" value="${CFG.averageFactor}" min="0" max="1" step="0.05"></span></div>
    <div class="rbcr"><span class="rbcl">${L.nrClusters}</span><span class="rbcc"><input id="c_nc" class="rbi" type="number" value="${CFG.nrClusters}" min="1"></span></div>
    ${specialCap ? `<div class="rbcr"><span class="rbcl">Händlerkapazität</span><span class="rbcc"><input id="c_mc" class="rbi" type="number" value="${CFG.merchantCapacity}" min="1000" max="2000"></span></div>` : `<input type="hidden" id="c_mc" value="${CFG.merchantCapacity}">`}
    <div class="rbcr"><span class="rbcl">${L.maxConstr}</span><span class="rbcc"><input id="c_mx" class="rbck" type="checkbox" ${CFG.maxConstruction?"checked":""}></span></div>
    <div class="rbch" style="margin-top:4px">Prioritäten</div>
    <div class="rbcr"><span class="rbcl">${L.lowPoints}</span><span class="rbcc"><input id="c_lp" class="rbi" type="number" value="${CFG.lowPoints}"></span></div>
    <div class="rbcr"><span class="rbcl">${L.highPoints}</span><span class="rbcc"><input id="c_hp" class="rbi" type="number" value="${CFG.highPoints}"></span></div>
    <div class="rbcr"><span class="rbcl">${L.highFarm}</span><span class="rbcc"><input id="c_hf" class="rbi" type="number" value="${CFG.highFarm}"></span></div>
    <div class="rbcr"><span class="rbcl">${L.builtPct}</span><span class="rbcc"><input id="c_bp" class="rbi" type="number" value="${CFG.builtOutPct}" min="0" max="1" step="0.05"></span></div>
    <div class="rbcr"><span class="rbcl">${L.needsPct}</span><span class="rbcc"><input id="c_np" class="rbi" type="number" value="${CFG.needsMorePct}" min="0" max="1" step="0.05"></span></div>
   </div>
   <button class="rbbtn" style="margin-top:5px" onclick="window._rbSave()">${L.saveBtn}</button>
  </div>
  <center><button class="rbbtn" style="font-size:15px;padding:8px 26px" onclick="window._rbRun()">&#9654; ${L.start}</button></center>
  <div id="rbpro_prog" style="display:none">
   <div class="rbpb"><div class="rbp" id="rbpro_bar" style="width:0%"></div></div>
   <div id="rbpro_stat" style="font-size:11px;color:${T.tx}">${L.progress}</div>
  </div>
  <div id="rbpro_res" style="display:none;margin-top:6px"></div>
 </div>
 <div class="rbf">${L.by}</div>
</div>`;
    const $h = $("#contentContainer,#mobileContent").first();
    ($h.length ? $h : $("body")).prepend(html);
    try { $("#rbpro_container").draggable({ handle:"#rbpro_drag" }); } catch(_) {}
}

window._rbTheme = name => {
    T = THEMES[name] || THEMES.dark;
    localStorage.setItem("rbpro_theme", name);
    document.getElementById("rbpro_css")?.remove();
    $("head").append($(CSS()));
};

window._rbSave = () => {
    const g = id => document.getElementById(id);
    CFG.reserveMerchants  = parseInt(g("c_rm").value)  || 0;
    CFG.constructionHours = parseInt(g("c_ch").value)  || 0;
    CFG.averageFactor     = parseFloat(g("c_af").value) || 1;
    CFG.nrClusters        = parseInt(g("c_nc").value)  || 1;
    CFG.merchantCapacity  = parseInt(g("c_mc")?.value) || 1000;
    CFG.maxConstruction   = g("c_mx").checked;
    CFG.lowPoints         = parseInt(g("c_lp").value)  || 3000;
    CFG.highPoints        = parseInt(g("c_hp").value)  || 9000;
    CFG.highFarm          = parseInt(g("c_hf").value)  || 24000;
    CFG.builtOutPct       = parseFloat(g("c_bp").value) || 0.25;
    CFG.needsMorePct      = parseFloat(g("c_np").value) || 0.85;
    saveCFG();
    UI.SuccessMessage(L.saved, 1200);
};

window._rbRun = async () => {
    window._rbSave();
    const bar  = document.getElementById("rbpro_bar");
    const stat = document.getElementById("rbpro_stat");
    document.getElementById("rbpro_prog").style.display = "";
    const prog = (p, m) => { bar.style.width=p+"%"; stat.textContent=m; };

    try {
        prog(5, "Daten laden…");
        // PARALLEL fetch — production + incoming at the same time
        const [{ villages, farmUsage }, incoming] = await Promise.all([
            fetchProduction(),
            fetchIncoming(),
        ]);

        if (!villages.length) {
            stat.textContent = "Keine Dörfer gefunden — Skript auf der Übersichtsseite starten.";
            return;
        }

        // AM only when actually configured
        let amMap = new Map();
        const needAM = CFG.constructionHours > 0 || CFG.maxConstruction;
        if (needAM) {
            prog(35, "Account Manager Daten…");
            try { amMap = await fetchAMData(farmUsage); } catch(_) {}
        }

        prog(55, "Cluster & Berechnung…");
        const k = Math.max(1, Math.min(CFG.nrClusters, villages.length));
        const clusters = kmeans(villages.map(v => xy(v.coord)), k);

        // Build village-by-coord map for O(1) lookup
        const byCoord = new Map(villages.map(v => [v.coord, v]));
        const byCluster = clusters.map(c =>
            c.points.map(p => byCoord.get(padCoord(p[0],p[1]))).filter(Boolean)
        );

        const { launches, stats } = calcLaunches(byCluster, incoming, amMap);

        prog(90, "Ergebnisse…");
        renderResults(launches, stats, villages, incoming);
        prog(100, L.done);

    } catch(err) {
        stat.textContent = "Fehler: " + err.message;
        console.error("[RBPro]", err);
    }
};

// ─── Send (uses TribalWars.post — TW internal API, handles CSRF automatically) ──
window._rbSend = (srcId, dstId, w, s, i, rowId) => {
    const row = document.getElementById(rowId);
    if (row) row.style.opacity = "0.4";
    TribalWars.post("market",
        { ajaxaction:"map_send", village:srcId },
        { target_id:dstId, wood:w, stone:s, iron:i },
        r  => { row?.remove(); UI.SuccessMessage(r?.message||L.done, 700); },
        e  => { if(row)row.style.opacity="1"; UI.ErrorMessage(e?.message||"Fehler",3000); }
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. RENDER
// ═══════════════════════════════════════════════════════════════════════════════
function renderResults(launches, stats, villages, incoming) {
    // Merge duplicate (src→dst) pairs
    const merged = new Map();
    for (const l of launches) {
        const k = l.id_origin+"_"+l.id_dest;
        if (!merged.has(k)) merged.set(k, {...l});
        else { const e=merged.get(k); e.wood+=l.wood; e.stone+=l.stone; e.iron+=l.iron; e.total+=l.total; }
    }
    const rows = [...merged.values()].sort((a,b) => a.distance-b.distance);

    // Precompute post-transfer state
    const post = new Map(villages.map(v => {
        const inc = incoming.get(v.coord) ?? {wood:0,stone:0,iron:0};
        return [v.id, { w:v.wood+inc.wood, s:v.stone+inc.stone, fe:v.iron+inc.iron }];
    }));
    rows.forEach(r => {
        if (post.has(r.id_origin)) { const p=post.get(r.id_origin); p.w-=r.wood; p.s-=r.stone; p.fe-=r.iron; }
        if (post.has(r.id_dest))   { const p=post.get(r.id_dest);   p.w+=r.wood; p.s+=r.stone; p.fe+=r.iron; }
    });

    const n=villages.length;
    const [tW,tS,tI] = [villages.reduce((a,v)=>a+v.wood,0), villages.reduce((a,v)=>a+v.stone,0), villages.reduce((a,v)=>a+v.iron,0)];

    let h = `
<div class="rbsec"><div class="rbs"><table class="rbt">
 <tr><th></th><th>&#x1F332; Holz</th><th>&#x1F9F1; Lehm</th><th>&#x2699; Eisen</th></tr>
 <tr><td>Gesamt</td><td>${fmt(tW)}</td><td>${fmt(tS)}</td><td>${fmt(tI)}</td></tr>
 <tr><td>&#x00D8;/Dorf</td><td>${fmt(tW/n)}</td><td>${fmt(tS/n)}</td><td>${fmt(tI/n)}</td></tr>
 <tr><td>&#128666; (${rows.length})</td><td>${fmt(rows.reduce((a,r)=>a+r.wood,0))}</td><td>${fmt(rows.reduce((a,r)=>a+r.stone,0))}</td><td>${fmt(rows.reduce((a,r)=>a+r.iron,0))}</td></tr>
</table></div>
<button class="rbbtn" onclick="window._rbCluster()">&#128202; ${L.clusters}</button>
<button class="rbbtn" onclick="window._rbDetail()">&#128203; ${L.results}</button>
</div>
<div class="rbs" style="max-height:480px;overflow-y:auto">
<table class="rbt" id="rbt_send">
 <tr><th>#</th><th>${L.source}</th><th>${L.target}</th><th>${L.distance}</th><th>&#x1F332;</th><th>&#x1F9F1;</th><th>&#x2699;</th><th></th></tr>`;

    rows.forEach((r,i) => {
        const rid = "rbr_"+i;
        h += `<tr id="${rid}">
 <td>${i+1}</td>
 <td><a class="rbl" href="${urlBase}info_village&id=${r.id_origin}">${r.name_origin}</a></td>
 <td><a class="rbl" href="${urlBase}info_village&id=${r.id_dest}">${r.name_dest}</a></td>
 <td>${r.distance.toFixed(1)}</td>
 <td>${fmt(r.wood)}</td><td>${fmt(r.stone)}</td><td>${fmt(r.iron)}</td>
 <td><button class="rbsend" onclick="window._rbSend('${r.id_origin}','${r.id_dest}',${r.wood},${r.stone},${r.iron},'${rid}')">${L.send}</button></td>
</tr>`;
    });
    h += `</table></div>`;

    const div = document.getElementById("rbpro_res");
    div.innerHTML = h;
    div.style.display = "";
    window._rbState = { rows, stats, villages, post };

    if (window._rbKH) window.removeEventListener("keydown", window._rbKH);
    window._rbKH = e => { if(e.key==="Enter"){ document.querySelector(".rbsend:not([disabled])")?.click(); } };
    window.addEventListener("keydown", window._rbKH);
}

window._rbCluster = () => {
    if (!window._rbState) return;
    let h = `<div style="max-height:550px;overflow-y:auto"><table class="rbt">
<tr><th>#</th><th>Dörfer</th><th>Zentrum</th><th>&#x00D8; H/L/E</th><th>&#220;berschuss H/L/E</th><th>Max Dist</th></tr>`;
    window._rbState.stats.forEach((c,i) =>
        h += `<tr><td>${i+1}</td><td>${c.n}</td><td>${Math.round(c.center.x)}|${Math.round(c.center.y)}</td>
<td>${fmt(c.avgW)}/${fmt(c.avgS)}/${fmt(c.avgI)}</td>
<td>${fmt(c.supW)}/${fmt(c.supS)}/${fmt(c.supI)}</td>
<td>${c.maxDist.toFixed(1)}</td></tr>`);
    Dialog.show("content", h+"</table></div>");
};

window._rbDetail = () => {
    if (!window._rbState) return;
    const { villages, post } = window._rbState;
    let h = `<div style="max-height:550px;overflow-y:auto"><table class="rbt">
<tr><th>Dorf</th><th>Pts</th><th>Prio</th><th>&#x1F332; danach</th><th>&#x1F9F1; danach</th><th>&#x2699; danach</th><th>WH</th></tr>`;
    villages.forEach(v => {
        const p=post.get(v.id)??{w:0,s:0,fe:0}, pri=priority(v);
        const col=pri==="small"?"#4eff4e":pri==="builtin"?"#ff9944":"inherit";
        h+=`<tr>
<td><a class="rbl" href="${urlBase}info_village&id=${v.id}">${v.coord}</a></td>
<td>${fmt(v.points)}</td><td style="color:${col}">${pri}</td>
<td style="background:${p.w<0?"#6a0000":"inherit"}">${fmt(Math.max(0,p.w))}</td>
<td style="background:${p.s<0?"#6a0000":"inherit"}">${fmt(Math.max(0,p.s))}</td>
<td style="background:${p.fe<0?"#6a0000":"inherit"}">${fmt(Math.max(0,p.fe))}</td>
<td>${fmt(v.capacity)}</td></tr>`;
    });
    Dialog.show("content", h+"</table></div>");
};

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════
buildUI();
UI.SuccessMessage("ResourceBalancer PRO v2.2 — Einstellungen prüfen & Start", 2000);
