# SPEC: Migration SQLite Local → Cloudflare

## Executive Summary

Migrer le backend de SQLite local (`better-sqlite3`) vers **Cloudflare D1** pour bénéficier d'une base serverless, distribuée globalement, avec backup automatique et zero-maintenance.

---

## Architecture Actuelle

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOCAL DEPLOYMENT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Pipeline   │───▶│  SQLite DB   │◀───│  Fastify API │      │
│  │  (Node.js)   │    │  (ucm.db)    │    │  (port 3001) │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                    ▲              │
│         │                   │                    │              │
│         ▼                   │                    │              │
│  ┌──────────────┐           │            ┌──────────────┐      │
│  │  NYC APIs    │           │            │  React Web   │      │
│  │  (Socrata)   │           │            │  (Vite)      │      │
│  └──────────────┘           │            └──────────────┘      │
│                             │                                   │
│                    /data/ucm.db (~500MB-4GB)                   │
│                    - better-sqlite3                             │
│                    - Drizzle ORM                                │
│                    - WAL mode, 1GB mmap                         │
└─────────────────────────────────────────────────────────────────┘
```

**Limitations actuelles:**

- Single-server, pas de HA
- Backup manuel
- Pas de CDN/edge
- Doit maintenir un serveur persistant

---

## Architecture Proposée: Cloudflare Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE DEPLOYMENT                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   CLOUDFLARE EDGE                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │  │
│  │  │   Pages    │  │  Workers   │  │       D1           │  │  │
│  │  │  (React)   │  │   (API)    │  │   (SQLite DB)      │  │  │
│  │  └────────────┘  └─────┬──────┘  └─────────┬──────────┘  │  │
│  │        │               │                   │              │  │
│  │        │               └───────────────────┘              │  │
│  │        │                       │                          │  │
│  │        │               ┌───────┴───────┐                  │  │
│  │        │               │  Read Replicas │                 │  │
│  │        │               │  (Global Edge) │                 │  │
│  │        │               └───────────────┘                  │  │
│  └────────┼──────────────────────────────────────────────────┘  │
│           │                                                     │
│  ┌────────┴────────┐                                           │
│  │   CDN Cache     │                                           │
│  │  (static assets)│                                           │
│  └─────────────────┘                                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              PIPELINE (GitHub Actions / Local)            │  │
│  │  ┌──────────────┐         ┌──────────────────────────┐   │  │
│  │  │   Ingest     │────────▶│  D1 (via HTTP API or     │   │  │
│  │  │   + Compute  │         │   wrangler d1 execute)   │   │  │
│  │  └──────────────┘         └──────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cloudflare Products à Utiliser

| Produit            | Usage                                     | Pricing (Workers Paid $5/mo)                             |
| ------------------ | ----------------------------------------- | -------------------------------------------------------- |
| **D1**             | Base SQLite serverless                    | 25B reads/mo inclus, 50M writes/mo inclus, 10GB/database |
| **Workers**        | API serverless (remplace Fastify)         | 10M requests/mo inclus                                   |
| **Pages**          | Hébergement React static                  | Illimité                                                 |
| **KV** (optionnel) | Cache clé-valeur pour heatmap pré-calculé | 100K reads/day free                                      |

### Pourquoi D1?

| Critère         | SQLite Local      | Cloudflare D1           |
| --------------- | ----------------- | ----------------------- |
| **Scalabilité** | Single node       | Read replicas globales  |
| **Latence**     | Dépend du serveur | Edge (<50ms worldwide)  |
| **Backup**      | Manuel            | Time Travel (30 jours)  |
| **HA**          | Non               | Oui (réplication auto)  |
| **Maintenance** | Serveur à gérer   | Zero                    |
| **ORM**         | Drizzle ✅        | Drizzle ✅ (compatible) |
| **Prix**        | VPS ~$10-50/mo    | $5/mo (Workers Paid)    |
| **Taille max**  | Illimitée         | 10GB/database           |

---

## Estimation Volumétrie

### Données actuelles/projetées

| Table                  | Rows estimées | Taille estimée |
| ---------------------- | ------------- | -------------- |
| `places`               | ~500K         | ~200MB         |
| `rawEvents`            | ~2-5M         | ~1-2GB         |
| `transformationStates` | ~500K         | ~300MB         |
| `heatmapCells`         | ~50K          | ~20MB          |
| `dataSources`          | 10            | <1KB           |
| **TOTAL**              |               | **~2-3GB**     |

**Verdict:** ✅ Fits dans D1 (limite 10GB)

### Trafic estimé

| Métrique          | Volume/mois | D1 Inclus |
| ----------------- | ----------- | --------- |
| Reads (API calls) | ~5-10M      | 25B ✅    |
| Writes (ingests)  | ~500K-1M    | 50M ✅    |

**Verdict:** ✅ Largement dans le tier inclus

---

## Plan de Migration

### Phase 1: Setup Infrastructure (1-2h)

```bash
# 1. Créer le projet Workers
wrangler init ucm-api --type worker

