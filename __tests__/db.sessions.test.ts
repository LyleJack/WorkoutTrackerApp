/**
 * Session, Set, and combine-session tests.
 */
import { __resetDb } from '../__mocks__/expo-sqlite';
import AsyncStorage from '../__mocks__/async-storage';

import {
  initDB,
  addWorkout, addExercise,
  createSession, createSessionOnDate, deleteSession,
  getSessionsForWorkout, saveSessionDuration,
  addSet, getSetsForSession, updateSetFull, deleteSet, getLastSetForExercise,
  combineSessions,
  hasWorkoutToday, getTotalWorkouts, getTotalSets, getTotalVolume,
  getRecentSession, saveLastSessionTime, clearLastSession,
} from '../src/db';

beforeEach(() => {
  __resetDb();
  AsyncStorage.__reset();
  initDB();
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

describe('createSession', () => {
  test('returns a positive integer ID', () => {
    const wId = addWorkout('Push');
    const sId = createSession(wId);
    expect(sId).toBeGreaterThan(0);
  });

  test('session appears in getSessionsForWorkout', () => {
    const wId = addWorkout('Push');
    const sId = createSession(wId);
    const sessions = getSessionsForWorkout(wId);
    expect(sessions.map(s => s.id)).toContain(sId);
  });

  test('multiple sessions accumulate for the same workout', () => {
    const wId = addWorkout('Push');
    createSession(wId);
    createSession(wId);
    expect(getSessionsForWorkout(wId).length).toBe(2);
  });
});

describe('createSessionOnDate', () => {
  test('session is created with the specified date string', () => {
    const wId = addWorkout('Push');
    createSessionOnDate(wId, '2023-06-15');
    const sessions = getSessionsForWorkout(wId);
    expect(sessions[0].date).toBe('2023-06-15');
  });
});

describe('deleteSession', () => {
  test('session no longer appears after deletion', () => {
    const wId = addWorkout('Push');
    const sId = createSession(wId);
    deleteSession(sId);
    expect(getSessionsForWorkout(wId).map(s => s.id)).not.toContain(sId);
  });

  test('deleting a session also removes its sets (cascade)', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSession(wId);
    addSet(sId, eId, 100, 5, 1);
    deleteSession(sId);
    expect(getSetsForSession(sId).length).toBe(0);
  });
});

describe('saveSessionDuration', () => {
  test('duration is persisted and retrievable', () => {
    const wId = addWorkout('Push');
    const sId = createSession(wId);
    saveSessionDuration(sId, 3600);
    const sessions = getSessionsForWorkout(wId);
    const s = sessions.find(s => s.id === sId);
    expect(s?.duration_seconds).toBe(3600);
  });
});

// ─── Sets ─────────────────────────────────────────────────────────────────────

describe('addSet / getSetsForSession', () => {
  test('set appears in getSetsForSession', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSession(wId);
    addSet(sId, eId, 100, 8, 1);
    const sets = getSetsForSession(sId);
    expect(sets.length).toBe(1);
    expect(sets[0].weight).toBe(100);
    expect(sets[0].reps).toBe(8);
  });

  test('multiple sets accumulate', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSession(wId);
    addSet(sId, eId, 100, 8, 1);
    addSet(sId, eId, 105, 6, 2);
    addSet(sId, eId, 110, 4, 3);
    expect(getSetsForSession(sId).length).toBe(3);
  });

  test('sets are scoped to their session', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const s1 = createSession(wId);
    const s2 = createSession(wId);
    addSet(s1, eId, 100, 8, 1);
    addSet(s2, eId, 80, 10, 1);
    expect(getSetsForSession(s1).length).toBe(1);
    expect(getSetsForSession(s2).length).toBe(1);
  });

  test('bodyweight sets have weight=0', () => {
    const wId = addWorkout('Pull');
    const eId = addExercise(wId, 'Pull Up');
    const sId = createSession(wId);
    addSet(sId, eId, 0, 10, 1);
    const sets = getSetsForSession(sId);
    expect(sets[0].weight).toBe(0);
  });
});

describe('updateSetFull', () => {
  test('updates weight, reps, and comment', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSession(wId);
    const setId = addSet(sId, eId, 100, 8, 1);
    updateSetFull(setId, 110, 6, 'felt strong');
    const sets = getSetsForSession(sId);
    expect(sets[0].weight).toBe(110);
    expect(sets[0].reps).toBe(6);
    expect(sets[0].comment).toBe('felt strong');
  });
});

describe('deleteSet', () => {
  test('deleted set no longer appears', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSession(wId);
    const setId = addSet(sId, eId, 100, 8, 1);
    deleteSet(setId);
    expect(getSetsForSession(sId).length).toBe(0);
  });

  test('other sets in the same session are unaffected', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSession(wId);
    const s1 = addSet(sId, eId, 100, 8, 1);
    addSet(sId, eId, 105, 6, 2);
    deleteSet(s1);
    expect(getSetsForSession(sId).length).toBe(1);
    expect(getSetsForSession(sId)[0].weight).toBe(105);
  });
});

describe('getLastSetForExercise', () => {
  test('returns null when no sets have been logged', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    expect(getLastSetForExercise(eId)).toBeNull();
  });

  test('returns the most recently added set for the exercise', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const sId = createSession(wId);
    addSet(sId, eId, 100, 8, 1);
    addSet(sId, eId, 110, 6, 2);
    const last = getLastSetForExercise(eId);
    expect(last?.weight).toBe(110);
  });
});

// ─── Combine sessions ─────────────────────────────────────────────────────────

