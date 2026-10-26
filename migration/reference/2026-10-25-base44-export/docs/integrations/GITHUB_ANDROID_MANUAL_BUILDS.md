# On-demand GitHub Android builds for IFund

GitHub is an **independent optional Android build provider**, not the mandatory or automatic APK publisher. Base44 currently publishes the installed IFund APK, but this GitHub workflow stays ready for a deliberate future migration.

## Start a GitHub build

After the manual workflow has been merged into the default branch:
1. Open **GitHub → interplanetary-fund2 → Actions → IFund Android APK - manual build**.
2. Select **Run workflow** and the branch/commit to build.
3. Choose **debug** for a test APK on the selected branch, or **signed-release** on the reviewed **main** branch for an APK signed with the existing owner's Android identity.
4. For signed-release, supply a new integer **version_code** that is greater than the APK already installed, and **version_name** such as `1.0.1`.
5. Review the run's tests, signing verification, APK embedded release marker, and artifact SHA-256. Download the private Actions artifact if successful.

This process runs only on `workflow_dispatch`. It is not triggered by website pushes, PRs, GitHub synchronization, schedules, Cloudflare deployment, or Base44 publication. A GitHub Actions artifact is **not** automatically installed, promoted, or published to users. No Google Play upload happens in this workflow.

## Release signing: preserve update compatibility

Before choosing signed-release, the repository owner must securely configure four GitHub **Actions secrets**:

| Secret name | Value |
| --- | --- |
| `IFUND_ANDROID_KEYSTORE_B64` | Base64-encoded bytes of the **existing** Android signing keystore (never a new random key for an upgrade) |
| `IFUND_ANDROID_KEYSTORE_PASSWORD` | Password for that existing keystore |
| `IFUND_ANDROID_KEY_ALIAS` | Alias of the correct signing key |
| `IFUND_ANDROID_KEY_PASSWORD` | Password for that key |

Use GitHub encrypted secrets, not committed files, chat messages, or logs. The workflow fails closed when a required secret is missing and removes decoded keystore files after signing. Credential retrieval/provisioning requires the account owner's authorization.

**Important:** An APK signed with a different certificate generally cannot update an already-installed APK with the same Android application ID. Obtain and verify the current signing certificate fingerprint and published versionCode before switching away from Base44. If Base44 cannot provide a compatible signing identity, do not claim GitHub-signed APKs are in-place upgrades. Production Android release/device QA and signing-key continuity must be verified separately.

## Existing Android setup

- The `android/` Gradle wrapper and configuration, Firebase, Capacitor, native code, and security tests remain available to GitHub and Base44.
- The workflow builds shared web assets, executes `npx cap sync android`, checks Android/website asset parity, and uses Gradle only in **explicit manual runs**.
- Both debug and release artifacts are checked with `apksigner` and the embedded `ifund-release.json` is compared with the just-built web output.
- This workflow generates APK files, not an AAB or Play Store upload. An AAB/Play release can be added later through a separate deliberate owner-approved process.
- GitHub's optional CodeQL Java/Kotlin default analysis is **not** the same as this manual build. If CodeQL automatically runs Gradle, configure its analysis independently to avoid unnecessary automatic native builds while retaining JavaScript/TypeScript and Actions scanning.

## Web-only changes

Builds and deployments of the website do **not** require an Android APK. Because Capacitor APKs bundle web assets, website publication doesn't automatically replace previously installed APK content. When a future native release is needed, the owner intentionally selects the build provider and starts a new native build.
