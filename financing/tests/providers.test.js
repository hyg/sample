import test from "node:test";
import assert from "node:assert/strict";
import {
  ProviderError,
  callProvider,
  listProviders,
  normalizeProviderConfig,
  publicProviderInfo,
  testProvider
} from "../src/providers.js";

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

test("provider catalog exposes public metadata without keys", () => {
  const providers = listProviders();
  assert.equal(providers.length, 12);
  assert.ok(providers.some((provider) => provider.id === "openai"));
  assert.ok(providers.some((provider) => provider.id === "anthropic"));
  assert.ok(providers.some((provider) => provider.id === "gemini"));
  assert.ok(providers.every((provider) => !("apiKey" in provider)));

  const custom = providers.find((provider) => provider.id === "custom");
  assert.equal(custom.requiresBaseUrl, true);

  const deepseek = providers.find((provider) => provider.id === "deepseek");
  assert.equal(deepseek.defaultModel, "deepseek-flash");
  assert.deepEqual(deepseek.models, ["deepseek-flash", "deepseek-v4-pro"]);
});

test("normalizeProviderConfig validates keys, models and custom base URLs", () => {
  const openai = normalizeProviderConfig({ id: "openai", apiKey: "sk-test" });
  assert.equal(openai.baseUrl, "https://api.openai.com/v1");
  assert.equal(openai.model, "gpt-4o-mini");
  assert.equal(openai.api, "openai");

  const legacyDeepSeek = normalizeProviderConfig({
    id: "deepseek",
    apiKey: "sk-test",
    model: "deepseek-reasoner"
  });
  assert.equal(legacyDeepSeek.model, "deepseek-flash");

  assert.throws(
    () => normalizeProviderConfig({ id: "openai" }),
    (error) => error instanceof ProviderError && error.code === "missing_api_key"
  );
  assert.throws(
    () => normalizeProviderConfig({ id: "openai", apiKey: "sk-test", model: "bad model" }),
    (error) => error instanceof ProviderError && error.code === "invalid_model"
  );
  assert.throws(
    () => normalizeProviderConfig({ id: "unknown", apiKey: "sk-test" }),
    (error) => error instanceof ProviderError && error.code === "unknown_provider"
  );
  assert.throws(
    () =>
      normalizeProviderConfig({
        id: "custom",
        apiKey: "sk-test",
        baseUrl: "http://example.com/v1"
      }),
    (error) => error instanceof ProviderError && error.code === "invalid_base_url"
  );
  assert.throws(
    () =>
      normalizeProviderConfig({
        id: "custom",
        apiKey: "sk-test",
        baseUrl: "https://127.0.0.1/v1"
      }),
    (error) => error instanceof ProviderError && error.code === "invalid_base_url"
  );

  const custom = normalizeProviderConfig({
    id: "custom",
    apiKey: "sk-test",
    baseUrl: "https://models.example.com/v1/"
  });
  assert.equal(custom.baseUrl, "https://models.example.com/v1");
  assert.deepEqual(publicProviderInfo(custom), {
    id: "custom",
    name: "Custom OpenAI-compatible",
    model: "gpt-4o-mini"
  });
});

test("OpenAI-compatible calls use Bearer auth and parse message content", async (t) => {
  let captured;
  withMockFetch(t, async (url, options) => {
    captured = { url: String(url), options };
    return jsonResponse({ choices: [{ message: { content: "hello from model" } }] });
  });

  const config = normalizeProviderConfig({
    id: "custom",
    apiKey: "sk-secret",
    baseUrl: "https://models.example.com/v1",
    model: "custom-model"
  });
  const text = await callProvider(config, { system: "sys", user: "hi", maxTokens: 99 });

  assert.equal(text, "hello from model");
  assert.equal(captured.url, "https://models.example.com/v1/chat/completions");
  assert.equal(captured.options.headers.authorization, "Bearer sk-secret");
  assert.ok(!captured.url.includes("sk-secret"));
  const body = JSON.parse(captured.options.body);
  assert.equal(body.model, "custom-model");
  assert.equal(body.max_tokens, 99);
  assert.deepEqual(body.messages, [
    { role: "system", content: "sys" },
    { role: "user", content: "hi" }
  ]);
});

test("Anthropic calls use x-api-key and return text blocks", async (t) => {
  let captured;
  withMockFetch(t, async (url, options) => {
    captured = { url: String(url), options };
    return jsonResponse({
      content: [
        { type: "text", text: "part one " },
        { type: "text", text: "part two" }
      ]
    });
  });

  const config = normalizeProviderConfig({ id: "anthropic", apiKey: "sk-ant-test" });
  const text = await callProvider(config, { system: "sys", user: "hi" });

  assert.equal(text, "part one part two");
  assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
  assert.equal(captured.options.headers["x-api-key"], "sk-ant-test");
  assert.equal(captured.options.headers["anthropic-version"], "2023-06-01");
  const body = JSON.parse(captured.options.body);
  assert.equal(body.system, "sys");
  assert.deepEqual(body.messages, [{ role: "user", content: "hi" }]);
});

