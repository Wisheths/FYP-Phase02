/* ==========================================================
   LOCAL STORAGE MODULE (storage.js)
   ========================================================== */

const EQUIPMENT_STORAGE_KEY = 'skr2_equipment_data';
const MAINTENANCE_STORAGE_KEY = 'skr2_maintenance_logs';

const DEFAULT_EQUIPMENT = [
  { id: 'PC-001', model: 'Dell OptiPlex 3080', serial: 'DL-3080-001', location: 'Baris A - Meja 1', condition: 'Baik', status: 'Aktif' },
  { id: 'PC-002', model: 'Dell OptiPlex 3080', serial: 'DL-3080-002', location: 'Baris A - Meja 2', condition: 'Perlu diperiksa', status: 'Perlu perhatian' },
  { id: 'PC-003', model: 'HP ProDesk 400 G7', serial: 'HP-400G7-003', location: 'Baris A - Meja 3', condition: 'Baik', status: 'Aktif' },
  { id: 'PC-004', model: 'HP ProDesk 400 G7', serial: 'HP-400G7-004', location: 'Baris B - Meja 1', condition: 'Rosak', status: 'Penyelenggaraan' },
  { id: 'PC-005', model: 'Lenovo ThinkCentre M70', serial: 'LN-M70-005', location: 'Baris B - Meja 2', condition: 'Baik', status: 'Aktif' },
  { id: 'PC-006', model: 'Lenovo ThinkCentre M70', serial: 'LN-M70-006', location: 'Baris B - Meja 3', condition: 'Baik', status: 'Aktif' }
];

const DEFAULT_MAINTENANCE_LOGS = [
  { id: 'MNT-001', pcId: 'PC-004', type: 'Pembaikan (Corrective)', date: '2026-11-10', notes: 'Unit tidak dapat dihidupkan. Penggantian PSU sedang dijalankan.', status: 'Dalam Proses' },
  { id: 'MNT-002', pcId: 'PC-002', type: 'Pemeriksaan Rutin', date: '2026-11-18', notes: 'Suhu CPU tinggi semasa penggunaan perisian berat. Perlu tukar thermal paste.', status: 'Belum Selesai' },
  { id: 'MNT-003', pcId: 'PC-001', type: 'Pencegahan (Preventive)', date: '2026-10-25', notes: 'Pembersihan habuk dalaman dan kemaskini Windows selesai.', status: 'Selesai' }
];

function getEquipment() {
  try {
    const data = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
    if (!data) {
      saveEquipment(DEFAULT_EQUIPMENT);
      return DEFAULT_EQUIPMENT;
    }
    return JSON.parse(data);
  } catch (e) {
    return DEFAULT_EQUIPMENT;
  }
}

function saveEquipment(equipment) {
  localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(equipment));
}

function getMaintenanceLogs() {
  try {
    const data = localStorage.getItem(MAINTENANCE_STORAGE_KEY);
    if (!data) {
      saveMaintenanceLogs(DEFAULT_MAINTENANCE_LOGS);
      return DEFAULT_MAINTENANCE_LOGS;
    }
    return JSON.parse(data);
  } catch (e) {
    return DEFAULT_MAINTENANCE_LOGS;
  }
}

function saveMaintenanceLogs(logs) {
  localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(logs));
}