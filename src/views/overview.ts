import * as d3 from 'd3'
import type { ParsedModel, ProductStatus } from '../types'
import { showProductDetail } from '../main'

const STATUS_CONFIG: { key: keyof ProductStatus; label: string; color: string }[] = [
  { key: 'known_affected',     label: 'Known Affected',     color: '#dc3545' },
  { key: 'known_not_affected', label: 'Known Not Affected', color: '#198754' },
  { key: 'fixed',              label: 'Fixed',              color: '#0dcaf0' },
  { key: 'under_investigation',label: 'Under Investigation',color: '#ffc107' },
  { key: 'first_affected',     label: 'First Affected',     color: '#fd7e14' },
  { key: 'last_affected',      label: 'Last Affected',      color: '#e85d04' },
  { key: 'first_fixed',        label: 'First Fixed',        color: '#20c997' },
  { key: 'recommended',        label: 'Recommended',        color: '#0d6efd' },
]

export function renderOverview(container: HTMLElement, model: ParsedModel): void {
  const { doc, allProducts } = model
  const { document: d } = doc

  const tlpLabel = d.distribution?.tlp?.label ?? null
  const tlpStyles: Record<string, string> = {
    WHITE: 'background:#ffffff;color:#000000;border:1px solid #adb5bd',
    CLEAR: 'background:#ffffff;color:#000000;border:1px solid #adb5bd',
    GREEN: 'background:#33cc00;color:#000000',
    AMBER: 'background:#ffc000;color:#000000',
    'AMBER+STRICT': 'background:#ffc000;color:#000000',
    RED:   'background:#cc0033;color:#ffffff',
  }
  const tlpStyle = tlpLabel ? (tlpStyles[tlpLabel] ?? 'background:#6c757d;color:#ffffff') : null
  const tlpBadge = tlpLabel
    ? `<span class="badge ms-2" style="${tlpStyle}">${tlpLabel}</span>`
    : ''

  const vulns = doc.vulnerabilities ?? []

  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 }
  for (const v of vulns) {
    const scores = v.scores ?? []
    const best = scores.reduce<number>((acc, s) => {
      const b = s.cvss_v3?.baseScore ?? s.cvss_v2?.baseScore ?? 0
      return b > acc ? b : acc
    }, -1)
    if (best < 0) { severityCounts.NONE++ }
    else if (best >= 9.0) { severityCounts.CRITICAL++ }
    else if (best >= 7.0) { severityCounts.HIGH++ }
    else if (best >= 4.0) { severityCounts.MEDIUM++ }
    else { severityCounts.LOW++ }
  }

  const branchProducts = doc.product_tree?.branches ? countBranchProducts(doc.product_tree.branches) : 0
  const relProducts = doc.product_tree?.relationships?.length ?? 0
  const topLevelProducts = doc.product_tree?.full_product_names?.length ?? 0

  const statusCounts = new Map<keyof ProductStatus, Set<string>>()
  for (const cfg of STATUS_CONFIG) statusCounts.set(cfg.key, new Set())
  for (const v of vulns) {
    if (!v.product_status) continue
    for (const cfg of STATUS_CONFIG) {
      const ids = v.product_status[cfg.key] ?? []
      for (const id of ids) statusCounts.get(cfg.key)!.add(id)
    }
  }

  container.innerHTML = `
    <div class="row g-3">
      <div class="col-12">
        <div class="card border-secondary">
          <div class="card-header d-flex align-items-center justify-content-between">
            <span class="fw-semibold">Document</span>
            ${tlpBadge ? `<span>TLP:${tlpBadge}</span>` : ''}
          </div>
          <div class="card-body">
            <h5 class="card-title">${escHtml(d.title)}</h5>
            <div class="row g-2">
              <div class="col-sm-6 col-lg-3">
                <span class="text-secondary">Tracking ID</span><br>
                <code>${escHtml(d.tracking.id)}</code>
              </div>
              <div class="col-sm-6 col-lg-3">
                <span class="text-secondary">Status</span><br>
                <span class="badge bg-secondary">${escHtml(d.tracking.status)}</span>
              </div>
              <div class="col-sm-6 col-lg-3">
                <span class="text-secondary">Version</span><br>
                ${escHtml(d.tracking.version)}
              </div>
              <div class="col-sm-6 col-lg-3">
                <span class="text-secondary">Category</span><br>
                ${escHtml(d.category)}
              </div>
              <div class="col-sm-6 col-lg-3">
                <span class="text-secondary">Publisher</span><br>
                ${escHtml(d.publisher.name)}
                <span class="badge bg-secondary ms-1">${escHtml(d.publisher.category)}</span>
              </div>
              <div class="col-sm-6 col-lg-3">
                <span class="text-secondary">Initial Release</span><br>
                ${formatDate(d.tracking.initial_release_date)}
              </div>
              <div class="col-sm-6 col-lg-3">
                <span class="text-secondary">Current Release</span><br>
                ${formatDate(d.tracking.current_release_date)}
              </div>
              ${d.tracking.generator ? `
              <div class="col-sm-6 col-lg-3">
                <span class="text-secondary">Generator</span><br>
                ${escHtml(d.tracking.generator.engine?.name ?? '')}
                ${d.tracking.generator.engine?.version ? `<span class="text-muted"> v${escHtml(d.tracking.generator.engine.version)}</span>` : ''}
              </div>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="col-sm-4">
        <div class="card border-secondary h-100">
          <div class="card-header fw-semibold">Vulnerabilities</div>
          <div class="card-body">
            <div class="d-flex align-items-baseline gap-2 mb-3">
              <span class="display-5 fw-bold">${vulns.length}</span>
              <span class="text-secondary">total</span>
            </div>
            <div class="d-flex flex-column gap-1">
              ${renderSeverityBar('Critical', severityCounts.CRITICAL, vulns.length, 'danger')}
              ${renderSeverityBar('High',     severityCounts.HIGH,     vulns.length, 'danger')}
              ${renderSeverityBar('Medium',   severityCounts.MEDIUM,   vulns.length, 'warning')}
              ${renderSeverityBar('Low',      severityCounts.LOW,      vulns.length, 'success')}
              ${severityCounts.NONE > 0 ? renderSeverityBar('No score', severityCounts.NONE, vulns.length, 'secondary') : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="col-sm-4">
        <div class="card border-secondary h-100">
          <div class="card-header fw-semibold">Products</div>
          <div class="card-body">
            <div class="d-flex align-items-baseline gap-2 mb-3">
              <span class="display-5 fw-bold">${allProducts.size}</span>
              <span class="text-secondary">total</span>
            </div>
            <div class="d-flex flex-column gap-2">
              ${branchProducts > 0 ? `
              <div class="d-flex justify-content-between">
                <span class="text-secondary">From branches</span>
                <span class="fw-semibold">${branchProducts}</span>
              </div>` : ''}
              ${relProducts > 0 ? `
              <div class="d-flex justify-content-between">
                <span class="text-secondary">From relationships</span>
                <span class="fw-semibold">${relProducts}</span>
              </div>` : ''}
              ${topLevelProducts > 0 ? `
              <div class="d-flex justify-content-between">
                <span class="text-secondary">Top-level</span>
                <span class="fw-semibold">${topLevelProducts}</span>
              </div>` : ''}
              ${doc.product_tree?.product_groups?.length ? `
              <div class="d-flex justify-content-between">
                <span class="text-secondary">Product groups</span>
                <span class="fw-semibold">${doc.product_tree.product_groups.length}</span>
              </div>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="col-sm-4">
        <div class="card border-secondary h-100">
          <div class="card-header fw-semibold">Product Status</div>
          <div class="card-body d-flex flex-column align-items-center" id="status-donut-card">
          </div>
        </div>
      </div>

      ${doc.product_tree?.product_groups?.length ? renderGroupsSection(doc.product_tree.product_groups, allProducts) : ''}

      ${d.notes?.length ? renderNotesSection(d.notes) : ''}
    </div>
  `

  container.querySelectorAll<HTMLElement>('[data-product-id]').forEach(el => {
    el.addEventListener('click', () => {
      const pid = el.dataset.productId!
      const product = allProducts.get(pid)
      if (product) showProductDetail(product)
    })
  })

  renderStatusDonut(
    document.getElementById('status-donut-card')!,
    statusCounts,
  )
}

function renderSeverityBar(label: string, count: number, total: number, color: string): string {
  if (count === 0) return ''
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return `
    <div>
      <div class="d-flex justify-content-between mb-1">
        <span class="text-secondary">${label}</span>
        <span class="fw-semibold">${count}</span>
      </div>
      <div class="progress" style="height:6px">
        <div class="progress-bar bg-${color}" style="width:${pct}%"></div>
      </div>
    </div>
  `
}

function renderStatusDonut(
  cardEl: HTMLElement,
  statusCounts: Map<keyof ProductStatus, Set<string>>,
): void {
  const data = STATUS_CONFIG
    .map(cfg => ({ label: cfg.label, color: cfg.color, count: statusCounts.get(cfg.key)!.size }))
    .filter(d => d.count > 0)

  const total = data.reduce((s, d) => s + d.count, 0)

  if (total === 0) {
    cardEl.innerHTML = '<span class="text-secondary">No product status data</span>'
    return
  }

  const size = 160
  const radius = size / 2
  const inner = radius * 0.58

  const svg = d3.select(cardEl)
    .append('svg')
    .attr('width', size)
    .attr('height', size)
    .attr('viewBox', `0 0 ${size} ${size}`)

  const g = svg.append('g').attr('transform', `translate(${radius},${radius})`)

  const pie = d3.pie<typeof data[0]>().value(d => d.count).sort(null)
  const arc = d3.arc<d3.PieArcDatum<typeof data[0]>>().innerRadius(inner).outerRadius(radius - 2)

  g.selectAll('path')
    .data(pie(data))
    .enter()
    .append('path')
    .attr('d', arc)
    .attr('fill', d => d.data.color)
    .attr('stroke', 'var(--bs-body-bg)')
    .attr('stroke-width', 2)
    .append('title')
    .text(d => `${d.data.label}: ${d.data.count}`)

  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.2em')
    .attr('font-size', '22px')
    .attr('font-weight', '700')
    .attr('fill', 'currentColor')
    .text(total)

  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '1.1em')
    .attr('font-size', '9px')
    .attr('fill', 'var(--bs-secondary-color)')
    .text('entries')

  const legend = d3.select(cardEl)
    .append('div')
    .style('margin-top', '12px')
    .style('width', '100%')

  for (const item of data) {
    const row = legend.append('div')
      .style('display', 'flex')
      .style('justify-content', 'space-between')
      .style('align-items', 'center')
      .style('font-size', '11px')
      .style('margin-bottom', '3px')

    row.append('span')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('gap', '5px')
      .html(`<span style="width:9px;height:9px;border-radius:50%;background:${item.color};display:inline-block;flex-shrink:0"></span>${item.label}`)

    row.append('span')
      .style('font-weight', '600')
      .text(item.count)
  }
}

