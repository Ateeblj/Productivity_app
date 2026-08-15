// services/goalsService.ts
// Goals own knowledge. Multi-goal: many curricula, one active at a time.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as syncedStorage from './syncedStorage';
import type { LearningUnit, LearningState, Roadmap } from '../types';

export const LEARNING_UNITS_KEY = 'learning_units';
export const CURRICULUM_GOALS_KEY = 'curriculum_goals';
export const ACTIVE_GOAL_ID_KEY = 'active_goal_id';
/** @deprecated single-goal key — migrated on read */
export const CURRICULUM_GOAL_KEY = 'curriculum_goal';

function uid(prefix = 'lu') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Learning units ─────────────────────────────────────────────

export async function getLearningUnits(goalId?: string | null): Promise<LearningUnit[]> {
  try {
    const raw = await AsyncStorage.getItem(LEARNING_UNITS_KEY);
    if (!raw) return [];
    let list: LearningUnit[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Do NOT attach orphan units to the active goal (that mis-filed old data).
    // Orphans keep goalId undefined until explicitly assigned on save/replace.
    if (goalId) {
      return list.filter((u) => u.goalId === goalId);
    }
    return list;
  } catch {
    return [];
  }
}

export async function saveLearningUnits(units: LearningUnit[]): Promise<void> {
  await syncedStorage.setItem(LEARNING_UNITS_KEY, JSON.stringify(units));
}

export async function replaceUnitsForGoal(
  goalId: string,
  units: LearningUnit[],
): Promise<void> {
  const all = await getLearningUnits();
  const others = all.filter((u) => u.goalId && u.goalId !== goalId);
  await saveLearningUnits([...others, ...units.map((u) => ({ ...u, goalId }))]);
}

// ── Goals list ─────────────────────────────────────────────────

async function migrateSingleGoalIfNeeded(goals: Roadmap[]): Promise<Roadmap[]> {
  if (goals.length) return goals;
  try {
    const raw = await AsyncStorage.getItem(CURRICULUM_GOAL_KEY);
    if (!raw) return goals;
    const old = JSON.parse(raw) as Roadmap;
    if (!old?.id) {
      await AsyncStorage.removeItem(CURRICULUM_GOAL_KEY);
      return goals;
    }
    const migrated: Roadmap = {
      ...old,
      currentPhaseIndex: (old as any).currentPhaseIndex ?? 0,
      status: (old as any).status ?? 'active',
      createdAt: old.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    await syncedStorage.setItem(CURRICULUM_GOALS_KEY, JSON.stringify([migrated]));
    await syncedStorage.removeItem(CURRICULUM_GOAL_KEY); // never revive after delete
    await setActiveGoalId(migrated.id);
    return [migrated];
  } catch {
    return goals;
  }
}

export async function getAllGoals(): Promise<Roadmap[]> {
  try {
    const raw = await AsyncStorage.getItem(CURRICULUM_GOALS_KEY);
    let goals: Roadmap[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(goals)) goals = [];
    goals = await migrateSingleGoalIfNeeded(goals);
    return goals.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

export async function saveAllGoals(goals: Roadmap[]): Promise<void> {
  // Single write path — syncedStorage always writes local + queues cloud
  await syncedStorage.setItem(CURRICULUM_GOALS_KEY, JSON.stringify(goals));
}

export async function getActiveGoalId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_GOAL_ID_KEY);
    if (!raw) return null;
    // Tolerate legacy JSON-quoted ids ("goal_xxx") from older cloud pulls
    const trimmed = raw.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'string' ? parsed : trimmed;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  } catch {
    return null;
  }
}

export async function setActiveGoalId(id: string | null): Promise<void> {
  if (id == null) {
    await syncedStorage.removeItem(ACTIVE_GOAL_ID_KEY);
  } else {
    await syncedStorage.setItem(ACTIVE_GOAL_ID_KEY, id);
    // Point roadmap_state at this goal so Generate this week / phase banner match
    try {
      const goals = await getAllGoals();
      const g = goals.find((x) => x.id === id);
      if (g?.planJson?.milestones?.length) {
        await syncedStorage.setItem(
          'roadmap_state',
          JSON.stringify({
            plan: g.planJson,
            currentPhaseIndex: g.currentPhaseIndex ?? 0,
            importedAt: new Date(g.updatedAt || Date.now()).toISOString(),
            goalId: g.id,
          }),
        );
      }
    } catch { /* ignore */ }
  }
}

export async function getActiveGoal(): Promise<Roadmap | null> {
  const goals = await getAllGoals();
  if (!goals.length) return null;
  const activeId = await getActiveGoalId();
  const found = activeId ? goals.find((g) => g.id === activeId) : null;
  return found || goals[0];
}

/** Back-compat: single “current” goal */
export async function getRoadmap(): Promise<Roadmap | null> {
  return getActiveGoal();
}

export async function saveRoadmap(goal: Roadmap): Promise<void> {
  const goals = await getAllGoals();
  const idx = goals.findIndex((g) => g.id === goal.id);
  const next = { ...goal, updatedAt: Date.now() };
  if (idx >= 0) goals[idx] = next;
  else goals.unshift(next);
  await saveAllGoals(goals);
  await setActiveGoalId(goal.id);
}

export async function upsertGoal(goal: Roadmap): Promise<Roadmap> {
  await saveRoadmap(goal);
  return goal;
}

/** Tag used on Daily / Weekly / Monthly / Yearly items for a goal. */
export function goalTag(goalId: string): string {
  return `goal:${goalId}`;
}

export function itemBelongsToActiveGoal(
  tags: string[] | undefined,
  activeGoalId: string | null,
  description?: string,
): boolean {
  const t = tags || [];
  const goalTags = t.filter((x) => x.startsWith('goal:'));
  // No goal tag → always show (user tasks + legacy roadmap habits)
  if (!goalTags.length) return true;
  // Tagged for a goal: show only when it matches active (or no active yet)
  if (!activeGoalId) return true;
  return goalTags.includes(goalTag(activeGoalId));
}

/** Remove planner projections that belong to a deleted goal. */
export async function purgePlannerForGoal(goalId: string): Promise<void> {
  const tag = goalTag(goalId);

  // Daily
  try {
    const raw = await AsyncStorage.getItem('dailyTasks');
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const next = list.filter((x: any) => !(x.tags || []).includes(tag));
      await syncedStorage.setItem('dailyTasks', JSON.stringify(next));
    }
  } catch { /* ignore */ }

  // Weekly board is derived from app_actions — purge this goal's actions by tag
  try {
    const { removeActionsByTag } = await import('./actionsService');
    await removeActionsByTag(tag);
  } catch { /* ignore */ }
  // Drop any leftover legacy weeklyRoutineTasks key (no longer a store)
  try {
    await AsyncStorage.removeItem('weeklyRoutineTasks');
  } catch { /* ignore */ }

  // Monthly
  try {
    const raw = await AsyncStorage.getItem('monthlyEvents');
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const next = list.filter((x: any) => !(x.tags || []).includes(tag));
      await syncedStorage.setItem('monthlyEvents', JSON.stringify(next));
    }
  } catch { /* ignore */ }

  // Yearly
  try {
    const raw = await AsyncStorage.getItem('yearlyGoals');
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const next = list.filter((x: any) => !(x.tags || []).includes(tag));
      await syncedStorage.setItem('yearlyGoals', JSON.stringify(next));
    }
  } catch { /* ignore */ }
}

