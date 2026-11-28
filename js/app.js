import { onDashboardAuth, logout } from "./auth.js";
import {
  loadAllData,
  getState,
  initDefaultLabsAndBrands,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  createMaintenanceLog,
  updateMaintenanceLog,
  deleteMaintenanceLog,
  saveLab,
  deleteLab,
  saveBrand,
  deleteBrand,
  updateUserRole
} from "./storage.js";
import { analyzeEquipmentRisk } from "./predictionEngine.js";
import { initCommandPalette } from "./commandPalette.js";
import { renderOfficialReport, triggerOfficialPrint } from "./printReport.js";

const THEME_STORAGE_KEY = "rcems_theme";

const ROLE_PERMISSIONS = {
  Pentadbir: {
    sections: ["dashboard", "peralatan", "penyelenggaraan", "modul-ramalan", "laporan", "tetapan"],
    canEditEquipment: true,
    canManageMaintenance: true,
    canDeleteMaintenance: true,
    canManageSettings: true
  },
  Juruteknik: {
    sections: ["dashboard", "peralatan", "penyelenggaraan", "modul-ramalan"],
    canEditEquipment: false,
    canManageMaintenance: true,
    canDeleteMaintenance: false,
    canManageSettings: false
  },
  Penyelia: {
    sections: ["dashboard", "peralatan", "penyelenggaraan", "laporan"],
    canEditEquipment: false,
    canManageMaintenance: false,
    canDeleteMaintenance: false,
    canManageSettings: false
  }
};

const CONDITION_SEVERITY = {
  "Rosak": 3,
  "Perlu diperiksa": 2,
  "Baik": 1
};

let currentUser = null;
let currentProfile = null;
let selectedLabId = "ALL";
let currentPermissions = ROLE_PERMISSIONS.Penyelia;
let confirmResolver = null;

let eqConditionFilter = "ALL";
let eqStatusFilter = "ALL";
let eqSort = { key: "condition", dir: "desc" };

let maintStatusFilter = "ALL";
let maintTypeFilter = "ALL";
let maintSort = { key: "date", dir: "desc" };

let highlightedEquipmentId = null;
let highlightedLogId = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;
  localStorage.setItem(THEME_STORAGE_KEY, normalized);

  const sunIcon = document.getElementById("themeIconSun");
  const moonIcon = document.getElementById("themeIconMoon");
  if (sunIcon && moonIcon) {
    sunIcon.hidden = normalized === "light";
    moonIcon.hidden = normalized === "dark";
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
}

function closeMobileSidebar() {
  document.getElementById("sidebar")?.classList.remove("mobile-open");
  document.getElementById("sidebarBackdrop")?.classList.remove("open");
}

function openConfirmDialog({ title, message, confirmLabel = "Sahkan", danger = false }) {
  const modal = document.getElementById("confirmModal");
  if (!modal) return Promise.resolve(false);

  setElText("confirmTitle", title);
  setElText("confirmMessage", message);
  const okBtn = document.getElementById("confirmOkBtn");
  okBtn.textContent = confirmLabel;
  okBtn.className = danger ? "button button-danger" : "button";

  modal.showModal();
  return new Promise(resolve => {
    confirmResolver = resolve;
  });
}

function getScopedData() {
  const state = getState();
  const equipment = selectedLabId === "ALL"
    ? state.equipment
    : state.equipment.filter(e => e.labId === selectedLabId);
  const maintenanceLogs = selectedLabId === "ALL"
    ? state.maintenanceLogs
    : state.maintenanceLogs.filter(m => m.labId === selectedLabId);
  return { ...state, equipment, maintenanceLogs };
}

function getConditionClass(condition) {
  if (condition === "Rosak") return "danger";
  if (condition === "Perlu diperiksa") return "warning";
  return "";
}

function getStatusClass(status) {
  if (status === "Penyelenggaraan" || status === "Belum Selesai") return "danger";
  if (status === "Perlu perhatian" || status === "Dalam Proses") return "warning";
  return "";
}

function getRowHighlightClass(condition) {
  if (condition === "Rosak") return "row-danger";
  if (condition === "Perlu diperiksa") return "row-warning";
  return "";
}

function applyRolePermissions(role) {
  currentPermissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Penyelia;
  document.body.dataset.role = role;

  document.querySelectorAll("#sidebarNav .nav-link").forEach(link => {
    if (!currentPermissions.sections.includes(link.dataset.section)) {
      link.remove();
    }
  });

  document.querySelectorAll(".content-section").forEach(sec => {
    if (!currentPermissions.sections.includes(sec.id)) {
      sec.remove();
    }
  });

  if (!currentPermissions.canEditEquipment) {
    document.querySelectorAll(".admin-only").forEach(el => el.remove());
  }

  if (!currentPermissions.canManageMaintenance) {
    document.querySelectorAll(".tech-only").forEach(el => el.remove());
  }
}

function showSection(sectionId) {
  if (!currentPermissions.sections.includes(sectionId)) return;

  document.querySelectorAll(".content-section").forEach(sec => {
    sec.classList.toggle("active-section", sec.id === sectionId);
  });

  document.querySelectorAll("#sidebarNav .nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.section === sectionId);
  });

  closeMobileSidebar();

  if (sectionId === "modul-ramalan") {
    populatePredictionDropdown();
  }
  if (sectionId === "laporan") {
    renderReportPreview();
  }
}

function populateLabSwitcher() {
  const select = document.getElementById("labSwitcher");
  if (!select) return;
  const { labs } = getState();
  const prev = selectedLabId;

  select.innerHTML = `<option value="ALL">Semua Makmal</option>` +
    labs.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join("");

  if (prev === "ALL" || labs.some(l => l.id === prev)) {
    select.value = prev;
  } else {
    selectedLabId = "ALL";
    select.value = "ALL";
  }
}

