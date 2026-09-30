import {
  createElement,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  mountGraphExplorer,
  type GraphExplorerController,
} from '@orven/core/graph-ui'
import type { OrvenGraphController } from './controller.js'

export interface OrvenGraphPanelProps {
  readonly controller: OrvenGraphController
}

function emptyMessage(
  state: ReturnType<OrvenGraphController['getSnapshot']>,
): { readonly title: string; readonly detail: string } {
  if (state.sessionId === null) {
    return {
      title: 'Select a Session',
      detail: 'Orven shows the Change Graph bound to the current DSH Session.',
    }
  }
  if (state.graph?.state === 'no-workspace') {
    return {
      title: 'No workspace',
      detail: 'The selected Session does not have an absolute workspace.',
    }
  }
  return {
    title: 'No active Change',
    detail: 'Ask the agent to begin an Orven Change, then return here to inspect its graph.',
  }
}

function Summary({
  graph,
}: {
  readonly graph: NonNullable<ReturnType<OrvenGraphController['getSnapshot']>['graph']>
}): ReactNode {
  if (graph.state !== 'active'
    || graph.change === null
    || graph.coverage === null
    || graph.gateState === null
    || graph.graphRevision === null) return null

  return createElement(
    'div',
    { className: 'orven-summary' },
    createElement(
      'div',
      { className: 'orven-summary-title' },
      createElement('strong', null, graph.change.title),
      createElement('span', { className: 'orven-chip' }, graph.change.kind),
    ),
    createElement(
      'div',
      { className: 'orven-summary-facts' },
      createElement('span', null, `Revision ${graph.graphRevision}`),
      createElement(
        'span',
        null,
        `Required ${graph.coverage.requiredComplete}/${graph.coverage.requiredTotal}`,
      ),
      createElement(
        'span',
        { className: `orven-gate orven-gate-${graph.gateState}` },
        `Gate ${graph.gateState}`,
      ),
    ),
  )
}

export function OrvenGraphPanel({
  controller,
}: OrvenGraphPanelProps): ReactNode {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  const hostRef = useRef<HTMLDivElement | null>(null)
  const explorerRef = useRef<GraphExplorerController>()

  const graph = state.graph?.state === 'active' ? state.graph : null
  const snapshot = graph?.snapshot ?? null
  const activeChangeId = graph?.activeChangeId ?? undefined

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return

    if (snapshot === null) {
      explorerRef.current?.destroy()
      explorerRef.current = undefined
      return
    }

    if (explorerRef.current === undefined) {
      explorerRef.current = mountGraphExplorer(host, snapshot, {
        ...(activeChangeId === undefined
          ? {}
          : { rootChangeId: activeChangeId as never }),
        ariaLabel: 'Orven Change Graph',
      })
      requestAnimationFrame(() => { explorerRef.current?.fit() })
      return
    }

    explorerRef.current.updateSnapshot(snapshot)
  }, [snapshot, activeChangeId])

  useEffect(() => () => {
    explorerRef.current?.destroy()
    explorerRef.current = undefined
  }, [])

  const empty = emptyMessage(state)
  const graphVisible = snapshot !== null

  return createElement(
    'section',
    {
      className: 'orven-panel',
      'aria-label': 'Orven Change Graph',
    },
    createElement(
      'header',
      { className: 'orven-panel-header' },
      createElement(
        'div',
        { className: 'orven-heading' },
        createElement('h2', null, 'Orven'),
        createElement(
          'span',
          { className: 'orven-subtitle' },
          'Change Graph',
        ),
      ),
      createElement(
        'button',
        {
          type: 'button',
          className: 'orven-button',
          disabled: state.sessionId === null || state.refreshing,
          onClick: () => { controller.refresh() },
        },
        state.refreshing ? 'Refreshing…' : 'Refresh',
      ),
    ),
    graph === null ? null : createElement(Summary, { graph }),
    state.phase === 'stale' && state.error !== null
      ? createElement(
          'div',
          { className: 'orven-banner', role: 'status' },
          `Showing the last good graph. ${state.error.message}`,
        )
      : null,
    state.phase === 'error' && state.error !== null
      ? createElement(
          'div',
          { className: 'orven-empty', role: 'alert' },
          createElement('strong', null, 'Graph unavailable'),
          createElement('p', null, state.error.message),
          createElement(
            'button',
            {
              type: 'button',
              className: 'orven-button',
              onClick: () => { controller.refresh() },
            },
            'Try again',
          ),
        )
      : null,
    (state.phase === 'idle' || state.phase === 'empty')
      ? createElement(
          'div',
          { className: 'orven-empty' },
          createElement('strong', null, empty.title),
          createElement('p', null, empty.detail),
        )
      : null,
    state.phase === 'loading' && !graphVisible
      ? createElement(
          'div',
          { className: 'orven-empty', role: 'status' },
          createElement('strong', null, 'Loading Change Graph…'),
        )
      : null,
    createElement('div', {
      ref: hostRef,
      className: 'orven-graph-host',
      hidden: !graphVisible,
    }),
  )
}

export const ORVEN_PANEL_CSS = `
.orven-panel {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  color: var(--dsw-alias-label-primary, #eef1f5);
  background: var(--dsw-alias-bg-base, #111318);
}
.orven-panel-header,
.orven-summary,
.orven-summary-title,
.orven-summary-facts {
  display: flex;
  align-items: center;
}
.orven-panel-header {
  min-height: 38px;
  justify-content: space-between;
  gap: 16px;
}
.orven-heading {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.orven-heading h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
}
.orven-subtitle {
  color: var(--dsw-alias-label-secondary, #8993a1);
  font-size: 13px;
}
.orven-summary {
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-subtle, #30343b);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1, #15181e);
}
.orven-summary-title {
  min-width: 0;
  gap: 8px;
}
.orven-summary-title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.orven-summary-facts {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  color: var(--dsw-alias-label-secondary, #8993a1);
  font-size: 12px;
}
.orven-chip,
.orven-gate {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2, #20242c);
  font-size: 11px;
}
.orven-gate-satisfied { color: #69d69c; }
.orven-gate-failed { color: #ff8a80; }
.orven-gate-pending { color: #e7b86c; }
.orven-button {
  appearance: none;
  border: 1px solid var(--dsw-alias-border-subtle, #30343b);
  border-radius: 8px;
  padding: 7px 11px;
  color: inherit;
  background: var(--dsw-alias-bg-layer-2, #20242c);
  cursor: pointer;
}
.orven-button:disabled {
  opacity: .5;
  cursor: default;
}
.orven-banner {
  padding: 8px 10px;
  border: 1px solid #7d6531;
  border-radius: 8px;
  color: #e7c87d;
  background: rgba(125, 101, 49, .14);
  font-size: 12px;
}
.orven-empty {
  margin: auto;
  max-width: 460px;
  text-align: center;
  color: var(--dsw-alias-label-secondary, #8993a1);
}
.orven-empty strong {
  display: block;
  color: var(--dsw-alias-label-primary, #eef1f5);
  font-size: 16px;
}
.orven-empty p {
  margin: 8px 0 14px;
  line-height: 1.55;
}
.orven-graph-host {
  min-height: 0;
  flex: 1 1 auto;
}
.orven-graph-host[hidden] {
  display: none;
}
.orven-graph-host > .dsh-graph-explorer {
  height: 100%;
  min-height: 520px;
}
@media (max-width: 900px) {
  .orven-panel { padding: 12px; }
  .orven-summary {
    align-items: flex-start;
    flex-direction: column;
  }
  .orven-summary-facts { justify-content: flex-start; }
}
`
