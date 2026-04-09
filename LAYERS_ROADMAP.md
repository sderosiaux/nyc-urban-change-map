# NYC Urban Quality Map — Layers Roadmap

> Vision: SimCity-like experience for exploring NYC building and neighborhood quality

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NYC URBAN QUALITY MAP                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Building │ │ Safety  │ │ Transit │ │  Env    │ │Economic │   │
│  │ Quality │ │         │ │ Access  │ │ Quality │ │         │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       │           │           │           │           │         │
│       ▼           ▼           ▼           ▼           ▼         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              UNIFIED QUALITY SCORE (0-100)              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Milestones

| # | Milestone | Description | Priority | Est. Effort |
|---|-----------|-------------|----------|-------------|
| M1 | **Building Quality Layer** | HPD violations, complaints, rent stabilization | P0 | Large |
| M2 | **Safety & Quality of Life** | 311 complaints, crime, noise | P0 | Medium |
| M3 | **Transit Access Layer** | Subway, bus, bike accessibility | P1 | Medium |
| M4 | **Environmental Layer** | Air quality, flood zones, noise | P1 | Small |
| M5 | **Economic Layer** | Property values, sales, taxes | P2 | Medium |
| M6 | **Unified Quality Score** | Combine all layers into single score | P2 | Medium |
| M7 | **UI Layer Controls** | Toggle layers, customize weights | P2 | Medium |

---

# Milestone 1: Building Quality Layer

## Objective
Show the physical condition and tenant protection status of every building in NYC.

## Data Sources

| Source | Endpoint | Records | Key Fields |
|--------|----------|---------|------------|
| HPD Violations | `wvxf-dwi5` | 4M+ | Class A/B/C, BIN, BBL, Status |
| HPD Complaints | `ygpa-z7cr` | 13M+ | MajorCategory, Status, BIN |
| Rent Stabilization | NYCDB `rentstab` | ~1M | Unit counts by BBL |
| Evictions Executed | `6z8x-wfk4` | 105K | Address, BIN, Date |
| HPD Registrations | `tesw-yqqr` | ~300K | Owner info, contacts |
| HPD Litigations | `59kj-x8nc` | ~50K | Case status, type |
| Building Age | PLUTO `YearBuilt` | Already have | Construction year |

## Building Quality Score Formula

```typescript
interface BuildingQualityScore {
  score: number;  // 0-100, higher = better

  components: {
    // Physical Condition (40% weight)
    physical: {
      violationScore: number;    // Based on HPD violations
      complaintScore: number;    // Based on HPD complaints
      ageScore: number;          // Newer = slightly better
    };

    // Tenant Protection (30% weight)
    protection: {
      rentStabilized: boolean;
      evictionRisk: number;      // Based on neighborhood eviction rate
      speculationRisk: boolean;  // On HPD watch list
    };

    // Maintenance Quality (30% weight)
    maintenance: {
      openViolations: number;
      avgResolutionTime: number;
      litigationHistory: boolean;
    };
  };
}
```

## Scoring Logic

### HPD Violations Score (0-100)
```
Base: 100
- Class C violation (immediately hazardous): -15 per open
- Class B violation (hazardous): -5 per open
- Class A violation (non-hazardous): -1 per open
- Closed violations: -0.5 (history matters but less)
- "Rent impairing" violations: additional -10

Floor: 0
```

### HPD Complaints Score (0-100)
```
Base: 100
- Open complaint: -3 per complaint
- HEAT/HOT WATER complaint: -10 (critical)
- Complaints in last 12 months: weighted 2x
- Complaints resolved quickly (<30 days): +1 back

Floor: 0
```

### Eviction Risk Score (0-100)
```
Base: 100
- Eviction executed at this building: -30
- Evictions in same ZIP (per 1000 units): scaled -1 to -20
- Building on speculation watch list: -20
```

## Implementation Plan

