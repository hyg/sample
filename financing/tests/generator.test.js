import test from "node:test";
import assert from "node:assert/strict";
import { selectStandard } from "../src/standards.js";
import { analyzeTurn } from "../src/engine.js";
import { generateMaterials } from "../src/generator.js";

function buildSample(lang = "zh") {
  const intro =
    lang === "en"
      ? "Our project is FlowLedger, a SaaS platform automating bookkeeping for SMEs. We charge a monthly subscription and have 40 paying customers with USD 300K ARR. The team has 12 people and we are raising USD 2M."
      : "项目叫云账通，我们为中小企业提供财务记账 SaaS 平台，解决手工记账低效的问题，按月订阅收费，已有 120 家付费客户，ARR 300 万元，团队 18 人，本轮计划融资 800 万元，出让 12% 股权。";
  const analysis = analyzeTurn({
    lang,
    messages: [{ role: "user", content: intro }],
    profile: {},
    pending: []
  });
  return analysis;
}

test("Chinese pack contains nine connected materials", () => {
  const analysis = buildSample("zh");
  const result = generateMaterials({
    profile: analysis.profile,
    standard: analysis.standard,
    lang: "zh",
    messages: []
  });

  assert.equal(result.materials.length, 9);
  assert.equal(new Set(result.materials.map((material) => material.filename)).size, 9);
  assert.equal(result.meta.projectName, "云账通");
  assert.match(result.meta.standardCode, /ISO/);
  assert.ok(result.materials.every((material) => material.markdown.includes("云账通")));
  assert.ok(result.materials.every((material) => material.markdown.length > 500));

  const summary = result.materials.find((material) => material.id === "summary");
  assert.match(summary.markdown, /一页纸融资摘要/);
  assert.match(summary.markdown, /项目：/);
  assert.match(summary.markdown, /标准依据/);

  const plan = result.materials.find((material) => material.id === "business-plan");
  assert.match(plan.markdown, /商业计划书/);
  assert.match(plan.markdown, /TAM/);
  assert.match(plan.markdown, /资金用途/);

  const technical = result.materials.find((material) => material.id === "technical");
  assert.match(technical.markdown, /ISO\/IEC/);
  assert.match(technical.markdown, /GB\/T/);
  assert.match(technical.markdown, /标准关注维度/);

  const dataRoom = result.materials.find((material) => material.id === "data-room");
  assert.match(dataRoom.markdown, /数据室/);
  assert.match(dataRoom.markdown, /\[ \]/);
});

test("English pack is fully localised and marks missing data as TBD", () => {
  const analysis = buildSample("en");
  analysis.profile.team = "";
  const result = generateMaterials({
    profile: analysis.profile,
    standard: analysis.standard,
    lang: "en",
    messages: []
  });

  assert.equal(result.materials.length, 9);
  assert.equal(result.meta.language, "en");
  assert.equal(result.meta.projectName, "FlowLedger");
  assert.ok(result.materials.every((material) => /^[0-9]{2}-[a-z0-9-]+\.md$/.test(material.filename)));
  const plan = result.materials.find((material) => material.id === "business-plan");
  assert.match(plan.markdown, /Business Plan/);
  assert.match(plan.markdown, /TBD/);
  assert.match(plan.markdown, /FlowLedger/);
  assert.doesNotMatch(plan.markdown, /待补充/);

  const overview = result.materials.find((material) => material.id === "overview");
  assert.match(overview.markdown, /Funding Pack Overview/);
  assert.match(overview.markdown, /Business Plan/);
});

test("funding allocation is calculated from the stated round size", () => {
  const analysis = buildSample("zh");
  const result = generateMaterials({
    profile: analysis.profile,
    standard: analysis.standard,
    lang: "zh",
    messages: []
  });
  const financials = result.materials.find((material) => material.id === "financials");
  assert.match(financials.markdown, /200 万元/);
  assert.match(financials.markdown, /25%/);
  assert.match(financials.markdown, /资金用途/);
});

test("missing project name is handled with localised fallback", () => {
  const standard = selectStandard({ lang: "en" });
  const result = generateMaterials({
    profile: {},
    standard,
    lang: "en",
    messages: []
  });
  assert.equal(result.meta.projectName, "Untitled Project");
  assert.ok(result.materials.every((material) => !material.markdown.includes("undefined")));
  assert.ok(result.materials.every((material) => !material.markdown.includes("[object Object]")));
});

test("standards are reflected in technical due diligence", () => {
  const standard = selectStandard({
    lang: "zh",
    messages: [
      {
        role: "user",
        content: "我们研发医疗器械软件，正在进行二类医疗器械注册和 ISO 13485 体系建设。"
      }
    ]
  });
  const result = generateMaterials({
    profile: { projectName: "心卫士", solution: "心电监测设备" },
    standard,
    lang: "zh",
    messages: []
  });
  const technical = result.materials.find((material) => material.id === "technical");
  assert.match(technical.markdown, /ISO 13485/);
  assert.match(technical.markdown, /GB\/T 42061/);
  assert.match(technical.markdown, /医疗器械/);
});
