# Plan d'implémentation – Urban Change Map

> Aligné avec `SPEC_REFINED.md` (vérité produit) et `SPEC_INITIALE.md`

---

## 0. Principes fondamentaux (de SPEC_REFINED)

Ces principes guident TOUTES les décisions:

| Principe | Implication |
|----------|-------------|
| **Transformation, pas projets** | L'entité principale est "ce que devient un lieu", pas un dossier administratif |
| **Grand public, pas experts** | Zéro acronyme en UI. Compréhension en 5 minutes |
| **Incertitude assumée** | Visuel différent pour "en discussion" vs "probable" vs "certain" |
| **Temps = narration** | Le slider montre "quand tu le sentiras", pas "quand c'est déposé" |
| **Jamais submerger** | Agrégation forcée en zone dense. Cacher > surcharger |
| **NYC entière** | La valeur = comparer quartiers, voir dynamiques globales |

**Test de succès (5 minutes):**
> L'utilisateur peut dire: "Je sais quels coins éviter l'an prochain"

---

## 1. Architecture globale

### 1.1 Structure du projet (Monorepo)

```
nyc-urban-change-map/
├── packages/
│   ├── pipeline/          # Ingestion, normalisation, narration
│   ├── api/               # REST backend (Fastify)
│   ├── web/               # React frontend avec carte
│   └── shared/            # Types, constantes, utilitaires
├── data/
│   ├── raw/               # Réponses API cachées
│   ├── processed/         # États de transformation
│   └── geo/               # Boundaries GeoJSON (NTA, CD)
├── infra/                 # Docker, déploiement
└── docs/                  # Documentation technique
```

### 1.2 Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Base de données | PostgreSQL + PostGIS | Requêtes spatiales, H3 extension |
| Backend | Node.js + Fastify | Rapide, TypeScript natif |
| ORM | Drizzle | Type-safe, migrations |
| Frontend | React + Vite | Dev rapide |
| Carte | Mapbox GL JS | Vector tiles, expressions dynamiques |
| State | Zustand + TanStack Query | Simple, cache intelligent |
| Styling | Tailwind CSS | Design system ready |

---

## 2. Modèle de données: Transformation-Centric

### 2.1 Concept central

```
┌─────────────────────────────────────────────────────────────┐
│                    MODÈLE CONCEPTUEL                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Place (lieu stable)                                       │
│     │                                                       │
│     └──▶ TransformationState (état dérivé, recalculé)      │
│            ├── intensity: 0-100                            │
│            ├── nature: densification|renovation|infra      │
│            ├── certainty: discussion|probable|certain      │
│            ├── headline: "2 immeubles en construction"     │
│            ├── impact_phases:                              │
│            │     ├── disruption: 2024-2027                 │
│            │     ├── visible_change: 2027                  │
│            │     └── usage_change: 2028                    │
│            └── sources: [...] (preuves, masquées)          │
│                                                             │
│   L'utilisateur voit TransformationState                   │
│   Il ne voit JAMAIS les sources brutes en premier          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Schéma de base de données

```sql
-- ============================================================
-- TABLES SOURCES (internes, jamais exposées directement)
-- ============================================================

-- Lieux géographiques stables
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geometry GEOMETRY(Geometry, 4326) NOT NULL,
  geometry_type VARCHAR(20) NOT NULL,  -- 'point' | 'polygon'
  bin VARCHAR(10),
  bbl VARCHAR(10),
  address TEXT,
  borough VARCHAR(20),
  nta_code VARCHAR(10),
  nta_name VARCHAR(100),
  community_district VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Événements bruts (données sources)
