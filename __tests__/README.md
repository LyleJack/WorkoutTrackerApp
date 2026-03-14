# Tests

## Stack

- **Jest** + **ts-jest** — test runner and TypeScript support
- **better-sqlite3** — real in-memory SQLite so tests run actual SQL, not stubs
- All Expo / React Native modules are mocked in `__mocks__/`

## Running

```bash
# Install deps first (only needed once)
npm install --legacy-peer-deps

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Structure

```
__tests__/
  utils.test.ts        — formatDuration, formatVolume, formatSessionDate, todayISO, clamp
  db.workouts.test.ts  — Workout/Exercise CRUD, hide/unhide, reorder
  db.sessions.test.ts  — Sessions, Sets, combineSessions, getRecentSession, aggregate stats
  db.streak.test.ts    — Streak logic, milestones, getFirstSessionDate, getPref/setPref
  db.progress.test.ts  — Exercise progress, cross-workout combining, personal bests
  db.routines.test.ts  — Routine CRUD, progress tracking, pause/resume

__mocks__/
  expo-sqlite.ts       — better-sqlite3 in-memory adapter (real SQL, resets between tests)
  async-storage.ts     — in-memory key-value store
  expo-constants.ts    — minimal stub
  react-native.ts      — Platform, Dimensions, Alert stubs
  ...                  — other Expo module stubs
```

## Design decisions

- **Real SQL, not mocks** — the SQLite mock uses better-sqlite3 so tests exercise actual
  query logic. A stub returning fake data would miss JOIN errors, missing columns, etc.
- **DB resets between tests** — `__resetDb()` closes and recreates the in-memory DB in
  `beforeEach`, so tests are fully isolated with no shared state.
- **AsyncStorage resets** — `AsyncStorage.__reset()` clears the in-memory store in
  `beforeEach` for the same reason.
- **No component tests** — React Native component testing is fragile with Expo and adds
  little confidence vs. the cost. The DB and utility tests cover the logic that matters.
- **`diagnostics: false` in ts-jest** — suppresses TypeScript type errors in tests so
  we focus on runtime behaviour rather than type completeness.
