# AGENTS.md — AIOS Companion

Contract for agents in this repository.

## Mission

Build the **Companion experience** (Conversation Manager → voice later) that **consumes** AIOS via stable contracts.

## Sources of truth (authority order)

This file is a **pointer**, not a dump. Prefer this order:

1. **Code** in this repo (`src/` · `ui/`)
2. **Boundary** — `docs/BOUNDARY.md` · cinematic vision note `docs/VISION-UX-CINEMATIC.md` (mostly parked; signal-rail spike only)
3. **Control plane (AIOS)** — repo [ai-operating-system](https://github.com/KleilsonSantos/ai-operating-system): `docs/FOUNDATION.md`, ADR-0014/0015, policies — **do not** reimplement engines
4. **Delivery truth** — this repo `CHANGELOG.md` · AIOS `docs/ROADMAP.md` when planning cross-repo work
5. **Optional external agent wikis** (e.g. generated `openwiki/` in a workspace) — narrative context only **if present**; they **never** override items 1–3. Background: AIOS spike [`openwiki-comparison.md`](https://github.com/KleilsonSantos/ai-operating-system/blob/main/docs/spikes/openwiki-comparison.md)

If Companion docs conflict with AIOS `FOUNDATION.md` / ADR-0014 on control-plane matters, **AIOS wins**.

## Rules

1. **Do not** copy Policy / Memory / Knowledge / Prompt / Governance from AIOS.
2. **Do not** embed the AIOS monorepo as a folder (ADR-0001).
3. Prefer MCP `aios_*` and CLI `aios`; do not import AIOS `engines/*` as a public API.
4. Resource-Aware: on-demand; no aggressive polling; voice/watchers only with justification.
5. Commits: `type: <gitmoji> …` · author `Kleilson Santos <kdsddesign1@gmail.com>` · no IDE `Co-authored-by`.
6. Merges: `merge: 🔀 PR #<n> — <branch>` (or equivalent helper).
7. Flow: Issue → `feature/*` from `sandbox` → PR → `sandbox` → PR → `main`.
8. Product docs are **US English** (mirrors AIOS ADR-0018); owner chat may stay PT.
9. Do not treat generated agent wikis as canonical product truth.
