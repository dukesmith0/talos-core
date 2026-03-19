# LOCI

**The Automaton for Local Operations and Search** — a persistent second brain for Claude Code.

LOCI gives Claude persistent memory across sessions via an Obsidian vault. The CLI manages brain infrastructure (indexing, linking, search). The [marketplace plugins](https://github.com/dukesmith0/loci-marketplace) teach Claude how to use it.

## Why LOCI?

Claude forgets everything between sessions. LOCI fixes that:
- **Remember** what you learned, who you met, what you decided
- **Search** across all your knowledge with semantic + keyword search
- **Track** projects, bugs, decisions, and risks persistently
- **Reflect** on patterns in your work over time
- **Automate** session start/end with crash recovery and vault sync

---

## Prerequisites

| Dependency | Required? | Install |
|-----------|-----------|---------|
| **Node.js** >=18 | Yes | [nodejs.org](https://nodejs.org/) |
| **Git** | Yes | [git-scm.com](https://git-scm.com/) |
| **Claude Code** | Yes | CLI or VS Code extension |
| **QMD** | Yes (auto-installed) | Bundled with `npm install` |
| **Obsidian** | Recommended | [obsidian.md](https://obsidian.md/) |

## Quick Start

### Step 1: Install QMD (search engine)
```bash
npm install -g @tobilu/qmd
claude mcp add qmd --github tobi/qmd
```

### Step 2: Install LOCI Core (CLI)
```bash
git clone https://github.com/dukesmith0/loci-core.git
cd loci-core && npm install && npm run build && npm link
```

### Step 3: Create your vault
```bash
loci setup
```
Follow the prompts — enter your vault path, name, and current focus. This creates the full vault structure, Obsidian config (graph colors, QuickAdd macros, Bases views), brain files, and QMD index.

### Step 4: Add plugins to Claude Code
```bash
claude plugin marketplace add dukesmith0/loci-marketplace
claude plugin install loci-brain@loci-marketplace
claude plugin install loci-code@loci-marketplace
claude plugin install loci-career@loci-marketplace
claude plugin install loci-study@loci-marketplace
claude plugin install loci-thoughts@loci-marketplace
```

### Step 5: Verify
```bash
loci health
loci stats
```

### Claude Code Permissions

Add to `~/.claude/settings.json` to avoid permission popups for vault operations:

```json
{
  "permissions": {
    "allow": [
      "Bash(loci *)",
      "Bash(cd *loci*)",
      "Read(*your-vault-name*/**)",
      "Edit(*your-vault-name*/**)",
      "Write(*your-vault-name*/**)"
    ]
  }
}
```

Replace `*your-vault-name*` with your actual vault folder name (e.g., `loci-vault`).

---

## Who Is LOCI For?

| You are a... | Install | Start with |
|-------------|---------|-----------|
| **Anyone** | `loci-brain` | `/loci-add` → `/loci-query` → `/loci-reflect` |
| **Developer** | + `loci-code` | `/loci-init` → `/loci-plan` → `/loci-go` |
| **Student** | + `loci-study` | `/loci-notes` → `/loci-study` → `/loci-teach` |
| **Strategist** | + `loci-thoughts` | `/loci-brainstorm` → `/loci-ideate` → `/loci-research` |
| **Job Seeker** | + `loci-career` | `/loci-apply` → `/loci-contact` → `/loci-prep` |
| **Researcher** | + `loci-thoughts` | `/loci-add` (papers) → `/loci-research` → `/loci-hub` |
| **PM** | + `loci-code` | `/loci-plan` → `/loci-go` → `/loci-ralph` → `/loci-wrapup` |
| **Writer** | + `loci-thoughts` | `/loci-brainstorm` → `/loci-add` → `/loci-query` |

---

## Commands

### Daily Use
| Command | Plugin | What it does |
|---------|--------|-------------|
| `/loci-query` | Brain | Search vault + project. Auto-selects depth. |
| `/loci-add` | Brain | Store knowledge. Auto-detects format. `--pin`/`--unpin` for working memory. |
| `/loci-log` | Brain | Append timestamped entry to daily note. |
| `/loci-morning` | Brain | Briefing: calendar, priorities, open threads. |

### Session
| `/loci-wrapup` | Brain | Session close: update .loci, reindex, sync. |

### Development
| `/loci-init` | Code | Scaffold `.loci/` project framework. |
| `/loci-plan` | Code | Task → checkable plan with vault context. |
| `/loci-go` | Code | Execute next plan item. |
| `/loci-ralph` | Code | Iterative loop with stuck detection. |
| `/loci-oneshot` | Code | Quick task, no plan. |
| `/loci-review` | Code | Code review with severity ratings. |
| `/loci-simplify` | Code | Refactor for clarity. |
| `/loci-diff` | Code | Git history analysis by topic. |
| `/loci-risks` | Code | Security/architecture risk analysis. |
| `/loci-consolidate` | Code | Compress `.loci/` files for token efficiency. |

### Career
| `/loci-apply` | Career | Job fit scoring → `career/applications/`. |
| `/loci-contact` | Career | Create/lookup contacts → `career/contacts/`. |
| `/loci-followup` | Career | Scan for overdue follow-ups. |
| `/loci-prep` | Career | Interview/meeting prep with vault context. |

### Study
| `/loci-study` | Study | Socratic tutoring by proficiency level. |
| `/loci-teach` | Study | Feynman technique evaluation. |
| `/loci-notes` | Study | Course notes to vault. |
| `/loci-learn` | Study | Quick concept lookup. |

### Ideas
| `/loci-brainstorm` | Ideas | SCAMPER brainstorming with scoring. |
| `/loci-ideate` | Ideas | Multi-perspective idea evaluation. |
| `/loci-research` | Ideas | Deep research: vault + web. |
| `/loci-think` | Ideas | Socratic reasoning walkthrough. |

### Maintenance
| `/loci-reflect` | Brain | Pattern analysis on vault activity. |
| `/loci-maintain` | Brain | Diagnose → fix → clean → report. |
| `/loci-sync` | Brain | Git sync vault. `--status` for brain report. |
| `/loci-help` | Brain | Full command reference. |

---

## CLI

| Command | Description |
|---------|-------------|
| `loci setup` | First-run onboarding |
| `loci health` | System health check |
| `loci doctor` | Auto-repair brain files |
| `loci update` | Reindex + embed + rebuild indexes |
| `loci sync` | Git pull + push vault |
| `loci vault` | Print vault path |
| `loci log <msg>` | Daily note entry |
| `loci link <file>` | Add wikilinks to a file |
| `loci index [--full]` | Build link graph + tag index |
| `loci wordfreq` | Build term frequency index |
| `loci search <query>` | Search vault (modes: hybrid, lex, vec) |
| `loci stats` | Vault quality metrics (origin, hub health, TF-IDF) |
| `loci template` | Manage templates (list, show, reset) |

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
├── tags/                # Concept hub pages (dynamically created)
│   ├── languages/       # Python, TypeScript, etc.
│   ├── frameworks/      # React, FastAPI, etc.
│   ├── tools/           # Arduino, CMake, etc.
│   ├── platforms/       # GitHub, Obsidian, etc.
│   ├── domains/         # Aerospace, Engineering, etc.
│   ├── methods/         # PID, Sensor Fusion, etc.
│   └── topics/          # General concepts
└── career/
    ├── contacts/        # People
    └── applications/    # Job applications
```

---

## Obsidian Integration

Open your vault directory in Obsidian. LOCI setup creates graph color config, QuickAdd macros, and Bases database views automatically.

### Required Plugins

These plugins are needed for LOCI features to render correctly:

| Plugin | Why Required | Install |
|--------|-------------|---------|
| **Dataview** | Hub live connections, dashboards, knowledge health queries | Community plugins → Dataview |
| **QuickAdd** | Quick capture macros (fact, reference, contact, application) | Community plugins → QuickAdd |

### Recommended Plugins

| Plugin | Purpose |
|--------|---------|
| **Calendar** | Navigate daily notes by clicking dates |
| **Git** | Auto-backup vault every 10 min |
| **Templater** | Use `_templates/` for new notes |
| **Data Files Editor** | Edit YAML/JSON brain files in Obsidian |
| **New 3D Graph** | 3D knowledge graph visualization |

### Setup After Installing Plugins
1. **Templater**: Settings → Template folder → `_templates`
2. **Git**: Settings → Disable "Pull on startup" (LOCI handles sync)
3. **QuickAdd**: Macros are pre-configured by `loci setup` — just enable the plugin
4. **Excluded folders**: Settings → Files & Links → add `_brain` to excluded

---

## Architecture

| Component | Role |
|-----------|------|
| **loci-core** | CLI for vault operations (Node.js/TypeScript) |
| **loci-marketplace** | Claude Code plugins (5 plugins, 32 skills, 13 agents) |
| **Obsidian vault** | Knowledge storage (markdown + YAML frontmatter) |
| **QMD** | Search engine (BM25 + vector + hybrid reranking) |

### Memory Systems

| System | Storage | Access |
|--------|---------|--------|
| Working | Context + crash-buffer | SessionStart hook |
| Episodic | Daily notes | `loci log` |
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
