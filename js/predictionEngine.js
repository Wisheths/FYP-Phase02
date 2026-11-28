// Rule-based maintenance risk scoring engine
export function analyzeEquipmentRisk(equipmentId, equipmentList, maintenanceList) {
  const pc = equipmentList.find(e => e.id === equipmentId);
  if (!pc) return null;

  const history = maintenanceList.filter(m => m.equipmentId === equipmentId);
  const correctiveLogs = history.filter(m => m.type === "Pembaikan (Corrective)");
  const pendingLogs = history.filter(m => m.status !== "Selesai");
  const completedLogs = history
    .filter(m => m.status === "Selesai" && m.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let riskScore = 10;
  const actions = [];

  // 1. Current physical condition
  if (pc.condition === "Rosak") {
    riskScore += 60;
    actions.push("Ganti komponen rosak atau hantar unit untuk pembaikan segera.");
  } else if (pc.condition === "Perlu diperiksa") {
    riskScore += 30;
    actions.push("Jalankan ujian diagnostik perkakasan penuh oleh juruteknik.");
  }

  // 2. Operational status consistency
  if (pc.status === "Penyelenggaraan" && pc.condition !== "Rosak") {
    riskScore += 15;
    actions.push("Unit masih berstatus Penyelenggaraan — sahkan status perkakasan sebelum diaktifkan semula.");
  } else if (pc.status === "Perlu perhatian" && pc.condition === "Baik") {
    riskScore += 10;
    actions.push("Semak punca status Perlu Perhatian walaupun keadaan direkodkan Baik.");
  }

  // 3. Frequent CORRECTIVE breakdowns only (never penalize Preventive maintenance)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentBreakdowns = correctiveLogs.filter(m => !m.date || new Date(m.date) >= oneYearAgo);

  if (recentBreakdowns.length >= 3) {
    riskScore += 20;
    actions.push(`Kerosakan berulang (${recentBreakdowns.length} pembaikan dalam 12 bulan): Pertimbangkan pertukaran perkakasan utama.`);
  } else if (recentBreakdowns.length === 2) {
    riskScore += 10;
    actions.push("Terdapat 2 rekod pembaikan tahun ini: Pantau kestabilan komponen kritikal.");
  }

  // 4. Unresolved maintenance tasks (scaled, capped at +25)
  if (pendingLogs.length > 0) {
    riskScore += Math.min(pendingLogs.length * 10, 25);
    actions.push(`Selesaikan ${pendingLogs.length} tugasan penyelenggaraan yang masih belum selesai.`);
  }

  // 5. Days since last completed service
  if (completedLogs.length === 0) {
    riskScore += 10;
    actions.push("Tiada rekod penyelenggaraan selesai: Jadualkan penyelenggaraan pencegahan awal.");
  } else {
    const lastDate = new Date(completedLogs[0].date);
    const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 180) {
      riskScore += 20;
      actions.push(`Penyelenggaraan terakhir ${daysSince} hari lalu (> 6 bulan): Lakukan servis pencegahan segera.`);
    } else if (daysSince > 90) {
      riskScore += 10;
      actions.push(`Penyelenggaraan terakhir ${daysSince} hari lalu (> 3 bulan): Rancang pemeriksaan berkala.`);
    }
  }

  // Clamp final score
  riskScore = Math.min(Math.max(riskScore, 5), 99);

  // Derive badge & schedule strictly from FINAL riskScore
  let badgeType = "ok";
  let badgeLabel = "Risiko Rendah";
  let timeframe = "Pemeriksaan Berjadual (30 Hari)";

  if (riskScore >= 70) {
    badgeType = "danger";
    badgeLabel = "Risiko Kritikal";
    timeframe = "Tindakan Pembaikan Segera (24–48 Jam)";
  } else if (riskScore >= 40) {
    badgeType = "warning";
    badgeLabel = "Risiko Sederhana";
    timeframe = "Pemeriksaan Dalam Masa 7 Hari";
  }

  if (actions.length === 0) {
    actions.push("Keadaan perkakasan stabil. Teruskan pemantauan berkala dan penyelenggaraan pencegahan mengikut jadual.");
  }

  return {
    id: pc.id,
    pcCode: pc.pcCode,
    riskScore,
    riskScoreLabel: `${riskScore}%`,
    badgeType,
    badgeLabel,
    timeframe,
    actions
  };
}
