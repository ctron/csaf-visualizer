import * as d3 from 'd3'
import type { ParsedModel, Branch, FullProductName } from '../types'
import { showProductDetail } from '../main'
import { pihEntries } from '../pih'
import { labelAnchor, labelContentHeight, renderNodeLabels } from '../node-labels'

interface TreeNode {
  name: string
  category?: string
  product?: FullProductName
  children?: TreeNode[]
}

type HNode = d3.HierarchyNode<TreeNode> & { _children?: HNode[]; collapsed?: boolean }

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

function getCategoryColor(category?: string): string {
  return category ? (BRANCH_COLORS[category] ?? '#adb5bd') : '#adb5bd'
}

function branchesToTree(branches: Branch[]): TreeNode[] {
  return branches.map(b => ({
    name: b.name,
    category: b.category,
    product: b.product,
    children: b.branches ? branchesToTree(b.branches) : undefined,
  }))
}

export function renderProductTree(container: HTMLElement, model: ParsedModel): void {
  container.innerHTML = ''

  const tree = model.doc.product_tree
  if (!tree) {
    container.innerHTML = '<div class="p-4 text-secondary">No product tree in this document.</div>'
    return
  }

  const roots: TreeNode[] = []

  if (tree.branches) {
    roots.push(...branchesToTree(tree.branches))
  }

  if (tree.full_product_names) {
    for (const p of tree.full_product_names) {
      roots.push({ name: p.name, product: p })
    }
  }

  if (roots.length === 0) {
    container.innerHTML = '<div class="p-4 text-secondary">Product tree contains no branches or products.</div>'
    return
  }

  const virtualRoot: TreeNode = { name: '__root__', children: roots }

  const legend = buildLegend()
  container.appendChild(legend)

  drawTree(container, virtualRoot)
}

function buildLegend(): HTMLElement {
  const div = document.createElement('div')
  div.className = 'px-3 pt-2 pb-1 d-flex flex-wrap gap-2 border-bottom border-secondary'

  const categories = Object.entries(BRANCH_COLORS)
  for (const [cat, color] of categories) {
    const item = document.createElement('span')
    item.className = 'd-flex align-items-center gap-1 small'
    item.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>${cat.replace(/_/g, ' ')}`
    div.appendChild(item)
  }

  const hint = document.createElement('span')
  hint.className = 'ms-auto small text-secondary'
  hint.textContent = 'Click circle to collapse/expand · Click label for details · Scroll to zoom'
  div.appendChild(hint)

  return div
}

const BASE_NODE_HEIGHT = 28

function nodeSlotHeight(node: { data: TreeNode }): number {
  const pih = node.data.product?.product_identification_helper
  const pihCount = pih ? pihEntries(pih).length : 0
  return labelContentHeight({
    hasProductId: !!node.data.product,
    extraLines: 0,
    pihCount,
  })
}

function drawTree(container: HTMLElement, root: TreeNode): void {
  const nodeWidth = 180
  const hGap = 40
  const vGap = 8

  const hierarchy = d3.hierarchy(root) as HNode

  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')

  const g = svg.append('g')
  const linkG = g.append('g')
  const nodeG = g.append('g')

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', e => g.attr('transform', e.transform.toString()))

  svg.call(zoom).on('dblclick.zoom', null)

  const linkGen = d3.linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
    .x(n => n.y)
    .y(n => n.x)

  let initialized = false

  function update(): void {
    const treeLayout = d3.tree<TreeNode>()
      .nodeSize([BASE_NODE_HEIGHT + vGap, nodeWidth + hGap])
      .separation((a, b) => {
        const aH = nodeSlotHeight(a)
        const bH = nodeSlotHeight(b)
        const needed = (aH + bH) / 2 + vGap
        return Math.max(1, needed / (BASE_NODE_HEIGHT + vGap))
      })

    const pointRoot = treeLayout(hierarchy as d3.HierarchyNode<TreeNode>)

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    pointRoot.each(n => {
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    })

    const padding = 20
    const svgWidth = maxY - minY + nodeWidth + padding * 2
    const svgHeight = maxX - minX + BASE_NODE_HEIGHT + padding * 2

    svg.style('min-width', `${svgWidth}px`).style('min-height', `${svgHeight}px`)

    if (!initialized) {
      initialized = true
      const width = container.clientWidth || 800
      const initialX = padding - minY + (width - svgWidth) / 2
      const initialY = padding - minX
      svg.call(zoom.transform, d3.zoomIdentity.translate(initialX, initialY))
    }

    const visibleNodes = pointRoot.descendants().filter(n => n.data.name !== '__root__')
    const visibleLinks = pointRoot.links().filter(l => l.source.data.name !== '__root__')

    const linkSel = linkG.selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNode>>('path.link')
      .data(visibleLinks, d => `${d.source.data.name}→${d.target.data.name}`)

    linkSel.enter().append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#495057')
      .attr('stroke-width', 1.5)
      .attr('d', linkGen)
      .merge(linkSel)
      .attr('d', linkGen)

    linkSel.exit().remove()

    const nodeSel = nodeG.selectAll<SVGGElement, d3.HierarchyPointNode<TreeNode>>('g.node')
      .data(visibleNodes, d => d.data.name)

    const nodeEnter = nodeSel.enter().append('g')
      .attr('class', 'node')
      .attr('transform', n => `translate(${n.y},${n.x})`)

    nodeEnter.append('circle')
      .attr('class', 'node-circle')
      .attr('r', 6)
      .attr('stroke', '#212529')
      .attr('stroke-width', 1.5)
      .style('pointer-events', 'all')
      .style('cursor', n => (n as HNode)._children || n.children ? 'pointer' : 'default')
      .on('click', (evt, n) => {
        evt.stopPropagation()
        const hn = n as HNode
        if (!hn._children && !hn.children) return
        if (hn.children) {
          hn._children = hn.children as HNode[]
          hn.children = undefined
        } else {
          hn.children = hn._children
          hn._children = undefined
        }
        update()
      })

    nodeEnter.append('g')
      .attr('class', 'node-label')
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .on('click', (_evt, n) => {
        const product = n.data.product ?? { name: n.data.name, product_id: '' }
        showProductDetail(product, n.data.category)
      })

    const nodeMerge = nodeEnter.merge(nodeSel)

    nodeMerge.attr('transform', n => `translate(${n.y},${n.x})`)

    nodeMerge.select<SVGCircleElement>('circle.node-circle')
      .attr('fill', n => {
        const hn = n as HNode
        return hn._children ? '#495057' : getCategoryColor(n.data.category)
      })
      .style('cursor', n => (n as HNode)._children || n.children ? 'pointer' : 'default')

    nodeMerge.select<SVGGElement>('g.node-label').each(function(n) {
      const el = this as SVGGElement
      el.innerHTML = ''
      const isLeaf = !n.children && !(n as HNode)._children
      const isTopLevel = n.parent?.data.name === '__root__'
      const anchor = labelAnchor(isLeaf, isTopLevel)
      const pih = n.data.product?.product_identification_helper
      const entries = pih ? pihEntries(pih) : []

      renderNodeLabels(el, {
        name: n.data.name,
        nameColor: n.data.product ? '#dee2e6' : '#adb5bd',
        nameFontWeight: n.data.product ? '500' : '400',
        nameTitle: n.data.name + (n.data.product ? ` [${n.data.product.product_id}]` : ''),
        productId: n.data.product?.product_id,
        pihEntries: entries,
        anchor,
      })
    })

    nodeSel.exit().remove()
  }

  update()
}
