import { createHash } from 'node:crypto'
import type {
  Artifact,
  ArtifactId,
  ArtifactRef,
  Evidence,
  EvidenceId,
  EvidenceRef,
  JsonValue,
} from '@dsh-factory/core'
import { BUILTIN_EVIDENCE_KINDS } from '@dsh-factory/evidence'
import type {
  DeployReleaseInput,
  DeploymentObservation,
  DeploymentReceipt,
  PrepareReleaseInput,
  PreparedRelease,
  ReleaseId,
  ReleasePlan,
} from './types.js'

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function refs(values: readonly ArtifactRef[]): readonly ArtifactRef[] {
  const map = new Map(values.map(ref => [String(ref.id), ref]))
  return [...map.values()].sort((a, b) => compareText(String(a.id), String(b.id)))
}

function evidenceRefs(values: readonly EvidenceRef[]): readonly EvidenceRef[] {
  const map = new Map(values.map(ref => [String(ref.id), ref]))
  return [...map.values()].sort((a, b) => compareText(String(a.id), String(b.id)))
}

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Release data contains a non-finite number')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {}
    for (const key of Object.keys(value).sort(compareText)) {
      const child = (value as Record<string, unknown>)[key]
      if (child !== undefined) result[key] = canonicalize(child)
    }
    return result
  }
  throw new Error('Release data contains a non-JSON value')
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')
}

export function prepareRelease(input: PrepareReleaseInput): PreparedRelease {
  if (input.gateAssessment.state !== 'satisfied') {
    throw new Error(
      `Release Gate ${input.gateAssessment.gateId} must be satisfied; got ${input.gateAssessment.state}`,
    )
  }
  if (input.gateGraphRevision !== input.graphRevision) {
    throw new Error(
      `Release Gate Graph Revision ${input.gateGraphRevision} does not match release revision ${input.graphRevision}`,
    )
  }

  const targets = refs(input.targets)
  if (targets.length === 0) throw new Error('Release requires at least one target Artifact')

  const environment = refs(input.environment)
  const configuration = refs(input.configuration)
  const gateEvidence = evidenceRefs(input.gateAssessment.evidence)

  const logical = {
    changeId: input.changeId,
    graphRevision: input.graphRevision,
    releaseGateId: input.gateAssessment.gateId,
    gateEvidence,
    targets,
    environment,
    configuration,
    createdAt: input.createdAt,
    createdBy: input.actor,
  }
  const hash = digest(logical)
  const plan: ReleasePlan = {
    id: `release:${hash}` as ReleaseId,
    ...logical,
  }
  const artifact: Artifact = {
    id: `artifact:release:${hash}` as ArtifactId,
    type: 'release/candidate',
    digest: `sha256:${hash}`,
    metadata: canonicalize(plan),
    createdAt: input.createdAt,
    createdBy: input.actor,
  }

  return { plan, artifact }
}

function normalizeReceipt(receipt: DeploymentReceipt): DeploymentReceipt {
  const provider = receipt.provider.trim()
  const deploymentId = receipt.deploymentId.trim()
  if (provider === '') throw new Error('Deployment provider must be non-empty')
  if (deploymentId === '') throw new Error('Deployment id must be non-empty')
  if (!['succeeded', 'failed', 'cancelled'].includes(receipt.state)) {
    throw new Error(`Invalid Deployment state ${receipt.state}`)
  }
  return {
    provider,
    deploymentId,
    state: receipt.state,
    url: receipt.url,
    observedAt: receipt.observedAt,
    ...(receipt.metadata === undefined ? {} : { metadata: receipt.metadata }),
  }
}

export function recordDeployment(
  prepared: PreparedRelease,
  receiptInput: DeploymentReceipt,
  actor: PrepareReleaseInput['actor'],
): DeploymentObservation {
  const receipt = normalizeReceipt(receiptInput)
  const metadata = canonicalize({
    releaseId: prepared.plan.id,
    receipt,
  })
  const artifactHash = digest({ type: 'deployment/record', metadata })
  const artifact: Artifact = {
    id: `artifact:deployment:${artifactHash}` as ArtifactId,
    type: 'deployment/record',
    uri: receipt.url,
    digest: `sha256:${artifactHash}`,
    metadata,
    createdAt: receipt.observedAt,
    createdBy: actor,
  }

  const result =
    receipt.state === 'succeeded'
      ? 'supports'
      : receipt.state === 'failed'
        ? 'contradicts'
        : 'inconclusive'

  const evidenceLogical = {
    releaseId: prepared.plan.id,
    deploymentArtifactId: artifact.id,
    state: receipt.state,
    provider: receipt.provider,
    deploymentId: receipt.deploymentId,
  }
  const evidence: Evidence = {
    id: `evidence:deployment:${digest(evidenceLogical)}` as EvidenceId,
    kind: BUILTIN_EVIDENCE_KINDS.deploymentObservation.kind,
    kindVersion: BUILTIN_EVIDENCE_KINDS.deploymentObservation.version,
    claim: `Deployment ${receipt.deploymentId} reported ${receipt.state}`,
    result,
    subjects: [
      {
        kind: 'node',
        node: { kind: 'change', id: prepared.plan.changeId },
      },
      {
        kind: 'node',
        node: { kind: 'gate', id: prepared.plan.releaseGateId },
      },
    ],
    reality: {
      targets: prepared.plan.targets,
      environment: prepared.plan.environment,
      configuration: prepared.plan.configuration,
    },
    sources: [
      {
        artifact: { id: artifact.id },
        role: 'observation',
      },
    ],
    observedAt: receipt.observedAt,
    payload: {
      deploymentId: receipt.deploymentId,
      state: receipt.state,
    },
  }

  return { artifact, evidence }
}

export async function deployRelease(
  input: DeployReleaseInput,
): Promise<DeploymentObservation> {
  const receipt = await input.port.deploy(
    input.prepared.plan,
    ...(input.signal === undefined ? [] : [input.signal]),
  )
  return recordDeployment(input.prepared, receipt, input.actor)
}
