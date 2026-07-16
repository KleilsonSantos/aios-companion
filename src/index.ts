/**
 * aios-companion CLI — experiência sobre o control plane AIOS (#90).
 */
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {
  fetchOperationalState,
  resolveAiosHome,
} from './aios/cli-bridge.ts'
import { createSession, respond } from './conversation/manager.ts'

function usage(): void {
  console.log(`aios-companion — Conversation Manager (ADR-0014)

Uso:
  companion status [--json]
  companion chat

Env:
  AIOS_HOME   path do monorepo ai-operating-system
`)
}

async function cmdStatus(jsonOnly: boolean): Promise<void> {
  const home = resolveAiosHome()
  const state = fetchOperationalState({ aiosHome: home })
  if (jsonOnly) {
    console.log(JSON.stringify(state, null, 2))
    return
  }
  console.log(`AIOS_HOME: ${home}`)
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

async function cmdChat(): Promise<void> {
  let state
  try {
    state = fetchOperationalState()
  } catch (err) {
    console.error(
      'Aviso: não foi possível obter operational state:',
      err instanceof Error ? err.message : err,
    )
  }
  const session = createSession(state)
  console.log(`session ${session.id}`)
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
  if (!cmd || cmd === '-h' || cmd === '--help') {
    usage()
    return
  }
  if (cmd === 'status') {
    await cmdStatus(argv.includes('--json'))
    return
  }
  if (cmd === 'chat') {
    await cmdChat()
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
