import { FIELD_DEFINITIONS, computeCoverage } from "./engine.js";
import { getStandardCatalog, standardDefinition } from "./standards.js";
import { DOC_DEFS } from "./generator.js";
import { EDGE_AI_GENERATION_MODEL, ProviderError, callProvider } from "./providers.js";

const ALLOWED_PRODUCT_TYPES = [
  "software",
  "ai",
  "medical",
  "food",
  "hardware",
  "service",
  "security",
  "energy",
  "other"
];

const STANDARD_IDS = new Set(getStandardCatalog().map((standard) => standard.id));
const FIELD_KEYS = new Set(FIELD_DEFINITIONS.map((field) => field.key));
const DOC_MAP = Object.fromEntries(DOC_DEFS.map((doc) => [doc.id, doc]));

const DOCUMENT_GROUPS = [
  ["summary", "business-plan", "market"],
  ["pitch-deck", "financials", "technical"],
  ["risk", "data-room"]
];

const FIELD_HELP = FIELD_DEFINITIONS.map(
  (field) => `${field.key}: ${field.zhLabel} / ${field.enLabel}`
).join("\n");

function cleanForAI(value, max) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, max);
}

function languageName(lang, label) {
  if (lang === "zh") return "Simplified Chinese";
  if (lang === "en") return "English";
  return cleanForAI(label, 80) || "the user's chosen language";
}

function languageRule(lang, label) {
  if (lang === "zh") {
    return "Write every user-facing value (reply, questions, rationale and documents) in Simplified Chinese, even if the transcript contains other languages.";
  }
  if (lang === "en") {
    return "Write every user-facing value (reply, questions, rationale and documents) in English, even if the transcript contains other languages.";
  }
  return `Write every user-facing value (reply, questions, rationale and documents) in ${languageName(
    lang,
    label
  )}. Do not translate the output into English or Chinese.`;
}

export function extractJson(text) {
  if (typeof text !== "string") return null;
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function normalizeAiProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return {};
  const allowed = new Set([...FIELD_KEYS, "oneLiner"]);
  const result = {};
  for (const [key, raw] of Object.entries(profile)) {
    if (!allowed.has(key)) continue;
    let value = "";
    if (typeof raw === "string") value = raw;
    else if (Array.isArray(raw)) value = raw.filter((item) => typeof item === "string").join("；");
    else if (raw && typeof raw === "object") {
      value = Object.values(raw).filter((item) => typeof item === "string").join("；");
    }
    value = value.replace(/\r\n/g, "\n").trim();
    if (!value) continue;
    result[key] = value.slice(0, 4000);
  }
  return result;
}

export function normalizeProductType(value) {
  if (typeof value !== "string") return "";
  const normalized = value.toLowerCase().trim();
  if (ALLOWED_PRODUCT_TYPES.includes(normalized)) return normalized;
  if (/artificial|大模型|算法|agent|llm/.test(normalized)) return "ai";
  if (/medical|医疗|诊断|临床/.test(normalized)) return "medical";
  if (/saas|software|软件|平台|app|系统|互联网/.test(normalized)) return "software";
  if (/hardware|硬件|设备|制造|工厂/.test(normalized)) return "hardware";
  if (/food|食品|餐饮|饮料/.test(normalized)) return "food";
  if (/security|安全|隐私/.test(normalized)) return "security";
  if (/energy|能源|环保|新能源/.test(normalized)) return "energy";
  if (/service|服务|咨询|运营/.test(normalized)) return "service";
  return "other";
}

function normalizeStandardId(value) {
  const id = String(value || "").trim();
  return STANDARD_IDS.has(id) ? id : "";
}

function normalizeDetectedLanguage(value, label) {
  const raw = String(value || "").toLowerCase().trim();
  if (raw === "zh" || raw === "en" || raw === "other") return raw;
  const text = String(label || "").toLowerCase();
  if (/中文|chinese|mandarin|zh/.test(text)) return "zh";
  if (/english|en\b/.test(text)) return "en";
  return label ? "other" : "";
}

