import {
  graphNodeKey,
  graphNodeRef,
  type ChangeGraphSnapshot,
  type ChangeId,
  type CriterionRevision,
  type GateEvaluation,
  type GraphNode,
  type GraphNodeRef,
  type Relation,
} from '@orven/internal-domain'
import type {
  BuildGraphViewOptions,
  GraphNodeDetails,
  GraphViewEdge,
  GraphViewModel,
  GraphViewNode,
} from './types.js'

const NODE_WIDTH = 224
const NODE_HEIGHT = 76
const LAYER_GAP = 320
const ROW_GAP = 128
const MARGIN_X = 72
const MARGIN_Y = 72

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1))}…`
}

function latestCriterionRevision(
  snapshot: ChangeGraphSnapshot,
  criterionId: string,
): CriterionRevision | undefined {
  return snapshot.criterionRevisions
    .filter(revision => String(revision.criterionId) === criterionId)
    .sort((left, right) => right.revision - left.revision)[0]
}

function latestGateEvaluation(
  snapshot: ChangeGraphSnapshot,
  gateId: string,
): GateEvaluation | undefined {
  return snapshot.gateEvaluations
    .filter(evaluation => String(evaluation.gateId) === gateId)
    .at(-1)
}

function labelFor(
  snapshot: ChangeGraphSnapshot,
  node: GraphNode,
): { readonly title: string; readonly subtitle: string } {
  switch (node.kind) {
    case 'change':
      return {
        title: truncate(node.value.title, 46),
        subtitle: node.value.kind,
      }
    case 'criterion': {
      const latest = latestCriterionRevision(snapshot, String(node.value.id))
      return {
        title: String(node.value.id),
        subtitle: latest === undefined
          ? 'criterion'
          : truncate(`r${latest.revision} · ${latest.statement}`, 48),
      }
    }
    case 'artifact':
      return {
        title: truncate(node.value.type, 46),
        subtitle: String(node.value.id),
      }
    case 'evidence':
      return {
        title: truncate(node.value.claim, 46),
        subtitle: node.value.result,
      }
    case 'finding':
      return {
        title: node.value.type,
        subtitle: node.value.severity,
      }
    case 'decision':
      return {
        title: truncate(node.value.question, 46),
        subtitle: truncate(node.value.outcome, 48),
      }
    case 'gate': {
      const evaluation = latestGateEvaluation(snapshot, String(node.value.id))
      return {
        title: node.value.kind,
        subtitle: evaluation?.state ?? 'pending',
      }
    }
    case 'run':
      return {
        title: truncate(node.value.objective, 46),
        subtitle: node.value.status,
      }
  }
}

function chooseRoot(
  nodes: readonly GraphNode[],
  rootChangeId?: ChangeId,
): GraphNodeRef | undefined {
  if (rootChangeId !== undefined) {
    const match = nodes.find(
      node => node.kind === 'change' && node.value.id === rootChangeId,
    )
    if (match !== undefined) return graphNodeRef(match)
  }

  const firstChange = nodes.find(node => node.kind === 'change')
  if (firstChange !== undefined) return graphNodeRef(firstChange)

  return nodes[0] === undefined ? undefined : graphNodeRef(nodes[0])
}

function buildAdjacency(
  nodes: readonly GraphNode[],
  relations: readonly Relation[],
): Map<string, Set<string>> {
  const keys = new Set(nodes.map(node => graphNodeKey(graphNodeRef(node))))
  const adjacency = new Map<string, Set<string>>()
  for (const key of keys) adjacency.set(key, new Set())

  for (const relation of relations) {
    const source = graphNodeKey(relation.source)
    const target = graphNodeKey(relation.target)
    if (!keys.has(source) || !keys.has(target)) continue
    adjacency.get(source)?.add(target)
    adjacency.get(target)?.add(source)
  }

  return adjacency
}

function componentLayers(
  sortedKeys: readonly string[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  rootKey: string | undefined,
): Map<string, number> {
  const layers = new Map<string, number>()
  let nextBase = 0

  const visit = (seed: string, base: number): number => {
    const queue: Array<{ readonly key: string; readonly distance: number }> = [
      { key: seed, distance: 0 },
    ]
    let maxDistance = 0

    while (queue.length > 0) {
      const current = queue.shift()
      if (current === undefined || layers.has(current.key)) continue

      layers.set(current.key, base + current.distance)
      maxDistance = Math.max(maxDistance, current.distance)

      const neighbors = [...(adjacency.get(current.key) ?? [])].sort(compareText)
      for (const neighbor of neighbors) {
        if (!layers.has(neighbor)) {
          queue.push({ key: neighbor, distance: current.distance + 1 })
        }
      }
    }

    return base + maxDistance
  }

  if (rootKey !== undefined) {
    nextBase = visit(rootKey, 0) + 1
  }

  for (const key of sortedKeys) {
    if (layers.has(key)) continue
    nextBase = visit(key, nextBase) + 1
  }

  return layers
}

function parallelLanes(relations: readonly Relation[]): Map<string, number> {
  const groups = new Map<string, Relation[]>()
  for (const relation of relations) {
    const key = `${graphNodeKey(relation.source)}->${graphNodeKey(relation.target)}`
    const list = groups.get(key) ?? []
    list.push(relation)
    groups.set(key, list)
  }

  const lanes = new Map<string, number>()
  for (const list of groups.values()) {
    const sorted = [...list].sort((left, right) =>
      compareText(String(left.id), String(right.id)),
    )
    const center = (sorted.length - 1) / 2
    sorted.forEach((relation, index) => {
      lanes.set(String(relation.id), index - center)
    })
  }
  return lanes
}

export function buildGraphViewModel(
  snapshot: ChangeGraphSnapshot,
  options: BuildGraphViewOptions = {},
): GraphViewModel {
  const domainNodes = [...snapshot.nodes].sort((left, right) =>
    compareText(
      graphNodeKey(graphNodeRef(left)),
      graphNodeKey(graphNodeRef(right)),
    ),
  )
  const root = chooseRoot(domainNodes, options.rootChangeId)
  const rootKey = root === undefined ? undefined : graphNodeKey(root)
  const adjacency = buildAdjacency(domainNodes, snapshot.relations)
  const keys = domainNodes.map(node => graphNodeKey(graphNodeRef(node)))
  const layers = componentLayers(keys, adjacency, rootKey)

  const byLayer = new Map<number, GraphNode[]>()
  for (const node of domainNodes) {
    const key = graphNodeKey(graphNodeRef(node))
    const layer = layers.get(key) ?? 0
    const list = byLayer.get(layer) ?? []
    list.push(node)
    byLayer.set(layer, list)
  }

  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  for (const relation of snapshot.relations) {
    const source = graphNodeKey(relation.source)
    const target = graphNodeKey(relation.target)
    outgoing.set(source, (outgoing.get(source) ?? 0) + 1)
    incoming.set(target, (incoming.get(target) ?? 0) + 1)
  }

  const viewNodes: GraphViewNode[] = []
  const positions = new Map<string, GraphViewNode>()

  for (const layer of [...byLayer.keys()].sort((left, right) => left - right)) {
    const nodes = [...(byLayer.get(layer) ?? [])].sort((left, right) =>
      compareText(
        graphNodeKey(graphNodeRef(left)),
        graphNodeKey(graphNodeRef(right)),
      ),
    )

    nodes.forEach((domain, row) => {
      const ref = graphNodeRef(domain)
      const key = graphNodeKey(ref)
      const label = labelFor(snapshot, domain)
      const view: GraphViewNode = {
        ref,
        key,
        kind: ref.kind,
        title: label.title,
        subtitle: label.subtitle,
        x: MARGIN_X + layer * LAYER_GAP,
        y: MARGIN_Y + row * ROW_GAP,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        incomingCount: incoming.get(key) ?? 0,
        outgoingCount: outgoing.get(key) ?? 0,
        domain,
      }
      viewNodes.push(view)
      positions.set(key, view)
    })
  }

  const activeRelations = [...snapshot.relations].sort((left, right) =>
    compareText(String(left.id), String(right.id)),
  )
  const lanes = parallelLanes(activeRelations)
  const edges: GraphViewEdge[] = []

  for (const relation of activeRelations) {
    const sourceKey = graphNodeKey(relation.source)
    const targetKey = graphNodeKey(relation.target)
    const source = positions.get(sourceKey)
    const target = positions.get(targetKey)
    if (source === undefined || target === undefined) continue

    edges.push({
      id: String(relation.id),
      kind: relation.kind,
      source: relation.source,
      target: relation.target,
      sourceKey,
      targetKey,
      sourceX: source.x + source.width / 2,
      sourceY: source.y + source.height / 2,
      targetX: target.x + target.width / 2,
      targetY: target.y + target.height / 2,
      lane: lanes.get(String(relation.id)) ?? 0,
      relation,
    })
  }

  const width = viewNodes.length === 0
    ? 640
    : Math.max(...viewNodes.map(node => node.x + node.width)) + MARGIN_X
  const height = viewNodes.length === 0
    ? 360
    : Math.max(...viewNodes.map(node => node.y + node.height)) + MARGIN_Y

  return {
    graphId: String(snapshot.graphId),
    revision: snapshot.revision,
    ...(root === undefined ? {} : { root }),
    nodes: viewNodes.sort((left, right) => compareText(left.key, right.key)),
    edges,
    bounds: { width, height },
  }
}

export function graphNodeDetails(
  model: GraphViewModel,
  ref: GraphNodeRef,
): GraphNodeDetails | undefined {
  const key = graphNodeKey(ref)
  const node = model.nodes.find(candidate => candidate.key === key)
  if (node === undefined) return undefined

  return {
    node,
    incoming: model.edges.filter(edge => edge.targetKey === key),
    outgoing: model.edges.filter(edge => edge.sourceKey === key),
  }
}
