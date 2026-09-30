import type { Agent, AgentHandle, CreateAgentOptions } from '@deepseek-ai/dsh-agent'
import { SessionId, type SessionId as DshSessionId } from '@deepseek-ai/dsh-session'
import type { GraphRevision } from '@orven/core'
import {
  acceptExecutionOutcome,
  startExecution,
  type ExecutionResult,
  type PreparedExecution,
  type WorkerOutcome,
} from '@orven/core/execution'
import { orvenContextMessage, orvenWorkMessage } from './messages.js'

export interface DshAgentPort {
  create(options: CreateAgentOptions): Promise<AgentHandle>
}

export interface DshOutcomeCollector {
  collect(
    agent: Agent,
    execution: PreparedExecution,
  ): Promise<WorkerOutcome>
}

export interface DshExecutionInput {
  readonly prepared: PreparedExecution
  readonly collector: DshOutcomeCollector
  readonly currentGraphRevision: () => GraphRevision | Promise<GraphRevision>
  readonly clock: () => string
  readonly signal?: AbortSignal
}

export function dshSessionId(executionId: string): DshSessionId {
  return SessionId(`orven:${executionId}`)
}

export class DshExecutionAdapter {
  constructor(private readonly agents: DshAgentPort) {}

  async execute(input: DshExecutionInput): Promise<ExecutionResult> {
    if (input.prepared.worker.runtime !== 'dsh') {
      throw new Error(
        `DSH adapter cannot execute runtime ${input.prepared.worker.runtime}`,
      )
    }

    if (input.signal?.aborted) {
      throw new Error('Orven execution was cancelled before agent creation')
    }

    const running = startExecution(input.prepared)
    const startedAt = input.clock()
    const handle = await this.agents.create({
      sessionId: dshSessionId(input.prepared.executionId),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    })

    let aborted = input.signal?.aborted ?? false
    const onAbort = (): void => {
      aborted = true
      handle.agent.cancel({ kind: 'parent' })
    }
    if (aborted) handle.agent.cancel({ kind: 'parent' })
    input.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      handle.agent.inject(orvenContextMessage(input.prepared))
      handle.agent.followup(orvenWorkMessage(input.prepared))
      await handle.agent.whenIdle()

      const outcome = aborted
        ? {
            status: 'cancelled' as const,
            artifacts: [],
            evidence: [],
            findings: [],
            decisions: [],
            diagnostics: 'Orven execution cancelled by parent runtime.',
          }
        : await input.collector.collect(handle.agent, input.prepared)

      const finishedAt = input.clock()
      const currentGraphRevision = await input.currentGraphRevision()

      return acceptExecutionOutcome({
        execution: running,
        outcome,
        currentGraphRevision,
        startedAt,
        finishedAt,
      })
    } finally {
      input.signal?.removeEventListener('abort', onAbort)
      await handle.dispose()
    }
  }
}
