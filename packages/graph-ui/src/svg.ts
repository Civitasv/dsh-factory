import type { GraphViewEdge, GraphViewModel, GraphViewNode } from './types.js'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function edgePath(edge: GraphViewEdge): string {
  const dx = edge.targetX - edge.sourceX
  const dy = edge.targetY - edge.sourceY
  const length = Math.hypot(dx, dy) || 1
  const normalX = -dy / length
  const normalY = dx / length
  const offset = edge.lane * 28
  const controlX = (edge.sourceX + edge.targetX) / 2 + normalX * offset
  const controlY = (edge.sourceY + edge.targetY) / 2 + normalY * offset

  return `M ${edge.sourceX} ${edge.sourceY} Q ${controlX} ${controlY} ${edge.targetX} ${edge.targetY}`
}

function edgeLabelPosition(edge: GraphViewEdge): { readonly x: number; readonly y: number } {
  const dx = edge.targetX - edge.sourceX
  const dy = edge.targetY - edge.sourceY
  const length = Math.hypot(dx, dy) || 1
  const normalX = -dy / length
  const normalY = dx / length
  const offset = edge.lane * 28

  return {
    x: (edge.sourceX + edge.targetX) / 2 + normalX * offset,
    y: (edge.sourceY + edge.targetY) / 2 + normalY * offset - 6,
  }
}

function nodeMarkup(node: GraphViewNode): string {
  const aria = escapeHtml(`${node.kind}: ${node.title}, ${node.subtitle}`)
  return [
    `<g class="dsh-graph-node dsh-kind-${escapeHtml(node.kind)}" data-node-key="${escapeHtml(node.key)}" role="button" tabindex="0" aria-label="${aria}" transform="translate(${node.x} ${node.y})">`,
    `<rect width="${node.width}" height="${node.height}" rx="12" ry="12"></rect>`,
    `<text class="dsh-node-title" x="14" y="28">${escapeHtml(node.title)}</text>`,
    `<text class="dsh-node-subtitle" x="14" y="51">${escapeHtml(node.subtitle)}</text>`,
    `<text class="dsh-node-counts" x="${node.width - 14}" y="51" text-anchor="end">←${node.incomingCount} →${node.outgoingCount}</text>`,
    '</g>',
  ].join('')
}

function edgeMarkup(edge: GraphViewEdge): string {
  const label = edgeLabelPosition(edge)
  return [
    `<g class="dsh-graph-edge" data-relation-id="${escapeHtml(edge.id)}" data-source-key="${escapeHtml(edge.sourceKey)}" data-target-key="${escapeHtml(edge.targetKey)}">`,
    `<path d="${edgePath(edge)}" marker-end="url(#dsh-graph-arrow)"></path>`,
    `<text x="${label.x}" y="${label.y}" text-anchor="middle">${escapeHtml(edge.kind)}</text>`,
    '</g>',
  ].join('')
}

export function renderGraphSvgMarkup(model: GraphViewModel): string {
  if (model.nodes.length === 0) {
    return '<text class="dsh-empty-svg" x="32" y="48">No graph nodes</text>'
  }

  return [
    '<defs>',
    '<marker id="dsh-graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
    '<path d="M 0 0 L 10 5 L 0 10 z"></path>',
    '</marker>',
    '</defs>',
    '<g class="dsh-graph-viewport">',
    ...model.edges.map(edgeMarkup),
    ...model.nodes.map(nodeMarkup),
    '</g>',
  ].join('')
}
