import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chunkText } from './stream.ts'

describe('surface stream', () => {
  it('chunkText splits by size and keeps empty as one chunk', () => {
    assert.deepEqual(chunkText('', 10), [''])
    assert.deepEqual(chunkText('abcdefghij', 4), ['abcd', 'efgh', 'ij'])
    assert.deepEqual(chunkText('hi', 28), ['hi'])
  })
})
