import { randomUUID } from 'node:crypto'
import type {
  ActorRef,
  Artifact,
  Change,
  ChangeDispositionRecord,
  ChangeGraphSnapshot,
  ChangeId,
  ChangeKind,
  CriterionId,
  CriterionRevision,
  Decision,
  Evidence,
  EvidenceKindRef,
  EvidenceRequirement,
  EvidenceRequirementId,
  Finding,
  GateId,
  GateState,
  GraphId,
  GraphRevision,
  JsonValue,
  Relation,
  RelationId,
  Run,
  RunId,
} from '@orven/internal-domain'
import type {
  AppendRequest,
  DomainEvent,
  EventEnvelope,
  PendingEvent,
} from '@orven/internal-events'
import { projectChangeGraph } from '@orven/internal-events'
import {
  assertCriterionEvidenceRequirements,
  BUILTIN_EVIDENCE_KINDS,
  createBuiltInEvidenceRegistry,
  validateEvidence,
  type EvidenceRegistry,
} from '@orven/internal-evidence'
import type {
  AcceptedExecutionResult,
  ExecutionResult,
} from '@orven/internal-execution'
import {
  materializeWork,
  type CapabilityId,
  type WorkItem,
} from '@orven/internal-work'

export interface OrvenApplicationStore {
  readonly graphId: GraphId
  currentRevision(): GraphRevision
  currentSequence(changeId: ChangeId): number
  readAll(): readonly EventEnvelope[]
  append(
    request: AppendRequest,
  ): readonly EventEnvelope[] | Promise<readonly EventEnvelope[]>
}

export interface BeginChangeCriterionInput {
  readonly statement: string
  readonly severity?: CriterionRevision['severity']
  readonly acceptedEvidenceKinds?: readonly EvidenceKindRef[]
}

export interface BeginChangeInput {
  readonly title: string
  readonly kind: ChangeKind
  readonly criteria: readonly BeginChangeCriterionInput[]
  readonly actor: ActorRef
}

export interface BeginChangeCriterionResult {
  readonly criterionId: CriterionId
  readonly revision: number
  readonly statement: string
  readonly severity: CriterionRevision['severity']
}

export interface BeginChangeResult {
  readonly changeId: ChangeId
  readonly graphRevision: GraphRevision
  readonly gateId: GateId
  readonly criteria: readonly BeginChangeCriterionResult[]
}

export interface CriterionEvidenceFacts {
  readonly supporting: number
  readonly contradicting: number
  readonly inconclusive: number
  readonly invalidated: number
}

export interface ChangeCriterionStatus extends BeginChangeCriterionResult {
  readonly evidence: CriterionEvidenceFacts
}

export interface ChangeGateStatus {
  readonly gateId: GateId
  readonly kind: string
  readonly state: GateState
  readonly evidenceCount: number
}

export interface ChangeRunSummary {
  readonly runId: RunId
  readonly status: Run['status']
  readonly objective: string
  readonly startedAt: string
  readonly finishedAt: string
}

export interface ChangeRunStatus {
  readonly total: number
  readonly succeeded: number
  readonly failed: number
  readonly cancelled: number
  readonly latest?: ChangeRunSummary
}

export interface ChangeStatus {
  readonly changeId: ChangeId
  readonly graphRevision: GraphRevision
  readonly title: string
  readonly kind: ChangeKind
  readonly criteria: readonly ChangeCriterionStatus[]
  readonly gates: readonly ChangeGateStatus[]
  readonly runs: ChangeRunStatus
  readonly disposition?: ChangeDispositionRecord['disposition']
}

export interface DeriveChangeWorkInput {
  readonly changeId: ChangeId
  readonly requiredCapabilities: readonly CapabilityId[]
  readonly objective?: string
}

export interface RecordExecutionInput {
  readonly changeId: ChangeId
  readonly result: ExecutionResult
  readonly actor: ActorRef
}

export interface RecordExecutionResult {
  readonly runId: RunId
  readonly graphRevision: GraphRevision
  readonly appendedEvents: number
}

