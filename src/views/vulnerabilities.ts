import { Popover, Tooltip } from 'bootstrap'
import { fromVector } from 'ae-cvss-calculator'
import cweNames from '../cwe-names.json'
import type { ParsedModel, Vulnerability, ProductStatus, Threat } from '../types'
import { severityColor } from '../parser'
import { navigateToRelTree } from '../main'
import { renderMarkdown, renderMarkdownInline } from '../markdown'

/** Renders the vulnerabilities tab with collapsible vulnerability cards. */
export function renderVulnerabilities(container: HTMLElement, model: ParsedModel): void {
  const { doc, allProducts } = model
  const vulns = doc.vulnerabilities ?? []

  container.innerHTML = vulns.length > 0
    ? renderVulnsSection(vulns, allProducts)
    : '<div class="text-secondary">No vulnerabilities</div>'

  container.querySelectorAll<HTMLElement>('[data-rel-product-id]').forEach(el => {
    el.addEventListener('click', () => {
      navigateToRelTree(el.dataset.relProductId!)
    })
    el.addEventListener('mouseenter', () => {
      const pid = el.dataset.pid!
      container.querySelectorAll<HTMLElement>(`[data-pid="${CSS.escape(pid)}"]`).forEach(b => {
        if (b !== el) b.classList.add('pid-highlight')
      })
    })
    el.addEventListener('mouseleave', () => {
      container.querySelectorAll<HTMLElement>('.pid-highlight').forEach(b => b.classList.remove('pid-highlight'))
    })
  })

  container.querySelectorAll<HTMLButtonElement>('button.expand-more').forEach(btn => {
    const pids: string[] = JSON.parse(btn.dataset.pids!)
    const style = btn.dataset.style!
    const expandId = btn.dataset.expandId!
    const extra = pids.slice(3)
    let expanded = false

    const extraBadges = extra.map(pid => {
      const p = allProducts.get(pid)
      const name = p?.name ?? pid
      const badge = document.createElement('span')
      badge.className = `badge ${style} me-1 mb-1 cursor-pointer product-link`
      badge.style.whiteSpace = 'normal'
      badge.style.textAlign = 'left'
      badge.dataset.productId = pid
      badge.dataset.pid = pid
      badge.innerHTML = escHtml(name)
      badge.addEventListener('click', () => { navigateToRelTree(pid) })
      badge.addEventListener('mouseenter', () => {
        container.querySelectorAll<HTMLElement>(`[data-pid="${CSS.escape(pid)}"]`).forEach(b => {
          if (b !== badge) b.classList.add('pid-highlight')
        })
      })
      badge.addEventListener('mouseleave', () => {
        container.querySelectorAll<HTMLElement>('.pid-highlight').forEach(b => b.classList.remove('pid-highlight'))
      })
      badge.style.display = 'none'
      return badge
    })

    const targetContainer = document.getElementById(expandId)!
    extraBadges.forEach(b => targetContainer.insertBefore(b, btn))

    btn.addEventListener('click', () => {
      expanded = !expanded
      extraBadges.forEach(b => { b.style.display = expanded ? '' : 'none' })
      btn.textContent = expanded ? `− show less` : `+${extra.length} more`
    })
  })

  container.querySelectorAll<HTMLElement>('.cvss-popover').forEach(el => {
    const vector = el.dataset.cvssVector!
    const severity = el.dataset.cvssSeverity ?? ''
    const score = parseFloat(el.dataset.cvssScore ?? '0')
    const { title, content } = formatCvssPopover(vector, severity, score)
    new Popover(el, {
      trigger: 'hover focus',
      html: true,
      title,
      content,
      container: 'body',
    })
  })

  container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
    new Tooltip(el)
  })

  container.querySelectorAll<HTMLElement>('.threat-popover[data-bs-content]').forEach(el => {
    new Popover(el, { html: true })
  })
}

/** Looks up the human-readable name for a CWE ID like "CWE-79". */
function cweName(id: string): string | undefined {
  const num = id.replace(/^CWE-/i, '')
  return (cweNames as Record<string, string>)[num]
}

function renderStateSummaryBadges(v: Vulnerability): string {
  const statuses: { key: keyof ProductStatus; label: string; cls: string }[] = [
    { key: 'known_affected', label: 'affected', cls: 'text-bg-danger' },
    { key: 'fixed', label: 'fixed', cls: 'text-bg-success' },
    { key: 'known_not_affected', label: 'not affected', cls: 'text-bg-secondary' },
    { key: 'under_investigation', label: 'investigating', cls: 'text-bg-warning' },
    { key: 'first_fixed', label: 'first fixed', cls: 'text-bg-info' },
    { key: 'recommended', label: 'recommended', cls: 'text-bg-primary' },
  ]
  return statuses
    .filter(s => (v.product_status?.[s.key]?.length ?? 0) > 0)
    .map(s => `<span class="badge ${s.cls} fw-normal">${v.product_status![s.key]!.length} ${s.label}</span>`)
    .join('')
}

