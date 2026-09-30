import type {
  CriterionRevision,
  CriterionRevisionRef,
  Evidence,
  EvidenceId,
  EvidenceReality,
  EvidenceRef,
  EvidenceRequirement,
} from '@dsh-factory/core'
import { evaluateEvidenceApplicability } from './applicability.js'
import { assertCriterionEvidenceRequirements, assertEvidenceRequirement } from './validation.js'

export type EvidenceCoverageState =
  | 'satisfied'
  | 'missing'
  | 'contradicted'
  | 'conflicted'

export interface EvidenceRequirementCoverage {
  readonly requirementId: EvidenceRequirement['id']
  readonly state: EvidenceCoverageState
  readonly satisfying: readonly EvidenceRef[]
  readonly contradicting: readonly EvidenceRef[]
  readonly inconclusive: readonly EvidenceRef[]
}

export interface CriterionEvidenceCoverage {
  readonly criterion: CriterionRevisionRef
  readonly requirements: readonly EvidenceRequirementCoverage[]
  readonly complete: boolean
}

function exactCriterionSubject(
  evidence: Evidence,
  criterion: CriterionRevisionRef,
): boolean {
  return evidence.subjects.some(
    subject =>
      subject.kind === 'criterion_revision' &&
      subject.revision.criterionId === criterion.criterionId &&
      subject.revision.revision === criterion.revision,
  )
}

function acceptedKind(evidence: Evidence, requirement: EvidenceRequirement): boolean {
  return requirement.acceptedKinds.some(
    kind => kind.kind === evidence.kind && kind.version === evidence.kindVersion,
  )
}

const ref = (evidence: Evidence): EvidenceRef => ({ id: evidence.id })

export interface EvidenceCoverageInput {
  readonly criterion: CriterionRevisionRef
  readonly requirement: EvidenceRequirement
  readonly evidence: readonly Evidence[]
  readonly currentReality?: EvidenceReality
  readonly invalidatedEvidenceIds?: ReadonlySet<EvidenceId>
}

export function evaluateEvidenceRequirementCoverage(
  input: EvidenceCoverageInput,
): EvidenceRequirementCoverage {
  assertEvidenceRequirement(input.requirement)

  const satisfying: EvidenceRef[] = []
  const contradicting: EvidenceRef[] = []
  const inconclusive: EvidenceRef[] = []
  const invalidated = input.invalidatedEvidenceIds ?? new Set<EvidenceId>()

  for (const evidence of input.evidence) {
    if (!exactCriterionSubject(evidence, input.criterion)) continue
    if (!acceptedKind(evidence, input.requirement)) continue

    const applicability = evaluateEvidenceApplicability(
      evidence,
      input.currentReality,
      invalidated.has(evidence.id),
    )
    if (applicability !== 'applicable') continue

    switch (evidence.result) {
      case 'supports':
        satisfying.push(ref(evidence))
        break
      case 'contradicts':
        contradicting.push(ref(evidence))
        break
      case 'inconclusive':
        inconclusive.push(ref(evidence))
        break
    }
  }

  const enough = satisfying.length >= input.requirement.minimumCount
  const state: EvidenceCoverageState =
    enough && contradicting.length === 0
      ? 'satisfied'
      : enough
        ? 'conflicted'
        : contradicting.length > 0
          ? 'contradicted'
          : 'missing'

  return {
    requirementId: input.requirement.id,
    state,
    satisfying,
    contradicting,
    inconclusive,
  }
}

export interface CriterionCoverageInput {
  readonly revision: CriterionRevision
  readonly evidence: readonly Evidence[]
  readonly currentReality?: EvidenceReality
  readonly invalidatedEvidenceIds?: ReadonlySet<EvidenceId>
}

export function evaluateCriterionEvidenceCoverage(
  input: CriterionCoverageInput,
): CriterionEvidenceCoverage {
  assertCriterionEvidenceRequirements(input.revision)

  const criterion: CriterionRevisionRef = {
    criterionId: input.revision.criterionId,
    revision: input.revision.revision,
  }

  const requirements = input.revision.evidenceRequirements.map(requirement =>
    evaluateEvidenceRequirementCoverage({
      criterion,
      requirement,
      evidence: input.evidence,
      ...(input.currentReality === undefined ? {} : { currentReality: input.currentReality }),
      ...(input.invalidatedEvidenceIds === undefined
        ? {}
        : { invalidatedEvidenceIds: input.invalidatedEvidenceIds }),
    }),
  )

  return {
    criterion,
    requirements,
    complete: requirements.every(requirement => requirement.state === 'satisfied'),
  }
}
