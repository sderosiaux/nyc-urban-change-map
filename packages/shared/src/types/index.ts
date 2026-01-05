/**
 * Core domain types for Urban Change Map
 * These types define the transformation-centric model from SPEC_REFINED.md
 */

// =============================================================================
// GEOMETRY TYPES
// =============================================================================

export interface Point {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface Polygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export type Geometry = Point | Polygon;

export interface Bounds {
  sw: [number, number]; // [lng, lat]
  ne: [number, number]; // [lng, lat]
}

// =============================================================================
// CERTAINTY MODEL
// From SPEC_REFINED: "The user must FEEL immediately: 'it could happen' vs
// 'it's very likely' vs 'it's already happening'"
// =============================================================================

export type Certainty = 'discussion' | 'probable' | 'certain';

export const CERTAINTY_LABELS: Record<Certainty, string> = {
  discussion: 'Under Review',
  probable: 'Likely',
  certain: 'In Progress',
};

export const CERTAINTY_DESCRIPTIONS: Record<Certainty, string> = {
  discussion: 'This project is under review, nothing is decided yet',
  probable: 'This project is approved and should proceed',
  certain: 'Construction is in progress or completed',
};

// =============================================================================
// TRANSFORMATION NATURE
// What kind of change is happening at this place?
// =============================================================================

export type TransformationNature =
  | 'densification'    // New buildings, added floors
  | 'renovation'       // Major alterations, facade work
  | 'infrastructure'   // Roads, parks, utilities
  | 'demolition'       // Teardowns
  | 'mixed';           // Multiple types

export const NATURE_LABELS: Record<TransformationNature, string> = {
  densification: 'Densification',
  renovation: 'Renovation',
  infrastructure: 'Infrastructure',
  demolition: 'Demolition',
  mixed: 'Mixed',
};

// =============================================================================
// PROJECT STATUS
// Derived status based on real dates and events
// =============================================================================

export type ProjectStatus = 'planning' | 'approved' | 'active' | 'stalled' | 'completed';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  approved: 'Approved',
  active: 'Active',
  stalled: 'Stalled',
  completed: 'Completed',
};

export const PROJECT_STATUS_DESCRIPTIONS: Record<ProjectStatus, string> = {
  planning: 'Project is in planning phase',
  approved: 'Project is approved but construction has not started',
  active: 'Construction is in progress',
  stalled: 'Permit expired before completion',
  completed: 'Construction is complete',
};

// =============================================================================
// PLACE
// A stable geographic location in the city
// =============================================================================

export interface Place {
  id: string;
  geometry: Geometry;
  geometryType: 'point' | 'polygon';
  bin?: string;                    // Building Identification Number
  bbl?: string;                    // Borough-Block-Lot
  address?: string;
  borough: string;
  ntaCode?: string;                // Neighborhood Tabulation Area
  ntaName?: string;
  communityDistrict?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// TRANSFORMATION STATE
// The derived state of a place - what the user sees
// This is computed from raw events but never shows events directly
// =============================================================================

export interface ImpactPhases {
  disruption?: {
    start: Date;
    end: Date;
  };
  visibleChange?: Date;
  usageChange?: Date;
}

export interface TransformationState {
  id: string;
  placeId: string;

  // Core metrics
  intensity: number;               // 0-100
  nature: TransformationNature;
  certainty: Certainty;

  // Human-readable narratives
  headline: string;                // "2 nouveaux immeubles en construction"
  oneLiner: string;                // "2 immeubles + 1 démolition"
  disruptionSummary?: string;      // "Perturbations attendues de 2024 à 2027"

  // Impact phases (when user will feel it)
  phases: ImpactPhases;

