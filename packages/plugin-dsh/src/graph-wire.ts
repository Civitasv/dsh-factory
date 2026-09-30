import type { ChangeGraphSnapshot } from '@orven/core'

export const ORVEN_GRAPH_SCHEMA = 'orven.graph.v1' as const
export const ORVEN_GRAPH_ERROR_SCHEMA = 'orven.graph.error.v1' as const

/** Absolute Host registration key under DSH's shared /api transport. */
export const ORVEN_GRAPH_PATH = '/api/orven/graph' as const

/** Document-relative browser route so DSH keeps working behind a mounted prefix. */
export const ORVEN_GRAPH_ROUTE = ORVEN_GRAPH_PATH.slice(1)

export type OrvenGraphGateState = 'pending' | 'satisfied' | 'failed'

export interface OrvenGraphCoverageDto {
  readonly requiredComplete: number
  readonly requiredTotal: number
}

export interface OrvenGraphChangeDto {
  readonly id: string
  readonly title: string
  readonly kind: string
}

export interface OrvenGraphDto {
  readonly schema: typeof ORVEN_GRAPH_SCHEMA
  readonly state: 'active' | 'no-workspace' | 'no-active-change'
  readonly sessionId: string
  readonly workspace: string | null
  readonly activeChangeId: string | null
  readonly graphId: string | null
  readonly graphRevision: number | null
  readonly change: OrvenGraphChangeDto | null
  readonly coverage: OrvenGraphCoverageDto | null
  readonly gateState: OrvenGraphGateState | null
  readonly snapshot: ChangeGraphSnapshot | null
}

export interface OrvenGraphErrorDto {
  readonly schema: typeof ORVEN_GRAPH_ERROR_SCHEMA
  readonly code:
    | 'invalid-session-id'
    | 'session-not-found'
    | 'session-workspace-mismatch'
    | 'active-change-not-found'
    | 'graph-read-failed'
  readonly message: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isCoverage(value: unknown): value is OrvenGraphCoverageDto {
  if (!isRecord(value)) return false
  return Number.isSafeInteger(value.requiredComplete)
    && Number(value.requiredComplete) >= 0
    && Number.isSafeInteger(value.requiredTotal)
    && Number(value.requiredTotal) >= 0
}

function isSnapshot(value: unknown): value is ChangeGraphSnapshot {
  if (!isRecord(value)) return false
  return typeof value.graphId === 'string'
    && typeof value.revision === 'number'
    && Array.isArray(value.nodes)
    && Array.isArray(value.relations)
    && Array.isArray(value.retiredRelationIds)
    && Array.isArray(value.criterionRevisions)
    && Array.isArray(value.evidenceInvalidations)
    && Array.isArray(value.changeDispositions)
    && Array.isArray(value.findingLifecycles)
    && Array.isArray(value.gateEvaluations)
}

export function isOrvenGraphDto(value: unknown): value is OrvenGraphDto {
  if (!isRecord(value) || value.schema !== ORVEN_GRAPH_SCHEMA) return false
  if (value.state !== 'active'
    && value.state !== 'no-workspace'
    && value.state !== 'no-active-change') return false
  if (typeof value.sessionId !== 'string'
    || !isNullableString(value.workspace)
    || !isNullableString(value.activeChangeId)
    || !isNullableString(value.graphId)
    || (value.graphRevision !== null && typeof value.graphRevision !== 'number')) return false

  if (value.state !== 'active') {
    return value.change === null
      && value.coverage === null
      && value.gateState === null
      && value.snapshot === null
  }

  if (value.workspace === null
    || value.activeChangeId === null
    || value.graphId === null
    || value.graphRevision === null
    || !isRecord(value.change)
    || typeof value.change.id !== 'string'
    || typeof value.change.title !== 'string'
    || typeof value.change.kind !== 'string'
    || !isCoverage(value.coverage)
    || (value.gateState !== 'pending'
      && value.gateState !== 'satisfied'
      && value.gateState !== 'failed')
    || !isSnapshot(value.snapshot)) return false

  return true
}

export function isOrvenGraphErrorDto(value: unknown): value is OrvenGraphErrorDto {
  return isRecord(value)
    && value.schema === ORVEN_GRAPH_ERROR_SCHEMA
    && typeof value.code === 'string'
    && typeof value.message === 'string'
}
