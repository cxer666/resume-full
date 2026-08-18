(() => {
  const API = "http://127.0.0.1:17888";
  const ROOT_ID = "resume-assistant-floating-root";
  const POSITION_KEY = "resume-assistant-floating-position";
  const DEFAULT_MARGIN = 18;
  const STATE_POLL_MS = 1500;
  const BOOT_SYNC_DELAYS = [0, 250, 800, 1600, 3200, 5000];
  let lastExtractedKeys = [];

  const ALIASES = {
    name: ["姓名", "名字", "name", "full name", "真实姓名", "应聘者姓名"],
    gender: ["性别", "gender"],
    phone: ["手机号", "手机", "电话", "联系电话", "联系方式", "phone", "mobile", "tel"],
    email: ["邮箱", "电子邮箱", "邮件", "email", "mail"],
    location: ["现居", "所在地", "居住地", "地址", "location", "address"],
    school: ["学校", "院校", "毕业院校", "就读学校", "university", "college", "school"],
    major: ["专业", "major"],
    degree: ["学历", "学位", "degree"],
    graduation: ["毕业时间", "毕业年份", "graduation"],
    targetRole: ["求职意向", "目标岗位", "应聘岗位", "岗位", "position", "role"],
    summary: ["自我评价", "个人总结", "个人优势", "summary", "profile"],
    skills: ["技能", "专业技能", "技能特长", "skills"],
    internships: ["实习", "实习经历", "工作经历", "实践经历", "experience", "work"],
    projects: ["项目", "项目经历", "作品集", "project", "portfolio"],
    education: ["教育经历", "教育背景", "education"],
    portfolio: ["作品链接", "作品集链接", "个人网站", "portfolio", "website"],
    github: ["github", "代码仓库", "仓库"],
    expectedCity: ["期望城市", "意向城市", "工作城市"],
    expectedSalary: ["期望薪资", "薪资", "salary"],
    availability: ["到岗", "到岗时间", "入职时间", "availability"],
    awards: ["获奖", "荣誉", "奖项", "证书", "竞赛", "奖学金", "award", "honor", "certificate"],
    languages: ["语言", "英语", "四六级", "四级", "六级", "cet", "ielts", "toefl", "language"],
    aiAbility: ["AI", "人工智能", "大模型", "AI应用", "AI工具", "Cursor", "Copilot", "DeepSeek", "Claude"],
  };

  if (window.top !== window.self) {
    // Iframes can still be filled by their own injected content script.
  }

  function init() {
    if (document.getElementById(ROOT_ID)) return;
    injectStyles();
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="ra-panel collapsed">
        <div class="ra-head">
          <strong>简历助手</strong>
          <button class="ra-close" title="收起">-</button>
        </div>
        <div class="ra-actions">
          <button class="ra-fill">填写</button>
          <button class="ra-check">检查</button>
                    <button class="ra-extract">提取</button>
          <button class="ra-scan">扫描</button>
        </div>
        <div class="ra-result"></div>
      </div>
    `;
    document.documentElement.appendChild(root);
    restoreFloatingPosition(root);
    enableDrag(root);
    root.querySelector(".ra-fill").addEventListener("click", fillPage);
    root.querySelector(".ra-check").addEventListener("click", checkPage);
    root.querySelector(".ra-scan").addEventListener("click", scanOnly);
    root.querySelector(".ra-extract").addEventListener("click", extractPage);
    root.querySelector(".ra-close").addEventListener("click", () => {
      root.querySelector(".ra-panel").classList.toggle("collapsed");
      keepRootInViewport(root);
    });
  }




  async function apiRequest(path, options = {}) {
    const res = await fetch(`${API}${path}`, { ...options, cache: "no-store" });
    if (!res.ok) throw new Error(`本地服务请求失败：${path}`);
    return res.json();
  }
  function removeFloating() {
    const root = document.getElementById(ROOT_ID);
    if (root) root.remove();
  }

  async function syncFloatingState() {

    try {
      const res = await fetch(`${API}/api/floating-state`, { cache: "no-store" });
      if (!res.ok) throw new Error("floating disabled");
      const state = await res.json();
      if (state.enabled) init();
      else removeFloating();
    } catch (error) {
      removeFloating();
    }
  }

  function startFloatingController() {
    BOOT_SYNC_DELAYS.forEach((delay) => setTimeout(syncFloatingState, delay));
    setInterval(syncFloatingState, STATE_POLL_MS);
    window.addEventListener("focus", syncFloatingState);
    window.addEventListener("pageshow", syncFloatingState);
    window.addEventListener("load", syncFloatingState);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) syncFloatingState();
    });
  }
  function enableDrag(root) {
    const handle = root.querySelector(".ra-head");
    let drag = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      const rect = root.getBoundingClientRect();
      drag = {
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
      };
      root.classList.add("ra-dragging");
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      applyRootPosition(root, drag.left + event.clientX - drag.startX, drag.top + event.clientY - drag.startY);
    });

    const finishDrag = (event) => {
      if (!drag) return;
      drag = null;
      root.classList.remove("ra-dragging");
      keepRootInViewport(root);
      const rect = root.getBoundingClientRect();
      saveFloatingPosition(rect.left, rect.top);
      handle.releasePointerCapture?.(event.pointerId);
    };

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
    handle.addEventListener("dblclick", () => resetFloatingPosition(root));
    window.addEventListener("resize", () => keepRootInViewport(root));
  }

  function restoreFloatingPosition(root) {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        applyRootPosition(root, saved.left, saved.top);
      }
    } catch (error) {
      localStorage.removeItem(POSITION_KEY);
    }
  }

  function saveFloatingPosition(left, top) {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify({ left: Math.round(left), top: Math.round(top) }));
    } catch (error) {
      // Some sites block storage in special modes; dragging still works for the current page.
    }
  }

  function resetFloatingPosition(root) {
    localStorage.removeItem(POSITION_KEY);
    root.style.left = "auto";
    root.style.top = "auto";
    root.style.right = `${DEFAULT_MARGIN}px`;
    root.style.bottom = `${DEFAULT_MARGIN}px`;
  }

  function keepRootInViewport(root) {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    applyRootPosition(root, rect.left, rect.top);
    const next = root.getBoundingClientRect();
    saveFloatingPosition(next.left, next.top);
  }

  function applyRootPosition(root, left, top) {
    const rect = root.getBoundingClientRect();
    const width = rect.width || 320;
    const height = rect.height || 48;
    const maxLeft = Math.max(DEFAULT_MARGIN, window.innerWidth - width - DEFAULT_MARGIN);
    const maxTop = Math.max(DEFAULT_MARGIN, window.innerHeight - height - DEFAULT_MARGIN);
    const safeLeft = Math.min(Math.max(DEFAULT_MARGIN, left), maxLeft);
    const safeTop = Math.min(Math.max(DEFAULT_MARGIN, top), maxTop);
    root.style.left = `${safeLeft}px`;
    root.style.top = `${safeTop}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
  }
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #${ROOT_ID} { all: initial; position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; font-family: "Microsoft YaHei", Arial, sans-serif; will-change: left, top; }
      #${ROOT_ID} * { box-sizing: border-box; font-family: inherit; }
      #${ROOT_ID} .ra-panel { width: 320px; max-height: 72vh; overflow:auto; color:#172033; background:#fff; border:1px solid #dbe1ea; border-radius:8px; box-shadow:0 18px 48px rgba(15,23,42,.22); }
      #${ROOT_ID} .ra-panel.collapsed { width: auto; overflow:hidden; }
      #${ROOT_ID} .ra-panel.collapsed .ra-actions, #${ROOT_ID} .ra-panel.collapsed .ra-result { display:none; }
      #${ROOT_ID} .ra-head { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:#1f4e78; color:white; cursor:move; user-select:none; touch-action:none; }
      #${ROOT_ID} .ra-close { width:24px; height:24px; border:0; border-radius:5px; color:#1f4e78; background:white; cursor:pointer; }
      #${ROOT_ID}.ra-dragging .ra-panel { opacity:.96; }
      #${ROOT_ID} .ra-actions { display:flex; flex-wrap:wrap; gap:8px; padding:10px; border-bottom:1px solid #eef1f5; }
      #${ROOT_ID} .ra-actions button, #${ROOT_ID} .ra-apply { border:1px solid #dbe1ea; border-radius:7px; background:#f8fafc; color:#172033; padding:8px 10px; cursor:pointer; }
      #${ROOT_ID} .ra-fill, #${ROOT_ID} .ra-apply { background:#2563eb !important; color:white !important; border-color:#2563eb !important; }
      #${ROOT_ID} .ra-extract { background:#eef6ff !important; border-color:#bfdbfe !important; color:#1d4ed8 !important; }
      #${ROOT_ID} .ra-result { padding:10px; font-size:12px; line-height:1.55; }
      #${ROOT_ID} .ra-item { padding:9px; border:1px solid #e5e7eb; border-radius:7px; margin-bottom:8px; background:#fbfdff; }
      #${ROOT_ID} .ra-label { color:#64748b; margin-bottom:4px; }
      #${ROOT_ID} .ra-old { color:#b45309; word-break:break-word; }
      #${ROOT_ID} .ra-new { color:#0f766e; word-break:break-word; }
      #${ROOT_ID} .ra-note { color:#64748b; }
      .ra-highlight-field { outline: 2px solid #60a5fa !important; outline-offset: 2px !important; }
    `;
    document.documentElement.appendChild(style);
  }

  async function getProfile() {
    const res = await fetch(`${API}/api/resume`, { cache: "no-store" });
    if (!res.ok) throw new Error("本地服务未启动，请先打开简历填写助手。");
    const store = await res.json();
    const active = store.activeVersion || "通用版";
    const version = store.versions?.[active] || Object.values(store.versions || {})[0];
    const profile = version?.profile || {};
    return { store, active, profile };
  }

  function getFields() {
    const selector = [
      "input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset])",
      "textarea",
      "select",
      "[contenteditable=true]",
      "[role=textbox]",
    ].join(",");
    return [...document.querySelectorAll(selector)]
      .filter((el) => isVisible(el) && !el.disabled && !el.readOnly)
      .map((el) => ({ el, label: getFieldLabel(el), key: null, score: 0 }));
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function getFieldLabel(el) {
    const parts = [];
    const attrs = ["aria-label", "placeholder", "name", "id", "title", "data-name", "data-field"];
    attrs.forEach((attr) => {
      const value = el.getAttribute(attr);
      if (value) parts.push(value);
    });
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) parts.push(label.innerText);
    }
    const closestLabel = el.closest("label");
    if (closestLabel) parts.push(closestLabel.innerText);
    let node = el.parentElement;
    for (let i = 0; node && i < 3; i += 1, node = node.parentElement) {
      const text = [...node.childNodes]
        .filter((item) => item.nodeType === Node.TEXT_NODE)
        .map((item) => item.textContent.trim())
        .join(" ");
      if (text) parts.push(text);
      const legends = node.querySelectorAll("label, .label, .form-label, .ant-form-item-label, .semi-form-field-label, .moka-form-label");
      legends.forEach((item) => parts.push(item.innerText || item.textContent || ""));
    }
    return normalize(parts.join(" "));
  }

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getCustomItems(profile, onlyEnabled = true) {
    return (Array.isArray(profile.customItems) ? profile.customItems : [])
      .filter((item) => item && String(item.label || "").trim() && String(item.value || "").trim())
      .filter((item) => !onlyEnabled || item.enabled !== false);
  }

  function splitCustomAliases(item) {
    return [item.label, ...(String(item.keywords || "").split(/[，,、;；\n]+/))]
      .map((value) => normalize(value).replace(/[：:*\s]/g, ""))
      .filter((value) => value.length >= 2);
  }

  function getExpectedValue(item, profile) {
    return item.custom ? item.customItem.value : profile[item.key];
  }

  function getExpectedLabel(item) {
    return item.custom ? item.customItem.label : item.key;
  }

  function minFillScore(item) {
    return item.custom ? 0.84 : 0.68;
  }

  function minCheckScore(item) {
    return item.custom ? 0.82 : 0.58;
  }

  function matchField(label, profile) {
    let best = { key: null, score: 0, custom: false };
    const compactLabel = label.replace(/[：:*\s]/g, "");
    Object.entries(ALIASES).forEach(([key, aliases]) => {
      if (!profile[key]) return;
      aliases.forEach((alias) => {
        const a = normalize(alias).replace(/[：:*\s]/g, "");
        let score = 0;
        if (compactLabel === a) score = 1;
        else if (compactLabel.includes(a)) score = 0.88;
        else if (a.includes(compactLabel) && compactLabel.length >= 2) score = 0.76;
        else score = similarity(compactLabel, a) * 0.7;
        if (score > best.score) best = { key, score, custom: false };
      });
    });
    getCustomItems(profile).forEach((customItem, index) => {
      splitCustomAliases(customItem).forEach((alias) => {
        let score = 0;
        if (compactLabel === alias) score = 0.98;
        else if (compactLabel.includes(alias) && alias.length >= 3) score = 0.92;
        else if (alias.includes(compactLabel) && compactLabel.length >= 3) score = 0.86;
        else score = similarity(compactLabel, alias) * 0.78;
        if (score > best.score) {
          best = { key: `custom:${index}`, score, custom: true, customItem };
        }
      });
    });
    return best;
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    const max = Math.max(a.length, b.length);
    return (max - levenshtein(a, b)) / max;
  }

  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
    }
    return dp[a.length][b.length];
  }

  function setValue(el, value) {
    const text = String(value || "").trim();
    if (!text) return false;
    el.classList.add("ra-highlight-field");
    setTimeout(() => el.classList.remove("ra-highlight-field"), 1200);

    if (el.tagName === "SELECT") {
      const option = [...el.options].find((item) => normalize(item.text).includes(normalize(text)) || normalize(text).includes(normalize(item.text)));
      if (option) el.value = option.value;
      else return false;
    } else if (el.isContentEditable || el.getAttribute("role") === "textbox") {
      el.focus();
      el.innerText = text;
    } else if (el.type === "checkbox" || el.type === "radio") {
      return false;
    } else {
      el.focus();
      el.value = text;
    }
    ["input", "change", "blur"].forEach((type) => el.dispatchEvent(new Event(type, { bubbles: true })));
    return true;
  }

  function getValue(el) {
    if (el.tagName === "SELECT") return el.options[el.selectedIndex]?.text || el.value || "";
    if (el.isContentEditable || el.getAttribute("role") === "textbox") return el.innerText || "";
    return el.value || "";
  }

  const STRUCTURED_SECTION_META = {
    internshipItems: {
      title: "实习经历",
      sectionWords: ["实习经历", "实习经验", "工作经历", "实践经历"],
      starterKeys: ["company"],
      labels: {
        company: ["公司", "单位", "企业", "实习公司", "工作单位"],
        role: ["职位", "岗位", "职务", "任职", "担任"],
        description: ["描述", "工作内容", "实习内容", "职责", "工作职责", "经历描述"],
      },
    },
    projectItems: {
      title: "项目经历",
      sectionWords: ["项目经历", "项目经验", "项目实践"],
      starterKeys: ["name"],
      labels: {
        name: ["项目名称", "项目名", "项目", "名称"],
        role: ["角色", "担任", "分工", "职责", "负责", "任职"],
        description: ["描述", "项目描述", "项目介绍", "项目内容", "项目说明", "说明"],
      },
    },
    awardItems: {
      title: "获奖信息",
      sectionWords: ["获奖信息", "获奖经历", "荣誉奖项", "奖项", "证书"],
      starterKeys: ["type", "name"],
      labels: {
        type: ["获奖类型", "奖项类型", "证书类型", "类型"],
        name: ["奖项名称", "证书名称", "荣誉名称", "名称"],
        description: ["奖项说明", "获奖说明", "证书说明", "说明", "描述"],
      },
    },
    languageItems: {
      title: "语言水平",
      sectionWords: ["语言水平", "语言能力", "语言证书", "英语能力"],
      starterKeys: ["name"],
      labels: {
        name: ["语言", "证书", "语言/证书", "语言 / 证书"],
        level: ["等级", "级别", "水平"],
        score: ["分数", "成绩", "得分"],
        description: ["补充说明", "说明", "描述", "能力描述"],
      },
    },
  };

  function getFieldOwnHints(el) {
    return ["aria-label", "placeholder", "name", "id", "title", "data-name", "data-field"]
      .map((attr) => el.getAttribute(attr) || "")
      .filter(Boolean)
      .join(" ");
  }

  function compactResumeText(text) {
    return normalize(text).replace(/[：:*\s\-_/()（）【】\[\]{}]/g, "");
  }

  function hasAnyWord(text, words) {
    const compact = compactResumeText(text);
    return words.some((word) => {
      const key = compactResumeText(word);
      return key && compact.includes(key);
    });
  }

  function getVisibleText(el) {
    return normalize(el?.innerText || el?.textContent || "");
  }

  function findNearbySectionType(el) {
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return "";
    let best = { type: "", distance: Number.POSITIVE_INFINITY };
    const selector = "h1,h2,h3,h4,h5,label,legend,span,div,p";
    [...document.querySelectorAll(selector)].forEach((node) => {
      if (node.closest(`#${ROOT_ID}`) || node.contains(el)) return;
      const text = getVisibleText(node).replace(/\s+/g, "");
      if (!text || text.length > 24) return;
      const nodeRect = node.getBoundingClientRect();
      if (!nodeRect.width || !nodeRect.height) return;
      const verticalGap = rect.top - nodeRect.top;
      if (verticalGap < -8 || verticalGap > 900) return;
      Object.entries(STRUCTURED_SECTION_META).forEach(([type, meta]) => {
        const hit = meta.sectionWords.some((word) => text === word || text === `${word}-1` || new RegExp(`^${word}[-－]?\\d+$`).test(text));
        if (!hit) return;
        const horizontalPenalty = Math.abs(rect.left - nodeRect.left) * 0.08;
        const score = verticalGap + horizontalPenalty;
        if (score < best.distance) best = { type, distance: score };
      });
    });
    return best.type;
  }

  function getStructuredInfo(field) {
    const nearby = findNearbySectionType(field.el);
    const context = `${field.label} ${getFieldOwnHints(field.el)}`;
    let type = nearby;
    if (!type) {
      Object.entries(STRUCTURED_SECTION_META).forEach(([candidate, meta]) => {
        if (!type && hasAnyWord(context, meta.sectionWords)) type = candidate;
      });
    }
    if (!type) return null;
    const subKey = detectStructuredSubKey(field, type);
    return subKey ? { type, subKey } : null;
  }

  function detectStructuredSubKey(field, type) {
    const meta = STRUCTURED_SECTION_META[type];
    const raw = `${field.label} ${getFieldOwnHints(field.el)}`;
    const ownRaw = getFieldOwnHints(field.el);
    const own = compactResumeText(ownRaw);
    const tag = String(field.el.tagName || "").toLowerCase();

    const ownHit = detectStructuredTextSubKey(ownRaw, type);
    if (ownHit) return ownHit;
    if (/(结束|截止|终止|离职|end|to)/i.test(own)) return "endDate";
    if (/(开始|起始|入职|start|from)/i.test(own)) return "startDate";
    if (/(时间|日期|起止|期间|date|time)/i.test(ownRaw)) return "periodDate";
    if (tag === "textarea" || field.el.isContentEditable || field.el.getAttribute("role") === "textbox") {
      if (hasAnyWord(raw, meta.labels.description || ["描述", "说明"])) return "description";
    }

    const labelHit = detectStructuredTextSubKey(field.label, type);
    if (labelHit) return labelHit;
    if (/(结束|截止|终止|离职|end|to)/i.test(raw)) return "endDate";
    if (/(开始|起始|入职|start|from)/i.test(raw)) return "startDate";
    if (/(时间|日期|起止|期间|date|time)/i.test(raw)) return "periodDate";
    if (tag === "textarea") return "description";
    return "";
  }

  function detectStructuredTextSubKey(text, type) {
    const meta = STRUCTURED_SECTION_META[type];
    if (type === "projectItems") {
      if (hasAnyWord(text, meta.labels.role)) return "role";
      if (hasAnyWord(text, meta.labels.description)) return "description";
      if (hasAnyWord(text, meta.labels.name)) return "name";
    }
    if (type === "internshipItems") {
      if (hasAnyWord(text, meta.labels.company)) return "company";
      if (hasAnyWord(text, meta.labels.role)) return "role";
      if (hasAnyWord(text, meta.labels.description)) return "description";
    }
    if (type === "awardItems") {
      if (hasAnyWord(text, meta.labels.type)) return "type";
      if (hasAnyWord(text, meta.labels.description)) return "description";
      if (hasAnyWord(text, meta.labels.name)) return "name";
    }
    if (type === "languageItems") {
      if (hasAnyWord(text, meta.labels.score)) return "score";
      if (hasAnyWord(text, meta.labels.level)) return "level";
      if (hasAnyWord(text, meta.labels.description)) return "description";
      if (hasAnyWord(text, meta.labels.name)) return "name";
    }
    return "";
  }
  function getStructuredItems(profile, type) {
    const items = Array.isArray(profile[type]) ? profile[type].filter(hasStructuredItemContent) : [];
    return items.length ? items : [];
  }

  function hasStructuredItemContent(item) {
    return Object.values(item || {}).some((value) => typeof value === "string" ? value.trim() : Boolean(value));
  }

  function getStructuredLabel(type, subKey, index) {
    const title = STRUCTURED_SECTION_META[type]?.title || "经历";
    const map = {
      company: "公司",
      role: type === "projectItems" ? "项目角色" : "职位",
      name: type === "projectItems" ? "项目名称" : type === "awardItems" ? "奖项名称" : "语言/证书",
      type: "获奖类型",
      startDate: "开始时间",
      endDate: "结束时间",
      date: "时间",
      level: "等级",
      score: "分数",
      description: "描述",
    };
    return `${title}-${index + 1} / ${map[subKey] || subKey}`;
  }

  function getStructuredValue(type, item, subKey, el) {
    if (!item) return "";
    const valueMap = {
      internshipItems: {
        company: item.company,
        role: item.role,
        startDate: item.startDate,
        endDate: item.current ? "" : item.endDate,
        description: item.description,
      },
      projectItems: {
        name: item.name,
        role: item.role,
        startDate: item.startDate,
        endDate: item.current ? "" : item.endDate,
        description: item.description,
      },
      awardItems: {
        type: item.type,
        name: item.name,
        date: item.date,
        description: item.description,
      },
      languageItems: {
        name: item.name,
        level: item.level,
        score: item.score,
        date: item.date,
        description: item.description,
      },
    };
    const raw = valueMap[type]?.[subKey] || "";
    return subKey.toLowerCase().includes("date") || subKey === "date" ? formatDateForElement(raw, el) : raw;
  }

  function formatDateForElement(value, el) {
    const text = String(value || "").trim();
    if (!text) return "";
    const cleaned = text.replace(/[年月]/g, ".").replace(/[日号]/g, "").replace(/\s+/g, "");
    const match = cleaned.match(/(20\d{2})[.\/-]?(\d{1,2})?(?:[.\/-]?(\d{1,2}))?/);
    if (!match) return text;
    const year = match[1];
    const month = match[2] ? match[2].padStart(2, "0") : "01";
    const day = match[3] ? match[3].padStart(2, "0") : "01";
    const type = String(el.type || "").toLowerCase();
    if (type === "date") return `${year}-${month}-${day}`;
    if (type === "month") return `${year}-${month}`;
    return match[3] ? `${year}.${Number(month)}.${Number(day)}` : `${year}.${Number(month)}`;
  }

  function buildStructuredAssignments(fields, profile) {
    const assignments = [];
    Object.keys(STRUCTURED_SECTION_META).forEach((type) => {
      const items = getStructuredItems(profile, type);
      if (!items.length) return;
      let index = 0;
      let seen = new Set();
      let periodCount = 0;
      fields.forEach((field) => {
        const info = getStructuredInfo(field);
        if (!info || info.type !== type) return;
        let subKey = info.subKey;
        if (subKey === "periodDate") {
          subKey = periodCount % 2 === 0 ? "startDate" : "endDate";
          periodCount += 1;
        }
        const meta = STRUCTURED_SECTION_META[type];
        const isStarter = meta.starterKeys.includes(subKey);
        if ((isStarter && seen.has(subKey)) || (!isStarter && seen.has(subKey) && subKey !== "startDate" && subKey !== "endDate")) {
          index += 1;
          seen = new Set();
          periodCount = subKey === "endDate" ? 1 : 0;
        }
        if (!items[index]) return;
        assignments.push({
          field,
          type,
          item: items[index],
          itemIndex: index,
          subKey,
          expected: getStructuredValue(type, items[index], subKey, field.el),
          expectedLabel: getStructuredLabel(type, subKey, index),
        });
        seen.add(subKey);
      });
    });
    return assignments;
  }

  function looksLikeStuffedBlock(value) {
    const text = String(value || "").trim();
    if (!text) return false;
    const labelHits = ["项目名称", "公司", "职位", "时间", "描述", "项目中担任", "获奖类型", "奖项名称"].filter((word) => text.includes(word)).length;
    return labelHits >= 2 || /[：:].{3,}[：:]/.test(text) || text.length > 60;
  }

  function shouldReplaceStructuredValue(current, expected, subKey) {
    const now = String(current || "").trim();
    const next = String(expected || "").trim();
    if (!now) return Boolean(next);
    if (next && normalize(now) === normalize(next)) return false;
    if (!next) return looksLikeStuffedBlock(now);
    if (["name", "company", "role", "type", "level", "score", "startDate", "endDate", "date"].includes(subKey)) {
      return looksLikeStuffedBlock(now) || now.length > next.length + 18;
    }
    return looksLikeStuffedBlock(now) && !normalize(now).includes(normalize(next).slice(0, 20));
  }

  function clearValue(el) {
    el.classList.add("ra-highlight-field");
    setTimeout(() => el.classList.remove("ra-highlight-field"), 1200);
    if (el.tagName === "SELECT") return false;
    if (el.isContentEditable || el.getAttribute("role") === "textbox") {
      el.focus();
      el.innerText = "";
    } else if (el.type === "checkbox" || el.type === "radio") {
      return false;
    } else {
      el.focus();
      el.value = "";
    }
    ["input", "change", "blur"].forEach((type) => el.dispatchEvent(new Event(type, { bubbles: true })));
    return true;
  }

  function fillStructuredSections(fields, profile) {
    const handled = new Set();
    const assignments = buildStructuredAssignments(fields, profile);
    assignments.forEach((item) => handled.add(item.field.el));
    fields.forEach((field) => {
      if (getStructuredInfo(field)) handled.add(field.el);
    });
    let filled = 0;
    let replaced = 0;
    let cleared = 0;
    assignments.forEach((item) => {
      const current = getValue(item.field.el).trim();
      const expected = String(item.expected || "").trim();
      if (!current && expected && setValue(item.field.el, expected)) {
        filled += 1;
      } else if (current && shouldReplaceStructuredValue(current, expected, item.subKey)) {
        if (expected) {
          if (setValue(item.field.el, expected)) replaced += 1;
        } else if (clearValue(item.field.el)) {
          cleared += 1;
        }
      }
    });
    return { handled, assignments, filled, replaced, cleared };
  }

  function getStructuredDiffs(fields, profile) {
    return buildStructuredAssignments(fields, profile)
      .map((item) => {
        const current = getValue(item.field.el).trim();
        const expected = String(item.expected || "").trim();
        const shouldFix = current && shouldReplaceStructuredValue(current, expected, item.subKey);
        const isDifferent = expected && current && normalize(current) !== normalize(expected) && shouldReplaceStructuredValue(current, expected, item.subKey);
        return {
          el: item.field.el,
          label: item.field.label,
          key: item.subKey,
          score: 1,
          expectedLabel: item.expectedLabel,
          current,
          expected,
          isDifferent: shouldFix || isDifferent,
        };
      })
      .filter((item) => item.isDifferent);
  }
  function mapFields(fields, profile) {
    return fields.map((field) => {
      const match = matchField(field.label, profile);
      return { ...field, key: match.key, score: match.score };
    });
  }

  async function scanOnly() {
    try {
      const { profile, active } = await getProfile();
      const fields = getFields();
      const structured = buildStructuredAssignments(fields, profile);
      const mapped = mapFields(fields, profile).filter((item) => !getStructuredInfo(item) && item.key && item.score >= (item.custom ? 0.82 : 0.55));
      show(`<div class="ra-note">当前版本：${escapeHtml(active)}。识别到 ${fields.length} 个可编辑字段，其中结构化经历字段 ${structured.length} 个，通用字段 ${mapped.length} 个；自定义字段只在高匹配时参与。</div>`);
    } catch (error) {
      show(`<div class="ra-old">${escapeHtml(error.message)}</div>`);
    }
  }

  async function fillPage() {
    try {
      const { profile, active } = await getProfile();
      const fields = getFields();
      const structured = fillStructuredSections(fields, profile);
      const mapped = mapFields(fields, profile).filter((item) => !structured.handled.has(item.el) && !getStructuredInfo(item) && item.key && item.score >= minFillScore(item));
      let filled = 0;
      let customFilled = 0;
      mapped.forEach((item) => {
        const expected = getExpectedValue(item, profile);
        if (!getValue(item.el).trim() && setValue(item.el, expected)) {
          filled += 1;
          if (item.custom) customFilled += 1;
        }
      });
      const fixedText = structured.replaced || structured.cleared ? `，并修正 ${structured.replaced} 项、清空错塞字段 ${structured.cleared} 项` : "";
      show(`<div class="ra-note">当前版本：${escapeHtml(active)}。已填写 ${filled + structured.filled} 个字段，其中结构化经历字段 ${structured.filled} 个、通用字段 ${filled} 个、自定义字段 ${customFilled} 个${fixedText}；已有正常内容的字段不会覆盖，请用“检查”处理。</div>`);
    } catch (error) {
      show(`<div class="ra-old">${escapeHtml(error.message)}</div>`);
    }
  }
  function compactKey(text) {
    return normalize(text).replace(/[：:*\s]/g, "");
  }

  function cleanExtractLabel(label) {
    return String(label || "")
      .replace(/\s+/g, " ")
      .replace(/[：:*\s]+$/g, "")
      .trim()
      .slice(0, 80);
  }

  function isSensitiveField(field) {
    const type = String(field.el.type || "").toLowerCase();
    const label = field.label || "";
    return type === "password" || /密码|验证码|校验码|短信|captcha|verify|verification/i.test(label);
  }

  function isStandardResumeLabel(label) {
    const compactLabel = compactKey(label);
    if (!compactLabel) return false;
    return Object.values(ALIASES).flat().some((alias) => {
      const compactAlias = compactKey(alias);
      return compactAlias && (compactLabel === compactAlias || compactLabel.includes(compactAlias) || (compactAlias.includes(compactLabel) && compactLabel.length >= 2));
    });
  }

  function getExtractablePageFields() {
    const seen = new Set();
    const result = [];
    getFields().forEach((field) => {
      if (isSensitiveField(field)) return;
      const value = String(getValue(field.el) || "").replace(/\s+$/g, "").trim();
      if (!value || value.length < 2 || value.length > 5000) return;
      const label = cleanExtractLabel(field.label || getFieldOwnHints(field.el));
      if (!label || label.length < 2) return;
      const key = `${field.el.tagName}|${compactKey(label)}|${normalize(value)}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ field, label, value });
    });
    return result;
  }

  function matchStandardLabel(label) {
    let best = { key: null, score: 0 };
    const compactLabel = compactKey(label);
    if (!compactLabel) return best;
    Object.entries(ALIASES).forEach(([key, aliases]) => {
      aliases.forEach((alias) => {
        const a = compactKey(alias);
        let score = 0;
        if (compactLabel === a) score = 1;
        else if (compactLabel.includes(a)) score = 0.9;
        else if (a.includes(compactLabel) && compactLabel.length >= 2) score = 0.78;
        else score = similarity(compactLabel, a) * 0.7;
        if (score > best.score) best = { key, score };
      });
    });
    return best;
  }

  function createArchiveProfile(baseProfile) {
    const profile = JSON.parse(JSON.stringify(baseProfile || {}));
    profile.projectItems = Array.isArray(profile.projectItems) ? profile.projectItems : [];
    profile.internshipItems = Array.isArray(profile.internshipItems) ? profile.internshipItems : [];
    profile.awardItems = Array.isArray(profile.awardItems) ? profile.awardItems : [];
    profile.languageItems = Array.isArray(profile.languageItems) ? profile.languageItems : [];
    profile.customItems = Array.isArray(profile.customItems) ? profile.customItems : [];
    return profile;
  }

  function blankStructuredItem(type) {
    if (type === "internshipItems") return { company: "", role: "", startDate: "", endDate: "", current: false, description: "" };
    if (type === "projectItems") return { name: "", role: "", startDate: "", endDate: "", current: false, description: "" };
    if (type === "awardItems") return { type: "", name: "", date: "", description: "" };
    if (type === "languageItems") return { name: "", level: "", score: "", date: "", description: "" };
    return {};
  }

  function normalizeExtractedDate(value) {
    const text = String(value || "").trim();
    const match = text.match(/(20\d{2})[-.\/年](\d{1,2})(?:[-.\/月](\d{1,2}))?/);
    if (!match) return text;
    return `${match[1]}.${Number(match[2])}${match[3] ? `.${Number(match[3])}` : ""}`;
  }

  function normalizeStructuredExtractValue(value, subKey) {
    if (["startDate", "endDate", "date", "periodDate"].includes(subKey)) return normalizeExtractedDate(value);
    return String(value || "").trim();
  }

  function assignStructuredExtraction(records) {
    const output = {
      internshipItems: [],
      projectItems: [],
      awardItems: [],
      languageItems: [],
    };
    const handled = new Set();
    const states = {};
    Object.keys(STRUCTURED_SECTION_META).forEach((type) => {
      states[type] = { index: 0, seen: new Set(), periodCount: 0 };
    });

    records.forEach((record) => {
      const info = getStructuredInfo(record.field);
      if (!info) return;
      const state = states[info.type];
      let subKey = info.subKey;
      if (subKey === "periodDate") {
        subKey = state.periodCount % 2 === 0 ? "startDate" : "endDate";
        state.periodCount += 1;
      }
      const meta = STRUCTURED_SECTION_META[info.type];
      const isStarter = meta.starterKeys.includes(subKey);
      if ((isStarter && state.seen.has(subKey)) || (!isStarter && state.seen.has(subKey) && subKey !== "startDate" && subKey !== "endDate")) {
        state.index += 1;
        state.seen = new Set();
        state.periodCount = subKey === "endDate" ? 1 : 0;
      }
      if (!output[info.type][state.index]) output[info.type][state.index] = blankStructuredItem(info.type);
      output[info.type][state.index][subKey] = normalizeStructuredExtractValue(record.value, subKey);
      state.seen.add(subKey);
      handled.add(record.field.el);
    });

    Object.keys(output).forEach((type) => {
      output[type] = output[type].filter(hasStructuredItemContent);
    });
    return { output, handled };
  }

  function appendCustomExtraction(profile, records, handled, source) {
    const customItems = Array.isArray(profile.customItems) ? profile.customItems.filter(Boolean) : [];
    const seen = new Set(customItems.map((item) => `${compactKey(item.label)}|${normalize(item.value)}`));
    let added = 0;
    records.forEach((record) => {
      if (handled.has(record.field.el)) return;
      const label = cleanExtractLabel(record.label);
      const value = String(record.value || "").trim();
      if (!label || !value) return;
      const pairKey = `${compactKey(label)}|${normalize(value)}`;
      if (seen.has(pairKey)) return;
      customItems.push({
        label,
        keywords: label,
        value,
        enabled: false,
        source,
      });
      seen.add(pairKey);
      added += 1;
    });
    profile.customItems = customItems;
    return added;
  }

  function applyExtractedRecordsToProfile(profile, records, source) {
    const structured = assignStructuredExtraction(records);
    let structuredCount = 0;
    Object.entries(structured.output).forEach(([type, items]) => {
      if (items.length) {
        profile[type] = items;
        structuredCount += items.length;
      }
    });

    let standardCount = 0;
    records.forEach((record) => {
      if (structured.handled.has(record.field.el)) return;
      const ownMatch = matchStandardLabel(getFieldOwnHints(record.field.el));
      const labelMatch = matchStandardLabel(record.label);
      const match = ownMatch.score >= labelMatch.score ? ownMatch : labelMatch;
      if (!match.key || match.score < 0.72) return;
      if (["projects", "internships", "awards", "languages"].includes(match.key) && String(record.value).length < 20) return;
      profile[match.key] = record.value;
      structured.handled.add(record.field.el);
      standardCount += 1;
    });

    const customCount = appendCustomExtraction(profile, records, structured.handled, source);
    return { structuredCount, standardCount, customCount };
  }

  function defaultExtractArchiveName() {
    const host = location.hostname || "网页提取";
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    return `${host}-提取-${stamp}`;
  }

  async function saveExtractedArchive(archiveName) {
    const records = getExtractablePageFields();
    if (!records.length) throw new Error("当前页面没有发现可提取的已填写文本字段。验证码、密码等敏感字段会自动跳过。");

    const res = await fetch(`${API}/api/resume`, { cache: "no-store" });
    if (!res.ok) throw new Error("本地服务未启动，请先打开简历填写助手。");
    const store = await res.json();
    store.versions = store.versions || {};
    const name = String(archiveName || "").trim();
    if (!name) throw new Error("存档名称不能为空。");
    if (store.versions[name]) throw new Error("该存档名称已存在，请换一个名称。");

    const active = store.activeVersion || "通用版";
    const baseVersion = store.versions?.[active] || Object.values(store.versions || {})[0] || { profile: {} };
    const profile = createArchiveProfile(baseVersion.profile || {});
    const source = `${location.hostname || location.href} ${new Date().toLocaleString()}`;
    const counts = applyExtractedRecordsToProfile(profile, records, source);
    store.versions[name] = {
      profile,
      sources: [{ file: "网页反向提取", path: location.href, time: new Date().toLocaleString() }],
      updatedAt: new Date().toLocaleString(),
    };
    store.activeVersion = name;
    store.updatedAt = new Date().toLocaleString();

    const saveRes = await fetch(`${API}/api/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store),
    });
    if (!saveRes.ok) throw new Error("保存新提取存档失败。");
    return { active: name, records, ...counts };
  }

  async function extractPage() {
    try {
      const name = prompt("请输入本次提取要新建的存档名称", defaultExtractArchiveName());
      if (name === null) return;
      const result = await saveExtractedArchive(name);
      const preview = result.records.slice(0, 6).map((item) => `
        <div class="ra-item">
          <div class="ra-label">${escapeHtml(item.label)}</div>
          <div class="ra-new">${escapeHtml(trimText(item.value))}</div>
        </div>
      `).join("");
      show(`
        <div class="ra-note">已新建存档：${escapeHtml(result.active)}。共提取 ${result.records.length} 个已填写字段；标准字段 ${result.standardCount} 个，结构化经历 ${result.structuredCount} 段，额外自定义 ${result.customCount} 项。额外字段默认未启用自动填入。</div>
        ${preview}
      `);
    } catch (error) {
      show(`<div class="ra-old">${escapeHtml(error.message)}</div>`);
    }
  }
  async function checkPage() {
    try {
      const { profile, active } = await getProfile();
      const fields = getFields();
      const structured = { handled: new Set() };
      buildStructuredAssignments(fields, profile).forEach((item) => structured.handled.add(item.field.el));
      fields.forEach((field) => {
        if (getStructuredInfo(field)) structured.handled.add(field.el);
      });
      const structuredDiffs = getStructuredDiffs(fields, profile);
      const mapped = mapFields(fields, profile).filter((item) => !structured.handled.has(item.el) && !getStructuredInfo(item) && item.key && item.score >= minCheckScore(item));
      const genericDiffs = mapped
        .map((item) => {
          const current = getValue(item.el).trim();
          const expected = String(getExpectedValue(item, profile) || "").trim();
          const isDifferent = current && expected && normalize(current) !== normalize(expected) && !normalize(current).includes(normalize(expected).slice(0, 18));
          return { ...item, current, expected, isDifferent };
        })
        .filter((item) => item.isDifferent);
      const diffs = [...structuredDiffs, ...genericDiffs];
      if (!diffs.length) {
        show(`<div class="ra-note">当前版本：${escapeHtml(active)}。未发现明显错填项。</div>`);
        return;
      }
      show(diffs.map((item, index) => `
        <div class="ra-item">
          <div class="ra-label">${escapeHtml(item.label || item.key)} → ${escapeHtml(item.expectedLabel || getExpectedLabel(item))}（置信度 ${(item.score * 100).toFixed(0)}%）</div>
          <div class="ra-old">当前：${escapeHtml(trimText(item.current))}</div>
          <div class="ra-new">建议：${escapeHtml(trimText(item.expected || "清空"))}</div>
          <button class="ra-apply" data-index="${index}">替换此项</button>
        </div>
      `).join(""));
      document.querySelectorAll(`#${ROOT_ID} .ra-apply`).forEach((btn) => {
        btn.addEventListener("click", () => {
          const item = diffs[Number(btn.dataset.index)];
          if (String(item.expected || "").trim()) setValue(item.el, item.expected);
          else clearValue(item.el);
          btn.textContent = "已替换";
        });
      });
    } catch (error) {
      show(`<div class="ra-old">${escapeHtml(error.message)}</div>`);
    }
  }
  function show(html) {
    const root = document.getElementById(ROOT_ID);
    const panel = root.querySelector(".ra-panel");
    panel.classList.remove("collapsed");
    keepRootInViewport(root);
    root.querySelector(".ra-result").innerHTML = html;
  }

  function trimText(text) {
    return String(text || "").replace(/\s+/g, " ").slice(0, 140);
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startFloatingController);
  } else {
    startFloatingController();
  }
})();






















