// services/roadmapImportService.ts
//
// Roadmap import + local week packing (no AI in this file for packing).
// Mapping (v2.9+):
//   Roadmap / Phases / Learning Units  ← AI plan structure (knowledge)
//   app_actions                         ← scheduled work from Learning Units
//   Daily                               ← habits only (repeating) + ad-hoc tasks
//   Weekly                              ← derived projection of app_actions for the week
//   Monthly (Life calendar)             ← independent LifeEvents only (no roadmap copy)
//   Yearly                              ← reflection / phase markers for review
//
// "Generate this week" is local non-AI packing from the current phase's
// Learning Units into app_actions (see generateThisWeek).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as syncedStorage from './syncedStorage';
import {
  createLearningUnit,
  getLearningUnits,
  getUnitsByMilestone,
  sortUnitsForScheduling,
  replaceUnitsForGoal,
} from './goalsService';
import {
  upsertHabitDefinition,
  replaceRoadmapWeekActions,
} from './actionsService';
import type { LearningUnit, Roadmap } from '../types';

// ── Types from Roadmap AI ────────────────────────────────────────

export interface RoadmapTopicDetail {
  name: string;
  hours?: number;
  whatToDo?: string;
}

export interface RoadmapTopicExpansion {
  subtopics?: RoadmapTopicDetail[];
  dailyRhythm?: string[];
}

/** Topic can be a plain string or an expanded object (prototype / some AI outputs). */
export type RoadmapTopicInput =
  | string
  | {
      name: string;
      hours?: number;
      whatToDo?: string;
      subtopics?: RoadmapTopicDetail[];
      dailyRhythm?: string[];
      startDate?: string;
      endDate?: string;
    };

export interface RoadmapMilestone {
  name: string;
  description?: string;
  topics?: RoadmapTopicInput[];
  hours?: number;
  dependsOn?: string[];
  startDate?: string;
  endDate?: string;
  days?: number;
}

export interface RoadmapPlan {
  goalType?: string;
  summary?: string;
  /** Optional explicit horizon, e.g. 3 for a 3-month plan. */
  durationMonths?: number;
  keyNumbers?: {
    dailyCalories?: number | string | null;
    weeklyTarget?: number | string | null;
    other?: string | null;
    durationMonths?: number | string | null;
  };
  milestones: RoadmapMilestone[];
  notes?: string;
  /**
   * Expanded sub-topics. Keys may be:
   * - "0-0" / "0_0" (phaseIndex-topicIndex)
   * - topic name ("Process vs. Thread")
   * - "phaseIndex:topicName"
   */
  topicDetails?: Record<string, RoadmapTopicExpansion>;
}

function topicNameOf(t: RoadmapTopicInput): string {
  if (typeof t === 'string') return t.trim();
  return (t?.name || '').trim();
}

function topicInlineExpansion(t: RoadmapTopicInput): RoadmapTopicExpansion | null {
  if (typeof t === 'string') return null;
  if (t.subtopics?.length || t.dailyRhythm?.length) {
    return { subtopics: t.subtopics, dailyRhythm: t.dailyRhythm };
  }
  return null;
}

/** Resolve expansion for a topic from topicDetails and/or inline topic objects. */
function resolveTopicExpansion(
  plan: RoadmapPlan,
  phaseIndex: number,
  topicIndex: number,
  topic: RoadmapTopicInput,
): RoadmapTopicExpansion | null {
  const inline = topicInlineExpansion(topic);
  if (inline?.subtopics?.length) return inline;

  const name = topicNameOf(topic);
  const details = plan.topicDetails || {};
  const candidates = [
    `${phaseIndex}-${topicIndex}`,
    `${phaseIndex}_${topicIndex}`,
    `${phaseIndex}:${topicIndex}`,
    name,
    name.toLowerCase(),
    `${phaseIndex}-${name}`,
    `${phaseIndex}:${name}`,
    `${phaseIndex}_${name}`,
  ];
  for (const k of candidates) {
    if (k && details[k]?.subtopics?.length) return details[k];
  }
  // Fuzzy: any key that ends with topic name or contains it
  const lower = name.toLowerCase();
  if (lower) {
    for (const [k, v] of Object.entries(details)) {
      if (!v?.subtopics?.length) continue;
      const kl = k.toLowerCase();
      if (kl === lower || kl.endsWith(lower) || kl.includes(lower)) return v;
    }
  }
  return inline;
}

/** Infer plan horizon in months (user's "3 months" should win over phase count). */
export function inferDurationMonths(plan: RoadmapPlan): number {
  const n = plan.milestones?.length || 1;

  if (plan.durationMonths != null && Number(plan.durationMonths) > 0) {
    return Math.max(1, Math.round(Number(plan.durationMonths)));
  }
  const kn = plan.keyNumbers?.durationMonths;
  if (kn != null && String(kn).trim() && !Number.isNaN(Number(kn))) {
    return Math.max(1, Math.round(Number(kn)));
  }

  // "In 3 months …" / "over 12 weeks" from summary
  const summary = plan.summary || '';
  const m = summary.match(/\b(\d+)\s*months?\b/i);
  if (m) return Math.max(1, parseInt(m[1], 10));
  const w = summary.match(/\b(\d+)\s*weeks?\b/i);
  if (w) return Math.max(1, Math.ceil(parseInt(w[1], 10) / 4.345));

  // From milestone dates
  const starts = (plan.milestones || [])
    .map((x) => x.startDate)
    .filter(Boolean) as string[];
  const ends = (plan.milestones || [])
    .map((x) => x.endDate)
    .filter(Boolean) as string[];
  if (starts.length && ends.length) {
    const minS = starts.reduce((a, b) => (a < b ? a : b));
    const maxE = ends.reduce((a, b) => (a > b ? a : b));
    const days =
      (new Date(maxE + 'T12:00:00').getTime() - new Date(minS + 'T12:00:00').getTime()) /
      (1000 * 60 * 60 * 24);
    if (days > 0) return Math.max(1, Math.ceil(days / 30.44));
  }

  // Sum of phase days
  const totalDays = (plan.milestones || []).reduce(
    (s, x) => s + (typeof x.days === 'number' && x.days > 0 ? x.days : 0),
    0,
  );
  if (totalDays > 0) return Math.max(1, Math.ceil(totalDays / 30.44));

  // Fallback: one month per phase (old behavior)
  return Math.max(1, n);
}

