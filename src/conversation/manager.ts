/**
 * Conversation Manager — turns de chat (sem voz no MVP).
 * Injeta resumo do Operational State do AIOS como contexto de sistema.
 */
import type { OperationalStateLite } from '../aios/cli-bridge.ts'

export type ChatTurn = {
  role: 'system' | 'user' | 'assistant'
  content: string
  at: string
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
    ].join('\n'),
    at: now(),
  }
  return {
    id: `c_${Date.now().toString(36)}`,
    createdAt: now(),
    turns: [system],
  }
}

/**
 * Resposta determinística MVP (sem LLM local obrigatório).
 * Um integrador pode trocar por provider via AIOS mais tarde.
 */
export function respond(session: ConversationSession, userText: string): ChatTurn {
  const content = userText.trim() || '(vazio)'
  session.turns.push({ role: 'user', content, at: now() })

  const lower = content.toLowerCase()
  let reply: string
  if (lower.includes('status') || lower.includes('estado')) {
    const sys = session.turns.find((t) => t.role === 'system')
    reply =
      sys?.content.split('\n').find((l) => l.startsWith('Estado operacional:')) ||
      'Sem snapshot — corre `companion status`.'
  } else if (lower.includes('ajuda') || lower === 'help') {
    reply =
      'Comandos úteis: falar do projeto; perguntar "status"; `companion status` no terminal. Voz ainda não.'
  } else {
    reply = [
      `Registei: “${content.slice(0, 200)}”.`,
      'Próximo passo sugerido: validar no AIOS (`aios --operational-state` / console Try it).',
      'Não executo policies aqui — sou a camada de diálogo.',
    ].join(' ')
  }

  const assistant: ChatTurn = { role: 'assistant', content: reply, at: now() }
  session.turns.push(assistant)
  return assistant
}
