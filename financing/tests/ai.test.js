import test from "node:test";
import assert from "node:assert/strict";
import {
  DOCUMENT_GROUPS,
  buildDocumentPrompt,
  buildInterviewPrompt,
  generateDocumentsWithProvider,
  interviewWithProvider,
  listDocumentGroups,
  normalizeAiProfile,
  normalizeProductType,
  parseDocumentTags,
  parseInterviewResponse
} from "../src/ai.js";
import { normalizeProviderConfig } from "../src/providers.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function withMockFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = original;
  });
}

function openAiContent(text) {
  return { choices: [{ message: { content: text } }] };
}

const SOFTWARE_STANDARD = {
  primary: { code: "ISO/IEC 25010:2023", name: "Systems and software quality" },
  national: { code: "GB/T 25000.10-2016", name: "系统与软件质量" },
  rationale: "软件产品质量评估"
};

test("parseInterviewResponse extracts JSON and sanitizes fields", () => {
  const parsed = parseInterviewResponse(`Here is the JSON:
\`\`\`json
{
  "reply": "  Thanks, noted.  ",
  "productType": "SaaS platform",
  "standardId": "software-25010",
  "standardRationale": "依据产品质量标准。",
  "detectedLanguage": "zh",
  "detectedLanguageLabel": "中文",
  "profile": {
    "projectName": "云账通",
    "targetMarket": "中小企业",
    "unknownField": "drop me",
    "risks": ["合规风险", "数据风险"],
    "oneLiner": { "text": "财务 SaaS" }
  },
  "questions": [
    { "field": "team", "text": "核心团队是谁？" },
    { "field": "team", "text": "重复问题" },
    { "field": "bogus", "text": "ignore" },
    { "field": "financials", "text": "财务预测？" }
  ]
}
\`\`\``);

  assert.equal(parsed.reply, "Thanks, noted.");
  assert.equal(parsed.productType, "software");
  assert.equal(parsed.standardId, "software-25010");
  assert.equal(parsed.detectedLanguage, "zh");
  assert.equal(parsed.detectedLanguageLabel, "中文");
  assert.deepEqual(parsed.profile, {
    projectName: "云账通",
    targetMarket: "中小企业",
    risks: "合规风险；数据风险",
    oneLiner: "财务 SaaS"
  });
  assert.deepEqual(parsed.questions, [
    { field: "team", text: "核心团队是谁？" },
    { field: "financials", text: "财务预测？" }
  ]);
});

test("parseInterviewResponse rejects invalid output and unknown standards", () => {
  assert.equal(parseInterviewResponse("not json"), null);
  const parsed = parseInterviewResponse('{"reply":"ok","standardId":"invented","questions":[]}');
  assert.equal(parsed.standardId, "");
  assert.deepEqual(parsed.questions, []);
});

test("normalizeAiProfile and normalizeProductType are defensive", () => {
  assert.deepEqual(normalizeAiProfile(null), {});
  assert.deepEqual(normalizeAiProfile(["not", "an", "object"]), {});
  assert.equal(normalizeProductType("AI agent platform"), "ai");
  assert.equal(normalizeProductType("medical device"), "medical");
  assert.equal(normalizeProductType("unknown"), "other");
  assert.equal(normalizeProductType(null), "");
});

test("buildInterviewPrompt includes target language, missing fields and standard catalog", () => {
  const prompt = buildInterviewPrompt({
    lang: "other",
    languageLabel: "日本語",
    messages: [{ role: "user", content: "プロジェクトの説明です。" }],
    profile: { projectName: "テスト" },
    pending: ["team"],
    standard: SOFTWARE_STANDARD
  });

  assert.match(prompt.system, /Return ONLY one valid JSON object/);
  assert.match(prompt.system, /Write every user-facing value .* in 日本語/);
  assert.match(prompt.system, /software-25010/);
  assert.match(prompt.system, /ai-42001/);
  assert.match(prompt.user, /Target language: 日本語/);
  assert.match(prompt.user, /Fields currently being asked.*\["team"\]/s);
  assert.match(prompt.user, /ISO\/IEC 25010:2023/);
});

test("parseDocumentTags accepts known ids and ignores overview or unknown ids", () => {
  const documents = parseDocumentTags(`
<DOCUMENT id="summary">
# Summary
</DOCUMENT>
<DOCUMENT id="overview"># must be ignored</DOCUMENT>
<DOCUMENT id="unknown"># nope</DOCUMENT>
<DOCUMENT id="risk">
\`\`\`markdown
# Risk\n\nDetails
\`\`\`
</DOCUMENT>
`);

  assert.deepEqual(Object.keys(documents).sort(), ["risk", "summary"]);
  assert.equal(documents.summary, "# Summary");
  assert.equal(documents.risk, "# Risk\n\nDetails");
  assert.deepEqual(parseDocumentTags(null), {});
});

