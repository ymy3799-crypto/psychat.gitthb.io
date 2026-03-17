const SESSION_STORAGE_KEY = "mindlane_session";
const CONVERSATION_STORAGE_KEY = "mindlane_conversations";

const APP_CONFIG = {
  chatApiUrl: "",
};

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

let conversations = readConversations();
let activeConversationId = conversations[0]?.id || null;

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function readConversations() {
  try {
    return JSON.parse(localStorage.getItem(CONVERSATION_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function writeConversations() {
  localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(conversations));
}

function redirectToAuth() {
  window.location.href = "./index.html";
}

function ensureSession() {
  const session = readSession();

  if (!session?.email) {
    redirectToAuth();
    return null;
  }

  userNameNode.textContent = session.displayName || session.email.split("@")[0] || "";
  userMetaNode.textContent = session.email;
  return session;
}

function generateId() {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createNewConversation() {
  const conversation = {
    id: generateId(),
    title: "新的对话",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  conversations.unshift(conversation);
  activeConversationId = conversation.id;
  writeConversations();
  renderConversationList();
  renderMessages();
  chatStatus.textContent = "已创建新的空白对话。";

  if (window.innerWidth <= 960) {
    document.body.classList.remove("sidebar-open");
  }
}

function getActiveConversation() {
  return conversations.find((item) => item.id === activeConversationId) || null;
}

function updateConversationTitle(conversation) {
  const firstUserMessage = conversation.messages.find((message) => message.role === "user");
  conversation.title = firstUserMessage ? firstUserMessage.content.slice(0, 18) || "新的对话" : "新的对话";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
    button.className = `conversation-item ${conversation.id === activeConversationId ? "active" : ""}`;
    button.innerHTML = `
      <p class="conversation-title">${escapeHtml(conversation.title)}</p>
      <p class="conversation-meta">${formatTime(conversation.updatedAt)}</p>
    `;
    button.addEventListener("click", () => {
      activeConversationId = conversation.id;
      renderConversationList();
      renderMessages();
      chatStatus.textContent = "已加载历史记录。";

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

function scrollToBottom() {
  messageViewport.scrollTo({
    top: messageViewport.scrollHeight,
    behavior: "smooth",
  });
}

function renderMessages() {
  const conversation = getActiveConversation();
  messageList.innerHTML = "";

  if (!conversation || !conversation.messages.length) {
    emptyState.hidden = false;
    messageList.hidden = true;
    return;
  }

  emptyState.hidden = true;
  messageList.hidden = false;

  conversation.messages.forEach((message) => {
    appendMessageNode(message.role, message.content);
  });

  scrollToBottom();
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

async function sendMessage(content) {
  if (!getActiveConversation()) {
    createNewConversation();
  }

  const currentConversation = getActiveConversation();
  const userMessage = {
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };

  currentConversation.messages.push(userMessage);
  currentConversation.updatedAt = new Date().toISOString();
  updateConversationTitle(currentConversation);
  writeConversations();
  renderConversationList();
  renderMessages();

  const thinkingNode = appendMessageNode("assistant", "", { thinking: true });
  messageList.hidden = false;
  emptyState.hidden = true;
  scrollToBottom();
  setSendingState(true);

  try {
    if (!APP_CONFIG.chatApiUrl) {
      throw new Error("尚未配置聊天接口地址。请在 chat.js 中填写 APP_CONFIG.chatApiUrl。");
    }

    const response = await fetch(APP_CONFIG.chatApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: currentConversation.id,
        message: content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `请求失败，状态码 ${response.status}`);
    }

    const data = await response.json();
    const assistantText = data.reply?.trim();

    if (!assistantText) {
      throw new Error("接口未返回有效回复内容。");
    }

    thinkingNode.remove();

    currentConversation.messages.push({
      role: "assistant",
      content: assistantText,
      createdAt: new Date().toISOString(),
    });
    currentConversation.updatedAt = new Date().toISOString();
    writeConversations();
    renderConversationList();
    renderMessages();
  } catch (error) {
    thinkingNode.remove();
    chatStatus.textContent = error.message;
  } finally {
    setSendingState(false);
    messageInput.value = "";
    autoResizeTextarea();
  }
}

function handleSubmit(event) {
  event.preventDefault();
  const content = messageInput.value.trim();

  if (!content) {
    chatStatus.textContent = "请输入消息后再发送。";
    return;
  }

  sendMessage(content);
}

function handleKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
}

mobileSidebarToggle.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-open");
});

desktopSidebarToggle.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
});

newChatButtons.forEach((button) => {
  button.addEventListener("click", createNewConversation);
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  redirectToAuth();
});

messageInput.addEventListener("input", autoResizeTextarea);
messageInput.addEventListener("keydown", handleKeydown);
chatForm.addEventListener("submit", handleSubmit);

ensureSession();
renderConversationList();
renderMessages();
autoResizeTextarea();
