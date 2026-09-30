import { describe, expect, it } from 'vitest'
import type {
  ActorRef,
  ArtifactId,
  ChangeId,
} from '@orven/internal-domain'
import {
  createBuiltInEvidenceRegistry,
  validateEvidence,
} from '@orven/internal-evidence'
import {
  ingestProductionMetric,
  type HealthRule,
  type ProductionMetricObservation,
} from './index.js'

const actor: ActorRef = { kind: 'system', id: 'observability' }

const rule: HealthRule = {
  id: 'health/error-rate',
  signal: 'error_rate',
  comparator: 'lte',
  threshold: 0.01,
  severity: 'high',
  description: 'Production error rate stays within the release budget',
}

function observation(value: number): ProductionMetricObservation {
  return {
    provider: 'otel',
    observationId: 'obs-1',
    signal: 'error_rate',
    value,
    unit: 'ratio',
    observedAt: '2026-09-30T01:00:00Z',
    deployment: { id: 'DEPLOY-ART' as ArtifactId },
    reality: {
      targets: [{ id: 'BUILD-1' as ArtifactId }],
      environment: [{ id: 'ENV-PROD' as ArtifactId }],
      configuration: [],
    },
    subjects: [
      {
        kind: 'node',
        node: { kind: 'change', id: 'CHG-1' as ChangeId },
      },
    ],
  }
}

describe('Production observation', () => {
  it('creates supporting Evidence without a Finding for healthy signals', () => {
    const result = ingestProductionMetric(observation(0.005), rule, { actor })

    expect(result.evidence.result).toBe('supports')
    expect(result.finding).toBeUndefined()
    expect(() =>
      validateEvidence(result.evidence, createBuiltInEvidenceRegistry()),
    ).not.toThrow()
  })

  it('creates contradictory Evidence and a graph-ready regression Finding for violations', () => {
    const result = ingestProductionMetric(observation(0.03), rule, { actor })

    expect(result.evidence.result).toBe('contradicts')
    expect(result.finding?.type).toBe('production_regression')
    expect(result.finding?.severity).toBe('high')
    expect(result.findingRelation?.kind).toBe('raises')
    expect(result.findingRelation?.source).toEqual({
      kind: 'evidence',
      id: result.evidence.id,
    })
  })

  it('is idempotent for the same production fact', () => {
    const left = ingestProductionMetric(observation(0.03), rule, { actor })
    const right = ingestProductionMetric(observation(0.03), rule, { actor })

    expect(left.artifact.id).toBe(right.artifact.id)
    expect(left.evidence.id).toBe(right.evidence.id)
    expect(left.finding?.id).toBe(right.finding?.id)
  })

  it('changes identity for another deployment Reality', () => {
    const left = ingestProductionMetric(observation(0.03), rule, { actor })
    const right = ingestProductionMetric(
      {
        ...observation(0.03),
        reality: {
          targets: [{ id: 'BUILD-2' as ArtifactId }],
          environment: [{ id: 'ENV-PROD' as ArtifactId }],
          configuration: [],
        },
      },
      rule,
      { actor },
    )

    expect(left.evidence.id).not.toBe(right.evidence.id)
  })

  it('rejects a signal that does not match the Health Rule', () => {
    expect(() =>
      ingestProductionMetric(
        { ...observation(0.03), signal: 'latency' },
        rule,
        { actor },
      ),
    ).toThrow('does not match')
  })
})
