# iOS Build Configuration (Smart Windows/Mac detection)
app_name := "Arrow Escape"
project := "ios/App/App.xcodeproj"
scheme := "App"
configuration := "Release"
archive_path := "build/App.xcarchive"
export_path := "build/ipa"
bundle_id := "co.bitscorp.arrowescape"

# Default recipe
default:
    @just --list

# Clean everything
clean:
    @echo "🧹 Cleaning..."
    {{ if os_family() == "windows" { "if (Test-Path 'build') { Remove-Item -Recurse -Force 'build' }; if (Test-Path 'dist') { Remove-Item -Recurse -Force 'dist' }" } else { "rm -rf build dist" } }}
    @echo "✅ Clean complete"

# Sync web code to native iOS
sync:
    @echo "🔄 Building web app and syncing to iOS..."
    npm run build
    npx cap sync ios

# Build & Archive (Uses xcodebuild on Mac)
archive: sync
    @echo "📦 Creating archive..."
    xcodebuild archive \
        -project {{project}} \
        -scheme {{scheme}} \
        -configuration {{configuration}} \
        -sdk iphoneos \
        -destination 'generic/platform=iOS' \
        -archivePath {{archive_path}} \
        -allowProvisioningUpdates \
        CODE_SIGN_STYLE=Automatic \
        ONLY_ACTIVE_ARCH=NO

# Export Unsigned IPA (Works on Windows and Mac)
export-unsigned:
    @echo "📱 Creating unsigned IPA for Sideloadly..."
    {{ if os_family() == "windows" { 
        "$appPath = Get-ChildItem -Path '" + archive_path + "/Products/Applications' -Filter '*.app' -Recurse | Select-Object -First 1; " +
        "$payloadDir = '" + export_path + "/Payload'; " +
        "if (Test-Path $payloadDir) { Remove-Item -Recurse -Force $payloadDir }; " +
        "New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null; " +
        "Copy-Item -Path $appPath.FullName -Destination $payloadDir -Recurse; " +
        "$ipaName = 'ArrowEscape-Unsigned.ipa'; " +
        "if (Test-Path '" + export_path + "/$ipaName') { Remove-Item '" + export_path + "/$ipaName' }; " +
        "Compress-Archive -Path $payloadDir -DestinationPath '" + export_path + "/$ipaName'; " +
        "Remove-Item -Recurse -Force $payloadDir"
    } else {
        "APP_PATH=$(find " + archive_path + "/Products/Applications -name '*.app' | head -n 1); " +
        "mkdir -p " + export_path + "/Payload; " +
        "cp -r \"$APP_PATH\" " + export_path + "/Payload/; " +
        "cd " + export_path + "; " +
        "zip -r ArrowEscape-Unsigned.ipa Payload; " +
        "rm -rf Payload"
    } }}
    @echo "✅ Unsigned IPA created in {{export_path}}"

# Full workflow
ios: clean archive export-unsigned
