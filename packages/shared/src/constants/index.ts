/**
 * Constants for Urban Change Map
 * Scoring weights, thresholds, and configuration
 */

import type { EventType, Certainty, TransformationNature } from '../types/index.js';

// =============================================================================
// INTENSITY SCORING
// From SPEC_INITIALE.md Section 8.1
// =============================================================================

export const INTENSITY_WEIGHTS: Record<EventType, number> = {
  // Minor works (low impact)
  scaffold: 3,
  equipment_work: 3,
  plumbing: 5,
  mechanical: 5,

  // Alterations (medium impact)
  minor_alteration: 10,  // A2 - cumulative
  major_alteration: 30,  // A1

  // Major transformations (high impact)
  demolition: 35,
  new_building: 50,

  // Planning signals
  zap_filed: 8,
  zap_approved: 20,
  ulurp_filed: 10,
  ulurp_approved: 25,
  ulurp_denied: 0,

  // CEQR signals (environmental review)
  ceqr_eas: 12,          // EAS filed - early signal
  ceqr_eis_draft: 18,    // Draft EIS - significant project
  ceqr_eis_final: 22,    // Final EIS - approved
  ceqr_completed: 15,    // Review complete

  // Public projects
  capital_project: 25,

  // Status changes
  construction_started: 0,  // Already counted via permit
  construction_completed: 0,
  other: 0,
};

export const MAX_INTENSITY = 100;

// =============================================================================
// MATURITY THRESHOLDS
// From SPEC_INITIALE.md Section 8.2
// =============================================================================

export interface MaturityLevel {
  label: string;
  min: number;
  max: number;
  color: string;
}

export const MATURITY_LEVELS: MaturityLevel[] = [
  { label: 'Stable', min: 0, max: 20, color: '#94a3b8' },      // slate-400
  { label: 'Frictions', min: 20, max: 50, color: '#fbbf24' },  // amber-400
  { label: 'Transformation', min: 50, max: 80, color: '#f97316' }, // orange-500
  { label: 'Mutation', min: 80, max: 100, color: '#dc2626' },  // red-600
];

export function getMaturityLevel(intensity: number): MaturityLevel {
  return MATURITY_LEVELS.find(l => intensity >= l.min && intensity < l.max)
    ?? MATURITY_LEVELS[MATURITY_LEVELS.length - 1]!;
}

// =============================================================================
// CERTAINTY DERIVATION
// =============================================================================

export const CERTAINTY_SIGNALS: Record<Certainty, EventType[]> = {
  certain: [
    'construction_started',
    'construction_completed',
  ],
  probable: [
    'new_building',      // Permit issued means approved
    'major_alteration',
    'demolition',
    'zap_approved',
    'ulurp_approved',
  ],
  discussion: [
    'ulurp_filed',
    'zap_filed',
  ],
};

// =============================================================================
// NATURE DERIVATION
// =============================================================================

export const NATURE_SIGNALS: Record<TransformationNature, EventType[]> = {
  densification: ['new_building'],
  renovation: ['major_alteration', 'minor_alteration', 'mechanical', 'plumbing'],
  demolition: ['demolition'],
  infrastructure: ['capital_project'],
  mixed: [], // Derived when multiple natures present
};

// =============================================================================
// DOB JOB TYPE MAPPING
// =============================================================================

export const DOB_JOB_TYPE_MAP: Record<string, EventType> = {
  NB: 'new_building',
  A1: 'major_alteration',
  A2: 'minor_alteration',
  DM: 'demolition',
  SG: 'scaffold',
  EW: 'equipment_work',
  PL: 'plumbing',
  OT: 'other',
};

// =============================================================================
// IMPACT PHASE ESTIMATION
// Default durations in months
// =============================================================================

export const IMPACT_ESTIMATION = {
  // Time from permit issued to construction start
  permitToConstructionMonths: 6,

  // Default construction duration if not specified
  defaultConstructionMonths: 24,

  // Time from completion to full occupancy
  completionToUsageMonths: 6,
};

