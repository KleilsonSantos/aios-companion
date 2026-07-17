import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AiosMcpSession, EXPECTED_CONTRACT_VERSION } from './mcp-client.ts'
import { runDoctor } from './doctor.ts'

describe('contractVersion', () => {
  it('OK quando versão bate', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ contractVersion: EXPECTED_CONTRACT_VERSION }),
          },
        ],
      }),
    }
    const out = await session.contractVersion()
    assert.equal(out.ok, true)
    assert.match(out.summary, /OK/)
  })

  it('FAIL em mismatch', async () => {
    const session = new AiosMcpSession('/tmp')
    ;(session as unknown as { client: unknown }).client = {
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ contractVersion: '999' }),
          },
        ],
      }),
    }
    const out = await session.contractVersion()
    assert.equal(out.ok, false)
    assert.match(out.summary, /MISMATCH/)
  })
})

describe('runDoctor', () => {
  it('falha cedo sem AIOS_HOME válido', async () => {
    const prev = process.env.AIOS_HOME
    const prevRepo = process.env.AIOS_REPO
    delete process.env.AIOS_HOME
    delete process.env.AIOS_REPO
    try {
      // force miss sibling by using impossible cwd context via empty home override
      const report = await runDoctor({ aiosHome: '/tmp/aios-doctor-missing-xyz' })
      // If path doesn't have mcp entry, mcp_entry fails (or aios_home ok but mcp fail)
      assert.equal(report.ok, false)
      assert.ok(report.checks.some((c) => !c.ok))
    } finally {
      if (prev !== undefined) process.env.AIOS_HOME = prev
      else delete process.env.AIOS_HOME
      if (prevRepo !== undefined) process.env.AIOS_REPO = prevRepo
      else delete process.env.AIOS_REPO
    }
  })
})
