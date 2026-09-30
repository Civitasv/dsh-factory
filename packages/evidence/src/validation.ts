import type {
  ArtifactRef,
  CriterionRevision,
  Evidence,
  EvidenceRequirement,
  JsonValue,
} from '@orven/internal-domain'
import type { EvidenceRegistry } from './registry.js'

function assertUniqueArtifactRefs(label: string, refs: readonly ArtifactRef[]): void {
  const seen = new Set<string>()
  for (const ref of refs) {
    if (seen.has(ref.id)) {
      throw new Error(`${label} contains duplicate Artifact ${ref.id}`)
    }
    seen.add(ref.id)
  }
}

function assertJsonValue(value: unknown, path = 'payload'): asserts value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} contains a non-finite number`)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`))
    return
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assertJsonValue(child, `${path}.${key}`)
    }
    return
  }

  throw new Error(`${path} is not JSON-compatible`)
}

export function assertEvidenceRequirement(requirement: EvidenceRequirement): void {
  if (String(requirement.id).trim() === '') {
    throw new Error('Evidence Requirement id must be non-empty')
  }
  if (requirement.acceptedKinds.length === 0) {
    throw new Error(`Evidence Requirement ${requirement.id} requires at least one accepted kind`)
  }
  if (!Number.isSafeInteger(requirement.minimumCount) || requirement.minimumCount <= 0) {
    throw new Error(`Evidence Requirement ${requirement.id} minimumCount must be a positive safe integer`)
  }

  const seen = new Set<string>()
  for (const kind of requirement.acceptedKinds) {
    if (String(kind.kind).trim() === '') {
      throw new Error(`Evidence Requirement ${requirement.id} has an empty accepted kind`)
    }
    if (!Number.isSafeInteger(kind.version) || kind.version <= 0) {
      throw new Error(`Evidence Requirement ${requirement.id} has an invalid kind version`)
    }
    const key = `${kind.kind}@${kind.version}`
    if (seen.has(key)) {
      throw new Error(`Evidence Requirement ${requirement.id} repeats ${key}`)
    }
    seen.add(key)
  }
}

export function assertCriterionEvidenceRequirements(revision: CriterionRevision): void {
  const ids = new Set<string>()
  for (const requirement of revision.evidenceRequirements) {
    assertEvidenceRequirement(requirement)
    if (ids.has(requirement.id)) {
      throw new Error(`Criterion ${revision.criterionId}@${revision.revision} repeats Evidence Requirement ${requirement.id}`)
    }
    ids.add(requirement.id)
  }
}

export function validateEvidence(evidence: Evidence, registry: EvidenceRegistry): void {
  if (String(evidence.kind).trim() === '') {
    throw new Error('Evidence kind must be non-empty')
  }
  if (!Number.isSafeInteger(evidence.kindVersion) || evidence.kindVersion <= 0) {
    throw new Error('Evidence kindVersion must be a positive safe integer')
  }
  if (evidence.claim.trim() === '') {
    throw new Error('Evidence claim must be non-empty')
  }
  if (evidence.subjects.length === 0) {
    throw new Error('Evidence requires at least one subject')
  }
  if (evidence.reality.targets.length === 0) {
    throw new Error('Evidence Reality requires at least one target Artifact')
  }
  if (evidence.sources.length === 0) {
    throw new Error('Evidence requires at least one Artifact-backed source')
  }

  assertUniqueArtifactRefs('Evidence Reality targets', evidence.reality.targets)
  assertUniqueArtifactRefs('Evidence Reality environment', evidence.reality.environment)
  assertUniqueArtifactRefs('Evidence Reality configuration', evidence.reality.configuration)
  assertJsonValue(evidence.payload)
  registry.validate(evidence)
}
