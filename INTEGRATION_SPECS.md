# Integration Specs: HPD & OCA

## 1. HPD (Housing Preservation & Development)

### Datasets à intégrer

| Dataset | Endpoint ID | Description | Priorité |
|---------|-------------|-------------|----------|
| **Housing Maintenance Code Violations** | `wvxf-dwi5` | Toutes les violations housing | P0 |
| **Housing Maintenance Code Complaints** | `ygpa-z7cr` | Complaints + Problems (merged) | P0 |
| **Housing Litigations** | `59kj-x8nc` | Procès contre landlords | P1 |
| **Multiple Dwelling Registrations** | `tesw-yqqr` | Infos propriétaire/agent | P1 |
| **Order to Repair/Vacate** | `tb8q-a3ar` | Ordres urgents | P2 |

### API Endpoints

```bash
# Violations (updated daily)
https://data.cityofnewyork.us/resource/wvxf-dwi5.json

# Complaints & Problems
https://data.cityofnewyork.us/resource/ygpa-z7cr.json

# Litigations
https://data.cityofnewyork.us/resource/59kj-x8nc.json
```

### Fields clés (Violations)

```typescript
interface HPDViolation {
  violationid: string;           // Unique ID
  buildingid: string;            // HPD Building ID
  registrationid: string;        // Registration ID
  boroid: string;                // 1-5
  borough: string;               // Full name
  housenumber: string;
  lowhousenumber: string;
  highhousenumber: string;
  streetname: string;
  streetcode: string;
  zip: string;
  apartment: string;
  story: string;
  block: string;
  lot: string;
  class: string;                 // A, B, C, I
  inspectiondate: string;
  approveddate: string;
  originalcertifybydate: string;
  originalcorrectbydate: string;
  newcertifybydate: string;
  newcorrectbydate: string;
  certifieddate: string;
  ordernumber: string;
  novid: string;                 // Notice of Violation ID
  novdescription: string;        // Violation description
  novissueddate: string;
  currentstatusid: string;
  currentstatus: string;
  currentstatusdate: string;
  latitude: string;
  longitude: string;
  communityboard: string;
  councildistrict: string;
  censustract: string;
  bin: string;                   // BIN!
  bbl: string;                   // BBL!
  nta: string;
}
```

### Fields clés (Complaints)

```typescript
interface HPDComplaint {
  complaintid: string;
  buildingid: string;
  boroughid: string;
  borough: string;
  housenumber: string;
  streetname: string;
  zip: string;
  block: string;
  lot: string;
  apartment: string;
  communityboard: string;
  receiveddate: string;
  status: string;
  statusdate: string;
  statusid: string;
  // Problem details (merged dataset)
  problemid: string;
  unittype: string;
  spacetype: string;
  problemtype: string;
  majorcategory: string;
  minorcategory: string;
  problemcode: string;
  problemstatus: string;
  problemstatusdate: string;
  statusdescription: string;
  problemduplicateflag: string;
  latitude: string;
  longitude: string;
  bin: string;
  bbl: string;
  nta: string;
}
```

### Mapping EventType

```typescript
const HPD_EVENT_TYPE_MAP: Record<string, EventType> = {
  // Violations par classe
  'A': 'hpd_violation_a',     // Non-hazardous
  'B': 'hpd_violation_b',     // Hazardous
  'C': 'hpd_violation_c',     // Immediately hazardous
  'I': 'hpd_violation_info',  // Information order
  // Complaints par catégorie majeure
  'HEAT/HOT WATER': 'hpd_complaint_heat',
  'PLUMBING': 'hpd_complaint_plumbing',
  'ELECTRIC': 'hpd_complaint_electric',
  'SAFETY': 'hpd_complaint_safety',
  // etc.
};
```

### Fichiers à créer

```
packages/pipeline/src/ingest/hpd-violations.ts
packages/pipeline/src/ingest/hpd-complaints.ts
packages/shared/src/constants/hpd.ts  (mappings, categories)
```

---

## 2. OCA (Office of Court Administration) - Evictions

### Source

Les données viennent du **Housing Data Coalition** qui parse les fichiers XML de l'OCA.

**CSV hébergés sur S3:**
```
https://oca-2-dev.s3.amazonaws.com/public/
```

### Tables disponibles

