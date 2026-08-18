const API = "http://127.0.0.1:17888";

const blankProfile = {
  name: "",
  gender: "",
  phone: "",
  email: "",
  location: "",
  school: "",
  major: "",
  degree: "",
  graduation: "",
  targetRole: "",
  expectedCity: "",
  expectedSalary: "",
  availability: "",
  portfolio: "",
  github: "",
  summary: "",
  skills: "",
  education: "",
  projects: "",
  internships: "",
  awards: "",
  languages: "",
  aiAbility: "",
  aiTools: "",
  aiProjects: "",
  aiLinks: "",
  rawText: "",
  photo: "",
  video: "",
  noInternship: false,
  noProject: false,
  noAwards: false,
  projectItems: [],
  internshipItems: [],
  awardItems: [],
  languageItems: [],
  customItems: [],
};

const basicFields = [
  ["name", "姓名", "请输入姓名"],
  ["gender", "性别", "男 / 女"],
  ["phone", "手机号", "请输入手机号"],
  ["email", "邮箱", "请输入邮箱"],
  ["location", "现居地", "如 北京 / 成都"],
  ["targetRole", "目标岗位", "如 游戏QA / 测试开发"],
  ["expectedCity", "期望城市", "如 北京 / 成都"],
  ["expectedSalary", "期望薪资", "如 面议 / 150-200元/天"],
  ["availability", "到岗时间", "如 一周内 / 立即到岗"],
];

const educationFields = [
  ["school", "学校", "请输入学校"],
  ["major", "专业", "请输入专业"],
  ["degree", "学历", "本科 / 硕士 / 专科"],
  ["graduation", "毕业时间", "如 2026.06"],
];

const linkFields = [
  ["portfolio", "作品集 / 个人网站", "请输入作品集链接"],
  ["github", "GitHub / 代码仓库", "请输入代码仓库链接"],
];

const repeaters = {
  internshipItems: {
    title: "实习经历",
    itemTitle: "实习经历",
    addText: "添加实习经历",
    emptyText: "无实习经历",
    noKey: "noInternship",
    legacyKey: "internships",
    blank: () => ({ company: "", role: "", startDate: "", endDate: "", current: false, description: "" }),
    fields: [
      ["company", "公司*", "请输入实习公司", "text"],
      ["role", "职位*", "请输入职位", "text"],
      ["startDate", "起止时间*", "开始日期", "date"],
      ["endDate", "", "结束日期", "date"],
      ["description", "描述", "请输入描述内容", "textarea", 1000],
    ],
    format: formatInternship,
  },
  projectItems: {
    title: "项目经历",
    itemTitle: "项目经历",
    addText: "添加项目经历",
    emptyText: "无项目经历",
    noKey: "noProject",
    legacyKey: "projects",
    blank: () => ({ name: "", role: "", startDate: "", endDate: "", current: false, description: "" }),
    fields: [
      ["name", "项目名称*", "请输入项目名称（含校园实践）", "text"],
      ["role", "在项目中担任的角色*", "请输入在项目中担任的角色", "text"],
      ["startDate", "起止时间*", "开始日期", "date"],
      ["endDate", "", "结束日期", "date"],
      ["description", "描述", "请输入描述内容", "textarea", 1000],
    ],
    format: formatProject,
  },
  awardItems: {
    title: "获奖信息",
    itemTitle: "获奖信息",
    addText: "添加获奖信息",
    emptyText: "无获奖信息",
    noKey: "noAwards",
    legacyKey: "awards",
    blank: () => ({ type: "", name: "", date: "", description: "" }),
    fields: [
      ["type", "获奖类型*", "竞赛奖项 / 奖学金 / 荣誉称号 / 证书", "text"],
      ["name", "奖项名称*", "请输入奖项名称", "text"],
      ["date", "获奖时间*", "请选择获奖时间", "date"],
      ["description", "奖项说明", "请输入奖项说明", "textarea", 500],
    ],
    format: formatAward,
  },
  languageItems: {
    title: "语言水平",
    itemTitle: "语言水平",
    addText: "添加语言水平",
    emptyText: "暂无语言证书",
    noKey: "",
    legacyKey: "languages",
    blank: () => ({ name: "", level: "", score: "", date: "", description: "" }),
    fields: [
      ["name", "语言 / 证书", "如 英语四级 / 英语六级 / 普通话", "text"],
      ["level", "等级", "如 CET-4 / CET-6 / 二甲", "text"],
      ["score", "分数", "如 425 / 520", "text"],
      ["date", "通过时间", "如 2025.06", "date"],
      ["description", "补充说明", "如 听说读写能力、口语水平等", "textarea", 500],
    ],
    format: formatLanguage,
  },
  customItems: {
    title: "自定义字段",
    itemTitle: "自定义字段",
    addText: "添加自定义字段",
    emptyText: "暂无自定义字段",
    noKey: "",
    legacyKey: "",
    defaultBlank: false,
    deleteText: "删除字段",
    blank: () => ({ label: "", keywords: "", value: "", enabled: true, source: "" }),
    fields: [
      ["label", "字段名称*", "如 失败经历 / 期望岗位说明 / 开放题名称", "text"],
      ["keywords", "匹配关键词", "多个关键词用逗号隔开，越具体越不容易误填", "text"],
      ["value", "填写内容*", "请输入需要复用的填写内容", "textarea", 2000],
      ["source", "来源备注", "如 某公司官网 / AI 面试报名表", "text"],
    ],
    format: formatCustom,
  },
};