// =============================================================================
// HEATMAP CONFIGURATION
// =============================================================================

export const HEATMAP_CONFIG = {
  // H3 resolution levels
  resolutionCity: 7,     // ~5.16 km² - city overview
  resolutionNeighborhood: 8,  // ~0.74 km² - neighborhood level
  resolutionBlock: 9,    // ~0.11 km² - block level

  // Default resolution
  defaultResolution: 8,
};

// =============================================================================
// DISPLAY CONFIGURATION
// =============================================================================

export const DISPLAY_CONFIG = {
  // Zoom thresholds for display modes
  zoomHeatmapMax: 12,
  zoomClusterMax: 15,

  // Max points before forcing clusters
  maxPointsBeforeCluster: 100,

  // Cluster radius in pixels
  clusterRadius: 50,

  // Default intensity filter (0 = show all)
  defaultMinIntensity: 0,
};

// =============================================================================
// NYC GEOGRAPHY
// =============================================================================

export const NYC_BOROUGHS = [
  'Manhattan',
  'Brooklyn',
  'Queens',
  'Bronx',
  'Staten Island',
] as const;

export type Borough = typeof NYC_BOROUGHS[number];

export const NYC_BOUNDS = {
  sw: [-74.2591, 40.4774] as [number, number],
  ne: [-73.7004, 40.9176] as [number, number],
};

export const NYC_CENTER = [-73.9857, 40.7484] as [number, number];
export const NYC_DEFAULT_ZOOM = 11;

// =============================================================================
// API CONFIGURATION
// =============================================================================

export const NYC_OPEN_DATA_BASE = 'https://data.cityofnewyork.us/resource';

export const NYC_DATA_ENDPOINTS = {
  // ==========================================================================
  // DOB - Department of Buildings (Travaux et Permis)
  // ==========================================================================
  dobPermits: `${NYC_OPEN_DATA_BASE}/ipu4-2q9a.json`,      // DOB Permit Issuance - historical (ends 2020)
  dobNow: `${NYC_OPEN_DATA_BASE}/w9ak-ipjd.json`,          // DOB NOW: Job Filings (active, has dates)
  dobComplaints: `${NYC_OPEN_DATA_BASE}/eabe-havv.json`,   // DOB Complaints
  dobViolations: `${NYC_OPEN_DATA_BASE}/3h2n-5cm9.json`,   // DOB/ECB Violations

  // ==========================================================================
  // Planning (Planification Urbaine)
  // ==========================================================================
  zapProjects: `${NYC_OPEN_DATA_BASE}/hgx4-8ukb.json`,     // ZAP - Zoning Applications
  zapBbl: `${NYC_OPEN_DATA_BASE}/2iga-a6mk.json`,          // ZAP BBL - Project to BBL mapping
  capitalProjects: `${NYC_OPEN_DATA_BASE}/h2ic-zdws.json`, // CPDB - Capital Projects
  ceqrProjects: `${NYC_OPEN_DATA_BASE}/gezn-7mgk.json`,    // CEQR Projects
  ceqrMilestones: `${NYC_OPEN_DATA_BASE}/8fj8-3sgg.json`,  // CEQR Project Milestones

  // ==========================================================================
  // Property & Context (Géographie et Contexte)
  // ==========================================================================
  pluto: `${NYC_OPEN_DATA_BASE}/64uk-42ks.json`,           // PLUTO - property data
  pad: `${NYC_OPEN_DATA_BASE}/bc8t-ecyu.json`,             // PAD - address directory

  // ==========================================================================
  // Boundaries (Frontières Administratives)
  // ==========================================================================
  ntas: `${NYC_OPEN_DATA_BASE}/9nt8-h7nd.json`,            // NTAs 2020
  communityDistricts: `${NYC_OPEN_DATA_BASE}/jp9i-3b7y.json`, // Community Districts
  boroughs: `${NYC_OPEN_DATA_BASE}/7t3b-ywvw.json`,        // Borough Boundaries
};
