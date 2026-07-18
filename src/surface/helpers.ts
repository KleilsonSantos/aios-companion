/**
 * Pure helpers for the Companion surface API (#79 / #82).
 */
import type { ChatTurn, ConversationSession } from '../conversation/manager.ts'
import type {
  GovernanceStatusResult,
  MemoryRecallResult,
} from '../aios/mcp-client.ts'
import type { OperationalStateLite } from '../aios/cli-bridge.ts'

export type SurfaceAttention = {
  id?: string
  severity?: string
  title?: string
  detail?: string
}

export type SurfaceTurn = {
  role: 'user' | 'assistant'
  content: string
  at: string
  via?: ChatTurn['via']
}

export type SurfaceMemoryEntry = {
  id?: string
  content?: string
  tags?: string[]
  at?: string
}

export type SurfaceSnapshot = {
  ok: boolean
  service: 'companion-surface'
  conversationId: string
  operational: {
    summary: string
    branch?: string
    generatedAt?: string
  }
  governance: {
    summary: string
    hasErrors: boolean
    providerOk?: boolean
    providers?: string[]
    attention: SurfaceAttention[]
    providerChat?: GovernanceStatusResult['providerChat']
    consumption?: { tone: 'ok' | 'bad' | ''; label: string }
  }
  memory: {
    workspaceId: string
    summary: string
    entries: SurfaceMemoryEntry[]
  }
  turns: SurfaceTurn[]
}

/** Format provider.chat metrics for the surface state line (#82). */
export function formatConsumptionChip(
  providerChat?: GovernanceStatusResult['providerChat'] | null,
): { tone: 'ok' | 'bad' | ''; label: string } {
  if (!providerChat) {
    return { tone: '', label: 'no chat yet' }
  }
  const tone = providerChat.errorCount > 0 ? 'bad' : 'ok'
  return {
    tone,
    label: `${providerChat.count} chat · ~${providerChat.totalTokens} tok${
      providerChat.errorCount ? ` · ${providerChat.errorCount} err` : ''
    }`,
  }
}

export function defaultWorkspaceId(): string {
  return process.env.AIOS_WORKSPACE || 'aios'
}

/** Visible chat turns for the UI (system stays server-side). */
export function publicTurns(session: ConversationSession): SurfaceTurn[] {
  return session.turns
    .filter((t): t is ChatTurn & { role: 'user' | 'assistant' } =>
      t.role === 'user' || t.role === 'assistant',
    )
    .map((t) => ({
      role: t.role,
      content: t.content,
      at: t.at,
      ...(t.via ? { via: t.via } : {}),
    }))
}

export function buildSurfaceSnapshot(options: {
  session: ConversationSession
  operational?: OperationalStateLite | null
  governance?: GovernanceStatusResult | null
  memory?: MemoryRecallResult | null
  workspaceId?: string
  error?: string
}): SurfaceSnapshot {
  const op = options.operational
  const gov = options.governance
  const ws = options.workspaceId || options.memory?.workspaceId || defaultWorkspaceId()
  const mem = options.memory
  return {
    ok: !options.error,
    service: 'companion-surface',
    conversationId: options.session.id,
    operational: {
      summary: op?.summary || options.error || 'Operational state unavailable',
      ...(op?.git?.branch ? { branch: op.git.branch } : {}),
      ...(op?.generatedAt ? { generatedAt: op.generatedAt } : {}),
    },
    governance: {
      summary: gov?.summary || (options.error ? options.error : 'Not loaded yet'),
      hasErrors: Boolean(gov?.hasErrors),
      ...(gov?.providerOk !== undefined ? { providerOk: gov.providerOk } : {}),
      ...(gov?.providers ? { providers: gov.providers } : {}),
      attention: gov?.attention ?? [],
      ...(gov?.providerChat ? { providerChat: gov.providerChat } : {}),
      consumption: formatConsumptionChip(gov?.providerChat),
    },
    memory: {
      workspaceId: ws,
      summary: mem?.summary || `memory ${ws}: not loaded`,
      entries: (mem?.entries || []).slice(0, 5).map((e) => ({
        ...(e.id ? { id: e.id } : {}),
        ...(e.content ? { content: e.content } : {}),
        ...(e.tags ? { tags: e.tags } : {}),
        ...(e.at ? { at: e.at } : {}),
      })),
    },
    turns: publicTurns(options.session),
  }
}

