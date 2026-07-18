import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSession } from '../conversation/manager.ts'
import {
  buildSurfaceSnapshot,
  parseChatBody,
  publicTurns,
} from './helpers.ts'

describe('surface helpers', () => {
  it('publicTurns omits system messages', () => {
    const session = createSession({ summary: 'healthy' })
    session.turns.push({
      role: 'user',
      content: 'hi',
      at: '2026-01-01T00:00:00.000Z',
    })
    session.turns.push({
      role: 'assistant',
      content: 'hello',
      at: '2026-01-01T00:00:01.000Z',
      via: 'local',
    })
    const turns = publicTurns(session)
    assert.equal(turns.length, 2)
    assert.equal(turns[0]?.role, 'user')
    assert.equal(turns[1]?.via, 'local')
  })

  it('buildSurfaceSnapshot maps attention + ops', () => {
    const session = createSession({ summary: '1 workspace' })
    const snap = buildSurfaceSnapshot({
      session,
      operational: {
        summary: '1 workspace · healthy',
        git: { branch: 'sandbox' },
        generatedAt: '2026-07-17T12:00:00.000Z',
      },
      governance: {
        summary: 'ok',
        hasErrors: false,
        attention: [{ id: 'a1', severity: 'warn', title: 'Drift' }],
        providerOk: true,
        providers: ['ollama'],
        raw: {},
      },
    })
    assert.equal(snap.service, 'companion-surface')
    assert.equal(snap.operational.branch, 'sandbox')
    assert.equal(snap.governance.attention.length, 1)
    assert.equal(snap.ok, true)
  })

  it('parseChatBody validates message', () => {
    assert.deepEqual(parseChatBody({ message: '  hello  ', local: true }), {
      message: 'hello',
      localOnly: true,
    })
    assert.equal('error' in parseChatBody({}), true)
    assert.equal('error' in parseChatBody(null), true)
  })
})