  // Metadata
  eventCount: number;
  firstActivity?: Date;
  lastActivity?: Date;
  computedAt: Date;
}

// =============================================================================
// RAW EVENTS (internal, never exposed directly)
// =============================================================================

export type EventSource = 'dob' | 'dob-now' | 'dob-violations' | 'dob-complaints' | 'zap' | 'capital' | 'ceqr';

export type EventType =
  // DOB permit types
  | 'new_building'
  | 'major_alteration'
  | 'minor_alteration'
  | 'demolition'
  | 'scaffold'
  | 'equipment_work'
  | 'plumbing'
  | 'mechanical'
  // ZAP types
  | 'ulurp_filed'
  | 'ulurp_approved'
  | 'ulurp_denied'
  | 'zap_filed'
  | 'zap_approved'
  // CEQR types
  | 'ceqr_eas'           // Environmental Assessment Statement
  | 'ceqr_eis_draft'     // Draft Environmental Impact Statement
  | 'ceqr_eis_final'     // Final Environmental Impact Statement
  | 'ceqr_completed'     // CEQR review completed
  // Other
  | 'capital_project'
  | 'construction_started'
  | 'construction_completed'
  | 'other';

export interface RawEvent {
  id: string;
  placeId: string;
  source: EventSource;
  sourceId?: string;
  eventType: EventType;
  eventDate: Date;
  rawData?: Record<string, unknown>;
  createdAt: Date;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface PlaceFeature {
  type: 'Feature';
  id: string;
  geometry: Geometry;
  properties: {
    id: string;
    intensity: number;
    certainty: Certainty;
    nature: TransformationNature;
    headline: string;
    hasZap?: boolean;
    disruptionEnd?: string;
  };
}

export interface PlacesGeoJSON {
  type: 'FeatureCollection';
  features: PlaceFeature[];
  meta: {
    total: number;
    clustered: boolean;
    timeMode: TimeMode;
  };
}

export interface PlaceDetail {
  id: string;
  place: {
    address?: string;
    neighborhood?: string;
    borough: string;
  };
  geometry: Geometry;
  transformation?: {
    intensity: number;
    nature?: TransformationNature;
    certainty?: Certainty;
    headline?: string;
    oneLiner?: string;
    disruptionSummary?: string;
    // Timeline dates
    disruptionStart?: string;
    disruptionEnd?: string;
    visibleChangeDate?: string;
    usageChangeDate?: string;
    // Data quality flags
    isEstimatedStart?: boolean;
    isEstimatedEnd?: boolean;
    // Milestone dates
    approvalDate?: string;      // ZAP approval date
    permitExpiration?: string;  // DOB permit expiration
    // Project status
    projectStatus?: ProjectStatus;
    // Activity info
    eventCount?: number;
    firstActivity?: string;
    lastActivity?: string;
  };
  sources?: SourceSummary[];
  propertyDetails?: PropertyDetails;
}

export interface SourceSummary {
  sourceType: string;
  sourceId?: string;        // Project ID, Job number, etc.
  description: string;
  agency?: string;          // Managing agency
  projectType?: string;     // Category/type
  filedDate?: string;
  dateLabel?: string;       // "Filed", "Projected start", etc.
  officialUrl?: string;
  // DOB NOW enrichment (fetched from API)
  dobNowDetails?: {
    bin?: string;
    address?: string;
    borough?: string;
    owner?: string;
    designProfessional?: string;
    jobStatus?: string;
    filingStatus?: string;
    jobType?: string;
    floors?: string;
  };
  // DOB Complaint enrichment
  complaintDetails?: {
    status: string;                    // OPEN, CLOSED
    category: string;                  // Human-readable category
    categoryCode: string;              // e.g., "8A", "91"
    disposition?: string;              // Human-readable disposition
    dispositionCode?: string;          // e.g., "I2", "AF"
    inspectionDate?: string;
    dispositionDate?: string;
  };
  // ZAP project enrichment
  zapDetails?: {
    projectName: string;
    projectBrief?: string;
    publicStatus: string;              // "In Public Review", "Filed", "Complete"
    isUlurp: boolean;
    actions?: string[];                // ["ZM", "ZR", "ZS", "LD"]
    ulurpNumbers?: string[];           // ["C240271ZMK", "N240272ZRK"]
    ceqrNumber?: string;
    currentMilestone?: string;
    currentMilestoneDate?: string;
    certifiedDate?: string;
    applicant?: string;
    applicantType?: string;            // "Private", "City"
    communityDistrict?: string;
  };
}

// =============================================================================
// PROPERTY DETAILS (from DOB NOW Property Details API)
// =============================================================================

export interface PropertyDetails {
  // Identifiers
  bin: string;
  bbl: string;                      // Derived: {borough}{block:5}{lot:4}
  borough: number;                  // 1=Manhattan, 2=Bronx, 3=Brooklyn, 4=Queens, 5=Staten Island
  taxBlock: number;
  taxLot: number;

  // Address
  houseNumber?: string;
  streetName?: string;
  zip?: string;
  crossStreets?: string[];          // Nearby cross streets

  // Building characteristics
  occupancy?: string;               // e.g., "F5-Factory/Industrial"
  buildingsOnLot?: number;
  vacant?: boolean;
  cityOwned?: boolean;
  condo?: boolean;

  // Special designations
  specialArea?: string;             // e.g., "IBZ - Industrial Business Zone"
  specialDistrict?: string;
  landmarkStatus?: string;
  floodZone?: boolean;              // Special Flood Hazard Area
  coastalErosion?: boolean;
  freshwaterWetlands?: boolean;
  tidalWetlands?: boolean;

  // Regulatory flags
  sroRestricted?: boolean;          // Single Room Occupancy
  loftLaw?: boolean;
  antiHarassment?: boolean;

  // Violation flags
  hasClass1Violation?: boolean;
  hasStopWork?: boolean;
  hasPadlock?: boolean;
  hasVacateOrder?: boolean;
  filingOnHold?: boolean;
  approvalOnHold?: boolean;

  // Administrative
  communityBoard?: string;
  censusTract?: number;
}

export interface HeatmapCell {
  h3Index: string;
  boundary: number[][];
  avgIntensity: number;
  maxIntensity: number;
  placeCount: number;
  dominantNature: TransformationNature;
}

export interface HeatmapResponse {
  cells: HeatmapCell[];
  meta: {
    resolution: number;
    bounds: Bounds;
  };
}

// =============================================================================
// FILTER & UI TYPES
// =============================================================================

export type TimeMode = 'past' | 'now' | 'future';

export const TIME_MODE_LABELS: Record<TimeMode, string> = {
  past: 'Past',
  now: 'Now',
  future: 'Future',
};

export const TIME_MODE_DESCRIPTIONS: Record<TimeMode, string> = {
  past: 'What has changed',
  now: 'Currently transforming',
  future: 'What is planned',
};

export interface MapFilters {
  bounds: Bounds;
  zoom: number;
  minIntensity: number;
  certainties?: Certainty[];
  timeMode: TimeMode;
  selectedYear?: number;
}

// =============================================================================
// NEIGHBORHOOD AGGREGATES
// =============================================================================

export interface NeighborhoodStats {
  ntaCode: string;
  ntaName: string;
  borough: string;
  placeCount: number;
  avgIntensity: number;
  maxIntensity: number;
  dominantNature: TransformationNature;
  activeTransformations: number;
}
