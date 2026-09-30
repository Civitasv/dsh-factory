import type {
  CriterionRevisionRef,
  EvidenceRef,
  Finding,
  FindingId,
  FindingLifecycleRecord,
} from '@dsh-factory/core'
import type {
  CriterionEvidenceCoverage,
  EvidenceRequirementCoverage,
} from '@dsh-factory/evidence'
import { validateGatePolicy } from './validation.js'
import type {
  EvaluateGateInput,
  GateAssessment,
  GateAssessmentReason,
} from './types.js'

function criterionKey(ref: CriterionRevisionRef): string {
  return `${ref.criterionId}@${ref.revision}`
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function evidenceUnion(coverages: readonly EvidenceRequirementCoverage[]): readonly EvidenceRef[] {
  const byId = new Map<string, EvidenceRef>()
  for (const coverage of coverages) {
    for (const ref of [...coverage.satisfying, ...coverage.contradicting]) {
      byId.set(String(ref.id), ref)
    }
  }
  return [...byId.values()].sort((left, right) =>
    compareText(String(left.id), String(right.id)),
  )
}

function blockingFindings(
  input: EvaluateGateInput,
): readonly Finding[] {
  const lifecycle = new Map<FindingId, FindingLifecycleRecord>(
    input.findingLifecycles.map(record => [record.findingId, record]),
  )
  const blockedSeverity = new Set(input.policy.blockFindingSeverities)

  return [...input.findings]
    .filter(finding => {
      if (!blockedSeverity.has(finding.severity)) return false
      const state = lifecycle.get(finding.id)?.state ?? 'open'
      return state === 'open' || state === 'reproduced'
    })
    .sort((left, right) => compareText(String(left.id), String(right.id)))
}

function sortCoverage(
  coverage: readonly CriterionEvidenceCoverage[],
): readonly CriterionEvidenceCoverage[] {
  return [...coverage].sort((left, right) =>
    compareText(criterionKey(left.criterion), criterionKey(right.criterion)),
  )
}

export function evaluateGate(input: EvaluateGateInput): GateAssessment {
  validateGatePolicy(input.policy)

  if (input.gate.kind !== input.policy.gateKind) {
    throw new Error(
      `Gate kind ${input.gate.kind} does not match policy ${input.policy.gateKind}`,
    )
  }

  if (input.notRequired !== undefined) {
    if (input.notRequired.gateId !== input.gate.id) {
      throw new Error('Not-required authorization targets another Gate')
    }
    if (!input.policy.notRequiredAuthorities.includes(input.notRequired.actor.kind)) {
      throw new Error(
        `Actor kind ${input.notRequired.actor.kind} cannot mark Gate ${input.gate.id} not required`,
      )
    }
    if (input.notRequired.reason.trim() === '') {
      throw new Error('Not-required authorization reason must be non-empty')
    }

    return {
      gateId: input.gate.id,
      gateKind: input.gate.kind,
      state: 'not_required',
      evidence: [],
      reasons: ['not_required_authorized'],
      criterionCoverage: sortCoverage(input.criterionCoverage),
      blockingFindings: [],
    }
  }

  const coverageByCriterion = new Map(
    input.criterionCoverage.map(coverage => [criterionKey(coverage.criterion), coverage]),
  )
  const requiredCoverage: CriterionEvidenceCoverage[] = []
  const reasons = new Set<GateAssessmentReason>()
  let hasFailure = false
  let hasMissing = false

  for (const criterion of [...input.policy.criteria].sort((left, right) =>
    compareText(criterionKey(left), criterionKey(right)),
  )) {
    const coverage = coverageByCriterion.get(criterionKey(criterion))
    if (coverage === undefined || coverage.requirements.length === 0) {
      hasMissing = true
      reasons.add('criterion_missing')
      continue
    }

    requiredCoverage.push(coverage)
    for (const requirement of coverage.requirements) {
      switch (requirement.state) {
        case 'satisfied':
          break
        case 'missing':
          hasMissing = true
          reasons.add('criterion_missing')
          break
        case 'contradicted':
          hasFailure = true
          reasons.add('criterion_contradicted')
          break
        case 'conflicted':
          hasFailure = true
          reasons.add('criterion_conflicted')
          break
      }
    }
  }

  const blockers = blockingFindings(input)
  if (blockers.length > 0) {
    reasons.add('finding_blocker')
  }

  const requirementCoverage = requiredCoverage.flatMap(coverage => coverage.requirements)
  const evidence = evidenceUnion(requirementCoverage)

  let state: GateAssessment['state']
  if (hasFailure) {
    state = 'failed'
  } else if (hasMissing || blockers.length > 0) {
    state = 'pending'
  } else {
    state = 'satisfied'
    reasons.add('requirements_satisfied')
  }

  return {
    gateId: input.gate.id,
    gateKind: input.gate.kind,
    state,
    evidence,
    reasons: [...reasons].sort(compareText),
    criterionCoverage: sortCoverage(requiredCoverage),
    blockingFindings: blockers,
  }
}
