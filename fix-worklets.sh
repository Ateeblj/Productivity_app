#!/usr/bin/env bash
set -euo pipefail
echo "==> Alternative fix: no Reanimated/Worklets on phone path"
rm -rf node_modules package-lock.json yarn.lock .expo
npm install
# Ensure these are gone
npm uninstall react-native-reanimated react-native-worklets 2>/dev/null || true
echo "==> Done. Start:"
echo "    npx expo start -c"
echo "Force-close Expo Go on the phone, then reopen and scan QR."
