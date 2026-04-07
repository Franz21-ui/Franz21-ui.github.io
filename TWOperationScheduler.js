// TW Operation Scheduler
// Importiert DS-Ultimate Export-Format und sendet Angriffe sekunden-genau zum geplanten Zeitpunkt
// Autor: Shop21 / W252 -- gebaut auf FarmGod-Architektur

(() => {

  // ── EINHEITENTYPEN-MAPPING ─────────────────────────────────────────────────
  // DS Ultimate Bezeichnung -> interne TW Einheitennamen
  const UNIT_MAP = {
    'ramme':     'ram',
    'rammboeck': 'ram',
    'rammbock':  'ram',
    'axt':       'axe',
    'axtkampfer':'axe',
    'speer':     'spear',
    'schwert':   'sword',
    'lkav':      'light',
    'leichte':   'light',
    'skav':      'heavy',
    'schwere':   'heavy',
    'bogi':      'archer',
    'berittener':'marcher',
    'kata':      'catapult',
    'katapult':  'catapult',
    'aufkl':     'spy',
    'adel':      'snob',
    'paladin':   'knight',
  };

  // ── SERVER-ZEIT SYNC ───────────────────────────────────────────────────────
  // Liest die angezeigte Serverzeit und berechnet den Offset zur lokalen Zeit
  // So bleibt der Timer auch bei PC-Zeitabweichungen korrekt
  const getServerOffset = function () {
    try {
      let text = $('#serverTime').closest('p').text();
      let m = text.match(/(\d+):(\d+):(\d+)/);
      let dm = text.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!m || !dm) return 0;
      let serverNow = new Date(
        parseInt(dm[3]), parseInt(dm[2]) - 1, parseInt(dm[1]),
        parseInt(m[1]), parseInt(m[2]), parseInt(m[3])
      ).getTime();
      return serverNow - Date.now();
    } catch (e) {
      return 0;
    }
  };

  const serverNow = function () {
    return Date.now() + getServerOffset();
  };

  // ── PARSER ─────────────────────────────────────────────────────────────────
  // Liest DS-Ultimate Tab-Export:
  // Typ | Spieler | Herkunft (Coord) | Einheit | Ziel-Spieler | Zielname (Coord) | Abfahrt | Ankunft
  const parseExport = function (raw) {
    let ops = [];
    let lines = raw.trim().split('\n');

    lines.forEach((line, i) => {
      line = line.trim();
      if (!line) return;

      let cols = line.split('\t');
      if (cols.length < 8) {
        // Versuche Leerzeichen-Split als Fallback
        cols = line.split(/\s{2,}/);
      }
      if (cols.length < 8) return;

      try {
        let type       = cols[0].trim().replace(/[()]/g, '').toLowerCase(); // fake/real
        let originFull = cols[2].trim();
        let unitRaw    = cols[3].trim().toLowerCase();
        let targetFull = cols[5].trim();
        let departStr  = cols[6].trim();
        let arriveStr  = cols[7].trim();

        // Koordinaten extrahieren z.B. "(506|558)"
        let originCoord = (originFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        let targetCoord = (targetFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        if (!originCoord || !targetCoord) return;

        // Dorfteil extrahieren z.B. "K-55:221:16 S"
        let originVillage = originFull.replace(/\s*\(.*\).*$/, '').trim();
        let targetName    = targetFull.replace(/\s*\(.*\).*$/, '').trim();

        // Einheit mappen
        let unitKey = null;
        for (let key in UNIT_MAP) {
          if (unitRaw.includes(key)) {
            unitKey = UNIT_MAP[key];
            break;
          }
        }

        // Zeiten parsen: "07.04.26 17:43:15" -> timestamp
        const parseTime = (str) => {
          let m = str.match(/(\d+)\.(\d+)\.(\d+)\s+(\d+):(\d+):(\d+)/);
          if (!m) return null;
          let year = parseInt(m[3]) < 100 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
          return new Date(year, parseInt(m[2]) - 1, parseInt(m[1]),
            parseInt(m[4]), parseInt(m[5]), parseInt(m[6])).getTime();
        };

        let departTs = parseTime(departStr);
        let arriveTs = parseTime(arriveStr);
        if (!departTs || !arriveTs) return;

        ops.push({
          id:            i,
          type:          type, // 'fake' oder 'real' (nur zur Anzeige)
          originVillage: originVillage,
          originCoord:   originCoord,
          targetName:    targetName,
          targetCoord:   targetCoord,
          unit:          unitKey,
          unitRaw:       cols[3].trim(),
          departTs:      departTs,
          arriveTs:      arriveTs,
          status:        'pending', // pending | sent | error | missed
          timerId:       null,
        });
      } catch (e) {
        console.warn('Zeile ' + i + ' konnte nicht geparst werden:', e);
      }
    });

    return ops.sort((a, b) => a.departTs - b.departTs);
  };

  // ── UI BUILDER ─────────────────────────────────────────────────────────────
  const buildUI = function () {
    return `
      <style>
        #twOpsBox { font-family: Arial, sans-serif; font-size: 11px; }
        #twOpsBox h3 { margin: 0 0 8px 0; font-size: 14px; }
        #twOpsBox textarea { width: 100%; height: 120px; font-size: 10px; resize: vertical; box-sizing: border-box; }
        #twOpsBox table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        #twOpsBox th { background: #7D510F; color: #fff; padding: 3px 5px; text-align: center; }
        #twOpsBox td { padding: 3px 5px; border-bottom: 1px solid #ccc; text-align: center; }
        #twOpsBox tr.pending td { background: #f4eed4; }
        #twOpsBox tr.sent td { background: #d4edda; }
        #twOpsBox tr.error td { background: #f8d7da; }
        #twOpsBox tr.missed td { background: #fff3cd; }
        #twOpsBox tr.imminent td { background: #ffe0b2; font-weight: bold; }
        .ops-countdown { font-weight: bold; color: #7D510F; }
        .ops-status-sent { color: #155724; font-weight: bold; }
        .ops-status-error { color: #721c24; font-weight: bold; }
        .ops-status-missed { color: #856404; font-weight: bold; }
        #twOpsSummary { margin-top: 6px; padding: 4px 8px; background: #f4eed4; border: 1px solid #7D510F; font-size: 11px; }
        #popup_box_TWOps { width: 820px !important; }
      </style>
      <div id="twOpsBox">
        <h3>Operation Scheduler</h3>
        <textarea id="twOpsInput" placeholder="DS-Ultimate Export hier einfügen (Tab-getrennt)..."></textarea>
        <br>
        <input type="button" id="twOpsLoad" class="btn" value="Operationen laden" style="margin-top:4px;">
        <input type="button" id="twOpsCancel" class="btn" value="Alle abbrechen" style="margin-top:4px;margin-left:6px;background:#c44;color:#fff;" disabled>
        <div id="twOpsSummary" style="display:none;"></div>
        <div id="twOpsTable"></div>
      </div>
    `;
  };

  // ── TABELLE RENDERN ────────────────────────────────────────────────────────
  const renderTable = function (ops) {
    if (!ops.length) {
      $('#twOpsTable').html('<p style="text-align:center;color:#c00;">Keine gültigen Operationen gefunden. Format prüfen.</p>');
      return;
    }

    let html = `<table>
      <tr>
        <th>#</th>
        <th>Typ</th>
        <th>Herkunft</th>
        <th>Ziel</th>
        <th>Einheit</th>
        <th>Abfahrt</th>
        <th>Ankunft</th>
        <th>Countdown</th>
        <th>Status</th>
      </tr>`;

    ops.forEach((op, i) => {
      let departStr = new Date(op.departTs).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      let arriveStr = new Date(op.arriveTs).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      html += `<tr id="twOpsRow_${op.id}" class="${op.status}">
        <td>${i + 1}</td>
        <td>${op.type === 'fake' ? '(F)' : '(R)'}</td>
        <td title="${op.originCoord}">${op.originVillage}</td>
        <td title="${op.targetCoord}">${op.targetName}</td>
        <td>${op.unitRaw}</td>
        <td>${departStr}</td>
        <td>${arriveStr}</td>
        <td><span id="twOpsCd_${op.id}" class="ops-countdown">--</span></td>
        <td><span id="twOpsSt_${op.id}">Ausstehend</span></td>
      </tr>`;
    });

    html += '</table>';
    $('#twOpsTable').html(html);
  };

  // ── COUNTDOWN TICKER ───────────────────────────────────────────────────────
  let tickInterval = null;

  const startTicker = function (ops) {
    clearInterval(tickInterval);
    tickInterval = setInterval(function () {
      let now = serverNow();
      let pending = 0;
      let sent = 0;
      let errors = 0;

      ops.forEach(op => {
        if (op.status === 'pending') {
          pending++;
          let diff = Math.round((op.departTs - now) / 1000);
          let cdEl = document.getElementById('twOpsCd_' + op.id);
          let rowEl = document.getElementById('twOpsRow_' + op.id);
          if (!cdEl) return;

          if (diff > 0) {
            let h = Math.floor(diff / 3600);
            let m = Math.floor((diff % 3600) / 60);
            let s = diff % 60;
            cdEl.textContent = (h > 0 ? h + 'h ' : '') +
              (m > 0 || h > 0 ? String(m).padStart(2, '0') + 'm ' : '') +
              String(s).padStart(2, '0') + 's';
            if (diff <= 60 && rowEl) rowEl.className = 'imminent';
          } else {
            cdEl.textContent = 'Wird gesendet...';
          }
        } else if (op.status === 'sent') { sent++; }
        else if (op.status === 'error') { errors++; }

        updateSummary(ops);
      });

      // Ticker stoppen wenn alle durch
      let allDone = ops.every(op => op.status !== 'pending');
      if (allDone) {
        clearInterval(tickInterval);
        updateSummary(ops, true);
      }
    }, 1000);
  };

  // ── ZUSAMMENFASSUNG ────────────────────────────────────────────────────────
  const updateSummary = function (ops, done) {
    let pending = ops.filter(o => o.status === 'pending').length;
    let sent    = ops.filter(o => o.status === 'sent').length;
    let errors  = ops.filter(o => o.status === 'error').length;
    let missed  = ops.filter(o => o.status === 'missed').length;

    $('#twOpsSummary').show().html(
      (done ? '<b>Operation abgeschlossen.</b> ' : '<b>Aktiv</b> -- ') +
      'Ausstehend: <b>' + pending + '</b> &nbsp;|&nbsp; ' +
      'Gesendet: <b style="color:#155724">' + sent + '</b> &nbsp;|&nbsp; ' +
      'Fehler: <b style="color:#721c24">' + errors + '</b>' +
      (missed ? ' &nbsp;|&nbsp; Verpasst: <b style="color:#856404">' + missed + '</b>' : '')
    );
  };

  // ── ANGRIFF SENDEN ─────────────────────────────────────────────────────────
  // Baut den Angriffs-POST direkt gegen den Place-Screen
  const sendAttack = function (op) {
    let stEl = document.getElementById('twOpsSt_' + op.id);
    let cdEl = document.getElementById('twOpsCd_' + op.id);
    let rowEl = document.getElementById('twOpsRow_' + op.id);

    // Ziel-Village-ID aus der Karte holen
    let targetX = op.targetCoord.replace(/[()]/g, '').split('|')[0];
    let targetY = op.targetCoord.replace(/[()]/g, '').split('|')[1];
    let originX = op.originCoord.replace(/[()]/g, '').split('|')[0];
    let originY = op.originCoord.replace(/[()]/g, '').split('|')[1];

    // Village-IDs per API ermitteln
    $.get(TribalWars.buildURL('GET', 'get_villages', {
      x: targetX, y: targetY
    })).then(function (data) {
      // Fallback: direkt über map/village.txt Koordinaten -> ID
      // Da get_villages nicht immer verfügbar, bauen wir den Link manuell
      let targetId = null;
      let originId = null;

      // Aus game_data.villages die IDs holen
      if (game_data.villages) {
        game_data.villages.forEach(function (v) {
          if (v.x == originX && v.y == originY) originId = v.id;
        });
      }

      // Village per overview_villages suchen falls nicht gefunden
      if (!originId) {
        // Koordinaten direkt im DOM suchen
        $('[data-x="' + originX + '"][data-y="' + originY + '"]').each(function () {
          originId = $(this).data('id') || originId;
        });
      }

      doSendAttack(op, originId, targetX, targetY, stEl, cdEl, rowEl);
    }).fail(function () {
      doSendAttack(op, null, targetX, targetY, stEl, cdEl, rowEl);
    });
  };

  const doSendAttack = function (op, originId, targetX, targetY, stEl, cdEl, rowEl) {
    // Aufbau: Truppenversammlung -> Bestätigung -> Senden
    // Schritt 1: Truppenversammlung aufrufen mit Zielkoordinaten
    let placeUrl = TribalWars.buildURL('GET', 'place', {
      target_x: targetX,
      target_y: targetY,
      attack: true
    });

    if (originId) {
      placeUrl = placeUrl.replace(/village=\d+/, 'village=' + originId);
    }

    $.get(placeUrl).then(function (html) {
      let $html = $(html);
      // CSRF Token extrahieren
      let csrfToken = $html.find('input[name="h"]').val() ||
                      $html.find('input[name="ch"]').val() ||
                      game_data.csrf;

      // Formular-Daten aufbauen
      let formData = {
        target_x: targetX,
        target_y: targetY,
        attack: '1',
        h: csrfToken,
      };

      // Einheit eintragen -- Feld befüllen
      if (op.unit) {
        // Maximale Truppen aus dem Formular lesen
        let unitInput = $html.find('input#unit_input_' + op.unit);
        let maxUnits = unitInput.attr('data-all-count') || unitInput.attr('max') || 1;
        formData[op.unit] = maxUnits;
      }

      // Schritt 2: Angriff bestätigen
      let confirmUrl = TribalWars.buildURL('POST', 'place', {});
      if (originId) confirmUrl = confirmUrl.replace(/village=\d+/, 'village=' + originId);

      $.post(confirmUrl, formData).then(function (confirmHtml) {
        let $confirm = $(confirmHtml);
        let confirmToken = $confirm.find('input[name="h"]').val() ||
                           $confirm.find('input[name="ch"]').val() ||
                           csrfToken;
        let confirmData = { h: confirmToken, attack: '1' };

        // Alle hidden inputs aus dem Bestätigungsformular übernehmen
        $confirm.find('form[name="command-data-form"] input[type="hidden"]').each(function () {
          confirmData[$(this).attr('name')] = $(this).val();
        });

        // Schritt 3: Endgültiger POST
        let sendUrl = TribalWars.buildURL('POST', 'place', { try: 'confirm' });
        if (originId) sendUrl = sendUrl.replace(/village=\d+/, 'village=' + originId);

        $.post(sendUrl, confirmData).then(function () {
          op.status = 'sent';
          if (stEl) { stEl.textContent = 'Gesendet'; stEl.className = 'ops-status-sent'; }
          if (cdEl) cdEl.textContent = '';
          if (rowEl) rowEl.className = 'sent';
          UI.SuccessMessage('Angriff gesendet: ' + op.originCoord + ' -> ' + op.targetCoord);
        }).fail(function () {
          op.status = 'error';
          if (stEl) { stEl.textContent = 'Fehler'; stEl.className = 'ops-status-error'; }
          if (cdEl) cdEl.textContent = '';
          if (rowEl) rowEl.className = 'error';
          UI.ErrorMessage('Fehler beim Senden: ' + op.originCoord + ' -> ' + op.targetCoord);
        });

      }).fail(function () {
        op.status = 'error';
        if (stEl) { stEl.textContent = 'Fehler (Bestätigung)'; stEl.className = 'ops-status-error'; }
        if (rowEl) rowEl.className = 'error';
      });

    }).fail(function () {
      op.status = 'error';
      if (stEl) { stEl.textContent = 'Fehler (Place)'; stEl.className = 'ops-status-error'; }
      if (rowEl) rowEl.className = 'error';
    });
  };

  // ── SCHEDULER ──────────────────────────────────────────────────────────────
  // Plant für jede Operation einen präzisen setTimeout
  const scheduleAll = function (ops) {
    let now = serverNow();

    ops.forEach(op => {
      let msUntilDepart = op.departTs - now;

      if (msUntilDepart < -5000) {
        // Bereits mehr als 5s in der Vergangenheit -- verpasst
        op.status = 'missed';
        let stEl = document.getElementById('twOpsSt_' + op.id);
        let cdEl = document.getElementById('twOpsCd_' + op.id);
        let rowEl = document.getElementById('twOpsRow_' + op.id);
        if (stEl) { stEl.textContent = 'Verpasst'; stEl.className = 'ops-status-missed'; }
        if (cdEl) cdEl.textContent = '';
        if (rowEl) rowEl.className = 'missed';
        return;
      }

      if (msUntilDepart < 0) msUntilDepart = 0;

      op.timerId = setTimeout(function () {
        sendAttack(op);
      }, msUntilDepart);
    });
  };

  // ── ALLE ABBRECHEN ─────────────────────────────────────────────────────────
  const cancelAll = function (ops) {
    ops.forEach(op => {
      if (op.timerId) clearTimeout(op.timerId);
      if (op.status === 'pending') {
        op.status = 'missed';
        let stEl = document.getElementById('twOpsSt_' + op.id);
        let rowEl = document.getElementById('twOpsRow_' + op.id);
        if (stEl) { stEl.textContent = 'Abgebrochen'; stEl.className = 'ops-status-missed'; }
        if (rowEl) rowEl.className = 'missed';
      }
    });
    clearInterval(tickInterval);
    UI.ErrorMessage('Alle ausstehenden Operationen wurden abgebrochen.');
  };

  // ── INIT ───────────────────────────────────────────────────────────────────
  const init = function () {
    if (!game_data.features.Premium || !game_data.features.Premium.active) {
      UI.ErrorMessage('Operation Scheduler benötigt einen Premium Account!');
      return;
    }

    Dialog.show('TWOps', buildUI());

    let currentOps = [];

    $('#twOpsLoad').off('click').on('click', function () {
      let raw = $('#twOpsInput').val().trim();
      if (!raw) {
        UI.ErrorMessage('Bitte zuerst den DS-Ultimate Export einfügen.');
        return;
      }

      // Alte Timer stoppen
      currentOps.forEach(op => { if (op.timerId) clearTimeout(op.timerId); });
      clearInterval(tickInterval);

      currentOps = parseExport(raw);
      renderTable(currentOps);

      if (!currentOps.length) return;

      scheduleAll(currentOps);
      startTicker(currentOps);
      updateSummary(currentOps);

      $('#twOpsCancel').prop('disabled', false);

      let pending = currentOps.filter(o => o.status === 'pending').length;
      let missed  = currentOps.filter(o => o.status === 'missed').length;
      UI.SuccessMessage(
        pending + ' Operationen geplant' +
        (missed ? ', ' + missed + ' bereits verpasst' : '') + '.'
      );
    });

    $('#twOpsCancel').off('click').on('click', function () {
      cancelAll(currentOps);
      $('#twOpsCancel').prop('disabled', true);
    });
  };

  init();

})();
