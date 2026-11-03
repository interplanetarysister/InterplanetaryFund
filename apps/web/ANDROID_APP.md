# IFund Android app

The Android app is a Capacitor shell around the same live Interplanetary Fund website. It loads `https://interplanetaryfund.com`, so web UX and application behavior stay in sync without maintaining a second frontend or waiting for a separate APK release for ordinary website changes.

- Existing Android application ID is preserved: `com.base6a67a778342a8fe05ee79cba.app`. This is an app identity, not a Base44 hosting dependency.
- The app icon and splash assets are generated from `assets/icon.svg`, the same planet mark used by the web frontend.
- Capacitor and asset-generation dependencies are open source and free.
- The Android workflow builds a debug APK on native-wrapper changes or manual dispatch. It does not require a paid build service.
- The debug APK is suitable for installation/testing. A signed release APK requires the existing private signing keystore and credentials; do not replace or publish a new signing identity without those credentials.
