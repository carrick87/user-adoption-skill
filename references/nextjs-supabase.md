# Next.js App Router + Supabase install

## Prerequisites

- Next.js App Router
- `@supabase/supabase-js` (and the app's existing server client helpers)
- Supabase Auth with JWT `session_id` claim (default for hosted Supabase)

## 1. Migration

Copy `templates/sql/001_usage.sql` into `supabase/migrations/` (or run in the
SQL editor). Edit:

- `usage_is_admin()` to match roles
- Eligible-user queries to match profiles / memberships
- `application` constant in the guard trigger

## 2. App code

```
lib/usage/contract.ts   ← from templates/lib/usage/contract.ts
lib/usage/record.ts     ← from templates/lib/usage/record.ts
components/adoption-table.tsx
app/adoption/page.tsx   ← or app/(admin)/adoption/page.tsx
```

Set `APP_NAME` and `appVersion()` to the product's release source.

## 3. Record call sites

Server only:

| Place | Events |
|-------|--------|
| Auth callback / login action | `user_login` |
| Logout action | `user_logout`, `session_ended` |
| Primary page RSC | `home_viewed`, optional `searched` / `list_viewed` |
| Export route | `export_completed` / `export_failed` |
| Access denied paths | `access_denied` |
| Adoption page | `adoption_viewed` |

```ts
await recordUsage(supabase, loginEvents(crypto.randomUUID()));
```

## 4. Gate the report

```ts
if (!canViewAdoption(profile?.role)) redirect("/");
```

Show the nav link only when the same check passes.

## 5. Environment

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_ENV` | Stored on events (`UAT`, `production`, …) |
| `VERCEL_ENV` | Fallback if `NEXT_PUBLIC_APP_ENV` unset |
| `ADOPTION_DEV_KEY` | Optional local admin report read (hash in `usage_dev_gate`) |

## 6. Styles

Reuse the app's table / masthead styles. The template uses class names
`adoption`, `adoption-head`, `table-wrap`, `col-filter` — map them to existing
CSS or add minimal rules. Do not add a new UI framework dependency.

## 7. Verify

Run `/adopt-audit`, then open `/adoption` as an admin with a few recorded events.
