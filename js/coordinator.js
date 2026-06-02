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

  // Employees for this location
  const employees = getEmployeesByLocation(locationId);

  // Session button
  document.getElementById('sessionBtn').addEventListener('click', function () {
    const id = startNewSession();
    showToast('New session started: ' + id);
    renderTable({});
    document.getElementById('sessionBtn').textContent = '&#x23F9; Session Active';
    document.getElementById('sessionBtn').className = 'btn btn-danger';
  });

  // Ensure a session exists
  if (!getActiveSession()) {
    showToast('Tap "Start Session" to begin check-in.');
  }

  // NFC
  const nfcBtn = document.getElementById('nfcBtn');
  let nfcActive = false;
  let nfcReader  = null;

  nfcBtn.addEventListener('click', function () {
    if (!('NDEFReader' in window)) {
      showToast('NFC not supported on this device/browser. Use manual check-in.');
      return;
    }
    if (nfcActive) {
      nfcActive = false;
      nfcBtn.textContent = '&#x1F4F1; Start NFC Scan';
      nfcBtn.className   = 'btn btn-primary';
      return;
    }
    nfcActive = true;
    nfcBtn.textContent = '&#x1F4F1; Stop NFC Scan';
    nfcBtn.className   = 'btn btn-danger';

    nfcReader = new NDEFReader();
    nfcReader.scan().then(function () {
      nfcReader.onreading = function (event) {
        for (const record of event.message.records) {
          if (record.recordType === 'url') {
            const url    = new TextDecoder().decode(record.data);
            const urlObj = new URL(url);
            const wid    = urlObj.searchParams.get('id');
            if (wid) {
              handleCheckIn(wid);
              return;
            }
          }
        }
        showToast('Could not read Worker ID from NFC tag.');
      };
    }).catch(function (err) {
      showToast('NFC error: ' + err.message);
      nfcActive = false;
      nfcBtn.textContent = '&#x1F4F1; Start NFC Scan';
      nfcBtn.className   = 'btn btn-primary';
    });
  });

  // Manual check-in via search
  document.getElementById('searchBox').addEventListener('input', function () {
    renderTable(currentCheckins, this.value.trim().toLowerCase());
  });

  // Track checkins
  var currentCheckins = {};

  onCheckinsUpdate(function (checkins) {
    currentCheckins = checkins || {};
    renderTable(currentCheckins, document.getElementById('searchBox').value.trim().toLowerCase());
    updateCount(currentCheckins);
  });

  function handleCheckIn(workerId) {
    if (!getActiveSession()) {
      showToast('No active session. Tap "Start Session" first.');
      return;
    }
    const emp = getEmployeeById(workerId);
    if (!emp) { showToast('Employee not found: ' + workerId); return; }
    checkInEmployee(workerId, locationId).then(function () {
      showToast(emp.name + ' checked in \u2705');
      flashRow(workerId);
    });
  }

  function flashRow(workerId) {
    const row = document.getElementById('row-' + workerId);
    if (row) {
      row.classList.add('flash-green');
      setTimeout(function () { row.classList.remove('flash-green'); }, 700);
    }
  }

  function updateCount(checkins) {
    const checkedIn = employees.filter(function (e) {
      return checkins[e.workerId];
    }).length;
    document.getElementById('countBadge').textContent = checkedIn + ' / ' + employees.length + ' Accounted For';
  }

  function renderTable(checkins, filter) {
    filter = filter || '';
    const tbody = document.getElementById('employeeBody');
    tbody.innerHTML = '';

    // Sort: unchecked first, checked at this location, checked elsewhere
    const sorted = employees.slice().sort(function (a, b) {
      return statusOrder(a, checkins) - statusOrder(b, checkins);
    });

    sorted.forEach(function (emp) {
      if (filter && emp.name.toLowerCase().indexOf(filter) === -1 &&
          emp.workerId.toLowerCase().indexOf(filter) === -1) return;

      const ci     = checkins[emp.workerId];
      const status = ci ? (ci.location === locationId ? 'checked' : 'elsewhere') : 'unchecked';
      const locLbl = status === 'elsewhere' ? getLocationLabel(ci.location) : '';

      let pillHtml = '';
      let statusClass = '';
      if (status === 'unchecked') {
        pillHtml    = '<span class="status-pill pill-red">Not In</span>';
        statusClass = 'status-unchecked';
      } else if (status === 'checked') {
        pillHtml    = '<span class="status-pill pill-green">&#x2705; Checked In</span>';
        statusClass = 'status-checked';
      } else {
        pillHtml    = '<span class="status-pill pill-blue">At ' + locLbl + '</span>';
        statusClass = 'status-elsewhere';
      }

      const tr = document.createElement('tr');
      tr.id        = 'row-' + emp.workerId;
      tr.className = 'employee-row ' + statusClass;
      tr.innerHTML =
        '<td><strong>' + emp.name + '</strong><br><small>' + emp.workerId + '</small></td>' +
        '<td>' + emp.position + '</td>' +
        '<td>' + emp.supervisoryOrg + '</td>' +
        '<td>' + pillHtml + '</td>';

      // Tap to check in manually
      tr.addEventListener('click', function () {
        if (status === 'unchecked') handleCheckIn(emp.workerId);
      });

      tbody.appendChild(tr);
    });
  }

  function statusOrder(emp, checkins) {
    const ci = checkins[emp.workerId];
    if (!ci) return 0;
    return ci.location === locationId ? 1 : 2;
  }

  function getLocationLabel(locId) {
    const l = getLocation(locId);
    return l ? l.label : locId;
  }

  // Initial render
  renderTable({});
})();
