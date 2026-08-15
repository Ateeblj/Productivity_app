# Productivity App — proper setup (NO rebuild / NO debug)

Use **Expo Go** only. You do **not** need Android Studio, `expo run:android`, or a development build for daily use.

---

## Requirements

- Node.js **18+** (20 LTS recommended)
- Phone: **Expo Go** from Play Store / App Store (SDK **54** compatible)
- PC and phone on the **same Wi‑Fi** (or use tunnel if Wi‑Fi blocks devices)

---

## 1. Install (once)

```bash
cd <this-folder>
npm install
```

If Expo complains about versions:

```bash
npx expo install --fix
```

---

## 2. Environment (optional cloud sync)

Already included if you kept `.env`. To set your own Supabase:

```bash
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

App works **offline** without Supabase; cloud login/sync needs these keys.

---

## 3. Run every day (no rebuild)

```bash
cd <this-folder>
npm start
```

That runs: `expo start --clear`

Then:

| Platform | How |
|----------|-----|
| **Android phone** | Open **Expo Go** → scan the QR code |
| **iPhone** | Camera / Expo Go → scan QR |
| **Web** | Press `w` in the terminal, or `npm run web` |
| **Wi‑Fi blocked** | `npm run start:tunnel` then scan QR |

---

## 4. After pulling a new zip / code update

```bash
cd <this-folder>
npm install
npm start
```

In Expo Go: shake device → **Reload**, or close and reopen the project.

**Do not** run `expo run:android` or `npx expo start --dev-client` unless you intentionally want a native rebuild.

---

## 5. What NOT to do

| Command | Why skip |
|---------|----------|
| `npx expo run:android` | Full native rebuild (slow, needs Android SDK) |
| `npx expo start --dev-client` | Needs a custom “dev client” APK already installed |
| Opening a custom **Productivity App** icon without Metro | That icon is a **dev build**; it freezes without Metro. Use **Expo Go** instead |

---

## 6. Troubleshooting

**QR won’t connect**

```bash
npm run start:tunnel
```

**Old UI still shows**

```bash
npm start
```

Then in Expo Go: reload the project.

**Stuck on logo (custom APK only)**  
Uninstall the custom Productivity App APK. Install **Expo Go** and open the project from the QR code.

**npm EOVERRIDE / peer dependency noise**  
Use `npm install --legacy-peer-deps` once, then `npm start`.

---

## Scripts reference

| Script | Purpose |
|--------|---------|
| `npm start` | Metro + QR (Expo Go) |
| `npm run start:tunnel` | Same, works across networks |
| `npm run web` | Browser |
| `npm run start:dev-client` | Only if you have a custom native build |

---

## Bottom tabs (mobile)

Home · Notes · Today · Week  

Center **+** menu: Search · Year review · Month calendar · Roadmaps · Generate roadmap · Settings  
