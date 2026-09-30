import type {
  Brand,
  ChangeId,
  ContextQuery,
  ContextSelectionBudget,
  CriterionRevisionRef,
  GraphNodeRef,
  GraphRevision,
} from '@dsh-factory/core'

export type CapabilityId = Brand<string, 'CapabilityId'>
export type WorkId = Brand<string, 'WorkId'>

export type WorkPriority = 'critical' | 'high' | 'normal' | 'low'

export type WorkSource =
  | {
      readonly kind: 'node'
      readonly node:
        | Extract<GraphNodeRef, { readonly kind: 'change' }>
        | Extract<GraphNodeRef, { readonly kind: 'gate' }>
        | Extract<GraphNodeRef, { readonly kind: 'finding' }>
    }
  | {
      readonly kind: 'criterion_revision'
      readonly revision: CriterionRevisionRef
    }

export interface WorkContextRequest {
  readonly query: ContextQuery
  readonly budget: ContextSelectionBudget
}

export interface WorkDemand {
  readonly changeId: ChangeId
  readonly graphRevision: GraphRevision
  readonly objective: string
  readonly requiredCapabilities: readonly CapabilityId[]
  readonly priority: WorkPriority
  readonly source: WorkSource
  readonly context: WorkContextRequest
}

export interface WorkItem extends WorkDemand {
  readonly id: WorkId
}

export interface WorkerDescriptor {
  readonly id: string
  readonly capabilities: readonly CapabilityId[]
  readonly maxParallel: number
}

export interface WorkDependency {
  readonly workId: WorkId
  readonly dependsOn: WorkId
}

export interface WorkPlan {
  readonly graphRevision: GraphRevision
  readonly items: readonly WorkItem[]
  readonly dependencies: readonly WorkDependency[]
}