export interface OrvenApplicationOptions {
  readonly clock?: () => string
  readonly ids?: () => string
  readonly evidenceRegistry?: EvidenceRegistry
}

const DEFAULT_EVIDENCE_KINDS: readonly EvidenceKindRef[] = [
  BUILTIN_EVIDENCE_KINDS.testExecution,
  BUILTIN_EVIDENCE_KINDS.reproduction,
  BUILTIN_EVIDENCE_KINDS.metric,
  BUILTIN_EVIDENCE_KINDS.staticAnalysis,
  BUILTIN_EVIDENCE_KINDS.visualObservation,
  BUILTIN_EVIDENCE_KINDS.runtimeObservation,
  BUILTIN_EVIDENCE_KINDS.deploymentObservation,
]

const DEFAULT_RELATION_KINDS = [
  'has_criterion',
  'evaluates',
  'attempts',
  'produces',
  'supports',
  'contradicts',
] as const

function normalizedStatement(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim()
  if (trimmed === '') throw new Error(`${label} must be non-empty`)
  return trimmed
}

function sortText(left: string, right: string): number {
  return left.localeCompare(right)
}

function latestRevision(
  revisions: readonly CriterionRevision[],
  criterionId: CriterionId,
): CriterionRevision | undefined {
  return revisions
    .filter(revision => revision.criterionId === criterionId)
    .sort((left, right) => right.revision - left.revision)[0]
}

function exactCriterionSubject(
  evidence: Evidence,
  revision: CriterionRevision,
): boolean {
  return evidence.subjects.some(subject =>
    subject.kind === 'criterion_revision'
    && subject.revision.criterionId === revision.criterionId
    && subject.revision.revision === revision.revision
  )
}

function runNode(
  snapshot: ChangeGraphSnapshot,
  runId: RunId,
): Run | undefined {
  const node = snapshot.nodes.find(candidate =>
    candidate.kind === 'run' && candidate.value.id === runId
  )
  return node?.kind === 'run' ? node.value : undefined
}

function acceptedResult(result: ExecutionResult): AcceptedExecutionResult {
  if (result.state === 'stale') {
    throw new Error(
      `Cannot record stale execution ${result.executionId}: expected Graph Revision ${result.expectedRevision}, actual ${result.actualRevision}`,
    )
  }
  return result
}

export class OrvenApplication {
  readonly #clock: () => string
  readonly #ids: () => string
  readonly #evidenceRegistry: EvidenceRegistry

  constructor(
    readonly store: OrvenApplicationStore,
    options: OrvenApplicationOptions = {},
  ) {
    this.#clock = options.clock ?? (() => new Date().toISOString())
    this.#ids = options.ids ?? randomUUID
    this.#evidenceRegistry =
      options.evidenceRegistry ?? createBuiltInEvidenceRegistry()
  }

  snapshot(): ChangeGraphSnapshot {
    return projectChangeGraph(this.store.graphId, this.store.readAll())
  }

