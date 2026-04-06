// ============================================================
// Ressourcen-Balancer v2.0 -- rebuilt by FarmGod AutoSend style
// Features: Async/Queue, Dry-Run, Blacklist, Truppen-Reservierung,
//           Rollback-Liste, Validierung, Zeitplan, Auto-Restart,
//           Effizienz-Score, Verlaufs-Timeline, FarmGod-Lock
// Sprache: Deutsch
// ============================================================

var RBv2 = {};

// ============================================================
// QUEUE-SYSTEM (identisch zu FarmGod-Architektur)
// ============================================================
RBv2.Queue = (function () {
  if (typeof window.twLib === 'undefined') {
    window.twLib = {
      queues: null,
      init: function () {
        if (this.queues === null) this.queues = this.queueLib.createQueues(5);
      },
      queueLib: {
        maxAttempts: 3,
        Item: function (action, arg, promise) {
          this.action = action; this.arguments = arg;
          this.promise = promise || null; this.attempts = 0;
        },
        Queue: function () {
          this.list = []; this.working = false; this.length = 0;
          this.doNext = function () {
            let item = this.dequeue(); let self = this;
            $[item.action](...item.arguments)
              .done(function () { item.promise && item.promise.resolve.apply(null, arguments); self.start(); })
              .fail(function () {
                item.attempts++;
                if (item.attempts < twLib.queueLib.maxAttempts) { self.enqueue(item, true); }
                else { item.promise && item.promise.reject.apply(null, arguments); }
                self.start();
              });
          };
          this.start = function () { if (this.length) { this.working = true; this.doNext(); } else { this.working = false; } };
          this.dequeue = function () { this.length -= 1; return this.list.shift(); };
          this.enqueue = function (item, front) {
            front ? this.list.unshift(item) : this.list.push(item);
            this.length++;
            if (!this.working) this.start();
          };
        },
        createQueues: function (n) { let a = []; for (let i = 0; i < n; i++) a[i] = new twLib.queueLib.Queue(); return a; },
        addItem: function (item) {
          let min = twLib.queues.map(q => q.length).reduce((n, c) => c < n ? c : n, 0);
          twLib.queues[min].enqueue(item);
        },
        orchestrator: function (type, arg) {
          let p = $.Deferred();
          let item = new twLib.queueLib.Item(type, arg, p);
          twLib.queueLib.addItem(item);
          return p;
        }
      },
      ajax: function () { return twLib.queueLib.orchestrator('ajax', arguments); },
      get:  function () { return twLib.queueLib.orchestrator('get',  arguments); },
      post: function () { return twLib.queueLib.orchestrator('post', arguments); }
    };
    twLib.init();
  }
  return {
    get:  function (url) { return twLib.get(url); },
    ajax: function (opts) { return twLib.ajax(opts); },
    post: function (url, data) { return twLib.post(url, data); }
  };
})();

// ============================================================
// STORAGE -- localStorage wrapper
// ============================================================
RBv2.Storage = {
  key: function (k) { return game_data.world + '_RBv2_' + k; },
  get: function (k) {
    try { return JSON.parse(localStorage.getItem(this.key(k))); } catch (e) { return null; }
  },
  set: function (k, v) { localStorage.setItem(this.key(k), JSON.stringify(v)); },
  del: function (k) { localStorage.removeItem(this.key(k)); }
};

// ============================================================
// ROLLBACK-LISTE
// ============================================================
RBv2.Rollback = {
  add: function (entry) {
    let list = RBv2.Storage.get('rollback') || [];
    entry.timestamp = new Date().toLocaleTimeString();
    list.unshift(entry);
    if (list.length > 50) list = list.slice(0, 50);
    RBv2.Storage.set('rollback', list);
  },
  get: function () { return RBv2.Storage.get('rollback') || []; },
  clear: function () { RBv2.Storage.del('rollback'); }
};

// ============================================================
// VERLAUFS-STATISTIK
// ============================================================
RBv2.History = {
  add: function (entry) {
    let list = RBv2.Storage.get('history') || [];
    entry.timestamp = new Date().toLocaleString();
    list.unshift(entry);
    if (list.length > 20) list = list.slice(0, 20);
    RBv2.Storage.set('history', list);
  },
  get: function () { return RBv2.Storage.get('history') || []; }
};

// ============================================================
// FARMGOD-LOCK -- verhindert gleichzeitigen Betrieb
// ============================================================
RBv2.Lock = {
  isLocked: function () {
    let ts = RBv2.Storage.get('farmgod_lock');
    if (!ts) return false;
    return (Date.now() - ts) < 60000; // 60s Timeout
  },
  set: function () { RBv2.Storage.set('farmgod_lock', Date.now()); },
  clear: function () { RBv2.Storage.del('farmgod_lock'); }
};

