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
import {
  AiosMcpSession,
  auditDocsMcp,
  compilePromptMcp,
  fetchGovernanceStatusMcp,
  fetchOperationalStateMcp,
  governanceRecordMcp,
  listWorkspacesMcp,
  memoryRecallMcp,
  memoryRememberMcp,
  runPipelineMcp,
  workspaceRemoveMcp,
  workspaceUpsertMcp,
  workspaceValidateMcp,
} from './aios/mcp-client.ts'
import { runDoctor } from './aios/doctor.ts'
import {
  createSession,
  isPipelineIntent,
  respondLocal,
  respondWithPipeline,
  respondWithProvider,
} from './conversation/manager.ts'
import {
  probeAll,
  snapshotCapability,
  type CapabilityId,
} from './capabilities/index.ts'

function usage(): void {
  console.log(`aios-companion — Conversation Manager (ADR-0014)

Uso:
  companion status [--json] [--mcp|--cli]
  companion doctor [--json]
  companion chat [--mcp|--cli] [--local]
  companion caps [git|github] [--json]
  companion run "<intent>" [--json] [--repo path] [--workspace id] [--scope path]
  companion gov [--json] [--provider id]
  companion decide "<resumo>" [--kind note] [--verdict info|pass|fail] [--json]
  companion audit [--json] [--repo path] [--workspace id]
  companion memory recall [workspace] [--json] [--limit n] [--query q] [--tag t]
  companion memory remember [workspace] "<nota>" [--tag t] [--json]
  companion brief "<intent>" [--json] [--repo path] [--workspace id] [--limit n]
  companion workspaces [list] [--json]
  companion workspaces add <id> <path> [--name n] [--tag t] [--default] [--json]
  companion workspaces remove <id> [--json]
  companion workspaces validate [id] [--json]

  --mcp     forçar MCP stdio
  --cli     forçar CLI AIOS (só status / estado inicial)
  --local   chat só com respostas determinísticas (sem Ollama)

  Doctor: check-up da ponte (AIOS_HOME + MCP + contract + state/gov).
  Chat (default): MCP session + aios_provider_chat; análise → pipeline; fallback local.
  Caps: adapters Git/GitHub on-demand (CLI existentes; sem watchers).
  Run: núcleo AIOS via aios_run_pipeline (on-demand; também auto no chat).
  Gov: aios_governance_status (health + attention).
  Decide: aios_governance_record (log de decisões).
  Audit: aios_audit_docs (inventário/drift de docs canónicos).
  Memory: aios_memory_recall / aios_memory_remember (default workspace: aios).
  Brief: aios_compile_prompt (intent → brief governado; alias: compile).
  Workspaces: aios_list_workspaces / aios_workspace_* (alias: ws).

Env:
  AIOS_HOME        path do monorepo ai-operating-system
  AIOS_WORKSPACE   default workspace id (memory/run/brief)
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

async function cmdDoctor(argv: string[]): Promise<void> {
  const jsonOnly = argv.includes('--json')
  const report = await runDoctor()
  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(report.summary)
    if (report.aiosHome) console.log(`AIOS_HOME: ${report.aiosHome}`)
    for (const c of report.checks) {
      console.log(`  ${c.ok ? 'ok' : 'FAIL'}  ${c.id.padEnd(18)} ${c.detail}`)
    }
  }
  if (!report.ok) process.exitCode = 1
}

async function cmdCaps(argv: string[]): Promise<void> {
  const jsonOnly = argv.includes('--json')
  const idArg = argv.find((a) => a === 'git' || a === 'github') as
    | CapabilityId
    | undefined
  let operationalGit: OperationalStateLite['git'] | undefined
  try {
    // CLI only — evita subir MCP só para atalho git (Resource-Aware).
    operationalGit = fetchOperationalState().git
  } catch {
    // caps funcionam sem AIOS — só perdem atalho git via state
  }
  const ctx = {
    cwd: process.cwd(),
    operationalGit,
  }

  if (!idArg) {
    const probes = probeAll(ctx)
    if (jsonOnly) {
      console.log(JSON.stringify(probes, null, 2))
      return
    }
    console.log('Capabilities (probe):')
    for (const p of probes) {
      console.log(
        `  ${p.id.padEnd(8)} ${p.available ? 'ok' : 'n/a'}${p.reason ? ` — ${p.reason}` : ''}`,
      )
    }
    console.log('\nUso: companion caps git|github [--json]')
    return
  }

  const snap = await snapshotCapability(idArg, ctx)
  if (jsonOnly) {
    console.log(JSON.stringify(snap, null, 2))
    return
  }
  console.log(`${snap.id}: ${snap.ok ? 'ok' : 'fail'}`)
  console.log(snap.summary)
  if (snap.data && typeof snap.data === 'object') {
    console.log(JSON.stringify(snap.data, null, 2))
  }
}

async function cmdRun(argv: string[]): Promise<void> {
  const jsonOnly = argv.includes('--json')
  const flagVal = (name: string): string | undefined => {
    const i = argv.indexOf(name)
    if (i < 0) return undefined
    return argv[i + 1]
  }
  const input = argv.find(
    (a, i) =>
      !a.startsWith('-') &&
      (i === 0 || !['--repo', '--workspace', '--scope', '--policies'].includes(argv[i - 1]!)),
  )
  if (!input) {
    console.error('Uso: companion run "<intent>" [--json] [--repo path] [--workspace id]')
    process.exitCode = 1
    return
  }

  const home = resolveAiosHome()
  const out = await runPipelineMcp({
    input,
    aiosHome: home,
    repoPath: flagVal('--repo'),
    workspaceId: flagVal('--workspace'),
    scope: flagVal('--scope'),
    policiesPath: flagVal('--policies'),
  })

  if (jsonOnly) {
    console.log(JSON.stringify(out.raw, null, 2))
  } else {
    console.log(out.summary)
    if (out.workflow?.ran?.length) {
      console.log(`ran:     ${out.workflow.ran.join(', ')}`)
    }
    if (out.workflow?.skipped?.length) {
      console.log(`skipped: ${out.workflow.skipped.join(', ')}`)
    }
    console.log(`verdict: ${out.passed ? 'passed' : 'failed'}`)
  }
  if (!out.passed) process.exitCode = 1
}

async function cmdGov(argv: string[]): Promise<void> {
  const jsonOnly = argv.includes('--json')
  const i = argv.indexOf('--provider')
  const provider = i >= 0 ? argv[i + 1] : undefined
  const home = resolveAiosHome()
  const out = await fetchGovernanceStatusMcp({ aiosHome: home, provider })
  if (jsonOnly) {
    console.log(JSON.stringify(out.raw, null, 2))
  } else {
    console.log(out.summary)
    const top = out.attention.slice(0, 8)
    for (const a of top) {
      console.log(
        `  [${a.severity || '?'}] ${a.title || a.id || '?'}${a.detail ? ` — ${a.detail}` : ''}`,
      )
    }
    if (out.attention.length > top.length) {
      console.log(`  … +${out.attention.length - top.length} mais`)
    }
  }
  if (out.hasErrors) process.exitCode = 1
}

async function cmdDecide(argv: string[]): Promise<void> {
  const jsonOnly = argv.includes('--json')
  const flagVal = (name: string): string | undefined => {
    const i = argv.indexOf(name)
    if (i < 0) return undefined
    return argv[i + 1]
  }
  const flagNames = new Set(['--kind', '--verdict', '--json', '--policy'])
  const summaryParts = argv.filter((a, i) => {
    if (a.startsWith('-')) return false
    if (i > 0 && flagNames.has(argv[i - 1]!)) return false
    return true
  })
  const summary = summaryParts.join(' ').trim()
  if (!summary) {
    console.error(
      'Uso: companion decide "<resumo>" [--kind note] [--verdict info|pass|fail]',
    )
    process.exitCode = 1
    return
  }
  const verdictRaw = flagVal('--verdict')
  const verdict =
    verdictRaw === 'pass' || verdictRaw === 'fail' || verdictRaw === 'info'
      ? verdictRaw
      : undefined
  const policy = flagVal('--policy')
  const home = resolveAiosHome()
  const out = await governanceRecordMcp({
    aiosHome: home,
    summary,
    kind: flagVal('--kind'),
    verdict,
    policyIds: policy ? [policy] : undefined,
  })
  if (jsonOnly) {
    console.log(JSON.stringify(out.raw, null, 2))
    return
  }
  console.log(out.summary)
  if (!out.ok) process.exitCode = 1
}

async function cmdAudit(argv: string[]): Promise<void> {
  const jsonOnly = argv.includes('--json')
  const flagVal = (name: string): string | undefined => {
    const i = argv.indexOf(name)
    if (i < 0) return undefined
    return argv[i + 1]
  }
  const home = resolveAiosHome()
  const out = await auditDocsMcp({
    aiosHome: home,
    repoPath: flagVal('--repo') || home,
    workspaceId: flagVal('--workspace'),
  })
  if (jsonOnly) {
    console.log(JSON.stringify(out.raw, null, 2))
    return
  }
  console.log(out.summary)
  for (const f of out.findings.slice(0, 12)) {
    if (f.severity === 'info') continue
    console.log(`  [${f.severity || '?'}] ${f.title || f.path || '?'}`)
  }
  if (out.missing.length) {
    console.log(`missing: ${out.missing.slice(0, 8).join(', ')}`)
  }
  if (!out.ok) process.exitCode = 1
}

async function cmdMemory(argv: string[]): Promise<void> {
  const sub = argv[0]
  const rest = argv.slice(1)
  const jsonOnly = rest.includes('--json') || argv.includes('--json')
  const flagVal = (name: string, from: string[]): string | undefined => {
    const i = from.indexOf(name)
    if (i < 0) return undefined
    return from[i + 1]
  }
  const home = resolveAiosHome()

  if (sub === 'recall' || sub === 'list' || !sub) {
    const args = sub ? rest : argv
    const flagNames = new Set(['--limit', '--query', '--tag', '--json'])
    const ws =
      args.find((a, i) => {
        if (a.startsWith('-')) return false
        if (a === 'recall' || a === 'list') return false
        if (i > 0 && flagNames.has(args[i - 1]!)) return false
        return true
      }) ||
      process.env.AIOS_WORKSPACE ||
      'aios'
    const limitRaw = flagVal('--limit', args)
    const out = await memoryRecallMcp({
      aiosHome: home,
      workspaceId: ws,
      limit: limitRaw ? Number(limitRaw) : undefined,
      query: flagVal('--query', args),
      tag: flagVal('--tag', args),
    })
    if (jsonOnly) {
      console.log(JSON.stringify(out.raw, null, 2))
      return
    }
    console.log(out.summary)
    for (const e of out.entries.slice(0, 20)) {
      const tags = e.tags?.length ? ` [${e.tags.join(', ')}]` : ''
      console.log(`  - ${(e.content || '').slice(0, 160)}${tags}`)
    }
    return
  }

  if (sub === 'remember' || sub === 'add') {
    const nonFlags = rest.filter(
      (a, i) =>
        !a.startsWith('-') &&
        (i === 0 || !['--tag', '--limit', '--query'].includes(rest[i - 1]!)),
    )
    let workspaceId = process.env.AIOS_WORKSPACE || 'aios'
    let content: string | undefined
    if (nonFlags.length >= 2) {
      workspaceId = nonFlags[0]!
      content = nonFlags.slice(1).join(' ')
    } else if (nonFlags.length === 1) {
      content = nonFlags[0]
    }
    if (!content?.trim()) {
      console.error(
        'Uso: companion memory remember [workspace] "<nota>" [--tag t]',
      )
      process.exitCode = 1
      return
    }
    const tag = flagVal('--tag', rest)
    const out = await memoryRememberMcp({
      aiosHome: home,
      workspaceId,
      content: content.trim(),
      tags: tag ? [tag] : undefined,
    })
    if (jsonOnly) {
      console.log(JSON.stringify(out.raw, null, 2))
      return
    }
    console.log(out.summary)
    if (!out.ok) process.exitCode = 1
    return
  }

  console.error('Uso: companion memory recall|remember …')
  process.exitCode = 1
}

async function cmdBrief(argv: string[]): Promise<void> {
  const jsonOnly = argv.includes('--json')
  const flagVal = (name: string): string | undefined => {
    const i = argv.indexOf(name)
    if (i < 0) return undefined
    return argv[i + 1]
  }
  const flagNames = new Set([
    '--repo',
    '--workspace',
    '--limit',
    '--json',
  ])
  const input = argv
    .filter((a, i) => {
      if (a.startsWith('-')) return false
      if (i > 0 && flagNames.has(argv[i - 1]!)) return false
      return true
    })
    .join(' ')
    .trim()
  if (!input) {
    console.error(
      'Uso: companion brief "<intent>" [--json] [--repo path] [--workspace id] [--limit n]',
    )
    process.exitCode = 1
    return
  }
  const limitRaw = flagVal('--limit')
  const home = resolveAiosHome()
  const out = await compilePromptMcp({
    input,
    aiosHome: home,
    repoPath: flagVal('--repo'),
    workspaceId: flagVal('--workspace') || process.env.AIOS_WORKSPACE,
    memoryLimit: limitRaw ? Number(limitRaw) : undefined,
  })
  if (jsonOnly) {
    console.log(JSON.stringify(out.raw, null, 2))
    return
  }
  console.log(out.summary)
  console.log('')
  console.log(out.brief)
}

async function cmdWorkspaces(argv: string[]): Promise<void> {
  const jsonOnly = argv.includes('--json')
  const flagVal = (name: string, from: string[]): string | undefined => {
    const i = from.indexOf(name)
    if (i < 0) return undefined
    return from[i + 1]
  }
  const home = resolveAiosHome()
  const sub = argv[0]
  const rest = argv.slice(1)

  const isList =
    !sub ||
    sub === 'list' ||
    sub === 'ls' ||
    sub.startsWith('-')

  if (isList) {
    const args = sub && !sub.startsWith('-') ? rest : argv
    const out = await listWorkspacesMcp({
      aiosHome: home,
      workspacesPath: flagVal('--path', args),
    })
    if (jsonOnly) {
      console.log(JSON.stringify(out.raw, null, 2))
      return
    }
    console.log(out.summary)
    for (const w of out.workspaces) {
      const mark = w.default ? ' *' : ''
      const tags = w.tags?.length ? ` [${w.tags.join(', ')}]` : ''
      console.log(
        `  ${w.id || '?'}${mark}  ${w.repoPath || w.path || '?'}${tags}`,
      )
    }
    return
  }

  if (sub === 'add' || sub === 'upsert' || sub === 'register') {
    const nonFlags = rest.filter(
      (a, i) =>
        !a.startsWith('-') &&
        (i === 0 || !['--name', '--tag', '--path'].includes(rest[i - 1]!)),
    )
    const id = nonFlags[0]
    const path = nonFlags[1]
    if (!id || !path) {
      console.error(
        'Uso: companion workspaces add <id> <path> [--name n] [--tag t] [--default]',
      )
      process.exitCode = 1
      return
    }
    const tags = rest.includes('--tag')
      ? rest.filter((a, i) => i > 0 && rest[i - 1] === '--tag' && !a.startsWith('-'))
      : undefined
    const out = await workspaceUpsertMcp({
      aiosHome: home,
      id,
      path,
      name: flagVal('--name', rest),
      tags: tags?.length ? tags : undefined,
      makeDefault: rest.includes('--default'),
    })
    if (jsonOnly) {
      console.log(JSON.stringify(out.raw, null, 2))
      return
    }
    console.log(out.summary)
    return
  }

  if (sub === 'remove' || sub === 'rm' || sub === 'delete') {
    const id = rest.find((a) => !a.startsWith('-'))
    if (!id) {
      console.error('Uso: companion workspaces remove <id>')
      process.exitCode = 1
      return
    }
    const out = await workspaceRemoveMcp({ aiosHome: home, id })
    if (jsonOnly) {
      console.log(JSON.stringify(out.raw, null, 2))
      return
    }
    console.log(out.summary)
    if (!out.removed) process.exitCode = 1
    return
  }

  if (sub === 'validate' || sub === 'check') {
    const id = rest.find((a) => !a.startsWith('-'))
    const out = await workspaceValidateMcp({ aiosHome: home, id })
    if (jsonOnly) {
      console.log(JSON.stringify(out.raw, null, 2))
      return
    }
    console.log(out.summary)
    for (const w of out.workspaces) {
      const sig = w.signals?.length ? ` (${w.signals.join(', ')})` : ''
      console.log(
        `  [${w.ok === false ? 'fail' : 'ok'}] ${w.id || '?'}${sig}`,
      )
    }
    if (!out.ok) process.exitCode = 1
    return
  }

  console.error(
    'Uso: companion workspaces [list|add|remove|validate] …',
  )
  process.exitCode = 1
}

async function cmdChat(
  transport: Transport,
  localOnly: boolean,
): Promise<void> {
  const home = resolveAiosHome()
  let state: OperationalStateLite | undefined
  let via: string | undefined
  let mcp: AiosMcpSession | undefined

  if (!localOnly && transport !== 'cli') {
    mcp = new AiosMcpSession(home)
    try {
      await mcp.connect()
      state = await mcp.operationalState()
      via = 'mcp'
    } catch (err) {
      await mcp.close().catch(() => undefined)
      mcp = undefined
      console.error(
        'Aviso: MCP indisponível —',
        err instanceof Error ? err.message : err,
      )
    }
  }

  if (!state) {
    try {
      const loaded = await loadState(
        transport === 'mcp' ? 'cli' : transport,
        home,
      )
      state = loaded.state
      via = loaded.via
    } catch (err) {
      console.error(
        'Aviso: não foi possível obter operational state:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  const session = createSession(state)
  const mode =
    localOnly || !mcp
      ? 'local (análise tenta MCP on-demand)'
      : 'provider + auto-pipeline (análise → aios_run_pipeline)'
  console.log(`session ${session.id}${via ? ` · state via ${via}` : ''}`)
  console.log(`replies: ${mode}`)
  console.log('(Ctrl+C /quit · análise auto-pipeline · /run · /brief · /workspaces · /gov · /decide · /audit · /memory)\n')
  if (state?.summary) console.log(`[contexto] ${state.summary}\n`)

  const rl = createInterface({ input, output })
  try {
    for (;;) {
      const line = await rl.question('you> ')
      if (!line.trim()) continue
      if (line.trim() === '/quit' || line.trim() === '/exit') break
      if (
        line.trim() === '/workspaces' ||
        line.trim() === '/ws' ||
        line.trim().startsWith('/workspaces ') ||
        line.trim().startsWith('/ws ')
      ) {
        try {
          const wsMcp = mcp ?? new AiosMcpSession(home)
          if (!mcp) await wsMcp.connect()
          const out = await wsMcp.listWorkspaces()
          console.log(`companion · workspaces> ${out.summary}`)
          for (const w of out.workspaces.slice(0, 12)) {
            const mark = w.default ? ' *' : ''
            console.log(`  ${w.id || '?'}${mark}  ${w.repoPath || w.path || '?'}`)
          }
          console.log('')
          if (!mcp) await wsMcp.close()
        } catch (err) {
          console.log(
            `companion · workspaces> falhou: ${err instanceof Error ? err.message : err}\n`,
          )
        }
        continue
      }
      if (line.trim().startsWith('/brief ') || line.trim().startsWith('/compile ')) {
        const prefix = line.trim().startsWith('/brief ') ? '/brief ' : '/compile '
        const intent = line.trim().slice(prefix.length).trim()
        if (!intent) {
          console.log('companion> Uso: /brief <intent curto>\n')
          continue
        }
        try {
          const briefMcp = mcp ?? new AiosMcpSession(home)
          if (!mcp) await briefMcp.connect()
          const out = await briefMcp.compilePrompt({
            input: intent,
            repoPath: process.cwd(),
            workspaceId: process.env.AIOS_WORKSPACE,
          })
          console.log(`companion · brief> ${out.summary}\n`)
          console.log(out.brief)
          console.log('')
          if (!mcp) await briefMcp.close()
        } catch (err) {
          console.log(
            `companion · brief> falhou: ${err instanceof Error ? err.message : err}\n`,
          )
        }
        continue
      }
      if (line.trim() === '/audit') {
        try {
          const audMcp = mcp ?? new AiosMcpSession(home)
          if (!mcp) await audMcp.connect()
          const out = await audMcp.auditDocs({ repoPath: home })
          console.log(`companion · audit> ${out.summary}`)
          for (const f of out.findings.filter((x) => x.severity !== 'info').slice(0, 5)) {
            console.log(`  [${f.severity}] ${f.title}`)
          }
          console.log('')
          if (!mcp) await audMcp.close()
        } catch (err) {
          console.log(
            `companion · audit> falhou: ${err instanceof Error ? err.message : err}\n`,
          )
        }
        continue
      }
      if (line.trim().startsWith('/decide ')) {
        const summary = line.trim().slice('/decide '.length).trim()
        if (!summary) {
          console.log('companion> Uso: /decide <resumo curto>\n')
          continue
        }
        try {
          const decMcp = mcp ?? new AiosMcpSession(home)
          if (!mcp) await decMcp.connect()
          const out = await decMcp.governanceRecord({
            summary,
            kind: 'note',
            verdict: 'info',
          })
          console.log(`companion · decide> ${out.summary}\n`)
          if (!mcp) await decMcp.close()
        } catch (err) {
          console.log(
            `companion · decide> falhou: ${err instanceof Error ? err.message : err}\n`,
          )
        }
        continue
      }
      if (line.trim() === '/memory' || line.trim().startsWith('/memory ')) {
        const ws =
          line.trim().slice('/memory'.length).trim() ||
          process.env.AIOS_WORKSPACE ||
          'aios'
        try {
          const memMcp = mcp ?? new AiosMcpSession(home)
          if (!mcp) await memMcp.connect()
          const out = await memMcp.memoryRecall({ workspaceId: ws, limit: 5 })
          console.log(`companion · memory> ${out.summary}`)
          for (const e of out.entries.slice(0, 5)) {
            console.log(`  - ${(e.content || '').slice(0, 120)}`)
          }
          console.log('')
          if (!mcp) await memMcp.close()
        } catch (err) {
          console.log(
            `companion · memory> falhou: ${err instanceof Error ? err.message : err}\n`,
          )
        }
        continue
      }
      if (line.trim() === '/gov' || line.trim() === '/governance') {
        try {
          const govMcp = mcp ?? new AiosMcpSession(home)
          if (!mcp) await govMcp.connect()
          const out = await govMcp.governanceStatus()
          console.log(`companion · gov> ${out.summary}`)
          for (const a of out.attention.slice(0, 5)) {
            console.log(`  [${a.severity || '?'}] ${a.title || a.id || '?'}`)
          }
          console.log('')
          if (!mcp) await govMcp.close()
        } catch (err) {
          console.log(
            `companion · gov> falhou: ${err instanceof Error ? err.message : err}\n`,
          )
        }
        continue
      }
      if (line.trim().startsWith('/run ')) {
        const intent = line.trim().slice(5).trim()
        if (!intent) {
          console.log('companion> Uso: /run <intent curto>\n')
          continue
        }
        try {
          const pipeMcp = mcp ?? new AiosMcpSession(home)
          if (!mcp) await pipeMcp.connect()
          const out = await pipeMcp.runPipeline({
            input: intent,
            repoPath: process.cwd(),
          })
          console.log(`companion · pipeline> ${out.summary}\n`)
          if (!mcp) await pipeMcp.close()
        } catch (err) {
          console.log(
            `companion · pipeline> falhou: ${err instanceof Error ? err.message : err}\n`,
          )
        }
        continue
      }
      if (isPipelineIntent(line)) {
        try {
          const pipeMcp = mcp ?? new AiosMcpSession(home)
          if (!mcp) await pipeMcp.connect()
          const turn = await respondWithPipeline(session, line, pipeMcp, {
            repoPath: process.cwd(),
          })
          console.log(`companion · pipeline> ${turn.content}\n`)
          if (!mcp) await pipeMcp.close()
        } catch (err) {
          console.log(
            `companion · pipeline> falhou: ${err instanceof Error ? err.message : err}\n`,
          )
        }
        continue
      }
      const turn =
        mcp && !localOnly
          ? await respondWithProvider(session, line, mcp)
          : respondLocal(session, line)
      const tag =
        turn.via === 'provider'
          ? ' · provider'
          : turn.via === 'pipeline'
            ? ' · pipeline'
            : ' · local'
      console.log(`companion${tag}> ${turn.content}\n`)
    }
  } finally {
    rl.close()
    await mcp?.close().catch(() => undefined)
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
  if (cmd === 'doctor' || cmd === 'checkup') {
    await cmdDoctor(argv.slice(1))
    return
  }
  if (cmd === 'chat') {
    await cmdChat(transport, argv.includes('--local'))
    return
  }
  if (cmd === 'caps' || cmd === 'capabilities') {
    await cmdCaps(argv.slice(1))
    return
  }
  if (cmd === 'run' || cmd === 'pipeline') {
    await cmdRun(argv.slice(1))
    return
  }
  if (cmd === 'gov' || cmd === 'governance') {
    await cmdGov(argv.slice(1))
    return
  }
  if (cmd === 'decide' || cmd === 'decision') {
    await cmdDecide(argv.slice(1))
    return
  }
  if (cmd === 'audit' || cmd === 'docs') {
    await cmdAudit(argv.slice(1))
    return
  }
  if (cmd === 'memory' || cmd === 'mem') {
    await cmdMemory(argv.slice(1))
    return
  }
  if (cmd === 'brief' || cmd === 'compile') {
    await cmdBrief(argv.slice(1))
    return
  }
  if (cmd === 'workspaces' || cmd === 'workspace' || cmd === 'ws') {
    await cmdWorkspaces(argv.slice(1))
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
