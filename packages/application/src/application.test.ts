import { describe, expect, it } from 'vitest'
import {
  asGraphRevision,
  type ActorRef,
  type Artifact,
  type ArtifactId,
  type ChangeId,
  type Evidence,
  type EvidenceId,
  type GraphId,
  type RunId,
} from '@orven/internal-domain'
import { InMemoryEventStore } from '@orven/internal-events'
import type { AcceptedExecutionResult } from '@orven/internal-execution'
import type { CapabilityId } from '@orven/internal-work'
import { OrvenApplication } from './application.js'

const actor: ActorRef = { kind: 'agent', id: 'test-agent' }
const now = '2026-09-30T00:00:00Z'

function ids(): () => string {
  let next = 0
  return () => String(++next).padStart(3, '0')
}

function app() {
  const store = new InMemoryEventStore('GRAPH' as GraphId)
  return {
    store,
    application: new OrvenApplication(store, {
      clock: () => now,
      ids: ids(),
    }),
  }
}

describe('OrvenApplication', () => {
  it('creates a Change, Criteria, acceptance Gate and relations atomically', async () => {
    const { store, application } = app()

    const created = await application.beginChange({
      title: ' Add cache hit percentage ',
      kind: 'feature',
      criteria: [
        { statement: 'Show a cache hit percentage.' },
        {
          statement: 'Keep calculation covered by tests.',
          severity: 'recommended',
        },
      ],
      actor,
    })

    expect(created.criteria).toHaveLength(2)
    expect(created.graphRevision).toBe(10)
    expect(store.currentSequence(created.changeId)).toBe(10)

    const snapshot = application.snapshot()
    expect(snapshot.nodes.filter(node => node.kind === 'change')).toHaveLength(1)
    expect(snapshot.nodes.filter(node => node.kind === 'criterion')).toHaveLength(2)
    expect(snapshot.nodes.filter(node => node.kind === 'gate')).toHaveLength(1)
    expect(snapshot.criterionRevisions).toHaveLength(2)
    expect(
      snapshot.relations.filter(relation => relation.kind === 'has_criterion'),
    ).toHaveLength(2)
    expect(
      snapshot.relations.filter(relation => relation.kind === 'evaluates'),
    ).toHaveLength(2)

    const status = application.status(created.changeId)
    expect(status.title).toBe('Add cache hit percentage')
    expect(status.criteria.map(item => item.evidence.supporting)).toEqual([0, 0])
    expect(status.gates).toEqual([
      expect.objectContaining({ state: 'pending', kind: 'acceptance' }),
    ])
    expect(status.runs.total).toBe(0)
  })

  it('rejects duplicate Criterion statements before append', async () => {
    const { store, application } = app()

    await expect(application.beginChange({
      title: 'Duplicate',
      kind: 'feature',
      criteria: [
        { statement: 'Same thing' },
        { statement: '  same   thing  ' },
      ],
      actor,
    })).rejects.toThrow('Duplicate Criterion statement')
    expect(store.currentRevision()).toBe(0)
  })

  it('derives Work from the current graph without persisting it', async () => {
    const { store, application } = app()
    const created = await application.beginChange({
      title: 'Work derivation',
      kind: 'feature',
      criteria: [{ statement: 'Do the work' }],
      actor,
    })
    const before = store.currentRevision()
    const capability = 'dsh.agent' as CapabilityId

    const work = application.deriveWork({
      changeId: created.changeId,
      requiredCapabilities: [capability],
    })

    expect(work.changeId).toBe(created.changeId)
    expect(work.graphRevision).toBe(before)
    expect(work.requiredCapabilities).toEqual([capability])
    expect(work.objective).toContain('Do the work')
    expect(store.currentRevision()).toBe(before)
  })

  it('records accepted Run outputs and run-scoped Evidence', async () => {
    const { application } = app()
    const created = await application.beginChange({
      title: 'Record execution',
      kind: 'feature',
      criteria: [{ statement: 'Execute safely' }],
      actor,
    })
    const inputRevision = application.store.currentRevision()
    const runId = 'run:exec:test:1' as RunId
    const artifact: Artifact = {
      id: 'artifact:tool' as ArtifactId,
      type: 'dsh/tool-result',
      metadata: { tool: 'read', isError: false },
      createdAt: now,
      createdBy: { kind: 'system', id: 'orven:dsh-collector' },
    }
    const evidence: Evidence = {
      id: 'evidence:tool' as EvidenceId,
      kind: 'factory/runtime-observation' as never,
      kindVersion: 1,
      claim: 'DSH tool read produced a normalized success result during the Run.',
      result: 'supports',
      subjects: [{ kind: 'node', node: { kind: 'run', id: runId } }],
      reality: {
        targets: [{ id: artifact.id }],
        environment: [],
        configuration: [],
      },
      sources: [{ artifact: { id: artifact.id }, role: 'raw_output' }],
      observedAt: now,
      payload: { signal: 'dsh.tool.read', value: { isError: false } },
    }
    const result: AcceptedExecutionResult = {
      executionId: 'exec:work:test:1' as never,
      attempt: 1,
      state: 'succeeded',
      run: {
        id: runId,
        objective: 'Execute',
        contextPackHash: 'hash',
        inputGraphRevision: inputRevision,
        runtime: 'dsh',
        status: 'succeeded',
        startedAt: now,
        finishedAt: now,
      },
      artifacts: [artifact],
      evidence: [evidence],
      findings: [],
      decisions: [],
    }

    const recorded = await application.recordExecution({
      changeId: created.changeId,
      result,
      actor,
    })

    expect(recorded.runId).toBe(runId)
    const status = application.status(created.changeId)
    expect(status.runs.total).toBe(1)
    expect(status.runs.succeeded).toBe(1)
    expect(status.criteria[0]?.evidence.supporting).toBe(0)

    const snapshot = application.snapshot()
    expect(
      snapshot.relations.some(relation =>
        relation.kind === 'attempts'
        && relation.source.kind === 'run'
        && relation.source.id === runId
        && relation.target.kind === 'change'
        && relation.target.id === created.changeId
      ),
    ).toBe(true)
    expect(
      snapshot.relations.filter(relation => relation.kind === 'produces'),
    ).toHaveLength(2)
  })

  it('refuses to record an accepted result after the graph advances', async () => {
    const { application } = app()
    const created = await application.beginChange({
      title: 'Freshness',
      kind: 'feature',
      criteria: [{ statement: 'Stay fresh' }],
      actor,
    })
    const inputRevision = application.store.currentRevision()

    await application.store.append({
      actor,
      events: [{
        eventId: 'evt:external' as never,
        occurredAt: now,
        event: {
          type: 'decision.recorded',
          decision: {
            id: 'decision:external' as never,
            question: 'Advance?',
            outcome: 'yes',
            rationale: 'test',
            madeBy: actor,
            madeAt: now,
          },
        },
      }],
    })

    const result: AcceptedExecutionResult = {
      executionId: 'exec:stale:1' as never,
      attempt: 1,
      state: 'succeeded',
      run: {
        id: 'run:exec:stale:1' as RunId,
        objective: 'Execute',
        contextPackHash: 'hash',
        inputGraphRevision: asGraphRevision(Number(inputRevision)),
        runtime: 'dsh',
        status: 'succeeded',
        startedAt: now,
        finishedAt: now,
      },
      artifacts: [],
      evidence: [],
      findings: [],
      decisions: [],
    }

    await expect(application.recordExecution({
      changeId: created.changeId,
      result,
      actor,
    })).rejects.toThrow('current revision')
  })
})
