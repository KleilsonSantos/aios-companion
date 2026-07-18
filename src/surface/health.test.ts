import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { probeSurfaceHealth } from './health.ts'

describe('surface health probe', () => {
  it('reports ok when health endpoint responds', async () => {
    const out = await probeSurfaceHealth({
      baseUrl: 'http://127.0.0.1:8790',
      timeoutMs: 500,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ ok: true, service: 'companion-surface' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch,
    })
    assert.equal(out.ok, true)
    assert.match(out.detail, /companion-surface/)
  })

  it('reports failure on network error', async () => {
    const out = await probeSurfaceHealth({
      baseUrl: 'http://127.0.0.1:1',
      timeoutMs: 200,
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED')
      }) as typeof fetch,
    })
    assert.equal(out.ok, false)
    assert.match(out.detail, /unreachable/)
  })
})
