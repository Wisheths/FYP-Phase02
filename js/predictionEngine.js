/* ==========================================================
   RULE-BASED DIAGNOSTIC ENGINE MODULE (diagnosticEngine.js)
   Calculates equipment failure risk scores & maintenance schedules
   ========================================================== */

function analyzeEquipmentRisk(equipmentId) {
  const equipmentList = getEquipmentData();
  const maintenanceList = getMaintenanceData();

  const pc = equipmentList.find(e => e.id === equipmentId);
  if (!pc) return null;

  const history = maintenanceList.filter(m => m.equipmentId === equipmentId);
  
  let riskScore = 15;
  let badgeType = 'available';
  let badgeLabel = 'Risiko Rendah';
  let timeframe = 'Pemeriksaan Berjadual (30 Hari)';
  let actions = [];

  if (pc.condition === 'Rosak') {
    riskScore += 65;
    badgeType = 'repair';
    badgeLabel = 'Risiko Kritikal';
    timeframe = 'Tindakan Pembaikan Segera';
    actions.push('Lakukan penggantian komponen rosak atau hantar ke pusat pembaikan.');
  } else if (pc.condition === 'Perlu diperiksa') {
    riskScore += 35;
    badgeType = 'attention';
    badgeLabel = 'Risiko Sederhana';
    timeframe = 'Pemeriksaan Dalam Masa 7 Hari';
    actions.push('Juruteknik perlu menjalankan ujian diagnostik perkakasan penuh.');
  }

  if (history.length >= 3) {
    riskScore += 15;
    actions.push('Rekod kerosakan kerap: Pertimbangkan pembersihan sistem atau pertukaran perkakasan utama.');
  } else if (history.length === 0) {
    actions.push('Tiada sejarah penyelenggaraan direkodkan: Jalankan penyelenggaraan pencegahan rutin.');
  }

  const pendingLogs = history.filter(h => h.status !== 'Selesai');
  if (pendingLogs.length > 0) {
    riskScore += 10;
    actions.push(`Terdapat ${pendingLogs.length} tugasan penyelenggaraan yang belum diselesaikan.`);
  }

  riskScore = Math.min(Math.max(riskScore, 5), 99);

  return {
    id: pc.id,
    riskScore: `${riskScore}%`,
    badgeType,
    badgeLabel,
    timeframe,
    actions
  };
}