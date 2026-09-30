import type { GraphRevision } from './ids.js'
import type {
  ArtifactRef,
  CriterionRevisionRef,
  EvidenceRef,
} from './refs.js'
import type {
  ArtifactId,
  ChangeId,
  CriterionId,
  DecisionId,
  EvidenceId,
  EvidenceKindId,
  EvidenceRequirementId,
  FindingId,
  GateId,
  RunId,
} from './ids.js'
import type { JsonValue } from './json.js'

export interface ActorRef {
  readonly kind: 'human' | 'agent' | 'system'
  readonly id: string
}

export type ChangeKind =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'performance'
  | 'incident'
  | 'security'
  | 'maintenance'
  | 'experiment'

export type ChangeDisposition = 'completed' | 'cancelled' | 'superseded' | 'rejected'

export interface Change {
  readonly id: ChangeId
  readonly kind: ChangeKind
  readonly title: string
  readonly createdAt: string
  readonly createdBy: ActorRef
}

export interface Criterion {
  readonly id: CriterionId
  readonly createdAt: string
  readonly createdBy: ActorRef
}

export interface EvidenceKindRef {
  readonly kind: EvidenceKindId
  readonly version: number
}

export interface EvidenceRequirement {
  readonly id: EvidenceRequirementId
  readonly acceptedKinds: readonly EvidenceKindRef[]
  readonly requiredResult: 'supports'
  readonly minimumCount: number
  readonly reality: 'current'
  readonly description?: string
}

export interface CriterionRevision {
  readonly criterionId: CriterionId
  readonly revision: number
  readonly statement: string
  readonly evidenceRequirements: readonly EvidenceRequirement[]
  readonly severity: 'required' | 'recommended'
  readonly source?: ArtifactRef
  readonly publishedAt: string
  readonly publishedBy: ActorRef
}

export interface Artifact {
  readonly id: ArtifactId
  readonly type: string
  readonly uri?: string
  readonly digest?: string
  readonly createdAt: string
  readonly createdBy: ActorRef
}

export type EvidenceSubjectRef =
  | { readonly kind: 'node'; readonly node: import('./refs.js').GraphNodeRef }
  | { readonly kind: 'criterion_revision'; readonly revision: CriterionRevisionRef }

export interface EvidenceReality {
  readonly targets: readonly ArtifactRef[]
  readonly environment: readonly ArtifactRef[]
  readonly configuration: readonly ArtifactRef[]
}

export type EvidenceSourceRole = 'observation' | 'procedure' | 'raw_output' | 'attachment'

export interface EvidenceSource {
  readonly artifact: ArtifactRef
  readonly role: EvidenceSourceRole
}

export type EvidenceResult = 'supports' | 'contradicts' | 'inconclusive'

export interface Evidence {
  readonly id: EvidenceId
  readonly kind: EvidenceKindId
  readonly kindVersion: number
  readonly claim: string
  readonly result: EvidenceResult
  readonly subjects: readonly EvidenceSubjectRef[]
  readonly reality: EvidenceReality
  readonly sources: readonly EvidenceSource[]
  readonly observedAt: string
  readonly payload: JsonValue
}

export type EvidenceInvalidationReason =
  | 'corrupt_source'
  | 'wrong_target'
  | 'invalid_procedure'
  | 'incorrect_observation'
  | 'revoked_attestation'
  | 'duplicate'
  | 'other'

export interface EvidenceInvalidationRecord {
  readonly evidenceId: EvidenceId
  readonly reason: EvidenceInvalidationReason
  readonly basis: readonly EvidenceRef[]
  readonly invalidatedAt: string
  readonly invalidatedBy: ActorRef
  readonly detail?: string
}

export type FindingType =
  | 'bug'
  | 'requirement_gap'
  | 'performance_regression'
  | 'test_failure'
  | 'security'
  | 'ux'
  | 'release_failure'
  | 'production_regression'

export type FindingLifecycleState = 'open' | 'reproduced' | 'resolved' | 'invalid'

export interface Finding {
  readonly id: FindingId
  readonly type: FindingType
  readonly expected: string
  readonly actual: string
  readonly criterion?: CriterionRevisionRef
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
  readonly confidence: number
  readonly openedAt: string
  readonly openedBy: ActorRef
}

export interface Decision {
  readonly id: DecisionId
  readonly question: string
  readonly outcome: string
  readonly rationale: string
  readonly madeBy: ActorRef
  readonly madeAt: string
}

export interface Gate {
  readonly id: GateId
  readonly kind: string
  readonly createdAt: string
  readonly createdBy: ActorRef
}

export type GateState = 'pending' | 'satisfied' | 'failed' | 'not_required'

export interface GateEvaluation {
  readonly gateId: GateId
  readonly state: GateState
  readonly evidence: readonly EvidenceRef[]
  readonly evaluatedAt: string
  readonly evaluatedBy: ActorRef
}

export interface GateEvaluationInput {
  readonly gateId: GateId
  readonly state: GateState
  readonly evidence?: readonly EvidenceRef[]
  readonly evaluatedAt: string
  readonly evaluatedBy: ActorRef
}

export interface Run {
  readonly id: RunId
  readonly objective: string
  readonly contextPackHash: string
  readonly inputGraphRevision: GraphRevision
  readonly runtime: string
  readonly status: 'succeeded' | 'failed' | 'cancelled'
  readonly startedAt: string
  readonly finishedAt: string
}

export interface ChangeDispositionRecord {
  readonly changeId: ChangeId
  readonly disposition: ChangeDisposition
  readonly closedAt: string
  readonly closedBy: ActorRef
  readonly reason?: string
}

export interface FindingLifecycleRecord {
  readonly findingId: FindingId
  readonly state: FindingLifecycleState
  readonly evidence: readonly EvidenceRef[]
  readonly updatedAt: string
}

export interface ExecutionBudget {
  readonly maxTokens?: number
  readonly maxCostUsd?: number
  readonly maxDurationMs?: number
}