describe('combineSessions', () => {
  test('returns true when workouts match', () => {
    const wId = addWorkout('Push');
    const s1 = createSession(wId);
    const s2 = createSession(wId);
    expect(combineSessions(s1, s2)).toBe(true);
  });

  test('returns false when workout IDs differ', () => {
    const w1 = addWorkout('Push');
    const w2 = addWorkout('Pull');
    const s1 = createSession(w1);
    const s2 = createSession(w2);
    expect(combineSessions(s1, s2)).toBe(false);
  });

  test('all sets from removed session appear under keep session', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench Press');
    const s1  = createSession(wId);
    const s2  = createSession(wId);
    addSet(s1, eId, 100, 8, 1);
    addSet(s2, eId, 80,  10, 1);
    combineSessions(s1, s2);
    expect(getSetsForSession(s1).length).toBe(2);
  });

  test('removed session no longer exists after combine', () => {
    const wId = addWorkout('Push');
    const s1  = createSession(wId);
    const s2  = createSession(wId);
    combineSessions(s1, s2);
    // s2 should be gone
    expect(getSessionsForWorkout(wId).map(s => s.id)).not.toContain(s2);
  });

  test('duration_seconds are summed on keep session', () => {
    const wId = addWorkout('Push');
    const s1  = createSession(wId);
    const s2  = createSession(wId);
    saveSessionDuration(s1, 1800);
    saveSessionDuration(s2, 900);
    combineSessions(s1, s2);
    const sessions = getSessionsForWorkout(wId);
    const kept = sessions.find(s => s.id === s1);
    expect(kept?.duration_seconds).toBe(2700);
  });

  test('duration sums correctly when one session has no duration', () => {
    const wId = addWorkout('Push');
    const s1  = createSession(wId);
    const s2  = createSession(wId);
    saveSessionDuration(s1, 1200);
    // s2 has no duration_seconds set
    combineSessions(s1, s2);
    const kept = getSessionsForWorkout(wId).find(s => s.id === s1);
    expect(kept?.duration_seconds).toBe(1200);
  });
});

// ─── Aggregate stats ──────────────────────────────────────────────────────────

describe('getTotalWorkouts / getTotalSets / getTotalVolume', () => {
  test('getTotalWorkouts counts sessions (not workout definitions)', () => {
    const wId = addWorkout('Push');
    expect(getTotalWorkouts()).toBe(0);
    createSession(wId);
    expect(getTotalWorkouts()).toBe(1);
    createSession(wId);
    expect(getTotalWorkouts()).toBe(2);
  });

  test('getTotalSets counts all sets across all sessions', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench');
    const sId = createSession(wId);
    expect(getTotalSets()).toBe(0);
    addSet(sId, eId, 100, 5, 1);
    addSet(sId, eId, 100, 5, 2);
    expect(getTotalSets()).toBe(2);
  });

  test('getTotalVolume is sum of weight × reps across all sets', () => {
    const wId = addWorkout('Push');
    const eId = addExercise(wId, 'Bench');
    const sId = createSession(wId);
    addSet(sId, eId, 100, 5, 1); // 500
    addSet(sId, eId, 80,  8, 2); // 640
    expect(getTotalVolume()).toBe(1140);
  });

  test('getTotalVolume excludes bodyweight sets (weight=0)', () => {
    const wId = addWorkout('Pull');
    const eId = addExercise(wId, 'Pull Up');
    const sId = createSession(wId);
    addSet(sId, eId, 0, 10, 1);
    expect(getTotalVolume()).toBe(0);
  });
});

// ─── hasWorkoutToday ──────────────────────────────────────────────────────────

describe('hasWorkoutToday', () => {
  test('returns false when no sessions exist', () => {
    expect(hasWorkoutToday()).toBe(false);
  });

  test('returns true after creating a session (which defaults to today)', () => {
    const wId = addWorkout('Push');
    createSession(wId);
    expect(hasWorkoutToday()).toBe(true);
  });

  test('returns false when only past sessions exist', () => {
    const wId = addWorkout('Push');
    createSessionOnDate(wId, '2020-01-01');
    expect(hasWorkoutToday()).toBe(false);
  });
});

// ─── getRecentSession ─────────────────────────────────────────────────────────

describe('getRecentSession', () => {
  test('returns null when AsyncStorage is empty', async () => {
    expect(await getRecentSession()).toBeNull();
  });

  test('returns null when the referenced session has been deleted from the DB', async () => {
    const wId = addWorkout('Push');
    const sId = createSession(wId);
    // Simulate what the app does when starting a session
    await saveLastSessionTime(sId, wId, 'Push', 0, false);
    // Now delete the session (simulates "deleted from history")
    deleteSession(sId);
    expect(await getRecentSession()).toBeNull();
  });

  test('returns null when the entry is older than 15 minutes', async () => {
    const wId = addWorkout('Push');
    const sId = createSession(wId);
    // Manually write a stale timestamp
    const stale = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    AsyncStorage.__store['last_session_info'] = JSON.stringify({
      session_id: sId, workout_id: wId, workout_name: 'Push',
      finished_at: stale, is_cardio: 0, finished: false,
    });
    expect(await getRecentSession()).toBeNull();
  });

  test('returns the session when it exists in DB and is within 15 minutes', async () => {
    const wId = addWorkout('Push');
    const sId = createSession(wId);
    await saveLastSessionTime(sId, wId, 'Push', 0, false);
    const result = await getRecentSession();
    expect(result).not.toBeNull();
    expect(result?.session_id).toBe(sId);
  });

  test('clearLastSession causes getRecentSession to return null', async () => {
    const wId = addWorkout('Push');
    const sId = createSession(wId);
    await saveLastSessionTime(sId, wId, 'Push', 0, false);
    await clearLastSession();
    expect(await getRecentSession()).toBeNull();
  });
});
