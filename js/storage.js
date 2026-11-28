import { db } from "./config.js";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const DEFAULT_LABS = [
  { id: "SKR-1", name: "Makmal SKR 1", rowsConfig: ["Baris A", "Baris B", "Baris C"], seatsPerRow: 10 },
  { id: "SKR-2", name: "Makmal SKR 2", rowsConfig: ["Baris A", "Baris B", "Baris C"], seatsPerRow: 10 },
  { id: "SKR-3", name: "Makmal SKR 3", rowsConfig: ["Baris A", "Baris B", "Baris C"], seatsPerRow: 10 }
];

const DEFAULT_BRANDS = [
  { id: "brand-dell", name: "Dell", models: ["OptiPlex 3080", "OptiPlex 5090", "OptiPlex 7010"] },
  { id: "brand-hp", name: "HP", models: ["ProDesk 400 G7", "ProDesk 600 G6", "EliteDesk 800 G6"] },
  { id: "brand-lenovo", name: "Lenovo", models: ["ThinkCentre M70", "ThinkCentre M75s", "ThinkCentre Neo 50s"] }
];

const state = {
  labs: [],
  brands: [],
  equipment: [],
  maintenanceLogs: [],
  users: []
};

function parseLegacyLocation(locText) {
  const str = String(locText || "").trim();
  const match = str.match(/^(.*?)\s*-\s*Meja\s*(\d+)$/i);
  if (match) {
    return { rowLabel: match[1].trim(), seatNumber: parseInt(match[2], 10) || 1 };
  }
  return { rowLabel: str || "Baris A", seatNumber: 1 };
}

function normalizeEquipmentDoc(docId, data) {
  const pcCode = String(data.pcCode || data.id || docId).trim();
  const rawModel = String(data.model || "").trim();
  const inferredBrand = data.brand || (rawModel ? rawModel.split(" ")[0] : "Lain-lain");
  const modelName = data.brand && rawModel.startsWith(`${data.brand} `)
    ? rawModel.slice(data.brand.length + 1).trim()
    : rawModel;

  const parsedLoc = parseLegacyLocation(data.location);
  const rowLabel = data.rowLabel || parsedLoc.rowLabel;
  const seatNumber = Number(data.seatNumber) || parsedLoc.seatNumber;
  const location = data.location || `${rowLabel} - Meja ${seatNumber}`;

  return {
    id: docId,
    pcCode,
    labId: data.labId || "SKR-2",
    brand: inferredBrand,
    model: modelName || rawModel || "-",
    serial: String(data.serial || "").trim(),
    rowLabel,
    seatNumber,
    location,
    condition: data.condition || "Baik",
    status: data.status || "Aktif",
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || ""
  };
}

function normalizeLogDoc(docId, data, equipmentList) {
  const matchedEq = equipmentList.find(
    e => e.id === data.equipmentId || e.pcCode === data.pcCode || e.pcCode === data.pcId
  );

  return {
    id: docId,
    logCode: data.logCode || data.id || docId,
    equipmentId: matchedEq ? matchedEq.id : (data.equipmentId || data.pcId || ""),
    pcCode: matchedEq ? matchedEq.pcCode : (data.pcCode || data.pcId || "-"),
    labId: data.labId || (matchedEq ? matchedEq.labId : "SKR-2"),
    type: data.type || "Pemeriksaan Rutin",
    date: data.date || "",
    notes: data.notes || "",
    status: data.status || "Belum Selesai",
    createdBy: data.createdBy || "",
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || ""
  };
}

