import type {
  ActorRef,
  Artifact,
  ArtifactRef,
  Evidence,
  EvidenceReality,
  EvidenceSubjectRef,
} from '@dsh-factory/core'

export type CiTestStatus = 'passed' | 'failed' | 'cancelled'
export type CiAnalysisStatus = 'completed' | 'cancelled'

export interface CiTestRunSnapshot {
  readonly provider: string
  readonly runId: string
  readonly suite: string
  readonly status: CiTestStatus
  readonly total: number
  readonly passed: number
  readonly failed: number
  readonly skipped: number
  readonly exitCode: number
  readonly url: string
  readonly startedAt: string
  readonly completedAt: string
  readonly reality: EvidenceReality
  readonly subjects: readonly EvidenceSubjectRef[]
  readonly rawOutputs?: readonly ArtifactRef[]
}

export interface CiStaticAnalysisSnapshot {
  readonly provider: string
  readonly runId: string
  readonly tool: string
  readonly status: CiAnalysisStatus
  readonly findings: number
  readonly url: string
  readonly startedAt: string
  readonly completedAt: string
  readonly reality: EvidenceReality
  readonly subjects: readonly EvidenceSubjectRef[]
  readonly rawOutputs?: readonly ArtifactRef[]
}

export interface CiEvidenceBundle {
  readonly artifact: Artifact
  readonly evidence: Evidence
}

export interface CiReadPort {
  readTestRun(provider: string, runId: string): Promise<CiTestRunSnapshot>
  readStaticAnalysis(
    provider: string,
    runId: string,
  ): Promise<CiStaticAnalysisSnapshot>
}

export interface CiIngestionContext {
  readonly actor: ActorRef
}
