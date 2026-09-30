import { describe, expect, it } from 'vitest'
import {
  asGraphRevision,
  type ActorRef,
  type ArtifactId,
  type ChangeId,
  type EvidenceId,
  type GateId,
} from '@orven/internal-domain'
import {
  createBuiltInEvidenceRegistry,
  validateEvidence,
} from '@orven/internal-evidence'
import type { GateAssessment } from '@orven/internal-policy'
import {
  deployRelease,
  prepareRelease,
  recordDeployment,
  type DeploymentPort,
} from './index.js'

const actor: ActorRef = { kind: 'system', id: 'release' }
const gateId = 'GATE-RELEASE' as GateId

function assessment(state: GateAssessment['state'] = 'satisfied'): GateAssessment {
  return {
    gateId,
    gateKind: 'release',
    state,
    evidence: state === 'satisfied' ? [{ id: 'EV-GATE' as EvidenceId }] : [],
    reasons: state === 'satisfied' ? ['requirements_satisfied'] : ['criterion_missing'],
    criterionCoverage: [],
    blockingFindings: [],
  }
}

function prepared() {
  return prepareRelease({
    changeId: 'CHG-1' as ChangeId,
    graphRevision: asGraphRevision(20),
    gateAssessment: assessment(),
    gateGraphRevision: asGraphRevision(20),
    targets: [{ id: 'BUILD-1' as ArtifactId }],
    environment: [{ id: 'ENV-PROD' as ArtifactId }],
    configuration: [{ id: 'CONFIG-1' as ArtifactId }],
    createdAt: '2026-09-30T00:00:00Z',
    actor,
  })
}

describe('Release preparation', () => {
  it('requires a satisfied final Release Gate', () => {
    expect(() =>
      prepareRelease({
        changeId: 'CHG-1' as ChangeId,
        graphRevision: asGraphRevision(20),
        gateAssessment: assessment('not_required'),
        gateGraphRevision: asGraphRevision(20),
        targets: [{ id: 'BUILD-1' as ArtifactId }],
        environment: [],
        configuration: [],
        createdAt: '2026-09-30T00:00:00Z',
        actor,
      }),
    ).toThrow('must be satisfied')
  })

  it('rejects stale Gate assessments', () => {
    expect(() =>
      prepareRelease({
        changeId: 'CHG-1' as ChangeId,
        graphRevision: asGraphRevision(20),
        gateAssessment: assessment(),
        gateGraphRevision: asGraphRevision(19),
        targets: [{ id: 'BUILD-1' as ArtifactId }],
        environment: [],
        configuration: [],
        createdAt: '2026-09-30T00:00:00Z',
        actor,
      }),
    ).toThrow('does not match')
  })

  it('canonicalizes Artifact ordering into deterministic Release identity', () => {
    const a = { id: 'A' as ArtifactId }
    const b = { id: 'B' as ArtifactId }
    const left = prepareRelease({
      changeId: 'CHG-1' as ChangeId,
      graphRevision: asGraphRevision(20),
      gateAssessment: assessment(),
      gateGraphRevision: asGraphRevision(20),
      targets: [b, a],
      environment: [],
      configuration: [],
      createdAt: '2026-09-30T00:00:00Z',
      actor,
    })
    const right = prepareRelease({
      changeId: 'CHG-1' as ChangeId,
      graphRevision: asGraphRevision(20),
      gateAssessment: assessment(),
      gateGraphRevision: asGraphRevision(20),
      targets: [a, b],
      environment: [],
      configuration: [],
      createdAt: '2026-09-30T00:00:00Z',
      actor,
    })
    expect(left.plan.id).toBe(right.plan.id)
  })
})

describe('Deployment observation', () => {
  it.each([
    ['succeeded', 'supports'],
    ['failed', 'contradicts'],
    ['cancelled', 'inconclusive'],
  ] as const)('maps %s receipt to %s Evidence', (state, result) => {
    const observation = recordDeployment(
      prepared(),
      {
        provider: 'test',
        deploymentId: 'DEP-1',
        state,
        url: 'https://deploy.example/1',
        observedAt: '2026-09-30T00:05:00Z',
      },
      actor,
    )
    expect(observation.evidence.result).toBe(result)
    expect(() =>
      validateEvidence(
        observation.evidence,
        createBuiltInEvidenceRegistry(),
      ),
    ).not.toThrow()
  })

  it('is idempotent for an identical receipt', () => {
    const release = prepared()
    const receipt = {
      provider: 'test',
      deploymentId: 'DEP-1',
      state: 'succeeded' as const,
      url: 'https://deploy.example/1',
      observedAt: '2026-09-30T00:05:00Z',
    }
    const left = recordDeployment(release, receipt, actor)
    const right = recordDeployment(release, receipt, actor)
    expect(left.artifact.id).toBe(right.artifact.id)
    expect(left.evidence.id).toBe(right.evidence.id)
  })

  it('executes through the provider-neutral Deployment Port', async () => {
    const port: DeploymentPort = {
      deploy: async plan => ({
        provider: 'fake',
        deploymentId: String(plan.id),
        state: 'succeeded',
        url: 'https://deploy.example',
        observedAt: '2026-09-30T00:05:00Z',
      }),
    }
    const observation = await deployRelease({
      prepared: prepared(),
      port,
      actor,
    })
    expect(observation.evidence.result).toBe('supports')
  })
})
