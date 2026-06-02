// ========================================================
// FIREBASE CONFIG
// ========================================================
const firebaseConfig = {
  apiKey:            "AIzaSyDkVUs7OWRE4VNG6zh5mDRf_m118DVj30I",
  authDomain:        "hmh-muster-check-in.firebaseapp.com",
  databaseURL:       "https://hmh-muster-check-in-default-rtdb.firebaseio.com",
  projectId:         "hmh-muster-check-in",
  storageBucket:     "hmh-muster-check-in.firebasestorage.app",
  messagingSenderId: "336141683682",
  appId:             "1:336141683682:web:9546744a13fe9c6e7607bb",
  measurementId:     "G-RMTMSN0PDZ"
};

// Initialise Firebase (v9 compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ── Active session key (stored in sessionStorage so each tab shares it) ──
function getActiveSession() { return sessionStorage.getItem('musterSession'); }
function setActiveSession(id) { sessionStorage.setItem('musterSession', id); }
function startNewSession() {
  const id = 'session_' + Date.now();
  db.ref('sessions/' + id).set({ active: true, startedAt: new Date().toISOString() });
  setActiveSession(id);
  return id;
}

// ── Muster Locations ──
// Only ML 5-2 is second shift.
// ML 13-2 variants are separate department locations (no shift label).
const MUSTER_LOCATIONS = [
  { id: "ML1",              label: "ML 1",             secondShift: false, coordinators: ["Robert Cameron", "Luc Ngo", "Ahsan Siddiqui"] },
  { id: "ML2",              label: "ML 2",             secondShift: false, coordinators: ["James Gay", "Bryan Armer"] },
  { id: "ML3",              label: "ML 3",             secondShift: false, coordinators: ["Jose Mata", "Danial Siddiqui", "Lemon Ford"] },
  { id: "ML5-1",            label: "ML 5-1",           secondShift: false, coordinators: ["Jose Estrada", "Henry Moreno", "Bobby Peterson"] },
  { id: "ML5-2",            label: "ML 5-2",           secondShift: true,  coordinators: ["Sean Lynch", "Ed Stankowski"] },
  { id: "ML6",              label: "ML 6",             secondShift: false, coordinators: ["Patricia Ronan", "Venkatesh Ramabadran"] },
  { id: "ML8",              label: "ML 8",             secondShift: false, coordinators: ["Ken Shannon", "Eric Sundholm"] },
  { id: "ML9",              label: "ML 9",             secondShift: false, coordinators: ["Carol Cleveland", "Security Guard"] },
  { id: "ML11",             label: "ML 11",            secondShift: false, coordinators: ["Jadrian Roquemore", "Grogan Mathews", "Devang Brahmbhatt", "Jeremy Welborn"] },
  { id: "ML12",             label: "ML 12",            secondShift: false, coordinators: ["Daniel Bailey", "Jorge Flores", "Mike Gerrard"] },
  { id: "ML13-1",           label: "ML 13-1",          secondShift: false, coordinators: ["Tracy McKinney", "Cindy Nichols"] },
  { id: "ML13-2-Finance",   label: "ML 13-2 Finance",  secondShift: false, coordinators: ["Stephanie Rodriguez", "Robert Flanagan"] },
  { id: "ML13-2-IT",        label: "ML 13-2 I.T",      secondShift: false, coordinators: ["Joe Frederick", "Junior Immanivong"] },
  { id: "ML13-2-PMSales",   label: "ML 13-2 PM-Sales", secondShift: false, coordinators: ["Ryan Gustafson", "Jeff Fisher", "Jose Colon"] },
  { id: "ML13-2-Services",  label: "ML 13-2 Services", secondShift: false, coordinators: ["Tali Ayala", "Clifton Hartoon"] },
  { id: "ML14",             label: "ML 14",            secondShift: false, coordinators: ["Darrell Silva", "Scott Letney", "Juan Adame"] },
];

function getLocation(id) { return MUSTER_LOCATIONS.find(l => l.id === id); }

// ========================================================
// EMPLOYEE ROSTER — Loaded from Firebase (uploaded via admin-upload.html)
// ========================================================
let EMPLOYEES = [];
let rosterLoaded = false;
let rosterCallbacks = [];

// Load roster from Firebase once on startup
db.ref('roster').once('value', function(snap) {
  const data = snap.val();
  if (data) {
    EMPLOYEES = Object.entries(data).map(function([workerId, emp]) {
      return {
        workerId:         workerId,
        name:             emp.name             || '',
        position:         emp.position         || '',
        supervisoryOrg:   emp.supervisoryOrg   || '',
        phone:            emp.phone            || '',
        assignedLocation: emp.assignedLocation || ''
      };
    });
    console.log('Roster loaded from Firebase: ' + EMPLOYEES.length + ' employees');
  } else {
    console.warn('No roster found in Firebase. Please upload via admin-upload.html');
  }
  rosterLoaded = true;
  rosterCallbacks.forEach(function(cb) { cb(EMPLOYEES); });
  rosterCallbacks = [];
});

// Call cb(EMPLOYEES) once roster is ready (or immediately if already loaded)
function onRosterReady(cb) {
  if (rosterLoaded) { cb(EMPLOYEES); }
  else { rosterCallbacks.push(cb); }
}

function getEmployeesByLocation(locationId) {
  return EMPLOYEES.filter(e => e.assignedLocation === locationId);
}
function getEmployeeById(workerId) {
  return EMPLOYEES.find(e => e.workerId === workerId);
}

// ── Check-in helper ──
function checkInEmployee(workerId, checkedInAtLocation) {
  const session = getActiveSession();
  if (!session) { alert('No active session. Please start a session first.'); return Promise.reject(new Error('No active session')); }
  const emp = getEmployeeById(workerId);
  if (!emp) { console.warn('Employee not found:', workerId); return Promise.reject(new Error('Employee not found')); }
  return db.ref(`sessions/${session}/checkins/${workerId}`).set({
    name:             emp.name,
    position:         emp.position,
    checkedInAt:      new Date().toISOString(),
    location:         checkedInAtLocation,
    assignedLocation: emp.assignedLocation
  });
}

// ── Listen to all checkins for current session ──
function onCheckinsUpdate(callback) {
  const session = getActiveSession();
  if (!session) return;
  db.ref(`sessions/${session}/checkins`).on('value', snap => {
    callback(snap.val() || {});
  });
}

// ── Toast utility ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
