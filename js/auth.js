/* ==========================================================
   FIREBASE AUTHENTICATION MODULE (js/auth.js)
   ========================================================== */
import { auth, db } from "./firebase-config.js";
import { initStorage } from "./storage.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const ROLE_PAGES = {
  Pentadbir: "pentadbir.html",
  Juruteknik: "juruteknik.html",
  Penyelia: "penyelia.html"
};

const PAGE_EXPECTED_ROLE = {
  "pentadbir.html": "Pentadbir",
  "juruteknik.html": "Juruteknik",
  "penyelia.html": "Penyelia"
};

function showAuthError(msg) {
  const box = document.getElementById("authError");
  if (!box) {
    alert(msg);
    return;
  }
  box.textContent = msg;
  box.style.display = "block";
}

function redirectByRole(role) {
  const target = ROLE_PAGES[role];
  if (!target) {
    showAuthError("Peranan pengguna tidak sah: " + role);
    return;
  }
  window.location.href = target;
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", cred.user.uid));

    if (!userDoc.exists()) {
      showAuthError("Profil peranan pengguna tidak dijumpai dalam pangkalan data.");
      return;
    }

    redirectByRole(userDoc.data().role);
  } catch (err) {
    showAuthError("Log masuk gagal: Emel atau kata laluan salah.");
  }
}

async function handleSignUp(event) {
  event.preventDefault();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const password = document.getElementById("regPassword").value;
  const role = document.getElementById("regRole").value;

  if (!name || !email || password.length < 6) {
    showAuthError("Sila lengkapkan maklumat (kata laluan Firebase minimum 6 aksara).");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      role,
      createdAt: new Date().toISOString()
    });

    redirectByRole(role);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      showAuthError("Emel ini telah didaftarkan.");
    } else {
      showAuthError("Pendaftaran gagal: " + err.message);
    }
  }
}

async function logout() {
  await signOut(auth);
  window.location.href = "index.html";
}

// Automatically protect dashboard pages and load Firestore data
const currentPage = window.location.pathname.split("/").pop();
const expectedRole = PAGE_EXPECTED_ROLE[currentPage];

if (expectedRole) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      window.location.href = "index.html";
      return;
    }

    const profile = userDoc.data();
    if (profile.role !== expectedRole) {
      redirectByRole(profile.role);
      return;
    }

    document.body.dataset.role = profile.role;

    const nameEl = document.getElementById("userName");
    const roleEl = document.getElementById("userRoleLabel");
    const avatarEl = document.getElementById("userAvatar");

    if (nameEl) nameEl.textContent = profile.name;
    if (roleEl) roleEl.textContent = profile.role;
    if (avatarEl) avatarEl.textContent = profile.name.charAt(0).toUpperCase();

    await initStorage();
    if (typeof window.refreshAllUI === "function") {
      window.refreshAllUI();
    }
  });
}

// Expose functions globally for HTML onsubmit / onclick attributes
window.handleLogin = handleLogin;
window.handleSignUp = handleSignUp;
window.logout = logout;