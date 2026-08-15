# Architecture (v2.7 — learnability pass)

Guest mode: full local use without account. Account is only required for cloud sync.

## Structural integrity (v2.9)

- Planner / curriculum keys write only through `syncedStorage.setItem` (local + cloud queue).
- Learning units never auto-attach to the active goal when `goalId` is missing.
- Phase complete clears that goal's week cards and repacks the next phase; in-progress units in the finished phase soft-cascade to mastered.
- Prefer structured fields (`goalId`, `learningUnitId`, `kind`) via `plannerFields.ts`; tags remain compatibility.
- **Monthly is life calendar only.** Roadmap import does not write phase events to `monthlyEvents`; legacy roadmap-tagged monthly rows are stripped on re-import.
- Dashboard empty state offers Notes / Today / optional Roadmap (not roadmap-only).
- Nav labels use user language (Home, Today, This week, Life calendar, Year review, Generate roadmap).




> **Rule:** If a feature does not have exactly one obvious home, the architecture is wrong.

## Screen responsibilities (one job each)

| Screen | Job | Answers |
|--------|-----|---------|
| **Dashboard** | Resume work | What do I do next? |
| **Roadmaps** | Complete learning structure | What am I building? |
| **Daily** | Execute today | What is on my plate today? |
| **Weekly** | This week's learning workload | What is this week's plan? |
| **Monthly** | Life calendar only | What is happening in my life? |
| **Yearly** | Reflection & planning | How did the year go? |
| **Notes** | Knowledge capture | Where are my notes? |
| **Settings** | Configuration | Account, theme, sync, reminders |

## Ownership rules

1. **Roadmaps own knowledge.** Curriculum hierarchy, learning state, resources, dependencies, and mastery live only here.
2. **Actions own execution.** Tasks, habits, revision items. An action may link to a Learning Unit; completing a habit does **not** auto-master a unit.
3. **Planner owns time.**
   - Daily / Weekly = execution views of work items (especially roadmap-linked).
   - Monthly = **life events only** (birthdays, appointments, bills, trips, deadlines). No SQL / fitness / roadmap phases.
   - Yearly = reflection dashboard (stats, heatmaps, timelines, year-in-review) — not a task list.
4. **Analytics is read-only.** Calculated from Roadmaps + Actions + planner history.
5. **Notes never own curriculum.** They may reference a Learning Unit; they are not the source of truth for topics.
6. **AI creates/updates Roadmaps and linked Actions** — it does not silently rewrite unrelated planner data.

## Layers

```
Dashboard     → "Continue" + today's slice + next life event + quick add
Roadmaps      → Goal → Milestone → Topic → Learning Unit (+ state, resources, deps)
                + Roadmap AI (generate / paste / import / generate this week / complete phase)
Actions       → Tasks | Habits | Revision
Planner       → Daily | Weekly | Monthly (life) | Yearly (reflection)
Notes         → standalone + optional learningUnitId link
Settings      → theme, sync, account, reminders
```

## Naming

| User-facing | Internal / storage |
|-------------|-------------------|
| **Roadmaps** | CurriculumGoal, learning_units, roadmap_state |
| Learning Unit | LearningUnit (was "subtopic") |
| Phase | Milestone (`currentPhaseIndex`) |
| Dashboard | HomeScreen / Overview route |

- Habits **support** Learning Units; mastery moves only when a unit’s `state` changes.
- Multi-roadmap is first-class; one **active** roadmap drives “Generate this week” and the Dashboard Continue card.

## Learning Unit states

`not_started` → `in_progress` → `mastered`  
`needs_revision` can be set after mastery.

## Storage keys (synced)

| Key | Owner |
|-----|--------|
| `curriculum_goals` / `active_goal_id` / `learning_units` / `roadmap_state` | Roadmaps |
| `habit_definitions` / `app_actions` | Actions |
| `dailyTasks` / `weeklyRoutineTasks` | Daily / Weekly execution |
| `monthlyEvents` | Monthly **life** calendar |
| `yearlyGoals` | Optional phase markers / reflections (Yearly prefers computed stats) |
| `myNotes` / `myFolders` | Notes |
| `app_theme` | Settings |

## Explicit non-goals (v2)

Knowledge-graph edges beyond `dependsOn`, spaced-repetition engine, AI coach, difficulty estimator, predictive completion, Weekly category filters for 10+ concurrent roadmaps (Version 2+).

## Change log vs previous

- Renamed user-facing **Goals → Roadmaps**.
- Dashboard is **resume**, not a dense widget board.
- Monthly is **life calendar only** (no roadmap scheduling).
- Yearly is **reflection & planning** (heatmap, mastery, streaks, year-in-review), not a month-grid of tasks.
- Navigation reduced to one clear home per concern; Analytics folded into Yearly reflection where possible.