  async beginChange(input: BeginChangeInput): Promise<BeginChangeResult> {
    const title = requireText(input.title, 'Change title')
    if (input.criteria.length === 0) {
      throw new Error('Change requires at least one Criterion')
    }

    const statements = new Set<string>()
    for (const criterion of input.criteria) {
      const statement = requireText(
        criterion.statement,
        'Criterion statement',
      )
      const normalized = normalizedStatement(statement)
      if (statements.has(normalized)) {
        throw new Error(`Duplicate Criterion statement: ${statement}`)
      }
      statements.add(normalized)
      if (
        criterion.acceptedEvidenceKinds !== undefined
        && criterion.acceptedEvidenceKinds.length === 0
      ) {
        throw new Error('Criterion acceptedEvidenceKinds cannot be empty')
      }
    }

    const now = this.#clock()
    const changeId = this.#changeId()
    const gateId = this.#gateId()
    const criteria = input.criteria.map(criterion => {
      const criterionId = this.#criterionId()
      const evidenceRequirement: EvidenceRequirement = {
        id: this.#requirementId(),
        acceptedKinds: criterion.acceptedEvidenceKinds
          ?? DEFAULT_EVIDENCE_KINDS,
        requiredResult: 'supports',
        minimumCount: 1,
        reality: 'current',
        description:
          'Artifact-backed Evidence supporting this acceptance criterion in the current Reality.',
      }
      const revision: CriterionRevision = {
        criterionId,
        revision: 1,
        statement: criterion.statement.trim(),
        evidenceRequirements: [evidenceRequirement],
        severity: criterion.severity ?? 'required',
        publishedAt: now,
        publishedBy: input.actor,
      }
      assertCriterionEvidenceRequirements(revision)
      return { criterionId, revision }
    })

    const change: Change = {
      id: changeId,
      kind: input.kind,
      title,
      createdAt: now,
      createdBy: input.actor,
    }

    const events: PendingEvent[] = []
    const push = (event: DomainEvent): void => {
      events.push({
        eventId: this.#eventId(),
        occurredAt: now,
        event,
      })
    }

    push({ type: 'change.created', change })
    for (const criterion of criteria) {
      push({
        type: 'criterion.created',
        criterion: {
          id: criterion.criterionId,
          createdAt: now,
          createdBy: input.actor,
        },
      })
      push({
        type: 'criterion.revision.published',
        revision: criterion.revision,
      })
    }

    push({
      type: 'gate.created',
      gate: {
        id: gateId,
        kind: 'acceptance',
        createdAt: now,
        createdBy: input.actor,
      },
    })

    for (const criterion of criteria) {
      push({
        type: 'relation.created',
        relation: this.#relation(
          { kind: 'change', id: changeId },
          { kind: 'criterion', id: criterion.criterionId },
          'has_criterion',
          now,
          input.actor,
        ),
      })
      push({
        type: 'relation.created',
        relation: this.#relation(
          { kind: 'gate', id: gateId },
          { kind: 'criterion', id: criterion.criterionId },
          'evaluates',
          now,
          input.actor,
        ),
      })
    }

    await this.store.append({
      changeId,
      expectedSequence: 0,
      expectedRevision: this.store.currentRevision(),
      actor: input.actor,
      events,
    })

    return {
      changeId,
      graphRevision: this.store.currentRevision(),
      gateId,
      criteria: criteria.map(item => ({
        criterionId: item.criterionId,
        revision: 1,
        statement: item.revision.statement,
        severity: item.revision.severity,
      })),
    }
  }

  status(changeId: ChangeId): ChangeStatus {
    const snapshot = this.snapshot()
    const changeNode = snapshot.nodes.find(node =>
      node.kind === 'change' && node.value.id === changeId
    )
    if (changeNode?.kind !== 'change') {
      throw new Error(`Change ${changeId} does not exist`)
    }

    const criterionIds = snapshot.relations
      .filter(relation =>
        relation.kind === 'has_criterion'
        && relation.source.kind === 'change'
        && relation.source.id === changeId
        && relation.target.kind === 'criterion'
      )
      .map(relation => relation.target.id as CriterionId)

    const invalidated = new Set(
      snapshot.evidenceInvalidations.map(record => record.evidenceId),
    )
    const evidenceNodes = snapshot.nodes
      .filter((node): node is Extract<typeof node, { kind: 'evidence' }> =>
        node.kind === 'evidence'
      )

    const criteria: ChangeCriterionStatus[] = criterionIds
      .map(criterionId => {
        const revision = latestRevision(
          snapshot.criterionRevisions,
          criterionId,
        )
        if (revision === undefined) {
          throw new Error(
            `Criterion ${criterionId} has no published revision`,
          )
        }

        const subjectEvidence = evidenceNodes
          .map(node => node.value)
          .filter(evidence => exactCriterionSubject(evidence, revision))
        const active = subjectEvidence.filter(
          evidence => !invalidated.has(evidence.id),
        )

        return {
          criterionId,
          revision: revision.revision,
          statement: revision.statement,
          severity: revision.severity,
          evidence: {
            supporting: active.filter(
              evidence => evidence.result === 'supports',
            ).length,
            contradicting: active.filter(
              evidence => evidence.result === 'contradicts',
            ).length,
            inconclusive: active.filter(
              evidence => evidence.result === 'inconclusive',
            ).length,
            invalidated: subjectEvidence.length - active.length,
          },
        }
      })
      .sort((left, right) =>
        sortText(String(left.criterionId), String(right.criterionId))
      )

    const criterionSet = new Set(criterionIds)
    const gateIds = new Set<GateId>()
    for (const relation of snapshot.relations) {
      if (
        relation.kind === 'evaluates'
        && relation.source.kind === 'gate'
        && relation.target.kind === 'criterion'
        && criterionSet.has(relation.target.id)
      ) {
        gateIds.add(relation.source.id)
      }
    }

    const evaluations = new Map(
      snapshot.gateEvaluations.map(value => [value.gateId, value]),
    )
    const gates = [...gateIds]
      .map(gateId => {
        const node = snapshot.nodes.find(candidate =>
          candidate.kind === 'gate' && candidate.value.id === gateId
        )
        if (node?.kind !== 'gate') {
          throw new Error(`Gate ${gateId} does not exist`)
        }
        const evaluation = evaluations.get(gateId)
        return {
          gateId,
          kind: node.value.kind,
          state: evaluation?.state ?? 'pending',
          evidenceCount: evaluation?.evidence.length ?? 0,
        } satisfies ChangeGateStatus
      })
      .sort((left, right) =>
        sortText(String(left.gateId), String(right.gateId))
      )

    const runIds = snapshot.relations
      .filter(relation =>
        relation.kind === 'attempts'
        && relation.source.kind === 'run'
        && relation.target.kind === 'change'
        && relation.target.id === changeId
      )
      .map(relation => relation.source.id as RunId)
    const runs = runIds
      .map(runId => runNode(snapshot, runId))
      .filter((run): run is Run => run !== undefined)
      .sort((left, right) =>
        left.finishedAt === right.finishedAt
          ? sortText(String(left.id), String(right.id))
          : left.finishedAt.localeCompare(right.finishedAt)
      )
    const latest = runs.at(-1)

    const disposition = snapshot.changeDispositions.find(
      record => record.changeId === changeId,
    )

    return {
      changeId,
      graphRevision: snapshot.revision,
      title: changeNode.value.title,
      kind: changeNode.value.kind,
      criteria,
      gates,
      runs: {
        total: runs.length,
        succeeded: runs.filter(run => run.status === 'succeeded').length,
        failed: runs.filter(run => run.status === 'failed').length,
        cancelled: runs.filter(run => run.status === 'cancelled').length,
        ...(latest === undefined
          ? {}
          : {
              latest: {
                runId: latest.id,
                status: latest.status,
                objective: latest.objective,
                startedAt: latest.startedAt,
                finishedAt: latest.finishedAt,
              },
            }),
      },
      ...(disposition === undefined
        ? {}
        : { disposition: disposition.disposition }),
    }
  }

  deriveWork(input: DeriveChangeWorkInput): WorkItem {
    const status = this.status(input.changeId)
    const objective = input.objective?.trim()
      || [
        `Implement Change: ${status.title}.`,
        'Use the repository tools to inspect, modify, and verify the workspace.',
        'Do not invent Orven Evidence from prose; leave verification facts in concrete tool results.',
        'Acceptance criteria:',
        ...status.criteria.map(criterion =>
          `- [${criterion.severity}] ${criterion.statement}`
        ),
      ].join('\n')

    return materializeWork({
      changeId: input.changeId,
      graphRevision: status.graphRevision,
      objective,
      requiredCapabilities: input.requiredCapabilities,
      priority: 'normal',
      source: {
        kind: 'node',
        node: { kind: 'change', id: input.changeId },
      },
      context: {
        query: {
          direction: 'both',
          relationKinds: [...DEFAULT_RELATION_KINDS],
          maxDepth: 3,
          includeSubjectEvidence: true,
        },
        budget: {
          maxNodes: 64,
          maxRelations: 128,
          maxCriterionRevisions: 64,
        },
      },
    })
  }

  async recordExecution(
    input: RecordExecutionInput,
  ): Promise<RecordExecutionResult> {
    const result = acceptedResult(input.result)
    const status = this.status(input.changeId)
    if (result.run.inputGraphRevision !== status.graphRevision) {
      throw new Error(
        `Execution ${result.executionId} was accepted for Graph Revision ${result.run.inputGraphRevision}, current revision is ${status.graphRevision}`,
      )
    }

    for (const evidence of result.evidence) {
      validateEvidence(evidence, this.#evidenceRegistry)
    }

    const now = this.#clock()
    const events: PendingEvent[] = []
    const push = (event: DomainEvent): void => {
      events.push({
        eventId: this.#eventId(),
        occurredAt: now,
        event,
      })
    }

    push({ type: 'run.recorded', run: result.run })
    for (const artifact of result.artifacts) {
      push({ type: 'artifact.recorded', artifact })
    }
    for (const finding of result.findings) {
      push({ type: 'finding.opened', finding })
    }
    for (const decision of result.decisions) {
      push({ type: 'decision.recorded', decision })
    }
    for (const evidence of result.evidence) {
      push({ type: 'evidence.recorded', evidence })
    }

    push({
      type: 'relation.created',
      relation: this.#relation(
        { kind: 'run', id: result.run.id },
        { kind: 'change', id: input.changeId },
        'attempts',
        now,
        input.actor,
      ),
    })

    const produced = [
      ...result.artifacts.map(value => ({
        kind: 'artifact' as const,
        id: value.id,
      })),
      ...result.evidence.map(value => ({
        kind: 'evidence' as const,
        id: value.id,
      })),
      ...result.findings.map(value => ({
        kind: 'finding' as const,
        id: value.id,
      })),
      ...result.decisions.map(value => ({
        kind: 'decision' as const,
        id: value.id,
      })),
    ]
    for (const target of produced) {
      push({
        type: 'relation.created',
        relation: this.#relation(
          { kind: 'run', id: result.run.id },
          target,
          'produces',
          now,
          input.actor,
        ),
      })
    }

    const appended = await this.store.append({
      changeId: input.changeId,
      expectedSequence: this.store.currentSequence(input.changeId),
      expectedRevision: result.run.inputGraphRevision,
      actor: input.actor,
      events,
    })

    return {
      runId: result.run.id,
      graphRevision: this.store.currentRevision(),
      appendedEvents: appended.length,
    }
  }

  #token(prefix: string): string {
    return `${prefix}:${this.#ids()}`
  }

  #changeId(): ChangeId {
    return this.#token('chg') as ChangeId
  }

  #criterionId(): CriterionId {
    return this.#token('crt') as CriterionId
  }

  #gateId(): GateId {
    return this.#token('gate') as GateId
  }

  #requirementId(): EvidenceRequirementId {
    return this.#token('req') as EvidenceRequirementId
  }

  #eventId(): PendingEvent['eventId'] {
    return this.#token('evt') as PendingEvent['eventId']
  }

  #relation(
    source: Relation['source'],
    target: Relation['target'],
    kind: Relation['kind'],
    createdAt: string,
    createdBy: ActorRef,
  ): Relation {
    return {
      id: this.#token('rel') as RelationId,
      source,
      target,
      kind,
      createdAt,
      createdBy,
    }
  }
}

export function executionObservationMetadata(input: {
  readonly tool: string
  readonly callId: string
  readonly arguments: JsonValue
  readonly isError: boolean
  readonly content: JsonValue
  readonly value?: JsonValue
  readonly error?: JsonValue
}): JsonValue {
  return {
    tool: input.tool,
    callId: input.callId,
    arguments: input.arguments,
    isError: input.isError,
    content: input.content,
    ...(input.value === undefined ? {} : { value: input.value }),
    ...(input.error === undefined ? {} : { error: input.error }),
  }
}

export type {
  Artifact,
  Decision,
  Evidence,
  Finding,
}
