import { createHash, randomUUID } from 'node:crypto'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {
  ToolExecution,
  ToolExecutionResult,
} from '@deepseek-ai/dsh-tools'
import type {
  ActorRef,
  Artifact,
  ArtifactId,
  ChangeId,
  ChangeKind,
  CriterionId,
  CriterionRevision,
  Evidence,
  EvidenceId,
  EvidenceRequirementId,
  EventId,
  GateId,
  GraphNode,
  JsonValue,
  RelationId,
  RunId,
} from '@orven/core'
import {
  ConcurrencyConflictError,
  type PendingEvent,
} from '@orven/core/events'
import {
  BUILTIN_EVIDENCE_KINDS,
  createBuiltInEvidenceRegistry,
  evaluateCriterionEvidenceCoverage,
  validateEvidence,
} from '@orven/core/evidence'
import type { ExecutionResult } from '@orven/core/execution'
import {
  materializeWork,
  type CapabilityId,
} from '@orven/core/work'
import { dshSessionId } from './adapter.js'
import type { OrvenService } from './service.js'
import {
  bindOrvenSession,
  readOrvenSessionBinding,
} from './session-binding.js'
import { captureWorkspaceReality } from './workspace-reality.js'
import type { Context } from '@deepseek-ai/cordis'

const evidenceRegistry = createBuiltInEvidenceRegistry()

const changeKinds = new Set<ChangeKind>([
  'feature',
  'bugfix',
  'refactor',
  'performance',
  'incident',
  'security',
  'maintenance',
  'experiment',
])

const eventId = (): EventId => `event:${randomUUID()}` as EventId
const relationId = (): RelationId => `relation:${randomUUID()}` as RelationId
const changeId = (): ChangeId => `change:${randomUUID()}` as ChangeId
const criterionId = (): CriterionId => `criterion:${randomUUID()}` as CriterionId
const gateId = (): GateId => `gate:${randomUUID()}` as GateId
const evidenceId = (): EvidenceId => `evidence:${randomUUID()}` as EvidenceId

function actorForAgent(agent: Agent): ActorRef {
  return { kind: 'agent', id: String(agent.id) }
}

function now(): string {
  return new Date().toISOString()
}

function pending(event: PendingEvent['event'], occurredAt = now()): PendingEvent {
  return {
    eventId: eventId(),
    occurredAt,
    event,
  }
}

async function appendChangeEvents(
  service: OrvenService,
  ownedChangeId: ChangeId,
  actor: ActorRef,
  events: readonly PendingEvent[],
): Promise<void> {
  let lastConflict: unknown
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const expectedSequence = service.currentSequence(ownedChangeId)
    try {
      await service.append({
        changeId: ownedChangeId,
        expectedSequence,
        actor,
        events,
      })
      return
    } catch (error) {
      if (!(error instanceof ConcurrencyConflictError)) throw error
      lastConflict = error
    }
  }
  throw lastConflict instanceof Error
    ? lastConflict
    : new Error('Orven Change append did not converge')
}

const ORVEN_DELEGATED_WORKER_PREFIX = 'orven:exec:'

function assertCoordinatorAgent(agent: Agent, operation: string): void {
  if (String(agent.id).startsWith(ORVEN_DELEGATED_WORKER_PREFIX)) {
    throw new Error(
      `${operation} is not available inside an Orven delegated worker. Execute the assigned objective directly instead of recursively orchestrating another Orven Change/Run.`,
    )
  }
}

function requiredWorkspace(agent: Agent): string {
  const cwd = agent.session.header.cwd
  if (cwd === undefined || cwd.trim() === '') {
    throw new Error(
      'Orven model tools require a DSH Session with an absolute workspace cwd.',
    )
  }
  return cwd
}

export interface ActiveChangeContext {
  readonly agent: Agent
  readonly workspace: string
  readonly changeId: ChangeId
  readonly service: OrvenService
}

export async function activeChangeContext(
  ctx: Context,
  root: OrvenService,
  agent: Agent | undefined,
): Promise<ActiveChangeContext> {
  if (agent === undefined) {
    throw new Error('Orven model tools require an owning DSH Agent session.')
  }

  const binding = readOrvenSessionBinding(ctx, agent.session)
  const workspace = binding.workspace ?? requiredWorkspace(agent)
  if (binding.changeId === null) {
    throw new Error(
      'This DSH Session has no active Orven Change. Call orven_begin_change first.',
    )
  }

  return {
    agent,
    workspace,
    changeId: binding.changeId as ChangeId,
    service: await root.forWorkspace(workspace),
  }
}

