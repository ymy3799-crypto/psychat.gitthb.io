const API_BASE = "https://psychat-jhpbnpbkpx.cn-hongkong.fcapp.run/api";
const SESSION_STORAGE_KEY = "mindlane_session";

const tabButtons = document.querySelectorAll(".tab-button");
const forms = {
  login: document.getElementById("loginForm"),
  register: document.getElementById("registerForm"),
};
const feedback = document.getElementById("authFeedback");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const pageEnteredAt = Date.now();

function getCurrentTab() {
  return document.querySelector(".tab-button.active")?.dataset.tab || "login";
}

function setSession(user) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      userId: user.user_id,
      email: user.email,
      displayName: user.display_name || "",
      loginAt: new Date().toISOString(),
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
  trackEvent("tab_switch", { tab: tabName });
}

function togglePasswordVisibility(button) {
  const input = button.previousElementSibling;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  button.textContent = isPassword ? "隐藏" : "显示";
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isValidPassword(password) {
  return password.trim().length >= 6;
}

async function apiRequest(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || "请求失败，请稍后重试。");
  }

  return data;
}

async function handleRegister(event) {
  event.preventDefault();
  clearFeedback();

  const formData = new FormData(forms.register);
  const displayName = (formData.get("displayName") || "").trim();
  const email = normalizeEmail(formData.get("email") || "");
  const password = formData.get("password") || "";
  const confirmPassword = formData.get("confirmPassword") || "";

  if (!email || !password || !confirmPassword) {
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

  try {
    const data = await apiRequest("/register", {
      display_name: displayName,
      email,
      password,
    });
    setSession(data.user);
    showFeedback("注册成功，正在进入聊天主页...", "success");
    trackEvent("register_submit", { email });

    window.setTimeout(() => {
      window.location.href = "./chat.html";
    }, 700);
  } catch (error) {
    showFeedback(error.message, "error");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  clearFeedback();

  const formData = new FormData(forms.login);
  const email = normalizeEmail(formData.get("email") || "");
  const password = formData.get("password") || "";

  if (!email || !password) {
    showFeedback("请输入邮箱和密码。", "error");
    return;
  }

  if (!isValidPassword(password)) {
    showFeedback("密码至少需要 6 位。", "error");
    return;
  }

  try {
    const data = await apiRequest("/login", { email, password });
    setSession(data.user);
    showFeedback("登录成功，正在进入聊天主页...", "success");
    trackEvent("login_submit", { email });

    window.setTimeout(() => {
      window.location.href = "./chat.html";
    }, 700);
  } catch (error) {
    showFeedback(error.message, "error");
  }
}

function trackEvent(eventType, metadata = {}) {
  fetch(`${API_BASE}/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: eventType,
      page: "auth",
      metadata,
    }),
    keepalive: true,
  }).catch(() => {});
}

function trackPageLeave() {
  const payload = {
    event_type: "page_leave",
    page: "auth",
    duration_ms: Date.now() - pageEnteredAt,
    metadata: {
      active_tab: getCurrentTab(),
    },
  };
  navigator.sendBeacon(`${API_BASE}/track`, new Blob([JSON.stringify(payload)], { type: "application/json" }));
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    togglePasswordVisibility(button);
    trackEvent("toggle_password", { tab: getCurrentTab() });
  });
});

forgotPasswordButton.addEventListener("click", () => {
  showFeedback("找回密码功能可在后续后端扩展中接入，当前版本未启用。", "success");
  trackEvent("forgot_password_click");
});

forms.login.addEventListener("submit", handleLogin);
forms.register.addEventListener("submit", handleRegister);
window.addEventListener("load", () => trackEvent("page_view", { page_title: document.title }));
window.addEventListener("beforeunload", trackPageLeave);
