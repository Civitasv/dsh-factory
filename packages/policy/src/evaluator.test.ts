import { describe, expect, it } from 'vitest'
import type {
  ActorRef,
  CriterionId,
  EvidenceId,
  Finding,
  FindingId,
  Gate,
  GateId,
} from '@orven/internal-domain'
import type { CriterionEvidenceCoverage } from '@orven/internal-evidence'
import {
  evaluateGate,
  gateEvaluationInput,
  validatePolicyProfile,
  type GatePolicy,
} from './index.js'

const actor: ActorRef = { kind: 'system', id: 'policy-test' }
const criterion = { criterionId: 'CRT-1' as CriterionId, revision: 1 }
const gate: Gate = {
  id: 'GATE-1' as GateId,
  kind: 'functional',
  createdAt: '2026-09-30T00:00:00Z',
  createdBy: actor,
}
const policy: GatePolicy = {
  id: 'POL-1',
  gateKind: 'functional',
  criteria: [criterion],
  blockFindingSeverities: ['high', 'critical'],
  notRequiredAuthorities: ['human'],
}

function coverage(
  state: 'satisfied' | 'missing' | 'contradicted' | 'conflicted',
): CriterionEvidenceCoverage {
  const supporting = state === 'satisfied' || state === 'conflicted'
    ? [{ id: 'EV-SUPPORT' as EvidenceId }]
    : []
  const contradicting = state === 'contradicted' || state === 'conflicted'
    ? [{ id: 'EV-CONTRADICT' as EvidenceId }]
    : []

  return {
    criterion,
    complete: state === 'satisfied',
    requirements: [
      {
        requirementId: 'ER-1' as never,
        state,
        satisfying: supporting,
        contradicting,
        inconclusive: [],
      },
    ],
  }
}

describe('Gate policy evaluation', () => {
  it('satisfies a Gate only with complete required coverage', () => {
    const result = evaluateGate({
      gate,
      policy,
      criterionCoverage: [coverage('satisfied')],
      findings: [],
      findingLifecycles: [],
    })

    expect(result.state).toBe('satisfied')
    expect(result.evidence).toEqual([{ id: 'EV-SUPPORT' }])
    expect(result.reasons).toContain('requirements_satisfied')
  })

  it('keeps missing coverage pending', () => {
    expect(
      evaluateGate({
        gate,
        policy,
        criterionCoverage: [coverage('missing')],
        findings: [],
        findingLifecycles: [],
      }).state,
    ).toBe('pending')
  })

  it.each(['contradicted', 'conflicted'] as const)(
    'fails a Gate for %s Evidence coverage',
    state => {
      const result = evaluateGate({
        gate,
        policy,
        criterionCoverage: [coverage(state)],
        findings: [],
        findingLifecycles: [],
      })

      expect(result.state).toBe('failed')
      expect(result.evidence.some(ref => ref.id === 'EV-CONTRADICT')).toBe(true)
    },
  )

  it('keeps an otherwise satisfied Gate pending for blocking Findings', () => {
    const finding: Finding = {
      id: 'FIND-1' as FindingId,
      type: 'bug',
      expected: 'works',
      actual: 'broken',
      severity: 'high',
      confidence: 1,
      openedAt: '2026-09-30T00:00:00Z',
      openedBy: actor,
    }

    const result = evaluateGate({
      gate,
      policy,
      criterionCoverage: [coverage('satisfied')],
      findings: [finding],
      findingLifecycles: [
        {
          findingId: finding.id,
          state: 'open',
          evidence: [],
          updatedAt: '2026-09-30T00:00:00Z',
        },
      ],
    })

    expect(result.state).toBe('pending')
    expect(result.reasons).toContain('finding_blocker')
  })

  it('requires authorized actors for not_required', () => {
    expect(() =>
      evaluateGate({
        gate,
        policy,
        criterionCoverage: [],
        findings: [],
        findingLifecycles: [],
        notRequired: {
          gateId: gate.id,
          actor,
          reason: 'Not applicable',
        },
      }),
    ).toThrow('cannot mark Gate')

    const result = evaluateGate({
      gate,
      policy,
      criterionCoverage: [],
      findings: [],
      findingLifecycles: [],
      notRequired: {
        gateId: gate.id,
        actor: { kind: 'human', id: 'owner' },
        reason: 'No performance surface changed',
      },
    })

    expect(result.state).toBe('not_required')
  })

  it('converts a terminal assessment to the existing Gate event input', () => {
    const assessment = evaluateGate({
      gate,
      policy,
      criterionCoverage: [coverage('satisfied')],
      findings: [],
      findingLifecycles: [],
    })

    expect(
      gateEvaluationInput({
        assessment,
        evaluatedAt: '2026-09-30T01:00:00Z',
        evaluatedBy: actor,
      }),
    ).toMatchObject({
      gateId: gate.id,
      state: 'satisfied',
      evidence: [{ id: 'EV-SUPPORT' }],
    })
  })
})

describe('Policy profile validation', () => {
  it('rejects duplicate gate kinds', () => {
    expect(() =>
      validatePolicyProfile({
        id: 'PROFILE-1',
        gates: [policy, { ...policy, id: 'POL-2' }],
      }),
    ).toThrow('repeats gate kind')
  })

  it('rejects duplicate Criterion references', () => {
    expect(() =>
      validatePolicyProfile({
        id: 'PROFILE-1',
        gates: [{ ...policy, criteria: [criterion, criterion] }],
      }),
    ).toThrow('repeats Criterion')
  })
})
