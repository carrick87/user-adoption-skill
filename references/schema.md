# Schema overview

All objects use the `usage_` prefix so they do not collide with app-specific
`sov_` / product prefixes.

## Tables

### `usage_events` (append-only)

| Column | Notes |
|--------|-------|
| event_id | uuid PK |
| event_name | constrained allow-list |
| event_timestamp | timestamptz |
| application | forced by trigger to `APP_NAME` |
| application_version, environment | short strings |
| user_id, user_role | from auth + profiles inside RPC |
| branch | optional tenant / workspace / site id |
| session_id | from JWT `session_id` claim |
| correlation_id | request correlation uuid |
| page, module | short labels |
| entity_type, entity_id | optional |
| success, duration_ms | optional |
| metadata | jsonb object; allow-listed keys only |

RLS: `SELECT` for admins only. No direct `INSERT` for clients — writes go through
`usage_record_usage`.

### `usage_entity_hits`

Optional child rows for list pages (entity id + optional site / branch).
Used for “top entities viewed” on the report.

### `usage_dev_gate`

Stores SHA-256 of `ADOPTION_DEV_KEY` so a local non-Supabase admin can read
report RPCs in development.

## Core functions

| Function | Role |
|----------|------|
| `usage_is_meaningful(event_name)` | Denominator for activation / adoption |
| `usage_metadata(raw)` | Strip disallowed metadata keys |
| `usage_record_usage(events jsonb)` | Security definer writer |
| `usage_can_read()` | Admin role **or** matching `x-adoption-dev` header |
| `usage_company(day_count)` | Company KPI row |
| `usage_*_rows(day_count)` | Table sections for the page |

`day_count` must be `7`, `14`, or `30` (anything else → `7`).

## Identity rules

Inside `usage_record_usage`:

- `user_id := auth.uid()`
- `session_id` from JWT claims
- Caller-supplied user_id / session_id are ignored

Auto-insert `session_started` once per session (unique partial index).

## Adapting to the app

Replace stubs:

1. `usage_is_admin()` — map to the app's super/admin check.
2. Eligible-user CTEs — join the real profiles / memberships tables.
3. Feature catalog in `usage_feature_rows` — map event names to product features.
4. Workflow definitions — match real screen sequences.

See [nextjs-supabase.md](nextjs-supabase.md) for application wiring.
