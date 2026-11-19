const I18N = {
  zh: {
    modeAI: "AI 模型",
    modeRules: "规则整理",
    modeDemo: "演示模式",
    modeIdle: "在线",
    restart: "重新开始",
    providerSettings: "模型设置",
    providerTitleStart: "连接在线大模型",
    providerTitleSettings: "模型设置",
    providerIntroStart:
      "选择模型提供商并输入 API Key。该 Key 只保存在当前浏览器标签页，用于本次融资材料会话。也可以先使用演示模式体验完整流程。",
    providerIntroSettings:
      "更新模型或密钥。密钥留空时会继续使用当前标签页中已保存的密钥；重新选择语言可开始新会话。",
    providerLabel: "提供商",
    providerModelLabel: "模型",
    providerBaseUrlLabel: "Base URL",
    providerKeyLabel: "API Key",
    providerKeyPlaceholder: "输入 API Key",
    providerKeySaved: "已在当前标签页保存；留空表示继续使用",
    providerPrivacy:
      "密钥仅保存在当前标签页内存中，并随请求经本站转发给所选提供商；不会写入日志、Cookie 或服务器存储。",
    providerTest: "测试连接",
    providerTesting: "测试中…",
    providerDemo: "使用演示模式",
    providerStart: "开始访谈",
    providerSave: "保存设置",
    providerLoadError: "无法加载提供商列表，请稍后重试。",
    providerMissingKey: "请输入 API Key，或使用演示模式。",
    providerMissingModel: "请输入模型名称。",
    providerMissingBaseUrl: "请输入自定义 Base URL（必须使用 HTTPS）。",
    providerOk: "连接成功：{provider} · {model}",
    providerDemoToast: "已切换到演示模式（规则整理，支持中英文）。",
    providerSavedToast: "模型设置已更新。",
    providerDemoLang:
      "演示模式仅支持中文和英文。其他语言请连接在线模型提供商。",
    providerDisabledDemo: "演示模式当前不可用，请连接在线模型。",
    providerDocs: "获取 API Key / 查看文档",
    edgeAiNotice:
      "默认使用 EdgeOne AI 免费额度（无需 API Key）。如需更高额度，请设置自己的 Provider / API Key。",
    edgeAiQuotaNotice: "EdgeOne AI 免费额度已用完。请设置自己的 Provider 和 API Key 后继续。",
    edgeAiSetup: "设置自己的模型",
    edgeAiDocs: "EdgeOne AI 介绍",
    edgeAiQuotaTitle: "EdgeOne AI 免费额度已用完",
    edgeAiQuotaIntro:
      "免费额度已用完，必须设置自己的 Provider 和 API Key 才能继续。当前对话和已填写信息不会丢失。",
    edgeAiQuotaError: "EdgeOne AI 免费额度已用完，请设置自己的 Provider / API Key 后继续。",
    edgeAiUnavailable: "EdgeOne AI 当前不可用，已回退到演示模式。",
    providerDemoName: "演示模式",
    providerDemoModel: "规则引擎",
    otherLanguage: "其他语言 / Other language",
    otherLanguagePlaceholder: "例如：日本語 / Español / Français",
    otherLanguageContinue: "继续 / Continue",
    otherLanguageMissing: "请输入语言名称。",
    toastWarnings: "部分文档使用了模板兜底，请检查后再对外使用。",
    topbarNote: "对话 → 标准匹配 → 全套材料",
    sidebarFoot: "ISO / GB 标准 · 对话数据不留存",
    langBadge: "中文",
    contextTitle: "项目访谈",
    contextSub: "按融资文档结构逐项补齐信息",
    contextChip: "DISCOVERY",
    coverage: "信息覆盖",
    composerPlaceholder: "介绍您的项目，或回答上面的问题…",
    composerHint: "Enter 发送 · Shift + Enter 换行",
    generate: "生成全套材料",
    generating: "正在生成…",
    backToChat: "返回对话",
    print: "打印当前文档",
    downloadAll: "下载全套 ZIP",
    downloading: "正在打包…",
    copy: "复制",
    copied: "已复制 Markdown。",
    copyFail: "复制失败，请手动选择文本。",
    downloadMd: "Markdown",
    downloadDoc: "Word",
    processTitle: "工作方式",
    processSteps: [
      { title: "选择语言与模型", desc: "中文、English 或其他语言；连接在线模型或使用演示模式。" },
      { title: "介绍项目", desc: "产品、客户、进展与融资计划。" },
      { title: "逐项追问", desc: "由模型结合标准与文档结构补齐关键信息。" },
      { title: "生成与下载", desc: "预览全套材料，导出 Markdown / Word / ZIP。" }
    ],
    outputTitle: "交付内容",
    outputDesc: "9 份材料：总览、一页纸摘要、商业计划书、路演大纲、财务预测、市场与竞争、技术与标准尽调、风险清单、数据室清单。",
    progressTitle: "信息完整度",
    progressSub: "项核心信息已覆盖",
    standardTitle: "匹配标准",
    standardNational: "国内对照",
    standardEmpty: "介绍项目后，将根据产品与行业特征自动匹配 ISO / GB 标准。",
    standardDimensions: "关注维度",
    coverageTitle: "材料完成度",
    missingTitle: "优先补充",
    missingNone: "核心信息已覆盖完整",
    sideGenerate: "生成全套材料",
    sideGenerateHint: "也可以先按现有信息生成，未补充项会自动标注。",
    sideIntroHint: "请先在对话中介绍项目，随后即可生成。",
    samples: [
      "我们做面向中小企业的 AI 客服 SaaS，按坐席订阅收费，已有 30 家付费客户，ARR 120 万元。",
      "我们研发便携式心电监测设备，正在申请二类医疗器械注册证，已完成样机和 50 例临床预试验。",
      "我们做新能源汽车退役电池回收与梯次利用，已与 3 家车企签订回收协议，首条产线预计明年投产。"
    ],
    skip: "暂无，继续",
    generateChip: "生成融资材料",
    typing: "正在整理…",
    requestWaiting: "正在等待 {target} 响应 · 已等待 {elapsed} 秒",
    requestGenerating: "正在使用 {target} 生成材料 · 已等待 {elapsed} 秒",
    requestCancel: "取消请求",
    requestCancelled: "已取消本次请求。",
    requestTimeout: "请求超时，请重试或切换模型。",
    emptyResponseHint:
      "模型没有返回最终内容。请打开模型设置，改用 deepseek-flash（非思考模式）或提高输出上限。",
    providerErrorMeta:
      "诊断：模型 {model} · finish_reason={reason} · 思考 tokens={reasoning}/{completion}",
    readyToast: "核心信息已齐全，可以生成全套材料。",
    toastGenerated: "已生成 {count} 份融资材料。",
    toastIncomplete: "已按现有信息生成，未补充项已标注为“待补充”。",
    toastNeedIntro: "请先介绍项目，再生成材料。",
    toastError: "请求失败，请稍后重试。",
    toastZipError: "打包下载失败，请重试。",
    toastZipReady: "全套材料已开始下载。",
    toastGenerating: "正在按对话内容整理全套材料…",
    errorPrefix: "请求失败：",
    retryHint: "请稍后重试。",
    loadedFrom: "生成于",
    noMaterials: "暂无材料。",
    materialsEyebrow: "FUNDING PACK",
    materialsTitle: "融资材料包",
    materialsSubtitle: "{project} · {standard} · {date} · 信息覆盖 {pct}%",
    restartConfirm: "确定要重新开始吗？当前对话与已生成材料将被清空。",
    introFallback:
      "好的，我们将使用中文。请用几句话介绍您的项目：它解决什么问题、产品/服务是什么、面向哪些客户、目前进展如何。信息越具体，后续追问越少。",
    you: "你",
    assistant: "AI",
    docListAria: "材料列表",
    startError: "暂时无法连接服务，已使用本地提示继续。"
  },
  en: {
    modeAI: "AI model",
    modeRules: "Rules mode",
    modeDemo: "Demo mode",
    modeIdle: "Online",
    restart: "Start over",
    providerSettings: "Model settings",
    providerTitleStart: "Connect an AI model",
    providerTitleSettings: "Model settings",
    providerIntroStart:
      "Choose a model provider and enter its API key. The key stays in this browser tab for this funding-pack session. You can also try demo mode first.",
    providerIntroSettings:
      "Update the model or key. Leave the key blank to keep the key already held in this tab. Choose a new language to start a new session.",
    providerLabel: "Provider",
    providerModelLabel: "Model",
    providerBaseUrlLabel: "Base URL",
    providerKeyLabel: "API key",
    providerKeyPlaceholder: "Enter your API key",
    providerKeySaved: "Saved in this tab; leave blank to keep it",
    providerPrivacy:
      "The key is held in this tab's memory and sent through this app only to the selected provider. It is never written to logs, cookies or server storage.",
    providerTest: "Test connection",
    providerTesting: "Testing…",
    providerDemo: "Use demo mode",
    providerStart: "Start interview",
    providerSave: "Save settings",
    providerLoadError: "Could not load the provider list. Please retry.",
    providerMissingKey: "Enter an API key or use demo mode.",
    providerMissingModel: "Enter a model name.",
    providerMissingBaseUrl: "Enter a custom Base URL using HTTPS.",
    providerOk: "Connected: {provider} · {model}",
    providerDemoToast: "Switched to demo mode (rules engine, Chinese and English).",
    providerSavedToast: "Model settings updated.",
    providerDemoLang:
      "Demo mode supports Chinese and English only. Connect a model provider for other languages.",
    providerDisabledDemo: "Demo mode is disabled. Please connect a model provider.",
    providerDocs: "Get an API key / view docs",
    edgeAiNotice:
      "EdgeOne AI free quota is used by default with no API key. For higher limits, configure your own provider and API key.",
    edgeAiQuotaNotice: "EdgeOne AI free quota is exhausted. Configure your own provider and API key to continue.",
    edgeAiSetup: "Set up my model",
    edgeAiDocs: "About EdgeOne AI",
    edgeAiQuotaTitle: "EdgeOne AI free quota exhausted",
    edgeAiQuotaIntro:
      "The free quota is exhausted. Configure your own provider and API key to continue. Your conversation and answers are not lost.",
    edgeAiQuotaError: "EdgeOne AI free quota is exhausted. Configure your own provider / API key to continue.",
    edgeAiUnavailable: "EdgeOne AI is unavailable; demo mode is being used.",
    providerDemoName: "Demo mode",
    providerDemoModel: "Rules engine",
    otherLanguage: "Other language / 其他语言",
    otherLanguagePlaceholder: "e.g. 日本語 / Español / Français",
    otherLanguageContinue: "Continue / 继续",
    otherLanguageMissing: "Please enter a language name.",
    toastWarnings: "Some documents used template fallback. Please review them before external use.",
    topbarNote: "Conversation → standards → funding pack",
    sidebarFoot: "ISO / GB standards · conversation not stored",
    langBadge: "EN",
    contextTitle: "Project interview",
    contextSub: "Filling gaps against the funding documents",
    contextChip: "DISCOVERY",
    coverage: "Coverage",
    composerPlaceholder: "Introduce your project or answer the question above…",
    composerHint: "Enter to send · Shift + Enter for a new line",
    generate: "Generate full pack",
    generating: "Generating…",
    backToChat: "Back to chat",
    print: "Print document",
    downloadAll: "Download all (.zip)",
    downloading: "Packaging…",
    copy: "Copy",
    copied: "Markdown copied.",
    copyFail: "Copy failed. Please select the text manually.",
    downloadMd: "Markdown",
    downloadDoc: "Word",
    processTitle: "How it works",
    processSteps: [
      { title: "Choose language & model", desc: "Chinese, English or another language; connect a model or use demo mode." },
      { title: "Introduce the project", desc: "Product, customers, traction and funding plan." },
      { title: "Guided gap-filling", desc: "The model completes the standards and document structure." },
      { title: "Generate & download", desc: "Preview the full pack and export Markdown / Word / ZIP." }
    ],
    outputTitle: "Deliverables",
    outputDesc: "9 documents: overview, one-pager, business plan, pitch outline, financials, market & competition, technical & standards DD, risk register and data-room checklist.",
    progressTitle: "Information completeness",
    progressSub: "core fields covered",
    standardTitle: "Matched standard",
    standardNational: "China reference",
    standardEmpty: "Introduce the project and the app will match an ISO / GB standard from product and industry signals.",
    standardDimensions: "Focus dimensions",
    coverageTitle: "Material completeness",
    missingTitle: "Priority gaps",
    missingNone: "Core information is complete",
    sideGenerate: "Generate full pack",
    sideGenerateHint: "You can also generate now; gaps are marked automatically.",
    sideIntroHint: "Introduce the project in the chat first.",
    samples: [
      "We build an AI customer-support SaaS for SMEs, priced per seat. We have 30 paying customers and RMB 1.2M ARR.",
      "We develop a portable ECG monitoring device. We are applying for Class II medical device registration, with a prototype and a 50-patient pilot.",
      "We recycle and repurpose retired EV batteries, with agreements with 3 automakers and our first production line planned for next year."
    ],
    skip: "Skip for now",
    generateChip: "Generate materials",
    typing: "Organising…",
    requestWaiting: "Waiting for {target} · {elapsed}s",
    requestGenerating: "Generating with {target} · {elapsed}s",
    requestCancel: "Cancel request",
    requestCancelled: "Request cancelled.",
    requestTimeout: "The request timed out. Please retry or switch models.",
    emptyResponseHint:
      "The model returned no final content. Open model settings and use deepseek-flash in non-thinking mode, or raise the output limit.",
    providerErrorMeta:
      "Diagnostics: model {model} · finish_reason={reason} · reasoning tokens {reasoning}/{completion}",
    readyToast: "Core information is complete. You can generate the full pack.",
    toastGenerated: "Generated {count} financing documents.",
    toastIncomplete: "Generated from current information; gaps are marked TBD.",
    toastNeedIntro: "Please introduce the project before generating.",
    toastError: "Request failed. Please retry.",
    toastZipError: "Could not package the download. Please retry.",
    toastZipReady: "Your funding pack download has started.",
    toastGenerating: "Organising the full pack from your conversation…",
    errorPrefix: "Request failed: ",
    retryHint: "Please try again shortly.",
    loadedFrom: "Generated",
    noMaterials: "No materials yet.",
    materialsEyebrow: "FUNDING PACK",
    materialsTitle: "Funding pack",
    materialsSubtitle: "{project} · {standard} · {date} · coverage {pct}%",
    restartConfirm: "Start over? The current conversation and generated pack will be cleared.",
    introFallback:
      "Great — we will use English. Please introduce your project in a few sentences: what problem it solves, what the product/service is, who it serves, and your current progress. The more specific you are, the fewer follow-up questions I will need.",
    you: "YOU",
    assistant: "AI",
    docListAria: "Materials list",
    startError: "The service is temporarily unreachable; continuing with a local prompt."
  }
};

