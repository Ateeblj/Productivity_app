// hooks/useRoadmapProgress.ts
// Boy Scout extract: derived unit/phase progress (item 8).
import { useCallback, useState } from 'react';
import {
  getLearningUnits,
  getMasterySummary,
  getUnitProgress,
  getPhaseProgress,
  reconcileUnitStatusesFromProgress,
  type UnitProgress,
  type PhaseProgress,
  type MasterySummary,
} from '../services/goalsService';
import type { LearningUnit } from '../types';

export function useRoadmapProgress() {
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [summary, setSummary] = useState<MasterySummary | null>(null);
  const [unitProgress, setUnitProgress] = useState<Record<string, UnitProgress>>({});
  const [phaseProgress, setPhaseProgress] = useState<Record<number, PhaseProgress>>({});

  const loadForGoal = useCallback(async (goalId: string | null) => {
    if (!goalId) {
      setUnits([]);
      setSummary(null);
      setUnitProgress({});
      setPhaseProgress({});
      return;
    }

    const rawUnits = await getLearningUnits(goalId);
    const u = await reconcileUnitStatusesFromProgress(rawUnits);
    const s = await getMasterySummary(undefined, goalId);
    setUnits(u);
    setSummary(s);

    const progressEntries = await Promise.all(
      u.map(async (unit) => [unit.id, await getUnitProgress(unit.id)] as const),
    );
    const up: Record<string, UnitProgress> = {};
    for (const [id, pr] of progressEntries) up[id] = pr;
    setUnitProgress(up);

    const milestoneIndexes = Array.from(new Set(u.map((x) => x.milestoneIndex)));
    const phaseEntries = await Promise.all(
      milestoneIndexes.map(async (mi) => [mi, await getPhaseProgress(mi, goalId)] as const),
    );
    const pp: Record<number, PhaseProgress> = {};
    for (const [mi, pr] of phaseEntries) pp[mi] = pr;
    setPhaseProgress(pp);
  }, []);

  return {
    units,
    summary,
    unitProgress,
    phaseProgress,
    loadForGoal,
    setUnits,
    setSummary,
  };
}
