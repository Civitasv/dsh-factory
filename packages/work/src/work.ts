import { createHash } from 'node:crypto'
import type { ContextQuery, ContextSelectionBudget, RelationKind } from '@dsh-factory/core'
import type {
  CapabilityId,
  WorkContextRequest,
  WorkDemand,
  WorkId,
  WorkItem,
  WorkPriority,
  WorkSource,
} from './types.js'

const PRIORITIES = new Set<WorkPriority>(['critical', 'high', 'normal', 'low'])

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function nonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
}

function canonicalQuery(query: ContextQuery): ContextQuery {
  nonNegativeSafeInteger(query.maxDepth, 'Work Context maxDepth')
  return {
    direction: query.direction,
    relationKinds: [...new Set<RelationKind>(query.relationKinds)].sort(compareText),
    maxDepth: query.maxDepth,
    includeSubjectEvidence: query.includeSubjectEvidence,
  }
}

function canonicalBudget(budget: ContextSelectionBudget): ContextSelectionBudget {
  nonNegativeSafeInteger(budget.maxNodes, 'Work Context maxNodes')
  nonNegativeSafeInteger(budget.maxRelations, 'Work Context maxRelations')
  nonNegativeSafeInteger(
    budget.maxCriterionRevisions,
    'Work Context maxCriterionRevisions',
  )
  if (budget.maxNodes < 1) {
    throw new Error('Work Context maxNodes must reserve the root Change')
  }
  return { ...budget }
}

function canonicalSource(source: WorkSource): WorkSource {
  if (source.kind === 'criterion_revision') {
    if (!Number.isSafeInteger(source.revision.revision) || source.revision.revision <= 0) {
      throw new Error('Work source Criterion revision must be a positive safe integer')
    }
    return source
  }
  return source
}

function canonicalContext(context: WorkContextRequest): WorkContextRequest {
  return {
    query: canonicalQuery(context.query),
    budget: canonicalBudget(context.budget),
  }
}

function canonicalCapabilities(
  capabilities: readonly CapabilityId[],
): readonly CapabilityId[] {
  const values = [...new Set(capabilities.map(String))].sort(compareText)
  if (values.length === 0) {
    throw new Error('Work requires at least one capability')
  }
  if (values.some(value => value.trim() === '')) {
    throw new Error('Work capabilities must be non-empty')
  }
  return values as CapabilityId[]
}

function sourceKey(source: WorkSource): string {
  if (source.kind === 'criterion_revision') {
    return `criterion:${source.revision.criterionId}@${source.revision.revision}`
  }
  return `${source.node.kind}:${source.node.id}`
}

function deterministicId(
  demand: Omit<WorkItem, 'id'>,
): WorkId {
  const payload = JSON.stringify({
    changeId: demand.changeId,
    graphRevision: demand.graphRevision,
    objective: demand.objective,
    requiredCapabilities: demand.requiredCapabilities,
    priority: demand.priority,
    source: sourceKey(demand.source),
    context: demand.context,
  })
  const digest = createHash('sha256').update(payload).digest('hex').slice(0, 32)
  return `work:${digest}` as WorkId
}

export function materializeWork(demand: WorkDemand): WorkItem {
  if (demand.objective.trim() === '') {
    throw new Error('Work objective must be non-empty')
  }
  if (!PRIORITIES.has(demand.priority)) {
    throw new Error(`Invalid Work priority ${demand.priority}`)
  }

  const canonical: Omit<WorkItem, 'id'> = {
    changeId: demand.changeId,
    graphRevision: demand.graphRevision,
    objective: demand.objective,
    requiredCapabilities: canonicalCapabilities(demand.requiredCapabilities),
    priority: demand.priority,
    source: canonicalSource(demand.source),
    context: canonicalContext(demand.context),
  }

  return {
    id: deterministicId(canonical),
    ...canonical,
  }
}
