import { describe, expect, it } from 'vitest'
import {
  asGraphRevision,
  type ChangeId,
  type FindingId,
} from '@dsh-factory/core'
import {
  eligibleWorkers,
  materializeWork,
  validateWorkPlan,
  type CapabilityId,
  type WorkDemand,
} from './index.js'

const cap = (value: string) => value as CapabilityId

function demand(capabilities: readonly CapabilityId[] = [cap('bug.reproduce')]): WorkDemand {
  return {
    changeId: 'CHG-1' as ChangeId,
    graphRevision: asGraphRevision(10),
    objective: 'Reproduce the observed failure',
    requiredCapabilities: capabilities,
    priority: 'high',
    source: {
      kind: 'node',
      node: { kind: 'finding', id: 'FIND-1' as FindingId },
    },
    context: {
      query: {
        direction: 'both',
        relationKinds: ['raises', 'addresses'],
        maxDepth: 2,
        includeSubjectEvidence: true,
      },
      budget: {
        maxNodes: 20,
        maxRelations: 20,
        maxCriterionRevisions: 10,
      },
    },
  }
}

describe('Work materialization', () => {
  it('canonicalizes capability order and duplicates into one deterministic id', () => {
    const left = materializeWork(demand([cap('code.read'), cap('bug.reproduce')]))
    const right = materializeWork(
      demand([cap('bug.reproduce'), cap('code.read'), cap('bug.reproduce')]),
    )

    expect(left.id).toBe(right.id)
    expect(left.requiredCapabilities).toEqual(['bug.reproduce', 'code.read'])
  })

  it('rejects Work without capabilities', () => {
    expect(() => materializeWork(demand([]))).toThrow('at least one capability')
  })
})

describe('Worker matching', () => {
  it('requires the complete capability set and returns stable worker order', () => {
    const work = materializeWork(
      demand([cap('bug.reproduce'), cap('code.read')]),
    )

    const workers = eligibleWorkers(work, [
      {
        id: 'worker-z',
        capabilities: [cap('code.read'), cap('bug.reproduce')],
        maxParallel: 1,
      },
      {
        id: 'worker-a',
        capabilities: [cap('code.read'), cap('bug.reproduce'), cap('test.execute')],
        maxParallel: 2,
      },
      {
        id: 'worker-missing',
        capabilities: [cap('code.read')],
        maxParallel: 1,
      },
    ])

    expect(workers.map(worker => worker.id)).toEqual(['worker-a', 'worker-z'])
  })
})

describe('Work Plan', () => {
  it('rejects dependency cycles', () => {
    const a = materializeWork(demand([cap('bug.reproduce')]))
    const b = materializeWork({
      ...demand([cap('code.implement')]),
      objective: 'Implement the fix',
    })

    expect(() =>
      validateWorkPlan({
        graphRevision: asGraphRevision(10),
        items: [a, b],
        dependencies: [
          { workId: a.id, dependsOn: b.id },
          { workId: b.id, dependsOn: a.id },
        ],
      }),
    ).toThrow('dependency cycle')
  })

  it('accepts an acyclic plan at one Graph Revision', () => {
    const reproduce = materializeWork(demand([cap('bug.reproduce')]))
    const implement = materializeWork({
      ...demand([cap('code.implement')]),
      objective: 'Implement the fix',
    })

    expect(() =>
      validateWorkPlan({
        graphRevision: asGraphRevision(10),
        items: [reproduce, implement],
        dependencies: [
          { workId: implement.id, dependsOn: reproduce.id },
        ],
      }),
    ).not.toThrow()
  })
})
