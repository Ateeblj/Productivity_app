// services/analyticsService.ts
// Insight layer: read-only stats from Goals + Daily + Weekly storage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllGoals,
  getLearningUnits,
  getMasterySummary,
  MasterySummary,
} from './goalsService';
import type { Roadmap } from '../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export interface DayCompletion {
  day: string; // Monday …
  short: string; // Mon
  completed: number;
  total: number;
  percent: number;
}

export interface GoalMasteryRow {
  goalId: string;
  title: string;
  summary: MasterySummary;
}

export interface ProductiveWeekday {
  day: string;
  short: string;
  completed: number;
  score: number; // completed tasks counted across recent history + current week
}

export interface AnalyticsSnapshot {
  weekDays: DayCompletion[];
  weekCompleted: number;
  weekTotal: number;
  weekPercent: number;
  goalMastery: GoalMasteryRow[];
  mostProductive: ProductiveWeekday | null;
  weekdayRanks: ProductiveWeekday[];
  generatedAt: number;
}

function shortDay(d: string) {
  return d.slice(0, 3);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday-based week containing `date`. */
function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadDailyTasks(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem('dailyTasks');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function loadWeeklyTasks(): Promise<Record<string, any[]>> {
  try {
    const { getWeeklyBoard } = await import('./actionsService');
    return await getWeeklyBoard();
  } catch {
    return {};
  }
}

async function loadWeeklyHistory(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem('weeklyHistory');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function getWeekCompletion(): Promise<{
  days: DayCompletion[];
  completed: number;
  total: number;
  percent: number;
}> {
  const weekly = await loadWeeklyTasks();
  const daily = await loadDailyTasks();
  const today = todayISO();

  // Map JS weekday to name
  const weekStart = startOfWeek();
  const days: DayCompletion[] = DAYS.map((day, i) => {
    const weekItems = Array.isArray(weekly[day]) ? weekly[day] : [];
    // Daily repeating habits only count once on "today" for that weekday name
    const dateForDay = new Date(weekStart);
    dateForDay.setDate(weekStart.getDate() + i);
    const iso = isoFromDate(dateForDay);
    const dailyForDay = daily.filter((t) => {
      const repeat = t.repeat || 'none';
      if (repeat === 'daily') {
        // attribute daily habits to every day of the current week for rate,
        // but only if dueDate is this week or missing
        return true;
      }
      return t.dueDate === iso || (t.dueDate === today && iso === today);
    });

    // Prefer weekly board as primary week signal; blend daily completes lightly
    const wDone = weekItems.filter((t) => t.completed).length;
    const wTotal = weekItems.length;
    const dDone = dailyForDay.filter((t) => t.completed).length;
    const dTotal = dailyForDay.length;

    // Weight weekly focuses higher; include daily as secondary
    const completed = wDone + (dTotal ? Math.min(dDone, 3) : 0);
    const total = wTotal + (dTotal ? Math.min(dTotal, 3) : 0);
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      day,
      short: shortDay(day),
      completed,
      total,
      percent,
    };
  });

  const completed = days.reduce((s, d) => s + d.completed, 0);
  const total = days.reduce((s, d) => s + d.total, 0);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { days, completed, total, percent };
}

export async function getMasteryByGoal(): Promise<GoalMasteryRow[]> {
  const goals = await getAllGoals();
  const rows: GoalMasteryRow[] = [];
  for (const g of goals) {
    const summary = await getMasterySummary(undefined, g.id);
    rows.push({ goalId: g.id, title: g.title || 'Untitled goal', summary });
  }
  return rows;
}

/**
 * Rank weekdays by completed weekly items (current board + history snapshots if any).
 */
export async function getProductiveWeekdays(): Promise<ProductiveWeekday[]> {
  const weekly = await loadWeeklyTasks();
  const history = await loadWeeklyHistory();
  const scores: Record<string, number> = {};
  for (const d of DAYS) scores[d] = 0;

  for (const d of DAYS) {
    const items = Array.isArray(weekly[d]) ? weekly[d] : [];
    scores[d] += items.filter((t) => t.completed).length;
  }

  // History entries may be { weekOf, tasks: { Monday: [...] } } or similar
  for (const entry of history) {
    const tasks = entry?.tasks || entry?.weeklyTasks || entry;
    if (!tasks || typeof tasks !== 'object') continue;
    for (const d of DAYS) {
      const items = Array.isArray(tasks[d]) ? tasks[d] : [];
      scores[d] += items.filter((t: any) => t.completed).length;
    }
  }

  // Daily: boost weekday of dueDate when completed
  const daily = await loadDailyTasks();
  for (const t of daily) {
    if (!t.completed || !t.dueDate) continue;
    try {
      const dt = new Date(t.dueDate + 'T12:00:00');
      if (Number.isNaN(dt.getTime())) continue;
      const name = DAYS[(dt.getDay() + 6) % 7]; // Mon=0
      scores[name] = (scores[name] || 0) + 1;
    } catch {
      /* ignore */
    }
  }

  const ranks: ProductiveWeekday[] = DAYS.map((day) => ({
    day,
    short: shortDay(day),
    completed: scores[day] || 0,
    score: scores[day] || 0,
  })).sort((a, b) => b.score - a.score);

  return ranks;
}

export async function buildWeeklySummaryText(snap?: AnalyticsSnapshot): Promise<string> {
  const data = snap || (await getAnalyticsSnapshot());
  const lines: string[] = [];
  const now = new Date();
  lines.push(`Weekly summary · ${now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`);
  lines.push('');
  lines.push(
    `This week: ${data.weekCompleted}/${data.weekTotal} items done (${data.weekPercent}%).`,
  );

  if (data.weekTotal === 0) {
    lines.push('No weekly focuses yet. Open Roadmap AI → Generate this week.');
  } else {
    const strong = [...data.weekDays].filter((d) => d.total > 0).sort((a, b) => b.percent - a.percent)[0];
    const weak = [...data.weekDays].filter((d) => d.total > 0).sort((a, b) => a.percent - b.percent)[0];
    if (strong) lines.push(`Strongest day this week: ${strong.day} (${strong.percent}%).`);
    if (weak && weak.day !== strong?.day) lines.push(`Needs attention: ${weak.day} (${weak.percent}%).`);
  }

  if (data.mostProductive && data.mostProductive.score > 0) {
    lines.push(
      `Most productive weekday overall: ${data.mostProductive.day} (${data.mostProductive.score} completions tracked).`,
    );
  } else {
    lines.push('Complete a few weekly/daily tasks to unlock your best weekday.');
  }

  lines.push('');
  if (data.goalMastery.length === 0) {
    lines.push('Goals: none yet. Generate a roadmap to track mastery.');
  } else {
    lines.push('Mastery by goal:');
    for (const g of data.goalMastery) {
      lines.push(
        `· ${g.title}: ${g.summary.masteryPercent}% (${g.summary.mastered}/${g.summary.total} units)` +
          (g.summary.needsRevision ? `, ${g.summary.needsRevision} need revision` : ''),
      );
    }
  }

  lines.push('');
  lines.push('Tip: switch goals → Generate this week for each active curriculum.');
  return lines.join('\n');
}

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const week = await getWeekCompletion();
  const goalMastery = await getMasteryByGoal();
  const weekdayRanks = await getProductiveWeekdays();
  const mostProductive =
    weekdayRanks.length && weekdayRanks[0].score > 0 ? weekdayRanks[0] : null;

  return {
    weekDays: week.days,
    weekCompleted: week.completed,
    weekTotal: week.total,
    weekPercent: week.percent,
    goalMastery,
    mostProductive,
    weekdayRanks,
    generatedAt: Date.now(),
  };
}
