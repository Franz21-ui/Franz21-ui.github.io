// Hungarian translation provided by =Krumpli=
// Auto-Send modification: automatically sends all planned farms sequentially
// Fixed & Optimized version v2.0
//
// IMPROVEMENTS v2.0:
//  OPT 1: Parallel page fetching  — all pages loaded simultaneously (was sequential)
//  OPT 2: Coord precomputation    — parse "x|y" strings once, not V×F times in planning loop
//  OPT 3: Real break in planning  — for...of + break (forEach return was a continue, not break!)
//  OPT 4: Callback-driven send    — no more 100ms busy-wait polling
//  OPT 5: village.txt TTL cache   — 10min localStorage cache, no re-download every restart
//  OPT 6: mobileCheck hoisted     — computed once, not inside closure called per page
//  OPT 7: Dead code removed       — currentOptions, bindSendCallbacks, stale globals

ScriptAPI.register('FarmGod', true, 'Warre', 'nl.tribalwars@coma.innogames.de');

window.FarmGod = {};
window.FarmGod.Library = (function () {
  /**** TribalWarsLibrary.js ****/
  if (typeof window.twLib === 'undefined') {
    window.twLib = {
      queues: null,
      init: function () {
        if (this.queues === null) {
          this.queues = this.queueLib.createQueues(5);
        }
      },
      queueLib: {
        maxAttempts: 3,
        Item: function (action, arg, promise = null) {
          this.action = action;
          this.arguments = arg;
          this.promise = promise;
          this.attempts = 0;
        },
        Queue: function () {
          this.list = [];
          this.working = false;
          this.length = 0;

          this.doNext = function () {
            let item = this.dequeue();
            let self = this;

            if (item.action == 'openWindow') {
              window
                .open(...item.arguments)
                .addEventListener('DOMContentLoaded', function () {
                  self.start();
                });
            } else {
              $[item.action](...item.arguments)
                .done(function () {
                  item.promise.resolve.apply(null, arguments);
                  self.start();
                })
                .fail(function () {
                  item.attempts += 1;
                  if (item.attempts < twLib.queueLib.maxAttempts) {
                    self.enqueue(item, true);
                  } else {
                    item.promise.reject.apply(null, arguments);
                  }
                  self.start();
                });
            }
          };

          this.start = function () {
            if (this.length) {
              this.working = true;
              this.doNext();
            } else {
              this.working = false;
            }
          };

          this.dequeue = function () {
            this.length -= 1;
            return this.list.shift();
          };

          this.enqueue = function (item, front = false) {
            front ? this.list.unshift(item) : this.list.push(item);
            this.length += 1;
            if (!this.working) {
              this.start();
            }
          };
        },
        createQueues: function (amount) {
          let arr = [];
          for (let i = 0; i < amount; i++) {
            arr[i] = new twLib.queueLib.Queue();
          }
          return arr;
        },
        addItem: function (item) {
          let lengths = twLib.queues.map((q) => q.length);
          let leastBusyQueue = lengths.indexOf(Math.min(...lengths));
          twLib.queues[leastBusyQueue].enqueue(item);
        },
        orchestrator: function (type, arg) {
          let promise = $.Deferred();
          let item = new twLib.queueLib.Item(type, arg, promise);
          twLib.queueLib.addItem(item);
          return promise;
        },
      },
      ajax: function () {
        return twLib.queueLib.orchestrator('ajax', arguments);
      },
      get: function () {
        return twLib.queueLib.orchestrator('get', arguments);
      },
      post: function () {
        return twLib.queueLib.orchestrator('post', arguments);
      },
      openWindow: function () {
        let item = new twLib.queueLib.Item('openWindow', arguments);
        twLib.queueLib.addItem(item);
      },
    };

    twLib.init();
  }

  /**** Script Library ****/
  const setUnitSpeeds = function () {
    let unitSpeeds = {};
    $.get('/interface.php?func=get_unit_info')
      .then((xml) => {
        $(xml)
          .find('config')
          .children()
          .each((i, el) => {
            unitSpeeds[$(el).prop('nodeName')] = $(el).find('speed').text().toNumber();
          });
        localStorage.setItem('FarmGod_unitSpeeds', JSON.stringify(unitSpeeds));
      })
      .fail(() => {
        console.warn('[FarmGod] setUnitSpeeds: Request failed, unit speeds unavailable.');
      });
  };

  const getUnitSpeeds = function () {
    return JSON.parse(localStorage.getItem('FarmGod_unitSpeeds')) || false;
  };

  if (!getUnitSpeeds()) setUnitSpeeds();

  const determineNextPage = function (page, $html) {
    let villageLength =
      $html.find('#scavenge_mass_screen').length > 0
        ? $html.find('tr[id*="scavenge_village"]').length
        : $html.find('tr.row_a, tr.row_ax, tr.row_b, tr.row_bx').length;
    let navSelect = $html
      .find('.paged-nav-item')
      .first()
      .closest('td')
      .find('select')
      .first();
    let navLength =
      $html.find('#am_widget_Farm').length > 0
        ? parseInt(
            $('#plunder_list_nav')
              .first()
              .find('a.paged-nav-item, strong.paged-nav-item')
              .last()
              .text()
              .replace(/\D/g, '')
          ) - 1
        : navSelect.length > 0
          ? navSelect.find('option').length - 1
          : $html.find('.paged-nav-item').not('[href*="page=-1"]').length;
    let pageSize =
      $('#mobileHeader').length > 0
        ? 10
        : parseInt($html.find('input[name="page_size"]').val());

    if (page == -1 && villageLength == 1000) {
      return Math.floor(1000 / pageSize);
    } else if (page < navLength) {
      return page + 1;
    }

    return false;
  };

  const processPage = function (url, page, wrapFn) {
    let pageText = url.match('am_farm') ? `&Farm_page=${page}` : `&page=${page}`;
    return twLib.ajax({ url: url + pageText }).then((html) => {
      return wrapFn(page, $(html));
    });
  };

  // OPT 1: Paralleles Seiten-Laden
  // Erste Seite laden → Gesamtanzahl bestimmen → alle restlichen Seiten gleichzeitig laden.
  // twLib verteilt die Requests automatisch auf 5 Queues.
  //
  // BUGFIX: jQuery Deferred ≠ native Promise — in jQuery < 3.x ignoriert Promise.all
  // den Rückgabewert eines Deferreds im .then()-Callback und löst sofort auf.
  // Lösung: jqToPromise() konvertiert jeden twLib.ajax()-Aufruf zu einem nativen Promise,
  // damit Promise.all() korrekt auf alle Seiten wartet.
  const jqToPromise = (deferred) => new Promise((res, rej) => deferred.then(res, rej));

  const processAllPages = function (url, processorFn) {
    const startPage = url.match('am_farm') || url.match('scavenge_mass') ? 0 : -1;
    const pageKey   = url.match('am_farm') ? 'Farm_page' : 'page';

    return jqToPromise(twLib.ajax({ url: `${url}&${pageKey}=${startPage}` })).then((html) => {
      const $html = $(html);
      processorFn($html);

      // Gesamtanzahl Seiten aus der ersten Antwort lesen
      let total = 0;
      if ($html.find('#am_widget_Farm').length) {
        total = parseInt(
          $('#plunder_list_nav')
            .first()
            .find('a.paged-nav-item, strong.paged-nav-item')
            .last()
            .text()
            .replace(/\D/g, '')
        ) - 1;
      } else {
        const $nav = $html
          .find('.paged-nav-item')
          .first()
          .closest('td')
          .find('select')
          .first();
        total = $nav.length
          ? $nav.find('option').length - 1
          : $html.find('.paged-nav-item').not('[href*="page=-1"]').length;
      }

      if (total <= startPage) return;

      // Alle restlichen Seiten parallel laden — jeder Aufruf ist ein nativer Promise
      const remaining = [];
      for (let p = startPage + 1; p <= total; p++) remaining.push(p);

      return Promise.all(
        remaining.map((p) =>
          jqToPromise(twLib.ajax({ url: `${url}&${pageKey}=${p}` }))
            .then((h) => processorFn($(h)))
        )
      );
    });
  };

  const getDistance = function (origin, target) {
    let a = origin.toCoord(true);
    let b = target.toCoord(true);
    return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y));
  };

  const subtractArrays = function (array1, array2) {
    let result = array1.map((val, i) => val - array2[i]);
    return result.some((v) => v < 0) ? false : result;
  };

  const getCurrentServerTime = function () {
    let match = $('#serverTime').closest('p').text().match(/\d+/g);
    if (!match || match.length < 6) return Date.now();
    let [hour, min, sec, day, month, year] = match;
    return new Date(year, month - 1, day, hour, min, sec).getTime();
  };

  const timestampFromString = function (timestr) {
    let d = $('#serverDate')
      .text()
      .split('/')
      .map((x) => +x);
    let todayPattern = new RegExp(
      window.lang['aea2b0aa9ae1534226518faaefffdaad'].replace('%s', '([\\d+|:]+)')
    ).exec(timestr);
    let tomorrowPattern = new RegExp(
      window.lang['57d28d1b211fddbb7a499ead5bf23079'].replace('%s', '([\\d+|:]+)')
    ).exec(timestr);
    let laterDatePattern = new RegExp(
      window.lang['0cb274c906d622fa8ce524bcfbb7552d']
        .replace('%1', '([\\d+|\\.]+)')
        .replace('%2', '([\\d+|:]+)')
    ).exec(timestr);
    let t, date;

    if (todayPattern !== null) {
      t = todayPattern[1].split(':');
      date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
    } else if (tomorrowPattern !== null) {
      t = tomorrowPattern[1].split(':');
      date = new Date(d[2], d[1] - 1, d[0] + 1, t[0], t[1], t[2], t[3] || 0);
    } else if (laterDatePattern !== null) {
      d = (laterDatePattern[1] + d[2]).split('.').map((x) => +x);
      t = laterDatePattern[2].split(':');
      date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
    } else {
      console.warn('[FarmGod] timestampFromString: Unbekanntes Zeitformat:', timestr);
      return Date.now();
    }

    return date.getTime();
  };

  String.prototype.toCoord = function (objectified) {
    let c = (this.match(/\d{1,3}\|\d{1,3}/g) || [false]).pop();
    if (!c) return objectified ? { x: 0, y: 0 } : c;
    let parts = c.split('|');
    return objectified ? { x: +parts[0], y: +parts[1] } : c;
  };

  String.prototype.toNumber = function () {
    return parseFloat(this);
  };

  Number.prototype.toNumber = function () {
    return parseFloat(this);
  };

  return {
    getUnitSpeeds,
    processPage,
    processAllPages,
    getDistance,
    subtractArrays,
    getCurrentServerTime,
    timestampFromString,
  };
})();

