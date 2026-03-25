const API_BASE = "https://psychat-jhpbnpbkpx.cn-hongkong.fcapp.run/api";
const SESSION_STORAGE_KEY = "mindlane_session";

const measureForm = document.getElementById("measureForm");
const questionTemplate = document.getElementById("questionTemplate");
const measureStatus = document.getElementById("measureStatus");
const measureLocked = document.getElementById("measureLocked");
const resetMeasureButton = document.getElementById("resetMeasureButton");

const OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
];

const QUESTIONS = [
  "\u6211\u5E38\u611F\u5230\u5BB3\u6015",
  "\u4E00\u65E6\u786E\u5B9A\u4E86\u76EE\u6807\uFF0C\u6211\u4F1A\u575A\u6301\u52AA\u529B\u5730\u5B9E\u73B0\u5B83",
  "\u6211\u89C9\u5F97\u5927\u90E8\u5206\u4EBA\u57FA\u672C\u4E0A\u662F\u5FC3\u6000\u5584\u610F\u7684",
  "\u6211\u5934\u8111\u4E2D\u7ECF\u5E38\u5145\u6EE1\u751F\u52A8\u7684\u753B\u9762",
  "\u6211\u5BF9\u4EBA\u591A\u7684\u805A\u4F1A\u611F\u5230\u4E4F\u5473",
  "\u6709\u65F6\u6211\u89C9\u5F97\u81EA\u5DF1\u4E00\u65E0\u662F\u5904",
  "\u6211\u5E38\u5E38\u662F\u4ED4\u7EC6\u8003\u8651\u4E4B\u540E\u624D\u505A\u51FA\u51B3\u5B9A",
  "\u6211\u4E0D\u592A\u5173\u5FC3\u522B\u4EBA\u662F\u5426\u53D7\u5230\u4E0D\u516C\u6B63\u7684\u5F85\u9047",
  "\u6211\u662F\u4E2A\u52C7\u4E8E\u5192\u9669\uFF0C\u7A81\u7834\u5E38\u89C4\u7684\u4EBA",
  "\u5728\u70ED\u95F9\u7684\u805A\u4F1A\u4E0A\uFF0C\u6211\u5E38\u5E38\u8868\u73B0\u4E3B\u52A8\u5E76\u5C3D\u60C5\u73A9\u800D",
  "\u522B\u4EBA\u4E00\u53E5\u6F2B\u4E0D\u7ECF\u5FC3\u7684\u8BDD\uFF0C\u6211\u5E38\u4F1A\u8054\u7CFB\u5728\u81EA\u5DF1\u8EAB\u4E0A",
  "\u522B\u4EBA\u8BA4\u4E3A\u6211\u662F\u4E2A\u614E\u91CD\u7684\u4EBA",
  "\u6211\u65F6\u5E38\u89C9\u5F97\u522B\u4EBA\u7684\u75DB\u82E6\u4E0E\u6211\u65E0\u5173",
  "\u6211\u559C\u6B22\u5192\u9669",
  "\u6211\u5C3D\u91CF\u907F\u514D\u53C2\u52A0\u4EBA\u591A\u7684\u805A\u4F1A\u548C\u5608\u6742\u7684\u73AF\u5883",
  "\u5728\u9762\u5BF9\u538B\u529B\u65F6\uFF0C\u6211\u6709\u79CD\u5FEB\u8981\u5D29\u6E83\u7684\u611F\u89C9",
  "\u6211\u559C\u6B22\u4E00\u5F00\u5934\u5C31\u628A\u4E8B\u60C5\u8BA1\u5212\u597D",
  "\u6211\u662F\u90A3\u79CD\u53EA\u7167\u987E\u597D\u81EA\u5DF1\uFF0C\u4E0D\u66FF\u522B\u4EBA\u62C5\u5FE7\u7684\u4EBA",
  "\u6211\u5BF9\u8BB8\u591A\u4E8B\u60C5\u6709\u7740\u5F88\u5F3A\u7684\u597D\u5947\u5FC3",
  "\u6709\u6211\u5728\u7684\u573A\u5408\u4E00\u822C\u4E0D\u4F1A\u51B7\u573A",
  "\u6211\u5E38\u62C5\u5FE7\u4E00\u4E9B\u65E0\u5173\u7D27\u8981\u7684\u4E8B\u60C5",
  "\u6211\u5DE5\u4F5C\u6216\u5B66\u4E60\u5F88\u52E4\u594B",
  "\u867D\u7136\u793E\u4F1A\u4E0A\u6709\u4E9B\u9A97\u5B50\uFF0C\u4F46\u6211\u89C9\u5F97\u5927\u90E8\u5206\u4EBA\u8FD8\u662F\u53EF\u4FE1\u7684",
  "\u6211\u8EAB\u4E0A\u5177\u6709\u522B\u4EBA\u6CA1\u6709\u7684\u5192\u9669\u7CBE\u795E",
  "\u5728\u4E00\u4E2A\u56E2\u4F53\u4E2D\uFF0C\u6211\u5E0C\u671B\u5904\u4E8E\u9886\u5BFC\u5730\u4F4D",
  "\u6211\u5E38\u5E38\u611F\u5230\u5185\u5FC3\u4E0D\u8E0F\u5B9E",
  "\u6211\u662F\u4E2A\u503E\u5C3D\u5168\u529B\u505A\u4E8B\u7684\u4EBA",
  "\u5F53\u522B\u4EBA\u5411\u6211\u8BC9\u8BF4\u4E0D\u5E78\u65F6\uFF0C\u6211\u5E38\u611F\u5230\u96BE\u8FC7",
  "\u6211\u6E34\u671B\u5B66\u4E60\u4E00\u4E9B\u65B0\u4E1C\u897F\uFF0C\u5373\u4F7F\u5B83\u4EEC\u4E0E\u6211\u7684\u65E5\u5E38\u751F\u6D3B\u65E0\u5173",
  "\u522B\u4EBA\u591A\u8BA4\u4E3A\u6211\u662F\u4E00\u4E2A\u70ED\u60C5\u548C\u53CB\u597D\u7684\u4EBA",
  "\u6211\u5E38\u62C5\u5FC3\u6709\u4EC0\u4E48\u4E0D\u597D\u7684\u4E8B\u60C5\u8981\u53D1\u751F",
  "\u5728\u5DE5\u4F5C\u4E0A\uFF0C\u6211\u5E38\u53EA\u6C42\u80FD\u5E94\u4ED8\u8FC7\u53BB\u4FBF\u53EF",
  "\u5C3D\u7BA1\u4EBA\u7C7B\u793E\u4F1A\u5B58\u5728\u7740\u4E00\u4E9B\u9634\u6697\u7684\u4E1C\u897F\uFF08\u5982\u6218\u4E89\u3001\u7F6A\u6076\u3001\u6B3A\u8BC8\uFF09\uFF0C\u6211\u4ECD\u7136\u76F8\u4FE1\u4EBA\u6027\u603B\u7684\u6765\u8BF4\u662F\u5584\u826F\u7684\u3002",
  "\u6211\u7684\u60F3\u8C61\u529B\u76F8\u5F53\u4E30\u5BCC",
  "\u6211\u559C\u6B22\u53C2\u52A0\u793E\u4EA4\u4E0E\u5A31\u4E50\u805A\u4F1A",
  "\u6211\u5F88\u5C11\u611F\u5230\u5FE7\u90C1\u6216\u6CAE\u4E27",
  "\u505A\u4E8B\u8BB2\u7A76\u903B\u8F91\u548C\u6761\u7406\u662F\u6211\u7684\u4E00\u4E2A\u7279\u70B9",
  "\u6211\u5E38\u4E3A\u90A3\u4E9B\u906D\u9047\u4E0D\u5E78\u7684\u4EBA\u611F\u5230\u96BE\u8FC7",
  "\u6211\u5F88\u613F\u610F\u4E5F\u5F88\u5BB9\u6613\u63A5\u53D7\u90A3\u4E9B\u65B0\u4E8B\u7269\u3001\u65B0\u89C2\u70B9\u3001\u65B0\u60F3\u6CD5",
  "\u6211\u5E0C\u671B\u6210\u4E3A\u9886\u5BFC\u8005\u800C\u4E0D\u662F\u88AB\u9886\u5BFC\u8005",
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
    throw new Error(data.message || "Request failed. Please try again.");
  }
  return data;
}