### Phase 1: Data Ingestion (Week 1)
```
Task 1.1: Create hpd-violations.ts ingest
  - Fetch from Socrata API with pagination
  - Normalize to our event format
  - Store with BIN/BBL indexes

Task 1.2: Create hpd-complaints.ts ingest
  - Fetch merged complaints + problems dataset
  - Map MajorCategory to our categories
  - Handle 13M+ records efficiently (batch)

Task 1.3: Create evictions.ts ingest
  - Fetch executed evictions
  - Link to places by BIN

Task 1.4: Integrate rent stabilization data
  - Download from NYCDB or RGB
  - Parse unit counts by BBL
  - Store as building attribute
```

### Phase 2: Score Computation (Week 2)
```
Task 2.1: Add BuildingQualityScore type to shared
Task 2.2: Create compute/building-quality.ts
  - Aggregate violations by building
  - Aggregate complaints by building
  - Compute component scores
  - Compute weighted total

Task 2.3: Add building_quality table to schema
  - place_id, score, components (JSON), computed_at

Task 2.4: Update compute job to include building quality
```

### Phase 3: API & Frontend (Week 3)
```
Task 3.1: Add /places/:id/quality endpoint
Task 3.2: Add quality score to place list response
Task 3.3: Create BuildingQualityBadge component
Task 3.4: Add quality filter to map (show only 70+)
Task 3.5: Create BuildingQualityDetail panel
```

## Files to Create/Modify

```
packages/pipeline/src/ingest/
  ├── hpd-violations.ts      # NEW
  ├── hpd-complaints.ts      # NEW
  ├── evictions.ts           # NEW
  └── rent-stabilization.ts  # NEW

packages/pipeline/src/compute/
  └── building-quality.ts    # NEW

packages/shared/src/types/
  └── building-quality.ts    # NEW

packages/api/src/routes/
  └── places.ts              # MODIFY - add quality endpoint

packages/web/src/components/
  ├── BuildingQualityBadge.tsx   # NEW
  └── BuildingQualityDetail.tsx  # NEW
```

## Visual Design

```
Building Quality Badge:
┌──────────────────┐
│  Quality: 78/100 │
│  ████████░░ Good │
└──────────────────┘

Colors:
  90-100: 🟢 Excellent (#22c55e)
  70-89:  🟢 Good (#84cc16)
  50-69:  🟡 Fair (#eab308)
  30-49:  🟠 Poor (#f97316)
  0-29:   🔴 Critical (#ef4444)
```

## Heatmap Layer

```
Building Quality Heatmap:
- Aggregate scores by H3 cell (resolution 9)
- Color gradient: Red (low) → Yellow → Green (high)
- Show average score in cell tooltip
```

---

# Milestone 2: Safety & Quality of Life Layer

## Objective
Show neighborhood safety and livability based on 311 complaints, crime data, and quality-of-life indicators.

## Data Sources

| Source | Endpoint | Records | Key Fields |
|--------|----------|---------|------------|
| 311 Complaints | `erm2-nwe9` | 30M+ | Type, Status, Location, Date |
| 311 Noise | `p5f6-bkga` | 600K+/year | Noise type, Location |
| NYPD Complaints | `5uac-w243` | ~500K/year | Offense, Location |
| NYPD Arrests | `8h9b-rp9u` | ~200K/year | Charge, Location |
| NYPD Shooting | `833y-fsy8` | ~2K/year | Location, Outcome |

## Quality of Life Score Formula

```typescript
interface QualityOfLifeScore {
  score: number;  // 0-100, higher = better

  components: {
    // Safety (40% weight)
    safety: {
      crimeRate: number;         // Per capita
      violentCrimeRate: number;  // Weighted higher
      shootingIncidents: number;
    };

    // Noise & Nuisance (30% weight)
    noise: {
      noiseComplaints: number;   // Per 1000 residents
      constructionNoise: number;
      residentialNoise: number;
    };

    // Cleanliness & Order (30% weight)
    cleanliness: {
      sanitationComplaints: number;
      rodentComplaints: number;
      graffitiComplaints: number;
    };
  };
}
```

## 311 Categories Mapping

