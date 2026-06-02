(function () {
  // Read location ID from URL query string
  const params     = new URLSearchParams(window.location.search);
  const locationId = params.get('location');

  if (!locationId) {
    document.getElementById('locationTitle').textContent = 'Unknown Location';
    return;
  }

  const loc = getLocation(locationId);
  if (!loc) {
    document.getElementById('locationTitle').textContent = 'Location Not Found';
    return;
  }

  // Set header
  document.title = 'Muster ' + loc.label;
  document.getElementById('locationTitle').innerHTML =
    loc.label + (loc.secondShift ? ' <span class="shift-badge">2nd Shift</span>' : '');
  document.getElementById('coordinatorNames').textContent =
    'Coordinators: ' + loc.coordinators.join(', ');

  // Employees assigned to THIS location
  const employees = getEmployeesByLocation(locationId);

  // ── Session Start / Stop ──
  var sessionActive = !!getActiveSession();

  function updateSessionBtn() {
    var btn = document.getElementById('sessionBtn');
    if (sessionActive) {
      btn.innerHTML  = '&#x23F9; Stop Session';
      btn.className  = 'btn btn-danger';
    } else {
      btn.innerHTML  = '&#x25B6; Start Session';
      btn.className  = 'btn btn-success';
    }
  }

  updateSessionBtn();

  document.getElementById('sessionBtn').addEventListener('click', function () {
    if (!sessionActive) {
      // Start
      var id = startNewSession();
      sessionActive = true;
      updateSessionBtn();
      showToast('Session started \u2705');
      renderTable({});
      listenForCheckins();
    } else {
      // Stop
      var current = getActiveSession();
      if (current) {
        db.ref('sessions/' + current + '/active').set(false);
        db.ref('sessions/' + current + '/endedAt').set(new Date().toISOString());
      }
      sessionStorage.removeItem('musterSession');
      sessionActive = false;
      updateSessionBtn();
      showToast('Session stopped \u23F9');
    }
  });

  // Ensure session state is shown on load
  if (!getActiveSession()) {
    showToast('Tap "Start Session" to begin check-in.');
  } else {
    listenForCheckins();
  }

  // ── NFC ──
  const nfcBtn  = document.getElementById('nfcBtn');
  var nfcActive = false;

  nfcBtn.addEventListener('click', function () {
    if (!('NDEFReader' in window)) {
      showToast('NFC not supported on this device/browser. Use manual check-in.');
      return;
    }
    if (nfcActive) {
      nfcActive          = false;
      nfcBtn.innerHTML   = '&#x1F4F1; Start NFC Scan';
      nfcBtn.className   = 'btn btn-primary';
      return;
    }
    nfcActive          = true;
    nfcBtn.innerHTML   = '&#x1F4F1; Stop NFC Scan';
    nfcBtn.className   = 'btn btn-danger';

    var reader = new NDEFReader();
    reader.scan().then(function () {
      reader.onreading = function (event) {
        for (var i = 0; i < event.message.records.length; i++) {
          var record = event.message.records[i];
          if (record.recordType === 'url') {
            var url    = new TextDecoder().decode(record.data);
            var urlObj = new URL(url);
            var wid    = urlObj.searchParams.get('id');
            if (wid) { handleCheckIn(wid); return; }
          }
        }
        showToast('Could not read Worker ID from NFC tag.');
      };
    }).catch(function (err) {
      showToast('NFC error: ' + err.message);
      nfcActive        = false;
      nfcBtn.innerHTML = '&#x1F4F1; Start NFC Scan';
      nfcBtn.className = 'btn btn-primary';
    });
  });

  // ── Search box ──
  // Searches ALL employees (not just this location) so walk-ins can be checked in here
  document.getElementById('searchBox').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    renderTable(currentCheckins, q);
  });

  // ── Live checkin listener ──
  var currentCheckins = {};
  var listening       = false;

  function listenForCheckins() {
    if (listening) return;
    listening = true;
    onCheckinsUpdate(function (checkins) {
      currentCheckins = checkins || {};
      var q = document.getElementById('searchBox').value.trim().toLowerCase();
      renderTable(currentCheckins, q);
      updateCount(currentCheckins);
    });
  }

  // ── Check-in handler ──
  function handleCheckIn(workerId) {
    if (!getActiveSession()) {
      showToast('No active session. Tap "Start Session" first.');
      return;
    }
    var emp = getEmployeeById(workerId);
    if (!emp) { showToast('Employee not found: ' + workerId); return; }

    checkInEmployee(workerId, locationId).then(function () {
      var note = emp.assignedLocation !== locationId
        ? ' (from ' + (getLocation(emp.assignedLocation) ? getLocation(emp.assignedLocation).label : emp.assignedLocation) + ')'
        : '';
      showToast(emp.name + note + ' checked in \u2705');
      flashRow(workerId);
    });
  }

  function flashRow(workerId) {
    var row = document.getElementById('row-' + workerId);
    if (row) {
      row.classList.add('flash-green');
      setTimeout(function () { row.classList.remove('flash-green'); }, 700);
    }
  }

  function updateCount(checkins) {
    var checkedIn = employees.filter(function (e) { return checkins[e.workerId]; }).length;
    document.getElementById('countBadge').textContent =
      checkedIn + ' / ' + employees.length + ' Accounted For';
  }

  // ── Render table ──
  // When search is active: show ALL employees matching the query (walk-ins included)
  // When no search: show only this location's employees
  function renderTable(checkins, filter) {
    filter = filter || '';
    var tbody = document.getElementById('employeeBody');
    tbody.innerHTML = '';

    // Decide which employee list to show
    var pool;
    if (filter.length >= 2) {
      // Search all employees so coordinators can find walk-ins from other locations
      pool = EMPLOYEES.filter(function (e) {
        return e.name.toLowerCase().indexOf(filter) !== -1 ||
               e.workerId.toLowerCase().indexOf(filter) !== -1;
      });
    } else {
      // Default: only this location's employees, sorted unchecked first
      pool = employees.slice().sort(function (a, b) {
        return statusOrder(a, checkins) - statusOrder(b, checkins);
      });
    }

    if (pool.length === 0) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5" style="padding:16px;text-align:center;color:#888;">No employees found</td>';
      tbody.appendChild(tr);
      return;
    }

    pool.forEach(function (emp) {
      var ci          = checkins[emp.workerId];
      var status      = ci ? (ci.location === locationId ? 'checked' : 'elsewhere') : 'unchecked';
      var isWalkIn    = emp.assignedLocation !== locationId;
      var assignedLbl = isWalkIn
        ? ' <small style="color:#888;">(Assigned: ' + (getLocation(emp.assignedLocation) ? getLocation(emp.assignedLocation).label : emp.assignedLocation) + ')</small>'
        : '';

      var pillHtml = '', statusClass = '', actionBtn = '';

      if (status === 'unchecked') {
        pillHtml    = '<span class="status-pill pill-red">Not In</span>';
        statusClass = 'status-unchecked';
        actionBtn   = '<button class="btn btn-success" style="padding:5px 12px;font-size:0.8rem;" onclick="doCheckIn(\'' + emp.workerId + '\',event)">Check In Here</button>';
      } else if (status === 'checked') {
        pillHtml    = '<span class="status-pill pill-green">&#x2705; Checked In</span>';
        statusClass = 'status-checked';
        actionBtn   = '';
      } else {
        var atLbl   = getLocation(ci.location) ? getLocation(ci.location).label : ci.location;
        pillHtml    = '<span class="status-pill pill-blue">At ' + atLbl + '</span>';
        statusClass = 'status-elsewhere';
        actionBtn   = '<button class="btn btn-primary" style="padding:5px 12px;font-size:0.8rem;" onclick="doCheckIn(\'' + emp.workerId + '\',event)">Move Here</button>';
      }

      var tr       = document.createElement('tr');
      tr.id        = 'row-' + emp.workerId;
      tr.className = 'employee-row ' + statusClass;
      tr.innerHTML =
        '<td><strong>' + emp.name + '</strong>' + assignedLbl + '<br><small>' + emp.workerId + '</small></td>' +
        '<td>' + emp.position + '</td>' +
        '<td>' + emp.supervisoryOrg + '</td>' +
        '<td>' + pillHtml + '</td>' +
        '<td>' + actionBtn + '</td>';

      tbody.appendChild(tr);
    });
  }

  // Exposed globally so inline onclick works
  window.doCheckIn = function (workerId, event) {
    if (event) event.stopPropagation();
    handleCheckIn(workerId);
  };

  function statusOrder(emp, checkins) {
    var ci = checkins[emp.workerId];
    if (!ci) return 0;
    return ci.location === locationId ? 1 : 2;
  }

  // Initial render
  renderTable({});
})();
