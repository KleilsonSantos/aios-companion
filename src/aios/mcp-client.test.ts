import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AiosMcpSession,
  companionClientVersion,
  resolveMcpHttpUrl,
  resolveMcpTransportKind,
} from './mcp-client.ts'

describe('MCP transport selection', () => {
  it('defaults to stdio when AIOS_MCP_URL unset', () => {
    assert.equal(resolveMcpTransportKind({}), 'stdio')
    assert.equal(resolveMcpHttpUrl({}), undefined)
  })

  it('selects http when AIOS_MCP_URL is set', () => {
    const env = { AIOS_MCP_URL: ' http://127.0.0.1:8791/mcp ' }
    assert.equal(resolveMcpTransportKind(env), 'http')
    assert.equal(resolveMcpHttpUrl(env), 'http://127.0.0.1:8791/mcp')
  })

  it('companionClientVersion reads package.json', () => {
    assert.match(companionClientVersion(), /^\d+\.\d+\.\d+$/)
  })
})

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
  it('resume attention, consumption e hasErrors', async () => {
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
              exposed: { providers: ['ollama', 'openai', 'anthropic'] },
              metrics: {
                note: 'provider.chat: 2',
                providerChat: {
                  count: 2,
                  errorCount: 0,
                  promptTokens: 10,
                  completionTokens: 5,
                  totalTokens: 15,
                },
              },
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
    assert.equal(out.providerChat?.count, 2)
    assert.equal(out.providerChat?.totalTokens, 15)
    assert.deepEqual(out.providers, ['ollama', 'openai', 'anthropic'])
    assert.match(out.summary, /provider=down/)
    assert.match(out.summary, /1 error/)
    assert.match(out.summary, /consumption: 2 chat/)
    assert.match(out.summary, /providers=ollama,openai,anthropic/)
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

  it('clear resume cleared', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: { name?: string }) => {
        assert.equal(req.name, 'aios_memory_clear')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                cleared: true,
                workspaceId: 'aios',
                remaining: [],
              }),
            },
          ],
        }
      },
    }
    const out = await session.memoryClear({ workspaceId: 'aios' })
    assert.equal(out.cleared, true)
    assert.match(out.summary, /cleared · aios/)
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

describe('AiosMcpSession.searchPkb', () => {
  it('resume hits e summary', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: {
        name?: string
        arguments?: { query?: string; domain?: string }
      }) => {
        assert.equal(req.name, 'aios_search_pkb')
        assert.equal(req.arguments?.query, 'README')
        assert.equal(req.arguments?.domain, 'documentation')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: 1,
                query: 'README',
                domain: 'documentation',
                hits: [
                  {
                    id: 'prompt.documentation.readme',
                    path: 'docs/prompts/by-domain/documentation/x.v1.md',
                    title: 'README audit',
                    domain: 'documentation',
                    tags: ['documentation', 'readme'],
                    score: 5,
                    matches: ['title', 'domain'],
                  },
                ],
              }),
            },
          ],
        }
      },
    }
    const out = await session.searchPkb({
      query: 'README',
      domain: 'documentation',
    })
    assert.equal(out.count, 1)
    assert.equal(out.hits[0]?.id, 'prompt.documentation.readme')
    assert.match(out.summary, /1 hit/)
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

describe('AiosMcpSession.workspaces', () => {
  it('list resume count', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: { name?: string }) => {
        assert.equal(req.name, 'aios_list_workspaces')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source: 'file',
                count: 1,
                workspaces: [{ id: 'aios', path: '.', default: true }],
              }),
            },
          ],
        }
      },
    }
    const out = await session.listWorkspaces()
    assert.equal(out.count, 1)
    assert.match(out.summary, /1/)
  })

  it('upsert resume created', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              created: true,
              entry: { id: 'comp', path: '/x' },
            }),
          },
        ],
      }),
    }
    const out = await session.workspaceUpsert({ id: 'comp', path: '/x' })
    assert.equal(out.created, true)
    assert.match(out.summary, /created · comp/)
  })

  it('remove resume not found', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ removed: false }),
          },
        ],
      }),
    }
    const out = await session.workspaceRemove({ id: 'missing' })
    assert.equal(out.removed, false)
    assert.match(out.summary, /not found/)
  })

  it('validate all resume FAIL', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              count: 2,
              workspaces: [
                { id: 'a', ok: true },
                { id: 'b', ok: false, signals: ['no-git'] },
              ],
            }),
          },
        ],
      }),
    }
    const out = await session.workspaceValidate()
    assert.equal(out.ok, false)
    assert.match(out.summary, /1\/2/)
  })
})

