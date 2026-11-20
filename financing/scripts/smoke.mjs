import assert from "node:assert/strict";
import { unzipSync } from "fflate";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const entryQuery = (process.env.SMOKE_QUERY || "").replace(/^\?/, "");
const useEdgeAi = process.env.SMOKE_EDGE_AI === "1";
const useEdgeAiGenerate = process.env.SMOKE_EDGE_AI_GENERATE === "1";
let cookieHeader = "";

async function bootstrapCookies() {
  if (!entryQuery) return;
  const response = await fetch(`${baseUrl}/?${entryQuery}`, { redirect: "manual" });
  const cookies = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  cookieHeader = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  if (!cookieHeader) {
    throw new Error(`Preview entry did not set cookies (HTTP ${response.status}).`);
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookieHeader) headers.set("cookie", cookieHeader);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  }
  return response;
}

async function postJson(path, body) {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

await bootstrapCookies();
const health = await (await request("/api/health")).json();
assert.equal(health.ok, true);
console.log(`health ok: v${health.version}, demo=${health.demo}`);

const providers = await (await request("/api/providers")).json();
assert.ok(Array.isArray(providers.providers) && providers.providers.length > 0);
console.log(`providers ok: ${providers.providers.length}`);

const intro = {
  lang: "zh",
  ...(useEdgeAi ? {} : { demo: true }),
  messages: [
    {
      role: "user",
      content:
        "项目叫云账通，我们为中小企业提供财务记账 SaaS 平台，解决手工记账低效的问题，按月订阅收费，已有 120 家付费客户，ARR 300 万元，团队 18 人，本轮计划融资 800 万元，出让 12% 股权。"
    }
  ],
  profile: {},
  pending: []
};

const chat = await (await postJson("/api/chat", intro)).json();
assert.equal(chat.standard.id, "software-25010");
assert.ok(chat.questions.length >= 1);
if (useEdgeAi) {
  assert.equal(chat.edgeAi, true);
  assert.equal(chat.provider.id, "edgeone-ai");
}
console.log(
  `chat ok: ${chat.standard.primary.code}, ${chat.questions.length} questions, edgeAi=${chat.edgeAi === true}`
);

const generated = await (
  await postJson("/api/generate", {
    ...intro,
    ...(useEdgeAiGenerate ? {} : { demo: true }),
    standardId: chat.standard.id,
    productType: chat.productType
  })
).json();
assert.equal(generated.ok, true);
assert.equal(generated.materials.length, 9);
assert.equal(generated.meta.standardCode, chat.standard.primary.code);
if (useEdgeAiGenerate) {
  assert.equal(generated.edgeAi, true);
  assert.equal(generated.mode, "ai");
}
console.log(`generate ok: ${generated.materials.length} materials, mode=${generated.mode}`);

const archive = await (
  await postJson("/api/export", {
    lang: "zh",
    materials: generated.materials,
    meta: generated.meta
  })
).arrayBuffer();
const files = Object.keys(unzipSync(new Uint8Array(archive)));
assert.equal(files.length, 10);
assert.ok(files.includes("funding-pack/README.txt"));
console.log(`export ok: ${files.length} files`);
console.log("smoke passed");
