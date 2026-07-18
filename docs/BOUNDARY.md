# Boundary — Companion ↔ AIOS

## Product

| Repo | Role |
| --- | --- |
| `ai-operating-system` | Control plane (governance) |
| `aios-companion` (this) | Experience / Conversation Manager |

## Stable contracts (consume)

1. MCP `@aios/mcp` — tools `aios_*` (…); transport **stdio** by default, or **Streamable HTTP** when `AIOS_MCP_URL` is set (AIOS ADR-0022)
2. CLI `aios` — `--operational-state`, `--governance-status`, …
3. Pipeline — via MCP `aios_run_pipeline` / `companion run` (do not import `engines/*`)
4. Doctor — `companion doctor` (contract handshake + state/gov)

## Anti-patterns

- A second Policy Engine here
- Polling CPU/RAM “to look alive”
- Embedding AIOS as a submodule / internal code folder
- Voice in MVP without a stable chat Conversation Manager

## Surface UI (v0.6+)

- Companion may expose a **local web surface** (`companion surface` / `pnpm surface`) that consumes the same MCP/CLI contracts.
- It may show consumption + memory **read/write via MCP** — never a second Memory Engine.
- Conversation may persist **locally** (file under `~/.aios-companion/`); not a multi-user store.
- Chat may use **SSE progressive reveal** of completed replies (`/api/chat/stream`); true token streaming stays an AIOS concern.
- Workspace selection may call `aios_list_workspaces` **on demand** — no polling loop.
- It must not become a second control plane or a clone of the AIOS console.
- Refresh / recall are **on-demand** (Resource-Aware). Destructive clear stays CLI (`--yes`).

## Evolution

Chat → Conversation Manager → minimal surface UI → voice → capabilities/watchers (Resource-Aware).

Cinematic UX vision (Jarvis / Minority Report) — **parked**: [`VISION-UX-CINEMATIC.md`](./VISION-UX-CINEMATIC.md) · [#37](https://github.com/KleilsonSantos/aios-companion/issues/37).
