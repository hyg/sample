const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    api: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys"
  },
  {
    id: "anthropic",
    name: "Anthropic",
    api: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-latest",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-sonnet-4-20250514"],
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    api: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-flash",
    models: ["deepseek-flash", "deepseek-v4-pro"],
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    api: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"],
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey"
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    api: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "deepseek/deepseek-chat"],
    keyPlaceholder: "sk-or-...",
    docsUrl: "https://openrouter.ai/keys"
  },
  {
    id: "dashscope",
    name: "Alibaba DashScope (Qwen)",
    api: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
    keyPlaceholder: "sk-...",
    docsUrl: "https://bailian.console.aliyun.com/"
  },
  {
    id: "moonshot",
    name: "Moonshot / Kimi",
    api: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "kimi-k2-0711-preview"],
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.moonshot.cn/console/api-keys"
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    api: "openai",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct", "deepseek-ai/DeepSeek-R1"],
    keyPlaceholder: "sk-...",
    docsUrl: "https://cloud.siliconflow.cn/account/ak"
  },
  {
    id: "groq",
    name: "Groq",
    api: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    keyPlaceholder: "gsk_...",
    docsUrl: "https://console.groq.com/keys"
  },
  {
    id: "mistral",
    name: "Mistral AI",
    api: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    models: ["mistral-large-latest", "mistral-small-latest"],
    keyPlaceholder: "...",
    docsUrl: "https://console.mistral.ai/api-keys"
  },
  {
    id: "xai",
    name: "xAI",
    api: "openai",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-2-latest",
    models: ["grok-2-latest", "grok-beta"],
    keyPlaceholder: "xai-...",
    docsUrl: "https://console.x.ai/"
  },
  {
    id: "custom",
    name: "Custom OpenAI-compatible",
    api: "openai",
    baseUrl: "",
    defaultModel: "gpt-4o-mini",
    models: [],
    keyPlaceholder: "API key",
    docsUrl: "",
    requiresBaseUrl: true
  }
];

const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map((provider) => [provider.id, provider]));

export const EDGE_AI_DEFAULT_MODEL = "@tx/deepseek-ai/deepseek-v4";
export const EDGE_AI_MODELS = [
  EDGE_AI_DEFAULT_MODEL,
  "@tx/deepseek-ai/deepseek-v32",
  "@tx/deepseek-ai/deepseek-v3-0324",
  "@tx/deepseek-ai/deepseek-r1-0528",
  "@tx/deepseek-ai/deepseek-r1-distill-qwen-32b"
];
export const EDGE_AI_GENERATION_MODEL = "@tx/deepseek-ai/deepseek-r1-distill-qwen-32b";
export const MAKERS_MODELS_MODEL = "@makers/deepseek-v4-flash";
export const EDGE_AI_DOCS_URL = "https://pages.edgeone.ai/zh/document/edge-ai";

export function makersModelsAvailable(env) {
  return Boolean(env && typeof env.AI_GATEWAY_API_KEY === "string" && env.AI_GATEWAY_API_KEY.trim());
}

export function makersModelsConfig(env) {
  const baseUrl = String((env && env.AI_GATEWAY_BASE_URL) || "https://ai-gateway.edgeone.link/v1").replace(/\/+$/, "");
  return {
    id: "makers-models",
    name: "EdgeOne Makers Models",
    api: "openai",
    baseUrl,
    model: MAKERS_MODELS_MODEL,
    apiKey: String(env.AI_GATEWAY_API_KEY || "").trim(),
    free: true
  };
}

export function edgeOneAiAvailable() {
  const ai = globalThis.AI;
  return Boolean(ai && typeof ai.chatCompletions === "function");
}

export function edgeOneAiConfig(model = EDGE_AI_DEFAULT_MODEL) {
  return {
    id: "edgeone-ai",
    name: "EdgeOne AI",
    api: "edgeone",
    baseUrl: "",
    model: EDGE_AI_MODELS.includes(model) ? model : EDGE_AI_DEFAULT_MODEL,
    apiKey: "",
    free: true
  };
}

export function edgeOneAiInfo() {
  return {
    id: "edgeone-ai",
    name: "EdgeOne AI",
    available: edgeOneAiAvailable(),
    defaultModel: EDGE_AI_DEFAULT_MODEL,
    generationModel: EDGE_AI_GENERATION_MODEL,
    models: EDGE_AI_MODELS,
    docsUrl: EDGE_AI_DOCS_URL
  };
}

