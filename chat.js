const API_BASE = "/api";
const SESSION_STORAGE_KEY = "mindlane_session";
const ACTIVE_CONVERSATION_STORAGE_KEY = "mindlane_active_conversation";

const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
const desktopSidebarToggle = document.getElementById("desktopSidebarToggle");
const logoutButton = document.getElementById("logoutButton");
const newChatButtons = [
  document.getElementById("newChatSidebarButton"),
  document.getElementById("newChatHeaderButton"),
];
const userNameNode = document.getElementById("sidebarUserName");
const userMetaNode = document.getElementById("sidebarUserMeta");
const conversationList = document.getElementById("conversationList");
const conversationCount = document.getElementById("conversationCount");
const messageViewport = document.getElementById("messageViewport");
const messageList = document.getElementById("messageList");
const emptyState = document.getElementById("emptyState");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const chatStatus = document.getElementById("chatStatus");

let session = null;
let conversations = [];
let activeConversationId = localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY) || null;
const pageEnteredAt = Date.now();

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function redirectToAuth() {
  window.location.href = "/";
}

function ensureSession() {
  session = readSession();

  if (!session?.userId || !session?.email) {
    redirectToAuth();
    return false;
  }

  userNameNode.textContent = session.displayName || session.email.split("@")[0];
  userMetaNode.textContent = session.email;
  return true;
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

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || "请求失败，请稍后重试。");
  }

  return data;
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
    empty.textContent = "还没有历史对话。";
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
      chatStatus.textContent = "已加载历史记录。";
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
      <span>思考中...</span>
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
  sendButton.disabled = isSending;
  messageInput.disabled = isSending;
  chatStatus.textContent = isSending ? "正在向大模型发送消息..." : "";
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
  chatStatus.textContent = "已创建新的空白对话。";
  trackEvent("new_conversation_click", { conversation_id: activeConversationId });

  if (window.innerWidth <= 960) {
    document.body.classList.remove("sidebar-open");
  }
}

async function sendMessage(content) {
  if (!activeConversationId) {
    await createConversation();
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
    chatStatus.textContent = data.context_truncated
      ? "消息已发送，本次回复因上下文过长自动进行了临时截断重试。"
      : "消息发送成功。";
    trackEvent("chat_round_completed", {
      conversation_id: activeConversationId,
      response_time_ms: data.response_time_ms || elapsedMs,
      context_truncated: Boolean(data.context_truncated),
    });
  } catch (error) {
    thinkingNode.remove();
    await loadConversation(activeConversationId);
    chatStatus.textContent = error.message;
  } finally {
    setSendingState(false);
    messageInput.value = "";
    autoResizeTextarea();
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const content = messageInput.value.trim();

  if (!content) {
    chatStatus.textContent = "请输入消息后再发送。";
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
    // 即使上报失败，也允许本地退出。
  }

  trackEvent("logout_click", { conversation_id: activeConversationId });
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
  redirectToAuth();
}

mobileSidebarToggle.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-open");
  trackEvent("sidebar_toggle_mobile", { open: document.body.classList.contains("sidebar-open") });
});

desktopSidebarToggle.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
  trackEvent("sidebar_toggle_desktop", { collapsed: document.body.classList.contains("sidebar-collapsed") });
});

newChatButtons.forEach((button) => {
  button.addEventListener("click", createConversation);
});

logoutButton.addEventListener("click", handleLogout);
messageInput.addEventListener("input", autoResizeTextarea);
messageInput.addEventListener("keydown", handleKeydown);
chatForm.addEventListener("submit", handleSubmit);

window.addEventListener("beforeunload", trackPageLeave);
window.addEventListener("load", async () => {
  if (!ensureSession()) {
    return;
  }

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
