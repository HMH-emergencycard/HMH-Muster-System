(function () {

  loadHistory();

  function loadHistory() {
    var container = document.getElementById('historyList');

    db.ref('sessionHistory').once('value', function (snap) {
      var val = snap.val();
      if (!val) {
        container.innerHTML =
          '<div style="text-align:center;padding:40px;color:#888;">No session history yet.' +
          '<br><br>Sessions will be recorded here automatically when you stop a session.</div>';
        return;
      }

      // Sort newest first
      var sessions = Object.values(val);
      sessions.sort(function (a, b) { return new Date(b.startedAt) - new Date(a.startedAt); });

      container.innerHTML = '';
      sessions.forEach(function (session, index) {
        renderSessionCard(session, container, index === 0);
      });
    });
  }

  function toArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return Object.values(val);
  }

  function renderSessionCard(session, container, expanded) {
    var startDate = new Date(session.startedAt);
    var endDate   = session.endedAt ? new Date(session.endedAt) : null;

    var dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    var timeStr = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    var endStr  = endDate ? endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    var dur = session.durationMinutes != null
      ? (session.durationMinutes < 60
          ? session.durationMinutes + ' min'
          : Math.floor(session.durationMinutes / 60) + 'h ' + (session.durationMinutes % 60) + 'm')
      : 'N/A';

    var pct      = session.overallPct || 0;
    var pctColor = pct === 100 ? '#28a745' : pct >= 75 ? '#e65100' : '#dc3545';

    var locs           = toArray(session.locations);
    var incompleteLocs = locs.filter(function (l) { return l.incomplete; });

    var cardId = 'hist-' + (session.sessionId || startDate.getTime());

    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.08);margin-bottom:16px;overflow:hidden;border-left:5px solid ' + pctColor + ';';

    card.innerHTML =
      '<div onclick="toggleHist(\'' + cardId + '\')" style="padding:16px 20px;cursor:pointer;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">' +
        '<div style="flex:2;min-width:150px;">' +
          '<div style="font-size:1rem;font-weight:bold;color:#333;">' + dateStr + '</div>' +
          '<div style="font-size:0.82rem;color:#888;">' + timeStr + ' &rarr; ' + endStr + ' &nbsp;&bull;&nbsp; ' + dur + '</div>' +
        '</div>' +
        '<div style="text-align:center;">' +
          '<div style="font-size:1.5rem;font-weight:bold;color:' + pctColor + ';">' + pct + '%</div>' +
          '<div style="font-size:0.75rem;color:#888;">Accounted</div>' +
        '</div>' +
        '<div style="text-align:center;">' +
          '<div style="font-size:1.2rem;font-weight:bold;color:#333;">' + (session.totalCheckedIn || 0) + ' / ' + (session.totalEmployees || 0) + '</div>' +
          '<div style="font-size:0.75rem;color:#888;">Employees</div>' +
        '</div>' +
        (session.contractors ? '<div style="text-align:center;"><div style="font-size:1.2rem;font-weight:bold;color:#e65100;">' + session.contractors + '</div><div style="font-size:0.75rem;color:#888;">Contractors</div></div>' : '') +
        '<div style="text-align:center;">' +
          '<div style="font-size:1.2rem;font-weight:bold;color:' + (incompleteLocs.length ? '#dc3545' : '#28a745') + ';">' + incompleteLocs.length + '</div>' +
          '<div style="font-size:0.75rem;color:#888;">Incomplete Points</div>' +
        '</div>' +
        '<div style="margin-left:auto;color:#aaa;font-size:1.1rem;" id="' + cardId + '-arrow">' + (expanded ? '&#x25B2;' : '&#x25BC;') + '</div>' +
      '</div>' +
      '<div id="' + cardId + '" style="display:' + (expanded ? 'block' : 'none') + ';border-top:1px solid #eee;">' +
        buildLocationTable(locs) +
      '</div>';

    container.appendChild(card);
  }

  function buildLocationTable(locs) {
    if (!locs || locs.length === 0) {
      return '<div style="padding:16px;color:#888;">No location data available.</div>';
    }

    var html =
      '<table style="width:100%;border-collapse:collapse;font-size:0.84rem;">' +
      '<thead><tr style="background:#f5f5f5;">' +
        '<th style="padding:8px 12px;text-align:left;">Muster Point</th>' +
        '<th style="padding:8px 12px;text-align:center;">Assigned</th>' +
        '<th style="padding:8px 12px;text-align:center;">Checked In</th>' +
        '<th style="padding:8px 12px;text-align:center;">Off-Site</th>' +
        '<th style="padding:8px 12px;text-align:center;">%</th>' +
        '<th style="padding:8px 12px;text-align:left;">Missing</th>' +
      '</tr></thead><tbody>';

    locs.forEach(function (loc) {
      var rowBg    = loc.incomplete ? (loc.pct >= 75 ? '#fff8e1' : '#fff3f3') : '#f0fff4';
      var pctColor = loc.pct === 100 ? '#28a745' : loc.pct >= 75 ? '#e65100' : '#dc3545';
      var missing  = toArray(loc.missing);
      var missingStr = missing.length ? missing.join(', ') : '&#x2014;';

      html +=
        '<tr style="background:' + rowBg + ';border-bottom:1px solid #eee;">' +
          '<td style="padding:8px 12px;font-weight:bold;">' + loc.label + '</td>' +
          '<td style="padding:8px 12px;text-align:center;">' + (loc.assigned || 0) + '</td>' +
          '<td style="padding:8px 12px;text-align:center;">' + (loc.checkedIn || 0) + '</td>' +
          '<td style="padding:8px 12px;text-align:center;">' + (loc.offSite || 0) + '</td>' +
          '<td style="padding:8px 12px;text-align:center;font-weight:bold;color:' + pctColor + ';">' + loc.pct + '%</td>' +
          '<td style="padding:8px 12px;color:#c62828;font-size:0.8rem;">' + missingStr + '</td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    return html;
  }

  window.toggleHist = function (id) {
    var el    = document.getElementById(id);
    var arrow = document.getElementById(id + '-arrow');
    if (!el) return;
    var open = el.style.display === 'block';
    el.style.display = open ? 'none' : 'block';
    if (arrow) arrow.innerHTML = open ? '&#x25BC;' : '&#x25B2;';
  };

})();
