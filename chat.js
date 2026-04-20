const API_BASE = "https://api.psychat.site/api";
const SESSION_STORAGE_KEY = "mindlane_session";
const ACTIVE_CONVERSATION_STORAGE_KEY = "mindlane_active_conversation";

const TEXT = {
  defaultUser: "用户",
  requestFailed: "请求失败，请稍后重试。",
  emptyHistory: "还没有聊天记录。",
  loaded: "已加载聊天记录。",
  thinking: "思考中...",
  sending: "正在发送...",
  newConversation: "已开始新的对话。",
  truncated: "本次回复已在缩短上下文后完成。",
  sent: "发送成功。",
  emptyMessage: "请输入消息后再发送。",
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
const roundCounterValue = document.getElementById("roundCounterValue");

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdown(content) {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listType = null;
  let listItems = [];

  function flushParagraph() {
    if (!paragraphLines.length) {
      return;
    }
    blocks.push(`<p>${paragraphLines.map(renderInlineMarkdown).join("<br>")}</p>`);
    paragraphLines = [];
  }

  function flushList() {
    if (!listType || !listItems.length) {
      return;
    }
    const tag = listType === "ol" ? "ol" : "ul";
    blocks.push(`<${tag}>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${tag}>`);
    listType = null;
    listItems = [];
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);

    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1]);
      return;
    }

    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();

  return blocks.join("") || `<p>${renderInlineMarkdown(content)}</p>`;
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
  } else if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.textContent = content;
  }

  row.appendChild(bubble);
  messageList.appendChild(row);
  return row;
}

function updateRoundCounter(messages = []) {
  if (!roundCounterValue) {
    return;
  }
  const rounds = messages.filter((message) => message.role === "user").length;
  roundCounterValue.textContent = String(rounds);
}

function renderMessages(messages = []) {
  messageList.innerHTML = "";
  updateRoundCounter(messages);

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
  if (roundCounterValue) {
    roundCounterValue.textContent = String(Number(roundCounterValue.textContent || "0") + 1);
  }
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

  const content = messageInput.value.trim();
  if (!content) {
    chatStatus.textContent = TEXT.emptyMessage;
    return;
  }

  messageInput.value = "";
  autoResizeTextarea();
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

newChatSidebarButton?.addEventListener("click", createConversation);
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
