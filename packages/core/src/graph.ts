import type {
  Artifact,
  Change,
  ChangeDispositionRecord,
  Criterion,
  CriterionRevision,
  Decision,
  Evidence,
  EvidenceInvalidationRecord,
  Finding,
  FindingLifecycleRecord,
  Gate,
  GateEvaluation,
  Run,
  ActorRef,
} from './domain.js'
import type { GraphId, GraphRevision, RelationId } from './ids.js'
import { graphNodeKey, type GraphNodeRef } from './refs.js'

export type RelationKind =
  | 'has_intent'
  | 'has_criterion'
  | 'constrained_by'
  | 'decomposes_into'
  | 'depends_on'
  | 'supersedes'
  | 'attempts'
  | 'produces'
  | 'observed_on'
  | 'supports'
  | 'contradicts'
  | 'evaluates'
  | 'raises'
  | 'addresses'
  | 'caused_by'
  | 'governs'

export const ACYCLIC_RELATION_KINDS = [
  'decomposes_into',
  'depends_on',
  'supersedes',
] as const satisfies readonly RelationKind[]

export type AcyclicRelationKind = (typeof ACYCLIC_RELATION_KINDS)[number]

export interface Relation {
  readonly id: RelationId
  readonly source: GraphNodeRef
  readonly target: GraphNodeRef
  readonly kind: RelationKind
  readonly createdAt: string
  readonly createdBy: ActorRef
}

export type GraphNode =
  | { readonly kind: 'change'; readonly value: Change }
  | { readonly kind: 'criterion'; readonly value: Criterion }
  | { readonly kind: 'artifact'; readonly value: Artifact }
  | { readonly kind: 'evidence'; readonly value: Evidence }
  | { readonly kind: 'finding'; readonly value: Finding }
  | { readonly kind: 'decision'; readonly value: Decision }
  | { readonly kind: 'gate'; readonly value: Gate }
  | { readonly kind: 'run'; readonly value: Run }

export interface ChangeGraphSnapshot {
  readonly graphId: GraphId
  readonly revision: GraphRevision
  readonly nodes: readonly GraphNode[]
  readonly relations: readonly Relation[]
  readonly retiredRelationIds: readonly RelationId[]
  readonly criterionRevisions: readonly CriterionRevision[]
  readonly evidenceInvalidations: readonly EvidenceInvalidationRecord[]
  readonly changeDispositions: readonly ChangeDispositionRecord[]
  readonly findingLifecycles: readonly FindingLifecycleRecord[]
  readonly gateEvaluations: readonly GateEvaluation[]
}

export function graphNodeRef(node: GraphNode): GraphNodeRef {
  return { kind: node.kind, id: node.value.id } as GraphNodeRef
}

export function isAcyclicRelationKind(kind: RelationKind): kind is AcyclicRelationKind {
  return (ACYCLIC_RELATION_KINDS as readonly RelationKind[]).includes(kind)
}

export function assertRelationShape(relation: Relation): void {
  const { source, target, kind } = relation

  const valid = (() => {
    switch (kind) {
      case 'has_intent':
      case 'constrained_by':
        return source.kind === 'change' && target.kind === 'artifact'
      case 'has_criterion':
        return source.kind === 'change' && target.kind === 'criterion'
      case 'decomposes_into':
      case 'depends_on':
      case 'supersedes':
        return source.kind === 'change' && target.kind === 'change'
      case 'attempts':
        return source.kind === 'run' && target.kind === 'change'
      case 'produces':
        return source.kind === 'run' && ['artifact', 'evidence', 'finding', 'decision'].includes(target.kind)
      case 'observed_on':
        return source.kind === 'evidence' && target.kind === 'artifact'
      case 'supports':
      case 'contradicts':
        return source.kind === 'evidence'
      case 'evaluates':
        return source.kind === 'gate' && target.kind === 'criterion'
      case 'raises':
        return source.kind === 'evidence' && target.kind === 'finding'
      case 'addresses':
        return source.kind === 'change' && target.kind === 'finding'
      case 'caused_by':
        return source.kind === 'finding'
      case 'governs':
        return source.kind === 'decision'
    }
  })()

  if (!valid) {
    throw new Error(
      `Invalid relation shape for ${kind}: ${source.kind} -> ${target.kind}`,
    )
  }
}

export function assertRelationCanBeAdded(
  activeRelations: readonly Relation[],
  relation: Relation,
): void {
  assertRelationShape(relation)

  if (!isAcyclicRelationKind(relation.kind)) return

  const sourceKey = graphNodeKey(relation.source)
  const targetKey = graphNodeKey(relation.target)

  if (sourceKey === targetKey) {
    throw new Error(`Relation ${relation.kind} cannot contain a self-cycle`)
  }

  const adjacency = new Map<string, string[]>()

  for (const edge of activeRelations) {
    if (edge.kind !== relation.kind) continue
    const key = graphNodeKey(edge.source)
    const neighbors = adjacency.get(key) ?? []
    neighbors.push(graphNodeKey(edge.target))
    adjacency.set(key, neighbors)
  }

  const pending = [targetKey]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined || visited.has(current)) continue
    if (current === sourceKey) {
      throw new Error(`Relation ${relation.kind} would introduce a cycle`)
    }

    visited.add(current)
    pending.push(...(adjacency.get(current) ?? []))
  }
}
