import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type ActorRef,
  type ChangeId,
  type EventId,
  type GraphId,
} from '@orven/internal-domain'
import {
  ConcurrencyConflictError,
  GraphRevisionConflictError,
} from '@orven/internal-events'
import { JsonlEventStore } from './index.js'

const actor: ActorRef = { kind: 'system', id: 'test' }
const graphId = 'GRAPH-1' as GraphId
const changeId = 'CHG-1' as ChangeId
const directories: string[] = []

async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'dsh-factory-'))
  directories.push(path)
  return path
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

function createEvent(id: string) {
  return {
    eventId: id as EventId,
    occurredAt: '2026-09-30T00:00:00Z',
    event: {
      type: 'change.created' as const,
      change: {
        id: changeId,
        kind: 'feature' as const,
        title: 'Persisted Change',
        createdAt: '2026-09-30T00:00:00Z',
        createdBy: actor,
      },
    },
  }
}

describe('JsonlEventStore', () => {
  it('persists Graph revision and Change sequence across reopen', async () => {
    const path = await directory()
    const store = await JsonlEventStore.open(path, graphId)

    await store.append({
      changeId,
      expectedSequence: 0,
      actor,
      events: [createEvent('EVT-1')],
    })

    const reopened = await JsonlEventStore.open(path, graphId)

    expect(reopened.currentRevision()).toBe(1)
    expect(reopened.currentSequence(changeId)).toBe(1)
    expect(reopened.project().nodes).toHaveLength(1)
  })

  it('rejects stale concurrency and duplicate Event ids after reopen', async () => {
    const path = await directory()
    const store = await JsonlEventStore.open(path, graphId)
    await store.append({
      changeId,
      expectedSequence: 0,
      actor,
      events: [createEvent('EVT-1')],
    })
    const reopened = await JsonlEventStore.open(path, graphId)

    await expect(
      reopened.append({
        changeId,
        expectedSequence: 0,
        actor,
        events: [
          {
            eventId: 'EVT-2' as EventId,
            occurredAt: '2026-09-30T00:00:01Z',
            event: { type: 'change.closed', changeId, disposition: 'completed' },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConcurrencyConflictError)

    await expect(
      reopened.append({
        actor,
        events: [createEvent('EVT-1')],
      }),
    ).rejects.toThrow('Duplicate event id')
  })

  it('rejects stale Graph revision atomically at the serialized append boundary', async () => {
    const path = await directory()
    const store = await JsonlEventStore.open(path, graphId)

    await store.append({
      changeId,
      expectedSequence: 0,
      expectedRevision: store.currentRevision(),
      actor,
      events: [createEvent('EVT-1')],
    })

    await expect(
      store.append({
        changeId,
        expectedSequence: 1,
        expectedRevision: 0 as never,
        actor,
        events: [
          {
            eventId: 'EVT-2' as EventId,
            occurredAt: '2026-09-30T00:00:01Z',
            event: { type: 'change.closed', changeId, disposition: 'completed' },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(GraphRevisionConflictError)

    expect(store.currentRevision()).toBe(1)
    expect(store.currentSequence(changeId)).toBe(1)
  })

  it('publishes a multi-event batch completely', async () => {
    const path = await directory()
    const store = await JsonlEventStore.open(path, graphId)

    await store.append({
      changeId,
      expectedSequence: 0,
      actor,
      events: [
        createEvent('EVT-1'),
        {
          eventId: 'EVT-2' as EventId,
          occurredAt: '2026-09-30T00:00:01Z',
          event: { type: 'change.closed', changeId, disposition: 'completed' },
        },
      ],
    })

    const lines = (await readFile(join(path, 'events.jsonl'), 'utf8'))
      .trim()
      .split('\n')
    expect(lines).toHaveLength(2)
    expect((await JsonlEventStore.open(path, graphId)).currentRevision()).toBe(2)
  })

  it('serializes concurrent appends through one store instance', async () => {
    const path = await directory()
    const store = await JsonlEventStore.open(path, graphId)

    const first = store.append({
      actor,
      events: [
        {
          eventId: 'EVT-A' as EventId,
          occurredAt: '2026-09-30T00:00:00Z',
          event: {
            type: 'decision.recorded',
            decision: {
              id: 'DEC-A' as never,
              question: 'A?',
              outcome: 'yes',
              rationale: 'test',
              madeBy: actor,
              madeAt: '2026-09-30T00:00:00Z',
            },
          },
        },
      ],
    })
    const second = store.append({
      actor,
      events: [
        {
          eventId: 'EVT-B' as EventId,
          occurredAt: '2026-09-30T00:00:01Z',
          event: {
            type: 'decision.recorded',
            decision: {
              id: 'DEC-B' as never,
              question: 'B?',
              outcome: 'yes',
              rationale: 'test',
              madeBy: actor,
              madeAt: '2026-09-30T00:00:01Z',
            },
          },
        },
      ],
    })

    await Promise.all([first, second])
    expect(store.readAll().map(event => event.offset)).toEqual([1, 2])
  })

  it('rejects another Graph id for an initialized directory', async () => {
    const path = await directory()
    await JsonlEventStore.open(path, graphId)

    await expect(
      JsonlEventStore.open(path, 'GRAPH-2' as GraphId),
    ).rejects.toThrow('Graph id mismatch')
  })

  it('fails open on malformed Event JSON', async () => {
    const path = await directory()
    await JsonlEventStore.open(path, graphId)
    await writeFile(join(path, 'events.jsonl'), '{broken\n', 'utf8')

    await expect(JsonlEventStore.open(path, graphId)).rejects.toThrow(
      'Invalid JSON',
    )
  })
})