export function parseChatBody(body: unknown): {
  message: string
  localOnly: boolean
} | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'JSON body required' }
  }
  const obj = body as { message?: unknown; local?: unknown }
  if (typeof obj.message !== 'string' || !obj.message.trim()) {
    return { error: 'body.message required (non-empty string)' }
  }
  return {
    message: obj.message.trim(),
    localOnly: obj.local === true,
  }
}

export type MemoryChatCommand =
  | { kind: 'recall'; workspaceId: string }
  | { kind: 'remember'; workspaceId: string; content: string }
  | { kind: 'clear-blocked' }

/**
 * Parse `/memory` chat shortcuts (Resource-Aware; clear stays CLI-only).
 * - `/memory` · `/memory <ws>` → recall
 * - `/memory remember <note>` · `/memory add <note>` → remember (default ws)
 * - `/memory remember @<ws> <note>` → remember into workspace
 */
export function parseMemoryChatCommand(message: string): MemoryChatCommand | null {
  const trimmed = message.trim()
  if (trimmed !== '/memory' && !trimmed.startsWith('/memory ')) return null
  const rest = trimmed.slice('/memory'.length).trim()
  if (!rest) {
    return { kind: 'recall', workspaceId: defaultWorkspaceId() }
  }
  if (rest === 'clear' || rest.startsWith('clear ')) {
    return { kind: 'clear-blocked' }
  }
  if (rest.startsWith('remember ') || rest.startsWith('add ')) {
    const body = rest.replace(/^(remember|add)\s+/, '').trim()
    if (!body) {
      return { kind: 'recall', workspaceId: defaultWorkspaceId() }
    }
    const parts = body.split(/\s+/)
    const head = parts[0]!
    if (head.startsWith('@') && head.length > 1 && parts.length >= 2) {
      return {
        kind: 'remember',
        workspaceId: head.slice(1),
        content: parts.slice(1).join(' '),
      }
    }
    return {
      kind: 'remember',
      workspaceId: defaultWorkspaceId(),
      content: body,
    }
  }
  // `/memory <workspaceId>`
  if (/^[a-zA-Z][\w.-]*$/.test(rest) && !rest.includes(' ')) {
    return { kind: 'recall', workspaceId: rest }
  }
  return { kind: 'recall', workspaceId: defaultWorkspaceId() }
}

export function parseWorkspaceBody(body: unknown):
  | { workspaceId: string }
  | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'JSON body required' }
  }
  const obj = body as { workspaceId?: unknown }
  if (typeof obj.workspaceId !== 'string' || !obj.workspaceId.trim()) {
    return { error: 'body.workspaceId required (non-empty string)' }
  }
  return { workspaceId: obj.workspaceId.trim() }
}

export function parseMemoryBody(body: unknown): {
  action: 'recall' | 'remember'
  workspaceId: string
  content?: string
} | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'JSON body required' }
  }
  const obj = body as {
    action?: unknown
    workspaceId?: unknown
    content?: unknown
  }
  const action = obj.action === 'remember' ? 'remember' : obj.action === 'recall' ? 'recall' : null
  if (!action) {
    return { error: 'body.action must be recall|remember' }
  }
  const workspaceId =
    typeof obj.workspaceId === 'string' && obj.workspaceId.trim()
      ? obj.workspaceId.trim()
      : defaultWorkspaceId()
  if (action === 'remember') {
    if (typeof obj.content !== 'string' || !obj.content.trim()) {
      return { error: 'body.content required for remember' }
    }
    return { action, workspaceId, content: obj.content.trim() }
  }
  return { action, workspaceId }
}
