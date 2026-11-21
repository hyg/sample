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
  assert.equal(data.provider.model, "@tx/deepseek-ai/deepseek-v4");
  assert.equal(captured.model, "@tx/deepseek-ai/deepseek-v4");
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

function withMockFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = original;
  });
}

test("EdgeOne adapter generates with Makers Models when gateway env is set", async (t) => {
  withMockAi(t, async () => {
    throw new Error("Edge AI must not be used for generation when the gateway is configured");
  });
  let captured;
  withMockFetch(t, async (url, options) => {
    captured = { url, options };
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: '<DOCUMENT id="summary">\n# Summary\n\nGateway body.\n</DOCUMENT>'
            },
            finish_reason: "stop"
          }
        ]
      })
    );
  });

  const response = await onRequest({
    request: new Request("https://example.test/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang: "en",
        messages: [{ role: "user", content: "We build a SaaS platform for SMB accounting." }],
        profile: { projectName: "CloudLedger", solution: "SMB accounting SaaS" },
        docs: ["summary"]
      })
    }),
    env: {
      AI_GATEWAY_API_KEY: "test-key",
      AI_GATEWAY_BASE_URL: "https://gateway.example.test/v1"
    }
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.mode, "ai");
  assert.equal(data.edgeAi, true);
  assert.equal(data.provider.id, "makers-models");
  assert.equal(data.provider.model, "@makers/deepseek-v4-flash");
  assert.match(data.materials.find((item) => item.id === "summary").markdown, /Gateway body/);
  assert.equal(captured.url, "https://gateway.example.test/v1/chat/completions");
  assert.equal(JSON.parse(captured.options.body).model, "@makers/deepseek-v4-flash");
});

test("EdgeOne adapter falls back to Makers Models for chat when Edge AI errors", async (t) => {
  withMockAi(t, async () => {
    throw new Error("inference internal error");
  });
  let captured;
  withMockFetch(t, async (url, options) => {
    captured = { url, options };
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "Thanks. Please share your target market and traction.",
                profile: { projectName: "CloudLedger" },
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
        lang: "en",
        messages: [{ role: "user", content: "We build an SMB accounting SaaS." }]
      })
    }),
    env: {
      AI_GATEWAY_API_KEY: "test-key",
      AI_GATEWAY_BASE_URL: "https://gateway.example.test/v1"
    }
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.mode, "ai");
  assert.equal(data.edgeAi, false);
  assert.equal(data.provider.id, "makers-models");
  assert.equal(data.provider.model, "@makers/deepseek-v4-flash");
  assert.match(data.warnings.join(" "), /Makers Models/);
  assert.equal(captured.url, "https://gateway.example.test/v1/chat/completions");
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
