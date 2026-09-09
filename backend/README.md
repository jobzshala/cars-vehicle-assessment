# Vehicle Data Service

A TypeScript/Express backend that ingests vehicle data from the public NHTSA vPIC XML API,
transforms it into a unified JSON structure, persists it in PostgreSQL, and exposes it through a
single GraphQL endpoint.

- **Ingestion:** `getallmakes` (~12,400 makes) → `GetVehicleTypesForMakeId/{id}` for each make,
  fetched with bounded concurrency, retries and timeouts, then transformed and upserted in batches.
- **API:** `POST /graphql` — paginated, searchable `makes`, single `make`, `ingestionStatus`, and a
  `triggerIngestion` mutation. `GET /health` for liveness.
- **Engineering:** strict TypeScript, Zod-validated config, structured Pino logging, typed error
  hierarchy, 68 unit + integration tests, multi-stage Docker image, GitHub Actions CI.

Deeper design notes (pipeline, error handling, logging, configuration) live in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Quick start (Docker)

Requires Docker with Compose v2.

```bash
git clone <this repo> && cd backend
docker compose up --build
```

This starts PostgreSQL 16 and the service. On first boot the service applies migrations, sees an
empty datastore and starts ingestion in the background. The GraphQL endpoint is available
immediately at **http://localhost:3000/graphql** (an embedded Apollo Sandbox is served on `GET`
outside production; with `NODE_ENV=production` — the compose default — use any GraphQL client).

A full ingestion makes ~12,400 upstream requests and takes several minutes. To try things out
quickly, cap it:

```bash
INGEST_MAKE_LIMIT=100 docker compose up --build
```

Check progress:

```graphql
query {
  ingestionStatus {
    status
    makesProcessed
    makesFailed
    startedAt
    finishedAt
    errorMessage
  }
}
```

Stop with `docker compose down` (add `-v` to also drop the database volume).

> Port 5432 already in use on your machine? Set `DB_PORT=5433` (or any free port) in `.env`; the
> host port for Postgres is configurable and the containers talk to each other internally.

## Local development (without Docker for the app)

Requires Node 20+ and npm.

```bash
cp .env.example .env            # adjust DATABASE_URL / DB_PORT if needed
docker compose up -d db          # PostgreSQL only
npm install
npm run prisma:migrate              # applies migrations, generates the Prisma client
npm run dev                         # tsx watch, pretty logs, playground at /graphql
```

### Scripts

| Script                 | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`             | Run with `tsx watch` and pretty-printed logs               |
| `npm run build` / `start` | Compile to `dist/` and run the compiled server             |
| `npm test`            | Vitest unit + integration tests (`test:cov` for coverage)  |
| `npm run lint`            | ESLint (typescript-eslint, zero warnings allowed)          |
| `npm run typecheck`       | `tsc --noEmit` including test files                        |
| `npm run format[:check]`  | Prettier                                                   |
| `npm run prisma:migrate`  | `prisma migrate dev` (development)                         |
| `npm run prisma:deploy`   | `prisma migrate deploy` (production; the Docker CMD runs it)|
| `npm run prisma:generate` | Regenerate the Prisma client after schema changes          |

## Configuration

All configuration comes from environment variables, validated once at startup by a Zod schema
(`src/config/schema.ts`). Invalid or missing values abort startup with a message listing every
problem. Empty strings count as unset so `.env` templates with blank values still get defaults.

| Variable                   | Default                                   | Description                                                                    |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| `NODE_ENV`                 | `development`                             | `development` \| `test` \| `production`. Dev enables pretty logs + playground. |
| `PORT`                     | `3000`                                    | HTTP port                                                                      |
| `LOG_LEVEL`                | `info`                                    | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal`                   |
| `DATABASE_URL`             | **required**                              | PostgreSQL connection URL                                                      |
| `DB_PORT`                  | `5432`                                    | Host port docker-compose publishes Postgres on (compose only)                  |
| `NHTSA_BASE_URL`           | `https://vpic.nhtsa.dot.gov/api/vehicles` | Upstream API base URL                                                          |
| `HTTP_TIMEOUT_MS`          | `10000`                                   | Per-request timeout                                                            |
| `HTTP_RETRIES`             | `3`                                       | Retries on network errors, timeouts, 429 and 5xx (0–10)                        |
| `HTTP_RETRY_BASE_DELAY_MS` | `300`                                     | First retry delay; doubles per attempt with 20 % jitter                        |
| `INGEST_CONCURRENCY`       | `10`                                      | Parallel vehicle-type requests (1–50)                                          |
| `INGEST_BATCH_SIZE`        | `500`                                     | Makes persisted per database transaction                                       |
| `INGEST_MAKE_LIMIT`        | unset                                     | Optional cap on makes ingested — useful in development                         |
| `INGEST_ON_STARTUP`        | `true`                                    | Feature flag: ingest automatically when the datastore is empty at startup      |

