import type { ChangeGraphSnapshot } from '@orven/core'

function refKey(ref: { readonly kind: string; readonly id: unknown }): string {
  return `${ref.kind}:${String(ref.id)}`
}

export function scopeSnapshotToChange(
  snapshot: ChangeGraphSnapshot,
  activeChangeId: string,
): ChangeGraphSnapshot {
  const start = `change:${activeChangeId}`
  const nodeKeys = new Set(
    snapshot.nodes.map(node => `${node.kind}:${String(node.value.id)}`),
  )
  if (!nodeKeys.has(start)) return snapshot

  const adjacency = new Map<string, Set<string>>()
  for (const key of nodeKeys) adjacency.set(key, new Set())
  for (const relation of snapshot.relations) {
    const source = refKey(relation.source)
    const target = refKey(relation.target)
    if (!nodeKeys.has(source) || !nodeKeys.has(target)) continue
    adjacency.get(source)?.add(target)
    adjacency.get(target)?.add(source)
  }

  const included = new Set<string>()
  const pending = [start]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined || included.has(current)) continue
    included.add(current)
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!included.has(neighbor)) pending.push(neighbor)
    }
  }

  const includes = (kind: string, id: unknown): boolean =>
    included.has(`${kind}:${String(id)}`)

  return {
    ...snapshot,
    nodes: snapshot.nodes.filter(node =>
      includes(node.kind, node.value.id)),
    relations: snapshot.relations.filter(relation =>
      included.has(refKey(relation.source))
      && included.has(refKey(relation.target))),
    criterionRevisions: snapshot.criterionRevisions.filter(revision =>
      includes('criterion', revision.criterionId)),
    evidenceInvalidations: snapshot.evidenceInvalidations.filter(record =>
      includes('evidence', record.evidenceId)),
    changeDispositions: snapshot.changeDispositions.filter(record =>
      includes('change', record.changeId)),
    findingLifecycles: snapshot.findingLifecycles.filter(record =>
      includes('finding', record.findingId)),
    gateEvaluations: snapshot.gateEvaluations.filter(record =>
      includes('gate', record.gateId)),
  }
}
