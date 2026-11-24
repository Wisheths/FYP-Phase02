/* ==========================================================
   UI CONTROLLER MODULE (uiController.js)
   ========================================================== */

const SECTION_META = {
  'dashboard': {
    title: 'Papan Pemuka',
    subtitle: 'Ringkasan keadaan komputer dan status sistem di Makmal SKR 2.'
  },
  'peralatan': {
    title: 'Pengurusan Peralatan',
    subtitle: 'Senarai inventori komputer, spesifikasi dan status semasa.'
  },
  'penyelenggaraan': {
    title: 'Rekod Penyelenggaraan',
    subtitle: 'Log pembaikan, pemeriksaan rutin dan tindakan teknikal.'
  },
  'modul-ramalan': {
    title: 'Ramalan Penyelenggaraan',
    subtitle: 'Analisis risiko kerosakan berasaskan enjin diagnostik.'
  },
  'laporan': {
    title: 'Laporan Status Makmal',
    subtitle: 'Ringkasan statistik dan cetakan laporan rasmi Makmal SKR 2.'
  }
};

// Compatibility bridges for diagnosticEngine.js
function getEquipmentData() {
  return getEquipment();
}

function getMaintenanceData() {
  return getMaintenanceLogs().map(log => ({
    ...log,
    equipmentId: log.pcId
  }));
}

// Safe DOM text helper
function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ==========================================================
// INITIALIZATION
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
  refreshAllUI();
});

function refreshAllUI() {
  renderDashboard();
  renderEquipmentTable();
  renderMaintenanceTable();
  populatePredictionDropdown();
}

// ==========================================================
// NAVIGATION & SIDEBAR
// ==========================================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
}

function showSection(sectionId, linkEl, event) {
  if (event) event.preventDefault();

  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.remove('active-section');
  });

  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active-section');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  if (linkEl) linkEl.classList.add('active');

  if (SECTION_META[sectionId]) {
    setElText('pageTitle', SECTION_META[sectionId].title);
    setElText('pageSubtitle', SECTION_META[sectionId].subtitle);
  }

  if (sectionId === 'modul-ramalan') {
    populatePredictionDropdown();
  }
}

// ==========================================================
// DASHBOARD & VISUALS
// ==========================================================
function renderDashboard() {
  const equipment = getEquipment();
  const logs = getMaintenanceLogs();

  const total = equipment.length;
  const baik = equipment.filter(e => e.condition === 'Baik').length;
  const perhatian = equipment.filter(e => e.condition === 'Perlu diperiksa').length;
  const rosak = equipment.filter(e => e.condition === 'Rosak').length;

  setElText('statTotal', total);
  setElText('statBaik', baik);
  setElText('statPerhatian', perhatian);
  setElText('statRosak', rosak);

  setElText('repTotal', total);
  setElText('repGood', baik);
  setElText('repMaintenance', perhatian + rosak);
  setElText('repLogsCount', logs.length);

  updateDashboardVisuals(total, baik, perhatian, rosak);

  const alertEl = document.getElementById('maintenanceAlertText');
  if (alertEl) {
    if (rosak > 0 || perhatian > 0) {
      alertEl.textContent = `Terdapat ${rosak} komputer rosak dan ${perhatian} komputer memerlukan pemeriksaan segera.`;
    } else {
      alertEl.textContent = 'Semua peralatan komputer berada dalam keadaan baik dan sedia digunakan.';
    }
  }

  const dashBody = document.getElementById('dashboardTableBody');
  if (dashBody) {
    dashBody.innerHTML = equipment.slice(0, 5).map(eq => `
      <tr>
        <td class="mono-text">${eq.id}</td>
        <td>${eq.model}</td>
        <td class="mono-text">${eq.serial}</td>
        <td><span class="badge ${getConditionClass(eq.condition)}">${eq.condition}</span></td>
        <td><span class="badge ${getStatusClass(eq.status)}">${eq.status}</span></td>
      </tr>
    `).join('');
  }
}