export class ProviderError extends Error {
  constructor(
    message,
    { status = 502, code = "provider_error", provider = "model provider", details = null } = {}
  ) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
    this.provider = provider;
    this.details = details;
  }
}

export function listProviders() {
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    api: provider.api,
    defaultModel: provider.defaultModel,
    models: provider.models,
    keyPlaceholder: provider.keyPlaceholder,
    docsUrl: provider.docsUrl,
    requiresBaseUrl: Boolean(provider.requiresBaseUrl)
  }));
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(host)) return true;
  if (/^fe80:/i.test(host)) return true;
  return false;
}

function validateBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new ProviderError("Custom base URL is invalid.", { status: 400, code: "invalid_base_url" });
  }
  if (url.protocol !== "https:") {
    throw new ProviderError("Custom base URL must use HTTPS.", { status: 400, code: "invalid_base_url" });
  }
  if (url.username || url.password) {
    throw new ProviderError("Custom base URL must not contain credentials.", { status: 400, code: "invalid_base_url" });
  }
  if (isPrivateHost(url.hostname)) {
    throw new ProviderError("Custom base URL cannot target a private or local address.", {
      status: 400,
      code: "invalid_base_url"
    });
  }
  return url.toString().replace(/\/+$/, "");
}

export function normalizeProviderConfig(raw, { requireKey = true } = {}) {
  if (!raw || typeof raw !== "object") {
    throw new ProviderError("Please choose a model provider.", { status: 400, code: "missing_provider" });
  }
  const def = PROVIDER_MAP[String(raw.id || "")];
  if (!def) {
    throw new ProviderError("Unknown model provider.", { status: 400, code: "unknown_provider" });
  }

  const apiKey = String(raw.apiKey || "").trim();
  if (requireKey && !apiKey) {
    throw new ProviderError(`${def.name} API key is required.`, { status: 400, code: "missing_api_key" });
  }
  if (apiKey.length > 5000) {
    throw new ProviderError("API key is too long.", { status: 400, code: "invalid_api_key" });
  }

  let model = String(raw.model || def.defaultModel || "").trim();
  if (!model) {
    throw new ProviderError("Model name is required.", { status: 400, code: "missing_model" });
  }
  if (def.id === "deepseek") {
    const aliases = {
      "deepseek-chat": "deepseek-flash",
      "deepseek-reasoner": "deepseek-flash",
      "deepseek-v4-flash": "deepseek-flash"
    };
    model = aliases[model] || model;
  }
  if (model.length > 160 || !/^[A-Za-z0-9._:/@-]+$/.test(model)) {
    throw new ProviderError("Model name contains unsupported characters.", { status: 400, code: "invalid_model" });
  }

  const baseUrl = def.requiresBaseUrl ? validateBaseUrl(raw.baseUrl) : def.baseUrl;

  return {
    id: def.id,
    name: def.name,
    api: def.api,
    baseUrl,
    model,
    apiKey
  };
}

export function publicProviderInfo(config) {
  if (!config) return null;
  return {
    id: config.id,
    name: config.name,
    model: config.model
  };
}

function redact(text, apiKey) {
  let value = String(text || "");
  if (apiKey) value = value.split(apiKey).join("[redacted]");
  return value.replace(/\s+/g, " ").trim().slice(0, 400);
}

async function readProviderError(response, config) {
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "";
  }
  let message = "";
  try {
    const parsed = JSON.parse(body);
    message =
      (parsed && parsed.error && (parsed.error.message || parsed.error)) ||
      (parsed && (parsed.message || parsed.detail)) ||
      "";
    if (typeof message !== "string") message = JSON.stringify(message);
  } catch {
    message = body;
  }
  message = redact(message, config.apiKey) || `HTTP ${response.status}`;

  let code = "provider_error";
  if (response.status === 401 || response.status === 403) code = "auth_error";
  else if (response.status === 429) code = "rate_limit";
  else if (response.status === 400) code = "bad_request";
  else if (response.status >= 500) code = "upstream_error";

  return new ProviderError(`${config.name} returned ${response.status}: ${message}`, {
    status: response.status === 429 ? 429 : 502,
    code,
    provider: config.name
  });
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const eoTimeout = Math.max(1000, Math.min(timeoutMs, 300000));
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      eo: {
        timeoutSetting: {
          connectTimeout: Math.min(eoTimeout, 15000),
          readTimeout: eoTimeout,
          writeTimeout: Math.min(eoTimeout, 30000)
        }
      }
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new ProviderError("The model provider request timed out. Please retry.", {
        status: 504,
        code: "timeout"
      });
    }
    throw new ProviderError(`Could not reach the model provider: ${redact(error && error.message)}`, {
      status: 502,
      code: "network_error"
    });
  } finally {
    clearTimeout(timer);
  }
}

