// services/actionsService.ts
// Actions own execution.
// Habits support Learning Units; completing a habit NEVER writes Learning Unit
// progress or status — only the habit completion record (completedDates / action.completed).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as syncedStorage from './syncedStorage';
import type { AppAction, ActionType, HabitDefinition } from '../types';

export const ACTIONS_KEY = 'app_actions';
export const HABIT_DEFINITIONS_KEY = 'habit_definitions';

function uid(prefix = 'act') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getActions(): Promise<AppAction[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTIONS_KEY);
    if (!raw) return [];
    const list: AppAction[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveActions(actions: AppAction[]): Promise<void> {
  await syncedStorage.setItem(ACTIONS_KEY, JSON.stringify(actions));
}

export async function getHabitDefinitions(): Promise<HabitDefinition[]> {
  try {
    const raw = await AsyncStorage.getItem(HABIT_DEFINITIONS_KEY);
    if (!raw) return [];
    const list: HabitDefinition[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveHabitDefinitions(habits: HabitDefinition[]): Promise<void> {
  await syncedStorage.setItem(HABIT_DEFINITIONS_KEY, JSON.stringify(habits));
}

export async function createAction(data: {
  type: ActionType;
  title: string;
  description?: string;
  learningUnitId?: string | null;
  habitId?: string | null;
  dueDate?: string;
  scheduledTime?: string;
  priority?: 'low' | 'medium' | 'high';
  repeat?: AppAction['repeat'];
  tags?: string[];
  weekday?: string;
}): Promise<AppAction> {
  const now = Date.now();
  const action: AppAction = {
    id: uid('act'),
    type: data.type,
    title: data.title,
    description: data.description,
    learningUnitId: data.learningUnitId ?? null,
    habitId: data.habitId ?? null,
    dueDate: data.dueDate,
    scheduledTime: data.scheduledTime,
    completed: false,
    priority: data.priority ?? 'medium',
    repeat: data.repeat ?? 'none',
    tags: data.tags ?? [],
    weekday: data.weekday,
    createdAt: now,
    updatedAt: now,
  };
  const all = await getActions();
  all.push(action);
  await saveActions(all);
  return action;
}

export async function toggleActionComplete(actionId: string): Promise<AppAction | null> {
  const all = await getActions();
  const now = Date.now();
  let found: AppAction | null = null;
  const next = all.map((a) => {
    if (a.id !== actionId) return a;
    const completed = !a.completed;
    found = {
      ...a,
      completed,
      completedAt: completed ? now : undefined,
      updatedAt: now,
    };
    return found;
  });
  if (!found) return null;
  await saveActions(next);
  return found;
}

export async function getActionsDueOn(dateISO: string): Promise<AppAction[]> {
  const all = await getActions();
  return all.filter(
    (a) =>
      !a.completed &&
      (a.dueDate === dateISO || (a.repeat === 'daily' && a.type === 'habit')),
  );
}

export async function getActionsForWeekday(weekday: string): Promise<AppAction[]> {
  const all = await getActions();
  return all.filter((a) => a.weekday === weekday && !a.completed);
}

export async function removeActionsByTag(tag: string): Promise<number> {
  const all = await getActions();
  const kept = all.filter((a) => !(a.tags || []).includes(tag));
  const removed = all.length - kept.length;
  if (removed > 0) await saveActions(kept);
  return removed;
}

export async function upsertHabitDefinition(data: {
  title: string;
  description?: string;
  source?: 'roadmap' | 'user';
  supportsUnitIds?: string[];
}): Promise<HabitDefinition> {
  const habits = await getHabitDefinitions();
  const existing = habits.find(
    (h) => h.title.trim().toLowerCase() === data.title.trim().toLowerCase(),
  );
  if (existing) return existing;
  const now = Date.now();
  const def: HabitDefinition = {
    id: uid('habit'),
    title: data.title.trim(),
    description: data.description,
    source: data.source ?? 'user',
    supportsUnitIds: data.supportsUnitIds,
    createdAt: now,
    updatedAt: now,
  };
  habits.push(def);
  await saveHabitDefinitions(habits);
  return def;
}

export async function replaceRoadmapWeekActions(
  newActions: Omit<AppAction, 'id' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt'>[],
): Promise<number> {
  const all = await getActions();
  const kept = all.filter((a) => !(a.tags || []).includes('roadmap-week'));
  const now = Date.now();
  const created: AppAction[] = newActions.map((n) => ({
    ...n,
    id: uid('act'),
    completed: false,
    tags: [...(n.tags || []), 'roadmap-week'],
    createdAt: now,
    updatedAt: now,
  }));
  await saveActions([...kept, ...created]);
  return created.length;
}

// ── Weekly board (derived from app_actions) ───────────────────

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type WeekdayName = (typeof WEEKDAYS)[number];

export type WeeklyBoard = Record<WeekdayName, AppAction[]>;

const WEEKLY_MIGRATE_FLAG = '__weekly_to_actions_migrated_v1__';

export function emptyWeeklyBoard(): WeeklyBoard {
  return {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };
}

/** Derived weekly view: Actions that have a weekday, grouped by day. */
export async function getWeeklyBoard(): Promise<WeeklyBoard> {
  const all = await getActions();
  const board = emptyWeeklyBoard();
  for (const a of all) {
    const day = a.weekday as WeekdayName | undefined;
    if (day && board[day]) {
      board[day].push(a);
    }
  }
  for (const day of WEEKDAYS) {
    board[day].sort((x, y) => {
      if (x.completed !== y.completed) return x.completed ? 1 : -1;
      return (x.createdAt || 0) - (y.createdAt || 0);
    });
  }
  return board;
}

/**
 * One-time: copy rows that exist only in weeklyRoutineTasks into app_actions
 * so nothing is lost when the weekly store is retired (migration safety rule step 3).
 */
export async function migrateWeeklyRoutineTasksToActions(): Promise<{
  migrated: number;
  already: boolean;
}> {
  try {
    const flag = await AsyncStorage.getItem(WEEKLY_MIGRATE_FLAG);
    if (flag === '1') {
      // Ensure legacy key stays gone even if an older build recreated it
      try { await AsyncStorage.removeItem('weeklyRoutineTasks'); } catch { /* ignore */ }
      return { migrated: 0, already: true };
    }

    const raw = await AsyncStorage.getItem('weeklyRoutineTasks');
    if (!raw) {
      try { await AsyncStorage.removeItem('weeklyRoutineTasks'); } catch { /* ignore */ }
      await AsyncStorage.setItem(WEEKLY_MIGRATE_FLAG, '1');
      return { migrated: 0, already: false };
    }

    let weekly: Record<string, any[]>;
    try {
      weekly = JSON.parse(raw);
    } catch {
      await AsyncStorage.setItem(WEEKLY_MIGRATE_FLAG, '1');
      return { migrated: 0, already: false };
    }

    const all = await getActions();
    const existingKeys = new Set(
      all.map(
        (a) =>
          `${(a.weekday || '').toLowerCase()}|${a.title.trim().toLowerCase()}|${a.learningUnitId || ''}`,
      ),
    );
    // Also match by id if weekly ids were previously copied
    const existingIds = new Set(all.map((a) => a.id));

    const now = Date.now();
    const created: AppAction[] = [];

    for (const day of WEEKDAYS) {
      const list = Array.isArray(weekly[day]) ? weekly[day] : [];
      for (const t of list) {
        if (!t || !t.title) continue;
        if (t.id && existingIds.has(t.id)) continue;
        const key = `${day.toLowerCase()}|${String(t.title).trim().toLowerCase()}|${t.learningUnitId || ''}`;
        if (existingKeys.has(key)) continue;

        const tags: string[] = Array.isArray(t.tags) ? [...t.tags] : [];
        // Preserve roadmap linkage markers if present in description but tags missing
        const desc = String(t.description || '');
        if (
          !tags.includes('roadmap-week') &&
          (desc.includes('Generated from phase') ||
            desc.includes('Learning Unit ·') ||
            desc.startsWith('Focus ·') ||
            desc.startsWith('Sub-topic ·'))
        ) {
          tags.push('roadmap', 'roadmap-week');
        }

        const action: AppAction = {
          id: typeof t.id === 'string' && t.id ? t.id : uid('act'),
          type: 'task',
          title: String(t.title).trim(),
          description: t.description || undefined,
          learningUnitId: t.learningUnitId ?? null,
          completed: !!t.completed,
          completedAt: t.completed ? now : undefined,
          scheduledTime: t.reminderTime || undefined,
          priority: 'medium',
          repeat: 'none',
          tags,
          weekday: day,
          createdAt: now,
          updatedAt: now,
        };
        created.push(action);
        existingKeys.add(key);
        existingIds.add(action.id);
      }
    }

    if (created.length) {
      await saveActions([...all, ...created]);
    }
    // Item 7: drop the legacy weekly store after migration so it cannot diverge again
    try {
      await AsyncStorage.removeItem('weeklyRoutineTasks');
    } catch { /* ignore */ }
    try {
      const { removeItem } = await import('./syncedStorage');
      // no-op if key not in SYNCED_KEYS; clear local only above is enough
    } catch { /* ignore */ }
    await AsyncStorage.setItem(WEEKLY_MIGRATE_FLAG, '1');
    return { migrated: created.length, already: false };
  } catch (e) {
    console.warn('[actions] weekly migrate failed', e);
    return { migrated: 0, already: false };
  }
}

export async function updateAction(
  actionId: string,
  patch: Partial<
    Pick<
      AppAction,
      | 'title'
      | 'description'
      | 'completed'
      | 'completedAt'
      | 'scheduledTime'
      | 'weekday'
      | 'priority'
      | 'tags'
      | 'learningUnitId'
    >
  >,
): Promise<AppAction | null> {
  const all = await getActions();
  const now = Date.now();
  let found: AppAction | null = null;
  const next = all.map((a) => {
    if (a.id !== actionId) return a;
    found = { ...a, ...patch, updatedAt: now };
    return found;
  });
  if (!found) return null;
  await saveActions(next);
  return found;
}

export async function deleteAction(actionId: string): Promise<boolean> {
  const all = await getActions();
  const next = all.filter((a) => a.id !== actionId);
  if (next.length === all.length) return false;
  await saveActions(next);
  return true;
}

export async function deleteActions(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const set = new Set(ids);
  const all = await getActions();
  const next = all.filter((a) => !set.has(a.id));
  const removed = all.length - next.length;
  if (removed > 0) await saveActions(next);
  return removed;
}

export async function setActionsCompleted(ids: string[], completed: boolean): Promise<number> {
  if (!ids.length) return 0;
  const set = new Set(ids);
  const now = Date.now();
  const all = await getActions();
  let n = 0;
  const next = all.map((a) => {
    if (!set.has(a.id)) return a;
    n++;
    return {
      ...a,
      completed,
      completedAt: completed ? now : undefined,
      updatedAt: now,
    };
  });
  if (n > 0) await saveActions(next);
  return n;
}

/** Count roadmap-linked items currently on the weekly board (from Actions). */
export async function countRoadmapWeekActions(): Promise<number> {
  const all = await getActions();
  return all.filter((a) => {
    const tags = a.tags || [];
    return tags.includes('roadmap-week') || tags.includes('roadmap');
  }).length;
}


/**
 * Record a habit completion for a calendar day.
 * Writes ONLY to the habit definition's completedDates (and optional habit-type Action).
 * Never calls Learning Unit state/progress APIs.
 */
export async function recordHabitCompletion(
  habitIdOrTitle: string,
  dateISO: string,
  completed: boolean = true,
): Promise<void> {
  const habits = await getHabitDefinitions();
  const idx = habits.findIndex(
    (h) =>
      h.id === habitIdOrTitle ||
      h.title.trim().toLowerCase() === habitIdOrTitle.trim().toLowerCase(),
  );
  if (idx < 0) return;
  const h = habits[idx];
  const set = new Set(h.completedDates || []);
  if (completed) set.add(dateISO);
  else set.delete(dateISO);
  habits[idx] = {
    ...h,
    completedDates: Array.from(set).sort(),
    updatedAt: Date.now(),
  };
  await saveHabitDefinitions(habits);
}

/**
 * Toggle completion of a habit-typed Action.
 * Does not update Learning Units — even if learningUnitId is accidentally set.
 */
export async function toggleHabitActionComplete(actionId: string): Promise<AppAction | null> {
  const all = await getActions();
  const action = all.find((a) => a.id === actionId);
  if (!action) return null;
  // Enforce: treat as habit if typed/tagged as such
  const isHabit =
    action.type === 'habit' ||
    !!action.habitId ||
    (action.tags || []).includes('roadmap-habit') ||
    (action.tags || []).includes('habit');
  if (!isHabit) {
    // Non-habit: normal toggle only (still no LU write here)
    return toggleActionComplete(actionId);
  }
  const updated = await toggleActionComplete(actionId);
  if (updated && action.habitId) {
    const day = new Date().toISOString().slice(0, 10);
    await recordHabitCompletion(action.habitId, day, updated.completed);
  } else if (updated) {
    const day = new Date().toISOString().slice(0, 10);
    await recordHabitCompletion(action.title, day, updated.completed);
  }
  return updated;
}
