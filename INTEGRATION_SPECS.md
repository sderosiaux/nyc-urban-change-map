# Integration Specs: HPD, OCA & FloodNet

## 1. HPD (Housing Preservation & Development)

### Datasets à intégrer

| Dataset                                 | Endpoint ID | Description                    | Priorité |
| --------------------------------------- | ----------- | ------------------------------ | -------- |
| **Housing Maintenance Code Violations** | `wvxf-dwi5` | Toutes les violations housing  | P0       |
| **Housing Maintenance Code Complaints** | `ygpa-z7cr` | Complaints + Problems (merged) | P0       |
| **Housing Litigations**                 | `59kj-x8nc` | Procès contre landlords        | P1       |
| **Multiple Dwelling Registrations**     | `tesw-yqqr` | Infos propriétaire/agent       | P1       |
| **Order to Repair/Vacate**              | `tb8q-a3ar` | Ordres urgents                 | P2       |

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
  violationid: string; // Unique ID
  buildingid: string; // HPD Building ID
  registrationid: string; // Registration ID
  boroid: string; // 1-5
  borough: string; // Full name
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
  class: string; // A, B, C, I
  inspectiondate: string;
  approveddate: string;
  originalcertifybydate: string;
  originalcorrectbydate: string;
  newcertifybydate: string;
  newcorrectbydate: string;
  certifieddate: string;
  ordernumber: string;
  novid: string; // Notice of Violation ID
  novdescription: string; // Violation description
  novissueddate: string;
  currentstatusid: string;
  currentstatus: string;
  currentstatusdate: string;
  latitude: string;
  longitude: string;
  communityboard: string;
  councildistrict: string;
  censustract: string;
  bin: string; // BIN!
  bbl: string; // BBL!
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
  A: 'hpd_violation_a', // Non-hazardous
  B: 'hpd_violation_b', // Hazardous
  C: 'hpd_violation_c', // Immediately hazardous
  I: 'hpd_violation_info', // Information order
  // Complaints par catégorie majeure
  'HEAT/HOT WATER': 'hpd_complaint_heat',
  PLUMBING: 'hpd_complaint_plumbing',
  ELECTRIC: 'hpd_complaint_electric',
  SAFETY: 'hpd_complaint_safety',
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

| Table             | Description          | Clé           |
| ----------------- | -------------------- | ------------- |
| `oca_index`       | Case records (main)  | indexnumberid |
| `oca_causes`      | Raisons du case      | indexnumberid |
| `oca_addresses`   | Adresses (ZIP only!) | indexnumberid |
| `oca_parties`     | Parties impliquées   | indexnumberid |
| `oca_events`      | Activités du case    | indexnumberid |
| `oca_appearances` | Comparutions         | indexnumberid |
| `oca_motions`     | Motions déposées     | indexnumberid |
| `oca_decisions`   | Décisions            | indexnumberid |
| `oca_judgments`   | Jugements finaux     | indexnumberid |
| `oca_warrants`    | Warrants d'éviction  | indexnumberid |

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
  residential_commercial: string; // "Residential" | "Commercial"
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
  | 'dob'
  | 'dob-now'
  | 'dob-violations'
  | 'dob-complaints'
  | 'zap'
  | 'capital'
  | 'ceqr'
  | 'hpd-violations'
  | 'hpd-complaints' // NEW
  | 'evictions'; // NEW

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

## 4. FloodNet NYC — Real-time street flooding sensors

### Source

Réseau de capteurs de crue déployé par NYU + CUNY + NYC DEP + Mayor's Office of Climate & Environmental Justice, en collaboration avec des résidents. Les capteurs mesurent la hauteur d'eau à **1 mesure/minute**. Un "flood event" = série de mesures > 10 mm, QC'd par l'équipe FloodNet.

- Site projet : https://www.floodnet.nyc
- Dashboard officiel : https://dataviz.floodnet.nyc
- Tutorial référence (Python, Socrata) : https://github.com/mebauer/floodnet-nyc-tutorial (voir `00-download-data.ipynb`)

