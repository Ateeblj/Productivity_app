# Bugfix report (this tree)

## Blocking: stuck on logo

| Issue | Severity | Fix |
|-------|----------|-----|
| `ProfileScreen` imports `expo-document-picker` but it was **not** in `package.json` | **Critical** — Metro cannot resolve module → JS never loads → native splash forever | Added `expo-document-picker` |
| `react-native-document-picker` still listed (incompatible with RN 0.81) | High | Removed; use Expo picker only |
| `MainActivity` had `setTheme(R.style.AppTheme)` commented out | Medium — splash theme handoff broken | Restored |
| Splash bg `#6C4E9A` vs app `#0d0d1a` | Low visual | Aligned colors + status bar |
| Phone cannot reach Metro (no `adb reverse`) | **Ops** — most common on USB | Documented in `BOOT_STUCK_LOGO.md` |

## Mobile UI

| Issue | Fix |
|-------|-----|
| `NotesScreen` used `SafeAreaView` **and** `MobileTabNavigator` applied `paddingTop: insets.top` | Double top inset → content pushed down | Notes root → `View` |
| `SearchScreen` / `NotificationManagerScreen` same double safe-area under stack headers | Replaced with `View` |
| Mobile tabs use real `DailyTaskScreen` / `WeeklyPlannerScreen` / `NotesScreen` | Already correct in this tree |
| FAB navigates nested: `navigate(tab, { screen })` | Already wired |

## Architecture already correct in this zip

- Mobile: `MobileTabNavigator` only (no drawer / no reanimated on device)
- Web/desktop: lazy `AppDrawer`, permanent sidebar when width ≥ 900
- Metro stubs `react-native-reanimated` / `react-native-worklets`
- Auth + boot timeouts so loading cannot hang forever
- No `SplashScreen.preventAutoHideAsync()` (that freezes the logo)

## What you must run on Windows after replacing sources

```powershell
cd D:\PApp
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install
npm uninstall react-native-document-picker react-native-reanimated react-native-worklets 2>$null

$env:ANDROID_HOME = "D:\Android"
$env:GRADLE_USER_HOME = "D:\Android\gradle-home"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

adb reverse tcp:8081 tcp:8081
npx expo run:android
# later:
npx expo start --dev-client --localhost --clear
```

If still on logo: `adb logcat` as in `BOOT_STUCK_LOGO.md`. First look for `Unable to resolve module`.

## Not fully redesigned in this pass

Large screens (Notes ~1.4k LOC, Home, Weekly, Daily) already use glass/dark palette and mobile padding bottoms. A full Figma pixel-match pass was **not** re-applied screen-by-screen here; priority was **boot + resolve crash + safe-area**.

If a specific screen still looks wrong on phone vs web, name the screen and we tune spacing next.
