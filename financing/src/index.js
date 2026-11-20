import { zipSync, strToU8 } from "fflate";
import { analyzeTurn, buildStart, resolveLanguage } from "./engine.js";
import { generateDocumentsWithProvider, interviewWithProvider } from "./ai.js";
import { generateMaterials } from "./generator.js";
import {
  ProviderError,
  edgeOneAiAvailable,
  edgeOneAiConfig,
  edgeOneAiInfo,
  listProviders,
  normalizeProviderConfig,
  publicProviderInfo,
  testProvider
} from "./providers.js";

var MAX_BODY_BYTES = 1e6;
var MODEL_VERSION = "1.2.0";
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    }
  });
}
function errorResponse(status, message) {
  return jsonResponse({ ok: false, error: message }, status);
}
async function readJson(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large.");
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON body.");
  }
}
function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  if (messages.length > 80) throw new HttpError(400, "Too many conversation messages.");
  return messages.filter((message) => message && (message.role === "user" || message.role === "assistant")).map((message) => ({
    role: message.role,
    content: String(message.content || "").slice(0, 8e3)
  })).filter((message) => message.content.trim());
}
function sanitizeProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return {};
  const result = {};
  for (const [key, value] of Object.entries(profile)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(key)) continue;
    if (typeof value === "string") result[key] = value.slice(0, 4e3);
  }
  return result;
}
function sanitizeLanguageLabel(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}
function sanitizeStandard(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const primary = value.primary && typeof value.primary === "object" ? value.primary : {};
  const national = value.national && typeof value.national === "object" ? value.national : {};
  return {
    primary: {
      code: String(primary.code || "").slice(0, 80),
      name: String(primary.name || "").slice(0, 160)
    },
    national: {
      code: String(national.code || "").slice(0, 80),
      name: String(national.name || "").slice(0, 160)
    },
    rationale: String(value.rationale || "").slice(0, 600)
  };
}
function demoEnabled(env) {
  return !env || env.DEMO_ENABLED !== "false";
}
function isEdgeAiProvider(provider) {
  return Boolean(provider && provider.config && provider.config.api === "edgeone");
}
function providerDefaults(provider) {
  return {
    mode: provider.mode,
    provider: publicProviderInfo(provider.config),
    demo: provider.demo,
    edgeAi: isEdgeAiProvider(provider)
  };
}
function previewProvider(body, env) {
  if (body.provider && typeof body.provider === "object" && !Array.isArray(body.provider)) {
    try {
      return { config: normalizeProviderConfig(body.provider), demo: false, mode: "ai" };
    } catch {
      return null;
    }
  }
  const wantsDemo = body.demo === true || body.demo === "true";
  if (wantsDemo) return { config: null, demo: true, mode: "rules" };
  if (edgeOneAiAvailable()) {
    return { config: edgeOneAiConfig(), demo: false, mode: "ai" };
  }
  if (demoEnabled(env)) {
    return { config: null, demo: true, mode: "rules", warning: "EdgeOne AI is unavailable; demo mode is being used." };
  }
  return null;
}
function resolveProvider(body, env) {
  if (body.provider && typeof body.provider === "object" && !Array.isArray(body.provider)) {
    return { config: normalizeProviderConfig(body.provider), demo: false, mode: "ai" };
  }
  const wantsDemo = body.demo === true || body.demo === "true";
  if (wantsDemo) {
    return { config: null, demo: true, mode: "rules" };
  }
  if (edgeOneAiAvailable()) {
    return { config: edgeOneAiConfig(), demo: false, mode: "ai" };
  }
  if (demoEnabled(env)) {
    return {
      config: null,
      demo: true,
      mode: "rules",
      warning: "EdgeOne AI is unavailable; demo mode is being used."
    };
  }
  throw new HttpError(400, "Please configure a model provider or use demo mode.");
}
function requireLanguageForDemo(provider, lang) {
  if (provider.demo && lang !== "zh" && lang !== "en") {
    throw new HttpError(400, "Demo mode supports Chinese and English only. Connect a model provider to use another language.");
  }
}
function sanitizeFilename(filename, fallback) {
  const cleaned = String(filename || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").replace(/^\.+/, "").trim().slice(0, 120);
  return cleaned || fallback;
}
function exportManifest({ meta = {}, materials = [], lang = "zh" }) {
  const isZh = String(lang) === "zh";
  const isEn = !isZh;
  const languageLabel = meta.languageLabel || (isZh ? "\u4E2D\u6587" : isEn ? "English" : String(lang));
  const lines = [
    isZh ? "FundFlow AI \u2014 \u878D\u8D44\u6750\u6599\u5305" : "FundFlow AI \u2014 FUNDING PACK",
    "================================",
    `${isZh ? "\u9879\u76EE" : "Project"}: ${meta.projectName || (isZh ? "\u672A\u547D\u540D\u9879\u76EE" : "Untitled Project")}`,
    `${isZh ? "\u8BED\u8A00" : "Language"}: ${languageLabel}`,
    `${isZh ? "\u751F\u6210\u65F6\u95F4" : "Generated"}: ${meta.generatedAt || (/* @__PURE__ */ new Date()).toISOString()}`,
    `${isZh ? "\u6807\u51C6\u4F9D\u636E" : "Standards basis"}: ${meta.standardCode || "ISO/IEC 25010"} / ${meta.nationalCode || "GB/T 25000.10"}`,
    `${isZh ? "\u4FE1\u606F\u8986\u76D6" : "Coverage"}: ${meta.coverage ? `${meta.coverage.filled}/${meta.coverage.total} (${meta.coverage.percent}%)` : "n/a"}`,
    `${isZh ? "\u751F\u6210\u6A21\u5F0F" : "Generation mode"}: ${meta.mode === "ai" ? isZh ? "\u5728\u7EBF\u5927\u6A21\u578B + \u6A21\u677F\u515C\u5E95" : "Connected model + template fallback" : isZh ? "\u89C4\u5219\u6574\u7406\uFF08\u6F14\u793A\u6A21\u5F0F\uFF09" : "Rules mode (demo)"}`,
    "",
    isZh ? "\u6587\u4EF6\uFF1A" : "Files:",
    ...materials.map((material, index) => `${String(index + 1).padStart(2, "0")}. ${material.filename}`),
    "",
    isZh ? "\u672C\u6750\u6599\u5305\u7531 AI \u8F85\u52A9\u5BF9\u8BDD\u6574\u7406\u3002\u6240\u6709\u6570\u5B57\u3001\u5E02\u573A\u6570\u636E\u3001\u77E5\u8BC6\u4EA7\u6743\u3001\u8D44\u8D28\u4E0E\u6807\u51C6\u8868\u8FF0\u5747\u9700\u521B\u59CB\u56E2\u961F\u53CA\u4E13\u4E1A\u987E\u95EE\u6838\u9A8C\u540E\u65B9\u53EF\u5BF9\u5916\u4F7F\u7528\u3002\u672C\u6750\u6599\u4E0D\u6784\u6210\u6CD5\u5F8B\u3001\u8D22\u52A1\u3001\u6295\u8D44\u6216\u8BA4\u8BC1\u610F\u89C1\u3002" : "This pack is generated from an AI-assisted conversation. All figures, market data, IP, licences and standards claims must be verified by the founding team and professional advisers before external use. It is not legal, financial, investment or certification advice."
  ];
  return lines.join("\r\n");
}
async function handleChat(request, env) {
  const body = await readJson(request);
  const messages = sanitizeMessages(body.messages);
  const profile = sanitizeProfile(body.profile);
  const pending = Array.isArray(body.pending) ? body.pending.filter((key) => typeof key === "string").slice(0, 8) : [];
  const languageLabel = sanitizeLanguageLabel(body.languageLabel);
  const lang = resolveLanguage(body.lang, messages);
  const preview = previewProvider(body, env);
  if (!lang) {
    return jsonResponse({
      ...buildStart(),
      mode: preview ? preview.mode : "rules",
      ...preview ? providerDefaults(preview) : {}
    });
  }
  const userMessages = messages.filter((message) => message.role === "user");
  if (!userMessages.length) {
    return jsonResponse({
      ...buildStart(lang, languageLabel),
      mode: preview ? preview.mode : "rules",
      ...preview ? providerDefaults(preview) : {},
      languageLabel,
      phase: "intro",
      profile,
      pending: [],
      standard: null,
      coverage: null,
      ready: false
    });
  }
  const provider = resolveProvider(body, env);
  requireLanguageForDemo(provider, lang);
  let aiResult = null;
  const warnings = [];
  if (provider.warning) warnings.push(provider.warning);
  if (provider.config) {
    aiResult = await interviewWithProvider(provider.config, {
      lang,
      languageLabel,
      messages,
      profile,
      pending,
      standard: sanitizeStandard(body.standard)
    });
    if (!aiResult) {
      warnings.push("The model response could not be parsed; this turn used the deterministic interview engine.");
    }
  }
  const result = analyzeTurn({
    lang,
    languageLabel,
    messages,
    profile,
    pending,
    productType: body.productType,
    previousStandardId: body.standardId,
    aiProfile: aiResult ? aiResult.profile : null,
    aiProductType: aiResult ? aiResult.productType : null,
    aiReply: aiResult ? aiResult.reply : null,
    aiQuestions: aiResult ? aiResult.questions : null,
    aiStandardId: aiResult ? aiResult.standardId : null,
    aiStandardRationale: aiResult ? aiResult.standardRationale : null,
    aiDetectedLanguage: aiResult ? aiResult.detectedLanguage : null,
    aiDetectedLanguageLabel: aiResult ? aiResult.detectedLanguageLabel : null
  });
  return jsonResponse({
    ...result,
    ...providerDefaults({ ...provider, mode: provider.config ? "ai" : "rules" }),
    productType: aiResult && aiResult.productType || body.productType || "",
    warnings
  });
}
function extractTitle(markdown, fallback) {
  const match = String(markdown || "").match(/^#\s+(.+)$/m);
  if (!match) return fallback;
  const title = match[1].replace(/[*_`]/g, "").trim();
  return title ? title.slice(0, 120) : fallback;
}
async function handleGenerate(request, env) {
  const body = await readJson(request);
  const messages = sanitizeMessages(body.messages);
  const profile = sanitizeProfile(body.profile);
  const languageLabel = sanitizeLanguageLabel(body.languageLabel);
  const lang = resolveLanguage(body.lang, messages) || "zh";
  if (!messages.some((message) => message.role === "user")) {
    throw new HttpError(400, "Please introduce the project before generating materials.");
  }
  const provider = resolveProvider(body, env);
  requireLanguageForDemo(provider, lang);
  const requestedDocs = Array.isArray(body.docs)
    ? body.docs.filter((id) => typeof id === "string").slice(0, 9)
    : null;
  const analysis = analyzeTurn({
    lang,
    languageLabel,
    messages,
    profile,
    pending: [],
    productType: body.productType,
    previousStandardId: body.standardId
  });
  const templateLang = lang === "zh" ? "zh" : "en";
  const templateResult = generateMaterials({
    profile: analysis.profile,
    standard: analysis.standard,
    lang: templateLang,
    messages
  });
  let aiDocuments = {};
  const warnings = [];
  if (provider.warning) warnings.push(provider.warning);
  if (provider.config) {
    const generated = await generateDocumentsWithProvider(provider.config, {
      lang,
      languageLabel: analysis.languageLabel || languageLabel,
      profile: analysis.profile,
      standard: analysis.standard,
      messages,
      docs: requestedDocs
    });
    aiDocuments = generated.documents;
    warnings.push(...generated.warnings);
  }
  const fallbackDocs = [];
  const materials = templateResult.materials.map((material) => {
    const aiMarkdown = aiDocuments[material.id];
    if (!aiMarkdown || material.id === "overview") {
      if (provider.config && material.id !== "overview" && !aiMarkdown) fallbackDocs.push(material.id);
      return material;
    }
    return {
      ...material,
      title: extractTitle(aiMarkdown, material.title),
      markdown: aiMarkdown
    };
  });
  if (fallbackDocs.length) {
    warnings.push(`Template fallback used for: ${fallbackDocs.join(", ")}.`);
  }
  const mode = provider.config && Object.keys(aiDocuments).length ? "ai" : "rules";
  const meta = {
    ...templateResult.meta,
    language: lang === "zh" ? "zh" : lang === "en" ? "en" : "other",
    languageLabel: analysis.languageLabel || languageLabel || (lang === "zh" ? "\u4E2D\u6587" : "English"),
    standardId: analysis.standard.id,
    standardCode: analysis.standard.primary.code,
    nationalCode: analysis.standard.national.code,
    coverage: analysis.coverage,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    mode,
    provider: publicProviderInfo(provider.config),
    edgeAi: isEdgeAiProvider(provider),
    warnings
  };
  return jsonResponse({
    ok: true,
    materials,
    meta,
    standard: analysis.standard,
    coverage: analysis.coverage,
    mode,
    provider: publicProviderInfo(provider.config),
    demo: provider.demo,
    edgeAi: isEdgeAiProvider(provider),
    warnings
  });
}
async function handleExport(request) {
  const body = await readJson(request);
  const materials = Array.isArray(body.materials) ? body.materials.slice(0, 20) : [];
  if (!materials.length) throw new HttpError(400, "No materials to export.");
  const lang = body.lang === "zh" ? "zh" : body.lang === "en" ? "en" : "other";
  const normalized = [];
  const usedNames = /* @__PURE__ */ new Set();
  for (let index = 0; index < materials.length; index += 1) {
    const material = materials[index];
    if (!material || typeof material !== "object") continue;
    const markdown = String(material.markdown || "");
    if (!markdown.trim()) continue;
    if (markdown.length > 16e4) throw new HttpError(413, "A material is too large to export.");
    let filename = sanitizeFilename(material.filename, `${String(index + 1).padStart(2, "0")}-material.md`);
    if (!/\.md$/i.test(filename)) filename += ".md";
    let unique = filename;
    let suffix = 2;
    while (usedNames.has(unique.toLowerCase())) {
      unique = filename.replace(/\.md$/i, `-${suffix}.md`);
      suffix += 1;
    }
    usedNames.add(unique.toLowerCase());
    normalized.push({ filename: unique, markdown });
  }
  if (!normalized.length) throw new HttpError(400, "No valid materials to export.");
  const files = {};
  for (const material of normalized) {
    files[`funding-pack/${material.filename}`] = strToU8(material.markdown);
  }
  files["funding-pack/README.txt"] = strToU8(
    exportManifest({
      meta: body.meta || {},
      materials: normalized,
      lang
    })
  );
  const archive = zipSync(files, { level: 6 });
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const downloadName = `funding-pack-${date}.zip`;
  return new Response(archive, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
async function handleProviderTest(request) {
  const body = await readJson(request);
  const config = normalizeProviderConfig(body.provider);
  const result = await testProvider(config);
  return jsonResponse({
    ok: true,
    ...result,
    provider: publicProviderInfo(config)
  });
}
async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/health" && request.method === "GET") {
    return jsonResponse({
      ok: true,
      service: "fundflow-ai",
      version: MODEL_VERSION,
      demo: demoEnabled(env),
      edgeAi: edgeOneAiAvailable(),
      defaultProvider: edgeOneAiAvailable() ? "edgeone-ai" : demoEnabled(env) ? "demo" : null,
      ai: edgeOneAiInfo(),
      time: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  if (path === "/api/providers" && request.method === "GET") {
    return jsonResponse({
      ok: true,
      providers: listProviders(),
      demoEnabled: demoEnabled(env),
      edgeAi: edgeOneAiInfo()
    });
  }
  if (path === "/api/provider/test" && request.method === "POST") {
    return handleProviderTest(request);
  }
  if (path === "/api/start" && request.method === "GET") {
    const rawLang = url.searchParams.get("lang");
    const lang = rawLang === "zh" || rawLang === "en" || rawLang === "other" ? rawLang : void 0;
    const languageLabel = sanitizeLanguageLabel(url.searchParams.get("label"));
    const preview = previewProvider({}, env);
    return jsonResponse({
      ...buildStart(lang, languageLabel),
      mode: preview ? preview.mode : "rules",
      ...preview ? providerDefaults(preview) : {},
      version: MODEL_VERSION
    });
  }
  if (path === "/api/chat" && request.method === "POST") {
    return handleChat(request, env);
  }
  if (path === "/api/generate" && request.method === "POST") {
    return handleGenerate(request, env);
  }
  if (path === "/api/export" && request.method === "POST") {
    return handleExport(request);
  }
  if (path.startsWith("/api/")) {
    return errorResponse(404, "API route not found.");
  }
  if (env.ASSETS) {
    return env.ASSETS.fetch(request);
  }
  return new Response("Not found", { status: 404 });
}
const index_default = {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.status, error.message);
      }
      if (error instanceof ProviderError) {
        return jsonResponse(
          {
            ok: false,
            error: error.message,
            code: error.code,
            provider: error.provider,
            ...error.details ? { details: error.details } : {}
          },
          error.status
        );
      }
      console.error("Unhandled error", error);
      return errorResponse(500, "Unexpected server error. Please retry.");
    }
  }
};


export default index_default;
