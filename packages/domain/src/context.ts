import type {
  ChangeDispositionRecord,
  CriterionRevision,
  EvidenceInvalidationRecord,
  FindingLifecycleRecord,
  GateEvaluation,
} from './domain.js'
import type { GraphNode, Relation, RelationKind } from './graph.js'
import type { ChangeId, GraphId, GraphRevision } from './ids.js'
import type { GraphNodeRef } from './refs.js'

export type ContextDirection = 'outbound' | 'inbound' | 'both'

export interface ContextQuery {
  readonly direction: ContextDirection
  readonly relationKinds: readonly RelationKind[]
  readonly maxDepth: number
  readonly includeSubjectEvidence: boolean
}

export interface ContextSelectionBudget {
  readonly maxNodes: number
  readonly maxRelations: number
  readonly maxCriterionRevisions: number
}

export type ContextInclusionReason =
  | 'root'
  | 'evidence-subject'
  | `relation:${RelationKind}`

export interface ContextNodeProvenance {
  readonly node: GraphNodeRef
  readonly reasons: readonly ContextInclusionReason[]
}

export interface GraphSlice {
  readonly graphId: GraphId
  readonly revision: GraphRevision
  readonly nodes: readonly GraphNode[]
  readonly relations: readonly Relation[]
  readonly criterionRevisions: readonly CriterionRevision[]
  readonly evidenceInvalidations: readonly EvidenceInvalidationRecord[]
  readonly changeDispositions: readonly ChangeDispositionRecord[]
  readonly findingLifecycles: readonly FindingLifecycleRecord[]
  readonly gateEvaluations: readonly GateEvaluation[]
  readonly provenance: readonly ContextNodeProvenance[]
  readonly omittedNodes: readonly GraphNodeRef[]
}

export interface ContextPack {
  readonly changeId: ChangeId
  readonly graphId: GraphId
  readonly graphRevision: GraphRevision
  readonly objective: string
  readonly query: ContextQuery
  readonly slice: GraphSlice
  readonly availableCapabilities: readonly string[]
  readonly permissions: readonly string[]
  readonly budget: ContextSelectionBudget
}

export interface CompiledContext {
  readonly pack: ContextPack
  readonly hash: string
}
