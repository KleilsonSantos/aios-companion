# AIOS Companion

> Experiência cognitiva (chat) que **consome** o [AI Operating System](https://github.com/KleilsonSantos/ai-operating-system) — não o substitui.

[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](./LICENSE)

## Em uma frase

O **AIOS governa**; o **Companion conversa** — Conversation Manager + MCP/CLI, sem duplicar engines.

## Fronteira (ADR-0014)

| Capacidade | Onde |
| --- | --- |
| Policies, memory, governance, operational state | **AIOS** (control plane) |
| Diálogo contínuo / UX “Jarvis” | **Este repo** |
| Voz, watchers IDE/Docker | Depois (ainda não) |
| Abrir IDE / subir containers | Fora do MVP |

Canónico no AIOS: [ADR-0014](https://github.com/KleilsonSantos/ai-operating-system/blob/main/docs/adr/0014-control-plane-companion.md) · [guia](https://github.com/KleilsonSantos/ai-operating-system/blob/main/docs/guides/control-plane-companion.md).

## Pré-requisitos

1. Checkout do AIOS (`ai-operating-system`) com `v0.18.0+`
2. Node ≥ 22.13
3. `AIOS_HOME` apontando para o monorepo AIOS

```bash
export AIOS_HOME=/path/to/ai-operating-system
```

## Uso (MVP)

```bash
pnpm install
pnpm companion status           # MCP (fallback CLI) → aios_operational_state
pnpm companion status --mcp     # forçar MCP stdio
pnpm companion chat             # replies via aios_provider_chat (fallback local)
pnpm companion chat --local     # só respostas determinísticas
pnpm companion caps             # probe git / github
pnpm companion caps git         # branch/status on-demand
pnpm companion caps github      # PRs abertos via `gh` (se autenticado)
pnpm companion run "Analise meu projeto."   # núcleo AIOS (aios_run_pipeline)
pnpm companion gov                  # health + attention (aios_governance_status)
pnpm companion decide "aceitar CI mínimo" --verdict info
pnpm companion memory recall        # memória do workspace (default: aios)
pnpm companion memory remember "nota curta"
```

## Capability adapters

Contratos finos no Companion (ADR-0014) — **não** engines AIOS:

| Adapter | Fonte | Notas |
| --- | --- | --- |
| `git` | AIOS operational state ou `git` CLI | On-demand; sem watchers |
| `github` | `gh` CLI | Inspect-before-install; sem Octokit se `gh` existir |

## Resource-Aware

- Estado operacional **on-demand** (sem polling)
- Caps Git/GitHub **on-demand** (sem watchers)
- Não instala Ollama/Docker/`gh` só para “ficar vivo”

## Fluxo Git

Mesma disciplina do AIOS: `feature/*` → `sandbox` → `main` · commits `type: <gitmoji> …` · merges via subject `merge: 🔀 …`.

CI: `.github/workflows/ci.yml` — `pnpm typecheck` + `test` em PRs/`main`/`sandbox` (sem matrix).

## Tracking

Issue AIOS: [#90](https://github.com/KleilsonSantos/ai-operating-system/issues/90)
