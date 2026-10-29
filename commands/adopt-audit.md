# /adopt-audit

Audit the current app's adoption / usage analytics.

Report findings as a short checklist with pass / fail / missing:

1. Server-only recording (no client beacons)
2. No IP, user-agent, raw search text, or secrets in events
3. `recordUsage` swallows errors
4. `/adoption` gated to admin/super (or configured role)
5. Meaningful-use set excludes bare login
6. Schema RPCs present and readable by admins only
7. Nav link hidden from unauthorized users

Suggest concrete fixes; do not widen privacy scope.
