/**
 * Cliente MCP → AIOS control plane (stdio on-demand / sessão de chat).
 * Consome tools aios_* — não duplica engines (ADR-0014).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  resolveAiosHome,
  type OperationalStateLite,
} from './cli-bridge.ts'

function mcpEntry(aiosHome: string): string {
  return join(aiosHome, 'apps', 'mcp', 'src', 'index.ts')
}

function toolText(result: {
  content?: Array<{ type: string; text?: string }>
  isError?: boolean
}): string {
  const text = result.content
    ?.filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n')
    .trim()
  if (!text) throw new Error('MCP tool: resposta vazia')
  if (result.isError) throw new Error(text)
  return text
}

/** Extrai texto MCP sem falhar em isError (pipeline pode falhar no quality gate). */
function toolTextAllowError(result: {
  content?: Array<{ type: string; text?: string }>
  isError?: boolean
}): { text: string; isError: boolean } {
  const text = result.content
    ?.filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n')
    .trim()
  if (!text) throw new Error('MCP tool: resposta vazia')
  return { text, isError: Boolean(result.isError) }
}

export type ProviderChatResult = {
  content: string
  raw?: unknown
}

export type PipelineRunResult = {
  contractVersion?: number
  intent?: { type?: string; raw?: string }
  workflow?: { ran?: string[]; skipped?: string[] }
  verdict?: { passed?: boolean; checks?: unknown }
  summary: string
  passed: boolean
  raw: unknown
}

export type GovernanceStatusResult = {
  summary: string
  hasErrors: boolean
  attention: Array<{ id?: string; severity?: string; title?: string; detail?: string }>
  workspaces?: number
  policies?: number
  providerOk?: boolean
  raw: unknown
}

export type MemoryRecallResult = {
  workspaceId: string
  count: number
  summary: string
  entries: Array<{ content?: string; tags?: string[]; at?: string; id?: string }>
  raw: unknown
}

export type MemoryRememberResult = {
  ok: boolean
  summary: string
  raw: unknown
}

export type GovernanceRecordResult = {
  ok: boolean
  summary: string
  raw: unknown
}

export type DocsAuditResult = {
  ok: boolean
  summary: string
  missing: string[]
  findings: Array<{ severity?: string; title?: string; path?: string }>
  raw: unknown
}

export type CompilePromptResult = {
  brief: string
  intent?: string
  workspaceId?: string
  repoPath?: string
  stats?: Record<string, unknown>
  summary: string
  raw: unknown
}

/** Versão de contrato que o Companion espera do AIOS (`PIPELINE_CONTRACT_VERSION`). */
export const EXPECTED_CONTRACT_VERSION = '1'

export type ContractVersionResult = {
  ok: boolean
  expected: string
  actual?: string
  summary: string
  raw?: unknown
}

/** Sessão MCP reutilizável (Resource-Aware: um processo por chat, fecha no fim). */
export class AiosMcpSession {
  private client: Client | null = null
  private aiosHome: string

  constructor(aiosHome?: string) {
    this.aiosHome = aiosHome || resolveAiosHome()
  }