```typescript
const QOL_CATEGORIES = {
  noise: [
    'Noise - Residential',
    'Noise - Street/Sidewalk',
    'Noise - Commercial',
    'Noise - Vehicle',
    'Noise - Helicopter',
  ],
  sanitation: [
    'Dirty Conditions',
    'Sanitation Condition',
    'Missed Collection',
    'Overflowing Litter Baskets',
  ],
  safety: [
    'Illegal Parking',
    'Blocked Driveway',
    'Street Light Condition',
    'Traffic Signal Condition',
  ],
  pest: [
    'Rodent',
    'Pest Control',
  ],
  housing: [
    'HEAT/HOT WATER',
    'PLUMBING',
    'ELECTRIC',
    'Elevator',
  ],
};
```

## Implementation Plan

### Phase 1: 311 Data Ingestion (Week 1)
```
Task 1.1: Create 311-complaints.ts ingest
  - Fetch with date range filtering
  - 30M+ records = need streaming/batching
  - Store aggregated by location (not individual)

Task 1.2: Create aggregation strategy
  - Aggregate by H3 cell (resolution 9)
  - Store counts by category per cell
  - Update daily/weekly

Task 1.3: Create 311 noise specialized ingest
  - Higher granularity for noise data
  - Time-of-day analysis (nighttime = worse)
```

### Phase 2: Crime Data Ingestion (Week 2)
```
Task 2.1: Create nypd-complaints.ts ingest
  - Fetch NYPD complaint data
  - Categorize by offense type
  - Aggregate by precinct/H3

Task 2.2: Create crime rate computation
  - Normalize by population (Census data)
  - Weight violent crimes higher
  - Time decay (recent = more relevant)
```

### Phase 3: Score Computation (Week 2-3)
```
Task 3.1: Add QualityOfLifeScore type
Task 3.2: Create compute/quality-of-life.ts
Task 3.3: Add qol_scores table (by H3 cell)
Task 3.4: Implement scoring algorithm
```

### Phase 4: API & Frontend (Week 3)
```
Task 4.1: Add /neighborhoods/:h3/quality endpoint
Task 4.2: Create QualityOfLife heatmap layer
Task 4.3: Add layer toggle in UI
Task 4.4: Create NeighborhoodQualityPanel
```

## Files to Create/Modify

```
packages/pipeline/src/ingest/
  ├── 311-complaints.ts       # NEW
  ├── 311-noise.ts            # NEW (specialized)
  └── nypd-complaints.ts      # NEW

packages/pipeline/src/compute/
  └── quality-of-life.ts      # NEW

packages/pipeline/src/db/schema.ts
  └── Add: qol_cell_scores table

packages/web/src/components/
  ├── QualityOfLifeLayer.tsx  # NEW (heatmap)
  └── NeighborhoodPanel.tsx   # NEW
```

## Visual Design

```
QoL Heatmap Layer:
┌─────────────────────────────┐
│  Neighborhood Quality       │
│  ┌─────────────────────┐    │
│  │ 🟢🟢🟡🟡🟠🔴🔴    │    │
│  │ 🟢🟢🟡🟡🟠🔴🔴    │    │
│  │ 🟢🟡🟡🟡🟠🟠🔴    │    │
│  └─────────────────────┘    │
│                             │
│  Legend:                    │
│  🟢 Safe & Quiet            │
│  🟡 Average                 │
│  🔴 High Activity           │
└─────────────────────────────┘
```

---

# Milestone 3: Transit Access Layer

## Objective
Show how well-connected each location is to public transit, with accessibility info.

## Data Sources

| Source | Endpoint | Records | Key Fields |
|--------|----------|---------|------------|
| MTA Subway Stations | `5f5g-n3cz` | 424 | Location, Lines, ADA |
| MTA Bus Stops | MTA GTFS | ~16K | Location, Routes |
| MTA Elevators | MTA API | ~400 | Status, Station |
| Citibike Stations | Citibike API | ~1800 | Location, Capacity |
| PATH Stations | - | 13 | Location |

## Transit Score Formula

