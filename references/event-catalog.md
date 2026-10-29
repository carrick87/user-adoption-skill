# Event catalog

Default event names shipped in the SQL template. Rename or extend to match the
product; keep the same privacy rules.

## Auth and session

| Event | When |
|-------|------|
| `user_login` | Sign-in succeeds |
| `user_logout` | Sign-out |
| `session_started` | First event for a Supabase session (auto or explicit) |
| `session_ended` | Sign-out |

## Product (map these to real screens)

| Event | Typical mapping |
|-------|-----------------|
| `home_viewed` | Primary dashboard / list shell |
| `searched` | Find / search used (store class + counts, **not** the query text) |
| `filtered` | Column or facet filters applied |
| `list_viewed` | A page of entity ids rendered |
| `export_completed` | File / workbook built successfully |
| `export_failed` | Export failed |
| `access_denied` | User lacked permission for that resource |
| `access_waiting` | Account has no role / membership yet (once per session) |
| `error_occurred` | Handled failure on a page or auth |
| `admin_viewed` | Optional admin screen |
| `adoption_viewed` | Someone opened `/adoption` |

## Meaningful use (default)

`home_viewed`, `searched`, `filtered`, `list_viewed`, `export_completed`.

## Metadata allow-list

`result_count`, `zero_results`, `search_class`, `status`, `side`, `group_id`,
`page`, `page_size`, `sort`, `direction`, `filter_columns`, `action`,
`row_count`, `error_code`, `http_status`.

Add keys only in **both** TypeScript `METADATA_KEYS` and SQL `usage_metadata`.

## Adding an event

Prefer `/adopt-event <name>`. Checklist:

1. SQL check constraint + `usage_record_usage` name allow-list
2. `EVENT_NAMES` in `contract.ts`
3. Builder helper
4. Call site via `recordUsage`
5. Meaningful / feature catalog updates if needed