| Table | Description | Clé |
|-------|-------------|-----|
| `oca_index` | Case records (main) | indexnumberid |
| `oca_causes` | Raisons du case | indexnumberid |
| `oca_addresses` | Adresses (ZIP only!) | indexnumberid |
| `oca_parties` | Parties impliquées | indexnumberid |
| `oca_events` | Activités du case | indexnumberid |
| `oca_appearances` | Comparutions | indexnumberid |
| `oca_motions` | Motions déposées | indexnumberid |
| `oca_decisions` | Décisions | indexnumberid |
| `oca_judgments` | Jugements finaux | indexnumberid |
| `oca_warrants` | Warrants d'éviction | indexnumberid |

### Limitation importante

⚠️ **Pas d'adresse précise** — seulement le **ZIP code** pour des raisons de privacy.

On ne peut pas lier directement à un building/place, mais on peut:
1. Agréger par ZIP → afficher "X eviction filings in this ZIP"
2. Enrichir les places existantes avec des stats de leur ZIP

### Stratégie d'intégration

```typescript
// Option 1: Stats par ZIP (recommandé)
interface ZipEvictionStats {
  zipCode: string;
  totalFilings: number;
  pendingCases: number;
  warrantsIssued: number;
  executedEvictions: number;
  periodStart: Date;
  periodEnd: Date;
}

// Option 2: Dataset Evictions (NYC Open Data) - a BIN/BBL!
// Endpoint: 6z8x-wfk4 - Evictions executed by marshals
// Ce dataset a les adresses précises!
```

### Alternative: NYC Open Data Evictions

```bash
# Evictions executed (has addresses!)
https://data.cityofnewyork.us/resource/6z8x-wfk4.json
```

Ce dataset contient les évictions **exécutées** (pas les filings) mais avec **BIN** et coordonnées.

```typescript
interface NYCEviction {
  court_index_number: string;
  docket_number: string;
  eviction_address: string;
  executed_date: string;
  marshal_first_name: string;
  marshal_last_name: string;
  residential_commercial: string;  // "Residential" | "Commercial"
  borough: string;
  eviction_zip: string;
  ejectment: string;
  eviction_legal_possession: string;
  latitude: string;
  longitude: string;
  bin: string;
  bbl: string;
  nta: string;
  community_board: string;
  council_district: string;
  census_tract: string;
}
```

### Recommandation

**Phase 1**: Intégrer `6z8x-wfk4` (Evictions executed) — a BIN/BBL
**Phase 2**: Ajouter stats par ZIP depuis OCA pour context

### Fichiers à créer

```
packages/pipeline/src/ingest/evictions.ts
packages/pipeline/src/ingest/oca-stats.ts  (optionnel, phase 2)
```

---

## 3. Shared Types à ajouter

```typescript
// packages/shared/src/types/index.ts

export type EventSource =
  | 'dob' | 'dob-now' | 'dob-violations' | 'dob-complaints'
  | 'zap' | 'capital' | 'ceqr'
  | 'hpd-violations' | 'hpd-complaints'  // NEW
  | 'evictions';                          // NEW

export type EventType =
  // ... existing types ...
  // HPD
  | 'hpd_violation_a'
  | 'hpd_violation_b'
  | 'hpd_violation_c'
  | 'hpd_violation_info'
  | 'hpd_complaint'
  | 'hpd_litigation'
  // Evictions
  | 'eviction_filing'
  | 'eviction_executed';
```

---

## 4. Ordre d'implémentation

1. **`hpd-violations.ts`** — High value, straightforward Socrata
2. **`hpd-complaints.ts`** — Similar pattern
3. **`evictions.ts`** — NYC Open Data executed evictions
4. **Update shared types** — Add new sources/events
5. **Update ingest job** — Include new sources
6. **Update compute** — Factor HPD/evictions into transformation score

---

## 5. NYCDB — Référence ETL

### Ce que fait NYCDB

NYCDB est un projet Python qui:

1. **Download** CSV/JSON depuis NYC Open Data et autres sources
2. **Transform** headers, nettoie les données, ajoute des colonnes calculées (BBL)
3. **Load** dans PostgreSQL avec indexes optimisés

### Transformations disponibles

