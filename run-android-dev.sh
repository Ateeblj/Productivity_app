#!/usr/bin/env bash
# Run on YOUR machine (needs Android SDK). Not for the cloud sandbox.
set -euo pipefail

echo "==> 1/4 Clean install"
rm -rf node_modules
rm -f package-lock.json
npm install
npm uninstall react-native-reanimated react-native-worklets 2>/dev/null || true

echo "==> 2/4 Check adb"
if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb not found. Install Android Studio and add platform-tools to PATH."
  echo "  ANDROID_HOME must point to your SDK."
  exit 1
fi
adb devices || true

echo "==> 3/4 expo prebuild --clean (android)"
npx expo prebuild --clean --platform android

echo "==> 4/4 expo run:android"
npx expo run:android

echo "Done. App should install on the emulator/device."