function updateStatus(message, type = "") {
  measureStatus.textContent = message;
  measureStatus.className = `measure-status ${type}`.trim();
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
      label.className = "option-pill";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = inputName;
      input.value = String(option.value);
      input.required = true;

      const span = document.createElement("span");
      span.textContent = option.label;

      label.appendChild(input);
      label.appendChild(span);
      optionGrid.appendChild(label);
    });

    measureForm.appendChild(fragment);
  });
}

function lockMeasure(scale) {
  measureForm.hidden = true;
  document.querySelector(".measure-actions").hidden = true;
  measureLocked.hidden = false;
  updateStatus(
    `Completed${scale?.completed_at ? ` (${new Date(scale.completed_at).toLocaleString("zh-CN")})` : ""}`,
    "success",
  );
}

function unlockMeasure() {
  measureLocked.hidden = true;
  measureForm.hidden = false;
  document.querySelector(".measure-actions").hidden = false;
  renderQuestions();
  updateStatus("Please answer all 40 items before submitting.");
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
    updateStatus("Some items are still unanswered.", "error");
    return;
  }

  updateStatus("Submitting...");

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
  }
}

function handleReset() {
  updateStatus("Reset is disabled in this version. Please contact the researcher.", "error");
}

window.addEventListener("load", loadScaleStatus);
measureForm.addEventListener("submit", handleSubmit);
resetMeasureButton?.addEventListener("click", handleReset);