let store = null;
let saveTimer = null;
let floatingEnabled = false;
let floatingHeartbeatTimer = null;

const $ = (selector) => document.querySelector(selector);

function setStatus(text, kind = "") {
  const el = $("#saveStatus");
  el.textContent = text;
  el.className = `status ${kind}`;
}

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `请求失败：${path}`);
  }
  return data;
}

function currentVersion() {
  return store?.activeVersion || "通用版";
}

function currentProfile() {
  const name = currentVersion();
  return store.versions[name].profile;
}

function createBlankVersion(updated = false) {
  return {
    profile: ensureProfileShape(JSON.parse(JSON.stringify(blankProfile))),
    sources: [],
    updatedAt: updated ? new Date().toLocaleString() : "",
  };
}

function cloneVersionFrom(sourceName) {
  if (!sourceName || sourceName === "__blank__") return createBlankVersion(true);
  const source = store.versions[sourceName];
  if (!source) return null;
  const cloned = JSON.parse(JSON.stringify(source));
  cloned.profile = ensureProfileShape(cloned.profile || {});
  cloned.sources = Array.isArray(cloned.sources) ? cloned.sources : [];
  cloned.updatedAt = new Date().toLocaleString();
  return cloned;
}

function chooseVersionTemplate() {
  const names = Object.keys(store.versions || {});
  const lines = ["0. 空白模板", ...names.map((name, index) => `${index + 1}. ${name}`)];
  const answer = prompt(`请选择新版本要复制的模板：\n\n${lines.join("\n")}\n\n可输入序号或版本名称。`, currentVersion());
  if (answer === null) return null;
  const text = answer.trim();
  if (!text || text === "0" || text === "空白" || text === "空白模板") return "__blank__";
  const number = Number(text);
  if (Number.isInteger(number) && number >= 1 && number <= names.length) return names[number - 1];
  if (store.versions[text]) return text;
  alert("没有找到这个模板版本，已取消新建。");
  return null;
}
function ensureStoreShape(data) {
  data = data || {};
  data.versions = data.versions || {};
  data.activeVersion = data.activeVersion || "通用版";
  if (!data.versions[data.activeVersion]) {
    data.versions[data.activeVersion] = { profile: {}, sources: [], updatedAt: "" };
  }
  Object.values(data.versions).forEach((version) => {
    version.profile = ensureProfileShape(version.profile || {});
    version.sources = version.sources || [];
    version.updatedAt = version.updatedAt || "";
  });
  return data;
}

