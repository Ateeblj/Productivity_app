> **Also see [INSTALL.md](./INSTALL.md)** for desktop installer + shared Supabase account setup.

# Standalone app (no laptop needed)

You want a real installable app: open the icon anytime.  
Laptop is **not** required. Internet is only for optional Supabase login/sync.

Expo Go and `npm start` always need the PC. For offline-from-PC use, you need **one APK build**.

---

## Build an installable Android APK (once per update)

### 1. On your PC

```bash
cd <this-folder>
npm install
npm install -g eas-cli
eas login
```

Use the Expo account that owns project `ateeb1` / `productivity-app`.

### 2. Start the cloud build (APK)

```bash
eas build -p android --profile preview
```

- Runs on Expo’s servers (no Android Studio required)
- Produces an **.apk** you can install on any Android phone
- Takes ~10–20 minutes the first time

### 3. Install on the phone

When the build finishes:

1. Open the build page link from the terminal (or [expo.dev](https://expo.dev) → your project → Builds)
2. Download the **APK**
3. On the phone: allow install from browser / unknown sources
4. Install and open **Productivity App**

Done. Open it anytime — **no QR, no Metro, no laptop**.

---

## What still uses the network

| Feature | Needs internet? |
|---------|-----------------|
| Notes, tasks, local data | No (saved on device) |
| Login / cloud sync (Supabase) | Yes, when you sync |
| AI generate roadmap | Yes |

`.env` values (`EXPO_PUBLIC_SUPABASE_*`) are baked into the APK at build time.  
If you change Supabase keys, run a new `eas build`.

---

## After you change the code

1. Update files on the PC  
2. Run again:

```bash
eas build -p android --profile preview
```

3. Install the new APK (or update over the old one)

There is no way around this for a true standalone app: JS is packaged inside the APK.

---

## Play Store (optional later)

```bash
eas build -p android --profile production
eas submit -p android
```

Production profile builds an **AAB** for Google Play.

---

## iPhone

iOS needs a Mac + Apple Developer account:

```bash
eas build -p ios --profile preview
```

---

## Do not use for standalone

| Command | Result |
|---------|--------|
| `npm start` + Expo Go | Needs laptop every time |
| `expo start --dev-client` | Needs laptop every time |
| Old “dev client” APK | Needs Metro on PC |

Only the **preview/production** APK is standalone.
