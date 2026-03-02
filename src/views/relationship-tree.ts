import * as d3 from 'd3'
import type { ParsedModel, FullProductName } from '../types'
import { showProductDetail } from '../main'
import { pihEntries } from '../pih'
import { labelAnchor, renderNodeLabels } from '../node-labels'

interface RelTreeState {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>
  containerEl: HTMLElement
  highlightFn: (productId: string) => void
}

let relTreeState: RelTreeState | null = null

interface LayerNode {
  id: string
  col: number
  name: string
  productId?: string
  product?: FullProductName
  branchCategory?: string
  relationCategory?: string
  kind: 'ancestor' | 'relates_to' | 'full_product_name' | 'product_reference'
  x: number
  y: number
}

interface LayerEdge {
  sourceId: string
  targetId: string
  relationCategory?: string
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  default_component_of: '#f0ad4e',
  external_component_of: '#e67e22',
  installed_on: '#5bc0de',
  installed_with: '#5cb85c',
  optional_component_of: '#9b59b6',
}

const KIND_COLORS: Record<string, string> = {
  ancestor: '#6c757d',
  relates_to: '#5bc0de',
  full_product_name: '#f0ad4e',
  product_reference: '#5cb85c',
}

function relColor(cat?: string): string {
  return cat ? (RELATIONSHIP_COLORS[cat] ?? '#adb5bd') : '#adb5bd'
}

function nodeRadius(kind: string): number {
  if (kind === 'ancestor') return 5
  if (kind === 'relates_to') return 8
  return 6
}

function connectedIds(startId: string, nodeChains: Map<string, Set<number>>): Set<string> {
  const chains = nodeChains.get(startId)
  if (!chains) return new Set([startId])
  const result = new Set<string>()
  for (const [nodeId, nodeChainSet] of nodeChains) {
    for (const c of chains) {
      if (nodeChainSet.has(c)) { result.add(nodeId); break }
    }
  }
  return result
}

