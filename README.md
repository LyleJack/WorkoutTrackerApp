# 💪 WorkoutTracker

A local-first Android workout tracking app built with **React Native + Expo SDK 55**.  
No account, no cloud, no ads — everything lives in SQLite on your device.

---

## Features

| Area | What it does |
|---|---|
| **Workouts** | 2-column grid home screen. Tap to start, long-press to manage. Quick-start templates for common splits (Push/Pull/Legs etc.) |
| **Strength logging** | Log sets with weight, reps, and optional notes. Swipe a set row left to delete. Checkbox mode to tick off sets as you go |
| **Duration mode** | Toggle any exercise (e.g. Plank) to duration mode — tracks seconds instead of reps |
| **Cardio logging** | Separate logging screen for duration, calories, and distance. Supports multiple activity types per session |
| **Rest timer** | Arc countdown timer with configurable presets and haptic feedback |
| **Elapsed clock** | Live workout duration shown in the logging header — freezes on finish |
| **Exercise management** | Drag to reorder exercises. Eye-slash icon to hide rarely-used exercises — they reappear as quick-add chips next time |
| **History** | Browse all sessions by date. Tap to edit sets, notes, or cardio entries inline. FAB to add a backdated session |
| **Stats** | Streak counter, personal bests, total volume lifted, weekly activity dots, most popular workouts chart |
| **Progress charts** | Per-exercise line charts. Bodyweight exercises show max reps. Duration exercises show seconds. Weighted sessions on a BW exercise shown as orange dots. Cardio tab shows calories/min per activity type |
| **Resume detection** | Auto-resumes an unfinished session (within 15 min). Finished recently? Offers "new session" or "edit last" via action sheet |
| **Export / Import** | Full JSON backup and restore via the share sheet |
| **Daily reminder** | Optional push notification at a configurable time (EAS build only) |

---

## Stack

