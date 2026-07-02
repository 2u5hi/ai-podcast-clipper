# Observability Stack — Grafana + Loki + Promtail

Local logging/observability for the AI Podcast Clipper, mirroring the
Grafana + Loki toolset used in production QA/observability setups.

## Architecture

```
Next.js dev server ──> logs/frontend.log ──> Promtail ──> Loki ──> Grafana
   (app under test)      (tailed file)      (shipper)   (store)  (dashboards)
```

- **Loki** (`:3100`) — log database. Stores lines + labels, queried with LogQL.
- **Promtail** — tails `logs/*.log`, parses each line, ships to Loki. The
  parsing (`promtail/promtail-config.yml`) pulls `method` and `status` out of
  Next.js request lines and promotes them to **labels** so they're graphable.
- **Grafana** (`:3001`) — dashboards. Datasource + dashboard are auto-provisioned.

## Run it

```powershell
# 1. start the stack
docker compose -f observability/docker-compose.yml up -d

# 2. run the frontend so its logs flow into Loki
./observability/run-frontend-with-logs.ps1

# 3. open Grafana (no login — anonymous admin)
#    http://localhost:3001  ->  dashboard "Podcast Clipper — App Observability"
```

Stop with: `docker compose -f observability/docker-compose.yml down`
(add `-v` to also wipe stored logs).

## LogQL cheatsheet (paste into Grafana Explore)

| Goal | Query |
|---|---|
| All app logs | `{job="frontend"}` |
| Only errors | `` {job="frontend"} |~ `(?i)error` `` |
| HTTP 5xx | `{job="frontend", status=~"5.."}` |
| Request rate by status | `sum by (status) (count_over_time({job="frontend"}[1m]))` |
| Error count last hour | `` sum(count_over_time({job="frontend"} |~ `(?i)error`[1h])) `` |
| Slowest routes (needs duration parse) | `{job="frontend"} | regexp `in (?P<ms>\\d+)ms` | unwrap ms` |

## Why this matters for QA

- **Labels vs. content**: `status` is a label (indexed, cheap to filter);
  the raw message is content (searched with `|~`). Choosing what becomes a
  label is the core Loki design decision — too many labels = high cardinality
  = slow Loki.
- **Ingestion vs. event time**: by default Promtail stamps lines at ingestion.
  For accurate timelines you add a `timestamp` pipeline stage to parse the
  real event time out of the log.
- **This is how you catch the invisible failures**: the black-clip S3 403s
  never surfaced in the UI, but they show up here as a `403` spike.
