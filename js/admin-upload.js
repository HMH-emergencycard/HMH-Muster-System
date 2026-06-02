(function () {

  const CORRECT_PIN = '1234';

  // ── PIN ──
  window.checkPin = function () {
    var val = document.getElementById('pinInput').value;
    if (val === CORRECT_PIN) {
      document.getElementById('pinOverlay').style.display = 'none';
    } else {
      document.getElementById('pinError').style.display = 'block';
      document.getElementById('pinInput').value = '';
    }
  };
  document.getElementById('pinInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') window.checkPin();
  });

  // ── Tab name → Location ID mapping ──
  var TAB_MAP = {
    'ML 1':             'ML1',
    'ML 2':             'ML2',
    'ML 3':             'ML3',
    'ML 5-1':           'ML5-1',
    'ML 5-2':           'ML5-2',
    'ML 6':             'ML6',
    'ML 8':             'ML8',
    'ML 9':             'ML9',
    'ML 11':            'ML11',
    'ML 12':            'ML12',
    'ML 13-1':          'ML13-1',
    'ML 13-2 Finance':  'ML13-2-Finance',
    'ML 13-2 IT':       'ML13-2-IT',
    'ML 13-2 PM-Sales': 'ML13-2-PMSales',
    'ML 13-2 Services': 'ML13-2-Services',
    'ML 14':            'ML14'
  };

  var parsedEmployees = [];

  // ── Drag & drop ──
  var dropZone = document.getElementById('dropZone');
  dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', function ()  { dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    var file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  window.handleFile = function (file) {
    if (!file) return;
    if (!file.name.match(/\.xlsx?$/i)) {
      showToast('Please upload an .xlsx file');
      return;
    }

    setStatus('Reading file...', 10);
    parsedEmployees = [];
    document.getElementById('summaryArea').innerHTML = '';
    document.getElementById('previewArea').innerHTML = '';
    document.getElementById('saveBtn').style.display = 'none';

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        setStatus('Parsing tabs...', 30);
        var data     = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });

        var totalTabs   = 0;
        var skippedTabs = [];

        workbook.SheetNames.forEach(function (sheetName) {
          var locationId = TAB_MAP[sheetName.trim()];
          if (!locationId) {
            skippedTabs.push(sheetName);
            return;
          }
          totalTabs++;

          var sheet = workbook.Sheets[sheetName];

          // Get all rows as arrays (no header assumption)
          var allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          // Find the header row — look for the row that contains 'Worker ID'
          var headerRowIdx = -1;
          var headers      = [];
          for (var i = 0; i < allRows.length; i++) {
            var row = allRows[i].map(function (c) { return String(c).trim(); });
            if (row.indexOf('Worker ID') !== -1) {
              headerRowIdx = i;
              headers      = row;
              break;
            }
          }

          if (headerRowIdx === -1) {
            // Could not find header row in this tab — skip
            skippedTabs.push(sheetName + ' (no header row found)');
            totalTabs--;
            return;
          }

          // Column index lookup
          var colWorker  = headers.indexOf('Worker');
          var colId      = headers.indexOf('Worker ID');
          var colPos     = headers.indexOf('Position');
          var colOrg     = headers.indexOf('Supervisory Organization');
          var colPhone   = headers.indexOf('Phone');

          // Process data rows (everything after the header row)
          for (var r = headerRowIdx + 1; r < allRows.length; r++) {
            var row    = allRows[r];
            var name   = colWorker >= 0 ? String(row[colWorker] || '').trim() : '';
            var wid    = colId     >= 0 ? String(row[colId]     || '').trim() : '';
            var pos    = colPos    >= 0 ? String(row[colPos]    || '').trim() : '';
            var org    = colOrg    >= 0 ? String(row[colOrg]    || '').trim() : '';
            var phone  = colPhone  >= 0 ? String(row[colPhone]  || '').trim() : '';

            // Skip empty rows
            if (!name || !wid) continue;

            parsedEmployees.push({
              workerId:         wid,
              name:             name,
              position:         pos,
              supervisoryOrg:   org,
              phone:            phone,
              assignedLocation: locationId
            });
          }
        });

        if (parsedEmployees.length === 0) {
          setStatus('\u26A0 No employees found. Check tab names and column headers match exactly.', 0);
          renderSkipped(skippedTabs);
          return;
        }

        setStatus('\u2705 Done! ' + parsedEmployees.length + ' employees found across ' + totalTabs + ' tabs.', 100);
        renderSummary(totalTabs, skippedTabs);
        renderPreview();
        document.getElementById('saveBtn').style.display = 'inline-block';

      } catch (err) {
        setStatus('Error reading file: ' + err.message, 0);
        showToast('Error reading Excel file');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  function renderSkipped(skippedTabs) {
    if (!skippedTabs.length) return;
    document.getElementById('summaryArea').innerHTML =
      '<p style="color:#e65100;font-size:0.9rem;">&#x26A0; Skipped tabs (not recognised): <strong>' +
      skippedTabs.join(', ') + '</strong></p>' +
      '<p style="font-size:0.85rem;color:#555;">Expected tab names: ' +
      Object.keys(TAB_MAP).join(', ') + '</p>';
  }

  function renderSummary(totalTabs, skippedTabs) {
    var byLoc = {};
    parsedEmployees.forEach(function (e) {
      byLoc[e.assignedLocation] = (byLoc[e.assignedLocation] || 0) + 1;
    });

    var html = '<div class="summary-grid">';
    html += '<div class="summary-card"><strong>' + parsedEmployees.length + '</strong>Total Employees</div>';
    html += '<div class="summary-card"><strong>' + totalTabs + '</strong>Tabs Imported</div>';
    Object.keys(byLoc).forEach(function (loc) {
      var label = (getLocation(loc) ? getLocation(loc).label : loc);
      html += '<div class="summary-card"><strong>' + byLoc[loc] + '</strong>' + label + '</div>';
    });
    html += '</div>';

    if (skippedTabs.length) {
      html += '<p style="color:#e65100;font-size:0.85rem;">&#x26A0; Skipped tabs: ' + skippedTabs.join(', ') + '</p>';
    }

    document.getElementById('summaryArea').innerHTML = html;
  }

  function renderPreview() {
    var preview = parsedEmployees.slice(0, 10);
    var html = '<p style="font-size:0.85rem;color:#555;margin-bottom:4px;">Preview (first 10 rows):</p>';
    html += '<div style="overflow-x:auto"><table class="preview-table"><thead><tr>';
    html += '<th>Worker ID</th><th>Name</th><th>Position</th><th>Supervisory Org</th><th>Location</th>';
    html += '</tr></thead><tbody>';
    preview.forEach(function (e) {
      var label = getLocation(e.assignedLocation) ? getLocation(e.assignedLocation).label : e.assignedLocation;
      html += '<tr><td>' + e.workerId + '</td><td>' + e.name + '</td><td>' + e.position + '</td><td>' + e.supervisoryOrg + '</td><td>' + label + '</td></tr>';
    });
    html += '</tbody></table></div>';
    document.getElementById('previewArea').innerHTML = html;
  }

  window.saveToFirebase = function () {
    if (!parsedEmployees.length) { showToast('No employees to save'); return; }

    var saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving...';
    setStatus('Saving to Firebase...', 60);

    var rosterObj = {};
    parsedEmployees.forEach(function (e) {
      rosterObj[e.workerId] = {
        name:             e.name,
        position:         e.position,
        supervisoryOrg:   e.supervisoryOrg,
        phone:            e.phone,
        assignedLocation: e.assignedLocation
      };
    });

    db.ref('roster').set(rosterObj).then(function () {
      setStatus('\u2705 Roster saved! ' + parsedEmployees.length + ' employees updated in Firebase.', 100);
      saveBtn.textContent = '\u2705 Saved!';
      showToast('Roster saved to Firebase \u2705');
    }).catch(function (err) {
      setStatus('Error saving: ' + err.message, 0);
      saveBtn.disabled    = false;
      saveBtn.textContent = '\u2705 Save Roster to Firebase';
      showToast('Error saving to Firebase');
    });
  };

  function setStatus(msg, pct) {
    var wrap = document.getElementById('progressWrap');
    wrap.style.display = 'block';
    document.getElementById('progressBar').value = pct;
    document.getElementById('statusMsg').textContent = msg;
  }

})();
