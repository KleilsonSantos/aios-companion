import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSession,
  isPipelineIntent,
  respondLocal,
  respondWithPipeline,
  respondWithProvider,
} from './manager.ts'
import type { AiosMcpSession } from '../aios/mcp-client.ts'
import { resolveLocale } from './locale.ts'

describe('ConversationManager', () => {
  it('creates session with English system turn by default', () => {
    const s = createSession({ summary: '1 workspace · healthy' }, { locale: 'en' })
    assert.equal(s.locale, 'en')
    assert.equal(s.turns[0]?.role, 'system')
    assert.match(s.turns[0]!.content, /Operational state:/)
    assert.match(s.turns[0]!.content, /in English/)
  })

  it('creates Portuguese system turn when locale=pt', () => {
    const s = createSession({ summary: '1 workspace · healthy' }, { locale: 'pt' })
    assert.equal(s.locale, 'pt')
    assert.match(s.turns[0]!.content, /Estado operacional:/)
    assert.match(s.turns[0]!.content, /português/)
  })

  it('responds to status locally from the system prompt', () => {
    const s = createSession({ summary: 'demo ok' }, { locale: 'en' })
    const a = respondLocal(s, 'what is the status?')
    assert.equal(a.role, 'assistant')
    assert.equal(a.via, 'local')
    assert.match(a.content, /Operational state:|demo ok/)
  })

  it('isPipelineIntent detects analysis', () => {
    assert.equal(isPipelineIntent('Analisa meu projeto'), true)
    assert.equal(isPipelineIntent('analyze the project'), true)
    assert.equal(isPipelineIntent('inspeciona o repo'), true)
    assert.equal(isPipelineIntent('olá'), false)
    assert.equal(isPipelineIntent('/run algo'), false)
  })

  it('respondWithPipeline marks via pipeline', async () => {
    const s = createSession({ summary: 'ctx' }, { locale: 'en' })
    const fake = {
      runPipeline: async () => ({
        summary: 'pipeline OK · intent=analyze.project',
        passed: true,
        intent: { type: 'analyze.project' },
        workflow: {
          ran: ['architecture', 'docs'],
          skipped: ['appsec'],
        },
      }),
    } as unknown as AiosMcpSession
    const a = await respondWithPipeline(s, 'Analisa meu projeto', fake)
    assert.equal(a.via, 'pipeline')
    assert.match(a.content, /pipeline OK/)
    assert.deepEqual(a.pipeline, {
      intent: 'analyze.project',
      ran: ['architecture', 'docs'],
      skipped: ['appsec'],
      passed: true,
    })
  })

  it('respondLocal on pipeline intent without MCP points to run', () => {
    const s = createSession({ summary: 'ctx' }, { locale: 'en' })
    const a = respondLocal(s, 'Analisa o projeto')
    assert.equal(a.via, 'local')
    assert.match(a.content, /pipeline|companion run|\/run/i)
  })

  it('respondWithProvider uses MCP and marks via provider', async () => {
    const s = createSession({ summary: 'ctx' }, { locale: 'en' })
    const fake = {
      providerChat: async () => ({ content: 'hello from provider' }),
    } as unknown as AiosMcpSession
    const a = await respondWithProvider(s, 'hi', fake)
    assert.equal(a.via, 'provider')
    assert.equal(a.content, 'hello from provider')
  })

  it('respondWithProvider falls back locally if MCP fails', async () => {
    const s = createSession({ summary: 'ctx demo' }, { locale: 'en' })
    const fake = {
      providerChat: async () => {
        throw new Error('provider down')
      },
    } as unknown as AiosMcpSession
    const a = await respondWithProvider(s, 'help', fake)
    assert.equal(a.via, 'local')
    assert.match(a.content, /pipeline|status|caps|Voice/i)
  })

  it('resolveLocale defaults to en; pt variants map to pt', () => {
    assert.equal(resolveLocale(undefined), 'en')
    assert.equal(resolveLocale(''), 'en')
    assert.equal(resolveLocale('en'), 'en')
    assert.equal(resolveLocale('pt'), 'pt')
    assert.equal(resolveLocale('pt-BR'), 'pt')
    assert.equal(resolveLocale('PT-pt'), 'pt')
  })
})