function renderThreatSummaryBadges(v: Vulnerability): string {
  const grouped = new Map<string, string[]>()
  for (const t of v.threats ?? []) {
    const label = threatCategoryLabel[t.category] ?? t.category.replace(/_/g, ' ')
    if (!grouped.has(label)) grouped.set(label, [])
    if (t.details) grouped.get(label)!.push(t.details)
  }
  return Array.from(grouped.entries())
    .map(([label, details]) => {
      const tip = details.join(' — ')
      const content = renderMarkdownInline(tip)
      return `<span class="badge text-bg-secondary threat-popover"${tip ? ` data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-content="${escHtml(content)}"` : ''}>${escHtml(label)}</span>`
    })
    .join('')
}


const threatCategoryLabel: Record<string, string> = {
  exploit_status: 'Exploit Status',
  impact: 'Impact',
  target_set: 'Target Set',
}

/** Renders the threats subsection within a vulnerability card. */
function renderThreatsSection(
  threats: Threat[],
  vulnId: string,
  renderBadges: (pids: string[], style: string, showAll: boolean, expandId: string) => string
): string {
  return `
    <div class="mt-2 row g-2">
      ${threats.map((t, ti) => {
        const label = threatCategoryLabel[t.category] ?? t.category.replace(/_/g, ' ')
        const threatPids = t.product_ids ?? []
        const threatExpandId = `${vulnId}-threat-${ti}`
        return `
          <div class="col-12 col-md-6 col-xl-4"><div class="card border-secondary-subtle h-100">
            <div class="card-header bg-secondary-subtle text-secondary-emphasis border-secondary-subtle d-flex align-items-center justify-content-between gap-2">
              <span class="fw-semibold">${escHtml(label)}</span>
              ${t.date ? `<span class="small text-body-secondary">${escHtml(t.date)}</span>` : ''}
            </div>
            <div class="card-body">
              ${t.details ? `<div class="mb-1">${renderMarkdownInline(t.details)}</div>` : ''}
              ${threatPids.length > 0 ? `<div id="${threatExpandId}">${renderBadges(threatPids, 'bg-secondary', false, threatExpandId)}</div>` : ''}
            </div>
          </div></div>
        `
      }).join('')}
    </div>`
}

