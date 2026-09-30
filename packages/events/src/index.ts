import type {
  ArtifactId,
  Change,
  ChangeId,
  EvidenceId,
  FindingId,
  GateId,
  GateState,
  RunId,
} from '@dsh-factory/core'

export type DomainEvent =
  | { readonly type: 'change.created'; readonly change: Change }
  | { readonly type: 'artifact.attached'; readonly artifactId: ArtifactId }
  | { readonly type: 'evidence.recorded'; readonly evidenceId: EvidenceId }
  | { readonly type: 'finding.opened'; readonly findingId: FindingId }
  | { readonly type: 'finding.resolved'; readonly findingId: FindingId }
  | {
      readonly type: 'gate.evaluated'
      readonly gateId: GateId
      readonly state: GateState
      readonly evidenceIds: readonly EvidenceId[]
    }
  | { readonly type: 'run.recorded'; readonly runId: RunId }

export interface EventEnvelope<Event extends DomainEvent = DomainEvent> {
  readonly eventId: string
  readonly changeId: ChangeId
  readonly sequence: number
  readonly occurredAt: string
  readonly event: Event
}

export function assertStrictlyIncreasingSequence(events: readonly EventEnvelope[]): void {
  let previous = 0

  for (const envelope of events) {
    if (!Number.isSafeInteger(envelope.sequence) || envelope.sequence <= previous) {
      throw new Error(
        `Event sequence must be a strictly increasing positive safe integer; got ${envelope.sequence} after ${previous}`,
      )
    }

    previous = envelope.sequence
  }
}
