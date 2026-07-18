/**
 * Pure helpers for the Companion surface API (#79).
 */
import type { ChatTurn, ConversationSession } from '../conversation/manager.ts'
import type { GovernanceStatusResult } from '../aios/mcp-client.ts'
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
  }
  turns: SurfaceTurn[]
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
  error?: string
}): SurfaceSnapshot {
  const op = options.operational
  const gov = options.governance
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
