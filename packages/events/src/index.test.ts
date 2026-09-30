import { describe, expect, it } from 'vitest'
import type { ChangeId } from '@dsh-factory/core'
import { assertStrictlyIncreasingSequence, type EventEnvelope } from './index.js'

const changeId = 'CHG-1' as ChangeId

function event(sequence: number): EventEnvelope {
  return {
    eventId: `EVT-${sequence}`,
    changeId,
    sequence,
    occurredAt: '2026-09-30T00:00:00Z',
    event: {
      type: 'artifact.attached',
      artifactId: `ART-${sequence}` as never,
    },
  }
}

describe('assertStrictlyIncreasingSequence', () => {
  it('accepts increasing stream order', () => {
    expect(() => assertStrictlyIncreasingSequence([event(1), event(2), event(3)])).not.toThrow()
  })

  it('rejects duplicate sequence numbers', () => {
    expect(() => assertStrictlyIncreasingSequence([event(1), event(1)])).toThrow('strictly increasing')
  })

  it('rejects regressing sequence numbers', () => {
    expect(() => assertStrictlyIncreasingSequence([event(2), event(1)])).toThrow('strictly increasing')
  })
})