function openAiCompatiblePayload(config, system, user, maxTokens, temperature) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });
  const payload = {
    model: config.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false
  };
  if (config.id === "deepseek") {
    payload.thinking = { type: "disabled" };
  }
  return payload;
}

function extractOpenAiText(data) {
  const message = data && data.choices && data.choices[0] && data.choices[0].message;
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === "string" ? part : part && part.text ? part.text : ""))
      .join("");
  }
  return "";
}

function openAiResponseDetails(data, config, maxTokens) {
  const choice = data && data.choices && data.choices[0];
  const message = (choice && choice.message) || {};
  const usage = (data && data.usage) || {};
  const tokenDetails = usage.completion_tokens_details || {};
  const completionTokens = Number(usage.completion_tokens || 0);
  const reasoningTokens = Number(tokenDetails.reasoning_tokens || 0);
  return {
    model: String((data && data.model) || config.model || "").slice(0, 120),
    finishReason: String((choice && choice.finish_reason) || "").slice(0, 40),
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    reasoningTokens: Number.isFinite(reasoningTokens) ? reasoningTokens : 0,
    maxTokens,
    hasReasoning: typeof message.reasoning_content === "string" && message.reasoning_content.trim().length > 0
  };
}

function emptyOpenAiResponseError(config, details) {
  let message;
  if (details.finishReason === "length" && details.reasoningTokens > 0) {
    message = `${config.name} returned no final answer: ${details.reasoningTokens}/${details.completionTokens} output tokens were used for reasoning. Use a non-thinking model such as deepseek-flash or raise max tokens.`;
  } else if (details.finishReason === "length") {
    message = `${config.name} returned no final answer because the ${details.maxTokens}-token output limit was reached. Raise max tokens or shorten the request.`;
  } else if (details.finishReason === "content_filter") {
    message = `${config.name} blocked the response with its content filter. Please rephrase the request.`;
  } else if (details.finishReason === "insufficient_system_resource" || details.finishReason === "aborted") {
    message = `${config.name} interrupted the request (${details.finishReason}). Please retry.`;
  } else if (details.hasReasoning) {
    message = `${config.name} returned reasoning but no final answer. Disable thinking mode or switch to a non-thinking model.`;
  } else {
    message = `${config.name} returned an empty response (finish_reason=${details.finishReason || "unknown"}). Please retry or switch models.`;
  }
  return new ProviderError(message, {
    status: 502,
    code: "empty_response",
    provider: config.name,
    details
  });
}

async function callOpenAiCompatible(config, system, user, maxTokens, temperature, timeoutMs) {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${config.apiKey}`
  };
  if (config.id === "openrouter") {
    headers["http-referer"] = "https://fundflow-ai.workers.dev";
    headers["x-title"] = "FundFlow AI";
  }
  const response = await fetchWithTimeout(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(openAiCompatiblePayload(config, system, user, maxTokens, temperature))
    },
    timeoutMs
  );
  if (!response.ok) throw await readProviderError(response, config);
  const data = await response.json();
  const text = extractOpenAiText(data).trim();
  if (!text) throw emptyOpenAiResponseError(config, openAiResponseDetails(data, config, maxTokens));
  return text;
}

async function callAnthropic(config, system, user, maxTokens, temperature, timeoutMs) {
  const response = await fetchWithTimeout(
    `${config.baseUrl}/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.model,
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: maxTokens,
        temperature
      })
    },
    timeoutMs
  );
  if (!response.ok) throw await readProviderError(response, config);
  const data = await response.json();
  const text = Array.isArray(data.content)
    ? data.content
        .filter((part) => part && part.type === "text")
        .map((part) => part.text || "")
        .join("")
        .trim()
    : "";
  if (!text) throw new ProviderError(`${config.name} returned an empty response.`, { status: 502 });
  return text;
}

