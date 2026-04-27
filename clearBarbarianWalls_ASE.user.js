// ==UserScript==
// @name         Clear Barbarian Walls [ASE Edition]
// @namespace    https://github.com/franz21-ui/
// @version      1.0.0
// @description  Injiziert einen Schnellleisten-Button auf der Farming-Assistant-Seite. Klick → analysiert alle Barbarendörfer mit Wall > 0 und schickt automatisch Angriffe (Axt + Rammbock + Späher) per direktem POST. Kein Tab-Öffnen, keine Popups. Queue-basiert mit konfigurierbarem Delay.
// @author       ASE (Autonomous Systems Engineer) für Shop21 / W252
// @match        https://de*.die-staemme.de/game.php*
// @match        https://de*.die-staemme.de/game.php*screen=am_farm*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      die-staemme.de
// @run-at       document-end
// ==/UserScript==

(function () {
‘use strict’;

```
// ════════════════════════════════════════════════════
// KONFIGURATION — hier anpassen
// ════════════════════════════════════════════════════
const CONFIG = {
    // Truppen pro Wall-Level: { axt, ramm, sp }
    // Wall 0 = kein Angriff nötig
    troops: [
        null,                          // lvl 0 — übersprungen
        { axt: 40,  ramm: 4,  sp: 1 }, // lvl 1
        { axt: 50,  ramm: 7,  sp: 1 }, // lvl 2
        { axt: 50,  ramm: 10, sp: 1 }, // lvl 3
        { axt: 80,  ramm: 16, sp: 1 }, // lvl 4
        { axt: 120, ramm: 20, sp: 1 }, // lvl 5
        { axt: 160, ramm: 25, sp: 1 }, // lvl 6
        { axt: 400, ramm: 50, sp: 1 }, // lvl 7+
    ],
    requestDelay: 600,    // ms Pause zwischen Angriffen (Anti-Spam)
    ramGreens: true,       // auch grüne (keine Verluste) angreifen?
    minWallLevel: 1,       // Mindest-Wallstufe zum Angreifen
};

// ════════════════════════════════════════════════════
// LOGGING — Silent Execution
// ════════════════════════════════════════════════════
const ASE_LOG = (msg, level = 'info') => {
    const prefix = '[ASE-CBW]';
    if (level === 'error') console.error(prefix, msg);
    else if (level === 'warn') console.warn(prefix, msg);
    else console.log(prefix, msg);
};

// ════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ════════════════════════════════════════════════════

/** Extrahiert das CSRF-Token ("h") aus dem aktuellen DOM */
function getCSRFToken() {
    const input = document.querySelector('input[name="h"]');
    if (input) return input.value;
    // Fallback: aus URL-Parametern lesen
    const match = window.location.href.match(/[&?]h=([a-f0-9]+)/);
    return match ? match[1] : null;
}

/** Gibt das aktuelle Dorf (village_id) aus der URL zurück */
function getCurrentVillageId() {
    const match = window.location.href.match(/village=(\d+)/);
    return match ? match[1] : null;
}

/** Mappt Wall-Level auf Truppen-Config (7+ → Index 7) */
function getTroopsForWall(wallLevel) {
    const idx = Math.min(wallLevel, CONFIG.troops.length - 1);
    return CONFIG.troops[idx] || CONFIG.troops[CONFIG.troops.length - 1];
}

// ════════════════════════════════════════════════════
// PARSE: Farming-Assistant Tabelle auslesen
// ════════════════════════════════════════════════════
function parseFarmList() {
    const table = document.querySelector('#plunder_list');
    if (!table) {
        ASE_LOG('Tabelle #plunder_list nicht gefunden. Bist du auf am_farm?', 'error');
        return [];
    }

    const targets = [];
    const rows = table.querySelectorAll('tr[id]');

    rows.forEach(row => {
        // Wall-Level steht in der 7. <td>
        const wallCell = row.querySelector('td:nth-of-type(7)');
        const wallLevel = wallCell ? parseInt(wallCell.textContent.trim(), 10) : 0;

        // Green-Icon = keine Verluste beim letzten Angriff
        const iconImg = row.querySelector('td:nth-of-type(2) img');
        const isGreen = iconImg ? iconImg.src.includes('green.png') : false;

        // Überspringen: Wall zu niedrig
        if (wallLevel < CONFIG.minWallLevel) return;
        // Überspringen: grünes Icon wenn ramGreens deaktiviert
        if (!CONFIG.ramGreens && isGreen) return;

        // Dorf-ID aus Row-ID extrahieren (z.B. "village_row_12345")
        const idMatch = row.id.match(/(\d+)/);
        if (!idMatch) return;
        const targetVillageId = idMatch[1];

        targets.push({ targetVillageId, wallLevel, isGreen });
        ASE_LOG(`Ziel gefunden: Dorf ${targetVillageId}, Wall ${wallLevel}`);
    });

    ASE_LOG(`${targets.length} Ziele mit Wall ≥ ${CONFIG.minWallLevel} gefunden.`);
    return targets;
}

// ════════════════════════════════════════════════════
// ANGRIFF: POST-Request direkt an die DS API
// ════════════════════════════════════════════════════
function sendAttack(sourceVillageId, target, csrfToken) {
    return new Promise((resolve, reject) => {
        const troops = getTroopsForWall(target.wallLevel);
        const world = window.location.hostname.split('.')[0]; // z.B. "de252"

        // POST-Body aufbauen — Feldnamen entsprechen dem Rallye-Punkt-Formular
        const params = new URLSearchParams({
            target:  target.targetVillageId,
            h:       csrfToken,
            attack:  '1',             // Angriff (nicht Unterstützung)
            spy:     troops.sp,
            axe:     troops.axt,
            ram:     troops.ramm,
            // Weitere Einheiten bleiben 0 (nicht mitschicken)
            sword:   0,
            archer:  0,
            light:   0,
            marcher: 0,
            heavy:   0,
            catapult:0,
            knight:  0,
            snob:    0,
        });

        const url = `https://${world}.die-staemme.de/game.php?village=${sourceVillageId}&screen=place&ajax=confirm`;

        ASE_LOG(`POST → Dorf ${target.targetVillageId} | Wall ${target.wallLevel} | Axt ${troops.axt} | Ramm ${troops.ramm}`);

        GM_xmlhttpRequest({
            method:  'POST',
            url:     url,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
            },
            data: params.toString(),
            onload: (resp) => {
                if (resp.status === 200) {
                    ASE_LOG(`✓ Angriff auf ${target.targetVillageId} gesendet (Wall ${target.wallLevel})`);
                    resolve(resp);
                } else {
                    ASE_LOG(`✗ Fehler bei ${target.targetVillageId}: HTTP ${resp.status}`, 'error');
                    reject(new Error(`HTTP ${resp.status}`));
                }
            },
            onerror: (err) => {
                ASE_LOG(`✗ Netzwerkfehler bei ${target.targetVillageId}`, 'error');
                reject(err);
            }
        });
    });
}