| Transform | Description |
|-----------|-------------|
| `flip_numbers()` | `2017values` → `values2017` (SQL can't start with digits) |
| `clean_headers()` | Lowercase, remove invalid chars |
| `with_bbl()` | Ajoute colonne BBL = concat(borough, block, lot) |
| `skip_fields()` | Remove unused columns |
| `hpd_registrations_address_cleanup()` | Normalize addresses |
| `extract_csvs_from_zip()` | Merge multiple CSVs from ZIP |

### Indexes créés (à copier)

**HPD Violations:**
```sql
CREATE INDEX hpd_violations_bbl_idx ON hpd_violations (bbl);
CREATE INDEX hpd_violations_bin_idx ON hpd_violations (bin);
CREATE INDEX hpd_violations_currentstatusid_idx ON hpd_violations (currentstatusid);
CREATE UNIQUE INDEX hpd_violations_violationid_idx ON hpd_violations (violationid);
```

**ACRIS:**
```sql
-- BBL sur les tables legals
CREATE INDEX real_property_legals_bbl_idx ON real_property_legals (bbl);
-- Document lookups
CREATE INDEX real_property_master_doctype_idx ON real_property_master (doctype);
CREATE INDEX real_property_master_docdate_idx ON real_property_master (docdate);
CREATE INDEX real_property_parties_name_idx ON real_property_parties (name);
```

### 64 datasets disponibles

```
acris.yml                    hpd_violations.yml
boundaries.yml               hpd_complaints.yml
dob_complaints.yml           hpd_registrations.yml
dob_violations.yml           hpd_litigations.yml
dob_safety_violations.yml    marshal_evictions.yml
dobjobs.yml                  executed_evictions.yml
dof_sales.yml                oca.yml (11 tables)
dof_421a.yml                 rentstab.yml
pluto_latest.yml             pad.yml
...
```

### Schémas exacts (from NYCDB YAML)

**HPD Violations (37 cols, 4M+ rows):**
```
ViolationID (int), BuildingID (int), RegistrationID (int),
BoroID (char1), Borough (text), HouseNumber (text),
StreetName (text), Postcode (char5), Apartment (text),
Block (int), Lot (int), Class (char1), InspectionDate (date),
NOVDescription (text), CurrentStatus (text), CurrentStatusDate (date),
Latitude (numeric), Longitude (numeric), BIN (char7), BBL (char10),
NTA (text), RentImpairing (boolean), ...
```

**HPD Complaints (31 cols, 13M+ rows):**
```
ReceivedDate (date), ProblemID (int), ComplaintID (int),
BuildingID (int), Borough (text), HouseNumber (text),
StreetName (text), PostCode (text), Block (int), Lot (int),
MajorCategory (text), MinorCategory (text), ProblemCode (text),
ComplaintStatus (text), ProblemStatus (text),
Latitude (numeric), Longitude (numeric), Bin (char7), BBL (char10), ...
```

**Executed Evictions (20 cols, 105K rows):**
```
CourtIndexNumber (text), DocketNumber (text),
EvictionAddress (text), EvictionApartmentNumber (text),
ExecutedDate (date), MarshalFirstName (text), MarshalLastName (text),
ResidentialCommercial (text), Borough (text), EvictionPostcode (text),
Latitude (numeric), Longitude (numeric), Bin (char7), Bbl (char10), ...
```

**OCA (11 tables, 1.3M+ cases):**
```
oca_index:       indexnumberid, court, fileddate, status, disposeddate...
oca_causes:      indexnumberid, causeofactiontype, amount...
oca_addresses:   indexnumberid, city, state, postalcode (ZIP only!)
oca_parties:     indexnumberid, role, partytype, representationtype...
oca_judgments:   indexnumberid, judgmenttype, withpossession, totaljudgmentamount...
oca_warrants:    indexnumberid, ordereddate, issueddate, executiondate...
```

### Notre approche vs NYCDB

| Aspect | NYCDB | Notre approche |
|--------|-------|----------------|
| **Language** | Python | TypeScript |
| **DB** | PostgreSQL | SQLite (local) / Turso (prod) |
| **Utilisation** | Standalone DB | Intégré dans notre pipeline |
| **Ce qu'on prend** | Schémas, indexes, URLs | ✅ |
| **Ce qu'on skip** | Code Python | ✅ |

**Conclusion**: On utilise NYCDB comme **référence** pour les schémas et bonnes pratiques, mais on implémente en TypeScript dans notre stack.

---

## Sources

- [HPD Open Data](https://www.nyc.gov/site/hpd/about/open-data.page)
- [Housing Data Coalition](https://www.housingdatanyc.org/)
- [OCA GitHub](https://github.com/housing-data-coalition/oca)
- [NYC Evictions Dataset](https://data.cityofnewyork.us/City-Government/Evictions/6z8x-wfk4)
- [NYCDB GitHub](https://github.com/nycdb/nycdb) — Reference ETL & schemas
