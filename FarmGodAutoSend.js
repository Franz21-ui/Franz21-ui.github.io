/*
 * FarmGod Safe Extension
 * Sichere Erweiterung für:
 * 1) Barbaren-Metadaten aus /map/village.txt lesen
 * 2) neue Barbaren als Kandidaten für Farmplanung bereitstellen
 * 3) manuellen Katapult-Coach anzeigen
 */

(function () {
  'use strict';

  if (!window.FarmGod) window.FarmGod = {};

  window.FarmGod.SafeExtension = (function () {
    const STORAGE = {
      barbarianMeta: 'FarmGod_barbarianMeta',
      catapultCoachOptions: 'FarmGod_catapultCoachOptions',
      safetyOptions: 'FarmGod_safetyOptions',
    };

    const DEFAULT_SAFETY = {
      minDelayMs: 900,
      maxDelayMs: 2400,
      maxSendsPerMinute: 25,
      maxConsecutiveErrors: 3,
      maxErrorsPerRun: 8,
      hardStopAfterSends: 250,
    };

    const DEFAULT_CATAPULT = {
      originId: '',
      originCoord: '',
      maxDistance: 20,
      unitPreset: {
        spear: 0,
        sword: 0,
        axe: 0,
        archer: 0,
        spy: 0,
        light: 0,
        marcher: 0,
        heavy: 0,
        ram: 0,
        catapult: 1,
      },
      targetBuilding: 'main',
      limit: 25,
    };

    let safetyPaused = false;
    let safetyReason = '';
    let sendTimestamps = [];
    let consecutiveErrors = 0;

    const getJson = function (key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
      } catch (e) {
        return fallback;
      }
    };

    const setJson = function (key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    };

    const toCoordObject = function (coord) {
      const parts = String(coord || '').split('|');
      return {
        x: parseInt(parts[0], 10) || 0,
        y: parseInt(parts[1], 10) || 0,
      };
    };

    const distance = function (a, b) {
      const ca = toCoordObject(a);
      const cb = toCoordObject(b);
      return Math.hypot(ca.x - cb.x, ca.y - cb.y);
    };

    const escapeHtml = function (value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const hasSafetyChallenge = function (htmlText) {
      const text = (htmlText || document.body.innerText || '').toString().toLowerCase();
      return [
        'captcha',
        'bot',
        'automatisiert',
        'automated',
        'sicherheitsprüfung',
        'security check',
        'schutz',
        'verification',
        'verify',
        'cloudflare',
      ].some((needle) => text.indexOf(needle) !== -1);
    };

    const pauseForSafety = function (reason) {
      safetyPaused = true;
      safetyReason = reason || 'Sicherheitsprüfung erkannt';

      $('#farmGodSafePauseBox').remove();

      const html =
        '<div id="farmGodSafePauseBox" class="info_box" style="margin:8px auto;width:98%;text-align:left;line-height:16px;">' +
        '<b>FarmGod pausiert aus Sicherheitsgründen.</b><br>' +
        'Grund: ' + escapeHtml(safetyReason) + '<br>' +
        'Es werden keine weiteren automatisierten Aktionen ausgeführt. Bitte prüfe die Seite manuell.' +
        '<br><br><input type="button" id="farmGodSafeResumeBtn" class="btn" value="Nach manueller Prüfung fortsetzen">' +
        '</div>';

      const $target = $('.farmGodContent').first();
      if ($target.length) {
        $target.before(html);
      } else {
        $('#content_value, #contentContainer, body').first().prepend(html);
      }

      $('#farmGodSafeResumeBtn')
        .off('click')
        .on('click', function () {
          safetyPaused = false;
          safetyReason = '';
          consecutiveErrors = 0;
          sendTimestamps = [];
          $('#farmGodSafePauseBox').remove();
        });
    };

    const pruneSendTimestamps = function () {
      const now = Date.now();
      sendTimestamps = sendTimestamps.filter((ts) => now - ts < 60000);
    };

    const canSendByRateLimit = function () {
      const opts = Object.assign({}, DEFAULT_SAFETY, getJson(STORAGE.safetyOptions, {}));
      pruneSendTimestamps();

      if (sendTimestamps.length >= opts.maxSendsPerMinute) {
        pauseForSafety('Rate-Limit erreicht: ' + opts.maxSendsPerMinute + ' Sends pro Minute');
        return false;
      }

      return true;
    };

    const registerSendSuccess = function () {
      consecutiveErrors = 0;
      sendTimestamps.push(Date.now());
    };

    const registerSendError = function (errorText) {
      const opts = Object.assign({}, DEFAULT_SAFETY, getJson(STORAGE.safetyOptions, {}));
      consecutiveErrors++;

      if (hasSafetyChallenge(errorText)) {
        pauseForSafety('Sicherheitsprüfung oder Bot-Hinweis in Serverantwort erkannt');
        return false;
      }

      if (consecutiveErrors >= opts.maxConsecutiveErrors) {
        pauseForSafety('Zu viele aufeinanderfolgende Fehler beim Senden erkannt');
        return false;
      }

      return true;
    };

    const getSafeDelay = function () {
      const opts = Object.assign({}, DEFAULT_SAFETY, getJson(STORAGE.safetyOptions, {}));
      return Math.floor(Math.random() * (opts.maxDelayMs - opts.minDelayMs + 1)) + opts.minDelayMs;
    };

    const fetchBarbarianMetadata = function () {
      return $.get('/map/village.txt').then(function (raw) {
        const rows = String(raw || '').match(/[^\r\n]+/g) || [];
        const barbs = {};

        rows.forEach(function (line) {
          const parts = line.split(',');
          if (parts.length < 5) return;

          const id = parseInt(parts[0], 10);
          const name = decodeURIComponent(String(parts[1] || '').replace(/\+/g, ' '));
          const x = parseInt(parts[2], 10);
          const y = parseInt(parts[3], 10);
          const playerId = parseInt(parts[4], 10);

          if (playerId !== 0 || !id || isNaN(x) || isNaN(y)) return;

          const coord = x + '|' + y;
          barbs[coord] = {
            id: id,
            name: name || 'Barbarendorf',
            coord: coord,
            x: x,
            y: y,
            player_id: playerId,
            imported_at: Date.now(),
          };
        });

        setJson(STORAGE.barbarianMeta, barbs);
        return barbs;
      });
    };

    const getStoredBarbarianMetadata = function () {
      return getJson(STORAGE.barbarianMeta, {});
    };

    const mergeNewBarbariansIntoFarmData = function (data) {
      if (!data || !data.farms || !data.farms.farms) return data;

      const barbs = getStoredBarbarianMetadata();
      Object.keys(barbs).forEach(function (coord) {
        if (!data.farms.farms.hasOwnProperty(coord)) {
          data.farms.farms[coord] = {
            id: barbs[coord].id,
            coord: coord,
            is_imported_barbarian: true,
          };
        }
      });

      return data;
    };

    const buildCatapultCoachOptions = function () {
      const opts = Object.assign({}, DEFAULT_CATAPULT, getJson(STORAGE.catapultCoachOptions, {}));

      return (
        '<div id="farmGodCatapultOptions" class="vis" style="margin:8px auto;width:98%;padding:8px;">' +
        '<h4>FarmGod Katapult-Coach</h4>' +
        '<p style="font-size:11px;line-height:15px;">Der Coach erstellt nur eine manuelle Angriffsliste. Es werden keine Angriffe automatisch gesendet.</p>' +
        '<table class="vis" style="width:100%;font-size:11px;text-align:left;">' +
        '<tr><td>Ausgangsdorf ID</td><td><input type="text" class="fgCatOriginId" value="' + escapeHtml(opts.originId) + '"></td></tr>' +
        '<tr><td>Ausgangsdorf Koordinate</td><td><input type="text" class="fgCatOriginCoord" value="' + escapeHtml(opts.originCoord) + '" placeholder="500|500"></td></tr>' +
        '<tr><td>Max. Entfernung</td><td><input type="text" class="fgCatMaxDistance" value="' + escapeHtml(opts.maxDistance) + '"></td></tr>' +
        '<tr><td>Limit Ziele</td><td><input type="text" class="fgCatLimit" value="' + escapeHtml(opts.limit) + '"></td></tr>' +
        '<tr><td>Zielgebäude</td><td><select class="fgCatBuilding">' +
        '<option value="main"' + (opts.targetBuilding === 'main' ? ' selected' : '') + '>Hauptgebäude</option>' +
        '<option value="barracks"' + (opts.targetBuilding === 'barracks' ? ' selected' : '') + '>Kaserne</option>' +
        '<option value="stable"' + (opts.targetBuilding === 'stable' ? ' selected' : '') + '>Stall</option>' +
        '<option value="garage"' + (opts.targetBuilding === 'garage' ? ' selected' : '') + '>Werkstatt</option>' +
        '<option value="farm"' + (opts.targetBuilding === 'farm' ? ' selected' : '') + '>Bauernhof</option>' +
        '<option value="storage"' + (opts.targetBuilding === 'storage' ? ' selected' : '') + '>Speicher</option>' +
        '<option value="wall"' + (opts.targetBuilding === 'wall' ? ' selected' : '') + '>Wall</option>' +
        '</select></td></tr>' +
        '<tr><td>Einheiten</td><td>' +
        'Speer <input type="text" size="3" class="fgUnit" data-unit="spear" value="' + escapeHtml(opts.unitPreset.spear || 0) + '"> ' +
        'Schwert <input type="text" size="3" class="fgUnit" data-unit="sword" value="' + escapeHtml(opts.unitPreset.sword || 0) + '"> ' +
        'Axt <input type="text" size="3" class="fgUnit" data-unit="axe" value="' + escapeHtml(opts.unitPreset.axe || 0) + '"> ' +
        'Späher <input type="text" size="3" class="fgUnit" data-unit="spy" value="' + escapeHtml(opts.unitPreset.spy || 0) + '"> ' +
        'LKav <input type="text" size="3" class="fgUnit" data-unit="light" value="' + escapeHtml(opts.unitPreset.light || 0) + '"> ' +
        'Ram <input type="text" size="3" class="fgUnit" data-unit="ram" value="' + escapeHtml(opts.unitPreset.ram || 0) + '"> ' +
        'Kata <input type="text" size="3" class="fgUnit" data-unit="catapult" value="' + escapeHtml(opts.unitPreset.catapult || 1) + '">' +
        '</td></tr>' +
        '</table><br>' +
        '<input type="button" class="btn fgImportBarbs" value="Barbaren-Metadaten aktualisieren"> ' +
        '<input type="button" class="btn fgBuildCatPlan" value="Manuellen Katapult-Plan erstellen">' +
        '</div>'
      );
    };

    const readCatapultCoachOptions = function () {
      const unitPreset = {};
      $('.fgUnit').each(function () {
        unitPreset[$(this).data('unit')] = parseInt($(this).val(), 10) || 0;
      });

      const opts = {
        originId: String($('.fgCatOriginId').val() || '').trim(),
        originCoord: String($('.fgCatOriginCoord').val() || '').trim(),
        maxDistance: parseFloat($('.fgCatMaxDistance').val()) || DEFAULT_CATAPULT.maxDistance,
        limit: parseInt($('.fgCatLimit').val(), 10) || DEFAULT_CATAPULT.limit,
        targetBuilding: $('.fgCatBuilding').val() || DEFAULT_CATAPULT.targetBuilding,
        unitPreset: unitPreset,
      };

      setJson(STORAGE.catapultCoachOptions, opts);
      return opts;
    };

    const rallyPointUrl = function (originId, targetId) {
      const base = (window.game_data && game_data.link_base_pure)
        ? game_data.link_base_pure
        : '/game.php?';
      return base + 'place&village=' + encodeURIComponent(originId) + '&target=' + encodeURIComponent(targetId);
    };

    const buildCatapultPlan = function () {
      const opts = readCatapultCoachOptions();
      const barbs = getStoredBarbarianMetadata();

      if (!opts.originId || !opts.originCoord.match(/^\d{1,3}\|\d{1,3}$/)) {
        UI.ErrorMessage('Bitte Ausgangsdorf ID und Koordinate im Format 500|500 angeben.');
        return;
      }

      const rows = Object.keys(barbs)
        .map(function (coord) {
          return Object.assign({}, barbs[coord], {
            distance: distance(opts.originCoord, coord),
          });
        })
        .filter(function (v) {
          return v.distance <= opts.maxDistance;
        })
        .sort(function (a, b) {
          return a.distance - b.distance;
        })
        .slice(0, opts.limit);

      $('#farmGodCatapultPlan').remove();

      let html =
        '<div id="farmGodCatapultPlan" class="vis" style="margin:8px auto;width:98%;padding:8px;">' +
        '<h4>Manueller Katapult-Plan</h4>' +
        '<p style="font-size:11px;line-height:15px;">Keine Auto-Angriffe: Nutze die Links, prüfe jede Eingabe manuell und sende nur bewusst selbst.</p>' +
        '<table class="vis" style="width:100%;font-size:11px;">' +
        '<tr>' +
        '<th>Ziel</th>' +
        '<th>Entfernung</th>' +
        '<th>Einheiten-Vorgabe</th>' +
        '<th>Zielgebäude</th>' +
        '<th>Manuell öffnen</th>' +
        '</tr>';

      if (rows.length === 0) {
        html += '<tr><td colspan="5" style="text-align:center;">Keine Barbaren im angegebenen Umkreis gefunden.</td></tr>';
      }

      rows.forEach(function (v, i) {
        const unitsText = Object.keys(opts.unitPreset)
          .filter(function (unit) { return opts.unitPreset[unit] > 0; })
          .map(function (unit) { return unit + ': ' + opts.unitPreset[unit]; })
          .join(', ');

        html +=
          '<tr class="row_' + (i % 2 === 0 ? 'a' : 'b') + '">' +
          '<td>' + escapeHtml(v.name) + ' (' + escapeHtml(v.coord) + ')</td>' +
          '<td style="text-align:center;">' + v.distance.toFixed(2) + '</td>' +
          '<td>' + escapeHtml(unitsText || 'Keine Einheiten gesetzt') + '</td>' +
          '<td style="text-align:center;">' + escapeHtml(opts.targetBuilding) + '</td>' +
          '<td style="text-align:center;"><a class="btn" href="' + rallyPointUrl(opts.originId, v.id) + '">Sammelplatz öffnen</a></td>' +
          '</tr>';
      });

      html += '</table></div>';
      $('#farmGodCatapultOptions').after(html);
    };

    const renderPanel = function () {
      $('#farmGodSafeExtensionPanel').remove();

      const html =
        '<div id="farmGodSafeExtensionPanel" style="margin:8px auto;width:98%;">' +
        buildCatapultCoachOptions() +
        '</div>';

      const $target = $('#am_widget_Farm').first();
      if ($target.length) {
        $target.before(html);
      } else {
        $('#content_value, #contentContainer, body').first().prepend(html);
      }

      $('.fgImportBarbs')
        .off('click')
        .on('click', function () {
          const $btn = $(this);
          $btn.prop('disabled', true).val('Lade...');
          fetchBarbarianMetadata()
            .then(function (barbs) {
              UI.SuccessMessage(Object.keys(barbs).length + ' Barbarendörfer importiert.');
            })
            .fail(function () {
              UI.ErrorMessage('Barbaren-Metadaten konnten nicht geladen werden.');
            })
            .always(function () {
              $btn.prop('disabled', false).val('Barbaren-Metadaten aktualisieren');
            });
        });

      $('.fgBuildCatPlan')
        .off('click')
        .on('click', buildCatapultPlan);
    };

    const init = function () {
      if (hasSafetyChallenge()) {
        pauseForSafety('Sicherheitsprüfung auf der Seite erkannt');
        return;
      }

      renderPanel();
    };

    return {
      init: init,
      fetchBarbarianMetadata: fetchBarbarianMetadata,
      getStoredBarbarianMetadata: getStoredBarbarianMetadata,
      mergeNewBarbariansIntoFarmData: mergeNewBarbariansIntoFarmData,
      safety: {
        hasSafetyChallenge: hasSafetyChallenge,
        pauseForSafety: pauseForSafety,
        canSendByRateLimit: canSendByRateLimit,
        registerSendSuccess: registerSendSuccess,
        registerSendError: registerSendError,
        getSafeDelay: getSafeDelay,
        isPaused: function () { return safetyPaused; },
      },
    };
  })();

  $(function () {
    if (window.game_data && game_data.screen === 'am_farm') {
      window.FarmGod.SafeExtension.init();
    }
  });
})();
