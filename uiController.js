/* ==========================================================
   MAIN UI CONTROLLER MODULE (uiController.js)
   Clean Single-Language Version (Bahasa Melayu)
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderDashboard();
  renderEquipmentTable();
  renderMaintenanceTable();
  populatePredictionDropdown();
  updateDashboardVisuals();

  // Reset scroll position to top on initial page load
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 50);
});

/* SIDEBAR & SECTION NAVIGATION */
function toggleSidebar() {
  document.body.classList.toggle('sidebar-collapsed');
}

function showSection(sectionId, linkEl, event) {
  if (event && event.preventDefault) event.preventDefault();

  document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active-section'));
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => link.classList.remove('active'));

  const targetSec = document.getElementById(sectionId);
  if (targetSec) targetSec.classList.add('active-section');
  if (linkEl) linkEl.classList.add('active');

  const titles = {
    'dashboard': ['Papan Pemuka', 'Ringkasan keadaan komputer dan status sistem di Makmal SKR 2.'],
    'peralatan': ['Senarai Peralatan', 'Pengurusan data komputer dan spesifikasi di Makmal SKR 2.'],
    'penyelenggaraan': ['Rekod Penyelenggaraan', 'Sejarah tindakan penyelenggaraan dan catatan teknikal juruteknik.'],
    'modul-ramalan': ['Modul Ramalan', 'Analisis sejarah kerosakan dan cadangan pembaikan berjadual.'],
    'laporan': ['Laporan Status', 'Laporan rasmi bagi kegunaan Penyelia Makmal dan Pentadbir.']
  };

  if (titles[sectionId]) {
    document.getElementById('pageTitle').textContent = titles[sectionId][0];
    document.getElementById('pageSubtitle').textContent = titles[sectionId][1];
  }

  if (sectionId === 'dashboard') updateDashboardVisuals();

  // Delay scroll to run AFTER browser hash anchor positioning completes
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 0);
}

/* USER ROLE MANAGEMENT */
function changeUserRole(role) {
  document.body.setAttribute('data-role', role);
  document.getElementById('userName').textContent = role;
  document.getElementById('userAvatar').textContent = role.charAt(0);
  showToast(`Peranan ditukar kepada: ${role}`, 'info');
}

/* TOAST NOTIFICATIONS */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/* DASHBOARD RENDER & VISUALIZATIONS */
function renderDashboard() {
  const list = getEquipmentData();
  const logs = getMaintenanceData();

  const total = list.length;
  const baik = list.filter(e => e.condition === 'Baik').length;
  const perhatian = list.filter(e => e.condition === 'Perlu diperiksa').length;
  const rosak = list.filter(e => e.condition === 'Rosak').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statBaik').textContent = baik;
  document.getElementById('statPerhatian').textContent = perhatian;
  document.getElementById('statRosak').textContent = rosak;

  const tbody = document.getElementById('dashboardTableBody');
  if (tbody) {
    tbody.innerHTML = list.slice(0, 3).map(e => `
      <tr>
        <td>${e.id}</td>
        <td>${e.model}</td>
        <td>${e.serial}</td>
        <td><span class="badge ${e.condition === 'Baik' ? 'available' : e.condition === 'Rosak' ? 'repair' : 'attention'}">${e.condition}</span></td>
        <td>${e.status}</td>
      </tr>
    `).join('');
  }

  const alertText = document.getElementById('maintenanceAlertText');
  if (alertText) {
    if (rosak > 0) {
      alertText.textContent = `Terdapat ${rosak} komputer dalam keadaan rosak/penyelenggaraan yang memerlukan tindakan segera.`;
    } else {
      alertText.textContent = `Semua peralatan berfungsi dengan stabil. Tiada kerosakan kritikal dikesan.`;
    }
  }

  document.getElementById('repTotal').textContent = total;
  document.getElementById('repGood').textContent = baik;
  document.getElementById('repMaintenance').textContent = perhatian + rosak;
  document.getElementById('repLogsCount').textContent = logs.length;
}

function updateDashboardVisuals() {
  const list = getEquipmentData();
  const total = list.length;
  if (total === 0) return;

  const baik = list.filter(e => e.condition === 'Baik').length;
  const perhatian = list.filter(e => e.condition === 'Perlu diperiksa').length;
  const rosak = list.filter(e => e.condition === 'Rosak').length;

  const baikPct = Math.round((baik / total) * 100);
  const perhatianPct = Math.round((perhatian / total) * 100);
  const rosakPct = 100 - baikPct - perhatianPct;

  const barBaik = document.getElementById('barBaik');
  const barPerhatian = document.getElementById('barPerhatian');
  const barRosak = document.getElementById('barRosak');

  if (barBaik) barBaik.style.width = `${baikPct}%`;
  if (barPerhatian) barPerhatian.style.width = `${perhatianPct}%`;
  if (barRosak) barRosak.style.width = `${rosakPct}%`;

  const healthRatio = document.getElementById('visualHealthRatio');
  if (healthRatio) {
    healthRatio.textContent = `${baikPct}% Sedia Digunakan`;
  }

  document.getElementById('legendBaikCount').textContent = baik;
  document.getElementById('legendPerhatianCount').textContent = perhatian;
  document.getElementById('legendRosakCount').textContent = rosak;
}