function ensureProfileShape(profile) {
  const next = { ...blankProfile, ...profile };
  next.projectItems = normalizeItems(next.projectItems, repeaters.projectItems.blank, next.projects, "description");
  next.internshipItems = normalizeItems(next.internshipItems, repeaters.internshipItems.blank, next.internships, "description");
  next.awardItems = normalizeItems(next.awardItems, repeaters.awardItems.blank, next.awards, "description");
  next.languageItems = normalizeItems(next.languageItems, repeaters.languageItems.blank, next.languages, "description");
  next.customItems = normalizeItems(next.customItems, repeaters.customItems.blank, "", "value");
  if (!next.aiTools && next.aiAbility && next.aiAbility.length < 500) {
    next.aiProjects = next.aiProjects || next.aiAbility;
  }
  syncDerivedFields(next);
  return next;
}

function normalizeItems(value, blankFactory, legacyText, legacyField) {
  const source = Array.isArray(value) ? value.filter(Boolean) : [];
  const items = source
    .map((item) => ({ ...blankFactory(), ...item }))
    .filter(hasItemContent);
  const legacyValue = String(legacyText || "").trim();
  if (!items.length && legacyValue) {
    const item = blankFactory();
    item[legacyField] = legacyValue;
    items.push(item);
  }
  return items;
}


function renderFloatingToggle(enabled) {
  floatingEnabled = Boolean(enabled);
  const btn = $("#floatingToggleBtn");
  const state = $("#floatingToggleState");
  if (!btn || !state) return;
  btn.textContent = floatingEnabled ? "关闭网页悬浮窗" : "开启网页悬浮窗";
  btn.classList.toggle("primary", !floatingEnabled);
  btn.classList.toggle("danger-button", floatingEnabled);
  state.textContent = floatingEnabled
    ? "当前开启：当前页面、已刷新网页和新打开网页都会自动显示可拖动悬浮窗"
    : "当前关闭：招聘网页不会显示悬浮窗";
}

function startFloatingHeartbeat() {
  clearInterval(floatingHeartbeatTimer);
  floatingHeartbeatTimer = null;
  if (!floatingEnabled) return;
  floatingHeartbeatTimer = setInterval(() => {
    setFloatingState(true, { silent: true });
  }, 5000);
}

async function loadFloatingState() {
  try {
    const state = await request("/api/floating-state");
    renderFloatingToggle(state.enabled);
    startFloatingHeartbeat();
  } catch (error) {
    renderFloatingToggle(false);
  }
}

