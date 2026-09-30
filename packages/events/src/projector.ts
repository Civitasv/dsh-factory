import {
  asGraphRevision,
  assertRelationCanBeAdded,
  createGateEvaluation,
  graphNodeKey,
  graphNodeRef,
  type ArtifactRef,
  type ChangeDispositionRecord,
  type ChangeGraphSnapshot,
  type CriterionRevision,
  type Evidence,
  type EvidenceId,
  type EvidenceInvalidationRecord,
  type EvidenceRef,
  type FindingId,
  type FindingLifecycleRecord,
  type FindingLifecycleState,
  type GateEvaluation,
  type GraphId,
  type GraphNode,
  type GraphNodeRef,
  type Relation,
  type RelationId,
} from '@dsh-factory/core'
import type { DomainEvent, EventEnvelope } from './events.js'
import { assertEventLogConsistency } from './validation.js'

function relationKey(id: RelationId): string {
  return id
}

function evidenceRef(id: EvidenceId): EvidenceRef {
  return { id }
}

export function projectChangeGraph(
  graphId: GraphId,
  events: readonly EventEnvelope[],
): ChangeGraphSnapshot {
  assertEventLogConsistency(graphId, events)

  const nodes = new Map<string, GraphNode>()
  const relations = new Map<string, Relation>()
  const retiredRelationIds = new Set<RelationId>()
  const criterionRevisions = new Map<string, CriterionRevision[]>()
  const evidenceInvalidations = new Map<EvidenceId, EvidenceInvalidationRecord>()
  const changeDispositions = new Map<string, ChangeDispositionRecord>()
  const findingLifecycles = new Map<string, FindingLifecycleRecord>()
  const gateEvaluations = new Map<string, GateEvaluation>()

  const requireNode = (ref: GraphNodeRef): GraphNode => {
    const node = nodes.get(graphNodeKey(ref))
    if (node === undefined) {
      throw new Error(`Missing graph node ${graphNodeKey(ref)}`)
    }
    return node
  }

  const addNode = (node: GraphNode): void => {
    const ref = graphNodeRef(node)
    const key = graphNodeKey(ref)
    if (nodes.has(key)) {
      throw new Error(`Duplicate graph node ${key}`)
    }
    nodes.set(key, node)
  }

  const requireArtifact = (artifact: ArtifactRef): void => {
    requireNode({ kind: 'artifact', id: artifact.id })
  }

  const requireEvidence = (ids: readonly EvidenceId[]): readonly EvidenceRef[] =>
    ids.map(id => {
      requireNode({ kind: 'evidence', id })
      return evidenceRef(id)
    })

  const requireEvidenceStructure = (evidence: Evidence): void => {
    if (String(evidence.kind).trim() === '') {
      throw new Error(`Evidence ${evidence.id} has an empty kind`)
    }
    if (!Number.isSafeInteger(evidence.kindVersion) || evidence.kindVersion <= 0) {
      throw new Error(`Evidence ${evidence.id} has an invalid kind version`)
    }
    if (evidence.claim.trim() === '') {
      throw new Error(`Evidence ${evidence.id} has an empty claim`)
    }
    if (evidence.subjects.length === 0) {
      throw new Error(`Evidence ${evidence.id} requires at least one subject`)
    }
    if (evidence.reality.targets.length === 0) {
      throw new Error(`Evidence ${evidence.id} requires at least one Reality target`)
    }
    if (evidence.sources.length === 0) {
      throw new Error(`Evidence ${evidence.id} requires at least one Artifact source`)
    }

    for (const source of evidence.sources) {
      requireArtifact(source.artifact)
    }

    for (const artifact of [
      ...evidence.reality.targets,
      ...evidence.reality.environment,
      ...evidence.reality.configuration,
    ]) {
      requireArtifact(artifact)
    }

    for (const subject of evidence.subjects) {
      if (subject.kind === 'node') {
        requireNode(subject.node)
        continue
      }

      requireNode({ kind: 'criterion', id: subject.revision.criterionId })
      const revisions = criterionRevisions.get(subject.revision.criterionId) ?? []
      if (!revisions.some(revision => revision.revision === subject.revision.revision)) {
        throw new Error(
          `Evidence ${evidence.id} references unpublished Criterion revision ${subject.revision.criterionId}@${subject.revision.revision}`,
        )
      }
    }
  }

  const transitionFinding = (
    findingId: FindingId,
    next: FindingLifecycleState,
    evidenceIds: readonly EvidenceId[],
    envelope: EventEnvelope,
  ): void => {
    requireNode({ kind: 'finding', id: findingId })
    const current = findingLifecycles.get(findingId)
    if (current === undefined) {
      throw new Error(`Missing Finding lifecycle ${findingId}`)
    }

    const allowed =
      (next === 'reproduced' && current.state === 'open') ||
      (next === 'resolved' && (current.state === 'open' || current.state === 'reproduced')) ||
      (next === 'open' && current.state === 'resolved') ||
      (next === 'invalid' && (current.state === 'open' || current.state === 'reproduced'))

    if (!allowed) {
      throw new Error(`Invalid Finding transition ${current.state} -> ${next}`)
    }

    findingLifecycles.set(findingId, {
      findingId,
      state: next,
      evidence: [...current.evidence, ...requireEvidence(evidenceIds)],
      updatedAt: envelope.occurredAt,
    })
  }

  for (const envelope of events) {
    const event: DomainEvent = envelope.event

    switch (event.type) {
      case 'change.created':
        addNode({ kind: 'change', value: event.change })
        break

      case 'change.closed': {
        requireNode({ kind: 'change', id: event.changeId })
        if (changeDispositions.has(event.changeId)) {
          throw new Error(`Change ${event.changeId} already has a terminal disposition`)
        }

        changeDispositions.set(event.changeId, {
          changeId: event.changeId,
          disposition: event.disposition,
          closedAt: envelope.occurredAt,
          closedBy: envelope.actor,
          ...(event.reason === undefined ? {} : { reason: event.reason }),
        })
        break
      }

      case 'criterion.created':
        addNode({ kind: 'criterion', value: event.criterion })
        criterionRevisions.set(event.criterion.id, [])
        break

      case 'criterion.revision.published': {
        requireNode({ kind: 'criterion', id: event.revision.criterionId })
        const revisions = criterionRevisions.get(event.revision.criterionId) ?? []
        const expected = revisions.length + 1
        if (
          !Number.isSafeInteger(event.revision.revision) ||
          event.revision.revision <= 0 ||
          event.revision.revision !== expected
        ) {
          throw new Error(
            `Criterion ${event.revision.criterionId} revision must be ${expected}; got ${event.revision.revision}`,
          )
        }
        criterionRevisions.set(event.revision.criterionId, [...revisions, event.revision])
        break
      }

      case 'artifact.recorded':
        addNode({ kind: 'artifact', value: event.artifact })
        break

      case 'evidence.recorded':
        requireEvidenceStructure(event.evidence)
        addNode({ kind: 'evidence', value: event.evidence })
        break

      case 'evidence.invalidated': {
        requireNode({ kind: 'evidence', id: event.evidenceId })
        if (evidenceInvalidations.has(event.evidenceId)) {
          throw new Error(`Evidence ${event.evidenceId} is already invalidated`)
        }
        const basis = requireEvidence(event.basis)
        evidenceInvalidations.set(event.evidenceId, {
          evidenceId: event.evidenceId,
          reason: event.reason,
          basis,
          invalidatedAt: envelope.occurredAt,
          invalidatedBy: envelope.actor,
          ...(event.detail === undefined ? {} : { detail: event.detail }),
        })
        break
      }

      case 'finding.opened':
        addNode({ kind: 'finding', value: event.finding })
        findingLifecycles.set(event.finding.id, {
          findingId: event.finding.id,
          state: 'open',
          evidence: [],
          updatedAt: envelope.occurredAt,
        })
        break

      case 'finding.reproduced':
        transitionFinding(event.findingId, 'reproduced', event.evidenceIds, envelope)
        break

      case 'finding.resolved':
        transitionFinding(event.findingId, 'resolved', event.evidenceIds, envelope)
        break

      case 'finding.reopened':
        transitionFinding(event.findingId, 'open', event.evidenceIds, envelope)
        break

      case 'finding.invalidated':
        transitionFinding(event.findingId, 'invalid', event.evidenceIds, envelope)
        break

      case 'decision.recorded':
        addNode({ kind: 'decision', value: event.decision })
        break

      case 'gate.created':
        addNode({ kind: 'gate', value: event.gate })
        break

      case 'gate.evaluated': {
        requireNode({ kind: 'gate', id: event.evaluation.gateId })
        for (const evidence of event.evaluation.evidence) {
          requireNode({ kind: 'evidence', id: evidence.id })
        }
        const evaluation = createGateEvaluation(event.evaluation)
        gateEvaluations.set(event.evaluation.gateId, evaluation)
        break
      }

      case 'run.recorded':
        if (event.run.inputGraphRevision >= envelope.offset) {
          throw new Error(
            `Run ${event.run.id} input Graph Revision must predate its record event`,
          )
        }
        addNode({ kind: 'run', value: event.run })
        break

      case 'relation.created': {
        requireNode(event.relation.source)
        requireNode(event.relation.target)
        const key = relationKey(event.relation.id)
        if (relations.has(key)) {
          throw new Error(`Duplicate relation id ${event.relation.id}`)
        }

        const activeRelations = [...relations.values()].filter(
          relation => !retiredRelationIds.has(relation.id),
        )
        assertRelationCanBeAdded(activeRelations, event.relation)
        relations.set(key, event.relation)
        break
      }

      case 'relation.retired': {
        const relation = relations.get(relationKey(event.relationId))
        if (relation === undefined) {
          throw new Error(`Cannot retire missing relation ${event.relationId}`)
        }
        if (retiredRelationIds.has(event.relationId)) {
          throw new Error(`Relation ${event.relationId} is already retired`)
        }
        retiredRelationIds.add(event.relationId)
        break
      }
    }
  }

  const latest = events.at(-1)

  return {
    graphId,
    revision: asGraphRevision(latest?.offset ?? 0),
    nodes: [...nodes.values()],
    relations: [...relations.values()].filter(
      relation => !retiredRelationIds.has(relation.id),
    ),
    retiredRelationIds: [...retiredRelationIds],
    criterionRevisions: [...criterionRevisions.values()].flat(),
    evidenceInvalidations: [...evidenceInvalidations.values()],
    changeDispositions: [...changeDispositions.values()],
    findingLifecycles: [...findingLifecycles.values()],
    gateEvaluations: [...gateEvaluations.values()],
  }
}
