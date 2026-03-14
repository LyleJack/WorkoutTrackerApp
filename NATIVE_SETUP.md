# Native Module Setup — Floating Timer Bubble

## Overview

The floating timer overlay is a native Android feature that requires an EAS build.
In Expo Go it silently does nothing — all other app functionality works normally.

## Dual workflow

| Scenario | How to run | Floating bubble? |
|---|---|---|
| Day-to-day dev | `npx expo start` → Expo Go | ❌ (in-app timer still works) |
| Testing native features | EAS dev build (see below) | ✅ |
| Distribution | `eas build --profile preview` | ✅ |

---

## One-time EAS setup

```bash
# 1. Install EAS CLI globally (if not already done)
npm install -g eas-cli

# 2. Log in to your Expo account
eas login

# 3. Configure the project (run once, answers stored in eas.json)
eas build:configure
```

---

## Building the dev client (for native testing)

This creates a custom APK with your native modules compiled in.
After installing it once, day-to-day dev still uses `npx expo start`.

```bash
# Prebuild generates the android/ folder with all native code wired in
npx expo prebuild --platform android

# Build the dev APK via EAS cloud (~10-15 min first time, cached after)
eas build --platform android --profile devbuild

# Or build locally if you have Android Studio / JDK installed
eas build --platform android --profile devbuild --local
```

Install the resulting APK on your device, then develop normally:

```bash
npx expo start
```

The custom dev client connects to Metro exactly like Expo Go does.

---

## What the config plugin does automatically

`plugins/withFloatingTimer.js` runs during `expo prebuild` and:

1. Adds `SYSTEM_ALERT_WINDOW` permission to `AndroidManifest.xml`
2. Adds `FOREGROUND_SERVICE` permission
3. Registers `FloatingTimerService` as an Android Service
4. Adds `FloatingTimerPackage` to `MainApplication.kt`

You do **not** need to manually edit `android/` folder files.

---

## First-time permission prompt

On first use the app will open the Android "Display over other apps" settings screen.
The user grants permission once and it persists permanently.

To trigger it manually for testing:

```kotlin
// In FloatingTimerModule.kt — already handled automatically in show()
FloatingTimer.requestPermission()
```

---

## File structure

```
modules/floating-timer/
└── android/src/main/java/com/workouttracker/floatingtimer/
    ├── FloatingTimerService.kt   ← Service that owns the overlay window
    ├── FloatingTimerModule.kt    ← JS ↔ Kotlin bridge (NativeModules.FloatingTimer)
    └── FloatingTimerPackage.kt   ← React Native package registration
    res/
    ├── layout/bubble_timer.xml   ← 56dp circle layout
    └── drawable/bubble_circle.xml ← Purple circle shape

plugins/
└── withFloatingTimer.js          ← Expo config plugin (wires everything in)

src/
└── floatingTimer.ts              ← JS/TS API (no-op in Expo Go)
```

---

## JS API

```typescript
import { FloatingTimer } from '@/src/floatingTimer';

// Check if running in an EAS build (false in Expo Go)
FloatingTimer.isAvailable  // boolean

// Show the bubble with a 90-second countdown
FloatingTimer.show(90);

// Update the countdown (e.g. user changed preset)
FloatingTimer.update(120);

// Dismiss bubble and stop background service
FloatingTimer.hide();

// Check / request overlay permission
const granted = await FloatingTimer.hasPermission();
FloatingTimer.requestPermission(); // opens Settings if needed
```

The JS API is already integrated into `app/workout/log/[sessionId].tsx` —
calling `show()` happens automatically when a set is logged, `hide()` when
the workout finishes or the in-app timer is dismissed.

---

## Behaviour

- **Drag** the bubble anywhere on screen
- **Snap** to left/right edge on release
- **Tap** the bubble to open the app
- **Pulse** animation when timer hits zero (✓ shown in bubble)
- Survives app backgrounding via a foreground `Service` (silent notification kept in shade)
- Automatically dismissed when workout is finished from inside the app
