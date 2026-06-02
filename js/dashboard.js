(function () {

  // ========================================================
  // PIN Protection
  // ========================================================
  const CORRECT_PIN = '1234';

  window.checkPin = function () {
    const val = document.getElementById('pinInput').value;
    if (val === CORRECT_PIN) {
      document.getElementById('pin-overlay').style.display = 'none';
      // Wait for roster to load from Firebase before building the dashboard
      onRosterReady(function () {
        initDashboard();
      });
    } else {
      document.getElementById('pinError').style.display = 'block';
      document.getElementById('pinInput').value = '';
    }
  };

  document.getElementById('pinInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') window.checkPin();
  });

  // Holds latest checkins so export always has current data
  var latestCheckins = {};

  function initDashboard() {
    const grid = document.getElementById('dashboardGrid');

    MUSTER_LOCATIONS.forEach(function (loc) {
      const card = document.createElement('div');
      card.className = 'dash-card border-red';
      card.id        = 'card-' + loc.id;

      const empCount = getEmployeesByLocation(loc.id).length;

      card.innerHTML =
        '<div class="dash-card-header" onclick="toggleCard(\'' + loc.id + '\')">' +
          '<h3>' + loc.label + (loc.secondShift ? ' <span class="shift-badge">2nd Shift</span>' : '') + '</h3>' +
          '<div class="dash-coords">' + loc.coordinators.join(', ') + '</div>' +
          '<div class="dash-count"><span id="cnt-' + loc.id + '">0</span> / ' + empCount + '</div>' +
          '<div class="progress-bar-wrap">' +
            '<div class="progress-bar-fill" id="bar-' + loc.id + '" style="width:0%"></div>' +
          '</div>' +
        '</div>' +
        '<div class="dash-employee-list" id="list-' + loc.id + '"></div>';

      grid.appendChild(card);
    });

    // Update overall count now that EMPLOYEES is populated
    document.getElementById('overallCount').textContent = '0 / ' + EMPLOYEES.length;
    document.getElementById('overallBadge').textContent = '0 / ' + EMPLOYEES.length + ' Total';

    // ── Session Start / Stop / Reset ──
    var sessionBtn = document.getElementById('sessionBtn');
    var resetBtn   = document.getElementById('resetBtn');
    var exportBtn  = document.getElementById('exportBtn');

    function updateSessionBtn(active) {
      if (active) {
        sessionBtn.innerHTML   = '&#x23F9; Stop Session';
        sessionBtn.className   = 'btn btn-danger';
        resetBtn.style.display = 'none';
      } else {
        sessionBtn.innerHTML = '&#x25B6; Start Session';
        sessionBtn.className = 'btn btn-success';
      }
    }

    updateSessionBtn(!!getActiveSession());

    sessionBtn.addEventListener('click', function () {
      var current = getActiveSession();
      if (!current) {
        var id = startNewSession();
        updateSessionBtn(true);
        resetBtn.style.display = 'none';
        document.getElementById('activeDot').classList.add('active');
        document.getElementById('sessionStatus').textContent = 'Session started at ' + new Date().toLocaleTimeString();
        startListening(id);
        showToast('Session started \u2705');
      } else {
        db.ref('sessions/' + current + '/active').set(false);
        db.ref('sessions/' + current + '/endedAt').set(new Date().toISOString());
        sessionStorage.removeItem('musterSession');
        updateSessionBtn(false);
        document.getElementById('activeDot').classList.remove('active');
        document.getElementById('sessionStatus').textContent = 'No active session';
        resetBtn.style.display = 'inline-block';
        showToast('Session stopped \u23F9');
      }
    });

    // Reset button
    resetBtn.addEventListener('click', function () {
      if (!confirm('Reset all check-in data? This cannot be undone.')) return;
      db.ref('sessions').remove().then(function () {
        sessionStorage.removeItem('musterSession');
        listeningSession = null;
        latestCheckins   = {};
        updateAllCards({});
        resetBtn.style.display = 'none';
        document.getElementById('overallCount').textContent = '0 / ' + EMPLOYEES.length;
        document.getElementById('overallBadge').textContent = '0 / ' + EMPLOYEES.length + ' Total';
        document.getElementById('lastUpdated').textContent  = '';
        showToast('Check-in data reset \u2705');
      });
    });

    // ── Export to CSV ──
    exportBtn.addEventListener('click', function () {
      var checkins = latestCheckins;
      var now      = new Date();
      var dateStr  = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

      var rows = [
        ['Name', 'Worker ID', 'Position', 'Supervisory Org', 'Assigned Location', 'Status', 'Checked In At', 'Check-In Time']
      ];

      EMPLOYEES.forEach(function (emp) {
        var ci            = checkins[emp.workerId];
        var assignedLabel = getLocation(emp.assignedLocation) ? getLocation(emp.assignedLocation).label : emp.assignedLocation;
        var status, checkedAtLabel, checkTime;

        if (!ci) {
          status         = 'Not Checked In';
          checkedAtLabel = '';
          checkTime      = '';
        } else {
          var ciLoc      = getLocation(ci.location);
          checkedAtLabel = ciLoc ? ciLoc.label : ci.location;
          checkTime      = ci.timestamp ? new Date(ci.timestamp).toLocaleTimeString() : '';
          status         = ci.location === emp.assignedLocation ? 'Checked In' : 'Checked In (Walk-In)';
        }

        rows.push([
          emp.name,
          emp.workerId,
          emp.position,
          emp.supervisoryOrg,
          assignedLabel,
          status,
          checkedAtLabel,
          checkTime
        ]);
      });

      var csv = rows.map(function (row) {
        return row.map(function (cell) {
          var s = String(cell).replace(/"/g, '""');
          return '"' + s + '"';
        }).join(',');
      }).join('\n');

      var header = '"HMH Emergency Muster Report"\n"Generated: ' + dateStr + '"\n\n';
      var blob   = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
      var url    = URL.createObjectURL(blob);
      var a      = document.createElement('a');
      var fname  = 'muster-report-' + now.toISOString().slice(0, 10) + '.csv';
      a.href     = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV downloaded \u2705');
    });

    // Watch Firebase for active session
    db.ref('sessions').orderByChild('active').equalTo(true).limitToLast(1)
      .on('value', function (snap) {
        var val = snap.val();
        if (val) {
          var sessionId = Object.keys(val)[0];
          setActiveSession(sessionId);
          updateSessionBtn(true);
          document.getElementById('activeDot').classList.add('active');
          document.getElementById('sessionStatus').textContent = 'Session active since ' +
            new Date(val[sessionId].startedAt).toLocaleTimeString();
          startListening(sessionId);
        } else {
          updateSessionBtn(false);
          document.getElementById('activeDot').classList.remove('active');
          document.getElementById('sessionStatus').textContent = 'No active session';
        }
      });

    var session = getActiveSession();
    if (session) startListening(session);
  }

  var listeningSession = null;
  function startListening(sessionId) {
    if (listeningSession === sessionId) return;
    listeningSession = sessionId;

    db.ref('sessions/' + sessionId + '/checkins').on('value', function (snap) {
      var checkins   = snap.val() || {};
      latestCheckins = checkins;
      updateAllCards(checkins);
      document.getElementById('lastUpdated').textContent =
        'Last updated: ' + new Date().toLocaleTimeString();
    });
  }

  function updateAllCards(checkins) {
    var totalChecked = 0;
    var totalAll     = EMPLOYEES.length;

    MUSTER_LOCATIONS.forEach(function (loc) {
      var emps    = getEmployeesByLocation(loc.id);
      var checked = emps.filter(function (e) { return checkins[e.workerId]; }).length;
      var pct     = emps.length ? Math.round((checked / emps.length) * 100) : 0;

      totalChecked += checked;

      var cntEl = document.getElementById('cnt-' + loc.id);
      if (cntEl) cntEl.textContent = checked;

      var barEl = document.getElementById('bar-' + loc.id);
      if (barEl) barEl.style.width = pct + '%';

      var cardEl = document.getElementById('card-' + loc.id);
      if (cardEl) {
        cardEl.classList.remove('border-red', 'border-yellow', 'border-green');
        if (pct === 100)    cardEl.classList.add('border-green');
        else if (pct >= 50) cardEl.classList.add('border-yellow');
        else                cardEl.classList.add('border-red');
      }

      var listEl = document.getElementById('list-' + loc.id);
      if (listEl && listEl.classList.contains('open')) {
        renderLocationList(loc.id, emps, checkins, listEl);
      }
    });

    var overall = totalChecked + ' / ' + totalAll;
    document.getElementById('overallCount').textContent = overall;
    document.getElementById('overallBadge').textContent = overall + ' Total';
  }

  function renderLocationList(locationId, emps, checkins, container) {
    container.innerHTML = '';
    var sorted = emps.slice().sort(function (a, b) {
      return statusOrder(a, checkins, locationId) - statusOrder(b, checkins, locationId);
    });
    sorted.forEach(function (emp) {
      var ci     = checkins[emp.workerId];
      var status = ci ? (ci.location === locationId ? 'checked' : 'elsewhere') : 'unchecked';
      var extra  = '';
      if (status === 'elsewhere') {
        var ol = getLocation(ci.location);
        extra  = ' <span class="status-pill pill-blue" style="font-size:0.7rem">At ' + (ol ? ol.label : ci.location) + '</span>';
      } else if (status === 'checked') {
        extra = ' <span class="status-pill pill-green" style="font-size:0.7rem">&#x2705;</span>';
      } else {
        extra = ' <span class="status-pill pill-red" style="font-size:0.7rem">Not In</span>';
      }
      var row = document.createElement('div');
      row.className = 'dash-emp-row status-' + status;
      row.innerHTML = '<span><strong>' + emp.name + '</strong> &mdash; ' + emp.position + '</span>' + extra;
      container.appendChild(row);
    });
  }

  function statusOrder(emp, checkins, locationId) {
    var ci = checkins[emp.workerId];
    if (!ci) return 0;
    return ci.location === locationId ? 1 : 2;
  }

  window.toggleCard = function (locId) {
    var listEl = document.getElementById('list-' + locId);
    if (!listEl) return;
    var isOpen = listEl.classList.toggle('open');
    if (isOpen) {
      var session  = getActiveSession();
      var checkins = {};
      if (session) {
        db.ref('sessions/' + session + '/checkins').once('value', function (snap) {
          checkins = snap.val() || {};
          renderLocationList(locId, getEmployeesByLocation(locId), checkins, listEl);
        });
      } else {
        renderLocationList(locId, getEmployeesByLocation(locId), checkins, listEl);
      }
    }
  };

})();
