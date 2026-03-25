const API_BASE = "https://psychat-jhpbnpbkpx.cn-hongkong.fcapp.run/api";
const SESSION_STORAGE_KEY = "mindlane_session";
const ACTIVE_CONVERSATION_STORAGE_KEY = "mindlane_active_conversation";

const TEXT = {
  defaultUser: "\u7528\u6237",
  completed: "\u5DF2\u5B8C\u6210\u6D4B\u91CF",
  notCompleted: "\u672A\u5B8C\u6210\u6D4B\u91CF",
  inputPlaceholder: "\u8F93\u5165\u6D88\u606F...",
  lockedPlaceholder: "\u8BF7\u5148\u5B8C\u6210\u6D4B\u91CF",
  requestFailed: "\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  emptyHistory: "\u8FD8\u6CA1\u6709\u804A\u5929\u8BB0\u5F55\u3002",
  loaded: "\u5DF2\u52A0\u8F7D\u804A\u5929\u8BB0\u5F55\u3002",
  thinking: "\u601D\u8003\u4E2D...",
  sending: "\u6B63\u5728\u53D1\u9001...",
  needMeasure: "\u8BF7\u5148\u5B8C\u6210\u6D4B\u91CF\uFF0C\u518D\u5F00\u59CB\u6B63\u5F0F\u5BF9\u8BDD\u3002",
  newConversation: "\u5DF2\u5F00\u59CB\u65B0\u7684\u5BF9\u8BDD\u3002",
  truncated: "\u672C\u6B21\u56DE\u590D\u5DF2\u5728\u7F29\u77ED\u4E0A\u4E0B\u6587\u540E\u5B8C\u6210\u3002",
  sent: "\u53D1\u9001\u6210\u529F\u3002",
  emptyMessage: "\u8BF7\u8F93\u5165\u6D88\u606F\u540E\u518D\u53D1\u9001\u3002",
  enterTip: "Enter \u53D1\u9001\uFF0CShift + Enter \u6362\u884C",
};

const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
const desktopSidebarToggle = document.getElementById("desktopSidebarToggle");
const logoutButton = document.getElementById("logoutButton");
const newChatSidebarButton = document.getElementById("newChatSidebarButton");
const userNameNode = document.getElementById("sidebarUserName");
const conversationList = document.getElementById("conversationList");
const conversationCount = document.getElementById("conversationCount");
const messageViewport = document.getElementById("messageViewport");
const messageList = document.getElementById("messageList");
const emptyState = document.getElementById("emptyState");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const chatStatus = document.getElementById("chatStatus");
const measureGate = document.getElementById("measureGate");
const measureBadge = document.getElementById("measureBadge");

let session = null;
let conversations = [];
let activeConversationId = localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY) || null;
const pageEnteredAt = Date.now();
let scaleCompleted = false;

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function redirectToAuth() {
  window.location.href = "./index.html";
}

function ensureSession() {
  session = readSession();
  if (!session?.userId) {
    redirectToAuth();
    return false;
  }

  userNameNode.textContent = session.displayName || TEXT.defaultUser;
  return true;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || TEXT.requestFailed);
  }
  return data;
}

async function syncMeasureState() {
  try {
    const data = await apiRequest(`/scale/status?user_id=${encodeURIComponent(session.userId)}`);
    scaleCompleted = Boolean(data.scale?.completed);
  } catch {
    scaleCompleted = false;
  }

  if (measureBadge) {
    measureBadge.textContent = scaleCompleted ? TEXT.completed : TEXT.notCompleted;
    measureBadge.classList.toggle("done", scaleCompleted);
  }

  if (measureGate) {
    measureGate.hidden = scaleCompleted;
  }

  messageInput.disabled = !scaleCompleted;
  sendButton.disabled = !scaleCompleted;
  messageInput.placeholder = scaleCompleted ? TEXT.inputPlaceholder : TEXT.lockedPlaceholder;
}

