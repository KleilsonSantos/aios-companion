import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createSession, respond } from './manager.ts'

describe('ConversationManager', () => {
  it('cria sessão com system turn', () => {
    const s = createSession({ summary: '1 workspace · healthy' })
    assert.equal(s.turns[0]?.role, 'system')
    assert.match(s.turns[0]!.content, /Estado operacional/)
  })

  it('responde a status a partir do system prompt', () => {
    const s = createSession({ summary: 'demo ok' })
    const a = respond(s, 'qual o status?')
    assert.equal(a.role, 'assistant')
    assert.match(a.content, /Estado operacional|demo ok/)
  })
})
