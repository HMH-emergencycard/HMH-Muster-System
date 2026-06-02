// ========================================================
// FIREBASE CONFIG — Replace with your Firebase project details
// IT Admin: Create a free project at https://console.firebase.google.com
// ========================================================
const firebaseConfig = {
  apiKey:        "REPLACE_WITH_YOUR_API_KEY",
  authDomain:    "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  databaseURL:   "REPLACE_WITH_YOUR_DATABASE_URL",
  projectId:     "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId:         "REPLACE_WITH_YOUR_APP_ID"
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
// EMPLOYEE ROSTER — To be replaced by SharePoint/Excel sync
// IT Admin: Connect to SharePoint Excel via Microsoft Graph API
// Excel file has 16 tabs, one per muster location, ~500 employees total
// Columns: Present (Y/N), Supervisory Organization, Worker, Worker ID, Position, Phone
// ========================================================
const EMPLOYEES = [
  // ML 1
  { workerId:"EMP001", name:"Alice Johnson",    position:"Process Engineer",      supervisoryOrg:"Operations",   phone:"281-555-0001", assignedLocation:"ML1" },
  { workerId:"EMP002", name:"Brian Lee",         position:"Technician II",          supervisoryOrg:"Maintenance",  phone:"281-555-0002", assignedLocation:"ML1" },
  { workerId:"EMP003", name:"Carmen Diaz",       position:"HSE Specialist",         supervisoryOrg:"Safety",       phone:"281-555-0003", assignedLocation:"ML1" },
  { workerId:"EMP004", name:"David Park",        position:"Shift Supervisor",       supervisoryOrg:"Operations",   phone:"281-555-0004", assignedLocation:"ML1" },
  { workerId:"EMP005", name:"Eva Martinez",      position:"Lab Analyst",            supervisoryOrg:"Quality",      phone:"281-555-0005", assignedLocation:"ML1" },
  // ML 2
  { workerId:"EMP006", name:"Frank Thompson",    position:"Operator",               supervisoryOrg:"Operations",   phone:"281-555-0006", assignedLocation:"ML2" },
  { workerId:"EMP007", name:"Grace Kim",         position:"Engineer I",             supervisoryOrg:"Engineering",  phone:"281-555-0007", assignedLocation:"ML2" },
  { workerId:"EMP008", name:"Henry Brown",       position:"Maintenance Tech",       supervisoryOrg:"Maintenance",  phone:"281-555-0008", assignedLocation:"ML2" },
  { workerId:"EMP009", name:"Iris Chan",         position:"Administrative Asst",    supervisoryOrg:"Admin",        phone:"281-555-0009", assignedLocation:"ML2" },
  { workerId:"EMP010", name:"James Wilson",      position:"Planner",               supervisoryOrg:"Planning",     phone:"281-555-0010", assignedLocation:"ML2" },
  // ML 3
  { workerId:"EMP011", name:"Karen White",       position:"Process Tech",           supervisoryOrg:"Operations",   phone:"281-555-0011", assignedLocation:"ML3" },
  { workerId:"EMP012", name:"Luis Gomez",        position:"Electrician",            supervisoryOrg:"Maintenance",  phone:"281-555-0012", assignedLocation:"ML3" },
  { workerId:"EMP013", name:"Maria Santos",      position:"QA Inspector",           supervisoryOrg:"Quality",      phone:"281-555-0013", assignedLocation:"ML3" },
  { workerId:"EMP014", name:"Nathan Scott",      position:"Supervisor",             supervisoryOrg:"Operations",   phone:"281-555-0014", assignedLocation:"ML3" },
  { workerId:"EMP015", name:"Olivia Turner",     position:"Safety Officer",         supervisoryOrg:"Safety",       phone:"281-555-0015", assignedLocation:"ML3" },
  // ML 5-1
  { workerId:"EMP016", name:"Paul Adams",        position:"Operator II",            supervisoryOrg:"Operations",   phone:"281-555-0016", assignedLocation:"ML5-1" },
  { workerId:"EMP017", name:"Quinn Baker",       position:"Instrument Tech",        supervisoryOrg:"Instrumentation",phone:"281-555-0017", assignedLocation:"ML5-1" },
  { workerId:"EMP018", name:"Rachel Green",      position:"Engineer II",            supervisoryOrg:"Engineering",  phone:"281-555-0018", assignedLocation:"ML5-1" },
  { workerId:"EMP019", name:"Steve Hall",        position:"Welder",                supervisoryOrg:"Maintenance",  phone:"281-555-0019", assignedLocation:"ML5-1" },
  { workerId:"EMP020", name:"Tina Young",        position:"Lab Technician",         supervisoryOrg:"Quality",      phone:"281-555-0020", assignedLocation:"ML5-1" },
  // ML 5-2
  { workerId:"EMP021", name:"Uma Patel",         position:"Operator (Night)",       supervisoryOrg:"Operations",   phone:"281-555-0021", assignedLocation:"ML5-2" },
  { workerId:"EMP022", name:"Victor Ramos",      position:"Technician (Night)",     supervisoryOrg:"Maintenance",  phone:"281-555-0022", assignedLocation:"ML5-2" },
  { workerId:"EMP023", name:"Wendy Ortiz",       position:"Shift Lead (Night)",     supervisoryOrg:"Operations",   phone:"281-555-0023", assignedLocation:"ML5-2" },
  { workerId:"EMP024", name:"Xavier Cruz",       position:"Electrician (Night)",    supervisoryOrg:"Maintenance",  phone:"281-555-0024", assignedLocation:"ML5-2" },
  { workerId:"EMP025", name:"Yara Singh",        position:"Safety Rep (Night)",     supervisoryOrg:"Safety",       phone:"281-555-0025", assignedLocation:"ML5-2" },
  // ML 6
  { workerId:"EMP026", name:"Zack Moore",        position:"Process Engineer",       supervisoryOrg:"Engineering",  phone:"281-555-0026", assignedLocation:"ML6" },
  { workerId:"EMP027", name:"Amy Nelson",        position:"Operator I",             supervisoryOrg:"Operations",   phone:"281-555-0027", assignedLocation:"ML6" },
  { workerId:"EMP028", name:"Ben Carter",        position:"Planner",               supervisoryOrg:"Planning",     phone:"281-555-0028", assignedLocation:"ML6" },
  { workerId:"EMP029", name:"Chloe Mitchell",    position:"Admin Coordinator",      supervisoryOrg:"Admin",        phone:"281-555-0029", assignedLocation:"ML6" },
  { workerId:"EMP030", name:"Derek Perez",       position:"Maintenance Tech",       supervisoryOrg:"Maintenance",  phone:"281-555-0030", assignedLocation:"ML6" },
  // ML 8
  { workerId:"EMP031", name:"Elena Ford",        position:"HSE Coordinator",        supervisoryOrg:"Safety",       phone:"281-555-0031", assignedLocation:"ML8" },
  { workerId:"EMP032", name:"Finn Hughes",       position:"Operator III",           supervisoryOrg:"Operations",   phone:"281-555-0032", assignedLocation:"ML8" },
  { workerId:"EMP033", name:"Gabby Price",       position:"QC Analyst",             supervisoryOrg:"Quality",      phone:"281-555-0033", assignedLocation:"ML8" },
  { workerId:"EMP034", name:"Hank Reed",         position:"Supervisor",             supervisoryOrg:"Operations",   phone:"281-555-0034", assignedLocation:"ML8" },
  { workerId:"EMP035", name:"Isla Ross",         position:"Engineer I",             supervisoryOrg:"Engineering",  phone:"281-555-0035", assignedLocation:"ML8" },
  // ML 9
  { workerId:"EMP036", name:"Jake Bell",         position:"Security Officer",       supervisoryOrg:"Security",     phone:"281-555-0036", assignedLocation:"ML9" },
  { workerId:"EMP037", name:"Kara Cox",          position:"Operator",               supervisoryOrg:"Operations",   phone:"281-555-0037", assignedLocation:"ML9" },
  { workerId:"EMP038", name:"Leo Ward",          position:"Instrumentation Tech",   supervisoryOrg:"Instrumentation",phone:"281-555-0038", assignedLocation:"ML9" },
  { workerId:"EMP039", name:"Mia Torres",        position:"Lab Tech",               supervisoryOrg:"Quality",      phone:"281-555-0039", assignedLocation:"ML9" },
  { workerId:"EMP040", name:"Noah Peterson",     position:"Maintenance II",         supervisoryOrg:"Maintenance",  phone:"281-555-0040", assignedLocation:"ML9" },
  // ML 11
  { workerId:"EMP041", name:"Ola Jensen",        position:"Process Engineer",       supervisoryOrg:"Engineering",  phone:"281-555-0041", assignedLocation:"ML11" },
  { workerId:"EMP042", name:"Pete Murray",       position:"Operator",               supervisoryOrg:"Operations",   phone:"281-555-0042", assignedLocation:"ML11" },
  { workerId:"EMP043", name:"Quinn Ellis",       position:"Safety Specialist",      supervisoryOrg:"Safety",       phone:"281-555-0043", assignedLocation:"ML11" },
  { workerId:"EMP044", name:"Rosa Mills",        position:"Admin Assistant",        supervisoryOrg:"Admin",        phone:"281-555-0044", assignedLocation:"ML11" },
  { workerId:"EMP045", name:"Sam Grant",         position:"Supervisor",             supervisoryOrg:"Operations",   phone:"281-555-0045", assignedLocation:"ML11" },
  // ML 12
  { workerId:"EMP046", name:"Tara Webb",         position:"QA Engineer",            supervisoryOrg:"Quality",      phone:"281-555-0046", assignedLocation:"ML12" },
  { workerId:"EMP047", name:"Umar Stone",        position:"Technician I",           supervisoryOrg:"Maintenance",  phone:"281-555-0047", assignedLocation:"ML12" },
  { workerId:"EMP048", name:"Vera Simmons",      position:"Engineer II",            supervisoryOrg:"Engineering",  phone:"281-555-0048", assignedLocation:"ML12" },
  { workerId:"EMP049", name:"Will Foster",       position:"Operator II",            supervisoryOrg:"Operations",   phone:"281-555-0049", assignedLocation:"ML12" },
  { workerId:"EMP050", name:"Xena Hayes",        position:"Planner",               supervisoryOrg:"Planning",     phone:"281-555-0050", assignedLocation:"ML12" },
  // ML 13-1
  { workerId:"EMP051", name:"Yusuf Holmes",      position:"Process Tech",           supervisoryOrg:"Operations",   phone:"281-555-0051", assignedLocation:"ML13-1" },
  { workerId:"EMP052", name:"Zoe Chapman",       position:"HSE Rep",                supervisoryOrg:"Safety",       phone:"281-555-0052", assignedLocation:"ML13-1" },
  { workerId:"EMP053", name:"Aaron Spencer",     position:"Maintenance III",        supervisoryOrg:"Maintenance",  phone:"281-555-0053", assignedLocation:"ML13-1" },
  { workerId:"EMP054", name:"Beth Fisher",       position:"Operator I",             supervisoryOrg:"Operations",   phone:"281-555-0054", assignedLocation:"ML13-1" },
  { workerId:"EMP055", name:"Carl Dixon",        position:"Supervisor",             supervisoryOrg:"Operations",   phone:"281-555-0055", assignedLocation:"ML13-1" },
  // ML 13-2 Finance
  { workerId:"EMP056", name:"Dana Perkins",      position:"Financial Analyst",      supervisoryOrg:"Finance",      phone:"281-555-0056", assignedLocation:"ML13-2-Finance" },
  { workerId:"EMP057", name:"Eric Walters",      position:"Accountant",             supervisoryOrg:"Finance",      phone:"281-555-0057", assignedLocation:"ML13-2-Finance" },
  { workerId:"EMP058", name:"Fiona Bryant",      position:"Finance Manager",        supervisoryOrg:"Finance",      phone:"281-555-0058", assignedLocation:"ML13-2-Finance" },
  { workerId:"EMP059", name:"Glen Sanders",      position:"Budget Analyst",         supervisoryOrg:"Finance",      phone:"281-555-0059", assignedLocation:"ML13-2-Finance" },
  { workerId:"EMP060", name:"Holly Price",       position:"Payroll Specialist",     supervisoryOrg:"Finance",      phone:"281-555-0060", assignedLocation:"ML13-2-Finance" },
  // ML 13-2 IT
  { workerId:"EMP061", name:"Ivan Coleman",      position:"Systems Admin",          supervisoryOrg:"IT",           phone:"281-555-0061", assignedLocation:"ML13-2-IT" },
  { workerId:"EMP062", name:"Jade Patterson",    position:"Network Engineer",       supervisoryOrg:"IT",           phone:"281-555-0062", assignedLocation:"ML13-2-IT" },
  { workerId:"EMP063", name:"Kyle Warren",       position:"IT Support",             supervisoryOrg:"IT",           phone:"281-555-0063", assignedLocation:"ML13-2-IT" },
  { workerId:"EMP064", name:"Lily Griffin",      position:"Developer",              supervisoryOrg:"IT",           phone:"281-555-0064", assignedLocation:"ML13-2-IT" },
  { workerId:"EMP065", name:"Mark Diaz",         position:"IT Manager",             supervisoryOrg:"IT",           phone:"281-555-0065", assignedLocation:"ML13-2-IT" },
  // ML 13-2 PM-Sales
  { workerId:"EMP066", name:"Nina Brooks",       position:"Project Manager",        supervisoryOrg:"PM-Sales",     phone:"281-555-0066", assignedLocation:"ML13-2-PMSales" },
  { workerId:"EMP067", name:"Oscar Kelly",       position:"Sales Engineer",         supervisoryOrg:"PM-Sales",     phone:"281-555-0067", assignedLocation:"ML13-2-PMSales" },
  { workerId:"EMP068", name:"Paula Murphy",      position:"Account Manager",        supervisoryOrg:"PM-Sales",     phone:"281-555-0068", assignedLocation:"ML13-2-PMSales" },
  { workerId:"EMP069", name:"Ray Rivera",        position:"Business Dev",           supervisoryOrg:"PM-Sales",     phone:"281-555-0069", assignedLocation:"ML13-2-PMSales" },
  { workerId:"EMP070", name:"Sara Cook",         position:"Sales Coordinator",      supervisoryOrg:"PM-Sales",     phone:"281-555-0070", assignedLocation:"ML13-2-PMSales" },
  // ML 13-2 Services
  { workerId:"EMP071", name:"Tom Bailey",        position:"Field Technician",       supervisoryOrg:"Services",     phone:"281-555-0071", assignedLocation:"ML13-2-Services" },
  { workerId:"EMP072", name:"Uma Foster",        position:"Service Engineer",       supervisoryOrg:"Services",     phone:"281-555-0072", assignedLocation:"ML13-2-Services" },
  { workerId:"EMP073", name:"Vince Powell",      position:"Service Coordinator",    supervisoryOrg:"Services",     phone:"281-555-0073", assignedLocation:"ML13-2-Services" },
  { workerId:"EMP074", name:"Wendy Long",        position:"Field Supervisor",       supervisoryOrg:"Services",     phone:"281-555-0074", assignedLocation:"ML13-2-Services" },
  { workerId:"EMP075", name:"Xander Ross",       position:"Technician II",          supervisoryOrg:"Services",     phone:"281-555-0075", assignedLocation:"ML13-2-Services" },
  // ML 14
  { workerId:"EMP076", name:"Yvonne James",      position:"HSE Manager",            supervisoryOrg:"Safety",       phone:"281-555-0076", assignedLocation:"ML14" },
  { workerId:"EMP077", name:"Zach Watson",       position:"Operator III",           supervisoryOrg:"Operations",   phone:"281-555-0077", assignedLocation:"ML14" },
  { workerId:"EMP078", name:"Amy Jenkins",       position:"Engineer II",            supervisoryOrg:"Engineering",  phone:"281-555-0078", assignedLocation:"ML14" },
  { workerId:"EMP079", name:"Brad Perry",        position:"Maintenance Lead",       supervisoryOrg:"Maintenance",  phone:"281-555-0079", assignedLocation:"ML14" },
  { workerId:"EMP080", name:"Clara Hughes",      position:"Supervisor",             supervisoryOrg:"Operations",   phone:"281-555-0080", assignedLocation:"ML14" },
];

function getEmployeesByLocation(locationId) {
  return EMPLOYEES.filter(e => e.assignedLocation === locationId);
}
function getEmployeeById(workerId) {
  return EMPLOYEES.find(e => e.workerId === workerId);
}

// ── Check-in helper ──
function checkInEmployee(workerId, checkedInAtLocation) {
  const session = getActiveSession();
  if (!session) { alert('No active session. Please start a session first.'); return; }
  const emp = getEmployeeById(workerId);
  if (!emp) { console.warn('Employee not found:', workerId); return; }
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
