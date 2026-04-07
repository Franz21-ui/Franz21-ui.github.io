// TW Operation Scheduler v3

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

  const KNOWN_FIELDS = [
    'template_id','source_village','spear','sword','axe','spy',
    'light','heavy','ram','catapult','snob','knight','archer','marcher',
    'x','y','target_type','input','attack','support'
  ];

  // SERVER-ZEIT
  let _serverOffset = 0;
  const initServerOffset = function () {
    try {
      let text = $('#serverTime').closest('p').text();
      let m  = text.match(/(\d+):(\d+):(\d+)/);
      let dm = text.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!m || !dm) return;
      let y = parseInt(dm[3]) < 100 ? 2000 + parseInt(dm[3]) : parseInt(dm[3]);
      let ts = new Date(y, parseInt(dm[2])-1, parseInt(dm[1]),
        parseInt(m[1]), parseInt(m[2]), parseInt(m[3])).getTime();
      _serverOffset = ts - Date.now();
    } catch(e) { _serverOffset = 0; }
  };
  const serverNow = () => Date.now() + _serverOffset;

  // PARSER
  const parseExport = function (raw) {
    let ops = [];
    raw.trim().split('\n').forEach((line, i) => {
      line = line.trim();
      if (!line) return;
      let cols = line.split('\t');
      if (cols.length < 8) cols = line.split(/\s{2,}/);
      if (cols.length < 8) return;
      try {
        let originFull = cols[2].trim();
        let unitRaw    = cols[3].trim();
        let targetFull = cols[5].trim();
        let originCoord = (originFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        let targetCoord = (targetFull.match(/\((\d+)\|(\d+)\)/) || [])[0];
        if (!originCoord || !targetCoord) return;
        let unitKey = null;
        let ul = unitRaw.toLowerCase();
        for (let k in UNIT_MAP) { if (ul.includes(k)) { unitKey = UNIT_MAP[k]; break; } }
        const pt = (str) => {
          let m = str.match(/(\d+)\.(\d+)\.(\d+)\s+(\d+):(\d+):(\d+)/);
          if (!m) return null;
          let y = parseInt(m[3]) < 100 ? 2000+parseInt(m[3]) : parseInt(m[3]);
          return new Date(y,parseInt(m[2])-1,parseInt(m[1]),parseInt(m[4]),parseInt(m[5]),parseInt(m[6])).getTime();
        };
        let departTs = pt(cols[6].trim());
        let arriveTs = pt(cols[7].trim());
        if (!departTs || !arriveTs) return;
        let troops = {};
        if (unitKey) troops[unitKey] = 'all';
        ops.push({
          id: i,
          type: cols[0].trim().replace(/[()]/g,'').toLowerCase(),
          originVillage: originFull.replace(/\s*\(.*\).*$/,'').trim(),
          originCoord, targetCoord,
          targetName: targetFull.replace(/\s*\(.*\).*$/,'').trim(),
          unitRaw, troops, departTs, arriveTs,
          status: 'pending', timerId: null,
        });
      } catch(e) { console.warn('[TWOps] Parse-Fehler Zeile '+i, e); }
    });
    return ops.sort((a,b) => a.departTs - b.departTs);
  };

  // DOERFER
  const loadOwnVillages = function () {
    return $.get('/map/village.txt').then(function (txt) {
      let myId = game_data.player.id;
      window._twOpsVillages = [];
      (txt.match(/[^\r\n]+/g)||[]).forEach(function(line){
        let p = line.split(',');
        if (p.length >= 5 && String(p[4]) === String(myId)) {
          window._twOpsVillages.push({ id:parseInt(p[0]), x:p[2].trim(), y:p[3].trim() });
        }
      });
      console.log('[TWOps] Doerfer geladen:', window._twOpsVillages.length);
    }).fail(function(){ window._twOpsVillages = []; });
  };

  const getOriginId = function (op) {
    let parts = op.originCoord.replace(/[()]/g,'').split('|');
    let ox = parts[0].trim(), oy = parts[1].trim();
    let cv = game_data.village;
    if (cv && String(cv.x)===ox && String(cv.y)===oy) return cv.id;
    if (window._twOpsVillages) {
      for (let v of window._twOpsVillages) {
        if (v.x===ox && v.y===oy) return v.id;
      }
    }
    return cv ? cv.id : null;
  };

  // ANGRIFF SENDEN
  const sendAttack = function (op) {
    let stEl  = document.getElementById('twOpsSt_'  + op.id);
    let cdEl  = document.getElementById('twOpsCd_'  + op.id);
    let rowEl = document.getElementById('twOpsRow_' + op.id);

    const setStatus = (txt, cls, rowCls) => {
      if (stEl)  { stEl.textContent = txt; stEl.className = 'ops-status-' + cls; }
      if (cdEl)  cdEl.textContent = '';
      if (rowEl) rowEl.className = rowCls || cls;
    };

    let tparts = op.targetCoord.replace(/[()]/g,'').split('|');
    let targetX = tparts[0].trim(), targetY = tparts[1].trim();
    let originId = getOriginId(op);

    if (!originId) { setStatus('Kein Dorf', 'error', 'error'); op.status='error'; return; }

    let troopData = {};
    UNITS.forEach(u => {
      let val = op.troops[u.key];
      if (val && val !== '0' && val !== '') troopData[u.key] = val;
    });
    if (!Object.keys(troopData).length) {
      setStatus('Keine Truppen', 'error', 'error'); op.status='error'; return;
    }

    setStatus('Lade...', 'pending', 'imminent');

    // Schritt 1: Place-Screen laden
    $.get('/game.php?village=' + originId + '&screen=place&x=' + targetX + '&y=' + targetY)
      .then(function (html) {
        let $html = $(html);

        // CSRF: erstes unbekanntes hidden input
        let csrfName = null, csrfVal = null;
        $html.find('input[type="hidden"]').each(function () {
          let n = $(this).attr('name') || '';
          if (n && KNOWN_FIELDS.indexOf(n) === -1) {
            csrfName = n; csrfVal = $(this).val(); return false;
          }
        });
        console.log('[TWOps] CSRF:', csrfName, '=', csrfVal);

        // Formular aufbauen
        let formData = { x: targetX, y: targetY, attack: 'Angreifen', source_village: String(originId) };
        if (csrfName) formData[csrfName] = csrfVal;

        let hasUnits = false;
        UNITS.forEach(u => {
          let val = troopData[u.key];
          if (!val) return;
          let el = $html.find('input[name="' + u.key + '"]');
          if (!el.length) return;
          let avail = parseInt(el.attr('data-all-count') || el.attr('max') || '0');
          let count = (val === 'all') ? avail : Math.min(parseInt(val)||0, avail);
          if (count > 0) { formData[u.key] = String(count); hasUnits = true; }
        });

        if (!hasUnits) { setStatus('Keine Truppen verfuegbar', 'error', 'error'); op.status='error'; return; }

        console.log('[TWOps] POST Schritt 1:', JSON.stringify(formData));

        // Schritt 2: POST -> Bestaetigung
        $.post('/game.php?village=' + originId + '&screen=place', formData)
          .then(function (confirmHtml) {
            let $c = $(confirmHtml);
            let forms = $c.find('form').map(function(){ return $(this).attr('name')||$(this).attr('id')||'?'; }).get();
            let err   = $c.find('.error_box,.system_wide_message').text().trim();
            console.log('[TWOps] Schritt2 - Formulare:', forms, '| Fehler:', err);

            if (err) { setStatus('Fehler: '+err.substring(0,30), 'error','error'); op.status='error'; return; }

            let confirmForm = $c.find('form[name="command-data-form"]');
            if (!confirmForm.length) {
              // Kein Bestaetigunsformular
              console.log('[TWOps] Kein command-data-form. Inputs:', $c.find('input').map(function(){ return $(this).attr('name')+'='+$(this).val(); }).get());
              setStatus('Gesendet?', 'sent', 'sent'); op.status='sent'; return;
            }

            let confirmData = {};
            confirmForm.find('input').each(function () {
              let n=$(this).attr('name'), v=$(this).val(), t=$(this).attr('type')||'';
              if (n && t !== 'submit') confirmData[n] = v;
            });
            confirmData['attack'] = 'Angreifen';
            console.log('[TWOps] POST Schritt 2:', JSON.stringify(confirmData));

            // Schritt 3
            $.post('/game.php?village=' + originId + '&screen=place&try=confirm', confirmData)
              .then(function (result) {
                let e2 = $(result).find('.error_box,.system_wide_message').text().trim();
                console.log('[TWOps] Schritt3 Fehler:', e2);
                if (e2) { setStatus('Fehler Final', 'error','error'); op.status='error'; return; }
                setStatus('Gesendet OK', 'sent', 'sent');
                op.status = 'sent';
                UI.SuccessMessage('Gesendet: ' + op.originCoord + ' -> ' + op.targetCoord);
              })
              .fail(function(){ setStatus('Fehler Senden', 'error','error'); op.status='error'; });

          }).fail(function(){ setStatus('Fehler POST', 'error','error'); op.status='error'; });

      }).fail(function(){ setStatus('Fehler Place', 'error','error'); op.status='error'; });
  };

  // UI
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
    + '</style>';

  const buildTroopCell = (op) => {
    let h = '<div class="ops-troop-cell">';
    UNITS.forEach(u => {
      let val = op.troops[u.key] || '';
      let dv  = (val==='all') ? '' : val;
      let ph  = (val==='all') ? 'alle' : '0';
      h += '<div class="ops-troop-entry"><label>' + u.label + '</label>'
        + '<div style="display:flex;align-items:center;">'
        + '<input class="ops-troop-input" type="text"'
        + ' data-op="' + op.id + '" data-unit="' + u.key + '"'
        + ' value="' + dv + '" placeholder="' + ph + '">'
        + '<button class="ops-all-btn" data-op="' + op.id + '" data-unit="' + u.key + '">∞</button>'
        + '</div></div>';
    });
    return h + '</div>';
  };

  const buildTable = (ops) => {
    if (!ops.length) return '<p style="text-align:center;color:#c00;margin-top:8px">Keine Operationen gefunden.</p>';
    const fmt = ts => new Date(ts).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    let h = '<table class="ops-table"><tr><th>#</th><th>Typ</th><th>Herkunft</th><th>Ziel</th><th>Truppen (leer=0, ∞=alle)</th><th>Abfahrt</th><th>Ankunft</th><th>Countdown</th><th>Status</th></tr>';
    ops.forEach((op,i) => {
      h += '<tr id="twOpsRow_'+op.id+'" class="'+op.status+'">'
        +'<td>'+(i+1)+'</td>'
        +'<td>'+(op.type==='fake'?'<span style="color:#888">(F)</span>':'<b>(R)</b>')+'</td>'
        +'<td style="text-align:left" title="'+op.originCoord+'">'+op.originVillage+'</td>'
        +'<td style="text-align:left" title="'+op.targetCoord+'">'+op.targetName+'</td>'
        +'<td>'+buildTroopCell(op)+'</td>'
        +'<td style="white-space:nowrap">'+fmt(op.departTs)+'</td>'
        +'<td style="white-space:nowrap">'+fmt(op.arriveTs)+'</td>'
        +'<td><span id="twOpsCd_'+op.id+'" class="ops-countdown">--</span></td>'
        +'<td><span id="twOpsSt_'+op.id+'" class="ops-status-pending">Ausstehend</span></td>'
        +'</tr>';
    });
    return h + '</table>';
  };

  // TICKER
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
          let hh=Math.floor(diff/3600), mm=Math.floor((diff%3600)/60), ss=diff%60;
          cdEl.textContent = (hh>0?hh+'h ':'') + (mm>0||hh>0?String(mm).padStart(2,'0')+'m ':'') + String(ss).padStart(2,'0')+'s';
          if (diff<=60 && rowEl) rowEl.className='imminent';
        } else { cdEl.textContent='Sendet...'; }
      });
      updateSummary(ops);
      if (ops.every(o => o.status!=='pending')) { clearInterval(tickInterval); updateSummary(ops,true); }
    }, 1000);
  };

  const updateSummary = (ops, done) => {
    let p=ops.filter(o=>o.status==='pending').length, s=ops.filter(o=>o.status==='sent').length,
        e=ops.filter(o=>o.status==='error').length, mi=ops.filter(o=>o.status==='missed').length;
    $('#twOpsSummary').show().html(
      (done?'<b>Abgeschlossen.</b> ':'<b>Aktiv</b> -- ')
      +'Ausstehend: <b>'+p+'</b> | Gesendet: <b style="color:#155724">'+s+'</b> | Fehler: <b style="color:#721c24">'+e+'</b>'
      +(mi?' | Verpasst: <b style="color:#856404">'+mi+'</b>':'')
    );
  };

  const scheduleAll = (ops) => {
    let now = serverNow();
    ops.forEach(op => {
      let ms = op.departTs - now;
      if (ms < -5000) {
        op.status='missed';
        let s=document.getElementById('twOpsSt_'+op.id), c=document.getElementById('twOpsCd_'+op.id), r=document.getElementById('twOpsRow_'+op.id);
        if(s){s.textContent='Verpasst';s.className='ops-status-missed';} if(c)c.textContent=''; if(r)r.className='missed';
        return;
      }
      if (ms < 0) ms = 0;
      op.timerId = setTimeout(() => sendAttack(op), ms);
    });
  };

  const cancelAll = (ops) => {
    ops.forEach(op => {
      if (op.timerId) clearTimeout(op.timerId);
      if (op.status==='pending') {
        op.status='missed';
        let s=document.getElementById('twOpsSt_'+op.id), r=document.getElementById('twOpsRow_'+op.id);
        if(s){s.textContent='Abgebrochen';s.className='ops-status-missed';} if(r)r.className='missed';
      }
    });
    clearInterval(tickInterval);
  };

  const readTroopsFromTable = (ops) => {
    ops.forEach(op => {
      UNITS.forEach(u => {
        let input = document.querySelector('input.ops-troop-input[data-op="'+op.id+'"][data-unit="'+u.key+'"]');
        if (!input) return;
        let val=input.value.trim(), ph=input.placeholder;
        if (!val && ph==='alle') { op.troops[u.key]='all'; }
        else if (!val || val==='0') { delete op.troops[u.key]; }
        else { op.troops[u.key]=val; }
      });
    });
  };

  // INIT
  const init = () => {
    initServerOffset();
    let ui = buildCSS()
      + '<div id="twOpsBox"><h3>Operation Scheduler v3</h3>'
      + '<textarea id="twOpsInput" placeholder="DS-Ultimate Export einfügen..."></textarea>'
      + '<div class="ops-toolbar">'
      + '<input type="button" id="twOpsLoad" class="btn" value="Laden">'
      + '<input type="button" id="twOpsStart" class="btn" value="Starten" disabled style="background:#2a7;color:#fff;">'
      + '<input type="button" id="twOpsCancel" class="btn" value="Abbrechen" disabled style="background:#c44;color:#fff;">'
      + '<span style="font-size:10px;color:#888">Truppen eintragen, dann Starten.</span>'
      + '</div><div id="twOpsSummary" style="display:none"></div>'
      + '<div id="twOpsTable"></div></div>';

    Dialog.show('TWOps', ui);
    let currentOps = [];
    loadOwnVillages();

    $('#twOpsLoad').on('click', function () {
      let raw = $('#twOpsInput').val().trim();
      if (!raw) { UI.ErrorMessage('Bitte Export einfügen.'); return; }
      currentOps.forEach(op => { if(op.timerId) clearTimeout(op.timerId); });
      clearInterval(tickInterval);
      currentOps = parseExport(raw);
      $('#twOpsTable').html(buildTable(currentOps));
      if (!currentOps.length) return;
      $(document).off('click.opsAll').on('click.opsAll', '.ops-all-btn', function () {
        let oid=$(this).data('op'), unit=$(this).data('unit');
        $('input.ops-troop-input[data-op="'+oid+'"][data-unit="'+unit+'"]').val('').attr('placeholder','alle');
      });
      $('#twOpsStart').prop('disabled', false);
      $('#twOpsCancel').prop('disabled', true);
      UI.SuccessMessage(currentOps.length + ' Operationen geladen.');
    });

    $('#twOpsStart').on('click', function () {
      if (!currentOps.length) return;
      readTroopsFromTable(currentOps);
      let pending = currentOps.filter(o => o.status==='pending');
      if (pending.every(o => !Object.keys(o.troops).length)) { UI.ErrorMessage('Bitte Truppen eintragen!'); return; }
      scheduleAll(currentOps);
      startTicker(currentOps);
      updateSummary(currentOps);
      $(this).prop('disabled', true);
      $('#twOpsCancel').prop('disabled', false);
      $('input.ops-troop-input, .ops-all-btn').prop('disabled', true);
      UI.SuccessMessage(pending.length + ' Angriffe geplant.');
    });

    $('#twOpsCancel').on('click', function () {
      cancelAll(currentOps);
      $(this).prop('disabled', true);
      $('input.ops-troop-input, .ops-all-btn').prop('disabled', false);
    });
  };

  init();

})();
