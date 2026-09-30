export type Brand<T, Name extends string> = T & { readonly __brand: Name }

export type ChangeId = Brand<string, 'ChangeId'>
export type ArtifactId = Brand<string, 'ArtifactId'>
export type EvidenceId = Brand<string, 'EvidenceId'>
export type FindingId = Brand<string, 'FindingId'>
export type DecisionId = Brand<string, 'DecisionId'>
export type GateId = Brand<string, 'GateId'>
export type RunId = Brand<string, 'RunId'>
export type CriterionId = Brand<string, 'CriterionId'>

export interface ArtifactRef {
  readonly id: ArtifactId
}

export interface EvidenceRef {
  readonly id: EvidenceId
}

export interface FindingRef {
  readonly id: FindingId
}

export interface DecisionRef {
  readonly id: DecisionId
}

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

export interface EvidenceRequirement {
  readonly type: string
  readonly description: string
}

export interface AcceptanceCriterion {
  readonly id: CriterionId
  readonly statement: string
  readonly verificationMode: 'automated' | 'agent' | 'human' | 'hybrid'
  readonly evidenceRequirements: readonly EvidenceRequirement[]
  readonly severity: 'required' | 'recommended'
  readonly source?: ArtifactRef
}

export interface Change {
  readonly id: ChangeId
  readonly kind: ChangeKind
  readonly title: string
  readonly intent: ArtifactRef
  readonly parentId?: ChangeId
  readonly acceptanceCriteria: readonly AcceptanceCriterion[]
  readonly constraints: readonly ArtifactRef[]
  readonly createdAt: string
  readonly createdBy: ActorRef
  readonly version: number
}

export interface Artifact {
  readonly id: ArtifactId
  readonly changeId: ChangeId
  readonly type: string
  readonly uri?: string
  readonly digest?: string
  readonly createdAt: string
}

export interface Evidence {
  readonly id: EvidenceId
  readonly changeId: ChangeId
  readonly type: string
  readonly claim: string
  readonly sources: readonly ArtifactRef[]
  readonly result: 'pass' | 'fail' | 'inconclusive'
  readonly observedAt: string
  readonly runId?: RunId
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

export interface Finding {
  readonly id: FindingId
  readonly changeId: ChangeId
  readonly type: FindingType
  readonly expected: string
  readonly actual: string
  readonly evidence: readonly EvidenceRef[]
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
  readonly confidence: number
  readonly status: 'open' | 'reproduced' | 'resolved' | 'invalid' | 'superseded'
}

export interface Decision {
  readonly id: DecisionId
  readonly changeId: ChangeId
  readonly question: string
  readonly outcome: string
  readonly rationale: string
  readonly madeBy: ActorRef
  readonly madeAt: string
  readonly evidence: readonly EvidenceRef[]
}

export type GateState = 'pending' | 'satisfied' | 'failed' | 'not_required'

export interface Gate {
  readonly id: GateId
  readonly changeId: ChangeId
  readonly kind: string
  readonly state: GateState
  readonly evidence: readonly EvidenceRef[]
  readonly evaluatedAt?: string
}

export interface GateEvaluationInput {
  readonly id: GateId
  readonly changeId: ChangeId
  readonly kind: string
  readonly state: GateState
  readonly evidence?: readonly EvidenceRef[]
  readonly evaluatedAt?: string
}

export function createGateEvaluation(input: GateEvaluationInput): Gate {
  const evidence = input.evidence ?? []
  const terminalEvidenceState = input.state === 'satisfied' || input.state === 'failed'

  if (terminalEvidenceState && evidence.length === 0) {
    throw new Error(`Gate state ${input.state} requires evidence`)
  }

  return {
    id: input.id,
    changeId: input.changeId,
    kind: input.kind,
    state: input.state,
    evidence,
    ...(input.evaluatedAt === undefined ? {} : { evaluatedAt: input.evaluatedAt }),
  }
}

export interface Run {
  readonly id: RunId
  readonly changeId: ChangeId
  readonly objective: string
  readonly contextPackHash: string
  readonly runtime: string
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  readonly artifacts: readonly ArtifactRef[]
  readonly evidence: readonly EvidenceRef[]
  readonly findings: readonly FindingRef[]
}

export type RelationKind =
  | 'implements'
  | 'verifies'
  | 'invalidates'
  | 'depends_on'
  | 'produces'
  | 'caused_by'
  | 'fixes'
  | 'supersedes'
  | 'derived_from'
  | 'blocks'
  | 'observed_on'
  | 'satisfies'

export interface GraphNodeRef {
  readonly kind: 'change' | 'artifact' | 'evidence' | 'finding' | 'decision' | 'gate' | 'run'
  readonly id: string
}

export interface Relation {
  readonly source: GraphNodeRef
  readonly target: GraphNodeRef
  readonly kind: RelationKind
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
  readonly change: Change
  readonly objective: string
  readonly acceptanceCriteria: readonly AcceptanceCriterion[]
  readonly constraints: readonly ArtifactRef[]
  readonly currentReality: readonly ArtifactRef[]
  readonly relevantDecisions: readonly DecisionRef[]
  readonly findings: readonly FindingRef[]
  readonly evidence: readonly EvidenceRef[]
  readonly availableCapabilities: readonly string[]
  readonly permissions: readonly string[]
  readonly budget: ExecutionBudget
  readonly provenance: readonly Provenance[]
  readonly contextVersion: string
}
