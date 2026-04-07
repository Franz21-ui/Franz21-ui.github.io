// TW Operation Scheduler v2
// Import DS-Ultimate Export, individuelle Truppeneinstellung, automatischer Versand
// Autor: Shop21 / W252

(() => {

  // ── EINHEITENLISTE ─────────────────────────────────────────────────────────
  const UNITS = [
    { key: 'spear',    label: 'Speer'    },
    { key: 'sword',    label: 'Schwert'  },
    { key: 'axe',      label: 'Axt'      },
    { key: 'spy',      label: 'Aufkl.'   },
    { key: 'light',    label: 'LKav'     },
    { key: 'heavy',    label: 'SKav'     },
    { key: 'ram',      label: 'Ramme'    },
    { key: 'catapult', label: 'Kata'     },
    { key: 'snob',     label: 'Adel'     },
    { key: 'knight',   label: 'Paladin'  },
  ];

  // DS-Ultimate Einheitenbezeichnungen -> key
  const UNIT_MAP = {
    'ramme': 'ram', 'rammboeck': 'ram', 'rammbock': 'ram',
    'axt': 'axe', 'axtkampfer': 'axe', 'axtkämpfer': 'axe',
    'speer': 'spear', 'schwert': 'sword',
    'lkav': 'light', 'leichte': 'light',
    'skav': 'heavy', 'schwere': 'heavy',
    'kata': 'catapult', 'katapult': 'catapult',
    'aufkl': 'spy', 'adel': 'snob', 'paladin': 'knight',
    'bogi': 'archer', 'berittener': 'marcher',
  };

  // ── SERVER-ZEIT ────────────────────────────────────────────────────────────
  let _serverOffset = 0;

  const initServerOffset = function () {
    try {
      let text = $('#serverTime').closest('p').text();
      let m = text.match(/(\d+):(\d+):(\d+)/);
      let dm = text.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!m || !dm) return;
      let serverTs = new Date(
        parseInt(dm[3]) < 100 ? 2000 + parseInt(dm[3]) : parseInt(dm[3]),
        parseInt(dm[2]) - 1, parseInt(dm[1]),
        parseInt(m[1]), parseInt(m[2]), parseInt(m[3])
      ).getTime();
      _serverOffset = serverTs - Date.now();
    } catch (e) { _serverOffset = 0; }
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
        let type       = cols[0].trim().replace(/[()]/g, '').toLowerCase();
        let originFull = cols[2].trim();
        let unitRaw    = cols[3].trim();
        let targetFull = cols[5].trim();
        let departStr  = cols[6].trim();
        let arriveStr  = cols[7].trim();

        let originCoord = (originFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        let targetCoord = (targetFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        if (!originCoord || !targetCoord) return;

        let originVillage = originFull.replace(/\s*\(.*\).*$/, '').trim();
        let targetName    = targetFull.replace(/\s*\(.*\).*$/, '').trim();

        // Einheit aus DS-Ultimate Namen mappen
        let unitKey = null;
        let unitLower = unitRaw.toLowerCase();
        for (let k in UNIT_MAP) {
          if (unitLower.includes(k)) { unitKey = UNIT_MAP[k]; break; }
        }

        const parseTime = (str) => {
          let m = str.match(/(\d+)\.(\d+)\.(\d+)\s+(\d+):(\d+):(\d+)/);
          if (!m) return null;
          let y = parseInt(m[3]) < 100 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
          return new Date(y, parseInt(m[2])-1, parseInt(m[1]),
            parseInt(m[4]), parseInt(m[5]), parseInt(m[6])).getTime();
        };

        let departTs = parseTime(departStr);
        let arriveTs = parseTime(arriveStr);
        if (!departTs || !arriveTs) return;

        // Truppen: leer = wird vom Nutzer in der Tabelle eingetragen
        let troops = {};
        if (unitKey) troops[unitKey] = 'all'; // Default: alle der erkannten Einheit

        ops.push({
          id: i,
          type, originVillage, originCoord, targetName, targetCoord,
          unitRaw, troops,
          departTs, arriveTs,
          status: 'pending',
          timerId: null,
        });
      } catch (e) {
        console.warn('Zeile ' + i + ' Fehler:', e);
      }
    });

    return ops.sort((a, b) => a.departTs - b.departTs);
  };

  // ── ORIGIN-ID ERMITTELN ────────────────────────────────────────────────────
  const getOriginId = function (op) {
    let parts = op.originCoord.replace(/[()]/g, '').split('|');
    let ox = parts[0].trim(), oy = parts[1].trim();

    // Aus game_data.villages (Array eigener Doerfer)
    if (Array.isArray(game_data.villages)) {
      for (let v of game_data.villages) {
        if (String(v.x) === ox && String(v.y) === oy) return v.id;
      }
    }
    // Fallback: aktuelles Dorf
    return game_data.village;
  };

  // ── ANGRIFF SENDEN (simuliert echte Browserinteraktion) ───────────────────
  const sendAttack = function (op) {
    let stEl  = document.getElementById('twOpsSt_'  + op.id);
    let cdEl  = document.getElementById('twOpsCd_'  + op.id);
    let rowEl = document.getElementById('twOpsRow_' + op.id);

    const setStatus = (txt, cls, rowCls) => {
      if (stEl)  { stEl.textContent = txt; stEl.className = 'ops-status-' + cls; }
      if (cdEl)  cdEl.textContent = '';
      if (rowEl) rowEl.className = rowCls || cls;
    };

    let tparts = op.targetCoord.replace(/[()]/g, '').split('|');
    let targetX = tparts[0].trim(), targetY = tparts[1].trim();
    let originId = getOriginId(op);

    // Truppen-Objekt aufbauen -- 'all' wird spaeter durch echte Zahl ersetzt
    let troopData = {};
    UNITS.forEach(u => {
      let val = op.troops[u.key];
      if (val && val !== '0' && val !== '') {
        troopData[u.key] = val; // 'all' oder Zahl als String
      }
    });

    if (Object.keys(troopData).length === 0) {
      setStatus('Keine Truppen', 'error', 'error');
      op.status = 'error';
      UI.ErrorMessage('Keine Truppen für: ' + op.originCoord + ' -> ' + op.targetCoord);
      return;
    }

    // Schritt 1: Place-Screen laden um verfügbare Truppen und CSRF zu lesen
    let placeUrl = TribalWars.buildURL('GET', 'place', {
      target_x: targetX,
      target_y: targetY,
      attack: '1',
      village: originId,
    });

    setStatus('Lade...', 'pending', 'imminent');

    $.get(placeUrl).then(function (html) {
      let $html = $(html);

      // CSRF Token
      let h = $html.find('input[name="h"]').val()
            || $html.find('input[name="ch"]').val()
            || game_data.csrf;

      // 'all' durch tatsaechliche Truppenzahl ersetzen
      let formData = { attack: 'true', h: h };

      let hasUnits = false;
      UNITS.forEach(u => {
        let val = troopData[u.key];
        if (!val) return;

        let inputEl = $html.find('input[name="' + u.key + '"]');
        if (!inputEl.length) return;

        let available = parseInt(
          inputEl.attr('data-all-count') ||
          inputEl.attr('max') ||
          inputEl.val() ||
          '0'
        );

        let count = (val === 'all') ? available : Math.min(parseInt(val) || 0, available);
        if (count > 0) {
          formData[u.key] = count;
          hasUnits = true;
        }
      });

      if (!hasUnits) {
        setStatus('Keine Truppen verfügbar', 'error', 'error');
        op.status = 'error';
        UI.ErrorMessage('Keine Truppen verfügbar: ' + op.originCoord + ' -> ' + op.targetCoord);
        return;
      }

      // Schritt 2: Angriffsformular absenden -> Bestätigungsseite
      let confirmUrl = game_data.link_base_pure + 'place&village=' + originId;

      $.post(confirmUrl, formData).then(function (confirmHtml) {
        let $c = $(confirmHtml);

        // Prüfen ob Bestätigungsformular da ist
        let confirmForm = $c.find('form[name="command-data-form"]');
        if (!confirmForm.length) {
          // Manchmal kein separates Formular -- direkt gesendet
          setStatus('Gesendet ✓', 'sent', 'sent');
          op.status = 'sent';
          UI.SuccessMessage('Gesendet: ' + op.originCoord + ' -> ' + op.targetCoord);
          return;
        }

        let confirmData = {};
        confirmForm.find('input').each(function () {
          let n = $(this).attr('name');
          let v = $(this).val();
          if (n) confirmData[n] = v;
        });
        // Sicherstellen dass attack gesetzt ist
        confirmData['attack'] = 'true';

        // Schritt 3: Bestätigung senden
        let sendUrl = game_data.link_base_pure + 'place&village=' + originId + '&try=confirm';

        $.post(sendUrl, confirmData).then(function (result) {
          // Prüfen ob Fehlerseite
          if ($(result).find('.error_box, .error-box').length) {
            setStatus('Fehler (Server)', 'error', 'error');
            op.status = 'error';
            UI.ErrorMessage('Server-Fehler: ' + op.originCoord + ' -> ' + op.targetCoord);
            return;
          }
          setStatus('Gesendet ✓', 'sent', 'sent');
          op.status = 'sent';
          UI.SuccessMessage('Gesendet: ' + op.originCoord + ' -> ' + op.targetCoord);
        }).fail(function () {
          setStatus('Fehler (Senden)', 'error', 'error');
          op.status = 'error';
        });

      }).fail(function () {
        setStatus('Fehler (Bestätigung)', 'error', 'error');
        op.status = 'error';
      });

    }).fail(function () {
      setStatus('Fehler (Place)', 'error', 'error');
      op.status = 'error';
    });
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  const buildCSS = () => `
    <style>
      #popup_box_TWOps { width: 900px !important; max-height: 90vh; overflow-y: auto; }
      #twOpsBox { font-family: Arial, sans-serif; font-size: 11px; }
      #twOpsBox h3 { margin: 0 0 6px 0; font-size: 14px; }
      #twOpsBox textarea { width: 100%; height: 100px; font-size: 10px; resize: vertical; box-sizing: border-box; }
      #twOpsBox .ops-toolbar { margin: 6px 0; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      #twOpsBox table.ops-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      #twOpsBox table.ops-table th { background: #7D510F; color: #fff; padding: 3px 4px; text-align: center; white-space: nowrap; }
      #twOpsBox table.ops-table td { padding: 2px 4px; border-bottom: 1px solid #ccc; text-align: center; vertical-align: middle; }
      #twOpsBox tr.pending td { background: #f4eed4; }
      #twOpsBox tr.sent td { background: #d4edda; }
      #twOpsBox tr.error td { background: #f8d7da; }
      #twOpsBox tr.missed td { background: #fff3cd; }
      #twOpsBox tr.imminent td { background: #ffe0b2; font-weight: bold; }
      .ops-countdown { font-weight: bold; color: #7D510F; font-size: 11px; }
      .ops-status-sent { color: #155724; font-weight: bold; }
      .ops-status-error { color: #721c24; font-weight: bold; }
      .ops-status-missed { color: #856404; font-weight: bold; }
      .ops-status-pending { color: #555; }
      .ops-troop-input { width: 36px; text-align: center; font-size: 10px; padding: 1px 2px; }
      .ops-all-btn { font-size: 9px; padding: 1px 3px; cursor: pointer; margin-left: 1px; }
      #twOpsSummary { margin-top: 6px; padding: 4px 8px; background: #f4eed4; border: 1px solid #7D510F; font-size: 11px; }
      .ops-troop-cell { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; min-width: 220px; }
      .ops-troop-entry { display: flex; flex-direction: column; align-items: center; font-size: 9px; }
      .ops-troop-entry label { color: #555; margin-bottom: 1px; }
    </style>
  `;

  const buildTroopCell = (op) => {
    let html = '<div class="ops-troop-cell">';
    UNITS.forEach(u => {
      let val = op.troops[u.key] || '';
      let displayVal = (val === 'all') ? '' : val; // 'all' -> leeres Feld mit Placeholder
      let placeholder = (val === 'all') ? 'alle' : '0';
      html += `<div class="ops-troop-entry">
        <label>${u.label}</label>
        <div style="display:flex;align-items:center;">
          <input class="ops-troop-input" type="text"
            data-op="${op.id}" data-unit="${u.key}"
            value="${displayVal}" placeholder="${placeholder}"
            title="${u.label}">
          <button class="ops-all-btn" data-op="${op.id}" data-unit="${u.key}" title="Alle">∞</button>
        </div>
      </div>`;
    });
    html += '</div>';
    return html;
  };

  const buildTable = (ops) => {
    if (!ops.length) {
      return '<p style="text-align:center;color:#c00;margin-top:8px;">Keine gültigen Operationen gefunden. Format prüfen.</p>';
    }

    let html = `<table class="ops-table">
      <tr>
        <th>#</th><th>Typ</th><th>Herkunft</th><th>Ziel</th>
        <th>Truppen (leer=0, ∞=alle)</th>
        <th>Abfahrt</th><th>Ankunft</th><th>Countdown</th><th>Status</th>
      </tr>`;

    const fmt = ts => new Date(ts).toLocaleString('de-DE', {
      day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'
    });

    ops.forEach((op, i) => {
      html += `<tr id="twOpsRow_${op.id}" class="${op.status}">
        <td>${i+1}</td>
        <td>${op.type === 'fake' ? '<span style="color:#888">(F)</span>' : '<b>(R)</b>'}</td>
        <td style="text-align:left;" title="${op.originCoord}">${op.originVillage}</td>
        <td style="text-align:left;" title="${op.targetCoord}">${op.targetName}</td>
        <td id="twOpsTroops_${op.id}">${buildTroopCell(op)}</td>
        <td style="white-space:nowrap;">${fmt(op.departTs)}</td>
        <td style="white-space:nowrap;">${fmt(op.arriveTs)}</td>
        <td><span id="twOpsCd_${op.id}" class="ops-countdown">--</span></td>
        <td><span id="twOpsSt_${op.id}" class="ops-status-pending">Ausstehend</span></td>
      </tr>`;
    });

    html += '</table>';
    return html;
  };

  // ── TICKER ─────────────────────────────────────────────────────────────────
  let tickInterval = null;

  const startTicker = (ops) => {
    clearInterval(tickInterval);
    tickInterval = setInterval(() => {
      let now = serverNow();

      ops.forEach(op => {
        if (op.status !== 'pending') return;
        let diff = Math.round((op.departTs - now) / 1000);
        let cdEl  = document.getElementById('twOpsCd_'  + op.id);
        let rowEl = document.getElementById('twOpsRow_' + op.id);
        if (!cdEl) return;

        if (diff > 0) {
          let h = Math.floor(diff / 3600);
          let m = Math.floor((diff % 3600) / 60);
          let s = diff % 60;
          cdEl.textContent = (h > 0 ? h + 'h ' : '')
            + (m > 0 || h > 0 ? String(m).padStart(2,'0') + 'm ' : '')
            + String(s).padStart(2,'0') + 's';
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

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  const updateSummary = (ops, done) => {
    let p = ops.filter(o => o.status === 'pending').length;
    let s = ops.filter(o => o.status === 'sent').length;
    let e = ops.filter(o => o.status === 'error').length;
    let mi = ops.filter(o => o.status === 'missed').length;
    $('#twOpsSummary').show().html(
      (done ? '<b>Abgeschlossen.</b> ' : '<b>Aktiv</b> -- ') +
      'Ausstehend: <b>' + p + '</b> | ' +
      'Gesendet: <b style="color:#155724">' + s + '</b> | ' +
      'Fehler: <b style="color:#721c24">' + e + '</b>' +
      (mi ? ' | Verpasst: <b style="color:#856404">' + mi + '</b>' : '')
    );
  };

  // ── SCHEDULER ──────────────────────────────────────────────────────────────
  const scheduleAll = (ops) => {
    let now = serverNow();
    ops.forEach(op => {
      let ms = op.departTs - now;
      if (ms < -5000) {
        op.status = 'missed';
        let stEl  = document.getElementById('twOpsSt_'  + op.id);
        let cdEl  = document.getElementById('twOpsCd_'  + op.id);
        let rowEl = document.getElementById('twOpsRow_' + op.id);
        if (stEl)  { stEl.textContent = 'Verpasst'; stEl.className = 'ops-status-missed'; }
        if (cdEl)  cdEl.textContent = '';
        if (rowEl) rowEl.className = 'missed';
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
        let stEl  = document.getElementById('twOpsSt_'  + op.id);
        let rowEl = document.getElementById('twOpsRow_' + op.id);
        if (stEl)  { stEl.textContent = 'Abgebrochen'; stEl.className = 'ops-status-missed'; }
        if (rowEl) rowEl.className = 'missed';
      }
    });
    clearInterval(tickInterval);
  };

  // ── TRUPPEN AUS TABELLE LESEN ──────────────────────────────────────────────
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
    });
  };

  // ── INIT ───────────────────────────────────────────────────────────────────
  const init = () => {
    initServerOffset();

    let ui = buildCSS() + `
      <div id="twOpsBox">
        <h3>⚔ Operation Scheduler</h3>
        <textarea id="twOpsInput" placeholder="DS-Ultimate Export hier einfügen (Tab-getrennt)..."></textarea>
        <div class="ops-toolbar">
          <input type="button" id="twOpsLoad"   class="btn" value="Operationen laden">
          <input type="button" id="twOpsStart"  class="btn" value="▶ Starten" disabled style="background:#2a7;color:#fff;">
          <input type="button" id="twOpsCancel" class="btn" value="■ Abbrechen" disabled style="background:#c44;color:#fff;">
          <span style="font-size:10px;color:#888;">Truppen in der Tabelle eintragen, dann Starten klicken.</span>
        </div>
        <div id="twOpsSummary" style="display:none;"></div>
        <div id="twOpsTable"></div>
      </div>`;

    Dialog.show('TWOps', ui);

    let currentOps = [];

    // Operationen laden -- nur parsen und Tabelle zeigen, noch nicht planen
    $('#twOpsLoad').on('click', function () {
      let raw = $('#twOpsInput').val().trim();
      if (!raw) { UI.ErrorMessage('Bitte Export einfügen.'); return; }

      currentOps.forEach(op => { if (op.timerId) clearTimeout(op.timerId); });
      clearInterval(tickInterval);

      currentOps = parseExport(raw);
      $('#twOpsTable').html(buildTable(currentOps));

      if (!currentOps.length) return;

      // Event: ∞-Button setzt Placeholder auf "alle"
      $(document).off('click.opsAll').on('click.opsAll', '.ops-all-btn', function () {
        let opId   = $(this).data('op');
        let unit   = $(this).data('unit');
        let input  = $('input.ops-troop-input[data-op="' + opId + '"][data-unit="' + unit + '"]');
        input.val('').attr('placeholder', 'alle');
      });

      $('#twOpsStart').prop('disabled', false);
      $('#twOpsCancel').prop('disabled', true);

      let missed = currentOps.filter(o => {
        let ms = o.departTs - serverNow();
        return ms < -5000;
      }).length;

      UI.SuccessMessage(
        currentOps.length + ' Operationen geladen' +
        (missed ? ' (' + missed + ' bereits verpasst)' : '') +
        '. Truppen eintragen, dann Starten klicken.'
      );
    });

    // Starten -- Truppen aus Tabelle lesen, dann schedulen
    $('#twOpsStart').on('click', function () {
      if (!currentOps.length) return;

      readTroopsFromTable(currentOps);

      // Prüfen ob mindestens eine Op Truppen hat
      let noTroops = currentOps.filter(o =>
        o.status === 'pending' && Object.keys(o.troops).length === 0
      );
      if (noTroops.length === currentOps.filter(o => o.status === 'pending').length) {
        UI.ErrorMessage('Bitte mindestens eine Einheit pro Operation eintragen!');
        return;
      }

      scheduleAll(currentOps);
      startTicker(currentOps);
      updateSummary(currentOps);

      $('#twOpsStart').prop('disabled', true);
      $('#twOpsCancel').prop('disabled', false);

      // Truppenfelder sperren damit nichts mehr geändert wird
      $('input.ops-troop-input').prop('disabled', true);
      $('.ops-all-btn').prop('disabled', true);

      let pending = currentOps.filter(o => o.status === 'pending').length;
      UI.SuccessMessage(pending + ' Angriffe geplant und aktiv.');
    });

    // Abbrechen
    $('#twOpsCancel').on('click', function () {
      cancelAll(currentOps);
      $(this).prop('disabled', true);
      $('input.ops-troop-input').prop('disabled', false);
      $('.ops-all-btn').prop('disabled', false);
      UI.ErrorMessage('Alle ausstehenden Operationen abgebrochen.');
    });
  };

  init();

})();
