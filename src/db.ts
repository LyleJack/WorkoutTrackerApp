import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const db = SQLite.openDatabaseSync('workouttracker.db');

// ─── Schema ───────────────────────────────────────────────────────────────────

export function initDB() {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS workouts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      is_cardio  INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id       INTEGER NOT NULL,
      date             TEXT    DEFAULT (date('now')),
      created_at       TEXT    DEFAULT (datetime('now')),
      notes            TEXT,
      duration_seconds INTEGER,
      FOREIGN KEY (workout_id) REFERENCES workouts(id)
    );

    CREATE TABLE IF NOT EXISTS sets (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id       INTEGER NOT NULL,
      exercise_id      INTEGER NOT NULL,
      weight           REAL    DEFAULT 0,
      reps             INTEGER DEFAULT 0,
      set_number       INTEGER DEFAULT 1,
      comment          TEXT,
      duration_seconds INTEGER,
      FOREIGN KEY (session_id)  REFERENCES sessions(id)  ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    CREATE TABLE IF NOT EXISTS cardio_types (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS cardio_logs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id       INTEGER NOT NULL,
      cardio_type_id   INTEGER NOT NULL,
      duration_minutes REAL    NOT NULL,
      calories         INTEGER,
      distance_km      REAL,
      notes            TEXT,
      FOREIGN KEY (session_id)     REFERENCES sessions(id)     ON DELETE CASCADE,
      FOREIGN KEY (cardio_type_id) REFERENCES cardio_types(id)
    );

    CREATE TABLE IF NOT EXISTS prefs (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS routines (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'repeating',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routine_days (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id   INTEGER NOT NULL,
      day_index    INTEGER NOT NULL,
      workout_id   INTEGER,
      is_rest      INTEGER DEFAULT 0,
      day_of_week  INTEGER,
      FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE SET NULL
    );
  `);

  // Seed cardio types if table is empty
  const count = (db.getFirstSync('SELECT COUNT(*) as c FROM cardio_types') as any).c;
  if (count === 0) {
    for (const name of ['Treadmill', 'Cycling', 'Rowing', 'Elliptical', 'Swimming', 'Stairmaster']) {
      db.runSync('INSERT OR IGNORE INTO cardio_types (name) VALUES (?)', [name]);
    }
  }

  // Ensure the Cardio workout always exists
  const cardio = db.getFirstSync("SELECT id FROM workouts WHERE is_cardio = 1") as any;
  if (!cardio) {
    db.runSync("INSERT INTO workouts (name, is_cardio) VALUES ('Cardio', 1)");
  }

  // Migration: add is_hidden to exercises if missing
  try { db.execSync('ALTER TABLE exercises ADD COLUMN is_hidden INTEGER DEFAULT 0'); } catch {}
  // Migration: add is_rest and day_of_week to routine_days if missing (for existing installs)
  try { db.execSync('ALTER TABLE routine_days ADD COLUMN is_rest INTEGER DEFAULT 0'); } catch {}
  try { db.execSync('ALTER TABLE routine_days ADD COLUMN day_of_week INTEGER'); } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Workout     = { id: number; name: string; is_cardio: number; created_at: string };
export type Exercise    = { id: number; workout_id: number; name: string; sort_order: number; is_hidden: number };
export type Session     = { id: number; workout_id: number; date: string; notes?: string; duration_seconds?: number };
export type Set         = { id: number; session_id: number; exercise_id: number; weight: number; reps: number; set_number: number; comment?: string; duration_seconds?: number };
export type CardioType  = { id: number; name: string };
export type CardioLog   = { id: number; session_id: number; cardio_type_id: number; duration_minutes: number; calories?: number; distance_km?: number; notes?: string };
export type CardioLogFull = CardioLog & { cardio_type_name: string; date: string };

export type RoutineType = 'repeating' | 'weekly';
export type RoutineDay  = {
  id: number; routine_id: number; day_index: number;
  workout_id: number | null; is_rest: number; day_of_week: number | null;
};
export type Routine     = { id: number; name: string; type: RoutineType; created_at: string };

// ─── Workouts ─────────────────────────────────────────────────────────────────

export function getWorkouts(): Workout[] {
  return db.getAllSync('SELECT * FROM workouts ORDER BY is_cardio ASC, name ASC') as Workout[];
}
// Unique non-cardio workout names for progress tab deduplication
export function getUniqueWorkoutNames(): string[] {
  const rows = db.getAllSync(
    'SELECT name FROM workouts WHERE is_cardio = 0 GROUP BY LOWER(name) ORDER BY MIN(created_at) ASC'
  ) as { name: string }[];
  return rows.map(r => r.name);
}
export function addWorkout(name: string): number {
  return db.runSync('INSERT INTO workouts (name, is_cardio) VALUES (?, 0)', [name]).lastInsertRowId;
}
export function deleteWorkout(id: number) {
  db.runSync('DELETE FROM workouts WHERE id = ? AND is_cardio = 0', [id]);
}
export function getCardioWorkout(): Workout {
  return db.getFirstSync("SELECT * FROM workouts WHERE is_cardio = 1") as Workout;
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export function getExercises(workoutId: number): Exercise[] {
  return db.getAllSync(
    'SELECT * FROM exercises WHERE workout_id = ? AND (is_hidden IS NULL OR is_hidden = 0) ORDER BY sort_order ASC',
    [workoutId]
  ) as Exercise[];
}
export function getHiddenExercises(workoutId: number): Exercise[] {
  return db.getAllSync(
    'SELECT * FROM exercises WHERE workout_id = ? AND is_hidden = 1 ORDER BY name ASC',
    [workoutId]
  ) as Exercise[];
}
export function hideExercise(id: number) {
  db.runSync('UPDATE exercises SET is_hidden = 1 WHERE id = ?', [id]);
}
export function unhideExercise(id: number) {
  db.runSync('UPDATE exercises SET is_hidden = 0 WHERE id = ?', [id]);
}
export function addExercise(workoutId: number, name: string): number {
  const count = (db.getFirstSync('SELECT COUNT(*) as c FROM exercises WHERE workout_id = ?', [workoutId]) as any).c;
  return db.runSync('INSERT INTO exercises (workout_id, name, sort_order) VALUES (?, ?, ?)', [workoutId, name, count]).lastInsertRowId;
}
export function deleteExercise(id: number) {
  db.runSync('DELETE FROM exercises WHERE id = ?', [id]);
}
export function reorderExercises(orderedIds: number[]) {
  orderedIds.forEach((id, i) => db.runSync('UPDATE exercises SET sort_order = ? WHERE id = ?', [i, id]));
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function createSession(workoutId: number, notes?: string): number {
  return db.runSync('INSERT INTO sessions (workout_id, notes) VALUES (?, ?)', [workoutId, notes ?? null]).lastInsertRowId;
}
export function createSessionOnDate(workoutId: number, date: string, notes?: string): number {
  return db.runSync('INSERT INTO sessions (workout_id, date, notes) VALUES (?, ?, ?)', [workoutId, date, notes ?? null]).lastInsertRowId;
}
export function getSessionsForWorkout(workoutId: number): Session[] {
  return db.getAllSync('SELECT * FROM sessions WHERE workout_id = ? ORDER BY date DESC', [workoutId]) as Session[];
}
export function deleteSession(id: number) {
  db.runSync('DELETE FROM sets WHERE session_id = ?', [id]);
  db.runSync('DELETE FROM cardio_logs WHERE session_id = ?', [id]);
  db.runSync('DELETE FROM sessions WHERE id = ?', [id]);
}
export function updateSessionNotes(sessionId: number, notes: string) {
  db.runSync('UPDATE sessions SET notes = ? WHERE id = ?', [notes, sessionId]);
}
export function updateSessionDate(sessionId: number, date: string) {
  db.runSync('UPDATE sessions SET date = ? WHERE id = ?', [date, sessionId]);
}
export function saveSessionDuration(sessionId: number, durationSeconds: number) {
  db.runSync('UPDATE sessions SET duration_seconds = ? WHERE id = ?', [durationSeconds, sessionId]);
}

// ─── Sets ─────────────────────────────────────────────────────────────────────

export function getSetsForSession(sessionId: number): Set[] {
  return db.getAllSync('SELECT * FROM sets WHERE session_id = ? ORDER BY exercise_id, set_number', [sessionId]) as Set[];
}
export function addSet(sessionId: number, exerciseId: number, weight: number, reps: number, setNumber: number, comment?: string, durationSeconds?: number): number {
  return db.runSync(
    'INSERT INTO sets (session_id, exercise_id, weight, reps, set_number, comment, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [sessionId, exerciseId, weight, reps, setNumber, comment ?? null, durationSeconds ?? null]
  ).lastInsertRowId;
}
export function updateSet(id: number, weight: number, reps: number, comment?: string, durationSeconds?: number) {
  db.runSync('UPDATE sets SET weight = ?, reps = ?, comment = ?, duration_seconds = ? WHERE id = ?', [weight, reps, comment ?? null, durationSeconds ?? null, id]);
}
export function updateSetFull(id: number, weight: number, reps: number, comment: string, durationSeconds?: number) {
  db.runSync('UPDATE sets SET weight = ?, reps = ?, comment = ?, duration_seconds = ? WHERE id = ?', [weight, reps, comment || null, durationSeconds ?? null, id]);
}
export function deleteSet(id: number) {
  db.runSync('DELETE FROM sets WHERE id = ?', [id]);
}
export function getLastSetForExercise(exerciseId: number): Set | null {
  return db.getFirstSync(`
    SELECT st.* FROM sets st
    JOIN sessions s ON s.id = st.session_id
    WHERE st.exercise_id = ?
    ORDER BY s.date DESC, st.set_number DESC
    LIMIT 1
  `, [exerciseId]) as Set | null;
}

// ─── Cardio Types ─────────────────────────────────────────────────────────────

export function getCardioTypes(): CardioType[] {
  return db.getAllSync('SELECT * FROM cardio_types ORDER BY name ASC') as CardioType[];
}
export function addCardioType(name: string): number {
  return db.runSync('INSERT OR IGNORE INTO cardio_types (name) VALUES (?)', [name]).lastInsertRowId;
}
export function deleteCardioType(id: number) {
  db.runSync('DELETE FROM cardio_types WHERE id = ?', [id]);
}

// ─── Cardio Logs ──────────────────────────────────────────────────────────────

export function addCardioLog(sessionId: number, cardioTypeId: number, durationMinutes: number, calories?: number, distanceKm?: number, notes?: string): number {
  return db.runSync(
    'INSERT INTO cardio_logs (session_id, cardio_type_id, duration_minutes, calories, distance_km, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, cardioTypeId, durationMinutes, calories ?? null, distanceKm ?? null, notes ?? null]
  ).lastInsertRowId;
}
export function getCardioLogsForSession(sessionId: number): CardioLogFull[] {
  return db.getAllSync(`
    SELECT cl.*, ct.name as cardio_type_name, s.date
    FROM cardio_logs cl
    JOIN cardio_types ct ON ct.id = cl.cardio_type_id
    JOIN sessions s ON s.id = cl.session_id
    WHERE cl.session_id = ?
  `, [sessionId]) as CardioLogFull[];
}
export function getAllCardioLogs(): CardioLogFull[] {
  return db.getAllSync(`
    SELECT cl.*, ct.name as cardio_type_name, s.date
    FROM cardio_logs cl
    JOIN cardio_types ct ON ct.id = cl.cardio_type_id
    JOIN sessions s ON s.id = cl.session_id
    ORDER BY s.date DESC
  `) as CardioLogFull[];
}
export function updateCardioLog(id: number, durationMinutes: number, calories: number | null, distanceKm: number | null, notes: string | null) {
  db.runSync('UPDATE cardio_logs SET duration_minutes = ?, calories = ?, distance_km = ?, notes = ? WHERE id = ?', [durationMinutes, calories, distanceKm, notes, id]);
}
export function deleteCardioLog(id: number) {
  db.runSync('DELETE FROM cardio_logs WHERE id = ?', [id]);
}

// ─── History ──────────────────────────────────────────────────────────────────

export type HistorySession = {
  session_id: number; workout_id: number; workout_name: string;
  date: string; created_at?: string; notes?: string; is_cardio: number;
  set_count: number; total_volume: number; duration_seconds?: number;
  cardio_duration?: number; cardio_calories?: number; cardio_type_name?: string;
};

export function getHistory(limit = 50): HistorySession[] {
  return db.getAllSync(`
    SELECT
      s.id as session_id, s.workout_id, w.name as workout_name,
      s.date, s.created_at, s.notes, w.is_cardio, s.duration_seconds,
      (SELECT COUNT(*)                      FROM sets st WHERE st.session_id = s.id) as set_count,
      (SELECT COALESCE(SUM(st.weight*st.reps),0) FROM sets st WHERE st.session_id = s.id) as total_volume,
      (SELECT SUM(cl.duration_minutes)      FROM cardio_logs cl WHERE cl.session_id = s.id) as cardio_duration,
      (SELECT SUM(cl.calories)              FROM cardio_logs cl WHERE cl.session_id = s.id) as cardio_calories,
      (SELECT GROUP_CONCAT(DISTINCT ct.name)
         FROM cardio_logs cl JOIN cardio_types ct ON ct.id = cl.cardio_type_id
         WHERE cl.session_id = s.id) as cardio_type_name
    FROM sessions s
    JOIN workouts w ON w.id = s.workout_id
    ORDER BY s.date DESC, s.id DESC
    LIMIT ?
  `, [limit]) as HistorySession[];
}

export function getSessionDetails(sessionId: number): { session: Session; sets: (Set & { exercise_name: string })[]; cardioLogs: CardioLogFull[] } {
  const session = db.getFirstSync('SELECT * FROM sessions WHERE id = ?', [sessionId]) as Session;
  const sets = db.getAllSync(`
    SELECT st.*, e.name as exercise_name FROM sets st
    JOIN exercises e ON e.id = st.exercise_id
    WHERE st.session_id = ?
    ORDER BY e.sort_order, st.set_number
  `, [sessionId]) as (Set & { exercise_name: string })[];
  return { session, sets, cardioLogs: getCardioLogsForSession(sessionId) };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getStreak(): number {
  const rows = db.getAllSync("SELECT DISTINCT date FROM sessions ORDER BY date DESC") as { date: string }[];
  if (!rows.length) return 0;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const mostRecentDate = new Date(rows[0].date + 'T00:00:00'); mostRecentDate.setHours(0, 0, 0, 0);

  // Streak is broken only if the most recent session was 2+ days ago (i.e., a full day missed).
  // Being at midnight with no session yet today does NOT break the streak — yesterday still counts.
  const daysSinceLast = Math.round((today.getTime() - mostRecentDate.getTime()) / 86400000);
  if (daysSinceLast > 1) return 0; // Full day missed → streak is 0

  // Count back from the most recent logged day
  const startFrom = mostRecentDate;
  let streak = 0;
  for (let i = 0; i < rows.length; i++) {
    const d = new Date(rows[i].date + 'T00:00:00'); d.setHours(0, 0, 0, 0);
    const expected = new Date(startFrom); expected.setDate(startFrom.getDate() - i);
    if (d.getTime() === expected.getTime()) streak++; else break;
  }
  return streak;
}

export type WorkoutCount = { name: string; count: number };
export function getMostPopularWorkouts(period: 'month' | 'year'): WorkoutCount[] {
  const filter = period === 'month' ? "AND s.date >= date('now','start of month')" : "AND s.date >= date('now','start of year')";
  return db.getAllSync(`
    SELECT w.name, COUNT(*) as count FROM sessions s
    JOIN workouts w ON w.id = s.workout_id
    WHERE 1=1 ${filter}
    GROUP BY w.id ORDER BY count DESC LIMIT 5
  `) as WorkoutCount[];
}

export type ProgressPoint = { date: string; weight: number; volume: number; max_reps: number; max_duration_seconds: number | null };

// Returns progress for all exercises matching this name (across all workouts)
export function getExerciseProgress(exerciseName: string): ProgressPoint[] {
  return db.getAllSync(`
    SELECT s.date,
           MAX(st.weight)                                    as weight,
           SUM(st.weight * st.reps)                         as volume,
           MAX(st.reps)                                      as max_reps,
           MAX(COALESCE(st.duration_seconds, 0))             as max_duration_seconds
    FROM sets st
    JOIN exercises e ON e.id = st.exercise_id
    JOIN sessions  s ON s.id = st.session_id
    WHERE LOWER(e.name) = LOWER(?)
    GROUP BY s.date
    ORDER BY s.date ASC
  `, [exerciseName]) as ProgressPoint[];
}

// Returns all DISTINCT exercise names that have ever been logged in sessions
// belonging to workouts whose name matches (case-insensitive) the given workout name.
export function getHistoricalExerciseNames(workoutName: string): string[] {
  const rows = db.getAllSync(`
    SELECT DISTINCT e.name
    FROM sets     st
    JOIN exercises e ON e.id          = st.exercise_id
    JOIN sessions  s ON s.id          = st.session_id
    JOIN workouts  w ON w.id          = s.workout_id
    WHERE LOWER(w.name) = LOWER(?)
    ORDER BY e.name ASC
  `, [workoutName]) as { name: string }[];
  return rows.map(r => r.name);
}

/** All distinct exercise names ever logged, sorted alphabetically.
 *  Used for cross-workout exercise progress (e.g. Seated Row across multiple workouts). */
export function getAllExerciseNames(): string[] {
  const rows = db.getAllSync(`
    SELECT DISTINCT LOWER(e.name) as name_lower, e.name
    FROM sets st
    JOIN exercises e ON e.id = st.exercise_id
    ORDER BY LOWER(e.name) ASC
  `) as { name_lower: string; name: string }[];
  // Deduplicate case-insensitively, prefer the capitalised version
  const seen = new Map<string, string>();
  rows.forEach(r => { if (!seen.has(r.name_lower)) seen.set(r.name_lower, r.name); });
  return [...seen.values()];
}

/** Returns progress for an exercise by name, across ALL workouts (combines duplicates). */
export function getExerciseProgressGlobal(exerciseName: string): ProgressPoint[] {
  return db.getAllSync(`
    SELECT s.date,
           MAX(st.weight)                        as weight,
           SUM(st.weight * st.reps)              as volume,
           MAX(st.reps)                           as max_reps,
           MAX(COALESCE(st.duration_seconds, 0)) as max_duration_seconds
    FROM sets st
    JOIN exercises e ON e.id = st.exercise_id
    JOIN sessions  s ON s.id = st.session_id
    WHERE LOWER(e.name) = LOWER(?)
    GROUP BY s.date
    ORDER BY s.date ASC
  `, [exerciseName]) as ProgressPoint[];
}

export type CardioProgressPoint = {
  date: string;
  cardio_type_name: string;
  calories_per_min: number | null;
  duration_minutes: number;
  calories: number | null;
  distance_km: number | null;
};
// Returns one row per cardio session, grouped by type then date
export function getCardioProgress(): CardioProgressPoint[] {
  return db.getAllSync(`
    SELECT s.date,
           ct.name                                              as cardio_type_name,
           cl.duration_minutes,
           cl.calories,
           cl.distance_km,
           CASE WHEN cl.duration_minutes > 0 AND cl.calories IS NOT NULL
                THEN ROUND(CAST(cl.calories AS REAL) / cl.duration_minutes, 2)
                ELSE NULL END                                   as calories_per_min
    FROM cardio_logs  cl
    JOIN sessions     s  ON s.id  = cl.session_id
    JOIN cardio_types ct ON ct.id = cl.cardio_type_id
    ORDER BY ct.name ASC, s.date ASC
  `) as CardioProgressPoint[];
}
// Also keep a by-id variant for internal use
export function getExerciseProgressById(exerciseId: number): ProgressPoint[] {
  return db.getAllSync(`
    SELECT s.date, MAX(st.weight) as weight, SUM(st.weight * st.reps) as volume, MAX(st.reps) as max_reps
    FROM sets st JOIN sessions s ON s.id = st.session_id
    WHERE st.exercise_id = ?
    GROUP BY s.date ORDER BY s.date ASC
  `, [exerciseId]) as ProgressPoint[];
}

export function getTotalWorkouts(): number { return (db.getFirstSync('SELECT COUNT(*) as c FROM sessions') as any).c; }

/** Returns the date of the very first session ever logged, or null. */
export function getFirstSessionDate(): string | null {
  try {
    const row = db.getFirstSync('SELECT date FROM sessions ORDER BY date ASC LIMIT 1') as { date: string } | null;
    return row?.date ?? null;
  } catch { return null; }
}

/** Returns a milestone message if today marks an anniversary or session count milestone, else null.
 *  Checks real calendar years from first session date, plus fixed session-count milestones. */
export function checkMilestone(total: number): string | null {
  // ── Session count milestones ──────────────────────────────────────────────
  const countMilestones: Record<number, string> = {
    1:    "First workout logged! The journey begins 🎉",
    5:    "5 sessions done — off to a great start!",
    10:   "10 sessions — double digits! 💪",
    25:   "25 sessions — a habit is forming 🔥",
    50:   "50 sessions! Halfway to a century 🏅",
    75:   "75 sessions — three quarters to 100!",
    100:  "100 sessions! A true century 🏆",
    150:  "150 sessions — seriously committed 💎",
    200:  "200 sessions — keep going! 💪",
    250:  "250 sessions — elite consistency 🔥",
    300:  "300 sessions! The 300 club 🛡️",
    400:  "400 sessions — unstoppable force 🌊",
    500:  "500 sessions! Half a thousand 🌟",
    600:  "600 sessions — extraordinary dedication 🎯",
    750:  "750 sessions — three quarters to a thousand!",
    1000: "1000 sessions! One thousand workouts 🚀👑",
    1250: "1250 sessions — absolutely legendary 🌟",
    1500: "1500 sessions! Relentless 🏔️",
    2000: "2000 sessions — beyond elite 🌍",
    2500: "2500 sessions — you are the gym 🏛️",
    5000: "5000 sessions — a lifetime of fitness 🌠",
  };
  const countMsg = countMilestones[total] ?? null;

  // ── Calendar anniversary milestones ───────────────────────────────────────
  let yearMsg: string | null = null;
  const firstDate = getFirstSessionDate();
  if (firstDate) {
    const first = new Date(firstDate);
    const today = new Date();
    // Same month and day as first session?
    if (
      today.getMonth()   === first.getMonth() &&
      today.getDate()    === first.getDate() &&
      today.getFullYear() > first.getFullYear()
    ) {
      const years = today.getFullYear() - first.getFullYear();
      const labels: Record<number, string> = {
        1:  "1 year of training — happy anniversary! 🎂",
        2:  "2 years of showing up 🎂🎂",
        3:  "3 years strong 🎂🎂🎂",
        4:  "4 years — incredible commitment 🎂🎂🎂🎂",
        5:  "5 years of training! Half a decade 🎆",
        6:  "6 years — elite dedication 🌟",
        7:  "7 years of lifting — legendary 👑",
        8:  "8 years strong 🦾",
        9:  "9 years — almost a decade!",
        10: "10 years of training! A full decade 🏆🌍",
        15: "15 years — a way of life 🗿",
        20: "20 years of training! Truly iconic 🌠",
      };
      yearMsg = labels[years] ?? (years > 0 ? `${years} year${years !== 1 ? 's' : ''} of training! 🎂` : null);
    }
  }

  // Year anniversary takes priority if both fire on same day
  return yearMsg ?? countMsg;
}
export function getTotalSets():     number { return (db.getFirstSync('SELECT COUNT(*) as c FROM sets') as any).c; }
export function getTotalVolume():   number { return Math.round((db.getFirstSync('SELECT SUM(weight*reps) as t FROM sets') as any)?.t ?? 0); }

export function getThisWeekSessions(): number {
  return (db.getFirstSync("SELECT COUNT(DISTINCT date) as c FROM sessions WHERE date >= date('now','-6 days')") as any)?.c ?? 0;
}
export function getPersonalBests(): { exercise_name: string; weight: number; reps: number; max_reps: number; is_bw: number; max_duration: number }[] {
  return db.getAllSync(`
    SELECT e.name                                as exercise_name,
           MAX(st.weight)                        as weight,
           st.reps,
           MAX(st.reps)                          as max_reps,
           MAX(COALESCE(st.duration_seconds, 0)) as max_duration,
           CASE WHEN AVG(CASE WHEN st.weight = 0 THEN 1.0 ELSE 0.0 END) >= 0.5 THEN 1 ELSE 0 END as is_bw
    FROM sets st JOIN exercises e ON e.id = st.exercise_id
    GROUP BY LOWER(e.name)
    ORDER BY weight DESC LIMIT 10
  `) as { exercise_name: string; weight: number; reps: number; max_reps: number; is_bw: number; max_duration: number }[];
}

export function getLastSessionSummary(workoutId: number): { daysAgo: number; totalSets: number; totalVolume: number } | null {
  const session = db.getFirstSync('SELECT * FROM sessions WHERE workout_id = ? ORDER BY date DESC LIMIT 1', [workoutId]) as Session | null;
  if (!session) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const daysAgo = Math.round((today.getTime() - new Date(session.date + 'T00:00:00').getTime()) / 86400000);
  const sets = db.getAllSync('SELECT weight, reps FROM sets WHERE session_id = ?', [session.id]) as { weight: number; reps: number }[];
  return { daysAgo, totalSets: sets.length, totalVolume: sets.reduce((s, r) => s + r.weight * r.reps, 0) };
}

/** Returns true if any session was logged today (for notification suppression) */
export function hasWorkoutToday(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const c = (db.getFirstSync("SELECT COUNT(*) as c FROM sessions WHERE date = ?", [today]) as any)?.c ?? 0;
  return c > 0;
}

/** Per-exercise summary for the post-workout summary screen.
 *  Returns each exercise name with current-session best vs previous-session best. */
export type ExerciseSummaryRow = {
  exercise_name: string;
  cur_weight: number;
  cur_reps: number;
  cur_duration: number | null;
  prev_weight: number | null;
  prev_reps: number | null;
  prev_duration: number | null;
  is_bw: boolean;
  is_duration: boolean;
};
export function getSessionExerciseSummary(sessionId: number): ExerciseSummaryRow[] {
  // Current session exercises
  const exercises = db.getAllSync(`
    SELECT DISTINCT e.id, e.name
    FROM sets st JOIN exercises e ON e.id = st.exercise_id
    WHERE st.session_id = ?
    ORDER BY e.sort_order
  `, [sessionId]) as { id: number; name: string }[];

  const session = db.getFirstSync('SELECT * FROM sessions WHERE id = ?', [sessionId]) as Session | null;
  if (!session) return [];

  return exercises.map(ex => {
    // Current session bests
    const cur = db.getFirstSync(`
      SELECT MAX(weight) as weight, MAX(reps) as reps,
             MAX(COALESCE(duration_seconds,0)) as duration
      FROM sets WHERE session_id = ? AND exercise_id = ?
    `, [sessionId, ex.id]) as any;

    // Previous session (most recent session before this one that has this exercise)
    const prev = db.getFirstSync(`
      SELECT MAX(st.weight) as weight, MAX(st.reps) as reps,
             MAX(COALESCE(st.duration_seconds,0)) as duration
      FROM sets st
      JOIN sessions s ON s.id = st.session_id
      WHERE st.exercise_id = ? AND s.date < ?
      ORDER BY s.date DESC LIMIT 1
    `, [ex.id, session.date]) as any;

    // Count total sets for this exercise across all history to determine BW
    const allSets = db.getAllSync(`
      SELECT weight, duration_seconds FROM sets WHERE exercise_id = ?
    `, [ex.id]) as { weight: number; duration_seconds: number | null }[];

    const bwCount  = allSets.filter(s => s.weight === 0).length;
    const is_bw    = bwCount >= allSets.length / 2;
    const is_duration = allSets.some(s => (s.duration_seconds ?? 0) > 0);

    return {
      exercise_name: ex.name,
      cur_weight:    cur?.weight ?? 0,
      cur_reps:      cur?.reps ?? 0,
      cur_duration:  cur?.duration > 0 ? cur.duration : null,
      prev_weight:   prev?.weight ?? null,
      prev_reps:     prev?.reps ?? null,
      prev_duration: prev?.duration > 0 ? prev.duration : null,
      is_bw,
      is_duration,
    };
  });
}

/** Cardio summary for post-workout summary screen */
export type CardioSummaryRow = {
  cardio_type_name: string;
  cur_duration: number; cur_calories: number | null; cur_distance: number | null;
  prev_duration: number | null; prev_calories: number | null;
};
export function getSessionCardioSummary(sessionId: number): CardioSummaryRow[] {
  const session = db.getFirstSync('SELECT * FROM sessions WHERE id = ?', [sessionId]) as Session | null;
  if (!session) return [];
  const logs = db.getAllSync(`
    SELECT cl.*, ct.name as cardio_type_name
    FROM cardio_logs cl JOIN cardio_types ct ON ct.id = cl.cardio_type_id
    WHERE cl.session_id = ?
  `, [sessionId]) as (CardioLog & { cardio_type_name: string })[];

  return logs.map(log => {
    const prev = db.getFirstSync(`
      SELECT cl.duration_minutes, cl.calories
      FROM cardio_logs cl
      JOIN sessions s ON s.id = cl.session_id
      WHERE cl.cardio_type_id = ? AND s.date < ?
      ORDER BY s.date DESC LIMIT 1
    `, [log.cardio_type_id, session.date]) as any;

    return {
      cardio_type_name: log.cardio_type_name,
      cur_duration:  log.duration_minutes,
      cur_calories:  log.calories ?? null,
      cur_distance:  log.distance_km ?? null,
      prev_duration: prev?.duration_minutes ?? null,
      prev_calories: prev?.calories ?? null,
    };
  });
}

/** Combine two consecutive sessions of the same workout_id.
 *  Moves all sets/cardio_logs from session B into session A, then deletes B. */

/** Returns the best single set value for an exercise (weight for weighted, reps for BW, seconds for duration). */
export function getExerciseBest(exerciseName: string): { weight: number; reps: number; duration: number; is_bw: boolean; is_duration: boolean } | null {
  const row = db.getFirstSync(`
    SELECT MAX(st.weight) as weight, MAX(st.reps) as reps,
           MAX(COALESCE(st.duration_seconds,0)) as duration,
           AVG(CASE WHEN st.weight=0 THEN 1.0 ELSE 0.0 END) as bw_ratio
    FROM sets st JOIN exercises e ON e.id=st.exercise_id
    WHERE LOWER(e.name)=LOWER(?)
  `, [exerciseName]) as any;
  if (!row || row.reps == null) return null;
  return { weight: row.weight ?? 0, reps: row.reps ?? 0, duration: row.duration ?? 0, is_bw: row.bw_ratio >= 0.5, is_duration: row.duration > 0 };
}

/** Total volume for a specific exercise across all history (weight × reps, or reps for BW, or duration seconds). */
export function getExerciseTotalVolume(exerciseName: string): { volume: number; reps: number; duration: number; is_bw: boolean; is_duration: boolean } {
  const row = db.getFirstSync(`
    SELECT SUM(st.weight * st.reps) as volume, SUM(st.reps) as reps,
           SUM(COALESCE(st.duration_seconds,0)) as duration,
           AVG(CASE WHEN st.weight=0 THEN 1.0 ELSE 0.0 END) as bw_ratio
    FROM sets st JOIN exercises e ON e.id=st.exercise_id
    WHERE LOWER(e.name)=LOWER(?)
  `, [exerciseName]) as any;
  return { volume: row?.volume ?? 0, reps: row?.reps ?? 0, duration: row?.duration ?? 0, is_bw: (row?.bw_ratio ?? 0) >= 0.5, is_duration: (row?.duration ?? 0) > 0 };
}

/** Best total volume in a single session by workout name. */
export function getBestWorkoutDayVolume(workoutName: string): { date: string; volume: number } | null {
  const row = db.getFirstSync(`
    SELECT s.date, SUM(st.weight * st.reps) as volume
    FROM sets st
    JOIN sessions  s ON s.id  = st.session_id
    JOIN workouts  w ON w.id  = s.workout_id
    WHERE LOWER(w.name) = LOWER(?)
    GROUP BY s.id
    ORDER BY volume DESC
    LIMIT 1
  `, [workoutName]) as any;
  return row ? { date: row.date, volume: row.volume ?? 0 } : null;
}

/** Unique workout names for use in stat tile pickers. */
export function getWorkoutNamesForStats(): string[] {
  return (db.getAllSync(`SELECT DISTINCT name FROM workouts WHERE is_cardio=0 ORDER BY name ASC`) as { name: string }[]).map(r => r.name);
}
export function combineSessions(keepId: number, removeId: number): boolean {
  const a = db.getFirstSync('SELECT * FROM sessions WHERE id = ?', [keepId]) as Session | null;
  const b = db.getFirstSync('SELECT * FROM sessions WHERE id = ?', [removeId]) as Session | null;
  if (!a || !b || a.workout_id !== b.workout_id) return false;
  // Sum durations so combined session reflects total time
  const durA = a.duration_seconds ?? 0;
  const durB = b.duration_seconds ?? 0;
  if (durA > 0 || durB > 0) {
    db.runSync('UPDATE sessions SET duration_seconds = ? WHERE id = ?', [durA + durB, keepId]);
  }
  db.runSync('UPDATE sets        SET session_id = ? WHERE session_id = ?', [keepId, removeId]);
  db.runSync('UPDATE cardio_logs SET session_id = ? WHERE session_id = ?', [keepId, removeId]);
  db.runSync('DELETE FROM sessions WHERE id = ?', [removeId]);
  return true;
}

// ─── Routines ─────────────────────────────────────────────────────────────────

const ACTIVE_ROUTINE_KEY = 'active_routine';

export function getRoutine(): Routine | null {
  return db.getFirstSync('SELECT * FROM routines ORDER BY created_at DESC LIMIT 1') as Routine | null;
}
export function getRoutineDays(routineId: number): (RoutineDay & { workout_name?: string })[] {
  return db.getAllSync(`
    SELECT rd.*, w.name as workout_name
    FROM routine_days rd
    LEFT JOIN workouts w ON w.id = rd.workout_id
    WHERE rd.routine_id = ?
    ORDER BY rd.day_index ASC
  `, [routineId]) as (RoutineDay & { workout_name?: string })[];
}
export function createRoutine(name: string, type: RoutineType, days: Omit<RoutineDay, 'id' | 'routine_id'>[]): number {
  // Only one routine allowed — delete any existing one first
  db.execSync('DELETE FROM routine_days; DELETE FROM routines;');
  const id = db.runSync("INSERT INTO routines (name, type) VALUES (?, ?)", [name, type]).lastInsertRowId;
  days.forEach((d, i) => {
    db.runSync(
      'INSERT INTO routine_days (routine_id, day_index, workout_id, is_rest, day_of_week) VALUES (?,?,?,?,?)',
      [id, i, d.workout_id ?? null, d.is_rest ? 1 : 0, d.day_of_week ?? null]
    );
  });
  return id;
}
export function deleteRoutine() {
  db.execSync('DELETE FROM routine_days; DELETE FROM routines;');
}
export function updateRoutineProgress(dayIndex: number) {
  AsyncStorage.setItem(ACTIVE_ROUTINE_KEY, String(dayIndex));
}
export async function getRoutineProgress(): Promise<number> {
  try { const v = await AsyncStorage.getItem(ACTIVE_ROUTINE_KEY); return v ? parseInt(v) : 0; } catch { return 0; }
}
export async function clearRoutineProgress() {
  await AsyncStorage.removeItem(ACTIVE_ROUTINE_KEY);
}

const ROUTINE_PAUSED_KEY = 'routine_paused';
export async function pauseRoutine() {
  await AsyncStorage.setItem(ROUTINE_PAUSED_KEY, 'true');
}
export async function resumeRoutine() {
  await AsyncStorage.removeItem(ROUTINE_PAUSED_KEY);
}
export async function isRoutinePaused(): Promise<boolean> {
  try { const v = await AsyncStorage.getItem(ROUTINE_PAUSED_KEY); return v === 'true'; } catch { return false; }
}

/** Returns the workout to do today given routine type.
 *  For 'repeating': uses stored day index mod total days.
 *  For 'weekly': finds the day matching today's day-of-week. */
export async function getTodayRoutineWorkout(): Promise<{ workout: Workout | null; isRest: boolean; dayIndex: number; totalDays: number } | null> {
  const routine = getRoutine();
  if (!routine) return null;
  const days = getRoutineDays(routine.id);
  if (!days.length) return null;

  let dayIndex = 0;
  if (routine.type === 'repeating') {
    dayIndex = await getRoutineProgress();
    dayIndex = dayIndex % days.length;
  } else {
    // weekly — match by day of week
    const dow = new Date().getDay();
    const found = days.find(d => d.day_of_week === dow);
    dayIndex = found ? found.day_index : -1;
  }

  if (dayIndex < 0 || dayIndex >= days.length) return null;
  const day = days[dayIndex];
  if (day.is_rest) return { workout: null, isRest: true, dayIndex, totalDays: days.length };

  const workout = day.workout_id
    ? (db.getFirstSync('SELECT * FROM workouts WHERE id = ?', [day.workout_id]) as Workout | null)
    : null;
  return { workout, isRest: false, dayIndex, totalDays: days.length };
}

// ─── Prefs ────────────────────────────────────────────────────────────────────

export function getPref(key: string): string | null {
  try { return (db.getFirstSync('SELECT value FROM prefs WHERE key = ?', [key]) as any)?.value ?? null; } catch { return null; }
}
export function setPref(key: string, value: string) {
  try { db.runSync('INSERT OR REPLACE INTO prefs (key, value) VALUES (?, ?)', [key, value]); } catch {}
}

// ─── Streak offset (AsyncStorage) ─────────────────────────────────────────────

const STREAK_OFFSET_KEY = 'streak_offset';
export async function getStreakOffset(): Promise<number> {
  try { const v = await AsyncStorage.getItem(STREAK_OFFSET_KEY); return v ? parseInt(v) : 0; } catch { return 0; }
}
export async function setStreakOffset(n: number) {
  await AsyncStorage.setItem(STREAK_OFFSET_KEY, String(n));
}
export async function getStreakWithOffset(): Promise<number> {
  const base = getStreak(); const offset = await getStreakOffset();
  return base > 0 ? base + offset : 0;
}

// ─── Recent session (AsyncStorage) ────────────────────────────────────────────

export type RecentSession = {
  session_id: number; workout_id: number; workout_name: string;
  finished_at: string; is_cardio: number;
  finished: boolean;
};

const LAST_SESSION_KEY = 'last_session_info';

export async function saveLastSessionTime(sessionId: number, workoutId: number, workoutName: string, isCardio: number, finished = false) {
  await AsyncStorage.setItem(LAST_SESSION_KEY, JSON.stringify({ session_id: sessionId, workout_id: workoutId, workout_name: workoutName, finished_at: new Date().toISOString(), is_cardio: isCardio, finished }));
}
export async function getRecentSession(): Promise<RecentSession | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SESSION_KEY);
    if (!raw) return null;
    const data: RecentSession = JSON.parse(raw);
    // Valid for 15 minutes
    if (Date.now() - new Date(data.finished_at).getTime() >= 15 * 60 * 1000) return null;
    // Verify the session still exists in the DB — it may have been deleted from history
    const exists = db.getFirstSync('SELECT id FROM sessions WHERE id = ?', [data.session_id]);
    if (!exists) {
      await AsyncStorage.removeItem(LAST_SESSION_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}
export async function clearLastSession() {
  await AsyncStorage.removeItem(LAST_SESSION_KEY);
}

// ─── Import / Export ──────────────────────────────────────────────────────────

export function exportAllData() {
  return {
    workouts:     db.getAllSync('SELECT * FROM workouts'),
    exercises:    db.getAllSync('SELECT * FROM exercises'),
    sessions:     db.getAllSync('SELECT * FROM sessions'),
    sets:         db.getAllSync('SELECT * FROM sets'),
    cardio_types: db.getAllSync('SELECT * FROM cardio_types'),
    cardio_logs:  db.getAllSync('SELECT * FROM cardio_logs'),
    routines:     db.getAllSync('SELECT * FROM routines'),
    routine_days: db.getAllSync('SELECT * FROM routine_days'),
    exportedAt:   new Date().toISOString(),
  };
}

export function importAllData(data: any) {
  db.execSync('DELETE FROM cardio_logs; DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM workouts; DELETE FROM cardio_types;');
  for (const w  of (data.workouts     ?? []) as Workout[])    db.runSync('INSERT INTO workouts    (id,name,is_cardio,created_at) VALUES (?,?,?,?)', [w.id, w.name, w.is_cardio??0, w.created_at]);
  for (const e  of (data.exercises    ?? []) as Exercise[])   db.runSync('INSERT INTO exercises   (id,workout_id,name,sort_order,is_hidden) VALUES (?,?,?,?,?)', [e.id, e.workout_id, e.name, e.sort_order, (e as any).is_hidden??0]);
  for (const s  of (data.sessions     ?? []) as Session[])    db.runSync('INSERT INTO sessions    (id,workout_id,date,created_at,notes,duration_seconds) VALUES (?,?,?,?,?,?)', [s.id, s.workout_id, s.date, (s as any).created_at??null, s.notes??null, s.duration_seconds??null]);
  for (const st of (data.sets         ?? []) as Set[])        db.runSync('INSERT INTO sets        (id,session_id,exercise_id,weight,reps,set_number,comment,duration_seconds) VALUES (?,?,?,?,?,?,?,?)', [st.id, st.session_id, st.exercise_id, st.weight, st.reps, st.set_number, st.comment??null, (st as any).duration_seconds??null]);
  for (const ct of (data.cardio_types ?? []) as CardioType[]) db.runSync('INSERT OR IGNORE INTO cardio_types (id,name) VALUES (?,?)', [ct.id, ct.name]);
  for (const cl of (data.cardio_logs  ?? []) as CardioLog[])  db.runSync('INSERT INTO cardio_logs (id,session_id,cardio_type_id,duration_minutes,calories,distance_km,notes) VALUES (?,?,?,?,?,?,?)', [cl.id, cl.session_id, cl.cardio_type_id, cl.duration_minutes, cl.calories??null, cl.distance_km??null, cl.notes??null]);
}

// ─── Developer utilities ──────────────────────────────────────────────────────

export function deleteAllData() {
  db.execSync('DELETE FROM cardio_logs; DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises;');
  db.runSync('DELETE FROM workouts WHERE is_cardio = 0');
  // Re-seed cardio types in case they were cleared
  const count = (db.getFirstSync('SELECT COUNT(*) as c FROM cardio_types') as any).c;
  if (count === 0) {
    for (const name of ['Treadmill', 'Cycling', 'Rowing', 'Elliptical', 'Swimming', 'Stairmaster']) {
      db.runSync('INSERT OR IGNORE INTO cardio_types (name) VALUES (?)', [name]);
    }
  }
}

export function populateDummyData() {
  const chestId    = db.runSync("INSERT INTO workouts (name,is_cardio) VALUES ('Chest',0)").lastInsertRowId;
  const backId     = db.runSync("INSERT INTO workouts (name,is_cardio) VALUES ('Back',0)").lastInsertRowId;
  const legsId     = db.runSync("INSERT INTO workouts (name,is_cardio) VALUES ('Legs',0)").lastInsertRowId;
  const shoulderId = db.runSync("INSERT INTO workouts (name,is_cardio) VALUES ('Shoulders',0)").lastInsertRowId;
  const armsId     = db.runSync("INSERT INTO workouts (name,is_cardio) VALUES ('Arms',0)").lastInsertRowId;

  const benchId   = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Bench Press',0)",    [chestId]).lastInsertRowId;
  const inclineId = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Incline DB Press',1)",[chestId]).lastInsertRowId;
  const flyId     = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Cable Fly',2)",       [chestId]).lastInsertRowId;

  const dlId   = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Deadlift',0)",    [backId]).lastInsertRowId;
  const pullId = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Pull Ups',1)",    [backId]).lastInsertRowId;
  const rowId  = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Barbell Row',2)", [backId]).lastInsertRowId;

  const sqId  = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Squat',0)",              [legsId]).lastInsertRowId;
  const lpId  = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Leg Press',1)",           [legsId]).lastInsertRowId;
  const rdlId = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Romanian Deadlift',2)",   [legsId]).lastInsertRowId;

  const ohpId = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Overhead Press',0)", [shoulderId]).lastInsertRowId;
  const latId = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Lateral Raise',1)",  [shoulderId]).lastInsertRowId;

  const curlId  = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Barbell Curl',0)", [armsId]).lastInsertRowId;
  const dipId   = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Tricep Dip',1)",   [armsId]).lastInsertRowId;
  const plankId = db.runSync("INSERT INTO exercises (workout_id,name,sort_order) VALUES (?,'Plank',2)",         [armsId]).lastInsertRowId;

  const today = new Date();

  // [workoutId, daysAgo, durationMins, sets: [exId, weight, reps]]
  const sessions: [number, number, number, [number,number,number][]][] = [
    [chestId,56,55,[[benchId,80,8],[benchId,80,8],[benchId,80,6],[inclineId,60,10],[inclineId,60,10],[flyId,20,12],[flyId,20,12]]],
    [chestId,49,52,[[benchId,82.5,8],[benchId,82.5,8],[benchId,82.5,6],[inclineId,62.5,10],[inclineId,62.5,10],[flyId,22.5,12]]],
    [chestId,42,54,[[benchId,85,8],[benchId,85,8],[benchId,85,6],[inclineId,65,10],[inclineId,65,10],[flyId,22.5,12]]],
    [chestId,35,58,[[benchId,87.5,8],[benchId,87.5,7],[benchId,87.5,6],[inclineId,67.5,10],[inclineId,67.5,10],[flyId,25,12]]],
    [chestId,28,60,[[benchId,90,8],[benchId,90,8],[benchId,90,7],[inclineId,70,10],[inclineId,70,10],[flyId,25,12]]],
    [chestId,21,57,[[benchId,92.5,8],[benchId,92.5,8],[benchId,92.5,6],[inclineId,72.5,10],[inclineId,70,10],[flyId,27.5,12]]],
    [chestId,14,61,[[benchId,95,8],[benchId,95,8],[benchId,95,6],[inclineId,75,10],[inclineId,75,10],[flyId,27.5,12]]],
    [chestId,7, 63,[[benchId,100,5],[benchId,100,5],[benchId,100,4],[inclineId,77.5,10],[inclineId,77.5,10],[flyId,30,12]]],

    [backId,54,68,[[dlId,120,5],[dlId,120,5],[dlId,120,5],[pullId,0,8],[pullId,0,7],[rowId,80,8],[rowId,80,8]]],
    [backId,47,65,[[dlId,125,5],[dlId,125,5],[dlId,125,5],[pullId,0,8],[pullId,0,8],[rowId,82.5,8],[rowId,82.5,8]]],
    [backId,40,70,[[dlId,130,5],[dlId,130,5],[dlId,130,4],[pullId,0,9],[pullId,0,8],[rowId,85,8],[rowId,85,8]]],
    [backId,33,64,[[dlId,132.5,5],[dlId,132.5,5],[dlId,132.5,5],[pullId,0,10],[pullId,0,9],[rowId,87.5,8]]],
    [backId,26,72,[[dlId,135,5],[dlId,135,5],[dlId,135,5],[pullId,0,10],[pullId,0,10],[rowId,90,8],[rowId,90,7]]],
    [backId,12,69,[[dlId,140,5],[dlId,140,5],[dlId,140,4],[pullId,0,11],[pullId,0,10],[rowId,92.5,8],[rowId,92.5,8]]],
    [backId,5, 71,[[dlId,142.5,5],[dlId,142.5,5],[dlId,142.5,5],[pullId,0,12],[pullId,0,11],[rowId,95,8],[rowId,95,7]]],

    [legsId,53,75,[[sqId,100,5],[sqId,100,5],[sqId,100,5],[lpId,140,10],[lpId,140,10],[rdlId,80,10],[rdlId,80,10]]],
    [legsId,46,72,[[sqId,102.5,5],[sqId,102.5,5],[sqId,102.5,5],[lpId,150,10],[lpId,150,10],[rdlId,82.5,10]]],
    [legsId,39,78,[[sqId,105,5],[sqId,105,5],[sqId,105,5],[lpId,160,10],[lpId,160,10],[rdlId,85,10],[rdlId,85,10]]],
    [legsId,25,74,[[sqId,107.5,5],[sqId,107.5,5],[sqId,107.5,4],[lpId,170,10],[lpId,170,10],[rdlId,87.5,10]]],
    [legsId,11,80,[[sqId,110,5],[sqId,110,5],[sqId,110,5],[lpId,180,10],[lpId,180,10],[rdlId,90,10],[rdlId,90,9]]],
    [legsId,4, 77,[[sqId,112.5,5],[sqId,112.5,5],[sqId,112.5,5],[lpId,190,10],[lpId,190,10],[rdlId,92.5,10]]],

    [shoulderId,52,48,[[ohpId,60,8],[ohpId,60,8],[ohpId,60,7],[latId,12.5,15],[latId,12.5,15],[latId,12.5,12]]],
    [shoulderId,38,50,[[ohpId,62.5,8],[ohpId,62.5,8],[ohpId,62.5,7],[latId,15,15],[latId,15,14],[latId,15,12]]],
    [shoulderId,24,52,[[ohpId,65,8],[ohpId,65,8],[ohpId,65,6],[latId,15,15],[latId,15,15],[latId,15,14]]],
    [shoulderId,10,49,[[ohpId,67.5,8],[ohpId,67.5,7],[ohpId,67.5,6],[latId,17.5,15],[latId,17.5,14],[latId,17.5,12]]],
    [shoulderId,3, 53,[[ohpId,70,8],[ohpId,70,8],[ohpId,70,7],[latId,17.5,15],[latId,17.5,15],[latId,17.5,14]]],

  // ── Arms ── (Tricep Dip starts bodyweight, transitions to weighted in last 2 sessions)
    [armsId,50,42,[[curlId,40,10],[curlId,40,10],[curlId,40,8],[dipId,0,12],[dipId,0,12],[dipId,0,10]]],
    [armsId,36,44,[[curlId,42.5,10],[curlId,42.5,10],[curlId,42.5,8],[dipId,0,14],[dipId,0,13],[dipId,0,12]]],
    [armsId,22,45,[[curlId,45,10],[curlId,45,10],[curlId,45,8],[dipId,0,15],[dipId,0,15],[dipId,0,13]]],
    [armsId,8, 47,[[curlId,47.5,10],[curlId,47.5,10],[curlId,47.5,8],[dipId,5,12],[dipId,5,12],[dipId,5,10]]],
    [armsId,1, 48,[[curlId,50,10],[curlId,50,10],[curlId,50,8],[dipId,10,12],[dipId,10,11],[dipId,10,10]]],
  ];

  sessions.forEach(([wId, daysAgo, durationMins, sets]) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().slice(0, 10);
    const hour = 6 + Math.floor(Math.random() * 14);
    const min  = Math.floor(Math.random() * 60);
    const createdAt = `${dateStr} ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`;
    const sId = db.runSync(
      'INSERT INTO sessions (workout_id,date,created_at,duration_seconds) VALUES (?,?,?,?)',
      [wId, dateStr, createdAt, durationMins * 60]
    ).lastInsertRowId;
    sets.forEach(([exId, weight, reps], i) => {
      const setNum = sets.slice(0, i).filter(s => s[0] === exId).length + 1;
      db.runSync('INSERT INTO sets (session_id,exercise_id,weight,reps,set_number) VALUES (?,?,?,?,?)', [sId, exId, weight, reps, setNum]);
    });
  });

  // Plank duration sets — seeded separately so we can store duration_seconds
  const plankHistory: [number, number, number[]][] = [
    // [daysAgo, durationMins, [set1_secs, set2_secs, set3_secs]]
    [50, 42, [30, 30, 30]],
    [36, 44, [45, 45, 30]],
    [22, 45, [60, 60, 45]],
    [8,  47, [75, 75, 60]],
    [1,  48, [90, 90, 75]],
  ];
  plankHistory.forEach(([daysAgo, , planks]) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().slice(0, 10);
    // Find the session already created for armsId on this date
    const existingSess = db.getFirstSync(
      'SELECT id FROM sessions WHERE workout_id = ? AND date = ?', [armsId, dateStr]
    ) as { id: number } | null;
    if (existingSess) {
      planks.forEach((durSecs, i) => {
        db.runSync(
          'INSERT INTO sets (session_id,exercise_id,weight,reps,set_number,duration_seconds) VALUES (?,?,?,?,?,?)',
          [existingSess.id, plankId, 0, 1, i + 1, durSecs]
        );
      });
    }
  });

  // Cardio sessions
  const cardioWorkout = db.getFirstSync("SELECT id FROM workouts WHERE is_cardio = 1") as any;
  const treadmill     = db.getFirstSync("SELECT id FROM cardio_types WHERE name = 'Treadmill'") as any;
  const cycling       = db.getFirstSync("SELECT id FROM cardio_types WHERE name = 'Cycling'") as any;
  if (cardioWorkout && treadmill) {
    [[15,45,380,6.2],[8,30,280,4.5],[2,35,310,5.1]].forEach(([daysAgo,dur,cals,dist]) => {
      const d = new Date(today); d.setDate(d.getDate() - daysAgo);
      const dateStr = d.toISOString().slice(0, 10);
      const sId = db.runSync('INSERT INTO sessions (workout_id,date,created_at,duration_seconds) VALUES (?,?,?,?)', [cardioWorkout.id, dateStr, `${dateStr} 07:30:00`, dur*60]).lastInsertRowId;
      db.runSync('INSERT INTO cardio_logs (session_id,cardio_type_id,duration_minutes,calories,distance_km) VALUES (?,?,?,?,?)', [sId, treadmill.id, dur, cals, dist]);
    });
  }
  if (cardioWorkout && cycling) {
    [[20,60,450,18.5],[6,45,340,14.2]].forEach(([daysAgo,dur,cals,dist]) => {
      const d = new Date(today); d.setDate(d.getDate() - daysAgo);
      const dateStr = d.toISOString().slice(0, 10);
      const sId = db.runSync('INSERT INTO sessions (workout_id,date,created_at,duration_seconds) VALUES (?,?,?,?)', [cardioWorkout.id, dateStr, `${dateStr} 08:00:00`, dur*60]).lastInsertRowId;
      db.runSync('INSERT INTO cardio_logs (session_id,cardio_type_id,duration_minutes,calories,distance_km) VALUES (?,?,?,?,?)', [sId, cycling.id, dur, cals, dist]);
    });
  }
}

// Atomically wipe all user data and replace with fresh dummy data.
// Safe to call from settings "Reset to demo data" option.
export function resetWithDummyData() {
  deleteAllData();
  populateDummyData();
}