  async connect(): Promise<void> {
    if (this.client) return
    const entry = mcpEntry(this.aiosHome)
    if (!existsSync(entry)) {
      throw new Error(`MCP AIOS não encontrado: ${entry}`)
    }
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--experimental-strip-types', entry],
      cwd: this.aiosHome,
      // Banner MCP vai para stderr (inherit) — silenciar no Companion (#34).
      stderr: 'ignore',
      env: {
        ...process.env,
        AIOS_HOME: this.aiosHome,
        AIOS_MCP_QUIET: '1',
      } as Record<string, string>,
    })
    const client = new Client({
      name: 'aios-companion',
      version: '0.1.0',
    })
    await client.connect(transport)
    this.client = client
  }

  private requireClient(): Client {
    if (!this.client) throw new Error('MCP session não ligada — chama connect()')
    return this.client
  }

  async operationalState(
    options: { workspaceId?: string } = {},
  ): Promise<OperationalStateLite> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_operational_state',
      arguments: {
        homePath: this.aiosHome,
        ...(options.workspaceId
          ? { workspaceId: options.workspaceId }
          : {}),
      },
    })
    const text = toolText(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    return JSON.parse(text) as OperationalStateLite
  }

  /**
   * Chat auxiliar via AIOS provider (Ollama por defeito).
   * Resource-Aware: falha se provider offline — caller faz fallback local.
   */
  async providerChat(options: {
    message: string
    system?: string
    provider?: string
    model?: string
  }): Promise<ProviderChatResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_provider_chat',
      arguments: {
        message: options.message,
        ...(options.system ? { system: options.system } : {}),
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.model ? { model: options.model } : {}),
      },
    })
    const text = toolText(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    let raw: unknown = text
    try {
      raw = JSON.parse(text)
    } catch {
      return { content: text }
    }
    const obj = raw as {
      message?: { content?: string }
      content?: string
      text?: string
    }
    const content =
      obj.message?.content || obj.content || obj.text || text
    return { content: String(content).trim() || text, raw }
  }

  /**
   * Núcleo AIOS via MCP — intent → policies → agents → quality gate.
   * Quality gate fail devolve JSON (não throw) — caller decide exit code.
   */
  async runPipeline(options: {
    input: string
    repoPath?: string
    workspaceId?: string
    scope?: string
    policiesPath?: string
  }): Promise<PipelineRunResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_run_pipeline',
      arguments: {
        input: options.input,
        ...(options.repoPath ? { repoPath: options.repoPath } : {}),
        ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
        ...(options.scope ? { scope: options.scope } : {}),
        ...(options.policiesPath ? { policiesPath: options.policiesPath } : {}),
      },
    })
    const { text, isError } = toolTextAllowError(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      if (isError) throw new Error(text)
      throw new Error(`Pipeline: JSON inválido — ${text.slice(0, 200)}`)
    }
    const obj = raw as {
      contractVersion?: number
      intent?: { type?: string; raw?: string }
      workflow?: { ran?: string[]; skipped?: string[] }
      verdict?: { passed?: boolean; checks?: unknown }
    }
    const passed = obj.verdict?.passed === true
    const ran = obj.workflow?.ran?.join(', ') || '—'
    const intentType = obj.intent?.type || '?'
    const summary = passed
      ? `pipeline OK · intent=${intentType} · agents=${ran}`
      : `pipeline FAIL · intent=${intentType} · agents=${ran} (quality gate)`
    return {
      contractVersion: obj.contractVersion,
      intent: obj.intent,
      workflow: obj.workflow,
      verdict: obj.verdict,
      summary,
      passed,
      raw,
    }
  }

  /**
   * Health + attention do control plane (consola AIOS via MCP).
   * Attention error → hasErrors; JSON ainda devolvido.
   */
  async governanceStatus(options: { provider?: string } = {}): Promise<GovernanceStatusResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_governance_status',
      arguments: {
        homePath: this.aiosHome,
        ...(options.provider ? { provider: options.provider } : {}),
      },
    })
    const { text, isError } = toolTextAllowError(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      if (isError) throw new Error(text)
      throw new Error(`Governance: JSON inválido — ${text.slice(0, 200)}`)
    }
    const obj = raw as {
      workspaces?: unknown[]
      policies?: { count?: number }
      provider?: { ok?: boolean; provider?: string }
      attention?: Array<{
        id?: string
        severity?: string
        title?: string
        detail?: string
      }>
    }
    const attention = obj.attention || []
    const errors = attention.filter((a) => a.severity === 'error')
    const warns = attention.filter((a) => a.severity === 'warn')
    const ws = obj.workspaces?.length ?? 0
    const pol = obj.policies?.count ?? 0
    const providerOk = obj.provider?.ok
    const summary = [
      `gov · workspaces=${ws} · policies=${pol}`,
      providerOk === undefined ? null : `provider=${providerOk ? 'ok' : 'down'}`,
      `attention: ${errors.length} error(s), ${warns.length} warn(s)`,
    ]
      .filter(Boolean)
      .join(' · ')
    return {
      summary,
      hasErrors: errors.length > 0 || isError,
      attention,
      workspaces: ws,
      policies: pol,
      providerOk,
      raw,
    }
  }

  async memoryRecall(options: {
    workspaceId: string
    limit?: number
    query?: string
    tag?: string
  }): Promise<MemoryRecallResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_memory_recall',
      arguments: {
        workspaceId: options.workspaceId,
        ...(options.limit != null ? { limit: options.limit } : {}),
        ...(options.query ? { query: options.query } : {}),
        ...(options.tag ? { tag: options.tag } : {}),
      },
    })
    const text = toolText(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    const raw = JSON.parse(text) as {
      workspaceId?: string
      entries?: Array<{ content?: string; tags?: string[]; at?: string; id?: string }>
      count?: number
    }
    const entries = raw.entries || []
    const count = raw.count ?? entries.length
    return {
      workspaceId: raw.workspaceId || options.workspaceId,
      count,
      summary:
        count === 0
          ? `memory ${options.workspaceId}: vazio`
          : `memory ${options.workspaceId}: ${count} entrada(s)`,
      entries,
      raw,
    }
  }

  async memoryRemember(options: {
    workspaceId: string
    content: string
    tags?: string[]
  }): Promise<MemoryRememberResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_memory_remember',
      arguments: {
        workspaceId: options.workspaceId,
        content: options.content,
        ...(options.tags?.length ? { tags: options.tags } : {}),
      },
    })
    const text = toolText(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    const raw = JSON.parse(text) as { ok?: boolean; entry?: { id?: string } }
    return {
      ok: raw.ok !== false,
      summary: `remembered · ${options.workspaceId}${raw.entry?.id ? ` · ${raw.entry.id}` : ''}`,
      raw,
    }
  }

  /** Append decision to AIOS governance log (não duplica engine). */
  async governanceRecord(options: {
    summary: string
    kind?: string
    verdict?: 'pass' | 'fail' | 'info'
    policyIds?: string[]
  }): Promise<GovernanceRecordResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_governance_record',
      arguments: {
        summary: options.summary,
        homePath: this.aiosHome,
        ...(options.kind ? { kind: options.kind } : {}),
        ...(options.verdict ? { verdict: options.verdict } : {}),
        ...(options.policyIds?.length ? { policyIds: options.policyIds } : {}),
      },
    })
    const text = toolText(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    const raw = JSON.parse(text) as {
      ok?: boolean
      entry?: { id?: string; kind?: string; verdict?: string }
    }
    const id = raw.entry?.id ? ` · ${raw.entry.id}` : ''
    const kind = raw.entry?.kind ? ` · ${raw.entry.kind}` : ''
    return {
      ok: raw.ok !== false,
      summary: `decision recorded${id}${kind}`,
      raw,
    }
  }

  /**
   * Audit heurístico de docs canónicos no control plane (Documentation Engine).
   * isError no MCP quando audit.ok=false — ainda devolvemos JSON.
   */
  async auditDocs(options: {
    repoPath?: string
    workspaceId?: string
  } = {}): Promise<DocsAuditResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_audit_docs',
      arguments: {
        ...(options.repoPath ? { repoPath: options.repoPath } : {}),
        ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
      },
    })
    const { text, isError } = toolTextAllowError(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      if (isError) throw new Error(text)
      throw new Error(`Audit docs: JSON inválido — ${text.slice(0, 200)}`)
    }
    const obj = raw as {
      ok?: boolean
      missing?: string[]
      present?: string[]
      findings?: Array<{ severity?: string; title?: string; path?: string }>
      repoPath?: string
    }
    const missing = obj.missing || []
    const findings = obj.findings || []
    const ok = obj.ok === true
    const summary = ok
      ? `docs audit OK · present=${obj.present?.length ?? '?'} · missing=0`
      : `docs audit FAIL · missing=${missing.length} · findings=${findings.length}`
    return { ok, summary, missing, findings, raw }
  }

  async contractVersion(): Promise<ContractVersionResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_contract_version',
      arguments: {},
    })
    const text = toolText(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    const raw = JSON.parse(text) as { contractVersion?: string | number }
    const actual = String(raw.contractVersion ?? '')
    const ok = actual === EXPECTED_CONTRACT_VERSION
    return {
      ok,
      expected: EXPECTED_CONTRACT_VERSION,
      actual,
      summary: ok
        ? `contract v${actual} OK`
        : `contract MISMATCH · companion espera ${EXPECTED_CONTRACT_VERSION} · AIOS=${actual || '?'}`,
      raw,
    }
  }

  /**
   * Prompt Engine via MCP — intent curto → brief governado (policies + memory + KG).
   * Não duplica o engine (#59 / Companion #43).
   */
  async compilePrompt(options: {
    input: string
    workspaceId?: string
    repoPath?: string
    memoryLimit?: number
  }): Promise<CompilePromptResult> {
    const client = this.requireClient()
    const result = await client.callTool({
      name: 'aios_compile_prompt',
      arguments: {
        input: options.input,
        ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
        ...(options.repoPath ? { repoPath: options.repoPath } : {}),
        ...(options.memoryLimit != null ? { memoryLimit: options.memoryLimit } : {}),
      },
    })
    const text = toolText(
      result as { content?: Array<{ type: string; text?: string }>; isError?: boolean },
    )
    const raw = JSON.parse(text) as {
      brief?: string
      intent?: string
      workspaceId?: string
      repoPath?: string
      stats?: Record<string, unknown>
    }
    const brief = raw.brief || text
    const chars = typeof brief === 'string' ? brief.length : 0
    const statsBits = raw.stats
      ? Object.entries(raw.stats)
          .slice(0, 4)
          .map(([k, v]) => `${k}=${v}`)
          .join(' · ')
      : ''
    return {
      brief,
      intent: raw.intent,
      workspaceId: raw.workspaceId,
      repoPath: raw.repoPath,
      stats: raw.stats,
      summary: [
        `brief · ${chars} chars`,
        raw.intent ? `intent=${raw.intent}` : null,
        statsBits || null,
      ]
        .filter(Boolean)
        .join(' · '),
      raw,
    }
  }

  async close(): Promise<void> {
    if (!this.client) return
    await this.client.close().catch(() => undefined)
    this.client = null
  }
}

