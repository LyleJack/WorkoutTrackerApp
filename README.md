# 💪 WorkoutTracker

A local-first Android workout tracking app built with React Native + Expo.

## Features

- **Track weight workouts** — log sets, reps and weight with progressive overload history
- **Cardio logging** — duration, calories, distance for treadmill, cycling, rowing and more
- **Progress charts** — per-exercise line charts showing max weight or volume over time
- **Stats dashboard** — streak, personal bests, total volume lifted, most popular workouts
- **History** — browse past sessions by date, edit sets, add missing sessions
- **Rest timer** — arc countdown timer with vibration and custom presets
- **Elapsed clock** — live workout duration shown in the header, freezes on finish
- **Resume detection** — automatically resumes a session if you navigate away mid-workout
- **Data export / import** — JSON backup and restore
- **100% local** — all data stored on-device via SQLite, no account required

## Stack

| Layer | Tech |
|---|---|
| Framework | [Expo](https://expo.dev) SDK 52+ |
| Navigation | [expo-router](https://expo.github.io/router) (file-based) |
| Database | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) |
| Charts | [react-native-gifted-charts](https://gifted-charts.web.app) |
| Icons | [@expo/vector-icons](https://icons.expo.fyi) (Ionicons) |
| Notifications | [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) |
| Storage | [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io/async-storage/) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Expo Go](https://expo.dev/go) on your Android device, or an Android emulator
- `npm` or `yarn`

### Install

```bash
git clone https://github.com/YOUR_USERNAME/WorkoutTracker.git
cd WorkoutTracker
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` to open in an Android emulator.

### First run

On first launch the app creates the SQLite database and seeds cardio types automatically.  
Use **Settings → Developer → Populate Dummy Data** to load 8 weeks of sample data for testing.

## Project Structure

```
app/
  _layout.tsx                  Tab navigator + shared AppHeader
  index.tsx                    Home screen — workout grid
  history.tsx                  Session history + detail modal
  stats.tsx                    Streak, PBs, volume, popular workouts
  progress.tsx                 Per-exercise progress charts
  settings.tsx                 Notifications, export/import, developer tools
  workout/
    [id].tsx                   Exercise list for a workout
    log/[sessionId].tsx        Live workout logging screen
    cardio/[sessionId].tsx     Cardio logging screen
src/
  db.ts                        All SQLite queries, schema and migrations
  notifications.ts             Daily reminder logic
  WorkoutIcons.tsx             SVG exercise icons
  ErrorBoundary.tsx            React error boundary
mocks/
  expo-keep-awake.js           Silent mock for Expo Go compatibility
```

## Database schema

```sql
workouts    (id, name, is_cardio, created_at)
exercises   (id, workout_id, name, sort_order)
sessions    (id, workout_id, date, created_at, notes)
sets        (id, session_id, exercise_id, weight, reps, set_number, comment)
cardio_types(id, name)
cardio_logs (id, session_id, cardio_type_id, duration_minutes, calories, distance_km, notes)
prefs       (key, value)
```

Migrations run automatically on startup via `PRAGMA table_info` checks — safe to upgrade from any previous version.

## Building for production

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

> Push notifications require an EAS build. They are silently disabled in Expo Go.

## Licence

MIT
