const CATALOG = {
  "software-25010": {
    id: "software-25010",
    family: "ISO/IEC 25000 SQuaRE",
    primary: {
      code: "ISO/IEC 25010:2023",
      zh: "系统与软件质量要求和评价（SQuaRE）— 产品质量模型",
      en: "Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model"
    },
    national: {
      code: "GB/T 25000.10",
      zh: "系统与软件质量要求和评价（SQuaRE）第10部分：系统与软件质量模型（现行版本）",
      en: "SQuaRE — Part 10: System and software quality models (current edition)"
    },
    related: [
      { code: "ISO/IEC 25040", zh: "评价过程", en: "Evaluation process" },
      { code: "GB/T 25000.51", zh: "就绪可用软件产品（RUSP）质量要求和测试细则", en: "Quality requirements and testing for Ready-to-Use Software Products" }
    ],
    reasonZh: "项目属于软件、平台或数字化服务，产品与技术的尽职调查应围绕软件质量模型和评测证据展开。",
    reasonEn: "The project is a software product, platform or digital service, so technical due diligence should follow the software quality model and evaluation evidence.",
    dimensionZh: "质量维度",
    dimensionEn: "Quality dimensions",
    dimensions: [
      { zh: "功能性：功能完备性、正确性、适当性", en: "Functional suitability: completeness, correctness, appropriateness" },
      { zh: "性能效率：时间行为、资源利用、容量", en: "Performance efficiency: time behaviour, resource utilisation, capacity" },
      { zh: "兼容性：共存性、互操作性", en: "Compatibility: co-existence, interoperability" },
      { zh: "易用性：可辨识、易学、易操作、用户差错防御、可访问性", en: "Usability: recognisability, learnability, operability, error protection, accessibility" },
      { zh: "可靠性：成熟性、可用性、容错性、可恢复性", en: "Reliability: maturity, availability, fault tolerance, recoverability" },
      { zh: "安全性：保密性、完整性、可追溯性、真实性", en: "Security: confidentiality, integrity, traceability, authenticity" },
      { zh: "可维护性：模块化、可重用性、可分析、可修改、可测试", en: "Maintainability: modularity, reusability, analysability, modifiability, testability" },
      { zh: "可移植性：适应性、可安装性、可替换性", en: "Portability: adaptability, installability, replaceability" }
    ],
    evidenceQuestionZh: "产品如何验证质量？请说明关键性能指标，以及功能、性能、安全、可靠性测试和可用性证据。",
    evidenceQuestionEn: "How do you validate product quality? Please share key performance indicators and evidence for functional, performance, security, reliability and usability testing.",
    evidenceRefZh: "技术尽调 §2 软件质量与评测",
    evidenceRefEn: "Technical DD §2 Software quality & evaluation",
    risksZh: ["核心功能未经过独立测试或缺少可复现的质量指标", "性能与可用性承诺缺少压测、SLA 和监控证据", "安全测试、权限控制与数据保护证据不足"],
    risksEn: ["Core features lack independent testing or reproducible quality metrics", "Performance and availability claims lack load testing, SLAs and monitoring evidence", "Insufficient evidence for security testing, access control and data protection"]
  },
  "ai-42001": {
    id: "ai-42001",
    family: "AI governance & SQuaRE",
    primary: {
      code: "ISO/IEC 42001:2023",
      zh: "人工智能管理体系（AIMS）",
      en: "Information technology — Artificial intelligence — Management system"
    },
    national: {
      code: "GB/T 25000.10",
      zh: "软件质量模型与评价要求（现行版本，作为产品质量补充）",
      en: "Software quality models and evaluation (current edition, as product-quality supplement)"
    },
    related: [
      { code: "ISO/IEC 23894:2023", zh: "人工智能风险管理指南", en: "Guidance on AI risk management" },
      { code: "ISO/IEC 25010:2023", zh: "产品质量模型", en: "Product quality model" },
      { code: "GB/T 25000.51", zh: "软件产品测试与质量评价", en: "Software product testing and quality evaluation" }
    ],
    reasonZh: "项目包含人工智能/大模型/算法能力，除软件质量外，还需要展示 AI 治理、数据合规、模型评估与风险控制能力。",
    reasonEn: "The project includes AI, foundation models or algorithmic capability, so AI governance, data compliance, model evaluation and risk controls should be evidenced alongside software quality.",
    dimensionZh: "AI 治理维度",
    dimensionEn: "AI governance dimensions",
    dimensions: [
      { zh: "AI 方针与治理职责", en: "AI policy and governance responsibilities" },
      { zh: "数据来源、授权与隐私合规", en: "Data provenance, licensing and privacy compliance" },
      { zh: "模型评估、准确率与鲁棒性", en: "Model evaluation, accuracy and robustness" },
      { zh: "偏见、公平性与内容安全", en: "Bias, fairness and content safety" },
      { zh: "人工监督与可解释性", en: "Human oversight and explainability" },
      { zh: "供应商与第三方模型管理", en: "Supplier and third-party model management" },
      { zh: "安全事件响应与持续改进", en: "Incident response and continual improvement" }
    ],
    evidenceQuestionZh: "AI 产品的数据来源、模型评估、内容安全与人工复核机制如何安排？",
    evidenceQuestionEn: "How are data provenance, model evaluation, content safety and human review arranged for the AI product?",
    evidenceRefZh: "技术尽调 §2 AI 治理与模型评测",
    evidenceRefEn: "Technical DD §2 AI governance & model evaluation",
    risksZh: ["训练/推理数据授权与个人信息保护证据不足", "模型效果、幻觉率与鲁棒性缺少量化评估", "内容安全、人工复核和供应商模型变更管理不完善"],
    risksEn: ["Insufficient evidence for training/inference data licensing and personal-information protection", "Model quality, hallucination rate and robustness lack quantitative evaluation", "Content safety, human review and third-party model change management are incomplete"]
  },
  "medical-13485": {
    id: "medical-13485",
    family: "Medical device QMS",
    primary: {
      code: "ISO 13485:2016",
      zh: "医疗器械质量管理体系",
      en: "Medical devices — Quality management systems"
    },
    national: {
      code: "GB/T 42061-2022",
      zh: "医疗器械质量管理体系 用于法规的要求",
      en: "Medical device quality management systems — Requirements for regulatory purposes"
    },
    related: [
      { code: "ISO 14971", zh: "医疗器械风险管理", en: "Application of risk management to medical devices" },
      { code: "IEC 62304", zh: "医疗器械软件生命周期", en: "Medical device software life-cycle processes" }
    ],
    reasonZh: "项目属于医疗器械/诊断/临床健康产品，融资尽调必须覆盖注册路径、质量管理体系、临床评价与风险管理。",
    reasonEn: "The project is a medical device, diagnostics or clinical-health product, so fundraising diligence must cover the registration pathway, QMS, clinical evaluation and risk management.",
    dimensionZh: "医疗器械合规维度",
    dimensionEn: "Medical-device compliance dimensions",
    dimensions: [
      { zh: "质量管理体系与设计控制", en: "QMS and design controls" },
      { zh: "风险管理（ISO 14971）", en: "Risk management (ISO 14971)" },
      { zh: "注册/备案与临床评价路径", en: "Registration/filing and clinical evaluation pathway" },
      { zh: "软件生命周期与网络安全（IEC 62304）", en: "Software lifecycle and cybersecurity (IEC 62304)" },
      { zh: "供应商、生产与可追溯性", en: "Supplier, production and traceability" },
      { zh: "上市后监督与不良事件处理", en: "Post-market surveillance and adverse events" }
    ],
    evidenceQuestionZh: "医疗器械注册/备案与质量体系建设进展如何？是否完成风险管理、临床评价和软件验证？",
    evidenceQuestionEn: "What is the progress on medical-device registration/filing and the QMS? Have risk management, clinical evaluation and software validation been completed?",
    evidenceRefZh: "技术尽调 §2 医疗器械注册与 QMS",
    evidenceRefEn: "Technical DD §2 Medical registration & QMS",
    risksZh: ["注册周期与临床评价结果具有不确定性", "质量体系未覆盖设计控制与可追溯要求", "软件与网络安全验证证据不足"],
    risksEn: ["Registration timelines and clinical evaluation outcomes are uncertain", "The QMS does not yet cover design controls and traceability requirements", "Software and cybersecurity validation evidence is insufficient"]
  },
  "manufacturing-9001": {
    id: "manufacturing-9001",
    family: "Quality management",
    primary: {
      code: "ISO 9001:2015",
      zh: "质量管理体系 — 要求",
      en: "Quality management systems — Requirements"
    },
    national: {
      code: "GB/T 19001-2016",
      zh: "质量管理体系 要求",
      en: "Quality management systems — Requirements"
    },
    related: [
      { code: "ISO 14001", zh: "环境管理体系", en: "Environmental management systems" },
      { code: "IATF 16949", zh: "汽车行业质量管理体系", en: "Automotive quality management system" }
    ],
    reasonZh: "项目涉及硬件制造、设备或实体产品交付，质量体系、供应链和量产能力是融资尽调的核心。",
    reasonEn: "The project involves hardware manufacturing, equipment or physical-product delivery; quality systems, supply chain and mass-production capability are central to diligence.",
    dimensionZh: "制造与质量维度",
    dimensionEn: "Manufacturing & quality dimensions",
    dimensions: [
      { zh: "质量管理体系与过程方法", en: "QMS and process approach" },
      { zh: "设计与开发控制", en: "Design and development control" },
      { zh: "供应商与采购管理", en: "Supplier and procurement management" },
      { zh: "生产与服务提供控制", en: "Production and service provision control" },
      { zh: "检验、校准与不合格品控制", en: "Inspection, calibration and nonconformity control" },
      { zh: "量产良率、产能与交付记录", en: "Mass-production yield, capacity and delivery records" }
    ],
    evidenceQuestionZh: "是否已建立 ISO 9001 质量管理体系？关键供应商、量产良率、产能与交付记录如何？",
    evidenceQuestionEn: "Has an ISO 9001 QMS been established? What are the key suppliers, mass-production yield, capacity and delivery records?",
    evidenceRefZh: "技术尽调 §2 质量体系与量产能力",
    evidenceRefEn: "Technical DD §2 QMS & mass-production capability",
    risksZh: ["量产良率与产能爬坡不及预期", "关键供应商单一或质量波动", "质量认证与检验记录不完整"],
    risksEn: ["Mass-production yield and capacity ramp-up may miss expectations", "Single-source suppliers or quality volatility", "Quality certification and inspection records are incomplete"]
  },
  "infosec-27001": {
    id: "infosec-27001",
    family: "Information security",
    primary: {
      code: "ISO/IEC 27001:2022",
      zh: "信息安全管理体系（ISMS）",
      en: "Information security management systems"
    },
    national: {
      code: "GB/T 22080-2016",
      zh: "信息技术 安全技术 信息安全管理体系 要求",
      en: "Information technology — Security techniques — Information security management systems — Requirements"
    },
    related: [
      { code: "ISO/IEC 27701", zh: "隐私信息管理体系", en: "Privacy information management" },
      { code: "GB/T 22239-2019", zh: "网络安全等级保护基本要求（等保2.0）", en: "Baseline for classified protection of cybersecurity (MLPS 2.0)" }
    ],
    reasonZh: "项目涉及信息安全、数据服务或企业级敏感数据，信息安全管理、隐私合规和等级保护是投资尽调重点。",
    reasonEn: "The project involves information security, data services or sensitive enterprise data; ISMS, privacy compliance and classified protection are key diligence areas.",
    dimensionZh: "信息安全维度",
    dimensionEn: "Information-security dimensions",
    dimensions: [
      { zh: "信息安全方针、角色与职责", en: "Security policy, roles and responsibilities" },
      { zh: "风险评估与风险处置", en: "Risk assessment and treatment" },
      { zh: "访问控制、加密与密钥管理", en: "Access control, cryptography and key management" },
      { zh: "供应商与外包安全", en: "Supplier and outsourcing security" },
      { zh: "安全事件管理与业务连续性", en: "Incident management and business continuity" },
      { zh: "隐私与数据合规（个保法/等保）", en: "Privacy and data compliance (PIPL/MLPS)" }
    ],
    evidenceQuestionZh: "信息安全与隐私合规如何保障？是否通过等保测评或 ISO/IEC 27001 认证？",
    evidenceQuestionEn: "How are information security and privacy protected? Have you passed MLPS assessment or ISO/IEC 27001 certification?",
    evidenceRefZh: "技术尽调 §2 信息安全与隐私合规",
    evidenceRefEn: "Technical DD §2 Information security & privacy",
    risksZh: ["数据泄露或越权访问导致业务与声誉损失", "隐私授权、跨境传输与等级保护不合规", "安全事件响应和业务连续性预案不足"],
    risksEn: ["Data breaches or unauthorised access could harm operations and reputation", "Privacy consent, cross-border transfer and MLPS compliance gaps", "Insufficient incident response and business-continuity plans"]
  },
  "food-22000": {
    id: "food-22000",
    family: "Food safety",
    primary: {
      code: "ISO 22000:2018",
      zh: "食品安全管理体系",
      en: "Food safety management systems"
    },
    national: {
      code: "GB/T 22000",
      zh: "食品安全管理体系（现行版本）",
      en: "Food safety management systems (current edition)"
    },
    related: [
      { code: "HACCP", zh: "危害分析与关键控制点", en: "Hazard analysis and critical control points" },
      { code: "ISO/TS 22002-1", zh: "食品制造前提方案", en: "Prerequisite programmes for food manufacturing" }
    ],
    reasonZh: "项目属于食品、饮料或餐饮供应链，食品安全体系、可追溯性和许可证是融资与规模化扩张的基础。",
    reasonEn: "The project is in food, beverage or food-service supply chains; food-safety systems, traceability and licences underpin financing and scale-up.",
    dimensionZh: "食品安全维度",
    dimensionEn: "Food-safety dimensions",
    dimensions: [
      { zh: "HACCP 与前提方案", en: "HACCP and prerequisite programmes" },
      { zh: "供应商准入与原料追溯", en: "Supplier approval and ingredient traceability" },
      { zh: "过敏原、标签与配方管理", en: "Allergen, labelling and recipe management" },
      { zh: "生产环境与卫生控制", en: "Production environment and hygiene control" },
      { zh: "检验、留样与召回机制", en: "Testing, retention samples and recall mechanism" },
      { zh: "食品生产/经营许可证", en: "Food production/operation licences" }
    ],
    evidenceQuestionZh: "食品安全管理体系与许可证情况如何？请说明 HACCP、追溯、过敏原与召回机制。",
    evidenceQuestionEn: "What is the status of the food-safety system and licences? Please describe HACCP, traceability, allergens and recall mechanisms.",
    evidenceRefZh: "技术尽调 §2 食品安全体系",
    evidenceRefEn: "Technical DD §2 Food-safety system",
    risksZh: ["食品安全事件导致品牌与现金流风险", "原料价格波动及供应商集中", "许可证、标签或追溯体系不完善"],
    risksEn: ["Food-safety incidents could damage the brand and cash flow", "Raw-material price volatility and supplier concentration", "Licences, labelling or traceability systems are incomplete"]
  },
  "environment-14001": {
    id: "environment-14001",
    family: "Environment & energy",
    primary: {
      code: "ISO 14001:2015",
      zh: "环境管理体系（EMS）",
      en: "Environmental management systems"
    },
    national: {
      code: "GB/T 24001-2016",
      zh: "环境管理体系 要求及使用指南",
      en: "Environmental management systems — Requirements with guidance for use"
    },
    related: [
      { code: "ISO 50001", zh: "能源管理体系", en: "Energy management systems" },
      { code: "ISO 14064", zh: "温室气体核算与验证", en: "Greenhouse gas accounting and verification" }
    ],
    reasonZh: "项目涉及新能源、环保、节能或重资产运营，环境合规、能耗表现和碳数据是融资尽调的重要组成部分。",
    reasonEn: "The project involves new energy, environmental protection, energy efficiency or asset-heavy operations; environmental compliance, energy performance and carbon data are key to diligence.",
    dimensionZh: "环境与能源维度",
    dimensionEn: "Environment & energy dimensions",
    dimensions: [
      { zh: "环境因素识别与合规义务", en: "Environmental aspects and compliance obligations" },
      { zh: "排污许可、环评与验收", en: "Discharge permits, EIA and acceptance" },
      { zh: "能源评审与能效指标", en: "Energy review and efficiency indicators" },
      { zh: "碳核算与减排路径", en: "Carbon accounting and reduction pathway" },
      { zh: "应急准备与环境事件响应", en: "Emergency preparedness and environmental incidents" },
      { zh: "生命周期视角与供应链环境管理", en: "Life-cycle perspective and supply-chain environmental management" }
    ],
    evidenceQuestionZh: "环保与能耗合规情况如何？请说明环评、排污许可、能耗指标与碳减排安排。",
    evidenceQuestionEn: "What is the status of environmental and energy compliance? Please describe EIA, discharge permits, energy indicators and carbon-reduction plans.",
    evidenceRefZh: "技术尽调 §2 环境与能耗合规",
    evidenceRefEn: "Technical DD §2 Environmental & energy compliance",
    risksZh: ["环保许可、环评或验收未完成影响投产", "能耗与碳成本上升压缩利润", "环境事件引发停产、处罚或声誉损失"],
    risksEn: ["Incomplete environmental permits, EIA or acceptance could delay operations", "Rising energy and carbon costs may compress margins", "Environmental incidents could cause shutdowns, fines or reputational damage"]
  },
  "service-9001": {
    id: "service-9001",
    family: "Service quality",
    primary: {
      code: "ISO 9001:2015",
      zh: "质量管理体系 — 服务组织应用",
      en: "Quality management systems — Application in service organisations"
    },
    national: {
      code: "GB/T 19001-2016",
      zh: "质量管理体系 要求",
      en: "Quality management systems — Requirements"
    },
    related: [
      { code: "ISO 10002", zh: "投诉处理指南", en: "Complaint handling guidelines" },
      { code: "GB/T 19038", zh: "顾客满意测评模型和方法指南", en: "Customer satisfaction measurement" }
    ],
    reasonZh: "项目以专业服务或运营服务为主，服务流程、质量控制、客户满意度和供应商管理是尽调重点。",
    reasonEn: "The project is primarily a professional or operational service; service processes, quality control, customer satisfaction and supplier management are the diligence focus.",
    dimensionZh: "服务质量维度",
    dimensionEn: "Service-quality dimensions",
    dimensions: [
      { zh: "服务设计与流程标准化", en: "Service design and process standardisation" },
      { zh: "服务人员培训与授权", en: "Service staff training and authorisation" },
      { zh: "服务 SLA 与客户满意度", en: "Service SLAs and customer satisfaction" },
      { zh: "投诉与持续改进机制", en: "Complaint and continual-improvement mechanisms" },
      { zh: "供应商与服务外包管理", en: "Supplier and outsourcing management" },
      { zh: "数据与隐私保护", en: "Data and privacy protection" }
    ],
    evidenceQuestionZh: "服务质量如何保障？请说明 SLA、客户满意度、投诉处理和人员培训机制。",
    evidenceQuestionEn: "How is service quality assured? Please describe SLAs, customer satisfaction, complaint handling and staff training.",
    evidenceRefZh: "技术尽调 §2 服务质量与运营体系",
    evidenceRefEn: "Technical DD §2 Service quality & operations",
    risksZh: ["服务标准化不足导致交付质量波动", "客户集中度高与续约率不确定", "人员流失与培训体系不完善"],
    risksEn: ["Insufficient standardisation causes delivery-quality variance", "High customer concentration and uncertain renewal rates", "Staff turnover and incomplete training systems"]
  }
};

