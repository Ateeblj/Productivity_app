/**
 * Structured fields for planner items (preferred over tag soup).
 * Tags remain for backward compatibility; new code should set these fields.
 */
export type PlannerItemKind = 'habit' | 'session' | 'review' | 'personal' | 'event';

export interface PlannerIdentity {
  kind?: PlannerItemKind;
  goalId?: string | null;
  learningUnitId?: string | null;
  tags?: string[];
}

export function goalIdFromTags(tags?: string[]): string | null {
  const t = (tags || []).find((x) => x.startsWith('goal:'));
  return t ? t.slice(5) : null;
}

export function kindFromTags(tags?: string[], title?: string): PlannerItemKind {
  const t = tags || [];
  if (t.includes('roadmap-review') || (title || '').toLowerCase() === 'weekly roadmap review') {
    return 'review';
  }
  if (t.includes('roadmap-habit')) return 'habit';
  if (t.includes('roadmap-week') || t.includes('roadmap')) return 'session';
  return 'personal';
}

/** Build canonical tags from structured fields (compat layer). */
export function tagsFromIdentity(id: PlannerIdentity): string[] {
  const tags = new Set<string>(id.tags || []);
  if (id.goalId) tags.add(`goal:${id.goalId}`);
  switch (id.kind) {
    case 'habit':
      tags.add('roadmap');
      tags.add('roadmap-habit');
      break;
    case 'session':
      tags.add('roadmap');
      tags.add('roadmap-week');
      break;
    case 'review':
      tags.add('roadmap');
      tags.add('roadmap-week');
      tags.add('roadmap-review');
      break;
    default:
      break;
  }
  return Array.from(tags);
}

export function belongsToGoal(
  item: PlannerIdentity,
  activeGoalId: string | null,
): boolean {
  const gid = item.goalId || goalIdFromTags(item.tags);
  if (!gid) return true; // personal
  if (!activeGoalId) return true;
  return gid === activeGoalId;
}
