const AUTH_STORAGE_KEY = "mindlane_users";
const SESSION_STORAGE_KEY = "mindlane_session";

const tabButtons = document.querySelectorAll(".tab-button");
const forms = {
  login: document.getElementById("loginForm"),
  register: document.getElementById("registerForm"),
};
const feedback = document.getElementById("authFeedback");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
}

function setSession(user) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      displayName: user.displayName,
      email: user.email,
      lastLoginAt: new Date().toISOString(),
    }),
  );
}

function showFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
}

function clearFeedback() {
  feedback.textContent = "";
  feedback.className = "feedback";
}

function switchTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  Object.entries(forms).forEach(([name, form]) => {
    form.classList.toggle("active", name === tabName);
  });

  clearFeedback();
}

function togglePasswordVisibility(button) {
  const input = button.previousElementSibling;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  button.textContent = isPassword ? "隐藏" : "显示";
}

function isValidPassword(password) {
  return password.trim().length >= 6;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function handleRegister(event) {
  event.preventDefault();
  clearFeedback();

  const formData = new FormData(forms.register);
  const displayName = formData.get("displayName").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (!displayName || !email || !password || !confirmPassword) {
    showFeedback("请完整填写注册信息。", "error");
    return;
  }

  if (!isValidPassword(password)) {
    showFeedback("密码至少需要 6 位。", "error");
    return;
  }

  if (password !== confirmPassword) {
    showFeedback("两次输入的密码不一致。", "error");
    return;
  }

  const users = readUsers();
  const exists = users.some((user) => user.email === email);

  if (exists) {
    showFeedback("该邮箱已经注册过，请直接登录。", "error");
    return;
  }

  const newUser = {
    displayName,
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);
  setSession(newUser);
  showFeedback("注册成功，正在进入聊天主页...", "success");

  window.setTimeout(() => {
    window.location.href = "./chat.html";
  }, 700);
}

function handleLogin(event) {
  event.preventDefault();
  clearFeedback();

  const formData = new FormData(forms.login);
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");

  if (!email || !password) {
    showFeedback("请输入邮箱和密码。", "error");
    return;
  }

  if (!isValidPassword(password)) {
    showFeedback("密码至少需要 6 位。", "error");
    return;
  }

  const users = readUsers();
  const user = users.find((item) => item.email === email && item.password === password);

  if (!user) {
    showFeedback("邮箱或密码不正确。", "error");
    return;
  }

  setSession(user);
  showFeedback("登录成功，正在进入聊天主页...", "success");

  window.setTimeout(() => {
    window.location.href = "./chat.html";
  }, 700);
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => togglePasswordVisibility(button));
});

forgotPasswordButton.addEventListener("click", () => {
  showFeedback("找回密码接口需在后端接入后启用，当前为前端演示版本。", "success");
});

forms.login.addEventListener("submit", handleLogin);
forms.register.addEventListener("submit", handleRegister);
