import type {
  Artifact,
  Brand,
  ChangeGraphSnapshot,
  CompiledContext,
  Decision,
  Evidence,
  Finding,
  GraphRevision,
  Run,
} from '@dsh-factory/core'
import type { WorkItem, WorkerDescriptor } from '@dsh-factory/work'

export type ExecutionId = Brand<string, 'ExecutionId'>
export type ExecutionState =
  | 'prepared'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'stale'

export interface ExecutionWorker {
  readonly descriptor: WorkerDescriptor
  readonly runtime: string
}

export interface PrepareExecutionInput {
  readonly work: WorkItem
  readonly worker: ExecutionWorker
  readonly snapshot: ChangeGraphSnapshot
  readonly attempt: number
  readonly availableCapabilities?: readonly string[]
  readonly permissions?: readonly string[]
}

export interface PreparedExecution {
  readonly executionId: ExecutionId
  readonly attempt: number
  readonly work: WorkItem
  readonly worker: ExecutionWorker
  readonly context: CompiledContext
  readonly state: 'prepared'
}

export interface RunningExecution extends Omit<PreparedExecution, 'state'> {
  readonly state: 'running'
}

export interface WorkerOutcome {
  readonly status: 'succeeded' | 'failed' | 'cancelled'
  readonly artifacts: readonly Artifact[]
  readonly evidence: readonly Evidence[]
  readonly findings: readonly Finding[]
  readonly decisions: readonly Decision[]
  readonly diagnostics?: string
}

export interface AcceptedExecutionResult {
  readonly executionId: ExecutionId
  readonly attempt: number
  readonly state: WorkerOutcome['status']
  readonly run: Run
  readonly artifacts: readonly Artifact[]
  readonly evidence: readonly Evidence[]
  readonly findings: readonly Finding[]
  readonly decisions: readonly Decision[]
  readonly diagnostics?: string
}

export interface StaleExecutionResult {
  readonly executionId: ExecutionId
  readonly attempt: number
  readonly state: 'stale'
  readonly expectedRevision: GraphRevision
  readonly actualRevision: GraphRevision
  readonly diagnostics?: string
}

export type ExecutionResult = AcceptedExecutionResult | StaleExecutionResult

export interface AcceptOutcomeInput {
  readonly execution: RunningExecution
  readonly outcome: WorkerOutcome
  readonly currentGraphRevision: GraphRevision
  readonly startedAt: string
  readonly finishedAt: string
}

export interface RetryPolicy {
  readonly maxAttempts: number
}
