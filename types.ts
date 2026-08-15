// types.ts
// ============================================================
// Types — Goals own knowledge, Actions own execution, Planner owns time
// See ARCHITECTURE.md
// ============================================================

export interface PouchDoc {
  _id?: string;
  _rev?: string;
}

export interface User extends PouchDoc {
  uid: string;
  email: string;
  displayName?: string;
  avatar?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type NoteType = 'text' | 'voice' | 'video';

export interface Note extends PouchDoc {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  mediaUri?: string;
  duration?: number;
  color?: string;
  isPinned?: boolean;
  folderId?: string | null;
  tags?: string[];
  /** Optional link to a Learning Unit (notes reference, never own curriculum). */
  learningUnitId?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface Folder extends PouchDoc {
  id: string;
  name: string;
  color: string;
  parentId?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface Task extends PouchDoc {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate: string;
  reminderTime?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  learningUnitId?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface WeeklyPlan extends PouchDoc {
  id: string;
  weekStart: string;
  days: { [key: string]: Task[] };
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface MonthlyEvent extends PouchDoc {
  id: string;
  date: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  color?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface YearlyGoal extends PouchDoc {
  id: string;
  month: string;
  goal: string;
  progress?: number;
  completed?: boolean;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface Notification extends PouchDoc {
  id: string;
  taskId?: string;
  title: string;
  message: string;
  scheduledTime: number;
  delivered: boolean;
  createdAt?: number;
}

// ── Goals layer (knowledge) ───────────────────────────────────

export type LearningState =
  | 'not_started'
  | 'in_progress'
  | 'ready_for_review'
  | 'mastered'
  | 'needs_revision';

/** Atomic curriculum unit (was "subtopic"). Scales across domains. */
export interface LearningUnit {
  id: string;
  /** Parent curriculum goal (multi-goal support). */
  goalId: string;
  /** Milestone / phase index in the plan */
  milestoneIndex: number;
  /** Topic index within that milestone */
  topicIndex: number;
  topicName: string;
  name: string;
  whatToDo?: string;
  resources?: string[];
  estimatedMinutes?: number;
  /** Prerequisite Learning Unit ids */
  dependsOn?: string[];
  state: LearningState;
  lastReviewedAt?: number;
  masteryScore?: number;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RoadmapMilestone {
  index: number;
  name: string;
  description?: string;
  hours?: number;
  topics: string[];
}

export interface Roadmap {
  id: string;
  title: string;
  summary?: string;
  goalType?: string;
  milestones: RoadmapMilestone[];
  /** Full AI plan including topicDetails when expanded */
  planJson?: any;
  currentPhaseIndex: number;
  durationMonths?: number;
  hoursPerDay?: number;
  status: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
}

// ── Actions layer (execution) ─────────────────────────────────

export type ActionType = 'task' | 'habit' | 'revision' | 'quiz';

export interface HabitDefinition {
  id: string;
  title: string;
  description?: string;
  source: 'roadmap' | 'user';
  /** Optional link to a roadmap; habits never own Learning Unit progress. */
  roadmapId?: string | null;
  /** Learning Units this habit supports (does not complete them). */
  supportsUnitIds?: string[];
  /** ISO date strings (YYYY-MM-DD) when the habit was completed — habit-only record. */
  completedDates?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AppAction {
  id: string;
  type: ActionType;
  title: string;
  description?: string;
  learningUnitId?: string | null;
  habitId?: string | null;
  dueDate?: string;
  scheduledTime?: string;
  completed: boolean;
  completedAt?: number;
  priority?: 'low' | 'medium' | 'high';
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  tags?: string[];
  /** Weekday name when projected into weekly board */
  weekday?: string;
  createdAt: number;
  updatedAt: number;
}
