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
```

## Resource-Aware

- Estado operacional **on-demand** (sem polling)
- Sem watchers Git/IDE neste MVP
- Não instala Ollama/Docker só para “ficar vivo”

## Fluxo Git

Mesma disciplina do AIOS: `feature/*` → `sandbox` → `main` · commits `type: <gitmoji> …` · merges via subject `merge: 🔀 …`.

## Tracking

Issue AIOS: [#90](https://github.com/KleilsonSantos/ai-operating-system/issues/90)
