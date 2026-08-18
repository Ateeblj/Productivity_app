# Productivity App
<img width="960" height="480" alt="Productivityapp-ezgif com-video-to-gif-converter (1)" src="https://github.com/user-attachments/assets/dde29e7f-d707-4674-b756-180871431dfb" />

**Offline-first productivity + learning roadmap app** for notes, tasks, daily/weekly/monthly/yearly planning, and AI-assisted learning roadmaps.

Works on **phone, desktop, and web**. Optional cloud sync so the same account works everywhere.

Built with **Expo / React Native**, **NativeWind**, and **Supabase** (bring your own project).

---

## Why this app?

| Problem | How this app helps |
|--------|---------------------|
| Data locked to one device or one company | Fully offline. Sync is **your** Supabase project (BYO). |
| Notes, tasks, and study plans live in different apps | One place for notes, tasks, habits, planners, and structured **Roadmaps**. |
| Learning goals become vague to-do lists | Roadmaps break goals into **phases → topics → learning units** with clear states and progress. |
| AI rewrites your life or does nothing useful | AI only generates/expands **roadmaps and linked actions** — it does not touch unrelated planner data. |
| Phone and PC feel like different products | Same codebase, same account, same data on Android / iOS / Windows / macOS / Linux / web. |

---

## Features

### Capture & organize
- Notes with folders (optional link to a learning unit)
- Tasks with priority, due dates, reminders, tags
- Voice & video recording
- Fast search

### Plan your time
- **Daily** task board
- **Weekly** planner
- **Monthly** life calendar
- **Yearly** reflection & planning (progress, streaks, year overview)

### Learn with structure (Roadmaps)
- Multi-roadmap support
- Hierarchy: **Goal → Phase → Topic → Learning Unit**
- States: `not_started` → `in_progress` → `mastered` (+ `needs_revision`)
- Prerequisites between units
- AI: generate roadmap, expand phases/topics, paste/import, generate this week’s work

### Stay on track
- Habits & revision actions
- Progress tracking & analytics
- Local notifications
- Dark / light theme

### Sync (optional)
- Same email/password on phone and desktop
- Guest mode works fully offline
- Bring Your Own Supabase (paste keys in Settings or use `.env`)

---

## Platforms

| Platform | How to run |
|----------|------------|
| **Android** | Expo Go or standalone APK (EAS) |
| **iOS** | Expo Go or EAS build |
| **Windows / macOS / Linux** | Electron desktop builds |
| **Web** | `expo start --web` |

---

## Quick start

```bash
npm install

# Optional: cloud sync
cp .env.example .env
# Add your Supabase URL + anon key, then run supabase/schema.sql

npx expo start --clear
```

Useful commands:

```bash
npm run web
npm run android
npm run electron:dev
npm run build:desktop
npm run build:mobile:android
```

More details: `INSTALL.md`, `SETUP.md`, `CLOUD_SYNC_SETUP.md`, `BYO_SUPABASE.md`.

---

## Architecture (short)

```
Dashboard  → Continue + today’s work + quick add
Roadmaps   → Goal → Phase → Topic → Learning Unit + AI helpers
Actions    → Tasks | Habits | Revision
Planner    → Daily | Weekly | Monthly | Yearly
Notes      → Standalone + optional learning unit link
Settings   → Theme, sync, account, reminders
```

**Core rules:**
- Offline-first. Cloud is optional and user-owned.
- Roadmaps own the curriculum. Notes/tasks only reference learning units.
- AI only touches roadmaps and linked actions.
- Identity is based on `user_id`, not email or device.

Full details: `ARCHITECTURE.md`, `IDENTITY.md`.

---

## Tech stack

- Expo SDK 54 + React Native + React 19
- React Navigation
- NativeWind (Tailwind)
- AsyncStorage + sync layer
- Supabase (auth + optional sync)
- Electron (desktop)
- EAS (mobile builds)

---

## Privacy

- Data stays on your device by default.
- Sync goes to **your** Supabase project only.
- No vendor lock-in for the database.
- Guest mode never pretends to be a cloud user.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
