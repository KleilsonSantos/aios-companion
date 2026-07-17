# Visão UX cinemática — Companion (parked)

> **Estado:** parked · **Issue:** [#37](https://github.com/KleilsonSantos/aios-companion/issues/37)  
> **Não implementar agora.** Fronteira: [ADR-0014](https://github.com/KleilsonSantos/ai-operating-system/blob/main/docs/adr/0014-control-plane-companion.md).

## Em uma frase

O Companion pode um dia ser a **sala de comando** (Jarvis / Minority Report); o AIOS continua o **cérebro que governa**.

## Referências de intenção

| Referência | O que extrair (não copiar literal) |
| --- | --- |
| Jarvis (Iron Man) | Diálogo + estado do sistema visível; assistente que **opera** a experiência |
| Minority Report | Superfícies / painéis que se abrem com uma procura ou decisão; gesto → informação |

## Ideias a preservar

1. **Ologramas / superfícies futuristas** — atmosfera, não chrome genérico de dashboard.
2. **Processos em execução visíveis** — fluxos / “algoritmos” que mudam de forma (**polimórficos**) de modo **coerente** com o que está a correr de verdade.
3. **Mapas mentais interativos em movimento** — relações (intent → agents → verdict, memory, gov) navegáveis.
4. **Janelas / painéis contextuais** — abrem porque houve uma execução (`run`), um audit, uma procura — não decoração aleatória.
5. **Gancho ao control plane** — cada efeito visual amarra a um evento/contrato AIOS (`pipeline`, `gov`, `memory`, `doctor`…). Animação sem sinal = anti-padrão.

## O que isto NÃO é (agora)

- Substituir o console de governança do AIOS
- WebGL/Three.js / gestos / voz / watchers agressivos nesta fase
- Duplicar Policy / Memory / Knowledge no Companion
- “Demo cinema” desligada do MCP

## Quando despark (critérios mínimos)

1. Contratos Companion↔AIOS estáveis (já em curso).
2. Spike: **um** painel visual ligado a um evento real (ex. `companion run` → grafo de agents).
3. Impacto Resource-Aware declarado (CPU/GPU/bateria no macOS).
4. Issue de spike própria (não esta vision sozinha).

## Relação com o MVP atual

Hoje o Companion é CLI + chat + caps + doctor. Esta visão é a **camada de presença** futura — documentada para não se perder entre chats.
