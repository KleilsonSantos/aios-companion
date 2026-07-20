# Cinematic UX vision — Companion (parked + spike)

> **Status:** parked · **Issue:** [#37](https://github.com/KleilsonSantos/aios-companion/issues/37)  
> **Spikes:** Signal rail (#106) · Attention field (#112) · Pipeline agent graph (#118) — presence panels tied to real MCP/chat signals. Does **not** fully unpark #37.  
> **Design mirror (implemented only):** [Figma — Companion first glance](https://www.figma.com/design/ZSv9VMBAFkEo908kQtBuwi) · tracking [#120](https://github.com/KleilsonSantos/aios-companion/issues/120)  
> Boundary: [ADR-0014](https://github.com/KleilsonSantos/ai-operating-system/blob/main/docs/adr/0014-control-plane-companion.md).

## In one sentence

The Companion may one day be the **command room** (Jarvis / Minority Report); AIOS remains the **brain that governs**.

## Intent references

| Reference | What to extract (not copy literally) |
| --- | --- |
| Jarvis (Iron Man) | Dialogue + visible system state; assistant that **operates** the experience |
| Minority Report | Surfaces / panels that open with a search or decision; gesture → information |

## Ideas to preserve

1. **Holograms / futuristic surfaces** — atmosphere, not generic dashboard chrome.
2. **Visible running processes** — flows / “algorithms” that change shape (**polymorphic**) in a way **coherent** with what is actually running.
3. **Interactive moving mind maps** — navigable relations (intent → agents → verdict, memory, gov).
4. **Contextual windows / panels** — open because of a run, an audit, a search — not random decoration.
5. **Hook to the control plane** — every visual effect ties to an AIOS event/contract (`pipeline`, `gov`, `memory`, `doctor`…). Animation without a signal = anti-pattern.

## What this is NOT (now)

- Replacing the AIOS governance console
- WebGL/Three.js / gestures / voice / aggressive watchers in this phase
- Duplicating Policy / Memory / Knowledge in Companion
- A “cinema demo” disconnected from MCP

## When to unpark (minimum criteria)

1. Stable Companion↔AIOS contracts (already in progress).
2. Spike: **one** visual panel tied to a real event (e.g. `companion run` → agent graph).
3. Declared Resource-Aware impact (CPU/GPU/battery on macOS).
4. Its own spike issue (not this vision alone).

## Relation to the current MVP

Today Companion is CLI + chat + caps + doctor + surface. Presence spikes so far: **Signal rail** (#106), **Attention field** (#112), **Pipeline agent graph** (#118) — all CSS-only and tied to real control-plane signals. A **Figma mirror** tracks shipped UI only ([#120](https://github.com/KleilsonSantos/aios-companion/issues/120)) — populate after releases, never invent cinema ahead of code. Full cinematic layer remains parked until more spikes meet the criteria above.
