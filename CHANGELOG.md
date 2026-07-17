# Changelog

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/).  
Versão: SemVer.

## [Unreleased]

### Added

- `companion providers` / `/providers` — `aios_provider_health` + `aios_provider_models` (#58)
- `companion policies` / `/policies` — `aios_load_policies` (#61)

## [0.3.0] — 2026-07-17

Marco **pós-MVP** — superfície MCP alargada (Prompt Engine, multi-repo, Knowledge Graph). Sem voz / sem UX cinemática.

### Added

- `companion brief` / `compile` / `/brief` — `aios_compile_prompt` (intent → brief governado) (#43)
- `companion workspaces` / `ws` / `/workspaces` — `aios_list_workspaces` + `aios_workspace_*` (#46)
- `companion run-all` / `/run-all` — `aios_run_across_workspaces` (pipeline multi-repo) (#49)
- `companion knowledge` / `kg` / `/knowledge` — `aios_build_knowledge` (mapa heurístico) (#52)

### Notes

- Requer AIOS `v0.18.0+` e `AIOS_HOME`
- Visão Jarvis/Minority Report: issue [#37](https://github.com/KleilsonSantos/aios-companion/issues/37) (parked)

## [0.2.0] — 2026-07-17

Marco do **MVP Companion** — experiência CLI/chat que consome o control plane AIOS (ADR-0014). Sem voz / sem UX cinemática.

### Added

- `companion status` — `aios_operational_state` (MCP, fallback CLI)
- `companion doctor` — check-up da ponte (HOME, MCP, contract v1, state, gov)
- `companion chat` — provider (`aios_provider_chat`) + auto-route “analisa…” → pipeline
- `companion run` / `/run` — `aios_run_pipeline`
- `companion gov` / `/gov` — `aios_governance_status`
- `companion decide` / `/decide` — `aios_governance_record`
- `companion audit` / `/audit` — `aios_audit_docs`
- `companion memory recall|remember` / `/memory` — `aios_memory_*`
- `companion caps git|github` — adapters on-demand (sem watchers)
- CI mínimo (`.github/workflows/ci.yml` — typecheck + test)
- Docs: `BOUNDARY.md`, `VISION-UX-CINEMATIC.md` (visão parked · #37)

### Changed

- Cliente MCP com `stderr: 'ignore'` + `AIOS_MCP_QUIET` (#34) — sem banner stdio

### Notes

- Requer AIOS `v0.18.0+` e `AIOS_HOME`
- Visão Jarvis/Minority Report: issue [#37](https://github.com/KleilsonSantos/aios-companion/issues/37) (parked)

## [0.1.0] — 2026-07-16

- Bootstrap: Conversation Manager + bridge CLI operacional
