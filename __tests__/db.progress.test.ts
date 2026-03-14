/**
 * Progress, personal bests, and cross-workout exercise combining tests.
 */
import { __resetDb } from '../__mocks__/expo-sqlite';
import AsyncStorage from '../__mocks__/async-storage';

import {
  initDB,
  addWorkout, addExercise, createSessionOnDate,
  addSet,
  getExerciseProgress, getExerciseProgressGlobal, getAllExerciseNames,
  getExerciseBest, getExerciseTotalVolume, getBestWorkoutDayVolume,
  getPersonalBests,
} from '../src/db';

beforeEach(() => {
  __resetDb();
  AsyncStorage.__reset();
  initDB();
});

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── getExerciseProgress ──────────────────────────────────────────────────────

describe('getExerciseProgress', () => {
  test('returns empty array for exercise with no sets', () => {
    expect(getExerciseProgress('Bench Press')).toEqual([]);
  });

  test('groups sets by date — one point per date', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const s1  = createSessionOnDate(wId, daysAgo(2));
    const s2  = createSessionOnDate(wId, daysAgo(1));
    addSet(s1, eId, 100, 5, 1);
    addSet(s2, eId, 105, 5, 1);
    const progress = getExerciseProgress('Bench Press');
    expect(progress.length).toBe(2);
  });

  test('returns max weight per date when multiple sets exist', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSessionOnDate(wId, daysAgo(1));
    addSet(sId, eId, 80,  8, 1);
    addSet(sId, eId, 100, 5, 2);
    addSet(sId, eId, 90,  6, 3);
    const progress = getExerciseProgress('Bench Press');
    expect(progress[0].weight).toBe(100);
  });

  test('is case-insensitive — "bench press" matches "Bench Press"', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSessionOnDate(wId, daysAgo(1));
    addSet(sId, eId, 100, 5, 1);
    expect(getExerciseProgress('bench press').length).toBe(1);
  });

  test('results are sorted by date ascending', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const s1  = createSessionOnDate(wId, daysAgo(3));
    const s2  = createSessionOnDate(wId, daysAgo(1));
    addSet(s1, eId, 80, 5, 1);
    addSet(s2, eId, 90, 5, 1);
    const progress = getExerciseProgress('Bench Press');
    expect(new Date(progress[0].date) < new Date(progress[1].date)).toBe(true);
  });
});

// ─── getExerciseProgressGlobal ────────────────────────────────────────────────

describe('getExerciseProgressGlobal — cross-workout combining', () => {
  test('combines sets from different workouts with the same exercise name', () => {
    const w1 = addWorkout('Push A');
    const w2 = addWorkout('Push B');
    const e1 = addExercise(w1, 'Bench Press');
    const e2 = addExercise(w2, 'Bench Press'); // same name, different workout
    const s1 = createSessionOnDate(w1, daysAgo(2));
    const s2 = createSessionOnDate(w2, daysAgo(1));
    addSet(s1, e1, 100, 5, 1);
    addSet(s2, e2, 110, 5, 1);
    const progress = getExerciseProgressGlobal('Bench Press');
    expect(progress.length).toBe(2);
  });

  test('case-insensitive match across workouts', () => {
    const w1 = addWorkout('W1');
    const w2 = addWorkout('W2');
    const e1 = addExercise(w1, 'Seated Row');
    const e2 = addExercise(w2, 'seated row');
    const s1 = createSessionOnDate(w1, daysAgo(2));
    const s2 = createSessionOnDate(w2, daysAgo(1));
    addSet(s1, e1, 60, 10, 1);
    addSet(s2, e2, 70, 10, 1);
    const progress = getExerciseProgressGlobal('Seated Row');
    expect(progress.length).toBe(2);
  });
});

// ─── getAllExerciseNames ───────────────────────────────────────────────────────

