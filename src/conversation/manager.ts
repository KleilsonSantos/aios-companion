/**
 * Conversation Manager — chat turns (no voice in MVP).
 * Injects Operational State summary; replies prefer AIOS provider (MCP).
 * Analysis intents → core via aios_run_pipeline (do not improvise in chat).
 */
import type { OperationalStateLite } from '../aios/cli-bridge.ts'
import type { AiosMcpSession } from '../aios/mcp-client.ts'
import {
  chatCopy,
  resolveLocale,
  type CompanionLocale,
} from './locale.ts'

export type PipelineTrace = {
  intent?: string
  ran: string[]
  skipped: string[]
  passed: boolean
}

export type ChatTurn = {
  role: 'system' | 'user' | 'assistant'
  content: string
  at: string
  via?: 'local' | 'provider' | 'pipeline'
  /** Present when via=pipeline — real aios_run_pipeline workflow (#118). */
  pipeline?: PipelineTrace
}

export type ConversationSession = {
  id: string
  createdAt: string
  turns: ChatTurn[]
  locale: CompanionLocale
}

function now(): string {
  return new Date().toISOString()
}

export function createSession(
  state?: OperationalStateLite,
  options: { locale?: CompanionLocale } = {},
): ConversationSession {
  const locale = options.locale ?? resolveLocale()
  const copy = chatCopy(locale)
  const summary =
    state?.summary ||
    (locale === 'pt'
      ? 'AIOS control plane disponível — peça status ou descreva a tarefa.'
      : 'AIOS control plane available — ask for status or describe the task.')
  const branch = state?.git?.branch ? ` (git: ${state.git.branch})` : ''
  const system: ChatTurn = {
    role: 'system',
    content: copy.system(summary, branch),
    at: now(),
  }
  return {
    id: `c_${Date.now().toString(36)}`,
    createdAt: now(),
    turns: [system],
    locale,
  }
}

function systemPrompt(session: ConversationSession): string {
  return session.turns.find((t) => t.role === 'system')?.content || ''
}

function copyFor(session: ConversationSession) {
  return chatCopy(session.locale)
}

/**
 * Detect intent that must go to the core (pipeline), not the chat LLM.
 * Light heuristic — Resource-Aware, no external NLU.
 */
export function isPipelineIntent(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t || t.startsWith('/')) return false
  if (/\b(analisa|analise|analyze|analys[ei])\b/.test(t)) return true
  if (
    /\b(inspeciona|inspect)\b/.test(t) &&
    /\b(projeto|project|repo|código|codigo)\b/.test(t)
  ) {
    return true
  }
  if (
    /\breview\b/.test(t) &&
    /\b(project|projeto|architecture|arquitetura|codebase)\b/.test(t)
  ) {
    return true
  }
  return false
}

/** Deterministic reply (offline / provider down) — Resource-Aware. */
export function respondLocal(
  session: ConversationSession,
  userText: string,
): ChatTurn {
  const copy = copyFor(session)
  const content = userText.trim() || copy.empty
  session.turns.push({ role: 'user', content, at: now() })

  const lower = content.toLowerCase()
  let reply: string
  if (isPipelineIntent(content)) {
    reply = copy.pipelineHint
  } else if (lower.includes('status') || lower.includes('estado')) {
    reply =
      systemPrompt(session)
        .split('\n')
        .find((l) => l.startsWith(copy.operationalPrefix)) || copy.noSnapshot
  } else if (lower.includes('ajuda') || lower === 'help') {
    reply = copy.help
  } else if (lower.includes('github') || /\bprs?\b/.test(lower)) {
    reply = copy.github
  } else if (/\bgit\b/.test(lower) || lower.includes('branch')) {
    reply = copy.git
  } else {
    reply = copy.localFallback(content.slice(0, 200))
  }

  const assistant: ChatTurn = {
    role: 'assistant',
    content: reply,
    at: now(),
    via: 'local',
  }
  session.turns.push(assistant)
  return assistant
}

/** @deprecated use respondLocal */
export const respond = respondLocal

/**
 * AIOS core — analysis intent via aios_run_pipeline.
 */
export async function respondWithPipeline(
  session: ConversationSession,
  userText: string,
  mcp: AiosMcpSession,
  options: { repoPath?: string; workspaceId?: string } = {},
): Promise<ChatTurn> {
  const copy = copyFor(session)
  const content = userText.trim() || copy.empty
  session.turns.push({ role: 'user', content, at: now() })

  try {
    const out = await mcp.runPipeline({
      input: content,
      repoPath: options.repoPath,
      workspaceId: options.workspaceId,
    })
    const assistant: ChatTurn = {
      role: 'assistant',
      content: out.summary,
      at: now(),
      via: 'pipeline',
      pipeline: {
        ...(out.intent?.type ? { intent: out.intent.type } : {}),
        ran: [...(out.workflow?.ran || [])],
        skipped: [...(out.workflow?.skipped || [])],
        passed: out.passed,
      },
    }
    session.turns.push(assistant)
    return assistant
  } catch (err) {
    session.turns.pop()
    const msg = err instanceof Error ? err.message : String(err)
    session.turns.push({ role: 'user', content, at: now() })
    const assistant: ChatTurn = {
      role: 'assistant',
      content: copy.pipelineFailed(msg),
      at: now(),
      via: 'local',
    }
    session.turns.push(assistant)
    return assistant
  }
}

/**
 * Reply via AIOS `aios_provider_chat` (MCP). Local fallback on failure.
 */
export async function respondWithProvider(
  session: ConversationSession,
  userText: string,
  mcp: AiosMcpSession,
): Promise<ChatTurn> {
  const copy = copyFor(session)
  const content = userText.trim() || copy.empty
  session.turns.push({ role: 'user', content, at: now() })

  try {
    const out = await mcp.providerChat({
      message: content,
      system: systemPrompt(session),
    })
    const assistant: ChatTurn = {
      role: 'assistant',
      content: out.content || copy.empty,
      at: now(),
      via: 'provider',
    }
    session.turns.push(assistant)
    return assistant
  } catch {
    // remove user turn — respondLocal will re-push
    session.turns.pop()
    return respondLocal(session, content)
  }
}
