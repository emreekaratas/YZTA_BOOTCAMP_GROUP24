import { createClient } from "@libsql/client";

const dbUrl = process.env.TURSO_DATABASE_URL || "file:./data/lokal.db";

export const db = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Hem orijinal db.execute metodunu hem de eski .prepare() çağrılarını destekleyen güvenli getDb
export function getDb() {
  return {
    ...db,
    execute: db.execute.bind(db),
    executeMultiple: db.executeMultiple.bind(db),
    prepare(sql: string) {
      return {
        async get(...args: any[]) {
          const res = await db.execute({ sql, args });
          return res.rows[0] || undefined;
        },
        async all(...args: any[]) {
          const res = await db.execute({ sql, args });
          return res.rows;
        },
        async run(...args: any[]) {
          return await db.execute({ sql, args });
        },
      };
    },
  };
}

export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL,
      image TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expiresAt TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL REFERENCES user(id)
    );

    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id),
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt TEXT,
      refreshTokenExpiresAt TEXT,
      scope TEXT,
      password TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      auth_id TEXT,
      avatar_path TEXT,
      home_district TEXT,
      birth_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      raw_text TEXT NOT NULL,
      parsed_location TEXT,
      parsed_mood TEXT,
      parsed_companion TEXT,
      parsed_time TEXT,
      parsed_budget TEXT,
      target_date TEXT,
      parsed_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_id INTEGER NOT NULL REFERENCES queries(id),
      layer TEXT NOT NULL CHECK (layer IN ('ticketed','free','venue','experience')),
      title TEXT NOT NULL,
      meta TEXT,
      reason_text TEXT,
      source_url TEXT,
      steps_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_id INTEGER NOT NULL REFERENCES suggestions(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      went INTEGER NOT NULL DEFAULT 1,
      liked INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profile_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      summary_text TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      suggestion_id INTEGER REFERENCES suggestions(id),
      content TEXT,
      image_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER NOT NULL REFERENCES posts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      meta TEXT,
      layer TEXT NOT NULL CHECK (layer IN ('ticketed','free')),
      source_url TEXT,
      event_date TEXT NOT NULL,
      location TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (title, event_date)
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id INTEGER NOT NULL REFERENCES users(id),
      friend_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      post_id INTEGER,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      suggestion_id INTEGER NOT NULL REFERENCES suggestions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, suggestion_id)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (group_id, user_id)
    );
  `);

  // Mevcut lokal veritabanında sütunlar eksikse otomatik olarak ekle
  try { await db.execute("ALTER TABLE users ADD COLUMN avatar_path TEXT;"); } catch (e) {}
  try { await db.execute("ALTER TABLE users ADD COLUMN home_district TEXT;"); } catch (e) {}
  try { await db.execute("ALTER TABLE users ADD COLUMN birth_date TEXT;"); } catch (e) {}
}