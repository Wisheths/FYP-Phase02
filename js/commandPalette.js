const RECENTS_STORAGE_KEY = "rcems_recent_commands";
const MAX_RECENTS = 6;

const ICONS = {
  page: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`,
  pc: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
  log: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
  action: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,
  recent: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecent(entry) {
  const recents = loadRecents().filter(r => r.key !== entry.key);
  recents.unshift({
    key: entry.key,
    type: entry.type,
    label: entry.label,
    sublabel: entry.sublabel,
    targetId: entry.targetId || ""
  });
  localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
}

export function initCommandPalette(handlers) {
  const openBtn = document.getElementById("openSearchModalBtn");
  const modal = document.getElementById("commandModal");
  const input = document.getElementById("commandSearchInput");
  const results = document.getElementById("commandResults");
  if (!modal || !input || !results) return;

  let selectedIndex = 0;
  let currentMatches = [];

  function buildStaticItems() {
    const { labs, permissions } = handlers.getContext();
    const items = [];

    document.querySelectorAll("#sidebarNav .nav-link").forEach(link => {
      const sectionId = link.dataset.section;
      const label = link.querySelector("span")?.textContent.trim();
      if (sectionId && label) {
        items.push({
          key: `page:${sectionId}`,
          type: "page",
          group: "Halaman",
          label,
          sublabel: "Halaman",
          targetId: sectionId,
          icon: ICONS.page,
          run: () => handlers.navigateSection(sectionId)
        });
      }
    });

    if (permissions.canEditEquipment) {
      items.push({
        key: "action:add-equipment",
        type: "action",
        group: "Tindakan",
        label: "Tambah Peralatan Baru",
        sublabel: "Tindakan",
        targetId: "add-equipment",
        icon: ICONS.action,
        run: () => handlers.openAddEquipment()
      });
    }

    if (permissions.canManageMaintenance) {
      items.push({
        key: "action:add-maintenance",
        type: "action",
        group: "Tindakan",
        label: "Tambah Rekod Penyelenggaraan",
        sublabel: "Tindakan",
        targetId: "add-maintenance",
        icon: ICONS.action,
        run: () => handlers.openAddMaintenance()
      });
    }

    if (permissions.sections.includes("laporan")) {
      items.push({
        key: "action:print-report",
        type: "action",
        group: "Tindakan",
        label: "Cetak Laporan Rasmi",
        sublabel: "Tindakan",
        targetId: "print-report",
        icon: ICONS.action,
        run: () => handlers.printReport()
      });
    }

    items.push({
      key: "action:toggle-theme",
      type: "action",
      group: "Tindakan",
      label: "Tukar Tema Cerah / Gelap",
      sublabel: "Paparan",
      targetId: "toggle-theme",
      icon: ICONS.action,
      run: () => handlers.toggleTheme()
    });

    items.push({
      key: "lab:ALL",
      type: "lab",
      group: "Makmal",
      label: "Tukar ke Semua Makmal",
      sublabel: "Penapis Makmal",
      targetId: "ALL",
      icon: ICONS.page,
      run: () => handlers.switchLab("ALL")
    });

    labs.forEach(lab => {
      items.push({
        key: `lab:${lab.id}`,
        type: "lab",
        group: "Makmal",
        label: `Tukar ke ${lab.name}`,
        sublabel: lab.id,
        targetId: lab.id,
        icon: ICONS.page,
        run: () => handlers.switchLab(lab.id)
      });
    });

    return items;
  }

  function resolveRecentEntry(entry, staticItems) {
    const { equipment, maintenanceLogs } = handlers.getContext();

    if (entry.type === "equipment") {
      const eq = equipment.find(e => e.id === entry.targetId);
      if (!eq) return null;
      return {
        ...entry,
        group: "Carian Terkini",
        icon: ICONS.recent,
        run: () => handlers.focusEquipment(eq)
      };
    }

    if (entry.type === "log") {
      const log = maintenanceLogs.find(l => l.id === entry.targetId);
      if (!log) return null;
      return {
        ...entry,
        group: "Carian Terkini",
        icon: ICONS.recent,
        run: () => handlers.focusMaintenanceLog(log)
      };
    }

    const match = staticItems.find(i => i.key === entry.key);
    if (!match) return null;
    return {
      ...match,
      group: "Carian Terkini",
      icon: ICONS.recent
    };
  }

  function buildSearchItems(query) {
    const q = query.trim().toLowerCase();
    const { equipment, maintenanceLogs, labs } = handlers.getContext();
    const staticItems = buildStaticItems();

    if (!q) {
      const recents = loadRecents()
        .map(r => resolveRecentEntry(r, staticItems))
        .filter(Boolean);

      const pageAndAction = staticItems.filter(i => i.group === "Halaman" || i.group === "Tindakan");
      return [...recents, ...pageAndAction];
    }

    const labNameMap = new Map(labs.map(l => [l.id, l.name]));

    const eqMatches = equipment
      .filter(eq => {
        const labName = (labNameMap.get(eq.labId) || "").toLowerCase();
        return (
          eq.pcCode.toLowerCase().includes(q) ||
          eq.serial.toLowerCase().includes(q) ||
          eq.brand.toLowerCase().includes(q) ||
          eq.model.toLowerCase().includes(q) ||
          eq.labId.toLowerCase().includes(q) ||
          labName.includes(q) ||
          eq.condition.toLowerCase().includes(q)
        );
      })
      .slice(0, 8)
      .map(eq => ({
        key: `eq:${eq.id}`,
        type: "equipment",
        group: "Komputer",
        label: `${eq.pcCode} · ${eq.brand} ${eq.model}`,
        sublabel: `${eq.labId} · ${eq.condition}`,
        targetId: eq.id,
        icon: ICONS.pc,
        run: () => handlers.focusEquipment(eq)
      }));

    const logMatches = maintenanceLogs
      .filter(log =>
        log.logCode.toLowerCase().includes(q) ||
        log.pcCode.toLowerCase().includes(q) ||
        log.notes.toLowerCase().includes(q) ||
        log.status.toLowerCase().includes(q)
      )
      .slice(0, 6)
      .map(log => ({
        key: `log:${log.id}`,
        type: "log",
        group: "Penyelenggaraan",
        label: `${log.logCode} · ${log.pcCode}`,
        sublabel: `${log.status} · ${log.date}`,
        targetId: log.id,
        icon: ICONS.log,
        run: () => handlers.focusMaintenanceLog(log)
      }));

    const staticMatches = staticItems.filter(
      item => item.label.toLowerCase().includes(q) || item.sublabel.toLowerCase().includes(q)
    );

    return [...eqMatches, ...logMatches, ...staticMatches];
  }

  function updateSelectedHighlight() {
    const nodes = results.querySelectorAll(".command-item[data-cmd-idx]");
    nodes.forEach((node, idx) => {
      const isSelected = idx === selectedIndex;
      node.classList.toggle("selected", isSelected);
      if (isSelected) {
        node.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function executeCommand(idx) {
    const item = currentMatches[idx];
    if (!item) return;
    saveRecent(item);
    modal.close();
    item.run();
  }

  function renderCommandList(query = "") {
    const items = buildSearchItems(query);
    currentMatches = items;
    selectedIndex = 0;

    if (items.length === 0) {
      results.innerHTML = `<div class="command-empty">Tiada padanan dijumpai.</div>`;
      return;
    }

    const groups = new Map();
    items.forEach(item => {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group).push(item);
    });

    let html = "";
    let idx = 0;

    groups.forEach((groupItems, groupName) => {
      html += `<div class="command-group-label">${escapeHtml(groupName)}</div>`;
      groupItems.forEach(item => {
        html += `
          <button type="button" class="command-item ${idx === 0 ? "selected" : ""}" data-cmd-idx="${idx}">
            <span class="command-item-left">
              ${item.icon}
              <span>${escapeHtml(item.label)}</span>
            </span>
            <small>${escapeHtml(item.sublabel)}</small>
          </button>
        `;
        idx++;
      });
    });

    results.innerHTML = html;

    results.querySelectorAll(".command-item[data-cmd-idx]").forEach((btn, i) => {
      btn.addEventListener("click", () => executeCommand(i));
      btn.addEventListener("mouseenter", () => {
        selectedIndex = i;
        updateSelectedHighlight();
      });
    });
  }

  function openPalette() {
    input.value = "";
    renderCommandList("");
    modal.showModal();
    input.focus();
  }

  openBtn?.addEventListener("click", openPalette);
  input.addEventListener("input", e => renderCommandList(e.target.value));
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentMatches.length > 0) {
        selectedIndex = (selectedIndex + 1) % currentMatches.length;
        updateSelectedHighlight();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentMatches.length > 0) {
        selectedIndex = (selectedIndex - 1 + currentMatches.length) % currentMatches.length;
        updateSelectedHighlight();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeCommand(selectedIndex);
    }
  });

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      modal.open ? modal.close() : openPalette();
    }
  });
}
