/**
 * Workout & Exercise CRUD tests.
 * Uses the better-sqlite3 in-memory mock so all SQL is real.
 */
import { __resetDb } from '../__mocks__/expo-sqlite';
import AsyncStorage from '../__mocks__/async-storage';

// Import after mocks are registered by jest moduleNameMapper
import {
  initDB,
  addWorkout, getWorkouts, deleteWorkout, getUniqueWorkoutNames,
  addExercise, getExercises, getHiddenExercises,
  hideExercise, unhideExercise, deleteExercise, reorderExercises,
} from '../src/db';

beforeEach(() => {
  __resetDb();
  AsyncStorage.__reset();
  initDB();
});

// ─── Workouts ─────────────────────────────────────────────────────────────────

describe('addWorkout / getWorkouts', () => {
  test('addWorkout returns a positive integer ID', () => {
    const id = addWorkout('Push');
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  test('added workout appears in getWorkouts', () => {
    addWorkout('Push');
    const workouts = getWorkouts();
    const names = workouts.map(w => w.name);
    expect(names).toContain('Push');
  });

  test('multiple workouts all appear', () => {
    addWorkout('Push');
    addWorkout('Pull');
    addWorkout('Legs');
    const names = getWorkouts().map(w => w.name);
    expect(names).toContain('Push');
    expect(names).toContain('Pull');
    expect(names).toContain('Legs');
  });

  test('duplicate workout names are allowed', () => {
    addWorkout('Push');
    addWorkout('Push');
    const pushWorkouts = getWorkouts().filter(w => w.name === 'Push');
    expect(pushWorkouts.length).toBe(2);
  });

  test('is_cardio is 0 by default for regular workouts', () => {
    const id = addWorkout('Push');
    const w = getWorkouts().find(w => w.id === id);
    expect(w?.is_cardio).toBe(0);
  });

  test('initDB creates the Cardio workout with is_cardio=1', () => {
    const cardio = getWorkouts().find(w => w.is_cardio === 1);
    expect(cardio).toBeTruthy();
    expect(cardio?.name).toBe('Cardio');
  });
});

describe('deleteWorkout', () => {
  test('deleted workout no longer appears in getWorkouts', () => {
    const id = addWorkout('Push');
    deleteWorkout(id);
    const names = getWorkouts().map(w => w.name);
    expect(names).not.toContain('Push');
  });
});

describe('getUniqueWorkoutNames', () => {
  test('excludes the Cardio workout', () => {
    addWorkout('Push');
    const names = getUniqueWorkoutNames();
    expect(names).not.toContain('Cardio');
  });

  test('deduplicates same-named workouts case-insensitively', () => {
    addWorkout('push');
    addWorkout('Push');
    addWorkout('PUSH');
    const names = getUniqueWorkoutNames();
    const pushEntries = names.filter(n => n.toLowerCase() === 'push');
    expect(pushEntries.length).toBe(1);
  });
});

// ─── Exercises ────────────────────────────────────────────────────────────────

describe('addExercise / getExercises', () => {
  test('addExercise returns a positive integer ID', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    expect(eId).toBeGreaterThan(0);
  });

  test('exercise appears in getExercises for its workout', () => {
    const wId = addWorkout('Push');
    addExercise(wId, 'Bench Press');
    const exercises = getExercises(wId);
    expect(exercises.map(e => e.name)).toContain('Bench Press');
  });

  test('exercises are scoped to their workout', () => {
    const w1 = addWorkout('Push');
    const w2 = addWorkout('Pull');
    addExercise(w1, 'Bench Press');
    addExercise(w2, 'Pull Up');
    expect(getExercises(w1).map(e => e.name)).not.toContain('Pull Up');
    expect(getExercises(w2).map(e => e.name)).not.toContain('Bench Press');
  });

  test('is_hidden defaults to 0', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const ex = getExercises(wId).find(e => e.id === eId);
    expect(ex?.is_hidden).toBe(0);
  });
});

describe('hideExercise / unhideExercise / getHiddenExercises', () => {
  test('hidden exercise disappears from getExercises', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    hideExercise(eId);
    expect(getExercises(wId).map(e => e.id)).not.toContain(eId);
  });

  test('hidden exercise appears in getHiddenExercises', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    hideExercise(eId);
    expect(getHiddenExercises(wId).map(e => e.id)).toContain(eId);
  });

  test('unhideExercise restores exercise to getExercises', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    hideExercise(eId);
    unhideExercise(eId);
    expect(getExercises(wId).map(e => e.id)).toContain(eId);
    expect(getHiddenExercises(wId).map(e => e.id)).not.toContain(eId);
  });
});

describe('deleteExercise', () => {
  test('deleted exercise no longer appears', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    deleteExercise(eId);
    expect(getExercises(wId).map(e => e.id)).not.toContain(eId);
  });
});

describe('reorderExercises', () => {
  test('updates sort_order to match provided array order', () => {
    const wId = addWorkout('Push');
    const e1 = addExercise(wId, 'A');
    const e2 = addExercise(wId, 'B');
    const e3 = addExercise(wId, 'C');
    // Reverse order
    reorderExercises([e3, e2, e1]);
    const exercises = getExercises(wId);
    expect(exercises[0].id).toBe(e3);
    expect(exercises[1].id).toBe(e2);
    expect(exercises[2].id).toBe(e1);
  });
});