/* EQUIPMENT TABLE RENDER */
function renderEquipmentTable() {
  const query = (document.getElementById('searchEquipment')?.value || '').toLowerCase();
  const list = getEquipmentData().filter(e => 
    e.id.toLowerCase().includes(query) ||
    e.model.toLowerCase().includes(query) ||
    e.serial.toLowerCase().includes(query)
  );

  const tbody = document.getElementById('equipmentTableBody');
  if (!tbody) return;

  tbody.innerHTML = list.map((e, idx) => `
    <tr>
      <td>${e.id}</td>
      <td>${e.model}</td>
      <td>${e.serial}</td>
      <td>${e.location}</td>
      <td><span class="badge ${e.condition === 'Baik' ? 'available' : e.condition === 'Rosak' ? 'repair' : 'attention'}">${e.condition}</span></td>
      <td>${e.status}</td>
      <td class="admin-only">
        <button class="button-link" onclick="openEditModal(${idx})">Edit</button> | 
        <button class="button-link button-danger" onclick="deleteEquipment('${e.id}')">Padam</button>
      </td>
    </tr>
  `).join('');
}

/* MAINTENANCE TABLE RENDER */
function renderMaintenanceTable() {
  const logs = getMaintenanceData();
  const tbody = document.getElementById('maintenanceTableBody');
  if (!tbody) return;

  tbody.innerHTML = logs.map(m => `
    <tr>
      <td>${m.id}</td>
      <td>${m.equipmentId}</td>
      <td>${m.type}</td>
      <td>${m.date}</td>
      <td>${m.notes}</td>
      <td><span class="badge ${m.status === 'Selesai' ? 'available' : 'attention'}">${m.status}</span></td>
    </tr>
  `).join('');
}

/* MODAL HANDLERS */
function openAddModal() {
  document.getElementById('equipmentForm').reset();
  document.getElementById('eqIndex').value = '-1';
  document.getElementById('modalEquipmentTitle').textContent = 'Tambah Peralatan Baru';
  document.getElementById('equipmentModal').showModal();
}

function openEditModal(index) {
  const list = getEquipmentData();
  const item = list[index];
  if (!item) return;

  document.getElementById('eqIndex').value = index;
  document.getElementById('eqId').value = item.id;
  document.getElementById('eqModel').value = item.model;
  document.getElementById('eqSerial').value = item.serial;
  document.getElementById('eqLocation').value = item.location;
  document.getElementById('eqCondition').value = item.condition;
  document.getElementById('eqStatus').value = item.status;

  document.getElementById('modalEquipmentTitle').textContent = 'Kemaskini Peralatan';
  document.getElementById('equipmentModal').showModal();
}

function closeAddModal() { document.getElementById('equipmentModal').close(); }

function saveEquipmentForm(e) {
  e.preventDefault();
  const idx = parseInt(document.getElementById('eqIndex').value);
  const item = {
    id: document.getElementById('eqId').value,
    model: document.getElementById('eqModel').value,
    serial: document.getElementById('eqSerial').value,
    location: document.getElementById('eqLocation').value,
    condition: document.getElementById('eqCondition').value,
    status: document.getElementById('eqStatus').value
  };

  addOrUpdateEquipment(item, idx);
  closeAddModal();
  renderDashboard();
  renderEquipmentTable();
  populatePredictionDropdown();
  updateDashboardVisuals();
  showToast('Rekod peralatan berjaya disimpan!', 'success');
}

function deleteEquipment(id) {
  if (confirm(`Adakah anda pasti untuk memadam ${id}?`)) {
    deleteEquipmentById(id);
    renderDashboard();
    renderEquipmentTable();
    populatePredictionDropdown();
    updateDashboardVisuals();
    showToast(`Peralatan ${id} telah dipadam.`, 'warning');
  }
}

function openMaintenanceModal() {
  const select = document.getElementById('maintPcId');
  select.innerHTML = getEquipmentData().map(e => `<option value="${e.id}">${e.id} (${e.model})</option>`).join('');
  document.getElementById('maintDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('maintenanceModal').showModal();
}

function closeMaintenanceModal() { document.getElementById('maintenanceModal').close(); }

function saveMaintenanceForm(e) {
  e.preventDefault();
  const record = {
    id: `MNT-2026-00${getMaintenanceData().length + 1}`,
    equipmentId: document.getElementById('maintPcId').value,
    type: document.getElementById('maintType').value,
    date: document.getElementById('maintDate').value,
    notes: document.getElementById('maintNotes').value,
    status: document.getElementById('maintStatus').value
  };

  addMaintenanceRecord(record);
  closeMaintenanceModal();
  renderMaintenanceTable();
  renderDashboard();
  showToast('Rekod penyelenggaraan berjaya ditambah!', 'success');
}

/* DIAGNOSTIC RUNNER */
function populatePredictionDropdown() {
  const select = document.getElementById('selectPcPrediction');
  if (!select) return;

  const list = getEquipmentData();
  select.innerHTML = '<option value="">-- Pilih Komputer --</option>' + 
    list.map(e => `<option value="${e.id}">${e.id} - ${e.model}</option>`).join('');
}

function runPredictionAnalysis() {
  const id = document.getElementById('selectPcPrediction').value;
  if (!id) return;

  const res = analyzeEquipmentRisk(id);
  if (!res) return;

  document.getElementById('rulePcId').textContent = res.id;
  document.getElementById('ruleRiskScore').textContent = res.riskScore;
  document.getElementById('ruleNextSchedule').textContent = res.timeframe;
  
  const badge = document.getElementById('ruleRiskBadge');
  badge.className = `badge ${res.badgeType}`;
  badge.textContent = res.badgeLabel;

  const list = document.getElementById('ruleActionList');
  list.innerHTML = res.actions.map(act => `<li>${act}</li>`).join('');
}