CREATE TABLE raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  source VARCHAR(20) NOT NULL,           -- 'dob' | 'zap' | 'capital'
  source_id VARCHAR(100),
  event_type VARCHAR(50) NOT NULL,       -- Interne: 'permit_nb', 'ulurp_filed'
  event_date DATE NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLES DÉRIVÉES (ce que l'API expose)
-- ============================================================

-- État de transformation par lieu (recalculé quotidiennement)
CREATE TABLE transformation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES places(id) ON DELETE CASCADE UNIQUE,

  -- Métriques
  intensity INTEGER NOT NULL DEFAULT 0,          -- 0-100
  nature VARCHAR(30),                            -- 'densification' | 'renovation' | 'infrastructure' | 'mixed'
  certainty VARCHAR(20) NOT NULL DEFAULT 'discussion',  -- 'discussion' | 'probable' | 'certain'

  -- Narration humaine
  headline TEXT,                                 -- "Zone en densification"
  one_liner TEXT,                                -- "2 immeubles + travaux de voirie"
  disruption_summary TEXT,                       -- "Bruit et camions jusqu'en 2027"

  -- Phases d'impact (quand l'utilisateur le sentira)
  disruption_start DATE,
  disruption_end DATE,
  visible_change_date DATE,
  usage_change_date DATE,

  -- Metadata
  event_count INTEGER DEFAULT 0,
  first_activity DATE,
  last_activity DATE,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agrégation H3 pour heatmap (niveau 8 = ~460m hexagons)
