import { auth, db } from "./config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const savedTheme = localStorage.getItem("rcems_theme") || "light";
document.documentElement.dataset.theme = savedTheme;

const normalizedPath = window.location.pathname.replace(/\/+$/, "").replace(/\.html$/, "");
const isDashboardPage = normalizedPath.endsWith("/dashboard");
const isLoginPage = !isDashboardPage;

let authActionInFlight = false;

function showAuthError(msg) {
  const box = document.getElementById("authError");
  if (!box) return;
  box.textContent = msg;
  box.hidden = false;
}

function clearAuthError() {
  const box = document.getElementById("authError");
  if (!box) return;
  box.textContent = "";
  box.hidden = true;
}

export async function ensureUserProfile(user, explicitName = "") {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { uid: user.uid, ...userSnap.data() };
  }

  const fallbackName = explicitName
    || user.displayName
    || (user.email ? user.email.split("@")[0] : "Pengguna");

  const profile = {
    name: fallbackName,
    email: (user.email || "").toLowerCase(),
    role: "Penyelia",
    createdAt: new Date().toISOString()
  };

  await setDoc(userRef, profile);
  return { uid: user.uid, ...profile };
}

function switchAuthTab(mode) {
  const isLogin = mode === "login";
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");

  if (loginForm) loginForm.hidden = !isLogin;
  if (registerForm) registerForm.hidden = isLogin;
  if (tabLogin) tabLogin.classList.toggle("active", isLogin);
  if (tabRegister) tabRegister.classList.toggle("active", !isLogin);
  clearAuthError();
}

async function handleLogin(event) {
  event.preventDefault();
  clearAuthError();

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const submitBtn = event.currentTarget.querySelector('button[type="submit"]');

  if (submitBtn) submitBtn.disabled = true;
  authActionInFlight = true;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(cred.user);
    window.location.replace("dashboard.html");
  } catch (err) {
    authActionInFlight = false;
    showAuthError("Log masuk gagal: Emel atau kata laluan salah.");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleSignUp(event) {
  event.preventDefault();
  clearAuthError();

  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const password = document.getElementById("regPassword").value;
  const submitBtn = event.currentTarget.querySelector('button[type="submit"]');

  if (!name || !email || password.length < 6) {
    showAuthError("Sila lengkapkan maklumat (kata laluan minimum 6 aksara).");
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  authActionInFlight = true;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(cred.user, name);
    window.location.replace("dashboard.html");
  } catch (err) {
    authActionInFlight = false;
    if (err.code === "auth/email-already-in-use") {
      showAuthError("Emel ini telah didaftarkan.");
    } else {
      showAuthError(`Pendaftaran gagal: ${err.message}`);
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleGoogleLogin() {
  clearAuthError();
  const googleBtn = document.getElementById("googleLoginBtn");
  if (googleBtn) googleBtn.disabled = true;
  authActionInFlight = true;

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    await ensureUserProfile(cred.user);
    window.location.replace("dashboard.html");
  } catch (err) {
    authActionInFlight = false;
    if (err.code === "auth/popup-closed-by-user") {
      showAuthError("Log masuk Google dibatalkan.");
    } else {
      showAuthError(`Log masuk Google gagal: ${err.message}`);
    }
  } finally {
    if (googleBtn) googleBtn.disabled = false;
  }
}

export async function logout() {
  await signOut(auth);
  window.location.replace("index.html");
}

export function onDashboardAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("index.html");
      return;
    }

    try {
      const profile = await ensureUserProfile(user);
      await callback(user, profile);
    } catch (err) {
      console.error("Ralat mengesahkan profil pengguna:", err);
      await signOut(auth);
      window.location.replace("index.html");
    }
  });
}

if (isLoginPage) {
  document.addEventListener("DOMContentLoaded", () => {
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const googleBtn = document.getElementById("googleLoginBtn");

    if (tabLogin) tabLogin.addEventListener("click", () => switchAuthTab("login"));
    if (tabRegister) tabRegister.addEventListener("click", () => switchAuthTab("register"));
    if (loginForm) loginForm.addEventListener("submit", handleLogin);
    if (registerForm) registerForm.addEventListener("submit", handleSignUp);
    if (googleBtn) googleBtn.addEventListener("click", handleGoogleLogin);

    onAuthStateChanged(auth, async (user) => {
      if (user && !authActionInFlight) {
        try {
          await ensureUserProfile(user);
          window.location.replace("dashboard.html");
        } catch (err) {
          console.error("Ralat semakan sesi:", err);
        }
      }
    });
  });
}
