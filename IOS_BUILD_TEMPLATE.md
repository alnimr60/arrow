# 🚀 Universal AI Studio -> iOS Build Template

This template creates a "Fortress" architecture. It allows you to use **Google AI Studio** as your main editor without it ever deleting your native iOS files.

---

## 🏗️ 1. The Architecture
*   **`main` branch**: Your "Playground." AI Studio syncs here. It's okay if files get deleted here.
*   **`fortress` branch**: Your "Vault." This branch holds the `ios` folder and build scripts safely.
*   **The Workflow**: A single script that combines both branches and builds the IPA.

---

## 🛠️ 2. One-Time Setup (New Project)

1.  **Initialize Capacitor** in your local project:
    ```powershell
    npm install @capacitor/core @capacitor/cli @capacitor/ios
    npx cap init "App Name" "com.domain.app" --web-dir dist
    npx cap add ios
    ```

2.  **Create your "Vault" branch**:
    ```powershell
    git checkout -b fortress
    git add .
    git commit -m "Initialize Fortress"
    git push origin fortress
    ```

3.  **Switch back to `main`**:
    ```powershell
    git checkout main
    ```

---

## 🤖 3. The "Trigger" Script
Create this file in AI Studio at the path: `.github/workflows/trigger.yml`

```yaml
name: Build iOS IPA (Fortress Mode)
on:
  push:
    branches: [ main ]

permissions:
  contents: write

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: 🛡️ Restore Fortress Infrastructure
        run: |
          # Grabs the native files from the 'fortress' branch
          git checkout origin/fortress -- ios justfile capacitor.config.ts package-lock.json
          
      - name: 📦 Setup & Install
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: 🏗️ Build App
        run: |
          npm install
          brew install just
          just archive
          just export-unsigned

      - name: 🚀 Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: latest
          name: Latest Build
          files: build/ipa/*.ipa
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: 🔄 Sync Game Logic back to Fortress
        run: |
          git config user.name "Fortress Guardian"
          git config user.email "actions@github.com"
          
          # Switch to fortress branch
          git checkout fortress
          
          # Specifically pull only game files from main
          # This prevents deleting the 'ios' folder and 'justfile'
          git checkout main -- src public index.html tsconfig.json vite.config.ts package.json package-lock.json .github/workflows/trigger.yml
          
          git add .
          git commit -m "🚀 Sync latest game code to Fortress" || echo "No changes"
          git push origin fortress
```

---

## 📜 4. The Generic `justfile`
Put this in your `fortress` branch root. It works for any app name.

```just
# iOS Build Script
project := "ios/App/App.xcodeproj"
scheme := "App"
archive_path := "build/App.xcarchive"
export_path := "build/ipa"

# Build web code & sync to iOS
sync:
    npm run build
    npx cap sync ios

# Archive (Runs on Mac)
archive: sync
    xcodebuild archive \
        -project {{project}} \
        -scheme {{scheme}} \
        -configuration Release \
        -sdk iphoneos \
        -destination 'generic/platform=iOS' \
        -archivePath {{archive_path}} \
        CODE_SIGNING_ALLOWED=NO \
        CODE_SIGNING_REQUIRED=NO \
        CODE_SIGN_IDENTITY=""

# Export IPA
export-unsigned:
    APP_PATH=$(find {{archive_path}}/Products/Applications -name '*.app' | head -n 1); \
    mkdir -p {{export_path}}/Payload; \
    cp -r "$APP_PATH" {{export_path}}/Payload/; \
    cd {{export_path}}; \
    zip -r App-Unsigned.ipa Payload; \
    rm -rf Payload
```

---

## ✅ Summary of the Workflow
1.  **Code** in AI Studio.
2.  **Sync** to GitHub (`main`).
3.  **The Trigger** wakes up, grabs the iOS folder from `fortress`, builds your IPA, and updates the `fortress` branch with your new code.
4.  **Download** your IPA from the "Releases" page.

**No more deletions. No more errors. Pure automation.** 🚀
