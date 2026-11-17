import { selectStandard } from "./standards.js";

export const FIELD_DEFINITIONS = [
  {
    key: "projectName",
    zhLabel: "项目名称",
    enLabel: "Project name",
    zhRef: "商业计划书 §1 项目概览",
    enRef: "Business Plan §1 Overview",
    zhQuestion: "项目或公司叫什么名字？",
    enQuestion: "What is the project or company called?"
  },
  {
    key: "solution",
    zhLabel: "产品与解决方案",
    enLabel: "Product & solution",
    zhRef: "商业计划书 §3 产品与解决方案",
    enRef: "Business Plan §3 Product & solution",
    zhQuestion: "请具体说明产品/解决方案：核心功能是什么，用户如何使用，目前处于什么阶段？",
    enQuestion: "Please describe the product or solution: what are the core features, how do users use it, and what stage is it at?"
  },
  {
    key: "problem",
    zhLabel: "核心痛点",
    enLabel: "Core problem",
    zhRef: "商业计划书 §3 痛点与机会",
    enRef: "Business Plan §3 Problem & opportunity",
    zhQuestion: "项目要解决的核心痛点是什么？谁最痛，现有方案为什么不够好？",
    enQuestion: "What core problem do you solve, who feels it most, and why are existing solutions inadequate?"
  },
  {
    key: "targetMarket",
    zhLabel: "目标市场与客户",
    enLabel: "Target market & customers",
    zhRef: "商业计划书 §2 市场与客户",
    enRef: "Business Plan §2 Market & customers",
    zhQuestion: "目标客户是谁？请描述客户画像、首批落地场景和典型付费方。",
    enQuestion: "Who are the target customers? Describe the customer profile, first deployment scenarios and who pays."
  },
  {
    key: "marketSize",
    zhLabel: "市场规模",
    enLabel: "Market size",
    zhRef: "商业计划书 §2 市场规模",
    enRef: "Business Plan §2 Market size",
    zhQuestion: "目标市场规模有多大？请提供 TAM/SAM/SOM 或可验证的数据来源。",
    enQuestion: "How large is the target market? Please provide TAM/SAM/SOM or verifiable sources."
  },
  {
    key: "businessModel",
    zhLabel: "商业模式",
    enLabel: "Business model",
    zhRef: "商业计划书 §5 商业模式",
    enRef: "Business Plan §5 Business model",
    zhQuestion: "商业模式是什么？如何收费、客单价多少、收入由哪些部分组成？",
    enQuestion: "What is the business model? How do you charge, what is the average contract value, and what are the revenue streams?"
  },
  {
    key: "traction",
    zhLabel: "项目进展",
    enLabel: "Traction",
    zhRef: "商业计划书 §5 进展与验证",
    enRef: "Business Plan §5 Traction & validation",
    zhQuestion: "目前进展如何？请提供用户/客户数、营收、订单、合作、留存或关键验证里程碑。",
    enQuestion: "What traction do you have? Please share users/customers, revenue, orders, partnerships, retention or key validation milestones."
  },
  {
    key: "competition",
    zhLabel: "竞争与壁垒",
    enLabel: "Competition & moat",
    zhRef: "商业计划书 §6 竞争分析",
    enRef: "Business Plan §6 Competitive analysis",
    zhQuestion: "主要竞争对手是谁？你们的差异化、进入壁垒和可持续优势是什么？",
    enQuestion: "Who are the main competitors? What are your differentiation, entry barriers and sustainable advantages?"
  },
  {
    key: "team",
    zhLabel: "核心团队",
    enLabel: "Core team",
    zhRef: "商业计划书 §7 团队",
    enRef: "Business Plan §7 Team",
    zhQuestion: "核心团队背景如何？请介绍创始人及关键成员的履历、能力和分工。",
    enQuestion: "What is the core team's background? Introduce the founders and key members, their experience and responsibilities."
  },
  {
    key: "financials",
    zhLabel: "财务数据与预测",
    enLabel: "Financials & projections",
    zhRef: "财务预测 §1 历史与预测",
    enRef: "Financial Projections §1 Historical & forecast",
    zhQuestion: "请提供近 1–2 年财务数据与未来 3 年预测（收入、成本、毛利、现金流、盈亏平衡点）。没有数据可给区间或当前状态。",
    enQuestion: "Share the last 1–2 years of financials and a 3-year forecast (revenue, costs, gross margin, cash flow, break-even). Ranges or current status are fine."
  },
  {
    key: "fundingAsk",
    zhLabel: "融资需求",
    enLabel: "Funding ask",
    zhRef: "商业计划书 §8 融资需求",
    enRef: "Business Plan §8 Funding ask",
    zhQuestion: "本轮融资计划是什么？请说明金额、出让股权、投前/投后估值和资金用途。",
    enQuestion: "What is the funding plan? Please specify the amount, equity offered, pre/post-money valuation and use of funds."
  },
  {
    key: "roadmap",
    zhLabel: "里程碑规划",
    enLabel: "Roadmap",
    zhRef: "商业计划书 §9 里程碑",
    enRef: "Business Plan §9 Milestones",
    zhQuestion: "未来 12–24 个月的关键里程碑是什么？请给出时间、目标与验证指标。",
    enQuestion: "What are the key milestones for the next 12–24 months? Include timing, targets and validation metrics."
  },
  {
    key: "standardEvidence",
    zhLabel: "标准与质量证据",
    enLabel: "Standards & quality evidence",
    zhRef: "技术尽调 §2 标准符合性",
    enRef: "Technical DD §2 Standards conformity",
    zhQuestion: "产品或服务的质量/合规证据有哪些？请说明测试、认证、指标或体系文件。",
    enQuestion: "What quality/compliance evidence do you have? Describe testing, certifications, metrics or system documents."
  },
  {
    key: "ipCompliance",
    zhLabel: "知识产权与资质",
    enLabel: "IP & licences",
    zhRef: "技术尽调 §4 知识产权与资质",
    enRef: "Technical DD §4 IP & licences",
    zhQuestion: "知识产权和资质情况如何？包括专利、软著、商标、许可证、备案与合规事项。",
    enQuestion: "What is the IP and licensing status? Include patents, software copyrights, trademarks, licences, filings and compliance matters."
  },
  {
    key: "risks",
    zhLabel: "主要风险",
    enLabel: "Key risks",
    zhRef: "风险清单 §1 风险与应对",
    enRef: "Risk Register §1 Risks & mitigation",
    zhQuestion: "项目的主要风险是什么？请说明技术、市场、合规、团队或现金流风险，以及应对措施。",
    enQuestion: "What are the main risks? Cover technology, market, compliance, team or cash-flow risks and your mitigations."
  },
  {
    key: "exitStrategy",
    zhLabel: "退出路径",
    enLabel: "Exit strategy",
    zhRef: "商业计划书 §10 退出路径",
    enRef: "Business Plan §10 Exit strategy",
    zhQuestion: "希望的投资退出方式是什么？例如 IPO、并购、老股转让、回购或后续轮次退出。",
    enQuestion: "What exit path do you envisage? For example IPO, M&A, secondary sale, buyback or later-round exit."
  }
];

