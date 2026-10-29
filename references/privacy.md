# Privacy rules

This skill installs **first-party, server-side** usage analytics for signed-in users.

## Never store

- Visitor IP addresses or derived geo
- User-Agent strings
- Passwords, OTP / magic-link codes
- Access tokens, refresh tokens, API keys
- Raw search box text
- Free-form customer names, notes, or message bodies
- Full page HTML or request bodies

## Allowed on events

- Event name, timestamp, application, version, environment
- `user_id` and `session_id` taken from the Supabase JWT by a security-definer RPC (callers must not set these)
- Role, optional tenant/branch/workspace id (sanitized identifiers)
- Page / module labels
- Entity type + short identifier (allow-listed pattern)
- Success flag, duration_ms
- Allow-listed metadata keys only (counts, flags, short codes)

## Report-only auth fields

`auth.users.last_sign_in_at` may appear on the adoption **report** for admins.
Do not copy it onto every event row.

## Recording failures

If `usage_record_usage` fails, the product action (login, page render, export)
must still complete. Swallow and optionally log server-side; never throw to the user.

## Anonymous visitors

This skill does **not** track anonymous page views. Login and session identity
come from Supabase Auth. Unauthenticated inserts are limited to carefully
allow-listed cases (for example login-page `error_occurred`).