export interface BeginCriterionInput {
  readonly statement: string
  readonly severity?: 'required' | 'recommended'
}

export interface BeginChangeInput {
  readonly title: string
  readonly kind?: ChangeKind
  readonly criteria: readonly BeginCriterionInput[]
}

export interface BeginChangeResult {
  readonly changeId: string
  readonly gateId: string
  readonly criterionIds: readonly string[]
  readonly graphRevision: number
  readonly workspace: string
}

export async function beginChange(
  ctx: Context,
  root: OrvenService,
  agent: Agent | undefined,
  input: BeginChangeInput,
): Promise<BeginChangeResult> {
  if (agent === undefined) {
    throw new Error('orven_begin_change requires an owning DSH Agent session.')
  }
  assertCoordinatorAgent(agent, 'orven_begin_change')

  const title = input.title.trim()
  if (title === '') throw new Error('Orven Change title must be non-empty.')
  if (input.criteria.length === 0) {
    throw new Error('Orven Change requires at least one Criterion.')
  }

  const kind = input.kind ?? 'feature'
  if (!changeKinds.has(kind)) {
    throw new Error(`Unsupported Orven Change kind: ${kind}`)
  }

  const criteria = input.criteria.map((item, index) => {
    const statement = item.statement.trim()
    if (statement === '') {
      throw new Error(`Criterion ${index + 1} statement must be non-empty.`)
    }
    return {
      id: criterionId(),
      statement,
      severity: item.severity ?? 'required',
    } as const
  })

  const workspace = requiredWorkspace(agent)
  const service = await root.forWorkspace(workspace)
  const actor = actorForAgent(agent)
  const createdAt = now()
  const id = changeId()
  const gate = gateId()
  const events: PendingEvent[] = [
    pending({
      type: 'change.created',
      change: {
        id,
        kind,
        title,
        createdAt,
        createdBy: actor,
      },
    }, createdAt),
  ]

  for (const item of criteria) {
    const requirementId =
      `requirement:${randomUUID()}` as EvidenceRequirementId
    events.push(
      pending({
        type: 'criterion.created',
        criterion: {
          id: item.id,
          createdAt,
          createdBy: actor,
        },
      }, createdAt),
      pending({
        type: 'criterion.revision.published',
        revision: {
          criterionId: item.id,
          revision: 1,
          statement: item.statement,
          evidenceRequirements: [{
            id: requirementId,
            acceptedKinds: [BUILTIN_EVIDENCE_KINDS.runtimeObservation],
            requiredResult: 'supports',
            minimumCount: 1,
            reality: 'current',
            description: 'One current Artifact-backed runtime observation.',
          }],
          severity: item.severity,
          publishedAt: createdAt,
          publishedBy: actor,
        },
      }, createdAt),
      pending({
        type: 'relation.created',
        relation: {
          id: relationId(),
          source: { kind: 'change', id },
          target: { kind: 'criterion', id: item.id },
          kind: 'has_criterion',
          createdAt,
          createdBy: actor,
        },
      }, createdAt),
    )
  }

  events.push(pending({
    type: 'gate.created',
    gate: {
      id: gate,
      kind: 'change-ready',
      createdAt,
      createdBy: actor,
    },
  }, createdAt))

  for (const item of criteria) {
    events.push(pending({
      type: 'relation.created',
      relation: {
        id: relationId(),
        source: { kind: 'gate', id: gate },
        target: { kind: 'criterion', id: item.id },
        kind: 'evaluates',
        createdAt,
        createdBy: actor,
      },
    }, createdAt))
  }

  await service.append({
    changeId: id,
    expectedSequence: 0,
    actor,
    events,
  })

  bindOrvenSession(agent.session, {
    changeId: id,
    workspace,
  })

  return {
    changeId: id,
    gateId: gate,
    criterionIds: criteria.map(item => item.id),
    graphRevision: Number(service.currentRevision()),
    workspace,
  }
}

