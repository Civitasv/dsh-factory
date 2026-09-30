import type {
  ActorRef,
  Artifact,
  ArtifactRef,
  Evidence,
  EvidenceReality,
  EvidenceSubjectRef,
  Finding,
  FindingSeverity,
  Relation,
} from '@orven/internal-domain'

export type HealthComparator = 'lt' | 'lte' | 'gt' | 'gte'

export interface ProductionMetricObservation {
  readonly provider: string
  readonly observationId: string
  readonly signal: string
  readonly value: number
  readonly unit: string
  readonly observedAt: string
  readonly deployment: ArtifactRef
  readonly reality: EvidenceReality
  readonly subjects: readonly EvidenceSubjectRef[]
}

export interface HealthRule {
  readonly id: string
  readonly signal: string
  readonly comparator: HealthComparator
  readonly threshold: number
  readonly severity: FindingSeverity
  readonly description: string
}

export interface ProductionObservationResult {
  readonly artifact: Artifact
  readonly evidence: Evidence
  readonly finding?: Finding
  readonly findingRelation?: Relation
}

export interface ProductionObservationPort {
  readMetric(
    provider: string,
    observationId: string,
  ): Promise<ProductionMetricObservation>
}

export interface ProductionObservationContext {
  readonly actor: ActorRef
}
