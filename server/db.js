const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'tourism.db');
const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS provinces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  province_code TEXT NOT NULL,
  lat REAL, lng REAL
);
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('scenic','food','activity')),
  name TEXT NOT NULL,
  city_code TEXT NOT NULL,
  category TEXT,
  summary TEXT,
  address TEXT,
  lat REAL, lng REAL,
  cover TEXT,
  tags TEXT,
  body TEXT,
  official_score REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS dimensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL,
  dimension TEXT NOT NULL,
  score REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  cover TEXT,
  type TEXT
);
CREATE TABLE IF NOT EXISTS topic_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  place_id INTEGER NOT NULL,
  rank INTEGER
);
CREATE TABLE IF NOT EXISTS user_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  place_id INTEGER NOT NULL,
  recommend TEXT NOT NULL CHECK(recommend IN ('worthit','general','no')),
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (visitor_id, place_id)
);
CREATE TABLE IF NOT EXISTS review_dimensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,
  dimension TEXT NOT NULL,
  score REAL NOT NULL CHECK(score BETWEEN 1 AND 5)
);
`);

module.exports = db;