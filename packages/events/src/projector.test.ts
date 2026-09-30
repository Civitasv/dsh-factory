import { describe, expect, it } from 'vitest'
import {
  asGraphRevision,
  type ActorRef,
  type ArtifactId,
  type ChangeId,
  type CriterionId,
  type EventId,
  type EvidenceId,
  type EvidenceKindId,
  type GraphId,
  type RelationId,
  type RunId,
} from '@orven/internal-domain'
import {
  InMemoryEventStore,
  projectChangeGraph,
} from './index.js'

const graphId = 'GRAPH-1' as GraphId
const changeA = 'CHG-A' as ChangeId
const changeB = 'CHG-B' as ChangeId
const criterionId = 'CRT-1' as CriterionId
const artifactId = 'ART-1' as ArtifactId
const actor: ActorRef = { kind: 'system', id: 'test' }
const evidenceKind = 'factory/visual-observation' as EvidenceKindId

function buildCriterionGraph() {
  const store = new InMemoryEventStore(graphId)

  store.append({
    changeId: changeA,
    expectedSequence: 0,
    actor,
    events: [
      {
        eventId: 'EVT-1' as EventId,
        occurredAt: '2026-09-30T00:00:00Z',
        event: {
          type: 'change.created',
          change: {
            id: changeA,
            kind: 'feature',
            title: 'Pin Edit',
            createdAt: '2026-09-30T00:00:00Z',
            createdBy: actor,
          },
        },
      },
      {
        eventId: 'EVT-2' as EventId,
        occurredAt: '2026-09-30T00:00:01Z',
        event: {
          type: 'criterion.created',
          criterion: {
            id: criterionId,
            createdAt: '2026-09-30T00:00:01Z',
            createdBy: actor,
          },
        },
      },
      {
        eventId: 'EVT-3' as EventId,
        occurredAt: '2026-09-30T00:00:02Z',
        event: {
          type: 'criterion.revision.published',
          revision: {
            criterionId,
            revision: 1,
            statement: 'Pin closes before Editor activates',
            evidenceRequirements: [],
            severity: 'required',
            publishedAt: '2026-09-30T00:00:02Z',
            publishedBy: actor,
          },
        },
      },
      {
        eventId: 'EVT-4' as EventId,
        occurredAt: '2026-09-30T00:00:03Z',
        event: {
          type: 'artifact.recorded',
          artifact: {
            id: artifactId,
            type: 'video',
            createdAt: '2026-09-30T00:00:03Z',
            createdBy: actor,
          },
        },
      },
    ],
  })

  return store
}

function visualEvidence(id: string, revision: number) {
  return {
    id: id as EvidenceId,
    kind: evidenceKind,
    kindVersion: 1,
    claim: 'Pin closes before Editor activates',
    result: 'supports' as const,
    sources: [{ artifact: { id: artifactId }, role: 'observation' as const }],
    subjects: [
      {
        kind: 'criterion_revision' as const,
        revision: { criterionId, revision },
      },
    ],
    reality: {
      targets: [{ id: artifactId }],
      environment: [],
      configuration: [],
    },
    observedAt: '2026-09-30T00:00:04Z',
    payload: { description: 'Observed expected window transition' },
  }
}

