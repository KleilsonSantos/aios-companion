# AGENTS.md — AIOS Companion

Contrato para agentes neste repositório.

## Missão

Construir a **experiência Companion** (Conversation Manager → voz depois) que **consome** o AIOS via contratos estáveis.

## Fontes de verdade

1. Código neste repo (`src/`)
2. Fronteira: `docs/BOUNDARY.md`
3. Control plane: repo **ai-operating-system** (`docs/FOUNDATION.md`, ADR-0014/0015) — **não** reimplementar engines

## Regras

1. **Não** copiar Policy / Memory / Knowledge / Prompt / Governance do AIOS.
2. **Não** embutir o monorepo AIOS como pasta (ADR-0001).
3. Preferir MCP `aios_*` e CLI `aios`; não importar `engines/*` do AIOS como API pública.
4. Resource-Aware: on-demand; sem polling agressivo; voz/watchers só com justificação.
5. Commits: `type: <gitmoji> …` · autoria `Kleilson Santos <kdsddesign1@gmail.com>` · sem Co-authored-by de IDE.
6. Merges: `merge: 🔀 PR #<n> — <branch>` (ou helper equivalente).
7. Fluxo: Issue → `feature/*` from `sandbox` → PR → `sandbox` → PR → `main`.
