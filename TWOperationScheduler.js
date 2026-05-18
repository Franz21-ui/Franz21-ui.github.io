// TW Operation Scheduler v4 — Beast Edition
// Angriff + Unterstützung | Pre-Warm Timing | Adels-Züge | Bulk-Edit | Presets | Timeline | Sound
// Import: DS-Ultimate JSON + DS Workbench Tab-Export

(() => {
  'use strict';

  if (window._twOpsInst) { window._twOpsInst.open(); return; }

  const _HOST       = (location.hostname.match(/^[^.]+/) || ['tw'])[0];
  const STORAGE_KEY = 'twOps_v4_' + _HOST;
  const PRESETS_KEY = 'twOps_v4_pre_' + _HOST;

  // ── KONFIGURATION ──────────────────────────────────────────────────────────
  const CFG = {
    PAGE_SIZE:   50,
    PREWARM_MS: 5000,
    FIRE_OFFSET: 200,
    ALERT_SEC:    60,
  };

  // ── EINHEITEN ──────────────────────────────────────────────────────────────
  const UNITS = [
    { key:'spear',    label:'Speer'   },
    { key:'sword',    label:'Schwert' },
    { key:'axe',      label:'Axt'     },
    { key:'spy',      label:'Aufkl.'  },
    { key:'light',    label:'LKav'    },
    { key:'heavy',    label:'SKav'    },
    { key:'ram',      label:'Ramme'   },
    { key:'catapult', label:'Kata'    },
    { key:'snob',     label:'Adel'    },
    { key:'knight',   label:'Paladin' },
  ];

  const UNIT_MAP = {
    'ramme':'ram','rammboeck':'ram','rammbock':'ram',
    'axt':'axe','axtkampfer':'axe',
    'speer':'spear','schwert':'sword',
    'lkav':'light','leichte':'light',
    'skav':'heavy','schwere':'heavy',
    'kata':'catapult','katapult':'catapult',
    'aufkl':'spy','adel':'snob','paladin':'knight',
    'axe':'axe','spear':'spear','sword':'sword','light':'light',
    'heavy':'heavy','ram':'ram','catapult':'catapult',
    'snob':'snob','knight':'knight','spy':'spy',
  };

  // DS-Ultimate slowest_unit Index → Einheiten-Key + Grundgeschwindigkeit (min/Feld)
  // Index: 1=Speer 2=Schwert 3=Axt 4=Aufkl 5=LKav 6=SKav 7=Ramme 8=Kata 9=Adel 10=Paladin
  const UNIT_IDX       = ['','spear','sword','axe','spy','light','heavy','ram','catapult','snob','knight'];
  const UNIT_SPEED_MIN = { spear:18, sword:22, axe:18, spy:9, light:10, heavy:11, ram:30, catapult:30, snob:35, knight:10 };

  const BUILDINGS = [
    { key:'',         label:'— Standard —'   },
    { key:'main',     label:'Hauptgebäude'    },
    { key:'barracks', label:'Kaserne'         },
    { key:'stable',   label:'Stall'           },
    { key:'garage',   label:'Werkstatt'       },
    { key:'church',   label:'Kirche'          },
    { key:'snob',     label:'Adelshof'        },
    { key:'smith',    label:'Schmiede'        },
    { key:'place',    label:'Versammlungspl.' },
    { key:'market',   label:'Marktplatz'      },
    { key:'wood',     label:'Holzfällerlager' },
    { key:'stone',    label:'Lehmgrube'       },
    { key:'iron',     label:'Eisenmine'       },
    { key:'farm',     label:'Bauernhof'       },
    { key:'storage',  label:'Speicher'        },
    { key:'wall',     label:'Wall'            },
  ];

  const KNOWN_FIELDS = [
    'template_id','source_village','source','spear','sword','axe','spy',
    'light','heavy','ram','catapult','snob','knight','archer','marcher',
    'x','y','target_type','input','attack','support',
  ];

  // ── STATE ──────────────────────────────────────────────────────────────────
  let ops        = [];
  let ticker     = null;
  let running    = false;
  let srvOff     = 0;
  let alertFired = false;

  let page         = 0;
  let filterSt     = 'all';
  let filterType   = 'all';
  let filterSearch = '';
  let sortKey      = 'departTs';
  let sortDir      = 1;

  // ── VILLAGE-QUEUE ──────────────────────────────────────────────────────────
  const vQueues = {};
  const queueSend = (vid, fn) => {
    if (!vQueues[vid]) vQueues[vid] = Promise.resolve();
    vQueues[vid] = vQueues[vid]
      .then(() => new Promise(resolve => fn(resolve)))
      .catch(() => {});
  };

  // ── PRESETS ────────────────────────────────────────────────────────────────
  let presets = [];
  const loadPresets = () => {
    try { presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); }
    catch (e) { presets = []; }
  };
  const savePresets = () => {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch (e) {}
  };
  loadPresets();

  // ── PERSISTENZ ─────────────────────────────────────────────────────────────
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(
        ops.map(o => ({ ...o, timerId: null, _prewarmId: null }))
      ));
    } catch (e) {}
  };

  const loadSaved = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (e) { return null; }
  };

  const wipePlan = () => {
    localStorage.removeItem(STORAGE_KEY);
    ops = []; running = false;
    Object.keys(vQueues).forEach(k => delete vQueues[k]);
  };

  // ── SERVERZEIT ─────────────────────────────────────────────────────────────
  const initOffset = () => {
    try {
      let tm = $('#serverTime').text().trim().match(/(\d+):(\d+):(\d+)/);
      let dm = $('#serverDate').text().trim().match(/(\d+)[\/\.](\d+)[\/\.](20?\d\d|\d\d)/);
      if (!tm || !dm) return;
      let y  = +dm[3] < 100 ? 2000 + +dm[3] : +dm[3];
      let ts = new Date(y, +dm[2]-1, +dm[1], +tm[1], +tm[2], +tm[3]).getTime();
      srvOff = ts - Date.now();
    } catch (e) { srvOff = 0; }
  };

  const now = () => Date.now() + srvOff;

  // ── PARSER ─────────────────────────────────────────────────────────────────
  const parseTs = str => {
    // Unterstützt: DD.MM.YY und DD.MM.YYYY
    let m = str.match(/(\d+)\.(\d+)\.(\d+)\s+(\d+):(\d+):(\d+)/);
    if (!m) return null;
    let y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[2]-1, +m[1], +m[4], +m[5], +m[6]).getTime();
  };

  const detectMode = typeStr => {
    let t = typeStr.toLowerCase().replace(/\s+/g, '');
    if (t.includes('unterstütz') || t.includes('unterst') || t.includes('support')
        || t === 'u' || t === 's' || t === 'def' || t === 'deff') return 'support';
    return 'attack';
  };

  // ── ABFAHRTSZEIT AUS ANKUNFTSZEIT BERECHNEN ────────────────────────────────
  // Wird für DS-Ultimate JSON gebraucht (dort nur arrival_time vorhanden)
  const calcDepartTs = (srcId, dstId, slowestUnitIdx, arrivalSec) => {
    let sv = window._twOpsAllV && window._twOpsAllV[srcId];
    let dv = window._twOpsAllV && window._twOpsAllV[dstId];
    if (!sv || !dv) return null;

    let dx   = sv.x - dv.x, dy = sv.y - dv.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    let unitKey  = UNIT_IDX[slowestUnitIdx] || 'ram';
    let speedMin = UNIT_SPEED_MIN[unitKey]  || 30;

    // Weltgeschwindigkeit + Einheitengeschwindigkeitsfaktor aus game_data
    let worldSpeed = (typeof game_data !== 'undefined' && game_data.speed)      ? +game_data.speed      : 1;
    let unitSpeed  = (typeof game_data !== 'undefined' && game_data.unit_speed) ? +game_data.unit_speed : 1;

    // Reisezeit in ms  — TW rundet auf ganze Sekunden
    let travelMs = Math.round((dist * speedMin * 60 * 1000) / (worldSpeed * unitSpeed));
    return arrivalSec * 1000 - travelMs;
  };

  // ── DS-ULTIMATE JSON PARSER ────────────────────────────────────────────────
  //
  //  Format: { title, world, items: [{ source, destination, slowest_unit,
  //            arrival_time, type, spy, axe, light, ram, catapult, ... }] }
  //
  //  Besonderheiten:
  //  · source/destination = Dorf-ID  →  Koordinaten aus _twOpsAllV
  //  · arrival_time = Unix-Sekunden  →  departTs via calcDepartTs()
  //  · Truppen als Zahlen hinterlegt →  9999 = "alle verfügbaren"
  //  · type 4 = Unterstützung, sonst = Angriff

  const parseJsonExport = raw => {
    let data;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    if (!data || !Array.isArray(data.items) || !data.items.length) return null;

    if (!window._twOpsAllV || !Object.keys(window._twOpsAllV).length) {
      try { UI.ErrorMessage('Dorfliste noch nicht geladen — kurz warten und erneut versuchen.'); } catch (e) {}
      return null;
    }

    let result = [];
    data.items.forEach((item, i) => {
      let srcId = +item.source, dstId = +item.destination;
      let sv = window._twOpsAllV[srcId];
      let dv = window._twOpsAllV[dstId];

      if (!sv) {
        console.warn('[TW-Ops] Quelldorf-ID nicht gefunden:', srcId);
        return;
      }

      let originCoord   = '(' + sv.x + '|' + sv.y + ')';
      let targetCoord   = dv ? '(' + dv.x + '|' + dv.y + ')' : '(?|?)';
      let originVillage = sv.name || ('Dorf ' + srcId);
      let targetName    = dv ? (dv.name || ('Dorf ' + dstId)) : ('Dorf ' + dstId);

      let aTs = item.arrival_time * 1000;
      let dTs = calcDepartTs(srcId, dstId, item.slowest_unit, item.arrival_time);
      if (!dTs) {
        console.warn('[TW-Ops] Zieldorf-ID nicht gefunden:', dstId);
        return;
      }

      // Truppen aus JSON übernehmen — 9999 = alle verfügbaren
      let troops = {};
      UNITS.forEach(u => {
        let v = item[u.key];
        if (!v || v === '0' || v === 0) return;
        troops[u.key] = (+v >= 9000) ? 'all' : String(v);
      });

      // type: Bit 2 (4) = Unterstützung in TW
      let mode = (item.type === 4) ? 'support' : 'attack';

      result.push({
        id: i, mode,
        type: 'real',
        originVillage, originCoord,
        targetName, targetCoord,
        unitRaw: UNIT_IDX[item.slowest_unit] || '',
        troops,
        departTs: Math.round(dTs), arriveTs: aTs,
        building: '', status: 'pending', statusText: 'Ausstehend',
        timerId: null, _prewarmId: null, nobleGroup: null,
        _srcId: srcId,  // Village-ID direkt für getOriginId
      });
    });

    result.sort((a, b) => a.departTs - b.departTs);
    detectNobleTrains(result);
    return result;
  };

  // ── DS WORKBENCH / TAB-EXPORT PARSER ─────────────────────────────────────
  //
  //  DS Workbench liefert zwei Formate:
  //  MIT Typ-Spalte (8 Felder):    (Fake) | Player | Origin | Unit | TargetPlayer | Target | Dep | Arr
  //  OHNE Typ-Spalte (7 Felder):   Player | Origin | Unit | TargetPlayer | Target | Dep | Arr

  const parseTabExport = raw => {
    let result = [];
    raw.trim().split('\n').forEach((line, i) => {
      line = line.trim(); if (!line) return;
      let c = line.split('\t');

      let typeRaw, oFull, uRaw, tFull, depStr, arrStr;

      if (c.length >= 8) {
        typeRaw = c[0].trim();
        oFull   = c[2].trim();
        uRaw    = c[3].trim();
        tFull   = c[5].trim();
        depStr  = c[6].trim();
        arrStr  = c[7].trim();
      } else if (c.length === 7) {
        // Kein Typ-Präfix → echter Angriff
        typeRaw = 'attack';
        oFull   = c[1].trim();
        uRaw    = c[2].trim();
        tFull   = c[4].trim();
        depStr  = c[5].trim();
        arrStr  = c[6].trim();
      } else {
        return;
      }

      try {
        let oC = (oFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        let tC = (tFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        if (!oC || !tC) return;

        let uKey = null;
        let ul = uRaw.toLowerCase().replace(/\s+/g, '');
        for (let k in UNIT_MAP) { if (ul.includes(k)) { uKey = UNIT_MAP[k]; break; } }

        let dTs = parseTs(depStr), aTs = parseTs(arrStr);
        if (!dTs || !aTs) return;

        let mode   = detectMode(typeRaw);
        let isFake = typeRaw.toLowerCase().replace(/[\s()]/g,'').match(/^f(ake)?$/);

        result.push({
          id: i, mode,
          type: isFake ? 'fake' : 'real',
          originVillage: oFull.replace(/\s*\(.*\).*$/, '').trim(),
          originCoord:   oC,
          targetName:    tFull.replace(/\s*\(.*\).*$/, '').trim(),
          targetCoord:   tC,
          unitRaw:       uRaw,
          troops:        uKey ? { [uKey]: 'all' } : {},
          departTs: dTs, arriveTs: aTs,
          building: '', status: 'pending', statusText: 'Ausstehend',
          timerId: null, _prewarmId: null, nobleGroup: null,
        });
      } catch (e) {}
    });
    result.sort((a, b) => a.departTs - b.departTs);
    detectNobleTrains(result);
    return result;
  };

  // ── AUTO-FORMAT-ERKENNUNG ──────────────────────────────────────────────────
  const parseExport = raw => {
    raw = raw.trim();
    if (raw.startsWith('{')) {
      let res = parseJsonExport(raw);
      if (res !== null) return res;
    }
    return parseTabExport(raw);
  };

  // ── DS-ULTIMATE URL FETCH ──────────────────────────────────────────────────
  //
  //  URL-Format: https://ds-ultimate.de/tools/attackPlanner/{id}/edit/{token}
  //
  //  Versucht mehrere API-Endpunkte der Reihe nach. Schlägt alles fehl (CORS),
  //  wird eine klare Fehlermeldung mit Copy-Tipp angezeigt.

  const DS_URL_RE = /ds-ultimate\.de\/tools\/attackPlanner\/(\d+)\/(?:edit|view)\/([A-Za-z0-9_-]+)/;

  const isDsUltimateUrl = str => DS_URL_RE.test(str);

  const fetchDsUltimatePlan = async url => {
    let m = url.match(DS_URL_RE);
    if (!m) throw new Error('URL nicht erkannt');
    let [, planId, token] = m;

    // Mögliche API-Endpunkte in Prioritätsreihenfolge
    let candidates = [
      `https://ds-ultimate.de/api/attackPlan/${planId}?token=${token}`,
      `https://ds-ultimate.de/api/attackPlanner/${planId}?token=${token}`,
      `https://ds-ultimate.de/api/attackPlanner/${planId}/${token}`,
      `https://ds-ultimate.de/tools/attackPlanner/${planId}/json/${token}`,
      `https://ds-ultimate.de/tools/attackPlanner/${planId}/data/${token}`,
    ];

    let lastErr = '';
    for (let endpoint of candidates) {
      try {
        let resp = await fetch(endpoint, {
          mode: 'cors',
          headers: { 'Accept': 'application/json, text/plain, */*' },
        });
        if (!resp.ok) { lastErr = 'HTTP ' + resp.status; continue; }
        let text = await resp.text();
        // Direkt JSON?
        try {
          let data = JSON.parse(text);
          if (data && Array.isArray(data.items)) return data;
        } catch (e) {}
        // JSON in HTML-Seite eingebettet?
        let patterns = [
          /window\.__plan__\s*=\s*(\{[\s\S]*?\});/,
          /var\s+attackPlan\s*=\s*(\{[\s\S]*?\});/,
          /data-plan="([^"]+)"/,
          /"items"\s*:\s*\[[\s\S]*?\]/,
        ];
        for (let re of patterns) {
          let hit = text.match(re);
          if (hit) {
            try {
              let raw2 = hit[1] ? hit[1].replace(/&quot;/g, '"') : hit[0];
              let data = JSON.parse(raw2.startsWith('{') ? raw2 : '{' + raw2 + '}');
              if (data && Array.isArray(data.items)) return data;
            } catch (e) {}
          }
        }
        lastErr = 'Kein items-Array in Antwort';
      } catch (err) {
        // TypeError = CORS oder Netzwerk
        lastErr = err.message || 'Netzwerkfehler';
      }
    }

    throw new Error(lastErr);
  };

  // ── ADELS-ZUG ERKENNUNG ────────────────────────────────────────────────────
  const detectNobleTrains = list => {
    let byTarget = {};
    list.forEach(op => {
      if (op.troops.snob) {
        if (!byTarget[op.targetCoord]) byTarget[op.targetCoord] = [];
        byTarget[op.targetCoord].push(op);
      }
    });
    Object.entries(byTarget).forEach(([coord, group]) => {
      if (group.length >= 2) group.forEach(op => op.nobleGroup = coord);
    });
  };

  // ── DÖRFER ─────────────────────────────────────────────────────────────────
  // Baut zwei Maps:
  //  _twOpsV     — eigene Dörfer  (für getOriginId via Koordinaten)
  //  _twOpsAllV  — alle Dörfer    (für DS-Ultimate JSON: ID → {x, y, name})

  const loadVillages = () =>
    $.get('/map/village.txt').then(txt => {
      let myId = String(game_data.player.id);
      window._twOpsV    = [];
      window._twOpsAllV = {};
      (txt.match(/[^\r\n]+/g) || []).forEach(l => {
        let p = l.split(',');
        if (p.length < 4) return;
        let id   = +p[0];
        let name = (p[1] || '').trim();
        let x    = +(p[2] || 0);
        let y    = +(p[3] || 0);
        window._twOpsAllV[id] = { x, y, name };
        if (p.length >= 5 && p[4].trim() === myId)
          window._twOpsV.push({ id, x: String(x), y: String(y) });
      });
    }).fail(() => { window._twOpsV = []; window._twOpsAllV = {}; });

  // ── HERKUNFTS-DORF-ID ──────────────────────────────────────────────────────
  const getOriginId = op => {
    // DS-Ultimate JSON liefert die ID direkt
    if (op._srcId) return op._srcId;

    let [ox, oy] = op.originCoord.replace(/[()]/g, '').split('|').map(s => s.trim());
    let cv = game_data.village;
    if (cv && String(cv.x) === ox && String(cv.y) === oy) return cv.id;
    if (window._twOpsV)
      for (let v of window._twOpsV) if (v.x === ox && v.y === oy) return v.id;
    return cv ? cv.id : null;
  };

  // ── STATUS ─────────────────────────────────────────────────────────────────
  const setStatus = (op, txt, cls, rowCls) => {
    if (['sent','error','missed'].includes(cls)) op.status = cls;
    op.statusText = txt;
    save(); updateFloater(); updateBadge();
    let s  = document.getElementById('twOpsSt_'  + op.id);
    let cd = document.getElementById('twOpsCd_'  + op.id);
    let r  = document.getElementById('twOpsRow_' + op.id);
    if (s)  { s.textContent = txt; s.className = 'ops-status-' + cls; }
    if (cd && cls !== 'pending') cd.textContent = '';
    if (r)  {
      let nc = op.nobleGroup ? ' noble-train' : '';
      r.className = (rowCls || cls) + nc;
    }
    if (['sent','error','missed'].includes(cls)) {
      $('[data-op="' + op.id + '"]').prop('disabled', true);
    }
  };

  // ── SOUND ALARM ────────────────────────────────────────────────────────────
  const playAlert = () => {
    try {
      let ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[880,0],[1100,0.25],[880,0.5],[1320,0.75]].forEach(([f, t]) => {
        let o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.35, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.22);
      });
    } catch (e) {}
  };

  // ── SEND-MECHANIK ──────────────────────────────────────────────────────────
  const scheduleOp = op => {
    let prewarmMs = Math.max(0, (op.departTs - CFG.PREWARM_MS) - now());
    op._prewarmId = setTimeout(() => prewarmAndQueue(op), prewarmMs);
  };

  const prewarmAndQueue = op => {
    if (op.status !== 'pending') return;
    setStatus(op, 'Vorlade…', 'pending', 'imminent');
    let vid = getOriginId(op);
    if (!vid) { setStatus(op, 'Dorf nicht gefunden', 'error', 'error'); return; }
    let [tx, ty] = op.targetCoord.replace(/[()]/g, '').split('|').map(s => s.trim());

    loadPlaceAndConfirm(op, vid, tx, ty)
      .then(({ formAction, s2 }) => {
        let waitMs = Math.max(0, (op.departTs - CFG.FIRE_OFFSET) - now());
        op.timerId = setTimeout(() => {
          queueSend(vid, done => fireOp(op, formAction, s2, done));
        }, waitMs);
      })
      .catch(err => setStatus(op, String(err).substring(0, 35), 'error', 'error'));
  };

  const loadPlaceAndConfirm = (op, vid, tx, ty) => {
    let troopData = {};
    UNITS.forEach(u => {
      let v = op.troops[u.key];
      if (v && v !== '0') troopData[u.key] = v;
    });
    if (!Object.keys(troopData).length) return Promise.reject('Keine Truppen');

    return $.get('/game.php?village=' + vid + '&screen=place&x=' + tx + '&y=' + ty)
      .then(html => {
        let $h   = $(html);
        let csrf = $h.find('input[name="h"]').val()
          || (typeof csrf_token !== 'undefined' ? csrf_token : null);
        if (!csrf) {
          $h.find('input[type="hidden"]').each(function () {
            let n = $(this).attr('name') || '';
            if (n && !KNOWN_FIELDS.includes(n)) { csrf = $(this).val(); return false; }
          });
        }

        let modeKey = op.mode === 'support' ? 'support' : 'attack';
        let modeVal = op.mode === 'support' ? 'Unterstützen' : 'Angreifen';
        let s1 = { x: tx, y: ty, target_type: 'coord', source_village: String(vid), [modeKey]: modeVal };
        if (csrf) s1.h = csrf;

        let hasUnits = false;
        UNITS.forEach(u => {
          let val = troopData[u.key]; if (!val) return;
          let $el = $h.find('input[name="' + u.key + '"]'); if (!$el.length) return;
          let avail = parseInt($el.attr('data-all-count') || $el.attr('max') || $el.val() || '0');
          let count;
          if (val === 'all')   count = avail;
          else if (+val < 0)   count = Math.max(0, avail + +val);
          else                 count = Math.min(+val || 0, avail);
          if (count > 0) { s1[u.key] = String(count); hasUnits = true; }
        });
        if (!hasUnits) return Promise.reject('Keine Truppen verfügbar');

        return $.post('/game.php?village=' + vid + '&screen=place&try=confirm', s1)
          .then(cHtml => {
            let $c  = $(cHtml);
            let err = $c.find('.error_box, .system_wide_message').text().trim();
            if (err) return Promise.reject(err.substring(0, 50));

            let $f = $c.find('form[name="confirm_form"]');
            if (!$f.length) {
              $f = $c.find('form').filter(function () {
                return $(this).find('input[name="ch"], input[name="h"]').length > 0
                    || $(this).find('input[name="attack"], input[name="support"]').length > 0;
              }).first();
            }
            if (!$f.length) return Promise.reject('Kein Confirm-Form');

            let fa = $f.attr('action') || '';
            let formAction = fa.startsWith('/') ? fa
              : (!fa ? '/game.php?village=' + vid + '&screen=place' : '/' + fa);

            let s2 = {};
            $f.find('input, select, textarea').each(function () {
              let $e = $(this), n = $e.attr('name');
              let tp = ($e.attr('type') || 'text').toLowerCase();
              if (!n) return;
              if ((tp === 'checkbox' || tp === 'radio') && !$e.prop('checked')) return;
              s2[n] = $e.val() || '';
            });

            if (op.mode === 'support') {
              if (!s2.support) s2.support = 'Unterstützen';
              delete s2.attack;
            } else {
              if (!s2.attack) s2.attack = 'Angreifen';
              delete s2.support;
            }

            if (op.building) s2.building = op.building;
            return { formAction, s2 };
          });
      });
  };

  const fireOp = (op, formAction, s2, done) => {
    if (op.status !== 'pending') { done(); return; }
    $.post(formAction, s2)
      .then(res => {
        let em = $(res).find('.error_box, .system_wide_message').text().trim();
        if (em) {
          setStatus(op, 'Fehler: ' + em.substring(0, 30), 'error', 'error');
        } else {
          setStatus(op, 'Gesendet ✓', 'sent', 'sent');
          try {
            let label = op.mode === 'support' ? '🛡 Support' : '⚔ Angriff';
            UI.SuccessMessage(label + ': ' + op.originCoord + ' → ' + op.targetCoord);
          } catch (e) {}
        }
        done();
      })
      .fail(() => { setStatus(op, 'Fehler beim Senden', 'error', 'error'); done(); });
  };

  // ── ALLE PLANEN ────────────────────────────────────────────────────────────
  const scheduleAll = list => {
    alertFired = false;
    let t = now();
    list.forEach(op => {
      if (op.status !== 'pending') return;
      if (op.departTs < t - (CFG.PREWARM_MS + 5000)) {
        op.status = 'missed'; op.statusText = 'Verpasst'; return;
      }
      scheduleOp(op);
    });
    save();
  };

  const cancelAll = list => {
    list.forEach(op => {
      if (op._prewarmId) { clearTimeout(op._prewarmId); op._prewarmId = null; }
      if (op.timerId)    { clearTimeout(op.timerId);    op.timerId    = null; }
      if (op.status === 'pending') {
        op.status = 'missed'; op.statusText = 'Abgebrochen';
        let s = document.getElementById('twOpsSt_' + op.id);
        let r = document.getElementById('twOpsRow_' + op.id);
        if (s) { s.textContent = 'Abgebrochen'; s.className = 'ops-status-missed'; }
        if (r) r.className = 'missed';
        $('[data-op="' + op.id + '"]').prop('disabled', true);
      }
    });
    if (ticker) { clearInterval(ticker); ticker = null; }
    running = false; save(); updateFloater();
  };

  // ── TICKER ─────────────────────────────────────────────────────────────────
  const startTicker = list => {
    if (ticker) clearInterval(ticker);
    ticker = setInterval(() => {
      let t = now(), allDone = true;

      if (!alertFired && running) {
        let next = list.filter(o => o.status === 'pending')
          .sort((a, b) => a.departTs - b.departTs)[0];
        if (next && (next.departTs - t) / 1000 <= CFG.ALERT_SEC) {
          alertFired = true; playAlert();
        }
      }

      list.forEach(op => {
        if (op.status !== 'pending') return;
        allDone = false;
        let diff = Math.round((op.departTs - t) / 1000);
        let cd   = document.getElementById('twOpsCd_' + op.id);
        let row  = document.getElementById('twOpsRow_' + op.id);
        if (!cd) return;

        if (diff > 0) {
          let hh = Math.floor(diff / 3600);
          let mm = Math.floor((diff % 3600) / 60);
          let ss = diff % 60;
          cd.textContent = (hh ? hh + 'h ' : '')
            + (mm || hh ? String(mm).padStart(2, '0') + 'm ' : '')
            + String(ss).padStart(2, '0') + 's';
          if (diff <= 10 && row && !row.className.includes('imminent'))
            row.className = 'imminent' + (op.nobleGroup ? ' noble-train' : '');
        } else if (diff > -30) {
          cd.textContent = '⚡ Sendet…';
        }
      });

      updateBadge();
      updateSummary(list);
      refreshTimeline(list);

      if (allDone) {
        clearInterval(ticker); ticker = null;
        updateSummary(list, true); updateFloater();
      }
    }, 500);
  };

  // ── FILTER / SORT ──────────────────────────────────────────────────────────
  const getDisplayOps = () => {
    let list = ops.filter(op => {
      if (filterSt !== 'all' && op.status !== filterSt) return false;
      if (filterType !== 'all' && op.mode !== filterType) return false;
      if (filterSearch) {
        let s = filterSearch.toLowerCase();
        return op.originCoord.includes(s) || op.targetCoord.includes(s)
            || op.originVillage.toLowerCase().includes(s)
            || op.targetName.toLowerCase().includes(s);
      }
      return true;
    });
    list.sort((a, b) => {
      let va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });
    return list;
  };

  const getPageOps = () => {
    let all   = getDisplayOps();
    let start = page * CFG.PAGE_SIZE;
    return { slice: all.slice(start, start + CFG.PAGE_SIZE), total: all.length };
  };

  // ── TABELLEN-RENDERING ─────────────────────────────────────────────────────
  const troopCell = op => {
    let dis = op.status !== 'pending' ? ' disabled' : '';
    let h   = '<div class="otc">';
    UNITS.forEach(u => {
      let v  = op.troops[u.key] || '';
      let dv = v === 'all' ? '' : v;
      let ph = v === 'all' ? 'alle' : '0';
      h += '<div class="ote"><label>' + u.label + '</label>'
        + '<div style="display:flex;align-items:center">'
        + '<input class="oti" type="text" data-op="' + op.id + '" data-unit="' + u.key + '"'
        + ' value="' + dv + '" placeholder="' + ph + '"' + dis + '>'
        + '<button class="oab" data-op="' + op.id + '" data-unit="' + u.key + '"' + dis + '>∞</button>'
        + '</div></div>';
    });
    h += '</div>';
    let opts = BUILDINGS.map(b =>
      '<option value="' + b.key + '"' + (op.building === b.key ? ' selected' : '') + '>' + b.label + '</option>'
    ).join('');
    h += '<div class="okt">🪨 <select class="oks" data-op="' + op.id + '"' + dis + '>' + opts + '</select></div>';
    return h;
  };

  const fmtTs = ts => new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const sortArrow = key => sortKey !== key ? '' : (sortDir === 1 ? ' ▲' : ' ▼');

  const buildTable = (slice, total) => {
    let totalPages = Math.ceil(total / CFG.PAGE_SIZE);
    let pagination = totalPages > 1
      ? '<div class="ops-pages">'
        + '<button class="ops-pnav" id="twOpsPrev"' + (page === 0 ? ' disabled' : '') + '>◀</button>'
        + ' Seite <b>' + (page + 1) + '</b> / ' + totalPages
        + ' &nbsp;<button class="ops-pnav" id="twOpsNext"'
        + (page >= totalPages - 1 ? ' disabled' : '') + '>▶</button>'
        + ' <span style="font-size:10px;color:#888">' + slice.length + ' von ' + total + ' Ops</span>'
        + '</div>'
      : '';

    if (!slice.length)
      return pagination + '<p style="text-align:center;color:#c00;padding:10px">Keine Operationen gefunden.</p>';

    let h = pagination
      + '<table class="ops-t"><tr>'
      + '<th><input type="checkbox" id="twOChkAll" title="Alle auf Seite wählen"></th>'
      + '<th>#</th>'
      + '<th class="ops-sortable" data-sort="mode">Typ' + sortArrow('mode') + '</th>'
      + '<th class="ops-sortable" data-sort="originVillage">Herkunft' + sortArrow('originVillage') + '</th>'
      + '<th class="ops-sortable" data-sort="targetName">Ziel' + sortArrow('targetName') + '</th>'
      + '<th>Truppen &amp; Kata-Ziel</th>'
      + '<th class="ops-sortable" data-sort="departTs">Abfahrt' + sortArrow('departTs') + '</th>'
      + '<th class="ops-sortable" data-sort="arriveTs">Ankunft' + sortArrow('arriveTs') + '</th>'
      + '<th>Countdown</th><th>Status</th><th>–</th>'
      + '</tr>';

    slice.forEach(op => {
      let realIdx    = ops.indexOf(op) + 1;
      let nobleClass = op.nobleGroup ? ' noble-train' : '';
      let modeIcon   = op.mode === 'support'
        ? '<span class="badge-sup" title="Unterstützung">🛡</span>'
        : (op.type === 'fake'
          ? '<span class="badge-fake" title="Fake">F</span>'
          : '<span class="badge-atk" title="Angriff">⚔</span>');
      let nobleIcon  = op.nobleGroup ? ' <span class="badge-noble" title="Adels-Zug">👑</span>' : '';
      let modeToggle = op.status === 'pending'
        ? '<button class="ops-modetgl" data-op="' + op.id + '" title="Typ wechseln"'
          + ' style="font-size:9px;padding:0 3px;border:1px solid #aaa;border-radius:2px;'
          + 'background:#f4eed4;cursor:pointer;margin-left:2px;">'
          + (op.mode === 'support' ? '→⚔' : '→🛡') + '</button>'
        : '';

      h += '<tr id="twOpsRow_' + op.id + '" class="' + op.status + nobleClass + '">'
        + '<td><input type="checkbox" class="ops-chk" data-op="' + op.id + '"></td>'
        + '<td>' + realIdx + '</td>'
        + '<td>' + modeIcon + nobleIcon + modeToggle + '</td>'
        + '<td style="text-align:left" title="' + op.originCoord + '">' + op.originVillage + '</td>'
        + '<td style="text-align:left" title="' + op.targetCoord + '">' + op.targetName + '</td>'
        + '<td>' + (op.status === 'pending'
            ? troopCell(op)
            : '<span style="color:#888;font-size:10px">' + op.statusText + '</span>') + '</td>'
        + '<td style="white-space:nowrap">' + fmtTs(op.departTs) + '</td>'
        + '<td style="white-space:nowrap">' + fmtTs(op.arriveTs) + '</td>'
        + '<td><span id="twOpsCd_' + op.id + '" class="ops-cd">--</span></td>'
        + '<td><span id="twOpsSt_' + op.id + '" class="ops-status-' + op.status + '">'
          + (op.statusText || 'Ausstehend') + '</span></td>'
        + '<td style="white-space:nowrap">'
        + (op.status === 'pending'
          ? '<button class="ops-del" data-del="' + op.id + '" title="Überspringen">✕</button>'
          : (op.status === 'error'
            ? '<button class="ops-retry" data-retry="' + op.id + '" title="Erneut">↺</button>'
            : ''))
        + '</td></tr>';
    });

    return h + '</table>' + pagination;
  };

  // ── TIMELINE ───────────────────────────────────────────────────────────────
  const fmtSec = sec => {
    let hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    return (hh ? hh + 'h ' : '') + (mm || hh ? String(mm).padStart(2,'0') + 'm ' : '') + String(ss).padStart(2,'0') + 's';
  };

  const buildTimeline = list => {
    let pending = list.filter(o => o.status === 'pending').sort((a, b) => a.departTs - b.departTs);
    if (!pending.length) return '';
    let t       = now();
    let first   = pending[0];
    let last    = pending[pending.length - 1];
    let secFirst = Math.max(0, Math.round((first.departTs - t) / 1000));
    let wins    = [5, 15, 30, 60];
    let wLabels = ['5min', '15min', '30min', '60min'];
    let wCounts = wins.map(w => pending.filter(o => (o.departTs - t) / 60000 <= w).length);
    let supCnt  = pending.filter(o => o.mode === 'support').length;
    let atkCnt  = pending.filter(o => o.mode === 'attack').length;

    return '<div id="twOTimeline" style="margin:4px 0;padding:5px 8px;'
      + 'background:#fff3cd;border:1px solid #ffc107;border-radius:3px;font-size:10px;">'
      + '📅 <b>Timeline</b> — '
      + 'Nächste Op: <b id="twOTLFirst">' + fmtSec(secFirst) + '</b>'
      + ' (' + fmtTs(first.departTs) + ')'
      + ' &nbsp;|&nbsp; Letzte: ' + fmtTs(last.departTs)
      + ' &nbsp;|&nbsp; ⚔ <b>' + atkCnt + '</b> Angriffe &nbsp;🛡 <b>' + supCnt + '</b> Supports'
      + '<br>'
      + wins.map((_, i) => '<b>' + wCounts[i] + '</b> in ' + wLabels[i]).join(' &nbsp;|&nbsp; ')
      + '</div>';
  };

  const refreshTimeline = list => {
    let el = document.getElementById('twOTLFirst');
    if (!el) return;
    let first = list.filter(o => o.status === 'pending').sort((a, b) => a.departTs - b.departTs)[0];
    if (!first) return;
    el.textContent = fmtSec(Math.max(0, Math.round((first.departTs - now()) / 1000)));
  };

  // ── PRESETS-PANEL ──────────────────────────────────────────────────────────
  const buildPresetsPanel = () => {
    let h = '<div id="twOPresPanel" style="margin:4px 0;padding:6px 8px;'
      + 'background:#f4eed4;border:1px solid #7D510F;border-radius:3px;">'
      + '<b style="font-size:11px">⚙ Truppen-Presets</b>'
      + '<div id="twOPresList" style="margin:4px 0;min-height:18px">';

    if (!presets.length) {
      h += '<span style="font-size:10px;color:#888">Noch keine Presets gespeichert.</span>';
    } else {
      presets.forEach((p, i) => {
        let summary = UNITS.filter(u => p.troops[u.key])
          .map(u => u.label + ':' + (p.troops[u.key] === 'all' ? '∞' : p.troops[u.key]))
          .join(' ');
        h += '<div style="display:flex;gap:5px;align-items:center;margin:2px 0;font-size:10px">'
          + '<b>' + p.name + '</b> <span style="color:#888">' + (summary || 'leer') + '</span>'
          + '<button class="oab" data-preset-del="' + i + '" title="Löschen" style="margin-left:4px">✕</button>'
          + '</div>';
      });
    }

    h += '</div><hr style="margin:4px 0;border-color:#c8b07a">'
      + '<div style="display:flex;gap:4px;align-items:flex-end;flex-wrap:wrap;font-size:10px">'
      + '<div><label>Name:<br>'
      + '<input type="text" id="twOPreName" placeholder="z.B. Axt-Off" style="width:110px;font-size:10px;padding:2px 4px"></label></div>';
    UNITS.forEach(u => {
      h += '<div class="ote" style="font-size:9px"><label>' + u.label + '</label>'
        + '<div style="display:flex;align-items:center">'
        + '<input class="oti" type="text" id="twOPreU_' + u.key + '" placeholder="0" style="width:30px">'
        + '<button class="oab" data-preunit="' + u.key + '" title="alle">∞</button>'
        + '</div></div>';
    });
    h += '<button class="btn" id="twOPreSave" style="font-size:10px;padding:3px 10px;'
      + 'background:#2a7;color:#fff;align-self:flex-end">💾 Speichern</button>'
      + '</div></div>';
    return h;
  };

  // ── BULK-BAR ───────────────────────────────────────────────────────────────
  const buildBulkBar = () =>
    '<div id="twOBulk" style="display:none;margin:4px 0;padding:5px 8px;'
    + 'background:#ffe0b2;border:1px solid #e65100;border-radius:3px;'
    + 'align-items:center;gap:6px;flex-wrap:wrap;">'
    + '<b id="twOBulkCount" style="font-size:11px;min-width:80px">0 gewählt</b>'
    + '<button class="btn" id="twOBulkAtk"  style="font-size:10px;padding:2px 8px">⚔ → Angriff</button>'
    + '<button class="btn" id="twOBulkSup"  style="font-size:10px;padding:2px 8px">🛡 → Support</button>'
    + '<button class="btn" id="twOBulkSkip" style="font-size:10px;padding:2px 8px;background:#c44;color:#fff">✕ Überspringen</button>'
    + '<select id="twOBulkPreset" style="font-size:10px;padding:2px 4px;border:1px solid #aaa;border-radius:2px">'
    + '<option value="">— Preset auf Auswahl anwenden —</option>'
    + presets.map((p, i) => '<option value="' + i + '">' + p.name + '</option>').join('')
    + '</select>'
    + '</div>';

  // ── FLOATER ────────────────────────────────────────────────────────────────
  const createFloater = () => {
    if (document.getElementById('twOpsFloater')) return;
    let el = document.createElement('div');
    el.id = 'twOpsFloater';
    el.title = 'Klicken um Scheduler zu öffnen (Strg+Shift+O)';
    el.style.cssText =
      'position:fixed;bottom:80px;right:0;z-index:99999;'
      + 'background:#7D510F;color:#fff;border-radius:6px 0 0 6px;'
      + 'padding:8px 10px 8px 12px;cursor:pointer;font:bold 11px Arial,sans-serif;'
      + 'box-shadow:-2px 0 8px rgba(0,0,0,.4);display:none;'
      + 'border:2px solid #5a3a08;border-right:none;user-select:none;transition:background .3s;';
    el.addEventListener('click', openDialog);
    document.body.appendChild(el);
  };

  const updateFloater = () => {
    let el = document.getElementById('twOpsFloater');
    if (!el) return;
    if (!ops.length) { el.style.display = 'none'; return; }
    let p = ops.filter(o => o.status === 'pending').length;
    let s = ops.filter(o => o.status === 'sent').length;
    let e = ops.filter(o => o.status === 'error').length;
    el.style.display = 'block';
    if (p === 0) {
      el.style.background = '#2d7a36';
      el.textContent = '✓ ' + s + ' gesendet' + (e ? ' | ' + e + ' ✗' : '') + ' — öffnen';
      setTimeout(() => {
        wipePlan();
        if (ticker) { clearInterval(ticker); ticker = null; }
        let fe = document.getElementById('twOpsFloater');
        if (fe) fe.style.display = 'none';
      }, 15000);
    } else {
      el.style.background = running ? '#c47a00' : '#7D510F';
      el.textContent = (running ? '▶ ' : '⏸ ') + p + ' pend.'
        + (s ? ' | ' + s + ' ✓' : '') + (e ? ' | ' + e + ' ✗' : '') + ' — öffnen';
    }
  };

  // ── SUMMARY / BADGE ────────────────────────────────────────────────────────
  const updateSummary = (list, done) => {
    let el = document.getElementById('twOSumm');
    if (!el) return;
    let p  = list.filter(o => o.status === 'pending').length;
    let s  = list.filter(o => o.status === 'sent').length;
    let e  = list.filter(o => o.status === 'error').length;
    let m  = list.filter(o => o.status === 'missed').length;
    let su = list.filter(o => o.status === 'pending' && o.mode === 'support').length;
    let at = list.filter(o => o.status === 'pending' && o.mode === 'attack').length;
    $(el).show().html(
      (done ? '<b>Abgeschlossen.</b> ' : '<b>' + (running ? '▶ Aktiv' : '⏸ Bereit') + '</b> — ')
      + 'Ausstehend: <b>' + p + '</b>'
      + (p > 0 ? ' (⚔ ' + at + ' / 🛡 ' + su + ')' : '')
      + ' | Gesendet: <b style="color:#155724">' + s + '</b>'
      + ' | Fehler: <b style="color:#721c24">' + e + '</b>'
      + (m ? ' | Skip/Verpasst: <b style="color:#856404">' + m + '</b>' : '')
    );
  };

  const updateBadge = () => {
    let el = document.getElementById('twObadge');
    if (!el) return;
    let p = ops.filter(o => o.status === 'pending').length;
    let s = ops.filter(o => o.status === 'sent').length;
    el.className = 'ops-badge' + (p > 0 && running ? ' warn' : '');
    el.textContent = p > 0 ? p + ' ausstehend' : s + ' gesendet ✓';
  };

  const updateBulkBar = () => {
    let ids = getSelectedIds();
    if (!ids.length) { $('#twOBulk').hide(); return; }
    $('#twOBulk').css('display', 'flex');
    $('#twOBulkCount').text(ids.length + ' gewählt');
  };

  // ── CSS ────────────────────────────────────────────────────────────────────
  const buildCSS = () => `<style>
    #popup_box_TWOps{width:1080px!important;max-height:94vh;overflow-y:auto}
    #twOB{font-family:Arial,sans-serif;font-size:11px}
    #twOB h3{margin:0 0 5px;font-size:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .ops-badge{background:#2d7a36;color:#fff;border-radius:10px;padding:1px 9px;font-size:10px;font-weight:bold}
    .ops-badge.warn{background:#c47a00;animation:opsPulse 1s ease-in-out infinite}
    @keyframes opsPulse{0%,100%{opacity:1}50%{opacity:.55}}
    #twOB textarea{width:100%;height:75px;font-size:10px;resize:vertical;box-sizing:border-box}
    .ops-tb{margin:4px 0;display:flex;gap:5px;align-items:center;flex-wrap:wrap}
    #twOB table.ops-t{width:100%;border-collapse:collapse;margin-top:4px}
    #twOB table.ops-t th{background:#7D510F;color:#fff;padding:3px 5px;text-align:center;
      white-space:nowrap;cursor:default;font-size:11px}
    #twOB table.ops-t th.ops-sortable{cursor:pointer}
    #twOB table.ops-t th.ops-sortable:hover{background:#9a6322}
    #twOB table.ops-t td{padding:2px 4px;border-bottom:1px solid #ccc;text-align:center;vertical-align:middle}
    #twOB tr.pending  td{background:#f4eed4}
    #twOB tr.sent     td{background:#d4edda}
    #twOB tr.error    td{background:#f8d7da}
    #twOB tr.missed   td{background:#fff3cd}
    #twOB tr.imminent td{background:#ffe0b2;font-weight:bold}
    #twOB tr.noble-train td{border-left:3px solid #9b59b6!important}
    .ops-cd{font-weight:bold;color:#7D510F}
    .ops-status-sent{color:#155724;font-weight:bold}
    .ops-status-error{color:#721c24;font-weight:bold}
    .ops-status-missed{color:#856404;font-weight:bold}
    .ops-status-pending{color:#555}
    .oti{width:30px;text-align:center;font-size:10px;padding:1px;border:1px solid #ccc;border-radius:2px}
    .oti:disabled{background:#eee;color:#bbb;border-color:#ddd}
    .oab{font-size:9px;padding:1px 2px;cursor:pointer;border:1px solid #aaa;border-radius:2px;background:#f4eed4}
    .oab:disabled{color:#bbb;cursor:not-allowed}
    .oks{font-size:10px;padding:1px;border-radius:2px;border:1px solid #aaa;background:#fff;cursor:pointer;max-width:125px}
    .oks:disabled{background:#eee;color:#bbb}
    #twOSumm{margin-top:4px;padding:4px 8px;background:#f4eed4;border:1px solid #7D510F;border-radius:3px}
    .otc{display:flex;flex-wrap:wrap;gap:1px;justify-content:center}
    .ote{display:flex;flex-direction:column;align-items:center;font-size:9px}
    .ote label{color:#555;margin-bottom:1px}
    .okt{margin-top:3px;font-size:9px;text-align:center}
    .ops-del,.ops-retry{font-size:10px;color:#888;cursor:pointer;padding:1px 4px;
      border:1px solid #ccc;border-radius:2px;background:#fff;line-height:1}
    .ops-del:hover{background:#f8d7da;border-color:#f44}
    .ops-retry{color:#155724;border-color:#28a745}
    .ops-retry:hover{background:#d4edda}
    .ops-pages{margin:3px 0;font-size:11px;text-align:center}
    .ops-pnav{padding:2px 8px;cursor:pointer;border:1px solid #7D510F;border-radius:3px;background:#f4eed4;font-size:11px}
    .ops-pnav:disabled{opacity:.4;cursor:not-allowed}
    .badge-atk{color:#c00;font-weight:bold}
    .badge-fake{color:#888;font-weight:bold;font-size:10px}
    .badge-noble{font-size:10px}
    .ops-filter-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;
      margin:3px 0;padding:4px 6px;background:#eee;border-radius:3px;font-size:10px}
    .ops-filter-bar select,.ops-filter-bar input[type="text"]{font-size:10px;padding:2px 4px;border:1px solid #ccc;border-radius:2px}
    #twOImportWrap{margin-bottom:3px}
    #twOImportToggle{font-size:10px;color:#7D510F;cursor:pointer;text-decoration:underline;display:inline-block;margin-top:1px}
    .ops-hint{font-size:9px;color:#888;margin:2px 0 0}
  </style>`;

  // ── DIALOG ─────────────────────────────────────────────────────────────────
  const openDialog = () => {
    let hasPlan  = ops.length > 0;
    let pCount   = ops.filter(o => o.status === 'pending').length;
    let { slice, total } = hasPlan ? getPageOps() : { slice: [], total: 0 };

    let ui = buildCSS()
      + '<div id="twOB">'
      + '<h3>⚔ Operation Scheduler v4'
      + (hasPlan
        ? ' <span id="twObadge" class="ops-badge' + (pCount > 0 && running ? ' warn' : '') + '">'
          + (pCount > 0 ? pCount + ' ausstehend' : ops.filter(o => o.status === 'sent').length + ' gesendet ✓')
          + '</span>'
        : '')
      + '<span style="font-size:9px;color:#888;margin-left:auto">Strg+Shift+O zum Öffnen</span>'
      + '</h3>'

      + '<div id="twOImportWrap"' + (hasPlan ? ' style="display:none"' : '') + '>'
      + '<textarea id="twOTxt" placeholder="Einfügen — drei Formate werden erkannt:\n'
      + '• DS-Ultimate Link   →  https://ds-ultimate.de/tools/attackPlanner/…/edit/…\n'
      + '• DS-Ultimate JSON   →  { &quot;title&quot;: ..., &quot;items&quot;: [...] }\n'
      + '• DS Workbench Tab   →  (Fake)  Dorf  Einheit  Ziel  Abfahrt  Ankunft"></textarea>'
      + '<p class="ops-hint">Link: Plan wird automatisch von DS-Ultimate geladen (erfordert Internetzugriff vom Spielfenster). JSON/Tab: direkt parsen.</p>'
      + '</div>'
      + (hasPlan ? '<a id="twOImportToggle">▼ Neuen Export laden</a>' : '')

      + '<div class="ops-tb">'
      + (!hasPlan
        ? '<input type="button" id="twOBtnLoad"   class="btn" value="Laden">'
        : '<input type="button" id="twOBtnNew"    class="btn" value="🗑 Neu laden" style="background:#888;color:#fff;">')
      + '<input type="button" id="twOBtnStart"  class="btn" value="▶ Starten"'
        + ((!hasPlan || running) ? ' disabled' : '') + ' style="background:#2a7;color:#fff;">'
      + '<input type="button" id="twOBtnCancel" class="btn" value="■ Abbrechen"'
        + (!running ? ' disabled' : '') + ' style="background:#c44;color:#fff;">'
      + '<input type="button" id="twOBtnSave"   class="btn" value="💾 Speichern"'
        + (!hasPlan ? ' disabled' : '') + ' style="background:#1a6;color:#fff;">'
      + '<input type="button" id="twOBtnPresets" class="btn" value="⚙ Presets" style="background:#7D510F;color:#fff;">'
      + '</div>'

      + (hasPlan
        ? '<div class="ops-filter-bar">'
          + '🔍 <input type="text" id="twOFSearch" placeholder="Koord. / Dorf suchen…" style="width:155px" value="' + filterSearch + '">'
          + ' Status: <select id="twOFStatus">'
          + ['all','pending','sent','error','missed'].map(s =>
            '<option value="' + s + '"' + (filterSt === s ? ' selected' : '') + '>'
            + { all:'Alle', pending:'Ausstehend', sent:'Gesendet', error:'Fehler', missed:'Verpasst' }[s]
            + '</option>'
          ).join('')
          + '</select>'
          + ' Typ: <select id="twOFType">'
          + '<option value="all"' + (filterType === 'all' ? ' selected' : '') + '>Alle</option>'
          + '<option value="attack"' + (filterType === 'attack' ? ' selected' : '') + '>⚔ Angriff</option>'
          + '<option value="support"' + (filterType === 'support' ? ' selected' : '') + '>🛡 Support</option>'
          + '</select>'
          + '<button class="oab" id="twOFReset">× Filter zurücksetzen</button>'
          + '</div>'
        : '')

      + '<div id="twOPresWrap" style="display:none"></div>'
      + buildBulkBar()
      + (hasPlan ? buildTimeline(ops) : '')
      + '<div id="twOSumm"' + (!hasPlan ? ' style="display:none"' : '') + '></div>'
      + '<div id="twOTbl">' + (hasPlan ? buildTable(slice, total) : '') + '</div>'
      + '</div>';

    Dialog.show('TWOps', ui);

    if (hasPlan) {
      updateSummary(ops, !running && pCount === 0);
      if (running && pCount > 0) startTicker(ops);
    }

    bindEvents();
  };

  // ── HILFSFUNKTIONEN ────────────────────────────────────────────────────────
  const readFromTable = list => {
    list.forEach(op => {
      if (op.status !== 'pending') return;
      UNITS.forEach(u => {
        let inp = document.querySelector('input.oti[data-op="' + op.id + '"][data-unit="' + u.key + '"]');
        if (!inp) return;
        let v = inp.value.trim();
        if (!v && inp.placeholder === 'alle') op.troops[u.key] = 'all';
        else if (!v || v === '0') delete op.troops[u.key];
        else op.troops[u.key] = v;
      });
      let ks = document.querySelector('.oks[data-op="' + op.id + '"]');
      if (ks) op.building = ks.value;
    });
  };

  const rerender = () => {
    let { slice, total } = getPageOps();
    $('#twOTbl').html(buildTable(slice, total));
    bindTableEvents();
    updateBulkBar();
  };

  const getSelectedIds = () =>
    $('.ops-chk:checked').map(function () { return +$(this).data('op'); }).get();

  // ── EVENT-BINDUNG ──────────────────────────────────────────────────────────
  const bindTableEvents = () => {
    $('.ops-sortable').off('click').on('click', function () {
      let k = $(this).data('sort');
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
      rerender();
    });

    $('#twOpsPrev').off('click').on('click', () => { page = Math.max(0, page - 1); rerender(); });
    $('#twOpsNext').off('click').on('click', () => {
      page = Math.min(Math.ceil(getDisplayOps().length / CFG.PAGE_SIZE) - 1, page + 1);
      rerender();
    });

    $('#twOChkAll').off('change').on('change', function () {
      $('.ops-chk').prop('checked', $(this).prop('checked'));
      updateBulkBar();
    });
    $(document).off('change.opsChk').on('change.opsChk', '.ops-chk', updateBulkBar);
  };

  const bindPresetEvents = () => {
    $('[data-preunit]').off('click').on('click', function () {
      $('#twOPreU_' + $(this).data('preunit')).val('').attr('placeholder', 'alle');
    });

    $('#twOPreSave').off('click').on('click', () => {
      let name = $('#twOPreName').val().trim();
      if (!name) { try { UI.ErrorMessage('Preset-Name fehlt!'); } catch (e) {} return; }
      let troops = {};
      UNITS.forEach(u => {
        let inp = $('#twOPreU_' + u.key);
        let v   = inp.val().trim();
        let ph  = inp.attr('placeholder');
        if (!v && ph === 'alle') troops[u.key] = 'all';
        else if (v && v !== '0') troops[u.key] = v;
      });
      presets.push({ name, troops });
      savePresets();
      try { UI.SuccessMessage('Preset "' + name + '" gespeichert!'); } catch (e) {}
      $('#twOPresWrap').html(buildPresetsPanel());
      bindPresetEvents();
      $('#twOBulkPreset').html(
        '<option value="">— Preset auf Auswahl anwenden —</option>'
        + presets.map((p, i) => '<option value="' + i + '">' + p.name + '</option>').join('')
      );
    });

    $('[data-preset-del]').off('click').on('click', function () {
      let i = +$(this).data('preset-del');
      if (!confirm('Preset "' + presets[i].name + '" löschen?')) return;
      presets.splice(i, 1);
      savePresets();
      $('#twOPresWrap').html(buildPresetsPanel());
      bindPresetEvents();
    });
  };

  const bindEvents = () => {
    bindTableEvents();

    $('#twOImportToggle').off('click').on('click', function () {
      let hidden = $('#twOImportWrap').is(':hidden');
      $('#twOImportWrap').toggle();
      $(this).text(hidden ? '▲ Import ausblenden' : '▼ Neuen Export laden');
    });

    $('#twOBtnLoad').off('click').on('click', async () => {
      let raw = $('#twOTxt').val().trim();
      if (!raw) { try { UI.ErrorMessage('Bitte Export oder Link einfügen.'); } catch (e) {} return; }

      // ── DS-Ultimate Link ───────────────────────────────────────────────────
      if (isDsUltimateUrl(raw)) {
        let $btn = $('#twOBtnLoad');
        $btn.prop('disabled', true).val('⏳ Lade…');
        $('#twOTxt').prop('disabled', true);
        try {
          let data = await fetchDsUltimatePlan(raw);
          ops = parseJsonExport(JSON.stringify(data));
          // Geparsten JSON zur Info in Textarea zeigen
          $('#twOTxt').val(JSON.stringify(data, null, 2));
        } catch (err) {
          $btn.prop('disabled', false).val('Laden');
          $('#twOTxt').prop('disabled', false);
          let msg = String(err.message || err);
          // CORS-Fehler → hilfreicher Hinweis
          let hint = msg.toLowerCase().includes('cors') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed')
            ? '\n→ CORS blockiert: Öffne den Link im Browser, kopiere den JSON-Export und füge ihn hier ein.'
            : '\n→ ' + msg;
          try { UI.ErrorMessage('DS-Ultimate nicht erreichbar.' + hint.replace('\n→ ', ' ')); } catch (e) {}
          $('#twOTxt').val(raw + '\n\n⚠ Fehler: ' + msg
            + '\n\nFallback: Öffne https://ds-ultimate.de → Plan → Export (JSON) → hier einfügen.');
          return;
        }
        $btn.prop('disabled', false).val('Laden');
        $('#twOTxt').prop('disabled', false);
        if (!ops || !ops.length) {
          try { UI.ErrorMessage('Plan geladen, aber keine Ops erkannt.'); } catch (e) {} return;
        }
      } else {
        // ── JSON oder Tab-Export ───────────────────────────────────────────
        ops = parseExport(raw);
        if (!ops || !ops.length) {
          try { UI.ErrorMessage('Keine Ops erkannt — Format prüfen.'); } catch (e) {} return;
        }
      }

      page = 0; running = false; save(); updateFloater();
      let { slice, total } = getPageOps();
      $('#twOTbl').html(buildTable(slice, total));
      bindTableEvents();
      $('#twOBtnStart,#twOBtnSave').prop('disabled', false);
      $('#twOSumm').show(); updateSummary(ops);
      let supCnt = ops.filter(o => o.mode === 'support').length;
      let nblCnt = ops.filter(o => o.nobleGroup).length;
      try {
        UI.SuccessMessage(ops.length + ' Ops geladen'
          + (supCnt ? ' · 🛡 ' + supCnt + ' Supports' : '')
          + (nblCnt ? ' · 👑 ' + nblCnt + ' Adels-Zug' : '') + '.');
      } catch (e) {}
    });

    $('#twOBtnNew').off('click').on('click', () => {
      if (running && !confirm('Laufenden Plan abbrechen und neuen laden?')) return;
      cancelAll(ops); wipePlan(); page = 0;
      filterSt = 'all'; filterType = 'all'; filterSearch = '';
      Dialog.close(); openDialog();
    });

    $('#twOBtnStart').off('click').on('click', () => {
      if (!ops.length) return;
      readFromTable(ops);
      let pend = ops.filter(o => o.status === 'pending');
      if (pend.every(o => !Object.keys(o.troops).length)) {
        try { UI.ErrorMessage('Bitte Truppen eintragen!'); } catch (e) {} return;
      }
      scheduleAll(ops); startTicker(ops); updateSummary(ops);
      running = true; alertFired = false; save(); updateFloater();
      $('#twOBtnStart').prop('disabled', true);
      $('#twOBtnCancel').prop('disabled', false);
      try {
        UI.SuccessMessage(pend.length + ' Ops geplant — Fenster kann geschlossen werden! '
          + '(Sound-Alarm ' + CFG.ALERT_SEC + 's vor erster Op)');
      } catch (e) {}
    });

    $('#twOBtnCancel').off('click').on('click', () => {
      if (!confirm('Alle ausstehenden Ops abbrechen?')) return;
      cancelAll(ops);
      $('#twOBtnCancel').prop('disabled', true);
      $('#twOBtnStart').prop('disabled', false);
      updateSummary(ops); rerender();
    });

    $('#twOBtnSave').off('click').on('click', () => {
      readFromTable(ops); save();
      try { UI.SuccessMessage('Änderungen gespeichert!'); } catch (e) {}
    });

    $('#twOBtnPresets').off('click').on('click', () => {
      let wrap = $('#twOPresWrap');
      if (wrap.is(':hidden')) { wrap.html(buildPresetsPanel()).show(); bindPresetEvents(); }
      else wrap.hide();
    });

    let debounceFilter;
    $('#twOFSearch').off('input').on('input', function () {
      filterSearch = $(this).val(); clearTimeout(debounceFilter);
      debounceFilter = setTimeout(() => { page = 0; rerender(); }, 250);
    });
    $('#twOFStatus').off('change').on('change', function () { filterSt   = $(this).val(); page = 0; rerender(); });
    $('#twOFType'  ).off('change').on('change', function () { filterType = $(this).val(); page = 0; rerender(); });
    $('#twOFReset' ).off('click' ).on('click',  () => {
      filterSt = 'all'; filterType = 'all'; filterSearch = ''; page = 0;
      $('#twOFSearch').val(''); $('#twOFStatus').val('all'); $('#twOFType').val('all');
      rerender();
    });

    $(document).off('click.opsMT').on('click.opsMT', '.ops-modetgl', function () {
      let op = ops.find(o => o.id === +$(this).data('op') && o.status === 'pending');
      if (!op) return;
      op.mode = op.mode === 'support' ? 'attack' : 'support';
      save(); rerender(); updateSummary(ops);
    });

    $(document).off('click.opsDel').on('click.opsDel', '.ops-del', function () {
      let op = ops.find(o => o.id === +$(this).data('del') && o.status === 'pending');
      if (!op) return;
      if (!confirm('Op #' + (ops.indexOf(op) + 1) + ' (' + op.targetCoord + ') überspringen?')) return;
      if (op._prewarmId) { clearTimeout(op._prewarmId); op._prewarmId = null; }
      if (op.timerId)    { clearTimeout(op.timerId);    op.timerId    = null; }
      op.status = 'missed'; op.statusText = 'Übersprungen';
      save(); updateFloater(); updateSummary(ops); rerender();
    });

    $(document).off('click.opsRetry').on('click.opsRetry', '.ops-retry', function () {
      let op = ops.find(o => o.id === +$(this).data('retry') && o.status === 'error');
      if (!op) return;
      op.status = 'pending'; op.statusText = 'Ausstehend (Retry)';
      if (running) scheduleOp(op);
      save(); rerender(); updateSummary(ops);
    });

    $(document).off('click.opsAB').on('click.opsAB',
      '.oab:not([disabled]):not([data-preunit]):not([data-preset-del])',
      function () {
        let oid  = $(this).data('op');
        let unit = $(this).data('unit');
        if (!oid || !unit) return;
        $('input.oti[data-op="' + oid + '"][data-unit="' + unit + '"]')
          .val('').attr('placeholder', 'alle');
      });

    let debounce;
    $(document).off('input.opsIN change.opsIN')
      .on('input.opsIN change.opsIN', '.oti:not([disabled]), .oks:not([disabled])', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { readFromTable(ops); save(); }, 700);
      });

    $('#twOBulkAtk').off('click').on('click', () => {
      getSelectedIds().forEach(id => {
        let op = ops.find(o => o.id === id && o.status === 'pending');
        if (op) op.mode = 'attack';
      });
      save(); rerender(); updateSummary(ops);
    });

    $('#twOBulkSup').off('click').on('click', () => {
      getSelectedIds().forEach(id => {
        let op = ops.find(o => o.id === id && o.status === 'pending');
        if (op) op.mode = 'support';
      });
      save(); rerender(); updateSummary(ops);
    });

    $('#twOBulkSkip').off('click').on('click', () => {
      let ids = getSelectedIds();
      if (!ids.length || !confirm(ids.length + ' Ops überspringen?')) return;
      ids.forEach(id => {
        let op = ops.find(o => o.id === id && o.status === 'pending');
        if (!op) return;
        if (op._prewarmId) { clearTimeout(op._prewarmId); op._prewarmId = null; }
        if (op.timerId)    { clearTimeout(op.timerId);    op.timerId    = null; }
        op.status = 'missed'; op.statusText = 'Übersprungen (Bulk)';
      });
      save(); updateFloater(); updateSummary(ops); rerender();
    });

    $('#twOBulkPreset').off('change').on('change', function () {
      let idx = +$(this).val();
      if (isNaN(idx) || !presets[idx]) return;
      readFromTable(ops); // Manuelle Eingaben sichern
      let p = presets[idx];
      getSelectedIds().forEach(id => {
        let op = ops.find(o => o.id === id && o.status === 'pending');
        if (op) op.troops = { ...p.troops };
      });
      $(this).val('');
      save(); rerender();
    });
  };

  // ── BOOTSTRAP ──────────────────────────────────────────────────────────────
  window._twOpsInst = { open: openDialog };

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key === 'O') { e.preventDefault(); openDialog(); }
  });

  initOffset();
  loadVillages();
  createFloater();

  const saved = loadSaved();
  if (saved && saved.length) {
    ops = saved.map(o => ({ ...o, timerId: null, _prewarmId: null }));
    detectNobleTrains(ops);
    let pend = ops.filter(o => o.status === 'pending');
    let t    = now();
    if (pend.length) {
      let stillValid = pend.some(o => o.departTs > t - CFG.PREWARM_MS);
      if (stillValid) {
        running = true;
        scheduleAll(ops);
        startTicker(ops);
      } else {
        pend.forEach(o => { o.status = 'missed'; o.statusText = 'Verpasst (neu geöffnet)'; });
        save();
      }
    }
    updateFloater();
  }

  openDialog();
})();