function generateNextLogCode(existingLogs) {
  const maxNum = existingLogs.reduce((max, log) => {
    const match = String(log.logCode || log.id || "").match(/(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `MNT-${String(maxNum + 1).padStart(4, "0")}`;
}

export async function loadAllData(userRole) {
  const [labsSnap, brandsSnap, eqSnap, logsSnap] = await Promise.all([
    getDocs(collection(db, "labs")),
    getDocs(collection(db, "equipment_brands")),
    getDocs(collection(db, "equipment")),
    getDocs(collection(db, "maintenance_logs"))
  ]);

  state.labs = labsSnap.docs
    .map(d => ({
      id: d.id,
      name: d.data().name || d.id,
      rowsConfig: Array.isArray(d.data().rowsConfig) ? d.data().rowsConfig : ["Baris A", "Baris B", "Baris C"],
      seatsPerRow: Number(d.data().seatsPerRow) || 10
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  state.brands = brandsSnap.docs
    .map(d => ({
      id: d.id,
      name: d.data().name || d.id,
      models: Array.isArray(d.data().models) ? d.data().models : []
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  state.equipment = eqSnap.docs
    .map(d => normalizeEquipmentDoc(d.id, d.data()))
    .sort((a, b) => a.labId.localeCompare(b.labId) || a.pcCode.localeCompare(b.pcCode));

  state.maintenanceLogs = logsSnap.docs
    .map(d => normalizeLogDoc(d.id, d.data(), state.equipment))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.logCode.localeCompare(a.logCode));

  if (userRole === "Pentadbir") {
    const usersSnap = await getDocs(collection(db, "users"));
    state.users = usersSnap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  } else {
    state.users = [];
  }

  return getState();
}

export function getState() {
  return {
    labs: state.labs.map(l => ({ ...l, rowsConfig: [...l.rowsConfig] })),
    brands: state.brands.map(b => ({ ...b, models: [...b.models] })),
    equipment: state.equipment.map(e => ({ ...e })),
    maintenanceLogs: state.maintenanceLogs.map(m => ({ ...m })),
    users: state.users.map(u => ({ ...u }))
  };
}

export async function initDefaultLabsAndBrands() {
  const batch = writeBatch(db);
  let addedLabs = 0;
  let addedBrands = 0;

  for (const lab of DEFAULT_LABS) {
    if (!state.labs.some(l => l.id === lab.id)) {
      batch.set(doc(db, "labs", lab.id), lab);
      addedLabs++;
    }
  }

  for (const brand of DEFAULT_BRANDS) {
    if (!state.brands.some(b => b.name.toLowerCase() === brand.name.toLowerCase())) {
      batch.set(doc(db, "equipment_brands", brand.id), brand);
      addedBrands++;
    }
  }

  if (addedLabs === 0 && addedBrands === 0) {
    return { addedLabs: 0, addedBrands: 0 };
  }

  await batch.commit();

  if (addedLabs > 0) {
    for (const lab of DEFAULT_LABS) {
      if (!state.labs.some(l => l.id === lab.id)) {
        state.labs.push({ ...lab, rowsConfig: [...lab.rowsConfig] });
      }
    }
    state.labs.sort((a, b) => a.id.localeCompare(b.id));
  }

  if (addedBrands > 0) {
    for (const brand of DEFAULT_BRANDS) {
      if (!state.brands.some(b => b.name.toLowerCase() === brand.name.toLowerCase())) {
        state.brands.push({ ...brand, models: [...brand.models] });
      }
    }
    state.brands.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { addedLabs, addedBrands };
}

function validateEquipmentUniqueness(candidate, excludeId = null) {
  const codeNorm = candidate.pcCode.trim().toLowerCase();
  const serialNorm = candidate.serial.trim().toLowerCase();

  const dupCode = state.equipment.find(
    e => e.id !== excludeId && e.labId === candidate.labId && e.pcCode.toLowerCase() === codeNorm
  );
  if (dupCode) {
    throw new Error(`ID Peralatan "${candidate.pcCode}" sudah wujud di ${candidate.labId}.`);
  }

  const dupSerial = state.equipment.find(
    e => e.id !== excludeId && e.serial.toLowerCase() === serialNorm
  );
  if (dupSerial) {
    throw new Error(`Nombor Siri "${candidate.serial}" sudah didaftarkan pada ${dupSerial.pcCode}.`);
  }
}

export async function createEquipment(item) {
  const pcCode = String(item.pcCode || "").trim();
  const serial = String(item.serial || "").trim();
  const labId = String(item.labId || "").trim();
  const brand = String(item.brand || "").trim();
  const model = String(item.model || "").trim();
  const rowLabel = String(item.rowLabel || "Baris A").trim();
  const seatNumber = Number(item.seatNumber) || 1;

  if (!pcCode || !serial || !labId || !brand || !model) {
    throw new Error("Sila lengkapkan semua medan peralatan.");
  }

  validateEquipmentUniqueness({ pcCode, serial, labId });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const record = {
    id,
    pcCode,
    labId,
    brand,
    model,
    serial,
    rowLabel,
    seatNumber,
    location: `${rowLabel} - Meja ${seatNumber}`,
    condition: item.condition || "Baik",
    status: item.status || "Aktif",
    createdAt: now,
    updatedAt: now
  };

  await setDoc(doc(db, "equipment", id), record);
  state.equipment.push(record);
  state.equipment.sort((a, b) => a.labId.localeCompare(b.labId) || a.pcCode.localeCompare(b.pcCode));
  return record;
}

export async function updateEquipment(id, patch) {
  const idx = state.equipment.findIndex(e => e.id === id);
  if (idx === -1) throw new Error("Rekod peralatan tidak dijumpai.");

  const existing = state.equipment[idx];
  const merged = { ...existing, ...patch };

  if (patch.rowLabel !== undefined || patch.seatNumber !== undefined) {
    merged.location = `${merged.rowLabel} - Meja ${merged.seatNumber}`;
    patch.location = merged.location;
  }

  if (patch.pcCode !== undefined || patch.serial !== undefined || patch.labId !== undefined) {
    validateEquipmentUniqueness(merged, id);
  }

  const cleanPatch = {
    ...patch,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(doc(db, "equipment", id), cleanPatch);
  state.equipment[idx] = { ...merged, updatedAt: cleanPatch.updatedAt };
  state.equipment.sort((a, b) => a.labId.localeCompare(b.labId) || a.pcCode.localeCompare(b.pcCode));
  return state.equipment[idx];
}

export async function deleteEquipment(id) {
  const existing = state.equipment.find(e => e.id === id);
  if (!existing) throw new Error("Rekod peralatan tidak dijumpai.");

  const linkedLogs = state.maintenanceLogs.filter(m => m.equipmentId === id);
  const batch = writeBatch(db);
  batch.delete(doc(db, "equipment", id));
  for (const log of linkedLogs) {
    batch.delete(doc(db, "maintenance_logs", log.id));
  }

  await batch.commit();

  state.equipment = state.equipment.filter(e => e.id !== id);
  state.maintenanceLogs = state.maintenanceLogs.filter(m => m.equipmentId !== id);
}

export async function createMaintenanceLog(log) {
  const pc = state.equipment.find(e => e.id === log.equipmentId);
  if (!pc) throw new Error("Komputer yang dipilih tidak dijumpai.");

  const id = crypto.randomUUID();
  const logCode = generateNextLogCode(state.maintenanceLogs);
  const now = new Date().toISOString();

  const record = {
    id,
    logCode,
    equipmentId: pc.id,
    pcCode: pc.pcCode,
    labId: pc.labId,
    type: log.type,
    date: log.date,
    notes: String(log.notes || "").trim(),
    status: log.status,
    createdBy: log.createdBy || "",
    createdAt: now,
    updatedAt: now
  };

  if (!record.notes || !record.date) {
    throw new Error("Sila masukkan tarikh dan catatan penyelenggaraan.");
  }

  await setDoc(doc(db, "maintenance_logs", id), record);
  state.maintenanceLogs.unshift(record);
  state.maintenanceLogs.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.logCode.localeCompare(a.logCode));
  return record;
}

export async function updateMaintenanceLog(id, patch) {
  const idx = state.maintenanceLogs.findIndex(m => m.id === id);
  if (idx === -1) throw new Error("Rekod penyelenggaraan tidak dijumpai.");

  const existing = state.maintenanceLogs[idx];
  const merged = { ...existing, ...patch };

  if (patch.equipmentId && patch.equipmentId !== existing.equipmentId) {
    const pc = state.equipment.find(e => e.id === patch.equipmentId);
    if (!pc) throw new Error("Komputer yang dipilih tidak dijumpai.");
    merged.pcCode = pc.pcCode;
    merged.labId = pc.labId;
    patch.pcCode = pc.pcCode;
    patch.labId = pc.labId;
  }

  const cleanPatch = {
    ...patch,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(doc(db, "maintenance_logs", id), cleanPatch);
  state.maintenanceLogs[idx] = { ...merged, updatedAt: cleanPatch.updatedAt };
  state.maintenanceLogs.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.logCode.localeCompare(a.logCode));
  return state.maintenanceLogs[idx];
}

export async function deleteMaintenanceLog(id) {
  await deleteDoc(doc(db, "maintenance_logs", id));
  state.maintenanceLogs = state.maintenanceLogs.filter(m => m.id !== id);
}

export async function saveLab(lab) {
  const id = String(lab.id || "").trim().toUpperCase();
  const name = String(lab.name || "").trim();
  const rowsConfig = Array.isArray(lab.rowsConfig) && lab.rowsConfig.length > 0
    ? lab.rowsConfig.map(r => r.trim()).filter(Boolean)
    : ["Baris A", "Baris B", "Baris C"];
  const seatsPerRow = Math.max(1, Math.min(60, Number(lab.seatsPerRow) || 10));

  if (!id || !name) {
    throw new Error("Kod makmal dan nama makmal diperlukan.");
  }

  const record = { id, name, rowsConfig, seatsPerRow };
  await setDoc(doc(db, "labs", id), record);

  const idx = state.labs.findIndex(l => l.id === id);
  if (idx >= 0) {
    state.labs[idx] = record;
  } else {
    state.labs.push(record);
    state.labs.sort((a, b) => a.id.localeCompare(b.id));
  }
  return record;
}

export async function deleteLab(labId) {
  if (state.equipment.some(e => e.labId === labId)) {
    throw new Error(`Makmal ${labId} masih mempunyai peralatan berdaftar dan tidak boleh dipadam.`);
  }

  await deleteDoc(doc(db, "labs", labId));
  state.labs = state.labs.filter(l => l.id !== labId);
}

export async function saveBrand(brand) {
  const name = String(brand.name || "").trim();
  if (!name) throw new Error("Nama jenama diperlukan.");

  const models = Array.isArray(brand.models)
    ? [...new Set(brand.models.map(m => m.trim()).filter(Boolean))]
    : [];

  const existingByName = state.brands.find(
    b => b.id !== brand.id && b.name.toLowerCase() === name.toLowerCase()
  );
  if (existingByName) {
    throw new Error(`Jenama "${name}" sudah wujud.`);
  }

  const id = brand.id || `brand-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const record = { id, name, models };
  await setDoc(doc(db, "equipment_brands", id), record);

  const idx = state.brands.findIndex(b => b.id === id);
  if (idx >= 0) {
    state.brands[idx] = record;
  } else {
    state.brands.push(record);
    state.brands.sort((a, b) => a.name.localeCompare(b.name));
  }
  return record;
}

export async function deleteBrand(brandId) {
  await deleteDoc(doc(db, "equipment_brands", brandId));
  state.brands = state.brands.filter(b => b.id !== brandId);
}

export async function updateUserRole(uid, role) {
  const validRoles = ["Pentadbir", "Juruteknik", "Penyelia"];
  if (!validRoles.includes(role)) {
    throw new Error("Peranan tidak sah.");
  }

  await updateDoc(doc(db, "users", uid), { role });
  const idx = state.users.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    state.users[idx].role = role;
  }
}
