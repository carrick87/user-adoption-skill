---
name: user-adoption-skill
description: >-
  Installs a privacy-first user adoption report and server-side usage analytics
  into a Next.js App Router + Supabase app. Tracks logins, sessions, feature use,
  workflows, DAU/WAU/MAU, and errors — never visitor IP or user-agent. Use when
  the user asks for an adoption page, usage analytics, DAU/WAU/MAU, /adopt,
  /adopt-audit, /adopt-event, or /adopt-report.
disable-model-invocation: true
license: MIT
---

# User adoption skill

Add an internal `/adoption` report and server-side event recording to the
**current** Next.js App Router + Supabase app.

Privacy model: record **what signed-in people did**, not who visited anonymously.
**Never** store IP addresses, user agents, passwords, tokens, or raw search text.

## Commands

| Command | Action |
|---------|--------|
| `/adopt` | Full install into the current app |
| `/adopt-audit` | Audit recording, gates, and privacy |
| `/adopt-event <name>` | Add one event end-to-end |
| `/adopt-report` | Explain or extend report sections only |

Parse leading slash commands the same way. If the user says "add adoption tracking"
without a slash, run `/adopt`.

## Before you start

1. Confirm the target repo is **Next.js App Router** with **Supabase Auth**.
2. If the stack differs, stop and explain this skill targets Next.js + Supabase only.
3. Ask once (if unknown): application name string, report timezone (default `UTC`),
   which role may open `/adoption` (default `admin` or `super`).
4. Read [references/privacy.md](references/privacy.md) and keep those rules.

## `/adopt` checklist

Copy this list and mark items as you go:

```
Adoption install:
- [ ] Stack verified (Next.js App Router + Supabase)
- [ ] SQL migration applied from templates/sql/001_usage.sql
- [ ] lib/usage/contract.ts + record.ts added and wired
- [ ] Login / logout / key screens call recordUsage
- [ ] /adoption page + gated nav link
- [ ] Env: NEXT_PUBLIC_APP_ENV (optional ADOPTION_DEV_KEY for local admin)
- [ ] /adopt-audit passes
```

### Steps

1. **Schema** — Apply [templates/sql/001_usage.sql](templates/sql/001_usage.sql).
   Adapt `usage_is_admin()` / eligible-user helpers to the app's profiles table.
   Details: [references/schema.md](references/schema.md).

2. **Contract** — Copy [templates/lib/usage/](templates/lib/usage/) into the app.
   Set `APP_NAME`, `EVENT_NAMES`, and meaningful-use names for this product.
   Map screens using [references/event-catalog.md](references/event-catalog.md).

3. **Record** — Call `recordUsage` only from **server** code (RSC, route handlers,
   server actions). Swallow DB errors so product flows still succeed.

4. **Report** — Add [templates/app/adoption/page.tsx](templates/app/adoption/page.tsx)
   and [templates/components/adoption-table.tsx](templates/components/adoption-table.tsx).
   Gate with `canViewAdoption`. Wire period `?days=7|14|30`.

5. **Nav** — Show the Adoption link only when the viewer may open the page.

6. **Verify** — Run `/adopt-audit`.

Full install narrative: [references/nextjs-supabase.md](references/nextjs-supabase.md).
Metric definitions: [references/metrics.md](references/metrics.md).

## `/adopt-audit`

Check and report:

- Events written only on the server
- No IP / user-agent / raw search / secrets in metadata or columns
- `recordUsage` failures do not break login, pages, or exports
- Report RPCs / page gated to admin (or configured role)
- Meaningful-use set matches product "real work"
- Login alone is **not** counted as adoption

## `/adopt-event <name>`

1. Add `name` to SQL check constraint + `usage_record_usage` allow-list + `EVENT_NAMES`.
2. Add a builder in `contract.ts` with allow-listed metadata only.
3. Call `recordUsage` at the real call site.
4. If it is meaningful use, add to `usage_is_meaningful`.
5. If it should appear on Features, extend `usage_feature_rows`.

## `/adopt-report`

Change **read/report** presentation or SQL report functions only.
Do not change the write path unless the user also asks for `/adopt-event`.

## Hosts

Install paths for Cursor, Claude Code, Codex, Gemini, Antigravity:
[references/hosts.md](references/hosts.md).

## Hard limits

- Do not add visitor IP, geo-from-IP, or user-agent tracking.
- Do not install analytics npm packages (no third-party trackers).
- Do not bump target-app dependencies unless Supabase client is missing.
- Do not invent business metrics the app cannot compute from existing data.
