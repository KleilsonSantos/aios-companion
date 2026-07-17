import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { gitAdapter } from './git.ts'
import { githubAdapter } from './github.ts'
import { probeAll, snapshotCapability } from './index.ts'

describe('capability adapters', () => {
  it('probeAll devolve git + github', () => {
    const probes = probeAll()
    assert.deepEqual(
      probes.map((p) => p.id).sort(),
      ['git', 'github'],
    )
  })

  it('git usa operational state quando disponível', async () => {
    const snap = await gitAdapter.snapshot({
      operationalGit: {
        available: true,
        branch: 'sandbox',
        head: 'abc1234deadbeef',
      },
    })
    assert.equal(snap.ok, true)
    assert.match(snap.summary, /sandbox/)
    assert.match(snap.summary, /AIOS/)
  })

  it('git probe falha sem repo e sem operational git', () => {
    const probe = gitAdapter.probe({ cwd: '/tmp' })
    // /tmp normalmente não é git — available false
    assert.equal(probe.available, false)
  })

  it('github probe reporta disponibilidade sem crash', () => {
    const probe = githubAdapter.probe()
    assert.equal(probe.id, 'github')
    assert.equal(typeof probe.available, 'boolean')
  })

  it('snapshotCapability desconhecido', async () => {
    const snap = await snapshotCapability('git', {
      operationalGit: { available: true, branch: 'main', head: 'fff' },
    })
    assert.equal(snap.id, 'git')
    assert.equal(snap.ok, true)
  })
})