function countBranchProducts(branches: import('../types').Branch[]): number {
  let count = 0
  for (const b of branches) {
    if (b.product) count++
    if (b.branches) count += countBranchProducts(b.branches)
  }
  return count
}


function renderGroupsSection(
  groups: import('../types').ProductGroup[],
  allProducts: Map<string, import('../types').FullProductName>
): string {
  const rows = groups.map(g => `
    <div class="mb-2">
      <div class="fw-semibold text-secondary mb-1">${escHtml(g.group_id)}${g.summary ? ` — ${escHtml(g.summary)}` : ''}</div>
      <div>${g.product_ids.map(pid => {
        const p = allProducts.get(pid)
        return `<span class="badge bg-secondary me-1 cursor-pointer product-link" data-product-id="${escHtml(pid)}">${escHtml(p?.name ?? pid)}</span>`
      }).join('')}</div>
    </div>
  `).join('')

  return `
    <div class="col-12">
      <div class="card border-secondary">
        <div class="card-header fw-semibold">Product Groups</div>
        <div class="card-body">${rows}</div>
      </div>
    </div>
  `
}

function renderNotesSection(notes: import('../types').Note[]): string {
  const items = notes.map(n => `
    <div class="mb-2">
      <div class="fw-semibold text-secondary">${escHtml(n.title ?? n.category)}</div>
      <div>${escHtml(n.text)}</div>
    </div>
  `).join('<hr class="border-secondary my-2">')

  return `
    <div class="col-12">
      <div class="card border-secondary">
        <div class="card-header fw-semibold">Notes</div>
        <div class="card-body">${items}</div>
      </div>
    </div>
  `
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