function buildTranscript(messages, limit = 18) {
  return (Array.isArray(messages) ? messages : [])
    .slice(-limit)
    .map((message) => `${message.role === "user" ? "USER" : "ASSISTANT"}: ${cleanForAI(message.content, 2400)}`)
    .join("\n\n");
}

function standardLine(standard) {
  if (!standard || !standard.primary) return "not selected yet";
  const national = standard.national ? ` / ${standard.national.code}` : "";
  return `${standard.primary.code}${national} — ${standard.primary.name || ""}`.trim();
}

function buildStandardCatalog() {
  return getStandardCatalog()
    .map((standard) => {
      const def = standardDefinition(standard.id);
      return `- ${standard.id}: ${standard.code} / ${standard.nationalCode} — ${def.primary.en}`;
    })
    .join("\n");
}

export function buildInterviewPrompt({
  lang = "zh",
  languageLabel = "",
  messages = [],
  profile = {},
  pending = [],
  standard = null
} = {}) {
  const coverage = computeCoverage(profile);
  const missing = coverage.missingKeys;
  const system = `You are a senior fundraising consultant and technical due-diligence analyst.
You conduct a structured interview that will become a complete, standards-aligned financing pack.

Rules:
- Return ONLY one valid JSON object. No markdown, no code fences, no commentary.
- ${languageRule(lang, languageLabel)}
- Never invent facts, numbers, customers, certifications, patents or team members. Only use facts explicitly present in the transcript or the existing profile.
- The "reply" must be a concise, warm acknowledgement (max 80 words) in the target language. It must NOT ask questions; the application appends the questions.
- Ask at most 3 questions, one per missing field. Each question must be specific, natural and in the target language.
- Only ask about fields listed under "Missing fields". Do not ask about fields already filled.
- Choose one standardId from the allowed list that best fits the project. Keep the current standard if it still fits.
- Write "standardRationale" in the target language.
- Return an empty questions array when no fields are missing.
- Omit unknown profile fields. Only include new or corrected facts, not repeated facts already in the existing profile.

Allowed standard IDs:
${buildStandardCatalog()}

Product type values:
${ALLOWED_PRODUCT_TYPES.join(" | ")}

Field meanings:
${FIELD_HELP}

Output schema:
{
  "reply": "short acknowledgement in the target language",
  "productType": "software | ai | medical | food | hardware | service | security | energy | other",
  "standardId": "one allowed standard id",
  "standardRationale": "why this standard fits, in the target language",
  "detectedLanguage": "zh | en | other",
  "detectedLanguageLabel": "language name in its own script",
  "profile": {
    "projectName": "...",
    "solution": "...",
    "problem": "...",
    "targetMarket": "...",
    "marketSize": "...",
    "businessModel": "...",
    "traction": "...",
    "competition": "...",
    "team": "...",
    "financials": "...",
    "fundingAsk": "...",
    "roadmap": "...",
    "standardEvidence": "...",
    "ipCompliance": "...",
    "risks": "...",
    "exitStrategy": "...",
    "oneLiner": "..."
  },
  "questions": [
    { "field": "targetMarket", "text": "specific question in the target language" }
  ]
}`;

  const user = `Target language: ${languageName(lang, languageLabel)}
Current standard: ${standardLine(standard)}
Current known profile:
${JSON.stringify(profile || {}, null, 2)}

Missing fields:
${JSON.stringify(missing)}

Fields currently being asked (the latest USER message may answer these):
${JSON.stringify(Array.isArray(pending) ? pending : [])}

Conversation transcript:
${buildTranscript(messages)}

Return the JSON object now.`;

  return { system, user };
}

