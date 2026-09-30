import type {
  ChangeGraphSnapshot,
  ChangeId,
  GraphId,
  GraphRevision,
} from '@dsh-factory/core'
import {
  projectChangeGraph,
  type AppendRequest,
  type EventEnvelope,
} from '@dsh-factory/events'
import {
  prepareExecution,
  type ExecutionResult,
  type PreparedExecution,
} from '@dsh-factory/execution'
import type {
  WorkItem,
  WorkerDescriptor,
} from '@dsh-factory/work'
import {
  DshExecutionAdapter,
  type DshOutcomeCollector,
} from './adapter.js'
import type { FactoryEventStore } from './store.js'

export interface FactoryPrepareWorkInput {
  readonly work: WorkItem
  readonly worker: WorkerDescriptor
  readonly attempt: number
  readonly availableCapabilities?: readonly string[]
  readonly permissions?: readonly string[]
}

export interface FactoryExecutePreparedInput {
  readonly prepared: PreparedExecution
  readonly collector: DshOutcomeCollector
  readonly signal?: AbortSignal
}

export interface FactoryExecuteWorkInput extends FactoryPrepareWorkInput {
  readonly collector: DshOutcomeCollector
  readonly signal?: AbortSignal
}

export class FactoryService {
  constructor(
    private readonly store: FactoryEventStore,
    private readonly executor: DshExecutionAdapter,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

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
    return projectChangeGraph(this.store.graphId, this.store.readAll())
  }

  async append(request: AppendRequest): Promise<readonly EventEnvelope[]> {
    return await this.store.append(request)
  }

  prepareWork(input: FactoryPrepareWorkInput): PreparedExecution {
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
    input: FactoryExecutePreparedInput,
  ): Promise<ExecutionResult> {
    return await this.executor.execute({
      prepared: input.prepared,
      collector: input.collector,
      currentGraphRevision: () => this.currentRevision(),
      clock: this.clock,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    })
  }

  async executeWork(input: FactoryExecuteWorkInput): Promise<ExecutionResult> {
    const prepared = this.prepareWork(input)
    return await this.executePrepared({
      prepared,
      collector: input.collector,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    })
  }
}