test("document groups cover the eight AI documents", () => {
  assert.deepEqual(listDocumentGroups(), [
    ["summary", "business-plan", "market"],
    ["pitch-deck", "financials", "technical"],
    ["risk", "data-room"]
  ]);
  assert.equal(DOCUMENT_GROUPS.flat().length, 8);
});

test("buildDocumentPrompt requests only allowed ids in the target language", () => {
  const prompt = buildDocumentPrompt({
    lang: "en",
    profile: { projectName: "Acme" },
    standard: SOFTWARE_STANDARD,
    messages: [],
    docs: [
      { id: "summary", zhTitle: "摘要", enTitle: "Summary", zhDesc: "概述", enDesc: "Overview" },
      { id: "risk", zhTitle: "风险", enTitle: "Risk", zhDesc: "风险清单", enDesc: "Risk list" }
    ]
  });

  assert.match(prompt.system, /Write every user-facing value .* in English/);
  assert.match(prompt.user, /Project profile/);
  assert.match(prompt.user, /id="summary"/);
  assert.match(prompt.user, /id="risk"/);
  assert.match(prompt.user, /ISO\/IEC 25010:2023/);
  assert.match(prompt.user, /Write these 2 documents/);
});

test("interviewWithProvider parses a mocked OpenAI-compatible response", async (t) => {
  let captured;
  withMockFetch(t, async (url, options) => {
    captured = { url, options };
    return jsonResponse(
      openAiContent(
        JSON.stringify({
          reply: "ありがとうございます。",
          productType: "software",
          standardId: "software-25010",
          standardRationale: "ソフトウェア品質に適合。",
          detectedLanguage: "other",
          detectedLanguageLabel: "日本語",
          profile: { projectName: "テスト" },
          questions: [{ field: "team", text: "チームは？" }]
        })
      )
    );
  });

  const config = normalizeProviderConfig({ id: "openai", apiKey: "sk-test" });
  const result = await interviewWithProvider(config, {
    lang: "other",
    languageLabel: "日本語",
    messages: [{ role: "user", content: "テスト" }],
    profile: {}
  });

  assert.equal(result.reply, "ありがとうございます。");
  assert.equal(result.productType, "software");
  assert.equal(result.detectedLanguageLabel, "日本語");
  assert.deepEqual(result.profile, { projectName: "テスト" });
  assert.deepEqual(result.questions, [{ field: "team", text: "チームは？" }]);
  assert.equal(JSON.parse(captured.options.body).max_tokens, 2400);
});

test("generateDocumentsWithProvider merges documents from all groups", async (t) => {
  let calls = 0;
  const tokenBudgets = [];
  withMockFetch(t, async (url, options) => {
    calls += 1;
    const body = JSON.parse(options.body);
    tokenBudgets.push(body.max_tokens);
    const user = body.messages.at(-1).content;
    const ids = [...user.matchAll(/^- id="([a-z0-9-]+)"/gm)].map((match) => match[1]);
    const blocks = ids
      .map((id) => `<DOCUMENT id="${id}"># ${id}\n\nContent for ${id}</DOCUMENT>`)
      .join("\n");
    return jsonResponse(openAiContent(blocks));
  });

  const config = normalizeProviderConfig({ id: "openai", apiKey: "sk-test" });
  const result = await generateDocumentsWithProvider(config, {
    lang: "en",
    profile: { projectName: "Acme" },
    standard: SOFTWARE_STANDARD
  });

  assert.equal(calls, 3);
  assert.deepEqual(tokenBudgets, [8000, 8000, 8000]);
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(Object.keys(result.documents).sort(), DOCUMENT_GROUPS.flat().sort());
  assert.equal(result.documents["business-plan"], "# business-plan\n\nContent for business-plan");
});

test("generateDocumentsWithProvider keeps partial results and reports warnings", async (t) => {
  withMockFetch(t, async (url, options) => {
    const body = JSON.parse(options.body);
    const user = body.messages.at(-1).content;
    const ids = [...user.matchAll(/^- id="([a-z0-9-]+)"/gm)].map((match) => match[1]);
    if (ids.includes("risk")) {
      return jsonResponse({ error: { message: "quota exhausted" } }, 429);
    }
    const blocks = ids
      .map((id) => `<DOCUMENT id="${id}"># ${id}</DOCUMENT>`)
      .join("\n");
    return jsonResponse(openAiContent(blocks));
  });

  const config = normalizeProviderConfig({ id: "openai", apiKey: "sk-test" });
  const result = await generateDocumentsWithProvider(config, {
    lang: "en",
    profile: { projectName: "Acme" },
    standard: SOFTWARE_STANDARD
  });

  assert.equal(Object.keys(result.documents).length, 6);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /quota exhausted/);
  assert.ok(!("risk" in result.documents));
  assert.ok(!("data-room" in result.documents));
});