export const FIELD_MAP = Object.fromEntries(FIELD_DEFINITIONS.map((field) => [field.key, field]));

const REQUIRED_FIELDS = FIELD_DEFINITIONS.map((field) => field.key);

const QUESTION_PRIORITY = [
  "projectName",
  "solution",
  "problem",
  "standardEvidence",
  "targetMarket",
  "marketSize",
  "businessModel",
  "traction",
  "competition",
  "team",
  "financials",
  "fundingAsk",
  "roadmap",
  "ipCompliance",
  "risks",
  "exitStrategy"
];

const QUESTION_RANK = Object.fromEntries(QUESTION_PRIORITY.map((key, index) => [key, index]));

const DOC_SECTIONS = [
  {
    id: "summary",
    zhLabel: "一页纸摘要",
    enLabel: "One-pager",
    fields: ["projectName", "problem", "solution", "traction", "fundingAsk"]
  },
  {
    id: "business-plan",
    zhLabel: "商业计划书",
    enLabel: "Business plan",
    fields: [
      "projectName",
      "problem",
      "solution",
      "targetMarket",
      "marketSize",
      "businessModel",
      "traction",
      "competition",
      "team",
      "financials",
      "fundingAsk",
      "roadmap",
      "exitStrategy"
    ]
  },
  {
    id: "market",
    zhLabel: "市场与竞争",
    enLabel: "Market & competition",
    fields: ["targetMarket", "marketSize", "competition"]
  },
  {
    id: "financial",
    zhLabel: "财务与融资",
    enLabel: "Financials & funding",
    fields: ["businessModel", "financials", "fundingAsk"]
  },
  {
    id: "technical",
    zhLabel: "技术与标准尽调",
    enLabel: "Technical & standards DD",
    fields: ["standardEvidence", "ipCompliance", "roadmap"]
  },
  {
    id: "risk",
    zhLabel: "风险清单",
    enLabel: "Risk register",
    fields: ["risks"]
  },
  {
    id: "data-room",
    zhLabel: "数据室清单",
    enLabel: "Data room checklist",
    fields: ["financials", "ipCompliance", "team"]
  }
];

