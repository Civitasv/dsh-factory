import { describe, expect, it } from 'vitest'
import type { Agent, AgentHandle, CreateAgentOptions } from '@deepseek-ai/dsh-agent'
import {
  asGraphRevision,
  type ActorRef,
  type ChangeGraphSnapshot,
  type ChangeId,
} from '@orven/core'
import { prepareExecution } from '@orven/core/execution'
import {
  materializeWork,
  type CapabilityId,
  type WorkerDescriptor,
} from '@orven/core/work'
import {
  DshExecutionAdapter,
  dshSessionId,
  type DshAgentPort,
  type DshOutcomeCollector,
} from './index.js'

const actor: ActorRef = { kind: 'system', id: 'test' }
const changeId = 'CHG-1' as ChangeId
const capability = 'code.read' as CapabilityId

function graph(): ChangeGraphSnapshot {
  return {
    graphId: 'GRAPH-1' as never,
    revision: asGraphRevision(10),
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

function prepared() {
  const work = materializeWork({
    changeId,
    graphRevision: asGraphRevision(10),
    objective: 'Inspect the repository',
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
  const worker: WorkerDescriptor = {
    id: 'dsh-worker',
    capabilities: [capability],
    maxParallel: 1,
  }

  return prepareExecution({
    work,
    worker: { descriptor: worker, runtime: 'dsh' },
    snapshot: graph(),
    attempt: 1,
  })
}

function fakePort(log: string[]): {
  readonly port: DshAgentPort
  readonly agent: Agent
  readonly getOptions: () => CreateAgentOptions | undefined
} {
  let options: CreateAgentOptions | undefined
  const agent = {
    inject: () => { log.push('inject') },
    followup: () => { log.push('followup') },
    whenIdle: async () => { log.push('idle') },
    cancel: () => { log.push('cancel') },
  } as unknown as Agent

  const port: DshAgentPort = {
    create: async next => {
      options = next
      log.push('create')
      const handle: AgentHandle = {
        agent,
        dispose: async () => { log.push('dispose') },
      }
      return handle
    },
  }

  return { port, agent, getOptions: () => options }
}

describe('DshExecutionAdapter', () => {
  it('uses deterministic DSH Session identity', () => {
    expect(String(dshSessionId('exec:work:abc:1'))).toBe(
      'orven:exec:work:abc:1',
    )
  })

  it('injects Context before waking the Work objective and disposes the handle', async () => {
    const log: string[] = []
    const fake = fakePort(log)
    const collector: DshOutcomeCollector = {
      collect: async () => {
        log.push('collect')
        return {
          status: 'succeeded',
          artifacts: [],
          evidence: [],
          findings: [],
          decisions: [],
        }
      },
    }
    const times = ['start', 'finish']
    const result = await new DshExecutionAdapter(fake.port).execute({
      prepared: prepared(),
      collector,
      currentGraphRevision: () => asGraphRevision(10),
      clock: () => times.shift() ?? 'unexpected',
    })

    expect(result.state).toBe('succeeded')
    expect(log).toEqual([
      'create',
      'inject',
      'followup',
      'idle',
      'collect',
      'dispose',
    ])
    expect(String(fake.getOptions()?.sessionId)).toContain('orven:')
  })

  it('preserves Feature-07 stale completion semantics', async () => {
    const log: string[] = []
    const fake = fakePort(log)
    const result = await new DshExecutionAdapter(fake.port).execute({
      prepared: prepared(),
      collector: {
        collect: async () => ({
          status: 'succeeded',
          artifacts: [],
          evidence: [],
          findings: [],
          decisions: [],
        }),
      },
      currentGraphRevision: () => asGraphRevision(11),
      clock: () => '2026-09-30T00:00:00Z',
    })

    expect(result.state).toBe('stale')
    expect(log.at(-1)).toBe('dispose')
  })

  it('propagates cancellation and still drains/disposes', async () => {
    const log: string[] = []
    const fake = fakePort(log)
    const controller = new AbortController()
    const collector: DshOutcomeCollector = {
      collect: async () => {
        throw new Error('collector should not run after cancellation')
      },
    }

    const port: DshAgentPort = {
      create: async options => {
        const handle = await fake.port.create(options)
        controller.abort()
        return handle
      },
    }

    const result = await new DshExecutionAdapter(port).execute({
      prepared: prepared(),
      collector,
      currentGraphRevision: () => asGraphRevision(10),
      clock: () => '2026-09-30T00:00:00Z',
      signal: controller.signal,
    })

    expect(result.state).toBe('cancelled')
    expect(log).toContain('cancel')
    expect(log.at(-1)).toBe('dispose')
  })
})