export async function deleteGoal(goalId: string): Promise<void> {
  if (!goalId) throw new Error('Missing goal id');

  const before = await getAllGoals();
  const remaining = before.filter((g) => g.id !== goalId);
  await syncedStorage.setItem(CURRICULUM_GOALS_KEY, JSON.stringify(remaining));

  // Never let legacy single-goal key revive a deleted goal
  try {
    await syncedStorage.removeItem(CURRICULUM_GOAL_KEY);
  } catch {
    try { await AsyncStorage.removeItem(CURRICULUM_GOAL_KEY); } catch { /* ignore */ }
  }

  // Learning units for this goal only
  try {
    const raw = await AsyncStorage.getItem(LEARNING_UNITS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const next = list.filter((u: any) => u && u.goalId !== goalId);
      await syncedStorage.setItem(LEARNING_UNITS_KEY, JSON.stringify(next));
    }
  } catch { /* ignore */ }

  try {
    await purgePlannerForGoal(goalId);
  } catch { /* ignore */ }

  const active = await getActiveGoalId();
  const nextActive = remaining[0]?.id ?? null;
  if (active === goalId || !remaining.find((g) => g.id === active)) {
    if (nextActive) {
      await syncedStorage.setItem(ACTIVE_GOAL_ID_KEY, nextActive);
      const g = remaining[0];
      if (g?.planJson?.milestones?.length) {
        const st = {
          plan: g.planJson,
          currentPhaseIndex: g.currentPhaseIndex ?? 0,
          importedAt: new Date().toISOString(),
          goalId: g.id,
        };
        await syncedStorage.setItem('roadmap_state', JSON.stringify(st));
      }
    } else {
      await syncedStorage.removeItem(ACTIVE_GOAL_ID_KEY);
      await syncedStorage.removeItem('roadmap_state');
    }
  }
}

