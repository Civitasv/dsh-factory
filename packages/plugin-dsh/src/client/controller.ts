import {
  isOrvenGraphDto,
  isOrvenGraphErrorDto,
  ORVEN_GRAPH_ROUTE,
  type OrvenGraphDto,
  type OrvenGraphErrorDto,
} from '../graph-wire.js'
import { scopeSnapshotToChange } from './graph-scope.js'

const POLL_INTERVAL_MS = 1_500

export const ORVEN_PANEL_ID = 'orven'

interface OrvenClientSessionSummary {
  readonly id: string
  readonly retainedBy: Readonly<{ readonly mainView?: number }>
}

export interface OrvenClientContext {
  readonly layout: {
    readonly panelInfo: {
      getSnapshot(): { readonly activePanelId: string | null }
      subscribe(listener: () => void): () => void
    }
  }
  readonly sessions: {
    readonly list: {
      getSnapshot(): {
        readonly byId: Readonly<Record<string, OrvenClientSessionSummary>>
      }
      subscribe(listener: () => void): () => void
    }
  }
  on(event: 'connection/reset', listener: () => void): () => void
}

export type OrvenGraphPanelPhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'stale'
  | 'error'

export interface OrvenGraphPanelState {
  readonly phase: OrvenGraphPanelPhase
  readonly sessionId: string | null
  readonly graph: OrvenGraphDto | null
  readonly error: OrvenGraphErrorDto | null
  readonly refreshing: boolean
}

const INITIAL_STATE: OrvenGraphPanelState = {
  phase: 'idle',
  sessionId: null,
  graph: null,
  error: null,
  refreshing: false,
}

function currentSessionId(ctx: OrvenClientContext): string | undefined {
  const list = ctx.sessions.list.getSnapshot()
  return Object.values(list.byId)
    .find(summary => (summary.retainedBy.mainView ?? 0) > 0)
    ?.id
}

function transportError(message: string): OrvenGraphErrorDto {
  return {
    schema: 'orven.graph.error.v1',
    code: 'graph-read-failed',
    message,
  }
}

export class OrvenGraphController {
  readonly #listeners = new Set<() => void>()
  readonly #disposers: Array<() => void> = []
  #state: OrvenGraphPanelState = INITIAL_STATE
  #sessionId: string | undefined
  #selected = false
  #visible = typeof document === 'undefined' || document.visibilityState === 'visible'
  #pollTimer: ReturnType<typeof setInterval> | undefined
  #request: AbortController | undefined
  #etag: string | undefined
  #disposed = false

  constructor(private readonly ctx: OrvenClientContext) {
    this.#disposers.push(
      ctx.layout.panelInfo.subscribe(() => {
        const next = ctx.layout.panelInfo.getSnapshot().activePanelId === ORVEN_PANEL_ID
        if (next === this.#selected) return
        this.#selected = next
        this.#reconcileActivity(true)
      }),
      ctx.sessions.list.subscribe(() => {
        const next = currentSessionId(ctx)
        if (next === this.#sessionId) return
        this.#sessionId = next
        this.#etag = undefined
        this.#request?.abort()
        this.#request = undefined
        this.#publish({
          phase: next === undefined ? 'idle' : 'loading',
          sessionId: next ?? null,
          graph: null,
          error: null,
          refreshing: false,
        })
        this.#reconcileActivity(true)
      }),
      ctx.on('connection/reset', () => {
        this.#etag = undefined
        this.#request?.abort()
        this.#request = undefined
        this.#reconcileActivity(true)
      }),
    )

