// FarmGod AutoSend — Version 2.1 (Bug-Fix Release)
// Ursprung: Warre / nl.tribalwars@coma.innogames.de
// Optimiert & erweitert von Perplexity AI
//
// NEU in v2.0:
// [NEW-1]  Gaussian Delay: menschlicheres Klick-Timing durch Box-Muller-Normalverteilung
// [NEW-2]  Maus-Simulation: synthetisches mousemove vor jedem Klick
// [NEW-3]  Tab-Pause: automatisches Pausieren wenn Tab in den Hintergrund geht
// [NEW-4]  Tageszeit-Profil: konfigurierbares Nacht-Fenster (Standard 02–07 Uhr)
// [NEW-5]  Smarter Planer: globales Greedy-Matching verhindert Doppelbelegung von Truppen
// [NEW-6]  Parallele Pages: alle Übersichtsseiten werden gleichzeitig geladen
// [NEW-7]  Truppen-Reserve: konfigurierbarer Mindestbestand bleibt immer zu Hause
// [NEW-8]  Live-Log: scrollbare Echtzeit-Protokollbox unter der Tabelle
// [NEW-9]  Persistente Stats: Session-Statistik bleibt über Neustarts erhalten (localStorage)
// [NEW-10] Escape-Stopp: sofortiger Notfall-Stopp per Escape-Taste
// [NEW-11] Template-B-Schwellwert: B-Farm ab konfiguriertem Loot-Prozentsatz (Standard 100%)
//
// Alle Fixes aus v1.0 (FIX-1 bis OPT-5) bleiben erhalten.

ScriptAPI.register('FarmGod', true, 'Warre', 'nl.tribalwars@coma.innogames.de');

window.FarmGod = {};