CREATE TABLE heatmap_cells (
  h3_index VARCHAR(20) PRIMARY KEY,
  center GEOMETRY(Point, 4326),
  boundary GEOMETRY(Polygon, 4326),
  avg_intensity FLOAT,
  max_intensity INTEGER,
  place_count INTEGER,
  dominant_nature VARCHAR(30),
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX idx_places_geometry ON places USING GIST(geometry);
CREATE INDEX idx_places_nta ON places(nta_code);
CREATE INDEX idx_places_bin ON places(bin) WHERE bin IS NOT NULL;

CREATE INDEX idx_transformation_intensity ON transformation_states(intensity);
CREATE INDEX idx_transformation_certainty ON transformation_states(certainty);
CREATE INDEX idx_transformation_disruption ON transformation_states(disruption_start, disruption_end);

CREATE INDEX idx_heatmap_h3 ON heatmap_cells(h3_index);
```

### 2.3 Calcul de l'état de transformation

```typescript
interface TransformationInput {
  events: RawEvent[];
  place: Place;
}

interface TransformationState {
  intensity: number;           // 0-100
  nature: Nature;
  certainty: Certainty;
  headline: string;
  one_liner: string;
  disruption_summary: string;
  disruption_start: Date | null;
  disruption_end: Date | null;
  visible_change_date: Date | null;
  usage_change_date: Date | null;
}

function computeTransformationState(input: TransformationInput): TransformationState {
  const { events, place } = input;

  // 1. Calculer l'intensité
  const intensity = computeIntensity(events);

  // 2. Dériver la nature
  const nature = deriveNature(events);

  // 3. Évaluer la certitude
  const certainty = deriveCertainty(events);

  // 4. Estimer les phases d'impact
  const phases = estimateImpactPhases(events);

  // 5. Générer les textes narratifs
  const narratives = generateNarratives({ events, nature, certainty, phases });

  return {
    intensity,
    nature,
    certainty,
    ...phases,
    ...narratives,
  };
}
```

#### Calcul de l'intensité

```typescript
const INTENSITY_WEIGHTS: Record<string, number> = {
  // Travaux mineurs
  'scaffold': 3,
  'equipment_work': 3,
  'plumbing': 5,
  'mechanical': 5,

  // Altérations
  'minor_alteration': 10,    // A2
  'major_alteration': 30,    // A1

  // Transformations majeures
  'demolition': 35,
  'new_building': 50,

  // Planification
  'zap_filed': 8,
  'zap_approved': 20,
  'ulurp_filed': 10,
  'ulurp_approved': 25,

  // Projets publics
  'capital_project': 25,
};

function computeIntensity(events: RawEvent[]): number {
  let score = 0;
  const seen = new Set<string>();

  for (const event of events) {
    const weight = INTENSITY_WEIGHTS[event.event_type] || 0;

    // Éviter le double comptage du même type (sauf A2 répétés)
    if (event.event_type === 'minor_alteration') {
      score += weight;  // Cumulatif
    } else if (!seen.has(event.event_type)) {
      score += weight;
      seen.add(event.event_type);
    }
  }

  return Math.min(score, 100);
}
```

#### Dérivation de la certitude

```typescript
type Certainty = 'discussion' | 'probable' | 'certain';

function deriveCertainty(events: RawEvent[]): Certainty {
  // Hiérarchie: certain > probable > discussion

  const hasActive = events.some(e =>
    e.event_type === 'construction_started' ||
    e.event_type === 'demolition_in_progress'
  );
  if (hasActive) return 'certain';

  const hasApproved = events.some(e =>
    e.event_type === 'permit_issued' ||
    e.event_type === 'zap_approved' ||
    e.event_type === 'ulurp_approved'
  );
  if (hasApproved) return 'probable';

  const hasFiled = events.some(e =>
    e.event_type.includes('filed') ||
    e.event_type === 'eis_submitted'
  );
  if (hasFiled) return 'discussion';

  return 'discussion';
}
```

#### Estimation des phases d'impact

```typescript
interface ImpactPhases {
  disruption_start: Date | null;
  disruption_end: Date | null;
  visible_change_date: Date | null;
  usage_change_date: Date | null;
}

function estimateImpactPhases(events: RawEvent[]): ImpactPhases {
  const phases: ImpactPhases = {
    disruption_start: null,
    disruption_end: null,
    visible_change_date: null,
    usage_change_date: null,
  };

  // Trouver les dates clés
  const constructionStart = findEventDate(events, 'construction_started');
  const permitIssued = findEventDate(events, 'permit_issued');
  const expectedCompletion = findExpectedCompletion(events);

  // Disruption = du début travaux à la fin
  if (constructionStart) {
    phases.disruption_start = constructionStart;
  } else if (permitIssued) {
    // Estimer début 6 mois après permit
    phases.disruption_start = addMonths(permitIssued, 6);
  }

  if (expectedCompletion) {
    phases.disruption_end = expectedCompletion;
    phases.visible_change_date = expectedCompletion;
    phases.usage_change_date = addMonths(expectedCompletion, 6);
  } else if (phases.disruption_start) {
    // Estimer 2 ans de travaux par défaut
    phases.disruption_end = addYears(phases.disruption_start, 2);
    phases.visible_change_date = phases.disruption_end;
  }

  return phases;
}
```

#### Génération des narratives

```typescript
interface Narratives {
  headline: string;
  one_liner: string;
  disruption_summary: string;
}

function generateNarratives(context: NarrativeContext): Narratives {
  const { events, nature, certainty, phases } = context;

  // Compter les types significatifs
  const newBuildings = countByType(events, 'new_building');
  const demolitions = countByType(events, 'demolition');
  const majorWorks = countByType(events, 'major_alteration');

  // Headline (5-10 mots)
  let headline: string;
  if (newBuildings > 0) {
    headline = newBuildings === 1
      ? "Nouvel immeuble en préparation"
      : `${newBuildings} nouveaux immeubles en préparation`;
  } else if (demolitions > 0) {
    headline = "Démolition et reconstruction";
  } else if (majorWorks > 0) {
    headline = "Rénovation majeure en cours";
  } else {
    headline = "Travaux et modifications";
  }

  // Ajouter le qualificateur de certitude
  if (certainty === 'discussion') {
    headline = headline.replace('en préparation', 'à l\'étude');
    headline = headline.replace('en cours', 'envisagée');
  }

  // One-liner (résumé factuel)
  const parts: string[] = [];
  if (newBuildings > 0) parts.push(`${newBuildings} immeuble(s)`);
  if (demolitions > 0) parts.push(`${demolitions} démolition(s)`);
  if (majorWorks > 0) parts.push(`${majorWorks} rénovation(s)`);
  const one_liner = parts.join(' + ') || "Activité de transformation";

  // Disruption summary
  let disruption_summary = "";
  if (phases.disruption_start && phases.disruption_end) {
    const startYear = phases.disruption_start.getFullYear();
    const endYear = phases.disruption_end.getFullYear();
    if (startYear === endYear) {
      disruption_summary = `Perturbations attendues en ${startYear}`;
    } else {
      disruption_summary = `Perturbations attendues de ${startYear} à ${endYear}`;
    }
  }

  return { headline, one_liner, disruption_summary };
}
```

---

## 3. Pipeline de données

### 3.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PIPELINE QUOTIDIEN                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ INGEST   │───▶│ GEOCODE  │───▶│ COMPUTE  │───▶│ AGGREGATE│  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │               │               │               │         │
│       ▼               ▼               ▼               ▼         │
│   raw_events      places       transformation    heatmap_cells │
│                                    _states                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Sources de données NYC

| Source | Endpoint | Fréquence | Données |
|--------|----------|-----------|---------|
| DOB NOW | Socrata API | Quotidien | Permits actifs |
| DOB Issuance | Socrata API | Quotidien | Permits historiques |
| ZAP | Planning API | Quotidien | ULURP, rezonings |
| PLUTO | Static download | Trimestriel | Géométries bâtiments |
| Capital Projects | Socrata API | Hebdo | Projets publics |

### 3.3 Jobs d'ingestion

```typescript
// packages/pipeline/src/ingest/dob.ts

const DOB_PERMITS_URL = 'https://data.cityofnewyork.us/resource/ipu4-2vj7.json';

interface DOBPermit {
  job__: string;
  doc__: string;
  borough: string;
  bin__: string;
  house__: string;
  street_name: string;
  job_type: string;
  job_status: string;
  filing_date: string;
  // ...
}

async function ingestDOBPermits(): Promise<void> {
  const lastSync = await getLastSyncDate('dob');

  const params = new URLSearchParams({
    $where: `filing_date > '${lastSync.toISOString()}'`,
    $limit: '50000',
    $order: 'filing_date DESC',
  });

  const permits = await fetchWithRetry<DOBPermit[]>(
    `${DOB_PERMITS_URL}?${params}`
  );

  for (const permit of permits) {
    await upsertRawEvent({
      source: 'dob',
      source_id: `${permit.job__}-${permit.doc__}`,
      event_type: mapJobType(permit.job_type),
      event_date: parseDate(permit.filing_date),
      raw_data: permit,
      // place_id résolu après geocoding
    });
  }

  await updateLastSyncDate('dob');
}

function mapJobType(jobType: string): string {
  const mapping: Record<string, string> = {
    'NB': 'new_building',
    'A1': 'major_alteration',
    'A2': 'minor_alteration',
    'DM': 'demolition',
    'SG': 'scaffold',
    'EW': 'equipment_work',
    'PL': 'plumbing',
  };
  return mapping[jobType] || 'other';
}
```

### 3.4 Job de calcul des états

```typescript
// packages/pipeline/src/compute/transformations.ts

async function computeAllTransformations(): Promise<void> {
  // Récupérer tous les places avec events récents
  const places = await db.query.places.findMany({
    with: {
      rawEvents: {
        where: (e, { gte }) => gte(e.created_at, subDays(new Date(), 30)),
      },
    },
  });

  for (const place of places) {
    const state = computeTransformationState({
      place,
      events: place.rawEvents,
    });

    await db
      .insert(transformationStates)
      .values({
        place_id: place.id,
        ...state,
        computed_at: new Date(),
      })
      .onConflictDoUpdate({
        target: transformationStates.place_id,
        set: { ...state, computed_at: new Date() },
      });
  }
}
```

### 3.5 Job d'agrégation heatmap

```typescript
// packages/pipeline/src/compute/heatmap.ts

async function computeHeatmapCells(): Promise<void> {
  // Utiliser H3 niveau 8 (~460m hexagons) pour NYC
  const H3_RESOLUTION = 8;

  const aggregates = await db.execute(sql`
    SELECT
      h3_lat_lng_to_cell(ST_Centroid(p.geometry), ${H3_RESOLUTION}) as h3_index,
      AVG(ts.intensity) as avg_intensity,
      MAX(ts.intensity) as max_intensity,
      COUNT(DISTINCT p.id) as place_count,
      MODE() WITHIN GROUP (ORDER BY ts.nature) as dominant_nature
    FROM places p
    JOIN transformation_states ts ON ts.place_id = p.id
    WHERE ts.intensity > 0
    GROUP BY 1
  `);

  for (const agg of aggregates) {
    await db
      .insert(heatmapCells)
      .values({
        h3_index: agg.h3_index,
        center: h3ToGeo(agg.h3_index),
        boundary: h3ToGeoBoundary(agg.h3_index),
        avg_intensity: agg.avg_intensity,
        max_intensity: agg.max_intensity,
        place_count: agg.place_count,
        dominant_nature: agg.dominant_nature,
        computed_at: new Date(),
      })
      .onConflictDoUpdate({
        target: heatmapCells.h3_index,
        set: { ...agg, computed_at: new Date() },
      });
  }
}
```

---

## 4. API REST

### 4.1 Philosophie

L'API expose des **états de transformation**, jamais des events bruts.
Les sources sont disponibles en "expansion" optionnelle.

### 4.2 Endpoints

```
BASE: /api/v1

# Carte et exploration
GET  /map/places
     ?bounds={sw_lng,sw_lat,ne_lng,ne_lat}
     &zoom={z}
     &min_intensity={0-100}
     &certainty={discussion,probable,certain}
     &time_mode={now|near|far}
     → GeoJSON des places avec transformation_state

GET  /map/heatmap
     ?bounds={...}
     &resolution={7-9}
     → Hexagones H3 avec intensité agrégée

GET  /map/clusters
     ?bounds={...}
     &zoom={z}
     → Points clusterisés pour zoom faible

# Détail d'un lieu
GET  /places/:id
     ?expand=sources
     → Détail transformation + narratives
     → Sources incluses seulement si expand=sources

# Recherche
GET  /search
     ?q={adresse|quartier}
     → Geocoding + places proches avec leur état

# Metadata
GET  /neighborhoods
     → Liste NTA avec stats agrégées

GET  /stats
     → Stats globales (places, intensité moyenne, etc.)
```

### 4.3 Formats de réponse

```typescript
// GET /map/places
interface MapPlacesResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: GeoJSON.Point | GeoJSON.Polygon;
    properties: {
      intensity: number;
      certainty: 'discussion' | 'probable' | 'certain';
      nature: string;
      headline: string;
      disruption_end: string | null;  // Pour savoir "quand ça finit"
    };
  }>;
  meta: {
    total: number;
    clustered: boolean;
    time_mode: string;
  };
}

