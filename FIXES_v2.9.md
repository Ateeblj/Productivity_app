# Fixes applied (v2.9) — based on UX audit

## Critical / architecture

1. **Monthly is life-calendar only**
   - `importPlanToMonthly` no longer writes roadmap phase events.
   - On re-import it strips legacy `roadmap` / `roadmap-phase` monthly rows.
   - Dashboard “next event” ignores those legacy rows.

2. **Import messaging**
   - Clearer success copy: units in Roadmaps, monthly stays personal, how to pack the week.

## First-run / empty states

3. **Home (Dashboard) without a roadmap**
   - Offers three paths: Notes, Today (tasks), optional Generate roadmap.
   - No longer forces “build a roadmap first”.

4. **Roadmaps empty state**
   - Explains roadmaps are optional; Notes/Today still work.

5. **Auth screen**
   - Clearer subtitle: offline guest works fully; account is for sync.

## Navigation language

6. **Drawer labels** (user language, better order)
   - Home · Notes · Today · This week · Roadmaps · Life calendar · Year review
   - Tools: Generate roadmap · Search · Cloud sync · Reminders · Settings
   - Header titles match.

## Clarity

7. **Cloud sync screen**
   - Explicit that voice/video recordings never leave the device.
   - Softer copy about what syncs.

8. **Generate roadmap (AI)**
   - API key help: free Groq option + Paste mode alternative.

9. **ARCHITECTURE.md** updated to v2.9 rules.

## Not rewritten in this pass (still true)

- Full bottom-tab redesign on mobile (larger product change).
- Hosted free AI without any user API key (requires backend/cost).
- Splitting 1000+ line Daily/Notes screens.
- Removing dead `tasksService` / legacy `src/services/syncService` files (left with existing warnings).

