import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AiosMcpSession } from './mcp-client.ts'

describe('AiosMcpSession.runPipeline', () => {
  it('resume passed a partir do JSON MCP', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              contractVersion: 1,
              intent: { type: 'analyze.project', raw: 'Analise' },
              workflow: { ran: ['architecture'], skipped: [] },
              verdict: { passed: true },
            }),
          },
        ],
      }),
    }
    const out = await session.runPipeline({ input: 'Analise' })
    assert.equal(out.passed, true)
    assert.match(out.summary, /pipeline OK/)
    assert.equal(out.intent?.type, 'analyze.project')
  })

  it('não throw quando quality gate falha (isError + JSON)', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              intent: { type: 'analyze.project' },
              workflow: { ran: [], skipped: ['qa'] },
              verdict: { passed: false },
            }),
          },
        ],
      }),
    }
    const out = await session.runPipeline({ input: 'x' })
    assert.equal(out.passed, false)
    assert.match(out.summary, /FAIL/)
  })
})

describe('AiosMcpSession.governanceStatus', () => {
  it('resume attention e hasErrors', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              workspaces: [{ id: 'a' }],
              policies: { count: 3 },
              provider: { ok: false },
              attention: [
                {
                  id: 'provider-down',
                  severity: 'error',
                  title: 'Provider down',
                },
                { id: 'metrics-stub', severity: 'info', title: 'Metrics stub' },
              ],
            }),
          },
        ],
      }),
    }
    const out = await session.governanceStatus()
    assert.equal(out.hasErrors, true)
    assert.equal(out.workspaces, 1)
    assert.equal(out.policies, 3)
    assert.match(out.summary, /provider=down/)
    assert.match(out.summary, /1 error/)
  })
})

describe('AiosMcpSession.memory', () => {
  it('recall resume entradas', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              workspaceId: 'aios',
              count: 1,
              entries: [{ content: 'nota', id: 'm1' }],
            }),
          },
        ],
      }),
    }
    const out = await session.memoryRecall({ workspaceId: 'aios' })
    assert.equal(out.count, 1)
    assert.match(out.summary, /1 entrada/)
  })

  it('remember marca ok', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: true, entry: { id: 'e1' } }),
          },
        ],
      }),
    }
    const out = await session.memoryRemember({
      workspaceId: 'aios',
      content: 'hello',
    })
    assert.equal(out.ok, true)
    assert.match(out.summary, /e1/)
  })
})