window.FarmGod.Translation = (function () {
  const msg = {
    nl_NL: {
      missingFeatures: 'Script vereist een premium account en farm assistent!',
      options: {
        title: 'FarmGod Opties',
        warning:
          '<b>Waarschuwingen:</b><br>- Zorg dat A is ingesteld als je standaard microfarm en B als een grotere microfarm<br>- Zorg dat de farm filters correct zijn ingesteld voor je het script gebruikt',
        filterImage: 'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters.png',
        group: 'Uit welke groep moet er gefarmd worden:',
        distance: 'Maximaal aantal velden dat farms mogen lopen:',
        time: 'Hoe veel tijd in minuten moet er tussen farms zitten:',
        losses: 'Verstuur farm naar dorpen met gedeeltelijke verliezen:',
        maxloot: 'Verstuur een B farm als de buit vorige keer vol was:',
        newbarbs: 'Voeg nieuwe barbarendorpen toe om te farmen:',
        button: 'Plan farms',
      },
      table: {
        noFarmsPlanned: 'Er kunnen met de opgegeven instellingen geen farms verstuurd worden.',
        origin: 'Oorsprong',
        target: 'Doel',
        fields: 'Velden',
        farm: 'Farm',
        goTo: 'Ga naar',
      },
      messages: {
        villageChanged: 'Succesvol van dorp veranderd!',
        villageError: 'Alle farms voor het huidige dorp zijn reeds verstuurd!',
        sendError: 'Error: farm niet verstuurd!',
      },
    },

    int: {
      missingFeatures: 'Script requires a premium account and loot assistent!',
      options: {
        title: 'FarmGod Options',
        warning:
          '<b>Warning:</b><br>- Make sure A is set as your default microfarm and B as a larger microfarm<br>- Make sure the farm filters are set correctly before using the script',
        filterImage: 'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters.png',
        group: 'Send farms from group:',
        distance: 'Maximum fields for farms:',
        time: 'How much time in minutes should there be between farms:',
        losses: 'Send farm to villages with partial losses:',
        maxloot: 'Send a B farm if the last loot was full:',
        newbarbs: 'Add new barbs to farm:',
        button: 'Plan farms',
      },
      table: {
        noFarmsPlanned: 'No farms can be sent with the specified settings.',
        origin: 'Origin',
        target: 'Target',
        fields: 'fields',
        farm: 'Farm',
        goTo: 'Go to',
      },
      messages: {
        villageChanged: 'Successfully changed village!',
        villageError: 'All farms for the current village have been sent!',
        sendError: 'Error: farm not sent!',
      },
    },
  };

  const get = function () {
    let lang = msg.hasOwnProperty(game_data.locale) ? game_data.locale : 'int';
    return msg[lang];
  };

  return { get };
})();

