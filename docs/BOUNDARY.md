# Boundary — Companion ↔ AIOS

## Produto

| Repo | Papel |
| --- | --- |
| `ai-operating-system` | Control plane (governança) |
| `aios-companion` (este) | Experiência / Conversation Manager |

## Contratos estáveis (consumir)

1. MCP `@aios/mcp` — tools `aios_*` (`aios_contract_version`, `aios_operational_state`, `aios_governance_*`, `aios_governance_audit`, `aios_audit_docs`, `aios_memory_*`, `aios_load_policies`, `aios_provider_health`, `aios_provider_models`, `aios_provider_chat`, `aios_run_pipeline`, `aios_run_across_workspaces`, `aios_compile_prompt`, `aios_list_workspaces`, `aios_workspace_*`, `aios_build_knowledge`, …)
2. CLI `aios` — `--operational-state`, `--governance-status`, …
3. Pipeline — via MCP `aios_run_pipeline` / `companion run` (não importar `engines/*`)
4. Doctor — `companion doctor` (handshake contrato + state/gov)

## Anti-padrões

- Segundo Policy Engine aqui
- Polling de CPU/RAM “para parecer vivo”
- Embutir AIOS como submodule/pasta de código interno
- Voz no MVP sem CM de chat estável

## Surface UI (v0.6+)

- Companion may expose a **local web surface** (`companion surface` / `pnpm surface`) that consumes the same MCP/CLI contracts.
- It may show consumption + memory **read/write via MCP** — never a second Memory Engine.
- Conversation may persist **locally** (file under `~/.aios-companion/`); not a multi-user store.
- It must not become a second control plane or a clone of the AIOS console.
- Refresh / recall are **on-demand** (Resource-Aware). Destructive clear stays CLI (`--yes`).

## Evolution

Chat → Conversation Manager → minimal surface UI → voice → capabilities/watchers (Resource-Aware).

Cinematic UX vision (Jarvis / Minority Report) — **parked**: [`VISION-UX-CINEMATIC.md`](./VISION-UX-CINEMATIC.md) · [#37](https://github.com/KleilsonSantos/aios-companion/issues/37).
