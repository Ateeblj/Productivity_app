# Android Dev Build (no Expo Go)

This compiles a real Android app with your project's native modules.
You do **not** use Expo Go, so the Worklets TurboModule crash goes away.

## Requirements (on your PC)

1. **Node.js 18+** (you already have this)
2. **Android Studio** with:
   - Android SDK
   - Android SDK Platform 35 (or latest)
   - Android SDK Build-Tools
   - Android Emulator **or** a phone with USB debugging
3. Environment variables (Windows example in PowerShell):

```powershell
# Adjust paths to your Android Studio install
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:PATH"
```

macOS/Linux:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk   # or ~/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Check:

```bash
adb version
java -version
```

## One-time setup in this project

```bash
cd path/to/this-project

# clean JS deps
rm -rf node_modules
npm install

# remove packages that break Expo Go (safe for dev builds too)
npm uninstall react-native-reanimated react-native-worklets 2>/dev/null || true

# regenerate native android/ project from app.json + plugins
npx expo prebuild --clean --platform android

# compile & install on emulator or USB phone
npx expo run:android
```

First build can take **5–15 minutes**.

## Phone via USB

1. Enable **Developer options** → **USB debugging**
2. Plug in phone, accept the RSA prompt
3. `adb devices` should list the device
4. `npx expo run:android`

## Emulator

1. Open Android Studio → Device Manager → start a Pixel emulator
2. `npx expo run:android`

## Later runs (after first successful build)

```bash
npx expo start --dev-client
# or
npx expo run:android
```

## If prebuild fails

```bash
npx expo install --fix
npx expo prebuild --clean --platform android
npx expo run:android
```

## If Gradle fails (Windows)

- Install **JDK 17** (not only JRE)
- In Android Studio: SDK Manager → install **NDK** and **CMake**
- Free disk space (builds need several GB)

## What this project already does

- Phone UI uses **MobileTabNavigator** (tabs), not Drawer
- `react-native-reanimated` / `worklets` are **not** in package.json
- Metro stubs those modules if something still imports them
- Boot timeouts so auth never hangs on loading forever
