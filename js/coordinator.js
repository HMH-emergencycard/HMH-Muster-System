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
      tbody.innerHTML = '<tr><td colspan="3" style="padding:16px;text-align:center;color:#e53935;">' +
        '&#x26A0; No roster loaded. Please <a href="admin-upload.html">upload the roster</a> first.' +
        '</td></tr>';
      return;
    }
    init();
  });

  function lastName(name) {
    var parts = (name || '').trim().split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  }

  function init() {
    var employees = getEmployeesByLocation(locationId);

    employees.sort(function (a, b) {
      return lastName(a.name).localeCompare(lastName(b.name));
    });

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
          startChatListener();
        }
      });

    // ── NFC ──
    var nfcBtn    = document.getElementById('nfcBtn');
    var nfcActive = false;
    nfcBtn.addEventListener('click', function () {
      if (!('NDEFReader' in window)) {
        showToast('NFC not supported on this device/browser. Use manual check-in.');
        return;
      }
      if (nfcActive) {
        nfcActive        = false;
        nfcBtn.innerHTML = '&#x1F4F1; Start NFC Scan';
        nfcBtn.className = 'btn btn-primary';
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

    // ── Contractor form ──
    var addBtn                 = document.getElementById('addContractorBtn');
    var contractorForm         = document.getElementById('contractorForm');
    var contractorNameInput    = document.getElementById('contractorName');
    var contractorCompanyInput = document.getElementById('contractorCompany');
    var contractorSubmit       = document.getElementById('contractorSubmit');
    var contractorCancel       = document.getElementById('contractorCancel');

    addBtn.addEventListener('click', function () {
      contractorForm.style.display = contractorForm.style.display === 'none' ? 'flex' : 'none';
      if (contractorForm.style.display === 'flex') contractorNameInput.focus();
    });
    contractorCancel.addEventListener('click', function () {
      contractorForm.style.display = 'none';
      contractorNameInput.value    = '';
      contractorCompanyInput.value = '';
    });
    contractorSubmit.addEventListener('click', function () {
      var name    = contractorNameInput.value.trim();
      var company = contractorCompanyInput.value.trim();
      if (!name) { showToast('Please enter a contractor name.'); return; }
      if (!getActiveSession()) { showToast('No active session. Ask your manager to start one.'); return; }
      var session = getActiveSession();
      var key     = 'contractor_' + Date.now();
      db.ref('sessions/' + session + '/checkins/' + key).set({
        name:             name,
        company:          company || 'Unknown Company',
        isContractor:     true,
        checkedInAt:      new Date().toISOString(),
        location:         locationId,
        assignedLocation: locationId,
        status:           'present'
      }).then(function () {
        showToast(name + ' (Contractor) checked in \u2705');
        contractorNameInput.value    = '';
        contractorCompanyInput.value = '';
        contractorForm.style.display = 'none';
      });
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

    if (getActiveSession()) {
      listenForCheckins();
      startChatListener();
    }

    // ── Check-in handler ──
    function handleCheckIn(workerId, status) {
      if (!getActiveSession()) { showToast('No active session. Ask your manager to start one.'); return; }
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
      var accounted = employees.filter(function (e) { return checkins[e.workerId]; }).length;
      document.getElementById('countBadge').textContent =
        accounted + ' / ' + employees.length + ' Accounted For';
    }

    // ── Render table ──
    function renderTable(checkins, filter) {
      filter = filter || '';
      var rows = [];

      if (filter.length >= 2) {
        var pool = EMPLOYEES.filter(function (e) {
          return e.name.toLowerCase().indexOf(filter) !== -1 ||
                 e.workerId.toLowerCase().indexOf(filter) !== -1;
        }).sort(function (a, b) {
          return lastName(a.name).localeCompare(lastName(b.name));
        });
        pool.forEach(function (emp) { rows.push(buildEmployeeRow(emp, checkins)); });

      } else {
        var notIn = employees.filter(function (e) { return !checkins[e.workerId]; });
        notIn.forEach(function (emp) { rows.push(buildEmployeeRow(emp, checkins)); });

        var checkedIn = employees.filter(function (e) { return !!checkins[e.workerId]; });
        checkedIn.sort(function (a, b) {
          return new Date(checkins[a.workerId].checkedInAt || 0) -
                 new Date(checkins[b.workerId].checkedInAt || 0);
        });
        checkedIn.forEach(function (emp) { rows.push(buildEmployeeRow(emp, checkins)); });

        var contractors = Object.entries(checkins)
          .filter(function (entry) {
            return entry[1].isContractor === true && entry[1].location === locationId;
          })
          .sort(function (a, b) {
            return new Date(a[1].checkedInAt || 0) - new Date(b[1].checkedInAt || 0);
          });
        contractors.forEach(function (entry) {
          var ci = entry[1];
          var tr = document.createElement('tr');
          tr.className = 'employee-row status-contractor';
          tr.innerHTML =
            '<td><strong>' + ci.name + '</strong> <small style="color:#e65100;">(Contractor &mdash; ' + ci.company + ')</small></td>' +
            '<td><span class="status-pill pill-orange">&#x1F477; Contractor</span></td>' +
            '<td></td>';
          rows.push(tr);
        });
      }

      tbody.innerHTML = '';
      if (rows.length === 0) {
        var empty = document.createElement('tr');
        empty.innerHTML = '<td colspan="3" style="padding:16px;text-align:center;color:#888;">No employees found</td>';
        tbody.appendChild(empty);
      } else {
        rows.forEach(function (tr) { tbody.appendChild(tr); });
      }
    }

    function buildEmployeeRow(emp, checkins) {
      var ci         = checkins[emp.workerId];
      var ciStatus   = ci ? ci.status : null;
      var atLocation = ci ? ci.location === locationId : false;
      var isWalkIn   = emp.assignedLocation !== locationId;
      var assignedLbl = isWalkIn
        ? ' <small style="color:#888;">(Assigned: ' + (getLocation(emp.assignedLocation) ? getLocation(emp.assignedLocation).label : emp.assignedLocation) + ')</small>'
        : '';
      var pillHtml = '', statusClass = '', actionBtn = '';
      if (!ci) {
        pillHtml    = '<span class="status-pill pill-red">Not In</span>';
        statusClass = 'status-unchecked';
        actionBtn   =
          '<button class="btn btn-success" style="padding:5px 10px;font-size:0.8rem;margin-right:4px" onclick="doCheckIn(\'' + emp.workerId + '\',\'present\',event)">&#x2705; Check In</button>' +
          '<button class="btn btn-offsite" style="padding:5px 10px;font-size:0.8rem;" onclick="doCheckIn(\'' + emp.workerId + '\',\'offsite\',event)">&#x1F3E0; Off-Site</button>';
      } else if (ciStatus === 'offsite') {
        pillHtml    = '<span class="status-pill pill-purple">&#x1F3E0; Off-Site</span>';
        statusClass = 'status-offsite';
        actionBtn   = '<button class="btn btn-success" style="padding:5px 10px;font-size:0.8rem;" onclick="doCheckIn(\'' + emp.workerId + '\',\'present\',event)">&#x2705; Move to Present</button>';
      } else if (ciStatus === 'present' && atLocation) {
        pillHtml    = '<span class="status-pill pill-green">&#x2705; Checked In</span>';
        statusClass = 'status-checked';
        actionBtn   = '';
      } else {
        var atLbl = getLocation(ci.location) ? getLocation(ci.location).label : ci.location;
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
      return tr;
    }

    window.doCheckIn = function (workerId, status, event) {
      if (event) event.stopPropagation();
      handleCheckIn(workerId, status);
    };

    renderTable({});
    updateCount({});

    // ════════════════════════════════════════════
    // TOOLBAR CHAT
    // Toggle wired immediately — NO session required
    // Firebase listener started only once session is available
    // ════════════════════════════════════════════
    var chatToggle  = document.getElementById('chatToolbarBtn');
    var chatPanel   = document.getElementById('chatToolbarPanel');
    var chatInput   = document.getElementById('chat-input-toolbar');
    var chatSend    = document.getElementById('chat-send-toolbar');
    var chatBadge   = document.getElementById('chat-unread-toolbar');
    var chatMsgList = document.getElementById('chat-msgs-toolbar');

    // Wire toggle immediately
    if (chatToggle && chatPanel) {
      chatToggle.addEventListener('click', function () {
        chatPanel.classList.toggle('open');
        if (chatPanel.classList.contains('open')) {
          if (chatBadge) { chatBadge.textContent = ''; chatBadge.classList.remove('visible'); }
          chatToggle.classList.remove('has-unread');
          if (chatMsgList) chatMsgList.scrollTop = chatMsgList.scrollHeight;
          if (chatInput) chatInput.focus();
        }
      });
    }

    // Wire send button immediately
    function doSendChat() {
      var text = chatInput ? chatInput.value.trim() : '';
      if (!text) return;
      if (!getActiveSession()) { showToast('No active session — cannot send message.'); return; }
      sendChatMessage(locationId, loc.label, 'location', text)
        .then(function () { if (chatInput) chatInput.value = ''; })
        .catch(function (err) { showToast('Could not send: ' + err.message); });
    }
    if (chatSend) chatSend.addEventListener('click', doSendChat);
    if (chatInput) chatInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSendChat(); });

    // Start Firebase listener — only once session exists
    var chatListening = false;
    function startChatListener() {
      if (chatListening) return;
      chatListening = true;
      var lastSeenCount = 0;
      listenChatMessages(locationId, function (msgs) {
        if (!chatMsgList) return;
        chatMsgList.innerHTML = '';
        if (msgs.length === 0) {
          chatMsgList.innerHTML = '<div class="chat-empty">No messages yet</div>';
        } else {
          msgs.forEach(function (m) {
            var bubble = document.createElement('div');
            bubble.className = 'chat-msg ' + (m.senderType === 'manager' ? 'from-manager' : 'from-location');
            bubble.innerHTML =
              '<div class="chat-sender">' + m.sender + '</div>' +
              '<div>' + escapeHtml(m.text) + '</div>' +
              '<div class="chat-time">' + formatChatTime(m.ts) + '</div>';
            chatMsgList.appendChild(bubble);
          });
        }
        if (chatPanel && chatPanel.classList.contains('open')) {
          chatMsgList.scrollTop = chatMsgList.scrollHeight;
          lastSeenCount = msgs.length;
        } else {
          var incoming = msgs.filter(function (m) { return m.senderType === 'manager'; });
          if (incoming.length > lastSeenCount) {
            if (chatBadge) { chatBadge.textContent = incoming.length - lastSeenCount; chatBadge.classList.add('visible'); }
            if (chatToggle) chatToggle.classList.add('has-unread');
          }
        }
      });
    }

  }

})();
