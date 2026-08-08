# Mobile App Build Guide

## Overview
The Interplanetary Fund mobile app is built using Capacitor to wrap the React web app as a native Android/iOS application.

## Prerequisites
- Node.js 18+
- Android Studio (for Android APK)
- Xcode (for iOS, macOS only)
- JDK 17+

## One-Time Setup

```bash
# Install Capacitor dependencies
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# Initialize Android project
npx cap add android

# Initialize iOS project (macOS only)
npx cap add ios
```

## Build & Sync

```bash
# 1. Build the web app
npm run build

# 2. Sync web build to native projects
npx cap sync

# 3. Open in Android Studio
npx cap open android

# 4. Open in Xcode (macOS only)
npx cap open ios
```

## Producing the APK

### Method 1: Android Studio
1. Run `npx cap sync && npx cap open android`
2. In Android Studio: Build → Build Bundle(s)/APK(s) → Build APK(s)
3. APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`

### Method 2: Command Line
```bash
cd android
./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk

# Release build (needs keystore)
./gradlew assembleRelease
# APK at: android/app/build/outputs/apk/release/app-release.apk
```

### Method 3: LEGACY — Base44 APK (DEPRECATED)
_NOTE: Base44 APK method is deprecated. Use Capacitor (Method 1 or 2) for mobile builds._
_Historically, Base44 built an APK that synced Convex data via backend functions. This is no longer the canonical approach._

## Environment Configuration

### Development
- `VITE_CONVEX_URL=https://rosy-butterfly-2.convex.cloud` in `.env.local`

### Production (Vercel)
- Set `VITE_CONVEX_URL` in Vercel project settings

### Mobile (Capacitor)
- The Convex URL is bundled into the built JS
- For runtime configuration, use a config endpoint

## Updating the App

1. Make code changes
2. `npm run build` → rebuilds web app
3. `npx cap sync` → copies new build to native projects
4. Rebuild APK in Android Studio
5. Push to GitHub → Vercel auto-deploys web version
