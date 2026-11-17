import { zipSync, strToU8 } from "fflate";
import { analyzeTurn, buildStart, resolveLanguage } from "./engine.js";
import { generateDocumentsWithProvider, interviewWithProvider } from "./ai.js";
import { generateMaterials } from "./generator.js";
import {
  ProviderError,
  listProviders,
  normalizeProviderConfig,
  publicProviderInfo,
  testProvider
} from "./providers.js";

const MAX_BODY_BYTES = 1_500_000;
const MODEL_VERSION = "1.1.0";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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
  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, 8000)
    }))
    .filter((message) => message.content.trim());
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return {};
  const result = {};
  for (const [key, value] of Object.entries(profile)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(key)) continue;
    if (typeof value === "string") result[key] = value.slice(0, 4000);
  }
  return result;
}

function sanitizeLanguageLabel(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
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

function resolveProvider(body, env) {
  if (body.provider && typeof body.provider === "object" && !Array.isArray(body.provider)) {
    return { config: normalizeProviderConfig(body.provider), demo: false, mode: "ai" };
  }
  const wantsDemo = body.demo === true || body.demo === "true";
  if (wantsDemo || demoEnabled(env)) {
    return { config: null, demo: true, mode: "rules" };
  }
  throw new HttpError(400, "Please choose a model provider or use demo mode.");
}

function requireLanguageForDemo(provider, lang) {
  if (provider.demo && lang !== "zh" && lang !== "en") {
    throw new HttpError(400, "Demo mode supports Chinese and English only. Connect a model provider to use another language.");
  }
}

function sanitizeFilename(filename, fallback) {
  const cleaned = String(filename || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

function exportManifest({ meta = {}, materials = [], lang = "zh" }) {
  const isZh = String(lang) === "zh";
  const isEn = !isZh;
  const languageLabel = meta.languageLabel || (isZh ? "中文" : isEn ? "English" : String(lang));
  const lines = [
    isZh ? "FundFlow AI — 融资材料包" : "FundFlow AI — FUNDING PACK",
    "================================",
    `${isZh ? "项目" : "Project"}: ${meta.projectName || (isZh ? "未命名项目" : "Untitled Project")}`,
    `${isZh ? "语言" : "Language"}: ${languageLabel}`,
    `${isZh ? "生成时间" : "Generated"}: ${meta.generatedAt || new Date().toISOString()}`,
    `${isZh ? "标准依据" : "Standards basis"}: ${meta.standardCode || "ISO/IEC 25010"} / ${meta.nationalCode || "GB/T 25000.10"}`,
    `${isZh ? "信息覆盖" : "Coverage"}: ${meta.coverage ? `${meta.coverage.filled}/${meta.coverage.total} (${meta.coverage.percent}%)` : "n/a"}`,
    `${isZh ? "生成模式" : "Generation mode"}: ${meta.mode === "ai" ? (isZh ? "在线大模型 + 模板兜底" : "Connected model + template fallback") : (isZh ? "规则整理（演示模式）" : "Rules mode (demo)")}`,
    "",
    isZh ? "文件：" : "Files:",
    ...materials.map((material, index) => `${String(index + 1).padStart(2, "0")}. ${material.filename}`),
    "",
    isZh
      ? "本材料包由 AI 辅助对话整理。所有数字、市场数据、知识产权、资质与标准表述均需创始团队及专业顾问核验后方可对外使用。本材料不构成法律、财务、投资或认证意见。"
      : "This pack is generated from an AI-assisted conversation. All figures, market data, IP, licences and standards claims must be verified by the founding team and professional advisers before external use. It is not legal, financial, investment or certification advice."
  ];
  return lines.join("\r\n");
}

async function handleChat(request, env) {
  const body = await readJson(request);
  const messages = sanitizeMessages(body.messages);
  const profile = sanitizeProfile(body.profile);
  const pending = Array.isArray(body.pending)
    ? body.pending.filter((key) => typeof key === "string").slice(0, 8)
    : [];
  const languageLabel = sanitizeLanguageLabel(body.languageLabel);
  const lang = resolveLanguage(body.lang, messages);

  if (!lang) {
    return jsonResponse({ ...buildStart(), mode: "rules" });
  }

  const userMessages = messages.filter((message) => message.role === "user");
  if (!userMessages.length) {
    return jsonResponse({
      ...buildStart(lang, languageLabel),
      mode: "rules",
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
    mode: aiResult ? "ai" : "rules",
    provider: publicProviderInfo(provider.config),
    demo: provider.demo,
    productType: (aiResult && aiResult.productType) || body.productType || "",
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
  if (provider.config) {
    const generated = await generateDocumentsWithProvider(provider.config, {
      lang,
      languageLabel: analysis.languageLabel || languageLabel,
      profile: analysis.profile,
      standard: analysis.standard,
      messages
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
    languageLabel: analysis.languageLabel || languageLabel || (lang === "zh" ? "中文" : "English"),
    standardId: analysis.standard.id,
    standardCode: analysis.standard.primary.code,
    nationalCode: analysis.standard.national.code,
    coverage: analysis.coverage,
    generatedAt: new Date().toISOString(),
    mode,
    provider: publicProviderInfo(provider.config),
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
    warnings
  });
}

async function handleExport(request) {
  const body = await readJson(request);
  const materials = Array.isArray(body.materials) ? body.materials.slice(0, 20) : [];
  if (!materials.length) throw new HttpError(400, "No materials to export.");

  const lang = body.lang === "zh" ? "zh" : body.lang === "en" ? "en" : "other";
  const normalized = [];
  const usedNames = new Set();
  for (let index = 0; index < materials.length; index += 1) {
    const material = materials[index];
    if (!material || typeof material !== "object") continue;
    const markdown = String(material.markdown || "");
    if (!markdown.trim()) continue;
    if (markdown.length > 160_000) throw new HttpError(413, "A material is too large to export.");
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
  const date = new Date().toISOString().slice(0, 10);
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
      time: new Date().toISOString()
    });
  }

  if (path === "/api/providers" && request.method === "GET") {
    return jsonResponse({
      ok: true,
      providers: listProviders(),
      demoEnabled: demoEnabled(env)
    });
  }

  if (path === "/api/provider/test" && request.method === "POST") {
    return handleProviderTest(request);
  }

  if (path === "/api/start" && request.method === "GET") {
    const rawLang = url.searchParams.get("lang");
    const lang = rawLang === "zh" || rawLang === "en" || rawLang === "other" ? rawLang : undefined;
    const languageLabel = sanitizeLanguageLabel(url.searchParams.get("label"));
    return jsonResponse({
      ...buildStart(lang, languageLabel),
      mode: "rules",
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

export default {
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
            ...(error.details ? { details: error.details } : {})
          },
          error.status
        );
      }
      console.error("Unhandled error", error);
      return errorResponse(500, "Unexpected server error. Please retry.");
    }
  }
};
