function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatGeneratedTimestamp() {
  return new Intl.DateTimeFormat("ms-MY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

export function renderOfficialReport({ container, selectedLabId, labs, equipment, maintenanceLogs, profile }) {
  if (!container) return;

  const activeLab = selectedLabId === "ALL"
    ? "Semua Makmal Komputer SKR"
    : (labs.find(l => l.id === selectedLabId)?.name || selectedLabId);

  const total = equipment.length;
  const baik = equipment.filter(e => e.condition === "Baik").length;
  const perhatian = equipment.filter(e => e.condition === "Perlu diperiksa").length;
  const rosak = equipment.filter(e => e.condition === "Rosak").length;
  const usabilityPct = total > 0 ? Math.round((baik / total) * 100) : 0;
  const pendingLogs = maintenanceLogs.filter(m => m.status !== "Selesai").length;

  const equipmentRows = equipment.length === 0
    ? `<tr><td colspan="6" class="print-empty">Tiada peralatan berdaftar bagi skop makmal ini.</td></tr>`
    : equipment.map(eq => `
      <tr>
        <td class="mono-text">${escapeHtml(eq.pcCode)}</td>
        <td>${escapeHtml(eq.labId)}</td>
        <td>${escapeHtml(eq.brand)} ${escapeHtml(eq.model)}</td>
        <td class="mono-text">${escapeHtml(eq.serial)}</td>
        <td>${escapeHtml(eq.location)}</td>
        <td>${escapeHtml(eq.condition)} / ${escapeHtml(eq.status)}</td>
      </tr>
    `).join("");

  const logRows = maintenanceLogs.length === 0
    ? `<tr><td colspan="6" class="print-empty">Tiada rekod penyelenggaraan bagi skop makmal ini.</td></tr>`
    : maintenanceLogs.slice(0, 25).map(log => `
      <tr>
        <td class="mono-text">${escapeHtml(log.logCode)}</td>
        <td class="mono-text">${escapeHtml(log.pcCode)}</td>
        <td>${escapeHtml(log.type)}</td>
        <td>${escapeHtml(log.date)}</td>
        <td>${escapeHtml(log.notes)}</td>
        <td>${escapeHtml(log.status)}</td>
      </tr>
    `).join("");

  container.innerHTML = `
    <div class="print-header">
      <div class="print-brand">
        <div class="logo-wrap print-logo-wrap">
          <img src="assets/kvas-logo.png" alt="Logo KVAS" class="brand-logo" onerror="this.hidden=true; this.nextElementSibling.hidden=false;">
          <div class="brand-fallback" hidden>KV</div>
        </div>
        <div>
          <p class="print-institution">KOLEJ VOKASIONAL ALOR SETAR</p>
          <h3 class="print-title">LAPORAN STATUS &amp; PENYELENGGARAAN PERALATAN MAKMAL</h3>
          <p class="print-subtitle">Sistem Pengurusan Peralatan Komputer Berasaskan Peraturan (R-CEMS)</p>
        </div>
      </div>
    </div>

    <div class="print-meta-grid">
      <div><span>Makmal:</span> <strong>${escapeHtml(activeLab)}</strong></div>
      <div><span>Tarikh &amp; Masa Dijana:</span> <strong>${escapeHtml(formatGeneratedTimestamp())}</strong></div>
      <div><span>Disediakan Oleh:</span> <strong>${escapeHtml(profile?.name || "-")} (${escapeHtml(profile?.role || "-")})</strong></div>
    </div>

    <h4 class="print-section-heading">1. Ringkasan Kesihatan Peralatan</h4>
    <table class="print-table">
      <thead>
        <tr>
          <th>Jumlah Komputer</th>
          <th>Keadaan Baik</th>
          <th>Perlu Diperiksa</th>
          <th>Rosak</th>
          <th>Kadar Kebolehgunaan</th>
          <th>Penyelenggaraan Belum Selesai</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${total}</strong></td>
          <td>${baik}</td>
          <td>${perhatian}</td>
          <td>${rosak}</td>
          <td><strong>${usabilityPct}%</strong></td>
          <td>${pendingLogs}</td>
        </tr>
      </tbody>
    </table>

    <h4 class="print-section-heading">2. Senarai Inventori Peralatan</h4>
    <table class="print-table">
      <thead>
        <tr>
          <th>ID PC</th>
          <th>Makmal</th>
          <th>Jenama / Model</th>
          <th>Nombor Siri</th>
          <th>Lokasi</th>
          <th>Keadaan / Status</th>
        </tr>
      </thead>
      <tbody>${equipmentRows}</tbody>
    </table>

    <h4 class="print-section-heading">3. Rekod Penyelenggaraan Terkini</h4>
    <table class="print-table">
      <thead>
        <tr>
          <th>ID Rekod</th>
          <th>ID PC</th>
          <th>Jenis</th>
          <th>Tarikh</th>
          <th>Catatan</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${logRows}</tbody>
    </table>

    <div class="print-signoff-grid">
      <div class="print-signoff-box">
        <p class="signoff-role">Disediakan oleh,</p>
        <div class="signoff-line"></div>
        <p class="signoff-meta">Nama: ${escapeHtml(profile?.name || "...........................")}</p>
        <p class="signoff-meta">Jawatan: ${escapeHtml(profile?.role || "...........................")}</p>
        <p class="signoff-meta">Tarikh: ...........................</p>
      </div>
      <div class="print-signoff-box">
        <p class="signoff-role">Disemak oleh,</p>
        <div class="signoff-line"></div>
        <p class="signoff-meta">Nama: ...........................</p>
        <p class="signoff-meta">Jawatan: Juruteknik / Penyelia Makmal</p>
        <p class="signoff-meta">Tarikh: ...........................</p>
      </div>
      <div class="print-signoff-box">
        <p class="signoff-role">Disahkan oleh,</p>
        <div class="signoff-line"></div>
        <p class="signoff-meta">Nama: ...........................</p>
        <p class="signoff-meta">Jawatan: Ketua Bengkel / Pentadbir</p>
        <p class="signoff-meta">Tarikh: ...........................</p>
      </div>
    </div>
  `;
}

export function triggerOfficialPrint(reportArgs) {
  renderOfficialReport(reportArgs);
  window.print();
}