export async function getUnitsByMilestone(
  milestoneIndex: number,
  goalId?: string | null,
): Promise<LearningUnit[]> {
  const gid = goalId ?? (await getActiveGoalId());
  const units = await getLearningUnits(gid);
  return units.filter((u) => u.milestoneIndex === milestoneIndex);
}

export async function getUnitById(id: string): Promise<LearningUnit | null> {
  const units = await getLearningUnits();
  return units.find((u) => u.id === id) ?? null;
}

export async function setLearningUnitState(
  unitId: string,
  state: LearningState,
  extra?: { masteryScore?: number },
): Promise<LearningUnit | null> {
  const units = await getLearningUnits();
  const now = Date.now();
  let updated: LearningUnit | null = null;
  const next = units.map((u) => {
    if (u.id !== unitId) return u;
    updated = {
      ...u,
      state,
      masteryScore: extra?.masteryScore ?? u.masteryScore,
      lastReviewedAt: now,
      updatedAt: now,
    };
    return updated;
  });
  if (!updated) return null;
  await saveLearningUnits(next);
  return updated;
}

export async function cycleLearningUnitState(unitId: string): Promise<LearningUnit | null> {
  const unit = await getUnitById(unitId);
  if (!unit) return null;
  // User-driven cycle. Mastered is only reachable by explicit user action (not auto).
  const order: LearningState[] = [
    'not_started',
    'in_progress',
    'ready_for_review',
    'mastered',
    'needs_revision',
  ];
  const i = order.indexOf(unit.state);
  const next = order[(i < 0 ? 0 : i + 1) % order.length];
  return setLearningUnitState(unitId, next);
}

export interface MasterySummary {
  total: number;
  notStarted: number;
  inProgress: number;
  readyForReview: number;
  mastered: number;
  needsRevision: number;
  masteryPercent: number;
  /** Average derived action progress across units (0–100). */
  progressPercent: number;
}

export async function getMasterySummary(
  milestoneIndex?: number,
  goalId?: string | null,
): Promise<MasterySummary> {
  let units = await getLearningUnits(goalId ?? (await getActiveGoalId()));
  if (milestoneIndex != null) {
    units = units.filter((u) => u.milestoneIndex === milestoneIndex);
  }
  // Reconcile auto status from derived progress (never auto-master)
  units = await reconcileUnitStatusesFromProgress(units);

  const total = units.length;
  const notStarted = units.filter((u) => u.state === 'not_started').length;
  const inProgress = units.filter((u) => u.state === 'in_progress').length;
  const readyForReview = units.filter((u) => u.state === 'ready_for_review').length;
  const mastered = units.filter((u) => u.state === 'mastered').length;
  const needsRevision = units.filter((u) => u.state === 'needs_revision').length;
  const masteryPercent = total === 0 ? 0 : Math.round((mastered / total) * 100);

  const progresses = await Promise.all(units.map((u) => getUnitProgress(u.id)));
  const progressPercent =
    progresses.length === 0
      ? 0
      : Math.round(progresses.reduce((s, p) => s + p.percent, 0) / progresses.length);

  return {
    total,
    notStarted,
    inProgress,
    readyForReview,
    mastered,
    needsRevision,
    masteryPercent,
    progressPercent,
  };
}