const KEYWORDS = {
  "ai-42001": [
    "人工智能", "大模型", "大语言模型", "生成式", "机器学习", "深度学习", "算法模型", "智能体", "ai", "llm", "agent", "machine learning", "deep learning", "generative", "algorithm", "model"
  ],
  "medical-13485": [
    "医疗器械", "医疗设备", "体外诊断", "诊断", "临床", "药品", "生物医药", "健康监测", "medical device", "medical", "diagnostic", "clinical", "ivd", "pharma", "biotech"
  ],
  "food-22000": [
    "食品", "饮料", "餐饮", "预制菜", "食品安全", "food", "beverage", "restaurant", "catering", "haccp"
  ],
  "infosec-27001": [
    "信息安全", "网络安全", "数据安全", "隐私", "加密", "零信任", "安全服务", "等保", "information security", "cybersecurity", "data security", "privacy", "encryption", "zero trust", "mlps"
  ],
  "environment-14001": [
    "新能源", "光伏", "储能", "环保", "节能", "双碳", "碳减排", "电池回收", "environment", "new energy", "solar", "energy storage", "carbon", "recycling", "emission"
  ],
  "manufacturing-9001": [
    "制造", "工厂", "硬件", "设备", "产线", "量产", "供应链", "机器人", "传感器", "芯片", "manufacturing", "factory", "hardware", "equipment", "production line", "mass production", "supply chain", "robot", "sensor", "chip"
  ],
  "software-25010": [
    "软件", "saas", "app", "平台", "系统", "小程序", "云服务", "开发者工具", "数据库", "中间件", "软件产品", "software", "platform", "system", "cloud", "developer tool", "database", "middleware"
  ],
  "service-9001": [
    "服务", "咨询", "运营", "代运营", "培训", "物流", "企业服务", "service", "consulting", "operations", "training", "logistics"
  ]
};

