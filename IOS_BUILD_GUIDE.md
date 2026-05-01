# 📱 iOS Build Guide for Windows (Unsigned IPA)

This guide documents the process of building an iOS app from a Windows machine using **Capacitor**, **Just**, and **GitHub Actions**.

---

## 1. Project Initialization
To turn a web app (Vite/React/Vue) into an iOS-ready project on Windows:

```powershell
# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios

# 2. Initialize Capacitor (Replace App Name and Bundle ID)
npx cap init "App Name" "com.yourname.app" --web-dir dist

# 3. Add the iOS platform
npx cap add ios
```

---

## 2. Task Automation (The `justfile`)
We used `just` as a task runner because it handles multi-line PowerShell (Windows) and Bash (Mac) commands better than `package.json`.

**Install Just:** `winget install casey.just`

**The "Smart" Justfile:** (Place in project root)
```just
# Detect OS
app_name := "Your App"
project := "ios/App/App.xcodeproj"
scheme := "App"
archive_path := "build/App.xcarchive"
export_path := "build/ipa"

# Clean build folders
clean:
    {{ if os_family() == "windows" { "if (Test-Path 'build') { Remove-Item -Recurse -Force 'build' }" } else { "rm -rf build" } }}

# Sync web code to iOS
sync:
    npm run build
    npx cap sync ios

# Build Archive (Runs on Mac/GitHub)
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
        CODE_SIGN_IDENTITY="" \
        ONLY_ACTIVE_ARCH=NO

# Export Unsigned IPA (Works on Windows/Mac)
export-unsigned:
    {{ if os_family() == "windows" { 
        # PowerShell logic for zipping .app into .ipa
    } else {
        # Bash logic for zipping .app into .ipa
    } }}
```

---

## 3. Remote Build (GitHub Actions)
Since Windows cannot run `xcodebuild`, we use GitHub's free Mac runners.

**File Path:** `.github/workflows/ios-build.yml`
**Key Requirements:**
- **Node.js 22**: Required for modern Capacitor versions.
- **Write Permissions**: Required to create GitHub Releases.
- **Unsigned Bypass**: We used `CODE_SIGNING_ALLOWED=NO` to build without an Apple Developer account.

---

## 4. Git Commands
To connect your local folder to GitHub and start the build:

```powershell
git init
git add .
git commit -m "Initial iOS setup"
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git push -u origin master
```

---

## 5. How to Download & Install
1.  **Push your code**: `git push` triggers the build.
2.  **Wait**: Check the "Actions" tab on GitHub (takes ~10 mins).
3.  **Download**: Go to the **Releases** page of your repo and download the `.ipa`.
4.  **Sideload**: 
    - Open **Sideloadly** on Windows.
    - Drag the `.ipa` in.
    - Enter Apple ID and click **Start**.

---

## 🛠️ Summary of Files Created
- `justfile`: Manages build tasks locally and remotely.
- `.github/workflows/ios-build.yml`: Automates the Mac build process.
- `capacitor.config.ts`: Configuration for the iOS wrapper.
