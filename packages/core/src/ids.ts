export type Brand<T, Name extends string> = T & { readonly __brand: Name }

export type GraphId = Brand<string, 'GraphId'>
export type EventId = Brand<string, 'EventId'>
export type CorrelationId = Brand<string, 'CorrelationId'>
export type ChangeId = Brand<string, 'ChangeId'>
export type CriterionId = Brand<string, 'CriterionId'>
export type ArtifactId = Brand<string, 'ArtifactId'>
export type EvidenceId = Brand<string, 'EvidenceId'>
export type EvidenceKindId = Brand<string, 'EvidenceKindId'>
export type EvidenceRequirementId = Brand<string, 'EvidenceRequirementId'>
export type FindingId = Brand<string, 'FindingId'>
export type DecisionId = Brand<string, 'DecisionId'>
export type GateId = Brand<string, 'GateId'>
export type RunId = Brand<string, 'RunId'>
export type RelationId = Brand<string, 'RelationId'>
export type GraphRevision = Brand<number, 'GraphRevision'>
export type EventOffset = Brand<number, 'EventOffset'>

export function asGraphRevision(value: number): GraphRevision {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Graph revision must be a non-negative safe integer; got ${value}`)
  }

  return value as GraphRevision
}

export function asEventOffset(value: number): EventOffset {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Event offset must be a positive safe integer; got ${value}`)
  }

  return value as EventOffset
}
