import { describe, expect, it } from 'vitest'
import {
  type ArtifactId,
  type CriterionId,
  type CriterionRevision,
  type Evidence,
  type EvidenceId,
  type EvidenceRequirementId,
} from '@dsh-factory/core'
import {
  BUILTIN_EVIDENCE_KINDS,
  evaluateCriterionEvidenceCoverage,
  evaluateEvidenceApplicability,
} from './index.js'

const artifact = (id: string) => ({ id: id as ArtifactId })
const criterionId = 'CRT-1' as CriterionId
const build = artifact('BUILD-1')
const environment = artifact('ENV-1')

const reality = {
  targets: [build],
  environment: [environment],
  configuration: [],
} as const

function evidence(
  id: string,
  result: Evidence['result'],
  target = build,
): Evidence {
  return {
    id: id as EvidenceId,
    kind: BUILTIN_EVIDENCE_KINDS.testExecution.kind,
    kindVersion: 1,
    claim: 'Criterion result',
    result,
    subjects: [
      {
        kind: 'criterion_revision',
        revision: { criterionId, revision: 1 },
      },
    ],
    reality: {
      targets: [target],
      environment: [environment],
      configuration: [],
    },
    sources: [{ artifact: artifact(`SOURCE-${id}`), role: 'raw_output' }],
    observedAt: '2026-09-30T00:00:00Z',
    payload: {
      suite: 'unit',
      total: 1,
      passed: result === 'supports' ? 1 : 0,
      failed: result === 'contradicts' ? 1 : 0,
      skipped: result === 'inconclusive' ? 1 : 0,
      exitCode: result === 'supports' ? 0 : 1,
    },
  }
}

const revision: CriterionRevision = {
  criterionId,
  revision: 1,
  statement: 'Behavior works',
  evidenceRequirements: [
    {
      id: 'ER-1' as EvidenceRequirementId,
      acceptedKinds: [BUILTIN_EVIDENCE_KINDS.testExecution],
      requiredResult: 'supports',
      minimumCount: 1,
      reality: 'current',
    },
  ],
  severity: 'required',
  publishedAt: '2026-09-30T00:00:00Z',
  publishedBy: { kind: 'system', id: 'test' },
}

describe('Evidence applicability', () => {
  it('requires exact Reality sets', () => {
    const item = evidence('EV-1', 'supports')
    expect(evaluateEvidenceApplicability(item, reality, false)).toBe('applicable')
    expect(
      evaluateEvidenceApplicability(
        item,
        { ...reality, targets: [artifact('BUILD-2')] },
        false,
      ),
    ).toBe('not_applicable')
    expect(evaluateEvidenceApplicability(item, undefined, false)).toBe('unknown')
    expect(evaluateEvidenceApplicability(item, reality, true)).toBe('invalid')
  })
})

describe('Evidence coverage', () => {
  it('marks sufficient supporting Evidence as satisfied', () => {
    const coverage = evaluateCriterionEvidenceCoverage({
      revision,
      evidence: [evidence('EV-1', 'supports')],
      currentReality: reality,
    })

    expect(coverage.complete).toBe(true)
    expect(coverage.requirements[0]?.state).toBe('satisfied')
  })

  it('reports simultaneous support and contradiction as conflicted', () => {
    const coverage = evaluateCriterionEvidenceCoverage({
      revision,
      evidence: [
        evidence('EV-1', 'supports'),
        evidence('EV-2', 'contradicts'),
      ],
      currentReality: reality,
    })

    expect(coverage.complete).toBe(false)
    expect(coverage.requirements[0]?.state).toBe('conflicted')
  })

  it('does not count Evidence from another Reality', () => {
    const coverage = evaluateCriterionEvidenceCoverage({
      revision,
      evidence: [evidence('EV-1', 'supports', artifact('BUILD-OLD'))],
      currentReality: reality,
    })

    expect(coverage.requirements[0]?.state).toBe('missing')
  })

  it('does not count invalidated Evidence', () => {
    const item = evidence('EV-1', 'supports')
    const coverage = evaluateCriterionEvidenceCoverage({
      revision,
      evidence: [item],
      currentReality: reality,
      invalidatedEvidenceIds: new Set([item.id]),
    })

    expect(coverage.requirements[0]?.state).toBe('missing')
  })
})