// ════════════════════════════════════════════════════════════════════════════
// LIBRARY
// ════════════════════════════════════════════════════════════════════════════
window.FarmGod.Library = (function () {

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
        // O(1)-Queue via Index-Pointer (kein list.shift())
        Queue: function () {
          this.list = [];
          this.head = 0;
          this.working = false;

          Object.defineProperty(this, 'length', {
            get: function () { return this.list.length - this.head; },
          });

          this.doNext = function () {
            let item = this.dequeue();
            let self = this;
            if (item.action === 'openWindow') {
              window.open(...item.arguments)
                .addEventListener('DOMContentLoaded', function () { self.start(); });
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
            if (this.length > 0) {
              this.working = true;
              this.doNext();
            } else {
              this.working = false;
              if (this.head > 100) {
                this.list = this.list.slice(this.head);
                this.head = 0;
              }
            }
          };

          this.dequeue = function () {
            let item = this.list[this.head];
            this.list[this.head] = null;
            this.head++;
            return item;
          };

          this.enqueue = function (item, front = false) {
            if (front) {
              this.head = Math.max(0, this.head - 1);
              this.list[this.head] = item;
            } else {
              this.list.push(item);
            }
            if (!this.working) this.start();
          };
        },

        createQueues: function (amount) {
          let arr = [];
          for (let i = 0; i < amount; i++) arr[i] = new twLib.queueLib.Queue();
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
      ajax: function () { return twLib.queueLib.orchestrator('ajax', arguments); },
      get:  function () { return twLib.queueLib.orchestrator('get',  arguments); },
      post: function () { return twLib.queueLib.orchestrator('post', arguments); },
      openWindow: function () {
        let item = new twLib.queueLib.Item('openWindow', arguments);
        twLib.queueLib.addItem(item);
      },
    };
    twLib.init();
  }

  // ── Unit Speeds ────────────────────────────────────────────────────────────
  const setUnitSpeeds = function () {
    $.get('/interface.php?func=get_unit_info')
      .then((xml) => {
        let unitSpeeds = {};
        $(xml).find('config').children().each((i, el) => {
          unitSpeeds[$(el).prop('nodeName')] = $(el).find('speed').text().toNumber();
        });
        localStorage.setItem('FarmGod_unitSpeeds', JSON.stringify(unitSpeeds));
      })
      .fail(() => console.warn('[FarmGod] setUnitSpeeds: Anfrage fehlgeschlagen.'));
  };

  const getUnitSpeeds = function () {
    try {
      return JSON.parse(localStorage.getItem('FarmGod_unitSpeeds')) || false;
    } catch (e) {
      console.warn('[FarmGod] getUnitSpeeds: localStorage corrupt, wird neu geladen.');
      return false;
    }
  };

  if (!getUnitSpeeds()) setUnitSpeeds();

  // ── Pagination ─────────────────────────────────────────────────────────────
  const determineNextPage = function (page, $html) {
    let villageLength =
      $html.find('#scavenge_mass_screen').length > 0
        ? $html.find('tr[id*="scavenge_village"]').length
        : $html.find('tr.row_a, tr.row_ax, tr.row_b, tr.row_bx').length;
    let navSelect = $html.find('.paged-nav-item').first().closest('td').find('select').first();
    let navLength =
      $html.find('#am_widget_Farm').length > 0
        ? parseInt($('#plunder_list_nav').first()
            .find('a.paged-nav-item, strong.paged-nav-item').last().text().replace(/\D/g, '')) - 1
        : navSelect.length > 0
          ? navSelect.find('option').length - 1
          : $html.find('.paged-nav-item').not('[href*="page=-1"]').length;
    let pageSize = $('#mobileHeader').length > 0
      ? 10
      : parseInt($html.find('input[name="page_size"]').val());

    if (page === -1 && villageLength === 1000) return Math.floor(1000 / pageSize);
    if (page < navLength) return page + 1;
    return false;
  };

  const processPage = function (url, page, wrapFn) {
    let pageText = url.match('am_farm') ? `&Farm_page=${page}` : `&page=${page}`;
    return twLib.ajax({ url: url + pageText }).then((html) => wrapFn(page, $(html)));
  };

  // [NEW-6] Parallele Pages: Erste Seite laden, dann alle weiteren parallel fetchen
  const processAllPages = function (url, processorFn) {
    let startPage = url.match('am_farm') || url.match('scavenge_mass') ? 0 : -1;

    return processPage(url, startPage, (page, $html) => {
      let dnp = determineNextPage(page, $html);
      processorFn($html); // erste Seite sofort verarbeiten

      if (!dnp) return Promise.resolve();

      // Alle weiteren Seiten parallel laden
      let furtherPages = [];
      for (let p = dnp; p !== false; p = p < dnp + 50 ? p + 1 : false) {
        // Begrenze auf max 50 weitere Seiten als Sicherheitsnetz
        furtherPages.push(p);
        if (p >= dnp + 49) break;
      }

      // Bessere Methode: Seiten sequenziell bis Ende ermitteln, dann parallel laden
      // Da wir die Gesamtanzahl von Seite 1 kennen, direkt parallel fetchen
      let pageText = url.match('am_farm') ? `&Farm_page=` : `&page=`;
      let parallelRequests = [];
      for (let p = dnp; ; p++) {
        parallelRequests.push(
          twLib.ajax({ url: url + pageText + p }).then((html) => processorFn($(html)))
        );
        // Prüfe ob das die letzte Seite war (navLength aus erster Seite)
        if (p >= dnp + 98) break; // absolutes Maximum
        // Abbruch wenn keine weiteren Seiten (wird durch leere Ergebnisse signalisiert)
        // In der Praxis: TW hat selten >10 Seiten, daher safe
        let lastNavLength = determineNextPage(p, $html);
        if (!lastNavLength || p >= lastNavLength) break;
      }
      return Promise.all(parallelRequests);
    });
  };

  // Verbesserte processAllPages die korrekt mit der navLength aus Seite 1 arbeitet
  const processAllPagesV2 = function (url, processorFn) {
    let startPage = url.match('am_farm') || url.match('scavenge_mass') ? 0 : -1;
    let pageText  = url.match('am_farm') ? `&Farm_page=` : `&page=`;

    return twLib.ajax({ url: url + pageText + startPage }).then((html) => {
      let $firstHtml = $(html);
      processorFn($firstHtml);

      // [BUG-B FIX] Seitenanzahl aus $firstHtml lesen, NICHT aus dem Live-DOM
      // [BUG-E FIX] navSelect: .length - 1 (Seiten sind 0-indiziert)
      let navSelect = $firstHtml.find('.paged-nav-item').first().closest('td').find('select').first();
      let totalPages;
      if ($firstHtml.find('#am_widget_Farm').length > 0) {
        // Farm-Assistent: Seitenanzahl aus der geparsten HTML-Seite lesen
        totalPages = parseInt($firstHtml.find('#plunder_list_nav')
          .find('a.paged-nav-item, strong.paged-nav-item').last().text().replace(/\D/g, '')) || 1;
      } else if (navSelect.length > 0) {
        // Übersichtsseiten: Optionen = Seiten, 0-indiziert → -1
        totalPages = navSelect.find('option').length - 1;
      } else {
        totalPages = $firstHtml.find('.paged-nav-item').not('[href*="page=-1"]').length + 1;
      }

      if (totalPages <= 1) return Promise.resolve();

      // Alle weiteren Seiten parallel fetchen
      let requests = [];
      