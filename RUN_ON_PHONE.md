# Run this build

## 1. Install
```powershell
cd <this-folder>
npm install
npx expo install --fix
```

## 2. Start (Expo Go SDK 54)
```powershell
npx expo start --tunnel --clear
```
Scan QR with Expo Go on the same or any network (tunnel).

## 3. What you get
- **Phone:** floating pill tabs (Overview · Notes · Calendar · Today) + center FAB
- **Desktop/web:** original drawer sidebar
- Overview: swipe course cards, progress ring, mastery bar, Start unit
- NativeWind CSS pipeline is **off** (avoids SDK 54 crash); StyleSheet UI still works

## 4. If npm says EOVERRIDE
Ensure `package.json` has **no** `"overrides"` block. This zip’s package.json is already clean for SDK 54.
