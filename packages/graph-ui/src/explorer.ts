import {
  graphNodeKey,
  type ChangeGraphSnapshot,
  type GraphNodeRef,
} from '@dsh-factory/core'
import { buildGraphViewModel, graphNodeDetails } from './view-model.js'
import { renderGraphSvgMarkup } from './svg.js'
import type {
  GraphExplorerController,
  GraphExplorerOptions,
  GraphUiAction,
  GraphViewModel,
  GraphViewNode,
} from './types.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const MIN_SCALE = 0.25
const MAX_SCALE = 3

const CSS = `
.dsh-graph-explorer { display:grid; grid-template-rows:auto 1fr; min-height:480px; border:1px solid var(--dsh-border,#30343b); border-radius:14px; overflow:hidden; background:var(--dsh-bg,#111318); color:var(--dsh-fg,#eef1f5); font:13px system-ui,sans-serif; }
.dsh-graph-toolbar { display:flex; gap:10px; align-items:center; padding:10px 12px; border-bottom:1px solid var(--dsh-border,#30343b); }
.dsh-graph-meta { opacity:.72; margin-right:auto; }
.dsh-graph-body { display:grid; grid-template-columns:minmax(0,1fr) 320px; min-height:0; }
.dsh-graph-stage { position:relative; min-width:0; overflow:hidden; background:var(--dsh-canvas,#0d0f13); }
.dsh-graph-stage svg { width:100%; height:100%; min-height:440px; touch-action:none; cursor:grab; }
.dsh-graph-stage svg.is-panning { cursor:grabbing; }
.dsh-graph-detail { overflow:auto; padding:14px; border-left:1px solid var(--dsh-border,#30343b); background:var(--dsh-panel,#15181e); }
.dsh-graph-detail pre { white-space:pre-wrap; overflow-wrap:anywhere; font-size:11px; line-height:1.45; }
.dsh-graph-node rect { fill:var(--dsh-node,#20242c); stroke:var(--dsh-node-border,#4c5563); stroke-width:1.2; }
.dsh-graph-node { cursor:pointer; outline:none; }
.dsh-graph-node:focus rect { stroke-width:2.2; }
.dsh-graph-node.is-selected rect { stroke:var(--dsh-selected,#f2a65a); stroke-width:2.5; }
.dsh-graph-edge path { fill:none; stroke:var(--dsh-edge,#596474); stroke-width:1.4; }
.dsh-graph-edge text { fill:var(--dsh-muted,#8993a1); font-size:10px; paint-order:stroke; stroke:var(--dsh-canvas,#0d0f13); stroke-width:4px; }
.dsh-graph-edge.is-incident path { stroke:var(--dsh-selected,#f2a65a); stroke-width:2.2; }
#dsh-graph-arrow path { fill:var(--dsh-edge,#596474); }
.dsh-node-title { fill:var(--dsh-fg,#eef1f5); font-size:12px; font-weight:600; }
.dsh-node-subtitle,.dsh-node-counts { fill:var(--dsh-muted,#8993a1); font-size:10px; }
.dsh-kind-change rect { fill:var(--dsh-change,#222a35); }
.dsh-kind-evidence rect { fill:var(--dsh-evidence,#1c2a26); }
.dsh-kind-finding rect { fill:var(--dsh-finding,#322322); }
.dsh-kind-gate rect { fill:var(--dsh-gate,#29253a); }
.dsh-detail-relations { padding-left:18px; }
.dsh-graph-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.dsh-graph-explorer button { border:1px solid var(--dsh-border,#30343b); background:var(--dsh-button,#20242c); color:inherit; border-radius:7px; padding:6px 9px; cursor:pointer; }
.dsh-empty { padding:28px; opacity:.7; }
`

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function appendText(
  parent: HTMLElement,
  tag: keyof HTMLElementTagNameMap,
  text: string,
  className?: string,
): HTMLElement {
  const element = document.createElement(tag)
  element.textContent = text
  if (className !== undefined) element.className = className
  parent.append(element)
  return element
}

function nodeByKey(model: GraphViewModel, key: string): GraphViewNode | undefined {
  return model.nodes.find(node => node.key === key)
}

