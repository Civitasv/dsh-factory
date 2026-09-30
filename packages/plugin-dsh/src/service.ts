import { resolve } from 'node:path'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {
  ChangeGraphSnapshot,
  ChangeId,
  GraphId,
  GraphRevision,
} from '@orven/core'
import {
  projectChangeGraph,
  type AppendRequest,
  type EventEnvelope,
} from '@orven/core/events'
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
  readonly parentAgent?: Agent
  readonly signal?: AbortSignal
}

export interface OrvenExecuteWorkInput extends OrvenPrepareWorkInput {
  readonly collector: DshOutcomeCollector
  readonly parentAgent?: Agent
  readonly signal?: AbortSignal
}

export type OrvenWorkspaceStoreFactory = (
  workspace: string,
) => OrvenEventStore | Promise<OrvenEventStore>

export interface OrvenServiceRuntimeOptions {
  readonly workspace?: string
  readonly workspaceStoreFactory?: OrvenWorkspaceStoreFactory
}

export class OrvenService {
  readonly #workspaceServices = new Map<string, Promise<OrvenService>>()

  constructor(
    private readonly store: OrvenEventStore,
    private readonly executor: DshExecutionAdapter,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly runtime: OrvenServiceRuntimeOptions = {},
  ) {}

  get graphId(): GraphId {
    return this.store.graphId
  }

  get workspace(): string | undefined {
    return this.runtime.workspace
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

  async forWorkspace(workspace: string): Promise<OrvenService> {
    const factory = this.runtime.workspaceStoreFactory
    if (factory === undefined) return this

    const canonical = resolve(workspace)
    const existing = this.#workspaceServices.get(canonical)
    if (existing !== undefined) return await existing

    const pending = Promise.resolve(factory(canonical))
      .then(store => new OrvenService(
        store,
        this.executor,
        this.clock,
        { workspace: canonical },
      ))
      .catch((error: unknown) => {
        this.#workspaceServices.delete(canonical)
        throw error
      })

    this.#workspaceServices.set(canonical, pending)
    return await pending
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
      ...(this.runtime.workspace === undefined
        ? {}
        : { cwd: this.runtime.workspace }),
      ...(input.parentAgent === undefined
        ? {}
        : { parentAgent: input.parentAgent }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    })
  }

  async executeWork(input: OrvenExecuteWorkInput): Promise<ExecutionResult> {
    const prepared = this.prepareWork(input)
    return await this.executePrepared({
      prepared,
      collector: input.collector,
      ...(input.parentAgent === undefined
        ? {}
        : { parentAgent: input.parentAgent }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    })
  }
}
