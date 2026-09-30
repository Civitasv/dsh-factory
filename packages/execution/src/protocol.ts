import type { RunId } from '@orven/internal-domain'
import { compileContext } from '@orven/internal-context'
import { workerCanExecute } from '@orven/internal-work'
import type {
  AcceptOutcomeInput,
  AcceptedExecutionResult,
  ExecutionId,
  ExecutionResult,
  ExecutionState,
  PrepareExecutionInput,
  PreparedExecution,
  RetryPolicy,
  RunningExecution,
} from './types.js'

export class StaleWorkError extends Error {
  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `Work Graph Revision ${expectedRevision} is stale; current revision is ${actualRevision}`,
    )
    this.name = 'StaleWorkError'
  }
}

function assertAttempt(attempt: number): void {
  if (!Number.isSafeInteger(attempt) || attempt <= 0) {
    throw new Error('Execution attempt must be a positive safe integer')
  }
}

export function executionId(workId: string, attempt: number): ExecutionId {
  assertAttempt(attempt)
  return `exec:${workId}:${attempt}` as ExecutionId
}

export function prepareExecution(input: PrepareExecutionInput): PreparedExecution {
  assertAttempt(input.attempt)

  if (input.work.graphRevision !== input.snapshot.revision) {
    throw new StaleWorkError(input.work.graphRevision, input.snapshot.revision)
  }

  if (!workerCanExecute(input.work, input.worker.descriptor)) {
    throw new Error(
      `Worker ${input.worker.descriptor.id} lacks required Work capabilities`,
    )
  }

  if (input.worker.runtime.trim() === '') {
    throw new Error('Execution runtime must be non-empty')
  }

  const context = compileContext({
    snapshot: input.snapshot,
    changeId: input.work.changeId,
    objective: input.work.objective,
    query: input.work.context.query,
    budget: input.work.context.budget,
    availableCapabilities: input.availableCapabilities ?? input.worker.descriptor.capabilities,
    permissions: input.permissions ?? [],
  })

  return {
    executionId: executionId(input.work.id, input.attempt),
    attempt: input.attempt,
    work: input.work,
    worker: input.worker,
    context,
    state: 'prepared',
  }
}

export function startExecution(prepared: PreparedExecution): RunningExecution {
  return { ...prepared, state: 'running' }
}

export type ExecutionTransition =
  | 'start'
  | 'succeed'
  | 'fail'
  | 'cancel'
  | 'mark_stale'

export function transitionExecution(
  state: ExecutionState,
  transition: ExecutionTransition,
): ExecutionState {
  if (state === 'prepared') {
    if (transition === 'start') return 'running'
    if (transition === 'cancel') return 'cancelled'
  }

  if (state === 'running') {
    if (transition === 'succeed') return 'succeeded'
    if (transition === 'fail') return 'failed'
    if (transition === 'cancel') return 'cancelled'
    if (transition === 'mark_stale') return 'stale'
  }

  throw new Error(`Illegal execution transition ${state} -> ${transition}`)
}

export function acceptExecutionOutcome(
  input: AcceptOutcomeInput,
): ExecutionResult {
  const expectedRevision = input.execution.work.graphRevision

  if (input.currentGraphRevision !== expectedRevision) {
    return {
      executionId: input.execution.executionId,
      attempt: input.execution.attempt,
      state: 'stale',
      expectedRevision,
      actualRevision: input.currentGraphRevision,
      ...(input.outcome.diagnostics === undefined
        ? {}
        : { diagnostics: input.outcome.diagnostics }),
    }
  }

  const run = {
    id: `run:${input.execution.executionId}` as RunId,
    objective: input.execution.work.objective,
    contextPackHash: input.execution.context.hash,
    inputGraphRevision: expectedRevision,
    runtime: input.execution.worker.runtime,
    status: input.outcome.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
  } as const

  const result: AcceptedExecutionResult = {
    executionId: input.execution.executionId,
    attempt: input.execution.attempt,
    state: input.outcome.status,
    run,
    artifacts: input.outcome.artifacts,
    evidence: input.outcome.evidence,
    findings: input.outcome.findings,
    decisions: input.outcome.decisions,
    ...(input.outcome.diagnostics === undefined
      ? {}
      : { diagnostics: input.outcome.diagnostics }),
  }
  return result
}

export function canRetry(
  state: ExecutionState,
  attempt: number,
  policy: RetryPolicy,
): boolean {
  assertAttempt(attempt)
  if (!Number.isSafeInteger(policy.maxAttempts) || policy.maxAttempts <= 0) {
    throw new Error('Retry maxAttempts must be a positive safe integer')
  }

  return state === 'failed' && attempt < policy.maxAttempts
}
