# NYC Urban Change Map - Data Sources

## Overview

This document lists all NYC Open Data sources used by the Urban Change Map project, organized by category and purpose.

---

## 1. Travaux et Permis (Construction Activity)

**Purpose:** Track what's actually happening on the ground - active construction, permits, violations.

### NYC Department of Buildings

| Source                  | Dataset ID  | Status         | Description                                          |
| ----------------------- | ----------- | -------------- | ---------------------------------------------------- |
| **DOB NOW**             | `rbx6-tga4` | ✅ Implemented | Active permits, current status, ongoing work         |
| **DOB Permit Issuance** | `ipu4-2q9a` | ✅ Implemented | Historical permits, trends, chronically active zones |
| **DOB Complaints**      | `eabe-havv` | ✅ Implemented | Building complaints                                  |
| **DOB Violations**      | `3h2n-5cm9` | ✅ Implemented | ECB and DOB violations                               |

#### Ingestion Pipelines

| Pipeline         | File                           | Status         |
| ---------------- | ------------------------------ | -------------- |
| `dob`            | `src/ingest/dob.ts`            | ✅ Implemented |
| `dob-now`        | `src/ingest/dob-now.ts`        | ✅ Implemented |
| `dob-violations` | `src/ingest/dob-violations.ts` | ✅ Implemented |
| `dob-complaints` | `src/ingest/dob-complaints.ts` | ✅ Implemented |

---

## 2. Planification Urbaine (Urban Planning & Future)

**Purpose:** Track what's being planned - rezonings, ULURP, environmental reviews.

### NYC Department of City Planning

| Source              | Dataset ID  | Status         | Description                                 |
| ------------------- | ----------- | -------------- | ------------------------------------------- |
| **ZAP Projects**    | `hgx4-8ukb` | ✅ Implemented | Zoning applications, ULURP, special permits |
| **CEQR Projects**   | `gezn-7mgk` | ✅ Implemented | Environmental Quality Review projects       |
| **CEQR Milestones** | `8fj8-3sgg` | ✅ Implemented | CEQR project milestones                     |

#### Ingestion Pipelines

| Pipeline | File                 | Status         |
| -------- | -------------------- | -------------- |
| `zap`    | `src/ingest/zap.ts`  | ✅ Implemented |
| `ceqr`   | `src/ingest/ceqr.ts` | ✅ Implemented |

---

## 3. Projets Publics Structurants (Public Infrastructure)

**Purpose:** Track city-led projects - schools, parks, streets, waterfront.

### NYC Office of Management and Budget

| Source                      | Dataset ID  | Status         | Description                        |
| --------------------------- | ----------- | -------------- | ---------------------------------- |
| **Capital Projects (CPDB)** | `h2ic-zdws` | ✅ Implemented | Multi-year infrastructure projects |

#### Ingestion Pipelines

| Pipeline  | File                    | Status         |
| --------- | ----------------------- | -------------- |
| `capital` | `src/ingest/capital.ts` | ✅ Implemented |

---

## 4. Géographie et Contexte Urbain (Geography & Context)

**Purpose:** Provide spatial context - parcels, buildings, zoning, addresses.

### NYC Department of City Planning

| Source                | Dataset ID  | Status         | Description                               |
| --------------------- | ----------- | -------------- | ----------------------------------------- |
| **PLUTO**             | `64uk-42ks` | ✅ Implemented | Building use, zoning, year built, density |
| **MapPLUTO**          | Shapefile   | 🔴 Not Started | PLUTO with geometry                       |
| **PAD**               | `bc8t-ecyu` | ✅ Implemented | Address ↔ BBL ↔ geometry mapping          |
| **PLUTO Change File** | TBD         | 🔴 Not Started | Building stock evolution over time        |

#### Ingestion Pipelines