async function callGemini(config, system, user, maxTokens, temperature, timeoutMs) {
  const model = config.model.replace(/^models\//, "");
  const response = await fetchWithTimeout(
    `${config.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": config.apiKey
      },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        }
      })
    },
    timeoutMs
  );
  if (!response.ok) throw await readProviderError(response, config);
  const data = await response.json();
  const candidate = data && data.candidates && data.candidates[0];
  const text =
    candidate && candidate.content && Array.isArray(candidate.content.parts)
      ? candidate.content.parts.map((part) => part.text || "").join("").trim()
      : "";
  if (!text) throw new ProviderError(`${config.name} returned an empty response.`, { status: 502 });
  return text;
}

function withTimeout(promise, timeoutMs, config) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ProviderError("The model provider request timed out. Please retry.", {
          status: 504,
          code: "timeout",
          provider: config.name
        })
      );
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

function edgeAiResponseText(data, trim = true) {
  if (!data || typeof data !== "object") return "";
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = choices[0] || {};
  const message = choice.message || choice.delta || {};
  const candidates = [message.content, message.reasoning_content, choice.text];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return trim ? candidate.trim() : candidate;
    if (Array.isArray(candidate)) {
      const text = candidate
        .map((part) => (typeof part === "string" ? part : (part && (part.text || part.content)) || ""))
        .join("");
      if (text.trim()) return trim ? text.trim() : text;
    }
  }
  for (const key of ["content", "response", "text", "output_text"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return trim ? value.trim() : value;
  }
  return "";
}

function parseEdgeAiOutput(raw) {
  const text = String(raw || "").trim();
  if (!text) return { text: "", data: null };

  try {
    const data = JSON.parse(text);
    return { text: edgeAiResponseText(data), data };
  } catch {
    // SSE responses are parsed below.
  }

  if (text.includes("data:")) {
    const chunks = [];
    let lastData = null;
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const data = JSON.parse(payload);
        lastData = data;
        const chunk = edgeAiResponseText(data, false);
        if (chunk) chunks.push(chunk);
      } catch {
        chunks.push(payload);
      }
    }
    return { text: chunks.join("").trim(), data: lastData };
  }

  return { text, data: null };
}

async function readEdgeAiRaw(response, signal) {
  if (response === undefined || response === null) return "";
  if (typeof response === "string") return response;
  if (typeof response.getReader === "function") {
    const reader = response.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let abortPromise = null;
    const onAbort = () => {
      Promise.resolve(reader.cancel()).catch(() => {});
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        throw new ProviderError("The EdgeOne AI stream timed out. Please retry.", {
          status: 504,
          code: "timeout",
          provider: "EdgeOne AI"
        });
      }
      signal.addEventListener("abort", onAbort, { once: true });
      abortPromise = new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () =>
            reject(
              new ProviderError("The EdgeOne AI stream timed out. Please retry.", {
                status: 504,
                code: "timeout",
                provider: "EdgeOne AI"
              })
            ),
          { once: true }
        );
      });
    }
    try {
      while (true) {
        const read = reader.read();
        const { done, value } = abortPromise ? await Promise.race([read, abortPromise]) : await read;
        if (done) break;
        raw += decoder.decode(value, { stream: true });
      }
    } finally {
      if (signal) signal.removeEventListener("abort", onAbort);
      try {
        reader.releaseLock();
      } catch {}
    }
    return raw + decoder.decode();
  }
  if (typeof response.text === "function") return response.text();
  return JSON.stringify(response);
}

function edgeAiFailure(error) {
  const raw = error && typeof error.message === "string" ? error.message : String(error || "");
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const nested = parsed && typeof parsed.error === "object" ? parsed.error : parsed;
  const code = (nested && (nested.code || nested.statusCode)) || (error && error.code) || "";
  const message = redact(
    (nested && (nested.message || nested.msg)) ||
      (parsed && typeof parsed.error === "string" ? parsed.error : "") ||
      raw ||
      "EdgeOne AI request failed."
  );
  const quota =
    String(code) === "14020" ||
    /daily public quota|public quota|quota[^.]{0,40}(exhaust|exceed|limit)|额度[^。]{0,20}(用尽|用完|耗尽|不足)|配额[^。]{0,20}(用完|耗尽|不足)/i.test(
      message
    );
  return { code, message, quota };
}

async function callEdgeOneAi(config, system, user, maxTokens, temperature, timeoutMs, validate = null, preferredModel = null) {
  if (!edgeOneAiAvailable()) {
    throw new ProviderError(
      "EdgeOne AI is not available in this runtime. Please configure your own provider and API key.",
      { status: 503, code: "edge_ai_unavailable", provider: "EdgeOne AI" }
    );
  }

  const models = [preferredModel || config.model, ...EDGE_AI_MODELS]
    .filter((model, index, list) => model && list.indexOf(model) === index)
    .filter((model) => model !== EDGE_AI_GENERATION_MODEL || preferredModel === EDGE_AI_GENERATION_MODEL);
  const messages = [
    ...(system.trim() ? [{ role: "system", content: system }] : []),
    { role: "user", content: user }
  ];
  const attempted = [];
  const failures = [];
  const budget = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 45000;
  const deadline = Date.now() + budget;
  let lastError = null;
  let quotaError = null;

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    attempted.push(model);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(remaining, budget));
    try {
      const response = await withTimeout(
        globalThis.AI.chatCompletions({ model, messages, stream: true }),
        Math.min(remaining, budget),
        config
      );

      if (response && typeof response.ok === "boolean" && !response.ok) {
        throw new Error(`EdgeOne AI returned HTTP ${response.status}.`);
      }

      const raw = await readEdgeAiRaw(response, controller.signal);
      const parsed = parseEdgeAiOutput(raw);
      if (parsed.data && parsed.data.error) {
        throw new Error(JSON.stringify(parsed.data));
      }
      if (!parsed.text) {
        lastError = emptyOpenAiResponseError(
          { ...config, model },
          openAiResponseDetails(parsed.data || {}, { ...config, model }, maxTokens)
        );
        failures.push({ model, error: "empty response" });
        continue;
      }
      if (validate && !validate(parsed.text)) {
        lastError = new ProviderError("EdgeOne AI returned an invalid response format.", {
          status: 502,
          code: "edge_ai_invalid_response",
          provider: "EdgeOne AI",
          details: { model, snippet: parsed.text.slice(0, 300) }
        });
        failures.push({ model, error: "invalid response format" });
        continue;
      }
      config.model = model;
      return parsed.text;
    } catch (error) {
      const failure = edgeAiFailure(error);
      failures.push({ model, error: failure.message });
      if (failure.quota) {
        quotaError = new ProviderError(
          "EdgeOne AI free quota has been exhausted. Please configure your own provider and API key to continue.",
          {
            status: 429,
            code: "edge_ai_quota_exhausted",
            provider: "EdgeOne AI",
            details: { models: attempted.slice(), reason: failure.message }
          }
        );
        continue;
      }
      lastError =
        error instanceof ProviderError
          ? error
          : new ProviderError(`EdgeOne AI request failed: ${failure.message}`, {
              status: 502,
              code: "edge_ai_error",
              provider: "EdgeOne AI"
            });
    } finally {
      clearTimeout(timer);
    }
  }

  if (quotaError) throw quotaError;
  if (lastError) {
    if (!lastError.details) lastError.details = {};
    lastError.details.attempts = failures.slice(-6);
    throw lastError;
  }
  throw new ProviderError("EdgeOne AI returned no response.", {
    status: 502,
    code: "edge_ai_error",
    provider: "EdgeOne AI",
    details: { attempts: failures.slice(-6) }
  });
}

export async function callProvider(
  config,
  { system = "", user = "", maxTokens = 1600, temperature = 0.3, timeoutMs = 45000, validate = null, model = null } = {}
) {
  if (!config) {
    throw new ProviderError("Model provider is not configured.", { status: 400, code: "missing_provider" });
  }
  if (!user.trim()) throw new ProviderError("Empty model prompt.", { status: 400, code: "empty_prompt" });

  if (config.api === "edgeone") {
    return callEdgeOneAi(config, system, user, maxTokens, temperature, timeoutMs, validate, model);
  }
  if (!config.apiKey) {
    throw new ProviderError("Model provider is not configured.", { status: 400, code: "missing_provider" });
  }
  let text;
  if (config.api === "anthropic") {
    text = await callAnthropic(config, system, user, maxTokens, temperature, timeoutMs);
  } else if (config.api === "gemini") {
    text = await callGemini(config, system, user, maxTokens, temperature, timeoutMs);
  } else {
    text = await callOpenAiCompatible(config, system, user, maxTokens, temperature, timeoutMs);
  }
  if (validate && !validate(text)) {
    throw new ProviderError("The model returned an invalid response format.", {
      status: 502,
      code: "provider_invalid_response",
      provider: config.name,
      details: { model: config.model, snippet: text.slice(0, 300) }
    });
  }
  return text;
}

export async function testProvider(config) {
  const sample = await callProvider(config, {
    system: "You are a connection test. Reply briefly and exactly as instructed.",
    user: "Reply with the single word OK.",
    maxTokens: 128,
    temperature: 0,
    timeoutMs: 20000
  });
  return {
    ok: true,
    provider: config.name,
    model: config.model,
    sample: sample.slice(0, 80)
  };
}