const EDGE_AI_QUOTA_STORAGE_KEY = "fundflow.edgeAiQuotaDate";

const state = {
  lang: null,
  uiLang: "zh",
  languageLabel: "",
  messages: [],
  profile: {},
  pending: [],
  standard: null,
  coverage: null,
  productType: "",
  ready: false,
  mode: null,
  phase: "start",
  quickReplies: [],
  materials: null,
  meta: null,
  activeMaterial: 0,
  busy: false,
  starting: false,
  generating: false,
  view: "start",
  provider: null,
  providerInfo: null,
  demo: false,
  demoEnabled: true,
  edgeAiAvailable: true,
  edgeAiExhausted: readEdgeAiQuotaExhausted(),
  edgeAiDocsUrl: "https://pages.edgeone.ai/zh/document/edge-ai",
  providers: [],
  providersLoaded: false,
  providersLoading: false,
  providerModalMode: "start",
  pendingLanguage: null,
  warnings: []
};

const el = {
  sidebar: document.getElementById("sidebar"),
  sidebarBody: document.getElementById("sidebarBody"),
  sidebarFootText: document.getElementById("sidebarFootText"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  sidebarClose: document.getElementById("sidebarClose"),
  menuButton: document.getElementById("menuButton"),
  statusPill: document.getElementById("statusPill"),
  modeLabel: document.getElementById("modeLabel"),
  topbarNote: document.getElementById("topbarNote"),
  edgeAiNotice: document.getElementById("edgeAiNotice"),
  edgeAiNoticeText: document.getElementById("edgeAiNoticeText"),
  edgeAiDocs: document.getElementById("edgeAiDocs"),
  edgeAiSetup: document.getElementById("edgeAiSetup"),
  requestBanner: document.getElementById("requestBanner"),
  requestStatusText: document.getElementById("requestStatusText"),
  requestCancel: document.getElementById("requestCancel"),
  langBadge: document.getElementById("langBadge"),
  providerSettingsButton: document.getElementById("providerSettingsButton"),
  restartButton: document.getElementById("restartButton"),
  otherLanguageCard: document.getElementById("otherLanguageCard"),
  otherLanguagePanel: document.getElementById("otherLanguagePanel"),
  otherLanguageInput: document.getElementById("otherLanguageInput"),
  otherLanguageStart: document.getElementById("otherLanguageStart"),
  providerModal: document.getElementById("providerModal"),
  providerClose: document.getElementById("providerClose"),
  providerTitle: document.getElementById("providerTitle"),
  providerIntro: document.getElementById("providerIntro"),
  providerForm: document.getElementById("providerForm"),
  providerSelect: document.getElementById("providerSelect"),
  providerModel: document.getElementById("providerModel"),
  providerModels: document.getElementById("providerModels"),
  providerBaseUrlField: document.getElementById("providerBaseUrlField"),
  providerBaseUrl: document.getElementById("providerBaseUrl"),
  providerKey: document.getElementById("providerKey"),
  providerLabel: document.getElementById("providerLabel"),
  providerModelLabel: document.getElementById("providerModelLabel"),
  providerBaseUrlLabel: document.getElementById("providerBaseUrlLabel"),
  providerKeyLabel: document.getElementById("providerKeyLabel"),
  providerDocs: document.getElementById("providerDocs"),
  providerPrivacy: document.getElementById("providerPrivacy"),
  providerStatus: document.getElementById("providerStatus"),
  providerTest: document.getElementById("providerTest"),
  providerDemo: document.getElementById("providerDemo"),
  providerSubmit: document.getElementById("providerSubmit"),
  startView: document.getElementById("startView"),
  chatView: document.getElementById("chatView"),
  chatScroll: document.getElementById("chatScroll"),
  chatContext: document.getElementById("chatContext"),
  messageList: document.getElementById("messageList"),
  quickReplies: document.getElementById("quickReplies"),
  composer: document.getElementById("composer"),
  composerInput: document.getElementById("composerInput"),
  sendButton: document.getElementById("sendButton"),
  composerHint: document.getElementById("composerHint"),
  generateButton: document.getElementById("generateButton"),
  materialsView: document.getElementById("materialsView"),
  backToChat: document.getElementById("backToChat"),
  printButton: document.getElementById("printButton"),
  downloadAllButton: document.getElementById("downloadAllButton"),
  materialsEyebrow: document.getElementById("materialsEyebrow"),
  materialsTitle: document.getElementById("materialsTitle"),
  materialsSubtitle: document.getElementById("materialsSubtitle"),
  docList: document.getElementById("docList"),
  previewFilename: document.getElementById("previewFilename"),
  preview: document.getElementById("preview"),
  copyButton: document.getElementById("copyButton"),
  downloadMdButton: document.getElementById("downloadMdButton"),
  downloadDocButton: document.getElementById("downloadDocButton"),
  toast: document.getElementById("toast")
};

let toastTimer = null;
let typingElement = null;
let activeRequest = null;

function t(key, vars = {}) {
  const lang = state.uiLang === "en" ? "en" : "zh";
  const value = I18N[lang][key] ?? I18N.zh[key] ?? key;
  if (typeof value !== "string") return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? "" : String(vars[name])));
}

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readEdgeAiQuotaExhausted() {
  try {
    return window.localStorage.getItem(EDGE_AI_QUOTA_STORAGE_KEY) === localDayKey();
  } catch {
    return false;
  }
}

