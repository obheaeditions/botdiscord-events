import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign key support
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    start_date TEXT NOT NULL,     -- Date de début
    end_date TEXT,                -- Date de fin (optionnel)
    start_time TEXT NOT NULL,     -- Heure de début (format HH:MM)
    end_time TEXT,                -- Heure de fin (format HH:MM, optionnel)
    duration TEXT NOT NULL,       -- Durée au format HH:MM
    desc_short TEXT NOT NULL,
    desc_org TEXT NOT NULL,
    channels TEXT NOT NULL,       -- JSON array of channel IDs
    roles TEXT NOT NULL,          -- JSON array of role IDs (empty list = open access)
    images TEXT NOT NULL,         -- JSON array of image paths
    documents TEXT NOT NULL,      -- JSON array of doc paths
    links TEXT NOT NULL,          -- JSON array of link URLs
    is_pinned INTEGER DEFAULT 0,  -- 0 or 1
    is_pinged INTEGER DEFAULT 0,  -- 0 or 1
    is_blocked INTEGER DEFAULT 0, -- 0 or 1 (1 = registrations closed)
    discord_messages TEXT NOT NULL -- JSON object mapping channel_id -> message_id
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE(event_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
`);

// Add previous_status column if it does not exist (migration support)
try {
  db.exec('ALTER TABLE registrations ADD COLUMN previous_status TEXT');
} catch (err) {
  // Column already exists, ignore error
}

// Add source/email columns to track registrations coming from the public Facebook page
try {
  db.exec("ALTER TABLE registrations ADD COLUMN source TEXT DEFAULT 'discord'");
} catch (err) {
  // Column already exists, ignore error
}

try {
  db.exec('ALTER TABLE registrations ADD COLUMN email TEXT');
} catch (err) {
  // Column already exists, ignore error
}

// Add facebook_post_id column to track the published Facebook photo post per event
try {
  db.exec('ALTER TABLE events ADD COLUMN facebook_post_id TEXT');
} catch (err) {
  // Column already exists, ignore error
}

// Add publish_facebook column: per-event opt-in for Facebook publication (off by default, Discord stays mandatory)
try {
  db.exec('ALTER TABLE events ADD COLUMN publish_facebook INTEGER DEFAULT 0');
} catch (err) {
  // Column already exists, ignore error
}

export default db;
