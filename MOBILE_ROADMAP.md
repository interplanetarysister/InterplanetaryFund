# Interplanetary Fund — Mobile App Roadmap

**Created:** August 3, 2026
**Owner:** Michelle Rogers
**Target Devices:** Android (Galaxy A16 primary), iOS (future)
**Final Goal:** Google Play Store + Apple App Store distribution

## Current State (August 2026)

✅ Capacitor configured (appId: com.interplanetarysister.interplanetaryfund)
✅ Capacitor dependencies installed (Android 6.1.0, iOS 6.1.0, Splash Screen 6.0.0)
✅ PWA manifest created (standalone, portrait, themed)
✅ Vite configured for production builds
✅ Mobile-first UI (Galaxy A16 optimized)
✅ Convex backend live and deployed
✅ Vercel hosting configured
✅ IP/legal protection framework in place
✅ MOBILE_BUILD.md guide created

## What's Missing

✅ App icons generated (192px, 512px, 180px, 1024px, favicon) — afro-punk comic book style
⏳ Android native project (npx cap add android) — requires Android SDK + JDK 17
❌ iOS native project (npx cap add ios) — requires macOS + Xcode
❌ App signing keystore (for Google Play release builds)
❌ Apple Developer account ($99/year)
⏳ Google Play Developer account — account created, awaiting Google approval
❌ Privacy Policy URL (required by both stores — we have the doc, need hosted URL)
❌ App store screenshots
❌ App store descriptions and metadata

## Roadmap Phases

### Phase 1: PWA (Current — No Cost)
- [x] Web app deployed on Vercel
- [x] PWA manifest configured
- [x] Mobile-first responsive design
- [x] Generate app icons (192px + 512px + 180px + 1024px) ✅
- [x] Add apple-touch-icon meta tags to index.html ✅
- [ ] Test PWA install on Galaxy A16 (pending Michelle testing)
- Result: Users can "Add to Home Screen" for app-like experience
- Cost: $0

### Phase 2: Android APK (Next — No Cost)
- [ ] Install Android SDK + JDK 17
- [ ] Run `npx cap add android` to create native project
- [ ] Generate app icons with Capacitor assets
- [ ] Build debug APK: `npm run build && npx cap sync && npx cap open android`
- [ ] Test APK on Galaxy A16
- [ ] Build release APK (needs signing keystore)
- Result: Distributable APK that can be sideloaded
- Cost: $0 (just dev tools)

### Phase 3: Google Play Store (When Ready — $25)
- [x] Google Play Developer account created ✅ (awaiting Google approval)
- [ ] Wait for Google account verification to complete
- [ ] Generate release signing keystore
- [ ] Build signed AAB (Android App Bundle — required by Google Play)
- [ ] Create store listing:
  - App name: "Interplanetary Fund"
  - Category: Finance or Social Impact
  - Privacy Policy URL (host the legal/PRIVACY_POLICY.md)
  - Terms of Service URL (host the legal/TERMS_OF_SERVICE.md)
  - Screenshots (min 2, max 8 — Galaxy A16 resolution)
  - App description
- [ ] Submit for Google Play review (typically 1-3 days)
- Result: App available on Google Play Store
- Cost: $25 one-time

### Phase 4: Apple App Store (Future — $99/year)
- [ ] Create Apple Developer account ($99/year)
- [ ] Run `npx cap add ios` (requires macOS + Xcode)
- [ ] Configure app signing in Xcode
- [ ] Build iOS app in Xcode
- [ ] Test on physical iPhone or simulator
- [ ] Create App Store Connect listing
- [ ] Submit for Apple review (typically 1-7 days)
- Result: App available on Apple App Store
- Cost: $99/year
- Requirement: macOS computer with Xcode

## Essential Build Instructions

See MOBILE_BUILD.md for complete step-by-step build commands including:
- One-time Capacitor setup (npm install, npx cap add android/ios)
- Build & sync workflow (npm run build → npx cap sync → npx cap open)
- APK production (Android Studio, command line, or Base44)
- Environment configuration (dev, production, mobile)
- App update workflow

Do NOT delete MOBILE_BUILD.md — it contains essential architecture creation steps.

## Technical Architecture (Already Built)

The app is designed as a hybrid web-to-native app:

1. React + Vite builds the web app → `dist/`
2. Capacitor wraps the web build in a native Android/iOS shell
3. The native app loads the Vercel-hosted web app via WebView
4. Convex handles real-time backend (WebSocket, works in WebView)
5. PayPal checkout opens in system browser (works in Capacitor)
6. Push notifications can be added via Capacitor plugins later

## App Store Compliance Notes

Both Google Play and Apple App Store require:
1. Privacy Policy URL — we have legal/PRIVACY_POLICY.md (needs hosting)
2. Account deletion option — users must be able to delete accounts
3. Data safety disclosure — we have this in the privacy policy
4. No deceptive behavior — our terms cover this
5. Payment transparency — our fee structure is documented (5% + 2.9% + $0.30)
6. No Stripe dependency — we use PayPal (avoids Stripe's $500 fee)

Important: Apple may require using their in-app purchase system for digital
transactions, which takes 30% (15% for small businesses). However, since
Interplanetary Fund processes donations (not digital goods), we may qualify
for an exemption. This needs legal review before App Store submission.

## Icon Requirements

Need to generate:
- 192x192 PNG (PWA + Android)
- 512x512 PNG (PWA + Google Play store icon)
- 180x180 PNG (apple-touch-icon)
- 1024x1024 PNG (App Store icon)
- Adaptive icon (Android — foreground + background layers)

Style: Afro-punk comic book aesthetic (matches campaign image style)
Colors: Background #0a0b1e, accent #22d3ee (from manifest.json)

---

© 2026 Michelle Rogers. All Rights Reserved.
