const API_BASE = "https://psychat-jhpbnpbkpx.cn-hongkong.fcapp.run/api";
const SESSION_STORAGE_KEY = "mindlane_session";

const TEXT = {
  show: "\u663E\u793A",
  hide: "\u9690\u85CF",
  requestFailed: "\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  registerIncomplete: "\u8BF7\u5B8C\u6574\u586B\u5199\u6CE8\u518C\u4FE1\u606F\u3002",
  passwordShort: "\u5BC6\u7801\u81F3\u5C11\u9700\u8981 6 \u4F4D\u3002",
  passwordMismatch: "\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4\u3002",
  registerSuccess: "\u6CE8\u518C\u6210\u529F\uFF0C\u6B63\u5728\u8FDB\u5165\u6D4B\u91CF\u9875\u9762...",
  loginIncomplete: "\u8BF7\u8F93\u5165\u90AE\u7BB1\u548C\u5BC6\u7801\u3002",
  loginSuccess: "\u767B\u5F55\u6210\u529F\uFF0C\u6B63\u5728\u8FDB\u5165\u6D4B\u91CF\u9875\u9762...",
};

const tabButtons = document.querySelectorAll(".tab-button");
const forms = {
  login: document.getElementById("loginForm"),
  register: document.getElementById("registerForm"),
};
const feedback = document.getElementById("authFeedback");
const pageEnteredAt = Date.now();

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function getCurrentTab() {
  return document.querySelector(".tab-button.active")?.dataset.tab || "login";
}

function setSession(user, displayName) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      userId: user.user_id,
      email: user.email,
      displayName: displayName || user.display_name || "",
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
  button.textContent = isPassword ? TEXT.hide : TEXT.show;
}

function isValidPassword(password) {
  return password.trim().length >= 6;
}

async function apiRequest(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || TEXT.requestFailed);
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
    showFeedback(TEXT.registerIncomplete, "error");
    return;
  }

  if (!isValidPassword(password)) {
    showFeedback(TEXT.passwordShort, "error");
    return;
  }

  if (password !== confirmPassword) {
    showFeedback(TEXT.passwordMismatch, "error");
    return;
  }

  try {
    const data = await apiRequest("/register", {
      display_name: displayName,
      email,
      password,
    });
    setSession(data.user, displayName);
    showFeedback(TEXT.registerSuccess, "success");
    trackEvent("register_submit", { email });
    window.setTimeout(() => {
      window.location.href = "./measure.html";
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
    showFeedback(TEXT.loginIncomplete, "error");
    return;
  }

  if (!isValidPassword(password)) {
    showFeedback(TEXT.passwordShort, "error");
    return;
  }

  try {
    const data = await apiRequest("/login", {
      email,
      password,
    });
    setSession(data.user, data.user.display_name || "");
    showFeedback(TEXT.loginSuccess, "success");
    trackEvent("login_submit", { email });
    window.setTimeout(() => {
      window.location.href = "./measure.html";
    }, 700);
  } catch (error) {
    showFeedback(error.message, "error");
  }
}

function trackEvent(eventType, metadata = {}) {
  fetch(`${API_BASE}/track`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
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
  navigator.sendBeacon(`${API_BASE}/track`, new Blob([JSON.stringify(payload)], { type: "text/plain;charset=UTF-8" }));
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

forms.login.addEventListener("submit", handleLogin);
forms.register.addEventListener("submit", handleRegister);
window.addEventListener("load", () => trackEvent("page_view", { page_title: document.title }));
window.addEventListener("beforeunload", trackPageLeave);
