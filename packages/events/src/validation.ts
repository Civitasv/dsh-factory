import type { ChangeId, GraphId } from '@orven/internal-domain'
import type { EventEnvelope } from './events.js'

export function assertEventLogConsistency(
  graphId: GraphId,
  events: readonly EventEnvelope[],
): void {
  let previousOffset = 0
  const previousSequence = new Map<ChangeId, number>()
  const eventIds = new Set<string>()

  for (const envelope of events) {
    if (envelope.graphId !== graphId) {
      throw new Error(
        `Event ${envelope.eventId} belongs to graph ${envelope.graphId}, expected ${graphId}`,
      )
    }

    if (!Number.isSafeInteger(envelope.offset) || envelope.offset <= previousOffset) {
      throw new Error(
        `Event offsets must be strictly increasing positive safe integers; got ${envelope.offset} after ${previousOffset}`,
      )
    }

    if (eventIds.has(envelope.eventId)) {
      throw new Error(`Duplicate event id ${envelope.eventId}`)
    }

    const hasChange = envelope.changeId !== undefined
    const hasSequence = envelope.sequence !== undefined
    if (hasChange !== hasSequence) {
      throw new Error('changeId and sequence must either both be present or both be absent')
    }

    if (envelope.changeId !== undefined && envelope.sequence !== undefined) {
      const previous = previousSequence.get(envelope.changeId) ?? 0
      if (!Number.isSafeInteger(envelope.sequence) || envelope.sequence <= previous) {
        throw new Error(
          `Change sequences must be strictly increasing positive safe integers; got ${envelope.sequence} after ${previous}`,
        )
      }
      previousSequence.set(envelope.changeId, envelope.sequence)
    }

    previousOffset = envelope.offset
    eventIds.add(envelope.eventId)
  }
}