function renderDashboard() {
  const { equipment, labs } = getScopedData();

  const total = equipment.length;
  const baik = equipment.filter(e => e.condition === "Baik").length;
  const perhatian = equipment.filter(e => e.condition === "Perlu diperiksa").length;
  const rosak = equipment.filter(e => e.condition === "Rosak").length;

  setElText("statTotal", total);
  setElText("statBaik", baik);
  setElText("statPerhatian", perhatian);
  setElText("statRosak", rosak);

  const pBaik = total > 0 ? Math.round((baik / total) * 100) : 0;
  setElText("visualHealthRatio", `${pBaik}% Sedia Digunakan`);

  const validSum = baik + perhatian + rosak;
  const barBaik = document.getElementById("barBaik");
  const barPerhatian = document.getElementById("barPerhatian");
  const barRosak = document.getElementById("barRosak");
  if (barBaik) barBaik.style.flex = validSum > 0 ? String(baik) : "0";
  if (barPerhatian) barPerhatian.style.flex = validSum > 0 ? String(perhatian) : "0";
  if (barRosak) barRosak.style.flex = validSum > 0 ? String(rosak) : "0";

  setElText("legendBaikCount", baik);
  setElText("legendPerhatianCount", perhatian);
  setElText("legendRosakCount", rosak);

  const alertBanner = document.getElementById("topAlertBanner");
  const alertTitle = document.getElementById("alertBannerTitle");
  const alertText = document.getElementById("maintenanceAlertText");
  const alertBtn = document.getElementById("alertActionBtn");
  if (alertBanner && alertText) {
    if (rosak > 0 || perhatian > 0) {
      const affectedIds = [...new Set(equipment.filter(e => e.condition !== "Baik").map(e => e.labId))];
      const labLabels = affectedIds.map(id => labs.find(l => l.id === id)?.name || id);
      alertBanner.hidden = false;
      alertBanner.classList.toggle("alert-critical", rosak > 0);
      if (alertTitle) {
        alertTitle.textContent = rosak > 0 ? "Amaran Kerosakan Peralatan" : "Pemeriksaan Peralatan Diperlukan";
      }
      alertText.textContent = `${rosak} komputer rosak dan ${perhatian} perlu diperiksa (${labLabels.join(", ")}).`;
      if (alertBtn) {
        alertBtn.textContent = rosak > 0 ? "Semak Komputer Rosak →" : "Semak Peralatan →";
        alertBtn.dataset.targetCondition = rosak > 0 ? "Rosak" : "Perlu diperiksa";
      }
    } else {
      alertBanner.hidden = true;
    }
  }

  const dashBody = document.getElementById("dashboardTableBody");
  if (dashBody) {
    if (equipment.length === 0) {
      dashBody.innerHTML = `<tr><td colspan="6" class="empty-cell">Tiada peralatan berdaftar untuk paparan ini.</td></tr>`;
    } else {
      const prioritized = [...equipment].sort((a, b) => {
        const diff = (CONDITION_SEVERITY[b.condition] || 0) - (CONDITION_SEVERITY[a.condition] || 0);
        return diff !== 0 ? diff : a.pcCode.localeCompare(b.pcCode);
      });

      dashBody.innerHTML = prioritized.slice(0, 6).map(eq => `
        <tr class="${getRowHighlightClass(eq.condition)}">
          <td class="mono-text">${escapeHtml(eq.pcCode)}</td>
          <td>${escapeHtml(eq.labId)}</td>
          <td>${escapeHtml(eq.brand)} ${escapeHtml(eq.model)}</td>
          <td class="mono-text">${escapeHtml(eq.serial)}</td>
          <td><span class="badge ${getConditionClass(eq.condition)}">${escapeHtml(eq.condition)}</span></td>
          <td><span class="badge ${getStatusClass(eq.status)}">${escapeHtml(eq.status)}</span></td>
        </tr>
      `).join("");
    }
  }
}

function updateSortIndicators(tableId, sortState) {
  document.querySelectorAll(`#${tableId} thead th[data-sort]`).forEach(th => {
    const indicator = th.querySelector(".sort-indicator");
    if (!indicator) return;
    if (th.dataset.sort === sortState.key) {
      indicator.textContent = sortState.dir === "asc" ? "↑" : "↓";
    } else {
      indicator.textContent = "";
    }
  });
}

function setEquipmentConditionPill(condition) {
  eqConditionFilter = condition;
  document.querySelectorAll("#equipmentConditionPills .filter-pill").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.condition === condition);
  });
}