/**
 * Snapshot one-shot via MCP (sobe e desce o processo).
 */
export async function fetchOperationalStateMcp(
  options: { aiosHome?: string; workspaceId?: string } = {},
): Promise<OperationalStateLite> {
  const session = new AiosMcpSession(options.aiosHome)
  try {
    await session.connect()
    return await session.operationalState({
      workspaceId: options.workspaceId,
    })
  } finally {
    await session.close()
  }
}

/** One-shot pipeline via MCP. */
export async function runPipelineMcp(
  options: {
    input: string
    aiosHome?: string
    repoPath?: string
    workspaceId?: string
    scope?: string
    policiesPath?: string
  },
): Promise<PipelineRunResult> {
  const session = new AiosMcpSession(options.aiosHome)
  try {
    await session.connect()
    return await session.runPipeline(options)
  } finally {
    await session.close()
  }
}

/** One-shot governance status via MCP. */
export async function fetchGovernanceStatusMcp(
  options: { aiosHome?: string; provider?: string } = {},
): Promise<GovernanceStatusResult> {
  const session = new AiosMcpSession(options.aiosHome)
  try {
    await session.connect()
    return await session.governanceStatus({ provider: options.provider })
  } finally {
    await session.close()
  }
}

export async function memoryRecallMcp(
  options: {
    workspaceId: string
    aiosHome?: string
    limit?: number
    query?: string
    tag?: string
  },
): Promise<MemoryRecallResult> {
  const session = new AiosMcpSession(options.aiosHome)
  try {
    await session.connect()
    return await session.memoryRecall(options)
  } finally {
    await session.close()
  }
}

