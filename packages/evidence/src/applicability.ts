import type { ArtifactRef, Evidence, EvidenceReality } from '@dsh-factory/core'

export type EvidenceApplicability =
  | 'applicable'
  | 'not_applicable'
  | 'unknown'
  | 'invalid'

function exactArtifactSet(left: readonly ArtifactRef[], right: readonly ArtifactRef[]): boolean {
  if (left.length !== right.length) return false

  const leftIds = new Set(left.map(ref => ref.id))
  const rightIds = new Set(right.map(ref => ref.id))
  if (leftIds.size !== left.length || rightIds.size !== right.length) return false
  if (leftIds.size !== rightIds.size) return false

  for (const id of leftIds) {
    if (!rightIds.has(id)) return false
  }
  return true
}

export function evidenceRealityEquals(
  left: EvidenceReality,
  right: EvidenceReality,
): boolean {
  return (
    exactArtifactSet(left.targets, right.targets) &&
    exactArtifactSet(left.environment, right.environment) &&
    exactArtifactSet(left.configuration, right.configuration)
  )
}

export function evaluateEvidenceApplicability(
  evidence: Evidence,
  currentReality: EvidenceReality | undefined,
  invalidated: boolean,
): EvidenceApplicability {
  if (invalidated) return 'invalid'
  if (currentReality === undefined) return 'unknown'
  return evidenceRealityEquals(evidence.reality, currentReality)
    ? 'applicable'
    : 'not_applicable'
}
