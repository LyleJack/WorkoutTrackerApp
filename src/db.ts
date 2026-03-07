import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('workouttracker.db');

// ─── Schema Init ─────────────────────────────────────────────────────────────

export function initDB() {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_cardio INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      date TEXT DEFAULT (date('now')),
      notes TEXT,
      FOREIGN KEY (workout_id) REFERENCES workouts(id)
    );

    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      weight REAL DEFAULT 0,
      reps INTEGER DEFAULT 0,
      set_number INTEGER DEFAULT 1,
      comment TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    CREATE TABLE IF NOT EXISTS cardio_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS cardio_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      cardio_type_id INTEGER NOT NULL,
      duration_minutes REAL NOT NULL,
      calories INTEGER,
      distance_km REAL,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (cardio_type_id) REFERENCES cardio_types(id)
    );
  `);

  // Seed default cardio types if empty
  const count = (db.getFirstSync('SELECT COUNT(*) as c FROM cardio_types') as any).c;
  if (count === 0) {
    for (const name of ['Treadmill', 'Cycling', 'Rowing', 'Elliptical', 'Swimming', 'Stairmaster']) {
      db.runSync('INSERT OR IGNORE INTO cardio_types (name) VALUES (?)', [name]);
    }
  }

  // Ensure cardio workout exists
  const cardio = db.getFirstSync("SELECT id FROM workouts WHERE is_cardio = 1") as any;
  if (!cardio) {
    db.runSync("INSERT INTO workouts (name, is_cardio) VALUES ('Cardio', 1)");
  }

  // Migration: add is_cardio column if upgrading from old schema
  try {
    db.execSync('ALTER TABLE workouts ADD COLUMN is_cardio INTEGER DEFAULT 0');
  } catch (_) { /* column already exists */ }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type Workout = { id: number; name: string; is_cardio: number; created_at: string };
export type Exercise = { id: number; workout_id: number; name: string; sort_order: number };
export type Session = { id: number; workout_id: number; date: string; notes?: string };
export type Set = {
  id: number; session_id: number; exercise_id: number;
  weight: number; reps: number; set_number: number; comment?: string;
};
export type CardioType = { id: number; name: string };
export type CardioLog = {
  id: number; session_id: number; cardio_type_id: number;
  duration_minutes: number; calories?: number; distance_km?: number; notes?: string;
};
export type CardioLogFull = CardioLog & { cardio_type_name: string; date: string };

// ─── Workouts ────────────────────────────────────────────────────────────────

export function getWorkouts(): Workout[] {
  return db.getAllSync('SELECT * FROM workouts ORDER BY is_cardio ASC, name ASC') as Workout[];
}

export function addWorkout(name: string): number {
  const result = db.runSync('INSERT INTO workouts (name, is_cardio) VALUES (?, 0)', [name]);
  return result.lastInsertRowId;
}

export function deleteWorkout(id: number) {
  // Don't allow deleting the cardio workout
  db.runSync('DELETE FROM workouts WHERE id = ? AND is_cardio = 0', [id]);
}

export function getCardioWorkout(): Workout {
  return db.getFirstSync("SELECT * FROM workouts WHERE is_cardio = 1") as Workout;
}

// ─── Exercises ───────────────────────────────────────────────────────────────

export function getExercises(workoutId: number): Exercise[] {
  return db.getAllSync(
    'SELECT * FROM exercises WHERE workout_id = ? ORDER BY sort_order ASC',
    [workoutId]
  ) as Exercise[];
}

export function addExercise(workoutId: number, name: string): number {
  const count = (db.getFirstSync(
    'SELECT COUNT(*) as c FROM exercises WHERE workout_id = ?', [workoutId]
  ) as any).c;
  const result = db.runSync(
    'INSERT INTO exercises (workout_id, name, sort_order) VALUES (?, ?, ?)',
    [workoutId, name, count]
  );
  return result.lastInsertRowId;
}

export function deleteExercise(id: number) {
  db.runSync('DELETE FROM exercises WHERE id = ?', [id]);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function createSession(workoutId: number, notes?: string): number {
  const result = db.runSync(
    'INSERT INTO sessions (workout_id, notes) VALUES (?, ?)',
    [workoutId, notes ?? null]
  );
  return result.lastInsertRowId;
}

export function getSessionsForWorkout(workoutId: number): Session[] {
  return db.getAllSync(
    'SELECT * FROM sessions WHERE workout_id = ? ORDER BY date DESC',
    [workoutId]
  ) as Session[];
}

export function deleteSession(id: number) {
  db.runSync('DELETE FROM sets WHERE session_id = ?', [id]);
  db.runSync('DELETE FROM cardio_logs WHERE session_id = ?', [id]);
  db.runSync('DELETE FROM sessions WHERE id = ?', [id]);
}

export function getAllSessions(): Session[] {
  return db.getAllSync('SELECT * FROM sessions ORDER BY date DESC') as Session[];
}

// ─── Sets ────────────────────────────────────────────────────────────────────

export function getSetsForSession(sessionId: number): Set[] {
  return db.getAllSync(
    'SELECT * FROM sets WHERE session_id = ? ORDER BY exercise_id, set_number',
    [sessionId]
  ) as Set[];
}

export function addSet(
  sessionId: number, exerciseId: number,
  weight: number, reps: number, setNumber: number, comment?: string
): number {
  const result = db.runSync(
    'INSERT INTO sets (session_id, exercise_id, weight, reps, set_number, comment) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, exerciseId, weight, reps, setNumber, comment ?? null]
  );
  return result.lastInsertRowId;
}

export function updateSet(id: number, weight: number, reps: number, comment?: string) {
  db.runSync(
    'UPDATE sets SET weight = ?, reps = ?, comment = ? WHERE id = ?',
    [weight, reps, comment ?? null, id]
  );
}

export function deleteSet(id: number) {
  db.runSync('DELETE FROM sets WHERE id = ?', [id]);
}

// Get last set logged for an exercise across all sessions (for "copy last" feature)
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
  const result = db.runSync('INSERT OR IGNORE INTO cardio_types (name) VALUES (?)', [name]);
  return result.lastInsertRowId;
}

export function deleteCardioType(id: number) {
  db.runSync('DELETE FROM cardio_types WHERE id = ?', [id]);
}

// ─── Cardio Logs ─────────────────────────────────────────────────────────────

export function addCardioLog(
  sessionId: number, cardioTypeId: number,
  durationMinutes: number, calories?: number,
  distanceKm?: number, notes?: string
): number {
  const result = db.runSync(
    `INSERT INTO cardio_logs
      (session_id, cardio_type_id, duration_minutes, calories, distance_km, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, cardioTypeId, durationMinutes, calories ?? null, distanceKm ?? null, notes ?? null]
  );
  return result.lastInsertRowId;
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

