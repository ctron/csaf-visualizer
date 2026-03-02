import 'bootstrap/dist/css/bootstrap.min.css'
import { Offcanvas } from 'bootstrap'
import './style.css'

import type { FullProductName, ParsedModel, ProductVulnEntry } from './types'
import { parseCsaf } from './parser'
import { renderOverview } from './views/overview'
import { renderProductTree } from './views/product-tree'
import { renderRelationships } from './views/relationships'
import { renderRelationshipTree, highlightProductInRelTree } from './views/relationship-tree'
import { initTheme, toggleTheme } from './theme'

let currentModel: ParsedModel | null = null
let activeTab = 'overview'
let offcanvasInstance: Offcanvas | null = null
const renderedTabs = new Set<string>()

const jsonInput = document.getElementById('json-input') as HTMLTextAreaElement
const parseBtn = document.getElementById('parse-btn') as HTMLButtonElement
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement
const parseError = document.getElementById('parse-error') as HTMLDivElement
const emptyState = document.getElementById('empty-state') as HTMLDivElement
const vizArea = document.getElementById('viz-area') as HTMLDivElement
const docTitle = document.getElementById('doc-title') as HTMLSpanElement
const urlInput = document.getElementById('url-input') as HTMLInputElement
const corsProxyInput = document.getElementById('cors-proxy-input') as HTMLInputElement
const loadUrlBtn = document.getElementById('load-url-btn') as HTMLButtonElement

const tabOverview = document.getElementById('tab-overview') as HTMLDivElement
const tabProductTree = document.getElementById('tab-product-tree') as HTMLDivElement
const tabRelationships = document.getElementById('tab-relationships') as HTMLDivElement
const tabRelationshipTree = document.getElementById('tab-relationship-tree') as HTMLDivElement

const tabButtons = document.querySelectorAll<HTMLButtonElement>('[data-tab]')

initTheme()
document.getElementById('theme-toggle')!.addEventListener('click', toggleTheme)

const shaEl = document.getElementById('git-sha') as HTMLAnchorElement
if (__GIT_SHA__ === 'dev') {
  shaEl.textContent = 'dev'
} else {
  shaEl.href = `https://github.com/ctron/csaf-visualizer/commit/${__GIT_SHA__}`
  shaEl.target = '_blank'
  shaEl.rel = 'noopener'
  shaEl.textContent = __GIT_SHA__.slice(0, 7)
  shaEl.title = __GIT_SHA__
}

history.replaceState({ tab: 'overview' }, '', '')

function loadRaw(raw: string): void {
  parseError.classList.add('d-none')
  parseError.textContent = ''

  try {
    currentModel = parseCsaf(raw)
  } catch (err) {
    parseError.textContent = err instanceof Error ? err.message : String(err)
    parseError.classList.remove('d-none')
    return
  }

  renderedTabs.clear()

  emptyState.classList.add('d-none')
  vizArea.classList.remove('d-none')
  clearBtn.classList.remove('d-none')

  docTitle.textContent = currentModel.doc.document.title

  renderCurrentTab()
}

parseBtn.addEventListener('click', () => {
  const raw = jsonInput.value.trim()
  if (!raw) return
  loadRaw(raw)
})

function buildFetchUrl(url: string, corsProxy: string): string {
  const proxy = corsProxy.trim()
  if (!proxy) return url
  return proxy + encodeURIComponent(url)
}