## Data model

### Unified JSON structure

The transformation layer produces exactly the shape requested by the challenge:

```json
[
  {
    "makeId": 440,
    "makeName": "ASTON MARTIN",
    "vehicleTypes": [
      { "typeId": 2, "typeName": "Passenger Car" },
      { "typeId": 7, "typeName": "Multipurpose Passenger Vehicle (MPV)" }
    ]
  }
]
```

Ids are integers (as in the source data); names are strings even when numeric-looking.

### Database schema (PostgreSQL via Prisma)

Rather than storing the JSON blob, the data is normalised so it can be queried, paginated and
searched efficiently. The GraphQL layer reconstructs the unified shape.

```
Make (id PK = NHTSA Make_ID, name, updatedAt)      indexed on name
VehicleType (id PK = NHTSA VehicleTypeId, name)
MakeVehicleType (makeId FK, vehicleTypeId FK)       composite PK, cascading deletes
IngestionRun (id, status, startedAt, finishedAt, makesProcessed, makesFailed, errorMessage)
```

Using NHTSA's own ids as primary keys makes ingestion idempotent: re-running updates names and
replaces each make's vehicle-type links instead of creating duplicates. Writes are set-based
(`INSERT … SELECT FROM unnest(...) ON CONFLICT DO UPDATE`) in transactions of `INGEST_BATCH_SIZE`
makes — a handful of round-trips per batch rather than one per row.

Migrations live in `prisma/migrations/` and are applied by `prisma migrate deploy` when the
container starts.

## GraphQL API

Single endpoint: `POST /graphql`. Introspection is enabled; every type and field carries a
description (see `src/graphql/typeDefs.ts`).

```graphql
type Make {
  makeId: Int!
  makeName: String!
  vehicleTypes: [VehicleType!]!
}

type VehicleType {
  typeId: Int!
  typeName: String!
}

type MakeConnection {
  items: [Make!]!
  totalCount: Int!
  limit: Int!
  offset: Int!
}

enum IngestionStatus { RUNNING SUCCEEDED FAILED }

type IngestionRun {
  id: Int!
  status: IngestionStatus!
  startedAt: String!          # ISO-8601
  finishedAt: String
  makesProcessed: Int!
  makesFailed: Int!
  errorMessage: String
}

type Query {
  makes(limit: Int = 50, offset: Int = 0, search: String): MakeConnection!
  make(makeId: Int!): Make
  ingestionStatus: IngestionRun
}

type Mutation {
  triggerIngestion: IngestionRun!
}
```

### Example queries

Paginated list with search (case-insensitive substring on the make name; `limit` ≤ 200):

```graphql
query {
  makes(limit: 5, offset: 0, search: "martin") {
    totalCount
    items {
      makeId
      makeName
      vehicleTypes { typeId typeName }
    }
  }
}
```

Single make:

```graphql
query {
  make(makeId: 440) {
    makeName
    vehicleTypes { typeName }
  }
}
```

Trigger a re-ingestion (returns immediately; poll `ingestionStatus`). If a run is already active,
its record is returned instead of starting another:

```graphql
mutation {
  triggerIngestion { id status startedAt }
}
```

With curl:

```bash
curl -s http://localhost:3000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ makes(limit: 3) { totalCount items { makeName vehicleTypes { typeName } } } }"}'
```

Validation errors come back with `extensions.code = "BAD_USER_INPUT"`; unexpected failures are
logged server-side and, in production, returned as a generic `Internal server error`.