window.FarmGod.Main = (function (Library, Translation) {
  const lib = Library;
  const t = Translation.get();
  let curVillage = null;
  let farmBusy = false;

  // ── STATE ──────────────────────────────────────────────────────────────────
  let autoPaused = false;
  let autoRestartTimer = null;
  let countdownTimer = null;
  let sessionStats = { sent: 0, errors: 0, runs: 0, villages: {} };
  // ── END STATE ──────────────────────────────────────────────────────────────

  // ── AUTO-SEND ──────────────────────────────────────────────────────────────
  // OPT 4: Callback-getrieben statt 100ms Busy-Wait-Polling.
  // sendNext wird als '_done'-Callback an sendFarm übergeben und direkt nach
  // Abschluss aufgerufen — kein setTimeout(sendNext, 100) mehr nötig.
  const autoSend = function (onComplete) {
    $('#farmGodControls').remove();
    $('#am_widget_Farm').first().before(
      '<div id="farmGodControls" style="margin:5px 0;text-align:center;">' +
      '<input type="button" id="farmGodPauseBtn" class="btn" value="Pause" ' +
      'style="background:#c44;color:#fff;font-weight:bold;padding:4px 16px;">' +
      '</div>'
    );

    const getDelay = () => Math.floor(Math.random() * 400) + 300; // 300–700ms

    const sendNext = function () {
      if (autoPaused) return;

      const $next = $('.farmGod_icon').first();
      if (!$next.length) {
        onComplete && onComplete();
        return;
      }

      // sendNext als done-Callback mitgeben — sendFarm ruft ihn nach Abschluss auf
      $next.data('_done', () => setTimeout(sendNext, getDelay()));
      $next.trigger('click');
    };

    $('#farmGodPauseBtn').on('click', function () {
      autoPaused = !autoPaused;
      $(this).val(autoPaused ? 'Weiter' : 'Pause');
      $(this).css('background', autoPaused ? '#888' : '#c44');
      if (!autoPaused) sendNext();
    });

    setTimeout(sendNext, 500);
  };
  // ── END AUTO-SEND ──────────────────────────────────────────────────────────

  // ── STATS ──────────────────────────────────────────────────────────────────
  const showStats = function (sent, errors, restartInSec) {
    sessionStats.runs++;
    let topVillages = Object.entries(sessionStats.villages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => name + ': ' + count)
      .join(' | ');

    let statsHtml =
      '<div id="farmGodStats" style="margin:8px auto;width:98%;background:#f4eed4;border:1px solid #7D510F;padding:6px;font-size:11px;text-align:center;">' +
      '<b>Durchlauf ' + sessionStats.runs + ' abgeschlossen</b><br>' +
      'Gesendet: <b>' + sent + '</b> &nbsp;|&nbsp; Fehler: <b>' + errors + '</b> &nbsp;|&nbsp; Gesamt Session: <b>' + sessionStats.sent + '</b><br>' +
      (topVillages ? 'Top Doerfer: ' + topVillages + '<br>' : '') +
      '<span id="farmGodCountdown" style="color:#7D510F;font-weight:bold;">Neustart in ' + restartInSec + 's</span>' +
      '</div>';

    $('.farmGodStats').remove();
    $(statsHtml).addClass('farmGodStats').insertBefore('.farmGodContent');

    clearInterval(countdownTimer);
    let restartEnd = Date.now() + restartInSec * 1000;
    countdownTimer = setInterval(function () {
      let remaining = Math.round((restartEnd - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        $('#farmGodCountdown').text('Neustart...');
      } else {
        $('#farmGodCountdown').text('Neustart in ' + remaining + 's');
      }
    }, 1000);
  };
  // ── END STATS ──────────────────────────────────────────────────────────────

  // ── AUTO-RESTART ───────────────────────────────────────────────────────────
  const scheduleRestart = function (minMin, minMax, runOptions) {
    let delayMin =
      Math.floor(Math.random() * (minMax - minMin + 1) + minMin) * 60 * 1000;
    autoRestartTimer = setTimeout(function () {
      $('.farmGodStats').remove();
      $('.farmGodContent').remove();
      runFarmCycle(runOptions);
    }, delayMin);
  };
  // ── END AUTO-RESTART ───────────────────────────────────────────────────────

  // ── FARM CYCLE ─────────────────────────────────────────────────────────────
  const runFarmCycle = function (opts) {
    getData(opts.group, opts.newbarbs, opts.losses).then((data) => {
      let plan = createPlanning(opts.distance, opts.time, opts.maxloot, data);
      $('.farmGodContent').remove();
      $('#am_widget_Farm').first().before(buildTable(plan.farms));

      bindEventHandlers();
      UI.InitProgressBars();
      UI.updateProgressBar($('#FarmGodProgessbar'), 0, plan.counter);
      $('#FarmGodProgessbar').data('current', 0).data('max', plan.counter);

      // OPT 7: Lokale Zähler per Closure — keine globalen window._farmGodOn* mehr
      let runSent = 0;
      let runErrors = 0;

      _onFarmSuccess = function (villageName) {
        runSent++;
        sessionStats.sent++;
        if (villageName) {
          sessionStats.villages[villageName] =
            (sessionStats.villages[villageName] || 0) + 1;
        }
      };

      _onFarmError = function () {
        runErrors++;
        sessionStats.errors++;
      };

      autoSend(function () {
        let restartSec = Math.floor(
          Math.random() * (opts.restartMax - opts.restartMin + 1) + opts.restartMin
        ) * 60;

        showStats(runSent, runErrors, restartSec);

        if (opts.restartMin > 0) {
          scheduleRestart(opts.restartMin, opts.restartMax, opts);
        }
      });
    });
  };
  // ── END FARM CYCLE ─────────────────────────────────────────────────────────

  const init = function () {
    if (
      game_data.features.Premium.active &&
      game_data.features.FarmAssistent.active
    ) {
      if (game_data.screen == 'am_farm') {
        $.when(buildOptions()).then((html) => {
          Dialog.show('FarmGod', html);

          $('.optionButton')
            .off('click')
            .on('click', () => {
              clearTimeout(autoRestartTimer);
              clearInterval(countdownTimer);
              autoPaused = false;
              sessionStats = { sent: 0, errors: 0, runs: 0, villages: {} };

              let opts = {
                group:      parseInt($('.optionGroup').val()),
                distance:   parseFloat($('.optionDistance').val()),
                time:       parseFloat($('.optionTime').val()),
                losses:     $('.optionLosses').prop('checked'),
                maxloot:    $('.optionMaxloot').prop('checked'),
                newbarbs:   $('.optionNewbarbs').prop('checked') || false,
                restartMin: parseFloat($('.optionRestartMin').val()) || 0,
                restartMax: parseFloat($('.optionRestartMax').val()) || 0,
              };

              if (opts.restartMax < opts.restartMin) opts.restartMax = opts.restartMin;

              localStorage.setItem('farmGod_options', JSON.stringify(opts));

              $('.optionsContent').html(UI.Throbber[0].outerHTML + '<br><br>');
              Dialog.close();

              runFarmCycle(opts);
            });

          document.querySelector('.optionButton').focus();
        });
      } else {
        location.href = game_data.link_base_pure + 'am_farm';
      }
    } else {
      UI.ErrorMessage(t.missingFeatures);
    }
  };

  // Send-Callbacks (werden in runFarmCycle pro Zyklus neu gesetzt)
  let _onFarmSuccess = null;
  let _onFarmError   = null;

  const bindEventHandlers = function () {
    $('.farmGod_icon')
      .off('click')
      .on('click', function () {
        if (game_data.market != 'nl' || $(this).data('origin') == curVillage) {
          sendFarm($(this));
        } else {
          UI.ErrorMessage(t.messages.villageError);
        }
      });

    $(document)
      .off('keydown.farmGod')
      .on('keydown.farmGod', (event) => {
        if ((event.keyCode || event.which) == 13) {
          $('.farmGod_icon').first().trigger('click');
        }
      });

    $('.switchVillage')
      .off('click')
      .on('click', function () {
        curVillage = $(this).data('id');
        UI.SuccessMessage(t.messages.villageChanged);
        $(this).closest('tr').remove();
      });
  };

  const buildOptions = function () {
    let options = JSON.parse(localStorage.getItem('farmGod_options')) || {
      group: 0,
      distance: 25,
      time: 10,
      losses: false,
      maxloot: true,
      newbarbs: true,
      restartMin: 30,
      restartMax: 45,
    };
    // Backwards compat with old key names
    if (options.optionGroup !== undefined) {
      options.group    = options.optionGroup;
      options.distance = options.optionDistance;
      options.time     = options.optionTime;
      options.losses   = options.optionLosses;
      options.maxloot  = options.optionMaxloot;
      options.newbarbs = options.optionNewbarbs;
    }

    let checkboxSettings = [false, true, true, true, false];
    let checkboxError = $('#plunder_list_filters')
      .find('input[type="checkbox"]')
      .map((i, el) => $(el).prop('checked') != checkboxSettings[i])
      .get()
      .includes(true);

    let $templateRows = $('form[action*="action=edit_all"]')
      .find('input[type="hidden"][name*="template"]')
      .closest('tr');
    let templateError =
      $templateRows.first().find('td').last().text().toNumber() >=
      $templateRows.last().find('td').last().text().toNumber();

    return $.when(buildGroupSelect(options.group)).then((groupSelect) => {
      return `<style>#popup_box_FarmGod{text-align:center;width:550px;}</style>
              <h3>${t.options.title}</h3><br><div class="optionsContent">
              ${checkboxError || templateError
                ? `<div class="info_box" style="line-height:15px;font-size:10px;text-align:left;"><p style="margin:0px 5px;">${t.options.warning}<br><img src="${t.options.filterImage}" style="width:100%;"></p></div><br>`
                : ''
              }
              <div style="width:90%;margin:auto;background:url('graphic/index/main_bg.jpg') 100% 0% #E3D5B3;border:1px solid #7D510F;border-collapse:separate !important;border-spacing:0px !important;">
                <table class="vis" style="width:100%;text-align:left;font-size:11px;">
                  <tr><td>${t.options.group}</td><td>${groupSelect}</td></tr>
                  <tr><td>${t.options.distance}</td><td><input type="text" size="5" class="optionDistance" value="${options.distance}"></td></tr>
                  <tr><td>${t.options.time}</td><td><input type="text" size="5" class="optionTime" value="${options.time}"></td></tr>
                  <tr><td>${t.options.losses}</td><td><input type="checkbox" class="optionLosses" ${options.losses ? 'checked' : ''}></td></tr>
                  <tr><td>${t.options.maxloot}</td><td><input type="checkbox" class="optionMaxloot" ${options.maxloot ? 'checked' : ''}></td></tr>
                  <tr><td>Neustart nach (Min): Von</td><td>
                    <input type="text" size="4" class="optionRestartMin" value="${options.restartMin || 30}">
                    &nbsp;Bis&nbsp;
                    <input type="text" size="4" class="optionRestartMax" value="${options.restartMax || 45}">
                    &nbsp;<small>(0 = kein Neustart)</small>
                  </td></tr>
                  ${game_data.market == 'nl'
                    ? `<tr><td>${t.options.newbarbs}</td><td><input type="checkbox" class="optionNewbarbs" ${options.newbarbs ? 'checked' : ''}></td></tr>`
                    : ''
                  }
                </table>
              </div><br>
              <input type="button" class="btn optionButton" value="${t.options.button}"></div>`;
    });
  };

  const buildGroupSelect = function (id) {
    return $.get(
      TribalWars.buildURL('GET', 'groups', { ajax: 'load_group_menu' })
    ).then((groups) => {
      let html = `<select class="optionGroup">`;
      groups.result.forEach((val) => {
        if (val.type == 'separator') {
          html += `<option disabled=""/>`;
        } else {
          html += `<option value="${val.group_id}" ${val.group_id == id ? 'selected' : ''}>${val.name}</option>`;
        }
      });
      html += `</select>`;
      return html;
    });
  };

  const buildTable = function (plan) {
    let html =
      `<div class="vis farmGodContent"><h4>FarmGod</h4><table class="vis" width="100%">` +
      `<tr><td colspan="4">` +
      `<div id="FarmGodProgessbar" class="progress-bar live-progress-bar progress-bar-alive" style="width:98%;margin:5px auto;">` +
      `<div style="background:rgb(146,194,0);"></div><span class="label" style="margin-top:0px;"></span>` +
      `</div></td></tr>` +
      `<tr>` +
      `<th style="text-align:center;">${t.table.origin}</th>` +
      `<th style="text-align:center;">${t.table.target}</th>` +
      `<th style="text-align:center;">${t.table.fields}</th>` +
      `<th style="text-align:center;">${t.table.farm}</th>` +
      `</tr>`;

    if (!$.isEmptyObject(plan)) {
      Object.keys(plan).forEach((prop, idx) => {
        if (game_data.market == 'nl') {
          html +=
            `<tr><td colspan="4" style="background:#e7d098;">` +
            `<input type="button" class="btn switchVillage" data-id="${plan[prop][0].origin.id}" ` +
            `value="${t.table.goTo} ${plan[prop][0].origin.name} (${plan[prop][0].origin.coord})" ` +
            `style="float:right;"></td></tr>`;
        }

        plan[prop].forEach((val, i) => {
          html +=
            `<tr class="farmRow row_${i % 2 === 0 ? 'a' : 'b'}">` +
            `<td style="text-align:center;"><a href="${game_data.link_base_pure}info_village&id=${val.origin.id}">${val.origin.name} (${val.origin.coord})</a></td>` +
            `<td style="text-align:center;"><a href="${game_data.link_base_pure}info_village&id=${val.target.id}">${val.target.coord}</a></td>` +
            `<td style="text-align:center;">${val.fields.toFixed(2)}</td>` +
            `<td style="text-align:center;"><a href="#" data-origin="${val.origin.id}" data-target="${val.target.id}" data-template="${val.template.id}" class="farmGod_icon farm_icon farm_icon_${val.template.name}" style="margin:auto;"></a></td>` +
            `</tr>`;
        });
      });
    } else {
      html += `<tr><td colspan="4" style="text-align:center;">${t.table.noFarmsPlanned}</td></tr>`;
    }

    html += `</table></div>`;
    return html;
  };

  const getData = function (group, newbarbs, losses) {
    let data = {
      villages: {},
      commands: {},
      farms: { templates: {}, farms: {} },
    };

    // OPT 6: mobileCheck einmal berechnen, nicht in jeder Closure-Iteration
    const mobileCheck = $('#mobileHeader').length > 0;

    let villagesProcessor = ($html) => {
      let skipUnits = ['ram', 'catapult', 'knight', 'snob', 'militia'];

      if (mobileCheck) {
        $html.find('.overview-container > div').each((i, el) => {
          try {
            const $el = $(el);
            const villageId = $el.find('.quickedit-vn').data('id');
            const name = $el.find('.quickedit-label').attr('data-text');
            const coord = $el.find('.quickedit-label').text().toCoord();

            const units = new Array(game_data.units.length).fill(0);
            $el.find('.overview-units-row > div.unit-row-item').each((_, unitElement) => {
              const $u = $(unitElement);
              const img = $u.find('img');
              const span = $u.find('span.unit-row-name');
              if (img.length && span.length) {
                let unitType = img
                  .attr('src')
                  .split('unit_')[1]
                  .replace('@2x.webp', '')
                  .replace('.webp', '')
                  .replace('.png', '');
                const value = parseInt(span.text()) || 0;
                const unitIndex = game_data.units.indexOf(unitType);
                if (unitIndex !== -1) units[unitIndex] = value;
              }
            });

            const filteredUnits = units.filter(
              (_, index) => skipUnits.indexOf(game_data.units[index]) === -1
            );

            data.villages[coord] = { name, id: villageId, units: filteredUnits };
          } catch (e) {
            console.error('[FarmGod] Error processing mobile village data:', e);
          }
        });
      } else {
        $html
          .find('#combined_table')
          .find('.row_a, .row_b')
          .filter((i, el) => $(el).find('.bonus_icon_33').length === 0)
          .each((i, el) => {
            let $el = $(el);
            let $qel = $el.find('.quickedit-label').first();
            let units = $el
              .find('.unit-item')
              .filter((index) => skipUnits.indexOf(game_data.units[index]) === -1)
              .map((index, element) => $(element).text().toNumber())
              .get();

            data.villages[$qel.text().toCoord()] = {
              name: $qel.data('text'),
              id: parseInt($el.find('.quickedit-vn').first().data('id')),
              units: units,
            };
          });
      }

      return data;
    };

    let commandsProcessor = ($html) => {
      $html
        .find('#commands_table')
        .find('.row_a, .row_ax, .row_b, .row_bx')
        .each((i, el) => {
          let $el = $(el);
          let coord = $el.find('.quickedit-label').first().text().toCoord();
          if (coord) {
            if (!data.commands.hasOwnProperty(coord)) data.commands[coord] = [];
            data.commands[coord].push(
              Math.round(lib.timestampFromString($el.find('td').eq(2).text().trim()) / 1000)
            );
          }
        });
      return data;
    };

    let farmProcessor = ($html) => {
      if ($.isEmptyObject(data.farms.templates)) {
        let unitSpeeds = lib.getUnitSpeeds();

        $html
          .find('form[action*="action=edit_all"]')
          .find('input[type="hidden"][name*="template"]')
          .closest('tr')
          .each((i, el) => {
            let $el = $(el);
            let templateName = $el
              .prev('tr')
              .find('a.farm_icon')
              .first()
              .attr('class')
              .match(/farm_icon_(.*)\s/)[1];

            let templateUnits = $el
              .find('input[type="text"], input[type="number"]')
              .map((index, element) => $(element).val().toNumber())
              .get();

            let templateSpeed = Math.max(
              ...$el
                .find('input[type="text"], input[type="number"]')
                .map((index, element) => {
                  let val = $(element).val().toNumber();
                  if (val <= 0) return 0;
                  let key = $(element).attr('name').trim().split('[')[0];
                  return unitSpeeds[key] || 0;
                })
                .get()
            );

            data.farms.templates[templateName] = {
              id: $el
                .find('input[type="hidden"][name*="template"][name*="[id]"]')
                .first()
                .val()
                .toNumber(),
              units: templateUnits,
              speed: isNaN(templateSpeed) ? 0 : templateSpeed,
            };
          });
      }

      $html
        .find('#plunder_list')
        .find('tr[id^="village_"]')
        .each((i, el) => {
          let $el = $(el);
          let coord = $el
            .find('a[href*="screen=report&mode=all&view="]')
            .first()
            .text()
            .toCoord();

          if (!coord) return;

          let colorMatch = $el
            .find('img[src*="graphic/dots/"]')
            .attr('src')
            .match(/dots\/(green|yellow|red|blue|red_blue)/);

          data.farms.farms[coord] = {
            id: $el.attr('id').split('_')[1].toNumber(),
            color: colorMatch ? colorMatch[1] : null,
            max_loot: $el.find('img[src*="max_loot/1"]').length > 0,
          };
        });

      return data;
    };

    // OPT 5: village.txt mit 10min TTL-Cache — kein Re-Download bei jedem Neustart
    let findNewbarbs = () => {
      if (!newbarbs) return Promise.resolve(data);

      const CACHE_KEY = 'farmGod_vmap_' + game_data.world;
      const CACHE_TS  = 'farmGod_vmap_ts_' + game_data.world;
      const TTL_MS    = 10 * 60 * 1000;

      const cached   = localStorage.getItem(CACHE_KEY);
      const cachedTs = parseInt(localStorage.getItem(CACHE_TS) || '0');

      const parseTxt = (txt) => {
        (txt.match(/[^\r\n]+/g) || []).forEach((line) => {
          const parts = line.split(',');
          if (parts.length < 5) return;
          const coord = `${parts[2]}|${parts[3]}`;
          if (parseInt(parts[4]) === 0 && !data.farms.farms.hasOwnProperty(coord)) {
            data.farms.farms[coord] = { id: +parts[0] };
          }
        });
        return data;
      };

      if (cached && Date.now() - cachedTs < TTL_MS) {
        return Promise.resolve(parseTxt(cached));
      }

      return twLib.get('/map/village.txt').then((txt) => {
        try {
          localStorage.setItem(CACHE_KEY, txt);
          localStorage.setItem(CACHE_TS, String(Date.now()));
        } catch (e) {
          console.warn('[FarmGod] village.txt Cache konnte nicht gespeichert werden:', e.message);
        }
        return parseTxt(txt);
      });
    };

    let filterFarms = () => {
      data.farms.farms = Object.fromEntries(
        Object.entries(data.farms.farms).filter(([key, val]) => {
          return (
            !val.hasOwnProperty('color') ||
            (val.color !== 'red' &&
              val.color !== 'red_blue' &&
              (val.color !== 'yellow' || losses))
          );
        })
      );
      return data;
    };

    return Promise.all([
      lib.processAllPages(
        TribalWars.buildURL('GET', 'overview_villages', { mode: 'combined', group: group }),
        villagesProcessor
      ),
      lib.processAllPages(
        TribalWars.buildURL('GET', 'overview_villages', { mode: 'commands', type: 'attack' }),
        commandsProcessor
      ),
      lib.processAllPages(TribalWars.buildURL('GET', 'am_farm'), farmProcessor),
      findNewbarbs(),
    ])
      .then(filterFarms)
      .then(() => data);
  };

  // OPT 2 + 3: Koordinaten einmal vorausberechnen (kein V×F Regex-Parsing mehr).
  // OPT 3: for...of + break statt forEach (forEach return = continue, kein break!).
  //         Da orderedFarms nach Distanz sortiert ist, kann die Schleife beim ersten
  //         überschrittenen Wert sofort abgebrochen werden.
  const createPlanning = function (optionDistance, optionTime, optionMaxloot, data) {
    let plan = { counter: 0, farms: {} };
    let serverTime = Math.round(lib.getCurrentServerTime() / 1000);

    // Alle Farm-Koordinaten einmal parsen und als {coord, x, y, farm} speichern
    const farmList = Object.entries(data.farms.farms).map(([coord, farm]) => {
      const [x, y] = coord.split('|').map(Number);
      return { coord, x, y, farm };
    });

    for (let prop in data.villages) {
      const [vx, vy] = prop.split('|').map(Number);

      // Distanzen ohne toCoord-Aufruf berechnen (x/y bereits gecacht)
      const orderedFarms = farmList
        .map((f) => ({ ...f, dis: Math.hypot(vx - f.x, vy - f.y) }))
        .sort((a, b) => a.dis - b.dis);

      for (const el of orderedFarms) {
        // Echter break — alle weiteren Farms sind noch weiter entfernt (sortiert)
        if (el.dis > optionDistance) break;

        let farmIndex = el.farm;
        let template_name =
          optionMaxloot && farmIndex.hasOwnProperty('max_loot') && farmIndex.max_loot
            ? 'b'
            : 'a';
        let template = data.farms.templates[template_name];
        if (!template) continue;

        let unitsLeft = lib.subtractArrays(data.villages[prop].units, template.units);
        if (!unitsLeft) continue;

        // el.dis bereits berechnet — kein zweiter getDistance-Aufruf nötig
        let arrival = Math.round(
          serverTime + el.dis * template.speed * 60 + Math.round(plan.counter / 5)
        );
        let maxTimeDiff = Math.round(optionTime * 60);
        let timeDiff = true;

        if (data.commands.hasOwnProperty(el.coord)) {
          if (!farmIndex.hasOwnProperty('color') && data.commands[el.coord].length > 0) {
            timeDiff = false;
          }
          data.commands[el.coord].forEach((timestamp) => {
            if (Math.abs(timestamp - arrival) < maxTimeDiff) timeDiff = false;
          });
        } else {
          data.commands[el.coord] = [];
        }

        if (timeDiff) {
          plan.counter++;
          if (!plan.farms.hasOwnProperty(prop)) plan.farms[prop] = [];

          plan.farms[prop].push({
            origin: {
              coord: prop,
              name: data.villages[prop].name,
              id: data.villages[prop].id,
            },
            target: { coord: el.coord, id: farmIndex.id },
            fields: el.dis,
            template: { name: template_name, id: template.id },
          });

          data.villages[prop].units = unitsLeft;
          data.commands[el.coord].push(arrival);
        }
      }
    }

    return plan;
  };

  const sendFarm = function ($this) {
    let n = Timing.getElapsedTimeSinceLoad();
    if (
      !farmBusy &&
      !(Accountmanager.farm.last_click && n - Accountmanager.farm.last_click < 200)
    ) {
      farmBusy = true;
      Accountmanager.farm.last_click = n;

      let $pb = $('#FarmGodProgessbar');

      TribalWars.post(
        Accountmanager.send_units_link.replace(
          /village=(\d+)/,
          'village=' + $this.data('origin')
        ),
        null,
        {
          target:      $this.data('target'),
          template_id: $this.data('template'),
          source:      $this.data('origin'),
        },
        function (r) {
          UI.SuccessMessage(r.success);
          $pb.data('current', $pb.data('current') + 1);
          UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max'));

          let villageName = $this.closest('.farmRow').find('td').first().text().trim();
          _onFarmSuccess && _onFarmSuccess(villageName);

          $this.closest('.farmRow').remove();
          farmBusy = false;

          // OPT 4: done-Callback aufrufen statt auf Polling zu warten
          const done = $this.data('_done');
          done && done();
        },
        function (r) {
          UI.ErrorMessage(r || t.messages.sendError);
          $pb.data('current', $pb.data('current') + 1);
          UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max'));

          _onFarmError && _onFarmError();

          $this.closest('.farmRow').remove();
          farmBusy = false;

          // OPT 4: done-Callback auch im Fehlerfall aufrufen
          const done = $this.data('_done');
          done && done();
        }
      );
    }
  };

  return { init };
})(window.FarmGod.Library, window.FarmGod.Translation);

(() => {
  window.FarmGod.Main.init();
})();
