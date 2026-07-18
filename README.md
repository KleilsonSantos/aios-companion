# AIOS Companion

> Cognitive experience (chat) that **consumes** the [AI Operating System](https://github.com/KleilsonSantos/ai-operating-system) — it does not replace it.

[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](./LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.13-brightgreen)](package.json)

**Version:** `0.11.0` — [CHANGELOG](./CHANGELOG.md)

Product documentation is **US English** (mirrors AIOS [ADR-0018](https://github.com/KleilsonSantos/ai-operating-system/blob/main/docs/adr/0018-documentation-language.md)).

## Table of contents

1. [In one sentence](#in-one-sentence)
2. [Boundary (ADR-0014)](#boundary-adr-0014)
3. [Prerequisites](#prerequisites)
4. [Surface UI](#surface-ui)
5. [CLI usage (MVP)](#cli-usage-mvp)
6. [Capability adapters](#capability-adapters)
7. [Resource-Aware](#resource-aware)
8. [Git flow](#git-flow)
9. [Tracking](#tracking)
10. [Contributing](#contributing)

## In one sentence

**AIOS governs**; the **Companion converses** — Conversation Manager + MCP/CLI, without duplicating engines.

## Boundary (ADR-0014)

| Capability | Where |
| --- | --- |
| Policies, memory, governance, operational state | **AIOS** (control plane) |
| Continuous dialogue / “Jarvis” UX | **This repo** |
| Voice, IDE/Docker watchers | Later (not yet) |
| Open IDE / start containers | Out of MVP |

Canonical in AIOS: [ADR-0014](https://github.com/KleilsonSantos/ai-operating-system/blob/main/docs/adr/0014-control-plane-companion.md) · [guide](https://github.com/KleilsonSantos/ai-operating-system/blob/main/docs/guides/control-plane-companion.md).

Future UX vision (parked): [docs/VISION-UX-CINEMATIC.md](./docs/VISION-UX-CINEMATIC.md) · issue [#37](https://github.com/KleilsonSantos/aios-companion/issues/37).

## Prerequisites

1. AIOS checkout (`ai-operating-system`) with `v0.25.0+` (HTTP MCP) or `v0.23.0+` (stdio)
2. Node ≥ 22.13
3. `AIOS_HOME` pointing at the AIOS monorepo

```bash
export AIOS_HOME=/path/to/ai-operating-system
# optional — reuse a running AIOS Streamable HTTP MCP (ADR-0022):
# export AIOS_MCP_URL=http://127.0.0.1:8791/mcp
# optional — Portuguese chat copy (default is English):
# export COMPANION_LOCALE=pt
```

### Verify your install

```bash
pnpm install
pnpm run typecheck
pnpm test
```

## Surface UI

One composition — **Companion** brand, conversation, operational line (with **consumption**), attention + **memory**. Consumes AIOS via MCP (no engine reimplementation). Cinematic UX remains parked ([#37](https://github.com/KleilsonSantos/aios-companion/issues/37)).

```bash
export AIOS_HOME=/path/to/ai-operating-system
pnpm install
pnpm companion surface         # API :8790 + UI :5174 · opens browser once
pnpm companion surface --no-open
pnpm companion surface --api-only
```

- Refresh / memory recall are **on-demand** (Resource-Aware; no polling loop)
- Conversation persists locally (`~/.aios-companion/surface-session.json`)
- Chat streams via SSE progressive reveal (`POST /api/chat/stream`); workspace chip selects AIOS workspace on demand
- Chat: analysis → `aios_run_pipeline`; `/memory` · `/memory remember …` · `/memory remember @ws …` → Memory Engine; else `aios_provider_chat` (local fallback)
- Clear memory stays CLI-only: `companion memory clear --yes`

## CLI usage (MVP)

```bash
pnpm install
pnpm companion status           # MCP (CLI fallback) → aios_operational_state
pnpm companion doctor           # check-up (contract + state + gov + consumption + provider + policies)
pnpm companion status --mcp     # force MCP stdio
pnpm companion chat             # replies via provider; "analisa…" → pipeline
pnpm companion chat --local     # deterministic replies only
pnpm companion caps             # probe git / github
pnpm companion caps git         # branch/status on-demand
pnpm companion caps github      # open PRs via `gh` (if authenticated)
pnpm companion run "Analyze my project."   # AIOS core (aios_run_pipeline)
pnpm companion run-all "Analyze" --workspace aios --workspace companion
pnpm companion gov                  # health + attention (aios_governance_status)
pnpm companion gov audit            # inspection (aios_governance_audit)
pnpm companion decide "accept minimal CI" --verdict info
pnpm companion audit                # docs inventory/drift (aios_audit_docs)
pnpm companion memory recall        # workspace memory (default: aios)
pnpm companion memory remember "short note"
pnpm companion memory clear --yes   # clear memory (requires --yes)
pnpm companion brief "Create an auth hook"   # Prompt Engine (aios_compile_prompt)
pnpm companion workspaces                     # list registry (aios_list_workspaces)
pnpm companion workspaces add companion ~/Projects/aios-companion
pnpm companion workspaces validate
pnpm companion knowledge                  # Knowledge Graph (aios_build_knowledge)
pnpm companion knowledge --workspace aios --json
pnpm companion providers              # health (aios_provider_health)
pnpm companion providers models       # list models (aios_provider_models)
pnpm companion policies               # Policy Engine (aios_load_policies)
```

## Capability adapters

Thin contracts in Companion (ADR-0014) — **not** AIOS engines:

| Adapter | Source | Notes |
| --- | --- | --- |
| `git` | AIOS operational state or `git` CLI | On-demand; no watchers |
| `github` | `gh` CLI | Inspect-before-install; no Octokit if `gh` exists |

## Resource-Aware

- Operational state **on-demand** (no polling)
- Git/GitHub caps **on-demand** (no watchers)
- Does not install Ollama/Docker/`gh` just to “look alive”

## Git flow

Same discipline as AIOS: `feature/*` → `sandbox` → `main` · commits `type: <gitmoji> …` · merges via subject `merge: 🔀 …`.

CI: `.github/workflows/ci.yml` — `pnpm typecheck` + `test` on PRs/`main`/`sandbox` (no matrix).

## Tracking

AIOS issue: [#90](https://github.com/KleilsonSantos/ai-operating-system/issues/90)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the code of conduct and pull request process.
