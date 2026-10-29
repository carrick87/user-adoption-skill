# Install paths by host

Canonical skill folder name: `user-adoption-skill`.

| Tool | Global | Project |
|------|--------|---------|
| Cursor | `~/.cursor/skills/user-adoption-skill/` | `.cursor/skills/user-adoption-skill/` |
| Claude Code | `~/.claude/skills/user-adoption-skill/` | `.claude/skills/user-adoption-skill/` |
| OpenAI Codex | `~/.codex/skills/user-adoption-skill/` | `.agents/skills/user-adoption-skill/` |
| Gemini CLI | `~/.gemini/skills/user-adoption-skill/` | `.gemini/skills/` or `.agents/skills/` |
| Antigravity | `~/.gemini/config/skills/user-adoption-skill/` or `~/.gemini/antigravity/skills/` | `.agents/skills/user-adoption-skill/` |

## Skill CLI

```bash
npx skills add carrick87/user-adoption-skill
# or pin agents:
npx skills add carrick87/user-adoption-skill --agent cursor claude-code codex
```

## Codex

If skills are disabled, enable in `~/.codex/config.toml`:

```toml
[features]
skills = true
```

Restart the agent or IDE after installing.
