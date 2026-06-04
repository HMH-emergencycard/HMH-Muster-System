(function () {
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

  document.title = 'Muster ' + loc.label;
  document.getElementById('locationTitle').innerHTML =
    loc.label + (loc.secondShift ? ' <span class="shift-badge">2nd Shift</span>' : '');
  document.getElementById('coordinatorNames').textContent =
    'Coordinators: ' + loc.coordinators.join(', ');

  var tbody = document.getElementById('employeeBody');
  tbody.innerHTML = '<tr><td colspan="3" style="padding:16px;text-align:center;color:#888;">&#x23F3; Loading roster...</td></tr>';

  onRosterReady(function () {
    if (EMPLOYEES.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="padding:16px;text-align:center;color:#e53935;">'
        + '&#x26A0; No roster loaded. Please <a href="admin-upload.html">upload the roster</a> first.'
        + '</td></tr>';
      return;
    }
    init();
  });

  function init() {
    var employees = getEmployeesByLocation(locationId);

    function checkSessionBanner() {
      var banner = document.getElementById('noSessionBanner');
      if (banner) banner.style.display = getActiveSession() ? 'none' : 'block';
    }
    checkSessionBanner();
    setInterval(checkSessionBanner, 5000);

    db.ref('sessions').orderByChild('active').equalTo(true).limitToLast(1)
      .on('value', function (snap) {
        var val = snap.val();
        if (val) {
          var sessionId = Object.keys(val)[0];
          setActiveSession(sessionId);
          checkSessionBanner();
          listenForCheckins();
        }
      });

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
      nfcActive        = true;
      nfcBtn.innerHTML = '&#x1F4F1; Stop NFC Scan';
      nfcBtn.className = 'btn btn-danger';
      var reader = new NDEFReader();
      reader.scan().then(function () {
        reader.onreading = function (event) {
          for (var i = 0; i < event.message.records.length; i++) {
            var record = event.message.records[i];
            if (record.recordType === 'url') {
              var url    = new TextDecoder().decode(record.data);
              var urlObj = new URL(url);
              var wid    = urlObj.searchParams.get('id');
              if (wid) { handleCheckIn(wid, 'present'); return; }
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
    document.getElementById('searchBox').addEventListener('input', function () {
      renderTable(currentCheckins, this.value.trim().toLowerCase());
    });

    // ── Live checkin listener ──
    var currentCheckins = {};
    var listening       = false;

    function listenForCheckins() {
      if (listening) return;
      listening = true;
      onCheckinsUpdate(function (checkins) {
        currentCheckins = checkins || {};
        renderTable(currentCheckins, document.getElementById('searchBox').value.trim().toLowerCase());
        updateCount(currentCheckins);
      });
    }

    if (getActiveSession()) listenForCheckins();

    // ── Check-in handler ──
    function handleCheckIn(workerId, status) {
      if (!getActiveSession()) {
        showToast('No active session. Ask your manager to start one.');
        return;
      }
      var emp = getEmployeeById(workerId);
      if (!emp) { showToast('Employee not found: ' + workerId); return; }

      checkInEmployee(workerId, locationId, status).then(function () {
        var label = status === 'offsite' ? ' marked Off-Site \uD83C\uDFE0' : ' checked in \u2705';
        var note  = emp.assignedLocation !== locationId
          ? ' (from ' + (getLocation(emp.assignedLocation) ? getLocation(emp.assignedLocation).label : emp.assignedLocation) + ')'
          : '';
        showToast(emp.name + note + label);
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
      // Count both present AND offsite as accounted for
      var accounted = employees.filter(function (e) { return checkins[e.workerId]; }).length;
      document.getElementById('countBadge').textContent =
        accounted + ' / ' + employees.length + ' Accounted For';
    }

    // ── Render table ──
    function renderTable(checkins, filter) {
      filter = filter || '';
      tbody.innerHTML = '';

      var pool;
      if (filter.length >= 2) {
        pool = EMPLOYEES.filter(function (e) {
          return e.name.toLowerCase().indexOf(filter) !== -1 ||
                 e.workerId.toLowerCase().indexOf(filter) !== -1;
        });
      } else {
        pool = employees.slice().sort(function (a, b) {
          return statusOrder(a, checkins) - statusOrder(b, checkins);
        });
      }

      if (pool.length === 0) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="3" style="padding:16px;text-align:center;color:#888;">No employees found</td>';
        tbody.appendChild(tr);
        return;
      }

      pool.forEach(function (emp) {
        var ci          = checkins[emp.workerId];
        var ciStatus    = ci ? ci.status : null;  // 'present', 'offsite', or null
        var atLocation  = ci ? ci.location === locationId : false;
        var isWalkIn    = emp.assignedLocation !== locationId;
        var assignedLbl = isWalkIn
          ? ' <small style="color:#888;">(Assigned: ' + (getLocation(emp.assignedLocation) ? getLocation(emp.assignedLocation).label : emp.assignedLocation) + ')</small>'
          : '';

        var pillHtml = '', statusClass = '', actionBtn = '';

        if (!ci) {
          // Not checked in at all
          pillHtml    = '<span class="status-pill pill-red">Not In</span>';
          statusClass = 'status-unchecked';
          actionBtn   =
            '<button class="btn btn-success" style="padding:5px 10px;font-size:0.8rem;margin-right:4px" onclick="doCheckIn(\'' + emp.workerId + '\',\'present\',event)">&#x2705; Check In</button>' +
            '<button class="btn btn-offsite" style="padding:5px 10px;font-size:0.8rem;" onclick="doCheckIn(\'' + emp.workerId + '\',\'offsite\',event)">&#x1F3E0; Off-Site</button>';
        } else if (ciStatus === 'offsite') {
          pillHtml    = '<span class="status-pill pill-purple">&#x1F3E0; Off-Site</span>';
          statusClass = 'status-offsite';
          actionBtn   =
            '<button class="btn btn-success" style="padding:5px 10px;font-size:0.8rem;" onclick="doCheckIn(\'' + emp.workerId + '\',\'present\',event)">&#x2705; Move to Present</button>';
        } else if (ciStatus === 'present' && atLocation) {
          pillHtml    = '<span class="status-pill pill-green">&#x2705; Checked In</span>';
          statusClass = 'status-checked';
          actionBtn   = '';
        } else {
          // Present but at a different location
          var atLbl   = getLocation(ci.location) ? getLocation(ci.location).label : ci.location;
          pillHtml    = '<span class="status-pill pill-blue">At ' + atLbl + '</span>';
          statusClass = 'status-elsewhere';
          actionBtn   =
            '<button class="btn btn-primary" style="padding:5px 10px;font-size:0.8rem;margin-right:4px" onclick="doCheckIn(\'' + emp.workerId + '\',\'present\',event)">Move Here</button>' +
            '<button class="btn btn-offsite" style="padding:5px 10px;font-size:0.8rem;" onclick="doCheckIn(\'' + emp.workerId + '\',\'offsite\',event)">&#x1F3E0; Off-Site</button>';
        }

        var tr       = document.createElement('tr');
        tr.id        = 'row-' + emp.workerId;
        tr.className = 'employee-row ' + statusClass;
        tr.innerHTML =
          '<td><strong>' + emp.name + '</strong>' + assignedLbl + '</td>' +
          '<td>' + pillHtml + '</td>' +
          '<td>' + actionBtn + '</td>';
        tbody.appendChild(tr);
      });
    }

    window.doCheckIn = function (workerId, status, event) {
      if (event) event.stopPropagation();
      handleCheckIn(workerId, status);
    };

    function statusOrder(emp, checkins) {
      var ci = checkins[emp.workerId];
      if (!ci) return 0;
      if (ci.status === 'offsite') return 2;
      return ci.location === locationId ? 3 : 1;
    }

    renderTable({});
    updateCount({});
  }

})();