    if (typeof document !== 'undefined') {
      const visibility = (): void => {
        const next = document.visibilityState === 'visible'
        if (next === this.#visible) return
        this.#visible = next
        this.#reconcileActivity(next)
      }
      document.addEventListener('visibilitychange', visibility)
      this.#disposers.push(() => {
        document.removeEventListener('visibilitychange', visibility)
      })
    }

    this.#sessionId = currentSessionId(ctx)
    this.#selected =
      ctx.layout.panelInfo.getSnapshot().activePanelId === ORVEN_PANEL_ID
    this.#reconcileActivity(true)
  }

  getSnapshot = (): OrvenGraphPanelState => this.#state

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  refresh = (): void => {
    if (!this.#active()) return
    void this.#refresh(true)
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#stopPolling()
    this.#request?.abort()
    this.#request = undefined
    for (const dispose of this.#disposers.splice(0).reverse()) dispose()
    this.#listeners.clear()
  }

  #publish(next: OrvenGraphPanelState): void {
    if (this.#disposed) return
    this.#state = next
    for (const listener of [...this.#listeners]) listener()
  }

  #active(): boolean {
    return !this.#disposed
      && this.#selected
      && this.#visible
      && this.#sessionId !== undefined
  }

  #reconcileActivity(immediate: boolean): void {
    if (!this.#active()) {
      this.#stopPolling()
      this.#request?.abort()
      this.#request = undefined
      return
    }

    if (this.#pollTimer === undefined) {
      this.#pollTimer = setInterval(() => {
        void this.#refresh(false)
      }, POLL_INTERVAL_MS)
    }
    if (immediate) void this.#refresh(true)
  }

  #stopPolling(): void {
    if (this.#pollTimer === undefined) return
    clearInterval(this.#pollTimer)
    this.#pollTimer = undefined
  }

  async #refresh(replaceInflight: boolean): Promise<void> {
    const sessionId = this.#sessionId
    if (!this.#active() || sessionId === undefined) return
    if (this.#request !== undefined) {
      if (!replaceInflight) return
      this.#request.abort()
    }

    const controller = new AbortController()
    this.#request = controller
    const prior = this.#state
    this.#publish({
      ...prior,
      sessionId,
      phase: prior.graph === null ? 'loading' : prior.phase,
      refreshing: true,
      error: prior.phase === 'error' ? null : prior.error,
    })

    try {
      const headers = new Headers()
      if (this.#etag !== undefined) headers.set('if-none-match', this.#etag)
      const response = await fetch(
        `${ORVEN_GRAPH_ROUTE}?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          headers,
          signal: controller.signal,
        },
      )
      if (controller.signal.aborted || this.#sessionId !== sessionId) return

      if (response.status === 304) {
        this.#publish({
          ...this.#state,
          refreshing: false,
        })
        return
      }

      const payload: unknown = await response.json()
      if (!response.ok) {
        const error = isOrvenGraphErrorDto(payload)
          ? payload
          : transportError(`Orven graph request failed with HTTP ${response.status}.`)
        this.#publishFailure(sessionId, error)
        return
      }
      if (!isOrvenGraphDto(payload)) {
        this.#publishFailure(
          sessionId,
          transportError('The Orven graph response did not match orven.graph.v1.'),
        )
        return
      }

      this.#etag = response.headers.get('etag') ?? undefined
      if (payload.state === 'active'
        && payload.snapshot !== null
        && payload.activeChangeId !== null) {
        const scoped: OrvenGraphDto = {
          ...payload,
          snapshot: scopeSnapshotToChange(
            payload.snapshot,
            payload.activeChangeId,
          ),
        }
        this.#publish({
          phase: 'ready',
          sessionId,
          graph: scoped,
          error: null,
          refreshing: false,
        })
        return
      }

      this.#publish({
        phase: 'empty',
        sessionId,
        graph: payload,
        error: null,
        refreshing: false,
      })
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error
        ? error.message
        : 'The Orven graph request failed.'
      this.#publishFailure(sessionId, transportError(message))
    } finally {
      if (this.#request === controller) this.#request = undefined
    }
  }

  #publishFailure(sessionId: string, error: OrvenGraphErrorDto): void {
    const previous = this.#state
    this.#publish({
      phase: previous.graph?.state === 'active' ? 'stale' : 'error',
      sessionId,
      graph: previous.graph?.state === 'active' ? previous.graph : null,
      error,
      refreshing: false,
    })
  }
}