// GET /places/:id
interface PlaceDetailResponse {
  id: string;
  address: string;
  neighborhood: string;
  borough: string;
  geometry: GeoJSON.Geometry;

  transformation: {
    intensity: number;
    nature: string;
    certainty: string;
    headline: string;
    one_liner: string;
    disruption_summary: string;

    phases: {
      disruption: { start: string; end: string } | null;
      visible_change: string | null;
      usage_change: string | null;
    };
  };

  // Seulement si ?expand=sources
  sources?: Array<{
    type: string;
    date: string;
    description: string;
    official_url?: string;
  }>;
}

// GET /map/heatmap
interface HeatmapResponse {
  cells: Array<{
    h3_index: string;
    boundary: number[][];
    avg_intensity: number;
    place_count: number;
    dominant_nature: string;
  }>;
}
```

---

## 5. Frontend

### 5.1 Principes UX (de SPEC_REFINED)

1. **Compréhension en 5 minutes** - Pas de tutorial, pas de modal
2. **Zéro acronyme** - "En discussion" pas "ULURP filed"
3. **Jamais submerger** - Agrégation automatique en zone dense
4. **Mobile-first** - Bottom sheet, pas sidebar sur mobile

### 5.2 Hiérarchie des composants

```
App
├── MapView (full screen)
│   ├── MapGL
│   │   ├── HeatmapLayer (zoom < 14)
│   │   ├── ClusterLayer (zoom 14-16)
│   │   ├── PointsLayer (zoom > 16)
│   │   └── PolygonsLayer
│   │
│   ├── TimeControl (bottom center)
│   │   ├── ModeButtons ["Maintenant", "Bientôt", "Plus tard"]
│   │   └── YearSlider (2020-2035)
│   │
│   ├── IntensityControl (bottom left)
│   │   └── Slider [Tout ←→ Majeur seulement]
│   │
│   └── Legend (bottom right)
│       ├── CertaintyLegend
│       └── IntensityScale
│
├── SearchBar (top)
│   └── SearchSuggestions
│
├── DetailPanel (slide-in, or bottom sheet mobile)
│   ├── Header
│   │   ├── Address
│   │   ├── Neighborhood
│   │   └── CertaintyBadge
│   │
│   ├── IntensityIndicator (visual gauge)
│   │
│   ├── NarrativeSection
│   │   ├── Headline (bold, large)
│   │   ├── OneLiner
│   │   └── DisruptionSummary
│   │
│   ├── ImpactTimeline (visual)
│   │   └── PhaseBar [disruption → visible → usage]
│   │
│   └── SourcesAccordion (collapsed by default)
│       └── SourceItem (repeating)
│
└── NeighborhoodCompare (modal, v2)
```

### 5.3 États visuels (encodage)

| Variable | Encodage | Valeurs |
|----------|----------|---------|
| Intensité | Taille + Couleur | 4px gris → 24px rouge |
| Certitude | Opacité + Bordure | Discussion: 40% dashed / Probable: 70% solid / Certain: 100% solid |
| Nature | Icône (optionnel) | Immeuble / Voirie / Parc |

```typescript
// Palette de couleurs par intensité
const INTENSITY_COLORS = {
  low: '#94a3b8',      // slate-400 (0-30)
  medium: '#fbbf24',   // amber-400 (30-60)
  high: '#f97316',     // orange-500 (60-80)
  extreme: '#dc2626',  // red-600 (80-100)
};

