#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export ANDROID_HOME="${ANDROID_HOME:-${LOCALAPPDATA:-}/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [[ -n "${TRADEVAULT_JAVA_HOME:-}" ]]; then
  export JAVA_HOME="$TRADEVAULT_JAVA_HOME"
else
  java_path="$(command -v java)"
  export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$java_path")")")"
fi
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export TRADEVAULT_APP_URL="${TRADEVAULT_APP_URL:-https://tradevault-tradevault.vercel.app}"

java_output="$("$JAVA_HOME/bin/java" -version 2>&1)"
if [[ "$java_output" != *'version "21.'* ]]; then
  printf 'Java 21 is required. Set TRADEVAULT_JAVA_HOME to a Java 21 installation.\n%s\n' "$java_output" >&2
  exit 1
fi

if [[ ! -x "$ANDROID_HOME/platform-tools/adb.exe" && ! -x "$ANDROID_HOME/platform-tools/adb" ]]; then
  printf 'Android SDK not found at %s\n' "$ANDROID_HOME" >&2
  exit 1
fi

if [[ ! -d "$ANDROID_HOME/platforms/android-36" ]]; then
  printf 'Android SDK Platform 36 is required and was not found.\n' >&2
  exit 1
fi

if [[ ! -f package-lock.json ]]; then
  npm install
else
  npm ci
fi

npx capacitor sync android

(cd android && bash ./gradlew --no-daemon assembleDebug)

mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk dist/tradevault.apk

printf '\nAPK created: %s\n' "$(pwd)/dist/tradevault.apk"
sha256sum dist/tradevault.apk