function persistActiveConversation() {
  if (activeConversationId) {
    localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, activeConversationId);
  } else {
    localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
  }
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function trackEvent(eventType, metadata = {}, extra = {}) {
  if (!session?.userId) {
    return;
  }

  fetch(`${API_BASE}/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: session.userId,
      event_type: eventType,
      page: "chat",
      metadata,
      ...extra,
    }),
    keepalive: true,
  }).catch(() => {});
}

function trackPageLeave() {
  if (!session?.userId) {
    return;
  }

  const payload = {
    user_id: session.userId,
    event_type: "page_leave",
    page: "chat",
    duration_ms: Date.now() - pageEnteredAt,
    metadata: {
      conversation_id: activeConversationId,
    },
  };

  navigator.sendBeacon(`${API_BASE}/track`, new Blob([JSON.stringify(payload)], { type: "application/json" }));
}

function renderConversationList() {
  conversationList.innerHTML = "";
  conversationCount.textContent = String(conversations.length);

  if (!conversations.length) {
    const empty = document.createElement("p");
    empty.className = "sidebar-user-meta";
    empty.textContent = TEXT.emptyHistory;
    conversationList.appendChild(empty);
    return;
  }

  conversations.forEach((conversation) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `conversation-item ${conversation.conversation_id === activeConversationId ? "active" : ""}`;
    button.innerHTML = `
      <p class="conversation-title"></p>
      <p class="conversation-meta">${formatTime(conversation.updated_at)}</p>
    `;
    button.querySelector(".conversation-title").textContent = conversation.title;
    button.addEventListener("click", async () => {
      activeConversationId = conversation.conversation_id;
      persistActiveConversation();
      renderConversationList();
      await loadConversation(activeConversationId);
      chatStatus.textContent = TEXT.loaded;
      trackEvent("conversation_click", { conversation_id: activeConversationId });

      if (window.innerWidth <= 960) {
        document.body.classList.remove("sidebar-open");
      }
    });
    conversationList.appendChild(button);
  });
}

function appendMessageNode(role, content, options = {}) {
  const row = document.createElement("div");
  row.className = `message-row ${role} ${options.thinking ? "thinking" : ""}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (options.thinking) {
    bubble.innerHTML = `
      <span>${TEXT.thinking}</span>
      <span class="typing-dots" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
    `;
  } else {
    bubble.textContent = content;
  }

  row.appendChild(bubble);
  messageList.appendChild(row);
  return row;
}

function renderMessages(messages = []) {
  messageList.innerHTML = "";

  if (!messages.length) {
    emptyState.hidden = false;
    messageList.hidden = true;
    return;
  }

  emptyState.hidden = true;
  messageList.hidden = false;

  messages.forEach((message) => {
    appendMessageNode(message.role, message.content);
  });

  scrollToBottom();
}

function scrollToBottom() {
  messageViewport.scrollTo({
    top: messageViewport.scrollHeight,
    behavior: "smooth",
  });
}

function autoResizeTextarea() {
  messageInput.style.height = "auto";
  const maxHeight = parseFloat(getComputedStyle(messageInput).lineHeight) * 4 + 18;
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, maxHeight)}px`;
}

function setSendingState(isSending) {
  sendButton.disabled = isSending || !scaleCompleted;
  messageInput.disabled = isSending || !scaleCompleted;
  if (isSending) {
    chatStatus.textContent = TEXT.sending;
  }
}

async function fetchConversations() {
  const data = await apiRequest(`/conversations?user_id=${encodeURIComponent(session.userId)}`);
  conversations = data.conversations || [];
  if (!activeConversationId && conversations.length) {
    activeConversationId = conversations[0].conversation_id;
    persistActiveConversation();
  }
  renderConversationList();
}

async function loadConversation(conversationId) {
  const data = await apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}?user_id=${encodeURIComponent(session.userId)}`,
  );
  renderMessages(data.conversation.messages || []);
}

async function createConversation() {
  if (!scaleCompleted) {
    chatStatus.textContent = TEXT.needMeasure;
    return;
  }

  const data = await apiRequest("/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: session.userId }),
  });

  activeConversationId = data.conversation.conversation_id;
  persistActiveConversation();
  await fetchConversations();
  renderMessages([]);
  chatStatus.textContent = TEXT.newConversation;
  trackEvent("new_conversation_click", { conversation_id: activeConversationId });

  if (window.innerWidth <= 960) {
    document.body.classList.remove("sidebar-open");
  }
}

async function sendMessage(content) {
  if (!activeConversationId) {
    await createConversation();
    if (!activeConversationId) {
      return;
    }
  }

  appendMessageNode("user", content);
  emptyState.hidden = true;
  messageList.hidden = false;
  const thinkingNode = appendMessageNode("assistant", "", { thinking: true });
  scrollToBottom();
  setSendingState(true);

  try {
    const startedAt = performance.now();
    const data = await apiRequest("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: session.userId,
        conversation_id: activeConversationId,
        message: content,
      }),
    });

    const elapsedMs = Math.round(performance.now() - startedAt);
    activeConversationId = data.conversation_id;
    persistActiveConversation();
    thinkingNode.remove();
    appendMessageNode("assistant", data.reply || "");
    scrollToBottom();
    await fetchConversations();
    chatStatus.textContent = data.context_truncated ? TEXT.truncated : TEXT.sent;
    trackEvent("chat_round_completed", {
      conversation_id: activeConversationId,
      response_time_ms: data.response_time_ms || elapsedMs,
      context_truncated: Boolean(data.context_truncated),
    });
  } catch (error) {
    thinkingNode.remove();
    if (activeConversationId) {
      await loadConversation(activeConversationId).catch(() => {});
    }
    chatStatus.textContent = error.message;
  } finally {
    messageInput.value = "";
    autoResizeTextarea();
    setSendingState(false);
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!scaleCompleted) {
    chatStatus.textContent = TEXT.needMeasure;
    return;
  }

  const content = messageInput.value.trim();
  if (!content) {
    chatStatus.textContent = TEXT.emptyMessage;
    return;
  }

  await sendMessage(content);
}

function handleKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
}

async function handleLogout() {
  try {
    await apiRequest("/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: session.userId }),
    });
  } catch {
    // ignore
  }

  trackEvent("logout_click", { conversation_id: activeConversationId });
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
  redirectToAuth();
}

mobileSidebarToggle.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-open");
});

desktopSidebarToggle.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
});

if (newChatSidebarButton) {
  newChatSidebarButton.addEventListener("click", createConversation);
}

logoutButton.addEventListener("click", handleLogout);
messageInput.addEventListener("input", autoResizeTextarea);
messageInput.addEventListener("keydown", handleKeydown);
chatForm.addEventListener("submit", handleSubmit);

window.addEventListener("beforeunload", trackPageLeave);
window.addEventListener("load", async () => {
  if (!ensureSession()) {
    return;
  }

  await syncMeasureState();
  trackEvent("page_view", { page_title: document.title });
  await fetchConversations();

  if (activeConversationId) {
    try {
      await loadConversation(activeConversationId);
    } catch {
      activeConversationId = null;
      persistActiveConversation();
      renderMessages([]);
    }
  } else {
    renderMessages([]);
  }

  autoResizeTextarea();
});
