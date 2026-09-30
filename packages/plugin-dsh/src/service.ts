import type {
  ChangeGraphSnapshot,
  ChangeId,
  GraphId,
  GraphRevision,
} from '@orven/core'
import {
  type AppendRequest,
  type EventEnvelope,
} from '@orven/core/events'
import {
  OrvenApplication,
  type BeginChangeInput,
  type BeginChangeResult,
  type ChangeStatus,
  type DeriveChangeWorkInput,
  type RecordExecutionInput,
  type RecordExecutionResult,
} from '@orven/core/application'
import {
  prepareExecution,
  type ExecutionResult,
  type PreparedExecution,
} from '@orven/core/execution'
import type {
  WorkItem,
  WorkerDescriptor,
} from '@orven/core/work'
import {
  DshExecutionAdapter,
  type DshOutcomeCollector,
} from './adapter.js'
import type { OrvenEventStore } from './store.js'

export interface OrvenPrepareWorkInput {
  readonly work: WorkItem
  readonly worker: WorkerDescriptor
  readonly attempt: number
  readonly availableCapabilities?: readonly string[]
  readonly permissions?: readonly string[]
}

export interface OrvenExecutePreparedInput {
  readonly prepared: PreparedExecution
  readonly collector: DshOutcomeCollector
  readonly signal?: AbortSignal
}

export interface OrvenExecuteWorkInput extends OrvenPrepareWorkInput {
  readonly collector: DshOutcomeCollector
  readonly signal?: AbortSignal
}

export class OrvenService {
  readonly #application: OrvenApplication

  constructor(
    private readonly store: OrvenEventStore,
    private readonly executor: DshExecutionAdapter,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {
    this.#application = new OrvenApplication(store, { clock })
  }

  get graphId(): GraphId {
    return this.store.graphId
  }

  currentRevision(): GraphRevision {
    return this.store.currentRevision()
  }

  currentSequence(changeId: ChangeId): number {
    return this.store.currentSequence(changeId)
  }

  snapshot(): ChangeGraphSnapshot {
    return this.#application.snapshot()
  }

  async beginChange(input: BeginChangeInput): Promise<BeginChangeResult> {
    return await this.#application.beginChange(input)
  }

  status(changeId: ChangeId): ChangeStatus {
    return this.#application.status(changeId)
  }

  deriveWork(input: DeriveChangeWorkInput): WorkItem {
    return this.#application.deriveWork(input)
  }

  async recordExecution(
    input: RecordExecutionInput,
  ): Promise<RecordExecutionResult> {
    return await this.#application.recordExecution(input)
  }

  async append(request: AppendRequest): Promise<readonly EventEnvelope[]> {
    return await this.store.append(request)
  }

  prepareWork(input: OrvenPrepareWorkInput): PreparedExecution {
    return prepareExecution({
      work: input.work,
      worker: {
        descriptor: input.worker,
        runtime: 'dsh',
      },
      snapshot: this.snapshot(),
      attempt: input.attempt,
      ...(input.availableCapabilities === undefined
        ? {}
        : { availableCapabilities: input.availableCapabilities }),
      ...(input.permissions === undefined
        ? {}
        : { permissions: input.permissions }),
    })
  }

  async executePrepared(
    input: OrvenExecutePreparedInput,
  ): Promise<ExecutionResult> {
    return await this.executor.execute({
      prepared: input.prepared,
      collector: input.collector,
      currentGraphRevision: () => this.currentRevision(),
      clock: this.clock,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    })
  }

  async executeWork(input: OrvenExecuteWorkInput): Promise<ExecutionResult> {
    const prepared = this.prepareWork(input)
    return await this.executePrepared({
      prepared,
      collector: input.collector,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    })
  }
}