**Pourquoi c'est utile** : les zones FEMA (`4vym-qrg3`) donnent le risque _prédit_ (100yr/500yr floodplain). FloodNet donne le risque _mesuré_ — signal réel, haute fréquence, au niveau rue. Les deux sont complémentaires, pas redondants.

### Datasets à intégrer

| Dataset                        | Endpoint ID | Description                                      | Priorité |
| ------------------------------ | ----------- | ------------------------------------------------ | -------- |
| **Street Flooding Events**     | `aq7i-eu5q` | Événements de crue mesurés (1 ligne / event)     | P0       |
| **Sensor Deployment Metadata** | `kb2e-tjy3` | Métadonnées capteurs : lat/lon, install, NTA, CB | P0       |

Mis à jour quotidiennement via l'API Socrata standard.

### API Endpoints

```bash
# Flood events (JSON, toutes les crues mesurées)
https://data.cityofnewyork.us/resource/aq7i-eu5q.json

# Sensor metadata (location, install date, borough, NTA, census tract)
https://data.cityofnewyork.us/resource/kb2e-tjy3.json

# Événements récents pour un capteur donné
https://data.cityofnewyork.us/resource/aq7i-eu5q.json
  ?$where=sensor_id='<ID>' AND flood_start_time > '2026-01-01T00:00:00'
  &$order=flood_start_time DESC
  &$limit=1000
```

Le pattern est identique au tutorial `mebauer/floodnet-nyc-tutorial/00-download-data.ipynb` — requêtes SoQL sur l'endpoint `/resource/{id}.json`, pagination via `$offset`/`$limit`, token facultatif `$$app_token`.

### Fields clés — Flood Events (`aq7i-eu5q`)

| Field                           | Type           | Description                     |
| ------------------------------- | -------------- | ------------------------------- |
| `sensor_id`                     | text           | JOIN key avec sensor metadata   |
| `sensor_name`                   | text           | Nom humain du capteur           |
| `flood_start_time`              | datetime (GMT) | Début de la crue                |
| `flood_end_time`                | datetime (GMT) | Fin de la crue                  |
| `max_depth_inches`              | number         | Hauteur maximale mesurée        |
| `onset_time_mins`               | number         | Temps pour atteindre le max     |
| `drain_time_mins`               | number         | Temps de drainage depuis le pic |
| `duration_mins`                 | number         | Durée totale                    |
| `duration_above_4_inches_mins`  | number         | Durée > 4″ (impact véhicule)    |
| `duration_above_12_inches_mins` | number         | Durée > 12″ (impact rdc/bâti)   |
| `duration_above_24_inches_mins` | number         | Durée > 24″ (dangereux)         |
| `flood_profile_depth_inches`    | text (CSV)     | Time series hauteur             |
| `flood_profile_time_secs`       | text (CSV)     | Time series timestamps          |

### Fields clés — Sensor Metadata (`kb2e-tjy3`)

| Field                              | Type   | Description                                 |
| ---------------------------------- | ------ | ------------------------------------------- |
| `sensor_id`                        | text   | PK                                          |
| `latitude` / `longitude`           | number | Position capteur                            |
| `location`                         | point  | GeoJSON point (usage direct)                |
| `street_name`                      | text   | Rue                                         |
| `borough`                          | text   | Borough                                     |
| `zipcode`                          | text   | ZIP                                         |
| `community_board`                  | number | CB                                          |
| `council_district`                 | text   | City Council district                       |
| `census_tract`                     | text   | Census tract 2020                           |
| `nta`                              | text   | Neighborhood Tabulation Area                |
| `date_installed`                   | date   | Date de déploiement                         |
| `date_removed`                     | date   | Nullable — capteur actif si null            |
| `tidally_influenced`               | text   | "Yes"/"No" — si la crue est liée aux marées |
| `lowest_point_height_delta_inches` | number | Offset du capteur vs point le plus bas rue  |

### Stratégie d'intégration

