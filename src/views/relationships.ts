import * as d3 from 'd3'
import type { ParsedModel, FullProductName } from '../types'
import { relationshipLabel } from '../parser'
import { showProductDetail } from '../main'
import { pihEntries } from '../pih'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  product?: FullProductName
  isRelProduct: boolean
  branchCategory?: string
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: GraphNode | string
  target: GraphNode | string
  category: string
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  default_component_of: '#f0ad4e',
  external_component_of: '#e67e22',
  installed_on: '#5bc0de',
  installed_with: '#5cb85c',
  optional_component_of: '#9b59b6',
}

const BRANCH_COLORS: Record<string, string> = {
  vendor: '#f0ad4e',
  product_name: '#5bc0de',
  product_version: '#5cb85c',
  product_version_range: '#5cb85c',
  product_family: '#9b59b6',
  architecture: '#e67e22',
  language: '#1abc9c',
  patch_level: '#3498db',
  service_pack: '#2980b9',
  host_name: '#e74c3c',
  legacy: '#95a5a6',
  specification: '#34495e',
}

function nodeColor(d: GraphNode): string {
  if (d.isRelProduct) return '#f0ad4e'
  return d.branchCategory ? (BRANCH_COLORS[d.branchCategory] ?? '#adb5bd') : '#adb5bd'
}

function relColor(cat: string): string {
  return RELATIONSHIP_COLORS[cat] ?? '#adb5bd'
}

