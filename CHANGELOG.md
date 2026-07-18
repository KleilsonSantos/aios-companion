# Changelog

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/).  
Versão: SemVer.

## [Unreleased]

## [0.8.0] — 2026-07-18

**Surface session continuity** — persist conversation, open browser, doctor probe. Cinematic UX (#37) stays parked. Requires AIOS **v0.23.0+**.

### Added

- Persist surface conversation to `~/.aios-companion/surface-session.json` (override: `COMPANION_SESSION_PATH`) (#85)
- `POST /api/session/reset` — new conversation (keeps file updated)
- `companion surface` opens the UI in the default browser once (`--no-open` to skip)
- Doctor `surface` check — probes `GET /api/health` (info if down; optional)

### Notes

- Resource-Aware: on-demand writes; no polling; turn cap ~120
- Session is local-only (no cloud sync)

## [0.7.0] — 2026-07-18

**Surface depth** — consumption + memory on the web surface; CLI launcher. Cinematic UX (#37) stays parked. Requires AIOS **v0.23.0+**.

### Added

- Consumption chip from governance `providerChat` metrics on the surface (#82)
- Memory panel (on-demand recall) + `/memory` / `/memory remember …` in surface chat
- `POST /api/memory` (recall|remember) · `companion surface` / `companion ui` CLI
- Snapshot includes `governance.consumption` + `memory`

### Notes

- Clear stays CLI-only (`companion memory clear --yes`) — destructive
- Resource-Aware: still no polling loop

## [0.6.0] — 2026-07-17

Minimal **surface UI** — one composition (conversation + state + attention) over MCP. Cinematic UX (#37) stays parked. Requires AIOS **v0.23.0+**.

### Added

- Local web surface (`pnpm surface`) — Vite + React UI + thin HTTP API (#79)
- `GET /api/surface`, `POST /api/chat`, `POST /api/refresh` via Conversation Manager + MCP
- On-demand refresh only (Resource-Aware; no aggressive polling)

### Notes

- Does not replace the AIOS console; does not reimplement engines
- CLI remains the primary automation surface

## [0.5.0] — 2026-07-17

Control-plane **consumption + governance v2** surface. Requires AIOS **v0.23.0+**.

### Added

- `companion doctor`: `consumption` check (`providerChat`) + `governance_v2` when fail verdicts (#76)
- `companion gov` / `/gov`: print consumption + exposed providers
- `gov audit`: fail verdicts / missing core must / unknown policy refs in summary (#76)

### Changed

- MCP client parses `metrics.providerChat` and governance audit v2 fields from AIOS

## [0.4.0] — 2026-07-17

Marco **MCP completo** — providers, policies, inspeção de governação e memory clear. Sem voz / sem UX cinemática.

### Added

- `companion providers` / `/providers` — `aios_provider_health` + `aios_provider_models` (#58)
- `companion policies` / `/policies` — `aios_load_policies` (#61)
- `companion gov audit` / `/gov audit` — `aios_governance_audit` (#64)
- `companion memory clear --yes` — `aios_memory_clear` (#67)

### Notes

- Superfície MCP `aios_*` consumível pelo Companion está coberta (ADR-0014)
- Requer AIOS `v0.18.0+` e `AIOS_HOME`
- Visão Jarvis/Minority Report: issue [#37](https://github.com/KleilsonSantos/aios-companion/issues/37) (parked)

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
