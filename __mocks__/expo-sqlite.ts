/**
 * expo-sqlite mock — backed by better-sqlite3 in-memory database.
 *
 * THE CORE PROBLEM THIS SOLVES:
 * src/db.ts runs `const db = SQLite.openDatabaseSync('workouttracker.db')` at
 * module load time and holds that reference for the entire test file lifetime.
 * If we close and reopen the underlying connection between tests, db.ts still
 * holds the old closed handle and every call throws "connection is not open".
 *
 * THE FIX:
 * Return a stable proxy object whose methods always delegate to the *current*
 * live better-sqlite3 instance. When __resetDb() closes and recreates the
 * connection, the proxy automatically routes to the new one — db.ts never
 * needs to know the underlying connection changed.
 */
import Database from 'better-sqlite3';

let _db: Database.Database | null = null;

function live(): Database.Database {
  if (!_db || !_db.open) {
    _db = new Database(':memory:');
  }
  return _db;
}

/** Call in beforeEach to wipe all data between tests */
export function __resetDb() {
  try { _db?.close(); } catch {}
  _db = new Database(':memory:');
}

/**
 * The proxy object returned to db.ts.
 * Every method call is forwarded to whatever `live()` returns at call time,
 * so reconnecting between tests is transparent to the caller.
 */
const proxyDb = {
  execSync(sql: string) {
    const db = live();
    // better-sqlite3 exec() doesn't handle multi-statement strings split by
    // blank lines or PRAGMA + DDL in one call, so we split carefully.
    const stmts = sql
      .split(/;\s*\n/)              // split on semicolon + newline
      .map(s => s.trim())
      .filter(Boolean);
    for (const stmt of stmts) {
      // Also handle the remaining semicolons within a single statement block
      const subStmts = stmt.split(';').map(s => s.trim()).filter(Boolean);
      for (const sub of subStmts) {
        try {
          db.exec(sub + ';');
        } catch (e: any) {
          // Swallow migration errors for columns that already exist
          if (e.message?.includes('duplicate column')) continue;
          // Swallow "table already exists" from CREATE TABLE IF NOT EXISTS
          // (better-sqlite3 sometimes throws even with IF NOT EXISTS on re-exec)
          if (e.message?.includes('already exists')) continue;
          throw e;
        }
      }
    }
  },

  runSync(sql: string, params: any[] = []) {
    const info = live().prepare(sql).run(...params);
    return { lastInsertRowId: info.lastInsertRowid as number, changes: info.changes };
  },

  getFirstSync(sql: string, params: any[] = []) {
    return live().prepare(sql).get(...params) ?? null;
  },

  getAllSync(sql: string, params: any[] = []) {
    return live().prepare(sql).all(...params);
  },
};

const openDatabaseSync = (_name: string) => proxyDb;

export default { openDatabaseSync };
export { openDatabaseSync };
