import type { EvidenceKindId, JsonValue } from '@dsh-factory/core'
import type { EvidenceKindDefinition } from './registry.js'
import { EvidenceRegistry } from './registry.js'

const kind = (value: string): EvidenceKindId => value as EvidenceKindId

export const BUILTIN_EVIDENCE_KINDS = {
  testExecution: { kind: kind('factory/test-execution'), version: 1 },
  reproduction: { kind: kind('factory/reproduction'), version: 1 },
  metric: { kind: kind('factory/metric'), version: 1 },
  staticAnalysis: { kind: kind('factory/static-analysis'), version: 1 },
  visualObservation: { kind: kind('factory/visual-observation'), version: 1 },
  runtimeObservation: { kind: kind('factory/runtime-observation'), version: 1 },
  deploymentObservation: { kind: kind('factory/deployment-observation'), version: 1 },
  humanAttestation: { kind: kind('factory/human-attestation'), version: 1 },
} as const

function record(payload: JsonValue, label: string): Readonly<Record<string, JsonValue>> {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload as unknown[])) {
    throw new Error(`${label} payload must be an object`)
  }
  return payload as Readonly<Record<string, JsonValue>>
}

function stringField(value: JsonValue | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function booleanField(value: JsonValue | undefined, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`)
  }
  return value
}

function nonNegativeInteger(value: JsonValue | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
  return value
}

function integerField(value: JsonValue | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer`)
  }
  return value
}

function definition(
  ref: { readonly kind: EvidenceKindId; readonly version: number },
  validatePayload: (payload: JsonValue) => void,
): EvidenceKindDefinition {
  return { ...ref, validatePayload }
}

export const BUILTIN_EVIDENCE_DEFINITIONS: readonly EvidenceKindDefinition[] = [
  definition(BUILTIN_EVIDENCE_KINDS.testExecution, payload => {
    const value = record(payload, 'test-execution')
    stringField(value.suite, 'test-execution.suite')
    const total = nonNegativeInteger(value.total, 'test-execution.total')
    const passed = nonNegativeInteger(value.passed, 'test-execution.passed')
    const failed = nonNegativeInteger(value.failed, 'test-execution.failed')
    const skipped = nonNegativeInteger(value.skipped, 'test-execution.skipped')
    integerField(value.exitCode, 'test-execution.exitCode')
    if (passed + failed + skipped !== total) {
      throw new Error('test-execution total must equal passed + failed + skipped')
    }
  }),
  definition(BUILTIN_EVIDENCE_KINDS.reproduction, payload => {
    const value = record(payload, 'reproduction')
    stringField(value.procedure, 'reproduction.procedure')
    booleanField(value.reproduced, 'reproduction.reproduced')
  }),
  definition(BUILTIN_EVIDENCE_KINDS.metric, payload => {
    const value = record(payload, 'metric')
    stringField(value.metric, 'metric.metric')
    stringField(value.unit, 'metric.unit')
    if (!Array.isArray(value.samples) || value.samples.length === 0) {
      throw new Error('metric.samples must be a non-empty array')
    }
    for (const sample of value.samples) {
      if (typeof sample !== 'number' || !Number.isFinite(sample)) {
        throw new Error('metric.samples must contain finite numbers')
      }
    }
  }),
  definition(BUILTIN_EVIDENCE_KINDS.staticAnalysis, payload => {
    const value = record(payload, 'static-analysis')
    stringField(value.tool, 'static-analysis.tool')
    nonNegativeInteger(value.findings, 'static-analysis.findings')
  }),
  definition(BUILTIN_EVIDENCE_KINDS.visualObservation, payload => {
    const value = record(payload, 'visual-observation')
    stringField(value.description, 'visual-observation.description')
  }),
  definition(BUILTIN_EVIDENCE_KINDS.runtimeObservation, payload => {
    const value = record(payload, 'runtime-observation')
    stringField(value.signal, 'runtime-observation.signal')
    if (!Object.hasOwn(value, 'value')) {
      throw new Error('runtime-observation.value is required')
    }
  }),
  definition(BUILTIN_EVIDENCE_KINDS.deploymentObservation, payload => {
    const value = record(payload, 'deployment-observation')
    stringField(value.deploymentId, 'deployment-observation.deploymentId')
    stringField(value.state, 'deployment-observation.state')
  }),
  definition(BUILTIN_EVIDENCE_KINDS.humanAttestation, payload => {
    const value = record(payload, 'human-attestation')
    stringField(value.statement, 'human-attestation.statement')
  }),
]

export function createBuiltInEvidenceRegistry(): EvidenceRegistry {
  const registry = new EvidenceRegistry()
  for (const evidenceKind of BUILTIN_EVIDENCE_DEFINITIONS) {
    registry.register(evidenceKind)
  }
  return registry
}