export function renderRelationshipTree(container: HTMLElement, model: ParsedModel): void {
  container.innerHTML = ''

  const rels = model.doc.product_tree?.relationships
  if (!rels || rels.length === 0) {
    container.innerHTML = '<div class="p-4 text-secondary">No relationships defined in this document.</div>'
    return
  }

  const allNodes = new Map<string, LayerNode>()
  const allEdges: LayerEdge[] = []
  const nodeChains = new Map<string, Set<number>>()
  let chainCounter = 0

  function ensureNode(node: LayerNode): void {
    if (!allNodes.has(node.id)) allNodes.set(node.id, { ...node, x: 0, y: 0 })
  }

  function addEdge(sourceId: string, targetId: string, relationCategory?: string): void {
    if (!allEdges.some(e => e.sourceId === sourceId && e.targetId === targetId)) {
      allEdges.push({ sourceId, targetId, relationCategory })
    }
  }

  function tagChain(chainId: number, ...ids: string[]): void {
    for (const id of ids) {
      if (!nodeChains.has(id)) nodeChains.set(id, new Set())
      nodeChains.get(id)!.add(chainId)
    }
  }

  for (const rel of rels) {
    const platformId = rel.relates_to_product_reference
    const componentId = rel.product_reference
    const combinedProduct = rel.full_product_name

    const platformProduct = model.allProducts.get(platformId)
    const componentProduct = model.allProducts.get(componentId)
    const platformAncestors = model.productAncestors.get(platformId) ?? []
    const platformBranchCategory = model.productBranchCategory.get(platformId)
    const componentBranchCategory = model.productBranchCategory.get(componentId)
    const componentAncestors = model.productAncestors.get(componentId) ?? []

    const platformNodeId = '__rel__' + platformId
    const combinedId = '__combined__' + combinedProduct.product_id
    const componentNodeId = '__comp__' + componentId
    const chainId = chainCounter++

    const nPlat = platformAncestors.length
    let prevId = ''
    for (let i = 0; i < nPlat; i++) {
      const anc = platformAncestors[i]
      const ancId = '__plat_anc__' + platformAncestors.slice(0, i + 1).map(a => a.name).join('\0')
      const ancCol = -(nPlat - i + 1)
      ensureNode({ id: ancId, col: ancCol, kind: 'ancestor', name: anc.name, branchCategory: anc.category, x: 0, y: 0 })
      tagChain(chainId, ancId)
      if (prevId) addEdge(prevId, ancId)
      prevId = ancId
    }

    ensureNode({
      id: platformNodeId, col: -1, kind: 'relates_to',
      name: platformProduct?.name ?? platformId,
      productId: platformId, product: platformProduct,
      branchCategory: platformBranchCategory, x: 0, y: 0,
    })
    tagChain(chainId, platformNodeId)
    if (prevId) addEdge(prevId, platformNodeId)

    ensureNode({
      id: combinedId, col: 0, kind: 'full_product_name',
      name: combinedProduct.name,
      productId: combinedProduct.product_id, product: combinedProduct,
      relationCategory: rel.category, x: 0, y: 0,
    })
    tagChain(chainId, combinedId)
    addEdge(platformNodeId, combinedId)

    ensureNode({
      id: componentNodeId, col: 1, kind: 'product_reference',
      name: componentProduct?.name ?? componentId,
      productId: componentId, product: componentProduct,
      branchCategory: componentBranchCategory,
      relationCategory: rel.category, x: 0, y: 0,
    })
    tagChain(chainId, componentNodeId)
    addEdge(combinedId, componentNodeId, rel.category)

    for (let i = 0; i < componentAncestors.length; i++) {
      const anc = componentAncestors[i]
      const ancId = '__comp_anc__' + componentAncestors.slice(0, i + 1).map(a => a.name).join('\0')
      const ancCol = 2 + i
      ensureNode({ id: ancId, col: ancCol, kind: 'ancestor', name: anc.name, branchCategory: anc.category, x: 0, y: 0 })
      tagChain(chainId, ancId)
      const parentId = i === 0 ? componentNodeId : '__comp_anc__' + componentAncestors.slice(0, i).map(a => a.name).join('\0')
      addEdge(parentId, ancId)
    }
  }

  const { minCol, maxCol, svgW, svgH } = computeLayout(allNodes)

  relTreeState = null

  const legend = buildLegend()
  container.appendChild(legend)

  drawCustomLayout(container, allNodes, allEdges, nodeChains, minCol, maxCol, svgW, svgH)
}

function computeLayout(
  visibleNodes: Map<string, LayerNode>,
): { minCol: number; maxCol: number; svgW: number; svgH: number } {
  const H_GAP = 60
  const ROW_HEIGHT = 56
  const PADDING = 40

  const colMap = new Map<number, LayerNode[]>()
  for (const node of visibleNodes.values()) {
    const col = colMap.get(node.col) ?? []
    if (!col.includes(node)) col.push(node)
    colMap.set(node.col, col)
  }

  const cols = Array.from(colMap.keys()).sort((a, b) => a - b)
  const minCol = cols[0] ?? 0
  const maxCol = cols[cols.length - 1] ?? 0

  const colWidths = measureColWidths(colMap)

  const colX = new Map<number, number>()
  let x = PADDING
  for (const col of cols) {
    colX.set(col, x)
    x += colWidths.get(col)! + H_GAP
  }
  const totalW = x - H_GAP + PADDING

  const maxRows = Math.max(1, ...Array.from(colMap.values()).map(n => n.length))
  const totalH = maxRows * ROW_HEIGHT

  for (const col of cols) {
    const nodes = colMap.get(col)!
    const cx = colX.get(col)!
    const colH = nodes.length * ROW_HEIGHT
    const offsetY = (totalH - colH) / 2 + PADDING
    nodes.forEach((node, i) => {
      node.x = cx
      node.y = i * ROW_HEIGHT + offsetY
    })
  }

  return { minCol, maxCol, svgW: totalW, svgH: totalH + PADDING * 2 }
}

