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

export interface CriterionRevisionRef {
  readonly criterionId: CriterionId
  readonly revision: number
}

export type GraphNodeRef =
  | { readonly kind: 'change'; readonly id: ChangeId }
  | { readonly kind: 'criterion'; readonly id: CriterionId }
  | { readonly kind: 'artifact'; readonly id: ArtifactId }
  | { readonly kind: 'evidence'; readonly id: EvidenceId }
  | { readonly kind: 'finding'; readonly id: FindingId }
  | { readonly kind: 'decision'; readonly id: DecisionId }
  | { readonly kind: 'gate'; readonly id: GateId }
  | { readonly kind: 'run'; readonly id: RunId }

export function graphNodeKey(ref: GraphNodeRef): string {
  return `${ref.kind}:${ref.id}`
}
