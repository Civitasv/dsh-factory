import { createHash } from 'node:crypto'
import type {
  Artifact,
  ArtifactId,
  ArtifactRef,
  Evidence,
  EvidenceId,
  EvidenceReality,
  EvidenceSubjectRef,
  JsonValue,
} from '@dsh-factory/core'
import { BUILTIN_EVIDENCE_KINDS } from '@dsh-factory/evidence'
import type {
  CiEvidenceBundle,
  CiIngestionContext,
  CiStaticAnalysisSnapshot,
  CiTestRunSnapshot,
} from './types.js'

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function artifactRefs(refs: readonly ArtifactRef[]): readonly ArtifactRef[] {
  const byId = new Map(refs.map(ref => [String(ref.id), ref]))
  return [...byId.values()].sort((left, right) =>
    compareText(String(left.id), String(right.id)),
  )
}

function subjectKey(subject: EvidenceSubjectRef): string {
  return subject.kind === 'node'
    ? `node:${subject.node.kind}:${subject.node.id}`
    : `criterion:${subject.revision.criterionId}@${subject.revision.revision}`
}

function subjects(
  values: readonly EvidenceSubjectRef[],
): readonly EvidenceSubjectRef[] {
  const byKey = new Map(values.map(subject => [subjectKey(subject), subject]))
  return [...byKey.values()].sort((left, right) =>
    compareText(subjectKey(left), subjectKey(right)),
  )
}

function reality(value: EvidenceReality): EvidenceReality {
  const normalized = {
    targets: artifactRefs(value.targets),
    environment: artifactRefs(value.environment),
    configuration: artifactRefs(value.configuration),
  }
  if (normalized.targets.length === 0) {
    throw new Error('CI Evidence Reality requires at least one target Artifact')
  }
  return normalized
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim()
  if (normalized === '') throw new Error(`${label} must be non-empty`)
  return normalized
}

function nonNegative(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
  return value
}

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer`)
  }
  return value
}

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('CI snapshot contains a non-finite number')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {}
    for (const key of Object.keys(value).sort(compareText)) {
      const child = (value as Record<string, unknown>)[key]
      if (child !== undefined) result[key] = canonicalize(child)
    }
    return result
  }
  throw new Error('CI snapshot contains a non-JSON value')
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')
}

function runArtifact(
  type: string,
  metadata: JsonValue,
  url: string,
  completedAt: string,
  context: CiIngestionContext,
): Artifact {
  const hash = digest({ type, metadata })
  return {
    id: `artifact:ci:${hash}` as ArtifactId,
    type,
    uri: url,
    digest: `sha256:${hash}`,
    metadata,
    createdAt: completedAt,
    createdBy: context.actor,
  }
}

function evidenceId(value: unknown): EvidenceId {
  return `evidence:ci:${digest(value)}` as EvidenceId
}

function evidenceSources(
  artifact: Artifact,
  rawOutputs: readonly ArtifactRef[] | undefined,
) {
  return [
    { artifact: { id: artifact.id }, role: 'raw_output' as const },
    ...artifactRefs(rawOutputs ?? []).map(ref => ({
      artifact: ref,
      role: 'raw_output' as const,
    })),
  ]
}

export function ingestTestRun(
  input: CiTestRunSnapshot,
  context: CiIngestionContext,
): CiEvidenceBundle {
  const provider = nonEmpty(input.provider, 'CI provider')
  const runId = nonEmpty(input.runId, 'CI run id')
  const suite = nonEmpty(input.suite, 'CI test suite')
  const total = nonNegative(input.total, 'CI test total')
  const passed = nonNegative(input.passed, 'CI test passed')
  const failed = nonNegative(input.failed, 'CI test failed')
  const skipped = nonNegative(input.skipped, 'CI test skipped')
  const exitCode = safeInteger(input.exitCode, 'CI test exitCode')
  if (passed + failed + skipped !== total) {
    throw new Error('CI test total must equal passed + failed + skipped')
  }
  if (!['passed', 'failed', 'cancelled'].includes(input.status)) {
    throw new Error(`Invalid CI test status ${input.status}`)
  }

  const normalizedReality = reality(input.reality)
  const normalizedSubjects = subjects(input.subjects)
  if (normalizedSubjects.length === 0) throw new Error('CI Evidence requires at least one subject')

  const metadata = canonicalize({
    provider,
    runId,
    suite,
    status: input.status,
    total,
    passed,
    failed,
    skipped,
    exitCode,
    url: input.url,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    reality: normalizedReality,
    subjects: normalizedSubjects,
    rawOutputs: artifactRefs(input.rawOutputs ?? []),
  })
  const artifact = runArtifact(
    'ci/run',
    metadata,
    input.url,
    input.completedAt,
    context,
  )
  const result =
    input.status === 'passed'
      ? 'supports'
      : input.status === 'failed'
        ? 'contradicts'
        : 'inconclusive'

  const evidence: Evidence = {
    id: evidenceId({
      kind: BUILTIN_EVIDENCE_KINDS.testExecution,
      metadata,
      artifactId: artifact.id,
    }),
    kind: BUILTIN_EVIDENCE_KINDS.testExecution.kind,
    kindVersion: BUILTIN_EVIDENCE_KINDS.testExecution.version,
    claim: `${provider} test suite ${suite} ${input.status}`,
    result,
    subjects: normalizedSubjects,
    reality: normalizedReality,
    sources: evidenceSources(artifact, input.rawOutputs),
    observedAt: input.completedAt,
    payload: {
      suite,
      total,
      passed,
      failed,
      skipped,
      exitCode,
    },
  }

  return { artifact, evidence }
}

export function ingestStaticAnalysis(
  input: CiStaticAnalysisSnapshot,
  context: CiIngestionContext,
): CiEvidenceBundle {
  const provider = nonEmpty(input.provider, 'CI provider')
  const runId = nonEmpty(input.runId, 'CI run id')
  const tool = nonEmpty(input.tool, 'Static-analysis tool')
  const findings = nonNegative(input.findings, 'Static-analysis findings')
  if (!['completed', 'cancelled'].includes(input.status)) {
    throw new Error(`Invalid static-analysis status ${input.status}`)
  }

  const normalizedReality = reality(input.reality)
  const normalizedSubjects = subjects(input.subjects)
  if (normalizedSubjects.length === 0) throw new Error('CI Evidence requires at least one subject')

  const metadata = canonicalize({
    provider,
    runId,
    tool,
    status: input.status,
    findings,
    url: input.url,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    reality: normalizedReality,
    subjects: normalizedSubjects,
    rawOutputs: artifactRefs(input.rawOutputs ?? []),
  })
  const artifact = runArtifact(
    'ci/static-analysis-run',
    metadata,
    input.url,
    input.completedAt,
    context,
  )
  const result =
    input.status === 'cancelled'
      ? 'inconclusive'
      : findings === 0
        ? 'supports'
        : 'contradicts'

  const evidence: Evidence = {
    id: evidenceId({
      kind: BUILTIN_EVIDENCE_KINDS.staticAnalysis,
      metadata,
      artifactId: artifact.id,
    }),
    kind: BUILTIN_EVIDENCE_KINDS.staticAnalysis.kind,
    kindVersion: BUILTIN_EVIDENCE_KINDS.staticAnalysis.version,
    claim: `${provider} static analysis ${tool} reported ${findings} findings`,
    result,
    subjects: normalizedSubjects,
    reality: normalizedReality,
    sources: evidenceSources(artifact, input.rawOutputs),
    observedAt: input.completedAt,
    payload: { tool, findings },
  }

  return { artifact, evidence }
}
