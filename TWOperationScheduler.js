// TW Operation Scheduler v3 — Persistent Background Edition

(() => {
  'use strict';

  // ── SINGLETON: nur eine Instanz, Dialog wiederöffnen ──────────────────────
  if (window._twOpsInst) { window._twOpsInst.open(); return; }

  // Speicher-Key pro Welt (hostname reicht als Scoping)
  const STORAGE_KEY = 'twOps_v3_' + (window.location.hostname.match(/^[^.]+/) || ['tw'])[0];

  // ── KONSTANTEN ─────────────────────────────────────────────────────────────
  const UNITS = [
    { key: 'spear',    label: 'Speer'   },
    { key: 'sword',    label: 'Schwert' },
    { key: 'axe',      label: 'Axt'     },
    { key: 'spy',      label: 'Aufkl.'  },
    { key: 'light',    label: 'LKav'    },
    { key: 'heavy',    label: 'SKav'    },
    { key: 'ram',      label: 'Ramme'   },
    { key: 'catapult', label: 'Kata'    },
    { key: 'snob',     label: 'Adel'    },
    { key: 'knight',   label: 'Paladin' },
  ];

  const UNIT_MAP = {
    'ramme':'ram','rammboeck':'ram','rammbock':'ram',
    'axt':'axe','axtkampfer':'axe',
    'speer':'spear','schwert':'sword',
    'lkav':'light','leichte':'light',
    'skav':'heavy','schwere':'heavy',
    'kata':'catapult','katapult':'catapult',
    'aufkl':'spy','adel':'snob','paladin':'knight',
  };

  const BUILDINGS = [
    { key: '',         label: '— Standard —'      },
    { key: 'main',     label: 'Hauptgebäude'       },
    { key: 'barracks', label: 'Kaserne'             },
    { key: 'stable',   label: 'Stall'               },
    { key: 'garage',   label: 'Werkstatt'           },
    { key: 'church',   label: 'Kirche'              },
    { key: 'snob',     label: 'Adelshof'            },
    { key: 'smith',    label: 'Schmiede'            },
    { key: 'place',    label: 'Versammlungsplatz'   },
    { key: 'market',   label: 'Marktplatz'          },
    { key: 'wood',     label: 'Holzfällerlager'     },
    { key: 'stone',    label: 'Lehmgrube'           },
    { key: 'iron',     label: 'Eisenmine'           },
    { key: 'farm',     label: 'Bauernhof'           },
    { key: 'storage',  label: 'Speicher'            },
    { key: 'wall',     label: 'Wall'                },
  ];

  const KNOWN_FIELDS = [
    'template_id','source_village','source','spear','sword','axe','spy',
    'light','heavy','ram','catapult','snob','knight','archer','marcher',
    'x','y','target_type','input','attack','support',
  ];

  // ── STATE ──────────────────────────────────────────────────────────────────
  let ops       = [];     // aktuelle Operationen
  let ticker    = null;   // setInterval-Countdown
  let running   = false;  // true nach "Starten"
  let srvOffset = 0;      // Serverzeit-Offset ms

  // ── PERSISTENZ ─────────────────────────────────────────────────────────────
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(
        ops.map(o => ({ ...o, timerId: null }))
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
  };

  // ── SERVERZEIT ─────────────────────────────────────────────────────────────
  const initOffset = () => {
    try {
      let tm = $('#serverTime').text().trim().match(/(\d+):(\d+):(\d+)/);
      let dm = $('#serverDate').text().trim().match(/(\d+)[\/\.](\d+)[\/\.](20?\d\d|\d\d)/);
      if (!tm || !dm) return;
      let y  = +dm[3] < 100 ? 2000 + +dm[3] : +dm[3];
      let ts = new Date(y, +dm[2]-1, +dm[1], +tm[1], +tm[2], +tm[3]).getTime();
      srvOffset = ts - Date.now();
    } catch (e) { srvOffset = 0; }
  };

  const now = () => Date.now() + srvOffset;

  // ── PARSER ─────────────────────────────────────────────────────────────────
  const parseTs = str => {
    let m = str.match(/(\d+)\.(\d+)\.(\d+)\s+(\d+):(\d+):(\d+)/);
    if (!m) return null;
    let y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[2]-1, +m[1], +m[4], +m[5], +m[6]).getTime();
  };

  const parseExport = raw => {
    let result = [];
    raw.trim().split('\n').forEach((line, i) => {
      line = line.trim(); if (!line) return;
      let c = line.split('\t');
      if (c.length < 8) c = line.split(/\s{2,}/);
      if (c.length < 8) return;
      try {
        let oFull = c[2].trim(), uRaw = c[3].trim(), tFull = c[5].trim();
        let oC = (oFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        let tC = (tFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        if (!oC || !tC) return;
        let uKey = null;
        let ul = uRaw.toLowerCase().replace(/\s+/g, '');
        for (let k in UNIT_MAP) { if (ul.includes(k)) { uKey = UNIT_MAP[k]; break; } }
        let dTs = parseTs(c[6].trim()), aTs = parseTs(c[7].trim());
        if (!dTs || !aTs) return;
        result.push({
          id: i,
          type: c[0].trim().replace(/[()]/g, '').toLowerCase(),
          originVillage: oFull.replace(/\s*\(.*\).*$/, '').trim(),
          originCoord: oC,
          targetName: tFull.replace(/\s*\(.*\).*$/, '').trim(),
          targetCoord: tC,
          unitRaw: uRaw,
          troops: uKey ? { [uKey]: 'all' } : {},
          departTs: dTs, arriveTs: aTs,
          building: '', status: 'pending', statusText: 'Ausstehend', timerId: null,
        });
      } catch (e) {}
    });
    return result.sort((a, b) => a.departTs - b.departTs);
  };

  // ── DÖRFER ─────────────────────────────────────────────────────────────────
  const loadVillages = () => {
    return $.get('/map/village.txt').then(txt => {
      let myId = String(game_data.player.id);
      window._twOpsV = [];
      (txt.match(/[^\r\n]+/g) || []).forEach(l => {
        let p = l.split(',');
        if (p.length >= 5 && p[4].trim() === myId)
          window._twOpsV.push({ id: +p[0], x: p[2].trim(), y: p[3].trim() });
      });
    }).fail(() => { window._twOpsV = []; });
  };

  const getOriginId = op => {
    let [ox, oy] = op.originCoord.replace(/[()]/g, '').split('|').map(s => s.trim());
    let cv = game_data.village;
    if (cv && String(cv.x) === ox && String(cv.y) === oy) return cv.id;
    if (window._twOpsV)
      for (let v of window._twOpsV)
        if (v.x === ox && v.y === oy) return v.id;
    return cv ? cv.id : null;
  };

  // ── STATUS SETZEN (DOM + Objekt + Speicher) ────────────────────────────────
  const setStatus = (op, txt, cls, rowCls) => {
    if (['sent','error','missed'].includes(cls)) op.status = cls;
    op.statusText = txt;
    save();
    updateFloater();
    const s  = document.getElementById('twOpsSt_'  + op.id);
    const cd = document.getElementById('twOpsCd_'  + op.id);
    const r  = document.getElementById('twOpsRow_' + op.id);
    if (s)  { s.textContent = txt; s.className = 'ops-status-' + cls; }
    if (cd) cd.textContent = '';
    if (r)  r.className = rowCls || cls;
  };

  // ── ANGRIFF SENDEN (3-Schritt) ─────────────────────────────────────────────
  const sendAttack = op => {
    setStatus(op, 'Lade...', 'pending', 'imminent');
    let [tx, ty] = op.targetCoord.replace(/[()]/g, '').split('|').map(s => s.trim());
    let vid = getOriginId(op);
    if (!vid) { setStatus(op, 'Kein Dorf', 'error', 'error'); return; }

    let troopData = {};
    UNITS.forEach(u => { let v = op.troops[u.key]; if (v && v !== '0') troopData[u.key] = v; });
    if (!Object.keys(troopData).length) { setStatus(op, 'Keine Truppen', 'error', 'error'); return; }

    // Schritt 1: Place-Screen laden
    $.get('/game.php?village=' + vid + '&screen=place&x=' + tx + '&y=' + ty).then(html => {
      let $h = $(html);
      let csrf = $h.find('input[name="h"]').val()
        || (typeof csrf_token !== 'undefined' ? csrf_token : null);
      if (!csrf) $h.find('input[type="hidden"]').each(function () {
        let n = $(this).attr('name') || '';
        if (n && KNOWN_FIELDS.indexOf(n) === -1) { csrf = $(this).val(); return false; }
      });

      let s1 = { x: tx, y: ty, target_type: 'coord', attack: 'Angreifen', source_village: String(vid) };
      if (csrf) s1.h = csrf;
      let hasUnits = false;
      UNITS.forEach(u => {
        let val = troopData[u.key]; if (!val) return;
        let $el = $h.find('input[name="' + u.key + '"]'); if (!$el.length) return;
        let avail = parseInt($el.attr('data-all-count') || $el.attr('max') || $el.val() || '0');
        let nv = parseInt(val), count;
        if (val === 'all')     count = avail;
        else if (nv < 0)       count = Math.max(0, avail + nv);
        else                   count = Math.min(nv || 0, avail);
        if (count > 0) { s1[u.key] = String(count); hasUnits = true; }
      });
      if (!hasUnits) { setStatus(op, 'Keine Truppen verf.', 'error', 'error'); return; }

      // Schritt 2: Bestätigungsseite
      $.post('/game.php?village=' + vid + '&screen=place&try=confirm', s1).then(cHtml => {
        let $c = $(cHtml);
        let err = $c.find('.error_box, .system_wide_message').text().trim();
        if (err) { setStatus(op, 'Fehler: ' + err.substring(0, 30), 'error', 'error'); return; }

        let $f = $c.find('form[name="confirm_form"]');
        if (!$f.length) $f = $c.find('form').filter(function () { return $(this).find('input[name="ch"]').length > 0; }).first();
        if (!$f.length) $f = $c.find('form').filter(function () { return $(this).find('input[name="attack"]').length > 0; }).first();
        if (!$f.length) { setStatus(op, 'Kein Confirm-Form', 'error', 'error'); return; }

        let fa = $f.attr('action') || '';
        let formAction = fa.startsWith('/') ? fa : (!fa ? '/game.php?village=' + vid + '&screen=place' : '/' + fa);

        let s2 = {};
        $f.find('input, select, textarea').each(function () {
          let $e = $(this), n = $e.attr('name'), t = ($e.attr('type') || 'text').toLowerCase();
          if (!n || (t === 'checkbox' && !$e.prop('checked')) || (t === 'radio' && !$e.prop('checked'))) return;
          s2[n] = $e.val() || '';
        });
        if (!s2.attack) s2.attack = 'Angreifen';
        if (op.building) { s2.building = op.building; console.log('[TWOps] Kata-Ziel:', op.building); }

        // Schritt 3: Wirklich senden
        $.post(formAction, s2).then(res => {
          let em = $(res).find('.error_box, .system_wide_message').text().trim();
          if (em) { setStatus(op, 'Fehler: ' + em.substring(0, 30), 'error', 'error'); return; }
          setStatus(op, 'Gesendet ✓', 'sent', 'sent');
          try { UI.SuccessMessage('Gesendet: ' + op.originCoord + ' → ' + op.targetCoord); } catch (e) {}
        }).fail(() => setStatus(op, 'Fehler Senden', 'error', 'error'));

      }).fail(() => setStatus(op, 'Fehler Bestätigung', 'error', 'error'));
    }).fail(() => setStatus(op, 'Fehler Place-Screen', 'error', 'error'));
  };

  // ── FLOATER (schwebender Hintergrund-Indikator) ────────────────────────────
  const createFloater = () => {
    if (document.getElementById('twOpsFloater')) return;
    let el = document.createElement('div');
    el.id = 'twOpsFloater';
    el.title = 'Klicken um Scheduler zu öffnen';
    el.style.cssText =
      'position:fixed;bottom:80px;right:0;z-index:99999;'
      + 'background:#7D510F;color:#fff;border-radius:6px 0 0 6px;'
      + 'padding:8px 10px 8px 12px;cursor:pointer;'
      + 'font:bold 11px Arial,sans-serif;'
      + 'box-shadow:-2px 0 8px rgba(0,0,0,.4);display:none;'
      + 'border:2px solid #5a3a08;border-right:none;user-select:none;'
      + 'writing-mode:initial;transition:background .3s;';
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
      el.style.background = '#7D510F';
      el.textContent = '⚔ ' + p + ' pend.' + (s ? ' | ' + s + ' ✓' : '') + (e ? ' | ' + e + ' ✗' : '') + ' — öffnen';
    }
  };

  // ── CSS ────────────────────────────────────────────────────────────────────
  const buildCSS = () => `<style>
    #popup_box_TWOps{width:960px!important;max-height:92vh;overflow-y:auto}
    #twOB{font-family:Arial,sans-serif;font-size:11px}
    #twOB h3{margin:0 0 6px;font-size:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    #twOB .ops-badge{background:#2d7a36;color:#fff;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:bold}
    #twOB .ops-badge.warn{background:#c47a00}
    #twOB textarea{width:100%;height:88px;font-size:10px;resize:vertical;box-sizing:border-box}
    .ops-tb{margin:5px 0;display:flex;gap:5px;align-items:center;flex-wrap:wrap}
    #twOB table.ops-t{width:100%;border-collapse:collapse;margin-top:6px}
    #twOB table.ops-t th{background:#7D510F;color:#fff;padding:3px 5px;text-align:center;white-space:nowrap}
    #twOB table.ops-t td{padding:2px 4px;border-bottom:1px solid #ccc;text-align:center;vertical-align:middle}
    #twOB tr.pending  td{background:#f4eed4}
    #twOB tr.sent     td{background:#d4edda}
    #twOB tr.error    td{background:#f8d7da}
    #twOB tr.missed   td{background:#fff3cd}
    #twOB tr.imminent td{background:#ffe0b2;font-weight:bold}
    .ops-cd{font-weight:bold;color:#7D510F}
    .ops-status-sent{color:#155724;font-weight:bold}
    .ops-status-error{color:#721c24;font-weight:bold}
    .ops-status-missed{color:#856404;font-weight:bold}
    .ops-status-pending{color:#555}
    .oti{width:36px;text-align:center;font-size:10px;padding:1px 2px;border:1px solid #ccc;border-radius:2px}
    .oti:disabled{background:#eee;color:#bbb;border-color:#ddd}
    .oab{font-size:9px;padding:1px 3px;cursor:pointer;margin-left:1px;border:1px solid #aaa;border-radius:2px;background:#f4eed4}
    .oab:disabled{color:#bbb;cursor:not-allowed}
    #twOSumm{margin-top:5px;padding:4px 8px;background:#f4eed4;border:1px solid #7D510F;border-radius:3px}
    .otc{display:flex;flex-wrap:wrap;gap:2px;justify-content:center}
    .ote{display:flex;flex-direction:column;align-items:center;font-size:9px}
    .ote label{color:#555;margin-bottom:1px}
    .okt{margin-top:4px;font-size:9px;text-align:center}
    .oks{font-size:10px;padding:1px 2px;border-radius:2px;border:1px solid #aaa;background:#fff;cursor:pointer;max-width:140px}
    .oks:disabled{background:#eee;color:#bbb;cursor:not-allowed}
    #twOEB{background:#fff3cd;border:1px solid #ffc107;padding:5px 9px;border-radius:3px;
      margin:4px 0;font-size:11px;display:none;align-items:center;gap:8px}
    #twOEB b{color:#856404}
    .ops-del{font-size:10px;color:#888;cursor:pointer;padding:1px 4px;border:1px solid #ccc;
      border-radius:2px;background:#fff;line-height:1}
    .ops-del:hover{background:#f8d7da;border-color:#f44}
    #twOImportWrap{margin-bottom:6px}
    #twOImportToggle{font-size:10px;color:#7D510F;cursor:pointer;text-decoration:underline;display:inline-block;margin-top:3px}
  </style>`;

  // ── TABELLEN-ZELLE TRUPPEN ─────────────────────────────────────────────────
  const troopCell = op => {
    let dis   = op.status !== 'pending' ? ' disabled' : '';
    let h     = '<div class="otc">';
    UNITS.forEach(u => {
      let v   = op.troops[u.key] || '';
      let dv  = v === 'all' ? '' : v;
      let ph  = v === 'all' ? 'alle' : '0';
      h += '<div class="ote">'
        + '<label>' + u.label + '</label>'
        + '<div style="display:flex;align-items:center">'
        + '<input class="oti" type="text" data-op="' + op.id + '" data-unit="' + u.key + '"'
        + ' value="' + dv + '" placeholder="' + ph + '"' + dis + '>'
        + '<button class="oab" data-op="' + op.id + '" data-unit="' + u.key + '"' + dis + '>∞</button>'
        + '</div></div>';
    });
    let opts = BUILDINGS.map(b =>
      '<option value="' + b.key + '"' + (op.building === b.key ? ' selected' : '') + '>' + b.label + '</option>'
    ).join('');
    return h + '</div><div class="okt">🪨 <select class="oks" data-op="' + op.id + '"' + dis + '>' + opts + '</select></div>';
  };

  const fmtTs = ts => new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const buildTable = list => {
    if (!list.length) return '<p style="text-align:center;color:#c00;padding:10px">Keine Operationen gefunden.</p>';
    let h = '<table class="ops-t">'
      + '<tr><th>#</th><th>Typ</th><th>Herkunft</th><th>Ziel</th>'
      + '<th>Truppen &amp; Kata-Ziel</th><th>Abfahrt</th><th>Ankunft</th>'
      + '<th>Countdown</th><th>Status</th><th>–</th></tr>';
    list.forEach((op, i) => {
      h += '<tr id="twOpsRow_' + op.id + '" class="' + op.status + '">'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + (op.type === 'fake' ? '<span style="color:#888">(F)</span>' : '<b>(R)</b>') + '</td>'
        + '<td style="text-align:left" title="' + op.originCoord + '">' + op.originVillage + '</td>'
        + '<td style="text-align:left" title="' + op.targetCoord + '">' + op.targetName + '</td>'
        + '<td>' + troopCell(op) + '</td>'
        + '<td style="white-space:nowrap">' + fmtTs(op.departTs) + '</td>'
        + '<td style="white-space:nowrap">' + fmtTs(op.arriveTs) + '</td>'
        + '<td><span id="twOpsCd_' + op.id + '" class="ops-cd">--</span></td>'
        + '<td><span id="twOpsSt_' + op.id + '" class="ops-status-' + op.status + '">' + (op.statusText || 'Ausstehend') + '</span></td>'
        + '<td>'
        + (op.status === 'pending'
          ? '<button class="ops-del" data-del="' + op.id + '" title="Überspringen">✕</button>'
          : '')
        + '</td>'
        + '</tr>';
    });
    return h + '</table>';
  };

  // ── TICKER ─────────────────────────────────────────────────────────────────
  const startTicker = list => {
    if (ticker) clearInterval(ticker);
    ticker = setInterval(() => {
      let t = now(), allDone = true;
      list.forEach(op => {
        if (op.status !== 'pending') return;
        allDone = false;
        let diff = Math.round((op.departTs - t) / 1000);
        let cd   = document.getElementById('twOpsCd_' + op.id);
        let row  = document.getElementById('twOpsRow_' + op.id);
        if (!cd) return;
        if (diff > 0) {
          let hh = Math.floor(diff / 3600), mm = Math.floor((diff % 3600) / 60), ss = diff % 60;
          cd.textContent = (hh ? hh + 'h ' : '') + (mm || hh ? String(mm).padStart(2, '0') + 'm ' : '') + String(ss).padStart(2, '0') + 's';
          if (diff <= 60 && row) row.className = 'imminent';
        } else {
          cd.textContent = 'Sendet...';
        }
      });
      updateBadge();
      updateSummary(list);
      if (allDone) { clearInterval(ticker); ticker = null; updateSummary(list, true); updateFloater(); }
    }, 1000);
  };

  const scheduleAll = list => {
    let t = now();
    list.forEach(op => {
      if (op.status !== 'pending') return;
      let ms = op.departTs - t;
      if (ms < -5000) {
        op.status = 'missed'; op.statusText = 'Verpasst';
        let s = document.getElementById('twOpsSt_' + op.id), r = document.getElementById('twOpsRow_' + op.id);
        if (s) { s.textContent = 'Verpasst'; s.className = 'ops-status-missed'; }
        if (r) r.className = 'missed';
        return;
      }
      if (ms < 0) ms = 0;
      op.timerId = setTimeout(() => sendAttack(op), ms);
    });
    save();
  };

  const cancelAll = list => {
    list.forEach(op => {
      if (op.timerId) { clearTimeout(op.timerId); op.timerId = null; }
      if (op.status === 'pending') {
        op.status = 'missed'; op.statusText = 'Abgebrochen';
        let s = document.getElementById('twOpsSt_' + op.id);
        let r = document.getElementById('twOpsRow_' + op.id);
        if (s) { s.textContent = 'Abgebrochen'; s.className = 'ops-status-missed'; }
        if (r) r.className = 'missed';
        // Inputs dieser Zeile deaktivieren
        $('input.oti[data-op="' + op.id + '"],.oab[data-op="' + op.id + '"],.oks[data-op="' + op.id + '"]').prop('disabled', true);
      }
    });
    if (ticker) { clearInterval(ticker); ticker = null; }
    running = false; save(); updateFloater();
  };

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

  const updateSummary = (list, done) => {
    let el = document.getElementById('twOSumm');
    if (!el) return;
    let p = list.filter(o => o.status === 'pending').length;
    let s = list.filter(o => o.status === 'sent').length;
    let e = list.filter(o => o.status === 'error').length;
    let m = list.filter(o => o.status === 'missed').length;
    $(el).show().html(
      (done ? '<b>Abgeschlossen.</b> ' : '<b>Aktiv</b> — ')
      + 'Ausstehend: <b>' + p + '</b>'
      + ' | Gesendet: <b style="color:#155724">' + s + '</b>'
      + ' | Fehler: <b style="color:#721c24">' + e + '</b>'
      + (m ? ' | Verpasst/Skip: <b style="color:#856404">' + m + '</b>' : '')
    );
  };

  const updateBadge = () => {
    let el = document.getElementById('twObadge');
    if (!el) return;
    let p = ops.filter(o => o.status === 'pending').length;
    let s = ops.filter(o => o.status === 'sent').length;
    el.className = 'ops-badge' + (p > 0 ? ' warn' : '');
    el.textContent = p > 0 ? p + ' ausstehend' : s + ' gesendet ✓';
  };

  // ── DIALOG AUFBAUEN ────────────────────────────────────────────────────────
  const openDialog = () => {
    let hasPlan = ops.length > 0;
    let pCount  = ops.filter(o => o.status === 'pending').length;

    let ui = buildCSS()
      + '<div id="twOB">'

      // Titel mit Badge
      + '<h3>⚔ Operation Scheduler v3'
      + (hasPlan ? ' <span id="twObadge" class="ops-badge' + (pCount > 0 ? ' warn' : '') + '">'
          + (pCount > 0 ? pCount + ' ausstehend' : ops.filter(o => o.status === 'sent').length + ' gesendet ✓')
          + '</span>' : '')
      + '</h3>'

      // Import (kollabierbar wenn Plan vorhanden)
      + '<div id="twOImportWrap"'
      + (hasPlan ? ' style="display:none"' : '') + '>'
      + '<textarea id="twOTxt" placeholder="DS-Ultimate Export einfügen..."></textarea>'
      + '</div>'
      + (hasPlan ? '<a id="twOImportToggle">▼ Neuen Export laden</a>' : '')

      // Toolbar
      + '<div class="ops-tb">'
      + (!hasPlan
          ? '<input type="button" id="twOBtnLoad"   class="btn" value="Laden">'
          : '<input type="button" id="twOBtnNew"    class="btn" value="🗑 Neu laden" style="background:#888;color:#fff;">')
      + '<input type="button" id="twOBtnStart"  class="btn" value="▶ Starten"'
      + ((!hasPlan || running) ? ' disabled' : '') + ' style="background:#2a7;color:#fff;">'
      + '<input type="button" id="twOBtnCancel" class="btn" value="■ Abbrechen"'
      + (!running ? ' disabled' : '') + ' style="background:#c44;color:#fff;">'
      + '<input type="button" id="twOBtnSave"   class="btn" value="💾 Änderungen speichern"'
      + (!hasPlan ? ' disabled' : '') + ' style="background:#1a6;color:#fff;">'
      + '<span style="font-size:10px;color:#888">Truppen für ausstehende Ops jederzeit editierbar.</span>'
      + '</div>'

      // Edit-Banner
      + '<div id="twOEB">✏ <b>Änderungen erkannt</b> — klicke <b>💾 Änderungen speichern</b> um zu übernehmen (wirkt beim nächsten Senden).</div>'

      // Summary + Tabelle
      + '<div id="twOSumm"' + (!hasPlan ? ' style="display:none"' : '') + '></div>'
      + '<div id="twOTbl">' + (hasPlan ? buildTable(ops) : '') + '</div>'
      + '</div>';

    Dialog.show('TWOps', ui);

    if (hasPlan) {
      updateSummary(ops, !running && pCount === 0);
      // Ticker neu anknüpfen wenn laufend (findet neue DOM-Elemente automatisch)
      if (running && pCount > 0) startTicker(ops);
    }

    bindEvents();
  };

  // ── EVENT-BINDUNG ──────────────────────────────────────────────────────────
  const bindEvents = () => {

    // ── Import-Toggle ──────────────────────────────────────────────────────
    $('#twOImportToggle').off('click').on('click', function () {
      let wrap = $('#twOImportWrap');
      let isHidden = wrap.is(':hidden');
      wrap.toggle();
      $(this).text(isHidden ? '▲ Import ausblenden' : '▼ Neuen Export laden');
    });

    // ── Laden (leerer Zustand) ─────────────────────────────────────────────
    $('#twOBtnLoad').off('click').on('click', () => {
      let raw = $('#twOTxt').val().trim();
      if (!raw) { try { UI.ErrorMessage('Bitte Export einfügen.'); } catch (e) {} return; }
      ops = parseExport(raw); running = false; save(); updateFloater();
      $('#twOTbl').html(buildTable(ops));
      if (!ops.length) return;
      $('#twOBtnStart, #twOBtnSave').prop('disabled', false);
      $('#twOSumm').show(); updateSummary(ops);
      try { UI.SuccessMessage(ops.length + ' Operationen geladen.'); } catch (e) {}
    });

    // ── Neu laden (Plan vorhanden) ─────────────────────────────────────────
    $('#twOBtnNew').off('click').on('click', () => {
      if (running && !confirm('Laufenden Plan abbrechen und neuen laden?')) return;
      cancelAll(ops); wipePlan();
      Dialog.close(); openDialog();
    });

    // ── Starten ────────────────────────────────────────────────────────────
    $('#twOBtnStart').off('click').on('click', () => {
      if (!ops.length) return;
      readFromTable(ops);
      let pend = ops.filter(o => o.status === 'pending');
      if (pend.every(o => !Object.keys(o.troops).length)) {
        try { UI.ErrorMessage('Bitte Truppen eintragen!'); } catch (e) {} return;
      }
      scheduleAll(ops); startTicker(ops); updateSummary(ops);
      running = true; save(); updateFloater();
      $('#twOBtnStart').prop('disabled', true);
      $('#twOBtnCancel').prop('disabled', false);
      $('#twOEB').hide();
      try { UI.SuccessMessage(pend.length + ' Angriffe geplant — Fenster kann geschlossen werden!'); } catch (e) {}
    });

    // ── Abbrechen ──────────────────────────────────────────────────────────
    $('#twOBtnCancel').off('click').on('click', () => {
      if (!confirm('Alle ausstehenden Angriffe abbrechen?')) return;
      cancelAll(ops);
      $('#twOBtnCancel').prop('disabled', true);
      $('#twOBtnStart').prop('disabled', false);
      $('#twOEB').hide();
      updateSummary(ops);
    });

    // ── Änderungen speichern ───────────────────────────────────────────────
    $('#twOBtnSave').off('click').on('click', () => {
      readFromTable(ops); save(); $('#twOEB').hide();
      try { UI.SuccessMessage('Änderungen gespeichert!'); } catch (e) {}
    });

    // ── ✕ Zeile überspringen ──────────────────────────────────────────────
    $(document).off('click.opsDel').on('click.opsDel', '.ops-del', function () {
      let opId = +$(this).data('del');
      let op   = ops.find(o => o.id === opId);
      if (!op || op.status !== 'pending') return;
      if (!confirm('Operation #' + (ops.indexOf(op) + 1) + ' (' + op.targetCoord + ') überspringen?')) return;
      if (op.timerId) { clearTimeout(op.timerId); op.timerId = null; }
      op.status = 'missed'; op.statusText = 'Übersprungen';
      let r = document.getElementById('twOpsRow_' + opId);
      let s = document.getElementById('twOpsSt_' + opId);
      if (r) r.className = 'missed';
      if (s) { s.textContent = 'Übersprungen'; s.className = 'ops-status-missed'; }
      $('input.oti[data-op="' + opId + '"],.oab[data-op="' + opId + '"],.oks[data-op="' + opId + '"]').prop('disabled', true);
      $(this).remove();
      save(); updateFloater(); updateSummary(ops); updateBadge();
    });

    // ── ∞ Button (alle verfügbaren) ────────────────────────────────────────
    $(document).off('click.opsAB').on('click.opsAB', '.oab:not([disabled])', function () {
      let oid  = $(this).data('op');
      let unit = $(this).data('unit');
      $('input.oti[data-op="' + oid + '"][data-unit="' + unit + '"]').val('').attr('placeholder', 'alle');
      if (running) $('#twOEB').show();
    });

    // ── Input-Änderung → Edit-Banner ───────────────────────────────────────
    $(document).off('input.opsIN change.opsIN').on('input.opsIN change.opsIN',
      '.oti:not([disabled]), .oks:not([disabled])',
      () => { if (running) $('#twOEB').show(); }
    );
  };

  // ── BOOTSTRAP ──────────────────────────────────────────────────────────────
  window._twOpsInst = { open: openDialog };

  initOffset();
  loadVillages();
  createFloater();

  // Gespeicherten Plan aus localStorage laden
  const saved = loadSaved();
  if (saved && saved.length) {
    ops = saved.map(o => ({ ...o, timerId: null }));
    let pend  = ops.filter(o => o.status === 'pending');
    let t     = now() || Date.now();

    if (pend.length) {
      let stillValid = pend.some(o => o.departTs > t - 5000);
      if (stillValid) {
        // Timers neu aufsetzen und Ticker starten
        running = true;
        scheduleAll(ops);
        startTicker(ops);
      } else {
        // Alle abgelaufenen pending → missed
        pend.forEach(o => { o.status = 'missed'; o.statusText = 'Verpasst (neu geöffnet)'; });
        save();
      }
    }
    updateFloater();
  }

  openDialog();

})();