function nodeById<T extends GraphNode['kind']>(
  nodes: readonly GraphNode[],
  kind: T,
  id: string,
): Extract<GraphNode, { readonly kind: T }> | undefined {
  return nodes.find(
    (node): node is Extract<GraphNode, { readonly kind: T }> =>
      node.kind === kind && String(node.value.id) === id,
  )
}

function criteriaForChange(
  service: OrvenService,
  ownedChangeId: ChangeId,
): readonly CriterionRevision[] {
  const snapshot = service.snapshot()
  const criterionIds: CriterionId[] = []
  for (const relation of snapshot.relations) {
    if (
      relation.kind === 'has_criterion' &&
      relation.source.kind === 'change' &&
      relation.source.id === ownedChangeId &&
      relation.target.kind === 'criterion'
    ) {
      criterionIds.push(relation.target.id)
    }
  }

  const criterionSet = new Set<CriterionId>(criterionIds)
  const latest = new Map<CriterionId, CriterionRevision>()
  for (const revision of snapshot.criterionRevisions) {
    if (!criterionSet.has(revision.criterionId)) continue
    const current = latest.get(revision.criterionId)
    if (current === undefined || revision.revision > current.revision) {
      latest.set(revision.criterionId, revision)
    }
  }

  return criterionIds
    .map(id => latest.get(id))
    .filter((revision): revision is CriterionRevision => revision !== undefined)
}

export interface StatusResult {
  readonly change: {
    readonly id: string
    readonly title: string
    readonly kind: string
  }
  readonly graphRevision: number
  readonly workspace: string
  readonly realityProvider: string
  readonly criteria: readonly {
    readonly id: string
    readonly revision: number
    readonly statement: string
    readonly severity: string
    readonly complete: boolean
    readonly requirements: readonly {
      readonly id: string
      readonly state: string
      readonly satisfyingEvidenceIds: readonly string[]
      readonly contradictingEvidenceIds: readonly string[]
    }[]
  }[]
  readonly coverage: {
    readonly requiredComplete: number
    readonly requiredTotal: number
  }
  readonly gateState: 'pending' | 'satisfied' | 'failed'
  readonly capturedArtifactIds: readonly string[]
}

export async function status(
  ctx: Context,
  root: OrvenService,
  agent: Agent | undefined,
): Promise<StatusResult> {
  const active = await activeChangeContext(ctx, root, agent)
  const snapshot = active.service.snapshot()
  const changeNode = nodeById(
    snapshot.nodes,
    'change',
    String(active.changeId),
  )
  if (changeNode === undefined) {
    throw new Error(
      `Active Orven Change ${active.changeId} is not present in this workspace Graph.`,
    )
  }

  const observedAt = now()
  const actor = actorForAgent(active.agent)
  const reality = await captureWorkspaceReality(
    active.workspace,
    observedAt,
    actor,
  )
  const evidence = snapshot.nodes
    .filter(
      (node): node is Extract<GraphNode, { readonly kind: 'evidence' }> =>
        node.kind === 'evidence',
    )
    .map(node => node.value)
  const invalidated = new Set(
    snapshot.evidenceInvalidations.map(record => record.evidenceId),
  )

  const criteria = criteriaForChange(active.service, active.changeId)
    .map(revision => {
      const coverage = evaluateCriterionEvidenceCoverage({
        revision,
        evidence,
        currentReality: reality.reality,
        invalidatedEvidenceIds: invalidated,
      })
      return {
        id: String(revision.criterionId),
        revision: revision.revision,
        statement: revision.statement,
        severity: revision.severity,
        complete: coverage.complete,
        requirements: coverage.requirements.map(requirement => ({
          id: String(requirement.requirementId),
          state: requirement.state,
          satisfyingEvidenceIds: requirement.satisfying.map(ref => String(ref.id)),
          contradictingEvidenceIds: requirement.contradicting.map(ref => String(ref.id)),
        })),
      }
    })

  const required = criteria.filter(item => item.severity === 'required')
  const requiredComplete = required.filter(item => item.complete).length
  const requiredFailed = required.some(item =>
    item.requirements.some(requirement =>
      requirement.state === 'contradicted' ||
      requirement.state === 'conflicted',
    ),
  )
  const gateState: StatusResult['gateState'] = requiredFailed
    ? 'failed'
    : requiredComplete === required.length
      ? 'satisfied'
      : 'pending'

  const capturedArtifactIds = snapshot.nodes
    .filter(
      (node): node is Extract<GraphNode, { readonly kind: 'artifact' }> =>
        node.kind === 'artifact' && node.value.type === 'dsh-tool-result',
    )
    .slice(-20)
    .map(node => String(node.value.id))

  return {
    change: {
      id: String(changeNode.value.id),
      title: changeNode.value.title,
      kind: changeNode.value.kind,
    },
    graphRevision: Number(snapshot.revision),
    workspace: active.workspace,
    realityProvider: reality.provider,
    criteria,
    coverage: {
      requiredComplete,
      requiredTotal: required.length,
    },
    gateState,
    capturedArtifactIds,
  }
}