function renderVulnsSection(
  vulns: Vulnerability[],
  allProducts: Map<string, import('../types').FullProductName>
): string {
  return vulns.map(v => {
    const scores = v.scores ?? []
    const bestScore = scores.reduce<{ score: number; severity: string; vector: string } | null>((acc, s) => {
      const src = s.cvss_v3 ?? s.cvss_v2
      if (src && (acc === null || src.baseScore > acc.score)) {
        return { score: src.baseScore, severity: src.baseSeverity ?? '', vector: src.vectorString }
      }
      return acc
    }, null)

    const affected = v.product_status?.known_affected ?? []
    const fixed = v.product_status?.fixed ?? []
    const vulnId = `vuln-${Math.random().toString(36).slice(2)}`

    const renderBadges = (pids: string[], style: string, showAll: boolean, expandId: string) => {
      const initial = showAll ? pids : pids.slice(0, 3)
      const badges = initial.map(pid => {
        const p = allProducts.get(pid)
        const name = p?.name ?? pid
        return `<span class="badge ${style} me-1 mb-1 cursor-pointer product-link" style="white-space:normal;text-align:left" data-rel-product-id="${escHtml(pid)}" data-pid="${escHtml(pid)}">${escHtml(name)}</span>`
      }).join('')
      const more = !showAll && pids.length > 3
        ? `<button class="btn btn-link btn-sm p-0 text-secondary expand-more" data-expand-id="${expandId}" data-pids='${JSON.stringify(pids)}' data-style="${style}">+${pids.length - 3} more</button>`
        : ''
      return badges + more
    }

    const hasDetails = affected.length > 0 || fixed.length > 0 || (v.remediations?.length ?? 0) > 0 || (v.threats?.length ?? 0) > 0

    return `
      <div class="card border-secondary mb-2">
        <div class="card-body py-2 px-3">
          <div class="d-flex align-items-start gap-2 flex-wrap vuln-header${hasDetails ? ' vuln-header-collapsible collapsed' : ''}"
                 ${hasDetails ? `role="button" data-bs-toggle="collapse" data-bs-target="#${vulnId}-detail"` : ''}>
            <span class="collapse-toggle text-secondary user-select-none">&#9654;</span>
            ${v.cve ? `<code>${escHtml(v.cve)}</code>` : ''}
            ${v.cwe ? `<span class="badge bg-secondary"${cweName(v.cwe.id) ? ` data-bs-toggle="tooltip" data-bs-title="${escHtml(cweName(v.cwe.id)!)}"` : ''}>${escHtml(v.cwe.id)}</span>` : ''}
            ${bestScore ? `<span class="badge bg-${severityColor(bestScore.severity)} cvss-popover" data-cvss-vector="${escHtml(bestScore.vector)}" data-cvss-severity="${escHtml(bestScore.severity)}" data-cvss-score="${bestScore.score}">${bestScore.severity} ${bestScore.score.toFixed(1)}</span>` : ''}
            ${renderThreatSummaryBadges(v)}
            <span class="flex-grow-1 fw-semibold small vuln-title">${renderMarkdownInline(v.title ?? v.cve ?? 'Unnamed')}</span>
            ${hasDetails ? `<span class="collapsed-only gap-1 flex-wrap">${renderStateSummaryBadges(v)}</span>` : ''}
          </div>
          ${hasDetails ? `<div class="collapse" id="${vulnId}-detail">` : ''}
          ${affected.length > 0 ? `
          <div class="mt-2 small" id="${vulnId}-affected">
            <span class="text-secondary me-1">Affected:</span>
            ${renderBadges(affected, 'bg-danger-subtle text-danger-emphasis border border-danger-subtle', false, `${vulnId}-affected`)}
          </div>` : ''}
          ${fixed.length > 0 ? `
          <div class="mt-1 small" id="${vulnId}-fixed">
            <span class="text-secondary me-1">Fixed:</span>
            ${renderBadges(fixed, 'bg-success-subtle text-success-emphasis border border-success-subtle', false, `${vulnId}-fixed`)}
          </div>` : ''}
          ${v.threats?.length ? renderThreatsSection(v.threats, vulnId, renderBadges) : ''}
          ${v.remediations?.length ? `
          <div class="mt-2 row g-2">
            ${v.remediations.map((r, ri) => {
              const remPids = r.product_ids ?? []
              const remExpandId = `${vulnId}-rem-${ri}`
              return `
                <div class="col-12 col-md-6 col-xl-4"><div class="card border-info-subtle h-100">
                  <div class="card-header bg-info-subtle text-info-emphasis border-info-subtle py-1 px-2 d-flex align-items-center justify-content-between gap-2">
                    <span class="fw-semibold">${escHtml(r.category.replace(/_/g, ' '))}</span>
                    ${r.url ? `<a href="${escHtml(r.url)}" target="_blank" rel="noopener" class="small text-truncate">${escHtml(r.url)}</a>` : ''}
                  </div>
                  <div class="card-body py-1 px-2">
                    ${r.details ? `<div class="mb-1 vuln-remediation-details">${renderMarkdown(r.details)}</div>` : ''}
                    ${remPids.length > 0 ? `<div id="${remExpandId}">${renderBadges(remPids, 'bg-secondary', false, remExpandId)}</div>` : ''}
                  </div>
                </div></div>
              `
            }).join('')}
          </div>` : ''}
          ${hasDetails ? `</div>` : ''}
        </div>
      </div>
    `
  }).join('')
}

/** Formats a CVSS vector into a rich HTML popover using ae-cvss-calculator. */
function formatCvssPopover(vector: string, severity: string, score: number): { title: string; content: string } {
  const cvss = fromVector(vector)

  const title = `${escHtml(severity)} ${score.toFixed(1)} (${escHtml(cvss.getVectorName())})`

  const rows: string[] = []
  for (const [comp, val] of cvss.getComponents()) {
    if (val.shortName === 'X' || val.shortName === 'ND') continue
    rows.push(
      `<div class="d-flex justify-content-between gap-2">`
      + `<span class="text-secondary">${escHtml(comp.name)} (${escHtml(comp.shortName)})</span>`
      + `<span class="fw-semibold">${escHtml(val.name)} (${escHtml(val.shortName)})</span>`
      + `</div>`
    )
  }
  const content = `<div class="small">${rows.join('')}</div>`
    + `<div class="mt-2 border-top pt-1 small"><code>${escHtml(vector)}</code></div>`

  return { title, content }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