```typescript
interface TransitScore {
  score: number;  // 0-100, higher = better

  components: {
    // Subway Access (50% weight)
    subway: {
      nearestStation: number;     // meters
      walkTime: number;           // minutes
      linesAvailable: string[];   // A, C, E, etc.
      expressAccess: boolean;     // Express trains
      isAccessible: boolean;      // ADA compliant
    };

    // Bus Access (25% weight)
    bus: {
      stopsWithin400m: number;
      routesAvailable: number;
      selectBusService: boolean;  // SBS = faster
    };

    // Bike Infrastructure (15% weight)
    bike: {
      citibikeStations: number;   // within 400m
      bikeLanes: boolean;         // protected lanes nearby
    };

    // Accessibility (10% weight)
    accessibility: {
      accessibleSubway: boolean;
      elevatorStatus: 'working' | 'outage' | 'none';
      accessibleBusStops: number;
    };
  };
}
```

## Scoring Logic

### Subway Score (0-100)
```
Distance to nearest station:
  < 400m (5 min walk):  100
  400-800m (10 min):    75
  800-1200m (15 min):   50
  1200-1600m (20 min):  25
  > 1600m:              0

Bonuses:
  + 10 for express access
  + 5 per additional line (max +20)
  + 10 for ADA accessibility
```

### Bus Score (0-100)
```
Stops within 400m:
  3+ stops: 100
  2 stops:  75
  1 stop:   50
  0 stops:  0

Bonuses:
  + 15 for Select Bus Service
  + 5 per route (max +20)
```

## Implementation Plan

### Phase 1: Transit Data Ingestion (Week 1)
```
Task 1.1: Create mta-stations.ts ingest
  - Fetch subway station locations
  - Include ADA status
  - Parse lines served

Task 1.2: Create mta-bus.ts ingest
  - Parse GTFS feed
  - Extract stop locations
  - Map routes to stops

Task 1.3: Create citibike.ts ingest
  - Fetch station feed
  - Include capacity info

Task 1.4: Create elevator-status.ts (real-time)
  - Fetch current outages
  - Update frequently (hourly?)
```

### Phase 2: Spatial Indexing (Week 1-2)
```
Task 2.1: Add transit_stations table
  - Indexed by H3 cell
  - Pre-compute distances

Task 2.2: Create spatial query helpers
  - Find stations within radius
  - Calculate walk times
```

### Phase 3: Score Computation (Week 2)
```
Task 3.1: Add TransitScore type
Task 3.2: Create compute/transit-score.ts
Task 3.3: Pre-compute scores by H3 cell
Task 3.4: Add real-time elevator adjustment
```

### Phase 4: API & Frontend (Week 3)
```
Task 4.1: Add /transit/score endpoint
Task 4.2: Create TransitLayer component
Task 4.3: Show subway/bus icons on map
Task 4.4: Create TransitPanel with details
Task 4.5: Add accessibility filter
```

## Files to Create/Modify

```
packages/pipeline/src/ingest/
  ├── mta-stations.ts       # NEW
  ├── mta-bus.ts            # NEW
  ├── citibike.ts           # NEW
  └── elevator-status.ts    # NEW (real-time)

packages/pipeline/src/compute/
  └── transit-score.ts      # NEW

packages/api/src/routes/
  └── transit.ts            # NEW

packages/web/src/components/
  ├── TransitLayer.tsx      # NEW
  ├── SubwayIcon.tsx        # NEW
  └── TransitPanel.tsx      # NEW
```

## Visual Design

```
Transit Layer:
┌─────────────────────────────┐
│  🚇 ─────── 🚇              │
│      A C E   1 2 3          │
│                             │
│  🚌 ────────────────        │
│                             │
│  🚲 ── 🚲 ──── 🚲           │
│                             │
│  Legend:                    │
│  🚇 Subway (●=Accessible)   │
│  🚌 Bus Stop                │
│  🚲 Citibike                │
└─────────────────────────────┘

Transit Score Badge:
┌──────────────────────────┐
│  Transit Score: 92       │
│  ████████████░ Excellent │
│                          │
│  🚇 2 min to A/C/E       │
│  🚌 3 bus routes         │
│  🚲 2 Citibike stations  │
│  ♿ Accessible: Yes       │
└──────────────────────────┘
```

