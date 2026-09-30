import { createHash } from 'node:crypto'
import type {
  Artifact,
  ArtifactId,
  ArtifactRef,
  Evidence,
  EvidenceId,
  EvidenceReality,
  EvidenceSubjectRef,
  Finding,
  FindingId,
  JsonValue,
  Relation,
  RelationId,
} from '@dsh-factory/core'
import { BUILTIN_EVIDENCE_KINDS } from '@dsh-factory/evidence'
import type {
  HealthRule,
  ProductionMetricObservation,
  ProductionObservationContext,
  ProductionObservationResult,
} from './types.js'

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Production observation contains non-finite number')
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
  throw new Error('Production observation contains non-JSON value')
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')
}

function refs(values: readonly ArtifactRef[]): readonly ArtifactRef[] {
  const map = new Map(values.map(ref => [String(ref.id), ref]))
  return [...map.values()].sort((a, b) => compareText(String(a.id), String(b.id)))
}

function subjectKey(subject: EvidenceSubjectRef): string {
  return subject.kind === 'node'
    ? `node:${subject.node.kind}:${subject.node.id}`
    : `criterion:${subject.revision.criterionId}@${subject.revision.revision}`
}

function subjects(values: readonly EvidenceSubjectRef[]): readonly EvidenceSubjectRef[] {
  const map = new Map(values.map(value => [subjectKey(value), value]))
  return [...map.values()].sort((a, b) => compareText(subjectKey(a), subjectKey(b)))
}

function normalizeReality(value: EvidenceReality): EvidenceReality {
  const result = {
    targets: refs(value.targets),
    environment: refs(value.environment),
    configuration: refs(value.configuration),
  }
  if (result.targets.length === 0) {
    throw new Error('Production Evidence Reality requires at least one target Artifact')
  }
  return result
}

function normalizeRule(rule: HealthRule): HealthRule {
  if (rule.id.trim() === '') throw new Error('Health Rule id must be non-empty')
  if (rule.signal.trim() === '') throw new Error('Health Rule signal must be non-empty')
  if (!Number.isFinite(rule.threshold)) throw new Error('Health Rule threshold must be finite')
  if (!['lt', 'lte', 'gt', 'gte'].includes(rule.comparator)) {
    throw new Error(`Invalid Health Rule comparator ${rule.comparator}`)
  }
  if (rule.description.trim() === '') throw new Error('Health Rule description must be non-empty')
  return { ...rule, id: rule.id.trim(), signal: rule.signal.trim() }
}

function evaluate(value: number, rule: HealthRule): boolean {
  switch (rule.comparator) {
    case 'lt':
      return value < rule.threshold
    case 'lte':
      return value <= rule.threshold
    case 'gt':
      return value > rule.threshold
    case 'gte':
      return value >= rule.threshold
  }
}

function expectation(rule: HealthRule, unit: string): string {
  const operator = {
    lt: '<',
    lte: '<=',
    gt: '>',
    gte: '>=',
  }[rule.comparator]
  return `${rule.signal} ${operator} ${rule.threshold} ${unit}`.trim()
}

export function ingestProductionMetric(
  input: ProductionMetricObservation,
  ruleInput: HealthRule,
  context: ProductionObservationContext,
): ProductionObservationResult {
  const provider = input.provider.trim()
  const observationId = input.observationId.trim()
  const signal = input.signal.trim()
  const unit = input.unit.trim()
  if (provider === '') throw new Error('Production provider must be non-empty')
  if (observationId === '') throw new Error('Production observation id must be non-empty')
  if (signal === '') throw new Error('Production signal must be non-empty')
  if (!Number.isFinite(input.value)) throw new Error('Production value must be finite')

  const rule = normalizeRule(ruleInput)
  if (signal !== rule.signal) {
    throw new Error(
      `Production observation signal ${signal} does not match Health Rule ${rule.signal}`,
    )
  }

  const normalizedReality = normalizeReality(input.reality)
  const normalizedSubjects = subjects(input.subjects)
  if (normalizedSubjects.length === 0) {
    throw new Error('Production Evidence requires at least one subject')
  }

  const normalized = canonicalize({
    provider,
    observationId,
    signal,
    value: input.value,
    unit,
    observedAt: input.observedAt,
    deployment: input.deployment,
    reality: normalizedReality,
    subjects: normalizedSubjects,
  })
  const artifactHash = digest({ type: 'production/observation', normalized })
  const artifact: Artifact = {
    id: `artifact:production:${artifactHash}` as ArtifactId,
    type: 'production/observation',
    digest: `sha256:${artifactHash}`,
    metadata: normalized,
    createdAt: input.observedAt,
    createdBy: context.actor,
  }

  const healthy = evaluate(input.value, rule)
  const evidenceLogical = {
    artifactId: artifact.id,
    rule,
    healthy,
  }
  const evidence: Evidence = {
    id: `evidence:production:${digest(evidenceLogical)}` as EvidenceId,
    kind: BUILTIN_EVIDENCE_KINDS.runtimeObservation.kind,
    kindVersion: BUILTIN_EVIDENCE_KINDS.runtimeObservation.version,
    claim: rule.description,
    result: healthy ? 'supports' : 'contradicts',
    subjects: normalizedSubjects,
    reality: normalizedReality,
    sources: [{ artifact: { id: artifact.id }, role: 'observation' }],
    observedAt: input.observedAt,
    payload: {
      signal,
      value: input.value,
    },
  }

  if (healthy) return { artifact, evidence }

  const findingHash = digest({
    rule,
    artifactId: artifact.id,
    evidenceId: evidence.id,
  })
  const finding: Finding = {
    id: `finding:production:${findingHash}` as FindingId,
    type: 'production_regression',
    expected: expectation(rule, unit),
    actual: `${signal} = ${input.value} ${unit}`.trim(),
    severity: rule.severity,
    confidence: 1,
    openedAt: input.observedAt,
    openedBy: context.actor,
  }
  const relation: Relation = {
    id: `relation:production-raises:${findingHash}` as RelationId,
    source: { kind: 'evidence', id: evidence.id },
    target: { kind: 'finding', id: finding.id },
    kind: 'raises',
    createdAt: input.observedAt,
    createdBy: context.actor,
  }

  return {
    artifact,
    evidence,
    finding,
    findingRelation: relation,
  }
}
