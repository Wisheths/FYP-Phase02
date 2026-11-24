/* ==========================================================
   FIREBASE FIRESTORE STORAGE MODULE (js/storage.js)
   ========================================================== */
import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

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

let equipmentCache = [];
let maintenanceCache = [];

export async function initStorage() {
  try {
    // 1. Load Equipment from Firestore
    const eqSnap = await getDocs(collection(db, "equipment"));
    if (eqSnap.empty) {
      for (const item of DEFAULT_EQUIPMENT) {
        await setDoc(doc(db, "equipment", item.id), item);
      }
      equipmentCache = [...DEFAULT_EQUIPMENT];
    } else {
      equipmentCache = eqSnap.docs
        .map(d => d.data())
        .sort((a, b) => a.id.localeCompare(b.id));
    }

    // 2. Load Maintenance Logs from Firestore
    const mntSnap = await getDocs(collection(db, "maintenance_logs"));
    if (mntSnap.empty) {
      for (const log of DEFAULT_MAINTENANCE_LOGS) {
        await setDoc(doc(db, "maintenance_logs", log.id), log);
      }
      maintenanceCache = [...DEFAULT_MAINTENANCE_LOGS];
    } else {
      maintenanceCache = mntSnap.docs
        .map(d => d.data())
        .sort((a, b) => b.id.localeCompare(a.id));
    }
  } catch (err) {
    console.error("Ralat memuatkan data Firestore:", err);
  }
}

function getEquipment() {
  return equipmentCache.map(item => ({ ...item }));
}

async function saveEquipment(updatedList) {
  const oldIds = new Set(equipmentCache.map(item => item.id));
  const newIds = new Set(updatedList.map(item => item.id));
  equipmentCache = updatedList
    .map(item => ({ ...item }))
    .sort((a, b) => a.id.localeCompare(b.id));

  try {
    for (const item of equipmentCache) {
      await setDoc(doc(db, "equipment", item.id), item);
    }
    for (const oldId of oldIds) {
      if (!newIds.has(oldId)) {
        await deleteDoc(doc(db, "equipment", oldId));
      }
    }
  } catch (err) {
    console.error("Ralat menyimpan peralatan ke Firestore:", err);
  }
}

function getMaintenanceLogs() {
  return maintenanceCache.map(log => ({ ...log }));
}

async function saveMaintenanceLogs(updatedLogs) {
  const oldIds = new Set(maintenanceCache.map(log => log.id));
  const newIds = new Set(updatedLogs.map(log => log.id));
  maintenanceCache = updatedLogs
    .map(log => ({ ...log }))
    .sort((a, b) => b.id.localeCompare(a.id));

  try {
    for (const log of maintenanceCache) {
      await setDoc(doc(db, "maintenance_logs", log.id), log);
    }
    for (const oldId of oldIds) {
      if (!newIds.has(oldId)) {
        await deleteDoc(doc(db, "maintenance_logs", oldId));
      }
    }
  } catch (err) {
    console.error("Ralat menyimpan rekod penyelenggaraan:", err);
  }
}

// Expose globally for uiController.js and predictionEngine.js
window.getEquipment = getEquipment;
window.saveEquipment = saveEquipment;
window.getMaintenanceLogs = getMaintenanceLogs;
window.saveMaintenanceLogs = saveMaintenanceLogs;
window.getEquipmentData = getEquipment;
window.getMaintenanceData = () => maintenanceCache.map(l => ({ ...l, equipmentId: l.pcId }));