describe('getAllExerciseNames', () => {
  test('returns empty array when no exercises have been logged', () => {
    // initDB seeds the cardio workout but no sets — so no exercise names from sets
    expect(getAllExerciseNames()).toEqual([]);
  });

  test('deduplicates case-insensitively', () => {
    const w1 = addWorkout('W1');
    const w2 = addWorkout('W2');
    const e1 = addExercise(w1, 'Bench Press');
    const e2 = addExercise(w2, 'bench press'); // same name, different case
    const s1 = createSessionOnDate(w1, daysAgo(1));
    const s2 = createSessionOnDate(w2, daysAgo(2));
    addSet(s1, e1, 100, 5, 1);
    addSet(s2, e2, 90,  5, 1);
    const names = getAllExerciseNames();
    const benchEntries = names.filter(n => n.toLowerCase() === 'bench press');
    expect(benchEntries.length).toBe(1);
  });

  test('returns names sorted alphabetically', () => {
    const wId = addWorkout('Push');
    const e1 = addExercise(wId, 'Tricep Pushdown');
    const e2 = addExercise(wId, 'Bench Press');
    const e3 = addExercise(wId, 'Lateral Raise');
    const sId = createSessionOnDate(wId, daysAgo(1));
    addSet(sId, e1, 30, 12, 1);
    addSet(sId, e2, 80, 8,  1);
    addSet(sId, e3, 10, 15, 1);
    const names = getAllExerciseNames();
    const sorted = [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    expect(names).toEqual(sorted);
  });
});

// ─── getExerciseBest ─────────────────────────────────────────────────────────

describe('getExerciseBest', () => {
  test('returns null for exercise with no sets', () => {
    expect(getExerciseBest('Nonexistent Exercise')).toBeNull();
  });

  test('returns max weight for a weighted exercise', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSessionOnDate(wId, daysAgo(1));
    addSet(sId, eId, 80,  8, 1);
    addSet(sId, eId, 100, 5, 2);
    addSet(sId, eId, 90,  6, 3);
    const best = getExerciseBest('Bench Press');
    expect(best?.weight).toBe(100);
    expect(best?.is_bw).toBe(false);
  });

  test('identifies bodyweight exercise (mostly weight=0)', () => {
    const wId = addWorkout('Pull');
    const eId = addExercise(wId, 'Pull Up');
    const sId = createSessionOnDate(wId, daysAgo(1));
    addSet(sId, eId, 0, 10, 1);
    addSet(sId, eId, 0, 8,  2);
    addSet(sId, eId, 0, 6,  3);
    const best = getExerciseBest('Pull Up');
    expect(best?.is_bw).toBe(true);
    expect(best?.reps).toBe(10); // max reps
  });

  test('identifies duration exercise', () => {
    const wId = addWorkout('Core');
    const eId = addExercise(wId, 'Plank');
    const sId = createSessionOnDate(wId, daysAgo(1));
    addSet(sId, eId, 0, 1, 1, undefined, 60);
    addSet(sId, eId, 0, 1, 2, undefined, 90);
    const best = getExerciseBest('Plank');
    expect(best?.is_duration).toBe(true);
    expect(best?.duration).toBe(90);
  });
});

// ─── getExerciseTotalVolume ───────────────────────────────────────────────────

