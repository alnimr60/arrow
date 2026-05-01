# iOS Build Configuration (Capacitor + Windows)
set shell := ["powershell.exe", "-Command"]

app_name := "Arrow Escape"
workspace := "ios/App/App.xcworkspace"
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
    if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    @echo "✅ Clean complete"

# Sync web code to native iOS
sync:
    @echo "🔄 Building web app and syncing to iOS..."
    npm run build
    npx cap sync ios

# Build & Archive (Use these on GitHub Actions)
archive: sync
    @echo "📦 Creating archive (Remote Mac)..."
    xcodebuild archive \
        -workspace {{workspace}} \
        -scheme {{scheme}} \
        -configuration {{configuration}} \
        -sdk iphoneos \
        -destination 'generic/platform=iOS' \
        -archivePath {{archive_path}} \
        -allowProvisioningUpdates \
        CODE_SIGN_STYLE=Automatic \
        ONLY_ACTIVE_ARCH=NO

# Export Unsigned IPA (Works on Windows/Mac)
export-unsigned:
    @echo "📱 Creating unsigned IPA for Sideloadly..."
    if (-not (Test-Path "{{archive_path}}")) { Write-Error "❌ Archive not found!"; exit 1 }
    
    $appPath = Get-ChildItem -Path "{{archive_path}}/Products/Applications" -Filter "*.app" -Recurse | Select-Object -First 1
    $payloadDir = "{{export_path}}/Payload"

    if (Test-Path $payloadDir) { Remove-Item -Recurse -Force $payloadDir }
    New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null
    
    Copy-Item -Path $appPath.FullName -Destination $payloadDir -Recurse
    
    $ipaName = "ArrowEscape-Unsigned.ipa"
    if (Test-Path "{{export_path}}/$ipaName") { Remove-Item "{{export_path}}/$ipaName" }
    
    Compress-Archive -Path $payloadDir -DestinationPath "{{export_path}}/$ipaName"
    Remove-Item -Recurse -Force $payloadDir
    @echo "✅ Unsigned IPA created: {{export_path}}/$ipaName"

# Full workflow for GitHub
ios: clean archive export-unsigned
