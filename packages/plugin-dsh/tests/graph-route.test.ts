import { describe, expect, it } from 'vitest'
import type { ChangeGraphSnapshot } from '@orven/core'
import { graphRouteInternals } from '../src/graph-route.js'
import { ORVEN_GRAPH_PATH, ORVEN_GRAPH_ROUTE } from '../src/graph-wire.js'

const actor = { kind: 'system', id: 'test' } as const

function snapshot(): ChangeGraphSnapshot {
  return {
    graphId: 'graph:test' as never,
    revision: 7 as never,
    nodes: [{
      kind: 'change',
      value: {
        id: 'change:test' as never,
        kind: 'feature',
        title: 'Test Change',
        createdAt: '2026-09-30T00:00:00.000Z',
        createdBy: actor,
      },
    }],
    relations: [],
    retiredRelationIds: [],
    criterionRevisions: [],
    evidenceInvalidations: [],
    changeDispositions: [],
    findingLifecycles: [],
    gateEvaluations: [],
  }
}

function harness(binding: {
  readonly changeId: string | null
  readonly workspace: string | null
}, cwd = process.cwd()) {
  const session = {
    header: { cwd },
  }
  const ctx = {
    sessions: {
      get: (id: string) => id === 'session:test' ? session : undefined,
    },
    sessionProjections: {
      stateOf: () => binding,
    },
  }
  const workspace = {
    snapshot: () => snapshot(),
  }
  const root = {
    forWorkspace: async () => workspace,
  }
  return { ctx, root }
}

describe('Orven graph route', () => {
  it('keeps Host registration absolute and browser navigation document-relative', () => {
    expect(ORVEN_GRAPH_PATH).toBe('/api/orven/graph')
    expect(ORVEN_GRAPH_ROUTE).toBe('api/orven/graph')
  })

  it('resolves Session authority, returns graph v1, and honors ETag', async () => {
    const { ctx, root } = harness({
      changeId: 'change:test',
      workspace: process.cwd(),
    })

    const first = await graphRouteInternals.graphResponse(
      ctx as never,
      root as never,
      new Request('http://localhost/api/orven/graph?sessionId=session%3Atest'),
    )
    expect(first.status).toBe(200)
    const etag = first.headers.get('etag')
    expect(etag).toBe('"graph:test:7:change:test"')
    const body = await first.json()
    expect(body).toMatchObject({
      schema: 'orven.graph.v1',
      state: 'active',
      sessionId: 'session:test',
      activeChangeId: 'change:test',
      graphRevision: 7,
      change: {
        id: 'change:test',
        title: 'Test Change',
        kind: 'feature',
      },
      coverage: {
        requiredComplete: 0,
        requiredTotal: 0,
      },
      gateState: 'satisfied',
    })

    const cached = await graphRouteInternals.graphResponse(
      ctx as never,
      root as never,
      new Request('http://localhost/api/orven/graph?sessionId=session%3Atest', {
        headers: { 'if-none-match': etag ?? '' },
      }),
    )
    expect(cached.status).toBe(304)
    expect(await cached.text()).toBe('')
  })

  it('returns explicit empty state before a Change is bound', async () => {
    const { ctx, root } = harness({
      changeId: null,
      workspace: process.cwd(),
    })
    const response = await graphRouteInternals.graphResponse(
      ctx as never,
      root as never,
      new Request('http://localhost/api/orven/graph?sessionId=session%3Atest'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      schema: 'orven.graph.v1',
      state: 'no-active-change',
      sessionId: 'session:test',
      activeChangeId: null,
      snapshot: null,
    })
  })

  it('rejects browser-supplied unknown Sessions', async () => {
    const { ctx, root } = harness({
      changeId: null,
      workspace: process.cwd(),
    })
    const response = await graphRouteInternals.graphResponse(
      ctx as never,
      root as never,
      new Request('http://localhost/api/orven/graph?sessionId=missing'),
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      schema: 'orven.graph.error.v1',
      code: 'session-not-found',
    })
  })

  it('supports HEAD without returning a response body', async () => {
    const { ctx, root } = harness({
      changeId: null,
      workspace: process.cwd(),
    })
    const response = await graphRouteInternals.graphResponse(
      ctx as never,
      root as never,
      new Request('http://localhost/api/orven/graph?sessionId=session%3Atest', {
        method: 'HEAD',
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
  })
})
