import { formatDuration, formatVolume, formatSessionDate, todayISO, clamp } from '../src/utils';

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  test('0 or negative seconds → "0s"', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(-10)).toBe('0s');
  });

  test('seconds only (< 60)', () => {
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(59)).toBe('59s');
    expect(formatDuration(30)).toBe('30s');
  });

  test('exactly 60 seconds → "1m"', () => {
    expect(formatDuration(60)).toBe('1m');
  });

  test('minutes with remainder seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(61)).toBe('1m 1s');
    expect(formatDuration(119)).toBe('1m 59s');
  });

  test('minutes only (no remainder seconds)', () => {
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(300)).toBe('5m');
  });

  test('exactly 1 hour', () => {
    expect(formatDuration(3600)).toBe('1h');
  });

  test('hours with remainder minutes', () => {
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(7200 + 300)).toBe('2h 5m');
  });

  test('hours only (no remainder minutes)', () => {
    expect(formatDuration(7200)).toBe('2h');
  });

  test('seconds remainder is dropped when >= 1 hour (shows h+m only)', () => {
    // 1h 1m 30s — the 30s is dropped since format only shows h and m
    expect(formatDuration(3690)).toBe('1h 1m');
  });
});

// ─── formatVolume ─────────────────────────────────────────────────────────────

describe('formatVolume', () => {
  test('values under 1000 shown as rounded integer', () => {
    expect(formatVolume(0)).toBe('0');
    expect(formatVolume(500)).toBe('500');
    expect(formatVolume(999)).toBe('999');
  });

  test('values >= 1000 shown as k with 1 decimal', () => {
    expect(formatVolume(1000)).toBe('1.0k');
    expect(formatVolume(1500)).toBe('1.5k');
    expect(formatVolume(999999)).toBe('1000.0k');
  });

  test('values >= 1,000,000 shown as M with 1 decimal', () => {
    expect(formatVolume(1_000_000)).toBe('1.0M');
    expect(formatVolume(2_500_000)).toBe('2.5M');
  });

  test('fractional kg rounds correctly under 1000', () => {
    expect(formatVolume(100.6)).toBe('101');
    expect(formatVolume(100.4)).toBe('100');
  });
});

// ─── formatSessionDate ────────────────────────────────────────────────────────

describe('formatSessionDate', () => {
  test('returns a non-empty string for any valid date', () => {
    expect(formatSessionDate('2024-01-15')).toBeTruthy();
    expect(typeof formatSessionDate('2024-06-01')).toBe('string');
  });

  test('includes the numeric day in the result', () => {
    // Day 15 should appear somewhere in the formatted string
    expect(formatSessionDate('2024-01-15')).toMatch(/15/);
  });
});

// ─── todayISO ─────────────────────────────────────────────────────────────────

describe('todayISO', () => {
  test('returns a string in YYYY-MM-DD format', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('matches native Date ISO slice', () => {
    expect(todayISO()).toBe(new Date().toISOString().slice(0, 10));
  });
});

// ─── clamp ────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  test('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  test('clamps to min when below', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(-100, 5, 20)).toBe(5);
  });

  test('clamps to max when above', () => {
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(1000, 0, 100)).toBe(100);
  });

  test('min === max returns that value', () => {
    expect(clamp(0, 5, 5)).toBe(5);
    expect(clamp(10, 5, 5)).toBe(5);
  });
});