export function parseInterviewResponse(raw) {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const questionKeys = new Set();
  const questions = [];
  for (const item of Array.isArray(parsed.questions) ? parsed.questions : []) {
    if (!item || typeof item !== "object") continue;
    const field = String(item.field || "").trim();
    const text = cleanForAI(item.text, 900);
    if (!FIELD_KEYS.has(field) || !text || questionKeys.has(field)) continue;
    questionKeys.add(field);
    questions.push({ field, text });
    if (questions.length >= 4) break;
  }

  const label = cleanForAI(parsed.detectedLanguageLabel, 80);
  return {
    reply: cleanForAI(parsed.reply, 1200),
    profile: normalizeAiProfile(parsed.profile),
    productType: normalizeProductType(parsed.productType),
    standardId: normalizeStandardId(parsed.standardId),
    standardRationale: cleanForAI(parsed.standardRationale, 900),
    detectedLanguage: normalizeDetectedLanguage(parsed.detectedLanguage, label),
    detectedLanguageLabel: label,
    questions
  };
}

export async function interviewWithProvider(
  config,
  { lang = "zh", languageLabel = "", messages = [], profile = {}, pending = [], standard = null } = {}
) {
  const prompt = buildInterviewPrompt({ lang, languageLabel, messages, profile, pending, standard });
  const raw = await callProvider(config, {
    system: prompt.system,
    user: prompt.user,
    maxTokens: 2400,
    temperature: 0.2,
    timeoutMs: 45000
  });
  return parseInterviewResponse(raw);
}

function docInstruction(doc) {
  return `- id="${doc.id}" — ${doc.zhTitle} / ${doc.enTitle}
  Requirements: ${doc.zhDesc} / ${doc.enDesc}
  Write a complete standalone Markdown document with one H1, a short metadata block (project, standards basis, data note), detailed sections, concrete checklists and tables where useful. Use only facts from the profile and transcript. Clearly mark missing facts as "to be confirmed" in the target language. Do not invent metrics, certificates, patents, customers or team credentials.`;
}

export function buildDocumentPrompt({
  lang = "zh",
  languageLabel = "",
  profile = {},
  standard = null,
  messages = [],
  docs = []
} = {}) {
  const targetLanguage = languageName(lang, languageLabel);
  const standardInfo = standard
    ? `${standard.primary.code} (${standard.primary.name}); national reference: ${standard.national.code} (${standard.national.name}); rationale: ${standard.rationale}`
    : "No standard selected; use the closest ISO/IEC 25010 software-quality framing.";
  const system = `You are a senior fundraising consultant, financial analyst and technical due-diligence writer.
You produce an investor-ready financing pack in Markdown.

Rules:
- ${languageRule(lang, languageLabel)}
- Return ONLY the requested <DOCUMENT> blocks. No preamble, no commentary, no code fences.
- Use exactly this format for each document:
<DOCUMENT id="summary">
# Document title

...full markdown...
</DOCUMENT>
- Every requested document must appear exactly once, with its exact id.
- Write substantive, specific prose that uses the founder's facts. Do not invent facts, numbers, customers, certifications, patents, licences, team credentials or standards claims.
- If a required fact is missing, write a clearly marked "to be confirmed" statement in ${targetLanguage}. You may provide a recommended framework, checklist or table, but label it as a template or recommendation.
- Include the project name and standards basis in each document. Use tables where they improve clarity.
- Do not output analysis, planning, or chain-of-thought. Start directly with the first <DOCUMENT> tag and output only the requested <DOCUMENT> blocks.
- Be concise: the summary should be 400-700 Chinese characters (or 250-400 English words); every other document should be 800-1500 Chinese characters (or 500-900 English words). Prefer compact tables over long prose.
- Do not mention that you are an AI model. Do not include HTML.`;

  const user = `Target language: ${targetLanguage}
Project profile:
${JSON.stringify(profile || {}, null, 2)}

Standards basis:
${standardInfo}

Recent conversation:
${buildTranscript(messages, 10)}

Write these ${docs.length} documents:
${docs.map(docInstruction).join("\n\n")}

Return the <DOCUMENT> blocks now.`;

  return { system, user };
}

