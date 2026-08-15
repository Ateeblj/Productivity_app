# Alternatives for NativeWorklets crash

## What this build does (recommended)
1. **Phone (Android/iOS)** uses only `MobileTabNavigator` (tabs + stack).
2. **Drawer + Reanimated are NOT imported** on native — so Worklets never loads.
3. Metro **stubs** `react-native-reanimated` / `react-native-worklets` if anything still requires them.
4. App animations use React Native’s built-in `Animated` API (already in your components).

## Install
```bash
bash fix-worklets.sh
npx expo start -c
```
Force-close Expo Go → reopen → scan QR.

## Other alternatives if still stuck

### A) Expo Go version mismatch
Update or reinstall Expo Go from Play Store. Old Expo Go + new JS = TurboModule errors.

### B) Development build instead of Expo Go
```bash
npx expo prebuild --clean
npx expo run:android
```
Uses your `android/` project; native modules compile together.

### C) Web only (quick check)
```bash
npx expo start --web
```
Confirms JS app works; crash is native-only.

### D) Nuclear: remove drawer package
```bash
npm uninstall @react-navigation/drawer react-native-reanimated react-native-worklets
npx expo start -c
```
Phone already does not use the drawer.

### E) Older Expo Go / SDK
If you must stay on Reanimated 4, use an Expo Go build that matches worklets 0.5.1 exactly, or a custom dev client.
