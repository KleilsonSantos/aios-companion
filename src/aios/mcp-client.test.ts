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

describe('AiosMcpSession.governanceRecord', () => {
  it('resume ok e id', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: true,
              entry: { id: 'd1', kind: 'note', verdict: 'info' },
            }),
          },
        ],
      }),
    }
    const out = await session.governanceRecord({
      summary: 'aceitar companion CI',
      kind: 'note',
      verdict: 'info',
    })
    assert.equal(out.ok, true)
    assert.match(out.summary, /d1/)
  })
})

describe('AiosMcpSession.auditDocs', () => {
  it('resume ok e missing', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              present: ['README.md'],
              missing: ['docs/FOUNDATION.md'],
              findings: [
                {
                  severity: 'error',
                  title: 'Doc canónica em falta: docs/FOUNDATION.md',
                },
              ],
            }),
          },
        ],
      }),
    }
    const out = await session.auditDocs({ repoPath: '/tmp/repo' })
    assert.equal(out.ok, false)
    assert.match(out.summary, /FAIL/)
    assert.equal(out.missing[0], 'docs/FOUNDATION.md')
  })
})

describe('AiosMcpSession.compilePrompt', () => {
  it('resume brief e stats', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: { name?: string; arguments?: { input?: string } }) => {
        assert.equal(req.name, 'aios_compile_prompt')
        assert.equal(req.arguments?.input, 'Crie um hook de auth')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                intent: 'Crie um hook de auth',
                workspaceId: 'aios',
                brief: '# Brief\n\nPolicies…',
                stats: { policies: 3, memories: 1 },
              }),
            },
          ],
        }
      },
    }
    const out = await session.compilePrompt({ input: 'Crie um hook de auth' })
    assert.match(out.brief, /# Brief/)
    assert.equal(out.intent, 'Crie um hook de auth')
    assert.match(out.summary, /brief ·/)
    assert.match(out.summary, /policies=3/)
  })
})