describe('projectChangeGraph', () => {
  it('preserves immutable Criterion revisions and exact Evidence subjects', () => {
    const store = buildCriterionGraph()

    store.append({
      changeId: changeA,
      expectedSequence: 4,
      actor,
      events: [
        {
          eventId: 'EVT-5' as EventId,
          occurredAt: '2026-09-30T00:00:04Z',
          event: {
            type: 'evidence.recorded',
            evidence: visualEvidence('EVID-1', 1),
          },
        },
        {
          eventId: 'EVT-6' as EventId,
          occurredAt: '2026-09-30T00:00:05Z',
          event: {
            type: 'criterion.revision.published',
            revision: {
              criterionId,
              revision: 2,
              statement: 'Pin closes, then Editor becomes key window',
              evidenceRequirements: [],
              severity: 'required',
              publishedAt: '2026-09-30T00:00:05Z',
              publishedBy: actor,
            },
          },
        },
      ],
    })

    const graph = projectChangeGraph(graphId, store.readAll())
    const evidence = graph.nodes.find(node => node.kind === 'evidence')

    expect(graph.criterionRevisions.map(revision => revision.revision)).toEqual([1, 2])
    expect(
      evidence?.kind === 'evidence' ? evidence.value.subjects[0] : undefined,
    ).toEqual({
      kind: 'criterion_revision',
      revision: { criterionId, revision: 1 },
    })
    expect(graph.revision).toBe(6)
  })

  it('rejects skipped Criterion revisions', () => {
    const store = buildCriterionGraph()

    store.append({
      changeId: changeA,
      expectedSequence: 4,
      actor,
      events: [
        {
          eventId: 'EVT-5' as EventId,
          occurredAt: '2026-09-30T00:00:04Z',
          event: {
            type: 'criterion.revision.published',
            revision: {
              criterionId,
              revision: 3,
              statement: 'Skipped revision',
              evidenceRequirements: [],
              severity: 'required',
              publishedAt: '2026-09-30T00:00:04Z',
              publishedBy: actor,
            },
          },
        },
      ],
    })

    expect(() => projectChangeGraph(graphId, store.readAll())).toThrow(
      'revision must be 2',
    )
  })

  it('rejects Evidence for an unpublished Criterion revision', () => {
    const store = buildCriterionGraph()

    store.append({
      changeId: changeA,
      expectedSequence: 4,
      actor,
      events: [
        {
          eventId: 'EVT-5' as EventId,
          occurredAt: '2026-09-30T00:00:04Z',
          event: {
            type: 'evidence.recorded',
            evidence: visualEvidence('EVID-1', 2),
          },
        },
      ],
    })

    expect(() => projectChangeGraph(graphId, store.readAll())).toThrow(
      'unpublished Criterion revision',
    )
  })

  it('projects Evidence invalidation without mutating the Evidence node', () => {
    const store = buildCriterionGraph()

    store.append({
      changeId: changeA,
      expectedSequence: 4,
      actor,
      events: [
        {
          eventId: 'EVT-5' as EventId,
          occurredAt: '2026-09-30T00:00:04Z',
          event: {
            type: 'evidence.recorded',
            evidence: visualEvidence('EVID-1', 1),
          },
        },
        {
          eventId: 'EVT-6' as EventId,
          occurredAt: '2026-09-30T00:00:05Z',
          event: {
            type: 'evidence.invalidated',
            evidenceId: 'EVID-1' as EvidenceId,
            reason: 'invalid_procedure',
            basis: [],
            detail: 'The procedure skipped the Edit action',
          },
        },
      ],
    })

    const graph = projectChangeGraph(graphId, store.readAll())

    expect(graph.nodes.some(node => node.kind === 'evidence')).toBe(true)
    expect(graph.evidenceInvalidations).toEqual([
      {
        evidenceId: 'EVID-1',
        reason: 'invalid_procedure',
        basis: [],
        invalidatedAt: '2026-09-30T00:00:05Z',
        invalidatedBy: actor,
        detail: 'The procedure skipped the Edit action',
      },
    ])
  })

  it('rejects a depends_on cycle and permits it after the blocking edge is retired', () => {
    const store = new InMemoryEventStore(graphId)

    store.append({
      actor,
      events: [
        {
          eventId: 'EVT-1' as EventId,
          occurredAt: '2026-09-30T00:00:00Z',
          event: {
            type: 'change.created',
            change: {
              id: changeA,
              kind: 'feature',
              title: 'A',
              createdAt: '2026-09-30T00:00:00Z',
              createdBy: actor,
            },
          },
        },
        {
          eventId: 'EVT-2' as EventId,
          occurredAt: '2026-09-30T00:00:01Z',
          event: {
            type: 'change.created',
            change: {
              id: changeB,
              kind: 'feature',
              title: 'B',
              createdAt: '2026-09-30T00:00:01Z',
              createdBy: actor,
            },
          },
        },
        {
          eventId: 'EVT-3' as EventId,
          occurredAt: '2026-09-30T00:00:02Z',
          event: {
            type: 'relation.created',
            relation: {
              id: 'REL-1' as RelationId,
              kind: 'depends_on',
              source: { kind: 'change', id: changeA },
              target: { kind: 'change', id: changeB },
              createdAt: '2026-09-30T00:00:02Z',
              createdBy: actor,
            },
          },
        },
        {
          eventId: 'EVT-4' as EventId,
          occurredAt: '2026-09-30T00:00:03Z',
          event: {
            type: 'relation.created',
            relation: {
              id: 'REL-2' as RelationId,
              kind: 'depends_on',
              source: { kind: 'change', id: changeB },
              target: { kind: 'change', id: changeA },
              createdAt: '2026-09-30T00:00:03Z',
              createdBy: actor,
            },
          },
        },
      ],
    })

    expect(() => projectChangeGraph(graphId, store.readAll())).toThrow(
      'introduce a cycle',
    )

    const validStore = new InMemoryEventStore(graphId)
    validStore.append({
      actor,
      events: [
        ...store.readAll().slice(0, 3).map(envelope => ({
          eventId: envelope.eventId,
          occurredAt: envelope.occurredAt,
          event: envelope.event,
        })),
        {
          eventId: 'EVT-5' as EventId,
          occurredAt: '2026-09-30T00:00:04Z',
          event: {
            type: 'relation.retired' as const,
            relationId: 'REL-1' as RelationId,
          },
        },
        {
          eventId: 'EVT-6' as EventId,
          occurredAt: '2026-09-30T00:00:05Z',
          event: {
            type: 'relation.created' as const,
            relation: {
              id: 'REL-2' as RelationId,
              kind: 'depends_on' as const,
              source: { kind: 'change' as const, id: changeB },
              target: { kind: 'change' as const, id: changeA },
              createdAt: '2026-09-30T00:00:05Z',
              createdBy: actor,
            },
          },
        },
      ],
    })

    const graph = projectChangeGraph(graphId, validStore.readAll())
    expect(graph.relations).toHaveLength(1)
    expect(graph.retiredRelationIds).toEqual(['REL-1'])
  })

  it('rejects a Run that claims a future Graph Revision', () => {
    const store = new InMemoryEventStore(graphId)

    store.append({
      actor,
      events: [
        {
          eventId: 'EVT-1' as EventId,
          occurredAt: '2026-09-30T00:00:00Z',
          event: {
            type: 'run.recorded',
            run: {
              id: 'RUN-1' as RunId,
              objective: 'test',
              contextPackHash: 'sha256:test',
              inputGraphRevision: asGraphRevision(1),
              runtime: 'dsh',
              status: 'succeeded',
              startedAt: '2026-09-30T00:00:00Z',
              finishedAt: '2026-09-30T00:00:01Z',
            },
          },
        },
      ],
    })

    expect(() => projectChangeGraph(graphId, store.readAll())).toThrow(
      'must predate its record event',
    )
  })
})
