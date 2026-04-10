const API_BASE = "https://psychat-jhpbnpbkpx.cn-hongkong.fcapp.run/api";
const SESSION_STORAGE_KEY = "mindlane_session";

const measureForm = document.getElementById("measureForm");
const questionTemplate = document.getElementById("questionTemplate");
const measureStatus = document.getElementById("measureStatus");
const measureLocked = document.getElementById("measureLocked");
const resetMeasureButton = document.getElementById("resetMeasureButton");

const OPTIONS = [
  { value: 1, title: "完全不符合", lines: ["完全", "不符合"] },
  { value: 2, title: "大部分不符合", lines: ["大部分", "不符合"] },
  { value: 3, title: "有点不符合", lines: ["有点", "不符合"] },
  { value: 4, title: "有点符合", lines: ["有点", "符合"] },
  { value: 5, title: "大部分符合", lines: ["大部分", "符合"] },
  { value: 6, title: "完全符合", lines: ["完全", "符合"] },
];

const QUESTIONS = [
  "我常感到害怕",
  "一旦确定了目标，我会坚持努力地实现它",
  "我觉得大部分人基本上是心怀善意的",
  "我头脑中经常充满生动的画面",
  "我对人多的聚会感到乏味",
  "有时我觉得自己一无是处",
  "我常常是仔细考虑之后才做出决定",
  "我不太关心别人是否受到不公正的待遇",
  "我是个勇于冒险，突破常规的人",
  "在热闹的聚会上，我常常表现主动并尽情玩耍",
  "别人一句漫不经心的话，我常会联系在自己身上",
  "别人认为我是个慎重的人",
  "我时常觉得别人的痛苦与我无关",
  "我喜欢冒险",
  "我尽量避免参加人多的聚会和嘈杂的环境",
  "在面对压力时，我有种快要崩溃的感觉",
  "我喜欢一开头就把事情计划好",
  "我是那种只照顾好自己，不替别人担忧的人",
  "我对许多事情有着很强的好奇心",
  "有我在的场合一般不会冷场",
  "我常担忧一些无关紧要的事情",
  "我工作或学习很勤奋",
  "虽然社会上有些骗子，但我觉得大部分人还是可信的",
  "我身上具有别人没有的冒险精神",
  "在一个团体中，我希望处于领导地位",
  "我常常感到内心不踏实",
  "我是个倾尽全力做事的人",
  "当别人向我诉说不幸时，我常感到难过",
  "我渴望学习一些新东西，即使它们与我的日常生活无关",
  "别人多认为我是一个热情和友好的人",
  "我常担心有什么不好的事情要发生",
  "在工作上，我常只求能应付过去便可",
  "尽管人类社会存在着一些阴暗的东西（如战争、罪恶、欺诈），我仍然相信人性总的来说是善良的。",
  "我的想象力相当丰富",
  "我喜欢参加社交与娱乐聚会",
  "我很少感到忧郁或沮丧",
  "做事讲究逻辑和条理是我的一个特点",
  "我常为那些遭遇不幸的人感到难过",
  "我很愿意也很容易接受那些新事物、新观点、新想法",
  "我希望成为领导者而不是被领导者",
];

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

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || "请求失败，请稍后重试。");
  }
  return data;
}

function updateStatus(message, type = "") {
  measureStatus.textContent = message;
  measureStatus.className = `measure-status ${type}`.trim();
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function renderQuestions() {
  measureForm.innerHTML = "";

  QUESTIONS.forEach((question, index) => {
    const fragment = questionTemplate.content.cloneNode(true);
    const questionNumber = index + 1;
    const inputName = `q${questionNumber}`;

    fragment.querySelector(".question-index").textContent = `(${questionNumber})`;
    fragment.querySelector(".question-text").textContent = question;
    const optionGrid = fragment.querySelector(".option-grid");

    OPTIONS.forEach((option) => {
      const label = document.createElement("label");
      label.className = "likert-option";
      label.title = option.title;

      const input = document.createElement("input");
      input.type = "radio";
      input.name = inputName;
      input.value = String(option.value);
      input.required = true;

      const score = document.createElement("span");
      score.className = "likert-option-score";
      score.textContent = String(option.value);

      const text = document.createElement("span");
      text.className = "likert-option-label";

      option.lines.forEach((line) => {
        const lineSpan = document.createElement("span");
        lineSpan.textContent = line;
        text.appendChild(lineSpan);
      });

      label.appendChild(input);
      label.appendChild(score);
      label.appendChild(text);
      optionGrid.appendChild(label);
    });

    measureForm.appendChild(fragment);
  });
}

function lockMeasure(scale) {
  measureForm.hidden = true;
  document.querySelector(".measure-actions").hidden = true;
  measureLocked.hidden = false;
  updateStatus(`已完成${scale?.completed_at ? `（${new Date(scale.completed_at).toLocaleString("zh-CN")}）` : ""}`, "success");
  scrollToTop();
}

function unlockMeasure() {
  measureLocked.hidden = true;
  measureForm.hidden = false;
  document.querySelector(".measure-actions").hidden = false;
  renderQuestions();
  updateStatus("请完成 40 道题目后再提交。");
}

function collectAnswers() {
  const answers = {};

  for (let index = 1; index <= QUESTIONS.length; index += 1) {
    const value = measureForm.querySelector(`input[name="q${index}"]:checked`)?.value;
    if (!value) {
      return null;
    }
    answers[`q${index}`] = Number(value);
  }

  return answers;
}

async function loadScaleStatus() {
  const session = readSession();
  if (!session?.userId) {
    redirectToAuth();
    return;
  }

  try {
    const data = await apiRequest(`/scale/status?user_id=${encodeURIComponent(session.userId)}`);
    if (data.scale?.completed) {
      lockMeasure(data.scale);
    } else {
      unlockMeasure();
    }
  } catch (error) {
    unlockMeasure();
    updateStatus(error.message, "error");
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const session = readSession();
  if (!session?.userId) {
    redirectToAuth();
    return;
  }

  const answers = collectAnswers();
  if (!answers) {
    updateStatus("还有题目未作答。", "error");
    return;
  }

  updateStatus("正在提交测量...");

  try {
    const data = await apiRequest("/scale/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: session.userId,
        answers,
      }),
    });
    lockMeasure(data.scale);
  } catch (error) {
    updateStatus(error.message, "error");
    scrollToTop();
  }
}

function handleReset() {
  updateStatus("当前版本不支持重新填写，如需修改请联系研究者。", "error");
  scrollToTop();
}

window.addEventListener("load", loadScaleStatus);
measureForm.addEventListener("submit", handleSubmit);
resetMeasureButton?.addEventListener("click", handleReset);
