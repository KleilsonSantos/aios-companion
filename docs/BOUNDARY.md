# Boundary — Companion ↔ AIOS

## Produto

| Repo | Papel |
| --- | --- |
| `ai-operating-system` | Control plane (governança) |
| `aios-companion` (este) | Experiência / Conversation Manager |

## Contratos estáveis (consumir)

1. MCP `@aios/mcp` — tools `aios_*` (prioridade: `aios_operational_state`)
2. CLI `aios` — `--operational-state`, `--governance-status`, …
3. `@aios/pipeline` — `contractVersion` / `runPipeline` (quando empacotado para consumo externo)

## Anti-padrões

- Segundo Policy Engine aqui
- Polling de CPU/RAM “para parecer vivo”
- Embutir AIOS como submodule/pasta de código interno
- Voz no MVP sem CM de chat estável

## Evolução

Chat → Conversation Manager maduro → voz → capabilities/watchers (Resource-Aware).