/** Month offset [0, durationMonths) for phase i, spread evenly across the horizon. */
function phaseMonthOffset(phaseIndex: number, phaseCount: number, durationMonths: number): number {
  if (phaseCount <= 1) return 0;
  if (durationMonths <= 1) return 0;
  // Evenly space phases inside [0, durationMonths - 1]
  return Math.round((phaseIndex * (durationMonths - 1)) / (phaseCount - 1));
}

/** Persisted so Generate this week / banners know the active phase. */
export interface RoadmapState {
  plan: RoadmapPlan;
  currentPhaseIndex: number;
  importedAt: string;
  lastWeekGeneratedAt?: string;
  goalId?: string;
}

export const ROADMAP_STATE_KEY = 'roadmap_state';

// ── App storage shapes ───────────────────────────────────────────

interface DailyTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  reminderTime?: string;
  dueDate: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
}

interface WeeklyTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  reminderTime?: string;
  tags?: string[];
}

interface WeeklyTasks {
  [day: string]: WeeklyTask[];
}

interface MonthlyEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  completed: boolean;
  tags?: string[];
}

export interface YearlyGoal {
  id: string;
  month: string;
  title: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Achieved';
  /** Set on roadmap-imported phase goals so we can advance phases. */
  roadmapPhaseIndex?: number;
  tags?: string[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAILY_HABIT_RE =
  /\b(daily|every day|track|tracking|log|logging|weigh|weigh-in|calories?|steps?|water|meditat|journal|stretch|warmup|warm-up|cool-?down|habit|routine|check-?in|practice|study|review|anki|flashcard|read)\b/i;

function uid(prefix = 'rm') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthNameFromOffset(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return MONTHS[d.getMonth()];
}

function dedupeByTitle<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((h) => {
    const k = h.title.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Roadmap state ────────────────────────────────────────────────

export async function getRoadmapState(): Promise<RoadmapState | null> {
  try {
    // Prefer active goal's embedded plan (true multi-goal)
    const { getActiveGoal } = await import('./goalsService');
    const goal = await getActiveGoal();
    if (goal?.planJson?.milestones?.length) {
      return {
        plan: goal.planJson,
        currentPhaseIndex: goal.currentPhaseIndex ?? 0,
        importedAt: new Date(goal.updatedAt || Date.now()).toISOString(),
        goalId: goal.id,
      } as RoadmapState;
    }
    const raw = await AsyncStorage.getItem(ROADMAP_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RoadmapState;
  } catch {
    return null;
  }
}

export async function saveRoadmapState(state: RoadmapState): Promise<void> {
  await syncedStorage.setItem(ROADMAP_STATE_KEY, JSON.stringify(state));
}

export interface CurrentPhaseInfo {
  hasPlan: boolean;
  phaseIndex: number;
  totalPhases: number;
  name: string;
  description?: string;
  topics: string[];
  goalType?: string;
  summary?: string;
  statusLabel: string;
}

export async function getCurrentPhase(): Promise<CurrentPhaseInfo | null> {
  const state = await getRoadmapState();
  if (!state?.plan?.milestones?.length) return null;

  const idx = Math.min(
    Math.max(0, state.currentPhaseIndex),
    state.plan.milestones.length - 1,
  );
  const m = state.plan.milestones[idx];
  return {
    hasPlan: true,
    phaseIndex: idx,
    totalPhases: state.plan.milestones.length,
    name: m.name || `Phase ${idx + 1}`,
    description: m.description,
    topics: m.topics || [],
    goalType: state.plan.goalType,
    summary: state.plan.summary,
    statusLabel: 'In progress',
  };
}

/** Banner-friendly one-liner. */
export function formatPhaseBanner(info: CurrentPhaseInfo | null): string | null {
  if (!info) return null;
  return `Phase ${info.phaseIndex + 1} of ${info.totalPhases} · ${info.name} · In progress`;
}

// ── Extractors ───────────────────────────────────────────────────

/**
 * Daily should only hold a small set of *true* repeating habits.
 * Per-topic dailyRhythm lines (dozens across the curriculum) are study
 * session tips — NOT permanent daily tasks. We compress them into at most
 * 3 generic habits: Review · Deep work · Wrap-up.
 * Topic titles are never imported as daily habits.
 */
function extractDailyHabits(plan: RoadmapPlan): { title: string; description: string }[] {
  const rawLines: string[] = [];

  for (const key of Object.keys(plan.topicDetails || {})) {
    for (const item of plan.topicDetails![key].dailyRhythm || []) {
      if (item?.trim()) rawLines.push(item.trim());
    }
  }
  for (const m of plan.milestones || []) {
    for (const t of m.topics || []) {
      if (typeof t === 'object' && t.dailyRhythm) {
        for (const item of t.dailyRhythm) {
          if (item?.trim()) rawLines.push(item.trim());
        }
      }
    }
  }

  const REVIEW_RE =
    /\b(review|flashcard|notes|anki|recap|revise|vocabulary|definitions|formulas)\b/i;
  const DEEP_RE =
    /\b(deep work|practice|coding|code|simulation|problems|hands-?on|strace|worked examples|diagram|write|implement|study session)\b/i;
  const WRAP_RE =
    /\b(takeaway|summary|teach-?back|quiz|reflect|wrap|error log|checkpoint|plan next)\b/i;

  const hasReview = rawLines.some((l) => REVIEW_RE.test(l));
  const hasDeep = rawLines.some((l) => DEEP_RE.test(l));
  const hasWrap = rawLines.some((l) => WRAP_RE.test(l));

  const habits: { title: string; description: string }[] = [];

  if (rawLines.length) {
    // Compress dozens of per-topic rhythms into a stable daily loop
    if (hasReview || rawLines.length) {
      habits.push({
        title: 'Review previous notes (20–30 min)',
        description:
          'Roadmap habit · supports current Learning Units (not a topic itself)',
      });
    }
    if (hasDeep || rawLines.length) {
      habits.push({
        title: 'Deep work on 1–2 Learning Units (60–90 min)',
        description:
          'Roadmap habit · pick units from Goals / this week’s focuses',
      });
    }
    if (hasWrap || rawLines.length) {
      habits.push({
        title: 'Wrap-up: quiz or 3 takeaways (10–15 min)',
        description: 'Roadmap habit · active recall before ending the session',
      });
    }
  }

  // Explicit habit-like key numbers only (e.g. fitness plans)
  const kn = plan.keyNumbers;
  if (kn?.dailyCalories != null && String(kn.dailyCalories).trim()) {
    habits.push({
      title: `Track calories (target ${kn.dailyCalories})`,
      description: 'From roadmap key numbers',
    });
  }

  // True habit-named topics only (never generic syllabus titles)
  for (const m of plan.milestones || []) {
    for (const t of m.topics || []) {
      const name = typeof t === 'string' ? t.trim() : (t?.name || '').trim();
      if (
        name &&
        DAILY_HABIT_RE.test(name) &&
        /\b(daily|every day|habit|track|log|journal|meditat|steps|water)\b/i.test(name)
      ) {
        habits.push({
          title: name,
          description: `Habit · ${m.name || 'roadmap'}`,
        });
      }
    }
  }

  // Default study loop when plan has no rhythms at all (learning goals)
  if (!habits.length && (plan.goalType === 'learning' || plan.goalType === 'skill' || !plan.goalType)) {
    habits.push(
      {
        title: 'Review previous notes (20–30 min)',
        description: 'Default roadmap study habit',
      },
      {
        title: 'Deep work on current phase units (60–90 min)',
        description: 'Default roadmap study habit · see Goals / Generate this week',
      },
      {
        title: 'Wrap-up: 3 takeaways (10 min)',
        description: 'Default roadmap study habit',
      },
    );
  }

  return dedupeByTitle(habits).slice(0, 5);
}

/** Work items for a specific phase — prefers expanded sub-topics (Learning Units). */
function extractPhaseWorkItems(
  plan: RoadmapPlan,
  phaseIndex: number,
): { title: string; description: string; learningUnitHint?: string }[] {
  const m = plan.milestones?.[phaseIndex];
  if (!m) return [];

  const items: { title: string; description: string; learningUnitHint?: string }[] = [];
  const phaseName = m.name || `Phase ${phaseIndex + 1}`;

  (m.topics || []).forEach((topic, ti) => {
    const name = topicNameOf(topic);
    if (!name) return;
    const detail = resolveTopicExpansion(plan, phaseIndex, ti, topic);
    if (detail?.subtopics?.length) {
      for (const st of detail.subtopics) {
        if (st.name?.trim()) {
          items.push({
            title: st.name.trim(),
            description: st.whatToDo || `Sub-topic · ${name} · ${phaseName}`,
            learningUnitHint: name,
          });
        }
      }
    } else {
      items.push({
        title: name,
        description: `Focus · ${phaseName}`,
        learningUnitHint: name,
      });
    }
  });

  return dedupeByTitle(items);
}

// ── Import result ────────────────────────────────────────────────

export interface ImportResult {
  dailyAdded: number;
  weeklyAdded: number;
  monthlyAdded: number;
  yearlyAdded: number;
  messages: string[];
}

function emptyResult(messages: string[]): ImportResult {
  return { dailyAdded: 0, weeklyAdded: 0, monthlyAdded: 0, yearlyAdded: 0, messages };
}

// ── Daily: habits only (max ~3–5; never dump every dailyRhythm line) ─

/** Remove previously imported roadmap daily habits so re-import stays clean. */
export async function clearRoadmapDailyHabits(goalId?: string): Promise<number> {
  const raw = await AsyncStorage.getItem('dailyTasks');
  const existing: DailyTask[] = raw ? JSON.parse(raw) : [];
  const goalTag = goalId ? `goal:${goalId}` : null;

  const isRoadmapHabit = (t: DailyTask) => {
    const tags = t.tags || [];
    if (tags.includes('roadmap-habit') || tags.includes('roadmap')) return true;
    const d = String(t.description || '');
    return (
      d.startsWith('Daily rhythm from Roadmap') ||
      d.startsWith('From phase:') ||
      d.startsWith('Roadmap habit') ||
      d.startsWith('Default roadmap study habit') ||
      d.startsWith('Habit ·') ||
      d.startsWith('From roadmap key numbers')
    );
  };

  const kept = existing.filter((t) => {
    if (!isRoadmapHabit(t)) return true; // never wipe user tasks / phase work
    if (goalTag) {
      // Only this goal's roadmap habits
      return !(t.tags || []).includes(goalTag);
    }
    // No goalId: wipe all roadmap habits
    return false;
  });
  const removed = existing.length - kept.length;
  if (removed > 0) {
    await syncedStorage.setItem('dailyTasks', JSON.stringify(kept));
  }
  return removed;
}

/** Collapse duplicate roadmap habits (same title + same goal tag). */
export async function dedupeDailyRoadmapHabits(): Promise<number> {
  const raw = await AsyncStorage.getItem('dailyTasks');
  const existing: DailyTask[] = raw ? JSON.parse(raw) : [];
  const seen = new Set<string>();
  const kept: DailyTask[] = [];
  let removed = 0;
  for (const t of existing) {
    const tags = t.tags || [];
    const isHabit = tags.includes('roadmap-habit') || tags.includes('roadmap');
    if (!isHabit) {
      kept.push(t);
      continue;
    }
    const goalTag = tags.find((x) => x.startsWith('goal:')) || '';
    const key = `${goalTag}::${(t.title || '').trim().toLowerCase()}`;
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    kept.push(t);
  }
  if (removed > 0) {
    await syncedStorage.setItem('dailyTasks', JSON.stringify(kept));
  }
  return removed;
}

export async function importPlanToDailyTasks(plan: RoadmapPlan, goalId?: string): Promise<ImportResult> {
  // Drop this goal's previous roadmap daily habits only
  const cleared = await clearRoadmapDailyHabits(goalId);

  const habits = extractDailyHabits(plan);
  if (!habits.length) {
    return emptyResult([
      cleared
        ? `Cleared ${cleared} old roadmap daily item(s). No new habits to add.`
        : 'No daily habits derived. Learning Units live in Goals; use Generate this week for concrete work.',
    ]);
  }

  const raw = await AsyncStorage.getItem('dailyTasks');
  const existing: DailyTask[] = raw ? JSON.parse(raw) : [];
  const goalTag = goalId ? `goal:${goalId}` : null;
  const existingKeys = new Set(
    existing.map((t) => {
      const gt = (t.tags || []).find((x) => x.startsWith('goal:')) || '';
      return `${gt}::${(t.title || '').trim().toLowerCase()}`;
    }),
  );
  const start = todayISO();
  const now = Date.now();
  const newTasks: DailyTask[] = [];

  for (const h of habits) {
    const key = `${goalTag || ''}::${h.title.toLowerCase()}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    newTasks.push({
      id: uid('daily'),
      title: h.title,
      description: h.description,
      completed: false,
      dueDate: start,
      repeat: 'daily',
      priority: 'medium',
      tags: ['roadmap', 'roadmap-habit', ...(goalId ? [`goal:${goalId}`] : [])],
      createdAt: now,
      updatedAt: now,
    });
  }

  if (newTasks.length) {
    await syncedStorage.setItem('dailyTasks', JSON.stringify([...existing, ...newTasks]));
  }

  return {
    dailyAdded: newTasks.length,
    weeklyAdded: 0,
    monthlyAdded: 0,
    yearlyAdded: 0,
    messages: [
      cleared ? `Cleared ${cleared} old noisy roadmap daily item(s).` : null,
      newTasks.length
        ? `Added ${newTasks.length} compact daily habit(s) (not every dailyRhythm line).`
        : 'Daily habits already present.',
      'Topic work lives in Roadmaps / Weekly — Daily only holds the study loop.',
    ].filter(Boolean) as string[],
  };
}

// ── Weekly on import: only Sunday review placeholder ─────────────

export async function importPlanToWeeklyRoutine(plan: RoadmapPlan, goalId?: string): Promise<ImportResult> {
  // No longer writes weeklyRoutineTasks. Week packing goes through app_actions via generateThisWeek.
  return {
    dailyAdded: 0,
    weeklyAdded: 0,
    monthlyAdded: 0,
    yearlyAdded: 0,
    messages: [
      'Weekly board is driven by app_actions. Use Generate this week to schedule the current phase.',
    ],
  };
}

// ── Monthly: life calendar only (architecture rule) ───────────────
// Roadmap phases must NOT be written here. Monthly is for birthdays,
// appointments, bills, trips, deadlines — not curriculum scheduling.
// Phase progress lives in Roadmaps + Yearly reflection markers.

export async function importPlanToMonthly(_plan: RoadmapPlan, _goalId?: string): Promise<ImportResult> {
  // Strip any legacy roadmap-phase events left by older imports so the
  // life calendar stays clean after re-import / upgrade.
  try {
    const raw = await AsyncStorage.getItem('monthlyEvents');
    const existing: MonthlyEvent[] = raw ? JSON.parse(raw) : [];
    const kept = existing.filter((e) => {
      const tags = e.tags || [];
      if (tags.includes('roadmap-phase') || tags.includes('roadmap')) return false;
      const d = String(e.description || '');
      if (d.startsWith('Roadmap phase') || d.includes('Phase window ends')) return false;
      return true;
    });
    if (kept.length !== existing.length) {
      await syncedStorage.setItem('monthlyEvents', JSON.stringify(kept));
      return emptyResult([
        `Monthly is life calendar only — removed ${existing.length - kept.length} legacy roadmap phase event(s). Add personal events (birthdays, trips) yourself.`,
      ]);
    }
  } catch {
    /* ignore */
  }
  return emptyResult([
    'Monthly stays a life calendar (birthdays, appointments, trips). Roadmap phases live in Roadmaps and Yearly reflection — nothing was written here.',
  ]);
}

// ── Yearly: outcome + phase goals ────────────────────────────────

export async function importPlanToYearly(plan: RoadmapPlan, goalId?: string): Promise<ImportResult> {
  const milestones = plan.milestones || [];
  if (!milestones.length) return emptyResult(['No milestones for yearly goals.']);

  const raw = await AsyncStorage.getItem('yearlyGoals');
  const existing: YearlyGoal[] = raw ? JSON.parse(raw) : [];
  const existingTitles = new Set(existing.map((g) => g.title.trim().toLowerCase()));
  const newGoals: YearlyGoal[] = [];

  // Optional top-level outcome goal
  if (plan.summary) {
    const outcomeTitle =
      plan.goalType && plan.goalType !== 'other'
        ? `${plan.goalType.charAt(0).toUpperCase() + plan.goalType.slice(1)} goal`
        : 'Main roadmap goal';
    if (!existingTitles.has(outcomeTitle.toLowerCase())) {
      newGoals.push({
        id: uid('yearly'),
        month: monthNameFromOffset(0),
        title: outcomeTitle,
        description: plan.summary.slice(0, 400),
        status: 'In Progress',
        tags: ['roadmap', 'roadmap-outcome', ...(goalId ? [`goal:${goalId}`] : [])],
      });
      existingTitles.add(outcomeTitle.toLowerCase());
    }
  }

  const durationMonths = inferDurationMonths(plan);
  milestones.forEach((m, i) => {
    const title = m.name || `Phase ${i + 1}`;
    if (existingTitles.has(title.toLowerCase())) return;
    const topicNames = (m.topics || []).map(topicNameOf).filter(Boolean);
    const monthOffset = phaseMonthOffset(i, milestones.length, durationMonths);
    newGoals.push({
      id: uid('yearly'),
      month: monthNameFromOffset(monthOffset),
      title,
      description:
        m.description ||
        [
          topicNames.length ? `Topics: ${topicNames.join(', ')}` : null,
          m.hours != null ? `~${m.hours}h` : null,
          `Horizon ${durationMonths} mo`,
        ]
          .filter(Boolean)
          .join(' · ') || '',
      status: i === 0 ? 'In Progress' : 'Pending',
      roadmapPhaseIndex: i,
      tags: ['roadmap', 'roadmap-phase', ...(goalId ? [`goal:${goalId}`] : [])],
    });
  });

  if (newGoals.length) {
    await syncedStorage.setItem('yearlyGoals', JSON.stringify([...existing, ...newGoals]));
  }

  return {
    dailyAdded: 0,
    weeklyAdded: 0,
    monthlyAdded: 0,
    yearlyAdded: newGoals.length,
    messages: [
      newGoals.length
        ? `Added ${newGoals.length} yearly goal(s) (outcome + phases). First phase is In Progress.`
        : 'Yearly goals already present.',
    ],
  };
}

// ── Materialize Learning Units (Goals source of truth) ───────────

/** Build Learning Units from plan topics / subtopics. Does not touch Planner stores. */
export async function materializeLearningUnits(
  plan: RoadmapPlan,
  options?: { goalId?: string; replaceGoalUnits?: boolean },
): Promise<{ count: number; goalId: string }> {
  const { createGoalShell, upsertGoal, replaceUnitsForGoal, getActiveGoalId } = await import('./goalsService');
  let goalId = options?.goalId;
  if (!goalId) {
    const shell = createGoalShell({
      title:
        plan.goalType && plan.goalType !== 'other'
          ? `${String(plan.goalType).charAt(0).toUpperCase() + String(plan.goalType).slice(1)} goal`
          : (plan.summary || 'Roadmap goal').slice(0, 48),
      summary: plan.summary,
      goalType: plan.goalType,
      durationMonths: (plan as any).durationMonths,
    });
    // will fill milestones below
    goalId = shell.id;
    await upsertGoal({
      ...shell,
      milestones: (plan.milestones || []).map((m, i) => ({
        index: i,
        name: m.name || `Phase ${i + 1}`,
        description: m.description,
        hours: m.hours,
        topics: (m.topics || []).map(topicNameOf).filter(Boolean),
      })),
      planJson: plan,
      currentPhaseIndex: 0,
    });
  }

  const units: LearningUnit[] = [];
  const milestones = plan.milestones || [];
  let expandedCount = 0;

  milestones.forEach((m, mi) => {
    (m.topics || []).forEach((topic, ti) => {
      const name = topicNameOf(topic);
      if (!name) return;
      const detail = resolveTopicExpansion(plan, mi, ti, topic);
      if (detail?.subtopics?.length) {
        expandedCount += detail.subtopics.length;
        for (const st of detail.subtopics) {
          if (!st.name?.trim()) continue;
          units.push(
            createLearningUnit({
              goalId: goalId!,
              milestoneIndex: mi,
              topicIndex: ti,
              topicName: name,
              name: st.name.trim(),
              whatToDo: st.whatToDo,
              estimatedMinutes:
                st.hours != null && !Number.isNaN(Number(st.hours))
                  ? Math.round(Number(st.hours) * 60)
                  : undefined,
              tags: ['roadmap', 'subtopic'],
            }),
          );
        }
      } else {
        units.push(
          createLearningUnit({
            goalId: goalId!,
            milestoneIndex: mi,
            topicIndex: ti,
            topicName: name,
            name,
            whatToDo:
              typeof topic === 'object' && topic.whatToDo
                ? topic.whatToDo
                : `Focus · ${m.name || `Phase ${mi + 1}`}`,
            estimatedMinutes:
              typeof topic === 'object' && topic.hours != null
                ? Math.round(Number(topic.hours) * 60)
                : undefined,
            tags: ['roadmap', 'topic'],
          }),
        );
      }
    });
  });

  // Merge with existing units for THIS goal only
  const existing = await getLearningUnits(goalId);
  const keyOf = (u: LearningUnit) =>
    `${u.milestoneIndex}|${u.topicIndex}|${u.name.trim().toLowerCase()}`;
  const existingMap = new Map(existing.map((u) => [keyOf(u), u]));
  const merged: LearningUnit[] = units.map((u) => {
    const prev = existingMap.get(keyOf(u));
    if (prev) {
      return {
        ...u,
        id: prev.id,
        goalId: goalId!,
        state: prev.state,
        masteryScore: prev.masteryScore,
        lastReviewedAt: prev.lastReviewedAt,
        createdAt: prev.createdAt,
        updatedAt: Date.now(),
      };
    }
    return { ...u, goalId: goalId! };
  });

  await replaceUnitsForGoal(goalId!, merged);

  // Refresh goal metadata
  const { getAllGoals, upsertGoal: upsert } = await import('./goalsService');
  const all = await getAllGoals();
  const g = all.find((x) => x.id === goalId);
  if (g) {
    await upsert({
      ...g,
      summary: plan.summary || g.summary,
      goalType: plan.goalType || g.goalType,
      planJson: plan,
      durationMonths: (plan as any).durationMonths ?? g.durationMonths,
      milestones: milestones.map((m, i) => ({
        index: i,
        name: m.name || `Phase ${i + 1}`,
        description: m.description,
        hours: m.hours,
        topics: (m.topics || []).map(topicNameOf).filter(Boolean),
      })),
      updatedAt: Date.now(),
    });
  }

  // Habit definitions from dailyRhythm (supports units; does not complete them)
  const habits = extractDailyHabits(plan);
  for (const h of habits) {
    await upsertHabitDefinition({
      title: h.title,
      description: h.description,
      source: 'roadmap',
    });
  }

  if (expandedCount === 0 && merged.length > 0) {
    console.warn(
      '[roadmap] No sub-topics found in topicDetails / inline topics. ' +
        'Paste the full expanded JSON (with topicDetails or nested subtopics) to get Learning Units per sub-topic.',
    );
  }

  return { count: merged.length, goalId: goalId! };
}

// ── Full import + save state ─────────────────────────────────────

export async function importFullPlan(plan: RoadmapPlan): Promise<ImportResult> {
  // 1) Goals source of truth
  const { count: unitsCreated, goalId } = await materializeLearningUnits(plan);

  // 2) Planner projections scoped to this goal
  const daily = await importPlanToDailyTasks(plan, goalId);
  await dedupeDailyRoadmapHabits();
  const weekly = await importPlanToWeeklyRoutine(plan, goalId);
  const monthly = await importPlanToMonthly(plan, goalId);
  const yearly = await importPlanToYearly(plan, goalId);

  await saveRoadmapState({
    plan,
    currentPhaseIndex: 0,
    importedAt: new Date().toISOString(),
    goalId,
  } as any);

  const horizon = inferDurationMonths(plan);
  return {
    dailyAdded: daily.dailyAdded,
    weeklyAdded: weekly.weeklyAdded,
    monthlyAdded: monthly.monthlyAdded,
    yearlyAdded: yearly.yearlyAdded,
    messages: [
      `Created ${unitsCreated} learning unit(s) in Roadmaps (expanded sub-topics when present).`,
      `Plan horizon: about ${horizon} month(s).`,
      ...daily.messages,
      ...weekly.messages,
      ...monthly.messages,
      ...yearly.messages,
      'Roadmaps track mastery. Life calendar is separate — add personal events there yourself.',
      'Open Roadmaps to update progress. Use “Generate this week” for study sessions (Mon–Sun).',
    ],
  };
}

// ── Generate this week (core) ────────────────────────────────────

export interface GenerateWeekResult {
  added: number;
  phaseName: string;
  phaseIndex: number;
  messages: string[];
}

/**
 * Scheduler (not importer): picks Learning Units from the *current* phase
 * by learning state (needs_revision > in_progress > not_started), writes
 * Actions, and projects into the weekly board for existing UI.
 */
export async function generateThisWeek(
  options: {
    maxItems?: number;
    reminderTime?: string;
    clearPreviousRoadmap?: boolean;
    /** Pack from this roadmap; defaults to active. */
    goalId?: string;
  } = {},
): Promise<GenerateWeekResult> {
  const maxItems = options.maxItems ?? 8;
  const reminderTime = options.reminderTime ?? '09:00 AM';
  const clearPrevious = options.clearPreviousRoadmap !== false;

  const { getActiveGoal, getAllGoals, getLearningUnits } = await import('./goalsService');

  // Resolve target roadmap (picker on Weekly, or active)
  let targetGoalId = options.goalId || null;
  let goalLabel = 'Roadmap';
  try {
    if (targetGoalId) {
      const all = await getAllGoals();
      const g = all.find((x) => x.id === targetGoalId);
      if (g?.title) goalLabel = g.title;
    } else {
      const g = await getActiveGoal();
      if (g?.id) targetGoalId = g.id;
      if (g?.title) goalLabel = g.title;
    }
  } catch { /* ignore */ }

  const state = await getRoadmapState();
  // Prefer roadmap_state when it matches target; else pack purely from Learning Units
  const stateMatches =
    !!state?.plan?.milestones?.length &&
    (!targetGoalId || !state.goalId || state.goalId === targetGoalId);

  if (!stateMatches && targetGoalId) {
    // Units-only path for a chosen roadmap
    let units = await getLearningUnits(targetGoalId);
    units = sortUnitsForScheduling(units).filter((u) => u.state !== 'mastered');
    if (!units.length) {
      return {
        added: 0,
        phaseName: goalLabel,
        phaseIndex: 0,
        messages: [
          `“${goalLabel}” has no open Learning Units to schedule. Expand topics or mark units as not mastered.`,
        ],
      };
    }
    const selected = units.slice(0, maxItems);
    // Full week including Saturday & Sunday as study days
    const weekdays = DAYS;
    const phaseName =
      selected[0] != null
        ? `Learning units · ${goalLabel}`
        : goalLabel;
    const added = await replaceRoadmapWeekActions(
      selected.map((u, i) => ({
        type: 'task' as const,
        title: u.name,
        description: u.whatToDo || `Learning Unit · ${goalLabel}`,
        learningUnitId: u.id,
        dueDate: undefined,
        scheduledTime: reminderTime,
        priority: u.state === 'needs_revision' ? ('high' as const) : ('medium' as const),
        repeat: 'none' as const,
        tags: ['roadmap', 'roadmap-week', `goal:${targetGoalId}`],
        weekday: weekdays[i % weekdays.length],
      })),
    );
    return {
      added,
      phaseName,
      phaseIndex: selected[0]?.milestoneIndex ?? 0,
      messages: [
        `Scheduled ${added} item(s) from “${goalLabel}”.`,
        'Ordered by learning state (revision → in progress → not started).',
        'Open Weekly to review the board.',
      ],
    };
  }

  if (!state?.plan?.milestones?.length) {
    return {
      added: 0,
      phaseName: '',
      phaseIndex: 0,
      messages: ['No roadmap imported yet. Parse a plan and run Import first.'],
    };
  }

  if (targetGoalId && !state.goalId) state.goalId = targetGoalId;
  if (targetGoalId) state.goalId = targetGoalId;

  const idx = Math.min(state.currentPhaseIndex ?? 0, state.plan.milestones.length - 1);
  const phase = state.plan.milestones[idx];
  const phaseName = phase.name || `Phase ${idx + 1}`;

  // Prefer Learning Units with adaptive order; fall back to plan extractors
  let units = await getUnitsByMilestone(idx, targetGoalId || state.goalId);
  units = sortUnitsForScheduling(units).filter((u) => u.state !== 'mastered');
  if (!units.length) {
    // Plan may exist before materialize — extract and still schedule titles
    const work = extractPhaseWorkItems(state.plan, idx).filter(
      (w) => !DAILY_HABIT_RE.test(w.title),
    );
    if (!work.length) {
      return {
        added: 0,
        phaseName,
        phaseIndex: idx,
        messages: [
          `Phase “${phaseName}” has no Learning Units to schedule. Import full plan or expand topics in Roadmap AI.`,
        ],
      };
    }
  }

  const selected = units.slice(0, maxItems);
  // Full week including Saturday & Sunday as study days
  const weekdays = DAYS;

  // Actions layer is the sole write target (app_actions).
  // Weekly board is derived from app_actions only (weeklyRoutineTasks persistence removed).
  let added = 0;
  if (selected.length) {
    added = await replaceRoadmapWeekActions(
      selected.map((u, i) => ({
        type: 'task' as const,
        title: u.name,
        description: u.whatToDo || `Learning Unit · ${phaseName}`,
        learningUnitId: u.id,
        dueDate: undefined,
        scheduledTime: reminderTime,
        priority: u.state === 'needs_revision' ? ('high' as const) : ('medium' as const),
        repeat: 'none' as const,
        tags: ['roadmap', 'roadmap-week', ...(state.goalId ? [`goal:${state.goalId}`] : [])],
        weekday: weekdays[i % weekdays.length],
      })),
    );
  } else {
    // Fall back: schedule titles from plan extractors when units are not materialized yet
    const work = extractPhaseWorkItems(state.plan, idx)
      .filter((w) => !DAILY_HABIT_RE.test(w.title))
      .slice(0, maxItems);
    if (work.length) {
      added = await replaceRoadmapWeekActions(
        work.map((w, i) => ({
          type: 'task' as const,
          title: w.title,
          description: w.description || `Learning Unit · ${phaseName}`,
          learningUnitId: null,
          dueDate: undefined,
          scheduledTime: reminderTime,
          priority: 'medium' as const,
          repeat: 'none' as const,
          tags: ['roadmap', 'roadmap-week', ...(state.goalId ? [`goal:${state.goalId}`] : [])],
          weekday: weekdays[i % weekdays.length],
        })),
      );
    }
  }

  state.lastWeekGeneratedAt = new Date().toISOString();
  await saveRoadmapState(state);

  const stateHint =
    selected.length > 0
      ? `Ordered by learning state (revision → in progress → not started).`
      : 'Scheduled from plan topics (import full plan to enable Learning Units).';

  return {
    added,
    phaseName,
    phaseIndex: idx,
    messages: [
      `Scheduled ${added} item(s) from phase ${idx + 1}: “${phaseName}”.`,
      stateHint,
      'Actions linked to Learning Units. Open Roadmaps to update mastery. Open Weekly to see the board.',
    ],
  };
}

// ── Mark phase complete → advance ────────────────────────────────

export interface AdvancePhaseResult {
  success: boolean;
  previousPhase?: string;
  newPhase?: string;
  finished?: boolean;
  messages: string[];
}

/**
 * Marks current phase Achieved on yearly goals, sets next to In Progress,
 * bumps roadmap_state.currentPhaseIndex.
 */
export async function markCurrentPhaseComplete(): Promise<AdvancePhaseResult> {
  const state = await getRoadmapState();
  if (!state?.plan?.milestones?.length) {
    return { success: false, messages: ['No active roadmap.'] };
  }

  const idx = state.currentPhaseIndex;
  const prevName = state.plan.milestones[idx]?.name || `Phase ${idx + 1}`;

  // Update yearly goals by roadmapPhaseIndex
  const raw = await AsyncStorage.getItem('yearlyGoals');
  const goals: YearlyGoal[] = raw ? JSON.parse(raw) : [];

  const updated = goals.map((g) => {
    if (g.roadmapPhaseIndex === idx) {
      return { ...g, status: 'Achieved' as const };
    }
    if (g.roadmapPhaseIndex === idx + 1) {
      return { ...g, status: 'In Progress' as const };
    }
    // Also match by title if index missing
    if (
      g.roadmapPhaseIndex == null &&
      g.title === state.plan.milestones[idx]?.name
    ) {
      return { ...g, status: 'Achieved' as const, roadmapPhaseIndex: idx };
    }
    if (
      g.roadmapPhaseIndex == null &&
      state.plan.milestones[idx + 1] &&
      g.title === state.plan.milestones[idx + 1].name
    ) {
      return { ...g, status: 'In Progress' as const, roadmapPhaseIndex: idx + 1 };
    }
    return g;
  });

  await syncedStorage.setItem('yearlyGoals', JSON.stringify(updated));

  if (idx + 1 >= state.plan.milestones.length) {
    state.currentPhaseIndex = idx; // stay on last
    await saveRoadmapState(state);
    return {
      success: true,
      previousPhase: prevName,
      finished: true,
      messages: [
        `“${prevName}” marked complete. All phases done — great work.`,
        'You can still Generate this week from the final phase for maintenance work.',
      ],
    };
  }

  state.currentPhaseIndex = idx + 1;
  await saveRoadmapState(state);
  try {
    const { getActiveGoal, upsertGoal, getUnitsByMilestone, setLearningUnitState } = await import('./goalsService');
    const g = await getActiveGoal();
    if (g && (!state.goalId || g.id === state.goalId)) {
      await upsertGoal({ ...g, currentPhaseIndex: idx + 1 });
    }
    // Soft-cascade: unfinished units in finished phase → Ready for Review (never auto-Mastered)
    try {
      const phaseUnits = await getUnitsByMilestone(idx, state.goalId || g?.id);
      for (const u of phaseUnits) {
        if (u.state === 'in_progress' || u.state === 'not_started' || u.state === 'ready_for_review') {
          if (u.state !== 'ready_for_review') {
            await setLearningUnitState(u.id, 'ready_for_review');
          }
        }
      }
    } catch { /* ignore */ }
  } catch { /* ignore */ }

  // app_actions is sole write target; generateThisWeek replaces roadmap-week actions.
  let packMsg = 'Open Weekly or tap Rebuild this week on Dashboard.';
  try {
    const pack = await generateThisWeek({ maxItems: 8, clearPreviousRoadmap: true });
    packMsg = pack.added
      ? `Packed ${pack.added} session(s) for the new phase.`
      : (pack.messages?.[0] || packMsg);
  } catch {
    /* leave packMsg */
  }

  const newName = state.plan.milestones[idx + 1].name || `Phase ${idx + 2}`;

  return {
    success: true,
    previousPhase: prevName,
    newPhase: newName,
    finished: false,
    messages: [
      `“${prevName}” → Achieved.`,
      `Current phase is now ${idx + 2}: “${newName}”.`,
      packMsg,
    ],
  };
}

/**
 * When user toggles a yearly goal to Achieved and it has roadmapPhaseIndex,
 * advance state if it was the current phase.
 */
export async function onYearlyGoalStatusChange(
  goal: YearlyGoal,
  newStatus: YearlyGoal['status'],
): Promise<AdvancePhaseResult | null> {
  if (newStatus !== 'Achieved' || goal.roadmapPhaseIndex == null) return null;

  const state = await getRoadmapState();
  if (!state) return null;
  if (goal.roadmapPhaseIndex !== state.currentPhaseIndex) return null;

  return markCurrentPhaseComplete();
}

// ── Parse ────────────────────────────────────────────────────────

export function parseRoadmapJson(raw: string): RoadmapPlan {
  let cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  // Tolerate leading prose before the first { … }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let data: any;
  try {
    data = JSON.parse(cleaned);
  } catch (e: any) {
    throw new Error(
      'Could not parse JSON. Copy the full Raw AI response (must include a "milestones" array). ' +
        (e?.message || ''),
    );
  }

  if (!data || !Array.isArray(data.milestones) || data.milestones.length < 1) {
    throw new Error(
      'JSON must contain a non-empty "milestones" array.\n\n' +
        'If Roadmap AI only returned a summary, generate again (the model truncated the plan). ' +
        'Then use "Copy JSON for app" and paste the full object here.',
    );
  }

  // Normalize topics (string or object with name)
  data.milestones = data.milestones.map((m: any) => ({
    ...m,
    topics: (m.topics || []).map((t: any) =>
      typeof t === 'string' ? t : t?.name != null ? t : String(t),
    ),
  }));

  return data as RoadmapPlan;
}
