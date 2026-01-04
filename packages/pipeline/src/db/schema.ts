/**
 * Database schema for Urban Change Map
 * Uses Drizzle ORM with SQLite
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// =============================================================================
// PLACES
// Stable geographic locations in the city
// =============================================================================

export const places = sqliteTable('places', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Geometry stored as GeoJSON text
  geometryJson: text('geometry_json', { mode: 'json' }).notNull(),
  geometryType: text('geometry_type').notNull(), // 'point' | 'polygon'

  // NYC identifiers
  bin: text('bin'),
  bbl: text('bbl'),
  address: text('address'),

  // Geography
  borough: text('borough'),
  ntaCode: text('nta_code'),
  ntaName: text('nta_name'),
  communityDistrict: text('community_district'),

  // Coordinates (for simpler queries)
  latitude: real('latitude'),
  longitude: real('longitude'),

  // Timestamps
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('idx_places_bin').on(table.bin),
  index('idx_places_bbl').on(table.bbl),
  index('idx_places_nta').on(table.ntaCode),
  index('idx_places_borough').on(table.borough),
  index('idx_places_coords').on(table.latitude, table.longitude),
]);

// =============================================================================
// RAW EVENTS
// Source data from DOB, ZAP, etc. (internal, never exposed directly)
// =============================================================================

export const rawEvents = sqliteTable('raw_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  placeId: text('place_id').references(() => places.id, { onDelete: 'cascade' }),

  // Source tracking
  source: text('source').notNull(), // 'dob' | 'zap' | 'capital'
  sourceId: text('source_id'),

  // Event details
  eventType: text('event_type').notNull(),
  eventDate: text('event_date').notNull(),

  // Raw data from source
  rawData: text('raw_data', { mode: 'json' }),

  // Timestamps
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('idx_raw_events_place').on(table.placeId),
  index('idx_raw_events_source').on(table.source),
  index('idx_raw_events_type').on(table.eventType),
  index('idx_raw_events_date').on(table.eventDate),
  uniqueIndex('idx_raw_events_source_id').on(table.source, table.sourceId),
]);

// =============================================================================
// TRANSFORMATION STATES
// Computed state per place - what the user sees
// =============================================================================

export const transformationStates = sqliteTable('transformation_states', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  placeId: text('place_id').references(() => places.id, { onDelete: 'cascade' }).notNull().unique(),

  // Core metrics
  intensity: integer('intensity').notNull().default(0),
  nature: text('nature'), // 'densification' | 'renovation' | etc.
  certainty: text('certainty').notNull().default('discussion'),

  // Human-readable narratives
  headline: text('headline'),
  oneLiner: text('one_liner'),
  disruptionSummary: text('disruption_summary'),

  // Impact phases
  disruptionStart: text('disruption_start'),
  disruptionEnd: text('disruption_end'),
  visibleChangeDate: text('visible_change_date'),
  usageChangeDate: text('usage_change_date'),

  // Data quality flags (0 = real data, 1 = estimated)
  isEstimatedStart: integer('is_estimated_start').default(0),
  isEstimatedEnd: integer('is_estimated_end').default(0),

  // Additional milestone dates (for detail pane)
  approvalDate: text('approval_date'),        // ZAP completed_date - when project was approved
  permitExpiration: text('permit_expiration'), // DOB expiration_date - when permit expires

  // Derived project status: 'planning' | 'approved' | 'active' | 'stalled' | 'completed'
  projectStatus: text('project_status').default('planning'),

  // Metadata
  eventCount: integer('event_count').default(0),
  firstActivity: text('first_activity'),
  lastActivity: text('last_activity'),

  // Computation tracking
  computedAt: text('computed_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('idx_transformation_intensity').on(table.intensity),
  index('idx_transformation_certainty').on(table.certainty),
  index('idx_transformation_nature').on(table.nature),
  index('idx_transformation_disruption').on(table.disruptionStart, table.disruptionEnd),
]);

// =============================================================================
// HEATMAP CELLS
// Pre-aggregated H3 hexagons for fast heatmap rendering
// =============================================================================

export const heatmapCells = sqliteTable('heatmap_cells', {
  h3Index: text('h3_index').primaryKey(),

  // Center point
  centerLat: real('center_lat').notNull(),
  centerLng: real('center_lng').notNull(),

  // Aggregated metrics
  avgIntensity: real('avg_intensity'),
  maxIntensity: integer('max_intensity'),
  placeCount: integer('place_count'),
  dominantNature: text('dominant_nature'),

  // Computation tracking
  computedAt: text('computed_at').default(sql`(datetime('now'))`).notNull(),
});

// =============================================================================
// DATA SOURCES
// Track sync status for each data source
// =============================================================================

export const dataSources = sqliteTable('data_sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  lastSync: text('last_sync'),
  recordCount: integer('record_count').default(0),
  status: text('status').default('idle'), // 'idle' | 'syncing' | 'error'
  errorMessage: text('error_message'),
});

// =============================================================================
// RELATIONS
// =============================================================================

export const placesRelations = relations(places, ({ many, one }) => ({
  rawEvents: many(rawEvents),
  transformationState: one(transformationStates),
}));

export const rawEventsRelations = relations(rawEvents, ({ one }) => ({
  place: one(places, {
    fields: [rawEvents.placeId],
    references: [places.id],
  }),
}));

export const transformationStatesRelations = relations(transformationStates, ({ one }) => ({
  place: one(places, {
    fields: [transformationStates.placeId],
    references: [places.id],
  }),
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;

export type RawEvent = typeof rawEvents.$inferSelect;
export type NewRawEvent = typeof rawEvents.$inferInsert;

export type TransformationState = typeof transformationStates.$inferSelect;
export type NewTransformationState = typeof transformationStates.$inferInsert;

export type HeatmapCell = typeof heatmapCells.$inferSelect;
export type NewHeatmapCell = typeof heatmapCells.$inferInsert;

export type DataSource = typeof dataSources.$inferSelect;
export type NewDataSource = typeof dataSources.$inferInsert;
