/**
 * aios-companion CLI — experiência sobre o control plane AIOS (#90).
 */
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {
  fetchOperationalState,
  resolveAiosHome,
  type OperationalStateLite,
} from './aios/cli-bridge.ts'
import { fetchOperationalStateMcp } from './aios/mcp-client.ts'
import { createSession, respond } from './conversation/manager.ts'

function usage(): void {
  console.log(`aios-companion — Conversation Manager (ADR-0014)

Uso:
  companion status [--json] [--mcp|--cli]
  companion chat [--mcp|--cli]

  --mcp   forçar MCP stdio (aios_operational_state)
  --cli   forçar CLI AIOS (--operational-state)
  (default: tenta MCP, fallback CLI)

Env:
  AIOS_HOME   path do monorepo ai-operating-system
`)
}

type Transport = 'auto' | 'mcp' | 'cli'

function parseTransport(argv: string[]): Transport {
  if (argv.includes('--mcp')) return 'mcp'
  if (argv.includes('--cli')) return 'cli'
  return 'auto'
}

async function loadState(
  transport: Transport,
  home: string,
): Promise<{ state: OperationalStateLite; via: 'mcp' | 'cli' }> {
  if (transport === 'cli') {
    return { state: fetchOperationalState({ aiosHome: home }), via: 'cli' }
  }
  if (transport === 'mcp') {
    return {
      state: await fetchOperationalStateMcp({ aiosHome: home }),
      via: 'mcp',
    }
  }
  try {
    return {
      state: await fetchOperationalStateMcp({ aiosHome: home }),
      via: 'mcp',
    }
  } catch {
    return { state: fetchOperationalState({ aiosHome: home }), via: 'cli' }
  }
}

async function cmdStatus(
  jsonOnly: boolean,
  transport: Transport,
): Promise<void> {
  const home = resolveAiosHome()
  const { state, via } = await loadState(transport, home)
  if (jsonOnly) {
    console.log(JSON.stringify({ via, ...state }, null, 2))
    return
  }
  console.log(`AIOS_HOME: ${home}`)
  console.log(`via:       ${via}`)
  console.log(`summary:   ${state.summary || '(sem summary)'}`)
  console.log(`mode:      ${state.mode || '?'}`)
  console.log(
    `git:       ${state.git?.available ? `${state.git.branch}@${state.git.head}` : 'n/a'}`,
  )
  console.log(
    `health:    errors=${state.health?.errorCount ?? '?'} warns=${state.health?.warnCount ?? '?'}`,
  )
  console.log(
    `boundaries: voice=${state.boundaries?.voice} ide=${state.boundaries?.ideControl} docker=${state.boundaries?.dockerControl}`,
  )
}

async function cmdChat(transport: Transport): Promise<void> {
  let state: OperationalStateLite | undefined
  let via: string | undefined
  try {
    const home = resolveAiosHome()
    const loaded = await loadState(transport, home)
    state = loaded.state
    via = loaded.via
  } catch (err) {
    console.error(
      'Aviso: não foi possível obter operational state:',
      err instanceof Error ? err.message : err,
    )
  }
  const session = createSession(state)
  console.log(`session ${session.id}${via ? ` · via ${via}` : ''}`)
  console.log('(Ctrl+C ou /quit para sair · sem voz neste MVP)\n')
  if (state?.summary) console.log(`[contexto] ${state.summary}\n`)

  const rl = createInterface({ input, output })
  try {
    for (;;) {
      const line = await rl.question('you> ')
      if (!line.trim()) continue
      if (line.trim() === '/quit' || line.trim() === '/exit') break
      const turn = respond(session, line)
      console.log(`companion> ${turn.content}\n`)
    }
  } finally {
    rl.close()
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  const transport = parseTransport(argv)
  if (!cmd || cmd === '-h' || cmd === '--help') {
    usage()
    return
  }
  if (cmd === 'status') {
    await cmdStatus(argv.includes('--json'), transport)
    return
  }
  if (cmd === 'chat') {
    await cmdChat(transport)
    return
  }
  console.error(`Comando desconhecido: ${cmd}`)
  usage()
  process.exitCode = 1
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
