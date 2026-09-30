import type { ActorKind, CriterionRevisionRef, FindingSeverity } from '@dsh-factory/core'
import type { GatePolicy, PolicyProfile } from './types.js'

const ACTOR_KINDS = new Set<ActorKind>(['human', 'agent', 'system'])
const FINDING_SEVERITIES = new Set<FindingSeverity>(['low', 'medium', 'high', 'critical'])

function criterionKey(ref: CriterionRevisionRef): string {
  return `${ref.criterionId}@${ref.revision}`
}

export function validateGatePolicy(policy: GatePolicy): void {
  if (policy.id.trim() === '') throw new Error('Gate Policy id must be non-empty')
  if (policy.gateKind.trim() === '') throw new Error('Gate Policy gateKind must be non-empty')
  if (policy.criteria.length === 0) {
    throw new Error(`Gate Policy ${policy.id} requires at least one Criterion Revision`)
  }

  const criteria = new Set<string>()
  for (const ref of policy.criteria) {
    if (!Number.isSafeInteger(ref.revision) || ref.revision <= 0) {
      throw new Error(`Gate Policy ${policy.id} has an invalid Criterion revision`)
    }
    const key = criterionKey(ref)
    if (criteria.has(key)) {
      throw new Error(`Gate Policy ${policy.id} repeats Criterion ${key}`)
    }
    criteria.add(key)
  }

  const severities = new Set<FindingSeverity>()
  for (const severity of policy.blockFindingSeverities) {
    if (!FINDING_SEVERITIES.has(severity)) {
      throw new Error(`Gate Policy ${policy.id} has invalid Finding severity ${severity}`)
    }
    if (severities.has(severity)) {
      throw new Error(`Gate Policy ${policy.id} repeats Finding severity ${severity}`)
    }
    severities.add(severity)
  }

  const authorities = new Set<ActorKind>()
  for (const authority of policy.notRequiredAuthorities) {
    if (!ACTOR_KINDS.has(authority)) {
      throw new Error(`Gate Policy ${policy.id} has invalid authority ${authority}`)
    }
    if (authorities.has(authority)) {
      throw new Error(`Gate Policy ${policy.id} repeats authority ${authority}`)
    }
    authorities.add(authority)
  }
}

export function validatePolicyProfile(profile: PolicyProfile): void {
  if (profile.id.trim() === '') throw new Error('Policy Profile id must be non-empty')

  const kinds = new Set<string>()
  for (const policy of profile.gates) {
    validateGatePolicy(policy)
    if (kinds.has(policy.gateKind)) {
      throw new Error(`Policy Profile ${profile.id} repeats gate kind ${policy.gateKind}`)
    }
    kinds.add(policy.gateKind)
  }
}