---

# Milestone 4: Environmental Quality Layer

## Objective
Show environmental factors affecting health and safety: air quality, flood risk, noise levels.

## Data Sources

| Source | Endpoint | Records | Key Fields |
|--------|----------|---------|------------|
| Air Quality | `c3uy-2p5r` | ~10K | PM2.5, Ozone, Location |
| Flood Zones (FEMA, predicted) | `4vym-qrg3` | Polygons | FEMA zones, Risk level |
| **FloodNet events (measured)** | `aq7i-eu5q` | ~daily | Max depth, duration, sensor_id |
| **FloodNet sensors metadata** | `kb2e-tjy3` | ~200 sensors | lat/lon, NTA, tidal flag |
| Noise Levels | 311 + Studies | - | Decibel estimates |
| Tree Canopy | NYC Parks | Polygons | Coverage % |
| Heat Vulnerability | `rvn8-2qkj` | Index | Heat risk |

> **FEMA vs FloodNet** : FEMA = risque *prédit* (100yr/500yr floodplain, statique). FloodNet = risque *mesuré* au niveau rue, 1 mesure/min, capteurs NYU+CUNY+NYC DEP. Les deux sont complémentaires — garder FEMA pour la couverture complète, FloodNet pour le signal réel. Voir `INTEGRATION_SPECS.md` §4 pour les détails techniques.

## Environmental Score Formula

```typescript
interface EnvironmentalScore {
  score: number;  // 0-100, higher = better

  components: {
    // Air Quality (35% weight)
    air: {
      pm25: number;          // Fine particles
      ozone: number;         // Ground-level ozone
      no2: number;           // Nitrogen dioxide
      airQualityIndex: number;
    };

    // Climate Risk (35% weight)
    climate: {
      floodZone: 'none' | 'moderate' | 'high' | 'extreme';  // FEMA (predicted)
      heatVulnerability: number;
      coastalRisk: boolean;

      // FloodNet sensors (measured)
      measuredFloodFrequency: number;    // events/year near this location
      measuredMaxDepth: number;          // p95 max depth observed (inches)
      nearestSensorDistanceM: number;    // distance to nearest active sensor
      tidallyInfluenced: boolean;        // nearby sensor flagged tidal
    };

    // Green Space (30% weight)
    green: {
      treeCanopy: number;    // % coverage
      parkAccess: number;    // meters to nearest
      greenScore: number;
    };
  };
}
```

## Implementation Plan

### Phase 1: Data Ingestion (Week 1)
```
Task 1.1: Create air-quality.ts ingest
  - Fetch air quality measurements
  - Interpolate for full coverage
  - Store by Community District

Task 1.2: Create flood-zones.ts ingest
  - Fetch FEMA flood zone polygons
  - Convert to H3 cells for lookup
  - Store risk level per cell

Task 1.3: Create floodnet.ts ingest
  - Fetch FloodNet sensor metadata (kb2e-tjy3)
  - Fetch flood events incremental (aq7i-eu5q), watermark on flood_start_time
  - Map sensors to H3 cells
  - Aggregate events per sensor / NTA / H3
  - See INTEGRATION_SPECS.md §4

Task 1.4: Create parks.ts ingest
  - Fetch park boundaries
  - Calculate distance to parks
  - Compute tree canopy coverage
```

### Phase 2: Score Computation (Week 2)
```
Task 2.1: Add EnvironmentalScore type
Task 2.2: Create compute/environmental-score.ts
Task 2.3: Store scores by H3 cell
```

### Phase 3: API & Frontend (Week 2-3)
```
Task 3.1: Add /environmental/score endpoint
Task 3.2: Create FloodZoneLayer component
Task 3.3: Create AirQualityLayer component
Task 3.4: Create EnvironmentalPanel
```

## Files to Create/Modify

