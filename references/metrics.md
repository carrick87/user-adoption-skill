# Metric definitions

Timezone for daily buckets defaults to the value chosen at install (often `UTC`
or a business region). Keep one timezone for all daily figures.

## Eligible users

People who **should** use the product for the adoption denominator.
Typical rule: active role (not pending) with access to at least one workspace /
branch / tenant. Invited-but-not-registered people may count as eligible.
Administrators / super users are usually listed separately and **excluded**
from sales (or end-user) adoption rates.

Adapt the SQL helpers in `001_usage.sql` to the app's profiles table.

## Meaningful use

Actions that prove real product work. Default catalog:

- `home_viewed` (or primary list/dashboard)
- `searched`
- `filtered`
- `list_viewed`
- `export_completed`

**Login alone is not meaningful use.**

## Company KPIs

| Metric | Definition |
|--------|------------|
| Eligible | Count of eligible users (and pending invites if configured) |
| Activated | Eligible with any meaningful use **ever** |
| Activation % | Activated / Eligible |
| Active in period | Eligible with meaningful use in the selected period |
| Adoption % | Active in period / Eligible |
| Logged in once | Users with exactly one `user_login` and no meaningful use (lifetime) |
| DAU | Distinct users with meaningful use on the **current** calendar date in report TZ |
| WAU | Meaningful use in last 7 days |
| MAU | Meaningful use in last 30 days |
| Search success % | Searches with `result_count > 0` / all searches in period |
| Error rate % | Sessions with `error_occurred` or `export_failed` / sessions with meaningful use |
| Workflow completion % | Completed visits / started visits for that workflow |

Period selector (`7` / `14` / `30`) applies to period-scoped tables.
DAU / WAU / MAU stay on fixed windows (today / 7 / 30).

## User status

| Status | Rule |
|--------|------|
| Logged in once | Exactly one login, no meaningful use |
| Never used | No meaningful use (and not exactly one login) |
| Stopped | Had meaningful use; none in the last 14 days |
| Active | Meaningful use in the last 14 days |

## Visits and workflows

A Supabase auth session can last days. **Visits** split that session after
**30 minutes** with no events (`QUIET_MS`).

Example workflows (adapt names to the product):

- **Primary review** — starts with primary screen view; completes when `list_viewed`
  shows `result_count > 0`; abandoned when the visit ends without that.
- **Export handoff** — starts with primary screen view; completes on
  `export_completed`; fails on `export_failed`; abandoned otherwise.

A visit ends on `session_ended` or when the quiet window has passed since the
last event.