function persistEdgeAiQuotaExhausted(exhausted) {
  try {
    if (exhausted) {
      window.localStorage.setItem(EDGE_AI_QUOTA_STORAGE_KEY, localDayKey());
    } else {
      window.localStorage.removeItem(EDGE_AI_QUOTA_STORAGE_KEY);
    }
  } catch {
    /* storage can be unavailable in private browsing */
  }
}

function isEdgeAiQuotaError(error) {
  return Boolean(
    error &&
      (error.code === "edge_ai_quota_exhausted" ||
        /EdgeOne AI free quota|免费额度已用完|每日.*额度/i.test(String(error.message || "")))
  );
}

function markEdgeAiQuotaExhausted() {
  state.edgeAiExhausted = true;
  state.demo = false;
  state.provider = null;
  state.providerInfo = null;
  persistEdgeAiQuotaExhausted(true);
  updateStatus();
  updateEdgeAiNotice();
  syncControls();
}

function clearEdgeAiQuotaExhausted() {
  if (!state.edgeAiExhausted) return;
  state.edgeAiExhausted = false;
  persistEdgeAiQuotaExhausted(false);
  updateEdgeAiNotice();
  syncControls();
}

function handleEdgeAiQuota() {
  markEdgeAiQuotaExhausted();
  showToast(t("edgeAiQuotaError"));
  openProviderModal("quota");
}

function ensureProviderReady() {
  if (state.edgeAiExhausted && !state.provider) {
    openProviderModal("quota");
    return false;
  }
  return true;
}

function updateEdgeAiNotice() {
  if (!el.edgeAiNotice) return;
  const show =
    Boolean(state.edgeAiExhausted) ||
    (!state.provider && !state.demo && state.edgeAiAvailable !== false);
  el.edgeAiNotice.hidden = !show;
  if (!show) return;
  el.edgeAiNotice.classList.toggle("quota", state.edgeAiExhausted);
  if (el.edgeAiNoticeText) {
    el.edgeAiNoticeText.textContent = state.edgeAiExhausted ? t("edgeAiQuotaNotice") : t("edgeAiNotice");
  }
  if (el.edgeAiDocs) {
    el.edgeAiDocs.href = state.edgeAiDocsUrl;
    el.edgeAiDocs.textContent = t("edgeAiDocs");
  }
  if (el.edgeAiSetup) el.edgeAiSetup.textContent = t("edgeAiSetup");
}

