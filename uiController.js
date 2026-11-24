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

// Safe DOM helper
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

  // Update Report Stats safely
  setElText('repTotal', total);
  setElText('repGood', baik);
  setElText('repMaintenance', perhatian + rosak);
  setElText('repLogsCount', logs.length);

  updateDashboardVisuals(total, baik, perhatian, rosak);

  // Maintenance Alert Banner
  const alertEl = document.getElementById('maintenanceAlertText');
  if (alertEl) {
    if (rosak > 0 || perhatian > 0) {
      alertEl.textContent = `Terdapat ${rosak} komputer rosak dan ${perhatian} komputer memerlukan pemeriksaan segera.`;
    } else {
      alertEl.textContent = 'Semua peralatan komputer berada dalam keadaan baik dan sedia digunakan.';
    }
  }

  // Dashboard Mini Table (Latest 5)
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
    tbody.innerHTML = `<tr><td colspan="${isAdmin ? 7 : 6}" style="text-align:center; padding: 20px; color: var(--text-muted);">Tiada rekod peralatan dijumpai.</td></tr>`;
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
        <td class="admin-only">
          <button class="button-small" onclick="openEditModal(${eq.originalIndex})">Edit</button>
          <button class="button-small danger" onclick="deleteEquipment(${eq.originalIndex})">Padam</button>
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

// =