| Layer | Package | Version |
|---|---|---|
| Framework | `expo` | SDK 55 |
| Navigation | `expo-router` | ~5.0 |
| Database | `expo-sqlite` | ~16.0 |
| Charts | `react-native-gifted-charts` | ^1.4 |
| Icons | `@expo/vector-icons` (Ionicons) | ^14 |
| Notifications | `expo-notifications` | ~0.31 |
| Storage (prefs) | `@react-native-async-storage/async-storage` | 2.x |
| Runtime | React Native | 0.83 / React 19 |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20+  
- [Expo Go](https://expo.dev/go) on your Android device (SDK 55), or an Android emulator  
- `npm` 10+

### Install & run

```bash
git clone https://github.com/YOUR_USERNAME/WorkoutTracker.git
cd WorkoutTracker
npm install --legacy-peer-deps
npx expo start --clear
```

Scan the QR code with Expo Go, or press `a` to open in an Android emulator.

> **Note:** `--legacy-peer-deps` is needed because `react-native-gifted-charts` and  
> `react-native-linear-gradient` haven't yet formally declared React 19 peer support,  
> but they work correctly with it.

### First run

On first launch the app creates the SQLite database and seeds six default cardio types.  
The **Cardio** workout is created automatically and cannot be deleted.

Go to **Settings → Developer → Demo Data** to load eight weeks of realistic sample data.

---

## Project structure

```
WorkoutTracker/
├── app/
│   ├── _layout.tsx                 Tab navigator + shared AppHeader component
│   ├── index.tsx                   Home — workout grid, templates, create new
│   ├── history.tsx                 Session history, detail/edit modal, FAB to add backdated sessions
│   ├── stats.tsx                   Streak, PBs, volume, weekly dots, most popular chart
│   ├── progress.tsx                Per-exercise line charts + cardio progress tab
│   ├── settings.tsx                Notifications, backup/restore, streak offset, developer tools
│   └── workout/
│       ├── [id].tsx                (Unused — kept for future "edit workout" feature)
│       ├── log/[sessionId].tsx     Live strength logging — sets, timer, reorder, hide, checkbox
│       └── cardio/[sessionId].tsx  Cardio logging — type picker, duration, calories, distance
├── src/
│   ├── db.ts                       All SQLite schema, queries, types, and migrations
│   ├── theme.ts                    Design tokens — colours, font sizes, border radii
│   ├── utils.ts                    Shared helpers — formatDuration, formatVolume, formatDate
│   ├── notifications.ts            Daily reminder scheduling (Expo Go safe — lazy import)
│   ├── WorkoutIcons.tsx            SVG exercise icon set + name matcher
│   └── ErrorBoundary.tsx           React class error boundary
├── assets/
│   ├── icon.png                    1024×1024 app icon
│   ├── adaptive-icon.png           Transparent foreground for Android adaptive icon
│   ├── splash.png                  1284×2778 splash screen
│   └── notification-icon.png      Monochrome notification icon
├── mocks/
│   └── expo-keep-awake.js          Silent no-op mock (expo-keep-awake not available in Expo Go)
├── app.json                        Expo config — SDK 55, package name, permissions
├── eas.json                        EAS build profiles (development / preview APK / production AAB)
├── metro.config.js                 Metro bundler — redirects expo-keep-awake to mock
├── package.json                    Dependencies (SDK 55 compatible)
└── tsconfig.json                   TypeScript — strict mode, @/* path alias
```

---

## Database schema

```sql
workouts    (id INTEGER PK, name TEXT, is_cardio INTEGER DEFAULT 0, created_at TEXT)
exercises   (id INTEGER PK, workout_id INTEGER, name TEXT, sort_order INTEGER, is_hidden INTEGER DEFAULT 0)
sessions    (id INTEGER PK, workout_id INTEGER, date TEXT, created_at TEXT, notes TEXT, duration_seconds INTEGER)
sets        (id INTEGER PK, session_id INTEGER, exercise_id INTEGER, weight REAL,
             reps INTEGER, set_number INTEGER, comment TEXT, duration_seconds INTEGER)
cardio_types(id INTEGER PK, name TEXT UNIQUE)
cardio_logs (id INTEGER PK, session_id INTEGER, cardio_type_id INTEGER,
             duration_minutes REAL, calories INTEGER, distance_km REAL, notes TEXT)
prefs       (key TEXT PK, value TEXT)
```

**Migrations** run automatically via `ALTER TABLE … ADD COLUMN` wrapped in try/catch — safe to upgrade from any earlier build without data loss.

---

## Building for Android

### Preview APK (sideloadable, fastest)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

The APK URL appears in the EAS dashboard and is also emailed to you. Install directly on your device.

### Production AAB (for Play Store)

```bash
eas build -p android --profile production
```

### Troubleshooting common EAS errors

| Error | Fix |
|---|---|
| `npm ci` lock file out of sync | Run `rm package-lock.json && npm install --legacy-peer-deps` locally, commit the new lock file |
| Missing asset files | Ensure `assets/` is committed to git — EAS builds from your git history |
| `ERESOLVE peer react@^19` | Run `npm install react@19.0.0 --legacy-peer-deps` then regenerate lock file |
| `newArchEnabled` schema error | Remove from `app.json` — new arch is enabled by default in SDK 55 |
| Duplicate `react` versions | Delete parent-directory `node_modules` that contain an older React, then `npm dedupe` |

> Push notifications are silently disabled in Expo Go and only activate in EAS builds.

---

## Design system

All colours and type sizes are defined in `src/theme.ts`. Key tokens:

| Token | Value | Usage |
|---|---|---|
| `C.purple` | `#6C63FF` | Primary brand, active states |
| `C.green` | `#22c55e` | Cardio, success, finish buttons |
| `C.orange` | `#f59e0b` | Weighted sets on BW exercises |
| `C.bg` | `#000000` | Screen background (true OLED black) |
| `C.bgCard` | `#0a0a0a` | Card and section backgrounds |
| `C.textPrimary` | `#e8e8ff` | Headlines and values |
| `C.textMuted` | `#555555` | Secondary labels |

---

## Licence

MIT — do whatever you like with it.