1. **Ingest metadata d'abord** : `kb2e-tjy3` → table `floodnet_sensors` (PK `sensor_id`, lat/lon, NTA, CB, tidal flag, active flag = `date_removed IS NULL`)
2. **Map chaque capteur à une cellule H3** (résolution 9 ou 10 selon la granularité map) — pré-calcul au ingest
3. **Ingest events incrémental** : `aq7i-eu5q`, watermark sur `flood_start_time`, table `floodnet_events`
4. **Ne pas stocker les time series brutes** (`flood_profile_*`) sauf si on en a un usage — ce sont de gros champs texte. Garder seulement les summary stats.
5. **Join en compute** : agréger par capteur / NTA / H3 cell → flood frequency (N/an), median max depth, median duration, tidal share
6. **Exposer en API** : `/environmental/flood-events?bbox=...` retournant GeoJSON points + stats agrégés
7. **Frontend** : overlay "FloodNet Sensors" affichant capteurs actifs + heatmap de fréquence par NTA

### Score impact (Environmental Layer, Milestone 4)

Ajouter à `climate` dans `EnvironmentalScore` :

```typescript
climate: {
  floodZone: 'none' | 'moderate' | 'high' | 'extreme'; // FEMA (prédit)
  heatVulnerability: number;
  coastalRisk: boolean;

  // FloodNet (mesuré)
  measuredFloodFrequency: number; // events/year dans un rayon de X m
  measuredMaxDepth: number; // p95 max depth observé (inches)
  nearestSensorDistanceM: number; // distance au capteur le plus proche
  tidallyInfluenced: boolean; // au moins un capteur proche marqué tidal
}
```

### Fichiers à créer

```
packages/pipeline/src/ingest/
  └── floodnet.ts                 # Ingest metadata + events incrémental

packages/pipeline/src/compute/
  └── flood-stats.ts              # Agrégats par sensor/NTA/H3

packages/api/src/routes/
  └── environmental.ts            # GET /environmental/flood-events, /flood-stats

packages/web/src/components/
  └── FloodNetLayer.tsx           # Overlay capteurs + heatmap
```

### JOIN strategy — linking FloodNet to our schema

FloodNet sensor metadata (`kb2e-tjy3`) partage **3 clés directement JOIN-ables** avec notre table `places` (`packages/pipeline/src/db/schema.ts:21`), plus les coordonnées. **Pas de clé building-level** (pas de BBL, pas de BIN) — les capteurs sont dans la rue, pas attachés à un bâtiment. C'est intentionnel, ne pas forcer.

| Notre champ (`places`)   | FloodNet (`kb2e-tjy3`)   | Format                                | Index existant       | Statut                           |
| ------------------------ | ------------------------ | ------------------------------------- | -------------------- | -------------------------------- |
| `ntaCode`                | `nta`                    | NTA 2020 (`BK0503`, `QN0707`)         | `idx_places_nta`     | ✅ Exact match                   |
| `communityDistrict`      | `community_board`        | 3-digit `{boro}{cd}` (`305` = BK CD5) | —                    | ✅ Exact match                   |
| `borough`                | `borough`                | Nom complet (`Brooklyn`)              | `idx_places_borough` | ✅ Exact match                   |
| `latitude` / `longitude` | `latitude` / `longitude` | WGS84 décimal                         | `idx_places_coords`  | ✅ Spatial proximity             |
| `bin` / `bbl`            | —                        | —                                     | —                    | ❌ N/A (pas de concept building) |