export function renderRelationships(container: HTMLElement, model: ParsedModel): void {
  container.innerHTML = ''

  const rels = model.doc.product_tree?.relationships
  if (!rels || rels.length === 0) {
    container.innerHTML = '<div class="p-4 text-secondary">No relationships defined in this document.</div>'
    return
  }

  const legend = buildLegend()
  container.appendChild(legend)

  const svgWrap = document.createElement('div')
  svgWrap.style.flex = '1'
  svgWrap.style.minHeight = '0'
  svgWrap.style.position = 'relative'
  container.appendChild(svgWrap)

  const nodeMap = new Map<string, GraphNode>()

  function getOrCreate(pid: string, product?: FullProductName, isRelProduct = false): GraphNode {
    if (!nodeMap.has(pid)) {
      const p = product ?? model.allProducts.get(pid)
      const branchCategory = model.productBranchCategory.get(pid)
      nodeMap.set(pid, { id: pid, name: p?.name ?? pid, product: p, isRelProduct, branchCategory })
    }
    return nodeMap.get(pid)!
  }

  const links: GraphLink[] = []

  function ensureAncestors(pid: string): void {
    const ancestors = model.productAncestors.get(pid) ?? []
    for (let i = 0; i < ancestors.length; i++) {
      const ancestorId = ancestors.slice(0, i + 1).map(a => a.name).join('\0')
      if (!nodeMap.has(ancestorId)) {
        const a = ancestors[i]
        nodeMap.set(ancestorId, { id: ancestorId, name: a.name, isRelProduct: false, branchCategory: a.category })
      }
      const parentId = i === 0 ? null : ancestors.slice(0, i).map(a => a.name).join('\0')
      const childId = i === ancestors.length - 1 ? pid : ancestors.slice(0, i + 1).map(a => a.name).join('\0')
      if (parentId !== null) {
        links.push({ source: parentId, target: childId, category: '__ancestor__' })
      }
    }
    if (ancestors.length > 0) {
      const parentId = ancestors.map(a => a.name).join('\0')
      links.push({ source: parentId, target: pid, category: '__ancestor__' })
    }
  }

  for (const rel of rels) {
    const relNode = getOrCreate(rel.full_product_name.product_id, rel.full_product_name, true)
    const srcNode = getOrCreate(rel.product_reference)
    const tgtNode = getOrCreate(rel.relates_to_product_reference)

    ensureAncestors(rel.product_reference)
    ensureAncestors(rel.relates_to_product_reference)

    links.push({ source: srcNode.id, target: relNode.id, category: rel.category })
    links.push({ source: relNode.id, target: tgtNode.id, category: rel.category })
  }

  const dedupeLinks = Array.from(
    new Map(links.map(l => [`${l.source}→${l.target}`, l])).values()
  )

  const nodes = Array.from(nodeMap.values())

  const width = svgWrap.clientWidth || 800
  const height = svgWrap.clientHeight || 600

  const svg = d3.select(svgWrap)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('background', 'transparent')

  svg.append('defs').selectAll('marker')
    .data(Object.keys(RELATIONSHIP_COLORS))
    .enter()
    .append('marker')
    .attr('id', d => `arrow-${d}`)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 22)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', d => relColor(d))

  svg.append('defs').append('marker')
    .attr('id', 'arrow-default')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 22)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#adb5bd')

  function nodeRadius(d: GraphNode): number {
    const pih = d.product?.product_identification_helper
    const pihCount = pih ? pihEntries(pih).length : 0
    const r = d.isRelProduct ? 18 : 10
    return r + 26 + pihCount * 13 + 8
  }

  const sim = d3.forceSimulation<GraphNode>(nodes)
    .force('link', d3.forceLink<GraphNode, GraphLink>(dedupeLinks).id(d => d.id).distance((l) => {
      const s = l.source as GraphNode
      const t = l.target as GraphNode
      return nodeRadius(s) + nodeRadius(t) + 40
    }))
    .force('charge', d3.forceManyBody().strength(-600))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide<GraphNode>(d => nodeRadius(d) + 10))
    .alphaDecay(0.04)
    .on('end', () => sim.stop())

  const zoomG = svg.append('g')

  const linkSel = zoomG.append('g').selectAll<SVGLineElement, GraphLink>('line')
    .data(dedupeLinks)
    .enter()
    .append('line')
    .attr('stroke', d => d.category === '__ancestor__' ? '#495057' : relColor(d.category))
    .attr('stroke-width', d => d.category === '__ancestor__' ? 1 : 1.5)
    .attr('stroke-opacity', d => d.category === '__ancestor__' ? 0.4 : 0.7)
    .attr('stroke-dasharray', d => d.category === '__ancestor__' ? '4,3' : 'none')
    .attr('marker-end', d => d.category === '__ancestor__' ? 'none' : `url(#arrow-${d.category in RELATIONSHIP_COLORS ? d.category : 'default'})`)

  const linkLabelSel = zoomG.append('g').selectAll<SVGTextElement, GraphLink>('text')
    .data(dedupeLinks.filter(l => l.category !== '__ancestor__'))
    .enter()
    .append('text')
    .attr('font-size', '9px')
    .attr('fill', d => relColor(d.category))
    .attr('text-anchor', 'middle')
    .text(d => relationshipLabel(d.category))

  const nodeSel = zoomG.append('g').selectAll<SVGGElement, GraphNode>('g')
    .data(nodes)
    .enter()
    .append('g')
    .style('cursor', 'pointer')
    .call(
      d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x; d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0)
          d.fx = null; d.fy = null
        })
    )
    .on('click', (_evt, d) => {
      const product = d.product ?? { name: d.name, product_id: d.id }
      showProductDetail(product, d.branchCategory)
    })

  nodeSel.append('circle')
    .attr('r', d => d.isRelProduct ? 14 : 10)
    .attr('fill', d => nodeColor(d))
    .attr('fill-opacity', 0.25)
    .attr('stroke', d => nodeColor(d))
    .attr('stroke-width', 2)

  nodeSel.filter(d => d.isRelProduct).append('circle')
    .attr('r', 18)
    .attr('fill', 'none')
    .attr('stroke', d => nodeColor(d))
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,2')
    .style('pointer-events', 'none')

  nodeSel.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', d => (d.isRelProduct ? 18 : 10) + 14)
    .attr('font-size', '11px')
    .attr('fill', 'var(--bs-body-color)')
    .text(d => d.name)
    .append('title')
    .text(d => `${d.name}\n${d.id}`)

  nodeSel.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', d => (d.isRelProduct ? 18 : 10) + 26)
    .attr('font-size', '9px')
    .attr('fill', 'var(--bs-secondary-color)')
    .text(d => d.id)

  nodeSel.each(function(d) {
    const pih = d.product?.product_identification_helper
    if (!pih) return
    const entries = pihEntries(pih)
    const r = d.isRelProduct ? 18 : 10
    const baseY = r + 26
    entries.forEach((e, i) => {
      d3.select(this).append('text')
        .attr('text-anchor', 'middle')
        .attr('y', baseY + 13 + i * 13)
        .attr('font-size', '9px')
        .attr('fill', '#5bc0de')
        .text(`[${e.kind}] ${e.value}`)
        .append('title').text(`${e.kind}: ${e.value}`)
    })
  })

  sim.on('tick', () => {
    linkSel
      .attr('x1', d => (d.source as GraphNode).x ?? 0)
      .attr('y1', d => (d.source as GraphNode).y ?? 0)
      .attr('x2', d => (d.target as GraphNode).x ?? 0)
      .attr('y2', d => (d.target as GraphNode).y ?? 0)

    linkLabelSel
      .attr('x', d => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
      .attr('y', d => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2 - 4)

    nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
  })

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', e => {
      zoomG.attr('transform', e.transform.toString())
    })

  svg.call(zoom)
}

function buildLegend(): HTMLElement {
  const div = document.createElement('div')
  div.className = 'px-3 pt-2 pb-1 d-flex flex-wrap gap-2 border-bottom border-secondary align-items-center'

  for (const [cat, color] of Object.entries(RELATIONSHIP_COLORS)) {
    const item = document.createElement('span')
    item.className = 'd-flex align-items-center gap-1 small'
    item.innerHTML = `<span style="width:24px;height:2px;background:${color};display:inline-block;"></span>${cat.replace(/_/g, ' ')}`
    div.appendChild(item)
  }

  const hint = document.createElement('span')
  hint.className = 'ms-auto small text-secondary'
  hint.textContent = 'Drag nodes · Scroll to zoom · Click for details'
  div.appendChild(hint)

  return div
}