```
packages/pipeline/src/ingest/
  ├── air-quality.ts        # NEW
  ├── flood-zones.ts        # NEW (FEMA)
  ├── floodnet.ts           # NEW (FloodNet sensors + events)
  └── parks.ts              # NEW

packages/pipeline/src/compute/
  ├── environmental-score.ts # NEW
  └── flood-stats.ts         # NEW (aggregates per sensor/NTA/H3)

packages/web/src/components/
  ├── FloodZoneLayer.tsx    # NEW (FEMA polygons)
  ├── FloodNetLayer.tsx     # NEW (sensor points + frequency heatmap)
  ├── AirQualityLayer.tsx   # NEW
  └── EnvironmentalPanel.tsx # NEW
```

## Visual Design

```
Flood Zone Overlay:
┌─────────────────────────────┐
│                             │
│  ░░░░░░░▒▒▒▒▓▓▓▓████       │
│  ░░░░░░▒▒▒▒▓▓▓▓████        │
│  ░░░░░▒▒▒▒▓▓▓▓████         │
│                             │
│  Legend:                    │
│  ░ Minimal Risk             │
│  ▒ Moderate (500yr flood)   │
│  ▓ High (100yr flood)       │
│  █ Extreme (FEMA Zone A)    │
└─────────────────────────────┘
```

---

# Milestone 5: Economic Layer

## Objective
Show property values, sales history, and economic indicators.

## Data Sources

| Source | Endpoint | Records | Key Fields |
|--------|----------|---------|------------|
| Property Sales | ACRIS | Millions | Sale price, Date |
| DOF Sales | `usep-8jbt` | ~100K/yr | Price, Address |
| Tax Assessments | DOF | ~1M | Assessed value |
| 421a Exemptions | NYCDB | ~50K | Exemption end date |
| Median Rent | Census ACS | By tract | Rent estimates |

## Economic Score Formula

```typescript
interface EconomicIndicators {
  // Not a score - just data display

  property: {
    lastSalePrice: number;
    lastSaleDate: Date;
    assessedValue: number;
    taxesAnnual: number;
    pricePerSqFt: number;
  };

  neighborhood: {
    medianSalePrice: number;
    medianRent: number;
    priceChange1yr: number;    // %
    priceChange5yr: number;    // %
  };

  exemptions: {
    has421a: boolean;
    exemptionEndDate: Date | null;
    hasJ51: boolean;
  };
}
```

## Implementation Plan

### Phase 1: Data Ingestion (Week 1-2)
```
Task 1.1: Create acris.ts ingest
  - Fetch real property records
  - Parse deed transfers
  - Extract sale prices

Task 1.2: Create dof-sales.ts ingest
  - Simpler rolling sales data
  - Annual aggregate

Task 1.3: Create tax-exemptions.ts ingest
  - 421a and J-51 data
  - Track expiration dates
```

### Phase 2: Computation (Week 2)
```
Task 2.1: Create compute/economic.ts
  - Aggregate by building
  - Calculate neighborhood medians
  - Track price changes over time
```

### Phase 3: API & Frontend (Week 3)
```
Task 3.1: Add /places/:id/economic endpoint
Task 3.2: Create PropertyValuePanel
Task 3.3: Create PriceHistoryChart
Task 3.4: Add sales layer (recent sales dots)
```

---

# Milestone 6: Unified Quality Score

## Objective
Combine all layers into a single, customizable quality score.

## Formula

```typescript
interface UnifiedQualityScore {
  overall: number;  // 0-100

  weights: {
    buildingQuality: number;    // default 0.30
    safetyQoL: number;          // default 0.25
    transitAccess: number;      // default 0.25
    environmental: number;      // default 0.20
  };

  components: {
    buildingQuality: BuildingQualityScore;
    safetyQoL: QualityOfLifeScore;
    transitAccess: TransitScore;
    environmental: EnvironmentalScore;
  };

  // User can customize weights
  customWeights?: {
    buildingQuality?: number;
    safetyQoL?: number;
    transitAccess?: number;
    environmental?: number;
  };
}
```

## Implementation Plan

```
Task 6.1: Create compute/unified-score.ts
Task 6.2: Add weight customization UI
Task 6.3: Create "Find Best Match" feature
  - User sets minimum scores per category
  - System highlights matching areas
Task 6.4: Create comparison mode
  - Select 2-3 locations
  - Side-by-side radar chart
```