async function setFloatingState(enabled, options = {}) {
  try {
    const state = await request("/api/floating-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    renderFloatingToggle(state.enabled);
    startFloatingHeartbeat();
    if (!options.silent) {
      setStatus(state.enabled ? "网页悬浮窗已开启" : "网页悬浮窗已关闭", "ok");
    }
  } catch (error) {
    renderFloatingToggle(false);
    if (!options.silent) {
      setStatus("悬浮窗开关失败", "warn");
      alert(error.message);
    }
  }
}
async function loadStore() {
  try {
    store = ensureStoreShape(await request("/api/resume"));
    renderVersions();
    renderEditor();
    setStatus("已连接本地服务", "ok");
    loadFloatingState();
  } catch (error) {
    setStatus("本地服务未连接", "warn");
    $("#importResult").textContent = error.message;
  }
}

function renderVersions() {
  const select = $("#versionSelect");
  const names = Object.keys(store.versions);
  select.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  select.value = currentVersion();

  const list = $("#versionList");
  list.innerHTML = names
    .map((name) => {
      const active = name === currentVersion();
      return `<button class="version-pill ${active ? "active" : ""}" type="button" data-version="${escapeHtml(name)}" aria-pressed="${active ? "true" : "false"}" title="切换到 ${escapeHtml(name)}">${escapeHtml(name)}</button>`;
    })
    .join("");
}

function switchVersion(name) {
  if (!store?.versions?.[name]) return;
  if (store.activeVersion === name) {
    renderVersions();
    return;
  }
  store.activeVersion = name;
  renderVersions();
  renderEditor();
  scheduleSave();
  setStatus(`已切换版本：${name}`, "ok");
}

function getSectionOpenStates(root) {
  const states = {};
  if (!root) return states;
  root.querySelectorAll(".paper-section[data-section]").forEach((section) => {
    states[section.dataset.section] = section.open;
  });
  return states;
}

function shouldSectionOpen(states, key, defaultOpen = false) {
  return Object.prototype.hasOwnProperty.call(states, key) ? states[key] : defaultOpen;
}

function renderEditor() {
  const profile = currentProfile();
  ensureDefaultVisibleItems(profile);
  const root = $("#profileEditor");
  const openStates = getSectionOpenStates(root);
  root.innerHTML = [
    renderSection("basic", "一", "基础信息", "姓名、联系方式与求职意向", renderGrid(basicFields), shouldSectionOpen(openStates, "basic", true)),
    renderSection("education", "二", "教育背景与通用能力", "学校、专业、技能、自我评价与作品链接", renderEducation(profile), shouldSectionOpen(openStates, "education", true)),
    renderSection("internships", "三", "实习经历", "按公司与岗位分段编辑", renderRepeater("internshipItems"), shouldSectionOpen(openStates, "internships")),
    renderSection("projects", "四", "项目经历", "按项目与角色分段编辑", renderRepeater("projectItems"), shouldSectionOpen(openStates, "projects")),
    renderSection("awards", "五", "获奖信息", "奖项、证书、荣誉可分段维护", renderRepeater("awardItems"), shouldSectionOpen(openStates, "awards")),
    renderSection("ai", "六", "AI应用技能", "常用工具、协作项目与相关链接", renderAiAbility(profile), shouldSectionOpen(openStates, "ai")),
    renderSection("languages", "七", "语言水平", "英语四六级、分数与其他语言能力", renderRepeater("languageItems"), shouldSectionOpen(openStates, "languages")),
    renderSection("custom", "八", "自定义字段库", "保存招聘网站额外问题；只有启用且高匹配时才自动填入", renderRepeater("customItems"), shouldSectionOpen(openStates, "custom")),
    renderSection("raw", "九", "原始简历文本", "导入文件保留的全文内容", renderTextarea("rawText", "原始简历文本", "导入后的原始文本会保留在这里", 3000), shouldSectionOpen(openStates, "raw")),
  ].join("");
  bindEditorEvents(root);
}
function ensureDefaultVisibleItems(profile) {
  Object.entries(repeaters).forEach(([listKey, config]) => {
    if (config.noKey && profile[config.noKey]) return;
    if (!Array.isArray(profile[listKey])) profile[listKey] = [];
    if (!profile[listKey].length && config.defaultBlank !== false) profile[listKey].push(config.blank());
  });
}

function renderSection(key, index, title, subtitle, body, open = false) {
  return `
    <details class="paper-section" data-section="${escapeHtml(key)}" ${open ? "open" : ""}>
      <summary>
        <div class="paper-number">${index}</div>
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <span class="section-state">展开</span>
      </summary>
      <div class="section-body">${body}</div>
    </details>
  `;
}
function renderGrid(fields) {
  return `<div class="form-grid">${fields.map(([key, label, placeholder]) => renderInput(key, label, placeholder)).join("")}</div>`;
}

function renderEducation(profile) {
  return `
    ${renderGrid(educationFields)}
    <div class="wide-block">${renderTextarea("education", "教育经历", "可填写课程、成绩、校园经历等", 900)}</div>
    <div class="wide-block">${renderTextarea("skills", "专业技能", "请输入技能关键词或分点描述", 1000)}</div>
    <div class="wide-block">${renderTextarea("summary", "自我评价", "请输入自我评价", 1000)}</div>
    <div class="form-grid link-grid">${linkFields.map(([key, label, placeholder]) => renderInput(key, label, placeholder)).join("")}</div>
  `;
}

function renderAiAbility(profile) {
  return `
    <div class="wide-block">${renderTextarea("aiTools", "常用 AI 工具&模型", "请填写具体工具名称&模型名称与版本号，如 Cursor、Copilot、Coze、Claude、GPT、DeepSeek 等", 1000)}</div>
    <div class="wide-block">${renderTextarea("aiProjects", "AI协作完成的项目或任务", "请说明项目目标背景、AI 工具及模型选择原因、你与 AI 的分工、核心挑战及解决方案、项目结果等", 1000)}</div>
    <div class="field link-field">
      <label for="aiLinks">相关项目或作品链接</label>
      <div class="inline-link-input">
        <input id="aiLinks" data-key="aiLinks" type="text" value="${escapeHtml(profile.aiLinks || "")}" placeholder="请输入相关项目或作品链接">
        <span>+</span>
      </div>
      <p class="field-note">可填写 GitHub 仓库、线上 Demo、个人博客或作品集链接。</p>
    </div>
  `;
}

function renderInput(key, label, placeholder) {
  const value = currentProfile()[key] || "";
  return `
    <div class="field">
      <label for="${key}">${escapeHtml(label)}</label>
      <input id="${key}" data-key="${key}" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">
    </div>
  `;
}

function renderTextarea(key, label, placeholder, max = 1000) {
  const value = currentProfile()[key] || "";
  return `
    <div class="field field-textarea">
      <label for="${key}">${escapeHtml(label)}</label>
      <textarea id="${key}" data-key="${key}" data-max="${max}" maxlength="${max}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>
      <span class="counter">${String(value).length}/${max}</span>
    </div>
  `;
}

function renderRepeater(listKey) {
  const profile = currentProfile();
  const config = repeaters[listKey];
  const noChecked = config.noKey ? Boolean(profile[config.noKey]) : false;
  const items = Array.isArray(profile[listKey]) ? profile[listKey] : [];
  const noToggle = config.noKey
    ? `<label class="no-toggle"><input type="checkbox" data-no-key="${config.noKey}" ${noChecked ? "checked" : ""}> ${escapeHtml(config.emptyText)}</label>`
    : "";
  const listHtml = noChecked ? "" : items.map((item, index) => renderRepeaterItem(listKey, item, index)).join("");
  return `
    <div class="repeat-head">${noToggle}</div>
    <div class="repeat-list ${noChecked ? "is-muted" : ""}">${listHtml}</div>
    ${noChecked ? "" : `<button class="link-button" data-action="add-item" data-list-key="${listKey}">+ ${escapeHtml(config.addText)}</button>`}
  `;
}

function renderRepeaterItem(listKey, item, index) {
  const config = repeaters[listKey];
  return `
    <article class="entry-card">
      <div class="entry-head">
        <h4>${escapeHtml(config.itemTitle)}-${index + 1}</h4>
        <button class="delete-button" data-action="delete-item" data-list-key="${listKey}" data-index="${index}">${escapeHtml(config.deleteText || "删除经历")}</button>
      </div>
      <div class="entry-grid">
        ${config.fields.map((field) => renderItemField(listKey, item, index, field)).join("")}
        ${("current" in item) ? renderCurrentCheckbox(listKey, item, index) : ""}
      </div>
    </article>
  `;
}

function renderItemField(listKey, item, index, [field, label, placeholder, type, max]) {
  const value = item[field] || "";
  if (type === "textarea") {
    const limit = max || 1000;
    return `
      <div class="field field-textarea entry-wide">
        <label>${escapeHtml(label)}</label>
        <textarea data-list-key="${listKey}" data-index="${index}" data-field="${field}" data-max="${limit}" maxlength="${limit}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>
        <span class="counter">${String(value).length}/${limit}</span>
      </div>
    `;
  }
  return `
    <div class="field ${label ? "" : "field-no-label"}">
      ${label ? `<label>${escapeHtml(label)}</label>` : "<label>&nbsp;</label>"}
      <input data-list-key="${listKey}" data-index="${index}" data-field="${field}" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">
    </div>
  `;
}

function renderCurrentCheckbox(listKey, item, index) {
  return `
    <label class="current-check">
      <input type="checkbox" data-list-key="${listKey}" data-index="${index}" data-field="current" ${item.current ? "checked" : ""}>
      至今
    </label>
  `;
}

function renderEnabledCheckbox(listKey, item, index) {
  return `
    <label class="current-check custom-enable-check">
      <input type="checkbox" data-list-key="${listKey}" data-index="${index}" data-field="enabled" ${item.enabled !== false ? "checked" : ""}>
      启用自动填入
    </label>
  `;
}

function bindEditorEvents(root) {
  root.querySelectorAll("input[data-key], textarea[data-key]").forEach((input) => {
    input.addEventListener("input", onSimpleFieldInput);
  });
  root.querySelectorAll("input[data-list-key], textarea[data-list-key]").forEach((input) => {
    const eventName = input.type === "checkbox" ? "change" : "input";
    input.addEventListener(eventName, onListFieldInput);
  });
  root.querySelectorAll("input[data-no-key]").forEach((input) => input.addEventListener("change", onNoToggle));
  root.querySelectorAll("[data-action='add-item']").forEach((button) => button.addEventListener("click", onAddItem));
  root.querySelectorAll("[data-action='delete-item']").forEach((button) => button.addEventListener("click", onDeleteItem));
}

function onSimpleFieldInput(event) {
  currentProfile()[event.target.dataset.key] = event.target.value;
  updateCounter(event.target);
  syncDerivedFields(currentProfile());
  scheduleSave();
}

function onListFieldInput(event) {
  const { listKey, index, field } = event.target.dataset;
  const item = currentProfile()[listKey][Number(index)];
  item[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
  updateCounter(event.target);
  syncDerivedFields(currentProfile());
  scheduleSave();
}

function onNoToggle(event) {
  const profile = currentProfile();
  const noKey = event.target.dataset.noKey;
  profile[noKey] = event.target.checked;
  if (!event.target.checked) ensureDefaultVisibleItems(profile);
  syncDerivedFields(profile);
  renderEditor();
  scheduleSave();
}

function onAddItem(event) {
  const listKey = event.target.dataset.listKey;
  currentProfile()[listKey].push(repeaters[listKey].blank());
  renderEditor();
  scheduleSave();
}

function onDeleteItem(event) {
  const listKey = event.target.dataset.listKey;
  const index = Number(event.target.dataset.index);
  currentProfile()[listKey].splice(index, 1);
  ensureDefaultVisibleItems(currentProfile());
  syncDerivedFields(currentProfile());
  renderEditor();
  scheduleSave();
}

function updateCounter(target) {
  if (!target.matches("textarea")) return;
  const counter = target.parentElement.querySelector(".counter");
  if (counter) counter.textContent = `${target.value.length}/${target.dataset.max || target.maxLength}`;
}

function syncDerivedFields(profile) {
  profile.projects = buildLegacyText(profile.projectItems, repeaters.projectItems.format);
  profile.internships = buildLegacyText(profile.internshipItems, repeaters.internshipItems.format);
  profile.awards = buildLegacyText(profile.awardItems, repeaters.awardItems.format);
  profile.languages = buildLegacyText(profile.languageItems, repeaters.languageItems.format);
  profile.aiAbility = [
    profile.aiTools ? `常用工具与模型：${profile.aiTools}` : "",
    profile.aiProjects ? `AI协作项目：${profile.aiProjects}` : "",
    profile.aiLinks ? `相关链接：${profile.aiLinks}` : "",
  ].filter(Boolean).join("\n\n");
}

function buildLegacyText(items, formatter) {
  if (!Array.isArray(items)) return "";
  return items.filter(hasItemContent).map(formatter).filter(Boolean).join("\n\n");
}

function hasItemContent(item) {
  return Object.entries(item || {}).some(([key, value]) => !["current", "enabled"].includes(key) && String(value || "").trim());
}

function dateRange(item) {
  const start = item.startDate || "";
  const end = item.current ? "至今" : (item.endDate || "");
  return [start, end].filter(Boolean).join(" - ");
}

function formatInternship(item) {
  return [
    item.company ? `公司：${item.company}` : "",
    item.role ? `职位：${item.role}` : "",
    dateRange(item) ? `时间：${dateRange(item)}` : "",
    item.description ? `描述：${item.description}` : "",
  ].filter(Boolean).join("\n");
}

function formatProject(item) {
  return [
    item.name ? `项目名称：${item.name}` : "",
    item.role ? `担任角色：${item.role}` : "",
    dateRange(item) ? `时间：${dateRange(item)}` : "",
    item.description ? `描述：${item.description}` : "",
  ].filter(Boolean).join("\n");
}

function formatAward(item) {
  return [
    item.type ? `类型：${item.type}` : "",
    item.name ? `奖项名称：${item.name}` : "",
    item.date ? `获奖时间：${item.date}` : "",
    item.description ? `说明：${item.description}` : "",
  ].filter(Boolean).join("\n");
}

function formatLanguage(item) {
  return [
    item.name ? `语言/证书：${item.name}` : "",
    item.level ? `等级：${item.level}` : "",
    item.score ? `分数：${item.score}` : "",
    item.date ? `通过时间：${item.date}` : "",
    item.description ? `说明：${item.description}` : "",
  ].filter(Boolean).join("\n");
}

function formatCustom(item) {
  return [
    item.label ? `字段名称：${item.label}` : "",
    item.keywords ? `匹配关键词：${item.keywords}` : "",
    item.value ? `填写内容：${item.value}` : "",
    item.source ? `来源备注：${item.source}` : "",
    item.enabled === false ? "状态：未启用自动填入" : "状态：已启用自动填入",
  ].filter(Boolean).join("\n");
}

function scheduleSave() {
  setStatus("保存中...");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveStore, 500);
}


async function manualSave() {
  if (!store) {
    setStatus("本地服务未连接", "warn");
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = null;
  setStatus("手动保存中...");
  await saveStore("已手动保存");
}
async function saveStore(doneText = "已自动保存") {
  try {
    const version = currentVersion();
    syncDerivedFields(store.versions[version].profile);
    store.versions[version].updatedAt = new Date().toLocaleString();
    const data = await request("/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store),
    });
    store = ensureStoreShape(data.store);
    setStatus(doneText, "ok");
    renderVersions();
  } catch (error) {
    setStatus("保存失败", "warn");
    console.error(error);
  }
}


function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function updateSelectedFileHint() {
  const hint = $("#selectedFileHint");
  const input = $("#resumeFile");
  if (!hint || !input) return;
  const file = input.files?.[0];
  if (!file) {
    hint.textContent = "未选择文件";
    hint.classList.remove("has-file");
    return;
  }
  hint.textContent = `已选择：${file.name}（${formatFileSize(file.size)}）`;
  hint.classList.add("has-file");
}
async function importResume() {
  const file = $("#resumeFile").files[0];
  if (!file) {
    $("#importResult").textContent = "请先选择简历文件。";
    return;
  }
  setStatus("正在导入...");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("version", currentVersion());
  try {
    const data = await request("/api/import", { method: "POST", body: fd });
    store = ensureStoreShape(data.store);
    renderVersions();
    renderEditor();
    const added = data.changes.filter((item) => item.type === "added").length;
    const merged = data.changes.filter((item) => item.type === "merged").length;
    const conflict = data.changes.filter((item) => item.type === "conflict").length;
    $("#importResult").innerHTML = `<span class="ok">导入完成。</span> 新增 ${added} 项，合并 ${merged} 项，冲突 ${conflict} 项。冲突内容保留旧值，可在内容编辑中手动调整。`;
    setStatus("导入并保存完成", "ok");
  } catch (error) {
    $("#importResult").textContent = error.message;
    setStatus("导入失败", "warn");
  }
}

function createVersion() {
  const name = prompt("请输入版本名称，例如：策划 / 测试 / 开发 / 游戏QA版");
  if (!name) return;
  const trimmedName = name.trim();
  if (!trimmedName) return;
  if (store.versions[trimmedName]) {
    alert("该版本已存在。");
    return;
  }

  const sourceName = chooseVersionTemplate();
  if (sourceName === null) return;
  const base = cloneVersionFrom(sourceName);
  if (!base) return;

  store.versions[trimmedName] = base;
  store.activeVersion = trimmedName;
  renderVersions();
  renderEditor();
  scheduleSave();
  setStatus(`已新建版本：${trimmedName}`, "ok");
}

async function clearAllArchives() {
  if (!store) return;
  const count = Object.keys(store.versions || {}).length;
  if (!confirm(`第一次确认：确定要清除全部 ${count} 个存档吗？`)) return;
  if (!confirm("第二次确认：该操作会删除所有版本的简历内容、分段经历、自定义字段与导入记录。")) return;
  const phrase = prompt("第三次确认：请输入“清除所有存档”继续。注：此操作不会删除工程文件。", "");
  if (phrase !== "清除所有存档") {
    alert("确认文字不一致，已取消清除。");
    return;
  }
  const number = prompt(`第四次确认：请输入当前存档数量 ${count}。`, "");
  if (number !== String(count)) {
    alert("存档数量不一致，已取消清除。");
    return;
  }

  store = {
    activeVersion: "通用版",
    versions: {
      "通用版": createBlankVersion(true),
    },
    updatedAt: new Date().toLocaleString(),
  };

  try {
    setStatus("正在清除所有存档...");
    clearTimeout(saveTimer);
    saveTimer = null;
    const data = await request("/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store),
    });
    store = ensureStoreShape(data.store);
    renderVersions();
    renderEditor();
    setStatus("已清除所有存档", "ok");
  } catch (error) {
    setStatus("清除失败", "warn");
    alert(error.message);
  }
}
async function deleteCurrentVersion() {
  const versionName = currentVersion();
  const names = Object.keys(store.versions || {});
  if (!store.versions[versionName]) {
    alert("当前版本不存在，无法删除。");
    return;
  }

  const firstConfirm = confirm(`确定要删除版本“${versionName}”吗？\n\n该操作会同步删除此版本保存的简历信息、分段项目、实习、获奖、语言与 AI 能力内容；其他版本不会受影响。`);
  if (!firstConfirm) return;

  const typed = prompt(`二次确认：请输入要删除的版本名\n\n${versionName}`);
  if (typed !== versionName) {
    alert("版本名不一致，已取消删除。");
    return;
  }

  delete store.versions[versionName];
  const remaining = names.filter((name) => name !== versionName && store.versions[name]);
  if (remaining.length) {
    store.activeVersion = remaining[0];
  } else {
    store.activeVersion = "通用版";
    store.versions[store.activeVersion] = {
      profile: createBlankVersion().profile,
      sources: [],
      updatedAt: "",
    };
  }

  try {
    setStatus("正在删除版本...");
    const data = await request("/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store),
    });
    store = ensureStoreShape(data.store);
    renderVersions();
    renderEditor();
    setStatus(`已删除版本：${versionName}`, "ok");
  } catch (error) {
    setStatus("删除失败", "warn");
    alert(error.message);
  }
}
async function uploadMedia(type, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("type", type);
  fd.append("version", currentVersion());
  try {
    const data = await request("/api/upload-media", { method: "POST", body: fd });
    store = ensureStoreShape(data.store);
    renderEditor();
    setStatus(`${type === "photo" ? "照片" : "视频"}已保存`, "ok");
  } catch (error) {
    alert(error.message);
  }
}

