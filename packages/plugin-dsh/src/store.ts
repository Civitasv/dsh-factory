import type {
  ChangeId,
  GraphId,
  GraphRevision,
} from '@orven/core'
import type {
  AppendRequest,
  EventEnvelope,
} from '@orven/core/events'

export interface OrvenEventStore {
  readonly graphId: GraphId

  currentRevision(): GraphRevision
  currentSequence(changeId: ChangeId): number
  readAll(): readonly EventEnvelope[]
  append(
    request: AppendRequest,
  ): readonly EventEnvelope[] | Promise<readonly EventEnvelope[]>
}