function renderEquipmentTable() {
  const tbody = document.getElementById("equipmentTableBody");
  if (!tbody) return;

  const { equipment } = getScopedData();
  const query = (document.getElementById("searchEquipment")?.value || "").trim().toLowerCase();
  const canEdit = currentPermissions.canEditEquipment;

  const filtered = equipment.filter(eq => {
    const matchesCondition = eqConditionFilter === "ALL" || eq.condition === eqConditionFilter;
    const matchesStatus = eqStatusFilter === "ALL" || eq.status === eqStatusFilter;
    const matchesQuery =
      !query ||
      eq.pcCode.toLowerCase().includes(query) ||
      eq.labId.toLowerCase().includes(query) ||
      eq.brand.toLowerCase().includes(query) ||
      eq.model.toLowerCase().includes(query) ||
      eq.serial.toLowerCase().includes(query) ||
      eq.location.toLowerCase().includes(query);
    return matchesCondition && matchesStatus && matchesQuery;
  });

  filtered.sort((a, b) => {
    const dir = eqSort.dir === "asc" ? 1 : -1;
    if (eqSort.key === "condition") {
      return ((CONDITION_SEVERITY[a.condition] || 0) - (CONDITION_SEVERITY[b.condition] || 0)) * dir;
    }
    if (eqSort.key === "model") {
      return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`) * dir;
    }
    return String(a[eqSort.key] || "").localeCompare(String(b[eqSort.key] || "")) * dir;
  });

  updateSortIndicators("equipmentTable", eqSort);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${canEdit ? 8 : 7}" class="empty-cell">Tiada rekod peralatan sepadan dengan penapis.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(eq => {
    const rowClasses = [
      getRowHighlightClass(eq.condition),
      eq.id === highlightedEquipmentId ? "row-flash" : ""
    ].filter(Boolean).join(" ");

    return `
      <tr class="${rowClasses}" data-eq-id="${escapeHtml(eq.id)}">
        <td class="mono-text">${escapeHtml(eq.pcCode)}</td>
        <td>${escapeHtml(eq.labId)}</td>
        <td>${escapeHtml(eq.brand)} ${escapeHtml(eq.model)}</td>
        <td class="mono-text">${escapeHtml(eq.serial)}</td>
        <td>${escapeHtml(eq.location)}</td>
        <td><span class="badge ${getConditionClass(eq.condition)}">${escapeHtml(eq.condition)}</span></td>
        <td><span class="badge ${getStatusClass(eq.status)}">${escapeHtml(eq.status)}</span></td>
        ${canEdit ? `
          <td class="actions-cell">
            <button type="button" class="button button-outline btn-sm" data-action="edit-eq" data-id="${escapeHtml(eq.id)}">Edit</button>
            <button type="button" class="button button-outline btn-sm btn-danger-outline" data-action="del-eq" data-id="${escapeHtml(eq.id)}">Padam</button>
          </td>
        ` : ""}
      </tr>
    `;
  }).join("");
}

function renderMaintenanceTable() {
  const tbody = document.getElementById("maintenanceTableBody");
  if (!tbody) return;

  const { maintenanceLogs } = getScopedData();
  const query = (document.getElementById("searchMaintenance")?.value || "").trim().toLowerCase();
  const canManage = currentPermissions.canManageMaintenance;
  const canDelete = currentPermissions.canDeleteMaintenance;

  const filtered = maintenanceLogs.filter(log => {
    const matchesStatus = maintStatusFilter === "ALL" || log.status === maintStatusFilter;
    const matchesType = maintTypeFilter === "ALL" || log.type === maintTypeFilter;
    const matchesQuery =
      !query ||
      log.logCode.toLowerCase().includes(query) ||
      log.pcCode.toLowerCase().includes(query) ||
      log.labId.toLowerCase().includes(query) ||
      log.notes.toLowerCase().includes(query) ||
      log.status.toLowerCase().includes(query);
    return matchesStatus && matchesType && matchesQuery;
  });

  filtered.sort((a, b) => {
    const dir = maintSort.dir === "asc" ? 1 : -1;
    return String(a[maintSort.key] || "").localeCompare(String(b[maintSort.key] || "")) * dir;
  });

  updateSortIndicators("maintenanceTable", maintSort);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${canManage ? 8 : 7}" class="empty-cell">Tiada rekod penyelenggaraan sepadan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(log => {
    const rowClasses = [
      log.status !== "Selesai" ? "row-warning" : "",
      log.id === highlightedLogId ? "row-flash" : ""
    ].filter(Boolean).join(" ");

    return `
      <tr class="${rowClasses}" data-log-id="${escapeHtml(log.id)}">
        <td class="mono-text">${escapeHtml(log.logCode)}</td>
        <td class="mono-text">${escapeHtml(log.pcCode)}</td>
        <td>${escapeHtml(log.labId)}</td>
        <td>${escapeHtml(log.type)}</td>
        <td>${escapeHtml(log.date)}</td>
        <td class="notes-cell">${escapeHtml(log.notes)}</td>
        <td><span class="badge ${getStatusClass(log.status)}">${escapeHtml(log.status)}</span></td>
        ${canManage ? `
          <td class="actions-cell">
            <button type="button" class="button button-outline btn-sm" data-action="edit-log" data-id="${escapeHtml(log.id)}">Kemaskini</button>
            ${canDelete ? `<button type="button" class="button button-outline btn-sm btn-danger-outline" data-action="del-log" data-id="${escapeHtml(log.id)}">Padam</button>` : ""}
          </td>
        ` : ""}
      </tr>
    `;
  }).join("");
}

function populatePredictionDropdown() {
  const select = document.getElementById("selectPcPrediction");
  if (!select) return;

  const { equipment } = getScopedData();
  const prev = select.value;

  select.innerHTML = `<option value="">-- Pilih Komputer --</option>` +
    equipment.map(eq => `<option value="${escapeHtml(eq.id)}">${escapeHtml(eq.pcCode)} (${escapeHtml(eq.labId)} · ${escapeHtml(eq.brand)} ${escapeHtml(eq.model)})</option>`).join("");

  if (prev && equipment.some(e => e.id === prev)) {
    select.value = prev;
    runPredictionAnalysis();
  } else {
    resetPredictionResult();
  }
}

function resetPredictionResult() {
  setElText("rulePcId", "-");
  setElText("ruleRiskScore", "0%");
  setElText("ruleNextSchedule", "-");
  const badge = document.getElementById("ruleRiskBadge");
  if (badge) {
    badge.textContent = "Menunggu Analisis";
    badge.className = "badge";
  }
  const list = document.getElementById("ruleActionList");
  if (list) {
    list.innerHTML = `<li>Sila pilih komputer di atas.</li>`;
  }
}

function runPredictionAnalysis() {
  const select = document.getElementById("selectPcPrediction");
  if (!select) return;
  const eqId = select.value;

  if (!eqId) {
    resetPredictionResult();
    return;
  }

  const { equipment, maintenanceLogs } = getState();
  const result = analyzeEquipmentRisk(eqId, equipment, maintenanceLogs);
  if (!result) {
    resetPredictionResult();
    return;
  }

  setElText("rulePcId", result.pcCode);
  setElText("ruleRiskScore", result.riskScoreLabel);
  setElText("ruleNextSchedule", result.timeframe);

  const badge = document.getElementById("ruleRiskBadge");
  if (badge) {
    badge.textContent = result.badgeLabel;
    badge.className = `badge ${result.badgeType === "danger" ? "danger" : result.badgeType === "warning" ? "warning" : ""}`;
  }

  const list = document.getElementById("ruleActionList");
  if (list) {
    list.innerHTML = result.actions.map(a => `<li>${escapeHtml(a)}</li>`).join("");
  }
}

function renderReportPreview() {
  if (!currentPermissions.sections.includes("laporan")) return;
  const container = document.getElementById("printArea");
  const { labs, equipment, maintenanceLogs } = getScopedData();
  renderOfficialReport({
    container,
    selectedLabId,
    labs,
    equipment,
    maintenanceLogs,
    profile: currentProfile
  });
}

function renderSettingsSection() {
  if (!currentPermissions.canManageSettings) return;
  const { labs, brands, users } = getState();

  const labsList = document.getElementById("settingsLabsList");
  if (labsList) {
    labsList.innerHTML = labs.length === 0
      ? `<p class="muted-text">Tiada makmal dikonfigurasi.</p>`
      : labs.map(l => `
        <div class="settings-item">
          <div>
            <strong>${escapeHtml(l.name)}</strong> <span class="mono-text">(${escapeHtml(l.id)})</span>
            <small>${escapeHtml(l.rowsConfig.join(", "))} · ${l.seatsPerRow} meja/baris</small>
          </div>
          <div class="actions-cell">
            <button type="button" class="button button-outline btn-sm" data-action="edit-lab" data-id="${escapeHtml(l.id)}">Edit</button>
            <button type="button" class="button button-outline btn-sm btn-danger-outline" data-action="del-lab" data-id="${escapeHtml(l.id)}">Padam</button>
          </div>
        </div>
      `).join("");
  }

  const brandsList = document.getElementById("settingsBrandsList");
  if (brandsList) {
    brandsList.innerHTML = brands.length === 0
      ? `<p class="muted-text">Tiada jenama dikonfigurasi.</p>`
      : brands.map(b => `
        <div class="settings-item">
          <div>
            <strong>${escapeHtml(b.name)}</strong>
            <small>${escapeHtml(b.models.join(", ") || "Tiada model")}</small>
          </div>
          <div class="actions-cell">
            <button type="button" class="button button-outline btn-sm" data-action="edit-brand" data-id="${escapeHtml(b.id)}">Edit</button>
            <button type="button" class="button button-outline btn-sm btn-danger-outline" data-action="del-brand" data-id="${escapeHtml(b.id)}">Padam</button>
          </div>
        </div>
      `).join("");
  }

  const usersBody = document.getElementById("settingsUsersBody");
  if (usersBody) {
    usersBody.innerHTML = users.map(u => {
      const isSelf = u.uid === currentUser?.uid;
      return `
        <tr>
          <td>${escapeHtml(u.name)}</td>
          <td class="mono-text">${escapeHtml(u.email)}</td>
          <td>
            <select class="input-field role-select" data-action="change-role" data-uid="${escapeHtml(u.uid)}" ${isSelf ? "disabled" : ""}>
              <option value="Pentadbir" ${u.role === "Pentadbir" ? "selected" : ""}>Pentadbir</option>
              <option value="Juruteknik" ${u.role === "Juruteknik" ? "selected" : ""}>Juruteknik</option>
              <option value="Penyelia" ${u.role === "Penyelia" ? "selected" : ""}>Penyelia</option>
            </select>
          </td>
        </tr>
      `;
    }).join("");
  }
}

function populateEquipmentModalDropdowns(selectedLab = null, selectedBrand = null, selectedModel = null, selectedRow = null, selectedSeat = null) {
  const { labs, brands } = getState();
  const labSelect = document.getElementById("eqLab");
  const brandSelect = document.getElementById("eqBrand");

  labSelect.innerHTML = labs.length > 0
    ? labs.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join("")
    : `<option value="SKR-2">Makmal SKR 2</option>`;

  if (selectedLab && labs.some(l => l.id === selectedLab)) {
    labSelect.value = selectedLab;
  } else if (selectedLabId !== "ALL" && labs.some(l => l.id === selectedLabId)) {
    labSelect.value = selectedLabId;
  }

  brandSelect.innerHTML = brands.length > 0
    ? brands.map(b => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)}</option>`).join("")
    : `<option value="Lain-lain">Lain-lain</option>`;

  if (selectedBrand) {
    if (![...brandSelect.options].some(o => o.value === selectedBrand)) {
      brandSelect.add(new Option(selectedBrand, selectedBrand));
    }
    brandSelect.value = selectedBrand;
  }

  updateLabLocationDropdowns(selectedRow, selectedSeat);
  updateBrandModelDropdown(selectedModel);
}

function updateLabLocationDropdowns(selectedRow = null, selectedSeat = null) {
  const { labs } = getState();
  const labId = document.getElementById("eqLab").value;
  const lab = labs.find(l => l.id === labId) || { rowsConfig: ["Baris A", "Baris B", "Baris C"], seatsPerRow: 10 };

  const rowSelect = document.getElementById("eqRow");
  const seatSelect = document.getElementById("eqSeat");

  rowSelect.innerHTML = lab.rowsConfig.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
  if (selectedRow) {
    if (![...rowSelect.options].some(o => o.value === selectedRow)) {
      rowSelect.add(new Option(selectedRow, selectedRow));
    }
    rowSelect.value = selectedRow;
  }

  const seats = [];
  for (let i = 1; i <= lab.seatsPerRow; i++) {
    seats.push(`<option value="${i}">Meja ${i}</option>`);
  }
  seatSelect.innerHTML = seats.join("");
  if (selectedSeat) {
    if (![...seatSelect.options].some(o => Number(o.value) === Number(selectedSeat))) {
      seatSelect.add(new Option(`Meja ${selectedSeat}`, String(selectedSeat)));
    }
    seatSelect.value = String(selectedSeat);
  }
}

function updateBrandModelDropdown(selectedModel = null) {
  const { brands } = getState();
  const brandName = document.getElementById("eqBrand").value;
  const brand = brands.find(b => b.name === brandName);
  const modelSelect = document.getElementById("eqModel");

  const models = brand && brand.models.length > 0 ? brand.models : ["Model Standard"];
  modelSelect.innerHTML = models.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");

  if (selectedModel) {
    if (![...modelSelect.options].some(o => o.value === selectedModel)) {
      modelSelect.add(new Option(selectedModel, selectedModel));
    }
    modelSelect.value = selectedModel;
  }
}

function openAddEquipmentModal() {
  if (!currentPermissions.canEditEquipment) return;
  const modal = document.getElementById("equipmentModal");
  document.getElementById("equipmentForm").reset();
  document.getElementById("eqEditId").value = "";
  setElText("modalEquipmentTitle", "Tambah Peralatan Baru");
  populateEquipmentModalDropdowns();
  modal.showModal();
}

function openEditEquipmentModal(id) {
  if (!currentPermissions.canEditEquipment) return;
  const eq = getState().equipment.find(e => e.id === id);
  if (!eq) return;

  const modal = document.getElementById("equipmentModal");
  document.getElementById("eqEditId").value = eq.id;
  document.getElementById("eqId").value = eq.pcCode;
  document.getElementById("eqSerial").value = eq.serial;
  document.getElementById("eqCondition").value = eq.condition;
  document.getElementById("eqStatus").value = eq.status;
  setElText("modalEquipmentTitle", "Kemaskini Peralatan");
  populateEquipmentModalDropdowns(eq.labId, eq.brand, eq.model, eq.rowLabel, eq.seatNumber);
  modal.showModal();
}

async function handleEquipmentSubmit(event) {
  event.preventDefault();
  if (!currentPermissions.canEditEquipment) return;

  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const editId = document.getElementById("eqEditId").value;

  const payload = {
    labId: document.getElementById("eqLab").value,
    pcCode: document.getElementById("eqId").value.trim(),
    brand: document.getElementById("eqBrand").value,
    model: document.getElementById("eqModel").value,
    serial: document.getElementById("eqSerial").value.trim(),
    rowLabel: document.getElementById("eqRow").value,
    seatNumber: Number(document.getElementById("eqSeat").value),
    condition: document.getElementById("eqCondition").value,
    status: document.getElementById("eqStatus").value
  };

  submitBtn.disabled = true;
  try {
    if (editId) {
      await updateEquipment(editId, payload);
      showToast(`Rekod ${payload.pcCode} berjaya dikemaskini.`, "success");
    } else {
      await createEquipment(payload);
      showToast(`Peralatan ${payload.pcCode} berjaya ditambah.`, "success");
    }
    document.getElementById("equipmentModal").close();
    renderAll();
  } catch (err) {
    showToast(err.message || "Gagal menyimpan peralatan.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleDeleteEquipment(id) {
  if (!currentPermissions.canEditEquipment) return;
  const eq = getState().equipment.find(e => e.id === id);
  if (!eq) return;

  const ok = await openConfirmDialog({
    title: "Padam Peralatan",
    message: `Adakah anda pasti mahu memadam ${eq.pcCode} (${eq.labId}) berserta rekod penyelenggaraannya?`,
    confirmLabel: "Padam",
    danger: true
  });
  if (!ok) return;

  try {
    await deleteEquipment(id);
    renderAll();
    showToast(`Rekod ${eq.pcCode} telah dipadam.`, "success");
  } catch (err) {
    showToast(err.message || "Gagal memadam peralatan.", "error");
  }
}

function toggleSyncPcCheckbox() {
  const type = document.getElementById("maintType").value;
  const status = document.getElementById("maintStatus").value;
  const wrapper = document.getElementById("syncPcWrapper");
  if (!wrapper) return;
  wrapper.hidden = !(type === "Pembaikan (Corrective)" && status === "Selesai");
}

function openAddMaintenanceModal() {
  if (!currentPermissions.canManageMaintenance) return;
  const { equipment } = getScopedData();
  if (equipment.length === 0) {
    showToast("Tiada peralatan dalam makmal ini untuk direkodkan.", "error");
    return;
  }

  const select = document.getElementById("maintPcId");
  select.innerHTML = equipment.map(eq => `<option value="${escapeHtml(eq.id)}">${escapeHtml(eq.pcCode)} (${escapeHtml(eq.labId)}) — ${escapeHtml(eq.brand)} ${escapeHtml(eq.model)}</option>`).join("");

  document.getElementById("maintenanceForm").reset();
  document.getElementById("maintEditId").value = "";
  document.getElementById("maintDate").value = new Date().toISOString().split("T")[0];
  setElText("modalMaintenanceTitle", "Tambah Rekod Penyelenggaraan");
  toggleSyncPcCheckbox();
  document.getElementById("maintenanceModal").showModal();
}

function openEditMaintenanceModal(id) {
  if (!currentPermissions.canManageMaintenance) return;
  const log = getState().maintenanceLogs.find(m => m.id === id);
  if (!log) return;

  const { equipment } = getState();
  const select = document.getElementById("maintPcId");
  select.innerHTML = equipment.map(eq => `<option value="${escapeHtml(eq.id)}">${escapeHtml(eq.pcCode)} (${escapeHtml(eq.labId)}) — ${escapeHtml(eq.brand)} ${escapeHtml(eq.model)}</option>`).join("");

  document.getElementById("maintEditId").value = log.id;
  select.value = log.equipmentId;
  document.getElementById("maintType").value = log.type;
  document.getElementById("maintDate").value = log.date;
  document.getElementById("maintNotes").value = log.notes;
  document.getElementById("maintStatus").value = log.status;
  document.getElementById("syncPcHealthyCheckbox").checked = true;
  setElText("modalMaintenanceTitle", `Kemaskini Rekod ${log.logCode}`);
  toggleSyncPcCheckbox();
  document.getElementById("maintenanceModal").showModal();
}

async function handleMaintenanceSubmit(event) {
  event.preventDefault();
  if (!currentPermissions.canManageMaintenance) return;

  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const editId = document.getElementById("maintEditId").value;

  const payload = {
    equipmentId: document.getElementById("maintPcId").value,
    type: document.getElementById("maintType").value,
    date: document.getElementById("maintDate").value,
    notes: document.getElementById("maintNotes").value.trim(),
    status: document.getElementById("maintStatus").value,
    createdBy: currentUser?.uid || ""
  };

  submitBtn.disabled = true;
  try {
    let savedLog;
    if (editId) {
      savedLog = await updateMaintenanceLog(editId, payload);
      showToast(`Rekod ${savedLog.logCode} berjaya dikemaskini.`, "success");
    } else {
      savedLog = await createMaintenanceLog(payload);
      showToast(`Rekod ${savedLog.logCode} berjaya disimpan.`, "success");
    }

    if (payload.type === "Pembaikan (Corrective)") {
      const stateAfter = getState();
      const hasOtherPendingCorrective = stateAfter.maintenanceLogs.some(
        m => m.equipmentId === payload.equipmentId &&
             m.id !== savedLog.id &&
             m.type === "Pembaikan (Corrective)" &&
             m.status !== "Selesai"
      );

      if (payload.status !== "Selesai") {
        await updateEquipment(payload.equipmentId, {
          condition: "Rosak",
          status: "Penyelenggaraan"
        });
      } else if (!hasOtherPendingCorrective && document.getElementById("syncPcHealthyCheckbox").checked) {
        await updateEquipment(payload.equipmentId, {
          condition: "Baik",
          status: "Aktif"
        });
      }
    }

    document.getElementById("maintenanceModal").close();
    renderAll();
  } catch (err) {
    showToast(err.message || "Gagal menyimpan rekod penyelenggaraan.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleDeleteMaintenanceLog(id) {
  if (!currentPermissions.canDeleteMaintenance) return;
  const log = getState().maintenanceLogs.find(m => m.id === id);
  if (!log) return;

  const ok = await openConfirmDialog({
    title: "Padam Rekod Penyelenggaraan",
    message: `Padam rekod ${log.logCode} (${log.pcCode})?`,
    confirmLabel: "Padam",
    danger: true
  });
  if (!ok) return;

  try {
    await deleteMaintenanceLog(id);
    renderAll();
    showToast(`Rekod ${log.logCode} telah dipadam.`, "success");
  } catch (err) {
    showToast(err.message || "Gagal memadam rekod.", "error");
  }
}

function renderAll() {
  populateLabSwitcher();
  renderDashboard();
  renderEquipmentTable();
  renderMaintenanceTable();
  populatePredictionDropdown();
  renderReportPreview();
  renderSettingsSection();
}

function bindStaticListeners() {
  document.getElementById("toggleSidebarBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("collapsed");
  });

  document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.add("mobile-open");
    document.getElementById("sidebarBackdrop")?.classList.add("open");
  });

  document.getElementById("sidebarBackdrop")?.addEventListener("click", closeMobileSidebar);
  document.getElementById("themeToggleBtn")?.addEventListener("click", toggleTheme);

  document.querySelectorAll("#sidebarNav .nav-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      showSection(link.dataset.section);
    });
  });

  document.getElementById("labSwitcher")?.addEventListener("change", e => {
    selectedLabId = e.target.value;
    renderAll();
  });

  document.getElementById("accountBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("accountDropdown")?.classList.toggle("open");
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".account-menu")) {
      document.getElementById("accountDropdown")?.classList.remove("open");
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", logout);

  document.getElementById("viewAllEquipmentBtn")?.addEventListener("click", () => {
    setEquipmentConditionPill("ALL");
    renderEquipmentTable();
    showSection("peralatan");
  });

  document.getElementById("alertActionBtn")?.addEventListener("click", e => {
    const targetCond = e.currentTarget.dataset.targetCondition || "Rosak";
    setEquipmentConditionPill(targetCond);
    renderEquipmentTable();
    showSection("peralatan");
  });

  document.getElementById("equipmentConditionPills")?.addEventListener("click", e => {
    const pill = e.target.closest("button[data-condition]");
    if (!pill) return;
    setEquipmentConditionPill(pill.dataset.condition);
    renderEquipmentTable();
  });

  document.getElementById("searchEquipment")?.addEventListener("input", renderEquipmentTable);
  document.getElementById("filterEqStatus")?.addEventListener("change", e => {
    eqStatusFilter = e.target.value;
    renderEquipmentTable();
  });

  document.querySelectorAll("#equipmentTable thead th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      eqSort = eqSort.key === key
        ? { key, dir: eqSort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" };
      renderEquipmentTable();
    });
  });

  document.getElementById("searchMaintenance")?.addEventListener("input", renderMaintenanceTable);
  document.getElementById("filterMaintStatus")?.addEventListener("change", e => {
    maintStatusFilter = e.target.value;
    renderMaintenanceTable();
  });
  document.getElementById("filterMaintType")?.addEventListener("change", e => {
    maintTypeFilter = e.target.value;
    renderMaintenanceTable();
  });

  document.querySelectorAll("#maintenanceTable thead th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      maintSort = maintSort.key === key
        ? { key, dir: maintSort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" };
      renderMaintenanceTable();
    });
  });

  document.getElementById("selectPcPrediction")?.addEventListener("change", runPredictionAnalysis);

  document.getElementById("printReportBtn")?.addEventListener("click", () => {
    const { labs, equipment, maintenanceLogs } = getScopedData();
    triggerOfficialPrint({
      container: document.getElementById("printArea"),
      selectedLabId,
      labs,
      equipment,
      maintenanceLogs,
      profile: currentProfile
    });
  });

  document.getElementById("addEquipmentBtn")?.addEventListener("click", openAddEquipmentModal);
  document.getElementById("cancelEquipmentBtn")?.addEventListener("click", () => document.getElementById("equipmentModal").close());
  document.getElementById("equipmentForm")?.addEventListener("submit", handleEquipmentSubmit);
  document.getElementById("eqLab")?.addEventListener("change", () => updateLabLocationDropdowns());
  document.getElementById("eqBrand")?.addEventListener("change", () => updateBrandModelDropdown());
  document.getElementById("eqCondition")?.addEventListener("change", e => {
    const statusSelect = document.getElementById("eqStatus");
    if (!statusSelect) return;
    if (e.target.value === "Rosak") statusSelect.value = "Penyelenggaraan";
    else if (e.target.value === "Perlu diperiksa") statusSelect.value = "Perlu perhatian";
    else statusSelect.value = "Aktif";
  });

  document.getElementById("addMaintenanceBtn")?.addEventListener("click", openAddMaintenanceModal);
  document.getElementById("cancelMaintenanceBtn")?.addEventListener("click", () => document.getElementById("maintenanceModal").close());
  document.getElementById("maintenanceForm")?.addEventListener("submit", handleMaintenanceSubmit);
  document.getElementById("maintType")?.addEventListener("change", toggleSyncPcCheckbox);
  document.getElementById("maintStatus")?.addEventListener("change", toggleSyncPcCheckbox);

  document.getElementById("equipmentTableBody")?.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "edit-eq") openEditEquipmentModal(btn.dataset.id);
    if (btn.dataset.action === "del-eq") handleDeleteEquipment(btn.dataset.id);
  });

  document.getElementById("maintenanceTableBody")?.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "edit-log") openEditMaintenanceModal(btn.dataset.id);
    if (btn.dataset.action === "del-log") handleDeleteMaintenanceLog(btn.dataset.id);
  });

  document.getElementById("confirmCancelBtn")?.addEventListener("click", () => {
    document.getElementById("confirmModal").close();
    confirmResolver?.(false);
    confirmResolver = null;
  });

  document.getElementById("confirmOkBtn")?.addEventListener("click", () => {
    document.getElementById("confirmModal").close();
    confirmResolver?.(true);
    confirmResolver = null;
  });

  document.getElementById("settingsTabs")?.addEventListener("click", e => {
    const tabBtn = e.target.closest("button[data-tab]");
    if (!tabBtn) return;
    document.querySelectorAll("#settingsTabs .settings-tab").forEach(b => b.classList.toggle("active", b === tabBtn));
    document.querySelectorAll(".settings-tab-panel").forEach(p => p.classList.toggle("active", p.id === tabBtn.dataset.tab));
  });

  document.getElementById("initDefaultSetupBtn")?.addEventListener("click", async () => {
    try {
      const res = await initDefaultLabsAndBrands();
      renderAll();
      showToast(`Inisialisasi selesai (${res.addedLabs} makmal, ${res.addedBrands} jenama ditambah).`, "success");
    } catch (err) {
      showToast(err.message || "Gagal melaksanakan inisialisasi.", "error");
    }
  });

  document.getElementById("labForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("labIdInput").value.trim().toUpperCase();
    const name = document.getElementById("labNameInput").value.trim();
    const rowsConfig = document.getElementById("labRowsInput").value.split(",").map(s => s.trim()).filter(Boolean);
    const seatsPerRow = Number(document.getElementById("labSeatsInput").value);
    try {
      await saveLab({ id, name, rowsConfig, seatsPerRow });
      e.currentTarget.reset();
      document.getElementById("labRowsInput").value = "Baris A, Baris B, Baris C";
      document.getElementById("labSeatsInput").value = "10";
      renderAll();
      showToast(`Makmal ${name} berjaya disimpan.`, "success");
    } catch (err) {
      showToast(err.message || "Gagal menyimpan makmal.", "error");
    }
  });

  document.getElementById("brandForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("brandEditId").value || undefined;
    const name = document.getElementById("brandNameInput").value.trim();
    const models = document.getElementById("brandModelsInput").value.split(",").map(s => s.trim()).filter(Boolean);
    try {
      await saveBrand({ id, name, models });
      e.currentTarget.reset();
      document.getElementById("brandEditId").value = "";
      document.getElementById("resetBrandFormBtn").hidden = true;
      renderAll();
      showToast(`Jenama ${name} berjaya disimpan.`, "success");
    } catch (err) {
      showToast(err.message || "Gagal menyimpan jenama.", "error");
    }
  });

  document.getElementById("resetBrandFormBtn")?.addEventListener("click", () => {
    document.getElementById("brandForm").reset();
    document.getElementById("brandEditId").value = "";
    document.getElementById("resetBrandFormBtn").hidden = true;
  });

  document.getElementById("settingsLabsList")?.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "edit-lab") {
      const lab = getState().labs.find(l => l.id === btn.dataset.id);
      if (!lab) return;
      document.getElementById("labIdInput").value = lab.id;
      document.getElementById("labNameInput").value = lab.name;
      document.getElementById("labRowsInput").value = lab.rowsConfig.join(", ");
      document.getElementById("labSeatsInput").value = String(lab.seatsPerRow);
      return;
    }
    if (btn.dataset.action === "del-lab") {
      const ok = await openConfirmDialog({
        title: "Padam Makmal",
        message: `Adakah anda pasti mahu memadam makmal ${btn.dataset.id}?`,
        confirmLabel: "Padam",
        danger: true
      });
      if (!ok) return;
      try {
        await deleteLab(btn.dataset.id);
        renderAll();
        showToast("Makmal berjaya dipadam.", "success");
      } catch (err) {
        showToast(err.message || "Gagal memadam makmal.", "error");
      }
    }
  });

  document.getElementById("settingsBrandsList")?.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "edit-brand") {
      const brand = getState().brands.find(b => b.id === btn.dataset.id);
      if (!brand) return;
      document.getElementById("brandEditId").value = brand.id;
      document.getElementById("brandNameInput").value = brand.name;
      document.getElementById("brandModelsInput").value = brand.models.join(", ");
      document.getElementById("resetBrandFormBtn").hidden = false;
      return;
    }
    if (btn.dataset.action === "del-brand") {
      const ok = await openConfirmDialog({
        title: "Padam Jenama",
        message: "Padam jenama ini daripada senarai pilihan?",
        confirmLabel: "Padam",
        danger: true
      });
      if (!ok) return;
      try {
        await deleteBrand(btn.dataset.id);
        renderAll();
        showToast("Jenama berjaya dipadam.", "success");
      } catch (err) {
        showToast(err.message || "Gagal memadam jenama.", "error");
      }
    }
  });

  document.getElementById("settingsUsersBody")?.addEventListener("change", async e => {
    const select = e.target.closest("select[data-action='change-role']");
    if (!select) return;
    try {
      await updateUserRole(select.dataset.uid, select.value);
      showToast("Peranan pengguna berjaya dikemaskini.", "success");
    } catch (err) {
      showToast(err.message || "Gagal mengemaskini peranan.", "error");
      renderSettingsSection();
    }
  });

  document.querySelectorAll("dialog").forEach(dlg => {
    dlg.addEventListener("click", e => {
      if (e.target === dlg) {
        dlg.close();
        if (dlg.id === "confirmModal" && confirmResolver) {
          confirmResolver(false);
          confirmResolver = null;
        }
      }
    });
  });

  initCommandPalette({
    getContext: () => ({
      ...getState(),
      permissions: currentPermissions
    }),
    navigateSection: sectionId => showSection(sectionId),
    openAddEquipment: () => openAddEquipmentModal(),
    openAddMaintenance: () => openAddMaintenanceModal(),
    printReport: () => {
      showSection("laporan");
      const { labs, equipment, maintenanceLogs } = getScopedData();
      triggerOfficialPrint({
        container: document.getElementById("printArea"),
        selectedLabId,
        labs,
        equipment,
        maintenanceLogs,
        profile: currentProfile
      });
    },
    toggleTheme: () => toggleTheme(),
    switchLab: labId => {
      selectedLabId = labId;
      renderAll();
    },
    focusEquipment: eq => {
      selectedLabId = eq.labId;
      setEquipmentConditionPill("ALL");
      eqStatusFilter = "ALL";
      const statusEl = document.getElementById("filterEqStatus");
      if (statusEl) statusEl.value = "ALL";
      const searchEl = document.getElementById("searchEquipment");
      if (searchEl) searchEl.value = eq.pcCode;
      highlightedEquipmentId = eq.id;
      renderAll();
      showSection("peralatan");
      setTimeout(() => {
        highlightedEquipmentId = null;
        document.querySelector(`tr[data-eq-id="${CSS.escape(eq.id)}"]`)?.classList.remove("row-flash");
      }, 2500);
    },
    focusMaintenanceLog: log => {
      selectedLabId = log.labId;
      maintStatusFilter = "ALL";
      maintTypeFilter = "ALL";
      const sEl = document.getElementById("filterMaintStatus");
      const tEl = document.getElementById("filterMaintType");
      if (sEl) sEl.value = "ALL";
      if (tEl) tEl.value = "ALL";
      const searchEl = document.getElementById("searchMaintenance");
      if (searchEl) searchEl.value = log.logCode;
      highlightedLogId = log.id;
      renderAll();
      showSection("penyelenggaraan");
      setTimeout(() => {
        highlightedLogId = null;
        document.querySelector(`tr[data-log-id="${CSS.escape(log.id)}"]`)?.classList.remove("row-flash");
      }, 2500);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || "light");
  bindStaticListeners();

  onDashboardAuth(async (user, profile) => {
    currentUser = user;
    currentProfile = profile;
    applyRolePermissions(profile.role);

    setElText("userName", profile.name);
    setElText("dropdownUserName", profile.name);
    setElText("userRoleLabel", profile.role);
    setElText("userAvatar", (profile.name || "U").charAt(0).toUpperCase());

    try {
      await loadAllData(profile.role);
      renderAll();
    } catch (err) {
      showToast("Ralat memuatkan data pangkalan data.", "error");
      console.error(err);
    }

    document.getElementById("authLoading")?.setAttribute("hidden", "");
    document.getElementById("appShell")?.removeAttribute("hidden");
  });
});