export function sortUnitsForScheduling(units: LearningUnit[]): LearningUnit[] {
  const rank: Record<LearningState, number> = {
    needs_revision: 0,
    ready_for_review: 1,
    in_progress: 2,
    not_started: 3,
    mastered: 4,
  };
  return [...units].sort((a, b) => {
    const ra = rank[a.state] ?? 9;
    const rb = rank[b.state] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export function createLearningUnit(partial: {
  goalId: string;
  milestoneIndex: number;
  topicIndex: number;
  topicName: string;
  name: string;
  whatToDo?: string;
  resources?: string[];
  estimatedMinutes?: number;
  dependsOn?: string[];
  tags?: string[];
}): LearningUnit {
  const now = Date.now();
  return {
    id: uid('lu'),
    goalId: partial.goalId,
    milestoneIndex: partial.milestoneIndex,
    topicIndex: partial.topicIndex,
    topicName: partial.topicName,
    name: partial.name,
    whatToDo: partial.whatToDo,
    resources: partial.resources,
    estimatedMinutes: partial.estimatedMinutes,
    dependsOn: partial.dependsOn,
    state: 'not_started',
    tags: partial.tags ?? ['roadmap'],
    createdAt: now,
    updatedAt: now,
  };
}

export function createGoalShell(partial: {
  title: string;
  summary?: string;
  goalType?: string;
  durationMonths?: number;
  hoursPerDay?: number;
}): Roadmap {
  const now = Date.now();
  return {
    id: uid('goal'),
    title: partial.title,
    summary: partial.summary,
    goalType: partial.goalType,
    milestones: [],
    currentPhaseIndex: 0,
    durationMonths: partial.durationMonths,
    hoursPerDay: partial.hoursPerDay,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

export const STATE_LABELS: Record<LearningState, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  ready_for_review: 'Ready for review',
  mastered: 'Mastered',
  needs_revision: 'Needs revision',
};

export const STATE_COLORS: Record<LearningState, string> = {
  not_started: '#9B9A97',
  in_progress: '#337EA9',
  ready_for_review: '#7C3AED',
  mastered: '#0F7B6C',
  needs_revision: '#CB912F',
};

// ── Derived progress (never stored) ───────────────────────────

export interface UnitProgress {
  unitId: string;
  totalActions: number;
  completedActions: number;
  /** 0 when totalActions === 0 (guard — never NaN). */
  percent: number;
  /** Progress label independent of mastery status. */
  label: 'Not Started' | 'In Progress' | 'Complete';
}

/**
 * Progress = completedActions / totalActions for this Learning Unit.
 * totalActions === 0 → "Not Started", 0% (explicit guard).
 */
function isHabitAction(a: {
  type?: string;
  habitId?: string | null;
  tags?: string[];
}): boolean {
  if (a.type === 'habit') return true;
  if (a.habitId) return true;
  const tags = a.tags || [];
  return tags.includes('roadmap-habit') || tags.includes('habit');
}

/**
 * Progress counts only non-habit Actions linked to the unit.
 * Habits may support units (supportsUnitIds) but never contribute to progress or status.
 */
export async function getUnitProgress(unitId: string): Promise<UnitProgress> {
  try {
    const { getActions } = await import('./actionsService');
    const actions = await getActions();
    const linked = actions.filter(
      (a) => a.learningUnitId === unitId && !isHabitAction(a),
    );
    const totalActions = linked.length;
    const completedActions = linked.filter((a) => a.completed).length;
    if (totalActions === 0) {
      return {
        unitId,
        totalActions: 0,
        completedActions: 0,
        percent: 0,
        label: 'Not Started',
      };
    }
    const percent = Math.round((completedActions / totalActions) * 100);
    return {
      unitId,
      totalActions,
      completedActions,
      percent,
      label: percent >= 100 ? 'Complete' : 'In Progress',
    };
  } catch {
    return {
      unitId,
      totalActions: 0,
      completedActions: 0,
      percent: 0,
      label: 'Not Started',
    };
  }
}

export interface PhaseProgress {
  milestoneIndex: number;
  unitCount: number;
  /** Average of unit action progress (0–100). */
  progressPercent: number;
  masteredCount: number;
  readyForReviewCount: number;
}

/** Phase progress is aggregate of its Learning Units' derived progress — never stored. */
export async function getPhaseProgress(
  milestoneIndex: number,
  goalId?: string | null,
): Promise<PhaseProgress> {
  const units = await getLearningUnits(goalId ?? (await getActiveGoalId()));
  const phaseUnits = units.filter((u) => u.milestoneIndex === milestoneIndex);
  if (phaseUnits.length === 0) {
    return {
      milestoneIndex,
      unitCount: 0,
      progressPercent: 0,
      masteredCount: 0,
      readyForReviewCount: 0,
    };
  }
  const progresses = await Promise.all(phaseUnits.map((u) => getUnitProgress(u.id)));
  const progressPercent = Math.round(
    progresses.reduce((s, p) => s + p.percent, 0) / progresses.length,
  );
  return {
    milestoneIndex,
    unitCount: phaseUnits.length,
    progressPercent,
    masteredCount: phaseUnits.filter((u) => u.state === 'mastered').length,
    readyForReviewCount: phaseUnits.filter((u) => u.state === 'ready_for_review').length,
  };
}

/**
 * Auto-move status from derived action progress.
 * - not_started → in_progress when any linked action is completed
 * - in_progress / not_started → ready_for_review when 100% actions done
 * - in_progress / ready_for_review → not_started when progress returns to 0%
 *   (so un-checking all tasks actually resets the unit)
 * NEVER auto-sets Mastered (user only). Never overwrites needs_revision / mastered.
 */
export async function reconcileUnitStatusesFromProgress(
  units?: LearningUnit[],
): Promise<LearningUnit[]> {
  const list = units ?? (await getLearningUnits());
  if (!list.length) return list;

  let changed = false;
  const now = Date.now();
  const next: LearningUnit[] = [];

  for (const u of list) {
    // User-owned states: mastered / needs_revision — do not auto-overwrite
    if (u.state === 'mastered' || u.state === 'needs_revision') {
      next.push(u);
      continue;
    }

    const progress = await getUnitProgress(u.id);
    let state = u.state;

    if (progress.totalActions === 0 || progress.percent === 0) {
      // No linked work, or every action unchecked → honest zero
      // Demote auto-derived states; leave not_started alone
      if (state === 'in_progress' || state === 'ready_for_review') {
        state = 'not_started';
      }
    } else if (progress.percent >= 100) {
      // 100% actions complete → Ready for Review (never Mastered)
      if (state === 'not_started' || state === 'in_progress') {
        state = 'ready_for_review';
      }
    } else if (progress.completedActions > 0) {
      if (state === 'not_started' || state === 'ready_for_review') {
        state = 'in_progress';
      }
    }

    if (state !== u.state) {
      changed = true;
      next.push({ ...u, state, updatedAt: now });
    } else {
      next.push(u);
    }
  }

  if (changed) {
    await saveLearningUnits(next);
  }
  return next;
}

/**
 * Mark unit Mastered — explicit user action only (passive UI triggers this).
 */
export async function markUnitMastered(unitId: string): Promise<LearningUnit | null> {
  return setLearningUnitState(unitId, 'mastered');
}
