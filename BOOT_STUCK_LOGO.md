# Stuck on logo (Android dev client)

## What the logo is
Native splash (`Theme.App.SplashScreen` + `SplashScreenManager`).  
If **JS never mounts**, the splash never gets `SplashScreen.hideAsync()` and you stay on the logo forever.

## Most common cause (90%)
Metro is running on the PC, but the **phone cannot reach it**.

### Fix (USB phone)

```powershell
cd D:\PApp
$env:ANDROID_HOME = "D:\Android"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

adb devices
adb reverse tcp:8081 tcp:8081

npx expo start --dev-client --localhost --clear
```

Then **force-stop** the app on the phone and open it again.

You should see a **bundle request** in the Metro terminal when the app opens.  
If Metro stays silent → still not connected (Wi‑Fi isolation, wrong port, or old APK).

### Confirm with logcat

```powershell
adb logcat -c
# open the app, wait 5s
adb logcat -d -t 200 ReactNativeJS:V ReactNative:V AndroidRuntime:E Expo:V *:S
```

- **No ReactNativeJS lines** → JS never loaded (Metro / reverse / wrong package).
- **Red error in ReactNativeJS** → fix that import/crash (see below).

## Code fixes already applied in this tree

1. **`expo-document-picker`** added to `package.json` (was imported by `ProfileScreen` but missing → **bundle resolve failure**).
2. Removed incompatible **`react-native-document-picker`**.
3. **`MainActivity`**: `setTheme(R.style.AppTheme)` restored so splash can hand off.
4. Splash background color aligned to `#0d0d1a`.
5. Notes screen no longer double-applies top safe area under the mobile tab shell.

## After pulling these changes (Windows)

```powershell
cd D:\PApp
# copy this project over your D:\PApp sources, then:

Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install

# uninstall any leftover bad native modules (safe)
npm uninstall react-native-document-picker react-native-reanimated react-native-worklets 2>$null

# native theme / MainActivity changed → rebuild once
$env:ANDROID_HOME = "D:\Android"
$env:GRADLE_USER_HOME = "D:\Android\gradle-home"
npx expo run:android
```

Daily after that (no rebuild unless native deps change):

```powershell
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --localhost
```

## If Metro connects but still freezes
Check logcat for the first JS error. Typical ones:

- Missing module (`Unable to resolve module …`)
- Reanimated / worklets TurboModule (should be stubbed; ensure you did **not** reinstall them)
- Auth/storage hang (already has 0.8s safety timeout in AuthContext)

## Web
```powershell
npx expo start --web
```
Permanent sidebar on width ≥ 900px is preserved in `AppDrawer`.