function applyProviderResult(data) {
  if (data.provider) {
    state.providerInfo = {
      id: data.provider.id,
      name: data.provider.name,
      model: data.provider.model
    };
    if (state.provider && state.provider.id === data.provider.id) {
      state.provider.model = data.provider.model || state.provider.model;
    }
  }
  if (typeof data.demo === "boolean") state.demo = data.demo;
  if (data.edgeAi) {
    state.edgeAiAvailable = true;
    if (state.edgeAiExhausted) clearEdgeAiQuotaExhausted();
  }
  updateEdgeAiNotice();
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function hasUserMessage() {
  return state.messages.some((message) => message.role === "user");
}

function formatDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return String(iso || "").slice(0, 10);
  try {
    return new Intl.DateTimeFormat(state.uiLang === "en" ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function showToast(message, { sticky = false } = {}) {
  if (!el.toast) return;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  el.toast.textContent = message;
  el.toast.classList.add("show");
  if (!sticky) {
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
      toastTimer = null;
    }, 3400);
  }
}

function hideToast() {
  if (!el.toast) return;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  el.toast.classList.remove("show");
}

function updateStatus() {
  if (!el.statusPill || !el.modeLabel) return;
  const mode = state.mode;
  let label;
  if (mode === "ai") {
    const info = state.providerInfo || state.provider;
    label = info && info.name ? `${info.name} · ${info.model}` : t("modeAI");
  } else if (mode === "rules") {
    label = state.demo ? t("modeDemo") : t("modeRules");
  } else {
    label = state.lang ? t("modeIdle") : "ONLINE";
  }
  el.modeLabel.textContent = String(label).slice(0, 48);
  el.statusPill.classList.toggle("rules", mode === "rules");
}

function setInitialChrome() {
  state.lang = null;
  state.uiLang = "zh";
  state.languageLabel = "";
  state.mode = null;
  updateStatus();
  if (el.topbarNote) el.topbarNote.textContent = "Conversation → standards → funding pack";
  if (el.sidebarFootText) el.sidebarFootText.textContent = "ISO / GB standards · private by design";
  if (el.langBadge) el.langBadge.hidden = true;
  if (el.restartButton) el.restartButton.hidden = true;
  if (el.providerSettingsButton) el.providerSettingsButton.hidden = true;
  updateEdgeAiNotice();
  document.documentElement.lang = "zh-CN";
}

function applyLanguageChrome(lang, label) {
  state.lang = lang;
  state.uiLang = lang === "zh" ? "zh" : "en";
  state.languageLabel = label || (lang === "zh" ? "中文" : lang === "en" ? "English" : "Other");
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  if (el.topbarNote) el.topbarNote.textContent = t("topbarNote");
  if (el.sidebarFootText) el.sidebarFootText.textContent = t("sidebarFoot");
  if (el.langBadge) {
    el.langBadge.textContent = state.languageLabel;
    el.langBadge.hidden = false;
  }
  if (el.providerSettingsButton) {
    el.providerSettingsButton.textContent = t("providerSettings");
    el.providerSettingsButton.hidden = false;
  }
  if (el.restartButton) {
    el.restartButton.textContent = t("restart");
    el.restartButton.hidden = false;
  }
  if (el.composerInput) el.composerInput.placeholder = t("composerPlaceholder");
  if (el.composerHint) el.composerHint.textContent = t("composerHint");
  if (el.generateButton) el.generateButton.textContent = t("generate");
  if (el.backToChat) el.backToChat.innerHTML = `← ${escapeHtml(t("backToChat"))}`;
  if (el.printButton) el.printButton.textContent = t("print");
  if (el.downloadAllButton) el.downloadAllButton.textContent = t("downloadAll");
  if (el.copyButton) el.copyButton.textContent = t("copy");
  if (el.downloadMdButton) el.downloadMdButton.textContent = t("downloadMd");
  if (el.downloadDocButton) el.downloadDocButton.textContent = t("downloadDoc");
  updateEdgeAiNotice();
  updateStatus();
}

function showView(view) {
  state.view = view;
  if (el.startView) el.startView.hidden = view !== "start";
  if (el.chatView) el.chatView.hidden = view !== "chat";
  if (el.materialsView) el.materialsView.hidden = view !== "materials";
  closeSidebar();
  syncControls();
}

function openSidebar() {
  document.body.classList.add("sidebar-open");
  if (el.sidebarOverlay) el.sidebarOverlay.hidden = false;
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
  if (el.sidebarOverlay) el.sidebarOverlay.hidden = true;
}

async function api(path, body, method = "POST", { signal, timeoutMs = 0 } = {}) {
  const options = { method, headers: {}, signal };
  let timer = null;
  let timeoutController = null;
  if (!signal && timeoutMs > 0) {
    timeoutController = new AbortController();
    options.signal = timeoutController.signal;
    timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  }
  if (method !== "GET" && body !== undefined) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(path, options);
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const error = new Error((data && data.error) || `HTTP ${response.status}`);
      error.code = data && data.code;
      error.provider = data && data.provider;
      error.details = data && data.details;
      error.status = response.status;
      throw error;
    }
    return data || {};
  } catch (error) {
    if (error && error.name === "AbortError") {
      const aborted = new Error(timeoutController ? "Request timed out." : "Request aborted.");
      aborted.name = "AbortError";
      aborted.code = timeoutController ? "timeout" : "aborted";
      throw aborted;
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function renderSidebar() {
  if (!el.sidebarBody) return;
  if (!state.lang) {
    const steps = [
      { title: "选择语言 / Choose language", desc: "中文或 English / 中文 or English" },
      { title: "介绍项目 / Introduce", desc: "产品、客户、进展 / Product, customers, traction" },
      { title: "逐项追问 / Guided gaps", desc: "按标准与文档结构补齐 / Standards & document structure" },
      { title: "生成与下载 / Generate", desc: "预览与导出 / Preview and export" }
    ];
    el.sidebarBody.innerHTML = `
      <section class="sidebar-section">
        <p class="side-kicker"><span>HOW IT WORKS</span><span>01—04</span></p>
        <ol class="process-list">
          ${steps
            .map(
              (step) =>
                `<li><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.desc)}</small></li>`
            )
            .join("")}
        </ol>
      </section>
      <section class="sidebar-section">
        <p class="side-kicker"><span>OUTPUT</span><span>9 DOCS</span></p>
        <p class="side-title">成套融资材料 / Investor-ready pack</p>
        <p class="side-copy">一页纸摘要、商业计划书、路演大纲、财务预测、市场与竞争、技术与标准尽调、风险清单、数据室清单。</p>
      </section>
      <section class="sidebar-section">
        <p class="side-kicker"><span>STANDARDS</span><span>ISO / GB</span></p>
        <p class="side-copy">ISO/IEC 25000 series · ISO 9001 · ISO 13485 · ISO/IEC 27001 · ISO/IEC 42001 · GB/T equivalents</p>
      </section>
    `;
    return;
  }

  const coverage = state.coverage;
  const standard = state.standard;
  const percent = coverage ? coverage.percent : 0;
  const filled = coverage ? coverage.filled : 0;
  const total = coverage ? coverage.total : 16;

  const standardSection = standard
    ? `
      <section class="sidebar-section">
        <p class="side-kicker"><span>${escapeHtml(t("standardTitle"))}</span><span>ISO / GB</span></p>
        <span class="standard-code">${escapeHtml(standard.primary.code)}</span>
        <p class="standard-name">${escapeHtml(standard.primary.name)}</p>
        <p class="standard-national">${escapeHtml(t("standardNational"))}：${escapeHtml(standard.national.code)} · ${escapeHtml(standard.national.name)}</p>
        <p class="standard-reason">${escapeHtml(standard.rationale)}</p>
        <div class="dimension-chips">
          ${standard.dimensions
            .slice(0, 4)
            .map((dimension) => `<span class="dimension-chip">${escapeHtml(String(dimension).split("：")[0].split(":")[0])}</span>`)
            .join("")}
        </div>
      </section>`
    : `
      <section class="sidebar-section">
        <p class="side-kicker"><span>${escapeHtml(t("standardTitle"))}</span><span>ISO / GB</span></p>
        <p class="empty-standard">${escapeHtml(t("standardEmpty"))}</p>
      </section>`;

  const progressSection = coverage
    ? `
      <section class="sidebar-section">
        <p class="side-kicker"><span>${escapeHtml(t("progressTitle"))}</span><span>${percent}%</span></p>
        <div class="progress-card">
          <div class="progress-ring" style="--pct:${percent}"><span>${percent}%</span></div>
          <div class="progress-copy">
            <strong>${filled} / ${total}</strong>
            <small>${escapeHtml(t("progressSub"))}</small>
          </div>
        </div>
      </section>`
    : `
      <section class="sidebar-section">
        <p class="side-kicker"><span>${escapeHtml(t("progressTitle"))}</span><span>0%</span></p>
        <p class="side-copy">${escapeHtml(t("contextSub"))}</p>
      </section>`;

  const coverageSection = coverage
    ? `
      <section class="sidebar-section">
        <p class="side-kicker"><span>${escapeHtml(t("coverageTitle"))}</span><span>${coverage.sections.length}</span></p>
        <div class="coverage-list">
          ${coverage.sections
            .map(
              (section) => `
              <div class="coverage-row">
                <span>${escapeHtml(state.uiLang === "en" ? section.enLabel : section.zhLabel)}</span>
                <em>${section.filled}/${section.total}</em>
                <div class="coverage-track"><div class="coverage-fill" style="width:${section.percent}%"></div></div>
              </div>`
            )
            .join("")}
        </div>
      </section>`
    : "";

  const missing = coverage ? coverage.missing : [];
  const missingSection = coverage
    ? `
      <section class="sidebar-section">
        <p class="side-kicker"><span>${escapeHtml(t("missingTitle"))}</span><span>${missing.length}</span></p>
        ${
          missing.length
            ? `<div class="missing-list">${missing
                .slice(0, 8)
                .map(
                  (item) =>
                    `<span class="missing-chip">${escapeHtml(state.uiLang === "en" ? item.enLabel : item.zhLabel)}</span>`
                )
                .join("")}</div>`
            : `<p class="side-copy">${escapeHtml(t("missingNone"))}</p>`
        }
      </section>`
    : "";

  const disabled = !hasUserMessage() || state.busy || state.generating;
  el.sidebarBody.innerHTML = `
    ${standardSection}
    ${progressSection}
    ${coverageSection}
    ${missingSection}
    <section class="sidebar-section">
      <button class="primary-button side-generate" type="button" data-action="generate" ${disabled ? "disabled" : ""}>
        ${escapeHtml(state.generating ? t("generating") : t("sideGenerate"))}
      </button>
      <p class="side-hint">${escapeHtml(hasUserMessage() ? t("sideGenerateHint") : t("sideIntroHint"))}</p>
    </section>
  `;
  syncControls();
}

function syncControls() {
  const busy = state.busy || state.starting;
  const blocked = state.edgeAiExhausted && !state.provider;
  const disabled = busy || !hasUserMessage() || blocked;
  if (el.sendButton) el.sendButton.disabled = state.busy || blocked;
  if (el.generateButton) {
    el.generateButton.disabled = disabled || state.generating;
    el.generateButton.textContent = state.generating ? t("generating") : t("generate");
  }
  const sideGenerate = el.sidebarBody && el.sidebarBody.querySelector('[data-action="generate"]');
  if (sideGenerate) {
    sideGenerate.disabled = disabled || state.generating;
    sideGenerate.textContent = state.generating ? t("generating") : t("sideGenerate");
  }
  if (el.downloadAllButton) {
    el.downloadAllButton.disabled = state.generating;
    el.downloadAllButton.textContent = state.generating ? t("downloading") : t("downloadAll");
  }
  document.querySelectorAll(".quick-chip").forEach((chip) => {
    chip.disabled = busy;
  });
}

