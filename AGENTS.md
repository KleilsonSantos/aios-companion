# AGENTS.md — AIOS Companion

Contract for agents in this repository.

## Mission

Build the **Companion experience** (Conversation Manager → voice later) that **consumes** AIOS via stable contracts.

## Sources of truth

1. Code in this repo (`src/`)
2. Boundary: `docs/BOUNDARY.md`
3. Control plane: **ai-operating-system** repo (`docs/FOUNDATION.md`, ADR-0014/0015) — **do not** reimplement engines

## Rules

1. **Do not** copy Policy / Memory / Knowledge / Prompt / Governance from AIOS.
2. **Do not** embed the AIOS monorepo as a folder (ADR-0001).
3. Prefer MCP `aios_*` and CLI `aios`; do not import AIOS `engines/*` as a public API.
4. Resource-Aware: on-demand; no aggressive polling; voice/watchers only with justification.
5. Commits: `type: <gitmoji> …` · author `Kleilson Santos <kdsddesign1@gmail.com>` · no IDE `Co-authored-by`.
6. Merges: `merge: 🔀 PR #<n> — <branch>` (or equivalent helper).
7. Flow: Issue → `feature/*` from `sandbox` → PR → `sandbox` → PR → `main`.
8. Product docs are **US English** (mirrors AIOS ADR-0018); owner chat may stay PT.
