import type {
  ActorRef,
  Artifact,
  ArtifactRef,
  Brand,
  ChangeId,
  Evidence,
  EvidenceRef,
  GateId,
  GraphRevision,
  JsonValue,
} from '@orven/internal-domain'
import type { GateAssessment } from '@orven/internal-policy'

export type ReleaseId = Brand<string, 'ReleaseId'>

export interface ReleasePlan {
  readonly id: ReleaseId
  readonly changeId: ChangeId
  readonly graphRevision: GraphRevision
  readonly releaseGateId: GateId
  readonly gateEvidence: readonly EvidenceRef[]
  readonly targets: readonly ArtifactRef[]
  readonly environment: readonly ArtifactRef[]
  readonly configuration: readonly ArtifactRef[]
  readonly createdAt: string
  readonly createdBy: ActorRef
}

export interface PreparedRelease {
  readonly plan: ReleasePlan
  readonly artifact: Artifact
}

export interface PrepareReleaseInput {
  readonly changeId: ChangeId
  readonly graphRevision: GraphRevision
  readonly gateAssessment: GateAssessment
  readonly gateGraphRevision: GraphRevision
  readonly targets: readonly ArtifactRef[]
  readonly environment: readonly ArtifactRef[]
  readonly configuration: readonly ArtifactRef[]
  readonly createdAt: string
  readonly actor: ActorRef
}

export type DeploymentState = 'succeeded' | 'failed' | 'cancelled'

export interface DeploymentReceipt {
  readonly provider: string
  readonly deploymentId: string
  readonly state: DeploymentState
  readonly url: string
  readonly observedAt: string
  readonly metadata?: JsonValue
}

export interface DeploymentPort {
  deploy(
    plan: ReleasePlan,
    signal?: AbortSignal,
  ): Promise<DeploymentReceipt>
}

export interface DeploymentObservation {
  readonly artifact: Artifact
  readonly evidence: Evidence
}

export interface DeployReleaseInput {
  readonly prepared: PreparedRelease
  readonly port: DeploymentPort
  readonly actor: ActorRef
  readonly signal?: AbortSignal
}
