import { describe, expect, it } from 'vitest'
import {
  type ActorRef,
  type ChangeId,
  type EventId,
  type GraphId,
} from '@orven/internal-domain'
import {
  ConcurrencyConflictError,
  InMemoryEventStore,
} from './index.js'

const graphId = 'GRAPH-1' as GraphId
const changeId = 'CHG-1' as ChangeId
const actor: ActorRef = { kind: 'system', id: 'test' }

describe('InMemoryEventStore', () => {
  it('assigns graph offsets and per-Change sequences', () => {
    const store = new InMemoryEventStore(graphId)

    const first = store.append({
      changeId,
      expectedSequence: 0,
      actor,
      events: [
        {
          eventId: 'EVT-1' as EventId,
          occurredAt: '2026-09-30T00:00:00Z',
          event: {
            type: 'change.created',
            change: {
              id: changeId,
              kind: 'feature',
              title: 'Graph',
              createdAt: '2026-09-30T00:00:00Z',
              createdBy: actor,
            },
          },
        },
      ],
    })

    const second = store.append({
      changeId,
      expectedSequence: 1,
      actor,
      events: [
        {
          eventId: 'EVT-2' as EventId,
          occurredAt: '2026-09-30T00:00:01Z',
          event: {
            type: 'change.closed',
            changeId,
            disposition: 'completed',
          },
        },
      ],
    })

    expect(first[0]?.offset).toBe(1)
    expect(first[0]?.sequence).toBe(1)
    expect(second[0]?.offset).toBe(2)
    expect(second[0]?.sequence).toBe(2)
    expect(store.currentRevision()).toBe(2)
  })

  it('rejects a stale expected Change sequence', () => {
    const store = new InMemoryEventStore(graphId)

    store.append({
      changeId,
      expectedSequence: 0,
      actor,
      events: [
        {
          eventId: 'EVT-1' as EventId,
          occurredAt: '2026-09-30T00:00:00Z',
          event: {
            type: 'change.created',
            change: {
              id: changeId,
              kind: 'feature',
              title: 'Graph',
              createdAt: '2026-09-30T00:00:00Z',
              createdBy: actor,
            },
          },
        },
      ],
    })

    expect(() =>
      store.append({
        changeId,
        expectedSequence: 0,
        actor,
        events: [
          {
            eventId: 'EVT-2' as EventId,
            occurredAt: '2026-09-30T00:00:01Z',
            event: {
              type: 'change.closed',
              changeId,
              disposition: 'completed',
            },
          },
        ],
      }),
    ).toThrow(ConcurrencyConflictError)
  })

  it('rejects duplicate event ids', () => {
    const store = new InMemoryEventStore(graphId)

    store.append({
      actor,
      events: [
        {
          eventId: 'EVT-1' as EventId,
          occurredAt: '2026-09-30T00:00:00Z',
          event: {
            type: 'decision.recorded',
            decision: {
              id: 'DEC-1' as never,
              question: 'Use graph?',
              outcome: 'yes',
              rationale: 'test',
              madeBy: actor,
              madeAt: '2026-09-30T00:00:00Z',
            },
          },
        },
      ],
    })

    expect(() =>
      store.append({
        actor,
        events: [
          {
            eventId: 'EVT-1' as EventId,
            occurredAt: '2026-09-30T00:00:01Z',
            event: {
              type: 'decision.recorded',
              decision: {
                id: 'DEC-2' as never,
                question: 'Again?',
                outcome: 'no',
                rationale: 'test',
                madeBy: actor,
                madeAt: '2026-09-30T00:00:01Z',
              },
            },
          },
        ],
      }),
    ).toThrow('Duplicate event id')
  })
})
