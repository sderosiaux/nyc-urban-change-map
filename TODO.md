# TODO

## Data Source Integrations

### Implemented

#### Pipeline Ingest (Bulk Data)
- [x] **DOB Permit Issuance** - Historical permits (ends 2020)
  - File: `packages/pipeline/src/ingest/dob.ts`
  - Endpoint: `ipu4-2q9a.json`
- [x] **DOB NOW: Job Application Filings** - All active job filings
  - File: `packages/pipeline/src/ingest/dob-now.ts`
  - Endpoint: `w9ak-ipjd.json`
  - Note: Includes all statuses (pending, approved, withdrawn) - no need for separate "Approved Permits" dataset
- [x] **DOB NOW: Safety Violations** - Civil penalties
  - File: `packages/pipeline/src/ingest/dob-now-violations.ts`
  - Endpoint: `855j-jady.json`
- [x] **DOB Complaints**
  - File: `packages/pipeline/src/ingest/dob-complaints.ts`
- [x] **DOB Violations**
  - File: `packages/pipeline/src/ingest/dob-violations.ts`
- [x] **ZAP** - Zoning Application Portal
  - File: `packages/pipeline/src/ingest/zap.ts`
- [x] **Capital Projects**
  - File: `packages/pipeline/src/ingest/capital.ts`
- [x] **CEQR** - Environmental reviews
  - File: `packages/pipeline/src/ingest/ceqr.ts`
- [x] **PLUTO** - Tax lot data
  - File: `packages/pipeline/src/ingest/pluto.ts`
- [x] **PAD** - Property Address Directory
  - File: `packages/pipeline/src/ingest/pad.ts`

#### API Enrichment (Real-time)
- [x] **DOB NOW GlobalSearch API** - Real-time job lookup by job number
- [x] **DOB NOW Property Details API** - Full property info by BIN
  - File: `packages/api/src/routes/places.ts` → `fetchPropertyDetails()`
  - Returns: BBL, zones, flood zone, violations, regulatory flags

### To Implement

#### High Priority
- [ ] **HPD Building Profile** - Housing violations, complaints, registrations
  - URL: `https://hpdonline.nyc.gov/HPDonline/Provide_address.aspx`
  - Requires: BIN or address
  - Why: Critical for understanding housing conditions

- [ ] **OCA / Housing Data Coalition** - Eviction filings, court cases
  - URL: `https://www.housingdatanyc.org/`
  - Requires: Address or BBL
  - Why: Critical for understanding tenant displacement risk

#### Medium Priority
- [ ] **ACRIS** - Property records, deeds, mortgages
  - URL: `https://a836-acris.nyc.gov/DS/DocumentSearch/BBL`
  - Requires: BBL

- [ ] **DOB BIS Building Profile** - Full building history
  - URL: `https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?bin={BIN}`
  - Requires: BIN

- [ ] **ANHD DAP Portal** - Affordable housing, displacement risk
  - URL: `https://portal.displacementalert.org/`
  - Requires: Address or BBL

#### Low Priority
- [ ] **DOF Property Tax Bills** - Tax assessments, exemptions
  - URL: `https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=persprop`
  - Requires: BBL

### BIN & BBL Identifiers

- **BIN** (Building Identification Number) - 7 digits
  - [x] Fetched from DOB NOW API
  - [x] Stored on Place records
- **BBL** (Borough-Block-Lot) - 10 digits
  - [x] Available from DOB NOW Property Details API
  - [ ] Batch-enrich all Places via Geoclient API

---

## Research

### NYCDB (NYC Housing Database)
- [ ] **Explore NYCDB** - Consolidated NYC housing database
  - GitHub: https://github.com/nycdb/nycdb
  - Python ETL that loads 30+ housing datasets into PostgreSQL
  - Includes: HPD, DOB, ACRIS, evictions, rent stabilization, and more
  - Could replace multiple individual integrations
  - Used by Housing Data Coalition, JustFix, ANHD
  - **Potential**: Use as upstream data source instead of individual APIs

---

## Infrastructure

### Deployment
- [ ] Deploy to production (Turso + Vercel or Cloudflare)
- [ ] Set up CI/CD pipeline

### Caching Strategy
- [ ] **Cache layer** - Store fetched data locally
- [ ] **Cache-first approach** - Never block on external APIs
- [ ] **Background refresh** - Update stale data asynchronously
- [ ] **Staleness thresholds** - Per-source (DOB: 24h, ACRIS: 7 days)

### Implementation
- [ ] Add `cached_at` timestamp to external data
- [ ] Add `source_data` table for raw API responses
- [ ] Background worker for refresh
- [ ] Graceful degradation when APIs fail