const PRIORITY = [
  "medical-13485",
  "food-22000",
  "ai-42001",
  "infosec-27001",
  "environment-14001",
  "manufacturing-9001",
  "software-25010",
  "service-9001"
];

const PRODUCT_TYPE_ALIASES = {
  software: "software-25010",
  saas: "software-25010",
  platform: "software-25010",
  app: "software-25010",
  ai: "ai-42001",
  "artificial intelligence": "ai-42001",
  medical: "medical-13485",
  "medical device": "medical-13485",
  hardware: "manufacturing-9001",
  manufacturing: "manufacturing-9001",
  food: "food-22000",
  security: "infosec-27001",
  energy: "environment-14001",
  environment: "environment-14001",
  service: "service-9001",
  other: "software-25010"
};

function countMatches(text, terms) {
  let count = 0;
  const hits = [];
  for (const term of terms) {
    const pattern = /[a-z]/i.test(term)
      ? new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "gi")
      : new RegExp(term, "g");
    const found = text.match(pattern);
    if (found) {
      count += Math.min(found.length, 3);
      hits.push(term);
    }
  }
  return { count, hits };
}

function localizeStandard(def, lang, { matched = [], score = 0, rationale } = {}) {
  const zh = lang === "zh";
  return {
    id: def.id,
    family: def.family,
    primary: {
      code: def.primary.code,
      name: zh ? def.primary.zh : def.primary.en
    },
    national: {
      code: def.national.code,
      name: zh ? def.national.zh : def.national.en
    },
    related: def.related.map((item) => ({
      code: item.code,
      name: zh ? item.zh : item.en
    })),
    rationale: rationale || (zh ? def.reasonZh : def.reasonEn),
    matchedTerms: matched.slice(0, 6),
    score,
    dimensionsLabel: zh ? def.dimensionZh : def.dimensionEn,
    dimensions: def.dimensions.map((item) => (zh ? item.zh : item.en)),
    evidenceQuestion: zh ? def.evidenceQuestionZh : def.evidenceQuestionEn,
    evidenceRef: zh ? def.evidenceRefZh : def.evidenceRefEn,
    risks: zh ? def.risksZh : def.risksEn,
    raw: def
  };
}