# 2. Créer la base D1
wrangler d1 create ucm-production
wrangler d1 create ucm-staging

# 3. Configurer wrangler.toml
```

**wrangler.toml:**

```toml
name = "ucm-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "ucm-production"
database_id = "<ID_FROM_CREATE>"
migrations_dir = "drizzle/migrations"

[vars]
ENVIRONMENT = "production"
```

### Phase 2: Adapter le Schema Drizzle (1-2h)

Le schema actuel utilise `sqliteTable` de Drizzle - **compatible D1 nativement**.

```typescript
// packages/pipeline/src/db/schema.ts - AUCUN CHANGEMENT REQUIS
// Drizzle supporte D1 avec le même schema SQLite

// Seul changement: driver d'initialisation
// AVANT (better-sqlite3)
import Database from 'better-sqlite3';
const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite, { schema });

// APRÈS (D1)
import { drizzle } from 'drizzle-orm/d1';
export const db = drizzle(env.DB, { schema });
```

### Phase 3: Migrer l'API Fastify → Workers (4-6h)

**Structure proposée:**

```
packages/api-worker/
├── src/
│   ├── index.ts          # Worker entry point
│   ├── routes/
│   │   ├── map.ts        # GET /map/places, /map/heatmap
│   │   ├── places.ts     # GET /places/:id
│   │   ├── search.ts     # GET /search
│   │   └── neighborhoods.ts
│   └── db/
│       └── index.ts      # D1 Drizzle connection
├── wrangler.toml
└── package.json
```

**Exemple de route migrée:**

```typescript
// AVANT (Fastify)
app.get('/api/v1/map/places', async (request, reply) => {
  const { bounds, zoom } = request.query;
  const results = await db.select().from(places).where(...);
  return reply.send({ type: 'FeatureCollection', features: results });
});

// APRÈS (Workers)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/v1/map/places') {
      const db = drizzle(env.DB, { schema });
      const bounds = url.searchParams.get('bounds');
      const results = await db.select().from(places).where(...);

      return Response.json(
        { type: 'FeatureCollection', features: results },
        { headers: { 'Cache-Control': 'public, max-age=60' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  }
};
```

**Alternative: Hono Framework** (recommandé pour migration plus facile)

```typescript
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/v1/map/places', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const bounds = c.req.query('bounds');
  // ... même logique que Fastify
  return c.json({ type: 'FeatureCollection', features: results });
});

export default app;
```

### Phase 4: Adapter le Pipeline d'Ingestion (2-4h)

Le pipeline (`ingest.ts`, `compute.ts`) tourne actuellement en local. Options:

#### Option A: Pipeline Local → D1 HTTP API

```typescript
// Utiliser wrangler pour exécuter des requêtes
import { execSync } from 'child_process';

async function insertBatch(events: NormalizedEvent[]) {
  const sql = generateInsertSQL(events);
  execSync(`wrangler d1 execute ucm-production --command "${sql}"`);
}
```

#### Option B: Pipeline comme Scheduled Worker (recommandé)

```typescript
// wrangler.toml
[triggers]
crons = ["0 */6 * * *"]  # Toutes les 6 heures

// src/scheduled.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = drizzle(env.DB);
    await runIngestJob(db);
    await runComputeJob(db);
  }
};
```

#### Option C: GitHub Actions + D1 REST API

```yaml
# .github/workflows/ingest.yml
name: Data Ingestion
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter pipeline ingest
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
          D1_DATABASE_ID: ${{ secrets.D1_DATABASE_ID }}
```

### Phase 5: Déployer le Frontend sur Pages (1h)

```bash
# Depuis packages/web
wrangler pages project create ucm-web
wrangler pages deploy dist
```

**Configuration GitHub Integration:**

- Build command: `pnpm --filter web build`
- Output directory: `packages/web/dist`
- Environment variable: `VITE_API_URL=https://ucm-api.<account>.workers.dev`

### Phase 6: Migration des Données (1-2h)

```bash
# 1. Export SQLite local
sqlite3 data/ucm.db .dump > dump.sql

# 2. Nettoyer le dump (retirer les pragmas incompatibles)
sed -i '/PRAGMA/d' dump.sql
sed -i '/BEGIN TRANSACTION/d' dump.sql
sed -i '/COMMIT/d' dump.sql

# 3. Import dans D1
wrangler d1 execute ucm-production --file=dump.sql

# 4. Vérifier
wrangler d1 execute ucm-production --command="SELECT COUNT(*) FROM places"
```

---

## Changements par Package

### `packages/pipeline`

| Fichier           | Changement                                                    |
| ----------------- | ------------------------------------------------------------- |
| `db/index.ts`     | Remplacer `better-sqlite3` par D1 client                      |
| `jobs/ingest.ts`  | Adapter pour D1 batch API                                     |
| `jobs/compute.ts` | Adapter pour D1 batch API                                     |
| `package.json`    | Retirer `better-sqlite3`, ajouter `@cloudflare/workers-types` |

### `packages/api` → `packages/api-worker`

