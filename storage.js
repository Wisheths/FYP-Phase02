/* ==========================================================
   DATA PERSISTENCE & STORAGE MODULE (storage.js)
   LocalStorage management for Equipment & Maintenance logs
   ========================================================== */

const STORAGE_KEYS = {
  EQUIPMENT: 'skr2_equipment_data',
  MAINTENANCE: 'skr2_maintenance_data'
};

const DEFAULT_EQUIPMENT = [
  { id: 'PC-SKR2-001', model: 'Dell OptiPlex 7090', serial: 'DL-10041', location: 'Meja 01', condition: 'Baik', status: 'Aktif' },
  { id: 'PC-SKR2-002', model: 'Dell OptiPlex 7090', serial: 'DL-10042', location: 'Meja 02', condition: 'Perlu diperiksa', status: 'Perlu perhatian' },
  { id: 'PC-SKR2-003', model: 'HP ProDesk 400', serial: 'HP-88301', location: 'Meja 03', condition: 'Rosak', status: 'Penyelenggaraan' },
  { id: 'PC-SKR2-004', model: 'Acer Veriton X', serial: 'AC-99212', location: 'Meja 04', condition: 'Baik', status: 'Aktif' }
];

const DEFAULT_MAINTENANCE = [
  { id: 'MNT-2026-001', equipmentId: 'PC-SKR2-003', type: 'Pembaikan (Corrective)', date: '2026-10-12', notes: 'Tukar Power Supply Unit (PSU)', status: 'Dalam Proses' },
  { id: 'MNT-2026-002', equipmentId: 'PC-SKR2-002', type: 'Pemeriksaan Rutin', date: '2026-10-18', notes: 'Kipas CPU bising, perlu pembersihan habuk', status: 'Belum Selesai' }
];

function getEquipmentData() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EQUIPMENT);
    return data ? JSON.parse(data) : DEFAULT_EQUIPMENT;
  } catch (e) {
    return DEFAULT_EQUIPMENT;
  }
}

function saveEquipmentData(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(list));
  } catch (e) {
    console.error("Gagal menyimpan data peralatan:", e);
  }
}

function addOrUpdateEquipment(item, editIndex = -1) {
  const list = getEquipmentData();
  if (editIndex >= 0 && editIndex < list.length) {
    list[editIndex] = item;
  } else {
    list.push(item);
  }
  saveEquipmentData(list);
  return list;
}

function deleteEquipmentById(id) {
  let list = getEquipmentData();
  list = list.filter(item => item.id !== id);
  saveEquipmentData(list);
  return list;
}

function getMaintenanceData() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MAINTENANCE);
    return data ? JSON.parse(data) : DEFAULT_MAINTENANCE;
  } catch (e) {
    return DEFAULT_MAINTENANCE;
  }
}

function saveMaintenanceData(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(list));
  } catch (e) {
    console.error("Gagal menyimpan rekod penyelenggaraan:", e);
  }
}

function addMaintenanceRecord(record) {
  const list = getMaintenanceData();
  list.unshift(record);
  saveMaintenanceData(list);
  return list;
}