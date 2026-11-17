import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeTurn,
  buildStart,
  computeCoverage,
  extractFields,
  normalizeProfile
} from "../src/engine.js";

const SOFTWARE_INTRO =
  "项目叫云账通，我们为中小企业提供财务记账 SaaS 平台，解决手工记账低效的问题，按月订阅收费，已有 120 家付费客户，ARR 300 万元，团队 18 人，本轮计划融资 800 万元，出让 12% 股权。";

test("buildStart asks bilingually and offers both languages", () => {
  const start = buildStart();
  assert.match(start.assistant, /请选择使用语言/);
  assert.match(start.assistant, /Please choose your language/);
  assert.deepEqual(
    start.quickReplies.map((reply) => reply.lang),
    ["zh", "en"]
  );
});

test("buildStart returns a language-specific introduction request", () => {
  assert.match(buildStart("zh").assistant, /请用几句话介绍您的项目/);
  assert.match(buildStart("en").assistant, /Please introduce your project/);
});

test("Chinese software intro matches ISO/IEC 25010 and extracts fields", () => {
  const result = analyzeTurn({
    lang: "zh",
    messages: [{ role: "user", content: SOFTWARE_INTRO }],
    profile: {},
    pending: []
  });

  assert.equal(result.standard.id, "software-25010");
  assert.match(result.standard.primary.code, /ISO\/IEC 25010/);
  assert.match(result.standard.national.code, /GB\/T 25000/);
  assert.equal(result.profile.projectName, "云账通");
  assert.match(result.profile.businessModel, /订阅/);
  assert.match(result.profile.traction, /120 家付费客户/);
  assert.match(result.profile.fundingAsk, /800 万元/);
  assert.equal(result.questions.length, 3);
  assert.match(result.assistant, /商业计划书/);
  assert.ok(result.coverage.percent > 0 && result.coverage.percent < 100);
  assert.ok(!result.ready);
  assert.deepEqual(result.pending, result.questions.map((question) => question.key));
});

test("AI project is matched to ISO/IEC 42001", () => {
  const result = analyzeTurn({
    lang: "zh",
    messages: [
      {
        role: "user",
        content: "我们研发面向企业的 AI 智能体平台，基于大模型做知识库问答，按调用量收费。"
      }
    ],
    profile: {},
    pending: []
  });

  assert.equal(result.standard.id, "ai-42001");
  assert.match(result.standard.primary.code, /ISO\/IEC 42001/);
  assert.match(result.standard.rationale, /人工智能|AI/);
});

test("Medical device project is matched to ISO 13485", () => {
  const result = analyzeTurn({
    lang: "zh",
    messages: [
      {
        role: "user",
        content: "我们研发便携式心电监测医疗器械，正在申请二类医疗器械注册证，已完成样机和临床预试验。"
      }
    ],
    profile: {},
    pending: []
  });

  assert.equal(result.standard.id, "medical-13485");
  assert.match(result.standard.primary.code, /ISO 13485/);
  assert.match(result.standard.national.code, /GB\/T 42061/);
  assert.match(result.profile.standardEvidence, /注册证/);
  assert.ok(result.questions.every((question) => question.ref));
});

test("English conversation stays English and requests English references", () => {
  const result = analyzeTurn({
    lang: "en",
    messages: [
      {
        role: "user",
        content:
          "Our project is FlowLedger, a SaaS platform that automates bookkeeping for SMEs. We charge a monthly subscription, have 40 paying customers and USD 300K ARR."
      }
    ],
    profile: {},
    pending: []
  });

  assert.equal(result.lang, "en");
  assert.equal(result.profile.projectName, "FlowLedger");
  assert.match(result.assistant, /To make the financing pack complete/);
  assert.ok(result.questions.every((question) => question.ref.includes("Business Plan") || question.ref.includes("Technical")));
  assert.match(result.assistant, /ISO\/IEC/);
});

test("answers to pending questions are mapped without inventing extra fields", () => {
  const first = analyzeTurn({
    lang: "zh",
    messages: [{ role: "user", content: SOFTWARE_INTRO }],
    profile: {},
    pending: []
  });
  const targetKey = first.pending[0];

  const result = analyzeTurn({
    lang: "zh",
    messages: [
      { role: "user", content: SOFTWARE_INTRO },
      { role: "assistant", content: first.assistant },
      { role: "user", content: "这部分目前还没有整理，后续补充。" }
    ],
    profile: first.profile,
    pending: first.pending
  });

  assert.match(result.profile[targetKey], /后续补充/);
  assert.equal(result.profile.projectName, "云账通");
  assert.ok(result.pending.length <= 3);
});

test("skip reply marks pending fields as not available and advances", () => {
  const result = analyzeTurn({
    lang: "zh",
    messages: [{ role: "user", content: "暂无，继续" }],
    profile: { projectName: "云账通", solution: "记账 SaaS" },
    pending: ["problem", "targetMarket"]
  });

  assert.match(result.profile.problem, /暂无/);
  assert.match(result.profile.targetMarket, /暂无/);
  assert.ok(!result.pending.includes("problem"));
  assert.match(result.assistant, /待补充/);
  assert.equal(result.phase, "discovery");
});

test("complete profile becomes ready with no questions", () => {
  const profile = {};
  const keys = [
    "projectName",
    "solution",
    "problem",
    "targetMarket",
    "marketSize",
    "businessModel",
    "traction",
    "competition",
    "team",
    "financials",
    "fundingAsk",
    "roadmap",
    "standardEvidence",
    "ipCompliance",
    "risks",
    "exitStrategy"
  ];
  for (const key of keys) profile[key] = `测试内容 ${key}`;

  const result = analyzeTurn({
    lang: "zh",
    messages: [{ role: "user", content: "全部信息已提供。" }],
    profile,
    pending: []
  });

  assert.equal(result.ready, true);
  assert.equal(result.questions.length, 0);
  assert.equal(result.coverage.percent, 100);
  assert.equal(result.phase, "ready");
  assert.match(result.assistant, /核心信息已覆盖完整/);
});

test("extractFields does not fill a field twice from one intro clause", () => {
  const updates = extractFields("项目叫云账通，按月订阅收费，已有 120 家付费客户，ARR 300 万元。", {});
  assert.equal(updates.projectName, "云账通");
  assert.match(updates.businessModel, /订阅/);
  assert.match(updates.traction, /付费客户/);
  assert.match(updates.financials, /ARR/);
});

test("normalizeProfile ignores unknown keys and whitespace-only values", () => {
  const normalized = normalizeProfile({
    projectName: "  CloudLedger  ",
    email: "ignored@example.com",
    solution: "   ",
    risks: "Risk"
  });
  assert.deepEqual(normalized, { projectName: "CloudLedger", risks: "Risk" });
});

test("coverage sections report per-document progress", () => {
  const coverage = computeCoverage({ projectName: "云账通", solution: "SaaS" });
  assert.equal(coverage.total, 16);
  assert.equal(coverage.filled, 2);
  assert.ok(coverage.sections.find((section) => section.id === "business-plan"));
  assert.ok(coverage.sections.every((section) => section.percent >= 0 && section.percent <= 100));
});
