import { describe, expect, it } from 'vitest'
import type {
  Agent,
  AgentHandle,
  CreateAgentOptions,
} from '@deepseek-ai/dsh-agent'
import {
  asGraphRevision,
  type ActorRef,
  type ChangeId,
  type EventId,
  type GraphId,
} from '@dsh-factory/core'
import { InMemoryEventStore } from '@dsh-factory/events'
import type { CapabilityId, WorkItem } from '@dsh-factory/work'
import {
  DshExecutionAdapter,
  FactoryService,
  type DshAgentPort,
} from './index.js'

const actor: ActorRef = { kind: 'system', id: 'factory-service-test' }
const graphId = 'GRAPH-SERVICE' as GraphId
const changeId = 'CHG-1' as ChangeId
const capability = 'code.read' as CapabilityId

function fakePort(log: string[]): DshAgentPort {
  return {
    create: async (_options: CreateAgentOptions) => {
      const agent = {
        inject: () => { log.push('inject') },
        followup: () => { log.push('followup') },
        whenIdle: async () => { log.push('idle') },
        cancel: () => { log.push('cancel') },
      } as unknown as Agent

      const handle: AgentHandle = {
        agent,
        dispose: async () => { log.push('dispose') },
      }
      log.push('create')
      return handle
    },
  }
}

describe('FactoryService', () => {
  it('projects graph state and executes Work through the DSH port', async () => {
    const log: string[] = []
    const store = new InMemoryEventStore(graphId)
    const service = new FactoryService(
      store,
      new DshExecutionAdapter(fakePort(log)),
      () => '2026-09-30T00:00:00Z',
    )

    await service.append({
      changeId,
      expectedSequence: 0,
      actor,
      events: [
        {
          eventId: 'EVT-1' as EventId,
          occurredAt: '2026-09-30T00:00:00Z',
          event: {
            type: 'change.created',
            change: {
              id: changeId,
              kind: 'feature',
              title: 'Plugin work',
              createdAt: '2026-09-30T00:00:00Z',
              createdBy: actor,
            },
          },
        },
      ],
    })

    const work: WorkItem = {
      id: 'work:service-test' as never,
      changeId,
      graphRevision: asGraphRevision(1),
      objective: 'Inspect the repository',
      requiredCapabilities: [capability],
      priority: 'normal',
      source: {
        kind: 'node',
        node: { kind: 'change', id: changeId },
      },
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
    }

    const result = await service.executeWork({
      work,
      worker: {
        id: 'dsh-worker',
        capabilities: [capability],
        maxParallel: 1,
      },
      attempt: 1,
      collector: {
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
      },
    })

    expect(service.currentRevision()).toBe(1)
    expect(service.snapshot().nodes).toHaveLength(2)
    expect(result.state).toBe('succeeded')
    expect(log).toEqual([
      'create',
      'inject',
      'followup',
      'idle',
      'collect',
      'dispose',
    ])
  })
})