export function mountGraphExplorer(
  container: HTMLElement,
  initialSnapshot: ChangeGraphSnapshot,
  options: GraphExplorerOptions = {},
): GraphExplorerController {
  let snapshot = initialSnapshot
  let currentModel = buildGraphViewModel(snapshot, options)
  let selectedKey: string | undefined
  let panX = 0
  let panY = 0
  let scale = 1
  let pointer: { readonly id: number; readonly x: number; readonly y: number } | undefined

  container.replaceChildren()

  const root = document.createElement('section')
  root.className = 'dsh-graph-explorer'
  root.setAttribute('aria-label', options.ariaLabel ?? 'DSH Factory Change Graph Explorer')
  root.tabIndex = 0

  const style = document.createElement('style')
  style.textContent = CSS
  root.append(style)

  const toolbar = document.createElement('div')
  toolbar.className = 'dsh-graph-toolbar'
  const meta = document.createElement('span')
  meta.className = 'dsh-graph-meta'
  const fitButton = document.createElement('button')
  fitButton.type = 'button'
  fitButton.textContent = 'Fit'
  toolbar.append(meta, fitButton)

  const body = document.createElement('div')
  body.className = 'dsh-graph-body'

  const stage = document.createElement('div')
  stage.className = 'dsh-graph-stage'
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('aria-label', 'Change Graph')
  stage.append(svg)

  const detail = document.createElement('aside')
  detail.className = 'dsh-graph-detail'

  body.append(stage, detail)
  root.append(toolbar, body)
  container.append(root)

  const viewport = (): SVGGElement | null =>
    svg.querySelector<SVGGElement>('.dsh-graph-viewport')

  const applyViewport = (): void => {
    viewport()?.setAttribute('transform', `translate(${panX} ${panY}) scale(${scale})`)
  }

  const renderDetail = (): void => {
    detail.replaceChildren()
    if (selectedKey === undefined) {
      appendText(detail, 'div', 'Select a node to inspect its domain facts.')
      return
    }

    const node = nodeByKey(currentModel, selectedKey)
    if (node === undefined) {
      selectedKey = undefined
      appendText(detail, 'div', 'Select a node to inspect its domain facts.')
      return
    }

    const details = graphNodeDetails(currentModel, node.ref)
    if (details === undefined) return

    appendText(detail, 'h3', node.title)
    appendText(detail, 'div', `${node.kind} · ${node.key}`)
    appendText(detail, 'h4', 'Domain')
    const pre = document.createElement('pre')
    pre.textContent = JSON.stringify(node.domain.value, null, 2)
    detail.append(pre)

    const appendRelations = (
      title: string,
      edges: typeof details.incoming,
      render: (edge: (typeof edges)[number]) => string,
    ): void => {
      appendText(detail, 'h4', title)
      const list = document.createElement('ul')
      list.className = 'dsh-detail-relations'
      for (const edge of edges) {
        const item = document.createElement('li')
        item.textContent = render(edge)
        list.append(item)
      }
      if (edges.length === 0) {
        const item = document.createElement('li')
        item.textContent = 'None'
        list.append(item)
      }
      detail.append(list)
    }

    appendRelations(
      'Incoming',
      details.incoming,
      edge => `${edge.kind} · ${edge.sourceKey} · ${edge.id}`,
    )
    appendRelations(
      'Outgoing',
      details.outgoing,
      edge => `${edge.kind} · ${edge.targetKey} · ${edge.id}`,
    )

    const actions = options.actionsForNode?.(node) ?? []
    if (actions.length > 0) {
      const actionRow = document.createElement('div')
      actionRow.className = 'dsh-graph-actions'
      for (const action of actions) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = action.label
        button.dataset.actionId = action.id
        button.addEventListener('click', () => options.onAction?.(action, node))
        actionRow.append(button)
      }
      detail.append(actionRow)
    }
  }

  const applySelection = (): void => {
    svg.querySelectorAll<SVGGElement>('[data-node-key]').forEach(element => {
      element.classList.toggle('is-selected', element.dataset.nodeKey === selectedKey)
    })
    svg.querySelectorAll<SVGGElement>('[data-relation-id]').forEach(element => {
      const incident =
        selectedKey !== undefined &&
        (element.dataset.sourceKey === selectedKey ||
          element.dataset.targetKey === selectedKey)
      element.classList.toggle('is-incident', incident)
    })
    renderDetail()
  }

  const selectByKey = (key: string | undefined): void => {
    selectedKey =
      key !== undefined && nodeByKey(currentModel, key) !== undefined ? key : undefined
    applySelection()
    options.onSelectNode?.(
      selectedKey === undefined ? undefined : nodeByKey(currentModel, selectedKey),
    )
  }

  const bindNodes = (): void => {
    svg.querySelectorAll<SVGGElement>('[data-node-key]').forEach(element => {
      const key = element.dataset.nodeKey
      if (key === undefined) return

      element.addEventListener('click', event => {
        event.stopPropagation()
        selectByKey(key)
      })
      element.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          selectByKey(key)
        }
      })
    })
  }

  const render = (): void => {
    meta.textContent = `${currentModel.graphId} · revision ${currentModel.revision}`

    if (currentModel.nodes.length === 0) {
      svg.setAttribute('viewBox', '0 0 640 360')
      svg.innerHTML = renderGraphSvgMarkup(currentModel)
      detail.replaceChildren()
      const empty = document.createElement('div')
      empty.className = 'dsh-empty'
      empty.textContent = 'This Change Graph has no nodes.'
      detail.append(empty)
      return
    }

    svg.setAttribute(
      'viewBox',
      `0 0 ${Math.max(640, currentModel.bounds.width)} ${Math.max(360, currentModel.bounds.height)}`,
    )
    svg.innerHTML = renderGraphSvgMarkup(currentModel)
    applyViewport()
    bindNodes()
    applySelection()
  }

  const fit = (): void => {
    if (currentModel.nodes.length === 0) return
    const rect = svg.getBoundingClientRect()
    const width = Math.max(rect.width, 1)
    const height = Math.max(rect.height, 1)
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(
        MIN_SCALE,
        Math.min(
          (width - 40) / currentModel.bounds.width,
          (height - 40) / currentModel.bounds.height,
        ),
      ),
    )
    scale = nextScale
    panX = (width - currentModel.bounds.width * scale) / 2
    panY = (height - currentModel.bounds.height * scale) / 2
    applyViewport()
  }

  fitButton.addEventListener('click', fit)

  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') selectByKey(undefined)
  })

  svg.addEventListener('click', event => {
    if (event.target === svg) selectByKey(undefined)
  })

  svg.addEventListener('pointerdown', event => {
    if ((event.target as Element).closest?.('[data-node-key]') !== null) return
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
    svg.classList.add('is-panning')
    svg.setPointerCapture?.(event.pointerId)
  })

  svg.addEventListener('pointermove', event => {
    if (pointer === undefined || pointer.id !== event.pointerId) return
    panX += event.clientX - pointer.x
    panY += event.clientY - pointer.y
    pointer = { id: pointer.id, x: event.clientX, y: event.clientY }
    applyViewport()
  })

  const endPan = (event: PointerEvent): void => {
    if (pointer?.id !== event.pointerId) return
    pointer = undefined
    svg.classList.remove('is-panning')
    svg.releasePointerCapture?.(event.pointerId)
  }

  svg.addEventListener('pointerup', endPan)
  svg.addEventListener('pointercancel', endPan)

  svg.addEventListener(
    'wheel',
    event => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const cursorX = event.clientX - rect.left
      const cursorY = event.clientY - rect.top
      const worldX = (cursorX - panX) / scale
      const worldY = (cursorY - panY) / scale
      const factor = event.deltaY < 0 ? 1.12 : 0.89
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor))
      panX = cursorX - worldX * next
      panY = cursorY - worldY * next
      scale = next
      applyViewport()
    },
    { passive: false },
  )

  render()

  return {
    selectedNode: () =>
      selectedKey === undefined ? undefined : nodeByKey(currentModel, selectedKey),
    model: () => currentModel,
    selectNode: ref => selectByKey(ref === undefined ? undefined : graphNodeKey(ref)),
    fit,
    updateSnapshot: nextSnapshot => {
      snapshot = nextSnapshot
      const priorSelection = selectedKey
      currentModel = buildGraphViewModel(snapshot, options)
      selectedKey =
        priorSelection !== undefined && nodeByKey(currentModel, priorSelection) !== undefined
          ? priorSelection
          : undefined
      render()
    },
    destroy: () => {
      container.replaceChildren()
    },
  }
}
