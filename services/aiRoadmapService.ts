// services/aiRoadmapService.ts
// In-app Roadmap AI: generate structure + expand topics (no copy/paste).
// Hard structural rules + paced expands (default ~60s between topic calls) to survive TPM limits.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AiProviderId = 'groq' | 'gemini' | 'openrouter' | 'custom';

export interface AiProviderConfig {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

const KEYS_STORAGE = 'roadmap_ai_keys';
const PREFS_STORAGE = 'roadmap_ai_prefs';

/**
 * Pause between *successful* expand calls (ms).
 * Keep short so a full plan finishes in minutes, not a frozen 15–40 min loop.
 * On HTTP 429 we wait the provider’s “try again in Xs” instead (see expand loop).
 */
export const DEFAULT_EXPAND_GAP_MS = 3_000;
/** Floor between successful calls */
export const MIN_EXPAND_GAP_MS = 1_500;
/** When rate-limited and the API gives no hint, wait this long before retry */
export const RATE_LIMIT_FALLBACK_MS = 30_000;

export const PROVIDER_DEFAULTS: Record<
  AiProviderId,
  { label: string; baseUrl?: string; models: string[]; keyPage?: string }
> = {
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    // Prefer 70B for structure quality; 8B is faster but often returns thin plans under free TPM.
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    keyPage: 'https://console.groq.com/keys',
  },
  gemini: {
    label: 'Gemini',
    // Full flash before lite — lite is more likely to under-scope multi-month plans.
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'],
    keyPage: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    // Free models are RPM/TPM tight and often thin — still listed last resort.
    models: ['google/gemini-2.0-flash-exp:free', 'openai/gpt-oss-20b:free'],
    keyPage: 'https://openrouter.ai/keys',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    models: [],
  },
};