async function generateSite() {
  await saveStore();
  try {
    const data = await request("/api/generate-site", { method: "POST" });
    const link = $("#siteLink");
    link.href = data.url;
    link.textContent = `已生成：${data.url}`;
    window.open(data.url, "_blank");
  } catch (error) {
    alert(error.message);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function openGuide(kind) {
  const message = kind === "fill"
    ? "打开招聘网站后，页面右下角会出现“填写”按钮。点击后会扫描当前表单并填入本地简历内容。"
    : "点击招聘页面右下角“检查”按钮，会对比当前填写内容和本地简历库，并列出可替换项。";
  alert(message);
}

$("#importBtn").addEventListener("click", importResume);
$("#resumeFile").addEventListener("change", updateSelectedFileHint);
$("#clearAllArchivesBtn").addEventListener("click", clearAllArchives);
$("#newVersionBtn").addEventListener("click", createVersion);
$("#manualSaveBtn").addEventListener("click", manualSave);
$("#floatingToggleBtn").addEventListener("click", () => setFloatingState(!floatingEnabled));
$("#deleteVersionBtn").addEventListener("click", deleteCurrentVersion);
$("#generateSiteBtn").addEventListener("click", generateSite);
$("#photoFile").addEventListener("change", (event) => uploadMedia("photo", event.target));
$("#videoFile").addEventListener("change", (event) => uploadMedia("video", event.target));
$("#versionSelect").addEventListener("change", (event) => {
  switchVersion(event.target.value);
});
$("#versionList").addEventListener("click", (event) => {
  const button = event.target.closest(".version-pill[data-version]");
  if (!button) return;
  switchVersion(button.dataset.version);
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    manualSave();
  }
});

loadStore();





