| Pipeline | File                  | Status         |
| -------- | --------------------- | -------------- |
| `pluto`  | `src/ingest/pluto.ts` | ✅ Implemented |
| `pad`    | `src/ingest/pad.ts`   | ✅ Implemented |

---

## 5. Boundaries & Administrative Areas

**Purpose:** Define neighborhoods and administrative boundaries for aggregation and display.

### NYC Department of City Planning

| Source                  | Dataset ID  | Status         | Description                          |
| ----------------------- | ----------- | -------------- | ------------------------------------ |
| **NTAs**                | `9nt8-h7nd` | ✅ Implemented | Neighborhood Tabulation Areas (2020) |
| **Community Districts** | `jp9i-3b7y` | ✅ Implemented | Political/administrative boundaries  |
| **Borough Boundaries**  | `7t3b-ywvw` | ✅ Implemented | NYC borough boundaries               |

#### Ingestion Pipelines

| Pipeline     | File                       | Status         |
| ------------ | -------------------------- | -------------- |
| `boundaries` | `src/ingest/boundaries.ts` | ✅ Implemented |

---

## 6. Réseau Urbain (Street Network)

**Purpose:** Provide street graph for distances, routing, and base map.

### NYC Department of Transportation / City Planning

| Source   | Dataset ID | Status         | Description                                 |
| -------- | ---------- | -------------- | ------------------------------------------- |
| **LION** | Shapefile  | 🔴 Not Started | Official street network graph               |
| **DCM**  | Shapefile  | 🔴 Not Started | Digital City Map - official street geometry |

> Note: These are typically loaded as base layers, not ingested as events.

---

## 7. Summary by Purpose

| Category                  | Purpose                 | Key Sources                     |
| ------------------------- | ----------------------- | ------------------------------- |
| **Present/Active**        | What's happening now    | DOB NOW, DOB Permits            |
| **Historical**            | What happened before    | DOB Permit Issuance, Violations |
| **Future (2-10 years)**   | What's being planned    | ZAP, CEQR                       |
| **Public Infrastructure** | City-led changes        | Capital Projects (CPDB)         |
| **Context**               | Understanding buildings | PLUTO, PAD                      |
| **Geography**             | Spatial structure       | NTAs, Community Districts, LION |

---

## API Configuration

All endpoints are configured in `packages/shared/src/constants/index.ts`:

```typescript
export const NYC_DATA_ENDPOINTS = {
  // DOB - Department of Buildings
  dobPermits: 'https://data.cityofnewyork.us/resource/ipu4-2q9a.json',
  dobNow: 'https://data.cityofnewyork.us/resource/rbx6-tga4.json',
  dobComplaints: 'https://data.cityofnewyork.us/resource/eabe-havv.json',
  dobViolations: 'https://data.cityofnewyork.us/resource/3h2n-5cm9.json',

  // Planning
  zapProjects: 'https://data.cityofnewyork.us/resource/hgx4-8ukb.json',
  capitalProjects: 'https://data.cityofnewyork.us/resource/h2ic-zdws.json',
  ceqrProjects: 'https://data.cityofnewyork.us/resource/gezn-7mgk.json',
  ceqrMilestones: 'https://data.cityofnewyork.us/resource/8fj8-3sgg.json',

  // Context
  pluto: 'https://data.cityofnewyork.us/resource/64uk-42ks.json',
  pad: 'https://data.cityofnewyork.us/resource/bc8t-ecyu.json',

  // Boundaries
  ntas: 'https://data.cityofnewyork.us/resource/9nt8-h7nd.json',
  communityDistricts: 'https://data.cityofnewyork.us/resource/jp9i-3b7y.json',
  boroughs: 'https://data.cityofnewyork.us/resource/7t3b-ywvw.json',
};
```

---

## Rate Limiting

NYC Open Data has rate limits:

- Without app token: 1,000 requests/hour
- With app token: 10,000 requests/hour

Set `NYC_OPEN_DATA_TOKEN` environment variable for higher limits.