function addMessage(role, content, { error = false, store = true } = {}) {
  const row = document.createElement("div");
  row.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? t("you") : t("assistant");
  avatar.setAttribute("aria-hidden", "true");

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (error) bubble.classList.add("error");
  bubble.textContent = content;

  row.append(avatar, bubble);
  el.messageList.append(row);
  if (store) state.messages.push({ role, content });
  scrollChatToBottom();
  return row;
}

function scrollChatToBottom() {
  if (!el.chatScroll) return;
  requestAnimationFrame(() => {
    el.chatScroll.scrollTop = el.chatScroll.scrollHeight;
  });
}

function showTyping() {
  hideTyping();
  const row = document.createElement("div");
  row.className = "message assistant";
  row.innerHTML = `
    <div class="message-avatar" aria-hidden="true">${escapeHtml(t("assistant"))}</div>
    <div class="bubble typing" aria-label="${escapeHtml(t("typing"))}"><span></span><span></span><span></span></div>
  `;
  el.messageList.append(row);
  typingElement = row;
  scrollChatToBottom();
}

function hideTyping() {
  if (typingElement && typingElement.parentNode) typingElement.parentNode.removeChild(typingElement);
  typingElement = null;
}

function renderChatContext() {
  if (!el.chatContext || !state.lang) return;
  const standardChip = state.standard
    ? `<span class="context-chip">${escapeHtml(state.standard.primary.code)}</span>`
    : `<span class="context-chip">${escapeHtml(t("contextChip"))}</span>`;
  const project = state.profile && state.profile.projectName ? state.profile.projectName : t("contextTitle");
  const coverageText = state.coverage
    ? `${escapeHtml(t("coverage"))} ${state.coverage.filled}/${state.coverage.total} · ${state.coverage.percent}%`
    : escapeHtml(t("contextSub"));
  el.chatContext.innerHTML = `
    <p class="context-title">${escapeHtml(project)} ${standardChip}</p>
    <p class="context-sub">${coverageText}</p>
  `;
}

function makeChip(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `quick-chip ${className || ""}`.trim();
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderQuickReplies(replies = [], { includeSamples = !hasUserMessage() } = {}) {
  if (!el.quickReplies) return;
  el.quickReplies.innerHTML = "";
  if (state.busy || state.generating) return;

  if (includeSamples && (state.lang === "zh" || state.lang === "en")) {
    const samples = I18N[state.uiLang].samples;
    for (const sample of samples) {
      const chip = makeChip(sample, "sample-chip", () => {
        el.composerInput.value = sample;
        resizeComposer();
        el.composerInput.focus();
      });
      el.quickReplies.append(chip);
    }
  }

  for (const reply of replies || []) {
    if (!reply) continue;
    if (reply.action === "generate") {
      const chip = makeChip(t("generateChip"), "accent", () => runGenerate());
      el.quickReplies.append(chip);
      continue;
    }
    if (!reply.value) continue;
    const chip = makeChip(reply.label || reply.value, "", () => sendMessage(reply.value));
    el.quickReplies.append(chip);
  }
}

function resizeComposer() {
  if (!el.composerInput) return;
  el.composerInput.style.height = "auto";
  el.composerInput.style.height = `${Math.min(el.composerInput.scrollHeight, 160)}px`;
}

async function startConversation(lang, label) {
  if (state.starting) return;
  state.pendingLanguage = { lang, label };
  if (!ensureProviderReady()) return;
  if (!state.provider && !state.demo && !state.edgeAiAvailable) {
    openProviderModal("start");
    return;
  }
  state.pendingLanguage = null;
  state.starting = true;
  state.lang = lang;
  state.languageLabel = label || (lang === "zh" ? "中文" : lang === "en" ? "English" : "Other");
  state.messages = [];
  state.profile = {};
  state.pending = [];
  state.standard = null;
  state.coverage = null;
  state.ready = false;
  state.materials = null;
  state.meta = null;
  state.activeMaterial = 0;
  state.quickReplies = [];
  state.warnings = [];
  el.messageList.innerHTML = "";
  applyLanguageChrome(lang, state.languageLabel);
  renderChatContext();
  showView("chat");
  renderSidebar();
  renderQuickReplies([]);
  setBusy(true);
  showTyping();

  try {
    const data = await api("/api/chat", {
      lang,
      languageLabel: state.languageLabel,
      messages: [],
      profile: {},
      pending: [],
      provider: state.provider,
      demo: state.demo
    }, "POST", { timeoutMs: 20000 });
    applyProviderResult(data);
    state.mode = data.mode || (state.provider ? "ai" : state.mode);
    if (data.languageLabel) {
      state.languageLabel = data.languageLabel;
      applyLanguageChrome(lang, data.languageLabel);
    }
    updateStatus();
    hideTyping();
    addMessage("assistant", data.assistant || I18N[state.uiLang].introFallback);
    state.phase = data.phase || "intro";
  } catch (error) {
    hideTyping();
    state.mode = "rules";
    updateStatus();
    addMessage("assistant", I18N[state.uiLang].introFallback, { store: false });
    showToast(`${t("errorPrefix")}${error.message}. ${t("startError")}`);
  } finally {
    state.starting = false;
    setBusy(false);
    renderQuickReplies([]);
    renderChatContext();
    renderSidebar();
    if (el.composerInput) el.composerInput.focus();
  }
}

function setBusy(busy) {
  state.busy = busy;
  syncControls();
}

function requestTargetLabel() {
  if (state.demo) return t("providerDemoName");
  const info = state.providerInfo;
  if (info && info.name) return info.model ? `${info.name} · ${info.model}` : info.name;
  if (state.provider && state.provider.id) {
    return state.provider.model ? `${state.provider.id} · ${state.provider.model}` : state.provider.id;
  }
  return t("providerModelLabel");
}

function updateRequestStatus() {
  if (!activeRequest || !el.requestStatusText) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - activeRequest.startedAt) / 1000));
  el.requestStatusText.textContent = t(
    activeRequest.kind === "generate" ? "requestGenerating" : "requestWaiting",
    { target: requestTargetLabel(), elapsed }
  );
}

function beginRequest(kind, timeoutMs) {
  if (activeRequest) cancelActiveRequest();
  const controller = new AbortController();
  activeRequest = {
    kind,
    controller,
    startedAt: Date.now(),
    timedOut: false,
    cancelled: false,
    timer: null,
    ticker: null
  };
  activeRequest.timer = setTimeout(() => {
    if (activeRequest && activeRequest.controller === controller) {
      activeRequest.timedOut = true;
      controller.abort();
    }
  }, timeoutMs);
  activeRequest.ticker = setInterval(updateRequestStatus, 500);
  if (el.requestCancel) el.requestCancel.textContent = t("requestCancel");
  if (el.requestBanner) el.requestBanner.hidden = false;
  updateRequestStatus();
  return controller.signal;
}

function finishRequest() {
  if (activeRequest) {
    if (activeRequest.timer) clearTimeout(activeRequest.timer);
    if (activeRequest.ticker) clearInterval(activeRequest.ticker);
  }
  activeRequest = null;
  if (el.requestBanner) el.requestBanner.hidden = true;
  if (el.requestStatusText) el.requestStatusText.textContent = "";
}

function cancelActiveRequest() {
  if (!activeRequest) return;
  activeRequest.cancelled = true;
  activeRequest.controller.abort();
}

function requestWasAborted(error) {
  return Boolean(error && (error.name === "AbortError" || error.code === "aborted"));
}

function providerErrorText(error) {
  if (isEdgeAiQuotaError(error)) return t("edgeAiQuotaError");
  const parts = [`${t("errorPrefix")}${(error && error.message) || t("toastError")}`];
  if (error && error.code === "empty_response") parts.push(t("emptyResponseHint"));
  else if (error && error.code === "timeout") parts.push(t("requestTimeout"));
  else parts.push(t("retryHint"));
  return parts.join(" ");
}

function needsProviderSettings(error) {
  return Boolean(
    error &&
      [
        "auth_error",
        "invalid_api_key",
        "missing_api_key",
        "missing_provider",
        "unknown_provider",
        "invalid_model",
        "missing_model",
        "empty_response",
        "edge_ai_quota_exhausted"
      ].includes(error.code)
  );
}