---

# Milestone 7: UI Layer Controls

## Objective
Allow users to toggle layers, customize weights, and filter the map.

## Features

```
┌─────────────────────────────────────────┐
│  Layers                           [≡]   │
├─────────────────────────────────────────┤
│                                         │
│  ☑ Building Quality      [████░] 30%    │
│  ☑ Safety & QoL          [███░░] 25%    │
│  ☑ Transit Access        [███░░] 25%    │
│  ☐ Environmental         [██░░░] 20%    │
│  ☐ Economic Data         [░░░░░] 0%     │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Filters                                │
│  Min Quality Score: [70    ] ▼          │
│  Show Only:                             │
│    ☑ Rent Stabilized                    │
│    ☐ Accessible Transit                 │
│    ☐ Low Flood Risk                     │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [🔍 Find Best Neighborhoods]           │
│                                         │
└─────────────────────────────────────────┘
```

## Implementation Plan

```
Task 7.1: Create LayerControlPanel component
Task 7.2: Add weight sliders with real-time update
Task 7.3: Create FilterPanel component
Task 7.4: Implement "Find Best" algorithm
Task 7.5: Add comparison mode UI
Task 7.6: Create shareable URL with settings
```

---

# Summary: Implementation Order

```
Phase 1 (MVP): Building Quality
├── M1: Building Quality Layer
└── Basic map with quality heatmap

Phase 2 (Core): Safety + Transit
├── M2: Safety & Quality of Life
├── M3: Transit Access Layer
└── Layer toggle UI

Phase 3 (Complete): Environment + Economic
├── M4: Environmental Layer
├── M5: Economic Layer
└── M6: Unified Score

Phase 4 (Polish): Advanced UI
├── M7: Full Layer Controls
├── Comparison mode
└── "Find Best" feature
```

---

# Data Volume Estimates

| Dataset | Records | Storage Est. |
|---------|---------|--------------|
| HPD Violations | 4M | ~800 MB |
| HPD Complaints | 13M | ~2 GB |
| 311 Complaints | 30M+ | ~5 GB (aggregated: ~100 MB) |
| NYPD Data | ~700K/yr | ~500 MB |
| MTA Stations | 424 | <1 MB |
| Flood Zones | Polygons | ~50 MB |
| ACRIS | Millions | ~2 GB |
| **Total (raw)** | - | **~10+ GB** |
| **Total (aggregated)** | - | **~1-2 GB** |

**Strategy**: Aggregate to H3 cells for heatmaps, keep detail for building-level queries.

---

# API Endpoints Summary

```
Building Quality:
  GET /places/:id/quality
  GET /map/quality-heatmap

Safety & QoL:
  GET /neighborhoods/:h3/quality
  GET /map/safety-heatmap
  GET /map/noise-heatmap

Transit:
  GET /transit/score?lat=&lng=
  GET /transit/stations?bounds=
  GET /transit/elevators/status

Environmental:
  GET /environmental/score?lat=&lng=
  GET /map/flood-zones
  GET /map/air-quality

Economic:
  GET /places/:id/economic
  GET /neighborhoods/:h3/prices

Unified:
  GET /score?lat=&lng=&weights=
  GET /search/best-match?criteria=
```

---

# Sources

- [NYCDB](https://github.com/nycdb/nycdb)
- [Housing Data Coalition](https://www.housingdatanyc.org/)
- [NYC Open Data](https://opendata.cityofnewyork.us/)
- [MTA Open Data](https://www.mta.info/open-data)
- [NYPD CompStat](https://www.nyc.gov/site/nypd/stats/crime-statistics/crime-statistics-landing.page)
- [NYC 311](https://portal.311.nyc.gov/)
- [FloodNet NYC](https://www.floodnet.nyc) — real-time street flood sensors ([dashboard](https://dataviz.floodnet.nyc), [datasets](https://data.cityofnewyork.us/browse?Data-Collection_Data-Collection=FloodNet+NYC), [tutorial](https://github.com/mebauer/floodnet-nyc-tutorial))