export async function memoryRememberMcp(
  options: {
    workspaceId: string
    content: string
    aiosHome?: string
    tags?: string[]
  },
): Promise<MemoryRememberResult> {
  const session = new AiosMcpSession(options.aiosHome)
  try {
    await session.connect()
    return await session.memoryRemember(options)
  } finally {
    await session.close()
  }
}

export async function governanceRecordMcp(
  options: {
    summary: string
    aiosHome?: string
    kind?: string
    verdict?: 'pass' | 'fail' | 'info'
    policyIds?: string[]
  },
): Promise<GovernanceRecordResult> {
  const session = new AiosMcpSession(options.aiosHome)
  try {
    await session.connect()
    return await session.governanceRecord(options)
  } finally {
    await session.close()
  }
}

export async function auditDocsMcp(
  options: {
    aiosHome?: string
    repoPath?: string
    workspaceId?: string
  } = {},
): Promise<DocsAuditResult> {
  const session = new AiosMcpSession(options.aiosHome)
  try {
    await session.connect()
    return await session.auditDocs({
      repoPath: options.repoPath,
      workspaceId: options.workspaceId,
    })
  } finally {
    await session.close()
  }
}

/** One-shot Prompt Engine via MCP. */
export async function compilePromptMcp(
  options: {
    input: string
    aiosHome?: string
    workspaceId?: string
    repoPath?: string
    memoryLimit?: number
  },
): Promise<CompilePromptResult> {
  const session = new AiosMcpSession(options.aiosHome)
  try {
    await session.connect()
    return await session.compilePrompt(options)
  } finally {
    await session.close()
  }
}
