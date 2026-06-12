// ========================================================
// HMH MUSTER — CHAT MODULE
// Shared by checkin.js (muster-point side)
//         and dashboard.js (manager side)
//
// Firebase path:
//   sessions/{sessionId}/chat/{locationId}/{pushKey}
//     sender     : display label  e.g. "ML 4" or "Manager"
//     senderType : "location" | "manager"
//     text       : message string
//     ts         : ISO timestamp
// ========================================================

/**
 * Post a chat message for a muster location.
 * @param {string} locationId   - e.g. "ML4"
 * @param {string} senderLabel  - e.g. "ML 4" or "Manager"
 * @param {string} senderType   - "location" or "manager"
 * @param {string} text         - message body
 * @returns {Promise}
 */
function sendChatMessage(locationId, senderLabel, senderType, text) {
  var session = getActiveSession();
  if (!session) {
    showToast('No active session — cannot send message.');
    return Promise.reject(new Error('No active session'));
  }
  text = (text || '').trim();
  if (!text) return Promise.reject(new Error('Empty message'));

  return db
    .ref('sessions/' + session + '/chat/' + locationId)
    .push({
      sender:     senderLabel,
      senderType: senderType,
      text:       text,
      ts:         new Date().toISOString()
    });
}

/**
 * Start a real-time listener for chat messages at one location.
 * Calls callback(messagesArray) every time messages change.
 * Returns the Firebase ref so the caller can call .off() later.
 *
 * @param {string}   locationId
 * @param {function} callback   - receives array of message objects
 * @returns {firebase.database.Reference}
 */
function listenChatMessages(locationId, callback) {
  var session = getActiveSession();
  if (!session) return null;

  var ref = db.ref('sessions/' + session + '/chat/' + locationId);
  ref.on('value', function(snap) {
    var val = snap.val();
    var msgs = [];
    if (val) {
      Object.keys(val).forEach(function(k) {
        msgs.push(val[k]);
      });
      // Sort oldest → newest
      msgs.sort(function(a, b) {
        return new Date(a.ts) - new Date(b.ts);
      });
    }
    callback(msgs);
  });
  return ref;
}

/**
 * Format an ISO timestamp to a short HH:MM time string.
 * @param {string} isoTs
 * @returns {string}
 */
function formatChatTime(isoTs) {
  if (!isoTs) return '';
  return new Date(isoTs).toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit'
  });
}

/**
 * Build and return a chat panel DOM element.
 * Works on both the check-in page and the dashboard card.
 *
 * @param {object} options
 *   locationId   {string}  - e.g. "ML4"
 *   locationLabel{string}  - e.g. "ML 4"
 *   senderType   {string}  - "location" | "manager"
 *   senderLabel  {string}  - label shown in messages
 *
 * @returns {HTMLElement}  — the wrapper div ready to appendChild
 */
function buildChatPanel(options) {
  var locationId    = options.locationId;
  var locationLabel = options.locationLabel;
  var senderType    = options.senderType;    // "location" or "manager"
  var senderLabel   = options.senderLabel;   // e.g. "ML 4" or "Manager"

  var panelId   = 'chat-panel-' + locationId;
  var bodyId    = 'chat-body-'  + locationId;
  var msgsId    = 'chat-msgs-'  + locationId;
  var inputId   = 'chat-input-' + locationId;
  var unreadId  = 'chat-unread-'+ locationId;

  var wrapper = document.createElement('div');
  wrapper.id  = panelId;

  // ── Toggle button ──
  var toggleBtn = document.createElement('button');
  toggleBtn.className = 'chat-toggle-btn';
  toggleBtn.innerHTML =
    '&#x1F4AC; Chat' +
    '<span class="chat-unread" id="' + unreadId + '">0</span>';
  wrapper.appendChild(toggleBtn);

  // ── Chat body (hidden by default) ──
  var body = document.createElement('div');
  body.className = 'chat-body';
  body.id        = bodyId;

  var msgList = document.createElement('div');
  msgList.className = 'chat-messages';
  msgList.id        = msgsId;
  msgList.innerHTML = '<div class="chat-empty">No messages yet</div>';
  body.appendChild(msgList);

  // ── Input row ──
  var inputRow = document.createElement('div');
  inputRow.className = 'chat-input-row';

  var input = document.createElement('input');
  input.type        = 'text';
  input.className   = 'chat-input';
  input.id          = inputId;
  input.placeholder = senderType === 'manager'
    ? 'Reply to ' + locationLabel + '…'
    : 'Message manager…';
  input.maxLength   = 300;

  var sendBtn = document.createElement('button');
  sendBtn.className   = 'chat-send-btn';
  sendBtn.textContent = 'Send';

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  body.appendChild(inputRow);
  wrapper.appendChild(body);

  // ── Toggle open/close ──
  toggleBtn.addEventListener('click', function() {
    body.classList.toggle('open');
    // Clear unread badge when opening
    if (body.classList.contains('open')) {
      var badge = document.getElementById(unreadId);
      if (badge) {
        badge.textContent = '0';
        badge.classList.remove('visible');
      }
      // Scroll to bottom
      msgList.scrollTop = msgList.scrollHeight;
      input.focus();
    }
  });

  // ── Send on button click or Enter ──
  function doSend() {
    var text = input.value.trim();
    if (!text) return;
    sendChatMessage(locationId, senderLabel, senderType, text)
      .then(function() { input.value = ''; })
      .catch(function(err) { showToast('Could not send: ' + err.message); });
  }

  sendBtn.addEventListener('click', doSend);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doSend();
  });

  // ── Live listener ──
  var unreadCount = 0;
  var lastSeenCount = 0;

  listenChatMessages(locationId, function(msgs) {
    // Update message list
    msgList.innerHTML = '';
    if (msgs.length === 0) {
      msgList.innerHTML = '<div class="chat-empty">No messages yet</div>';
    } else {
      msgs.forEach(function(m) {
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

    // Scroll to bottom if panel is open
    if (body.classList.contains('open')) {
      msgList.scrollTop = msgList.scrollHeight;
      lastSeenCount = msgs.length;
    } else {
      // Count messages that aren't from this side as "unread"
      var incoming = msgs.filter(function(m) {
        return m.senderType !== senderType;
      });
      var newUnread = Math.max(0, incoming.length - lastSeenCount);
      if (newUnread > 0) {
        unreadCount = incoming.length;
        var badge = document.getElementById(unreadId);
        if (badge) {
          badge.textContent = unreadCount;
          badge.classList.add('visible');
        }
        // If manager side — add notify dot to dash-card header
        if (senderType === 'manager') {
          var cardHeader = document.querySelector('#card-' + locationId + ' .dash-card-header h3');
          if (cardHeader && !cardHeader.querySelector('.chat-notify-dot')) {
            var dot = document.createElement('span');
            dot.className = 'chat-notify-dot';
            dot.id        = 'notify-dot-' + locationId;
            cardHeader.appendChild(dot);
          }
        }
      }
    }
  });

  return wrapper;
}

/** Simple HTML escape to prevent XSS in chat messages */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
