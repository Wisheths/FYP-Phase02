const USERS_KEY = 'skr2_users';
const SESSION_KEY = 'skr2_current_user';

const ROLE_PAGES = {
  Pentadbir: 'pentadbir.html',
  Juruteknik: 'juruteknik.html',
  Penyelia: 'penyelia.html'
};

const DEFAULT_USERS = [
  { name: 'Pentadbir Sistem', email: 'admin@kvas.edu.my', password: '123', role: 'Pentadbir' },
  { name: 'Juruteknik Makmal', email: 'tech@kvas.edu.my', password: '123', role: 'Juruteknik' },
  { name: 'Penyelia Makmal', email: 'penyelia@kvas.edu.my', password: '123', role: 'Penyelia' }
];

function getUsers() {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch (e) {
    // fallback to defaults
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  return [...DEFAULT_USERS];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function showAuthError(msg) {
  const box = document.getElementById('authError');
  if (!box) {
    alert(msg);
    return;
  }
  box.textContent = msg;
  box.style.display = 'block';
}

function redirectByRole(role) {
  const target = ROLE_PAGES[role];
  if (!target) {
    showAuthError('Peranan tidak sah: ' + role);
    return;
  }
  window.location.href = target;
}

function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value.trim();

  const users = getUsers();
  const user = users.find((u) => u.email.toLowerCase() === email && u.password === password);

  if (!user) {
    showAuthError('Emel atau kata laluan salah.');
    return;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify({
    name: user.name,
    email: user.email,
    role: user.role
  }));

  redirectByRole(user.role);
}

function handleSignUp(event) {
  event.preventDefault();

  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value.trim();
  const role = document.getElementById('regRole').value;

  if (!name || !email || password.length < 3) {
    showAuthError('Sila lengkapkan semua maklumat (kata laluan min. 3 aksara).');
    return;
  }

  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    showAuthError('Emel ini telah didaftarkan.');
    return;
  }

  const newUser = { name, email, password, role };
  users.push(newUser);
  saveUsers(users);

  localStorage.setItem(SESSION_KEY, JSON.stringify({
    name: newUser.name,
    email: newUser.email,
    role: newUser.role
  }));

  redirectByRole(newUser.role);
}

function requireAuth(expectedRole) {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (e) {
    user = null;
  }

  if (!user || !user.role) {
    window.location.href = 'index.html';
    return;
  }

  if (expectedRole && user.role !== expectedRole) {
    redirectByRole(user.role);
    return;
  }

  document.body.dataset.role = user.role;

  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRoleLabel');
  const avatarEl = document.getElementById('userAvatar');

  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role;
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}