describe('getExerciseTotalVolume', () => {
  test('returns total kg×reps for weighted exercise', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const s1  = createSessionOnDate(wId, daysAgo(2));
    const s2  = createSessionOnDate(wId, daysAgo(1));
    addSet(s1, eId, 100, 5, 1); // 500
    addSet(s2, eId, 80,  8, 1); // 640
    const vol = getExerciseTotalVolume('Bench Press');
    expect(vol.volume).toBe(1140);
    expect(vol.is_bw).toBe(false);
  });

  test('returns total reps for BW exercise', () => {
    const wId = addWorkout('Pull');
    const eId = addExercise(wId, 'Pull Up');
    const s1  = createSessionOnDate(wId, daysAgo(2));
    const s2  = createSessionOnDate(wId, daysAgo(1));
    addSet(s1, eId, 0, 10, 1);
    addSet(s2, eId, 0, 8,  1);
    const vol = getExerciseTotalVolume('Pull Up');
    expect(vol.reps).toBe(18);
    expect(vol.is_bw).toBe(true);
  });

  test('returns total duration seconds for timed exercise', () => {
    const wId = addWorkout('Core');
    const eId = addExercise(wId, 'Plank');
    const s1  = createSessionOnDate(wId, daysAgo(2));
    addSet(s1, eId, 0, 1, 1, undefined, 60);
    addSet(s1, eId, 0, 1, 2, undefined, 45);
    const vol = getExerciseTotalVolume('Plank');
    expect(vol.duration).toBe(105);
    expect(vol.is_duration).toBe(true);
  });
});

// ─── getBestWorkoutDayVolume ──────────────────────────────────────────────────

describe('getBestWorkoutDayVolume', () => {
  test('returns null for workout with no sessions', () => {
    addWorkout('Empty');
    expect(getBestWorkoutDayVolume('Empty')).toBeNull();
  });

  test('returns the session date with the highest volume', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const s1  = createSessionOnDate(wId, daysAgo(2));
    const s2  = createSessionOnDate(wId, daysAgo(1));
    addSet(s1, eId, 100, 5, 1); // 500
    addSet(s2, eId, 80,  10, 1); // 800 — higher
    const best = getBestWorkoutDayVolume('Push');
    expect(best?.volume).toBe(800);
    expect(best?.date).toBe(daysAgo(1));
  });
});

// ─── getPersonalBests ─────────────────────────────────────────────────────────

describe('getPersonalBests', () => {
  test('returns empty array when no sets logged', () => {
    expect(getPersonalBests()).toEqual([]);
  });

  test('returns max weight for weighted exercises', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSessionOnDate(wId, daysAgo(1));
    addSet(sId, eId, 80,  8, 1);
    addSet(sId, eId, 100, 5, 2);
    const pbs = getPersonalBests();
    const bench = pbs.find(p => p.exercise_name === 'Bench Press');
    expect(bench?.weight).toBe(100);
    expect(bench?.is_bw).toBe(0);
  });

  test('identifies bodyweight exercises (is_bw=1)', () => {
    const wId = addWorkout('Pull');
    const eId = addExercise(wId, 'Pull Up');
    const sId = createSessionOnDate(wId, daysAgo(1));
    addSet(sId, eId, 0, 10, 1);
    addSet(sId, eId, 0, 8,  2);
    const pbs = getPersonalBests();
    const pu = pbs.find(p => p.exercise_name === 'Pull Up');
    expect(pu?.is_bw).toBe(1);
    expect(pu?.max_reps).toBe(10);
  });

  test('identifies duration exercises (max_duration > 0)', () => {
    const wId = addWorkout('Core');
    const eId = addExercise(wId, 'Plank');
    const sId = createSessionOnDate(wId, daysAgo(1));
    addSet(sId, eId, 0, 1, 1, undefined, 90);
    const pbs = getPersonalBests();
    const plank = pbs.find(p => p.exercise_name === 'Plank');
    expect(plank?.max_duration).toBe(90);
  });

  test('deduplicates same-named exercises across workouts', () => {
    const w1 = addWorkout('W1');
    const w2 = addWorkout('W2');
    const e1 = addExercise(w1, 'Bench Press');
    const e2 = addExercise(w2, 'Bench Press');
    const s1 = createSessionOnDate(w1, daysAgo(2));
    const s2 = createSessionOnDate(w2, daysAgo(1));
    addSet(s1, e1, 100, 5, 1);
    addSet(s2, e2, 120, 3, 1);
    const pbs = getPersonalBests();
    const benches = pbs.filter(p => p.exercise_name.toLowerCase() === 'bench press');
    expect(benches.length).toBe(1);
    expect(benches[0].weight).toBe(120);
  });
});