function addProviderError(error) {
  const row = addMessage("assistant", providerErrorText(error), { error: true, store: false });
  const bubble = row.querySelector(".bubble");
  if (!bubble) return row;
  const details = error && error.details;
  if (details && (details.finishReason || details.reasoningTokens)) {
    const meta = document.createElement("span");
    meta.className = "error-meta";
    meta.textContent = t("providerErrorMeta", {
      model: details.model || "—",
      reason: details.finishReason || "unknown",
      reasoning: details.reasoningTokens || 0,
      completion: details.completionTokens || 0
    });
    bubble.append(meta);
  }
  if (needsProviderSettings(error)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-action";
    button.textContent = t("providerSettings");
    button.addEventListener("click", () =>
      openProviderModal(error.code === "edge_ai_quota_exhausted" ? "quota" : "settings")
    );
    bubble.append(button);
  }
  return row;
}

async function sendMessage(text) {
  const content = String(text || "").trim();
  if (!content || !state.lang || state.busy || state.starting || state.generating) return;
  if (!ensureProviderReady()) return;
  if (state.view !== "chat") showView("chat");

  el.quickReplies.innerHTML = "";
  addMessage("user", content);
  el.composerInput.value = "";
  resizeComposer();
  setBusy(true);
  showTyping();
  const signal = beginRequest("chat", 65000);

  try {
    const data = await api("/api/chat", {
      lang: state.lang,
      languageLabel: state.languageLabel,
      messages: state.messages,
      profile: state.profile,
      pending: state.pending,
      standardId: state.standard ? state.standard.id : undefined,
      standard: state.standard
        ? {
            primary: state.standard.primary,
            national: state.standard.national,
            rationale: state.standard.rationale
          }
        : undefined,
      productType: state.productType,
      provider: state.provider,
      demo: state.demo
    }, "POST", { signal });
    hideTyping();
    applyProviderResult(data);
    state.mode = data.mode || state.mode;
    state.profile = data.profile || state.profile;
    state.pending = data.pending || [];
    state.standard = data.standard || state.standard;
    state.coverage = data.coverage || state.coverage;
    state.productType = data.productType || state.productType;
    state.ready = Boolean(data.ready);
    state.phase = data.phase || state.phase;
    state.quickReplies = data.quickReplies || [];
    state.warnings = data.warnings || [];
    if (data.languageLabel && data.languageLabel !== state.languageLabel) {
      state.languageLabel = data.languageLabel;
      applyLanguageChrome(state.lang, data.languageLabel);
    }
    addMessage("assistant", data.assistant || "");
    updateStatus();
    renderChatContext();
    renderQuickReplies(state.quickReplies);
    renderSidebar();
    if (state.ready) showToast(t("readyToast"));
  } catch (error) {
    hideTyping();
    const timedOut = Boolean(activeRequest && activeRequest.timedOut);
    if (requestWasAborted(error)) {
      const message = timedOut ? t("requestTimeout") : t("requestCancelled");
      addMessage("assistant", message, { error: timedOut, store: false });
      showToast(message);
    } else if (isEdgeAiQuotaError(error)) {
      addProviderError(error);
      handleEdgeAiQuota();
    } else {
      addProviderError(error);
      showToast(t("toastError"));
    }
  } finally {
    finishRequest();
    setBusy(false);
    renderQuickReplies(state.quickReplies);
    if (el.composerInput) el.composerInput.focus();
  }
}

async function runGenerate() {
  if (!state.lang || state.busy || state.generating) return;
  if (!hasUserMessage()) {
    showToast(t("toastNeedIntro"));
    return;
  }
  if (!ensureProviderReady()) return;

  state.generating = true;
  syncControls();
  showToast(t("toastGenerating"), { sticky: true });
  const signal = beginRequest("generate", 150000);

  try {
    const data = await api("/api/generate", {
      lang: state.lang,
      languageLabel: state.languageLabel,
      messages: state.messages,
      profile: state.profile,
      standardId: state.standard ? state.standard.id : undefined,
      productType: state.productType,
      provider: state.provider,
      demo: state.demo
    }, "POST", { signal });
    state.materials = data.materials || [];
    state.meta = data.meta || null;
    state.standard = data.standard || state.standard;
    state.coverage = (data.meta && data.meta.coverage) || state.coverage;
    state.activeMaterial = 0;
    applyProviderResult(data);
    state.mode = data.mode || state.mode;
    state.warnings = (data.meta && data.meta.warnings) || data.warnings || [];
    updateStatus();
    renderSidebar();
    renderMaterials();
    showView("materials");
    const percent = state.coverage ? state.coverage.percent : 0;
    if (state.warnings.length) {
      showToast(t("toastWarnings"));
    } else if (percent < 100) {
      showToast(t("toastIncomplete"));
    } else {
      showToast(t("toastGenerated", { count: state.materials.length }));
    }
  } catch (error) {
    hideToast();
    const timedOut = Boolean(activeRequest && activeRequest.timedOut);
    if (requestWasAborted(error)) {
      showToast(timedOut ? t("requestTimeout") : t("requestCancelled"));
    } else if (isEdgeAiQuotaError(error)) {
      addProviderError(error);
      showView("chat");
      handleEdgeAiQuota();
    } else {
      addProviderError(error);
      showView("chat");
      showToast(t("toastError"));
    }
  } finally {
    finishRequest();
    state.generating = false;
    syncControls();
    renderQuickReplies(state.quickReplies);
  }
}

function renderMaterials() {
  if (!state.materials || !state.materials.length) {
    showToast(t("noMaterials"));
    return;
  }
  const meta = state.meta || {};
  const standardCode =
    meta.standardCode || (state.standard && state.standard.primary && state.standard.primary.code) || "ISO / GB";
  const coverage = meta.coverage || state.coverage;
  const percent = coverage ? coverage.percent : 0;
  const project = meta.projectName || (state.profile && state.profile.projectName) || t("materialsTitle");

  if (el.materialsEyebrow) el.materialsEyebrow.textContent = t("materialsEyebrow");
  if (el.materialsTitle) el.materialsTitle.textContent = t("materialsTitle");
  if (el.materialsSubtitle) {
    el.materialsSubtitle.textContent = t("materialsSubtitle", {
      project,
      standard: standardCode,
      date: formatDate(meta.generatedAt),
      pct: percent
    });
  }
  if (el.docList) {
    el.docList.setAttribute("aria-label", t("docListAria"));
    el.docList.innerHTML = state.materials
      .map(
        (material, index) => `
        <button class="doc-item ${index === state.activeMaterial ? "active" : ""}" type="button" data-index="${index}">
          <span class="doc-index">${String(index).padStart(2, "0")}</span>
          <span class="doc-title">${escapeHtml(material.title)}</span>
          <span class="doc-desc">${escapeHtml(material.description || "")}</span>
        </button>`
      )
      .join("");
  }
  selectMaterial(state.activeMaterial);
}

function selectMaterial(index) {
  if (!state.materials || !state.materials[index]) return;
  state.activeMaterial = index;
  const material = state.materials[index];
  if (el.docList) {
    el.docList.querySelectorAll(".doc-item").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.index) === index);
    });
  }
  if (el.previewFilename) el.previewFilename.textContent = material.filename;
  if (el.preview) el.preview.innerHTML = renderMarkdown(material.markdown || "");
  const scroller = el.preview && el.preview.closest(".preview-scroll");
  if (scroller) scroller.scrollTop = 0;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function activeMaterial() {
  return state.materials && state.materials[state.activeMaterial];
}

function downloadMarkdown() {
  const material = activeMaterial();
  if (!material) return;
  const blob = new Blob([material.markdown || ""], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, material.filename);
}