// FarmGod setzt diesen Lock wenn er läuft
if (typeof window.FarmGod !== 'undefined') {
  RBv2.Lock.set();
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================
RBv2.Utils = {
  formatNum: function (n) { return new Intl.NumberFormat('de-DE').format(Math.round(n)); },
  calcDist: function (c1, c2) {
    let [x1, y1] = c1.split('|').map(Number);
    let [x2, y2] = c2.split('|').map(Number);
    return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
  },
  colorDarker: function (hex, pct) {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
    let r = parseInt(hex.substr(0,2),16), g = parseInt(hex.substr(2,2),16), b = parseInt(hex.substr(4,2),16);
    const f = (100 + pct) / 100;
    r = Math.min(255, Math.max(0, Math.round(r*f)));
    g = Math.min(255, Math.max(0, Math.round(g*f)));
    b = Math.min(255, Math.max(0, Math.round(b*f)));
    return '#' + [r,g,b].map(v => ('00'+v.toString(16)).slice(-2).toUpperCase()).join('');
  },
  randomColor: function (opacity) {
    let vals = [0,0,0].map(() => Math.floor(Math.random()*255));
    return { color: `rgb(${vals.join(',')})`, colorOpacity: `rgba(${vals.join(',')},${opacity})` };
  },
  getFinishTime: function (timestr) {
    let serverDate = document.getElementById('serverDate').innerText.split('/');
    let serverTime = document.getElementById('serverTime').innerText;
    let date_current = new Date(serverDate[1]+'/'+serverDate[0]+'/'+serverDate[2]+' '+serverTime);
    // Simplified: just return seconds from now -- full impl uses lang keys like original
    return 0;
  }
};

// ============================================================
// SETTINGS -- Standardwerte + Persistenz
// ============================================================
RBv2.Settings = {
  defaults: {
    reserveMerchants: 0,
    constructionTime: 0,
    averageFactor: 1,
    nrClusters: 1,
    merchantCapacity: 1000,
    maxConstruction: false,
    // NEU:
    blacklist: [],           // Koordinaten die ignoriert werden
    whitelist: [],           // Wenn gesetzt: NUR diese Koordinaten
    reserveWood: 0,          // Rohstoff-Reserve pro Dorf (Holz)
    reserveStone: 0,         // Rohstoff-Reserve pro Dorf (Lehm)
    reserveIron: 0,          // Rohstoff-Reserve pro Dorf (Eisen)
    reserveTroops: true,     // Truppenproduktions-Reservierung aktiv
    overflowProtect: true,   // Lager-Overflow-Schutz
    dryRun: true,            // Trockenlauf -- kein echtes Senden
    autoRestart: false,      // Auto-Neustart
    restartMin: 30,          // Neustart frühestens nach X Min
    restartMax: 60,          // Neustart spätestens nach X Min
    scheduleEnabled: false,  // Zeitplan aktiv
    scheduleHours: '08:00,20:00', // Zeitplan Uhrzeiten
    priorityWood: 1,         // Rohstoff-Priorität (1=gleich)
    priorityStone: 1,
    priorityIron: 1,
  },
  load: function () {
    return Object.assign({}, this.defaults, RBv2.Storage.get('settings') || {});
  },
  save: function (s) { RBv2.Storage.set('settings', s); }
};

// ============================================================
// DATENABRUF -- vollständig async, parallel wie FarmGod
// ============================================================
RBv2.Data = {

  // Alle 4 Quellen parallel laden
  loadAll: async function (settings) {
    UI.SuccessMessage('Lade Daten...');
    const [production, incoming, buildings, templates, troops] = await Promise.all([
      RBv2.Data.getProduction(),
      RBv2.Data.getIncoming(),
      RBv2.Data.getBuildings(),
      RBv2.Data.getTemplates(),
      settings.reserveTroops ? RBv2.Data.getTroopNeeds() : Promise.resolve(new Map())
    ]);
    UI.SuccessMessage('Daten geladen!');
    return { production, incoming, buildings, templates, troops };
  },

  // Alle Seiten einer URL laden -- async rekursiv
  loadPages: async function (baseUrl, processor) {
    let firstPage = await $.ajax({ url: baseUrl, method: 'get' });
    const parser = new DOMParser();
    let firstDoc = parser.parseFromString(firstPage, 'text/html');
    let pages = RBv2.Data.extractPages(firstDoc, baseUrl);
    let result = {};
    processor(firstDoc, result);
    for (let url of pages) {
      await new Promise(res => setTimeout(res, 200)); // Rate-Limit
      let data = await $.ajax({ url, method: 'get' });
      let doc = parser.parseFromString(data, 'text/html');
      processor(doc, result);
      UI.SuccessMessage('Seite geladen: ' + url.split('page=')[1]);
    }
    return result;
  },

  extractPages: function (doc, baseUrl) {
    let pages = [];
    let select = $(doc).find('.paged-nav-item').first().closest('td').find('select').first();
    if (select.length > 0) {
      select.find('option').each((i, opt) => { if (i > 0) pages.push(opt.value); });
    } else {
      let navItems = $(doc).find('.paged-nav-item').not('[href*="page=-1"]');
      navItems.each((i, a) => { if (i > 0) pages.push(a.href); });
    }
    return pages;
  },

  // Produktionsübersicht -- NEU: auch Farmauslastung für Truppenreservierung
  getProduction: async function () {
    let url = game_data.link_base_pure + 'overview_villages&mode=prod';
    let list = [];
    let farmUsage = new Map();

    await RBv2.Data.loadPages(url, (doc, _) => {
      let isMobile = $('#mobileHeader').length > 0;
      if (!isMobile) {
        $(doc).find('#combined_table .row_a, #combined_table .row_b').each((i, row) => {
          try {
            let $r = $(row);
            if ($r.find('.bonus_icon_33').length > 0) return; // Bonusdorf ignorieren
            let coord = $r.find('.quickedit-vn').first().text().match(/\d{3}\|\d{3}/)?.[0];
            if (!coord) return;
            let id = $r.find('.quickedit-vn').first().data('id');
            let name = $r.find('.quickedit-label').first().data('text');
            let wood = parseInt($r.find('.wood').text().replace(/\./g, '')) || 0;
            let stone = parseInt($r.find('.stone').text().replace(/\./g, '')) || 0;
            let iron = parseInt($r.find('.iron').text().replace(/\./g, '')) || 0;
            let merchantText = $r.find('a[href*="market"]').text();
            let merchants = parseInt(merchantText.split('/')[0]) || 0;
            let merchantsTotal = parseInt(merchantText.split('/')[1]) || 0;
            let capacity = parseInt($r.children().eq(4).text().replace(/\./g, '')) || 10000;
            let farmText = $r.children().eq(6).text();
            let farmCur = parseInt(farmText.split('/')[0]) || 0;
            let farmMax = parseInt(farmText.split('/')[1]) || 1;
            farmUsage.set(coord, farmCur / farmMax);
            list.push({ coord, id: String(id), name, wood, stone, iron, merchants, merchantsTotal, capacity });
          } catch (e) { console.warn('Produktionsfehler:', e); }
        });
      } else {
        // Mobile-Variante
        $(doc).find('.overview-container-item').each((i, item) => {
          try {
            let $i = $(item);
            let name = $i.find('.quickedit-label').text().trim();
            let coord = name.match(/\d+\|\d+/)?.[0];
            if (!coord) return;
            let id = $i.find('.quickedit-vn').attr('data-id');
            let wood = parseInt($i.find('.mwood').text().replace(/\./g, '')) || 0;
            let stone = parseInt($i.find('.mstone').text().replace(/\./g, '')) || 0;
            let iron = parseInt($i.find('.miron').text().replace(/\./g, '')) || 0;
            let merchants = parseInt($i.find('.vertical_center').text()) || 0;
            let capacity = parseInt($i.find('.ressources').parent().text().replace(/\./g, '')) || 10000;
            list.push({ coord, id: String(id), name, wood, stone, iron, merchants, merchantsTotal: 500, capacity });
          } catch (e) { console.warn('Mobile Produktionsfehler:', e); }
        });
      }
    });

    return { list, farmUsage };
  },

  // Eingehende Transporte
  getIncoming: async function () {
    let url = game_data.link_base_pure + 'overview_villages&mode=trader&type=inc';
    let map = new Map();
    await RBv2.Data.loadPages(url, (doc, _) => {
      $(doc).find('.row_a, .row_b').each((i, row) => {
        try {
          let $r = $(row);
          let isMobile = $('#mobileHeader').length > 0;
          let coord = isMobile
            ? $r.children().eq(3).text().match(/\d{3}\|\d{3}/g)?.[1]
            : $r.children().eq(4).text().match(/\d{3}\|\d{3}/)?.[0];
          if (!coord) return;
          let wood = parseInt($r.find('.wood').parent().text().replace(/\./g, '')) || 0;
          let stone = parseInt($r.find('.stone').parent().text().replace(/\./g, '')) || 0;
          let iron = parseInt($r.find('.iron').parent().text().replace(/\./g, '')) || 0;
          if (map.has(coord)) {
            let e = map.get(coord);
            map.set(coord, { wood: e.wood+wood, stone: e.stone+stone, iron: e.iron+iron });
          } else {
            map.set(coord, { wood, stone, iron });
          }
        } catch (e) { console.warn('Incoming-Fehler:', e); }
      });
    });
    return map;
  },

  // Gebäudestände
  getBuildings: async function () {
    let url = game_data.link_base_pure + 'overview_villages&mode=buildings';
    let map = new Map();
    await RBv2.Data.loadPages(url, (doc, _) => {
      $(doc).find('.row_a, .row_b').each((i, row) => {
        try {
          let $r = $(row);
          let coord = $r.find('.nowrap').text().match(/\d{3}\|\d{3}/)?.[0];
          if (!coord) return;
          // Laufende Bauzeit
          let timeTitle = $r.find('.queue_icon img').last().attr('title');
          map.set(coord + '_time_queued', timeTitle ? RBv2.Utils.getFinishTime(timeTitle.split('-')[1]) : 0);
          // Gebäudelevel
          $r.find('.upgrade_building').each((j, el) => {
            let name = el.classList[1]?.replace('b_', '');
            if (name) map.set(coord + '_' + name, parseInt(el.innerText) || 0);
          });
          // Warteschlange
          $r.find('.queue_icon img').each((j, img) => {
            let name = img.src.match(/\w+\.(webp|png)/)?.[0].replace(/\.(webp|png)/, '');
            if (name) {
              let key = coord + '_' + name;
              map.set(key, (map.get(key) || 0) + 1);
            }
          });
        } catch (e) { console.warn('Gebäudefehler:', e); }
      });
    });
    return map;
  },

  // AM-Vorlagen
  getTemplates: async function () {
    if (!game_data.features.AccountManager?.active) {
      return { coordTemplates: new Map(), constructionTemplates: new Map(), farmPriority: new Map() };
    }
    let url = game_data.link_base_pure + 'am_village';
    let coordTemplates = new Map();
    let constructionTemplates = new Map();
    let farmPriority = new Map();

    await RBv2.Data.loadPages(url, (doc, _) => {
      $(doc).find('.row_a, .row_b').each((i, row) => {
        try {
          let coord = row.children[0]?.innerText.match(/\d{3}\|\d{3}/)?.[0];
          let tplName = row.children[1]?.innerText.trim();
          if (coord && tplName) {
            coordTemplates.set(coord, tplName);
            constructionTemplates.set(tplName, []);
            farmPriority.set(tplName, 99);
          }
        } catch (e) {}
      });
    });

    // Template-Details laden
    let firstPage = await $.ajax({ url, method: 'get' });
    let parser = new DOMParser();
    let doc = parser.parseFromString(firstPage, 'text/html');
    let options = Array.from($(doc).find('select[name=template] option'));

    for (let opt of options) {
      let name = opt.innerText?.replace(/\n|\t/g, '').replace(/\(\w+\)/, '').trim();
      if (!name || !constructionTemplates.has(name)) continue;
      await new Promise(res => setTimeout(res, 200));
      let tplData = await $.ajax({ url: game_data.link_base_pure + 'am_village&mode=queue&template=' + opt.value, method: 'get' });
      let tplDoc = parser.parseFromString(tplData, 'text/html');
      let tpl = Array.from($(tplDoc).find('.sortable_row')).map(r => ({
        name: r.getAttribute('data-building'),
        level_absolute: parseInt($(r).find('.level_absolute').text().match(/\d+/)?.[0]) || 0
      }));
      constructionTemplates.set(name, tpl);
      let hasCustomFarm = $(tplDoc).find('input[name=farm_upgrade_toggle]').is(':checked');
      farmPriority.set(name, hasCustomFarm ? 100 - parseInt($(tplDoc).find('select[name=population_upgrades]').val()) : 99);
    }

    return { coordTemplates, constructionTemplates, farmPriority };
  },

  // NEU: Truppenproduktions-Bedarf -- schätzt Rohstoffbedarf laufender Rekrutierungen
  getTroopNeeds: async function () {
    let url = game_data.link_base_pure + 'overview_villages&mode=combined';
    let map = new Map(); // coord -> { wood, stone, iron }

    // Rohstoffkosten pro Einheit (W252 Standard)
    const unitCosts = {
      spear: {w:50,s:30,i:10}, sword: {w:30,s:30,i:70},
      axe: {w:60,s:30,i:40}, spy: {w:140,s:30,i:50},
      light: {w:125,s:100,i:250}, marcher: {w:250,s:100,i:150},
      heavy: {w:200,s:150,i:600}, ram: {w:300,s:200,i:200},
      catapult: {w:320,s:400,i:100}, knight: {w:0,s:0,i:0},
      snob: {w:40000,s:50000,i:50000}
    };

    await RBv2.Data.loadPages(url, (doc, _) => {
      $(doc).find('#combined_table .row_a, #combined_table .row_b').each((i, row) => {
        try {
          let $r = $(row);
          let coord = $r.find('.quickedit-label').text().toCoord?.() || $r.find('.quickedit-label').text().match(/\d{3}\|\d{3}/)?.[0];
          if (!coord) return;
          let totalW = 0, totalS = 0, totalI = 0;
          // Einheitenzählen aus der kombinierten Ansicht (Kaserne-Queue-Tooltip)
          $r.find('.unit-item').each((j, el) => {
            let unit = game_data.units?.[j];
            let count = parseInt($(el).text()) || 0;
            if (unit && unitCosts[unit] && count > 0) {
              totalW += unitCosts[unit].w * count;
              totalS += unitCosts[unit].s * count;
              totalI += unitCosts[unit].i * count;
            }
          });
          if (totalW + totalS + totalI > 0) {
            map.set(coord, { wood: totalW, stone: totalS, iron: totalI });
          }
        } catch (e) {}
      });
    });
    return map;
  }
};

// ============================================================
// PLANUNGS-ENGINE -- verbessert gegenüber Original
// ============================================================
RBv2.Planner = {

  // K-Means Clustering (50 Wiederholungen, beste Distanz)
  cluster: function (coords, nrClusters) {
    let best = null, bestDist = Infinity;
    for (let rep = 0; rep < 50; rep++) {
      let result = RBv2.Planner._kmeans(coords, nrClusters);
      if (result.maxDist < bestDist) { bestDist = result.maxDist; best = result; }
    }
    return best;
  },

  _kmeans: function (coords, k) {
    let means = coords.slice().sort(() => Math.random()-0.5).slice(0, k);
    let clusters = means.map(m => ({ mean: [...m], data: [] }));
    for (let iter = 0; iter < 100; iter++) {
      clusters.forEach(c => c.data = []);
      coords.forEach(coord => {
        let best = clusters[0], bestD = Infinity;
        clusters.forEach(c => {
          let d = Math.hypot(c.mean[0]-coord[0], c.mean[1]-coord[1]);
          if (d < bestD) { bestD = d; best = c; }
        });
        best.data.push(coord);
      });
      clusters.forEach(c => {
        if (!c.data.length) return;
        c.mean = [
          c.data.reduce((s,v) => s+v[0], 0) / c.data.length,
          c.data.reduce((s,v) => s+v[1], 0) / c.data.length
        ];
      });
    }
    let maxDist = 0;
    clusters.forEach(c => {
      for (let i = 0; i < c.data.length; i++)
        for (let j = i+1; j < c.data.length; j++) {
          let d = Math.hypot(c.data[i][0]-c.data[j][0], c.data[i][1]-c.data[j][1]);
          if (d > maxDist) maxDist = d;
        }
    });
    clusters.maxDist = maxDist;
    return clusters;
  },

  // Hauptplanungslogik -- NEU: Blacklist, Truppen-Reserve, Overflow-Schutz, Prioritäten
  plan: function (rawData, settings, amData) {
    let { production, incoming, troops } = rawData;
    let { list } = production;

    // Blacklist/Whitelist filtern
    let filtered = list.filter(v => {
      if (settings.blacklist.includes(v.coord)) return false;
      if (settings.whitelist.length > 0 && !settings.whitelist.includes(v.coord)) return false;
      return true;
    });

    // Eingehende Rohstoffe addieren
    filtered.forEach(v => {
      if (incoming.has(v.coord)) {
        let inc = incoming.get(v.coord);
        v.wood  = Math.min(v.wood  + inc.wood,  v.capacity);
        v.stone = Math.min(v.stone + inc.stone, v.capacity);
        v.iron  = Math.min(v.iron  + inc.iron,  v.capacity);
      }
    });

    // Truppenproduktions-Reserve abziehen
    if (settings.reserveTroops) {
      filtered.forEach(v => {
        if (troops.has(v.coord)) {
          let t = troops.get(v.coord);
          v.wood  = Math.max(0, v.wood  - t.wood);
          v.stone = Math.max(0, v.stone - t.stone);
          v.iron  = Math.max(0, v.iron  - t.iron);
        }
      });
    }

    // Manuelle Rohstoff-Reserven abziehen
    filtered.forEach(v => {
      v.wood  = Math.max(0, v.wood  - (settings.reserveWood  || 0));
      v.stone = Math.max(0, v.stone - (settings.reserveStone || 0));
      v.iron  = Math.max(0, v.iron  - (settings.reserveIron  || 0));
    });

    // Clustering
    let coords = filtered.map(v => v.coord.split('|').map(Number));
    let clusters = RBv2.Planner.cluster(coords, settings.nrClusters || 1);

    let launches = [];
    let clusterStats = [];

    clusters.forEach((cluster, ci) => {
      let clusterVillages = cluster.data.map(pt => {
        let coord = pt[0] + '|' + pt[1];
        return filtered.find(v => v.coord === coord);
      }).filter(Boolean);

      // Durchschnitt pro Cluster -- MIT Rohstoff-Prioritäten gewichtet
      let n = clusterVillages.length || 1;
      let avgW = clusterVillages.reduce((s,v) => s+v.wood,  0) / n * settings.averageFactor * (settings.priorityWood  || 1);
      let avgS = clusterVillages.reduce((s,v) => s+v.stone, 0) / n * settings.averageFactor * (settings.priorityStone || 1);
      let avgI = clusterVillages.reduce((s,v) => s+v.iron,  0) / n * settings.averageFactor * (settings.priorityIron  || 1);

      let senders = [], receivers = [];

      clusterVillages.forEach(v => {
        let merch = Math.max(0, v.merchants - settings.reserveMerchants);
        let cap = settings.merchantCapacity || 1000;
        let capacity95 = v.capacity * 0.95;

        let diffW = v.wood  - Math.round(avgW);
        let diffS = v.stone - Math.round(avgS);
        let diffI = v.iron  - Math.round(avgI);

        // Overflow-Schutz: Dörfer die kurz vor Lagervoll sind bekommen Empfänger-Priorität
        if (settings.overflowProtect) {
          let fillRatio = (v.wood + v.stone + v.iron) / (v.capacity * 3);
          if (fillRatio > 0.85 && diffW > 0) diffW = Math.max(diffW, v.wood - avgW * 1.1);
          if (fillRatio > 0.85 && diffS > 0) diffS = Math.max(diffS, v.stone - avgS * 1.1);
          if (fillRatio > 0.85 && diffI > 0) diffI = Math.max(diffI, v.iron - avgI * 1.1);
        }

        let sendTotal = Math.max(0,diffW) + Math.max(0,diffS) + Math.max(0,diffI);
        let norm = (merch * cap <= sendTotal && sendTotal > 0) ? (merch * cap / sendTotal) : 1;

        let sendW = diffW > 0 ? Math.floor(diffW * norm) : 0;
        let sendS = diffS > 0 ? Math.floor(diffS * norm) : 0;
        let sendI = diffI > 0 ? Math.floor(diffI * norm) : 0;

        let getW = diffW < 0 ? Math.min(Math.abs(diffW), capacity95 - v.wood)  : 0;
        let getS = diffS < 0 ? Math.min(Math.abs(diffS), capacity95 - v.stone) : 0;
        let getI = diffI < 0 ? Math.min(Math.abs(diffI), capacity95 - v.iron)  : 0;

        if (sendW + sendS + sendI > 0) senders.push({ ...v, sendW, sendS, sendI });
        if (getW  + getS  + getI  > 0) receivers.push({ ...v, getW,  getS,  getI  });
      });

      // Launches berechnen: nächste Sender zuerst
      receivers.forEach(recv => {
        senders.sort((a, b) => RBv2.Utils.calcDist(recv.coord, a.coord) - RBv2.Utils.calcDist(recv.coord, b.coord));
        senders.forEach(send => {
          let w = Math.min(recv.getW, send.sendW);
          let s = Math.min(recv.getS, send.sendS);
          let i = Math.min(recv.getI, send.sendI);
          let total = w + s + i;
          let minRes = settings.merchantCapacity >= 1500 ? 1200 : 700;
          // Bug-Fix wie Original: Reste unter Minimum abziehen
          let rest = total % (settings.merchantCapacity || 1000);
          if (rest > 0 && rest < minRes) {
            if (w > rest) { w -= rest; total -= rest; }
            else if (s > rest) { s -= rest; total -= rest; }
            else if (i > rest) { i -= rest; total -= rest; }
          }
          if (total >= minRes) {
            launches.push({
              coordOrigin: send.coord, idOrigin: send.id, nameOrigin: send.name,
              coordDest: recv.coord, idDest: recv.id, nameDest: recv.name,
              wood: w, stone: s, iron: i, total,
              dist: RBv2.Utils.calcDist(send.coord, recv.coord)
            });
            recv.getW  -= w; recv.getS  -= s; recv.getI  -= i;
            send.sendW -= w; send.sendS -= s; send.sendI -= i;
          }
        });
      });

      clusterStats.push({
        center: cluster.mean.map(Math.round).join('|'),
        nrVillages: clusterVillages.length,
        avgW: Math.round(avgW), avgS: Math.round(avgS), avgI: Math.round(avgI),
        maxDist: cluster.data.length > 1 ? Math.max(...cluster.data.flatMap((a,ai) =>
          cluster.data.slice(ai+1).map(b => Math.hypot(a[0]-b[0],a[1]-b[1])))) : 0
      });
    });

    return { launches, clusterStats };
  },

  // Effizienz-Score berechnen (0-100)
  calcScore: function (launches, allVillages) {
    if (!launches.length || !allVillages.length) return 0;
    let totalRes = allVillages.reduce((s,v) => s + v.wood + v.stone + v.iron, 0);
    let sentRes = launches.reduce((s,l) => s + l.total, 0);
    let avgDist = launches.reduce((s,l) => s + l.dist, 0) / launches.length;
    let distScore = Math.max(0, 100 - avgDist * 2);
    let coverScore = Math.min(100, sentRes / (totalRes * 0.1) * 100);
    return Math.round((distScore + coverScore) / 2);
  }
};

// ============================================================
// HAUPT-CONTROLLER
// ============================================================
RBv2.Main = (function () {
  let settings = {};
  let lastPlan = null;
  let autoTimer = null;
  let countdownTimer = null;
  let scheduleTimer = null;

  // ── UI AUFBAUEN ──────────────────────────────────────────
  const buildUI = function () {
    settings = RBv2.Settings.load();
    $('#RBv2_container').remove();

    let blacklistStr = (settings.blacklist || []).join(', ');
    let whitelistStr = (settings.whitelist || []).join(', ');

    let html = `
    <div id="RBv2_container" style="
      position:fixed; top:60px; left:20px; z-index:9999;
      width:${settings.widthInterface || 50}%;
      background:#1a1a2e; border:2px solid #e94560;
      border-radius:8px; color:#eee; font-family:sans-serif;
      font-size:12px; box-shadow:0 4px 30px rgba(233,69,96,0.3);
      user-select:none;">

      <!-- HEADER -->
      <div style="background:#16213e; padding:10px 14px; border-radius:6px 6px 0 0;
        display:flex; justify-content:space-between; align-items:center; cursor:move"
        id="RBv2_header">
        <span style="font-size:15px; font-weight:bold; color:#e94560;">
          &#9648; Ressourcen-Balancer <span style="font-size:10px;color:#888">v2.0</span>
        </span>
        <span>
          <a href="#" id="RBv2_min" style="color:#aaa;margin-right:8px;">&#8722;</a>
          <a href="#" onclick="$('#RBv2_container').remove()" style="color:#e94560;">&#10005;</a>
        </span>
      </div>

      <!-- BODY -->
      <div id="RBv2_body" style="padding:12px; max-height:80vh; overflow-y:auto;">

        <!-- STATUS-BANNER -->
        <div id="RBv2_status" style="display:none;padding:6px;border-radius:4px;
          margin-bottom:8px;text-align:center;font-weight:bold;"></div>

        <!-- TABS -->
        <div style="display:flex;gap:4px;margin-bottom:10px;">
          ${['Einstellungen','Ergebnis','Statistik','Verlauf','Rollback'].map((t,i) =>
            `<button class="RBv2_tab btn" data-tab="${i}"
              style="flex:1;font-size:11px;padding:4px;">${t}</button>`).join('')}
        </div>

        <!-- TAB 0: EINSTELLUNGEN -->
        <div id="RBv2_tab0">
          <table style="width:100%;border-collapse:collapse;">
            ${row('Reserve Händler', `<input type="number" id="rb_reserveMerch" value="${settings.reserveMerchants}" style="${inp()}">`)}
            ${row('Bauzeit [Std]', `<input type="number" id="rb_conTime" value="${settings.constructionTime}" style="${inp()}">`)}
            ${row('Ø-Faktor [0-1]', `<input type="number" id="rb_avgFactor" step="0.1" min="0" max="1" value="${settings.averageFactor}" style="${inp()}">`)}
            ${row('Cluster', `<input type="number" id="rb_clusters" value="${settings.nrClusters}" style="${inp()}">`)}
            ${row('Händler-Kapazität', `<select id="rb_merchCap" style="${inp()}"><option value="1000" ${settings.merchantCapacity==1000?'selected':''}>1000</option><option value="1500" ${settings.merchantCapacity==1500?'selected':''}>1500</option></select>`)}
            ${row('Max Bau', `<input type="checkbox" id="rb_maxConst" ${settings.maxConstruction?'checked':''}>`)}
            ${row('Trocken-Lauf ⚠️', `<input type="checkbox" id="rb_dryRun" ${settings.dryRun?'checked':''}>`)}
            ${row('Truppen-Reserve', `<input type="checkbox" id="rb_troops" ${settings.reserveTroops?'checked':''}>`)}
            ${row('Overflow-Schutz', `<input type="checkbox" id="rb_overflow" ${settings.overflowProtect?'checked':''}>`)}
            ${row('Reserve Holz/Lehm/Eisen',
              `<input type="number" id="rb_resW" value="${settings.reserveWood||0}" style="${inp(60)}">
               <input type="number" id="rb_resS" value="${settings.reserveStone||0}" style="${inp(60)}">
               <input type="number" id="rb_resI" value="${settings.reserveIron||0}" style="${inp(60)}">`)}
            ${row('Priorität H/L/E',
              `<input type="number" id="rb_priW" value="${settings.priorityWood||1}" step="0.1" style="${inp(60)}">
               <input type="number" id="rb_priS" value="${settings.priorityStone||1}" step="0.1" style="${inp(60)}">
               <input type="number" id="rb_priI" value="${settings.priorityIron||1}" step="0.1" style="${inp(60)}">`)}
            ${row('Blacklist (Koord.)', `<input type="text" id="rb_blacklist" value="${blacklistStr}" placeholder="350|350, 351|351" style="${inp()}">`)}
            ${row('Whitelist (Koord.)', `<input type="text" id="rb_whitelist" value="${whitelistStr}" placeholder="leer = alle" style="${inp()}">`)}
            ${row('Auto-Neustart', `<input type="checkbox" id="rb_autoRestart" ${settings.autoRestart?'checked':''}>`)}
            ${row('Neustart Von/Bis Min',
              `<input type="number" id="rb_restMin" value="${settings.restartMin||30}" style="${inp(60)}">
               &nbsp;/&nbsp;
               <input type="number" id="rb_restMax" value="${settings.restartMax||60}" style="${inp(60)}">`)}
            ${row('Zeitplan aktiv', `<input type="checkbox" id="rb_schedEn" ${settings.scheduleEnabled?'checked':''}>`)}
            ${row('Zeitplan Uhrzeiten', `<input type="text" id="rb_schedHours" value="${settings.scheduleHours||'08:00,20:00'}" placeholder="08:00,20:00" style="${inp()}">`)}
          </table>

          <div style="display:flex;gap:6px;margin-top:10px;">
            <button id="RBv2_plan" class="btn evt-confirm-btn btn-confirm-yes"
              style="flex:2;background:#e94560;color:#fff;font-weight:bold;">
              Planen
            </button>
            <button id="RBv2_send" class="btn" style="flex:1;" disabled>
              Senden
            </button>
          </div>
          <div id="RBv2_countdown" style="text-align:center;color:#e94560;
            font-weight:bold;margin-top:6px;display:none;"></div>
        </div>

        <!-- TAB 1: ERGEBNIS -->
        <div id="RBv2_tab1" style="display:none;">
          <div id="RBv2_result_table"></div>
        </div>

        <!-- TAB 2: STATISTIK -->
        <div id="RBv2_tab2" style="display:none;">
          <div id="RBv2_stats_content"></div>
        </div>

        <!-- TAB 3: VERLAUF -->
        <div id="RBv2_tab3" style="display:none;">
          <div id="RBv2_history_content"></div>
        </div>

        <!-- TAB 4: ROLLBACK -->
        <div id="RBv2_tab4" style="display:none;">
          <div id="RBv2_rollback_content"></div>
        </div>

      </div>
      <div style="background:#16213e;padding:6px 14px;border-radius:0 0 6px 6px;
        font-size:10px;color:#555;text-align:center;">
        RBv2 &mdash; W252
      </div>
    </div>`;

    $('body').append(html);
    bindEvents();
    switchTab(0);
    makeDraggable();
    checkFarmGodLock();
    initScheduler();
  };

  // Hilfsfunktionen für UI
  const inp = (w) => `background:#0f3460;color:#eee;border:1px solid #e94560;
    border-radius:3px;padding:2px 4px;${w?`width:${w}px`:'width:100%'}`;
  const row = (label, content) => `
    <tr style="border-bottom:1px solid #1a1a2e;">
      <td style="padding:5px 6px;color:#aaa;white-space:nowrap;">${label}</td>
      <td style="padding:5px 6px;">${content}</td>
    </tr>`;

  // ── EVENTS ──────────────────────────────────────────────
  const bindEvents = function () {
    // Tabs
    $('.RBv2_tab').on('click', function () { switchTab(parseInt($(this).data('tab'))); });

    // Minimieren
    $('#RBv2_min').on('click', function () {
      let vis = $('#RBv2_body').is(':visible');
      $('#RBv2_body').toggle(!vis);
    });

    // Planen
    $('#RBv2_plan').on('click', async function () {
      saveSettings();
      await runPlan();
    });

    // Senden
    $('#RBv2_send').on('click', async function () {
      if (!lastPlan) return;
      let isDry = settings.dryRun;
      if (isDry) {
        setStatus('Trocken-Lauf: Kein echtes Senden!', '#e67e22');
        return;
      }
      let confirmed = confirm(`${lastPlan.launches.length} Transporte wirklich senden?`);
      if (!confirmed) return;
      await sendAll(lastPlan.launches);
    });
  };

  const switchTab = function (i) {
    for (let j = 0; j <= 4; j++) {
      $(`#RBv2_tab${j}`).toggle(j === i);
      $(`.RBv2_tab[data-tab="${j}"]`).css('opacity', j === i ? 1 : 0.5);
    }
    if (i === 3) renderHistory();
    if (i === 4) renderRollback();
  };

  const setStatus = function (msg, color) {
    $('#RBv2_status').text(msg).css('background', color || '#27ae60').show();
  };

  // ── SETTINGS LESEN ──────────────────────────────────────
  const saveSettings = function () {
    settings = {
      reserveMerchants: parseInt($('#rb_reserveMerch').val()) || 0,
      constructionTime: parseInt($('#rb_conTime').val()) || 0,
      averageFactor: parseFloat($('#rb_avgFactor').val()) || 1,
      nrClusters: parseInt($('#rb_clusters').val()) || 1,
      merchantCapacity: parseInt($('#rb_merchCap').val()) || 1000,
      maxConstruction: $('#rb_maxConst').is(':checked'),
      dryRun: $('#rb_dryRun').is(':checked'),
      reserveTroops: $('#rb_troops').is(':checked'),
      overflowProtect: $('#rb_overflow').is(':checked'),
      reserveWood: parseInt($('#rb_resW').val()) || 0,
      reserveStone: parseInt($('#rb_resS').val()) || 0,
      reserveIron: parseInt($('#rb_resI').val()) || 0,
      priorityWood: parseFloat($('#rb_priW').val()) || 1,
      priorityStone: parseFloat($('#rb_priS').val()) || 1,
      priorityIron: parseFloat($('#rb_priI').val()) || 1,
      blacklist: ($('#rb_blacklist').val() || '').split(',').map(s=>s.trim()).filter(Boolean),
      whitelist: ($('#rb_whitelist').val() || '').split(',').map(s=>s.trim()).filter(Boolean),
      autoRestart: $('#rb_autoRestart').is(':checked'),
      restartMin: parseInt($('#rb_restMin').val()) || 30,
      restartMax: parseInt($('#rb_restMax').val()) || 60,
      scheduleEnabled: $('#rb_schedEn').is(':checked'),
      scheduleHours: $('#rb_schedHours').val() || '08:00,20:00',
    };
    RBv2.Settings.save(settings);
  };

  // ── HAUPTLAUF ────────────────────────────────────────────
  const runPlan = async function () {
    setStatus('Lade Daten...', '#2980b9');
    $('#RBv2_plan').prop('disabled', true);
    $('#RBv2_send').prop('disabled', true);

    try {
      let rawData = await RBv2.Data.loadAll(settings);
      let { launches, clusterStats } = RBv2.Planner.plan(rawData, settings, {});
      let score = RBv2.Planner.calcScore(launches, rawData.production.list);

      lastPlan = { launches, clusterStats, score, rawData };

      renderResult(launches, clusterStats, score, settings.dryRun);
      renderStats(clusterStats, score, rawData.production.list);
      switchTab(1);

      if (settings.dryRun) {
        setStatus(`Trocken-Lauf: ${launches.length} Transporte geplant (Score: ${score}/100)`, '#e67e22');
      } else {
        setStatus(`${launches.length} Transporte bereit. Jetzt senden?`, '#27ae60');
        $('#RBv2_send').prop('disabled', false);
      }

    } catch (e) {
      console.error('RBv2 Fehler:', e);
      setStatus('Fehler beim Laden: ' + e.message, '#c0392b');
    }

    $('#RBv2_plan').prop('disabled', false);
  };

  // ── SENDEN ───────────────────────────────────────────────
  const sendAll = async function (launches) {
    let sent = 0, errors = 0;
    setStatus(`Sende... 0/${launches.length}`, '#2980b9');

    // Gruppieren nach Zieldorf
    let grouped = {};
    launches.forEach(l => {
      if (!grouped[l.idDest]) grouped[l.idDest] = { idDest: l.idDest, coordDest: l.coordDest, nameDest: l.nameDest, resources: {} };
      grouped[l.idDest].resources[`resource[${l.idOrigin}][wood]`]  = l.wood;
      grouped[l.idDest].resources[`resource[${l.idOrigin}][stone]`] = l.stone;
      grouped[l.idDest].resources[`resource[${l.idOrigin}][iron]`]  = l.iron;
    });

    for (let [idDest, entry] of Object.entries(grouped)) {
      try {
        await new Promise((resolve, reject) => {
          TribalWars.post('market', {
            village: idDest,
            ajaxaction: 'call',
            h: window.csrf_token
          }, entry.resources, function (res) {
            UI.SuccessMessage(res.success, 1000);
            // Rollback-Eintrag
            RBv2.Rollback.add({
              idDest, coordDest: entry.coordDest, nameDest: entry.nameDest,
              resources: entry.resources,
              total: Object.values(entry.resources).reduce((s,v)=>s+v,0)
            });
            sent++;
            setStatus(`Sende... ${sent}/${Object.keys(grouped).length}`, '#2980b9');
            resolve();
          }, function (err) {
            errors++;
            reject(err);
          });
        });
        await new Promise(res => setTimeout(res, 300 + Math.random() * 400));
      } catch (e) {
        errors++;
        console.warn('Sendefehler:', e);
      }
    }

    let histEntry = {
      sent, errors,
      score: lastPlan?.score || 0,
      launches: launches.length,
      clusters: lastPlan?.clusterStats?.length || 0
    };
    RBv2.History.add(histEntry);

    setStatus(`Fertig! ${sent} gesendet, ${errors} Fehler. Score: ${lastPlan?.score}/100`, errors ? '#e67e22' : '#27ae60');

    if (settings.autoRestart) scheduleRestart();
  };

  // ── ERGEBNIS-TABELLE ─────────────────────────────────────
  const renderResult = function (launches, clusterStats, score, isDry) {
    let sorted = [...launches].sort((a,b) => b.total - a.total);
    let html = `
      <div style="text-align:center;margin-bottom:8px;">
        <span style="font-size:18px;font-weight:bold;color:${score>70?'#27ae60':score>40?'#e67e22':'#e94560'};">
          Score: ${score}/100
        </span>
        ${isDry ? '<span style="color:#e67e22;margin-left:10px;">&#9888; TROCKEN-LAUF</span>' : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <tr style="background:#16213e;color:#e94560;">
          <th style="padding:4px;">Ziel</th>
          <th>Distanz</th>
          <th>Gesamt</th>
          <th>&#x1F332;</th><th>&#x26F0;</th><th>&#x2694;&#xFE0F;</th>
          ${!isDry ? '<th>Send</th>' : ''}
        </tr>`;

    sorted.forEach((l, i) => {
      let bg = i % 2 === 0 ? '#0f3460' : '#16213e';
      html += `
        <tr style="background:${bg};" id="RBv2_row_${i}">
          <td style="padding:4px;">
            <a href="${game_data.link_base_pure}info_village&id=${l.idDest}"
               style="color:#eee;">${l.nameDest} (${l.coordDest})</a>
          </td>
          <td style="text-align:center;">${l.dist.toFixed(1)}</td>
          <td style="text-align:center;">${RBv2.Utils.formatNum(l.total)}</td>
          <td style="text-align:center;color:#8bc34a;">${RBv2.Utils.formatNum(l.wood)}</td>
          <td style="text-align:center;color:#ffc107;">${RBv2.Utils.formatNum(l.stone)}</td>
          <td style="text-align:center;color:#90caf9;">${RBv2.Utils.formatNum(l.iron)}</td>
          ${!isDry ? `<td><button class="btn RBv2_single_send" data-idx="${i}"
            style="font-size:10px;padding:2px 6px;">&#x27A4;</button></td>` : ''}
        </tr>`;
    });

    html += '</table>';
    $('#RBv2_result_table').html(html);

    // Einzeln senden
    if (!isDry) {
      $('.RBv2_single_send').on('click', async function () {
        let idx = parseInt($(this).data('idx'));
        let l = sorted[idx];
        $(this).prop('disabled', true);
        await sendAll([l]);
        $(`#RBv2_row_${idx}`).fadeOut();
      });
    }
  };

  // ── STATISTIK ────────────────────────────────────────────
  const renderStats = function (clusterStats, score, villages) {
    let totalW = villages.reduce((s,v)=>s+v.wood,0);
    let totalS = villages.reduce((s,v)=>s+v.stone,0);
    let totalI = villages.reduce((s,v)=>s+v.iron,0);
    let avgW = Math.round(totalW / (villages.length||1));
    let avgS = Math.round(totalS / (villages.length||1));
    let avgI = Math.round(totalI / (villages.length||1));

    let html = `
      <div style="margin-bottom:10px;">
        <div style="color:#e94560;font-weight:bold;margin-bottom:4px;">Gesamt-Statistik</div>
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr style="background:#16213e;">
            <td style="padding:4px;"></td>
            <td style="color:#8bc34a;">&#x1F332; Holz</td>
            <td style="color:#ffc107;">&#x26F0; Lehm</td>
            <td style="color:#90caf9;">&#x2694;&#xFE0F; Eisen</td>
          </tr>
          <tr style="background:#0f3460;">
            <td style="padding:4px;">Gesamt</td>
            <td>${RBv2.Utils.formatNum(totalW)}</td>
            <td>${RBv2.Utils.formatNum(totalS)}</td>
            <td>${RBv2.Utils.formatNum(totalI)}</td>
          </tr>
          <tr style="background:#16213e;">
            <td style="padding:4px;">Durchschnitt</td>
            <td>${RBv2.Utils.formatNum(avgW)}</td>
            <td>${RBv2.Utils.formatNum(avgS)}</td>
            <td>${RBv2.Utils.formatNum(avgI)}</td>
          </tr>
        </table>
      </div>

      <div>
        <div style="color:#e94560;font-weight:bold;margin-bottom:4px;">Cluster-Details</div>
        ${clusterStats.map((c, i) => `
          <div style="background:#0f3460;border-radius:4px;padding:6px;margin-bottom:4px;">
            <b>Cluster ${i+1}</b> &mdash; ${c.nrVillages} Dörfer, Zentrum: ${c.center},
            Max-Distanz: ${c.maxDist.toFixed(1)}
          </div>`).join('')}
      </div>`;

    $('#RBv2_stats_content').html(html);
  };

  // ── VERLAUF ──────────────────────────────────────────────
  const renderHistory = function () {
    let history = RBv2.History.get();
    if (!history.length) { $('#RBv2_history_content').html('<p style="color:#888;">Kein Verlauf vorhanden.</p>'); return; }
    let html = '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
    html += '<tr style="background:#16213e;color:#e94560;"><th>Zeit</th><th>Gesendet</th><th>Fehler</th><th>Score</th></tr>';
    history.forEach((h, i) => {
      html += `<tr style="background:${i%2?'#0f3460':'#16213e'};">
        <td style="padding:4px;">${h.timestamp}</td>
        <td>${h.sent}</td><td>${h.errors}</td>
        <td style="color:${h.score>70?'#27ae60':h.score>40?'#e67e22':'#e94560'};">${h.score}/100</td>
      </tr>`;
    });
    html += '</table>';
    $('#RBv2_history_content').html(html);
  };

  // ── ROLLBACK ─────────────────────────────────────────────
  const renderRollback = function () {
    let list = RBv2.Rollback.get();
    if (!list.length) { $('#RBv2_rollback_content').html('<p style="color:#888;">Keine Transaktionen gespeichert.</p>'); return; }
    let html = `<button id="RBv2_clearRollback" class="btn" style="margin-bottom:8px;font-size:11px;">Liste leeren</button>`;
    html += '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
    html += '<tr style="background:#16213e;color:#e94560;"><th>Zeit</th><th>Ziel</th><th>Gesamt</th></tr>';
    list.forEach((r, i) => {
      html += `<tr style="background:${i%2?'#0f3460':'#16213e'};">
        <td style="padding:4px;">${r.timestamp}</td>
        <td>${r.nameDest} (${r.coordDest})</td>
        <td>${RBv2.Utils.formatNum(r.total)}</td>
      </tr>`;
    });
    html += '</table>';
    $('#RBv2_rollback_content').html(html);
    $('#RBv2_clearRollback').on('click', function () { RBv2.Rollback.clear(); renderRollback(); });
  };

  // ── AUTO-NEUSTART ────────────────────────────────────────
  const scheduleRestart = function () {
    clearTimeout(autoTimer);
    clearInterval(countdownTimer);
    let minSec = (settings.restartMin || 30) * 60;
    let maxSec = (settings.restartMax || 60) * 60;
    let waitSec = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
    let remaining = waitSec;

    $('#RBv2_countdown').text(`Neustart in ${Math.round(remaining/60)} Min`).show();
    countdownTimer = setInterval(() => {
      remaining--;
      $('#RBv2_countdown').text(`Neustart in ${Math.round(remaining/60)} Min ${remaining%60}s`);
      if (remaining <= 0) clearInterval(countdownTimer);
    }, 1000);

    autoTimer = setTimeout(async () => {
      $('#RBv2_countdown').hide();
      saveSettings();
      await runPlan();
      if (!settings.dryRun && lastPlan?.launches.length) await sendAll(lastPlan.launches);
    }, waitSec * 1000);
  };

  // ── ZEITPLAN ─────────────────────────────────────────────
  const initScheduler = function () {
    clearTimeout(scheduleTimer);
    if (!settings.scheduleEnabled) return;
    let hours = (settings.scheduleHours || '08:00,20:00').split(',').map(h => h.trim());
    const checkSchedule = () => {
      let now = new Date();
      let timeStr = ('0'+now.getHours()).slice(-2) + ':' + ('0'+now.getMinutes()).slice(-2);
      if (hours.includes(timeStr)) {
        saveSettings();
        runPlan().then(() => {
          if (!settings.dryRun && lastPlan?.launches.length) sendAll(lastPlan.launches);
        });
      }
      scheduleTimer = setTimeout(checkSchedule, 60000); // jede Minute prüfen
    };
    scheduleTimer = setTimeout(checkSchedule, 60000);
  };

  // ── FARMGOD-LOCK CHECK ───────────────────────────────────
  const checkFarmGodLock = function () {
    if (RBv2.Lock.isLocked()) {
      setStatus('⚠️ FarmGod läuft gerade -- Balancer pausiert', '#e67e22');
      $('#RBv2_plan').prop('disabled', true);
      setTimeout(checkFarmGodLock, 15000);
    } else {
      $('#RBv2_plan').prop('disabled', false);
    }
  };

  // ── DRAG ─────────────────────────────────────────────────
  const makeDraggable = function () {
    let el = document.getElementById('RBv2_container');
    let header = document.getElementById('RBv2_header');
    let startX, startY, startL, startT;
    header.addEventListener('mousedown', function (e) {
      startX = e.clientX; startY = e.clientY;
      startL = el.offsetLeft; startT = el.offsetTop;
      function move(e) {
        el.style.left = (startL + e.clientX - startX) + 'px';
        el.style.top  = (startT + e.clientY - startY) + 'px';
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  };

  return { init: buildUI };
})();

// ============================================================
// START
// ============================================================
RBv2.Main.init();