export async function loadAiKeys(): Promise<Partial<Record<AiProviderId, string>>> {
  try {
    const raw = await AsyncStorage.getItem(KEYS_STORAGE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveAiKey(provider: AiProviderId, key: string): Promise<void> {
  const keys = await loadAiKeys();
  keys[provider] = key.trim();
  await AsyncStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
}

export async function loadAiPrefs(): Promise<{
  lastProvider?: AiProviderId;
  lastModel?: string;
  customBaseUrl?: string;
}> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_STORAGE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveAiPrefs(prefs: {
  lastProvider?: AiProviderId;
  lastModel?: string;
  customBaseUrl?: string;
}): Promise<void> {
  await AsyncStorage.setItem(PREFS_STORAGE, JSON.stringify(prefs));
}

function cleanJsonText(raw: string): any {
  let t = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse “try again in 27.58s” style hints from 429 bodies. */
export function parseRetryAfterMs(errorMessage: string): number | null {
  const m = errorMessage.match(/try again in\s+([\d.]+)\s*s/i);
  if (m) {
    const sec = parseFloat(m[1]);
    if (!Number.isNaN(sec) && sec > 0) return Math.ceil(sec * 1000) + 1500;
  }
  const m2 = errorMessage.match(/retry-after["']?\s*[:=]\s*["']?(\d+)/i);
  if (m2) {
    const sec = parseInt(m2[1], 10);
    if (!Number.isNaN(sec) && sec > 0) return sec * 1000 + 1000;
  }
  return null;
}

function isRateLimitError(msg: string): boolean {
  return /429|rate[_ ]limit|tokens per minute|TPM|too many requests/i.test(msg);
}

/**
 * Gap after a *successful* expand before starting the next topic.
 * Long fixed gaps (e.g. 60s × 20 topics) felt like an infinite loop — avoid that.
 * Rate limits are handled only when a 429 actually occurs.
 */
export function recommendedExpandGapMs(model: string): number {
  const m = (model || '').toLowerCase();
  if (m.includes('8b') || m.includes('instant') || m.includes('flash-lite') || m.includes('mini')) {
    return 2_000;
  }
  if (m.includes('flash')) {
    return 3_000;
  }
  // 70b / large — slightly longer, still not a full minute
  return 5_000;
}

async function callOpenAICompat(
  baseUrl: string,
  model: string,
  apiKey: string,
  prompt: string,
  temperature = 0.3,
): Promise<any> {
  const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
  // Free tiers often hard-cap output well below 8k; still request high and detect truncation.
  const maxTokens = /8b|instant|mini|lite|oss-20b|free/i.test(model) ? 4096 : 8192;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You output rich, complete JSON only. Never omit fields. Never return a single thin phase for multi-month goals. Prefer substance over brevity.',
        },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    throw new Error(`API ${resp.status}: ${body.slice(0, 500)}`);
  }
  const data = JSON.parse(body);
  const choice = data?.choices?.[0];
  const text = choice?.message?.content || '';
  const finish = String(choice?.finish_reason || choice?.native_finish_reason || '');
  if (!text) throw new Error('Empty response from provider');
  if (/length|max_tokens/i.test(finish)) {
    throw new Error(
      `Response truncated (finish_reason=${finish}). Use a larger model or turn expand off and expand phases later.`,
    );
  }
  try {
    return cleanJsonText(text);
  } catch (e: any) {
    // Truncated JSON often fails parse — surface as retryable quality error
    throw new Error(
      `Invalid/truncated JSON from model (${e?.message || 'parse error'}). Retry or switch model.`,
    );
  }
}

async function callGemini(
  model: string,
  apiKey: string,
  prompt: string,
  temperature = 0.3,
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const maxOut = /lite|flash-lite/i.test(model) ? 4096 : 8192;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxOut,
        responseMimeType: 'application/json',
      },
    }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    throw new Error(`Gemini ${resp.status}: ${body.slice(0, 500)}`);
  }
  const data = JSON.parse(body);
  const cand = data?.candidates?.[0];
  const text = cand?.content?.parts?.map((p: any) => p.text).join('') || '';
  const reason = String(cand?.finishReason || cand?.finish_reason || '');
  if (!text) throw new Error('Empty response from Gemini');
  if (/MAX_TOKENS|LENGTH/i.test(reason)) {
    throw new Error(
      `Gemini response truncated (${reason}). Retry with gemini-2.0-flash or fewer topics per run.`,
    );
  }
  try {
    return cleanJsonText(text);
  } catch (e: any) {
    throw new Error(`Invalid/truncated JSON from Gemini (${e?.message || 'parse error'}).`);
  }
}

export async function callAiJson(
  cfg: AiProviderConfig,
  prompt: string,
  temperature = 0.3,
): Promise<any> {
  if (!cfg.apiKey?.trim()) throw new Error('API key required');
  if (cfg.provider === 'gemini') {
    return callGemini(cfg.model, cfg.apiKey, prompt, temperature);
  }
  const base =
    cfg.baseUrl ||
    PROVIDER_DEFAULTS[cfg.provider]?.baseUrl ||
    '';
  if (!base) throw new Error('Base URL required for this provider');
  return callOpenAICompat(base, cfg.model, cfg.apiKey, prompt, temperature);
}

/**
 * Call AI with automatic 429 backoff (up to maxAttempts).
 * onWait is called with remaining ms when sleeping for rate limits.
 */
export async function callAiJsonWithRetry(
  cfg: AiProviderConfig,
  prompt: string,
  temperature = 0.3,
  opts?: {
    maxAttempts?: number;
    onWait?: (ms: number, reason: string) => void;
  },
): Promise<any> {
  const maxAttempts = opts?.maxAttempts ?? 4;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callAiJson(cfg, prompt, temperature);
    } catch (e: any) {
      lastErr = e;
      const msg = e?.message || String(e);
      if (!isRateLimitError(msg) || attempt === maxAttempts) throw e;
      const hinted = parseRetryAfterMs(msg);
      const waitMs = Math.max(hinted ?? 30_000, 15_000);
      opts?.onWait?.(waitMs, `Rate limit — waiting ${Math.ceil(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

export interface GeneratePlanInput {
  goal: string;
  level: string;
  hoursPerDay: number;
  deadlineMonths: number;
  context?: string;
}

function minPhasesForHorizon(months: number, targetHours: number): number {
  if (months >= 6 || targetHours >= 150) return 6;
  if (months >= 3 || targetHours >= 60) return 4;
  if (months >= 2 || targetHours >= 35) return 3;
  return 2;
}

function maxPhasesForHorizon(months: number): number {
  if (months >= 6) return 8;
  if (months >= 3) return 7;
  return 5;
}

export interface PlanValidation {
  ok: boolean;
  phaseCount: number;
  sumHours: number;
  targetHours: number;
  minPhases: number;
  issues: string[];
}

export function validateStructurePlan(
  plan: any,
  targetStudyHours: number,
  deadlineMonths: number,
): PlanValidation {
  const milestones = Array.isArray(plan?.milestones) ? plan.milestones : [];
  const phaseCount = milestones.length;
  const sumHours = milestones.reduce((s: number, m: any) => s + (Number(m?.hours) || 0), 0);
  const minPhases = minPhasesForHorizon(deadlineMonths, targetStudyHours);
  const issues: string[] = [];

  if (phaseCount < minPhases) {
    issues.push(`Only ${phaseCount} phase(s); need at least ${minPhases} for a ${deadlineMonths}-month / ~${targetStudyHours}h plan.`);
  }
  if (phaseCount > maxPhasesForHorizon(deadlineMonths) + 2) {
    issues.push(`Too many phases (${phaseCount}).`);
  }
  const low = targetStudyHours * 0.55;
  const high = targetStudyHours * 1.35;
  if (sumHours < low) {
    issues.push(`Total phase hours ${sumHours}h is far below budget (~${targetStudyHours}h). Plan is too thin.`);
  }
  if (sumHours > high) {
    issues.push(`Total phase hours ${sumHours}h exceeds budget (~${targetStudyHours}h) by a lot.`);
  }
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const topics = m?.topics;
    const n = Array.isArray(topics) ? topics.length : 0;
    if (n < 2) issues.push(`Phase ${i + 1} (“${m?.name || '?'}”) has fewer than 2 topics.`);
    if (n > 8) issues.push(`Phase ${i + 1} has too many topics (${n}).`);
  }

  return {
    ok: issues.length === 0,
    phaseCount,
    sumHours,
    targetHours: targetStudyHours,
    minPhases,
    issues,
  };
}

function buildHardStructurePrompt(input: GeneratePlanInput, totalBudgetHours: number, targetStudyHours: number): string {
  const minP = minPhasesForHorizon(input.deadlineMonths, targetStudyHours);
  const maxP = maxPhasesForHorizon(input.deadlineMonths);
  const hoursPerPhase = Math.round(targetStudyHours / Math.max(minP, 4));

  return `You are a senior curriculum architect. Build a COMPLETE, multi-phase learning roadmap that FILLS the time budget. Shallow one-phase plans are FORBIDDEN.

GOAL: ${input.goal}
${input.context ? `EXTRA CONTEXT (use as grounding; adapt into phases — do not copy blindly):\n${input.context}\n` : ''}
STARTING LEVEL: ${input.level}
DAILY CAPACITY: ${input.hoursPerDay} hours/day
HORIZON: ${input.deadlineMonths} months
TOTAL EFFORT BUDGET: ~${totalBudgetHours} hours
ASSIGN TO ACTIVE STUDY: ~${targetStudyHours} hours (±15%)

Return ONLY valid JSON (no markdown):
{
  "goalType": "learning | skill | fitness | habit | routine | project | other",
  "summary": "3-5 sentences: honest outcome, strategy, success criteria, caveat",
  "durationMonths": ${input.deadlineMonths},
  "keyNumbers": { "dailyCalories": null, "weeklyTarget": null, "other": null, "durationMonths": ${input.deadlineMonths} },
  "milestones": [
    {
      "name": "descriptive phase title (never 'Milestone 1' or 'Phase 1')",
      "description": "2-3 sentences: what the learner DOES in this phase, why it unlocks the next, success criteria",
      "topics": ["specific executable topic", "another topic", "..."],
      "hours": number,
      "dependsOn": []
    }
  ],
  "notes": "realism notes if capacity slips"
}

HARD RULES (non-negotiable):
1. milestones.length MUST be between ${minP} and ${maxP} inclusive. NEVER return only 1 phase for a multi-month goal.
2. Sum of all milestone "hours" MUST be within ±15% of ${targetStudyHours}.
3. Each milestone: 3–6 concrete topics (executable skills/drills/modules — not vague themes).
4. Each milestone hours ≈ ${hoursPerPhase}h order-of-magnitude (distribute fairly; later phases may be heavier on application).
5. Progression required: foundations → intermediate technique → applied practice → integration / mastery-review.
6. dependsOn: only earlier milestone names; first phase uses [].
7. Phase names must describe skill content (e.g. "Active listening under pressure"), not numbers.
8. Match ambition to ${input.hoursPerDay} h/day × ${input.deadlineMonths} months — the plan must not be finishable in a few days of micro-drills.
9. If EXTRA CONTEXT lists candidate modules, map them into distinct phases where sensible; still obey hour budget and phase count.`;
}

function buildRepairPrompt(
  input: GeneratePlanInput,
  draft: any,
  validation: PlanValidation,
  targetStudyHours: number,
): string {
  const minP = validation.minPhases;
  return `The previous roadmap FAILED structural quality checks. Rewrite it as ONLY valid JSON.

FAILURES:
${validation.issues.map((i) => `- ${i}`).join('\n')}

REQUIREMENTS:
- ${minP}–${maxPhasesForHorizon(input.deadlineMonths)} milestones (phases)
- Sum of milestone hours ≈ ${targetStudyHours} (±15%)
- Each phase: 3–6 concrete topics + descriptive name + hours + dependsOn
- Multi-month progression; NO single-phase collapse

GOAL: ${input.goal}
Hours/day: ${input.hoursPerDay}
Months: ${input.deadlineMonths}
Level: ${input.level}

Broken draft (fix — do not keep its thin structure):
${JSON.stringify(draft).slice(0, 6000)}

Return the full corrected JSON object with milestones array.`;
}

export async function generateStructurePlan(
  cfg: AiProviderConfig,
  input: GeneratePlanInput,
  onProgress?: (msg: string) => void,
): Promise<any> {
  const totalBudgetHours = Math.round(input.hoursPerDay * 30 * input.deadlineMonths * 0.85);
  const targetStudyHours = Math.round(totalBudgetHours * 0.88);
  const prompt = buildHardStructurePrompt(input, totalBudgetHours, targetStudyHours);

  onProgress?.('Generating multi-phase structure…');
  let plan = await callAiJsonWithRetry(cfg, prompt, 0.25, {
    onWait: (ms, reason) => onProgress?.(reason),
  });

  let validation = validateStructurePlan(plan, targetStudyHours, input.deadlineMonths);

  // Up to two repair/regenerate passes if structure is thin / under-scoped
  for (let pass = 1; pass <= 2 && !validation.ok; pass++) {
    onProgress?.(
      `Structure too thin (${validation.phaseCount} phases, ${validation.sumHours}h / ~${targetStudyHours}h) — ${pass === 1 ? 'repairing' : 'full regenerate'}…`,
    );
    try {
      let candidate: any;
      if (pass === 1) {
        const repair = buildRepairPrompt(input, plan, validation, targetStudyHours);
        candidate = await callAiJsonWithRetry(cfg, repair, 0.2, {
          onWait: (ms, reason) => onProgress?.(reason),
        });
      } else {
        // Fresh generation with slightly higher temperature + explicit anti-thin line
        const fresh = buildHardStructurePrompt(input, totalBudgetHours, targetStudyHours)
          + `\n\nCRITICAL: Previous attempt had only ${validation.phaseCount} phase(s) and ${validation.sumHours}h. You MUST return at least ${validation.minPhases} phases totaling ~${targetStudyHours}h.`;
        candidate = await callAiJsonWithRetry(cfg, fresh, 0.35, {
          onWait: (ms, reason) => onProgress?.(reason),
        });
      }
      const v2 = validateStructurePlan(candidate, targetStudyHours, input.deadlineMonths);
      if (
        v2.ok ||
        v2.phaseCount > validation.phaseCount ||
        (v2.sumHours >= targetStudyHours * 0.55 && v2.phaseCount >= validation.minPhases)
      ) {
        plan = candidate;
        validation = v2;
      }
    } catch (e) {
      console.warn('[aiRoadmap] structure repair/regen failed', e);
    }
  }

  if (!plan?.milestones?.length) {
    throw new Error('Model returned no milestones. Try another model (prefer 70B / Flash, not 8B instant) or retry.');
  }

  // Soft warning attached for UI (still importable)
  plan.durationMonths = plan.durationMonths ?? input.deadlineMonths;
  if (!plan.keyNumbers) plan.keyNumbers = {};
  plan.keyNumbers.durationMonths = input.deadlineMonths;
  plan._validation = validation;

  if (!validation.ok) {
    onProgress?.(
      `Warning: plan still under-scoped (${validation.phaseCount} phases, ${validation.sumHours}h vs ~${targetStudyHours}h). You can regenerate or continue.`,
    );
  } else {
    onProgress?.(
      `Structure OK: ${validation.phaseCount} phases · ~${validation.sumHours}h (target ~${targetStudyHours}h)`,
    );
  }

  return plan;
}

/** Reject thin expands so the expand loop can retry instead of saving fluff. */
export function validateExpandQuality(
  data: any,
  approxHours: number,
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const subs = Array.isArray(data?.subtopics) ? data.subtopics : [];
  if (subs.length < 3) issues.push(`Only ${subs.length} subtopic(s); need 3–5.`);
  if (subs.length > 6) issues.push(`Too many subtopics (${subs.length}).`);

  let sumH = 0;
  for (let i = 0; i < subs.length; i++) {
    const s = subs[i];
    const h = Number(s?.hours) || 0;
    sumH += h;
    const what = String(s?.whatToDo || '');
    const name = String(s?.name || '');
    if (!name.trim()) issues.push(`Subtopic ${i + 1} missing name.`);
    if (what.trim().length < 40) {
      issues.push(`Subtopic ${i + 1} whatToDo is too short (<40 chars) — not executable.`);
    }
    if (h > 0 && h < 0.5) issues.push(`Subtopic ${i + 1} hours unrealistically low.`);
  }
  const target = Math.max(2, approxHours);
  if (sumH > 0 && sumH < target * 0.45) {
    issues.push(`Subtopic hours sum ${sumH}h is far below topic budget ~${target}h.`);
  }
  const rhythm = Array.isArray(data?.dailyRhythm) ? data.dailyRhythm : [];
  if (rhythm.length < 1) issues.push('Missing dailyRhythm.');

  return { ok: issues.length === 0, issues };
}

export async function expandTopic(
  cfg: AiProviderConfig,
  args: {
    goal: string;
    level: string;
    hoursPerDay: number;
    phaseName: string;
    phaseDescription?: string;
    topicName: string;
    approxHours: number;
  },
): Promise<{ subtopics: { name: string; hours?: number; whatToDo?: string }[]; dailyRhythm?: string[] }> {
  const hours = Math.max(3, Number(args.approxHours) || 5);
  const minWhat = 60;

  const prompt = `Expand ONE curriculum topic into SUBSTANTIAL multi-session practice. Tiny one-day drills are forbidden.

Overall goal: ${args.goal}
Starting level: ${args.level}
Hours/day available: ${args.hoursPerDay}
Parent phase: ${args.phaseName}
Phase description: ${args.phaseDescription || ''}
Topic to expand: ${args.topicName}
Approx hours for THIS topic ONLY: ${hours}

Return ONLY valid JSON:
{
  "subtopics": [
    {
      "name": "specific multi-session practice block",
      "hours": number,
      "whatToDo": "detailed executable instructions (≥${minWhat} characters): steps, how to practice, how to know it worked, spread across sessions"
    }
  ],
  "dailyRhythm": ["concrete daily/near-daily habit supporting this topic"]
}

HARD RULES:
1. Exactly 3–5 subtopics.
2. Sum of subtopic "hours" MUST be within ±25% of ${hours}.
3. Each whatToDo ≥ ${minWhat} characters — concrete steps, not "study the topic".
4. Each subtopic is a practice block lasting multiple sessions if hours ≥ 3.
5. Prefer drills, role-plays, projects, checklists, spaced review — measurable work.
6. dailyRhythm: 2–4 items that fit ${args.hoursPerDay} h/day capacity.
7. Do NOT return a single vague subtopic or empty whatToDo.`;

  // Up to 2 quality passes (plus rate-limit retries inside callAiJsonWithRetry)
  let lastData: any = null;
  let lastIssues: string[] = [];
  for (let pass = 1; pass <= 2; pass++) {
    const data = await callAiJsonWithRetry(
      cfg,
      pass === 1
        ? prompt
        : `${prompt}\n\nPREVIOUS OUTPUT WAS TOO THIN. Fix these issues:\n${lastIssues.map((i) => `- ${i}`).join('\n')}\nReturn a FULLER JSON expansion.`,
      pass === 1 ? 0.35 : 0.4,
    );
    lastData = data;
    if (!data?.subtopics || !Array.isArray(data.subtopics)) {
      throw new Error(`Expand failed for “${args.topicName}” (no subtopics)`);
    }
    const q = validateExpandQuality(data, hours);
    if (q.ok) return data;
    lastIssues = q.issues;
    console.warn('[aiRoadmap] thin expand', args.topicName, q.issues);
  }
  // Accept best effort but tag so UI can show warning
  if (lastData) {
    lastData._qualityIssues = lastIssues;
    return lastData;
  }
  throw new Error(`Expand failed for “${args.topicName}”`);
}

export type ExpandProgress = (
  done: number,
  total: number,
  label: string,
  extra?: { waitingMs?: number; status?: string },
) => void;

export interface ExpandTopicResult {
  key: string;
  topic: string;
  phaseName: string;
  ok: boolean;
  error?: string;
}

export interface ExpandAllResult {
  plan: any;
  results: ExpandTopicResult[];
  succeeded: number;
  failed: number;
  total: number;
}

export interface ExpandAllOptions {
  onlyKeys?: string[];
  /**
   * 'phase' (default) = one API call per phase (all topics in that phase).
   * 'topic' = one API call per topic (legacy; many more RPM hits).
   */
  mode?: 'phase' | 'topic';
  /** Override gap between phase/topic calls (ms). */
  gapMs?: number;
  onProgress?: ExpandProgress;
}

type ExpandJob = {
  mi: number;
  ti: number;
  topic: string;
  m: any;
  hours: number;
  key: string;
};

/**
 * ONE API call expands every topic in a phase.
 * This is the preferred path: ~4–8 calls per plan instead of 20–40.
 */
export async function expandPhase(
  cfg: AiProviderConfig,
  args: {
    goal: string;
    level: string;
    hoursPerDay: number;
    phaseName: string;
    phaseDescription?: string;
    phaseHours?: number;
    topics: { key: string; name: string; approxHours: number }[];
  },
): Promise<Record<string, { subtopics: any[]; dailyRhythm?: string[]; _qualityIssues?: string[] }>> {
  const topicLines = args.topics
    .map(
      (t, i) =>
        `${i + 1}. key="${t.key}" name="${t.name}" approxHours=${Math.max(3, Math.round(t.approxHours))}`,
    )
    .join('\n');

  const prompt = `Expand ONE learning phase into executable practice for EACH listed topic.
Return a single JSON object covering all topics in this phase — do not skip any.

Overall goal: ${args.goal}
Starting level: ${args.level}
Hours/day: ${args.hoursPerDay}
Phase: ${args.phaseName}
Phase description: ${args.phaseDescription || ''}
Phase hours (approx): ${args.phaseHours ?? 'n/a'}

Topics to expand (use the exact key strings in the output):
${topicLines}

Return ONLY valid JSON:
{
  "topics": [
    {
      "key": "exact key from the list above e.g. 0-2",
      "name": "topic name",
      "subtopics": [
        {
          "name": "multi-session practice block",
          "hours": number,
          "whatToDo": "detailed executable steps (≥60 characters)"
        }
      ],
      "dailyRhythm": ["habit supporting this topic"]
    }
  ],
  "phaseDailyRhythm": ["optional shared daily habits for the whole phase"]
}

HARD RULES:
1. Include EVERY topic key from the list — one entry per topic.
2. Each topic: 3–5 subtopics; sum of subtopic hours ≈ that topic's approxHours (±30%).
3. Each whatToDo ≥ 60 characters, concrete practice (not "study X").
4. Prefer drills, projects, role-play, checklists, spaced review.
5. Keep the whole phase coherent (later topics build on earlier ones when sensible).`;

  let data: any = null;
  for (let pass = 1; pass <= 2; pass++) {
    data = await callAiJsonWithRetry(
      cfg,
      pass === 1
        ? prompt
        : `${prompt}\n\nPREVIOUS OUTPUT MISSED TOPICS OR WAS TOO THIN. Every key must appear with 3–5 solid subtopics.`,
      pass === 1 ? 0.3 : 0.35,
    );
    const list = Array.isArray(data?.topics) ? data.topics : [];
    if (list.length >= Math.ceil(args.topics.length * 0.6)) break;
  }

  const out: Record<string, { subtopics: any[]; dailyRhythm?: string[]; _qualityIssues?: string[] }> = {};
  const list = Array.isArray(data?.topics) ? data.topics : [];
  const phaseRhythm = Array.isArray(data?.phaseDailyRhythm) ? data.phaseDailyRhythm : undefined;

  // Index by key and by name for fuzzy match
  const byKey = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const row of list) {
    if (row?.key) byKey.set(String(row.key), row);
    if (row?.name) byName.set(String(row.name).toLowerCase().trim(), row);
  }

  for (const t of args.topics) {
    const row =
      byKey.get(t.key) ||
      byName.get(t.name.toLowerCase().trim()) ||
      list.find(
        (r: any) =>
          String(r?.name || '')
            .toLowerCase()
            .includes(t.name.toLowerCase().slice(0, 12)),
      );
    if (!row?.subtopics || !Array.isArray(row.subtopics) || !row.subtopics.length) {
      continue; // caller marks this topic failed
    }
    const expansion = {
      subtopics: row.subtopics,
      dailyRhythm: row.dailyRhythm?.length ? row.dailyRhythm : phaseRhythm,
    };
    const q = validateExpandQuality(expansion, t.approxHours);
    out[t.key] = q.ok
      ? expansion
      : { ...expansion, _qualityIssues: q.issues };
  }

  return out;
}

/**
 * Expand the plan into Learning-Unit detail.
 * Default mode is **phase** (one API call per phase) — far fewer RPM hits than per-topic.
 * Pass mode: 'topic' only if you need the legacy one-call-per-topic behavior.
 */
export async function expandAllTopics(
  cfg: AiProviderConfig,
  plan: any,
  meta: { goal: string; level: string; hoursPerDay: number },
  onProgressOrOpts?: ExpandProgress | ExpandAllOptions,
  onlyKeysLegacy?: string[],
): Promise<ExpandAllResult> {
  let opts: ExpandAllOptions = {};
  if (typeof onProgressOrOpts === 'function') {
    opts = { onProgress: onProgressOrOpts, onlyKeys: onlyKeysLegacy };
  } else if (onProgressOrOpts) {
    opts = onProgressOrOpts;
  }

  const mode = opts.mode ?? 'phase';
  const gapMs = Math.max(
    MIN_EXPAND_GAP_MS,
    opts.gapMs ?? recommendedExpandGapMs(cfg.model),
  );
  const onlyKeys = opts.onlyKeys;
  const onProgress = opts.onProgress;

  const milestones = plan.milestones || [];
  const topicDetails: Record<string, any> = { ...(plan.topicDetails || {}) };
  const jobs: ExpandJob[] = [];

  milestones.forEach((m: any, mi: number) => {
    const topics = m.topics || [];
    const topicHours = topics.length ? (Number(m.hours) || 20) / topics.length : 5;
    topics.forEach((t: any, ti: number) => {
      const name = typeof t === 'string' ? t : t?.name;
      if (!name) return;
      const key = `${mi}-${ti}`;
      if (onlyKeys && onlyKeys.length > 0) {
        if (!onlyKeys.includes(key)) return;
      } else if (topicDetails[key]?.subtopics?.length) {
        return;
      }
      jobs.push({ mi, ti, topic: name, m, hours: topicHours, key });
    });
  });

  const results: ExpandTopicResult[] = [];

  if (jobs.length === 0) {
    onProgress?.(0, 0, '', { status: 'Nothing to expand (all topics already done or no topics).' });
    return { plan: { ...plan, topicDetails }, results: [], succeeded: 0, failed: 0, total: 0 };
  }

  // ── Phase mode (default): group jobs by milestone ─────────────
  if (mode === 'phase') {
    const byPhase = new Map<number, ExpandJob[]>();
    for (const j of jobs) {
      if (!byPhase.has(j.mi)) byPhase.set(j.mi, []);
      byPhase.get(j.mi)!.push(j);
    }
    const phaseIndexes = Array.from(byPhase.keys()).sort((a, b) => a - b);
    const totalPhases = phaseIndexes.length;
    let phasesDone = 0;

    onProgress?.(0, totalPhases, '', {
      status: `Expanding ${totalPhases} phase(s) · ${jobs.length} topics (1 API call per phase)`,
    });

    for (let pi = 0; pi < phaseIndexes.length; pi++) {
      const mi = phaseIndexes[pi];
      const phaseJobs = byPhase.get(mi)!;
      const phaseName = phaseJobs[0].m.name || `Phase ${mi + 1}`;

      onProgress?.(phasesDone, totalPhases, phaseName, {
        status: `Expanding phase ${phasesDone + 1}/${totalPhases}: “${phaseName}” (${phaseJobs.length} topics)`,
      });

      let attempt = 0;
      const maxAttempts = 3;
      let phaseOk = false;

      while (attempt < maxAttempts && !phaseOk) {
        attempt++;
        try {
          const expanded = await expandPhase(cfg, {
            goal: meta.goal,
            level: meta.level,
            hoursPerDay: meta.hoursPerDay,
            phaseName,
            phaseDescription: phaseJobs[0].m.description,
            phaseHours: Number(phaseJobs[0].m.hours) || undefined,
            topics: phaseJobs.map((j) => ({
              key: j.key,
              name: j.topic,
              approxHours: j.hours,
            })),
          });

          for (const j of phaseJobs) {
            const data = expanded[j.key];
            if (data?.subtopics?.length) {
              topicDetails[j.key] = data;
              const thin =
                Array.isArray(data._qualityIssues) && data._qualityIssues.length > 0;
              results.push({
                key: j.key,
                topic: j.topic,
                phaseName,
                ok: true,
                error: thin
                  ? `Saved but thin: ${data._qualityIssues!.slice(0, 2).join('; ')}`
                  : undefined,
              });
            } else {
              // Missing from phase response — try single-topic fallback once
              try {
                const one = await expandTopic(cfg, {
                  goal: meta.goal,
                  level: meta.level,
                  hoursPerDay: meta.hoursPerDay,
                  phaseName,
                  phaseDescription: phaseJobs[0].m.description,
                  topicName: j.topic,
                  approxHours: j.hours,
                });
                topicDetails[j.key] = one;
                results.push({
                  key: j.key,
                  topic: j.topic,
                  phaseName,
                  ok: true,
                  error: one?._qualityIssues?.length
                    ? `Saved but thin: ${one._qualityIssues.slice(0, 2).join('; ')}`
                    : undefined,
                });
              } catch (e2: any) {
                results.push({
                  key: j.key,
                  topic: j.topic,
                  phaseName,
                  ok: false,
                  error: e2?.message || 'Missing from phase expand',
                });
              }
            }
          }
          phaseOk = true;
        } catch (e: any) {
          const msg = e?.message || String(e);
          if (isRateLimitError(msg) && attempt < maxAttempts) {
            const waitMs = Math.max(
              parseRetryAfterMs(msg) ?? RATE_LIMIT_FALLBACK_MS,
              15_000,
            );
            onProgress?.(phasesDone, totalPhases, phaseName, {
              waitingMs: waitMs,
              status: `Rate limited on phase “${phaseName}” — waiting ${Math.ceil(waitMs / 1000)}s…`,
            });
            await sleep(waitMs);
            continue;
          }
          // Whole phase failed — mark all its topics failed
          console.warn('[aiRoadmap] phase expand failed', phaseName, e);
          for (const j of phaseJobs) {
            results.push({
              key: j.key,
              topic: j.topic,
              phaseName,
              ok: false,
              error: msg,
            });
          }
          phaseOk = true;
        }
      }

      phasesDone++;
      onProgress?.(phasesDone, totalPhases, phaseName, {
        status: `Phase ${phasesDone}/${totalPhases} done${pi < phaseIndexes.length - 1 ? ` · next: ${byPhase.get(phaseIndexes[pi + 1])![0].m.name}` : ''}`,
      });

      if (pi < phaseIndexes.length - 1) {
        await sleep(gapMs);
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    return {
      plan: { ...plan, topicDetails },
      results,
      succeeded,
      failed,
      total: results.length,
    };
  }

  // ── Topic mode (legacy): one call per topic ───────────────────
  let done = 0;
  onProgress?.(0, jobs.length, jobs[0].topic, {
    status: `Expanding ${jobs.length} topic(s) one-by-one (legacy mode)…`,
  });

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    onProgress?.(done, jobs.length, job.topic, {
      status: `Expanding ${done + 1}/${jobs.length}: ${job.topic}`,
    });

    let attempt = 0;
    const maxAttempts = 3;
    let finished = false;
    while (attempt < maxAttempts && !finished) {
      attempt++;
      try {
        const data = await expandTopic(cfg, {
          goal: meta.goal,
          level: meta.level,
          hoursPerDay: meta.hoursPerDay,
          phaseName: job.m.name,
          phaseDescription: job.m.description,
          topicName: job.topic,
          approxHours: job.hours,
        });
        topicDetails[job.key] = data;
        const thin = Array.isArray(data?._qualityIssues) && data._qualityIssues.length > 0;
        results.push({
          key: job.key,
          topic: job.topic,
          phaseName: job.m.name || `Phase ${job.mi + 1}`,
          ok: true,
          error: thin
            ? `Saved but thin: ${(data._qualityIssues as string[]).slice(0, 2).join('; ')}`
            : undefined,
        });
        finished = true;
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (isRateLimitError(msg) && attempt < maxAttempts) {
          const waitMs = Math.max(
            parseRetryAfterMs(msg) ?? RATE_LIMIT_FALLBACK_MS,
            15_000,
          );
          onProgress?.(done, jobs.length, job.topic, {
            waitingMs: waitMs,
            status: `Rate limited on “${job.topic}” — waiting ${Math.ceil(waitMs / 1000)}s…`,
          });
          await sleep(waitMs);
          continue;
        }
        results.push({
          key: job.key,
          topic: job.topic,
          phaseName: job.m.name || `Phase ${job.mi + 1}`,
          ok: false,
          error: msg,
        });
        finished = true;
      }
    }

    done++;
    if (i < jobs.length - 1) await sleep(gapMs);
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return {
    plan: { ...plan, topicDetails },
    results,
    succeeded,
    failed,
    total: results.length,
  };
}