export function parseDocumentTags(raw) {
  const documents = {};
  if (typeof raw !== "string") return documents;
  const text = raw.replace(/```(?:markdown|md)?/gi, "").replace(/```/g, "");
  const pattern = /<DOCUMENT\b([^>]*)>([\s\S]*?)(?:<\/DOCUMENT>|$)/gi;
  let match;
  while ((match = pattern.exec(text))) {
    const attrs = match[1] || "";
    const idMatch = attrs.match(/\bid\s*=\s*["']?([a-z0-9-]+)["']?/i);
    if (!idMatch) continue;
    const id = idMatch[1].toLowerCase();
    if (!DOC_MAP[id] || id === "overview") continue;
    const markdown = match[2]
      .replace(/^\s*```(?:markdown|md)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    if (!markdown) continue;
    documents[id] = markdown.slice(0, 180_000);
  }
  return documents;
}

export function listDocumentGroups() {
  return DOCUMENT_GROUPS.map((ids) => [...ids]);
}

export async function generateDocumentsWithProvider(
  config,
  { lang = "zh", languageLabel = "", profile = {}, standard = null, messages = [], docs = null } = {}
) {
  const requestedIds = Array.isArray(docs) && docs.length
    ? docs.filter((id) => DOC_MAP[id] && id !== "overview")
    : DOCUMENT_GROUPS.flat();
  const groups = DOCUMENT_GROUPS.map((ids) => ids.filter((id) => requestedIds.includes(id))).filter(
    (ids) => ids.length
  );
  if (!groups.length) return { documents: {}, warnings: [] };

  const results = await Promise.allSettled(
    groups.map(async (ids) => {
      const prompt = buildDocumentPrompt({
        lang,
        languageLabel,
        profile,
        standard,
        messages,
        docs: ids.map((id) => DOC_MAP[id])
      });
      const raw = await callProvider(config, {
        system: prompt.system,
        user: prompt.user,
        maxTokens: 8000,
        temperature: 0.35,
        timeoutMs: 100000,
        model: EDGE_AI_GENERATION_MODEL,
        validate: (text) => Object.keys(parseDocumentTags(text)).length > 0
      });
      const opened = (raw.match(/<DOCUMENT\b/gi) || []).length;
      const closed = (raw.match(/<\/DOCUMENT>/gi) || []).length;
      return { documents: parseDocumentTags(raw), truncated: opened > closed };
    })
  );

  const documents = {};
  const warnings = [];
  let firstError = null;
  let quotaError = null;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.status === "rejected") {
      if (result.reason && result.reason.code === "edge_ai_quota_exhausted") {
        quotaError = result.reason;
      }
      if (!firstError) firstError = result.reason;
      if (result.reason instanceof ProviderError) {
        const snippet = result.reason.details && result.reason.details.snippet;
        warnings.push(
          `${result.reason.provider}: ${result.reason.message}${snippet ? ` Response starts with: ${snippet}` : ""}`
        );
      } else {
        warnings.push(String((result.reason && result.reason.message) || result.reason || "AI generation failed"));
      }
      continue;
    }
    if (result.value.truncated) {
      warnings.push("AI output may be truncated; review the last generated document before sharing.");
    }
    for (const [id, markdown] of Object.entries(result.value.documents)) {
      documents[id] = markdown;
    }
  }

  if (quotaError) throw quotaError;
  if (!Object.keys(documents).length && firstError) {
    if (config.api === "edgeone" && firstError.code !== "edge_ai_quota_exhausted") {
      warnings.push(firstError.message);
      return { documents: {}, warnings };
    }
    throw firstError;
  }
  return { documents, warnings };
}

export { DOCUMENT_GROUPS };