describe('AiosMcpSession.runAcrossWorkspaces', () => {
  it('resume OK quando todos passam', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: { name?: string }) => {
        assert.equal(req.name, 'aios_run_across_workspaces')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                input: 'Analise',
                results: [
                  {
                    workspaceId: 'aios',
                    verdictPassed: true,
                    intentKind: 'analyze.project',
                  },
                  {
                    workspaceId: 'comp',
                    verdictPassed: true,
                    intentKind: 'analyze.project',
                  },
                ],
              }),
            },
          ],
        }
      },
    }
    const out = await session.runAcrossWorkspaces({ input: 'Analise' })
    assert.equal(out.passed, true)
    assert.equal(out.results.length, 2)
    assert.match(out.summary, /OK · 2/)
  })

  it('não throw quando isError + JSON parcial FAIL', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results: [
                { workspaceId: 'a', verdictPassed: true },
                { workspaceId: 'b', verdictPassed: false, error: 'gate' },
              ],
            }),
          },
        ],
      }),
    }
    const out = await session.runAcrossWorkspaces({ input: 'x' })
    assert.equal(out.passed, false)
    assert.match(out.summary, /FAIL · 1\/2/)
  })
})

describe('AiosMcpSession.buildKnowledge', () => {
  it('resume summary nodes/edges', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: { name?: string }) => {
        assert.equal(req.name, 'aios_build_knowledge')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                repoPath: '/tmp/repo',
                nodeCount: 12,
                edgeCount: 8,
                kinds: { project: 1, package: 4, doc: 3 },
                signals: ['package.json'],
              }),
            },
          ],
        }
      },
    }
    const out = await session.buildKnowledge({ repoPath: '/tmp/repo' })
    assert.equal(out.nodeCount, 12)
    assert.equal(out.edgeCount, 8)
    assert.match(out.summary, /nodes=12/)
    assert.match(out.summary, /package=4/)
  })
})

describe('AiosMcpSession.provider', () => {
  it('health resume OK', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: { name?: string }) => {
        assert.equal(req.name, 'aios_provider_health')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                provider: 'ollama',
                ok: true,
                baseUrl: 'http://127.0.0.1:11434',
                models: ['llama3.2'],
                latencyMs: 12,
              }),
            },
          ],
        }
      },
    }
    const out = await session.providerHealth()
    assert.equal(out.ok, true)
    assert.match(out.summary, /OK · models=1/)
  })

  it('health DOWN sem throw (isError + JSON)', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              provider: 'ollama',
              ok: false,
              error: 'ECONNREFUSED',
            }),
          },
        ],
      }),
    }
    const out = await session.providerHealth()
    assert.equal(out.ok, false)
    assert.match(out.summary, /DOWN/)
  })

  it('models resume count', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: { name?: string }) => {
        assert.equal(req.name, 'aios_provider_models')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                provider: 'ollama',
                count: 2,
                models: [{ name: 'a' }, { name: 'b' }],
              }),
            },
          ],
        }
      },
    }
    const out = await session.providerModels()
    assert.equal(out.count, 2)
    assert.match(out.summary, /models · ollama · 2/)
  })
})

describe('AiosMcpSession.loadPolicies', () => {
  it('resume count e mustIds', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: { name?: string }) => {
        assert.equal(req.name, 'aios_load_policies')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source: 'file',
                path: '/tmp/policies.json',
                count: 2,
                mustIds: ['official-docs', 'trade-offs'],
                rules: [
                  { id: 'official-docs', severity: 'must', title: 'Docs' },
                  { id: 'trade-offs', severity: 'must', title: 'Trade-offs' },
                ],
              }),
            },
          ],
        }
      },
    }
    const out = await session.loadPolicies({ repoPath: '/tmp' })
    assert.equal(out.count, 2)
    assert.equal(out.mustIds.length, 2)
    assert.match(out.summary, /must=2/)
  })
})

describe('AiosMcpSession.governanceAudit', () => {
  it('resume OK e findings', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async (req: { name?: string }) => {
        assert.equal(req.name, 'aios_governance_audit')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ok: true,
                policies: {
                  mustIds: ['a', 'b'],
                  count: 5,
                  missingCoreMustIds: ['docs-language-en'],
                },
                decisions: {
                  count: 3,
                  failCount: 1,
                  unknownPolicyIds: ['nope'],
                },
                documentation: { ok: true, findingCount: 0 },
                findings: [
                  {
                    id: 'gov-no-decisions',
                    severity: 'info',
                    title: 'Nenhuma decisão',
                  },
                ],
              }),
            },
          ],
        }
      },
    }
    const out = await session.governanceAudit()
    assert.equal(out.ok, true)
    assert.equal(out.mustIds.length, 2)
    assert.equal(out.failCount, 1)
    assert.deepEqual(out.missingCoreMustIds, ['docs-language-en'])
    assert.deepEqual(out.unknownPolicyIds, ['nope'])
    assert.match(out.summary, /gov audit OK/)
    assert.match(out.summary, /fail-verdicts=1/)
    assert.match(out.summary, /missing-core=1/)
  })

  it('não throw quando isError + ok false', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              policies: { mustIds: [] },
              decisions: { count: 0 },
              findings: [
                { severity: 'error', title: 'bloqueio', id: 'x' },
              ],
            }),
          },
        ],
      }),
    }
    const out = await session.governanceAudit({ repoPath: '/tmp' })
    assert.equal(out.ok, false)
    assert.match(out.summary, /FAIL/)
  })
})
