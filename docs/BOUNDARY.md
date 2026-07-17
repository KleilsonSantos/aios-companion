# Boundary — Companion ↔ AIOS

## Produto

| Repo | Papel |
| --- | --- |
| `ai-operating-system` | Control plane (governança) |
| `aios-companion` (este) | Experiência / Conversation Manager |

## Contratos estáveis (consumir)

1. MCP `@aios/mcp` — tools `aios_*` (`aios_operational_state`, `aios_governance_status`, `aios_governance_record`, `aios_audit_docs`, `aios_memory_*`, `aios_provider_chat`, `aios_run_pipeline`, …)
2. CLI `aios` — `--operational-state`, `--governance-status`, …
3. Pipeline — via MCP `aios_run_pipeline` / `companion run` (não importar `engines/*`)

## Anti-padrões

- Segundo Policy Engine aqui
- Polling de CPU/RAM “para parecer vivo”
- Embutir AIOS como submodule/pasta de código interno
- Voz no MVP sem CM de chat estável

## Evolução

Chat → Conversation Manager maduro → voz → capabilities/watchers (Resource-Aware).
