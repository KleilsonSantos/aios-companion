# Boundary — Companion ↔ AIOS

## Produto

| Repo | Papel |
| --- | --- |
| `ai-operating-system` | Control plane (governança) |
| `aios-companion` (este) | Experiência / Conversation Manager |

## Contratos estáveis (consumir)

1. MCP `@aios/mcp` — tools `aios_*` (`aios_contract_version`, `aios_operational_state`, `aios_governance_*`, `aios_audit_docs`, `aios_memory_*`, `aios_provider_chat`, `aios_run_pipeline`, `aios_compile_prompt`, `aios_list_workspaces`, `aios_workspace_*`, …)
2. CLI `aios` — `--operational-state`, `--governance-status`, …
3. Pipeline — via MCP `aios_run_pipeline` / `companion run` (não importar `engines/*`)
4. Doctor — `companion doctor` (handshake contrato + state/gov)

## Anti-padrões

- Segundo Policy Engine aqui
- Polling de CPU/RAM “para parecer vivo”
- Embutir AIOS como submodule/pasta de código interno
- Voz no MVP sem CM de chat estável

## Evolução

Chat → Conversation Manager maduro → voz → capabilities/watchers (Resource-Aware).

Visão UX cinemática (Jarvis / Minority Report) — **parked**: [`VISION-UX-CINEMATIC.md`](./VISION-UX-CINEMATIC.md) · [#37](https://github.com/KleilsonSantos/aios-companion/issues/37).
