# Fix: NativeWorklets installTurboModule crash

## What we changed (final fix)
Switched from **Reanimated 4 + worklets** → **Reanimated 3.19**.

Reanimated 4 needs `react-native-worklets`, and Expo Go’s native module often mismatches the JS package, causing:

```
installTurboModule called with 1 arguments (expected 0)
NativeWorklets
```

Reanimated 3 does **not** use that Worklets TurboModule API, so the crash goes away.

## Run on your computer

```bash
cd your-project-folder

bash fix-worklets.sh

npx expo start -c
```

Then on the phone:
1. Swipe Expo Go away (force close)
2. Open Expo Go again
3. Scan the QR code

## Verify

```bash
node -p "require('react-native-reanimated/package.json').version"
# should start with 3.19

node -p "require.resolve('react-native-worklets/package.json')"
# should FAIL (module not found) — that is correct
