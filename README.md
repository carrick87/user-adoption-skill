# user-adoption-skill

**AI agent skill that installs a privacy-first user adoption page and server-side usage analytics into a Next.js App Router + Supabase app** — for Cursor, Claude Code, Codex, Antigravity, Gemini CLI, and any [Agent Skills](https://agentskills.io/specification) compatible tool.

Tracks **logins, sessions, feature use, workflows, DAU / WAU / MAU, and errors**.  
Does **not** track visitor IP, user-agent, raw search text, passwords, or tokens.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-SKILL.md-6366f1)](https://agentskills.io/specification)
[![Cursor](https://img.shields.io/badge/Cursor-compatible-000000)](https://cursor.com)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-d97757)](https://code.claude.com)
[![Codex](https://img.shields.io/badge/OpenAI%20Codex-compatible-412991)](https://developers.openai.com/codex)
[![Antigravity](https://img.shields.io/badge/Antigravity-compatible-4285F4)](https://antigravity.google/docs/skills)

**Repo:** https://github.com/carrick87/user-adoption-skill

---

## Why use this skill?

Internal apps need adoption answers without a third-party tracker:

- Who activated? Who signed in once and never returned?
- Which features stick? Where do workflows abandon?
- What is DAU / WAU / MAU for the people who should use the product?

**user-adoption-skill** teaches your coding agent to add a gated `/adoption` report and `usage_record_usage` event pipeline — copied from a production-proven pattern, sanitized for any Next.js + Supabase app.

---

## Supported AI tools

| Tool | Personal (global) install | Project install |
|------|---------------------------|-----------------|
| **[Cursor](https://cursor.com)** | `~/.cursor/skills/user-adoption-skill/` | `.cursor/skills/user-adoption-skill/` |
| **[Claude Code](https://code.claude.com)** | `~/.claude/skills/user-adoption-skill/` | `.claude/skills/user-adoption-skill/` |
| **[OpenAI Codex](https://developers.openai.com/codex)** | `~/.codex/skills/user-adoption-skill/` | `.agents/skills/user-adoption-skill/` |
| **[Google Antigravity](https://antigravity.google/docs/skills)** | `~/.gemini/config/skills/user-adoption-skill/` | `.agents/skills/user-adoption-skill/` |
| **[Gemini CLI](https://geminicli.com)** | `~/.gemini/skills/user-adoption-skill/` | `.agents/skills/user-adoption-skill/` |

---

## Requirements

| Capability | Used for |
|------------|----------|
| **Next.js App Router** | Report page + server recording |
| **Supabase Auth + SQL** | Identity, RLS, RPCs |
| Existing profiles / roles table | Admin gate + eligible users |

No analytics npm packages. No IP collection.

---

## Quick install

### Skill CLI

```bash
npx skills add carrick87/user-adoption-skill
```

### Cursor

```bash
git clone https://github.com/carrick87/user-adoption-skill.git ~/.cursor/skills/user-adoption-skill
```

### Claude Code

```bash
git clone https://github.com/carrick87/user-adoption-skill.git ~/.claude/skills/user-adoption-skill
```

### OpenAI Codex

```bash
git clone https://github.com/carrick87/user-adoption-skill.git ~/.codex/skills/user-adoption-skill
```

Enable skills in `~/.codex/config.toml` if needed:

```toml
[features]
skills = true
```

### Google Antigravity

```bash
git clone https://github.com/carrick87/user-adoption-skill.git ~/.gemini/config/skills/user-adoption-skill
```

### Gemini CLI

```bash
git clone https://github.com/carrick87/user-adoption-skill.git ~/.gemini/skills/user-adoption-skill
```

### One-liner for multiple tools

```bash
REPO=https://github.com/carrick87/user-adoption-skill.git
git clone "$REPO" ~/.cursor/skills/user-adoption-skill
git clone "$REPO" ~/.claude/skills/user-adoption-skill
git clone "$REPO" ~/.codex/skills/user-adoption-skill
git clone "$REPO" ~/.gemini/config/skills/user-adoption-skill
```

Restart your agent / IDE after installing.

### Update

```bash
git -C ~/.cursor/skills/user-adoption-skill pull
# repeat for other install paths you use
```

---

## Skill commands

| Command | What it does |
|---------|----------------|
| `/adopt` | Full install: SQL + `lib/usage` + `/adoption` page + record call sites |
| `/adopt-audit` | Check gates, privacy (no IP/UA), meaningful-use, and missing events |
| `/adopt-event <name>` | Add one event through SQL, contract, and call site |
| `/adopt-report` | Extend or explain report metrics without changing writes |

### Example prompts

```
/adopt
```

```
Add a user adoption page like DAU WAU MAU for this Next.js Supabase app
```

```
/adopt-audit
```

```
/adopt-event invoice_exported
```

```
/adopt-report explain activation vs adoption
```

---

## What gets installed

```
supabase/migrations/..._usage.sql   # tables + RPCs
lib/usage/contract.ts               # event builders + privacy allow-list
lib/usage/record.ts                 # swallow-errors writer
components/adoption-table.tsx       # sortable / filterable / CSV tables
app/adoption/page.tsx               # gated report UI
```

Events are written **only on the server**. The report is visible to admins (adapt role check). Recording failures never break login or product pages.

Details: [references/nextjs-supabase.md](references/nextjs-supabase.md) · [references/metrics.md](references/metrics.md) · [references/privacy.md](references/privacy.md)

---

## Privacy

- No visitor IP or user-agent
- No raw search text, passwords, or tokens
- `user_id` / `session_id` set inside a security-definer RPC from the JWT
- Metadata keys are allow-listed in TypeScript **and** SQL

---

## Layout

```
user-adoption-skill/
├── SKILL.md
├── README.md
├── LICENSE
├── commands/          # /adopt, /adopt-audit, /adopt-event, /adopt-report
├── references/        # metrics, schema, privacy, hosts, install guide
└── templates/         # SQL + TypeScript starters
```

---

## License

MIT © carrick87
