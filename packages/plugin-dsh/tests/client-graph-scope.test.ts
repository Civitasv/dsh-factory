import { describe, expect, it } from 'vitest'
import type { ChangeGraphSnapshot } from '@orven/core'
import { scopeSnapshotToChange } from '../src/client/graph-scope.js'

const actor = { kind: 'system', id: 'test' } as const

function snapshot(): ChangeGraphSnapshot {
  return {
    graphId: 'graph' as never,
    revision: 4 as never,
    nodes: [
      {
        kind: 'change',
        value: {
          id: 'change:active' as never,
          kind: 'feature',
          title: 'Active',
          createdAt: '2026-09-30T00:00:00.000Z',
          createdBy: actor,
        },
      },
      {
        kind: 'criterion',
        value: {
          id: 'criterion:active' as never,
          createdAt: '2026-09-30T00:00:00.000Z',
          createdBy: actor,
        },
      },
      {
        kind: 'evidence',
        value: {
          id: 'evidence:active' as never,
          kind: { kind: 'test' as never, version: 1 },
          subject: {
            kind: 'criterion_revision',
            revision: {
              criterionId: 'criterion:active' as never,
              revision: 1,
            },
          },
          reality: {
            targets: [],
            environment: [],
            configuration: [],
          },
          sources: [],
          result: 'supports',
          observedAt: '2026-09-30T00:00:00.000Z',
          observedBy: actor,
        },
      },
      {
        kind: 'change',
        value: {
          id: 'change:other' as never,
          kind: 'feature',
          title: 'Other',
          createdAt: '2026-09-30T00:00:00.000Z',
          createdBy: actor,
        },
      },
    ],
    relations: [
      {
        id: 'relation:criterion' as never,
        source: { kind: 'change', id: 'change:active' as never },
        target: { kind: 'criterion', id: 'criterion:active' as never },
        kind: 'has_criterion',
        createdAt: '2026-09-30T00:00:00.000Z',
        createdBy: actor,
      },
      {
        id: 'relation:evidence' as never,
        source: { kind: 'evidence', id: 'evidence:active' as never },
        target: { kind: 'criterion', id: 'criterion:active' as never },
        kind: 'supports',
        createdAt: '2026-09-30T00:00:00.000Z',
        createdBy: actor,
      },
    ],
    retiredRelationIds: [],
    criterionRevisions: [{
      criterionId: 'criterion:active' as never,
      revision: 1,
      statement: 'Active criterion',
      evidenceRequirements: [],
      severity: 'required',
      publishedAt: '2026-09-30T00:00:00.000Z',
      publishedBy: actor,
    }],
    evidenceInvalidations: [{
      evidenceId: 'evidence:active' as never,
      reason: 'superseded',
      basis: [],
      invalidatedAt: '2026-09-30T00:00:00.000Z',
      invalidatedBy: actor,
    }],
    changeDispositions: [{
      changeId: 'change:other' as never,
      disposition: 'completed',
      closedAt: '2026-09-30T00:00:00.000Z',
      closedBy: actor,
    }],
    findingLifecycles: [],
    gateEvaluations: [],
  }
}

describe('scopeSnapshotToChange', () => {
  it('keeps only the active Change connected component and matching records', () => {
    const scoped = scopeSnapshotToChange(snapshot(), 'change:active')

    expect(scoped.nodes.map(node => String(node.value.id))).toEqual([
      'change:active',
      'criterion:active',
      'evidence:active',
    ])
    expect(scoped.relations).toHaveLength(2)
    expect(scoped.criterionRevisions).toHaveLength(1)
    expect(scoped.evidenceInvalidations).toHaveLength(1)
    expect(scoped.changeDispositions).toEqual([])
  })

  it('returns the original snapshot when the active Change is absent', () => {
    const source = snapshot()
    expect(scopeSnapshotToChange(source, 'missing')).toBe(source)
  })
})