function measureColWidths(colMap: Map<number, LayerNode[]>): Map<number, number> {
  const measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  measureSvg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  document.body.appendChild(measureSvg)

  const colWidths = new Map<number, number>()

  for (const [col, nodes] of colMap) {
    let maxW = 0
    for (const node of nodes) {
      const kind = node.kind
      const fontSize = kind === 'ancestor' ? '11px' : '12px'
      const fontWeight = kind === 'relates_to' ? '600' : '400'
      const texts = [node.name]
      if (node.productId && kind !== 'ancestor') texts.push(node.productId)
      if (kind === 'full_product_name' && node.relationCategory) texts.push(node.relationCategory.replace(/_/g, ' '))
      for (const t of texts) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        el.style.fontSize = fontSize
        el.style.fontWeight = fontWeight
        el.textContent = t
        measureSvg.appendChild(el)
        maxW = Math.max(maxW, el.getBBox().width)
      }
    }
    colWidths.set(col, Math.max(maxW, 80))
  }

  document.body.removeChild(measureSvg)
  return colWidths
}

function buildLegend(): HTMLElement {
  const div = document.createElement('div')
  div.className = 'px-3 pt-2 pb-1 d-flex flex-wrap gap-3 border-bottom border-secondary align-items-center'

  const kindEntries: [string, string][] = [
    [KIND_COLORS.ancestor, 'Branch ancestor'],
    [KIND_COLORS.relates_to, 'Platform (relates_to)'],
    [KIND_COLORS.full_product_name, 'Combined product (full_product_name)'],
    [KIND_COLORS.product_reference, 'Component (product_reference)'],
  ]
  for (const [color, label] of kindEntries) {
    const item = document.createElement('span')
    item.className = 'd-flex align-items-center gap-1 small'
    item.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>${label}`
    div.appendChild(item)
  }

  const sep = document.createElement('span')
  sep.className = 'text-secondary small'
  sep.textContent = '|'
  div.appendChild(sep)

  for (const [cat, color] of Object.entries(RELATIONSHIP_COLORS)) {
    const item = document.createElement('span')
    item.className = 'd-flex align-items-center gap-1 small'
    item.innerHTML = `<span style="width:20px;height:2px;background:${color};display:inline-block;flex-shrink:0"></span>${cat.replace(/_/g, ' ')}`
    div.appendChild(item)
  }

  const hint = document.createElement('span')
  hint.className = 'ms-auto small text-secondary'
  hint.textContent = 'Hover to highlight path · Click label for details · Drag to pan · Scroll to zoom'
  div.appendChild(hint)

  return div
}

function drawCustomLayout(
  container: HTMLElement,
  allNodes: Map<string, LayerNode>,
  allEdges: LayerEdge[],
  nodeChains: Map<string, Set<number>>,
  minCol: number,
  maxCol: number,
  svgW: number,
  svgH: number,
): void {
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('min-width', `${svgW}px`)
    .style('min-height', `${svgH}px`)

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', e => g.attr('transform', e.transform.toString()))

  svg.call(zoom).on('dblclick.zoom', null)

  const g = svg.append('g')

  const cw = container.clientWidth || 800
  svg.call(zoom.transform, d3.zoomIdentity.translate((cw - svgW) / 2, 0))

  const linkG = g.append('g')
  const nodeG = g.append('g')

  const link = d3.linkHorizontal<LayerEdge, LayerNode>()
    .source(e => allNodes.get(e.sourceId)!)
    .target(e => allNodes.get(e.targetId)!)
    .x(n => n.x)
    .y(n => n.y)

  linkG.selectAll<SVGPathElement, LayerEdge>('path')
    .data(allEdges)
    .enter()
    .append('path')
    .merge(linkG.selectAll<SVGPathElement, LayerEdge>('path'))
    .attr('fill', 'none')
    .attr('stroke', e => {
      const tgt = allNodes.get(e.targetId)
      if (!tgt) return '#6c757d'
      return tgt.kind === 'product_reference' ? relColor(e.relationCategory) : (tgt.kind === 'ancestor' ? '#495057' : '#6c757d')
    })
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', e => allNodes.get(e.targetId)?.kind === 'product_reference' ? '5,3' : 'none')
    .attr('d', link)

  const nodeData = Array.from(allNodes.values())

  const nodeEls = nodeG.selectAll<SVGGElement, LayerNode>('g.node')
    .data(nodeData, d => d.id)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .style('pointer-events', 'all')

  nodeEls.append('circle')
    .attr('class', 'node-circle')
    .attr('r', d => nodeRadius(d.kind))
    .attr('fill', d => KIND_COLORS[d.kind] ?? '#adb5bd')
    .attr('stroke', '#212529')
    .attr('stroke-width', 1.5)
    .style('pointer-events', 'all')

  nodeEls.filter(d => d.kind === 'full_product_name')
    .append('circle')
    .attr('class', 'combined-ring')
    .attr('r', 10)
    .attr('fill', 'none')
    .attr('stroke', d => relColor(d.relationCategory))
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,2')
    .style('pointer-events', 'none')

  nodeEls.append('g')
    .attr('class', 'node-label')
    .style('cursor', 'pointer')
    .style('pointer-events', 'all')
    .on('click', (_evt, d) => {
      const product = d.product ?? { name: d.name, product_id: d.productId ?? '' }
      showProductDetail(product, d.branchCategory ?? d.relationCategory ?? d.kind)
    })
    .each(function(d) {
      const el = this as SVGGElement
      const kind = d.kind
      const anchor = labelAnchor(d.col === maxCol, d.col === minCol)
      const pih = d.product?.product_identification_helper
      const entries = pih ? pihEntries(pih) : []
      const nameColor = kind === 'ancestor' ? '#6c757d' : (d.product ? '#dee2e6' : '#adb5bd')
      const nameFontWeight = kind === 'relates_to' ? '600' : '400'
      const nameFontSize = kind === 'ancestor' ? '11px' : '12px'
      const nameTitle = `${d.name}${d.productId ? `\n${d.productId}` : ''}`
      const extraLines = kind === 'full_product_name' && d.relationCategory
        ? [{ text: d.relationCategory.replace(/_/g, ' '), color: relColor(d.relationCategory) }]
        : []
      renderNodeLabels(el, {
        name: d.name, nameColor, nameFontSize, nameFontWeight, nameTitle,
        productId: kind !== 'ancestor' ? d.productId : undefined,
        extraLines, pihEntries: entries, anchor,
      })
    })

  nodeEls
    .on('mouseenter', (_evt, d) => {
      const connected = connectedIds(d.id, nodeChains)
      nodeG.selectAll<SVGGElement, LayerNode>('g.node').style('opacity', n => connected.has(n.id) ? '1' : '0.15')
      linkG.selectAll<SVGPathElement, LayerEdge>('path').style('opacity', e => connected.has(e.sourceId) && connected.has(e.targetId) ? '1' : '0.05')
    })
    .on('mouseleave', () => {
      nodeG.selectAll<SVGGElement, LayerNode>('g.node').style('opacity', '1')
      linkG.selectAll<SVGPathElement, LayerEdge>('path').style('opacity', '1')
    })

  function highlightFn(productId: string): void {
    nodeEls.selectAll<SVGCircleElement, unknown>('circle.highlight-ring').remove()

    let found: LayerNode | null = null

    nodeEls.each(function(d) {
      if (d.productId === productId) {
        found = d
        const r = nodeRadius(d.kind)
        d3.select(this).append('circle')
          .attr('class', 'highlight-ring')
          .attr('r', r + 8)
          .attr('fill', 'none')
          .attr('stroke', '#ffc107')
          .attr('stroke-width', 2.5)
          .style('pointer-events', 'none')
      }
    })

    if (!found) return

    const n = found as LayerNode
    const cw2 = container.clientWidth || 800
    const ch = container.clientHeight || 600
    const scale = 1.5

    svg.transition().duration(600)
      .call(zoom.transform, d3.zoomIdentity.translate(cw2 / 2 - n.x * scale, ch / 2 - n.y * scale).scale(scale))
  }

  relTreeState = { svg, zoom, containerEl: container, highlightFn }
}

export function highlightProductInRelTree(productId: string): void {
  relTreeState?.highlightFn(productId)
}