function fetchUrl(url: string, corsProxy: string): void {
  const fetchTarget = buildFetchUrl(url, corsProxy)
  parseError.classList.add('d-none')
  emptyState.innerHTML = '<div class="text-center text-secondary"><div class="spinner-border mb-3" role="status"></div><p>Loading document\u2026</p></div>'
  fetch(fetchTarget)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`)
      return r.text()
    })
    .then(text => {
      try {
        const json = JSON.parse(text)
        if (typeof json.contents === 'string') return json.contents
      } catch { /* not JSON wrapper, use as-is */ }
      return text
    })
    .then(text => {
      jsonInput.value = text
      loadRaw(text)
    })
    .catch(err => {
      emptyState.innerHTML = ''
      parseError.textContent = `Failed to load URL: ${err instanceof Error ? err.message : String(err)}`
      parseError.classList.remove('d-none')
    })
}

loadUrlBtn.addEventListener('click', () => {
  const url = urlInput.value.trim()
  if (!url) return
  fetchUrl(url, corsProxyInput.value)
})

const params = new URLSearchParams(window.location.search)
const urlParam = params.get('url')
const corsProxyParam = params.get('cors-proxy') ?? ''

if (urlParam) {
  urlInput.value = urlParam
  corsProxyInput.value = corsProxyParam
  document.getElementById('url-loader')!.classList.add('show')
  fetchUrl(urlParam, corsProxyParam)
}

clearBtn.addEventListener('click', () => {
  currentModel = null
  jsonInput.value = ''
  emptyState.classList.remove('d-none')
  vizArea.classList.add('d-none')
  clearBtn.classList.add('d-none')
  docTitle.textContent = ''
  parseError.classList.add('d-none')
  renderedTabs.clear()
  tabOverview.innerHTML = ''
  tabProductTree.innerHTML = ''
  tabRelationships.innerHTML = ''
  tabRelationshipTree.innerHTML = ''
})

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab!, true)
  })
})

function switchTab(tab: string, pushHistory: boolean): void {
  tabButtons.forEach(b => b.classList.remove('active'))
  const btn = [...tabButtons].find(b => b.dataset.tab === tab)
  if (btn) btn.classList.add('active')
  activeTab = tab

  document.querySelectorAll<HTMLDivElement>('.tab-pane').forEach(p => p.classList.remove('active'))

  if (pushHistory) history.pushState({ tab }, '', '')

  if (currentModel) renderCurrentTab()
}

window.addEventListener('popstate', e => {
  const tab = (e.state as { tab?: string } | null)?.tab ?? 'overview'
  switchTab(tab, false)
})

function renderCurrentTab(): void {
  if (!currentModel) return

  tabOverview.classList.remove('active')
  tabProductTree.classList.remove('active')
  tabRelationships.classList.remove('active')
  tabRelationshipTree.classList.remove('active')

  if (activeTab === 'overview') {
    tabOverview.classList.add('active')
    if (!renderedTabs.has('overview')) {
      renderOverview(tabOverview, currentModel)
      renderedTabs.add('overview')
    }
  } else if (activeTab === 'product-tree') {
    tabProductTree.classList.add('active')
    if (!renderedTabs.has('product-tree')) {
      renderProductTree(tabProductTree, currentModel)
      renderedTabs.add('product-tree')
    }
  } else if (activeTab === 'relationships') {
    tabRelationships.classList.add('active')
    if (!renderedTabs.has('relationships')) {
      renderRelationships(tabRelationships, currentModel)
      renderedTabs.add('relationships')
    }
  } else if (activeTab === 'relationship-tree') {
    tabRelationshipTree.classList.add('active')
    if (!renderedTabs.has('relationship-tree')) {
      renderRelationshipTree(tabRelationshipTree, currentModel)
      renderedTabs.add('relationship-tree')
    }
  }
}

export function navigateToRelTree(productId: string): void {
  if (!currentModel) return

  switchTab('relationship-tree', true)

  if (!renderedTabs.has('relationship-tree')) {
    renderRelationshipTree(tabRelationshipTree, currentModel)
    renderedTabs.add('relationship-tree')
  }

  requestAnimationFrame(() => highlightProductInRelTree(productId))
}

export function showProductDetail(product: FullProductName, nodeType?: string, model?: ParsedModel): void {
  const title = document.getElementById('product-detail-title')!
  const body = document.getElementById('product-detail-body')!

  title.textContent = product.name
  const vulnEntries = model?.productVulnInfo.get(product.product_id) ?? []
  body.innerHTML = renderProductDetailBody(product, nodeType, vulnEntries)

  const el = document.getElementById('product-detail')!
  if (!offcanvasInstance) {
    offcanvasInstance = new Offcanvas(el)
  }
  offcanvasInstance.show()
}

function renderProductDetailBody(product: FullProductName, nodeType?: string, vulnEntries: ProductVulnEntry[] = []): string {
  const pih = product.product_identification_helper
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  let html = `
    <div class="mb-3">
      ${nodeType ? `<span class="badge bg-secondary mb-2">${esc(nodeType.replace(/_/g, ' '))}</span>` : ''}
      ${product.product_id ? `<div class="small text-secondary mb-1">Product ID</div><code class="text-warning text-break">${esc(product.product_id)}</code>` : '<span class="text-secondary small fst-italic">Branch node — no product ID</span>'}
    </div>
  `

  if (pih && pih.purl) {
    html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Package URL (PURL)</div>
        <div class="p-2 rounded bg-body-tertiary border border-secondary font-monospace small text-break">${esc(pih.purl)}</div>
      </div>
    `
  }

  if (pih && pih.cpe) {
    html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">CPE</div>
        <div class="p-2 rounded bg-body-tertiary border border-secondary font-monospace small text-break">${esc(pih.cpe)}</div>
      </div>
    `
  }

  if (pih && pih.hashes && pih.hashes.length > 0) {
    const rows = pih.hashes.flatMap(h =>
      h.file_hashes.map(fh => `
        <tr>
          <td class="text-secondary small">${esc(h.filename)}</td>
          <td><span class="badge bg-secondary">${esc(fh.algorithm)}</span></td>
          <td class="font-monospace small text-break" style="word-break:break-all">${esc(fh.value)}</td>
        </tr>
      `)
    ).join('')
    html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Cryptographic Hashes</div>
        <table class="table table-sm table-bordered mb-0">
          <thead><tr><th>File</th><th>Algorithm</th><th>Value</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `
  }

  if (pih && pih.sbom_urls && pih.sbom_urls.length > 0) {
    html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">SBOM URLs</div>
        <ul class="list-unstyled mb-0">
          ${pih.sbom_urls.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener" class="small">${esc(u)}</a></li>`).join('')}
        </ul>
      </div>
    `
  }

  if (pih && pih.model_numbers && pih.model_numbers.length > 0) {
    html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Model Numbers</div>
        <div>${pih.model_numbers.map(m => `<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle me-1">${esc(m)}</span>`).join('')}</div>
      </div>
    `
  }

  if (pih && pih.serial_numbers && pih.serial_numbers.length > 0) {
    html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Serial Numbers</div>
        <div>${pih.serial_numbers.map(s => `<span class="badge bg-secondary me-1 font-monospace">${esc(s)}</span>`).join('')}</div>
      </div>
    `
  }

  if (pih && pih.skus && pih.skus.length > 0) {
    html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">SKUs</div>
        <div>${pih.skus.map(s => `<span class="badge bg-secondary me-1">${esc(s)}</span>`).join('')}</div>
      </div>
    `
  }

  if (pih && pih.x_generic_uris && pih.x_generic_uris.length > 0) {
    const rows = pih.x_generic_uris.map(g => `
      <tr>
        <td class="small text-secondary">${esc(g.namespace)}</td>
        <td><a href="${esc(g.uri)}" target="_blank" rel="noopener" class="small">${esc(g.uri)}</a></td>
      </tr>
    `).join('')
    html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Generic URIs</div>
        <table class="table table-sm table-bordered mb-0">
          <thead><tr><th>Namespace</th><th>URI</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `
  }

  if (vulnEntries.length > 0) {
    html += `<div class="mb-1"><div class="small text-secondary mb-2 fw-semibold">Vulnerabilities</div>`
    for (const entry of vulnEntries) {
      const v = entry.vuln
      const label = v.cve ?? v.title ?? v.ids?.[0]?.text ?? 'Unknown'
      const statusBadges = entry.statuses.map(s => {
        const color = STATUS_BADGE_COLOR[s] ?? 'secondary'
        return `<span class="badge bg-${color} me-1">${esc(s.replace(/_/g, ' '))}</span>`
      }).join('')
      html += `<div class="border border-secondary rounded p-2 mb-2">`
      html += `<div class="fw-semibold small mb-1">${esc(label)}</div>`
      html += `<div class="mb-1">${statusBadges}</div>`
      if (entry.remediations.length > 0) {
        for (const r of entry.remediations) {
          const remColor = REMEDIATION_BADGE_COLOR[r.category] ?? 'secondary'
          html += `<div class="mt-2 small">`
          html += `<span class="badge bg-${remColor} me-1">${esc(r.category.replace(/_/g, ' '))}</span>`
          html += `<span class="text-body">${esc(r.details)}</span>`
          if (r.url) html += ` <a href="${esc(r.url)}" target="_blank" rel="noopener" class="ms-1">&#x2197;</a>`
          html += `</div>`
        }
      }
      html += `</div>`
    }
    html += `</div>`
  }

  return html
}

const STATUS_BADGE_COLOR: Record<string, string> = {
  known_affected: 'danger',
  known_not_affected: 'success',
  fixed: 'success',
  first_fixed: 'success',
  first_affected: 'warning',
  last_affected: 'warning',
  recommended: 'info',
  under_investigation: 'warning',
}

const REMEDIATION_BADGE_COLOR: Record<string, string> = {
  fix_planned: 'warning',
  mitigation: 'info',
  no_fix_planned: 'danger',
  none_available: 'secondary',
  vendor_fix: 'success',
  workaround: 'warning',
}
