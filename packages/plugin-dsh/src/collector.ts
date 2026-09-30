import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Session } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import type {
  Artifact,
  ArtifactId,
  Evidence,
  EvidenceId,
  JsonValue,
  RunId,
} from '@orven/core'
import { BUILTIN_EVIDENCE_KINDS } from '@orven/core/evidence'
import type {
  PreparedExecution,
  WorkerOutcome,
} from '@orven/core/execution'
import type { DshOutcomeCollector } from './adapter.js'

interface ToolObservation {
  readonly tool: string
  readonly callId: string
  readonly arguments: JsonValue
  readonly isError: boolean
  readonly content: JsonValue
  readonly value?: JsonValue
  readonly error?: JsonValue
}

const collectorActor = {
  kind: 'system',
  id: 'orven:dsh-runtime-observer',
} as const

function jsonSnapshot(value: unknown): JsonValue {
  const text = JSON.stringify(value)
  if (text === undefined) {
    throw new Error('DSH runtime observation is not JSON-serializable')
  }
  return JSON.parse(text) as JsonValue
}

function terminalStatus(reason: string): WorkerOutcome['status'] {
  if (reason === 'completed') return 'succeeded'
  if (reason === 'aborted') return 'cancelled'
  return 'failed'
}

export class DshRuntimeOutcomeCollector implements DshOutcomeCollector {
  readonly #observations = new WeakMap<Agent, ToolObservation[]>()
  readonly #terminal = new WeakMap<Session, WorkerOutcome['status']>()

  constructor(
    ctx: Context,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {
    ctx.on('tools/result', (exec, result) => {
      const agent = exec.agent
      if (agent === undefined) return
      const observations = this.#observations.get(agent) ?? []
      observations.push({
        tool: exec.name,
        callId: String(exec.callId),
        arguments: jsonSnapshot(exec.arguments),
        isError: result.isError,
        content: jsonSnapshot(result.content),
        ...(result.isError
          ? { error: jsonSnapshot(result.error) }
          : { value: jsonSnapshot(result.value) }),
      })
      this.#observations.set(agent, observations)
    })

    ctx.on('session/event', (session, event) => {
      if (event.type !== 'turn/end') return
      this.#terminal.set(session, terminalStatus(event.data.reason.kind))
    })
  }

  async collect(
    agent: Agent,
    execution: PreparedExecution,
  ): Promise<WorkerOutcome> {
    const observations = this.#observations.get(agent) ?? []
    const artifacts: Artifact[] = []
    const evidence: Evidence[] = []
    const runId = `run:${execution.executionId}` as RunId

    for (const observation of observations) {
      const observedAt = this.clock()
      const artifact: Artifact = {
        id: `artifact:dsh-tool:${randomUUID()}` as ArtifactId,
        type: 'dsh/tool-result',
        metadata: {
          tool: observation.tool,
          callId: observation.callId,
          arguments: observation.arguments,
          isError: observation.isError,
          content: observation.content,
          ...(observation.value === undefined
            ? {}
            : { value: observation.value }),
          ...(observation.error === undefined
            ? {}
            : { error: observation.error }),
        },
        createdAt: observedAt,
        createdBy: collectorActor,
      }
      artifacts.push(artifact)

      evidence.push({
        id: `evidence:dsh-tool:${randomUUID()}` as EvidenceId,
        kind: BUILTIN_EVIDENCE_KINDS.runtimeObservation.kind,
        kindVersion: BUILTIN_EVIDENCE_KINDS.runtimeObservation.version,
        claim:
          `DSH tool ${observation.tool} produced a normalized `
          + `${observation.isError ? 'error' : 'success'} result during Run ${runId}.`,
        result: 'supports',
        subjects: [
          { kind: 'node', node: { kind: 'run', id: runId } },
        ],
        reality: {
          targets: [{ id: artifact.id }],
          environment: [],
          configuration: [],
        },
        sources: [
          { artifact: { id: artifact.id }, role: 'raw_output' },
        ],
        observedAt,
        payload: {
          signal: `dsh.tool.${observation.tool}`,
          value: { isError: observation.isError },
        },
      })
    }

    const status = this.#terminal.get(agent.session) ?? 'failed'
    return {
      status,
      artifacts,
      evidence,
      findings: [],
      decisions: [],
      ...(this.#terminal.has(agent.session)
        ? {}
        : {
            diagnostics:
              'DSH child Agent reached collection without a durable turn/end; failed closed.',
          }),
    }
  }
}