function intensityToColor(intensity: number): string {
  if (intensity < 30) return INTENSITY_COLORS.low;
  if (intensity < 60) return INTENSITY_COLORS.medium;
  if (intensity < 80) return INTENSITY_COLORS.high;
  return INTENSITY_COLORS.extreme;
}

// Mapbox expressions pour certitude
const certaintyOpacity = [
  'match', ['get', 'certainty'],
  'discussion', 0.4,
  'probable', 0.7,
  'certain', 1.0,
  0.5
];
```

### 5.4 State management

```typescript
// stores/viewStore.ts
interface ViewStore {
  // Time control
  timeMode: 'now' | 'near' | 'far';
  selectedYear: number;

  // Intensity filter
  minIntensity: number;  // 0-100, default 0

  // Map
  viewport: Viewport;
  bounds: Bounds | null;

  // Selection
  selectedPlaceId: string | null;

  // Actions
  setTimeMode: (mode: TimeMode) => void;
  setSelectedYear: (year: number) => void;
  setMinIntensity: (intensity: number) => void;
  selectPlace: (id: string | null) => void;
}

// hooks/useMapData.ts
function useMapData() {
  const { bounds, minIntensity, timeMode } = useViewStore();

  return useQuery({
    queryKey: ['mapPlaces', bounds, minIntensity, timeMode],
    queryFn: () => api.getMapPlaces({ bounds, minIntensity, timeMode }),
    enabled: !!bounds,
    staleTime: 30_000,
  });
}
```

### 5.5 Contrôle du bruit (auto-declutter)

```typescript
// hooks/useSmartDisplay.ts

