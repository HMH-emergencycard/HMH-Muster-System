(function () {

  // ========================================================
  // PIN Protection
  // TODO: Replace PIN and add proper manager auth when access list is confirmed
  // ========================================================
  const CORRECT_PIN = '1234';

  window.checkPin = function () {
    const val = document.getElementById('pinInput').value;
    if (val === CORRECT_PIN) {
      document.getElementById('pin-overlay').style.display = 'none';
      initDashboard();
    } else {
      document.getElementById('pinError').style.display = 'block';
      document.getElementById('pinInput').value = '';
    }
  };

  // Allow Enter key on PIN input
  document.getElementById('pinInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') window.checkPin();
  });

  function initDashboard() {
    const grid = document.getElementById('dashboardGrid');

    // Build a card per location
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

    // ── Session Start / Stop ──
    var sessionBtn = document.getElementById('sessionBtn');

    function updateSessionBtn(active) {
      if (active) {
        sessionBtn.innerHTML  = '&#x23F9; Stop Session';
        sessionBtn.className  = 'btn btn-danger';
      } else {
        sessionBtn.innerHTML  = '&#x25B6; Start Session';
        sessionBtn.className  = 'btn btn-success';
      }
    }

    // Reflect current state on load
    updateSessionBtn(!!getActiveSession());

    sessionBtn.addEventListener('click', function () {
      var current = getActiveSession();
      if (!current) {
        // Start new session
        var id = startNewSession();
        updateSessionBtn(true);
        document.getElementById('activeDot').classList.add('active');
        document.getElementById('sessionStatus').textContent = 'Session started at ' + new Date().toLocaleTimeString();
        startListening(id);
        showToast('Session started \u2705');
      } else {
        // Stop session
        db.ref('sessions/' + current + '/active').set(false);
        db.ref('sessions/' + current + '/endedAt').set(new Date().toISOString());
        sessionStorage.removeItem('musterSession');
        updateSessionBtn(false);
        document.getElementById('activeDot').classList.remove('active');
        document.getElementById('sessionStatus').textContent = 'No active session';
        showToast('Session stopped \u23F9');
      }
    });

    // Listen for active session in Firebase
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

    // Listen for current session if already active
    var session = getActiveSession();
    if (session) startListening(session);
  }

  var listeningSession = null;
  function startListening(sessionId) {
    if (listeningSession === sessionId) return;
    listeningSession = sessionId;

    db.ref('sessions/' + sessionId + '/checkins').on('value', function (snap) {
      var checkins = snap.val() || {};
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
        if (pct === 100)       cardEl.classList.add('border-green');
        else if (pct >= 50)    cardEl.classList.add('border-yellow');
        else                   cardEl.classList.add('border-red');
      }

      var listEl = document.getElementById('list-' + loc.id);
      if (listEl && listEl.classList.contains('open')) {
        renderLocationList(loc.id, emps, checkins, listEl);
      }
    });

    var overall = totalChecked + ' / ' + totalAll;
    document.getElementById('overallCount').textContent  = overall;
    document.getElementById('overallBadge').textContent  = overall + ' Total';
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
