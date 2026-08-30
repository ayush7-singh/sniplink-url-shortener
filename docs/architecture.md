# Architecture & Design Decisions

## System Overview

SnipLink is a URL shortener platform decomposed into two backend microservices, a React frontend, and supporting infrastructure (PostgreSQL, Redis, RabbitMQ). The design prioritizes **separation of concerns**, **async processing**, and **horizontal scalability**.

## Why Microservices (Not a Monolith)?

A monolith would be simpler for a URL shortener, but the goal is to demonstrate cloud-native patterns for a portfolio:

- **Independent scaling** — The shortener (redirect-heavy, latency-sensitive) and analytics (write-heavy, batch-friendly) have different scaling profiles. In production, redirects would see 100x the traffic of URL creation.
- **Fault isolation** — If analytics processing falls behind or crashes, redirects continue working. Users experience zero downtime for the critical path.
- **Deployment independence** — Each service can be updated, rolled back, and scaled independently in Kubernetes.

## Database: PostgreSQL

**Why Postgres over MongoDB/DynamoDB?**

- URL metadata is inherently relational (URLs → click events is a 1:N relationship)
- Analytics queries require aggregations (GROUP BY date, COUNT, etc.) — SQL excels here
- ACID guarantees for URL creation (no duplicate short codes)
- Postgres is the industry standard for this scale; no need for a NoSQL database when the data model is structured

**Schema design:**
- `urls` table in shortener-service scope: stores short codes + original URLs + basic counters
- `click_events` table in analytics-service scope: stores individual click events with metadata
- Both services share the same Postgres instance (separate tables) for simplicity in local dev. In production, you could split into separate databases for true service isolation.

**Tradeoff:** Shared database couples services at the data layer. For a system at this scale, that's acceptable. At larger scale, you'd give each service its own database and use the message queue as the sole communication channel (full CQRS).

## Cache: Redis

**Strategy: Read-through cache for URL lookups**

The redirect endpoint (`GET /:code`) is the hottest path. Without caching, every redirect hits Postgres. With Redis:

