# Get the app back on your phone

Your local build fails because **NDK is broken**:

`D:\Android\ndk\26.1.10909125` has no `source.properties`.

You already deleted the app, so you need a new APK.

---

## Path A — EAS cloud build (recommended, skips broken NDK)

Run in PowerShell at `D:\PApp`:

```powershell
cd D:\PApp

# If you copied the patched project, ensure these files exist:
# package.json has expo-dev-client, eas.json exists, app.json has "expo-dev-client" plugin

npx expo install expo-dev-client expo-document-picker
npm uninstall react-native-document-picker react-native-reanimated react-native-worklets 2>$null

# Login once (browser opens)
npx eas-cli login

# Link project once if asked
npx eas init

# Build APK in the cloud (10–20 min)
npx eas build --profile development --platform android --non-interactive
```

When it finishes, EAS prints a URL. On the phone:

1. Open that URL in Chrome  
2. Download the APK  
3. Install it (allow install from browser if asked)

Then every day:

```powershell
cd D:\PApp
$env:ANDROID_HOME = "D:\Android"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --localhost
```

Open the **app icon** on the phone. Metro should show `Android Bundled`.

---

## Path B — Fix NDK then local rebuild

### 1) Remove broken NDK

```powershell
Remove-Item -Recurse -Force "D:\Android\ndk\26.1.10909125" -ErrorAction SilentlyContinue
```

### 2) Install NDK via Android Studio

1. Open **Android Studio**
2. **More Actions** → **SDK Manager** (or Settings → Android SDK)
3. **SDK Tools** tab
4. Enable:
   - **NDK (Side by side)**
   - **CMake**
   - **Android SDK Command-line Tools**
5. Apply → wait until finished

### 3) Confirm NDK is valid

```powershell
dir D:\Android\ndk
Get-Content D:\Android\ndk\*\source.properties
```

You must see `Pkg.Revision=...`. Note the folder name (e.g. `27.1.12297006`).

### 4) Point Gradle at that version

```powershell
notepad D:\PApp\android\gradle.properties
```

Add a line (use **your** folder name):

```properties
android.ndkVersion=27.1.12297006
```

### 5) Rebuild and install

```powershell
cd D:\PApp
$env:ANDROID_HOME = "D:\Android"
$env:GRADLE_USER_HOME = "D:\Android\gradle-home"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

npx expo install expo-dev-client
npx expo run:android
```

---

## After install works

Daily (no rebuild):

```powershell
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --localhost
```

Open the app icon. JS changes load from Metro.

Only run `expo run:android` or EAS again when **native** deps change.