test("Gemini calls send the key in a header and parse candidates", async (t) => {
  let captured;
  withMockFetch(t, async (url, options) => {
    captured = { url: String(url), options };
    return jsonResponse({
      candidates: [{ content: { parts: [{ text: "gemini text" }] } }]
    });
  });

  const config = normalizeProviderConfig({ id: "gemini", apiKey: "AIzaSecret" });
  const text = await callProvider(config, { system: "sys", user: "hi" });

  assert.equal(text, "gemini text");
  assert.match(captured.url, /\/models\/gemini-2\.0-flash:generateContent$/);
  assert.equal(captured.options.headers["x-goog-api-key"], "AIzaSecret");
  assert.ok(!captured.url.includes("AIzaSecret"));
  const body = JSON.parse(captured.options.body);
  assert.equal(body.systemInstruction.parts[0].text, "sys");
  assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "hi" }] }]);
});

test("provider errors are mapped and API keys are redacted", async (t) => {
  withMockFetch(t, async () =>
    new Response("leaked sk-secret and sk-secret again", {
      status: 401,
      headers: { "content-type": "text/plain" }
    })
  );

  const config = normalizeProviderConfig({ id: "openai", apiKey: "sk-secret" });
  await assert.rejects(
    () => callProvider(config, { user: "hi" }),
    (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "auth_error");
      assert.equal(error.status, 502);
      assert.match(error.message, /\[redacted\]/);
      assert.ok(!error.message.includes("sk-secret"));
      return true;
    }
  );
});

test("DeepSeek requests disable thinking for structured output", async (t) => {
  let captured;
  withMockFetch(t, async (url, options) => {
    captured = { url: String(url), options };
    return jsonResponse({ choices: [{ message: { content: "OK" }, finish_reason: "stop" }] });
  });

  const config = normalizeProviderConfig({ id: "deepseek", apiKey: "sk-test" });
  const text = await callProvider(config, { system: "sys", user: "hi", maxTokens: 2400 });

  assert.equal(text, "OK");
  assert.equal(captured.url, "https://api.deepseek.com/v1/chat/completions");
  const body = JSON.parse(captured.options.body);
  assert.equal(body.model, "deepseek-flash");
  assert.equal(body.max_tokens, 2400);
  assert.deepEqual(body.thinking, { type: "disabled" });
});

test("DeepSeek empty final content reports reasoning diagnostics", async (t) => {
  withMockFetch(t, async () =>
    jsonResponse({
      model: "deepseek-flash",
      choices: [
        {
          finish_reason: "length",
          message: { content: "", reasoning_content: "private reasoning" }
        }
      ],
      usage: {
        completion_tokens: 2400,
        completion_tokens_details: { reasoning_tokens: 2400 }
      }
    })
  );

  const config = normalizeProviderConfig({ id: "deepseek", apiKey: "sk-test" });
  await assert.rejects(
    () => callProvider(config, { user: "hi", maxTokens: 2400 }),
    (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "empty_response");
      assert.match(error.message, /used for reasoning/);
      assert.deepEqual(error.details, {
        model: "deepseek-flash",
        finishReason: "length",
        completionTokens: 2400,
        reasoningTokens: 2400,
        maxTokens: 2400,
        hasReasoning: true
      });
      assert.ok(!JSON.stringify(error.details).includes("private reasoning"));
      return true;
    }
  );
});

test("empty content with finish_reason=length reports the output budget", async (t) => {
  withMockFetch(t, async () =>
    jsonResponse({
      choices: [{ finish_reason: "length", message: { content: "" } }],
      usage: { completion_tokens: 128 }
    })
  );

  const config = normalizeProviderConfig({ id: "openai", apiKey: "sk-test" });
  await assert.rejects(
    () => callProvider(config, { user: "hi", maxTokens: 128 }),
    (error) => {
      assert.equal(error.code, "empty_response");
      assert.match(error.message, /128-token output limit/);
      return true;
    }
  );
});

test("testProvider returns a short sample", async (t) => {
  let captured;
  withMockFetch(t, async (url, options) => {
    captured = { url, options };
    return jsonResponse({ choices: [{ message: { content: "OK" } }] });
  });
  const config = normalizeProviderConfig({ id: "openai", apiKey: "sk-test" });
  const result = await testProvider(config);
  assert.deepEqual(result, {
    ok: true,
    provider: "OpenAI",
    model: "gpt-4o-mini",
    sample: "OK"
  });
  const body = JSON.parse(captured.options.body);
  assert.equal(body.max_tokens, 128);
});