1. Check Redis for `url:<shortCode>` → if hit, redirect immediately
2. If miss, query Postgres, store result in Redis with 1-hour TTL, then redirect
3. Cache invalidation: TTL-based (no explicit invalidation needed since URLs don't change after creation)

**Rate limiting** also uses Redis via a sliding window counter (`rate-limit-redis`). Redis's atomic INCR + EXPIRE operations make this reliable under concurrent load.

**Why not Memcached?** Redis offers data structures (sorted sets for rate limiting), persistence options, and pub/sub — more versatile for future features.

## Message Queue: RabbitMQ

**Why RabbitMQ over Kafka?**

| Factor | RabbitMQ | Kafka |
|---|---|---|
| Complexity | Simple broker, easy to run | Requires ZooKeeper/KRaft, partitions, consumer groups |
| Use case fit | Task queue / pub-sub for individual events | Log streaming, event sourcing, replay |
| Scale needed | Handles thousands of events/sec easily | Designed for millions of events/sec |
| Operational overhead | Low — single binary, management UI built-in | High — partition rebalancing, retention policies |
| Message ordering | Per-queue FIFO (sufficient for us) | Per-partition ordering (overkill here) |

**Decision:** RabbitMQ is the right tool for this scale. We're processing individual click events — a simple task queue pattern. Kafka would add operational complexity without proportional benefit. If this system needed event replay or multi-consumer streaming, Kafka would be the choice.

**Pattern:** Fire-and-forget publish from the shortener service. The redirect response doesn't wait for the analytics write — it publishes to the queue and immediately responds with 302. If RabbitMQ is temporarily down, redirects still work (the click event is lost, which is an acceptable tradeoff for redirect latency).

## Rate Limiting

**Strategy: Sliding window counter via Redis**

- 10 requests per minute per IP on the `POST /api/shorten` endpoint
- Uses `express-rate-limit` with `rate-limit-redis` store for distributed rate limiting (works across multiple shortener instances in Kubernetes)
- Returns standard `429 Too Many Requests` with `Retry-After` header

**Why not rate limit redirects?** Redirects are the core user-facing feature. Rate limiting them would break the product. Instead, we rely on CDN/WAF in production for redirect abuse protection.

## Frontend Architecture

- **Vite + React** for fast development and optimized builds
- **Recharts** for analytics visualizations (lightweight, React-native charting)
- **Client-side routing** via React Router (SPA pattern)
- Calls two backends: shortener API (port 3001) for URL operations, analytics API (port 3002) for stats
- In production (Phase 3+), NGINX Ingress routes `/api/*` to shortener and `/api/analytics/*` to analytics, so the frontend only needs one base URL

## Containerization & Multi-Stage Builds (Phase 2)

### Multi-Stage Build Strategy
- **Lean Production Images**: Uses Alpine-based base images (`node:20-alpine`, `nginx:1.27-alpine`) to minimize attack surface and image size (<150MB per microservice).
- **Separation of Build & Runtime**: Dependencies and build tools (`npm`, compilers) are executed in isolated build stages, with only production node_modules and built assets copied to the runtime stage.
- **Security & Least Privilege**: Backend microservices execute under non-root system user `node`.
- **Health Probes**: Built-in container health checks verify liveness against `/healthz` endpoints before dependent services (like the frontend or API gateway) route traffic.

### Frontend Serving via Nginx
- Compiled React static assets are served using a lightweight Nginx web server.
- Built-in Gzip compression reduces payload size for CSS, JS, and SVGs.
- Immutable cache headers are applied to hashed assets (`/assets/`) with `try_files $uri $uri/ /index.html` fallback for client-side routing.

## Kubernetes & Cloud-Native Deployment (Phase 3)

### Horizontal Pod Autoscaling (HPA)
- **Dynamic Autoscaling**: `shortener` and `analytics` microservices are configured with `HorizontalPodAutoscaler` v2 definitions.
- **Scaling Triggers**: Autoscales from **2 to 10 replicas** based on 70% CPU or 80% Memory utilization thresholds.
- **Resource Constraints**: Explicit `requests` (100m CPU / 128Mi RAM) and `limits` (300m CPU / 256Mi RAM) ensure deterministic scheduling and avoid noisy-neighbor starvation.

### Health Probes & Zero-Downtime Rolling Updates
- **Liveness Probes** (`/healthz`): Checks if the process is responsive. If unhealthy, Kubernetes restarts the pod.
- **Readiness Probes** (`/readyz`): Verifies database and message queue connectivity before routing traffic. Ensures traffic is only directed to pods ready to accept requests.

### Unified Ingress Architecture
- **Path-Based Routing**: A single Nginx Ingress Controller routes external traffic to the appropriate microservice without needing separate domains:
  - `/api/analytics` → `analytics-service:3002`
  - `/api` → `shortener-service:3001`
  - `/` → `frontend-service:80`

### Helm 3 Packaging
- **Modular Values**: All operational parameters (replicas, image tags, ingress hosts, resource limits, PVC sizes) are externalized in `values.yaml`.
- **Reproducible Environments**: Enables single-command provisioning across staging, test, and production clusters (`helm upgrade --install sniplink ./helm/sniplink`).

## CI/CD Pipeline Architecture (Phase 4)

### Multi-Stage GitHub Actions Matrix
- **Matrix Parallelism**: Unit tests for backend microservices (`shortener`, `analytics`) run concurrently across isolated workers.
- **Node.js Native Test Runner**: Utilizes Node 20's built-in `node:test` framework for sub-second test execution without third-party test framework overhead.
- **Frontend Verification**: React SPA code undergoes static compilation and asset bundling check before any container build initiates.
- **Cloud-Native Linter Gate**: Automated `helm lint` and `kubectl kustomize` validation stops faulty manifests from reaching container or release stages.
- **Docker Layer Caching (`type=gha`)**: Leverages GitHub Actions cache backend to persist and reuse intermediate Docker image build layers, cutting multi-stage image build times by over 70%.
- **Helm Release Archival**: Packages versioned Helm charts as release artifacts ready for internal chart registries or deployment stages.

## Observability & Telemetry Pipeline (Phase 5)

### Standardized RED Metrics Instrumentation
- **Rate**: Measured via `sniplink_shortener_http_requests_total` and `sniplink_analytics_http_requests_total` counters.
- **Errors**: Filtered on HTTP `4xx` (client errors) and `5xx` (server errors).
- **Duration**: Captured using custom `prom-client` histogram buckets (`0.005s` to `5s`) for high-fidelity percentile calculations (P50, P95, P99).

### Custom Domain Counters & Business Metrics
- `sniplink_urls_shortened_total`: Tracks the aggregate volume of created links.
- `sniplink_url_redirects_total{cache_hit="true"|"false"}`: Real-time telemetry to measure Redis caching efficiency and hit ratios.
- `sniplink_events_published_total` & `sniplink_events_consumed_total{status="success"|"failure"}`: Asynchronous message queue throughput and processing lag telemetry.

### Auto-Provisioned Grafana Visualizations
- Automated datasource configuration eliminates manual setup.
- Executive overview dashboard (`SnipLink Platform Overview`) provides immediate visibility into throughput, latency distributions, error budgets, and Node.js process metrics (event loop lag, RSS memory, heap allocations).

## Performance Engineering & Load Testing (Phase 6)

### Traffic Simulation Methodology (k6)
- **Smoke Testing (`smoke-test.js`)**: Baseline sanity checks ensuring endpoints adhere to strict latency budgets (<100ms P95).
- **Realistic Production Workload (`load-test.js`)**: Simulates 80% cache-read redirects, 15% URL creation writes, and 5% analytics reads across 50 virtual users. Validates sub-80ms P95 redirect latency backed by Redis.
- **Traffic Spikes & Stress Saturation (`stress-test.js`)**: Surges to 250 concurrent users to verify Redis-backed sliding window rate limiting (HTTP 429 throttling) without crashing application worker loops.
- **Endurance / Soak Testing (`soak-test.js`)**: Multi-minute steady load checks to ensure PostgreSQL connection pool stability, absence of memory leaks, and prompt garbage collection.

### Autoscaling Dynamics
- **HPA Evaluation**: Traffic surges generating CPU loads >70% or Memory >80% dynamically trigger Kubernetes Horizontal Pod Autoscaler scale-out events from 2 to 10 replicas.
- **Graceful De-escalation**: Once load subsides, scale-down stabilization windows prevent flapping and ensure smooth resource consolidation.

## Key Tradeoffs

| Decision | Pro | Con | Mitigation |
|---|---|---|---|
| Shared Postgres | Simple, less infra | Services coupled at data layer | Message queue decouples the write path; split DBs in prod if needed |
| Fire-and-forget publish | Fast redirects | Click events can be lost if RabbitMQ down | Acceptable for analytics; add publisher confirms in Phase 2 |
| nanoid (7 chars) | 3.5 billion unique codes | Collision possible at extreme scale | Check for uniqueness before insert; increase length if needed |
| Redis TTL-based cache | Simple, no invalidation logic | Stale cache for up to 1 hour | URLs don't change after creation, so staleness is a non-issue |
| Single Redis instance | Simple | SPOF for rate limiting | Redis Sentinel or Cluster in production |





