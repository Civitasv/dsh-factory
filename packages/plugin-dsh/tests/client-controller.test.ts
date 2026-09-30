import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrvenGraphDto } from '../src/graph-wire.js'
import {
  ORVEN_PANEL_ID,
  OrvenGraphController,
  type OrvenClientContext,
} from '../src/client/controller.js'

interface Observable<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
  set(value: T): void
}

function observable<T>(initial: T): Observable<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: next => {
      value = next
      for (const listener of [...listeners]) listener()
    },
  }
}

function activeGraph(sessionId = 'session:one'): OrvenGraphDto {
  return {
    schema: 'orven.graph.v1',
    state: 'active',
    sessionId,
    workspace: '/workspace',
    activeChangeId: 'change:one',
    graphId: 'graph:one',
    graphRevision: 3,
    change: {
      id: 'change:one',
      title: 'Visible Change',
      kind: 'feature',
    },
    coverage: {
      requiredComplete: 1,
      requiredTotal: 2,
    },
    gateState: 'pending',
    snapshot: {
      graphId: 'graph:one' as never,
      revision: 3 as never,
      nodes: [{
        kind: 'change',
        value: {
          id: 'change:one' as never,
          kind: 'feature',
          title: 'Visible Change',
          createdAt: '2026-09-30T00:00:00.000Z',
          createdBy: { kind: 'system', id: 'test' },
        },
      }],
      relations: [],
      retiredRelationIds: [],
      criterionRevisions: [],
      evidenceInvalidations: [],
      changeDispositions: [],
      findingLifecycles: [],
      gateEvaluations: [],
    },
  }
}

function response(
  body: OrvenGraphDto,
  etag = '"graph:one:3:change:one"',
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      etag,
    },
  })
}

function context(options: {
  readonly selected?: boolean
  readonly sessionId?: string
} = {}) {
  const panel = observable({
    activePanelId: options.selected === false ? 'chat' : ORVEN_PANEL_ID,
  })
  const sessionId = options.sessionId ?? 'session:one'
  const sessions = observable({
    byId: {
      [sessionId]: {
        id: sessionId,
        retainedBy: { mainView: 1 },
      },
    },
  })
  const resetListeners = new Set<() => void>()

  const ctx: OrvenClientContext = {
    layout: { panelInfo: panel },
    sessions: { list: sessions },
    on: (_event, listener) => {
      resetListeners.add(listener)
      return () => { resetListeners.delete(listener) }
    },
  }

  return {
    ctx,
    panel,
    sessions,
    reset: () => {
      for (const listener of [...resetListeners]) listener()
    },
  }
}

async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('OrvenGraphController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('polls only while the Orven panel is selected', async () => {
    const fetchMock = vi.fn(async () => response(activeGraph()))
    vi.stubGlobal('fetch', fetchMock)
    const fixture = context({ selected: false })
    const controller = new OrvenGraphController(fixture.ctx)

    await vi.advanceTimersByTimeAsync(4_500)
    expect(fetchMock).not.toHaveBeenCalled()

    fixture.panel.set({ activePanelId: ORVEN_PANEL_ID })
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_499)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fixture.panel.set({ activePanelId: 'chat' })
    await vi.advanceTimersByTimeAsync(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    controller.dispose()
  })

  it('keeps the same graph object on a 304 refresh', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(activeGraph()))
      .mockResolvedValueOnce(new Response(null, {
        status: 304,
        headers: { etag: '"graph:one:3:change:one"' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    const fixture = context()
    const controller = new OrvenGraphController(fixture.ctx)

    await settle()
    const first = controller.getSnapshot()
    expect(first.phase).toBe('ready')
    expect(first.graph).not.toBeNull()

    controller.refresh()
    await settle()
    const second = controller.getSnapshot()
    expect(second.phase).toBe('ready')
    expect(second.graph).toBe(first.graph)

    const secondOptions = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined
    expect(new Headers(secondOptions?.headers).get('if-none-match'))
      .toBe('"graph:one:3:change:one"')

    controller.dispose()
  })

  it('retains the last good graph and marks it stale after refresh failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(activeGraph()))
      .mockRejectedValueOnce(new Error('network unavailable'))
    vi.stubGlobal('fetch', fetchMock)
    const fixture = context()
    const controller = new OrvenGraphController(fixture.ctx)

    await settle()
    const good = controller.getSnapshot().graph
    expect(good).not.toBeNull()

    controller.refresh()
    await settle()
    const stale = controller.getSnapshot()
    expect(stale.phase).toBe('stale')
    expect(stale.graph).toBe(good)
    expect(stale.error?.message).toBe('network unavailable')

    controller.dispose()
  })

  it('switches Session authority and immediately refetches the new Session', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const sessionId = new URL(url, 'http://localhost').searchParams.get('sessionId')
      return response(activeGraph(sessionId ?? 'missing'))
    })
    vi.stubGlobal('fetch', fetchMock)
    const fixture = context({ sessionId: 'session:one' })
    const controller = new OrvenGraphController(fixture.ctx)

    await settle()
    expect(fetchMock.mock.calls[0]?.[0])
      .toContain('session%3Aone')

    fixture.sessions.set({
      byId: {
        'session:two': {
          id: 'session:two',
          retainedBy: { mainView: 1 },
        },
      },
    })
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0])
      .toContain('session%3Atwo')
    expect(controller.getSnapshot().sessionId).toBe('session:two')

    controller.dispose()
  })
})
