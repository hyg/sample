import { FIELD_DEFINITIONS, FIELD_MAP, computeCoverage, isFilled } from "./engine.js";

const DOC_DEFS = [
  {
    id: "overview",
    zhTitle: "融资材料总览与使用说明",
    enTitle: "Funding Pack Overview & Guide",
    zhFile: "00-融资材料总览.md",
    enFile: "00-funding-pack-overview.md",
    zhDesc: "全套材料的目录、标准依据与使用说明",
    enDesc: "Contents, standards basis and usage notes for the pack"
  },
  {
    id: "summary",
    zhTitle: "一页纸融资摘要",
    enTitle: "One-Page Executive Summary",
    zhFile: "01-一页纸融资摘要.md",
    enFile: "01-executive-summary.md",
    zhDesc: "给投资人 60 秒内看懂项目的一句话摘要",
    enDesc: "A 60-second project summary for investors"
  },
  {
    id: "business-plan",
    zhTitle: "商业计划书",
    enTitle: "Business Plan",
    zhFile: "02-商业计划书.md",
    enFile: "02-business-plan.md",
    zhDesc: "覆盖市场、产品、模式、团队、财务与融资的完整正文",
    enDesc: "Full narrative covering market, product, model, team, financials and funding"
  },
  {
    id: "pitch-deck",
    zhTitle: "路演大纲",
    enTitle: "Pitch Deck Outline",
    zhFile: "03-路演大纲.md",
    enFile: "03-pitch-deck-outline.md",
    zhDesc: "13 页路演结构、核心信息与讲稿要点",
    enDesc: "A 13-slide narrative with key messages and speaker notes"
  },
  {
    id: "financials",
    zhTitle: "财务预测与资金用途",
    enTitle: "Financial Projections & Use of Funds",
    zhFile: "04-财务预测与资金用途.md",
    enFile: "04-financial-projections.md",
    zhDesc: "历史数据框架、三年预测、单位经济模型与资金分配",
    enDesc: "Historical framework, three-year forecast, unit economics and allocation"
  },
  {
    id: "market",
    zhTitle: "市场与竞争分析",
    enTitle: "Market & Competitive Analysis",
    zhFile: "05-市场与竞争分析.md",
    enFile: "05-market-and-competition.md",
    zhDesc: "TAM/SAM/SOM、客户细分、竞争矩阵与增长路径",
    enDesc: "TAM/SAM/SOM, customer segments, competitive matrix and growth path"
  },
  {
    id: "technical",
    zhTitle: "技术与标准合规尽调",
    enTitle: "Technical & Standards Due Diligence",
    zhFile: "06-技术与标准合规尽调.md",
    enFile: "06-technical-standards-dd.md",
    zhDesc: "ISO/GB 标准匹配、质量证据、知识产权与技术尽调清单",
    enDesc: "ISO/GB matching, quality evidence, IP and technical DD checklist"
  },
  {
    id: "risk",
    zhTitle: "风险清单与应对",
    enTitle: "Risk Register & Mitigation",
    zhFile: "07-风险清单与应对.md",
    enFile: "07-risk-register.md",
    zhDesc: "投资人关注的风险矩阵、应对措施与监控指标",
    enDesc: "Investor-focused risk matrix, mitigations and monitoring metrics"
  },
  {
    id: "data-room",
    zhTitle: "融资资料清单与数据室",
    enTitle: "Data Room & Funding Checklist",
    zhFile: "08-融资资料清单与数据室.md",
    enFile: "08-data-room-checklist.md",
    zhDesc: "按优先级整理的尽调文件清单与上传状态",
    enDesc: "Prioritised diligence document checklist and status"
  }
];

const TBD = { zh: "待补充", en: "TBD" };

function pick(lang, zh, en) {
  return lang === "en" ? en : zh;
}

function tbd(lang) {
  return TBD[lang] || TBD.zh;
}

function valueOrTbd(profile, key, lang, { bold = true } = {}) {
  const value = profile[key];
  if (isFilled(value)) return value;
  const label = tbd(lang);
  return bold ? `**${label}**` : label;
}

function cell(value, lang) {
  const text = isFilled(value) ? value : tbd(lang);
  return String(text).replace(/\|/g, "\\|").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

function table(headers, rows) {
  return [
    `| ${headers.map((header) => cell(header)).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((item) => cell(item)).join(" | ")} |`)
  ].join("\n");
}

function blockquote(text, lang) {
  if (!isFilled(text)) return `> ${tbd(lang)}`;
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function projectName(profile, lang) {
  return isFilled(profile.projectName) ? profile.projectName : pick(lang, "未命名项目", "Untitled Project");
}

function oneLiner(profile, lang) {
  return isFilled(profile.oneLiner)
    ? profile.oneLiner
    : pick(lang, "一句话项目定位待补充。", "One-line positioning to be added.");
}

function standardLines(standard, lang) {
  return {
    primary: `${standard.primary.code} — ${standard.primary.name}`,
    national: `${standard.national.code} — ${standard.national.name}`,
    related: standard.related.length
      ? standard.related.map((item) => `${item.code} ${item.name}`).join(pick(lang, "；", "; "))
      : pick(lang, "无", "None")
  };
}

function docHeader(lang, title, profile, standard) {
  return `# ${title}

> **${pick(lang, "项目", "Project")}：** ${projectName(profile, lang)}  
> **${pick(lang, "生成日期", "Generated")}：** ${new Date().toISOString().slice(0, 10)}  
> **${pick(lang, "标准依据", "Standards basis")}：** ${standard.primary.code} / ${standard.national.code}  
> **${pick(lang, "数据说明", "Data note")}：** ${pick(
    lang,
    "本材料由对话内容整理，标注“待补充”的数据需创始团队核验后再对外发送。",
    "This pack is compiled from the conversation. Items marked TBD must be verified by the founding team before external use."
  )}`;
}

function parseFundingAmount(fundingAsk) {
  if (!isFilled(fundingAsk)) return null;
  const text = fundingAsk.replace(/,/g, "");
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(亿|千万|百万|万|千)?\s*(元|人民币|美元|美金|USD|RMB|CNY|dollars?|million|billion|m|b|k)?/i
  );
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0) return null;
  const zhUnit = match[2] || "";
  const currencyToken = (match[3] || "").toLowerCase();
  let multiplier = 1;
  if (zhUnit === "亿") multiplier = 1e8;
  else if (zhUnit === "千万") multiplier = 1e7;
  else if (zhUnit === "百万") multiplier = 1e6;
  else if (zhUnit === "万") multiplier = 1e4;
  else if (zhUnit === "千") multiplier = 1e3;
  else if (/million|m$/.test(currencyToken)) multiplier = 1e6;
  else if (/billion|b$/.test(currencyToken)) multiplier = 1e9;
  else if (/k$/.test(currencyToken)) multiplier = 1e3;

  if (multiplier === 1 && !/元|人民币|美元|美金|usd|rmb|cny|dollar/i.test(currencyToken)) {
    return null;
  }

  const isUsd = /美元|美金|usd|dollar/i.test(currencyToken);
  return { amount: number * multiplier, currency: isUsd ? "USD" : "CNY" };
}

function formatMoney(amount, currency, lang) {
  if (currency === "USD") {
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(amount % 1e6 === 0 ? 0 : 1)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  }
  if (amount >= 1e8) return pick(lang, `${(amount / 1e8).toFixed(2)} 亿元`, `RMB ${(amount / 1e6).toFixed(0)}M`);
  if (amount >= 1e4) return pick(lang, `${Math.round(amount / 1e4)} 万元`, `RMB ${(amount / 1e3).toFixed(0)}K`);
  return pick(lang, `${Math.round(amount)} 元`, `RMB ${Math.round(amount)}`);
}

