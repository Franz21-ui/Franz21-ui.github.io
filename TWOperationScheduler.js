// TW Operation Scheduler v3 — Fixed & Optimized

(() => {

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

  // Gebäude die Katapulte angreifen können
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

  // Bekannte Formular-Felder (alles andere ist kandidat für CSRF, aber h ist bevorzugt)
  const KNOWN_FIELDS = [
    'template_id','source_village','source','spear','sword','axe','spy',
    'light','heavy','ram','catapult','snob','knight','archer','marcher',
    'x','y','target_type','input','attack','support',
  ];

  // ── SERVER-ZEIT ────────────────────────────────────────────────────────────
  let _serverOffset = 0;

  const initServerOffset = function () {
    try {
      // FIX: #serverTime und #serverDate separat lesen (robuster als combined text)
      // Unterstützt DD/MM/YYYY und DD.MM.YYYY
      let timeText = $('#serverTime').text().trim();
      let dateText = $('#serverDate').text().trim();
      let tm = timeText.match(/(\d+):(\d+):(\d+)/);
      let dm = dateText.match(/(\d+)[\/\.](\d+)[\/\.](\d+)/);
      if (!tm || !dm) return;
      let y = parseInt(dm[3]) < 100 ? 2000 + parseInt(dm[3]) : parseInt(dm[3]);
      let ts = new Date(
        y, parseInt(dm[2]) - 1, parseInt(dm[1]),
        parseInt(tm[1]), parseInt(tm[2]), parseInt(tm[3])
      ).getTime();
      _serverOffset = ts - Date.now();
      console.log('[TWOps] Server-Offset:', _serverOffset, 'ms');
    } catch (e) {
      _serverOffset = 0;
      console.warn('[TWOps] initServerOffset fehlgeschlagen:', e);
    }
  };

  const serverNow = () => Date.now() + _serverOffset;

  // ── PARSER ─────────────────────────────────────────────────────────────────
  const parseExport = function (raw) {
    let ops = [];
    raw.trim().split('\n').forEach((line, i) => {
      line = line.trim();
      if (!line) return;
      let cols = line.split('\t');
      if (cols.length < 8) cols = line.split(/\s{2,}/);
      if (cols.length < 8) return;
      try {
        let originFull  = cols[2].trim();
        let unitRaw     = cols[3].trim();
        let targetFull  = cols[5].trim();
        let originCoord = (originFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        let targetCoord = (targetFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        if (!originCoord || !targetCoord) return;

        let unitKey = null;
        let ul = unitRaw.toLowerCase().replace(/\s+/g, '');
        for (let k in UNIT_MAP) { if (ul.includes(k)) { unitKey = UNIT_MAP[k]; break; } }

        const pt = (str) => {
          let m = str.match(/(\d+)\.(\d+)\.(\d+)\s+(\d+):(\d+):(\d+)/);
          if (!m) return null;
          let y = parseInt(m[3]) < 100 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
          return new Date(y, parseInt(m[2])-1, parseInt(m[1]),
            parseInt(m[4]), parseInt(m[5]), parseInt(m[6])).getTime();
        };

        let departTs = pt(cols[6].trim());
        let arriveTs = pt(cols[7].trim());
        if (!departTs || !arriveTs) return;

        let troops = {};
        if (unitKey) troops[unitKey] = 'all';

        ops.push({
          id: i,
          type: cols[0].trim().replace(/[()]/g, '').toLowerCase(),
          originVillage: originFull.replace(/\s*\(.*\).*$/, '').trim(),
          originCoord, targetCoord,
          targetName: targetFull.replace(/\s*\(.*\).*$/, '').trim(),
          unitRaw, troops, departTs, arriveTs,
          building: '', status: 'pending', timerId: null,
        });
      } catch (e) {
        console.warn('[TWOps] Parse-Fehler Zeile ' + i, e);
      }
    });
    return ops.sort((a, b) => a.departTs - b.departTs);
  };

  // ── DÖRFER ─────────────────────────────────────────────────────────────────
  const loadOwnVillages = function () {
    return $.get('/map/village.txt').then(function (txt) {
      let myId = String(game_data.player.id);
      window._twOpsVillages = [];
      (txt.match(/[^\r\n]+/g) || []).forEach(function (line) {
        let p = line.split(',');
        // FIX: parseInt(p[4]) === 0 wäre falsch für player_id — String-Vergleich korrekt
        if (p.length >= 5 && p[4].trim() === myId) {
          window._twOpsVillages.push({
            id: parseInt(p[0]),
            x: p[2].trim(),
            y: p[3].trim(),
          });
        }
      });
      console.log('[TWOps] Dörfer geladen:', window._twOpsVillages.length);
    }).fail(function () {
      window._twOpsVillages = [];
      console.warn('[TWOps] village.txt konnte nicht geladen werden.');
    });
  };

  const getOriginId = function (op) {
    let parts = op.originCoord.replace(/[()]/g, '').split('|');
    let ox = parts[0].trim(), oy = parts[1].trim();
    let cv = game_data.village;
    if (cv && String(cv.x) === ox && String(cv.y) === oy) return cv.id;
    if (window._twOpsVillages) {
      for (let v of window._twOpsVillages) {
        if (v.x === ox && v.y === oy) return v.id;
      }
    }
    console.warn('[TWOps] Ursprungsdorf nicht gefunden für Koord:', op.originCoord);
    return cv ? cv.id : null;
  };

  // ── ANGRIFF SENDEN ─────────────────────────────────────────────────────────
  //
  // FIX KRITISCH: Der alte Code hat nur 2 Schritte durchgeführt:
  //   1. GET  place-screen  (CSRF + verfügbare Truppen lesen)
  //   2. POST try=confirm   (gibt Bestätigungsseite zurück — KEIN SENDEN!)
  //
  // TW erfordert 3 Schritte:
  //   1. GET  place-screen                → CSRF + Truppenzahlen lesen
  //   2. POST screen=place&try=confirm    → Bestätigungsseite mit ch-Hash holen
  //   3. POST screen=place (form action)  → ch-Hash + alle hidden fields → SENDEN
  //
  // Ohne Schritt 3 (und den ch-Hash) wird kein Angriff registriert.
  //
  const sendAttack = function (op) {
    let stEl  = document.getElementById('twOpsSt_'  + op.id);
    let cdEl  = document.getElementById('twOpsCd_'  + op.id);
    let rowEl = document.getElementById('twOpsRow_' + op.id);

    const setStatus = (txt, cls, rowCls) => {
      if (stEl)  { stEl.textContent = txt; stEl.className = 'ops-status-' + cls; }
      if (cdEl)  cdEl.textContent = '';
      if (rowEl) rowEl.className = rowCls || cls;
    };

    let tparts    = op.targetCoord.replace(/[()]/g, '').split('|');
    let targetX   = tparts[0].trim();
    let targetY   = tparts[1].trim();
    let originId  = getOriginId(op);

    if (!originId) {
      setStatus('Kein Dorf', 'error', 'error');
      op.status = 'error';
      return;
    }

    let troopData = {};
    UNITS.forEach(u => {
      let val = op.troops[u.key];
      if (val && val !== '0' && val !== '') troopData[u.key] = val;
    });
    if (!Object.keys(troopData).length) {
      setStatus('Keine Truppen', 'error', 'error');
      op.status = 'error';
      return;
    }

    setStatus('Lade...', 'pending', 'imminent');

    // ── SCHRITT 1: Place-Screen laden ──────────────────────────────────────
    $.get('/game.php?village=' + originId + '&screen=place&x=' + targetX + '&y=' + targetY)
      .then(function (html) {
        let $html = $(html);

        // FIX: CSRF direkt über input[name="h"] lesen (zuverlässig)
        // Fallback: globales csrf_token (in TW immer verfügbar), dann unknown-input
        let csrfVal = $html.find('input[name="h"]').val()
          || (typeof csrf_token !== 'undefined' ? csrf_token : null);

        if (!csrfVal) {
          $html.find('input[type="hidden"]').each(function () {
            let n = $(this).attr('name') || '';
            if (n && KNOWN_FIELDS.indexOf(n) === -1) {
              csrfVal = $(this).val();
              return false;
            }
          });
        }

        console.log('[TWOps] CSRF (h):', csrfVal);

        // Formular für Schritt 2 aufbauen
        let step1Data = {
          x:              targetX,
          y:              targetY,
          target_type:    'coord',
          attack:         'Angreifen',
          source_village: String(originId),
        };
        if (csrfVal) step1Data.h = csrfVal;

        let hasUnits = false;
        UNITS.forEach(u => {
          let val = troopData[u.key];
          if (!val) return;
          let $el = $html.find('input[name="' + u.key + '"]');
          if (!$el.length) return;
          // data-all-count > max > val (aktuelle Anzahl im Input)
          let avail = parseInt(
            $el.attr('data-all-count') ||
            $el.attr('max') ||
            $el.val() ||
            '0'
          );
          // Eingabe-Logik:
          //   leer / "alle" (∞)  → alle verfügbaren Truppen
          //   positive Zahl      → genau diese Anzahl (max: verfügbar)
          //   negative Zahl      → Reserve: alle MINUS dieser Betrag (z.B. -400 → avail - 400)
          let numVal = parseInt(val);
          let count;
          if (val === 'all') {
            count = avail;
          } else if (numVal < 0) {
            count = Math.max(0, avail + numVal); // avail - Reserve
          } else {
            count = Math.min(numVal || 0, avail);
          }
          if (count > 0) {
            step1Data[u.key] = String(count);
            hasUnits = true;
          }
        });

        if (!hasUnits) {
          setStatus('Keine Truppen verfügbar', 'error', 'error');
          op.status = 'error';
          return;
        }

        console.log('[TWOps] Schritt 2 — POST try=confirm:', JSON.stringify(step1Data));

        // ── SCHRITT 2: Bestätigungsseite laden ──────────────────────────────
        return $.post(
          '/game.php?village=' + originId + '&screen=place&try=confirm',
          step1Data
        ).then(function (confirmHtml) {
          let $conf = $(confirmHtml);

          let err = $conf.find('.error_box, .system_wide_message').text().trim();
          if (err) {
            setStatus('Fehler: ' + err.substring(0, 30), 'error', 'error');
            op.status = 'error';
            UI.ErrorMessage('[TWOps] ' + err.substring(0, 80));
            console.error('[TWOps] Schritt 2 Fehler:', err);
            return;
          }

          // Bestätigungsformular finden — enthält ch-Hash (Pflicht für Schritt 3)
          // TW nutzt form[name="confirm_form"] oder ein Formular mit input[name="ch"]
          let $form = $conf.find('form[name="confirm_form"]');
          if (!$form.length) {
            $form = $conf.find('form').filter(function () {
              return $(this).find('input[name="ch"]').length > 0;
            }).first();
          }
          if (!$form.length) {
            // Letzter Fallback: Formular mit Angriff-Button
            $form = $conf.find('form').filter(function () {
              return $(this).find('input[name="attack"]').length > 0;
            }).first();
          }

          if (!$form.length) {
            setStatus('Kein Bestätigungsformular', 'error', 'error');
            op.status = 'error';
            console.error('[TWOps] Bestätigungsformular nicht gefunden. HTML-Anfang:',
              confirmHtml.substring(0, 800));
            return;
          }

          // Formular-Action bestimmen
          let rawAction = $form.attr('action') || '';
          let formAction;
          if (!rawAction) {
            formAction = '/game.php?village=' + originId + '&screen=place';
          } else if (rawAction.startsWith('/')) {
            formAction = rawAction;
          } else {
            formAction = '/' + rawAction;
          }

          // Alle Felder aus dem Bestätigungsformular extrahieren (inkl. ch-Hash)
          let step2Data = {};
          $form.find('input, select, textarea').each(function () {
            let $el   = $(this);
            let name  = $el.attr('name');
            let type  = ($el.attr('type') || 'text').toLowerCase();
            if (!name) return;
            if (type === 'checkbox' && !$el.prop('checked')) return;
            if (type === 'radio'    && !$el.prop('checked')) return;
            step2Data[name] = $el.val() || '';
          });

          // attack muss gesetzt sein
          if (!step2Data.attack) step2Data.attack = 'Angreifen';

          // Kata-Ziel überschreiben wenn vom User gesetzt (leerer Wert = Server-Standard)
          if (op.building) {
            step2Data.building = op.building;
            console.log('[TWOps] Kata-Ziel gesetzt:', op.building);
          }

          if (!step2Data.ch) {
            console.warn('[TWOps] ch-Hash nicht gefunden — Senden könnte fehlschlagen.');
          }

          console.log('[TWOps] Schritt 3 — POST Senden:', JSON.stringify(step2Data),
            'Action:', formAction);

          // ── SCHRITT 3: Angriff tatsächlich senden ───────────────────────
          return $.post(formAction, step2Data)
            .then(function (result) {
              let $r    = $(result);
              let errMsg = $r.find('.error_box, .system_wide_message').text().trim();
              let h2    = $r.find('h2').first().text().trim();
              console.log('[TWOps] Schritt 3 Ergebnis H2:', h2, '| Fehler:', errMsg);

              if (errMsg) {
                setStatus('Fehler: ' + errMsg.substring(0, 30), 'error', 'error');
                op.status = 'error';
                UI.ErrorMessage('[TWOps] Fehler: ' + errMsg.substring(0, 80));
                return;
              }

              setStatus('Gesendet ✓', 'sent', 'sent');
              op.status = 'sent';
              UI.SuccessMessage('Gesendet: ' + op.originCoord + ' → ' + op.targetCoord);
            })
            .fail(function (xhr) {
              setStatus('Fehler Senden', 'error', 'error');
              op.status = 'error';
              console.error('[TWOps] Schritt 3 fehlgeschlagen:', xhr.status,
                (xhr.responseText || '').substring(0, 200));
            });

        }).fail(function (xhr) {
          setStatus('Fehler Bestätigung', 'error', 'error');
          op.status = 'error';
          console.error('[TWOps] Schritt 2 fehlgeschlagen:', xhr.status);
        });

      }).fail(function (xhr) {
        setStatus('Fehler Place-Screen', 'error', 'error');
        op.status = 'error';
        console.error('[TWOps] Schritt 1 fehlgeschlagen:', xhr.status);
      });
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  const buildCSS = () => '<style>'
    + '#popup_box_TWOps{width:920px!important;max-height:90vh;overflow-y:auto}'
    + '#twOpsBox{font-family:Arial,sans-serif;font-size:11px}'
    + '#twOpsBox h3{margin:0 0 6px;font-size:14px}'
    + '#twOpsBox textarea{width:100%;height:100px;font-size:10px;resize:vertical;box-sizing:border-box}'
    + '#twOpsBox .ops-toolbar{margin:6px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap}'
    + '#twOpsBox table.ops-table{width:100%;border-collapse:collapse;margin-top:6px}'
    + '#twOpsBox table.ops-table th{background:#7D510F;color:#fff;padding:3px 4px;text-align:center;white-space:nowrap}'
    + '#twOpsBox table.ops-table td{padding:2px 4px;border-bottom:1px solid #ccc;text-align:center;vertical-align:middle}'
    + '#twOpsBox tr.pending td{background:#f4eed4}'
    + '#twOpsBox tr.sent td{background:#d4edda}'
    + '#twOpsBox tr.error td{background:#f8d7da}'
    + '#twOpsBox tr.missed td{background:#fff3cd}'
    + '#twOpsBox tr.imminent td{background:#ffe0b2;font-weight:bold}'
    + '.ops-countdown{font-weight:bold;color:#7D510F}'
    + '.ops-status-sent{color:#155724;font-weight:bold}'
    + '.ops-status-error{color:#721c24;font-weight:bold}'
    + '.ops-status-missed{color:#856404;font-weight:bold}'
    + '.ops-status-pending{color:#555}'
    + '.ops-troop-input{width:36px;text-align:center;font-size:10px;padding:1px 2px}'
    + '.ops-all-btn{font-size:9px;padding:1px 3px;cursor:pointer;margin-left:1px}'
    + '#twOpsSummary{margin-top:6px;padding:4px 8px;background:#f4eed4;border:1px solid #7D510F}'
    + '.ops-troop-cell{display:flex;flex-wrap:wrap;gap:2px;justify-content:center}'
    + '.ops-troop-entry{display:flex;flex-direction:column;align-items:center;font-size:9px}'
    + '.ops-troop-entry label{color:#555;margin-bottom:1px}'
    + '.ops-kata-row{margin-top:4px;font-size:9px;text-align:center}'
    + '.ops-kata-sel{font-size:10px;padding:1px 2px;border-radius:2px;border:1px solid #aaa;background:#fff;color:#333;cursor:pointer;max-width:140px}'
    + '</style>';

  const buildTroopCell = (op) => {
    let h = '<div class="ops-troop-cell">';
    UNITS.forEach(u => {
      let val = op.troops[u.key] || '';
      let dv  = (val === 'all') ? '' : val;
      let ph  = (val === 'all') ? 'alle' : '0';
      h += '<div class="ops-troop-entry">'
        + '<label>' + u.label + '</label>'
        + '<div style="display:flex;align-items:center;">'
        + '<input class="ops-troop-input" type="text"'
        + ' data-op="' + op.id + '" data-unit="' + u.key + '"'
        + ' value="' + dv + '" placeholder="' + ph + '">'
        + '<button class="ops-all-btn" data-op="' + op.id + '" data-unit="' + u.key + '">∞</button>'
        + '</div></div>';
    });
    // Kata-Ziel Dropdown
    let opts = BUILDINGS.map(b =>
      '<option value="' + b.key + '"' + (op.building === b.key ? ' selected' : '') + '>'
      + b.label + '</option>'
    ).join('');
    h += '</div>'
      + '<div class="ops-kata-row">🪨 Kata-Ziel: '
      + '<select class="ops-kata-sel" data-op="' + op.id + '">' + opts + '</select>'
      + '</div>';
    return h;
  };

  const buildTable = (ops) => {
    if (!ops.length) return '<p style="text-align:center;color:#c00;margin-top:8px">Keine Operationen gefunden.</p>';
    const fmt = ts => new Date(ts).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    let h = '<table class="ops-table">'
      + '<tr><th>#</th><th>Typ</th><th>Herkunft</th><th>Ziel</th>'
      + '<th>Truppen (leer=0, ∞=alle)</th><th>Abfahrt</th><th>Ankunft</th>'
      + '<th>Countdown</th><th>Status</th></tr>';

    ops.forEach((op, i) => {
      h += '<tr id="twOpsRow_' + op.id + '" class="' + op.status + '">'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + (op.type === 'fake' ? '<span style="color:#888">(F)</span>' : '<b>(R)</b>') + '</td>'
        + '<td style="text-align:left" title="' + op.originCoord + '">' + op.originVillage + '</td>'
        + '<td style="text-align:left" title="' + op.targetCoord + '">' + op.targetName + '</td>'
        + '<td>' + buildTroopCell(op) + '</td>'
        + '<td style="white-space:nowrap">' + fmt(op.departTs) + '</td>'
        + '<td style="white-space:nowrap">' + fmt(op.arriveTs) + '</td>'
        + '<td><span id="twOpsCd_' + op.id + '" class="ops-countdown">--</span></td>'
        + '<td><span id="twOpsSt_' + op.id + '" class="ops-status-pending">Ausstehend</span></td>'
        + '</tr>';
    });
    return h + '</table>';
  };

  // ── TICKER ─────────────────────────────────────────────────────────────────
  let tickInterval = null;

  const startTicker = (ops) => {
    clearInterval(tickInterval);
    tickInterval = setInterval(() => {
      let now = serverNow();
      ops.forEach(op => {
        if (op.status !== 'pending') return;
        let diff  = Math.round((op.departTs - now) / 1000);
        let cdEl  = document.getElementById('twOpsCd_'  + op.id);
        let rowEl = document.getElementById('twOpsRow_' + op.id);
        if (!cdEl) return;
        if (diff > 0) {
          let hh = Math.floor(diff / 3600);
          let mm = Math.floor((diff % 3600) / 60);
          let ss = diff % 60;
          cdEl.textContent = (hh > 0 ? hh + 'h ' : '')
            + (mm > 0 || hh > 0 ? String(mm).padStart(2, '0') + 'm ' : '')
            + String(ss).padStart(2, '0') + 's';
          if (diff <= 60 && rowEl) rowEl.className = 'imminent';
        } else {
          cdEl.textContent = 'Sendet...';
        }
      });
      updateSummary(ops);
      if (ops.every(o => o.status !== 'pending')) {
        clearInterval(tickInterval);
        updateSummary(ops, true);
      }
    }, 1000);
  };

  const updateSummary = (ops, done) => {
    let p  = ops.filter(o => o.status === 'pending').length;
    let s  = ops.filter(o => o.status === 'sent').length;
    let e  = ops.filter(o => o.status === 'error').length;
    let mi = ops.filter(o => o.status === 'missed').length;
    $('#twOpsSummary').show().html(
      (done ? '<b>Abgeschlossen.</b> ' : '<b>Aktiv</b> — ')
      + 'Ausstehend: <b>' + p + '</b>'
      + ' | Gesendet: <b style="color:#155724">' + s + '</b>'
      + ' | Fehler: <b style="color:#721c24">' + e + '</b>'
      + (mi ? ' | Verpasst: <b style="color:#856404">' + mi + '</b>' : '')
    );
  };

  const scheduleAll = (ops) => {
    let now = serverNow();
    ops.forEach(op => {
      if (op.status !== 'pending') return;
      let ms = op.departTs - now;
      if (ms < -5000) {
        op.status = 'missed';
        let s = document.getElementById('twOpsSt_'  + op.id);
        let c = document.getElementById('twOpsCd_'  + op.id);
        let r = document.getElementById('twOpsRow_' + op.id);
        if (s) { s.textContent = 'Verpasst'; s.className = 'ops-status-missed'; }
        if (c) c.textContent = '';
        if (r) r.className = 'missed';
        return;
      }
      if (ms < 0) ms = 0;
      op.timerId = setTimeout(() => sendAttack(op), ms);
    });
  };

  const cancelAll = (ops) => {
    ops.forEach(op => {
      if (op.timerId) clearTimeout(op.timerId);
      if (op.status === 'pending') {
        op.status = 'missed';
        let s = document.getElementById('twOpsSt_'  + op.id);
        let r = document.getElementById('twOpsRow_' + op.id);
        if (s) { s.textContent = 'Abgebrochen'; s.className = 'ops-status-missed'; }
        if (r) r.className = 'missed';
      }
    });
    clearInterval(tickInterval);
  };

  const readTroopsFromTable = (ops) => {
    ops.forEach(op => {
      UNITS.forEach(u => {
        let input = document.querySelector(
          'input.ops-troop-input[data-op="' + op.id + '"][data-unit="' + u.key + '"]'
        );
        if (!input) return;
        let val = input.value.trim();
        let ph  = input.placeholder;
        if (!val && ph === 'alle') {
          op.troops[u.key] = 'all';
        } else if (!val || val === '0') {
          delete op.troops[u.key];
        } else {
          op.troops[u.key] = val;
        }
      });
      // Kata-Ziel auslesen
      let kataSel = document.querySelector('.ops-kata-sel[data-op="' + op.id + '"]');
      if (kataSel) op.building = kataSel.value;
    });
  };

  // ── INIT ───────────────────────────────────────────────────────────────────
  const init = () => {
    initServerOffset();

    let ui = buildCSS()
      + '<div id="twOpsBox"><h3>Operation Scheduler v3</h3>'
      + '<textarea id="twOpsInput" placeholder="DS-Ultimate Export einfügen..."></textarea>'
      + '<div class="ops-toolbar">'
      + '<input type="button" id="twOpsLoad"   class="btn" value="Laden">'
      + '<input type="button" id="twOpsStart"  class="btn" value="Starten"   disabled style="background:#2a7;color:#fff;">'
      + '<input type="button" id="twOpsCancel" class="btn" value="Abbrechen" disabled style="background:#c44;color:#fff;">'
      + '<span style="font-size:10px;color:#888">Truppen eintragen, dann Starten.</span>'
      + '</div>'
      + '<div id="twOpsSummary" style="display:none"></div>'
      + '<div id="twOpsTable"></div></div>';

    Dialog.show('TWOps', ui);
    let currentOps = [];
    loadOwnVillages();

    $('#twOpsLoad').on('click', function () {
      let raw = $('#twOpsInput').val().trim();
      if (!raw) { UI.ErrorMessage('Bitte Export einfügen.'); return; }
      currentOps.forEach(op => { if (op.timerId) clearTimeout(op.timerId); });
      clearInterval(tickInterval);
      currentOps = parseExport(raw);
      $('#twOpsTable').html(buildTable(currentOps));
      if (!currentOps.length) return;

      $(document).off('click.opsAll').on('click.opsAll', '.ops-all-btn', function () {
        let oid  = $(this).data('op');
        let unit = $(this).data('unit');
        $('input.ops-troop-input[data-op="' + oid + '"][data-unit="' + unit + '"]')
          .val('').attr('placeholder', 'alle');
      });

      $('#twOpsStart').prop('disabled', false);
      $('#twOpsCancel').prop('disabled', true);
      UI.SuccessMessage(currentOps.length + ' Operationen geladen.');
    });

    $('#twOpsStart').on('click', function () {
      if (!currentOps.length) return;
      readTroopsFromTable(currentOps);
      let pending = currentOps.filter(o => o.status === 'pending');
      if (pending.every(o => !Object.keys(o.troops).length)) {
        UI.ErrorMessage('Bitte Truppen eintragen!'); return;
      }
      scheduleAll(currentOps);
      startTicker(currentOps);
      updateSummary(currentOps);
      $(this).prop('disabled', true);
      $('#twOpsCancel').prop('disabled', false);
      $('input.ops-troop-input, .ops-all-btn, .ops-kata-sel').prop('disabled', true);
      UI.SuccessMessage(pending.length + ' Angriffe geplant.');
    });

    $('#twOpsCancel').on('click', function () {
      cancelAll(currentOps);
      $(this).prop('disabled', true);
      $('input.ops-troop-input, .ops-all-btn, .ops-kata-sel').prop('disabled', false);
    });
  };

  init();

})();
