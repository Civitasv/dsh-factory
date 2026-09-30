import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { ConnectionFetchRoute } from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {
  ActorRef,
  ChangeGraphSnapshot,
  ChangeId,
  CriterionId,
  CriterionRevision,
  GraphNode,
} from '@orven/core'
import { evaluateCriterionEvidenceCoverage } from '@orven/core/evidence'
import {
  ORVEN_GRAPH_ERROR_SCHEMA,
  ORVEN_GRAPH_PATH,
  ORVEN_GRAPH_SCHEMA,
  type OrvenGraphDto,
  type OrvenGraphErrorDto,
  type OrvenGraphGateState,
} from './graph-wire.js'
import { readOrvenSessionBinding } from './session-binding.js'
import type { OrvenService } from './service.js'
import { captureWorkspaceReality } from './workspace-reality.js'

const WEB_ACTOR: ActorRef = { kind: 'system', id: 'orven-web' }

function graphError(
  code: OrvenGraphErrorDto['code'],
  message: string,
): OrvenGraphErrorDto {
  return { schema: ORVEN_GRAPH_ERROR_SCHEMA, code, message }
}

function jsonResponse(
  request: Request,
  value: OrvenGraphDto | OrvenGraphErrorDto,
  status = 200,
  headers: HeadersInit = {},
): Response {
  const body = request.method === 'HEAD' ? null : JSON.stringify(value)
  return new Response(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

function nodeById<T extends GraphNode['kind']>(
  snapshot: ChangeGraphSnapshot,
  kind: T,
  id: string,
): Extract<GraphNode, { readonly kind: T }> | undefined {
  return snapshot.nodes.find(
    (node): node is Extract<GraphNode, { readonly kind: T }> =>
      node.kind === kind && String(node.value.id) === id,
  )
}

function criteriaForChange(
  snapshot: ChangeGraphSnapshot,
  changeId: ChangeId,
): readonly CriterionRevision[] {
  const criterionIds: CriterionId[] = []
  for (const relation of snapshot.relations) {
    if (
      relation.kind === 'has_criterion'
      && relation.source.kind === 'change'
      && relation.source.id === changeId
      && relation.target.kind === 'criterion'
    ) {
      criterionIds.push(relation.target.id)
    }
  }

  const criterionSet = new Set<CriterionId>(criterionIds)
  const latest = new Map<CriterionId, CriterionRevision>()
  for (const revision of snapshot.criterionRevisions) {
    if (!criterionSet.has(revision.criterionId)) continue
    const current = latest.get(revision.criterionId)
    if (current === undefined || revision.revision > current.revision) {
      latest.set(revision.criterionId, revision)
    }
  }

  return criterionIds
    .map(id => latest.get(id))
    .filter((revision): revision is CriterionRevision => revision !== undefined)
}

async function summarizeChange(
  service: OrvenService,
  workspace: string,
  changeId: ChangeId,
  snapshot: ChangeGraphSnapshot,
): Promise<{
  readonly coverage: { readonly requiredComplete: number; readonly requiredTotal: number }
  readonly gateState: OrvenGraphGateState
}> {
  const observedAt = new Date().toISOString()
  const reality = await captureWorkspaceReality(
    workspace,
    observedAt,
    WEB_ACTOR,
  )
  const evidence = snapshot.nodes
    .filter(
      (node): node is Extract<GraphNode, { readonly kind: 'evidence' }> =>
        node.kind === 'evidence',
    )
    .map(node => node.value)
  const invalidated = new Set(
    snapshot.evidenceInvalidations.map(record => record.evidenceId),
  )

  const criteria = criteriaForChange(snapshot, changeId).map(revision => {
    const coverage = evaluateCriterionEvidenceCoverage({
      revision,
      evidence,
      currentReality: reality.reality,
      invalidatedEvidenceIds: invalidated,
    })
    return {
      severity: revision.severity,
      complete: coverage.complete,
      failed: coverage.requirements.some(requirement =>
        requirement.state === 'contradicted'
        || requirement.state === 'conflicted'),
    }
  })

  const required = criteria.filter(item => item.severity === 'required')
  const requiredComplete = required.filter(item => item.complete).length
  const requiredFailed = required.some(item => item.failed)
  const gateState: OrvenGraphGateState = requiredFailed
    ? 'failed'
    : requiredComplete === required.length
      ? 'satisfied'
      : 'pending'

  return {
    coverage: {
      requiredComplete,
      requiredTotal: required.length,
    },
    gateState,
  }
}

function emptyGraph(
  sessionId: string,
  state: 'no-workspace' | 'no-active-change',
  workspace: string | null,
): OrvenGraphDto {
  return {
    schema: ORVEN_GRAPH_SCHEMA,
    state,
    sessionId,
    workspace,
    activeChangeId: null,
    graphId: null,
    graphRevision: null,
    change: null,
    coverage: null,
    gateState: null,
    snapshot: null,
  }
}

async function graphResponse(
  ctx: Context,
  root: OrvenService,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url)
  const sessionIdText = url.searchParams.get('sessionId')?.trim() ?? ''
  if (sessionIdText === '') {
    return jsonResponse(
      request,
      graphError('invalid-session-id', 'A non-empty sessionId query parameter is required.'),
      400,
    )
  }

  const session = ctx.sessions.get(sessionIdText as SessionId)
  if (session === undefined) {
    return jsonResponse(
      request,
      graphError('session-not-found', 'The requested DSH Session is not active.'),
      404,
    )
  }

  const binding = readOrvenSessionBinding(ctx, session)
  const headerWorkspace = session.header.cwd?.trim()
  const boundWorkspace = binding.workspace?.trim() || undefined

  if (
    headerWorkspace !== undefined
    && headerWorkspace !== ''
    && boundWorkspace !== undefined
    && resolve(headerWorkspace) !== resolve(boundWorkspace)
  ) {
    return jsonResponse(
      request,
      graphError(
        'session-workspace-mismatch',
        'The Session workspace does not match its durable Orven binding.',
      ),
      409,
    )
  }

  const workspace =
    boundWorkspace
    ?? (headerWorkspace === undefined || headerWorkspace === '' ? undefined : headerWorkspace)
  if (workspace === undefined) {
    return jsonResponse(request, emptyGraph(sessionIdText, 'no-workspace', null))
  }

  if (binding.changeId === null) {
    return jsonResponse(
      request,
      emptyGraph(sessionIdText, 'no-active-change', resolve(workspace)),
    )
  }

  try {
    const service = await root.forWorkspace(workspace)
    const snapshot = service.snapshot()
    const activeChangeId = binding.changeId as ChangeId
    const change = nodeById(snapshot, 'change', binding.changeId)
    if (change === undefined) {
      return jsonResponse(
        request,
        graphError(
          'active-change-not-found',
          'The Session is bound to an Orven Change that is missing from its workspace graph.',
        ),
        409,
      )
    }

    const etag = `"${String(snapshot.graphId)}:${String(snapshot.revision)}:${binding.changeId}"`
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'cache-control': 'no-store',
          etag,
        },
      })
    }

    const summary = await summarizeChange(
      service,
      resolve(workspace),
      activeChangeId,
      snapshot,
    )
    const response: OrvenGraphDto = {
      schema: ORVEN_GRAPH_SCHEMA,
      state: 'active',
      sessionId: sessionIdText,
      workspace: resolve(workspace),
      activeChangeId: binding.changeId,
      graphId: String(snapshot.graphId),
      graphRevision: Number(snapshot.revision),
      change: {
        id: String(change.value.id),
        title: change.value.title,
        kind: change.value.kind,
      },
      coverage: summary.coverage,
      gateState: summary.gateState,
      snapshot,
    }

    return jsonResponse(request, response, 200, { etag })
  } catch {
    return jsonResponse(
      request,
      graphError('graph-read-failed', 'Unable to read the Orven Change Graph.'),
      500,
    )
  }
}

export function registerOrvenGraphRoute(
  ctx: Context,
  root: OrvenService,
): void {
  const route: ConnectionFetchRoute = {
    path: ORVEN_GRAPH_PATH,
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: request => graphResponse(ctx, root, request),
  }
  ctx.connection.fetch.register(route)
}

export const graphRouteInternals = {
  graphResponse,
  summarizeChange,
}
