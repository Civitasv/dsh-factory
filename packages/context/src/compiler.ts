import { createHash } from 'node:crypto'
import {
  graphNodeKey,
  graphNodeRef,
  type ChangeGraphSnapshot,
  type ChangeId,
  type CompiledContext,
  type ContextInclusionReason,
  type ContextNodeProvenance,
  type ContextPack,
  type ContextQuery,
  type ContextSelectionBudget,
  type CriterionRevision,
  type GraphNode,
  type GraphNodeRef,
  type GraphSlice,
  type JsonValue,
  type Relation,
  type RelationKind,
} from '@dsh-factory/core'

export interface CompileContextInput {
  readonly snapshot: ChangeGraphSnapshot
  readonly changeId: ChangeId
  readonly objective: string
  readonly query: ContextQuery
  readonly budget: ContextSelectionBudget
  readonly availableCapabilities?: readonly string[]
  readonly permissions?: readonly string[]
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function nodeKey(node: GraphNode): string {
  return graphNodeKey(graphNodeRef(node))
}

function compareNodes(left: GraphNode, right: GraphNode): number {
  return compareText(nodeKey(left), nodeKey(right))
}

function compareRefs(left: GraphNodeRef, right: GraphNodeRef): number {
  return compareText(graphNodeKey(left), graphNodeKey(right))
}

function compareRelations(left: Relation, right: Relation): number {
  return compareText(String(left.id), String(right.id))
}

function compareCriterionRevisions(left: CriterionRevision, right: CriterionRevision): number {
  const criterion = compareText(String(left.criterionId), String(right.criterionId))
  return criterion === 0 ? left.revision - right.revision : criterion
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
}

function validateInput(input: CompileContextInput): void {
  if (input.objective.trim() === '') {
    throw new Error('Context objective must be non-empty')
  }

  assertNonNegativeSafeInteger(input.query.maxDepth, 'Context query maxDepth')
  assertNonNegativeSafeInteger(input.budget.maxNodes, 'Context budget maxNodes')
  assertNonNegativeSafeInteger(input.budget.maxRelations, 'Context budget maxRelations')
  assertNonNegativeSafeInteger(
    input.budget.maxCriterionRevisions,
    'Context budget maxCriterionRevisions',
  )

  if (input.budget.maxNodes < 1) {
    throw new Error('Context budget maxNodes must reserve the root Change')
  }
}

function relationAllowed(query: ContextQuery, relation: Relation): boolean {
  return query.relationKinds.includes(relation.kind)
}

function neighborFor(
  current: GraphNodeRef,
  relation: Relation,
  direction: ContextQuery['direction'],
): GraphNodeRef | undefined {
  const currentKey = graphNodeKey(current)
  const sourceMatches = graphNodeKey(relation.source) === currentKey
  const targetMatches = graphNodeKey(relation.target) === currentKey

  if ((direction === 'outbound' || direction === 'both') && sourceMatches) {
    return relation.target
  }
  if ((direction === 'inbound' || direction === 'both') && targetMatches) {
    return relation.source
  }
  return undefined
}

function canonicalize(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('ContextPack contains a non-finite number')
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => canonicalize(item))
  }

  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {}
    for (const key of Object.keys(value).sort(compareText)) {
      const child = (value as Record<string, unknown>)[key]
      if (child !== undefined) result[key] = canonicalize(child)
    }
    return result
  }

  throw new Error('ContextPack contains a non-JSON value')
}

export function canonicalContextJson(pack: ContextPack): string {
  return JSON.stringify(canonicalize(pack))
}

export function hashContextPack(pack: ContextPack): string {
  return createHash('sha256').update(canonicalContextJson(pack)).digest('hex')
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareText)
}

