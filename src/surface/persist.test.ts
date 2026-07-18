import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it } from 'node:test'
import { createSession } from '../conversation/manager.ts'
import {
  clearSession,
  loadSession,
  parseStoredSession,
  saveSession,
} from './persist.ts'

describe('surface persist', () => {
  it('parseStoredSession rejects invalid payloads', () => {
    assert.equal(parseStoredSession(null), null)
    assert.equal(parseStoredSession({ id: 'x' }), null)
    assert.equal(
      parseStoredSession({
        id: 'c1',
        createdAt: '2026-01-01T00:00:00.000Z',
        turns: [{ role: 'user', content: 'hi', at: 't' }],
      }),
      null,
    )
  })

  it('round-trips a session to disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'companion-session-'))
    const path = join(dir, 'surface-session.json')
    try {
      const session = createSession({ summary: 'healthy' })
      session.turns.push({
        role: 'user',
        content: 'hello',
        at: '2026-07-18T12:00:00.000Z',
      })
      saveSession(session, path)
      const loaded = loadSession(path)
      assert.ok(loaded)
      assert.equal(loaded.id, session.id)
      assert.equal(loaded.turns.length, 2)
      assert.equal(loaded.turns[1]?.content, 'hello')
      assert.equal(loaded.locale, session.locale)
      clearSession(path)
      assert.equal(readFileSync(path, 'utf8'), '')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
