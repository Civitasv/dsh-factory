import { describe, expect, it } from 'vitest'
import {
  asGraphRevision,
  type ActorRef,
  type ArtifactId,
  type ChangeGraphSnapshot,
  type ChangeId,
  type CriterionId,
  type EvidenceId,
  type EvidenceKindId,
  type GraphId,
  type RelationId,
} from '@dsh-factory/core'
import { compileContext } from './index.js'

const actor: ActorRef = { kind: 'system', id: 'test' }
const graphId = 'GRAPH-1' as GraphId
const changeId = 'CHG-1' as ChangeId
const criterionId = 'CRT-1' as CriterionId
const artifactId = 'ART-1' as ArtifactId
const evidenceId = 'EV-1' as EvidenceId

function snapshot(reverse = false): ChangeGraphSnapshot {
  const nodes: ChangeGraphSnapshot['nodes'] = [
    {
      kind: 'change',
      value: {
        id: changeId,
        kind: 'feature',
        title: 'Feature',
        createdAt: '2026-09-30T00:00:00Z',
        createdBy: actor,
      },
    },
    {
      kind: 'criterion',
      value: {
        id: criterionId,
        createdAt: '2026-09-30T00:00:01Z',
        createdBy: actor,
      },
    },
    {
      kind: 'artifact',
      value: {
        id: artifactId,
        type: 'intent',
        createdAt: '2026-09-30T00:00:02Z',
        createdBy: actor,
      },
    },
    {
      kind: 'evidence',
      value: {
        id: evidenceId,
        kind: 'factory/visual-observation' as EvidenceKindId,
        kindVersion: 1,
        claim: 'Criterion holds',
        result: 'supports',
        subjects: [
          {
            kind: 'criterion_revision',
            revision: { criterionId, revision: 1 },
          },
        ],
        reality: {
          targets: [{ id: artifactId }],
          environment: [],
          configuration: [],
        },
        sources: [{ artifact: { id: artifactId }, role: 'observation' }],
        observedAt: '2026-09-30T00:00:03Z',
        payload: { description: 'Observed' },
      },
    },
  ]

  const relations: ChangeGraphSnapshot['relations'] = [
    {
      id: 'REL-2' as RelationId,
      source: { kind: 'change', id: changeId },
      target: { kind: 'artifact', id: artifactId },
      kind: 'has_intent',
      createdAt: '2026-09-30T00:00:02Z',
      createdBy: actor,
    },
    {
      id: 'REL-1' as RelationId,
      source: { kind: 'change', id: changeId },
      target: { kind: 'criterion', id: criterionId },
      kind: 'has_criterion',
      createdAt: '2026-09-30T00:00:01Z',
      createdBy: actor,
    },
  ]

  return {
    graphId,
    revision: asGraphRevision(42),
    nodes: reverse ? [...nodes].reverse() : nodes,
    relations: reverse ? [...relations].reverse() : relations,
    retiredRelationIds: [],
    criterionRevisions: [
      {
        criterionId,
        revision: 1,
        statement: 'Behavior holds',
        evidenceRequirements: [],
        severity: 'required',
        publishedAt: '2026-09-30T00:00:01Z',
        publishedBy: actor,
      },
    ],
    evidenceInvalidations: [],
    changeDispositions: [],
    findingLifecycles: [],
    gateEvaluations: [],
  }
}

const query = {
  direction: 'outbound' as const,
  relationKinds: ['has_criterion', 'has_intent'] as const,
  maxDepth: 1,
  includeSubjectEvidence: true,
}

const budget = {
  maxNodes: 4,
  maxRelations: 2,
  maxCriterionRevisions: 5,
}

describe('compileContext', () => {
  it('pins the source Graph Revision and includes subject Evidence', () => {
    const compiled = compileContext({
      snapshot: snapshot(),
      changeId,
      objective: 'Verify behavior',
      query,
      budget,
    })

    expect(compiled.pack.graphRevision).toBe(42)
    expect(compiled.pack.slice.nodes.map(node => node.kind)).toEqual([
      'artifact',
      'change',
      'criterion',
      'evidence',
    ])
    expect(
      compiled.pack.slice.provenance.find(entry => entry.node.kind === 'evidence')
        ?.reasons,
    ).toEqual(['evidence-subject'])
  })

  it('produces the same hash regardless of source array order', () => {
    const left = compileContext({
      snapshot: snapshot(false),
      changeId,
      objective: 'Verify behavior',
      query,
      budget,
      permissions: ['write', 'read'],
      availableCapabilities: ['test.run', 'code.read'],
    })
    const right = compileContext({
      snapshot: snapshot(true),
      changeId,
      objective: 'Verify behavior',
      query,
      budget,
      permissions: ['read', 'write'],
      availableCapabilities: ['code.read', 'test.run'],
    })

    expect(left.hash).toBe(right.hash)
  })

  it('does not traverse disallowed relation kinds', () => {
    const compiled = compileContext({
      snapshot: snapshot(),
      changeId,
      objective: 'Only inspect criteria',
      query: {
        ...query,
        relationKinds: ['has_criterion'],
        includeSubjectEvidence: false,
      },
      budget,
    })

    expect(compiled.pack.slice.nodes.map(node => node.kind)).toEqual([
      'change',
      'criterion',
    ])
  })

  it('records budget-skipped nodes as lazy references', () => {
    const compiled = compileContext({
      snapshot: snapshot(),
      changeId,
      objective: 'Budgeted context',
      query: { ...query, includeSubjectEvidence: false },
      budget: {
        maxNodes: 2,
        maxRelations: 1,
        maxCriterionRevisions: 5,
      },
    })

    expect(compiled.pack.slice.nodes).toHaveLength(2)
    expect(compiled.pack.slice.omittedNodes).toHaveLength(1)
  })

  it('respects depth zero while preserving the root Change', () => {
    const compiled = compileContext({
      snapshot: snapshot(),
      changeId,
      objective: 'Root only',
      query: { ...query, maxDepth: 0, includeSubjectEvidence: false },
      budget,
    })

    expect(compiled.pack.slice.nodes.map(node => node.kind)).toEqual(['change'])
  })
})