interface DisplayMode {
  mode: 'heatmap' | 'clusters' | 'points';
  clusterRadius: number;
}

function useSmartDisplay(zoom: number, pointCount: number): DisplayMode {
  // Règles de declutter automatique

  if (zoom < 12) {
    return { mode: 'heatmap', clusterRadius: 0 };
  }

  if (zoom < 15 || pointCount > 100) {
    return { mode: 'clusters', clusterRadius: 50 };
  }

  return { mode: 'points', clusterRadius: 0 };
}
```

---

## 6. Phases d'implémentation

### Phase 1: MVP NYC (scope révisé)

**Objectif:** Carte NYC entière avec compréhension en 5 minutes

#### Milestone 1.1: Infrastructure
- [ ] Setup monorepo (pnpm)
- [ ] PostgreSQL + PostGIS + H3 (Docker)
- [ ] Config TypeScript stricte
- [ ] CI basique

#### Milestone 1.2: Pipeline données
- [ ] Ingestion DOB permits (NYC entier)
- [ ] Geocoding BIN → Place
- [ ] Import PLUTO géométries
- [ ] Job calcul transformation_states
- [ ] Job agrégation heatmap H3

#### Milestone 1.3: API
- [ ] Setup Fastify
- [ ] `GET /map/places` avec filtres
- [ ] `GET /map/heatmap`
- [ ] `GET /places/:id`
- [ ] `GET /search`

#### Milestone 1.4: Carte de base
- [ ] React + Vite + Tailwind
- [ ] Mapbox GL integration
- [ ] Heatmap layer
- [ ] Points/clusters layer
- [ ] Encodage visuel certitude

#### Milestone 1.5: Interactions
- [ ] Click → DetailPanel
- [ ] TimeControl (3 modes)
- [ ] IntensitySlider
- [ ] SearchBar

#### Milestone 1.6: Narratives
- [ ] Génération headline/one_liner
- [ ] DisruptionSummary
- [ ] ImpactTimeline visuel

#### Milestone 1.7: Polish
- [ ] Design system tokens
- [ ] Responsive (mobile bottom sheet)
- [ ] Empty states guidants
- [ ] Loading states

#### Milestone 1.8: Deploy
- [ ] Railway (DB)
- [ ] Vercel (frontend)
- [ ] Domain + SSL

---

### Phase 2: Intelligence

- [ ] Intégration ZAP (ULURP, rezonings)
- [ ] Capital Projects polygons
- [ ] Amélioration certitude avec plus de signaux
- [ ] Comparaison quartiers (modal)
- [ ] Partage URL avec état filtres

### Phase 3: Profondeur

- [ ] Ingestion PDFs CEQR
- [ ] Résumés AI des documents
- [ ] Historique long (2000-2020)
- [ ] Notifications (suivre une zone)
- [ ] API publique

---

## 7. Critères de succès Phase 1

### Métriques UX

| Métrique | Cible |
|----------|-------|
| Time to first interaction | < 10 sec |
| Time to "aha" moment | < 60 sec |
| Bounce rate | < 40% |
| 5-min comprehension test | Passé |

### Test de compréhension (5 min)

Après 5 minutes sur le site, l'utilisateur peut-il dire:

- [ ] "Je sais quels coins seront perturbés l'an prochain"
- [ ] "Je vois ce qui se prépare pour le futur"
- [ ] "Je comprends pourquoi ce quartier change"

### Anti-patterns à éviter

- ❌ Acronymes visibles (DOB, ULURP, CEQR)
- ❌ Liste de permits comme contenu principal
- ❌ Carte illisible en zone dense
- ❌ Besoin de lire des docs pour comprendre
- ❌ Filtres techniques ("job type", "source")

---

## 8. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Estimation dates fausse | Mauvaise prédiction impact | Qualifier clairement l'incertitude |
| NYC = trop de données | Carte illisible | Declutter agressif, intensité default > 0 |
| Narratives génériques | Pas de valeur ajoutée | Investir dans les templates par nature |
| Rate limits NYC API | Données stale | Cache 7 jours, sync incrémental |

---

## 9. Décisions techniques

| Question | Décision |
|----------|----------|
| H3 résolution heatmap | 8 (~460m hexagons) |
| Clustering côté | Serveur (Supercluster) |
| Recalcul transformations | Quotidien, batch |
| Hébergement | Railway DB + Vercel frontend |
| Mapbox vs Maplibre | Mapbox (simplicité) → Maplibre Phase 3 |