export function getStandardCatalog() {
  return PRIORITY.map((id) => {
    const def = CATALOG[id];
    return { id, family: def.family, code: def.primary.code, nationalCode: def.national.code };
  });
}

export function selectStandard({
  profile = {},
  messages = [],
  productType,
  lang = "zh",
  standardId,
  rationale: rationaleOverride
} = {}) {
  if (standardId && CATALOG[standardId]) {
    return localizeStandard(CATALOG[standardId], lang, {
      matched: [],
      score: 8,
      rationale:
        rationaleOverride ||
        (lang === "zh"
          ? CATALOG[standardId].reasonZh
          : CATALOG[standardId].reasonEn)
    });
  }

  const text = messages
    .filter((message) => message && message.role === "user")
    .map((message) => message.content || "")
    .join("\n")
    .slice(-24000);

  const combined = `${text}\n${Object.values(profile).filter(Boolean).join("\n")}`;
  const scores = {};

  for (const id of PRIORITY) {
    const { count, hits } = countMatches(combined, KEYWORDS[id] || []);
    scores[id] = { score: count, matched: hits };
  }

  if (productType) {
    const normalized = String(productType).toLowerCase().trim();
    const mapped = PRODUCT_TYPE_ALIASES[normalized];
    if (mapped) {
      scores[mapped].score += 6;
      if (!scores[mapped].matched.includes(normalized)) scores[mapped].matched.push(normalized);
    }
  }

  let bestId = "software-25010";
  let best = { score: 0, matched: [] };
  for (const id of PRIORITY) {
    if (scores[id].score > best.score) {
      best = scores[id];
      bestId = id;
    }
  }

  let rationale;
  let matched = best.matched;
  if (best.score === 0) {
    bestId = "software-25010";
    best = scores[bestId];
    matched = [];
    rationale =
      lang === "zh"
        ? "暂未识别到明确的行业特征，默认采用软件质量与评价标准；您可以随时补充产品类型以便重新匹配。"
        : "No industry-specific keyword was detected, so the default software quality and evaluation framework is used. You can correct the product type at any time.";
  } else if (lang === "zh") {
    rationale = `${CATALOG[bestId].reasonZh}（匹配特征：${matched.slice(0, 4).join("、") || "项目描述"}）`;
  } else {
    rationale = `${CATALOG[bestId].reasonEn} (Matched signals: ${matched.slice(0, 4).join(", ") || "project description"})`;
  }

  return localizeStandard(CATALOG[bestId], lang, {
    matched,
    score: best.score,
    rationale
  });
}

export function standardDefinition(id) {
  return CATALOG[id] || CATALOG["software-25010"];
}