function updateDashboardVisuals(total, baik, perhatian, rosak) {
  const pBaik = total > 0 ? Math.round((baik / total) * 100) : 0;
  const pPerhatian = total > 0 ? Math.round((perhatian / total) * 100) : 0;
  const pRosak = total > 0 ? Math.round((rosak / total) * 100) : 0;

  setElText('visualHealthRatio', `${pBaik}% Sedia Digunakan`);

  const barBaik = document.getElementById('barBaik');
  const barPerhatian = document.getElementById('barPerhatian');
  const barRosak = document.getElementById('barRosak');

  if (barBaik) barBaik.style.width = `${pBaik}%`;
  if (barPerhatian) barPerhatian.style.width = `${pPerhatian}%`;
  if (barRosak) barRosak.style.width = `${pRosak}%`;

  setElText('legendBaikCount', baik);
  setElText('legendPerhatianCount', perhatian);
  setElText('legendRosakCount', rosak);

  const reportHealth = document.getElementById('reportHealthText');
  if (reportHealth) {
    reportHealth.textContent = `Kadar kebolehgunaan semasa Makmal SKR 2 ialah ${pBaik}% (${baik} daripada ${total} unit berfungsi dengan baik).`;
  }
}

// ==========================================================
// EQUIPMENT TABLE & CRUD
// ==========================================================
function renderEquipmentTable() {
  const tbody = document.getElementById('equipmentTableBody');
  if (!tbody) return;

  const equipment = getEquipment();
  const searchInput = document.getElementById('searchEquipment');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const isAdmin = document.body.getAttribute('data-role') === 'Pentadbir';

  const filtered = equipment
    .map((eq, index) => ({ ...eq, originalIndex: index }))
    .filter(eq =>
      eq.id.toLowerCase().includes(query) ||
      eq.model.toLowerCase().includes(query) ||
      eq.serial.toLowerCase().includes(query) ||
      eq.location.toLowerCase().includes(query)
    );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${isAdmin ? 7 : 6}" style="text-align:center; padding: 20px; color: var(--muted);">Tiada rekod peralatan dijumpai.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(eq => `
    <tr>
      <td class="mono-text">${eq.id}</td>
      <td>${eq.model}</td>
      <td class="mono-text">${eq.serial}</td>
      <td>${eq.location}</td>
      <td><span class="badge ${getConditionClass(eq.condition)}">${eq.condition}</span></td>
      <td><span class="badge ${getStatusClass(eq.status)}">${eq.status}</span></td>
      ${isAdmin ? `
        <td class="admin-only" style="white-space: nowrap;">
          <button class="button button-outline" style="padding: 4px 10px; font-size: 12px;" onclick="openEditModal(${eq.originalIndex})">Edit</button>
          <button class="button button-outline" style="padding: 4px 10px; font-size: 12px; color: var(--danger); border-color: rgba(217, 102, 96, 0.35);" onclick="deleteEquipment(${eq.originalIndex})">Padam</button>
        </td>
      ` : ''}
    </tr>
  `).join('');
}

function openAddModal() {
  const modal = document.getElementById('equipmentModal');
  if (!modal) return;
  document.getElementById('equipmentForm').reset();
  document.getElementById('eqIndex').value = '-1';
  setElText('modalEquipmentTitle', 'Tambah Peralatan Baru');
  modal.showModal();
}

function openEditModal(index) {
  const modal = document.getElementById('equipmentModal');
  if (!modal) return;
  const eq = getEquipment()[index];
  if (!eq) return;

  document.getElementById('eqIndex').value = index;
  document.getElementById('eqId').value = eq.id;
  document.getElementById('eqModel').value = eq.model;
  document.getElementById('eqSerial').value = eq.serial;
  document.getElementById('eqLocation').value = eq.location;
  document.getElementById('eqCondition').value = eq.condition;
  document.getElementById('eqStatus').value = eq.status;

  setElText('modalEquipmentTitle', 'Kemaskini Peralatan');
  modal.showModal();
}

function closeAddModal() {
  const modal = document.getElementById('equipmentModal');
  if (modal) modal.close();
}

function saveEquipmentForm(event) {
  event.preventDefault();
  const equipment = getEquipment();
  const index = parseInt(document.getElementById('eqIndex').value, 10);

  const newRecord = {
    id: document.getElementById('eqId').value.trim(),
    model: document.getElementById('eqModel').value.trim(),
    serial: document.getElementById('eqSerial').value.trim(),
    location: document.getElementById('eqLocation').value.trim(),
    condition: document.getElementById('eqCondition').value,
    status: document.getElementById('eqStatus').value
  };

  if (index >= 0) {
    equipment[index] = newRecord;
    showToast(`Rekod ${newRecord.id} berjaya dikemaskini.`);
  } else {
    equipment.push(newRecord);
    showToast(`Peralatan ${newRecord.id} berjaya ditambah.`);
  }

  saveEquipment(equipment);
  closeAddModal();
  refreshAllUI();
}

function deleteEquipment(index) {
  const equipment = getEquipment();
  const target = equipment[index];
  if (!target) return;

  if (confirm(`Adakah anda pasti mahu memadam rekod ${target.id}?`)) {
    equipment.splice(index, 1);
    saveEquipment(equipment);
    refreshAllUI();
    showToast(`Rekod ${target.id} telah dipadam.`);
  }
}

// ==========================================================
// MAINTENANCE TABLE & MODAL
// ==========================================================
function renderMaintenanceTable() {
  const tbody = document.getElementById('maintenanceTableBody');
  if (!tbody) return;

  const logs = getMaintenanceLogs();
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--muted);">Tiada rekod penyelenggaraan.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(log => `
    <tr>
      <td class="mono-text">${log.id}</td>
      <td class="mono-text">${log.pcId}</td>
      <td>${log.type}</td>
      <td>${log.date}</td>
      <td>${log.notes}</td>
      <td><span class="badge ${getStatusClass(log.status)}">${log.status}</span></td>
    </tr>
  `).join('');
}

function openMaintenanceModal() {
  const modal = document.getElementById('maintenanceModal');
  if (!modal) return;

  const select = document.getElementById('maintPcId');
  const equipment = getEquipment();
  select.innerHTML = equipment.map(eq => `<option value="${eq.id}">${eq.id} — ${eq.model}</option>`).join('');

  document.getElementById('maintenanceForm').reset();
  document.getElementById('maintDate').value = new Date().toISOString().split('T')[0];
  modal.showModal();
}

function closeMaintenanceModal() {
  const modal = document.getElementById('maintenanceModal');
  if (modal) modal.close();
}

function saveMaintenanceForm(event) {
  event.preventDefault();
  const logs = getMaintenanceLogs();
  const nextNum = String(logs.length + 1).padStart(3, '0');

  const newLog = {
    id: `MNT-${nextNum}`,
    pcId: document.getElementById('maintPcId').value,
    type: document.getElementById('maintType').value,
    date: document.getElementById('maintDate').value,
    notes: document.getElementById('maintNotes').value.trim(),
    status: document.getElementById('maintStatus').value
  };

  logs.unshift(newLog);
  saveMaintenanceLogs(logs);
  closeMaintenanceModal();
  refreshAllUI();
  showToast(`Rekod ${newLog.id} berjaya disimpan.`);
}

// ==========================================================
// DIAGNOSTIC / PREDICTION MODULE
// ==========================================================
function populatePredictionDropdown() {
  const select = document.getElementById('selectPcPrediction');
  if (!select) return;

  const equipment = getEquipment();
  select.innerHTML = `<option value="">-- Pilih Komputer --</option>` +
    equipment.map(eq => `<option value="${eq.id}">${eq.id} (${eq.model})</option>`).join('');
}

function runPredictionAnalysis() {
  const pcId = document.getElementById('selectPcPrediction').value;
  if (!pcId || typeof analyzeEquipmentRisk !== 'function') return;

  const result = analyzeEquipmentRisk(pcId);
  if (!result) return;

  setElText('rulePcId', result.id);
  setElText('ruleRiskScore', result.riskScore);
  setElText('ruleNextSchedule', result.timeframe);

  const badge = document.getElementById('ruleRiskBadge');
  if (badge) {
    badge.textContent = result.badgeLabel;
    badge.className = `badge ${result.badgeType === 'repair' ? 'danger' : result.badgeType === 'attention' ? 'warning' : ''}`;
  }

  const list = document.getElementById('ruleActionList');
  if (list) {
    list.innerHTML = result.actions.map(a => `<li>${a}</li>`).join('');
  }
}

// ==========================================================
// HELPERS & TOASTS
// ==========================================================
function getConditionClass(condition) {
  if (condition === 'Rosak') return 'danger';
  if (condition === 'Perlu diperiksa') return 'warning';
  return '';
}

function getStatusClass(status) {
  if (status === 'Penyelenggaraan' || status === 'Belum Selesai') return 'danger';
  if (status === 'Perlu perhatian' || status === 'Dalam Proses') return 'warning';
  return '';
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}