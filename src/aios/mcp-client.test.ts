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
