// hooks/useWeeklyBoard.ts
// Boy Scout extract: weekly board derived from app_actions (items 5–7).
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as syncedStorage from '../services/syncedStorage';
import {
  getWeeklyBoard,
  migrateWeeklyRoutineTasksToActions,
  deleteActions,
  type WeeklyBoard,
} from '../services/actionsService';
import type { AppAction } from '../types';

export interface WeeklyBoardTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  reminderTime?: string;
  tags?: string[];
  learningUnitId?: string | null;
}

export type WeeklyTasksMap = Record<string, WeeklyBoardTask[]>;

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const WEEKLY_HISTORY_KEY = 'weeklyHistory';

export const defaultWeeklyTasks = (): WeeklyTasksMap => ({
  Monday: [],
  Tuesday: [],
  Wednesday: [],
  Thursday: [],
  Friday: [],
  Saturday: [],
  Sunday: [],
});

export function actionToTask(a: AppAction): WeeklyBoardTask {
  return {
    id: a.id,
    title: a.title,
    description: a.description || '',
    completed: !!a.completed,
    reminderTime: a.scheduledTime,
    tags: a.tags,
    learningUnitId: a.learningUnitId,
  };
}

export function boardToWeeklyTasks(board: WeeklyBoard | Record<string, AppAction[]>): WeeklyTasksMap {
  const weekly = defaultWeeklyTasks();
  for (const day of DAYS_OF_WEEK) {
    weekly[day] = (board[day] || []).map(actionToTask);
  }
  return weekly;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Load derived weekly board; migrate legacy weeklyRoutineTasks once. */
export async function loadWeeklyTasksMap(): Promise<WeeklyTasksMap> {
  await migrateWeeklyRoutineTasksToActions();
  const board = await getWeeklyBoard();

  // Collapse duplicate Sunday review rows
  const reviewTitle = 'weekly roadmap review';
  const sun = board.Sunday || [];
  const reviews = sun.filter((t) => (t.title || '').toLowerCase() === reviewTitle);
  if (reviews.length > 1) {
    const keepId = reviews[0].id;
    const dropIds = reviews.slice(1).map((r) => r.id);
    await deleteActions(dropIds);
    board.Sunday = sun.filter(
      (t) => t.id === keepId || (t.title || '').toLowerCase() !== reviewTitle,
    );
  }

  return boardToWeeklyTasks(board);
}

/** Refresh board from Actions after a mutation. */
export async function refreshWeeklyTasksMap(): Promise<WeeklyTasksMap> {
  const board = await getWeeklyBoard();
  return boardToWeeklyTasks(board);
}

export async function recordWeeklyHistory(
  weekStart: Date,
  tasks: WeeklyTasksMap,
): Promise<void> {
  try {
    const weekKey = formatDateKey(weekStart);
    const dayPercentages: Record<string, number> = {};
    for (const day of DAYS_OF_WEEK) {
      const list = tasks[day] || [];
      const total = list.length;
      const completed = list.filter((t) => t.completed).length;
      dayPercentages[day] = total > 0 ? Math.round((completed / total) * 100) : 0;
    }
    const prev = await AsyncStorage.getItem(WEEKLY_HISTORY_KEY);
    const hist = prev ? JSON.parse(prev) : {};
    hist[weekKey] = dayPercentages;
    await syncedStorage.setItem(WEEKLY_HISTORY_KEY, JSON.stringify(hist));
  } catch {
    /* ignore */
  }
}

export function useWeeklyBoard() {
  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTasksMap>(defaultWeeklyTasks);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const map = await loadWeeklyTasksMap();
      setWeeklyTasks(map);
    } catch (e) {
      console.error('[useWeeklyBoard]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyLocal = useCallback(async (tasks: WeeklyTasksMap, weekStart: Date) => {
    setWeeklyTasks(tasks);
    await recordWeeklyHistory(weekStart, tasks);
  }, []);

  const refreshFromActions = useCallback(async (weekStart: Date) => {
    const map = await refreshWeeklyTasksMap();
    setWeeklyTasks(map);
    await recordWeeklyHistory(weekStart, map);
    return map;
  }, []);

  return {
    weeklyTasks,
    setWeeklyTasks,
    loading,
    setLoading,
    reload,
    applyLocal,
    refreshFromActions,
  };
}