const SKIP_PATTERN =
  /^(?:\s*)(?:暂无|没有|无|不清楚|不知道|待定|先跳过|跳过|暂缺|未提供|not available|none|n\/?a|no|not sure|skip|tbd|unknown|pending)(?:[\s。.!！,，;；].*)?$/i;

const NA_VALUE = {
  zh: "暂无（用户暂未提供，建议生成后补充）",
  en: "Not available (not provided by the user; recommended to add after generation)"
};

const DETECTORS = [
  { key: "marketSize", re: /(市场规模|市场空间|行业规模|TAM|SAM|SOM|market size|addressable market)/i },
  { key: "fundingAsk", re: /(融资|轮次|天使轮|种子轮|pre-?a|a\+?轮|b轮|raise|funding|investment|investor|equity)/i, needsNumber: true },
  { key: "financials", re: /(营收|收入|毛利|净利|利润|成本|现金流|盈亏平衡|客单价|ARR|MRR|revenue|gross margin|profit|cost|cash flow|break-even|burn rate)/i },
  {
    key: "team",
    re: /(核心团队|团队|创始人|联合创始人|\b(?:CEO|CTO|COO|CFO)\b|合伙人|核心成员|\b(?:team|founder|co-founder|cofounder)\b)/i
  },
  {
    key: "traction",
    re: /(用户|客户|付费|订单|合同|签约|复购|留存|月活|日活|下载量|门店|增长率|ARR|MRR|GMV|DAU|MAU|customers?|users?|paying|contracts?|orders?|retention|growth rate|downloads|stores)/i
  },
  {
    key: "competition",
    re: /(竞争|对手|壁垒|差异化|护城河|替代方案|competitor|competition|moat|differentiat|barrier)/i
  },
  {
    key: "businessModel",
    re: /(商业模式|收费|订阅|佣金|抽成|广告|授权费|变现|盈利模式|subscription|business model|pricing model|commission|monetiz|revenue model|licen[cs]e fee)/i
  },
  {
    key: "roadmap",
    re: /(里程碑|路线图|roadmap|milestone|未来\s*\d|未来.{0,8}(计划|目标|规划)|next\s+\d+\s+(months|quarters)|12[- ]month plan)/i
  },
  {
    key: "standardEvidence",
    re: /(质量体系|质量管理体系|质量模型|性能测试|压力测试|安全测试|可靠性|可用性|SLA|模型评估|数据合规|注册证|临床评价|HACCP|环评|排污许可|能效|等保测评|ISO\/IEC 25000|ISO\/IEC 25010|ISO\/IEC 42001|ISO 13485|ISO 9001|ISO\/IEC 27001|GB\/T 25000|quality management|load test|performance test|security test|model evaluation|clinical evaluation|HACCP|environmental impact|energy efficiency|MLPS)/i
  },
  {
    key: "ipCompliance",
    re: /(专利|软著|软件著作权|商标|知识产权|认证|资质|许可证|牌照|备案|合规|等保|patent|intellectual property|copyright|trademark|certif|licen[cs]e|filing|compliance)/i
  },
  {
    key: "risks",
    re: /(风险|挑战|不确定|风险点|依赖|risk|challenge|uncertain|dependence)/i
  },
  {
    key: "exitStrategy",
    re: /(退出|上市|IPO|并购|回购|股权转让|老股转让|exit|acquisition|M&A|buyback|secondary sale)/i
  },
  {
    key: "targetMarket",
    re: /(目标市场|目标客户|目标用户|客户画像|客户群体|面向|服务于|应用场景|行业客户|target (market|customer)|customer segment|ideal customer|customer profile)/i
  },
  {
    key: "problem",
    re: /(痛点|难题|低效|成本高|效率低|困扰|尚未解决|问题在于|痛点明显|pain point|problem|inefficien|expensive|fragmented|underserved)/i
  },
  {
    key: "solution",
    re: /(解决方案|产品|平台|系统|应用|软件|服务|提供|帮助|打造|研发|我们做|我们开发|saas|paas|iaas|小程序|solution|product|platform|app|software|service|provide|offer|build|develop|we build|we provide|we offer)/i
  }
];

