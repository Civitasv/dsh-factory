import { describe, expect, it } from 'vitest'
import type {
  ActorRef,
  ArtifactId,
  CriterionId,
} from '@orven/internal-domain'
import {
  createBuiltInEvidenceRegistry,
  validateEvidence,
} from '@orven/internal-evidence'
import { ingestStaticAnalysis, ingestTestRun } from './index.js'

const actor: ActorRef = { kind: 'system', id: 'ci' }
const target = { id: 'COMMIT-1' as ArtifactId }
const subject = {
  kind: 'criterion_revision' as const,
  revision: { criterionId: 'CRT-1' as CriterionId, revision: 1 },
}

function testRun(status: 'passed' | 'failed' | 'cancelled' = 'passed') {
  return {
    provider: 'github-actions',
    runId: '100',
    suite: 'unit',
    status,
    total: 3,
    passed: status === 'passed' ? 3 : 0,
    failed: status === 'failed' ? 3 : 0,
    skipped: status === 'cancelled' ? 3 : 0,
    exitCode: status === 'passed' ? 0 : 1,
    url: 'https://github.com/example/run/100',
    startedAt: '2026-09-30T00:00:00Z',
    completedAt: '2026-09-30T00:01:00Z',
    reality: { targets: [target], environment: [], configuration: [] },
    subjects: [subject],
  }
}

describe('CI test ingestion', () => {
  it.each([
    ['passed', 'supports'],
    ['failed', 'contradicts'],
    ['cancelled', 'inconclusive'],
  ] as const)('maps %s to %s Evidence', (status, expected) => {
    const bundle = ingestTestRun(testRun(status), { actor })
    expect(bundle.evidence.result).toBe(expected)
    expect(() =>
      validateEvidence(bundle.evidence, createBuiltInEvidenceRegistry()),
    ).not.toThrow()
  })

  it('is content-addressed and order-stable for Reality sets', () => {
    const environment = [
      { id: 'ENV-B' as ArtifactId },
      { id: 'ENV-A' as ArtifactId },
    ]
    const left = ingestTestRun(
      { ...testRun(), reality: { targets: [target], environment, configuration: [] } },
      { actor },
    )
    const right = ingestTestRun(
      {
        ...testRun(),
        reality: {
          targets: [target],
          environment: [...environment].reverse(),
          configuration: [],
        },
      },
      { actor },
    )

    expect(left.artifact.id).toBe(right.artifact.id)
    expect(left.evidence.id).toBe(right.evidence.id)
  })

  it('rejects unbalanced test counts', () => {
    expect(() =>
      ingestTestRun({ ...testRun(), total: 4 }, { actor }),
    ).toThrow('total must equal')
  })

  it('changes identity when Reality changes', () => {
    const left = ingestTestRun(testRun(), { actor })
    const right = ingestTestRun(
      {
        ...testRun(),
        reality: {
          targets: [{ id: 'COMMIT-2' as ArtifactId }],
          environment: [],
          configuration: [],
        },
      },
      { actor },
    )
    expect(left.evidence.id).not.toBe(right.evidence.id)
  })
})

describe('Static-analysis ingestion', () => {
  it('maps zero findings to support and nonzero findings to contradiction', () => {
    const base = {
      provider: 'github-actions',
      runId: 'lint-1',
      tool: 'oxlint',
      status: 'completed' as const,
      url: 'https://github.com/example/run/lint-1',
      startedAt: '2026-09-30T00:00:00Z',
      completedAt: '2026-09-30T00:01:00Z',
      reality: { targets: [target], environment: [], configuration: [] },
      subjects: [subject],
    }

    expect(ingestStaticAnalysis({ ...base, findings: 0 }, { actor }).evidence.result)
      .toBe('supports')
    expect(ingestStaticAnalysis({ ...base, findings: 2 }, { actor }).evidence.result)
      .toBe('contradicts')
  })
})