export function deleteCardioLog(id: number) {
  db.runSync('DELETE FROM cardio_logs WHERE id = ?', [id]);
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

// ─── History ─────────────────────────────────────────────────────────────────

export type HistorySession = {
  session_id: number; workout_id: number; workout_name: string;
  date: string; notes?: string; is_cardio: number;
  set_count: number;
};

export function getHistory(limit = 50): HistorySession[] {
  return db.getAllSync(`
    SELECT
      s.id as session_id, s.workout_id, w.name as workout_name,
      s.date, s.notes, w.is_cardio,
      (SELECT COUNT(*) FROM sets st WHERE st.session_id = s.id) as set_count
    FROM sessions s
    JOIN workouts w ON w.id = s.workout_id
    ORDER BY s.date DESC, s.id DESC
    LIMIT ?
  `, [limit]) as HistorySession[];
}

export function getSessionDetails(sessionId: number): {
  session: Session;
  sets: (Set & { exercise_name: string })[];
  cardioLogs: CardioLogFull[];
} {
  const session = db.getFirstSync('SELECT * FROM sessions WHERE id = ?', [sessionId]) as Session;
  const sets = db.getAllSync(`
    SELECT st.*, e.name as exercise_name FROM sets st
    JOIN exercises e ON e.id = st.exercise_id
    WHERE st.session_id = ?
    ORDER BY e.sort_order, st.set_number
  `, [sessionId]) as (Set & { exercise_name: string })[];
  const cardioLogs = getCardioLogsForSession(sessionId);
  return { session, sets, cardioLogs };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export function getStreak(): number {
  const sessions = db.getAllSync(
    "SELECT DISTINCT date FROM sessions ORDER BY date DESC"
  ) as { date: string }[];
  if (sessions.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < sessions.length; i++) {
    const sessionDate = new Date(sessions[i].date);
    sessionDate.setHours(0, 0, 0, 0);
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    if (sessionDate.getTime() === expected.getTime()) streak++;
    else break;
  }
  return streak;
}

export type WorkoutCount = { name: string; count: number };

export function getMostPopularWorkouts(period: 'month' | 'year'): WorkoutCount[] {
  const filter = period === 'month'
    ? "AND s.date >= date('now', 'start of month')"
    : "AND s.date >= date('now', 'start of year')";
  return db.getAllSync(`
    SELECT w.name, COUNT(*) as count FROM sessions s
    JOIN workouts w ON w.id = s.workout_id
    WHERE 1=1 ${filter}
    GROUP BY w.id ORDER BY count DESC LIMIT 5
  `) as WorkoutCount[];
}

export type ProgressPoint = { date: string; weight: number; volume: number };

export function getExerciseProgress(exerciseId: number): ProgressPoint[] {
  return db.getAllSync(`
    SELECT s.date, MAX(st.weight) as weight, SUM(st.weight * st.reps) as volume
    FROM sets st JOIN sessions s ON s.id = st.session_id
    WHERE st.exercise_id = ?
    GROUP BY s.date ORDER BY s.date ASC
  `, [exerciseId]) as ProgressPoint[];
}

export function getTotalWorkouts(): number {
  return (db.getFirstSync('SELECT COUNT(*) as c FROM sessions') as any).c;
}

export function getTotalSets(): number {
  return (db.getFirstSync('SELECT COUNT(*) as c FROM sets') as any).c;
}

// ─── Import / Export ─────────────────────────────────────────────────────────

export function exportAllData() {
  return {
    workouts: db.getAllSync('SELECT * FROM workouts'),
    exercises: db.getAllSync('SELECT * FROM exercises'),
    sessions: db.getAllSync('SELECT * FROM sessions'),
    sets: db.getAllSync('SELECT * FROM sets'),
    cardio_types: db.getAllSync('SELECT * FROM cardio_types'),
    cardio_logs: db.getAllSync('SELECT * FROM cardio_logs'),
    exportedAt: new Date().toISOString(),
  };
}

export function importAllData(data: any) {
  db.execSync(`
    DELETE FROM cardio_logs; DELETE FROM sets; DELETE FROM sessions;
    DELETE FROM exercises; DELETE FROM workouts; DELETE FROM cardio_types;
  `);
  for (const w of (data.workouts ?? []) as Workout[]) {
    db.runSync('INSERT INTO workouts (id, name, is_cardio, created_at) VALUES (?, ?, ?, ?)',
      [w.id, w.name, w.is_cardio ?? 0, w.created_at]);
  }
  for (const e of (data.exercises ?? []) as Exercise[]) {
    db.runSync('INSERT INTO exercises (id, workout_id, name, sort_order) VALUES (?, ?, ?, ?)',
      [e.id, e.workout_id, e.name, e.sort_order]);
  }
  for (const s of (data.sessions ?? []) as Session[]) {
    db.runSync('INSERT INTO sessions (id, workout_id, date, notes) VALUES (?, ?, ?, ?)',
      [s.id, s.workout_id, s.date, s.notes ?? null]);
  }
  for (const st of (data.sets ?? []) as Set[]) {
    db.runSync('INSERT INTO sets (id, session_id, exercise_id, weight, reps, set_number, comment) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [st.id, st.session_id, st.exercise_id, st.weight, st.reps, st.set_number, st.comment ?? null]);
  }
  for (const ct of (data.cardio_types ?? []) as CardioType[]) {
    db.runSync('INSERT OR IGNORE INTO cardio_types (id, name) VALUES (?, ?)', [ct.id, ct.name]);
  }
  for (const cl of (data.cardio_logs ?? []) as CardioLog[]) {
    db.runSync('INSERT INTO cardio_logs (id, session_id, cardio_type_id, duration_minutes, calories, distance_km, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cl.id, cl.session_id, cl.cardio_type_id, cl.duration_minutes, cl.calories ?? null, cl.distance_km ?? null, cl.notes ?? null]);
  }
}

// ─── Streak Offset (custom starting streak) ──────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_OFFSET_KEY = 'streak_offset';

export async function getStreakOffset(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(STREAK_OFFSET_KEY);
    return val ? parseInt(val) : 0;
  } catch { return 0; }
}

export async function setStreakOffset(n: number) {
  await AsyncStorage.setItem(STREAK_OFFSET_KEY, String(n));
}

export async function getStreakWithOffset(): Promise<number> {
  const base = getStreak();
  const offset = await getStreakOffset();
  return base > 0 ? base + offset : 0;
}

// ─── Extra Stats ──────────────────────────────────────────────────────────────

export function getTotalVolume(): number {
  const result = db.getFirstSync(
    'SELECT SUM(weight * reps) as total FROM sets'
  ) as any;
  return Math.round(result?.total ?? 0);
}

export function getThisWeekSessions(): number {
  const result = db.getFirstSync(
    "SELECT COUNT(DISTINCT date) as c FROM sessions WHERE date >= date('now', '-6 days')"
  ) as any;
  return result?.c ?? 0;
}

export function getPersonalBests(): { exercise_name: string; weight: number; reps: number }[] {
  return db.getAllSync(`
    SELECT e.name as exercise_name, MAX(st.weight) as weight, st.reps
    FROM sets st
    JOIN exercises e ON e.id = st.exercise_id
    GROUP BY st.exercise_id
    ORDER BY weight DESC
    LIMIT 5
  `) as { exercise_name: string; weight: number; reps: number }[];
}

// ─── History: update session notes ───────────────────────────────────────────

export function updateSessionNotes(sessionId: number, notes: string) {
  db.runSync('UPDATE sessions SET notes = ? WHERE id = ?', [notes, sessionId]);
}

export function updateSessionDate(sessionId: number, date: string) {
  db.runSync('UPDATE sessions SET date = ? WHERE id = ?', [date, sessionId]);
}

export function updateSetFull(id: number, weight: number, reps: number, comment: string) {
  db.runSync(
    'UPDATE sets SET weight = ?, reps = ?, comment = ? WHERE id = ?',
    [weight, reps, comment || null, id]
  );
}

export function updateCardioLog(
  id: number, durationMinutes: number,
  calories: number | null, distanceKm: number | null, notes: string | null
) {
  db.runSync(
    'UPDATE cardio_logs SET duration_minutes = ?, calories = ?, distance_km = ?, notes = ? WHERE id = ?',
    [durationMinutes, calories, distanceKm, notes, id]
  );
}

// ─── Recent session detection ─────────────────────────────────────────────────

export type RecentSession = {
  session_id: number;
  workout_id: number;
  workout_name: string;
  finished_at: string; // ISO string stored when session created
  is_cardio: number;
};

const LAST_SESSION_KEY = 'last_session_info';

export async function saveLastSessionTime(
  sessionId: number, workoutId: number, workoutName: string, isCardio: number
) {
  await AsyncStorage.setItem(LAST_SESSION_KEY, JSON.stringify({
    session_id: sessionId,
    workout_id: workoutId,
    workout_name: workoutName,
    finished_at: new Date().toISOString(),
    is_cardio: isCardio,
  }));
}

export async function getRecentSession(): Promise<RecentSession | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SESSION_KEY);
    if (!raw) return null;
    const data: RecentSession = JSON.parse(raw);
    const elapsed = Date.now() - new Date(data.finished_at).getTime();
    if (elapsed < 60 * 60 * 1000) return data; // within 1 hour
    return null;
  } catch { return null; }
}

export async function clearLastSession() {
  await AsyncStorage.removeItem(LAST_SESSION_KEY);
}

// ─── Backfill / add missing session on a specific date ───────────────────────

export function createSessionOnDate(workoutId: number, date: string, notes?: string): number {
  const result = db.runSync(
    'INSERT INTO sessions (workout_id, date, notes) VALUES (?, ?, ?)',
    [workoutId, date, notes ?? null]
  );
  return result.lastInsertRowId;
}