## Testing

```bash
npm test          # everything
npm run test:cov      # with V8 coverage (text + lcov in coverage/)
```

- **Unit tests** cover configuration validation, the XML parser, every transformation function
  (single item, empty results, malformed items, entities, duplicates), the NHTSA client (URL
  building, retry/backoff, timeout, non-retriable 4xx, error wrapping) with a mocked `fetch`, the
  concurrency helper, and the ingestion service with a fake data source and in-memory repository
  (partial failures, total failure, persistence failure, make limit, duplicate-run guard).
- **HTTP/GraphQL tests** run the real Express + Apollo app with supertest against the in-memory
  repository: pagination, search, validation errors, 404s, and the trigger → status flow.
- **Database integration tests** (`*.integration.test.ts`) exercise the Prisma repository against
  a real PostgreSQL. They run automatically when `TEST_DATABASE_URL` points at a migrated
  database and are skipped otherwise. CI provides one; locally:

  ```bash
  docker compose up -d db
  DATABASE_URL=postgresql://vehicles:vehicles@localhost:5432/vehicles_test npm run prisma:deploy
  TEST_DATABASE_URL=postgresql://vehicles:vehicles@localhost:5432/vehicles_test npm test
  ```

## CI

`.github/workflows/ci.yml` runs on every push and pull request: install → `prisma generate` →
lint → format check → typecheck → migrations against a Postgres service → tests with coverage
(uploaded as an artifact) → Docker image build (uploaded as an artifact).

## Project structure

```
src/
  main.ts                      bootstrap: config → logger → prisma → services → HTTP; graceful shutdown
  app.ts                       Express app factory: logging middleware, /health, Apollo at /graphql
  config/                      Zod schema + loadConfig()
  domain/                      framework-free core
    types.ts                   Make, VehicleType, MakeWithVehicleTypes, IngestionRun
    errors.ts                  AppError hierarchy (ExternalApi, XmlParse, Transform, Persistence)
    transform.ts               mapMakes / mapVehicleTypes / combine (pure functions)
    repository.ts              VehicleRepository port
  infrastructure/
    http/nhtsaClient.ts        fetch + timeout + retry/backoff
    xml/xmlParser.ts           fast-xml-parser wrapper
    db/prismaClient.ts         Prisma client factory with log forwarding
    db/prismaVehicleRepository.ts  PostgreSQL adapter (set-based upserts)
    logging/logger.ts          Pino factory
  ingestion/
    mapWithConcurrency.ts      bounded-concurrency map
    ingestionService.ts        the pipeline + run tracking
  graphql/
    typeDefs.ts                SDL with descriptions
    resolvers.ts               thin resolvers over the repository
  test/                        fixtures and the in-memory repository (not shipped)
prisma/                        schema + migrations
docs/ARCHITECTURE.md           pipeline, error handling, logging, configuration
```

## Design decisions & trade-offs

- **Express over NestJS.** The challenge lists NestJS as nice-to-have; plain Express keeps the
  dependency surface small and the layering explicit. Domain code has no framework imports and is
  wired together in `main.ts`, so swapping the HTTP layer would touch one file.
- **Normalised tables instead of a JSON column.** Enables indexed search and pagination over
  12k+ makes; the unified JSON shape is a view, not the storage format.
- **Skip, don't poison.** If a make's vehicle types cannot be fetched after retries, that make is
  skipped and counted in `makesFailed` rather than stored with an empty list. A run where every
  make fails is marked `FAILED`.
- **Ingestion is asynchronous.** `triggerIngestion` returns the run record immediately; the API
  stays responsive during the multi-minute crawl, and only one run can be active at a time.
- **`fetch` + `AbortSignal.timeout`** (Node 20 built-ins) instead of an HTTP client library; the
  client accepts injected `fetch`/`sleep` functions so tests are deterministic and offline.

## Limitations / next steps

- Ingestion state (the "is a run active" guard) is per process. Running multiple replicas would
  need a database-level lock or a queue.
- No authentication on `triggerIngestion`; in a real deployment it should be protected or moved
  to an internal/admin surface.
- Scheduled re-ingestion is left to an external scheduler (cron hitting the mutation).
