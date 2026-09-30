import { describe, expect, it } from 'vitest'
import {
  asGraphRevision,
  type ActorRef,
  type ChangeGraphSnapshot,
  type ChangeId,
  type EvidenceId,
  type EvidenceKindId,
  type FindingId,
  type GraphId,
  type RelationId,
} from '@orven/internal-domain'
import {
  buildGraphViewModel,
  graphNodeDetails,
  renderGraphSvgMarkup,
} from './index.js'

const actor: ActorRef = { kind: 'system', id: 'ui-test' }
const graphId = 'GRAPH-UI' as GraphId
const changeA = 'CHG-A' as ChangeId
const changeB = 'CHG-B' as ChangeId
const findingId = 'FIND-1' as FindingId
const evidenceId = 'EV-1' as EvidenceId

function snapshot(reverse = false): ChangeGraphSnapshot {
  const nodes: ChangeGraphSnapshot['nodes'] = [
    {
      kind: 'change',
      value: {
        id: changeA,
        kind: 'feature',
        title: 'Root feature',
        createdAt: '2026-09-30T00:00:00Z',
        createdBy: actor,
      },
    },
    {
      kind: 'change',
      value: {
        id: changeB,
        kind: 'bugfix',
        title: 'Feedback fix',
        createdAt: '2026-09-30T00:00:01Z',
        createdBy: actor,
      },
    },
    {
      kind: 'finding',
      value: {
        id: findingId,
        type: 'bug',
        expected: 'works',
        actual: 'broken',
        severity: 'high',
        confidence: 1,
        openedAt: '2026-09-30T00:00:02Z',
        openedBy: actor,
      },
    },
    {
      kind: 'evidence',
      value: {
        id: evidenceId,
        kind: 'factory/runtime-observation' as EvidenceKindId,
        kindVersion: 1,
        claim: 'Regression observed',
        result: 'contradicts',
        subjects: [{ kind: 'node', node: { kind: 'change', id: changeA } }],
        reality: { targets: [], environment: [], configuration: [] },
        sources: [],
        observedAt: '2026-09-30T00:00:03Z',
        payload: { signal: 'error-rate', value: 0.2 },
      },
    },
  ]

  const relations: ChangeGraphSnapshot['relations'] = [
    {
      id: 'REL-1' as RelationId,
      source: { kind: 'evidence', id: evidenceId },
      target: { kind: 'finding', id: findingId },
      kind: 'raises',
      createdAt: '2026-09-30T00:00:03Z',
      createdBy: actor,
    },
    {
      id: 'REL-2' as RelationId,
      source: { kind: 'change', id: changeB },
      target: { kind: 'finding', id: findingId },
      kind: 'addresses',
      createdAt: '2026-09-30T00:00:04Z',
      createdBy: actor,
    },
    {
      id: 'REL-3' as RelationId,
      source: { kind: 'evidence', id: evidenceId },
      target: { kind: 'change', id: changeA },
      kind: 'contradicts',
      createdAt: '2026-09-30T00:00:05Z',
      createdBy: actor,
    },
    {
      id: 'REL-4' as RelationId,
      source: { kind: 'change', id: changeA },
      target: { kind: 'change', id: changeB },
      kind: 'depends_on',
      createdAt: '2026-09-30T00:00:06Z',
      createdBy: actor,
    },
    {
      id: 'REL-5' as RelationId,
      source: { kind: 'change', id: changeB },
      target: { kind: 'change', id: changeA },
      kind: 'governs' as never,
      createdAt: '2026-09-30T00:00:07Z',
      createdBy: actor,
    },
  ]

  return {
    graphId,
    revision: asGraphRevision(77),
    nodes: reverse ? [...nodes].reverse() : nodes,
    relations: reverse ? [...relations].reverse() : relations,
    retiredRelationIds: [],
    criterionRevisions: [],
    evidenceInvalidations: [],
    changeDispositions: [],
    findingLifecycles: [],
    gateEvaluations: [],
  }
}

describe('Graph View Model', () => {
  it('is deterministic regardless of snapshot array order', () => {
    const left = buildGraphViewModel(snapshot(false), { rootChangeId: changeA })
    const right = buildGraphViewModel(snapshot(true), { rootChangeId: changeA })

    expect(
      left.nodes.map(node => [node.key, node.x, node.y]),
    ).toEqual(
      right.nodes.map(node => [node.key, node.x, node.y]),
    )
    expect(left.edges.map(edge => edge.id)).toEqual(right.edges.map(edge => edge.id))
  })

  it('lays out a legal cyclic graph without topological sorting', () => {
    const model = buildGraphViewModel(snapshot(), { rootChangeId: changeA })

    expect(model.nodes).toHaveLength(4)
    expect(model.edges).toHaveLength(5)
    expect(model.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true)
  })

  it('returns full incoming and outgoing relations for selection details', () => {
    const model = buildGraphViewModel(snapshot(), { rootChangeId: changeA })
    const details = graphNodeDetails(model, { kind: 'finding', id: findingId })

    expect(details?.incoming.map(edge => edge.id).sort()).toEqual(['REL-1', 'REL-2'])
    expect(details?.outgoing).toEqual([])
  })

  it('renders every active relation exactly once in SVG markup', () => {
    const model = buildGraphViewModel(snapshot(), { rootChangeId: changeA })
    const markup = renderGraphSvgMarkup(model)

    for (const edge of model.edges) {
      expect(markup.split(`data-relation-id="${edge.id}"`)).toHaveLength(2)
    }
  })

  it('renders an explicit empty SVG state', () => {
    const empty: ChangeGraphSnapshot = {
      ...snapshot(),
      nodes: [],
      relations: [],
    }
    const model = buildGraphViewModel(empty)

    expect(model.nodes).toEqual([])
    expect(renderGraphSvgMarkup(model)).toContain('No graph nodes')
  })
})
