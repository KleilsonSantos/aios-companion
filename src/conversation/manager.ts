/**
 * Conversation Manager — turns de chat (sem voz no MVP).
 * Injeta resumo do Operational State; replies preferem provider AIOS (MCP).
 */
import type { OperationalStateLite } from '../aios/cli-bridge.ts'
import type { AiosMcpSession } from '../aios/mcp-client.ts'

export type ChatTurn = {
  role: 'system' | 'user' | 'assistant'
  content: string
  at: string
  via?: 'local' | 'provider'
}

export type ConversationSession = {
  id: string
  createdAt: string
  turns: ChatTurn[]
}

function now(): string {
  return new Date().toISOString()
}

export function createSession(state?: OperationalStateLite): ConversationSession {
  const summary =
    state?.summary ||
    'AIOS control plane disponível — peça status ou descreva a tarefa.'
  const branch = state?.git?.branch ? ` (git: ${state.git.branch})` : ''
  const system: ChatTurn = {
    role: 'system',
    content: [
      'És o Companion do AIOS (experiência). O AIOS governa; tu conversas.',
      'Não inventes policies — sugere consultar o control plane.',
      `Estado operacional: ${summary}${branch}`,
      'Voz e controlo de IDE/Docker estão fora de escopo neste MVP.',
      'Capabilities: `companion caps` (git / github via CLI on-demand).',
      'Respostas curtas e práticas em português.',
    ].join('\n'),
    at: now(),
  }
  return {
    id: `c_${Date.now().toString(36)}`,
    createdAt: now(),
    turns: [system],
  }
}

function systemPrompt(session: ConversationSession): string {
  return session.turns.find((t) => t.role === 'system')?.content || ''
}

/** Resposta determinística (offline / provider down) — Resource-Aware. */
export function respondLocal(
  session: ConversationSession,
  userText: string,
): ChatTurn {
  const content = userText.trim() || '(vazio)'
  session.turns.push({ role: 'user', content, at: now() })

  const lower = content.toLowerCase()
  let reply: string
  if (lower.includes('status') || lower.includes('estado')) {
    reply =
      systemPrompt(session)
        .split('\n')
        .find((l) => l.startsWith('Estado operacional:')) ||
      'Sem snapshot — corre `companion status`.'
  } else if (lower.includes('ajuda') || lower === 'help') {
    reply =
      'Comandos: "status"; `companion status`; `companion caps git|github`; chat usa provider AIOS se disponível. Voz ainda não.'
  } else if (lower.includes('github') || /\bprs?\b/.test(lower)) {
    reply =
      'GitHub: corre `companion caps github` (usa `gh` se autenticado). Não duplico APIs no Companion.'
  } else if (/\bgit\b/.test(lower) || lower.includes('branch')) {
    reply =
      'Git: corre `companion caps git` (CLI ou snapshot AIOS). Sem watchers neste MVP.'
  } else {
    reply = [
      `Registei: “${content.slice(0, 200)}”.`,
      'Provider AIOS indisponível — resposta local.',
      'Valida no control plane: `companion status` / console Try it.',
    ].join(' ')
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
 * Reply via AIOS `aios_provider_chat` (MCP). Fallback local se falhar.
 */
export async function respondWithProvider(
  session: ConversationSession,
  userText: string,
  mcp: AiosMcpSession,
): Promise<ChatTurn> {
  const content = userText.trim() || '(vazio)'
  session.turns.push({ role: 'user', content, at: now() })

  try {
    const out = await mcp.providerChat({
      message: content,
      system: systemPrompt(session),
    })
    const assistant: ChatTurn = {
      role: 'assistant',
      content: out.content || '(vazio)',
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