export interface RecordEvidenceInput {
  readonly criterionId: string
  readonly artifactIds: readonly string[]
  readonly claim: string
  readonly result: 'supports' | 'contradicts' | 'inconclusive'
}

export interface RecordEvidenceResult {
  readonly evidenceId: string
  readonly criterionId: string
  readonly criterionRevision: number
  readonly graphRevision: number
  readonly realityArtifactId: string
}

export async function recordEvidence(
  ctx: Context,
  root: OrvenService,
  agent: Agent | undefined,
  input: RecordEvidenceInput,
): Promise<RecordEvidenceResult> {
  const active = await activeChangeContext(ctx, root, agent)
  if (input.artifactIds.length === 0) {
    throw new Error('orven_record_evidence requires at least one source Artifact.')
  }
  const claim = input.claim.trim()
  if (claim === '') throw new Error('Evidence claim must be non-empty.')

  const revisions = criteriaForChange(active.service, active.changeId)
  const revision = revisions.find(
    item => String(item.criterionId) === input.criterionId,
  )
  if (revision === undefined) {
    throw new Error(
      `Criterion ${input.criterionId} does not belong to the active Orven Change.`,
    )
  }

  const snapshot = active.service.snapshot()
  const sources = input.artifactIds.map(id => {
    const node = nodeById(snapshot.nodes, 'artifact', id)
    if (node === undefined) {
      throw new Error(`Evidence source Artifact ${id} does not exist.`)
    }
    return node.value
  })

  const actor = actorForAgent(active.agent)
  const observedAt = now()
  const reality = await captureWorkspaceReality(
    active.workspace,
    observedAt,
    actor,
  )
  const id = evidenceId()
  const evidence: Evidence = {
    id,
    kind: BUILTIN_EVIDENCE_KINDS.runtimeObservation.kind,
    kindVersion: BUILTIN_EVIDENCE_KINDS.runtimeObservation.version,
    claim,
    result: input.result,
    subjects: [{
      kind: 'criterion_revision',
      revision: {
        criterionId: revision.criterionId,
        revision: revision.revision,
      },
    }],
    reality: reality.reality,
    sources: sources.map(artifact => ({
      artifact: { id: artifact.id },
      role: 'raw_output' as const,
    })),
    observedAt,
    payload: {
      signal: 'orven/artifact-backed-claim',
      value: {
        artifactIds: input.artifactIds,
        claim,
        result: input.result,
      },
    },
  }
  validateEvidence(evidence, evidenceRegistry)

  const events: PendingEvent[] = []
  if (nodeById(snapshot.nodes, 'artifact', String(reality.artifact.id)) === undefined) {
    events.push(pending({
      type: 'artifact.recorded',
      artifact: reality.artifact,
    }, observedAt))
  }
  events.push(
    pending({
      type: 'evidence.recorded',
      evidence,
    }, observedAt),
    pending({
      type: 'relation.created',
      relation: {
        id: relationId(),
        source: { kind: 'evidence', id },
        target: { kind: 'artifact', id: reality.artifact.id },
        kind: 'observed_on',
        createdAt: observedAt,
        createdBy: actor,
      },
    }, observedAt),
  )

  if (input.result !== 'inconclusive') {
    events.push(pending({
      type: 'relation.created',
      relation: {
        id: relationId(),
        source: { kind: 'evidence', id },
        target: { kind: 'criterion', id: revision.criterionId },
        kind: input.result === 'supports' ? 'supports' : 'contradicts',
        createdAt: observedAt,
        createdBy: actor,
      },
    }, observedAt))
  }

  await appendChangeEvents(
    active.service,
    active.changeId,
    actor,
    events,
  )

  return {
    evidenceId: String(id),
    criterionId: String(revision.criterionId),
    criterionRevision: revision.revision,
    graphRevision: Number(active.service.currentRevision()),
    realityArtifactId: String(reality.artifact.id),
  }
}

