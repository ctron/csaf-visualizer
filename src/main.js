import 'bootstrap/dist/css/bootstrap.min.css';
import { Offcanvas } from 'bootstrap';
import './style.css';
import { parseCsaf } from './parser';
import { renderOverview } from './views/overview';
import { renderProductTree } from './views/product-tree';
import { renderRelationships } from './views/relationships';
import { renderRelationshipTree, highlightProductInRelTree } from './views/relationship-tree';
import { initTheme, toggleTheme } from './theme';
let currentModel = null;
let activeTab = 'overview';
let offcanvasInstance = null;
const renderedTabs = new Set();
const jsonInput = document.getElementById('json-input');
const parseBtn = document.getElementById('parse-btn');
const clearBtn = document.getElementById('clear-btn');
const parseError = document.getElementById('parse-error');
const emptyState = document.getElementById('empty-state');
const vizArea = document.getElementById('viz-area');
const docTitle = document.getElementById('doc-title');
const tabOverview = document.getElementById('tab-overview');
const tabProductTree = document.getElementById('tab-product-tree');
const tabRelationships = document.getElementById('tab-relationships');
const tabRelationshipTree = document.getElementById('tab-relationship-tree');
const tabButtons = document.querySelectorAll('[data-tab]');
initTheme();
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
history.replaceState({ tab: 'overview' }, '', '');
parseBtn.addEventListener('click', () => {
    const raw = jsonInput.value.trim();
    if (!raw)
        return;
    parseError.classList.add('d-none');
    parseError.textContent = '';
    try {
        currentModel = parseCsaf(raw);
    }
    catch (err) {
        parseError.textContent = err instanceof Error ? err.message : String(err);
        parseError.classList.remove('d-none');
        return;
    }
    renderedTabs.clear();
    emptyState.classList.add('d-none');
    vizArea.classList.remove('d-none');
    clearBtn.classList.remove('d-none');
    docTitle.textContent = currentModel.doc.document.title;
    renderCurrentTab();
});
clearBtn.addEventListener('click', () => {
    currentModel = null;
    jsonInput.value = '';
    emptyState.classList.remove('d-none');
    vizArea.classList.add('d-none');
    clearBtn.classList.add('d-none');
    docTitle.textContent = '';
    parseError.classList.add('d-none');
    renderedTabs.clear();
    tabOverview.innerHTML = '';
    tabProductTree.innerHTML = '';
    tabRelationships.innerHTML = '';
    tabRelationshipTree.innerHTML = '';
});
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab, true);
    });
});
function switchTab(tab, pushHistory) {
    tabButtons.forEach(b => b.classList.remove('active'));
    const btn = [...tabButtons].find(b => b.dataset.tab === tab);
    if (btn)
        btn.classList.add('active');
    activeTab = tab;
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    if (pushHistory)
        history.pushState({ tab }, '', '');
    if (currentModel)
        renderCurrentTab();
}
window.addEventListener('popstate', e => {
    const tab = e.state?.tab ?? 'overview';
    switchTab(tab, false);
});
function renderCurrentTab() {
    if (!currentModel)
        return;
    tabOverview.classList.remove('active');
    tabProductTree.classList.remove('active');
    tabRelationships.classList.remove('active');
    tabRelationshipTree.classList.remove('active');
    if (activeTab === 'overview') {
        tabOverview.classList.add('active');
        if (!renderedTabs.has('overview')) {
            renderOverview(tabOverview, currentModel);
            renderedTabs.add('overview');
        }
    }
    else if (activeTab === 'product-tree') {
        tabProductTree.classList.add('active');
        if (!renderedTabs.has('product-tree')) {
            renderProductTree(tabProductTree, currentModel);
            renderedTabs.add('product-tree');
        }
    }
    else if (activeTab === 'relationships') {
        tabRelationships.classList.add('active');
        if (!renderedTabs.has('relationships')) {
            renderRelationships(tabRelationships, currentModel);
            renderedTabs.add('relationships');
        }
    }
    else if (activeTab === 'relationship-tree') {
        tabRelationshipTree.classList.add('active');
        if (!renderedTabs.has('relationship-tree')) {
            renderRelationshipTree(tabRelationshipTree, currentModel);
            renderedTabs.add('relationship-tree');
        }
    }
}
export function navigateToRelTree(productId) {
    if (!currentModel)
        return;
    switchTab('relationship-tree', true);
    if (!renderedTabs.has('relationship-tree')) {
        renderRelationshipTree(tabRelationshipTree, currentModel);
        renderedTabs.add('relationship-tree');
    }
    requestAnimationFrame(() => highlightProductInRelTree(productId));
}
export function showProductDetail(product, nodeType) {
    const title = document.getElementById('product-detail-title');
    const body = document.getElementById('product-detail-body');
    title.textContent = product.name;
    body.innerHTML = renderProductDetailBody(product, nodeType);
    const el = document.getElementById('product-detail');
    if (!offcanvasInstance) {
        offcanvasInstance = new Offcanvas(el);
    }
    offcanvasInstance.show();
}
function renderProductDetailBody(product, nodeType) {
    const pih = product.product_identification_helper;
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let html = `
    <div class="mb-3 d-flex align-items-center gap-2">
      <div>
        <div class="small text-secondary mb-1">Product ID</div>
        <code class="text-warning">${esc(product.product_id)}</code>
      </div>
      ${nodeType ? `<span class="badge bg-secondary ms-auto">${esc(nodeType.replace(/_/g, ' '))}</span>` : ''}
    </div>
  `;
    if (!pih) {
        html += '<p class="text-secondary small">No product identification helper available.</p>';
        return html;
    }
    if (pih.purl) {
        html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Package URL (PURL)</div>
        <div class="p-2 rounded bg-body-tertiary border border-secondary font-monospace small text-break">${esc(pih.purl)}</div>
      </div>
    `;
    }
    if (pih.cpe) {
        html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">CPE</div>
        <div class="p-2 rounded bg-body-tertiary border border-secondary font-monospace small text-break">${esc(pih.cpe)}</div>
      </div>
    `;
    }
    if (pih.hashes && pih.hashes.length > 0) {
        const rows = pih.hashes.flatMap(h => h.file_hashes.map(fh => `
        <tr>
          <td class="text-secondary small">${esc(h.filename)}</td>
          <td><span class="badge bg-secondary">${esc(fh.algorithm)}</span></td>
          <td class="font-monospace small text-break" style="word-break:break-all">${esc(fh.value)}</td>
        </tr>
      `)).join('');
        html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Cryptographic Hashes</div>
        <table class="table table-sm table-bordered mb-0">
          <thead><tr><th>File</th><th>Algorithm</th><th>Value</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    }
    if (pih.sbom_urls && pih.sbom_urls.length > 0) {
        html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">SBOM URLs</div>
        <ul class="list-unstyled mb-0">
          ${pih.sbom_urls.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener" class="small">${esc(u)}</a></li>`).join('')}
        </ul>
      </div>
    `;
    }
    if (pih.model_numbers && pih.model_numbers.length > 0) {
        html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Model Numbers</div>
        <div>${pih.model_numbers.map(m => `<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle me-1">${esc(m)}</span>`).join('')}</div>
      </div>
    `;
    }
    if (pih.serial_numbers && pih.serial_numbers.length > 0) {
        html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Serial Numbers</div>
        <div>${pih.serial_numbers.map(s => `<span class="badge bg-secondary me-1 font-monospace">${esc(s)}</span>`).join('')}</div>
      </div>
    `;
    }
    if (pih.skus && pih.skus.length > 0) {
        html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">SKUs</div>
        <div>${pih.skus.map(s => `<span class="badge bg-secondary me-1">${esc(s)}</span>`).join('')}</div>
      </div>
    `;
    }
    if (pih.x_generic_uris && pih.x_generic_uris.length > 0) {
        const rows = pih.x_generic_uris.map(g => `
      <tr>
        <td class="small text-secondary">${esc(g.namespace)}</td>
        <td><a href="${esc(g.uri)}" target="_blank" rel="noopener" class="small">${esc(g.uri)}</a></td>
      </tr>
    `).join('');
        html += `
      <div class="mb-3">
        <div class="small text-secondary mb-1 fw-semibold">Generic URIs</div>
        <table class="table table-sm table-bordered mb-0">
          <thead><tr><th>Namespace</th><th>URI</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    }
    return html;
}