**Vérification des formats** (fait avant d'écrire cette section) :

- `places.ntaCode` est peuplé par `normalizeNTA()` (`packages/pipeline/src/ingest/boundaries.ts:135`), qui lit `ntacode` ou `nta2020` de l'API NYC → format NTA 2020 (`BK0101`, `MN0101`). FloodNet renvoie `"nta": "BK0503"` sur un sample live → **même référentiel**.
- `places.communityDistrict` est pris depuis `community_board` / `community_district` / `commmunity_board` (sic) des sources DOB/ZAP/PLUTO — voir `dob-violations.ts:202`, `dob-now.ts:192`, `zap.ts:169`. Format `boro_cd` 3 digits. FloodNet renvoie `"community_board": "305"` → **même format**.
- `places.borough` est produit par `mapBorough()` (`boundaries.ts:210`) — renvoie `"Manhattan"`, `"Bronx"`, `"Brooklyn"`, `"Queens"`, `"Staten Island"`. FloodNet utilise les mêmes noms complets.

### JOIN strategy — usage recommandé par niveau de granularité

**1. Spatial proximity** (le plus précis, usage : flood exposure par bâtiment/projet)

Pour chaque `place`, trouver les capteurs actifs dans un rayon R (suggéré 250-500 m). Pré-filtrer via H3 ou bounding box pour éviter le cross-join.

```sql
-- Suggestif — sensors actifs proches d'un place
SELECT s.sensor_id, s.latitude, s.longitude,
       -- Haversine inline ou via fonction
       (6371000 * acos(cos(radians(:lat)) * cos(radians(s.latitude)) *
        cos(radians(s.longitude) - radians(:lng)) +
        sin(radians(:lat)) * sin(radians(s.latitude))))  AS distance_m
FROM floodnet_sensors s
WHERE s.date_removed IS NULL
  AND s.latitude BETWEEN :lat - 0.005 AND :lat + 0.005  -- ~500m bbox prefilter
  AND s.longitude BETWEEN :lng - 0.006 AND :lng + 0.006
HAVING distance_m < 500
ORDER BY distance_m
LIMIT 5;
```

**2. H3 cell** (pour le rendu heatmap — JOIN sur `heatmap_cells.h3_index`)

Pré-calculer le H3 index du capteur au moment de l'ingest (lat/lon → H3 res 9 ou 10). Stocker dans `floodnet_sensors.h3_index`. JOIN direct avec la table `heatmap_cells` existante (`schema.ts:139`).

**3. NTA** (le plus naturel pour agréger — usage : stats "flood events par NTA", filtres UI)

```sql
-- Flood event stats par NTA (pour overlay carte)
SELECT p.nta_code, p.nta_name,
       COUNT(DISTINCT fe.event_id) AS event_count,
       AVG(fe.max_depth_inches) AS avg_max_depth,
       MAX(fe.max_depth_inches) AS peak_depth
FROM places p
JOIN floodnet_sensors s ON p.nta_code = s.nta
JOIN floodnet_events fe ON fe.sensor_id = s.sensor_id
WHERE s.date_removed IS NULL
  AND fe.flood_start_time > datetime('now', '-1 year')
GROUP BY p.nta_code, p.nta_name;
```

**4. Community District** (dashboards overview — plus grossier, ~59 CD vs ~200 NTA)

**5. Borough** (top-line stats seulement — trop coarse pour UI actionnable)

### Caveats JOIN — à ne pas oublier

- **Couverture partielle** : ~200 capteurs actifs pour tout NYC. Beaucoup de NTAs ont 0 capteur → `LEFT JOIN` + fallback FEMA / 311. Ne pas supposer une couverture uniforme.
- **"Même NTA" ≠ "même risque"** : un capteur inondé au coin d'une rue ne dit pas grand-chose sur un place 800 m plus loin dans le même NTA. Pour le signal par bâtiment, **toujours préférer spatial proximity** et exposer la distance au capteur le plus proche (`nearestSensorDistanceM`) pour que le frontend puisse flagger une confiance faible.
- **Sensors retirés** : filtrer `date_removed IS NULL` partout dans les agrégats actifs. Garder les historiques pour les événements passés.
- **Tidally influenced** : les crues marées sont prévisibles et ≠ crues pluviales. Ne pas les mélanger dans les agrégats "climate risk" — les compter séparément ou les exclure du score risque pluvial.
- **Format BBL/BIN absent** : ne pas essayer d'inventer une clé. Si on a besoin d'associer un sensor à un bâtiment précis, c'est par géolocalisation uniquement.
- **CB vs boro_cd** : vérifier au moment de l'ingest qu'aucune source ne stocke le CD au format alternatif (`"MN 1"`, `"1"` seul sans borough digit). Si oui, normaliser **avant** le JOIN.

### Fichiers à toucher pour le JOIN

```
packages/pipeline/src/db/schema.ts
  └── Ajouter table floodnet_sensors avec:
      - sensor_id (PK)
      - latitude, longitude
      - h3_index (pré-calculé, res 9)
      - nta_code, community_district, borough, zipcode
      - date_installed, date_removed, tidally_influenced
      - index sur nta_code, community_district, h3_index, coords

  └── Ajouter table floodnet_events avec:
      - event_id (PK, composite de sensor_id + flood_start_time)
      - sensor_id (FK floodnet_sensors)
      - flood_start_time, flood_end_time
      - max_depth_inches, duration_mins
      - duration_above_{4,12,24}_inches_mins
      - index sur (sensor_id, flood_start_time DESC)
```

### Gotchas

- Timestamps en **GMT** — convertir en America/New_York pour l'affichage et les filtres par date
- `flood_profile_*` sont des **strings CSV** (pas des arrays Socrata) — parser si besoin
- Capteurs déplacés / retirés : toujours filtrer `date_removed IS NULL` pour le réseau actif
- Capteurs **tidally_influenced** : les crues sont prévisibles (marées), pas météo — à flagger différemment dans le scoring
- Couverture partielle : FloodNet ne couvre pas tout NYC. Pour les zones sans capteur, fallback sur FEMA + 311 flooding complaints

---

## 5. Ordre d'implémentation

1. **`hpd-violations.ts`** — High value, straightforward Socrata
2. **`hpd-complaints.ts`** — Similar pattern
3. **`evictions.ts`** — NYC Open Data executed evictions
4. **`floodnet.ts`** — Sensors + events, pattern Socrata identique
5. **Update shared types** — Add new sources/events
6. **Update ingest job** — Include new sources
7. **Update compute** — Factor HPD/evictions/flood into scores

---

## 6. NYCDB — Référence ETL

### Ce que fait NYCDB

NYCDB est un projet Python qui:

1. **Download** CSV/JSON depuis NYC Open Data et autres sources
2. **Transform** headers, nettoie les données, ajoute des colonnes calculées (BBL)
3. **Load** dans PostgreSQL avec indexes optimisés

### Transformations disponibles

| Transform                             | Description                                               |
| ------------------------------------- | --------------------------------------------------------- |
| `flip_numbers()`                      | `2017values` → `values2017` (SQL can't start with digits) |
| `clean_headers()`                     | Lowercase, remove invalid chars                           |
| `with_bbl()`                          | Ajoute colonne BBL = concat(borough, block, lot)          |
| `skip_fields()`                       | Remove unused columns                                     |
| `hpd_registrations_address_cleanup()` | Normalize addresses                                       |
| `extract_csvs_from_zip()`             | Merge multiple CSVs from ZIP                              |

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

| Aspect             | NYCDB                  | Notre approche                |
| ------------------ | ---------------------- | ----------------------------- |
| **Language**       | Python                 | TypeScript                    |
| **DB**             | PostgreSQL             | SQLite (local) / Turso (prod) |
| **Utilisation**    | Standalone DB          | Intégré dans notre pipeline   |
| **Ce qu'on prend** | Schémas, indexes, URLs | ✅                            |
| **Ce qu'on skip**  | Code Python            | ✅                            |

**Conclusion**: On utilise NYCDB comme **référence** pour les schémas et bonnes pratiques, mais on implémente en TypeScript dans notre stack.

---

## Sources

- [HPD Open Data](https://www.nyc.gov/site/hpd/about/open-data.page)
- [Housing Data Coalition](https://www.housingdatanyc.org/)
- [OCA GitHub](https://github.com/housing-data-coalition/oca)
- [NYC Evictions Dataset](https://data.cityofnewyork.us/City-Government/Evictions/6z8x-wfk4)
- [NYCDB GitHub](https://github.com/nycdb/nycdb) — Reference ETL & schemas