| Changement      | Détail                                    |
| --------------- | ----------------------------------------- |
| Nouveau package | Worker Cloudflare (ou adapter l'existant) |
| Framework       | Fastify → Hono (ou Workers natif)         |
| DB connection   | `better-sqlite3` → `drizzle-orm/d1`       |
| Deployment      | PM2/Node → `wrangler deploy`              |

### `packages/web`

| Fichier          | Changement                   |
| ---------------- | ---------------------------- |
| `api/client.ts`  | Mettre à jour `API_BASE_URL` |
| `vite.config.ts` | Configurer pour Pages        |
| Aucun autre      | Le frontend reste identique  |

### `packages/shared`

Aucun changement - les types restent identiques.

---

## Considérations Spéciales

### 1. Pragmas SQLite non supportés par D1

```diff
- sqlite.pragma('journal_mode = WAL');
- sqlite.pragma('mmap_size = 1073741824');
- sqlite.pragma('cache_size = -262144');
- sqlite.pragma('temp_store = MEMORY');
- sqlite.pragma('synchronous = NORMAL');
+ // D1 gère tout ça automatiquement
```

### 2. Transactions et Batch

D1 supporte les transactions via `db.batch()`:

```typescript
// Atomic batch insert
await db.batch([
  db.insert(places).values(place1),
  db.insert(places).values(place2),
  db.insert(rawEvents).values(events),
]);
```

### 3. Limites D1 à respecter

| Limite         | Valeur   | Impact                     |
| -------------- | -------- | -------------------------- |
| Statement size | 100KB    | OK pour nos queries        |
| Bound params   | 100      | Chunker les gros inserts   |
| Query duration | 30s      | Optimiser les compute jobs |
| Rows per query | Illimité | ✅                         |
| DB size        | 10GB     | ✅ (estimé 2-3GB)          |

### 4. Pas de Full-Text Search natif

D1 n'a pas `FTS5`. Solutions:

- **Option A:** LIKE queries (OK pour petits volumes)
- **Option B:** Vectorize (Cloudflare AI embeddings) pour recherche sémantique
- **Option C:** Algolia/Meilisearch externe

### 5. Cold Starts Workers

Workers ont ~0-50ms cold start vs Fastify toujours chaud.

- Mitigation: Workers restent warm avec trafic régulier
- Pas un problème pour ce use case

---

## Timeline Estimée

| Phase                   | Durée      | Dépendances         |
| ----------------------- | ---------- | ------------------- |
| 1. Setup Infrastructure | 1-2h       | Compte CF configuré |
| 2. Adapter Schema       | 1-2h       | -                   |
| 3. Migrer API           | 4-6h       | Phase 1-2           |
| 4. Adapter Pipeline     | 2-4h       | Phase 1-2           |
| 5. Deploy Frontend      | 1h         | Phase 3             |
| 6. Migration Données    | 1-2h       | Phase 1-5           |
| 7. Tests & Validation   | 2-4h       | Tout                |
| **TOTAL**               | **12-20h** |                     |

---

## Coûts Mensuels Estimés

### Workers Paid Plan: $5/mois

| Resource         | Inclus   | Usage estimé | Coût additionnel |
| ---------------- | -------- | ------------ | ---------------- |
| Workers requests | 10M      | ~5M          | $0               |
| D1 reads         | 25B      | ~10M         | $0               |
| D1 writes        | 50M      | ~1M          | $0               |
| D1 storage       | 5GB      | ~3GB         | $0               |
| Pages            | Illimité | -            | $0               |
| **TOTAL**        |          |              | **$5/mois**      |

vs. VPS actuel: ~$10-50/mois + maintenance

---

## Rollback Plan

Si problème après migration:

1. **Données:** Time Travel D1 permet restore jusqu'à 30 jours
2. **Code:** Git revert + redeploy local
3. **Hybride:** Garder le SQLite local comme backup read-only

---

## Décision Requise

### Recommandation: **GO pour la migration**

**Avantages:**

- Coût réduit ($5 vs $10-50)
- Zero maintenance infrastructure
- Scalabilité globale automatique
- Backup automatique (Time Travel)
- Même ORM (Drizzle), migration schema triviale
- Frontend sur CDN mondial

**Risques mitigés:**

- Volumétrie OK (2-3GB < 10GB limite)
- Trafic OK (largement dans les quotas)
- Drizzle compatible, pas de rewrite schema
- Full-text search: LIKE suffisant pour MVP

### Questions pour valider

1. **Pipeline scheduling:** Préfères-tu GitHub Actions ou Scheduled Workers?
2. **Search:** LIKE queries OK ou besoin de FTS avancé?
3. **Staging:** Veux-tu un environnement staging séparé sur D1?
4. **Timeline:** Quand veux-tu commencer la migration?

---

## Prochaines Étapes

Si GO:

```bash
# 1. Installer wrangler si pas déjà fait
npm install -g wrangler

# 2. Login Cloudflare
wrangler login

# 3. Créer la database D1
wrangler d1 create ucm-production

# 4. Je peux commencer la migration du code
```
