import { describe, expect, it } from 'vitest'
import {
  type ArtifactId,
  type CriterionId,
  type Evidence,
  type EvidenceId,
} from '@orven/internal-domain'
import {
  BUILTIN_EVIDENCE_KINDS,
  createBuiltInEvidenceRegistry,
  EvidenceRegistry,
  validateEvidence,
} from './index.js'

const artifact = (id: string) => ({ id: id as ArtifactId })

function testEvidence(): Evidence {
  return {
    id: 'EV-1' as EvidenceId,
    kind: BUILTIN_EVIDENCE_KINDS.testExecution.kind,
    kindVersion: 1,
    claim: 'Tests pass',
    result: 'supports',
    subjects: [
      {
        kind: 'criterion_revision',
        revision: { criterionId: 'CRT-1' as CriterionId, revision: 1 },
      },
    ],
    reality: {
      targets: [artifact('BUILD-1')],
      environment: [artifact('ENV-1')],
      configuration: [],
    },
    sources: [
      { artifact: artifact('JUNIT-1'), role: 'raw_output' },
    ],
    observedAt: '2026-09-30T00:00:00Z',
    payload: {
      suite: 'unit',
      total: 3,
      passed: 3,
      failed: 0,
      skipped: 0,
      exitCode: 0,
    },
  }
}

describe('EvidenceRegistry', () => {
  it('rejects duplicate kind versions', () => {
    const registry = new EvidenceRegistry()
    const definition = {
      kind: BUILTIN_EVIDENCE_KINDS.visualObservation.kind,
      version: 1,
      validatePayload: () => {},
    }

    registry.register(definition)
    expect(() => registry.register(definition)).toThrow('already registered')
  })

  it('rejects unknown Evidence kinds', () => {
    const registry = new EvidenceRegistry()
    expect(() => registry.validate(testEvidence())).toThrow('Unknown Evidence kind')
  })

  it('validates built-in payloads', () => {
    const registry = createBuiltInEvidenceRegistry()
    expect(() => validateEvidence(testEvidence(), registry)).not.toThrow()

    const invalid: Evidence = {
      ...testEvidence(),
      payload: {
        suite: 'unit',
        total: 2,
        passed: 2,
        failed: 1,
        skipped: 0,
        exitCode: 0,
      },
    }

    expect(() => validateEvidence(invalid, registry)).toThrow(
      'total must equal passed + failed + skipped',
    )
  })

  it('rejects prose-only Evidence with no Artifact source', () => {
    const registry = createBuiltInEvidenceRegistry()
    expect(() =>
      validateEvidence(
        {
          ...testEvidence(),
          sources: [],
        },
        registry,
      ),
    ).toThrow('Artifact-backed source')
  })
})
