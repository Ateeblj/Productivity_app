# Install Productivity App — Mobile + Desktop (same Supabase account)

One codebase, two installable apps. **Same email/password** on phone and PC.
Data (notes, tasks, planner, roadmaps, theme) syncs through **your** Supabase project.

| Platform | What you get | Needs after install |
|----------|--------------|---------------------|
| **Android phone** | `.apk` you install once | Internet only for login/sync |
| **Windows / Mac / Linux PC** | Real installer (`.exe` / `.dmg` / `.AppImage`) | Internet only for login/sync |
| Expo Go / `npm start` | Dev only | Laptop always running |

---

## Part 0 — Shared cloud (do this once)

Both apps talk to the **same** Supabase project.

1. Go to [supabase.com](https://supabase.com) → create a free project.
2. **SQL Editor** → New query → paste all of `supabase/schema.sql` → **Run**.
3. **Authentication → Providers → Email** → turn **Confirm email** OFF (optional, easier for personal use).
4. **Project Settings → API** → copy:
   - Project URL  
   - `anon` `public` key  

### Option A — Bake keys into builds (simplest)

In the project root:

```bash
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These values are compiled into mobile APK and desktop app at build time.

### Option B — Enter keys inside the app (BYO)

Skip `.env`. After install, open **Settings → Your Database**, paste URL + anon key, run `schema.sql` once, then sign up/login.

Either way: **sign up once**, then use the **same email/password** on phone and PC.

---

## Part 1 — Mobile (standalone Android APK)

### Requirements
- Node.js 18+
- Expo account (free): [expo.dev](https://expo.dev)
- Phone can install from “unknown sources”

### Build (on your PC, once per release)

```bash
cd path/to/this-folder
npm install
npm install -g eas-cli
eas login
```

Use the Expo account that owns this project (`owner: ateeb1`, `projectId` already in `app.json`).

```bash
# Preview APK — installable on any Android phone
eas build -p android --profile preview
# same as: npm run build:mobile:android
```

Wait ~10–20 minutes. Open the link Expo prints (or expo.dev → project → Builds) → **Download APK**.

### Install on phone
1. Transfer the APK (download on phone, Drive, USB, etc.).
2. Allow install from that source.
3. Open **Productivity App**.
4. Connect database (if BYO) → **Sign up / Log in** with the same account as desktop.

### iPhone (optional)
Needs Apple Developer account + Mac:

```bash
eas build -p ios --profile preview
```

### After code changes
Run `eas build -p android --profile preview` again and install the new APK.

---

## Part 2 — Desktop (Windows / Mac / Linux installer)

### Requirements
- Node.js 18+
- Same repo folder with `.env` filled (or BYO after first launch)

### One-command build

```bash
cd path/to/this-folder
npm install

# Current OS installer → folder dist-electron/
npm run build:desktop
```

Or target a specific OS:

```bash
npm run build:desktop:win     # Windows → NSIS setup .exe
npm run build:desktop:mac     # macOS  → .dmg   (build on a Mac)
npm run build:desktop:linux   # Linux  → .AppImage
```

What happens:
1. `expo export --platform web` → static files in `dist/`
2. `electron-builder` packages Electron + `dist/` → installer in **`dist-electron/`**

### Install on PC
- **Windows:** run the `.exe` installer (choose folder, desktop shortcut).
- **Mac:** open `.dmg`, drag app to Applications.
- **Linux:** `chmod +x *.AppImage` then run it.

Launch **Productivity App** → same login as phone → data syncs.

### Quick test without installer

```bash
npm run electron:dev
```

Exports web then opens Electron window (needs `dist/` present).

---

## Part 3 — Same account on both devices

1. Build mobile APK and desktop installer **with the same Supabase project** (same `.env` or same BYO keys).
2. On **one** device: Sign up with email + password.
3. On the **other** device: Log in with that email + password.
4. Open **Sync** (or wait for auto-merge on login) — notes, tasks, planner, goals merge by id.

Rules already in the app:
- Identity = Supabase `user_id` (not the device).
- RLS: each account only sees its own rows.
- Media (voice/video files) stays **local** on the device that recorded it; metadata can still sync.

---

## Commands cheat sheet

| Goal | Command |
|------|---------|
| Dev in browser / Expo | `npm start` or `npm run web` |
| Export web only | `npm run export:web` |
| Desktop installer (this OS) | `npm run build:desktop` |
| Windows `.exe` | `npm run build:desktop:win` |
| Android APK (cloud) | `npm run build:mobile:android` |
| Run Electron after export | `npm run electron` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Desktop says “Build missing” | Run `npm run export:web` then `npm run build:desktop` |
| Login works on PC but not phone | Same Supabase URL/key on both; same email; confirm email OFF or confirm the mail |
| APK install blocked | Settings → allow install from browser/files |
| `eas build` asks for credentials | `eas login`; first Android build may ask to generate a keystore (accept defaults) |
| Sync empty after login | Open Sync screen → Sync now; check SQL `schema.sql` was run |
| Windows icon ugly | Optional: convert `assets/icon.png` to `.ico` and set `"icon": "assets/icon.ico"` under `build.win` |

---

## What is *not* required day-to-day

- Laptop running Metro / Expo Go  
- Same Wi‑Fi between phone and PC  
- Custom backend server  

Only optional network: Supabase for auth + sync.

---

See also: `BYO_SUPABASE.md`, `CLOUD_SYNC_SETUP.md`, `STANDALONE.md`, `IDENTITY.md`.
