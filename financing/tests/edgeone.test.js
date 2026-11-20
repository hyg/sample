import assert from "node:assert/strict";
import test from "node:test";
import onRequest from "../src/edgeone.js";

test("EdgeOne adapter serves the health endpoint", async () => {
  const response = await onRequest({
    request: new Request("https://example.test/api/health"),
    env: { DEMO_ENABLED: "true" }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.demo, true);
});

function withMockAi(t, handler) {
  const hadAi = Object.prototype.hasOwnProperty.call(globalThis, "AI");
  const original = globalThis.AI;
  globalThis.AI = { chatCompletions: handler };
  t.after(() => {
    if (hadAi) globalThis.AI = original;
    else delete globalThis.AI;
  });
}

test("EdgeOne adapter uses EdgeOne AI by default when available", async (t) => {
  let captured;
  withMockAi(t, async (payload) => {
    captured = payload;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "请介绍项目的融资计划。",
                profile: { projectName: "云账通" },
                productType: "saas",
                standardId: "software-25010",
                questions: []
              })
            },
            finish_reason: "stop"
          }
        ]
      })
    );
  });

  const response = await onRequest({
    request: new Request("https://example.test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang: "zh",
        messages: [{ role: "user", content: "我们做中小企业财务 SaaS。" }]
      })
    }),
    env: {}
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.edgeAi, true);
  assert.equal(data.demo, false);
  assert.equal(data.provider.id, "edgeone-ai");
  assert.equal(data.provider.model, "@tx/deepseek-ai/deepseek-v3-0324");
  assert.equal(captured.model, "@tx/deepseek-ai/deepseek-v3-0324");
});

test("EdgeOne adapter surfaces free-quota exhaustion", async (t) => {
  withMockAi(t, async () => {
    throw new Error(JSON.stringify({ code: 14020, message: "daily public quota exhausted" }));
  });

  const response = await onRequest({
    request: new Request("https://example.test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang: "zh",
        messages: [{ role: "user", content: "我们做中小企业财务 SaaS。" }]
      })
    }),
    env: {}
  });

  assert.equal(response.status, 429);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, "edge_ai_quota_exhausted");
});

test("EdgeOne adapter applies demo mode without environment variables", async () => {
  const response = await onRequest({
    request: new Request("https://example.test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang: "zh",
        messages: [{ role: "user", content: "我们做 AI 软件，需要融资。" }]
      })
    }),
    env: {}
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.demo, true);
  assert.equal(data.mode, "rules");
});
