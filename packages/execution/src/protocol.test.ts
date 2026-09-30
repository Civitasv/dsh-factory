import { describe, expect, it } from 'vitest'
import {
  asGraphRevision,
  type ActorRef,
  type ChangeGraphSnapshot,
  type ChangeId,
} from '@orven/internal-domain'
import {
  materializeWork,
  type CapabilityId,
  type WorkerDescriptor,
} from '@orven/internal-work'
import {
  acceptExecutionOutcome,
  canRetry,
  prepareExecution,
  startExecution,
  StaleWorkError,
  transitionExecution,
} from './index.js'

const actor: ActorRef = { kind: 'system', id: 'test' }
const changeId = 'CHG-1' as ChangeId
const capability = 'code.read' as CapabilityId

function graph(revision = 10): ChangeGraphSnapshot {
  return {
    graphId: 'GRAPH-1' as never,
    revision: asGraphRevision(revision),
    nodes: [
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
    ],
    relations: [],
    retiredRelationIds: [],
    criterionRevisions: [],
    evidenceInvalidations: [],
    changeDispositions: [],
    findingLifecycles: [],
    gateEvaluations: [],
  }
}

function work() {
  return materializeWork({
    changeId,
    graphRevision: asGraphRevision(10),
    objective: 'Inspect the change',
    requiredCapabilities: [capability],
    priority: 'normal',
    source: { kind: 'node', node: { kind: 'change', id: changeId } },
    context: {
      query: {
        direction: 'both',
        relationKinds: [],
        maxDepth: 0,
        includeSubjectEvidence: false,
      },
      budget: {
        maxNodes: 1,
        maxRelations: 0,
        maxCriterionRevisions: 0,
      },
    },
  })
}

const worker: WorkerDescriptor = {
  id: 'worker-1',
  capabilities: [capability],
  maxParallel: 1,
}

describe('Execution preparation', () => {
  it('rejects stale Work before Context compilation', () => {
    expect(() =>
      prepareExecution({
        work: work(),
        worker: { descriptor: worker, runtime: 'test-runtime' },
        snapshot: graph(11),
        attempt: 1,
      }),
    ).toThrow(StaleWorkError)
  })

  it('rejects a Worker missing required capability', () => {
    expect(() =>
      prepareExecution({
        work: work(),
        worker: {
          descriptor: {
            id: 'wrong-worker',
            capabilities: [],
            maxParallel: 1,
          },
          runtime: 'test-runtime',
        },
        snapshot: graph(),
        attempt: 1,
      }),
    ).toThrow('lacks required Work capabilities')
  })

  it('binds the compiled Context hash', () => {
    const prepared = prepareExecution({
      work: work(),
      worker: { descriptor: worker, runtime: 'test-runtime' },
      snapshot: graph(),
      attempt: 1,
    })

    expect(prepared.context.hash).toHaveLength(64)
    expect(prepared.context.pack.graphRevision).toBe(10)
  })
})

describe('Execution lifecycle', () => {
  it('allows declared transitions and rejects terminal mutation', () => {
    expect(transitionExecution('prepared', 'start')).toBe('running')
    expect(transitionExecution('running', 'succeed')).toBe('succeeded')
    expect(() => transitionExecution('succeeded', 'cancel')).toThrow(
      'Illegal execution transition',
    )
  })
})

describe('Outcome acceptance', () => {
  it('marks an outcome stale when Graph Revision moved', () => {
    const prepared = prepareExecution({
      work: work(),
      worker: { descriptor: worker, runtime: 'test-runtime' },
      snapshot: graph(),
      attempt: 1,
    })
    const running = startExecution(prepared)

    const result = acceptExecutionOutcome({
      execution: running,
      outcome: {
        status: 'succeeded',
        artifacts: [],
        evidence: [],
        findings: [],
        decisions: [],
        diagnostics: 'Finished, but graph changed',
      },
      currentGraphRevision: asGraphRevision(11),
      startedAt: '2026-09-30T00:00:00Z',
      finishedAt: '2026-09-30T00:00:01Z',
    })

    expect(result.state).toBe('stale')
    expect('run' in result).toBe(false)
  })

  it('creates a durable Run proposal only for a fresh outcome', () => {
    const prepared = prepareExecution({
      work: work(),
      worker: { descriptor: worker, runtime: 'dsh' },
      snapshot: graph(),
      attempt: 1,
    })
    const running = startExecution(prepared)

    const result = acceptExecutionOutcome({
      execution: running,
      outcome: {
        status: 'succeeded',
        artifacts: [],
        evidence: [],
        findings: [],
        decisions: [],
      },
      currentGraphRevision: asGraphRevision(10),
      startedAt: '2026-09-30T00:00:00Z',
      finishedAt: '2026-09-30T00:00:01Z',
    })

    expect(result.state).toBe('succeeded')
    if (result.state === 'stale') throw new Error('unexpected stale result')
    expect(result.run.contextPackHash).toBe(prepared.context.hash)
    expect(result.run.inputGraphRevision).toBe(10)
    expect(result.run.runtime).toBe('dsh')
  })
})

describe('Retry policy', () => {
  it('retries failed attempts only within the configured budget', () => {
    expect(canRetry('failed', 1, { maxAttempts: 3 })).toBe(true)
    expect(canRetry('failed', 3, { maxAttempts: 3 })).toBe(false)
    expect(canRetry('cancelled', 1, { maxAttempts: 3 })).toBe(false)
    expect(canRetry('stale', 1, { maxAttempts: 3 })).toBe(false)
  })
})
