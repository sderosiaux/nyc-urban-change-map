/**
 * Database connection and query utilities
 * Uses SQLite for local development
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import * as schema from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database file path - store in project root data folder
const DATA_DIR = process.env['DATA_DIR'] ?? join(__dirname, '..', '..', '..', '..', 'data');
const DB_PATH = process.env['DATABASE_PATH'] ?? join(DATA_DIR, 'ucm.db');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Create SQLite client
const sqlite = new Database(DB_PATH);

// Enable foreign keys and WAL mode for better performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export schema and types
export * from './schema.js';

// Close database connection
export function closeDatabase(): void {
  sqlite.close();
}

// Initialize database tables (for development without migrations)
export function initializeDatabase(): void {
  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      geometry_json TEXT NOT NULL,
      geometry_type TEXT NOT NULL,
      bin TEXT,
      bbl TEXT,
      address TEXT,
      borough TEXT,
      nta_code TEXT,
      nta_name TEXT,
      community_district TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_places_bin ON places(bin);
    CREATE INDEX IF NOT EXISTS idx_places_bbl ON places(bbl);
    CREATE INDEX IF NOT EXISTS idx_places_nta ON places(nta_code);
    CREATE INDEX IF NOT EXISTS idx_places_borough ON places(borough);
    CREATE INDEX IF NOT EXISTS idx_places_coords ON places(latitude, longitude);

    CREATE TABLE IF NOT EXISTS raw_events (
      id TEXT PRIMARY KEY,
      place_id TEXT REFERENCES places(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      source_id TEXT,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      raw_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_raw_events_place ON raw_events(place_id);
    CREATE INDEX IF NOT EXISTS idx_raw_events_source ON raw_events(source);
    CREATE INDEX IF NOT EXISTS idx_raw_events_type ON raw_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_raw_events_date ON raw_events(event_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_events_source_id ON raw_events(source, source_id);

    CREATE TABLE IF NOT EXISTS transformation_states (
      id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL UNIQUE REFERENCES places(id) ON DELETE CASCADE,
      intensity INTEGER NOT NULL DEFAULT 0,
      nature TEXT,
      certainty TEXT NOT NULL DEFAULT 'discussion',
      headline TEXT,
      one_liner TEXT,
      disruption_summary TEXT,
      disruption_start TEXT,
      disruption_end TEXT,
      visible_change_date TEXT,
      usage_change_date TEXT,
      event_count INTEGER DEFAULT 0,
      first_activity TEXT,
      last_activity TEXT,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transformation_intensity ON transformation_states(intensity);
    CREATE INDEX IF NOT EXISTS idx_transformation_certainty ON transformation_states(certainty);
    CREATE INDEX IF NOT EXISTS idx_transformation_nature ON transformation_states(nature);
    CREATE INDEX IF NOT EXISTS idx_transformation_disruption ON transformation_states(disruption_start, disruption_end);

    CREATE TABLE IF NOT EXISTS heatmap_cells (
      h3_index TEXT PRIMARY KEY,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      avg_intensity REAL,
      max_intensity INTEGER,
      place_count INTEGER,
      dominant_nature TEXT,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      last_sync TEXT,
      record_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'idle',
      error_message TEXT
    );
  `);
}
