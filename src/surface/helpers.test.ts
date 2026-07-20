import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSession } from '../conversation/manager.ts'
import {
  buildSurfaceSnapshot,
  formatConsumptionChip,
  parseChatBody,
  parseLocaleBody,
  parseMemoryBody,
  parseMemoryChatCommand,
  parseWorkspaceBody,
  publicTurns,
  lastPipelineTrace,
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

  it('buildSurfaceSnapshot maps attention + ops + memory + consumption', () => {
    const session = createSession({ summary: '1 workspace' }, { locale: 'en' })
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
        providerChat: {
          count: 3,
          errorCount: 0,
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        raw: {},
      },
      memory: {
        workspaceId: 'aios',
        count: 1,
        summary: 'memory aios: 1 entrada(s)',
        entries: [{ content: 'note one', tags: ['t'] }],
        raw: {},
      },
    })
    assert.equal(snap.service, 'companion-surface')
    assert.equal(snap.locale, 'en')
    assert.equal(snap.operational.branch, 'sandbox')
    assert.equal(snap.governance.attention.length, 1)
    assert.equal(snap.governance.consumption?.label.includes('3 chat'), true)
    assert.equal(snap.memory.entries[0]?.content, 'note one')
    assert.equal(snap.ok, true)
    assert.equal(snap.lastPipeline, null)
    assert.equal(snap.lastDoctor, null)
  })

  it('lastPipelineTrace + publicTurns carry pipeline meta', () => {
    const session = createSession({ summary: 'healthy' }, { locale: 'en' })
    session.turns.push({
      role: 'user',
      content: 'analyze',
      at: '2026-01-01T00:00:00.000Z',
    })
    session.turns.push({
      role: 'assistant',
      content: 'pipeline OK',
      at: '2026-01-01T00:00:01.000Z',
      via: 'pipeline',
      pipeline: {
        intent: 'analyze.project',
        ran: ['architecture', 'qa'],
        skipped: ['docs'],
        passed: true,
      },
    })
    const turns = publicTurns(session)
    assert.equal(turns[1]?.pipeline?.ran.length, 2)
    assert.equal(lastPipelineTrace(session)?.intent, 'analyze.project')
    const snap = buildSurfaceSnapshot({ session })
    assert.equal(snap.lastPipeline?.passed, true)
  })

  it('formatConsumptionChip handles empty and errors', () => {
    assert.equal(formatConsumptionChip(null).label, 'no chat yet')
    assert.equal(
      formatConsumptionChip({
        count: 2,
        errorCount: 1,
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
      }).tone,
      'bad',
    )
  })

  it('parseChatBody validates message', () => {
    assert.deepEqual(parseChatBody({ message: '  hello  ', local: true }), {
      message: 'hello',
      localOnly: true,
    })
    assert.equal('error' in parseChatBody({}), true)
    assert.equal('error' in parseChatBody(null), true)
  })

  it('parseMemoryChatCommand covers recall/remember/clear', () => {
    assert.deepEqual(parseMemoryChatCommand('/memory'), {
      kind: 'recall',
      workspaceId: process.env.AIOS_WORKSPACE || 'aios',
    })
    assert.deepEqual(parseMemoryChatCommand('/memory companion'), {
      kind: 'recall',
      workspaceId: 'companion',
    })
    assert.deepEqual(parseMemoryChatCommand('/memory remember ship it'), {
      kind: 'remember',
      workspaceId: process.env.AIOS_WORKSPACE || 'aios',
      content: 'ship it',
    })
    assert.deepEqual(parseMemoryChatCommand('/memory remember @companion note'), {
      kind: 'remember',
      workspaceId: 'companion',
      content: 'note',
    })
    assert.deepEqual(parseMemoryChatCommand('/memory clear --yes'), {
      kind: 'clear-blocked',
    })
    assert.equal(parseMemoryChatCommand('hello'), null)
  })

  it('parseMemoryBody validates action', () => {
    assert.deepEqual(parseMemoryBody({ action: 'recall' }), {
      action: 'recall',
      workspaceId: process.env.AIOS_WORKSPACE || 'aios',
    })
    assert.equal('error' in parseMemoryBody({ action: 'remember' }), true)
    assert.deepEqual(
      parseMemoryBody({
        action: 'remember',
        workspaceId: 'aios',
        content: ' hi ',
      }),
      { action: 'remember', workspaceId: 'aios', content: 'hi' },
    )
  })

  it('parseWorkspaceBody requires workspaceId', () => {
    assert.deepEqual(parseWorkspaceBody({ workspaceId: '  companion  ' }), {
      workspaceId: 'companion',
    })
    assert.equal('error' in parseWorkspaceBody({}), true)
    assert.equal('error' in parseWorkspaceBody(null), true)
  })

  it('parseLocaleBody accepts en/pt', () => {
    assert.deepEqual(parseLocaleBody({ locale: 'en' }), { locale: 'en' })
    assert.deepEqual(parseLocaleBody({ locale: 'PT-BR' }), { locale: 'pt' })
    assert.equal('error' in parseLocaleBody({ locale: 'fr' }), true)
    assert.equal('error' in parseLocaleBody({}), true)
  })
})