function markdownToWordHtml(markdown, title) {
  const body = renderMarkdown(markdown || "");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title || "Funding material")}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.65; }
  h1 { font-size: 22pt; font-weight: 600; border-bottom: 1px solid #ccc; padding-bottom: 8pt; }
  h2 { font-size: 15pt; margin-top: 22pt; }
  h3 { font-size: 12.5pt; margin-top: 16pt; }
  p { margin: 0 0 8pt; }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0 14pt; font-size: 9pt; }
  th, td { border: 1px solid #bbb; padding: 5pt 6pt; vertical-align: top; text-align: left; }
  th { background: #f2f2f2; }
  blockquote { margin: 10pt 0; padding: 8pt 10pt; border-left: 2px solid #999; background: #f7f7f7; color: #444; }
  code { font-family: Consolas, monospace; background: #f3f3f3; padding: 1pt 3pt; }
  .table-wrap { overflow: visible; }
  a { color: #1a4f8b; }
  li { margin: 3pt 0; }
</style>
</head>
<body>${body}</body>
</html>`;
}

function downloadWord() {
  const material = activeMaterial();
  if (!material) return;
  const html = markdownToWordHtml(material.markdown, material.title);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  downloadBlob(blob, material.filename.replace(/\.md$/i, ".doc"));
}

async function copyMarkdown() {
  const material = activeMaterial();
  if (!material) return;
  try {
    await navigator.clipboard.writeText(material.markdown || "");
    showToast(t("copied"));
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = material.markdown || "";
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    showToast(ok ? t("copied") : t("copyFail"));
  }
}

async function downloadAll() {
  if (!state.materials || !state.materials.length || state.generating) return;
  state.generating = true;
  syncControls();
  showToast(t("toastGenerating"), { sticky: true });
  try {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang: state.lang,
        meta: state.meta || {},
        materials: state.materials.map((material) => ({
          filename: material.filename,
          markdown: material.markdown
        }))
      })
    });
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        if (data && data.error) message = data.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    downloadBlob(blob, `funding-pack-${new Date().toISOString().slice(0, 10)}.zip`);
    showToast(t("toastZipReady"));
  } catch (error) {
    hideToast();
    showToast(`${t("toastZipError")} ${error.message}`);
  } finally {
    state.generating = false;
    syncControls();
  }
}

function printCurrent() {
  if (!activeMaterial()) return;
  window.print();
}

function providerById(id) {
  return state.providers.find((provider) => provider.id === id) || null;
}

async function loadProviders() {
  if (state.providersLoaded || state.providersLoading) return;
  state.providersLoading = true;
  try {
    const data = await api("/api/providers", undefined, "GET");
    state.providers = Array.isArray(data.providers) ? data.providers : [];
    state.demoEnabled = data.demoEnabled !== false;
    if (data.edgeAi) {
      state.edgeAiAvailable = data.edgeAi.available !== false;
      if (data.edgeAi.docsUrl) state.edgeAiDocsUrl = data.edgeAi.docsUrl;
    }
    updateEdgeAiNotice();
    state.providersLoaded = true;
  } catch (error) {
    if (el.providerStatus) setProviderStatus(t("providerLoadError"), "error");
    throw error;
  } finally {
    state.providersLoading = false;
  }
}

function populateProviderSelect(selectedId) {
  if (!el.providerSelect) return;
  const current = selectedId || el.providerSelect.value;
  el.providerSelect.innerHTML = state.providers
    .map(
      (provider) =>
        `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.name)}</option>`
    )
    .join("");
  if (current && providerById(current)) el.providerSelect.value = current;
}

function syncProviderFields({ resetModel = false } = {}) {
  const def = providerById(el.providerSelect && el.providerSelect.value);
  if (!def) return;
  if (resetModel || !el.providerModel.value) {
    el.providerModel.value = def.defaultModel || "";
  }
  if (el.providerModels) {
    el.providerModels.innerHTML = (def.models || [])
      .map((model) => `<option value="${escapeHtml(model)}"></option>`)
      .join("");
  }
  if (el.providerBaseUrlField) el.providerBaseUrlField.hidden = !def.requiresBaseUrl;
  if (el.providerDocs) {
    if (def.docsUrl) {
      el.providerDocs.href = def.docsUrl;
      el.providerDocs.textContent = t("providerDocs");
      el.providerDocs.hidden = false;
    } else {
      el.providerDocs.hidden = true;
      el.providerDocs.removeAttribute("href");
    }
  }
  if (el.providerKey) {
    const usesSaved = state.provider && !state.demo && state.provider.id === def.id;
    el.providerKey.placeholder = usesSaved ? t("providerKeySaved") : t("providerKeyPlaceholder");
  }
}

function setProviderStatus(message, kind) {
  if (!el.providerStatus) return;
  el.providerStatus.textContent = message || "";
  el.providerStatus.className = `provider-status${kind ? ` ${kind}` : ""}`;
}

function applyProviderModalCopy() {
  const quota = state.providerModalMode === "quota";
  const settings = state.providerModalMode === "settings";
  if (el.providerTitle) {
    el.providerTitle.textContent = quota
      ? t("edgeAiQuotaTitle")
      : settings
        ? t("providerTitleSettings")
        : t("providerTitleStart");
  }
  if (el.providerIntro) {
    el.providerIntro.textContent = quota
      ? t("edgeAiQuotaIntro")
      : settings
        ? t("providerIntroSettings")
        : t("providerIntroStart");
  }
  if (el.providerLabel) el.providerLabel.textContent = t("providerLabel");
  if (el.providerModelLabel) el.providerModelLabel.textContent = t("providerModelLabel");
  if (el.providerBaseUrlLabel) el.providerBaseUrlLabel.textContent = t("providerBaseUrlLabel");
  if (el.providerKeyLabel) el.providerKeyLabel.textContent = t("providerKeyLabel");
  if (el.providerPrivacy) el.providerPrivacy.textContent = t("providerPrivacy");
  if (el.providerTest) el.providerTest.textContent = t("providerTest");
  if (el.providerDemo) {
    el.providerDemo.textContent = t("providerDemo");
    el.providerDemo.hidden = !state.demoEnabled || quota;
  }
  if (el.providerSubmit) {
    el.providerSubmit.textContent = quota || settings ? t("providerSave") : t("providerStart");
  }
  setProviderStatus("", "");
}

async function openProviderModal(mode = "start") {
  state.providerModalMode = mode === "settings" || mode === "quota" ? mode : "start";
  applyProviderModalCopy();
  if (el.providerModal) el.providerModal.hidden = false;
  document.body.classList.add("modal-open");
  if (el.providerKey) el.providerKey.value = "";
  if (el.providerModel) el.providerModel.value = "";
  if (el.providerBaseUrl) el.providerBaseUrl.value = "";
  try {
    await loadProviders();
    const existing = state.provider && !state.demo ? state.provider : null;
    populateProviderSelect(existing ? existing.id : state.providers[0] && state.providers[0].id);
    if (existing) {
      if (el.providerModel) el.providerModel.value = existing.model || "";
      if (el.providerBaseUrl) el.providerBaseUrl.value = existing.baseUrl || "";
    }
    syncProviderFields({ resetModel: !existing });
    if (el.providerKey) el.providerKey.focus();
  } catch {
    setProviderStatus(t("providerLoadError"), "error");
  }
}

function closeProviderModal() {
  if (el.providerModal) el.providerModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function providerFormConfig() {
  const def = providerById(el.providerSelect && el.providerSelect.value);
  if (!def) throw new Error(t("providerLoadError"));
  const model = String(el.providerModel && el.providerModel.value ? el.providerModel.value : "").trim();
  if (!model) throw new Error(t("providerMissingModel"));
  const typedKey = String(el.providerKey && el.providerKey.value ? el.providerKey.value : "").trim();
  const savedKey =
    state.provider && !state.demo && state.provider.id === def.id ? state.provider.apiKey : "";
  const apiKey = typedKey || savedKey;
  if (!apiKey) throw new Error(t("providerMissingKey"));
  const baseUrl = def.requiresBaseUrl
    ? String(el.providerBaseUrl && el.providerBaseUrl.value ? el.providerBaseUrl.value : "").trim()
    : "";
  if (def.requiresBaseUrl && !baseUrl) throw new Error(t("providerMissingBaseUrl"));
  return { id: def.id, model, apiKey, baseUrl, name: def.name };
}

async function testProviderConnection() {
  if (!el.providerTest) return;
  el.providerTest.disabled = true;
  setProviderStatus(t("providerTesting"), "pending");
  try {
    const config = providerFormConfig();
    const data = await api("/api/provider/test", { provider: config }, "POST", { timeoutMs: 25000 });
    setProviderStatus(
      t("providerOk", {
        provider: (data.provider && data.provider.name) || config.name,
        model: (data.provider && data.provider.model) || config.model
      }),
      "success"
    );
  } catch (error) {
    setProviderStatus(error.code === "timeout" ? t("requestTimeout") : error.message, "error");
  } finally {
    el.providerTest.disabled = false;
    if (el.providerTest) el.providerTest.textContent = t("providerTest");
  }
}

function saveProviderAndStart(config, def) {
  state.provider = {
    id: config.id,
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || ""
  };
  state.demo = false;
  state.providerInfo = { name: def.name, model: config.model };
  state.mode = "ai";
  state.edgeAiExhausted = false;
  persistEdgeAiQuotaExhausted(false);
  const shouldStart =
    Boolean(state.pendingLanguage) &&
    (state.providerModalMode === "start" || state.providerModalMode === "quota");
  closeProviderModal();
  updateStatus();
  updateEdgeAiNotice();
  syncControls();
  if (shouldStart) {
    const pending = state.pendingLanguage;
    state.pendingLanguage = null;
    startConversation(pending.lang, pending.label);
  } else {
    showToast(t("providerSavedToast"));
  }
}

async function submitProviderForm(event) {
  event.preventDefault();
  try {
    const config = providerFormConfig();
    const def = providerById(config.id);
    saveProviderAndStart(config, def);
  } catch (error) {
    setProviderStatus(error.message, "error");
  }
}

function chooseDemoMode() {
  if (state.edgeAiExhausted || state.providerModalMode === "quota") {
    setProviderStatus(t("edgeAiQuotaError"), "error");
    return;
  }
  if (!state.demoEnabled) {
    setProviderStatus(t("providerDisabledDemo"), "error");
    return;
  }
  const target =
    state.providerModalMode === "start"
      ? state.pendingLanguage
      : { lang: state.lang, label: state.languageLabel };
  if (target && target.lang !== "zh" && target.lang !== "en") {
    setProviderStatus(t("providerDemoLang"), "error");
    return;
  }
  state.provider = null;
  state.demo = true;
  state.providerInfo = { name: t("providerDemoName"), model: t("providerDemoModel") };
  state.mode = "rules";
  closeProviderModal();
  updateStatus();
  updateEdgeAiNotice();
  syncControls();
  if (state.providerModalMode === "start" && state.pendingLanguage) {
    const pending = state.pendingLanguage;
    state.pendingLanguage = null;
    startConversation(pending.lang, pending.label);
  } else {
    showToast(t("providerDemoToast"));
  }
}

function chooseLanguage(lang) {
  const labels = { zh: "中文", en: "English" };
  startConversation(lang, labels[lang] || lang);
}

function chooseOtherLanguage() {
  const label = String(el.otherLanguageInput && el.otherLanguageInput.value ? el.otherLanguageInput.value : "")
    .replace(/\s+/g, " ")
    .trim();
  if (!label) {
    showToast(t("otherLanguageMissing"));
    if (el.otherLanguageInput) el.otherLanguageInput.focus();
    return;
  }
  startConversation("other", label);
}

function resetApp() {
  if (!state.lang) return;
  if (hasUserMessage() && !window.confirm(t("restartConfirm"))) return;
  state.messages = [];
  state.profile = {};
  state.pending = [];
  state.standard = null;
  state.coverage = null;
  state.productType = "";
  state.ready = false;
  state.phase = "start";
  state.quickReplies = [];
  state.materials = null;
  state.meta = null;
  state.activeMaterial = 0;
  state.busy = false;
  state.starting = false;
  state.generating = false;
  state.warnings = [];
  state.pendingLanguage = null;
  hideTyping();
  if (el.messageList) el.messageList.innerHTML = "";
  if (el.quickReplies) el.quickReplies.innerHTML = "";
  if (el.composerInput) {
    el.composerInput.value = "";
    resizeComposer();
  }
  setInitialChrome();
  showView("start");
  renderSidebar();
  if (el.chatScroll) el.chatScroll.scrollTop = 0;
  if (el.startView) el.startView.scrollTop = 0;
}

function handleSidebarClick(event) {
  const button = event.target.closest('[data-action="generate"]');
  if (button) {
    runGenerate();
  }
}

function handleDocListClick(event) {
  const button = event.target.closest(".doc-item");
  if (!button) return;
  selectMaterial(Number(button.dataset.index));
}

function initEvents() {
  document.querySelectorAll(".language-card[data-lang]").forEach((card) => {
    card.addEventListener("click", () => chooseLanguage(card.dataset.lang === "en" ? "en" : "zh"));
  });

  if (el.otherLanguageCard) {
    el.otherLanguageCard.addEventListener("click", () => {
      if (!el.otherLanguagePanel) return;
      el.otherLanguagePanel.hidden = !el.otherLanguagePanel.hidden;
      if (!el.otherLanguagePanel.hidden && el.otherLanguageInput) el.otherLanguageInput.focus();
    });
  }
  if (el.otherLanguageStart) el.otherLanguageStart.addEventListener("click", chooseOtherLanguage);
  if (el.otherLanguageInput) {
    el.otherLanguageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        chooseOtherLanguage();
      }
    });
  }

  if (el.providerSettingsButton) {
    el.providerSettingsButton.addEventListener("click", () => openProviderModal("settings"));
  }
  if (el.edgeAiSetup) {
    el.edgeAiSetup.addEventListener("click", () =>
      openProviderModal(state.edgeAiExhausted ? "quota" : "settings")
    );
  }
  if (el.providerClose) el.providerClose.addEventListener("click", closeProviderModal);
  if (el.providerModal) {
    el.providerModal.addEventListener("click", (event) => {
      if (event.target === el.providerModal) closeProviderModal();
    });
  }
  if (el.providerSelect) {
    el.providerSelect.addEventListener("change", () => syncProviderFields({ resetModel: true }));
  }
  if (el.providerForm) el.providerForm.addEventListener("submit", submitProviderForm);
  if (el.providerTest) el.providerTest.addEventListener("click", testProviderConnection);
  if (el.providerDemo) el.providerDemo.addEventListener("click", chooseDemoMode);
  if (el.requestCancel) el.requestCancel.addEventListener("click", cancelActiveRequest);

  el.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(el.composerInput.value);
  });

  el.composerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendMessage(el.composerInput.value);
    }
  });

  el.composerInput.addEventListener("input", resizeComposer);
  el.generateButton.addEventListener("click", runGenerate);
  el.sidebarBody.addEventListener("click", handleSidebarClick);
  el.restartButton.addEventListener("click", resetApp);
  el.menuButton.addEventListener("click", openSidebar);
  el.sidebarClose.addEventListener("click", closeSidebar);
  el.sidebarOverlay.addEventListener("click", closeSidebar);
  el.backToChat.addEventListener("click", () => {
    showView("chat");
    renderChatContext();
    renderQuickReplies(state.quickReplies);
    scrollChatToBottom();
  });
  el.docList.addEventListener("click", handleDocListClick);
  el.copyButton.addEventListener("click", copyMarkdown);
  el.downloadMdButton.addEventListener("click", downloadMarkdown);
  el.downloadDocButton.addEventListener("click", downloadWord);
  el.downloadAllButton.addEventListener("click", downloadAll);
  el.printButton.addEventListener("click", printCurrent);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (activeRequest) cancelActiveRequest();
      if (el.providerModal && !el.providerModal.hidden) closeProviderModal();
      closeSidebar();
    }
  });
}

function renderInline(text) {
  let value = escapeHtml(text);
  value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  value = value.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return value;
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  let backslash = false;
  for (const char of trimmed) {
    if (backslash) {
      if (char === "|") current += "|";
      else current += `\\${char}`;
      backslash = false;
      continue;
    }
    if (char === "\\") {
      backslash = true;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (backslash) current += "\\";
  cells.push(current.trim());
  return cells;
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((item) => /^:?-{3,}:?$/.test(item.trim()));
}

function isSpecialLine(line) {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^```/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*---+\s*$/.test(line) ||
    /^\s*\|/.test(line) ||
    !line.trim()
  );
}

function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 6);
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote><p>${renderInline(quote.join("\n")).replace(/\n/g, "<br>")}</p></blockquote>`);
      continue;
    }

    if (/^\s*\|/.test(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\s*\|/.test(lines[index])) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      output.push(
        `<div class="table-wrap"><table><thead><tr>${headers
          .map((header) => `<th>${renderInline(header)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${headers
                .map((_, cellIndex) => `<td>${renderInline(row[cellIndex] || "")}</td>`)
                .join("")}</tr>`
          )
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (
        index < lines.length &&
        (ordered ? /^\s*\d+\.\s+/.test(lines[index]) : /^\s*[-*+]\s+/.test(lines[index]))
      ) {
        let item = lines[index].replace(/^\s*(?:[-*+]|\d+\.)\s+/, "");
        let task = false;
        const taskMatch = item.match(/^\[([ xX])\]\s+(.*)$/);
        if (taskMatch) {
          task = true;
          item = taskMatch[2];
        }
        items.push(
          task
            ? `<li class="task"><span class="checkbox" aria-hidden="true"></span>${renderInline(item)}</li>`
            : `<li>${renderInline(item)}</li>`
        );
        index += 1;
      }
      output.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && !isSpecialLine(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return output.join("\n");
}

async function init() {
  initEvents();
  renderSidebar();
  setInitialChrome();
  syncControls();
  renderQuickReplies([]);
  try {
    const response = await fetch("/api/health");
    if (response.ok) {
      const data = await response.json();
      state.demoEnabled = data.demo !== false;
      state.edgeAiAvailable = data.edgeAi !== false;
      if (!state.edgeAiAvailable && state.demoEnabled && !state.provider && !state.edgeAiExhausted) {
        state.demo = true;
        state.mode = "rules";
        state.providerInfo = { name: t("providerDemoName"), model: t("providerDemoModel") };
      }
      updateEdgeAiNotice();
      updateStatus();
    }
  } catch {
    /* offline start screen still works */
  }
  loadProviders().catch(() => {});
}

init();
