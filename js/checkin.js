(function () {

  var params     = new URLSearchParams(window.location.search);
  var locationId = params.get('location');

  if (!locationId) {
    document.getElementById('locationTitle').textContent = 'Unknown Location';
    return;
  }

  var loc = getLocation(locationId);
  if (!loc) {
    document.getElementById('locationTitle').textContent = 'Location Not Found';
    return;
  }

  document.title = 'Check-In \u2014 ' + loc.label;
  document.getElementById('locationTitle').innerHTML =
    loc.label + (loc.secondShift ? ' <span class="shift-badge">2nd Shift</span>' : '');
  document.getElementById('coordinatorNames').textContent =
    'Coordinators: ' + loc.coordinators.join(', ');

  var wrap = document.getElementById('empListWrap');
  wrap.innerHTML = '<div class="empty-msg">&#x23F3; Loading roster&hellip;</div>';

  onRosterReady(function () {
    if (EMPLOYEES.length === 0) {
      wrap.innerHTML = '<div class="empty-msg">&#x26A0; No roster loaded. Please ask your coordinator.</div>';
      return;
    }
    init();
  });

  function lastName(name) {
    var parts = (name || '').trim().split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  }

  function init() {
    var employees = getEmployeesByLocation(locationId).slice().sort(function (a, b) {
      return lastName(a.name).localeCompare(lastName(b.name));
    });

    // ── Session banner ──
    function refreshBanner() {
      var banner = document.getElementById('noSessionBanner');
      if (banner) banner.style.display = getActiveSession() ? 'none' : 'block';
    }
    refreshBanner();

    db.ref('sessions').orderByChild('active').equalTo(true).limitToLast(1)
      .on('value', function (snap) {
        var val = snap.val();
        if (val) {
          var sessionId = Object.keys(val)[0];
          setActiveSession(sessionId);
          refreshBanner();
          listenForCheckins();
          initToolbarChat();
        } else {
          refreshBanner();
        }
      });

    // ── Contractor form ──
    var addBtn    = document.getElementById('addContractorBtn');
    var ctForm    = document.getElementById('contractorForm');
    var ctName    = document.getElementById('contractorName');
    var ctCompany = document.getElementById('contractorCompany');
    var ctSubmit  = document.getElementById('contractorSubmit');
    var ctCancel  = document.getElementById('contractorCancel');

    addBtn.addEventListener('click', function () {
      ctForm.style.display = ctForm.style.display === 'none' ? 'block' : 'none';
      if (ctForm.style.display !== 'none') ctName.focus();
    });
    ctCancel.addEventListener('click', function () {
      ctForm.style.display = 'none';
      ctName.value = ''; ctCompany.value = '';
    });
    ctSubmit.addEventListener('click', function () {
      var name    = ctName.value.trim();
      var company = ctCompany.value.trim();
      if (!name) { showToast('Please enter a name.'); return; }
      if (!getActiveSession()) { showToast('No active session. Ask your coordinator to start one.'); return; }
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
        ctName.value = ''; ctCompany.value = '';
        ctForm.style.display = 'none';
      });
    });

    // ── Search ──
    document.getElementById('searchBox').addEventListener('input', function () {
      render(currentCheckins, this.value.trim().toLowerCase());
    });

    // ── Live checkins ──
    var currentCheckins = {};
    var listening = false;

    function listenForCheckins() {
      if (listening) return;
      listening = true;
      onCheckinsUpdate(function (checkins) {
        currentCheckins = checkins || {};
        render(currentCheckins, document.getElementById('searchBox').value.trim().toLowerCase());
        updateCount(currentCheckins);
      });
    }

    if (getActiveSession()) {
      listenForCheckins();
      initToolbarChat();
    }

    // ── Check-in handler ──
    window.doCheckIn = function (workerId, status) {
      if (!getActiveSession()) {
        showToast('No active session. Ask your coordinator to start one.');
        return;
      }
      var emp = getEmployeeById(workerId);
      if (!emp) { showToast('Employee not found.'); return; }
      checkInEmployee(workerId, locationId, status).then(function () {
        var label = status === 'offsite' ? ' marked Off-Site \uD83C\uDFE0' : ' checked in \u2705';
        showToast(emp.name + label);
      });
    };

    function updateCount(checkins) {
      var accounted = employees.filter(function (e) { return !!checkins[e.workerId]; }).length;
      document.getElementById('countBadge').textContent = accounted + ' / ' + employees.length;
    }

    // ── Render ──
    function render(checkins, filter) {
      filter = filter || '';
      wrap.innerHTML = '';

      var pool = filter.length >= 2
        ? employees.filter(function (e) {
            return e.name.toLowerCase().indexOf(filter) !== -1;
          })
        : employees;

      if (pool.length === 0) {
        wrap.innerHTML = '<div class="empty-msg">No employees found for &ldquo;' + filter + '&rdquo;</div>';
        return;
      }

      if (filter.length < 2) {
        var notIn     = pool.filter(function (e) { return !checkins[e.workerId]; });
        var checkedIn = pool.filter(function (e) { return !!checkins[e.workerId]; });

        if (notIn.length > 0) {
          var lbl = document.createElement('div');
          lbl.className = 'section-label';
          lbl.textContent = 'Not Yet Checked In (' + notIn.length + ')';
          wrap.appendChild(lbl);
          var list = document.createElement('div');
          list.className = 'emp-card-list';
          notIn.forEach(function (emp) { list.appendChild(buildCard(emp, checkins)); });
          wrap.appendChild(list);
        }

        if (checkedIn.length > 0) {
          var lbl2 = document.createElement('div');
          lbl2.className = 'section-label';
          lbl2.textContent = 'Accounted For (' + checkedIn.length + ')';
          wrap.appendChild(lbl2);
          var list2 = document.createElement('div');
          list2.className = 'emp-card-list';
          checkedIn.sort(function (a, b) {
            return new Date(checkins[a.workerId].checkedInAt || 0) -
                   new Date(checkins[b.workerId].checkedInAt || 0);
          });
          checkedIn.forEach(function (emp) { list2.appendChild(buildCard(emp, checkins)); });
          wrap.appendChild(list2);
        }

        var contractors = Object.entries(checkins).filter(function (e) {
          return e[1].isContractor && e[1].location === locationId;
        });
        if (contractors.length > 0) {
          var lbl3 = document.createElement('div');
          lbl3.className = 'section-label';
          lbl3.textContent = 'Contractors (' + contractors.length + ')';
          wrap.appendChild(lbl3);
          var list3 = document.createElement('div');
          list3.className = 'emp-card-list';
          contractors.forEach(function (entry) {
            var ci = entry[1];
            var card = document.createElement('div');
            card.className = 'emp-card card-contractor';
            card.innerHTML =
              '<div class="emp-card-info">' +
                '<div class="emp-card-name">&#x1F477; ' + ci.name + '</div>' +
                '<div class="emp-card-pos">' + (ci.company || 'Unknown Company') + '</div>' +
              '</div>' +
              '<div class="done-badge">&#x2705; Checked In</div>';
            list3.appendChild(card);
          });
          wrap.appendChild(list3);
        }

      } else {
        var list4 = document.createElement('div');
        list4.className = 'emp-card-list';
        pool.forEach(function (emp) { list4.appendChild(buildCard(emp, checkins)); });
        wrap.appendChild(list4);
      }
    }

    function buildCard(emp, checkins) {
      var ci       = checkins[emp.workerId];
      var status   = !ci ? 'unchecked'
                   : ci.status === 'offsite' ? 'offsite'
                   : ci.location === locationId ? 'checked'
                   : 'elsewhere';

      var card = document.createElement('div');
      card.id  = 'card-' + emp.workerId;

      var actionsHtml = '';
      var badgeHtml   = '';
      var cardClass   = 'emp-card ';

      if (status === 'unchecked') {
        cardClass += 'card-unchecked';
        actionsHtml =
          '<button class="btn-checkin" onclick="doCheckIn(\'' + emp.workerId + '\',\'present\')">&#x2705; Check In</button>' +
          '<button class="btn-offsite" onclick="doCheckIn(\'' + emp.workerId + '\',\'offsite\')">&#x1F3E0;</button>';
      } else if (status === 'checked') {
        cardClass += 'card-checked';
        badgeHtml = '<div class="done-badge">&#x2705; Checked In<br><small style="font-weight:normal;color:#888;">' +
          (ci.checkedInAt ? new Date(ci.checkedInAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '') +
          '</small></div>';
      } else if (status === 'offsite') {
        cardClass += 'card-offsite';
        badgeHtml = '<div class="offsite-badge">&#x1F3E0; Off-Site</div>';
        actionsHtml = '<button class="btn-checkin" style="font-size:0.8rem;padding:8px 10px;" onclick="doCheckIn(\'' + emp.workerId + '\',\'present\')">&#x2705; Present</button>';
      } else {
        var atLbl = getLocation(ci.location) ? getLocation(ci.location).label : ci.location;
        cardClass += 'card-elsewhere';
        badgeHtml = '<div class="elsewhere-badge">At ' + atLbl + '</div>';
        actionsHtml = '<button class="btn-move" onclick="doCheckIn(\'' + emp.workerId + '\',\'present\')">Move Here</button>';
      }

      card.className = cardClass;
      card.innerHTML =
        '<div class="emp-card-info">' +
          '<div class="emp-card-name">' + emp.name + '</div>' +
          '<div class="emp-card-pos">' + emp.position + '</div>' +
        '</div>' +
        (badgeHtml ? '<div class="emp-card-actions">' + badgeHtml + actionsHtml + '</div>'
                   : '<div class="emp-card-actions">' + actionsHtml + '</div>');
      return card;
    }

    render({});
    updateCount({});

    // ════════════════════════════════════════════
    // TOOLBAR CHAT — wired to sticky top bar
    // ════════════════════════════════════════════
    var chatInited = false;

    function initToolbarChat() {
      if (chatInited) return;
      chatInited = true;

      var toggleBtn = document.getElementById('chatToolbarBtn');
      var panel     = document.getElementById('chatToolbarPanel');
      var msgList   = document.getElementById('chat-msgs-toolbar');
      var input     = document.getElementById('chat-input-toolbar');
      var sendBtn   = document.getElementById('chat-send-toolbar');
      var badge     = document.getElementById('chat-unread-toolbar');

      var lastSeenCount = 0;
      var unreadCount   = 0;

      // Toggle open/close
      toggleBtn.addEventListener('click', function () {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
          unreadCount   = 0;
          lastSeenCount = msgList.querySelectorAll('.chat-msg').length;
          badge.textContent = '';
          badge.classList.remove('visible');
          toggleBtn.classList.remove('has-unread');
          msgList.scrollTop = msgList.scrollHeight;
          input.focus();
        }
      });

      // Send
      function doSend() {
        var text = input.value.trim();
        if (!text) return;
        sendChatMessage(locationId, loc.label, 'location', text)
          .then(function () { input.value = ''; })
          .catch(function (err) { showToast('Could not send: ' + err.message); });
      }
      sendBtn.addEventListener('click', doSend);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doSend();
      });

      // Live listener
      listenChatMessages(locationId, function (msgs) {
        msgList.innerHTML = '';
        if (msgs.length === 0) {
          msgList.innerHTML = '<div class="chat-empty">No messages yet</div>';
        } else {
          msgs.forEach(function (m) {
            var bubble = document.createElement('div');
            bubble.className = 'chat-msg ' +
              (m.senderType === 'manager' ? 'from-manager' : 'from-location');
            bubble.innerHTML =
              '<div class="chat-sender">' + m.sender + '</div>' +
              '<div>' + escapeHtml(m.text) + '</div>' +
              '<div class="chat-time">' + formatChatTime(m.ts) + '</div>';
            msgList.appendChild(bubble);
          });
        }

        if (panel.classList.contains('open')) {
          msgList.scrollTop = msgList.scrollHeight;
          lastSeenCount = msgs.length;
        } else {
          var incoming = msgs.filter(function (m) { return m.senderType === 'manager'; });
          if (incoming.length > lastSeenCount) {
            unreadCount = incoming.length - lastSeenCount;
            badge.textContent = unreadCount;
            badge.classList.add('visible');
            toggleBtn.classList.add('has-unread');
          }
        }
      });
    }

  }

})();
