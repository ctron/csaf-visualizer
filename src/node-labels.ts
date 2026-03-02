import * as d3 from 'd3'
import type { PihEntry } from './pih'

export interface LabelAnchor {
  x: number
  y: number
  anchor: string
}

const NODE_GAP = 14
const LINE_SM = 13
const PIH_LINE_HEIGHT = 13

export function labelAnchor(isLeaf: boolean, isTopLevel: boolean): LabelAnchor {
  if (isLeaf) return { x: NODE_GAP, y: 4, anchor: 'start' }
  if (isTopLevel) return { x: -NODE_GAP, y: 4, anchor: 'end' }
  return { x: NODE_GAP, y: 18, anchor: 'start' }
}

export interface ExtraLine {
  text: string
  color: string
}

export interface NodeLabelOpts {
  name: string
  nameColor: string
  nameFontSize?: string
  nameFontWeight?: string
  nameTitle?: string
  productId?: string
  extraLines?: ExtraLine[]
  pihEntries?: PihEntry[]
  anchor: LabelAnchor
}

export function renderNodeLabels(el: SVGGElement, opts: NodeLabelOpts): void {
  const { name, nameColor, nameFontSize = '12px', nameFontWeight = '400',
    nameTitle, productId, extraLines = [], pihEntries: entries = [], anchor } = opts

  const grp = d3.select(el)
  let y = anchor.y

  grp.append('text')
    .attr('x', anchor.x).attr('y', y)
    .attr('text-anchor', anchor.anchor)
    .attr('font-size', nameFontSize)
    .attr('font-weight', nameFontWeight)
    .attr('fill', nameColor)
    .text(name)
    .call(t => { if (nameTitle) t.append('title').text(nameTitle) })

  if (productId) {
    y += LINE_SM
    grp.append('text')
      .attr('x', anchor.x).attr('y', y)
      .attr('text-anchor', anchor.anchor)
      .attr('font-size', '10px')
      .attr('fill', '#6c757d')
      .text(productId)
  }

  for (const line of extraLines) {
    y += LINE_SM
    grp.append('text')
      .attr('x', anchor.x).attr('y', y)
      .attr('text-anchor', anchor.anchor)
      .attr('font-size', '9px')
      .attr('fill', line.color)
      .text(line.text)
  }

  if (entries.length > 0) {
    y += LINE_SM
    const pihGrp = grp.append('g').attr('class', 'pih-lines')

    function render(expanded: boolean): void {
      pihGrp.selectAll('*').remove()
      const visible = expanded ? entries : entries.slice(0, 1)

      visible.forEach((e, i) => {
        pihGrp.append('text')
          .attr('x', anchor.x).attr('y', y + i * PIH_LINE_HEIGHT)
          .attr('text-anchor', anchor.anchor)
          .attr('font-size', '9px').attr('fill', '#5bc0de')
          .text(`[${e.kind}] ${e.value}`)
          .append('title').text(`${e.kind}: ${e.value}`)
      })

      if (entries.length > 1) {
        pihGrp.append('text')
          .attr('x', anchor.x).attr('y', y + visible.length * PIH_LINE_HEIGHT)
          .attr('text-anchor', anchor.anchor)
          .attr('font-size', '9px').attr('fill', '#ffc107')
          .attr('class', 'pih-toggle')
          .style('cursor', 'pointer')
          .text(expanded ? '▲ show less' : `▼ +${entries.length - 1} more`)
          .on('click', (evt) => { evt.stopPropagation(); render(!expanded) })
      }
    }

    render(false)
  }
}

export function labelContentHeight(opts: {
  hasProductId: boolean
  extraLines: number
  pihCount: number
}): number {
  let h = 13
  if (opts.hasProductId) h += LINE_SM
  h += opts.extraLines * LINE_SM
  if (opts.pihCount > 0) {
    h += PIH_LINE_HEIGHT
    if (opts.pihCount > 1) h += PIH_LINE_HEIGHT
  }
  return h
}

