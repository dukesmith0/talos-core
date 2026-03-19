# TALOS

**The Automaton for Local Operations and Search** — a persistent second brain for Claude Code.

TALOS gives Claude persistent memory across sessions via an Obsidian vault. The CLI manages brain infrastructure (indexing, linking, search). The [marketplace plugins](https://github.com/dukesmith0/talos-marketplace) teach Claude how to use it.

## Why TALOS?

Claude forgets everything between sessions. TALOS fixes that:
- **Remember** what you learned, who you met, what you decided
- **Search** across all your knowledge with semantic + keyword search
- **Track** projects, bugs, decisions, and risks persistently
- **Reflect** on patterns in your work over time
- **Automate** session start/end with crash recovery and vault sync

---

## Quick Start

```bash
# 1. Install
git clone https://github.com/dukesmith0/talos-core.git
cd talos-core && npm install && npm run build && npm link

# 2. Create your brain
talos setup

# 3. Add the plugin marketplace
claude plugin marketplace add dukesmith0/talos-marketplace

# 4. Install plugins (talos-brain is required)
claude plugin install talos-brain@talos-marketplace
claude plugin install talos-code@talos-marketplace     # dev workflows
claude plugin install talos-career@talos-marketplace    # job search
claude plugin install talos-study@talos-marketplace     # learning
claude plugin install talos-thoughts@talos-marketplace  # brainstorming

# 5. Verify
talos health
```

### Permissions

Add to `~/.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(talos *)",
      "Read(*your-vault-name*)",
      "Edit(*your-vault-name*)",
      "Write(*your-vault-name*)"
    ]
  }
}
```

---

## Commands

### Daily Use
| Command | Plugin | What it does |
|---------|--------|-------------|
| `/talos-query` | Brain | Search vault + project. Auto-selects depth. |
| `/talos-add` | Brain | Store knowledge. Auto-detects format. `--pin`/`--unpin` for working memory. |
| `/talos-log` | Brain | Append timestamped entry to daily note. |
| `/talos-morning` | Brain | Briefing: calendar, priorities, open threads. |

### Session
| `/talos-wrapup` | Brain | Session close: update .talos, reindex, sync. |

### Development
| `/talos-init` | Code | Scaffold `.talos/` project framework. |
| `/talos-plan` | Code | Task → checkable plan with vault context. |
| `/talos-go` | Code | Execute next plan item. |
| `/talos-ralph` | Code | Iterative loop with stuck detection. |
| `/talos-oneshot` | Code | Quick task, no plan. |
| `/talos-review` | Code | Code review with severity ratings. |
| `/talos-simplify` | Code | Refactor for clarity. |
| `/talos-diff` | Code | Git history analysis by topic. |
| `/talos-risks` | Code | Security/architecture risk analysis. |
| `/talos-consolidate` | Code | Compress `.talos/` files for token efficiency. |

### Career
| `/talos-apply` | Career | Job fit scoring → `career/applications/`. |
| `/talos-contact` | Career | Create/lookup contacts → `career/contacts/`. |
| `/talos-followup` | Career | Scan for overdue follow-ups. |
| `/talos-prep` | Career | Interview/meeting prep with vault context. |

### Study
| `/talos-study` | Study | Socratic tutoring by proficiency level. |
| `/talos-teach` | Study | Feynman technique evaluation. |
| `/talos-notes` | Study | Course notes to vault. |
| `/talos-learn` | Study | Quick concept lookup. |

### Ideas
| `/talos-brainstorm` | Ideas | SCAMPER brainstorming with scoring. |
| `/talos-ideate` | Ideas | Multi-perspective idea evaluation. |
| `/talos-research` | Ideas | Deep research: vault + web. |
| `/talos-think` | Ideas | Socratic reasoning walkthrough. |

### Maintenance
| `/talos-reflect` | Brain | Pattern analysis on vault activity. |
| `/talos-maintain` | Brain | Diagnose → fix → clean → report. |
| `/talos-sync` | Brain | Git sync vault. `--status` for brain report. |
| `/talos-help` | Brain | Full command reference. |

---

## CLI

| Command | Description |
|---------|-------------|
| `talos setup` | First-run onboarding |
| `talos health` | System health check |
| `talos doctor` | Auto-repair brain files |
| `talos update` | Reindex + embed + rebuild indexes |
| `talos sync` | Git pull + push vault |
| `talos vault` | Print vault path |
| `talos log <msg>` | Daily note entry |
| `talos link <file>` | Add wikilinks to a file |
| `talos index [--full]` | Build link graph + tag index |
| `talos wordfreq` | Build term frequency index |
| `talos search <query>` | Search vault (modes: hybrid, lex, vec) |
| `talos template` | Manage templates (list, show, reset) |

---

## Vault Structure

```
vault/
├── _brain/              # System files (auto-managed)
│   ├── profile.md       # Identity (loaded every session)
│   ├── priorities.md    # Current focus (loaded every session)
│   ├── pinned/          # Working memory (loaded every session)
│   ├── schemas.yaml     # Note type definitions (10 types)
│   ├── config.yaml      # Brain configuration
│   ├── link-index.yaml  # Entity graph (auto-rebuilt)
│   ├── word-freq.txt    # Term frequency (auto-rebuilt)
│   ├── crash-buffer.md  # Open threads between sessions
│   └── gaps.txt         # Knowledge gaps
├── _templates/          # Note templates
├── journal/             # Daily notes (YYYY/MM/YYYY-MM-DD.md)
├── projects/            # Project overview notes
├── references/          # Reference material, facts
├── ideas/               # Brainstorms, proposals
└── career/
    ├── contacts/        # People
    └── applications/    # Job applications
```

---

## Obsidian Integration

Open your vault directory in Obsidian for a visual knowledge graph, daily note navigation, and Dataview queries.

### Recommended Plugins

| Plugin | Purpose |
|--------|---------|
| **Calendar** | Navigate daily notes by date |
| **Dataview** | Query notes by frontmatter (type, tags, status) |
| **Git** | Auto-backup vault (10 min interval) |
| **Templater** | Use `_templates/` for new notes |
| **QuickAdd** | Quick capture to daily note |
| **Data Files Editor** | Edit YAML/JSON brain files |
| **New 3D Graph** | 3D knowledge graph visualization |

### Tips
- **Templater**: Set template folder to `_templates`
- **Git**: Disable pull on startup (TALOS handles sync)
- **Excluded folders**: Add `_brain` to Settings → Files & Links → Excluded

---

## Architecture

| Component | Role |
|-----------|------|
| **talos-core** | CLI for vault operations (Node.js/TypeScript) |
| **talos-marketplace** | Claude Code plugins (5 plugins, 32 skills, 15 agents) |
| **Obsidian vault** | Knowledge storage (markdown + YAML frontmatter) |
| **QMD** | Search engine (BM25 + vector + hybrid reranking) |

### Memory Systems

| System | Storage | Access |
|--------|---------|--------|
| Working | Context + crash-buffer | SessionStart hook |
| Episodic | Daily notes | `talos log` |
| Semantic | Typed vault notes | QMD search |
| Identity | `_brain/profile.md` | Every session |
| Pinned | `_brain/pinned/*.md` | Every session |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript (strict, ESM) |
| Runtime | Node.js >=18 |
| CLI | Commander.js |
| Search | QMD (`@tobilu/qmd`) |
| Git | simple-git |
| Frontmatter | gray-matter |
| Build | `tsc` |
| Test | vitest |

## License

MIT