function jsonValue(value: unknown): JsonValue {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function toolArtifact(
  agent: Agent,
  exec: Readonly<ToolExecution>,
  result: Readonly<ToolExecutionResult>,
): Artifact {
  const digest = createHash('sha256')
    .update(String(agent.id))
    .update('\0')
    .update(String(exec.callId))
    .digest('hex')
  const createdAt = now()

  return {
    id: `artifact:dsh-tool:${digest}` as ArtifactId,
    type: 'dsh-tool-result',
    metadata: {
      tool: exec.name,
      callId: String(exec.callId),
      sessionId: String(agent.id),
      arguments: jsonValue(exec.arguments),
      outcome: result.isError
        ? {
            isError: true,
            content: jsonValue(result.content),
          }
        : {
            isError: false,
            value: result.value,
          },
    },
    createdAt,
    createdBy: actorForAgent(agent),
  }
}

interface ExecutionCapture {
  readonly workspace: string
  readonly changeId: ChangeId
  readonly artifacts: Artifact[]
}

export class ExecutionCaptureRegistry {
  readonly #captures = new Map<string, ExecutionCapture>()

  begin(
    sessionId: string,
    workspace: string,
    ownedChangeId: ChangeId,
  ): void {
    if (this.#captures.has(sessionId)) {
      throw new Error(`Execution capture already exists for DSH Session ${sessionId}`)
    }
    this.#captures.set(sessionId, {
      workspace,
      changeId: ownedChangeId,
      artifacts: [],
    })
  }

  capture(sessionId: string, artifact: Artifact): boolean {
    const capture = this.#captures.get(sessionId)
    if (capture === undefined) return false
    capture.artifacts.push(artifact)
    return true
  }

  end(sessionId: string): readonly Artifact[] {
    const capture = this.#captures.get(sessionId)
    this.#captures.delete(sessionId)
    return capture?.artifacts ?? []
  }

  cancel(sessionId: string): void {
    this.#captures.delete(sessionId)
  }
}

export async function recordObservedToolArtifact(
  ctx: Context,
  root: OrvenService,
  captures: ExecutionCaptureRegistry,
  exec: Readonly<ToolExecution>,
  result: Readonly<ToolExecutionResult>,
): Promise<void> {
  if (exec.name.startsWith('orven_')) return
  const agent = exec.agent
  if (agent === undefined) return

  const artifact = toolArtifact(agent, exec, result)
  if (captures.capture(String(agent.id), artifact)) return

  const binding = readOrvenSessionBinding(ctx, agent.session)
  if (binding.changeId === null || binding.workspace === null) return

  const service = await root.forWorkspace(binding.workspace)
  const snapshot = service.snapshot()
  if (nodeById(snapshot.nodes, 'artifact', String(artifact.id)) !== undefined) {
    return
  }

  await appendChangeEvents(
    service,
    binding.changeId as ChangeId,
    actorForAgent(agent),
    [pending({
      type: 'artifact.recorded',
      artifact,
    }, artifact.createdAt)],
  )
}

function collectWorkerOutcome(agent: Agent): {
  readonly status: 'succeeded' | 'failed' | 'cancelled'
  readonly artifacts: readonly []
  readonly evidence: readonly []
  readonly findings: readonly []
  readonly decisions: readonly []
  readonly diagnostics: string
} {
  // Existing DSH API: the worker has reached idle, so its terminal turn/end is
  // stable for this lifecycle. This adapter reads the exact durable event
  // rather than equating "idle" with success.
  const terminal = [...agent.session.snapshotEvents()]
    .reverse()
    .find(event => event.type === 'turn/end')

  if (terminal?.type !== 'turn/end') {
    return {
      status: 'failed',
      artifacts: [],
      evidence: [],
      findings: [],
      decisions: [],
      diagnostics: 'DSH worker reached idle without a terminal turn/end event.',
    }
  }

  const kind = terminal.data.reason.kind
  return {
    status: kind === 'completed'
      ? 'succeeded'
      : kind === 'aborted'
        ? 'cancelled'
        : 'failed',
    artifacts: [],
    evidence: [],
    findings: [],
    decisions: [],
    diagnostics: `DSH worker terminal reason: ${kind}.`,
  }
}

