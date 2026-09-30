import type {
  ChangeGraphSnapshot,
  ChangeId,
  GraphNode,
  GraphNodeRef,
  GraphRevision,
  Relation,
  RelationKind,
} from '@orven/internal-domain'

export interface GraphViewNode {
  readonly ref: GraphNodeRef
  readonly key: string
  readonly kind: GraphNodeRef['kind']
  readonly title: string
  readonly subtitle: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly incomingCount: number
  readonly outgoingCount: number
  readonly domain: GraphNode
}

export interface GraphViewEdge {
  readonly id: string
  readonly kind: RelationKind
  readonly source: GraphNodeRef
  readonly target: GraphNodeRef
  readonly sourceKey: string
  readonly targetKey: string
  readonly sourceX: number
  readonly sourceY: number
  readonly targetX: number
  readonly targetY: number
  readonly lane: number
  readonly relation: Relation
}

export interface GraphBounds {
  readonly width: number
  readonly height: number
}

export interface GraphViewModel {
  readonly graphId: string
  readonly revision: GraphRevision
  readonly root?: GraphNodeRef
  readonly nodes: readonly GraphViewNode[]
  readonly edges: readonly GraphViewEdge[]
  readonly bounds: GraphBounds
}

export interface BuildGraphViewOptions {
  readonly rootChangeId?: ChangeId
}

export interface GraphNodeDetails {
  readonly node: GraphViewNode
  readonly incoming: readonly GraphViewEdge[]
  readonly outgoing: readonly GraphViewEdge[]
}

export interface GraphUiAction {
  readonly id: string
  readonly label: string
}

export interface GraphExplorerOptions extends BuildGraphViewOptions {
  readonly ariaLabel?: string
  readonly actionsForNode?: (node: GraphViewNode) => readonly GraphUiAction[]
  readonly onAction?: (action: GraphUiAction, node: GraphViewNode) => void
  readonly onSelectNode?: (node: GraphViewNode | undefined) => void
}

export interface GraphExplorerController {
  readonly selectedNode: () => GraphViewNode | undefined
  readonly model: () => GraphViewModel
  readonly selectNode: (ref: GraphNodeRef | undefined) => void
  readonly fit: () => void
  readonly updateSnapshot: (snapshot: ChangeGraphSnapshot) => void
  readonly destroy: () => void
}
