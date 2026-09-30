import type {
  ActorKind,
  ActorRef,
  CriterionRevisionRef,
  DecisionId,
  EvidenceRef,
  Finding,
  FindingLifecycleRecord,
  FindingSeverity,
  Gate,
  GateEvaluationInput,
  GateId,
  GateState,
} from '@dsh-factory/core'
import type { CriterionEvidenceCoverage } from '@dsh-factory/evidence'

export interface GatePolicy {
  readonly id: string
  readonly gateKind: string
  readonly criteria: readonly CriterionRevisionRef[]
  readonly blockFindingSeverities: readonly FindingSeverity[]
  readonly notRequiredAuthorities: readonly ActorKind[]
}

export interface PolicyProfile {
  readonly id: string
  readonly gates: readonly GatePolicy[]
}

export interface NotRequiredAuthorization {
  readonly gateId: GateId
  readonly actor: ActorRef
  readonly reason: string
  readonly decisionId?: DecisionId
}

export type GateAssessmentReason =
  | 'criterion_missing'
  | 'criterion_contradicted'
  | 'criterion_conflicted'
  | 'finding_blocker'
  | 'not_required_authorized'
  | 'requirements_satisfied'

export interface GateAssessment {
  readonly gateId: GateId
  readonly gateKind: string
  readonly state: GateState
  readonly evidence: readonly EvidenceRef[]
  readonly reasons: readonly GateAssessmentReason[]
  readonly criterionCoverage: readonly CriterionEvidenceCoverage[]
  readonly blockingFindings: readonly Finding[]
}

export interface EvaluateGateInput {
  readonly gate: Gate
  readonly policy: GatePolicy
  readonly criterionCoverage: readonly CriterionEvidenceCoverage[]
  readonly findings: readonly Finding[]
  readonly findingLifecycles: readonly FindingLifecycleRecord[]
  readonly notRequired?: NotRequiredAuthorization
}

export interface GateEvaluationRecordInput {
  readonly assessment: GateAssessment
  readonly evaluatedAt: string
  readonly evaluatedBy: ActorRef
}

export function gateEvaluationInput(
  input: GateEvaluationRecordInput,
): GateEvaluationInput {
  return {
    gateId: input.assessment.gateId,
    state: input.assessment.state,
    evidence: input.assessment.evidence,
    evaluatedAt: input.evaluatedAt,
    evaluatedBy: input.evaluatedBy,
  }
}
