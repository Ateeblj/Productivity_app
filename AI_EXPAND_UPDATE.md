# Productivity App — updated build (2026-08-07)

## AI changes in this zip
- Phase-level expand (1 API call per phase, default) instead of per-topic
- expandPhase() + expandAllTopics({ mode: "phase" | "topic" })
- Truncation detection (finish_reason / MAX_TOKENS)
- Structure repair + second regenerate if plan is thin
- Expand quality validation (min subtopics, whatToDo length, hours)
- RoadmapScreen copy updated for phase expand

## Not yet wired
- Lazy expand of *current phase only* inside Generate this week (recommended next step)

## Key files
- services/aiRoadmapService.ts
- screens/RoadmapScreen.tsx