// ════════════════════════════════════════════════════
// QUEUE: Angriffe nacheinander mit Delay senden
// ════════════════════════════════════════════════════
async function processQueue(targets, sourceVillageId, csrfToken, statusEl) {
    let success = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        statusEl.textContent = `[ASE-CBW] ${i + 1}/${targets.length} — Dorf ${target.targetVillageId}...`;

        try {
            await sendAttack(sourceVillageId, target, csrfToken);
            success++;
        } catch (e) {
            failed++;
        }

        // Delay zwischen Requests (Anti-Spam / Serverfreundlich)
        if (i < targets.length - 1) {
            await new Promise(r => setTimeout(r, CONFIG.requestDelay));
        }
    }

    statusEl.textContent = `[ASE-CBW] Fertig! ✓ ${success} gesendet, ✗ ${failed} Fehler.`;
    ASE_LOG(`Queue abgearbeitet: ${success} erfolgreich, ${failed} Fehler.`);
}

// ════════════════════════════════════════════════════
// UI: Button in die DS-Schnellleiste injizieren
// ════════════════════════════════════════════════════
function injectQuickbarButton() {
    // Schnellleiste suchen — verschiedene DS-Versionen haben unterschiedliche Container
    const quickbar = document.querySelector('#quickbar ul, .quickbar ul, #menu_inner ul');
    if (!quickbar) {
        ASE_LOG('Schnellleiste nicht gefunden — warte auf DOM...', 'warn');
        return false;
    }

    // Doppeltes Injizieren verhindern
    if (document.getElementById('ase-cbw-btn')) return true;

    // Status-Anzeige
    const statusSpan = document.createElement('span');
    statusSpan.id = 'ase-cbw-status';
    statusSpan.style.cssText = `
        font-size: 11px;
        color: #f90;
        margin-left: 8px;
        font-family: monospace;
    `;
    statusSpan.textContent = '';

    // Button erstellen
    const li = document.createElement('li');
    const btn = document.createElement('a');
    btn.id = 'ase-cbw-btn';
    btn.href = '#';
    btn.textContent = '🏹 Wall Clear';
    btn.title = 'Clear Barbarian Walls [ASE Edition] — Klick startet Angriffe auf alle Barbs mit Wall > 0';
    btn.style.cssText = `
        cursor: pointer;
        color: #ffcc44;
        font-weight: bold;
        text-decoration: none;
    `;

    // Klick-Handler mit Anti-Double-Click
    let running = false;
    btn.addEventListener('click', async (e) => {
        e.preventDefault();

        if (running) {
            ASE_LOG('Script läuft bereits — bitte warten.', 'warn');
            return;
        }

        // Sicherheits-Check: Nur auf am_farm-Seite
        if (!window.location.href.includes('am_farm')) {
            statusSpan.textContent = '⚠ Nur auf der Farming-Assistant-Seite nutzbar!';
            ASE_LOG('Falscher Screen — bitte zur am_farm-Seite navigieren.', 'error');
            return;
        }

        running = true;
        btn.style.opacity = '0.5';
        btn.textContent = '⏳ Läuft...';

        const csrfToken = getCSRFToken();
        const sourceVillageId = getCurrentVillageId();

        if (!csrfToken) {
            statusSpan.textContent = '⚠ CSRF-Token nicht gefunden!';
            ASE_LOG('CSRF-Token (h) nicht im DOM gefunden.', 'error');
            running = false;
            btn.style.opacity = '1';
            btn.textContent = '🏹 Wall Clear';
            return;
        }

        const targets = parseFarmList();
        if (targets.length === 0) {
            statusSpan.textContent = '✓ Keine Ziele gefunden.';
            running = false;
            btn.style.opacity = '1';
            btn.textContent = '🏹 Wall Clear';
            return;
        }

        statusSpan.textContent = `[ASE-CBW] Starte Queue (${targets.length} Ziele)...`;

        await processQueue(targets, sourceVillageId, csrfToken, statusSpan);

        running = false;
        btn.style.opacity = '1';
        btn.textContent = '🏹 Wall Clear';
    });

    li.appendChild(btn);
    li.appendChild(statusSpan);
    quickbar.appendChild(li);

    ASE_LOG('✓ Schnellleisten-Button injiziert. Navigiere zur Farming-Assistant-Seite und klicke "Wall Clear".');
    return true;
}

// ════════════════════════════════════════════════════
// INIT: Mit MutationObserver auf DOM warten
// ════════════════════════════════════════════════════
function init() {
    // Direktversuch
    if (injectQuickbarButton()) return;

    // Fallback: MutationObserver bis Schnellleiste da ist
    const observer = new MutationObserver(() => {
        if (injectQuickbarButton()) {
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Sicherheits-Timeout nach 10s
    setTimeout(() => {
        observer.disconnect();
        ASE_LOG('Timeout: Schnellleiste nach 10s nicht gefunden.', 'warn');
    }, 10000);
}

init();
```

})();