import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSession,
  respondLocal,
  respondWithProvider,
} from './manager.ts'
import type { AiosMcpSession } from '../aios/mcp-client.ts'

describe('ConversationManager', () => {
  it('cria sessão com system turn', () => {
    const s = createSession({ summary: '1 workspace · healthy' })
    assert.equal(s.turns[0]?.role, 'system')
    assert.match(s.turns[0]!.content, /Estado operacional/)
  })

  it('responde a status local a partir do system prompt', () => {
    const s = createSession({ summary: 'demo ok' })
    const a = respondLocal(s, 'qual o status?')
    assert.equal(a.role, 'assistant')
    assert.equal(a.via, 'local')
    assert.match(a.content, /Estado operacional|demo ok/)
  })

  it('respondWithProvider usa MCP e marca via provider', async () => {
    const s = createSession({ summary: 'ctx' })
    const fake = {
      providerChat: async () => ({ content: 'olá do provider' }),
    } as unknown as AiosMcpSession
    const a = await respondWithProvider(s, 'oi', fake)
    assert.equal(a.via, 'provider')
    assert.equal(a.content, 'olá do provider')
  })

  it('respondWithProvider faz fallback local se MCP falhar', async () => {
    const s = createSession({ summary: 'ctx demo' })
    const fake = {
      providerChat: async () => {
        throw new Error('provider down')
      },
    } as unknown as AiosMcpSession
    const a = await respondWithProvider(s, 'ajuda', fake)
    assert.equal(a.via, 'local')
    assert.match(a.content, /provider|status|Voz/i)
  })
})