function fundingAllocation(profile, lang) {
  const parsed = parseFundingAmount(profile.fundingAsk);
  const rows = [
    { pct: 40, zh: "产品研发、测试与标准合规", en: "Product R&D, testing & standards compliance" },
    { pct: 25, zh: "市场拓展与销售", en: "Go-to-market & sales" },
    { pct: 20, zh: "团队扩充与关键岗位", en: "Team expansion & key hires" },
    { pct: 10, zh: "运营、供应链与交付", en: "Operations, supply chain & delivery" },
    { pct: 5, zh: "预备金与不可预见支出", en: "Reserve & contingency" }
  ];
  return rows.map((row) => ({
    purpose: lang === "en" ? row.en : row.zh,
    pct: `${row.pct}%`,
    amount: parsed ? formatMoney((parsed.amount * row.pct) / 100, parsed.currency, lang) : tbd(lang)
  }));
}

function fieldStatus(value, lang) {
  if (!isFilled(value)) return pick(lang, "待补充", "To add");
  if (/^(暂无（用户暂未提供|Not available \(not provided)/i.test(value.trim())) {
    return pick(lang, "明确暂无", "Not available");
  }
  return pick(lang, "已提供线索（待核验文件）", "Mentioned (documents to verify)");
}

function missingLabels(profile, lang, limit = 5) {
  return FIELD_DEFINITIONS.filter((field) => !isFilled(profile[field.key]))
    .slice(0, limit)
    .map((field) => (lang === "en" ? field.enLabel : field.zhLabel));
}

function nextActions(profile, lang) {
  const missing = missingLabels(profile, lang, 5);
  if (!missing.length) {
    return pick(
      lang,
      [
        "1. 核验全部数字与对外表述，确保与审计报表、合同和系统数据一致。",
        "2. 按数据室清单上传原件，建立版本号与访问权限。",
        "3. 针对标准符合性补充测试报告、认证证书或体系文件。",
        "4. 用路演大纲进行一次 15 分钟模拟路演，记录投资人问题。",
        "5. 给财务预测补充保守/基准/进取三种情景。"
      ].join("\n"),
      [
        "1. Verify every metric and external claim against audited statements, contracts and system data.",
        "2. Upload source documents per the data-room checklist with version numbers and access controls.",
        "3. Add test reports, certificates or system documents for standards conformity.",
        "4. Run a 15-minute mock pitch using the deck outline and log investor questions.",
        "5. Add conservative/base/aggressive scenarios to the financial forecast."
      ].join("\n")
    );
  }
  return missing
    .map((label, index) => `${index + 1}. ${pick(lang, `补充并核验：${label}`, `Add and verify: ${label}`)}`)
    .join("\n");
}

function renderOverview(profile, standard, lang, materials) {
  const coverage = computeCoverage(profile);
  const lines = standardLines(standard, lang);
  const docList = materials
    .filter((item) => item.id !== "overview")
    .map((item) => `- ${item.title} — ${item.description}`)
    .join("\n");

  return `${docHeader(lang, pick(lang, "融资材料总览与使用说明", "Funding Pack Overview & Guide"), profile, standard)}

## ${pick(lang, "一、材料清单", "1. Pack contents")}

${docList}

## ${pick(lang, "二、标准匹配", "2. Standards matching")}

- **${pick(lang, "主标准", "Primary standard")}：** ${lines.primary}
- **${pick(lang, "国内对照", "China reference")}：** ${lines.national}
- **${pick(lang, "相关标准", "Related standards")}：** ${lines.related}
- **${pick(lang, "匹配依据", "Matching rationale")}：** ${standard.rationale}

## ${pick(lang, "三、信息完整度", "3. Information completeness")}

${coverage.filled} / ${coverage.total} ${pick(lang, "项核心信息已覆盖（", "core items covered (")}${coverage.percent}%${pick(lang, "）", ")")}。

${pick(lang, "尚未覆盖：", "Still missing: ")}${
    coverage.missingKeys.length
      ? coverage.missing.map((item) => (lang === "en" ? item.enLabel : item.zhLabel)).join(pick(lang, "、", ", "))
      : pick(lang, "无，可进入核验阶段。", "None; ready for verification.")
  }

## ${pick(lang, "四、使用顺序建议", "4. Recommended usage")}

1. ${pick(lang, "先用《一页纸融资摘要》做初次接触与邮件正文。", "Use the One-Page Executive Summary for first contact and email bodies.")}
2. ${pick(lang, "用《路演大纲》组织 10–15 分钟会议，再用《商业计划书》承接深问。", "Use the Pitch Deck Outline for a 10–15 minute meeting, then the Business Plan for follow-up depth.")}
3. ${pick(lang, "财务问题用《财务预测与资金用途》回应，并准备底层报表。", "Answer financial questions with Financial Projections & Use of Funds, backed by underlying statements.")}
4. ${pick(lang, "技术/合规问题用《技术与标准合规尽调》，按证据台账归档。", "Answer technical/compliance questions with the Technical & Standards DD document and evidence register.")}
5. ${pick(lang, "尽调阶段开放《融资资料清单与数据室》中的文件。", "Share data-room files during the diligence phase.")}

## ${pick(lang, "五、优先补充事项", "5. Priority actions")}

${nextActions(profile, lang)}

## ${pick(lang, "重要声明", "Important notice")}

> ${pick(
    lang,
    "本材料由对话内容自动整理，不构成法律、财务、投资或认证意见。所有市场数据、财务数字、知识产权、资质与标准符合性表述均需创始团队及专业顾问核验。ISO/GB 标准版本请以正式发布文本为准。",
    "This pack is compiled automatically from the conversation and is not legal, financial, investment or certification advice. All market data, financials, IP, licences and standards-conformity claims must be verified by the founding team and professional advisers. Refer to the official published texts for ISO/GB standard editions."
  )}`;
}

function renderSummary(profile, standard, lang) {
  const lines = standardLines(standard, lang);
  const highlights = [];
  if (isFilled(profile.targetMarket)) {
    highlights.push(pick(lang, `聚焦客户：${profile.targetMarket}`, `Target customers: ${profile.targetMarket}`));
  }
  if (isFilled(profile.traction)) {
    highlights.push(pick(lang, `已验证进展：${profile.traction}`, `Validated traction: ${profile.traction}`));
  }
  if (isFilled(profile.businessModel)) {
    highlights.push(pick(lang, `可复制模式：${profile.businessModel}`, `Scalable model: ${profile.businessModel}`));
  }
  if (isFilled(profile.fundingAsk)) {
    highlights.push(pick(lang, `本轮需求：${profile.fundingAsk}`, `This round: ${profile.fundingAsk}`));
  }
  highlights.push(
    pick(
      lang,
      `技术/合规基准：${standard.primary.code} + ${standard.national.code}`,
      `Technical/compliance baseline: ${standard.primary.code} + ${standard.national.code}`
    )
  );

  return `${docHeader(lang, pick(lang, "一页纸融资摘要", "One-Page Executive Summary"), profile, standard)}

## ${projectName(profile, lang)}

**${oneLiner(profile, lang)}**

## ${pick(lang, "问题", "Problem")}

${valueOrTbd(profile, "problem", lang)}

## ${pick(lang, "解决方案", "Solution")}

${valueOrTbd(profile, "solution", lang)}

## ${pick(lang, "市场与客户", "Market & customers")}

- **${pick(lang, "目标市场", "Target market")}：** ${valueOrTbd(profile, "targetMarket", lang)}
- **${pick(lang, "市场规模", "Market size")}：** ${valueOrTbd(profile, "marketSize", lang)}

## ${pick(lang, "商业模式与进展", "Business model & traction")}

- **${pick(lang, "商业模式", "Business model")}：** ${valueOrTbd(profile, "businessModel", lang)}
- **${pick(lang, "当前进展", "Traction")}：** ${valueOrTbd(profile, "traction", lang)}

## ${pick(lang, "团队", "Team")}

${valueOrTbd(profile, "team", lang)}

## ${pick(lang, "竞争壁垒", "Competitive moat")}

${valueOrTbd(profile, "competition", lang)}

## ${pick(lang, "融资需求", "Funding ask")}

${valueOrTbd(profile, "fundingAsk", lang)}

## ${pick(lang, "投资亮点", "Investment highlights")}

${highlights.map((item) => `- ${item}`).join("\n")}

## ${pick(lang, "标准与合规", "Standards & compliance")}

- **${pick(lang, "主标准", "Primary standard")}：** ${lines.primary}
- **${pick(lang, "国内对照", "China reference")}：** ${lines.national}
- **${pick(lang, "已有证据", "Existing evidence")}：** ${valueOrTbd(profile, "standardEvidence", lang)}
- **${pick(lang, "知识产权与资质", "IP & licences")}：** ${valueOrTbd(profile, "ipCompliance", lang)}

> ${pick(lang, "以上为对话整理版本，请补齐“待补充”项并核验后对外发送。", "This is a conversation-derived draft. Complete all TBDs and verify before external use.")}`;
}

function renderBusinessPlan(profile, standard, lang) {
  const allocation = fundingAllocation(profile, lang);
  const useRows = allocation.map((row) => [row.purpose, row.pct, row.amount]);
  const dimensions = standard.dimensions.slice(0, 8).map((dimension) => [dimension, pick(lang, "待补充", "To add"), pick(lang, "待验证", "To verify")]);

  return `${docHeader(lang, pick(lang, "商业计划书", "Business Plan"), profile, standard)}

## 1. ${pick(lang, "项目概览", "Project overview")}

**${projectName(profile, lang)}** — ${oneLiner(profile, lang)}

- **${pick(lang, "核心痛点", "Core problem")}：** ${valueOrTbd(profile, "problem", lang)}
- **${pick(lang, "解决方案", "Solution")}：** ${valueOrTbd(profile, "solution", lang)}
- **${pick(lang, "当前阶段", "Current stage")}：** ${valueOrTbd(profile, "traction", lang)}

## 2. ${pick(lang, "市场与客户", "Market & customers")}

**${pick(lang, "目标客户与场景", "Target customers & scenarios")}：** ${valueOrTbd(profile, "targetMarket", lang)}

**${pick(lang, "市场规模", "Market size")}：** ${valueOrTbd(profile, "marketSize", lang)}

${table(
    [
      pick(lang, "市场层级", "Layer"),
      pick(lang, "定义", "Definition"),
      pick(lang, "数值", "Value"),
      pick(lang, "来源/验证方式", "Source / validation")
    ],
    [
      ["TAM", pick(lang, "全部可服务市场", "Total addressable market"), tbd(lang), tbd(lang)],
      ["SAM", pick(lang, "可服务市场", "Serviceable addressable market"), tbd(lang), tbd(lang)],
      ["SOM", pick(lang, "近期可获得市场", "Serviceable obtainable market"), tbd(lang), tbd(lang)]
    ]
  )}

## 3. ${pick(lang, "痛点与解决方案", "Problem & solution")}

### ${pick(lang, "痛点", "Problem")}

${valueOrTbd(profile, "problem", lang)}

### ${pick(lang, "解决方案与产品", "Solution & product")}

${valueOrTbd(profile, "solution", lang)}

## 4. ${pick(lang, "产品、技术与标准", "Product, technology & standards")}

- **${pick(lang, "产品类型", "Product type")}：** ${standard.family}
- **${pick(lang, "标准匹配", "Standards fit")}：** ${standard.primary.code}；${standard.national.code}
- **${pick(lang, "匹配理由", "Why this standard")}：** ${standard.rationale}
- **${pick(lang, "现有质量/合规证据", "Existing quality/compliance evidence")}：** ${valueOrTbd(profile, "standardEvidence", lang)}

${table(
    [pick(lang, "标准关注维度", "Dimension"), pick(lang, "当前证据", "Current evidence"), pick(lang, "状态", "Status")],
    dimensions
  )}

## 5. ${pick(lang, "商业模式与增长", "Business model & growth")}

**${pick(lang, "商业模式", "Business model")}：** ${valueOrTbd(profile, "businessModel", lang)}

**${pick(lang, "进展验证", "Traction")}：** ${valueOrTbd(profile, "traction", lang)}

${table(
    [pick(lang, "单位经济指标", "Unit economics"), pick(lang, "当前值", "Current"), pick(lang, "建议目标（按行业校准）", "Target (calibrate by industry)")],
    [
      [`ACV / ${pick(lang, "客单价", "contract value")}`, tbd(lang), tbd(lang)],
      [pick(lang, "毛利率", "Gross margin"), tbd(lang), pick(lang, "软件 ≥ 70%；硬件按行业", "Software ≥ 70%; hardware by industry")],
      ["CAC", tbd(lang), tbd(lang)],
      ["LTV", tbd(lang), tbd(lang)],
      ["LTV / CAC", tbd(lang), pick(lang, "≥ 3x", "≥ 3x")],
      [pick(lang, "CAC 回收期", "CAC payback"), tbd(lang), pick(lang, "< 18 个月", "< 18 months")]
    ]
  )}

## 6. ${pick(lang, "竞争分析", "Competitive analysis")}

${valueOrTbd(profile, "competition", lang)}

${table(
    [pick(lang, "竞争者", "Competitor"), pick(lang, "定位", "Positioning"), pick(lang, "优势", "Strength"), pick(lang, "短板", "Weakness"), pick(lang, "价格/模式", "Price/model")],
    [
      [pick(lang, "竞争者 A", "Competitor A"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "竞争者 B", "Competitor B"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "本项目", "This project"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)]
    ]
  )}

## 7. ${pick(lang, "团队", "Team")}

${valueOrTbd(profile, "team", lang)}

## 8. ${pick(lang, "财务与融资", "Financials & funding")}

**${pick(lang, "财务概况", "Financials")}：** ${valueOrTbd(profile, "financials", lang)}

**${pick(lang, "本轮融资", "Funding ask")}：** ${valueOrTbd(profile, "fundingAsk", lang)}

${table(
    [pick(lang, "资金用途（建议分配）", "Use of funds (proposed)"), pick(lang, "比例", "Share"), pick(lang, "金额", "Amount")],
    useRows
  )}

> ${pick(lang, "资金分配为建议模板，需结合融资额、现金 runway 与里程碑校准。", "The allocation is a suggested template; calibrate it against the round size, cash runway and milestones.")}

## 9. ${pick(lang, "里程碑规划", "Roadmap")}

${valueOrTbd(profile, "roadmap", lang)}

## 10. ${pick(lang, "风险与退出", "Risks & exit")}

**${pick(lang, "主要风险", "Key risks")}：** ${valueOrTbd(profile, "risks", lang)}

**${pick(lang, "退出路径", "Exit strategy")}：** ${valueOrTbd(profile, "exitStrategy", lang)}

## ${pick(lang, "附录：标准与知识产权", "Appendix: standards & IP")}

- **${pick(lang, "标准依据", "Standards")}：** ${standard.primary.code}；${standard.national.code}
- **${pick(lang, "相关标准", "Related")}：** ${standard.related.map((item) => item.code).join(pick(lang, "、", ", "))}
- **${pick(lang, "知识产权与资质", "IP & licences")}：** ${valueOrTbd(profile, "ipCompliance", lang)}`;
}

function renderPitchDeck(profile, standard, lang) {
  const slides = [
    {
      title: pick(lang, "封面：项目名称与一句话定位", "Cover: name & one-liner"),
      message: `${projectName(profile, lang)} — ${oneLiner(profile, lang)}`,
      notes: pick(lang, "用一句话讲清楚“为谁解决什么问题”，不要从技术架构开始。", "Explain who you serve and what pain you remove in one sentence. Do not start with architecture."),
      visual: pick(lang, "产品界面、客户使用场景或品牌主视觉。", "Product UI, customer context or brand key visual."),
      gap: tbd(lang)
    },
    {
      title: pick(lang, "痛点：为什么现在必须解决", "Problem: why it matters now"),
      message: valueOrTbd(profile, "problem", lang, { bold: false }),
      notes: pick(lang, "给出一个具体客户故事和量化损失。", "Use one concrete customer story and quantify the loss."),
      visual: pick(lang, "现状流程图与成本/效率对比。", "Current-state workflow and cost/efficiency comparison."),
      gap: pick(lang, "补充痛点量化数据与客户原话。", "Add quantified pain and customer quotes.")
    },
    {
      title: pick(lang, "解决方案：产品如何工作", "Solution: how it works"),
      message: valueOrTbd(profile, "solution", lang, { bold: false }),
      notes: pick(lang, "用“输入—处理—结果”三步说明，避免堆功能。", "Use input-process-outcome in three steps; avoid a feature list."),
      visual: pick(lang, "产品截图或 30 秒演示视频。", "Product screenshot or 30-second demo."),
      gap: tbd(lang)
    },
    {
      title: pick(lang, "为什么是我们：差异化与壁垒", "Why us: differentiation & moat"),
      message: valueOrTbd(profile, "competition", lang, { bold: false }),
      notes: pick(lang, "只讲可验证的优势：数据、网络效应、切换成本、牌照或成本结构。", "Only claim defensible advantages: data, network effects, switching costs, licences or cost structure."),
      visual: pick(lang, "竞争矩阵或价值链对比。", "Competitive matrix or value-chain comparison."),
      gap: pick(lang, "补充竞争对手名称与对比维度。", "Add competitor names and comparison dimensions.")
    },
    {
      title: pick(lang, "市场：空间与切入路径", "Market: size & entry point"),
      message: `${valueOrTbd(profile, "targetMarket", lang, { bold: false })} / ${valueOrTbd(profile, "marketSize", lang, { bold: false })}`,
      notes: pick(lang, "先讲 SOM 的切入路径，再讲 TAM 的长期空间。", "Start with the SOM entry path, then the TAM long-term opportunity."),
      visual: pick(lang, "TAM/SAM/SOM 漏斗与首批客户分布。", "TAM/SAM/SOM funnel and first-customer footprint."),
      gap: pick(lang, "补充数据来源、年份与计算方法。", "Add source, year and methodology.")
    },
    {
      title: pick(lang, "产品与标准：质量如何被证明", "Product & standards: proof of quality"),
      message: `${standard.primary.code} / ${standard.national.code} — ${valueOrTbd(profile, "standardEvidence", lang, { bold: false })}`,
      notes: pick(lang, "用测试报告、SLA、认证或第三方评估证明质量，而不是只说“技术领先”。", "Prove quality with test reports, SLAs, certifications or third-party assessments, not just 'leading technology'."),
      visual: pick(lang, "质量指标看板与标准符合性台账。", "Quality metrics dashboard and standards-conformity register."),
      gap: pick(lang, "补充性能、安全、可靠性测试证据。", "Add performance, security and reliability evidence.")
    },
    {
      title: pick(lang, "商业模式：如何赚钱", "Business model: how you make money"),
      message: valueOrTbd(profile, "businessModel", lang, { bold: false }),
      notes: pick(lang, "讲清收费对象、定价锚点、毛利与扩张逻辑。", "Clarify who pays, the pricing anchor, gross margin and expansion logic."),
      visual: pick(lang, "收入结构、客单价与复购/续费。", "Revenue mix, contract value and renewal/repurchase."),
      gap: pick(lang, "补充客单价、毛利率与销售周期。", "Add ACV, gross margin and sales cycle.")
    },
    {
      title: pick(lang, "进展：已经验证了什么", "Traction: what is validated"),
      message: valueOrTbd(profile, "traction", lang, { bold: false }),
      notes: pick(lang, "用趋势而非单点数据；明确付费客户、留存和收入质量。", "Show trends rather than one-off numbers; clarify paying customers, retention and revenue quality."),
      visual: pick(lang, "增长曲线、客户 Logo 与关键合同。", "Growth curve, customer logos and key contracts."),
      gap: pick(lang, "补充月度/季度趋势与流失率。", "Add monthly/quarterly trend and churn.")
    },
    {
      title: pick(lang, "团队：为什么你们能赢", "Team: why you can win"),
      message: valueOrTbd(profile, "team", lang, { bold: false }),
      notes: pick(lang, "只保留与当前业务直接相关的经历和分工。", "Keep only experience and responsibilities directly relevant to this business."),
      visual: pick(lang, "团队照片、履历时间线与组织图。", "Team photos, career timelines and org chart."),
      gap: pick(lang, "补充全职投入情况、股权与关键岗位缺口。", "Add full-time commitment, equity and key hiring gaps.")
    },
    {
      title: pick(lang, "财务：增长与现金流", "Financials: growth & cash"),
      message: valueOrTbd(profile, "financials", lang, { bold: false }),
      notes: pick(lang, "讲清收入驱动、成本结构和达峰现金流时点。", "Explain revenue drivers, cost structure and peak cash need."),
      visual: pick(lang, "三年收入/毛利/现金流图与假设表。", "Three-year revenue/gross-margin/cash chart with assumptions."),
      gap: pick(lang, "补充预测假设、敏感性分析与审计状态。", "Add forecast assumptions, sensitivity analysis and audit status.")
    },
    {
      title: pick(lang, "融资：要多少钱、做什么", "Funding: how much and for what"),
      message: valueOrTbd(profile, "fundingAsk", lang, { bold: false }),
      notes: pick(lang, "把融资金额、18 个月里程碑和下一轮触发条件绑定。", "Tie the amount to 18-month milestones and next-round triggers."),
      visual: pick(lang, "资金用途与里程碑甘特图。", "Use-of-funds and milestone Gantt chart."),
      gap: pick(lang, "补充估值口径、出让比例与资金使用表。", "Add valuation basis, dilution and use-of-funds table.")
    },
    {
      title: pick(lang, "路线图：下一阶段的验证点", "Roadmap: next proof points"),
      message: valueOrTbd(profile, "roadmap", lang, { bold: false }),
      notes: pick(lang, "每个里程碑都要对应可核验指标。", "Every milestone needs a verifiable metric."),
      visual: pick(lang, "12–24 个月路线图与负责人。", "12–24 month roadmap with owners."),
      gap: tbd(lang)
    },
    {
      title: pick(lang, "结尾：融资需求与联系方式", "Close: ask & contact"),
      message: `${valueOrTbd(profile, "fundingAsk", lang, { bold: false })} / ${valueOrTbd(profile, "exitStrategy", lang, { bold: false })}`,
      notes: pick(lang, "明确下一步动作：数据室、会议或试点。", "State the next action: data room, meeting or pilot."),
      visual: pick(lang, "联系方式、数据室二维码与免责声明。", "Contact details, data-room QR code and disclaimer."),
      gap: tbd(lang)
    }
  ];

  return `${docHeader(lang, pick(lang, "路演大纲", "Pitch Deck Outline"), profile, standard)}

> ${pick(lang, "建议 10–13 页，15 分钟以内。每页只保留一个核心信息；以下“待补充”用于会前检查。", "Aim for 10–13 slides and under 15 minutes. Keep one key message per slide; use the TBD notes as a pre-meeting checklist.")}

${slides
    .map(
      (slide, index) => `## ${index + 1}. ${slide.title}

- **${pick(lang, "核心信息", "Key message")}：** ${slide.message}
- **${pick(lang, "讲稿要点", "Speaker notes")}：** ${slide.notes}
- **${pick(lang, "建议画面", "Visual")}：** ${slide.visual}
- **${pick(lang, "会前检查", "Pre-meeting check")}：** ${slide.gap}`
    )
    .join("\n\n")}`;
}

function renderFinancials(profile, standard, lang) {
  const allocation = fundingAllocation(profile, lang);
  return `${docHeader(lang, pick(lang, "财务预测与资金用途", "Financial Projections & Use of Funds"), profile, standard)}

## 1. ${pick(lang, "创始人提供的信息", "Information provided by founders")}

${blockquote(valueOrTbd(profile, "financials", lang, { bold: false }), lang)}

## 2. ${pick(lang, "历史财务（请按审计/管理报表填写）", "Historical financials (from audited/management accounts)")}

${table(
    [pick(lang, "科目", "Line item"), pick(lang, "前一年", "Prior year"), pick(lang, "上一年", "Last year"), pick(lang, "当前年（年化）", "Current year (annualised)")],
    [
      [pick(lang, "营业收入", "Revenue"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "营业成本", "Cost of revenue"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "毛利润", "Gross profit"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "毛利率", "Gross margin"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "销售与市场费用", "Sales & marketing"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "研发费用", "R&D"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "管理费用", "G&A"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "经营性现金流", "Operating cash flow"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "期末现金", "Ending cash"), tbd(lang), tbd(lang), tbd(lang)]
    ]
  )}

## 3. ${pick(lang, "三年预测（基准情景）", "Three-year forecast (base case)")}

${table(
    [pick(lang, "科目", "Line item"), pick(lang, "第 1 年", "Year 1"), pick(lang, "第 2 年", "Year 2"), pick(lang, "第 3 年", "Year 3"), pick(lang, "关键假设", "Key assumptions")],
    [
      [pick(lang, "营业收入", "Revenue"), tbd(lang), tbd(lang), tbd(lang), pick(lang, "客户数 × 客单价，或销量 × 单价", "Customers × ACV, or units × price")],
      [pick(lang, "毛利润", "Gross profit"), tbd(lang), tbd(lang), tbd(lang), pick(lang, "毛利率假设", "Gross-margin assumption")],
      [pick(lang, "销售与市场费用", "Sales & marketing"), tbd(lang), tbd(lang), tbd(lang), pick(lang, "CAC × 新增客户数", "CAC × new customers")],
      [pick(lang, "研发费用", "R&D"), tbd(lang), tbd(lang), tbd(lang), pick(lang, "团队人数 × 人均成本", "Headcount × cost per head")],
      [pick(lang, "管理费用", "G&A"), tbd(lang), tbd(lang), tbd(lang), pick(lang, "固定成本与合规投入", "Fixed costs and compliance")],
      [pick(lang, "EBITDA", "EBITDA"), tbd(lang), tbd(lang), tbd(lang), pick(lang, "毛利 − 费用", "Gross profit − opex")],
      [pick(lang, "经营现金流", "Operating cash flow"), tbd(lang), tbd(lang), tbd(lang), pick(lang, "EBITDA ± 营运资金变动", "EBITDA ± working-capital changes")],
      [pick(lang, "期末现金", "Ending cash"), tbd(lang), tbd(lang), tbd(lang), pick(lang, "期初现金 + 融资 + 经营现金流 − 资本开支", "Opening cash + funding + operating cash flow − capex")]
    ]
  )}

> ${pick(lang, "预测必须写明口径、汇率、税率、收款周期与关键假设，并准备保守/基准/进取三种情景。", "State the basis, FX, tax, collection cycle and key assumptions. Prepare conservative/base/aggressive scenarios.")}

## 4. ${pick(lang, "情景分析", "Scenario analysis")}

${table(
    [pick(lang, "情景", "Scenario"), pick(lang, "核心驱动", "Key drivers"), pick(lang, "收入假设", "Revenue assumption"), pick(lang, "现金峰值", "Peak cash need"), pick(lang, "触发条件", "Triggers")],
    [
      [pick(lang, "保守", "Conservative"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "基准", "Base"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "进取", "Aggressive"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)]
    ]
  )}

## 5. ${pick(lang, "单位经济模型", "Unit economics")}

${table(
    [pick(lang, "指标", "Metric"), pick(lang, "公式/定义", "Formula/definition"), pick(lang, "当前", "Current"), pick(lang, "投资人常用参考", "Common investor reference")],
    [
      [pick(lang, "客单价 ACV", "ACV"), pick(lang, "年度合同金额", "Annual contract value"), tbd(lang), pick(lang, "按产品和客户分层", "Segment by product and customer")],
      [pick(lang, "毛利率", "Gross margin"), pick(lang, "（收入−直接成本）/收入", "(Revenue − COGS) / revenue"), tbd(lang), pick(lang, "软件通常 ≥ 70%", "Software often ≥ 70%")],
      ["CAC", pick(lang, "获客总成本 / 新增客户数", "Total acquisition cost / new customers"), tbd(lang), tbd(lang)],
      ["LTV", pick(lang, "ACV × 毛利率 / 年流失率", "ACV × gross margin / annual churn"), tbd(lang), tbd(lang)],
      ["LTV/CAC", pick(lang, "LTV ÷ CAC", "LTV ÷ CAC"), tbd(lang), pick(lang, "≥ 3x", "≥ 3x")],
      [pick(lang, "回收期", "Payback"), pick(lang, "CAC ÷ 月度毛利", "CAC ÷ monthly gross profit"), tbd(lang), pick(lang, "通常 < 18 个月", "Often < 18 months")]
    ]
  )}

## 6. ${pick(lang, "资金用途", "Use of funds")}

**${pick(lang, "融资需求", "Funding ask")}：** ${valueOrTbd(profile, "fundingAsk", lang)}

${table(
    [pick(lang, "用途", "Use"), pick(lang, "比例", "Share"), pick(lang, "金额（建议值）", "Amount (proposed)")],
    allocation.map((row) => [row.purpose, row.pct, row.amount])
  )}

> ${pick(lang, "金额列为按融资额自动测算的建议值，若无法识别融资金额则显示“待补充”。请创始人确认后再使用。", "Amounts are automatically estimated from the stated round size. If the amount could not be parsed, TBD is shown. Founders must confirm before use.")}

## 7. ${pick(lang, "Runway 与里程碑", "Runway & milestones")}

${table(
    [pick(lang, "项目", "Item"), pick(lang, "内容", "Details")],
    [
      [pick(lang, "当前现金", "Current cash"), tbd(lang)],
      [pick(lang, "月度净消耗", "Monthly net burn"), tbd(lang)],
      [pick(lang, "预计 runway", "Estimated runway"), tbd(lang)],
      [pick(lang, "本轮后 runway", "Post-round runway"), tbd(lang)],
      [pick(lang, "下一轮触发条件", "Next-round triggers"), tbd(lang)],
      [pick(lang, "关键里程碑", "Key milestones"), valueOrTbd(profile, "roadmap", lang, { bold: false })]
    ]
  )}

## 8. ${pick(lang, "财务尽调文件清单", "Financial diligence checklist")}

- [ ] ${pick(lang, "近 2–3 年审计报告与管理报表", "Audited accounts and management reports for 2–3 years")}
- [ ] ${pick(lang, "月度收入明细、客户集中度与应收账款账龄", "Monthly revenue detail, customer concentration and AR aging")}
- [ ] ${pick(lang, "成本结构、供应商合同与采购发票", "Cost structure, supplier contracts and purchase invoices")}
- [ ] ${pick(lang, "银行流水、贷款与担保文件", "Bank statements, loans and guarantees")}
- [ ] ${pick(lang, "税务申报、社保公积金与关联交易", "Tax filings, payroll/social insurance and related-party transactions")}
- [ ] ${pick(lang, "预测模型底稿与关键假设", "Forecast model and key assumptions")}`;
}

function renderMarket(profile, standard, lang) {
  return `${docHeader(lang, pick(lang, "市场与竞争分析", "Market & Competitive Analysis"), profile, standard)}

## 1. ${pick(lang, "市场定义", "Market definition")}

**${pick(lang, "目标客户与场景", "Target customers & scenarios")}：** ${valueOrTbd(profile, "targetMarket", lang)}

**${pick(lang, "市场规模", "Market size")}：** ${valueOrTbd(profile, "marketSize", lang)}

## 2. TAM / SAM / SOM

${table(
    [pick(lang, "层级", "Layer"), pick(lang, "定义", "Definition"), pick(lang, "数值", "Value"), pick(lang, "数据来源/年份", "Source/year"), pick(lang, "验证方法", "Validation")],
    [
      ["TAM", pick(lang, "全部可服务市场", "Total addressable market"), tbd(lang), tbd(lang), pick(lang, "自上而下 + 自下而上交叉验证", "Top-down + bottom-up triangulation")],
      ["SAM", pick(lang, "当前产品可服务市场", "Serviceable addressable market"), tbd(lang), tbd(lang), pick(lang, "按地区、客户与价格筛选", "Filter by geography, customer and price")],
      ["SOM", pick(lang, "3 年内可获得市场", "Obtainable within 3 years"), tbd(lang), tbd(lang), pick(lang, "销售能力与渠道覆盖测算", "Sales-capacity and channel coverage")]]
  )}

> ${pick(lang, "不要只给一个巨大的 TAM。投资人更关心 SAM/SOM、切入路径和可验证的获客能力。", "Do not rely on a huge TAM alone. Investors care more about SAM/SOM, the entry path and demonstrable acquisition capability.")}

## 3. ${pick(lang, "客户细分与优先级", "Customer segments & priority")}

${table(
    [pick(lang, "细分", "Segment"), pick(lang, "痛点强度", "Pain intensity"), pick(lang, "付费意愿", "Willingness to pay"), pick(lang, "获客难度", "Acquisition difficulty"), pick(lang, "优先级", "Priority")],
    [
      [pick(lang, "细分 A", "Segment A"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "细分 B", "Segment B"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "细分 C", "Segment C"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)]
    ]
  )}

## 4. ${pick(lang, "竞争格局", "Competitive landscape")}

${valueOrTbd(profile, "competition", lang)}

${table(
    [pick(lang, "竞争者", "Competitor"), pick(lang, "目标客户", "Target customers"), pick(lang, "核心能力", "Core capability"), pick(lang, "价格/模式", "Price/model"), pick(lang, "主要短板", "Key weakness")],
    [
      [pick(lang, "竞争者 A", "Competitor A"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "竞争者 B", "Competitor B"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "本项目", "This project"), valueOrTbd(profile, "targetMarket", lang, { bold: false }), valueOrTbd(profile, "solution", lang, { bold: false }), valueOrTbd(profile, "businessModel", lang, { bold: false }), tbd(lang)]
    ]
  )}

## 5. ${pick(lang, "壁垒与可持续优势", "Moat & sustainable advantage")}

${table(
    [pick(lang, "壁垒类型", "Moat type"), pick(lang, "现状", "Current status"), pick(lang, "证据/指标", "Evidence/metric"), pick(lang, "建设计划", "Build plan")],
    [
      [pick(lang, "数据与网络效应", "Data & network effects"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "切换成本与嵌入深度", "Switching cost & embedding"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "品牌与渠道", "Brand & channel"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "成本结构/供应链", "Cost structure/supply chain"), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "资质、标准与牌照", "Licences, standards & permits"), tbd(lang), tbd(lang), tbd(lang)]
    ]
  )}

## 6. ${pick(lang, "增长路径与渠道", "Growth path & channels")}

- **${pick(lang, "首批客户", "First customers")}：** ${valueOrTbd(profile, "traction", lang)}
- **${pick(lang, "核心渠道", "Core channels")}：** ${pick(lang, "待补充（直销/渠道/生态/内容/招投标）", "TBD (direct/channel/ecosystem/content/tenders)")}
- **${pick(lang, "销售周期与客单价", "Sales cycle & ACV")}：** ${tbd(lang)}
- **${pick(lang, "扩张顺序", "Expansion sequence")}：** ${tbd(lang)}

## 7. ${pick(lang, "需要验证的关键假设", "Key assumptions to validate")}

1. ${pick(lang, "市场数据来源、统计口径与年份是否可被第三方复核？", "Can the market data source, scope and year be independently verified?")}
2. ${pick(lang, "目标客户的付费预算来自哪个部门，决策链有多长？", "Which budget owner pays, and how long is the decision chain?")}
3. ${pick(lang, "与替代方案相比，客户可量化的收益是什么？", "What is the quantified customer benefit versus alternatives?")}
4. ${pick(lang, "获客成本与回收期是否已有真实数据支撑？", "Are CAC and payback supported by real data?")}
5. ${pick(lang, "竞争者的实际报价、覆盖区域与产品边界是什么？", "What are competitors' actual pricing, coverage and product boundaries?")}`;
}

function renderTechnical(profile, standard, lang) {
  const dimensions = standard.dimensions.map((dimension) => [
    dimension,
    isFilled(profile.standardEvidence) ? pick(lang, "已有线索，需归档到该维度", "Mentioned; map to this dimension") : tbd(lang),
    pick(lang, "待验证", "To verify"),
    tbd(lang)
  ]);
  const related = standard.related.map((item) => `${item.code} — ${item.name}`).join("\n");

  return `${docHeader(lang, pick(lang, "技术与标准合规尽调", "Technical & Standards Due Diligence"), profile, standard)}

## 1. ${pick(lang, "标准匹配结论", "Standards matching conclusion")}

- **${pick(lang, "主标准", "Primary standard")}：** ${standard.primary.code} — ${standard.primary.name}
- **${pick(lang, "国内对照", "China reference")}：** ${standard.national.code} — ${standard.national.name}
- **${pick(lang, "匹配依据", "Rationale")}：** ${standard.rationale}
- **${pick(lang, "相关标准/框架", "Related standards/frameworks")}：**
${related
    .split("\n")
    .map((line) => `  - ${line}`)
    .join("\n")}

> ${pick(lang, "说明：匹配结果用于组织融资尽调材料，不等同于认证结论；标准版本与适用范围请以官方发布文本和认证机构意见为准。", "Note: this matching organises fundraising diligence materials and is not a certification conclusion. Confirm editions and applicability with official texts and certification bodies.")}

## 2. ${pick(lang, "质量与合规证据台账", "Quality & compliance evidence register")}

**${pick(lang, "创始人提供的证据线索", "Evidence mentioned by founders")}：** ${valueOrTbd(profile, "standardEvidence", lang)}

${table(
    [pick(lang, "标准关注维度", "Dimension"), pick(lang, "当前证据", "Current evidence"), pick(lang, "状态", "Status"), pick(lang, "需补充文件", "Document required")],
    dimensions
  )}

## 3. ${pick(lang, "技术尽调问题清单", "Technical diligence checklist")}

${table(
    [pick(lang, "领域", "Area"), pick(lang, "尽调问题", "Diligence question"), pick(lang, "证据", "Evidence"), pick(lang, "状态", "Status")],
    [
      [pick(lang, "产品", "Product"), pick(lang, "核心功能、版本节奏与路线图是否清晰？", "Are core features, release cadence and roadmap clear?"), tbd(lang), pick(lang, "待补充", "To add")],
      [pick(lang, "架构", "Architecture"), pick(lang, "系统架构、可扩展性与单点故障如何？", "What are the architecture, scalability and single points of failure?"), tbd(lang), pick(lang, "待补充", "To add")],
      [pick(lang, "质量", "Quality"), pick(lang, "功能、性能、可靠性与安全测试是否可复现？", "Are functional, performance, reliability and security tests reproducible?"), tbd(lang), pick(lang, "待补充", "To add")],
      [pick(lang, "数据", "Data"), pick(lang, "数据来源、授权、存储、跨境与删除机制？", "What are data provenance, licensing, storage, cross-border transfer and deletion?"), tbd(lang), pick(lang, "待补充", "To add")],
      [pick(lang, "安全", "Security"), pick(lang, "访问控制、加密、漏洞管理与事件响应？", "Access control, encryption, vulnerability management and incident response?"), tbd(lang), pick(lang, "待补充", "To add")],
      [pick(lang, "交付", "Delivery"), pick(lang, "SLA、可用性、监控与客户支持能力？", "SLAs, availability, monitoring and customer support?"), tbd(lang), pick(lang, "待补充", "To add")],
      [pick(lang, "供应链", "Supply chain"), pick(lang, "关键供应商、替代方案与成本波动？", "Critical suppliers, alternatives and cost volatility?"), tbd(lang), pick(lang, "待补充", "To add")]
    ]
  )}

## 4. ${pick(lang, "知识产权与资质", "Intellectual property & licences")}

**${pick(lang, "创始人提供的信息", "Information provided by founders")}：** ${valueOrTbd(profile, "ipCompliance", lang)}

${table(
    [pick(lang, "类型", "Type"), pick(lang, "名称/编号", "Name/number"), pick(lang, "权利人", "Owner"), pick(lang, "状态", "Status"), pick(lang, "到期/续费", "Expiry/renewal")],
    [
      [pick(lang, "发明专利", "Invention patent"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "软件著作权", "Software copyright"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "商标", "Trademark"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "经营/行业许可证", "Business/industry licence"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)],
      [pick(lang, "认证/备案", "Certification/filing"), tbd(lang), tbd(lang), tbd(lang), tbd(lang)]
    ]
  )}

## 5. ${pick(lang, "标准符合性建设路线", "Standards conformity roadmap")}

${table(
    [pick(lang, "阶段", "Phase"), pick(lang, "动作", "Action"), pick(lang, "输出物", "Deliverable"), pick(lang, "负责人", "Owner"), pick(lang, "时间", "Timing")],
    [
      [pick(lang, "差距分析", "Gap analysis"), pick(lang, "对照标准条款梳理现有流程与证据", "Map current processes and evidence against the standard"), pick(lang, "差距清单", "Gap list"), tbd(lang), tbd(lang)],
      [pick(lang, "体系建设", "System build"), pick(lang, "补齐制度、职责、记录与培训", "Complete policies, roles, records and training"), pick(lang, "体系文件", "System documents"), tbd(lang), tbd(lang)],
      [pick(lang, "测试验证", "Testing"), pick(lang, "开展功能/性能/安全/可靠性或专项验证", "Run functional/performance/security/reliability or sector-specific validation"), pick(lang, "测试报告", "Test reports"), tbd(lang), tbd(lang)],
      [pick(lang, "内部审核", "Internal audit"), pick(lang, "核查证据闭环与不符合项整改", "Check evidence closure and corrective actions"), pick(lang, "审核记录", "Audit records"), tbd(lang), tbd(lang)],
      [pick(lang, "认证/声明", "Certification/declaration"), pick(lang, "按需申请第三方认证或自我声明", "Apply for third-party certification or self-declaration as needed"), pick(lang, "证书/声明", "Certificate/declaration"), tbd(lang), tbd(lang)]
    ]
  )}

## 6. ${pick(lang, "主要标准风险", "Key standards risks")}

${standard.risks.map((risk) => `- ${risk}`).join("\n")}

> ${pick(lang, "本清单可用于准备技术尽调会议，但不能替代正式审计、律师意见或认证审核。", "This checklist supports technical due-diligence preparation but does not replace formal audits, legal opinions or certification audits.")}`;
}

function renderRisk(profile, standard, lang) {
  const userRisks = isFilled(profile.risks)
    ? profile.risks
        .split(/(?<=[。！？!?；;])|\n+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const rows = [];
  userRisks.forEach((risk, index) => {
    rows.push([`R${index + 1}`, pick(lang, "创始人识别", "Founder-identified"), risk, tbd(lang), tbd(lang), pick(lang, "补充可执行应对措施与负责人", "Add mitigation and owner"), tbd(lang)]);
  });
  standard.risks.forEach((risk, index) => {
    rows.push([
      `S${index + 1}`,
      pick(lang, "标准/合规", "Standards/compliance"),
      risk,
      tbd(lang),
      tbd(lang),
      pick(lang, `按 ${standard.primary.code} 建立控制并留存证据`, `Establish controls and retain evidence under ${standard.primary.code}`),
      tbd(lang)
    ]);
  });
  rows.push(
    ["F1", pick(lang, "财务", "Financial"), pick(lang, "现金流不足以支撑到下一轮或盈亏平衡", "Cash runway may not reach the next round or break-even"), pick(lang, "高", "High"), pick(lang, "中", "Medium"), pick(lang, "建立 18 个月滚动现金流预测、成本弹性和分阶段融资方案", "Build an 18-month rolling cash forecast, cost flexibility and staged funding plan"), tbd(lang)],
    ["F2", pick(lang, "商业化", "Commercial"), pick(lang, "客户集中度高或续约率低于预期", "High customer concentration or renewal below expectations"), tbd(lang), tbd(lang), pick(lang, "签署多年合同、拓展第二客户群、跟踪 NRR/流失率", "Sign multi-year contracts, diversify the customer base, track NRR/churn"), tbd(lang)],
    ["F3", pick(lang, "组织", "Organisation"), pick(lang, "关键人依赖与核心岗位缺口", "Key-person dependency and critical hiring gaps"), tbd(lang), tbd(lang), pick(lang, "股权激励、岗位备份、文档化与招聘计划", "Equity incentives, backup roles, documentation and hiring plan"), tbd(lang)]
  );

  return `${docHeader(lang, pick(lang, "风险清单与应对", "Risk Register & Mitigation"), profile, standard)}

## 1. ${pick(lang, "风险矩阵", "Risk matrix")}

${table(
    [pick(lang, "编号", "ID"), pick(lang, "类别", "Category"), pick(lang, "风险描述", "Risk"), pick(lang, "影响", "Impact"), pick(lang, "概率", "Likelihood"), pick(lang, "应对措施", "Mitigation"), pick(lang, "负责人/状态", "Owner/status")],
    rows
  )}

> ${pick(lang, "影响与概率标记为“待评估”的项，应在与投资人会面前由管理层完成评级。", "Items marked TBD for impact/likelihood should be rated by management before investor meetings.")}

## 2. ${pick(lang, "创始人自述风险", "Founder-provided risks")}

${blockquote(valueOrTbd(profile, "risks", lang, { bold: false }), lang)}

## 3. ${pick(lang, "标准相关风险的优先动作", "Priority actions for standards risks")}

1. ${pick(lang, `将 ${standard.primary.code} 的要求映射到现有流程、岗位与记录。`, `Map ${standard.primary.code} requirements to current processes, roles and records.`)}
2. ${pick(lang, "建立证据台账：文件名、版本、责任人、有效期与存放位置。", "Build an evidence register: filename, version, owner, expiry and location.")}
3. ${pick(lang, "对高风险维度安排第三方测试或预审，并保留原始报告。", "Arrange third-party testing or pre-assessment for high-risk dimensions and retain original reports.")}
4. ${pick(lang, "在融资材料中只陈述已验证的事实，避免使用无法举证的最高级表述。", "Only state verified facts in fundraising materials; avoid unsubstantiated superlatives.")}

## 4. ${pick(lang, "风险监控指标", "Risk monitoring metrics")}

${table(
    [pick(lang, "指标", "Metric"), pick(lang, "频率", "Frequency"), pick(lang, "预警阈值", "Alert threshold"), pick(lang, "责任人", "Owner")],
    [
      [pick(lang, "现金 runway（月）", "Cash runway (months)"), pick(lang, "月度", "Monthly"), pick(lang, "< 9 个月", "< 9 months"), tbd(lang)],
      [pick(lang, "前 5 大客户收入占比", "Top-5 customer revenue share"), pick(lang, "季度", "Quarterly"), pick(lang, "> 60%", "> 60%"), tbd(lang)],
      [pick(lang, "净收入留存率 NRR", "Net revenue retention"), pick(lang, "季度", "Quarterly"), pick(lang, "< 100%", "< 100%"), tbd(lang)],
      [pick(lang, "重大安全/合规事件", "Material security/compliance incidents"), pick(lang, "实时", "Real-time"), pick(lang, "任何 P1 事件", "Any P1 incident"), tbd(lang)],
      [pick(lang, "关键岗位空缺时长", "Critical-role vacancy duration"), pick(lang, "月度", "Monthly"), pick(lang, "> 90 天", "> 90 days"), tbd(lang)]
    ]
  )}

## 5. ${pick(lang, "退出路径与风险", "Exit path & risks")}

**${pick(lang, "目标退出方式", "Target exit")}：** ${valueOrTbd(profile, "exitStrategy", lang)}

- ${pick(lang, "退出路径依赖资本市场窗口、收入规模与合规状态，应在融资文件中作为情景而非承诺。", "The exit path depends on capital-market windows, revenue scale and compliance status; present it as a scenario, not a promise.")}
- ${pick(lang, "并购方通常重点关注客户合同可转让性、知识产权归属、数据合规与核心团队留任。", "Acquirers typically focus on contract assignability, IP ownership, data compliance and key-team retention.")}`;
}

function renderDataRoom(profile, standard, lang) {
  const status = (key) => fieldStatus(profile[key], lang);
  const coverage = computeCoverage(profile);
  const checklist = [
    {
      zh: "公司与法律",
      en: "Corporate & legal",
      items: [
        { zh: "营业执照、公司章程、股东名册", en: "Business licence, articles of association, register of members", key: "projectName" },
        { zh: "股权结构表（含期权池）与历史融资协议", en: "Cap table (including option pool) and historical financing agreements", key: "fundingAsk" },
        { zh: "股东协议、一致行动安排与关键审批", en: "Shareholders' agreement, concert-party arrangements and key approvals", key: "projectName" }
      ]
    },
    {
      zh: "财务",
      en: "Financial",
      items: [
        { zh: "近 2–3 年审计报告/管理报表", en: "Audited/management accounts for the last 2–3 years", key: "financials" },
        { zh: "月度收入、应收账款、客户集中度", en: "Monthly revenue, AR aging and customer concentration", key: "traction" },
        { zh: "税务、银行流水、贷款与担保", en: "Tax filings, bank statements, loans and guarantees", key: "financials" },
        { zh: "三年预测模型与情景分析", en: "Three-year forecast model and scenarios", key: "financials" }
      ]
    },
    {
      zh: "产品与技术",
      en: "Product & technology",
      items: [
        { zh: "产品说明、架构图与版本路线图", en: "Product description, architecture diagram and release roadmap", key: "solution" },
        { zh: "测试报告、SLA、性能与安全证据", en: "Test reports, SLAs, performance and security evidence", key: "standardEvidence" },
        { zh: "数据来源、隐私政策、跨境与删除机制", en: "Data provenance, privacy policy, cross-border transfer and deletion", key: "standardEvidence" },
        { zh: "关键供应商与外包合同", en: "Critical supplier and outsourcing contracts", key: "standardEvidence" }
      ]
    },
    {
      zh: "知识产权与资质",
      en: "IP & licences",
      items: [
        { zh: "专利、软著、商标清单与证书", en: "Patent, software copyright and trademark list with certificates", key: "ipCompliance" },
        { zh: "经营许可证、行业备案与认证", en: "Business licences, industry filings and certifications", key: "ipCompliance" },
        { zh: "员工/外包知识产权归属协议", en: "Employee/contractor IP assignment agreements", key: "ipCompliance" }
      ]
    },
    {
      zh: "市场与客户",
      en: "Market & customers",
      items: [
        { zh: "市场研究报告与数据来源", en: "Market research and data sources", key: "marketSize" },
        { zh: "客户合同、订单、LOI 与续约记录", en: "Customer contracts, orders, LOIs and renewal records", key: "traction" },
        { zh: "定价、渠道与销售流程", en: "Pricing, channels and sales process", key: "businessModel" }
      ]
    },
    {
      zh: "团队与组织",
      en: "Team & organisation",
      items: [
        { zh: "创始人及核心成员简历", en: "CVs of founders and key team members", key: "team" },
        { zh: "组织架构、劳动合同与顾问协议", en: "Org chart, employment contracts and advisory agreements", key: "team" },
        { zh: "股权激励计划与关键人保险", en: "Equity incentive plan and key-person insurance", key: "team" }
      ]
    },
    {
      zh: "标准与合规",
      en: "Standards & compliance",
      items: [
        { zh: `${standard.primary.code} 差距分析与证据台账`, en: `${standard.primary.code} gap analysis and evidence register`, key: "standardEvidence" },
        { zh: "第三方测试、认证或体系文件", en: "Third-party test reports, certificates or system documents", key: "standardEvidence" },
        { zh: "诉讼、处罚、数据与安全事件记录", en: "Litigation, penalties, data and security incidents", key: "risks" }
      ]
    },
    {
      zh: "融资文件",
      en: "Financing documents",
      items: [
        { zh: "本轮融资计划与资金用途", en: "Current financing plan and use of funds", key: "fundingAsk" },
        { zh: "历史 term sheet、可转债与回购条款", en: "Historical term sheets, convertible notes and redemption terms", key: "fundingAsk" },
        { zh: "风险清单与应对方案", en: "Risk register and mitigation plan", key: "risks" }
      ]
    }
  ];

  const sections = checklist
    .map((section) => {
      const title = lang === "en" ? section.en : section.zh;
      const lines = section.items
        .map((item) => `- [ ] ${lang === "en" ? item.en : item.zh} — ${status(item.key)}`)
        .join("\n");
      return `## ${title}\n\n${lines}`;
    })
    .join("\n\n");

  return `${docHeader(lang, pick(lang, "融资资料清单与数据室", "Data Room & Funding Checklist"), profile, standard)}

## ${pick(lang, "使用说明", "How to use")}

- ${pick(lang, "“已提供线索”表示对话中提及，不代表文件已验证；请上传原件并核对。", "'Mentioned' means the topic appeared in the conversation, not that the document is verified. Upload the source file and check it.")}
- ${pick(lang, "建议使用只读数据室，按投资人分别授权，并保留访问日志。", "Use a read-only data room, grant access per investor and keep access logs.")}
- ${pick(lang, "文件命名：编号_文件类型_日期_版本，例如 03_审计报告_2025_ v2。", "File naming: number_document-type_date_version, e.g. 03_audited-accounts_2025_v2.")}
- ${pick(lang, "信息覆盖：", "Coverage: ")}${coverage.filled} / ${coverage.total}（${coverage.percent}%）

${sections}

## ${pick(lang, "优先完成这 5 件事", "Top 5 priority actions")}

${nextActions(profile, lang)}

> ${pick(lang, "不要将与本次融资无关的敏感个人信息、客户密钥或未授权第三方数据放入数据室。", "Do not place unrelated sensitive personal data, customer secrets or unauthorised third-party data in the data room.")}`;
}

export function generateMaterials({ profile = {}, standard, lang = "zh", messages = [] }) {
  const language = lang === "en" ? "en" : "zh";
  const localizedStandard = standard;
  const builders = {
    overview: (materials) => renderOverview(profile, localizedStandard, language, materials),
    summary: () => renderSummary(profile, localizedStandard, language),
    "business-plan": () => renderBusinessPlan(profile, localizedStandard, language),
    "pitch-deck": () => renderPitchDeck(profile, localizedStandard, language),
    financials: () => renderFinancials(profile, localizedStandard, language),
    market: () => renderMarket(profile, localizedStandard, language),
    technical: () => renderTechnical(profile, localizedStandard, language),
    risk: () => renderRisk(profile, localizedStandard, language),
    "data-room": () => renderDataRoom(profile, localizedStandard, language)
  };

  const baseMaterials = DOC_DEFS.map((def) => ({
    id: def.id,
    title: language === "en" ? def.enTitle : def.zhTitle,
    description: language === "en" ? def.enDesc : def.zhDesc,
    filename: language === "en" ? def.enFile : def.zhFile
  }));

  const materials = baseMaterials.map((material) => ({
    ...material,
    markdown: builders[material.id](baseMaterials)
  }));

  const coverage = computeCoverage(profile);
  return {
    materials,
    meta: {
      projectName: projectName(profile, language),
      oneLiner: oneLiner(profile, language),
      language,
      generatedAt: new Date().toISOString(),
      standardId: localizedStandard.id,
      standardCode: localizedStandard.primary.code,
      nationalCode: localizedStandard.national.code,
      coverage
    }
  };
}

export function listMaterials(lang = "zh") {
  return DOC_DEFS.map((def) => ({
    id: def.id,
    title: lang === "en" ? def.enTitle : def.zhTitle,
    description: lang === "en" ? def.enDesc : def.zhDesc,
    filename: lang === "en" ? def.enFile : def.zhFile
  }));
}

export { DOC_DEFS, FIELD_MAP };
