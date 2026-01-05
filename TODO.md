# TODO

## Data Source Integrations

### Implemented
- [x] DOB NOW API - Job details, status, owner, architect, BIN

### To Implement
Fetch and display data from these additional NYC data sources:

- [ ] **ACRIS** - Property records, deeds, mortgages
  - URL: `https://a836-acris.nyc.gov/DS/DocumentSearch/BBL`
  - Requires: BBL (Borough-Block-Lot)

- [ ] **HPD Building Profile** - Housing violations, complaints, registrations
  - URL: `https://hpdonline.nyc.gov/HPDonline/Provide_address.aspx`
  - Requires: BIN or address

- [ ] **DOB Building Profile** - Full building history, all permits, violations
  - URL: `https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?bin={BIN}`
  - Requires: BIN

- [ ] **DOF Property Tax Bills** - Tax assessments, exemptions, property values
  - URL: `https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=persprop`
  - Requires: BBL

- [ ] **ANHD DAP Portal** - Affordable housing, displacement risk data
  - URL: `https://portal.displacementalert.org/`
  - Requires: Address or BBL

- [ ] **OCA / Housing Data Coalition** - Eviction filings, court cases
  - URL: `https://www.housingdatanyc.org/`
  - Data: Eviction cases, housing court filings, landlord history
  - Requires: Address or BBL
  - Note: Critical for understanding tenant displacement risk

### Critical: BIN & BBL Identifiers

These two identifiers are the keys to unlocking all NYC data:

- **BIN** (Building Identification Number) - 7 digits, identifies a building
  - [x] Can be fetched from DOB NOW API (implemented)
  - [ ] Should be stored on Place record for reuse

- **BBL** (Borough-Block-Lot) - 10 digits, identifies a tax lot
  - [ ] Can be derived from coordinates via NYC Geoclient API
  - [ ] Should be stored on Place record for reuse
  - Format: `{borough:1}{block:5}{lot:4}` (e.g., `3012340001`)

### Notes
- Almost all NYC data sources key off BIN or BBL
- Once we have these, we can link to ACRIS, HPD, DOB, DOF, OCA, ANHD
- Consider batch-enriching all Places with BIN/BBL via Geoclient API

## Caching Strategy

Government websites are often slow or unavailable. Data doesn't change frequently.

### Architecture
- [ ] **Local cache layer** - Store all fetched data locally (SQLite or Postgres)
- [ ] **Cache-first approach** - Serve from cache, never block on external APIs
- [ ] **Background refresh** - Update stale data asynchronously when accessed
- [ ] **Staleness threshold** - Define per-source (e.g., DOB: 24h, ACRIS: 7 days)

### Implementation
- [ ] Add `cached_at` timestamp to all external data
- [ ] Add `source_data` table to store raw API responses by BIN/BBL
- [ ] Background worker to refresh data older than threshold
- [ ] Graceful degradation - show cached data even if refresh fails

### Benefits
- Fast UI response (no waiting for gov APIs)
- Resilience to API outages
- Reduced load on external services
- Historical data tracking (diff changes over time)