export interface ExecuteResult {
  readonly state: string
  readonly executionId: string
  readonly runId?: string
  readonly graphRevision: number
  readonly capturedArtifactIds: readonly string[]
  readonly expectedRevision?: number
  readonly actualRevision?: number
}

export async function executeChangeWork(
  ctx: Context,
  root: OrvenService,
  captures: ExecutionCaptureRegistry,
  agent: Agent | undefined,
  objectiveInput: string,
  signal?: AbortSignal,
): Promise<ExecuteResult> {
  if (agent !== undefined) assertCoordinatorAgent(agent, 'orven_execute')
  const active = await activeChangeContext(ctx, root, agent)
  const objective = objectiveInput.trim()
  if (objective === '') throw new Error('Orven Work objective must be non-empty.')

  const capability = 'dsh.agent' as CapabilityId
  const work = materializeWork({
    changeId: active.changeId,
    graphRevision: active.service.currentRevision(),
    objective,
    requiredCapabilities: [capability],
    priority: 'normal',
    source: {
      kind: 'node',
      node: { kind: 'change', id: active.changeId },
    },
    context: {
      query: {
        direction: 'both',
        relationKinds: [
          'has_criterion',
          'attempts',
          'produces',
          'supports',
          'contradicts',
        ],
        maxDepth: 3,
        includeSubjectEvidence: true,
      },
      budget: {
        maxNodes: 128,
        maxRelations: 256,
        maxCriterionRevisions: 64,
      },
    },
  })

  const prepared = active.service.prepareWork({
    work,
    worker: {
      id: 'orven-dsh-worker',
      capabilities: [capability],
      maxParallel: 1,
    },
    attempt: 1,
  })
  const workerSessionId = String(dshSessionId(prepared.executionId))
  captures.begin(workerSessionId, active.workspace, active.changeId)

  let execution: ExecutionResult
  let artifacts: readonly Artifact[]
  try {
    execution = await active.service.executePrepared({
      prepared,
      parentAgent: active.agent,
      collector: {
        collect: async worker => collectWorkerOutcome(worker),
      },
      ...(signal === undefined ? {} : { signal }),
    })
    artifacts = captures.end(workerSessionId)
  } catch (error) {
    captures.cancel(workerSessionId)
    throw error
  }

  if (execution.state === 'stale') {
    return {
      state: 'stale',
      executionId: String(execution.executionId),
      graphRevision: Number(active.service.currentRevision()),
      capturedArtifactIds: [],
      expectedRevision: Number(execution.expectedRevision),
      actualRevision: Number(execution.actualRevision),
    }
  }

  const actor = actorForAgent(active.agent)
  const recordedAt = execution.run.finishedAt
  const snapshot = active.service.snapshot()
  const uniqueArtifacts = artifacts.filter(
    artifact =>
      nodeById(snapshot.nodes, 'artifact', String(artifact.id)) === undefined,
  )
  const events: PendingEvent[] = [
    pending({
      type: 'run.recorded',
      run: execution.run,
    }, recordedAt),
    ...uniqueArtifacts.map(artifact =>
      pending({
        type: 'artifact.recorded',
        artifact,
      }, artifact.createdAt),
    ),
    pending({
      type: 'relation.created',
      relation: {
        id: relationId(),
        source: { kind: 'run', id: execution.run.id },
        target: { kind: 'change', id: active.changeId },
        kind: 'attempts',
        createdAt: recordedAt,
        createdBy: actor,
      },
    }, recordedAt),
    ...uniqueArtifacts.map(artifact =>
      pending({
        type: 'relation.created',
        relation: {
          id: relationId(),
          source: { kind: 'run', id: execution.run.id },
          target: { kind: 'artifact', id: artifact.id },
          kind: 'produces',
          createdAt: recordedAt,
          createdBy: actor,
        },
      }, recordedAt),
    ),
  ]

  await appendChangeEvents(
    active.service,
    active.changeId,
    actor,
    events,
  )

  return {
    state: execution.state,
    executionId: String(execution.executionId),
    runId: String(execution.run.id as RunId),
    graphRevision: Number(active.service.currentRevision()),
    capturedArtifactIds: uniqueArtifacts.map(artifact => String(artifact.id)),
  }
}
