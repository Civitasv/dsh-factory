import type { GraphRevision } from './ids.js'
import type {
  ArtifactRef,
  CriterionRevisionRef,
  DecisionRef,
  EvidenceRef,
  FindingRef,
  GraphNodeRef,
} from './refs.js'
import type {
  ArtifactId,
  ChangeId,
  CriterionId,
  DecisionId,
  EvidenceId,
  FindingId,
  GateId,
  RunId,
} from './ids.js'

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

export interface EvidenceRequirement {
  readonly type: string
  readonly description: string
}

export interface CriterionRevision {
  readonly criterionId: CriterionId
  readonly revision: number
  readonly statement: string
  readonly verificationMode: 'automated' | 'agent' | 'human' | 'hybrid'
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
  | { readonly kind: 'node'; readonly node: GraphNodeRef }
  | { readonly kind: 'criterion_revision'; readonly revision: CriterionRevisionRef }

export interface Evidence {
  readonly id: EvidenceId
  readonly type: string
  readonly claim: string
  readonly result: 'supports' | 'contradicts' | 'inconclusive'
  readonly sources: readonly ArtifactRef[]
  readonly subjects: readonly EvidenceSubjectRef[]
  readonly observedAt: string
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

export interface Provenance {
  readonly source: GraphNodeRef
  readonly reason: string
}

export interface ContextPack {
  readonly changeId: ChangeId
  readonly graphRevision: GraphRevision
  readonly objective: string
  readonly relevantDecisions: readonly DecisionRef[]
  readonly findings: readonly FindingRef[]
  readonly evidence: readonly EvidenceRef[]
  readonly availableCapabilities: readonly string[]
  readonly permissions: readonly string[]
  readonly budget: ExecutionBudget
  readonly provenance: readonly Provenance[]
  readonly contextVersion: string
}
