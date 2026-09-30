import type { WorkId, WorkPlan } from './types.js'

export function validateWorkPlan(plan: WorkPlan): void {
  const items = new Map<WorkId, WorkId>()
  for (const item of plan.items) {
    if (item.graphRevision !== plan.graphRevision) {
      throw new Error(`Work ${item.id} uses another Graph Revision`)
    }
    if (items.has(item.id)) throw new Error(`Duplicate Work id ${item.id}`)
    items.set(item.id, item.id)
  }

  const edges = new Set<string>()
  const adjacency = new Map<WorkId, WorkId[]>()

  for (const dependency of plan.dependencies) {
    if (!items.has(dependency.workId) || !items.has(dependency.dependsOn)) {
      throw new Error('Work dependency references a missing Work item')
    }
    if (dependency.workId === dependency.dependsOn) {
      throw new Error(`Work ${dependency.workId} cannot depend on itself`)
    }

    const key = `${dependency.workId}->${dependency.dependsOn}`
    if (edges.has(key)) throw new Error(`Duplicate Work dependency ${key}`)
    edges.add(key)

    const next = adjacency.get(dependency.workId) ?? []
    next.push(dependency.dependsOn)
    adjacency.set(dependency.workId, next)
  }

  const visiting = new Set<WorkId>()
  const visited = new Set<WorkId>()

  const visit = (id: WorkId): void => {
    if (visiting.has(id)) throw new Error('Work Plan contains a dependency cycle')
    if (visited.has(id)) return

    visiting.add(id)
    for (const dependency of adjacency.get(id) ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of items.keys()) visit(id)
}
