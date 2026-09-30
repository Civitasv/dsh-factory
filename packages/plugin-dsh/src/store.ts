import type {
  ChangeId,
  GraphId,
  GraphRevision,
} from '@dsh-factory/core'
import type {
  AppendRequest,
  EventEnvelope,
} from '@dsh-factory/events'

export interface FactoryEventStore {
  readonly graphId: GraphId

  currentRevision(): GraphRevision
  currentSequence(changeId: ChangeId): number
  readAll(): readonly EventEnvelope[]
  append(
    request: AppendRequest,
  ): readonly EventEnvelope[] | Promise<readonly EventEnvelope[]>
}
