const API_BASE = "https://psychat-jhpbnpbkpx.cn-hongkong.fcapp.run/api";
const SESSION_STORAGE_KEY = "mindlane_session";

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
  button.textContent = isPassword ? "Hide" : "Show";
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
    throw new Error(data.message || "Request failed. Please try again.");
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
    showFeedback("Please complete the registration form.", "error");
    return;
  }

  if (!isValidPassword(password)) {
    showFeedback("Password must be at least 6 characters.", "error");
    return;
  }

  if (password !== confirmPassword) {
    showFeedback("The two passwords do not match.", "error");
    return;
  }

  try {
    const data = await apiRequest("/register", {
      display_name: displayName,
      email,
      password,
    });
    setSession(data.user, displayName);
    showFeedback("Registration successful. Redirecting...", "success");
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
    showFeedback("Please enter your email and password.", "error");
    return;
  }

  if (!isValidPassword(password)) {
    showFeedback("Password must be at least 6 characters.", "error");
    return;
  }

  try {
    const data = await apiRequest("/login", {
      email,
      password,
    });
    setSession(data.user, data.user.display_name || "");
    showFeedback("Login successful. Redirecting...", "success");
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

forms.login.addEventListener("submit", handleLogin);
forms.register.addEventListener("submit", handleRegister);
window.addEventListener("load", () => trackEvent("page_view", { page_title: document.title }));
window.addEventListener("beforeunload", trackPageLeave);
