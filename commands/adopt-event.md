# /adopt-event

Usage: `/adopt-event <event_name>`

Add one usage event end-to-end:

1. SQL event name check + `usage_record_usage` allow-list
2. `EVENT_NAMES` + builder in `lib/usage/contract.ts`
3. Server call site via `recordUsage`
4. Update `usage_is_meaningful` and feature catalog when appropriate

Refuse metadata keys that would store IP, UA, search text, or secrets.
See `references/event-catalog.md`.
