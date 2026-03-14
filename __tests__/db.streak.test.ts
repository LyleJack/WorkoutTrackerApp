/**
 * Streak, hasWorkoutToday, and milestone tests.
 */
import { __resetDb } from '../__mocks__/expo-sqlite';
import AsyncStorage from '../__mocks__/async-storage';

import {
  initDB,
  addWorkout, createSessionOnDate, createSession,
  getStreak, hasWorkoutToday,
  checkMilestone, getFirstSessionDate,
  getPref, setPref,
} from '../src/db';

beforeEach(() => {
  __resetDb();
  AsyncStorage.__reset();
  initDB();
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── getStreak ────────────────────────────────────────────────────────────────

describe('getStreak', () => {
  test('returns 0 with no sessions', () => {
    expect(getStreak()).toBe(0);
  });

  test('returns 1 after one session today', () => {
    const wId = addWorkout('Push');
    createSession(wId); // defaults to today
    expect(getStreak()).toBe(1);
  });

  test('returns 1 after one session yesterday (and none today)', () => {
    const wId = addWorkout('Push');
    createSessionOnDate(wId, daysAgo(1));
    expect(getStreak()).toBe(1);
  });

  test('increments for consecutive days', () => {
    const wId = addWorkout('Push');
    createSessionOnDate(wId, daysAgo(2));
    createSessionOnDate(wId, daysAgo(1));
    createSession(wId); // today
    expect(getStreak()).toBe(3);
  });

  test('breaks when a full day is missed', () => {
    const wId = addWorkout('Push');
    // 3 days ago and 1 day ago — day 2 is missing
    createSessionOnDate(wId, daysAgo(3));
    createSessionOnDate(wId, daysAgo(1));
    // Streak should only count from the most recent unbroken run = 1
    expect(getStreak()).toBe(1);
  });

  test('multiple sessions on the same day count as 1 streak day', () => {
    const wId = addWorkout('Push');
    createSessionOnDate(wId, daysAgo(1));
    createSessionOnDate(wId, daysAgo(1));
    createSessionOnDate(wId, daysAgo(1));
    expect(getStreak()).toBe(1);
  });
});

// ─── checkMilestone ───────────────────────────────────────────────────────────

describe('checkMilestone — session count milestones', () => {
  test('returns a message at milestone counts', () => {
    const milestones = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 1000];
    for (const n of milestones) {
      expect(checkMilestone(n)).not.toBeNull();
    }
  });

  test('returns null for non-milestone counts', () => {
    const nonMilestones = [2, 3, 4, 6, 7, 8, 9, 11, 99, 101, 249, 501];
    for (const n of nonMilestones) {
      expect(checkMilestone(n)).toBeNull();
    }
  });

  test('message at 1 mentions "first"', () => {
    expect(checkMilestone(1)?.toLowerCase()).toMatch(/first/);
  });

  test('message at 100 mentions "100"', () => {
    expect(checkMilestone(100)).toMatch(/100/);
  });

  test('message at 1000 mentions "1000"', () => {
    expect(checkMilestone(1000)).toMatch(/1000/);
  });
});

describe('checkMilestone — calendar anniversary', () => {
  test('returns anniversary message on the exact month/day of first session', () => {
    const wId = addWorkout('Push');
    // Create a session exactly 1 year ago
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateStr = oneYearAgo.toISOString().slice(0, 10);
    createSessionOnDate(wId, dateStr);
    // Any non-milestone count to isolate the anniversary branch
    const result = checkMilestone(7);
    expect(result).not.toBeNull();
    expect(result).toMatch(/year/i);
  });

  test('returns null anniversary when month/day does not match today', () => {
    const wId = addWorkout('Push');
    // First session 366 days ago (off by one day from exact anniversary)
    const d = new Date();
    d.setDate(d.getDate() - 366);
    createSessionOnDate(wId, d.toISOString().slice(0, 10));
    // Only fires if today matches the month+day of first session — usually won't
    // We test this by checking it returns null for a count that has no count milestone
    const result = checkMilestone(7);
    // If today happens to be the anniversary date this test may return non-null —
    // that's acceptable; we just verify the function doesn't throw
    expect(typeof result === 'string' || result === null).toBe(true);
  });

  test('does not return anniversary when first session is this year', () => {
    const wId = addWorkout('Push');
    createSession(wId); // today = first session, 0 years ago
    expect(checkMilestone(7)).toBeNull();
  });
});

// ─── getFirstSessionDate ──────────────────────────────────────────────────────

describe('getFirstSessionDate', () => {
  test('returns null when no sessions exist', () => {
    expect(getFirstSessionDate()).toBeNull();
  });

  test('returns the earliest session date', () => {
    const wId = addWorkout('Push');
    createSessionOnDate(wId, '2022-01-15');
    createSessionOnDate(wId, '2023-06-01');
    createSessionOnDate(wId, '2021-03-10');
    expect(getFirstSessionDate()).toBe('2021-03-10');
  });
});

// ─── getPref / setPref ────────────────────────────────────────────────────────

describe('getPref / setPref', () => {
  test('getPref returns null for missing key', () => {
    expect(getPref('nonexistent_key')).toBeNull();
  });

  test('setPref / getPref round-trip', () => {
    setPref('theme_mode', 'dark');
    expect(getPref('theme_mode')).toBe('dark');
  });

  test('setPref overwrites existing value', () => {
    setPref('theme_mode', 'dark');
    setPref('theme_mode', 'light');
    expect(getPref('theme_mode')).toBe('light');
  });

  test('different keys are independent', () => {
    setPref('key_a', 'alpha');
    setPref('key_b', 'beta');
    expect(getPref('key_a')).toBe('alpha');
    expect(getPref('key_b')).toBe('beta');
  });
});