const PROJECT_NAME_PATTERNS = [
  /(?:项目|公司|产品|平台)(?:名称|名字)?(?:叫做|叫|是|为|：|:)\s*[“"'「『]?([^，。；;！!？?\n“”"'」』]{2,40})/,
  /(?:我们|我)(?:的)?(?:项目|公司|产品|平台)(?:叫做|叫|是|名为|名称为)\s*[“"'「『]?([^，。；;！!？?\n“”"'」』]{2,40})/,
  /(?:project|company|product|platform)(?:\s+name)?\s*(?:is|called|named|:)\s*([^,.;!?\n]{2,60})/i
];

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
}

export function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return {};
  const result = {};
  for (const key of [...REQUIRED_FIELDS, "oneLiner"]) {
    const value = cleanText(profile[key]);
    if (value) result[key] = value.slice(0, 4000);
  }
  return result;
}

export function mergeProfiles(base, update, { overwrite = false } = {}) {
  const result = { ...base };
  if (!update || typeof update !== "object") return result;
  for (const key of [...REQUIRED_FIELDS, "oneLiner"]) {
    const value = cleanText(update[key]);
    if (!value) continue;
    if (overwrite || !result[key]) result[key] = value.slice(0, 4000);
  }
  return result;
}

export function isFilled(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function splitSentences(text) {
  return text
    .split(/(?<=[。！？!?；;，,])|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function firstStrongSentence(text) {
  const match = String(text || "").match(/^[^。！？!?\n]+[。！？!?]?/);
  return (match ? match[0] : String(text || "")).trim();
}

function extractSegment(text, detector) {
  const sentences = splitSentences(text);
  const matched = [];
  for (const sentence of sentences) {
    if (!detector.re.test(sentence)) continue;
    if (detector.needsNumber && !/(\d|一百|两百|三百|五百|一千|一万|百万|千万|亿|million|billion|thousand)/i.test(sentence)) {
      continue;
    }
    matched.push(sentence.replace(/[，,；;]\s*$/, ""));
    if (matched.length >= 2) break;
  }
  if (!matched.length) return "";
  return matched.join(" ").slice(0, 1200);
}

function extractProjectName(text) {
  for (const pattern of PROJECT_NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/[。.!！?？]+$/, "");
      if (candidate.length >= 2) return candidate.slice(0, 80);
    }
  }
  return "";
}

export function extractFields(text, existing = {}) {
  const content = cleanText(text);
  if (!content) return {};
  const updates = {};

  if (!existing.projectName) {
    const name = extractProjectName(content);
    if (name) updates.projectName = name;
  }

  for (const detector of DETECTORS) {
    if (existing[detector.key] || updates[detector.key]) continue;
    const segment = extractSegment(content, detector);
    if (segment) updates[detector.key] = segment;
  }

  return updates;
}

function extractFromHistory(messages, existing) {
  let profile = { ...existing };
  if (!profile.oneLiner) {
    const firstUser = messages.find((message) => message.role === "user");
    if (firstUser) {
      const firstSentence = firstStrongSentence(cleanText(firstUser.content));
      if (firstSentence) profile.oneLiner = firstSentence.slice(0, 180);
    }
  }
  for (const message of messages) {
    if (!message || message.role !== "user") continue;
    const updates = extractFields(message.content, profile);
    profile = mergeProfiles(profile, updates);
  }
  return profile;
}

function isIntroMessage(messages) {
  return messages.filter((message) => message && message.role === "user").length <= 1;
}

function detectLanguage(text) {
  const content = cleanText(text);
  if (!content) return null;
  if (/(^|\b)(中文|汉语|简体中文|chinese|zh)(\b|$)/i.test(content)) return "zh";
  if (/(^|\b)(英文|英语|english|en)(\b|$)/i.test(content)) return "en";
  return null;
}

function guessLanguage(text) {
  const content = cleanText(text);
  if (!content) return null;
  if (/[\u3400-\u9fff]/u.test(content)) return "zh";
  if (/[A-Za-z]{3}/.test(content)) return "en";
  return "other";
}

export function normalizeLanguageMode(value) {
  if (value === "zh" || value === "en" || value === "other" || value === "auto") return value;
  if (typeof value === "string" && value.trim()) return "other";
  return "";
}

export function resolveLanguage(lang, messages = []) {
  const mode = normalizeLanguageMode(lang);
  if (mode === "zh" || mode === "en" || mode === "other") return mode;
  if (mode === "auto") {
    const lastUser = [...messages].reverse().find((message) => message && message.role === "user");
    if (!lastUser) return "auto";
    return detectLanguage(lastUser.content) || guessLanguage(lastUser.content) || "auto";
  }
  const lastUser = [...messages].reverse().find((message) => message && message.role === "user");
  return lastUser ? detectLanguage(lastUser.content) : null;
}

function textLocale(lang) {
  return lang === "zh" ? "zh" : "en";
}

function localizeField(field, lang) {
  return {
    key: field.key,
    label: lang === "zh" ? field.zhLabel : field.enLabel,
    ref: lang === "zh" ? field.zhRef : field.enRef
  };
}

export function fieldQuestion(field, lang, standard) {
  const localized = localizeField(field, lang);
  if (field.key === "standardEvidence" && standard) {
    return {
      ...localized,
      text: standard.evidenceQuestion,
      ref: standard.evidenceRef
    };
  }
  return {
    ...localized,
    text: lang === "zh" ? field.zhQuestion : field.enQuestion
  };
}

export function buildQuestions(missingKeys, lang, standard, max = 3) {
  return [...missingKeys]
    .sort((a, b) => (QUESTION_RANK[a] ?? 99) - (QUESTION_RANK[b] ?? 99))
    .slice(0, max)
    .map((key) => fieldQuestion(FIELD_MAP[key], lang, standard));
}

function mergeQuestions(missingKeys, lang, standard, aiQuestions, max = 3) {
  const missing = new Set(missingKeys);
  const questions = [];
  const seen = new Set();
  for (const item of Array.isArray(aiQuestions) ? aiQuestions : []) {
    if (!item || typeof item !== "object") continue;
    const key = cleanText(item.field);
    const text = cleanText(item.text);
    if (!FIELD_MAP[key] || !missing.has(key) || seen.has(key) || !text) continue;
    const base = fieldQuestion(FIELD_MAP[key], lang, standard);
    questions.push({ ...base, text: text.slice(0, 900) });
    seen.add(key);
    if (questions.length >= max) break;
  }
  if (questions.length < max) {
    const remaining = missingKeys.filter((key) => !seen.has(key));
    questions.push(...buildQuestions(remaining, lang, standard, max - questions.length));
  }
  return questions;
}

export function computeCoverage(profile) {
  const filled = REQUIRED_FIELDS.filter((key) => isFilled(profile[key]));
  const missingKeys = REQUIRED_FIELDS.filter((key) => !isFilled(profile[key]));
  const total = REQUIRED_FIELDS.length;
  return {
    filled: filled.length,
    total,
    percent: Math.round((filled.length / total) * 100),
    missingKeys,
    missing: missingKeys.map((key) => {
      const field = FIELD_MAP[key];
      return {
        key,
        zhLabel: field.zhLabel,
        enLabel: field.enLabel,
        zhRef: field.zhRef,
        enRef: field.enRef
      };
    }),
    sections: DOC_SECTIONS.map((section) => {
      const count = section.fields.filter((key) => isFilled(profile[key])).length;
      return {
        id: section.id,
        zhLabel: section.zhLabel,
        enLabel: section.enLabel,
        filled: count,
        total: section.fields.length,
        percent: Math.round((count / section.fields.length) * 100)
      };
    })
  };
}

function deriveOneLiner(profile, messages) {
  if (profile.oneLiner) return profile.oneLiner;
  const firstUser = messages.find((message) => message && message.role === "user");
  if (!firstUser) return "";
  const content = cleanText(firstUser.content);
  if (!content) return "";
  return firstStrongSentence(content).slice(0, 180);
}

function wasSkipped(message) {
  return SKIP_PATTERN.test(cleanText(message).slice(0, 300));
}

function labelsFor(keys, lang) {
  return keys
    .map((key) => FIELD_MAP[key])
    .filter(Boolean)
    .map((field) => (lang === "zh" ? field.zhLabel : field.enLabel));
}

function buildAcknowledgement({ lang, newFields, skipped, aiAck }) {
  if (aiAck && cleanText(aiAck)) {
    return cleanText(aiAck).slice(0, 700);
  }
  if (skipped) {
    return lang === "zh"
      ? "好的，本轮未提供的信息已标记为“待补充”。"
      : "Understood. I have marked the items you did not provide as TBD.";
  }
  if (newFields.length) {
    const labels = labelsFor(newFields, lang);
    return lang === "zh"
      ? `已记录：${labels.join("、")}。`
      : `Noted. I have updated: ${labels.join(", ")}.`;
  }
  return lang === "zh"
    ? "收到，我会继续基于现有信息整理。"
    : "Got it. I will keep building on the current information.";
}

function standardLine(lang, standard) {
  if (lang === "zh") {
    return `根据项目特征，最接近的标准是 ${standard.primary.code}（${standard.primary.name}），国内可对照 ${standard.national.code}。该标准将用于技术尽调与合规章节。`;
  }
  return `Based on the project profile, the closest fit is ${standard.primary.code} (${standard.primary.name}); the reference standard is ${standard.national.code}. It will drive the technical and compliance due-diligence chapters.`;
}

function buildAssistant({ lang, newFields, skipped, missing, questions, ready, aiAck, mentionStandard, standard }) {
  const parts = [buildAcknowledgement({ lang, newFields, skipped, aiAck })];
  if (mentionStandard) parts.push(standardLine(lang, standard));

  if (ready) {
    parts.push(
      lang === "zh"
        ? "核心信息已覆盖完整。现在可以生成全套融资材料；生成后仍可返回对话继续补充。"
        : "All core information is now covered. You can generate the full financing pack; you can also return to the conversation later to add more detail."
    );
    return parts.join("\n\n");
  }

  if (questions.length) {
    const header =
      lang === "zh"
        ? `为了让融资材料能够完整交付，请继续补充以下 ${questions.length} 项：`
        : `To make the financing pack complete, please add the following ${questions.length} item${questions.length > 1 ? "s" : ""}:`;
    const body = questions
      .map((question, index) => `${index + 1}. [${question.ref}] ${question.text}`)
      .join("\n");
    parts.push(`${header}\n${body}`);
  }

  return parts.join("\n\n");
}

export function analyzeTurn({
  lang = "zh",
  languageLabel,
  messages = [],
  profile = {},
  pending = [],
  productType,
  previousStandardId,
  aiProfile,
  aiProductType,
  aiAck,
  aiReply,
  aiQuestions,
  aiStandardId,
  aiStandardRationale,
  aiDetectedLanguage,
  aiDetectedLanguageLabel
} = {}) {
  let language = normalizeLanguageMode(lang) || "zh";
  if (language === "auto") {
    language = normalizeLanguageMode(aiDetectedLanguage) || "other";
  }
  const locale = textLocale(language);
  const resolvedLabel =
    cleanText(aiDetectedLanguageLabel) ||
    cleanText(languageLabel) ||
    (language === "zh" ? "中文" : language === "en" ? "English" : "Other");

  const safeMessages = Array.isArray(messages)
    ? messages
        .filter((message) => message && (message.role === "user" || message.role === "assistant"))
        .map((message) => ({ role: message.role, content: cleanText(message.content).slice(0, 8000) }))
        .filter((message) => message.content)
        .slice(-40)
    : [];
  const safePending = Array.isArray(pending)
    ? pending.filter((key) => REQUIRED_FIELDS.includes(key)).slice(0, 8)
    : [];

  const before = normalizeProfile(profile);
  let nextProfile = mergeProfiles(before, aiProfile, { overwrite: true });

  let historyProfile = extractFromHistory(safeMessages, nextProfile);
  nextProfile = mergeProfiles(historyProfile, nextProfile, { overwrite: true });

  const lastUser = [...safeMessages].reverse().find((message) => message && message.role === "user");
  const skipped = Boolean(lastUser && safePending.length && wasSkipped(lastUser.content));
  let fallbackAssigned = null;

  if (lastUser && !skipped) {
    const updates = extractFields(lastUser.content, nextProfile);
    nextProfile = mergeProfiles(nextProfile, updates);

    if (isIntroMessage(safeMessages) && !nextProfile.solution) {
      const intro = cleanText(lastUser.content);
      if (intro.length > 12) {
        nextProfile.solution = intro.slice(0, 1200);
      }
    }

    if (safePending.length) {
      const initiallyMissing = safePending.filter((key) => !isFilled(before[key]));
      const answeredFromPending = initiallyMissing.filter((key) => isFilled(nextProfile[key]));
      if (initiallyMissing.length && answeredFromPending.length === 0) {
        const content = cleanText(lastUser.content);
        if (content.length >= 2) {
          nextProfile[initiallyMissing[0]] = content.slice(0, 4000);
          fallbackAssigned = initiallyMissing[0];
        }
      }
    }
  } else if (skipped) {
    for (const key of safePending) {
      if (!isFilled(nextProfile[key])) {
        nextProfile[key] = NA_VALUE[locale];
      }
    }
  }

  const oneLiner = deriveOneLiner(nextProfile, safeMessages);
  if (oneLiner) nextProfile.oneLiner = oneLiner;

  const standard = selectStandard({
    profile: nextProfile,
    messages: safeMessages,
    productType: aiProductType || productType,
    lang: locale,
    standardId: aiStandardId,
    rationaleOverride: aiStandardRationale
  });

  const coverage = computeCoverage(nextProfile);
  const questions = mergeQuestions(coverage.missingKeys, locale, standard, aiQuestions, 3);
  const ready = coverage.missingKeys.length === 0;
  const newFields = REQUIRED_FIELDS.filter((key) => !isFilled(before[key]) && isFilled(nextProfile[key]));
  if (fallbackAssigned && !newFields.includes(fallbackAssigned)) newFields.push(fallbackAssigned);
  const mentionStandard =
    !previousStandardId ||
    previousStandardId !== standard.id ||
    safeMessages.filter((message) => message.role === "user").length === 1;

  const assistant = buildAssistant({
    lang: locale,
    newFields,
    skipped,
    missing: coverage.missingKeys,
    questions,
    ready,
    aiAck: aiReply || aiAck,
    mentionStandard,
    standard
  });

  const pendingNext = questions.map((question) => question.key);

  const quickReplies = [];
  if (!ready) {
    quickReplies.push({
      label: locale === "zh" ? "暂无，继续" : "Skip for now",
      value: locale === "zh" ? "暂无，继续" : "Skip for now",
      kind: "skip"
    });
  }
  if (Object.keys(nextProfile).length) {
    quickReplies.push({
      label: locale === "zh" ? "生成融资材料" : "Generate materials",
      action: "generate"
    });
  }

  return {
    lang: language,
    languageLabel: resolvedLabel,
    phase: ready ? "ready" : safeMessages.some((message) => message.role === "user") ? "discovery" : "intro",
    profile: nextProfile,
    pending: pendingNext,
    standard,
    coverage,
    questions,
    ready,
    assistant,
    newFields,
    skipped,
    quickReplies
  };
}

export function buildStart(lang, languageLabel) {
  if (lang === "other") {
    const label = cleanText(languageLabel) || "your language";
    return {
      lang,
      languageLabel: label,
      assistant: `We will continue in ${label}. Please introduce your project in a few sentences: what problem it solves, what the product or service is, who it serves, and your current progress. The more specific you are, the fewer follow-up questions I will need.`,
      quickReplies: []
    };
  }
  if (lang !== "zh" && lang !== "en") {
    return {
      lang: null,
      assistant:
        "请选择使用语言 / Please choose your language\n\n中文 或 English\n\n选择后，我会用您选定的语言了解项目，并整理融资材料。 / After you choose, I will continue in your selected language.",
      quickReplies: [
        { label: "中文", value: "中文", lang: "zh" },
        { label: "English", value: "English", lang: "en" }
      ]
    };
  }

  return {
    lang,
    assistant:
      lang === "en"
        ? "Great — we will use English. Please introduce your project in a few sentences: what problem it solves, what the product/service is, who it serves, and your current progress. The more specific you are, the fewer follow-up questions I will need."
        : "好的，我们将使用中文。请用几句话介绍您的项目：它解决什么问题、产品/服务是什么、面向哪些客户、目前进展如何。信息越具体，后续追问越少。",
    quickReplies: []
  };
}

export function missingFieldLabels(missingKeys, lang) {
  return (missingKeys || []).map((key) => {
    const field = FIELD_MAP[key];
    if (!field) return key;
    return {
      key,
      label: lang === "zh" ? field.zhLabel : field.enLabel,
      ref: lang === "zh" ? field.zhRef : field.enRef
    };
  });
}
