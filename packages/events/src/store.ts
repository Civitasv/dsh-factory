import {
  asEventOffset,
  asGraphRevision,
  type ActorRef,
  type ChangeId,
  type CorrelationId,
  type EventId,
  type GraphId,
  type GraphRevision,
} from '@orven/internal-domain'
import type { DomainEvent, EventEnvelope, PendingEvent } from './events.js'

export class ConcurrencyConflictError extends Error {
  constructor(
    readonly changeId: ChangeId,
    readonly expectedSequence: number,
    readonly actualSequence: number,
  ) {
    super(
      `Change ${changeId} sequence conflict: expected ${expectedSequence}, actual ${actualSequence}`,
    )
    this.name = 'ConcurrencyConflictError'
  }
}

export interface AppendRequest {
  readonly changeId?: ChangeId
  readonly expectedSequence?: number
  readonly actor: ActorRef
  readonly causationId?: EventId
  readonly correlationId?: CorrelationId
  readonly events: readonly PendingEvent[]
}

export class InMemoryEventStore {
  readonly #events: EventEnvelope[] = []
  readonly #changeSequences = new Map<ChangeId, number>()
  readonly #eventIds = new Set<EventId>()

  constructor(readonly graphId: GraphId) {}

  currentSequence(changeId: ChangeId): number {
    return this.#changeSequences.get(changeId) ?? 0
  }

  currentRevision(): GraphRevision {
    const latest = this.#events.at(-1)
    return asGraphRevision(latest?.offset ?? 0)
  }

  readAll(): readonly EventEnvelope[] {
    return this.#events
  }

  append(request: AppendRequest): readonly EventEnvelope[] {
    if (request.events.length === 0) {
      throw new Error('Append requires at least one event')
    }

    const changeId = request.changeId
    const expectedSequence = request.expectedSequence

    if (changeId === undefined && expectedSequence !== undefined) {
      throw new Error('expectedSequence requires changeId')
    }

    if (changeId !== undefined && expectedSequence === undefined) {
      throw new Error('Change-owned append requires expectedSequence')
    }

    if (changeId !== undefined && expectedSequence !== undefined) {
      const actual = this.currentSequence(changeId)
      if (expectedSequence !== actual) {
        throw new ConcurrencyConflictError(changeId, expectedSequence, actual)
      }
    }

    const batchIds = new Set<EventId>()
    for (const pending of request.events) {
      if (this.#eventIds.has(pending.eventId) || batchIds.has(pending.eventId)) {
        throw new Error(`Duplicate event id ${pending.eventId}`)
      }
      batchIds.add(pending.eventId)
    }

    let sequence = changeId === undefined ? undefined : this.currentSequence(changeId)
    const appended: EventEnvelope[] = []

    for (const pending of request.events) {
      const offset = asEventOffset(this.#events.length + 1)
      if (sequence !== undefined) sequence += 1

      const envelope: EventEnvelope = {
        eventId: pending.eventId,
        graphId: this.graphId,
        offset,
        occurredAt: pending.occurredAt,
        actor: request.actor,
        event: pending.event as DomainEvent,
        ...(changeId === undefined ? {} : { changeId }),
        ...(sequence === undefined ? {} : { sequence }),
        ...(request.causationId === undefined ? {} : { causationId: request.causationId }),
        ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
      }

      this.#events.push(envelope)
      this.#eventIds.add(envelope.eventId)
      appended.push(envelope)
    }

    if (changeId !== undefined && sequence !== undefined) {
      this.#changeSequences.set(changeId, sequence)
    }

    return appended
  }
}
