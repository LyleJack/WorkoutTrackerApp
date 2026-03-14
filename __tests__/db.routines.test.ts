/**
 * Routine CRUD and pause/resume tests.
 */
import { __resetDb } from '../__mocks__/expo-sqlite';
import AsyncStorage from '../__mocks__/async-storage';

import {
  initDB,
  addWorkout,
  createRoutine, getRoutine, getRoutineDays, deleteRoutine,
  getRoutineProgress, updateRoutineProgress, clearRoutineProgress,
  pauseRoutine, resumeRoutine, isRoutinePaused,
} from '../src/db';

beforeEach(() => {
  __resetDb();
  AsyncStorage.__reset();
  initDB();
});

// ─── createRoutine / getRoutine ───────────────────────────────────────────────

describe('createRoutine / getRoutine', () => {
  test('getRoutine returns null when no routine exists', () => {
    expect(getRoutine()).toBeNull();
  });

  test('createRoutine creates a routine and getRoutine returns it', () => {
    const w = addWorkout('Push');
    createRoutine('My Routine', 'repeating', [
      { day_index: 0, workout_id: w, is_rest: 0, day_of_week: null },
    ]);
    const r = getRoutine();
    expect(r).not.toBeNull();
    expect(r?.name).toBe('My Routine');
    expect(r?.type).toBe('repeating');
  });

  test('createRoutine replaces the existing routine', () => {
    const w = addWorkout('Push');
    createRoutine('Old Routine', 'repeating', [
      { day_index: 0, workout_id: w, is_rest: 0, day_of_week: null },
    ]);
    createRoutine('New Routine', 'weekly', [
      { day_index: 0, workout_id: w, is_rest: 0, day_of_week: 1 },
    ]);
    const r = getRoutine();
    expect(r?.name).toBe('New Routine');
    expect(r?.type).toBe('weekly');
  });
});

describe('getRoutineDays', () => {
  test('returns days in day_index order', () => {
    const w1 = addWorkout('Push');
    const w2 = addWorkout('Pull');
    const w3 = addWorkout('Legs');
    createRoutine('PPL', 'repeating', [
      { day_index: 0, workout_id: w1, is_rest: 0, day_of_week: null },
      { day_index: 1, workout_id: w2, is_rest: 0, day_of_week: null },
      { day_index: 2, workout_id: w3, is_rest: 0, day_of_week: null },
    ]);
    const r    = getRoutine()!;
    const days = getRoutineDays(r.id);
    expect(days.length).toBe(3);
    expect(days[0].day_index).toBe(0);
    expect(days[1].day_index).toBe(1);
    expect(days[2].day_index).toBe(2);
  });

  test('rest days have is_rest=1 and no workout_id', () => {
    const w = addWorkout('Push');
    createRoutine('Push + Rest', 'repeating', [
      { day_index: 0, workout_id: w,    is_rest: 0, day_of_week: null },
      { day_index: 1, workout_id: null, is_rest: 1, day_of_week: null },
    ]);
    const r    = getRoutine()!;
    const days = getRoutineDays(r.id);
    expect(days[1].is_rest).toBe(1);
    expect(days[1].workout_id).toBeNull();
  });

  test('includes workout_name joined from workouts table', () => {
    const w = addWorkout('Push');
    createRoutine('Test', 'repeating', [
      { day_index: 0, workout_id: w, is_rest: 0, day_of_week: null },
    ]);
    const r    = getRoutine()!;
    const days = getRoutineDays(r.id);
    expect(days[0].workout_name).toBe('Push');
  });
});

describe('deleteRoutine', () => {
  test('getRoutine returns null after deleteRoutine', () => {
    const w = addWorkout('Push');
    createRoutine('Test', 'repeating', [
      { day_index: 0, workout_id: w, is_rest: 0, day_of_week: null },
    ]);
    deleteRoutine();
    expect(getRoutine()).toBeNull();
  });
});

// ─── Routine progress ─────────────────────────────────────────────────────────

describe('updateRoutineProgress / getRoutineProgress / clearRoutineProgress', () => {
  test('getRoutineProgress returns 0 when no progress set', async () => {
    expect(await getRoutineProgress()).toBe(0);
  });

  test('updateRoutineProgress / getRoutineProgress round-trip', async () => {
    updateRoutineProgress(3);
    expect(await getRoutineProgress()).toBe(3);
  });

  test('clearRoutineProgress resets to 0', async () => {
    updateRoutineProgress(5);
    await clearRoutineProgress();
    expect(await getRoutineProgress()).toBe(0);
  });

  test('progress advances correctly through repeating routine', async () => {
    const w = addWorkout('Push');
    createRoutine('3-Day', 'repeating', [
      { day_index: 0, workout_id: w, is_rest: 0, day_of_week: null },
      { day_index: 1, workout_id: w, is_rest: 0, day_of_week: null },
      { day_index: 2, workout_id: w, is_rest: 0, day_of_week: null },
    ]);
    // Simulate 4 completions — should wrap around
    for (let i = 0; i < 4; i++) {
      const cur = await getRoutineProgress();
      const r   = getRoutine()!;
      const days = getRoutineDays(r.id);
      const next = (cur + 1) % days.length;
      updateRoutineProgress(next);
    }
    // After 4 completions of a 3-day routine: 0→1→2→0→1
    expect(await getRoutineProgress()).toBe(1);
  });
});

// ─── Pause / resume ───────────────────────────────────────────────────────────

describe('pauseRoutine / resumeRoutine / isRoutinePaused', () => {
  test('isRoutinePaused returns false by default', async () => {
    expect(await isRoutinePaused()).toBe(false);
  });

  test('pauseRoutine causes isRoutinePaused to return true', async () => {
    await pauseRoutine();
    expect(await isRoutinePaused()).toBe(true);
  });

  test('resumeRoutine causes isRoutinePaused to return false', async () => {
    await pauseRoutine();
    await resumeRoutine();
    expect(await isRoutinePaused()).toBe(false);
  });

  test('multiple pause calls remain paused', async () => {
    await pauseRoutine();
    await pauseRoutine();
    expect(await isRoutinePaused()).toBe(true);
  });

  test('resuming without pausing remains unpaused', async () => {
    await resumeRoutine();
    expect(await isRoutinePaused()).toBe(false);
  });
});