export function compileContext(input: CompileContextInput): CompiledContext {
  validateInput(input)

  const nodesByKey = new Map(
    [...input.snapshot.nodes].sort(compareNodes).map(node => [nodeKey(node), node]),
  )
  const rootRef: GraphNodeRef = { kind: 'change', id: input.changeId }
  const rootKey = graphNodeKey(rootRef)
  const rootNode = nodesByKey.get(rootKey)
  if (rootNode === undefined) {
    throw new Error(`Context root Change ${input.changeId} does not exist`)
  }

  const relations = [...input.snapshot.relations]
    .filter(relation => relationAllowed(input.query, relation))
    .sort(compareRelations)

  const selected = new Map<string, GraphNode>([[rootKey, rootNode]])
  const provenance = new Map<string, Set<ContextInclusionReason>>([
    [rootKey, new Set<ContextInclusionReason>(['root'])],
  ])
  const omitted = new Map<string, GraphNodeRef>()
  const selectedRelations = new Map<string, Relation>()
  const queue: Array<{ readonly ref: GraphNodeRef; readonly depth: number }> = [
    { ref: rootRef, depth: 0 },
  ]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined || current.depth >= input.query.maxDepth) continue

    for (const relation of relations) {
      const neighbor = neighborFor(current.ref, relation, input.query.direction)
      if (neighbor === undefined) continue

      const neighborKey = graphNodeKey(neighbor)
      const reason = `relation:${relation.kind}` as ContextInclusionReason
      const alreadySelected = selected.has(neighborKey)

      if (!alreadySelected) {
        const neighborNode = nodesByKey.get(neighborKey)
        if (neighborNode === undefined) {
          throw new Error(`Relation ${relation.id} references missing node ${neighborKey}`)
        }

        if (
          selected.size >= input.budget.maxNodes ||
          selectedRelations.size >= input.budget.maxRelations
        ) {
          omitted.set(neighborKey, neighbor)
          continue
        }

        selected.set(neighborKey, neighborNode)
        provenance.set(neighborKey, new Set<ContextInclusionReason>([reason]))
        selectedRelations.set(String(relation.id), relation)
        queue.push({ ref: neighbor, depth: current.depth + 1 })
        continue
      }

      provenance.get(neighborKey)?.add(reason)
      if (
        selectedRelations.size < input.budget.maxRelations &&
        !selectedRelations.has(String(relation.id))
      ) {
        selectedRelations.set(String(relation.id), relation)
      }
    }
  }

  if (input.query.includeSubjectEvidence) {
    const selectedCriterionIds = new Set(
      [...selected.values()]
        .filter(node => node.kind === 'criterion')
        .map(node => node.value.id),
    )
    const evidenceNodes = [...input.snapshot.nodes]
      .filter((node): node is Extract<GraphNode, { readonly kind: 'evidence' }> =>
        node.kind === 'evidence',
      )
      .sort(compareNodes)

    for (const evidenceNode of evidenceNodes) {
      const evidenceRef = graphNodeRef(evidenceNode)
      const evidenceKey = graphNodeKey(evidenceRef)
      if (selected.has(evidenceKey)) continue

      const relevant = evidenceNode.value.subjects.some(subject => {
        if (subject.kind === 'node') {
          return selected.has(graphNodeKey(subject.node))
        }
        return selectedCriterionIds.has(subject.revision.criterionId)
      })
      if (!relevant) continue

      if (selected.size >= input.budget.maxNodes) {
        omitted.set(evidenceKey, evidenceRef)
        continue
      }

      selected.set(evidenceKey, evidenceNode)
      provenance.set(
        evidenceKey,
        new Set<ContextInclusionReason>(['evidence-subject']),
      )
    }
  }

  const selectedNodes = [...selected.values()].sort(compareNodes)
  const selectedNodeKeys = new Set(selectedNodes.map(nodeKey))
  const criterionIds = new Set(
    selectedNodes
      .filter(node => node.kind === 'criterion')
      .map(node => node.value.id),
  )
  const evidenceIds = new Set(
    selectedNodes
      .filter(node => node.kind === 'evidence')
      .map(node => node.value.id),
  )
  const changeIds = new Set(
    selectedNodes
      .filter(node => node.kind === 'change')
      .map(node => node.value.id),
  )
  const findingIds = new Set(
    selectedNodes
      .filter(node => node.kind === 'finding')
      .map(node => node.value.id),
  )
  const gateIds = new Set(
    selectedNodes
      .filter(node => node.kind === 'gate')
      .map(node => node.value.id),
  )

  const slice: GraphSlice = {
    graphId: input.snapshot.graphId,
    revision: input.snapshot.revision,
    nodes: selectedNodes,
    relations: [...selectedRelations.values()]
      .filter(
        relation =>
          selectedNodeKeys.has(graphNodeKey(relation.source)) &&
          selectedNodeKeys.has(graphNodeKey(relation.target)),
      )
      .sort(compareRelations),
    criterionRevisions: [...input.snapshot.criterionRevisions]
      .filter(revision => criterionIds.has(revision.criterionId))
      .sort(compareCriterionRevisions)
      .slice(0, input.budget.maxCriterionRevisions),
    evidenceInvalidations: [...input.snapshot.evidenceInvalidations]
      .filter(record => evidenceIds.has(record.evidenceId))
      .sort((left, right) => compareText(String(left.evidenceId), String(right.evidenceId))),
    changeDispositions: [...input.snapshot.changeDispositions]
      .filter(record => changeIds.has(record.changeId))
      .sort((left, right) => compareText(String(left.changeId), String(right.changeId))),
    findingLifecycles: [...input.snapshot.findingLifecycles]
      .filter(record => findingIds.has(record.findingId))
      .sort((left, right) => compareText(String(left.findingId), String(right.findingId))),
    gateEvaluations: [...input.snapshot.gateEvaluations]
      .filter(record => gateIds.has(record.gateId))
      .sort((left, right) => compareText(String(left.gateId), String(right.gateId))),
    provenance: [...provenance.entries()]
      .map(([key, reasons]): ContextNodeProvenance => ({
        node: graphNodeRef(selected.get(key) as GraphNode),
        reasons: [...reasons].sort(compareText),
      }))
      .sort((left, right) => compareRefs(left.node, right.node)),
    omittedNodes: [...omitted.values()].sort(compareRefs),
  }

  const pack: ContextPack = {
    changeId: input.changeId,
    graphId: input.snapshot.graphId,
    graphRevision: input.snapshot.revision,
    objective: input.objective,
    query: {
      direction: input.query.direction,
      relationKinds: [...new Set<RelationKind>(input.query.relationKinds)].sort(compareText),
      maxDepth: input.query.maxDepth,
      includeSubjectEvidence: input.query.includeSubjectEvidence,
    },
    slice,
    availableCapabilities: uniqueSorted(input.availableCapabilities ?? []),
    permissions: uniqueSorted(input.permissions ?? []),
    budget: input.budget,
  }

  return {
    pack,
    hash: hashContextPack(pack),
  }
}
