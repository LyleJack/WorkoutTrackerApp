# 💪 WorkoutTracker

A local-first Android workout tracking app built with React Native + Expo.

## Features
- Create workouts and exercises
- Log sets with weight, reps, and comments
- Daily notification reminder
- Streak tracking and statistics
- Per-exercise progression charts (weight or volume)
- JSON export/import for backup

## Setup

### 1. Copy files into your Expo project

Copy the contents of this folder into your existing Expo project created with:
```bash
npx create-expo-app WorkoutTracker --template tabs
cd WorkoutTracker
```

### 2. Install dependencies

```bash
npx expo install expo-sqlite expo-notifications expo-file-system expo-sharing expo-document-picker
npx expo install @react-native-async-storage/async-storage @react-native-community/datetimepicker
npm install react-native-gifted-charts react-native-linear-gradient react-native-svg
```

### 3. Run on your phone

Install **Expo Go** from the Play Store, then:
```bash
npx expo start
```
Scan the QR code with your phone.

### 4. Build an APK

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```
This produces a `.apk` you can install directly (no Play Store needed).

## File Structure

```
app/
  _layout.tsx          ← Tab navigation + DB init
  index.tsx            ← Workout list (Home)
  stats.tsx            ← Streaks and charts
  progress.tsx         ← Per-exercise progression
  settings.tsx         ← Notifications + export/import
  workout/
    [id].tsx           ← Exercise list for a workout
    log/
      [sessionId].tsx  ← Live logging screen

src/
  db.ts                ← All SQLite queries
  notifications.ts     ← Daily notification logic
```

## Tips
- Long-press a workout or exercise to delete it
- Export your data regularly via Settings as a backup
- The daily reminder time can be changed anytime in Settings
