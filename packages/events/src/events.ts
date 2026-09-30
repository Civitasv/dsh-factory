import type {
  ActorRef,
  Artifact,
  Change,
  ChangeDisposition,
  ChangeId,
  CorrelationId,
  Criterion,
  CriterionRevision,
  Decision,
  EventId,
  EventOffset,
  Evidence,
  EvidenceId,
  EvidenceInvalidationReason,
  Finding,
  FindingId,
  Gate,
  GateEvaluation,
  GraphId,
  Relation,
  RelationId,
  Run,
} from '@orven/internal-domain'

export type DomainEvent =
  | { readonly type: 'change.created'; readonly change: Change }
  | {
      readonly type: 'change.closed'
      readonly changeId: ChangeId
      readonly disposition: ChangeDisposition
      readonly reason?: string
    }
  | { readonly type: 'criterion.created'; readonly criterion: Criterion }
  | { readonly type: 'criterion.revision.published'; readonly revision: CriterionRevision }
  | { readonly type: 'artifact.recorded'; readonly artifact: Artifact }
  | { readonly type: 'evidence.recorded'; readonly evidence: Evidence }
  | {
      readonly type: 'evidence.invalidated'
      readonly evidenceId: EvidenceId
      readonly reason: EvidenceInvalidationReason
      readonly basis: readonly EvidenceId[]
      readonly detail?: string
    }
  | { readonly type: 'finding.opened'; readonly finding: Finding }
  | {
      readonly type: 'finding.reproduced'
      readonly findingId: FindingId
      readonly evidenceIds: readonly EvidenceId[]
    }
  | {
      readonly type: 'finding.resolved'
      readonly findingId: FindingId
      readonly evidenceIds: readonly EvidenceId[]
    }
  | {
      readonly type: 'finding.reopened'
      readonly findingId: FindingId
      readonly evidenceIds: readonly EvidenceId[]
    }
  | {
      readonly type: 'finding.invalidated'
      readonly findingId: FindingId
      readonly evidenceIds: readonly EvidenceId[]
    }
  | { readonly type: 'decision.recorded'; readonly decision: Decision }
  | { readonly type: 'gate.created'; readonly gate: Gate }
  | { readonly type: 'gate.evaluated'; readonly evaluation: GateEvaluation }
  | { readonly type: 'run.recorded'; readonly run: Run }
  | { readonly type: 'relation.created'; readonly relation: Relation }
  | {
      readonly type: 'relation.retired'
      readonly relationId: RelationId
      readonly reason?: string
    }

export interface EventEnvelope<Event extends DomainEvent = DomainEvent> {
  readonly eventId: EventId
  readonly graphId: GraphId
  readonly changeId?: ChangeId
  readonly sequence?: number
  readonly offset: EventOffset
  readonly occurredAt: string
  readonly actor: ActorRef
  readonly causationId?: EventId
  readonly correlationId?: CorrelationId
  readonly event: Event
}

export interface PendingEvent<Event extends DomainEvent = DomainEvent> {
  readonly eventId: EventId
  readonly occurredAt: string
  readonly event: Event
}
