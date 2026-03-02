import * as d3 from 'd3';
import { severityColor } from '../parser';
import { showProductDetail, navigateToRelTree } from '../main';
const STATUS_CONFIG = [
    { key: 'known_affected', label: 'Known Affected', color: '#dc3545' },
    { key: 'known_not_affected', label: 'Known Not Affected', color: '#198754' },
    { key: 'fixed', label: 'Fixed', color: '#0dcaf0' },
    { key: 'under_investigation', label: 'Under Investigation', color: '#ffc107' },
    { key: 'first_affected', label: 'First Affected', color: '#fd7e14' },
    { key: 'last_affected', label: 'Last Affected', color: '#e85d04' },
    { key: 'first_fixed', label: 'First Fixed', color: '#20c997' },
    { key: 'recommended', label: 'Recommended', color: '#0d6efd' },
];
export function renderOverview(container, model) {
    const { doc, allProducts } = model;
    const { document: d } = doc;
    const tlpLabel = d.distribution?.tlp?.label ?? null;
    const tlpStyles = {
        WHITE: 'background:#ffffff;color:#000000;border:1px solid #adb5bd',
        CLEAR: 'background:#ffffff;color:#000000;border:1px solid #adb5bd',
        GREEN: 'background:#33cc00;color:#000000',
        AMBER: 'background:#ffc000;color:#000000',
        'AMBER+STRICT': 'background:#ffc000;color:#000000',
        RED: 'background:#cc0033;color:#ffffff',
    };
    const tlpStyle = tlpLabel ? (tlpStyles[tlpLabel] ?? 'background:#6c757d;color:#ffffff') : null;
    const tlpBadge = tlpLabel
        ? `<span class="badge ms-2" style="${tlpStyle}">${tlpLabel}</span>`
        : '';
    const vulns = doc.vulnerabilities ?? [];
    const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
    for (const v of vulns) {
        const scores = v.scores ?? [];
        const best = scores.reduce((acc, s) => {
            const b = s.cvss_v3?.baseScore ?? s.cvss_v2?.baseScore ?? 0;
            return b > acc ? b : acc;
        }, -1);
        if (best < 0) {
            severityCounts.NONE++;
        }
        else if (best >= 9.0) {
            severityCounts.CRITICAL++;
        }
        else if (best >= 7.0) {
            severityCounts.HIGH++;
        }
        else if (best >= 4.0) {
            severityCounts.MEDIUM++;
        }
        else {
            severityCounts.LOW++;
        }
    }
    const branchProducts = doc.product_tree?.branches ? countBranchProducts(doc.product_tree.branches) : 0;
    const relProducts = doc.product_tree?.relationships?.length ?? 0;
    const topLevelProducts = doc.product_tree?.full_product_names?.length ?? 0;
    const statusCounts = new Map();
    for (const cfg of STATUS_CONFIG)
        statusCounts.set(cfg.key, new Set());
    for (const v of vulns) {
        if (!v.product_status)
            continue;
        for (const cfg of STATUS_CONFIG) {
            const ids = v.product_status[cfg.key] ?? [];
            for (const id of ids)
                statusCounts.get(cfg.key).add(id);
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
            <div class="row g-2 small">
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
              <span class="text-secondary small">total</span>
            </div>
            <div class="d-flex flex-column gap-1">
              ${renderSeverityBar('Critical', severityCounts.CRITICAL, vulns.length, 'danger')}
              ${renderSeverityBar('High', severityCounts.HIGH, vulns.length, 'danger')}
              ${renderSeverityBar('Medium', severityCounts.MEDIUM, vulns.length, 'warning')}
              ${renderSeverityBar('Low', severityCounts.LOW, vulns.length, 'success')}
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
              <span class="text-secondary small">total</span>
            </div>
            <div class="d-flex flex-column gap-2 small">
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

      ${vulns.length > 0 ? renderVulnsSection(vulns, allProducts) : ''}

      ${doc.product_tree?.product_groups?.length ? renderGroupsSection(doc.product_tree.product_groups, allProducts) : ''}

      ${d.notes?.length ? renderNotesSection(d.notes) : ''}
    </div>
  `;
    container.querySelectorAll('[data-product-id]').forEach(el => {
        el.addEventListener('click', () => {
            const pid = el.dataset.productId;
            const product = allProducts.get(pid);
            if (product)
                showProductDetail(product);
        });
    });
    container.querySelectorAll('[data-rel-product-id]').forEach(el => {
        el.addEventListener('click', () => {
            navigateToRelTree(el.dataset.relProductId);
        });
        el.addEventListener('mouseenter', () => {
            const pid = el.dataset.pid;
            container.querySelectorAll(`[data-pid="${CSS.escape(pid)}"]`).forEach(b => {
                if (b !== el)
                    b.classList.add('pid-highlight');
            });
        });
        el.addEventListener('mouseleave', () => {
            container.querySelectorAll('.pid-highlight').forEach(b => b.classList.remove('pid-highlight'));
        });
    });
    container.querySelectorAll('button.expand-more').forEach(btn => {
        const pids = JSON.parse(btn.dataset.pids);
        const style = btn.dataset.style;
        const expandId = btn.dataset.expandId;
        const extra = pids.slice(3);
        let expanded = false;
        const extraBadges = extra.map(pid => {
            const p = allProducts.get(pid);
            const name = p?.name ?? pid;
            const badge = document.createElement('span');
            badge.className = `badge ${style} me-1 mb-1 cursor-pointer product-link`;
            badge.style.whiteSpace = 'normal';
            badge.style.textAlign = 'left';
            badge.dataset.productId = pid;
            badge.dataset.pid = pid;
            badge.innerHTML = formatProductName(name);
            badge.addEventListener('click', () => { navigateToRelTree(pid); });
            badge.addEventListener('mouseenter', () => {
                container.querySelectorAll(`[data-pid="${CSS.escape(pid)}"]`).forEach(b => {
                    if (b !== badge)
                        b.classList.add('pid-highlight');
                });
            });
            badge.addEventListener('mouseleave', () => {
                container.querySelectorAll('.pid-highlight').forEach(b => b.classList.remove('pid-highlight'));
            });
            badge.style.display = 'none';
            return badge;
        });
        const targetContainer = document.getElementById(expandId);
        extraBadges.forEach(b => targetContainer.insertBefore(b, btn));
        btn.addEventListener('click', () => {
            expanded = !expanded;
            extraBadges.forEach(b => { b.style.display = expanded ? '' : 'none'; });
            btn.textContent = expanded ? `− show less` : `+${extra.length} more`;
        });
    });
    renderStatusDonut(document.getElementById('status-donut-card'), statusCounts);
}
function renderSeverityBar(label, count, total, color) {
    if (count === 0)
        return '';
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
    <div>
      <div class="d-flex justify-content-between small mb-1">
        <span class="text-secondary">${label}</span>
        <span class="fw-semibold">${count}</span>
      </div>
      <div class="progress" style="height:6px">
        <div class="progress-bar bg-${color}" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}
function renderStatusDonut(cardEl, statusCounts) {
    const data = STATUS_CONFIG
        .map(cfg => ({ label: cfg.label, color: cfg.color, count: statusCounts.get(cfg.key).size }))
        .filter(d => d.count > 0);
    const total = data.reduce((s, d) => s + d.count, 0);
    if (total === 0) {
        cardEl.innerHTML = '<span class="text-secondary small">No product status data</span>';
        return;
    }
    const size = 160;
    const radius = size / 2;
    const inner = radius * 0.58;
    const svg = d3.select(cardEl)
        .append('svg')
        .attr('width', size)
        .attr('height', size)
        .attr('viewBox', `0 0 ${size} ${size}`);
    const g = svg.append('g').attr('transform', `translate(${radius},${radius})`);
    const pie = d3.pie().value(d => d.count).sort(null);
    const arc = d3.arc().innerRadius(inner).outerRadius(radius - 2);
    g.selectAll('path')
        .data(pie(data))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => d.data.color)
        .attr('stroke', 'var(--bs-body-bg)')
        .attr('stroke-width', 2)
        .append('title')
        .text(d => `${d.data.label}: ${d.data.count}`);
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.2em')
        .attr('font-size', '22px')
        .attr('font-weight', '700')
        .attr('fill', 'currentColor')
        .text(total);
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.1em')
        .attr('font-size', '9px')
        .attr('fill', 'var(--bs-secondary-color)')
        .text('entries');
    const legend = d3.select(cardEl)
        .append('div')
        .style('margin-top', '12px')
        .style('width', '100%');
    for (const item of data) {
        const row = legend.append('div')
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .style('align-items', 'center')
            .style('font-size', '11px')
            .style('margin-bottom', '3px');
        row.append('span')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '5px')
            .html(`<span style="width:9px;height:9px;border-radius:50%;background:${item.color};display:inline-block;flex-shrink:0"></span>${item.label}`);
        row.append('span')
            .style('font-weight', '600')
            .text(item.count);
    }
}
function countBranchProducts(branches) {
    let count = 0;
    for (const b of branches) {
        if (b.product)
            count++;
        if (b.branches)
            count += countBranchProducts(b.branches);
    }
    return count;
}
function renderVulnsSection(vulns, allProducts) {
    const rows = vulns.map(v => {
        const scores = v.scores ?? [];
        const bestScore = scores.reduce((acc, s) => {
            const cv3 = s.cvss_v3;
            if (cv3 && (acc === null || cv3.baseScore > acc.score)) {
                return { score: cv3.baseScore, severity: cv3.baseSeverity, vector: cv3.vectorString };
            }
            return acc;
        }, null);
        const affected = v.product_status?.known_affected ?? [];
        const fixed = v.product_status?.fixed ?? [];
        const vulnId = `vuln-${Math.random().toString(36).slice(2)}`;
        const renderBadges = (pids, style, showAll, expandId) => {
            const initial = showAll ? pids : pids.slice(0, 3);
            const badges = initial.map(pid => {
                const p = allProducts.get(pid);
                const name = p?.name ?? pid;
                return `<span class="badge ${style} me-1 mb-1 cursor-pointer product-link" style="white-space:normal;text-align:left" data-rel-product-id="${escHtml(pid)}" data-pid="${escHtml(pid)}">${formatProductName(name)}</span>`;
            }).join('');
            const more = !showAll && pids.length > 3
                ? `<button class="btn btn-link btn-sm p-0 text-secondary expand-more" data-expand-id="${expandId}" data-pids='${JSON.stringify(pids)}' data-style="${style}">+${pids.length - 3} more</button>`
                : '';
            return badges + more;
        };
        return `
      <div class="card border-secondary mb-2">
        <div class="card-body py-2 px-3">
          <div class="d-flex align-items-start gap-2 flex-wrap">
            ${v.cve ? `<code class="text-warning">${escHtml(v.cve)}</code>` : ''}
            ${v.cwe ? `<span class="badge bg-secondary">${escHtml(v.cwe.id)}</span>` : ''}
            ${bestScore ? `<span class="badge bg-${severityColor(bestScore.severity)}">${bestScore.severity} ${bestScore.score.toFixed(1)}</span>` : ''}
            <span class="flex-grow-1 fw-semibold small">${escHtml(v.title ?? v.cve ?? 'Unnamed')}</span>
          </div>
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
          ${v.remediations?.length ? `
          <div class="mt-2 row g-2">
            ${v.remediations.map(r => {
            const remPids = r.product_ids ?? [];
            const remBadges = remPids.map(pid => {
                const p = allProducts.get(pid);
                return `<span class="badge bg-secondary me-1 mb-1 cursor-pointer product-link" style="white-space:normal;text-align:left" data-rel-product-id="${escHtml(pid)}" data-pid="${escHtml(pid)}">${formatProductName(p?.name ?? pid)}</span>`;
            }).join('');
            return `
                <div class="col-12 col-md-6 col-xl-4"><div class="card border-info-subtle small h-100">
                  <div class="card-header bg-info-subtle text-info-emphasis border-info-subtle py-1 px-2 d-flex align-items-center justify-content-between gap-2">
                    <span class="fw-semibold">${escHtml(r.category.replace(/_/g, ' '))}</span>
                    ${r.url ? `<a href="${escHtml(r.url)}" target="_blank" rel="noopener" class="small text-truncate">${escHtml(r.url)}</a>` : ''}
                  </div>
                  <div class="card-body py-1 px-2">
                    ${r.details ? `<p class="text-secondary mb-1">${escHtml(r.details)}</p>` : ''}
                    ${remBadges ? `<div>${remBadges}</div>` : ''}
                  </div>
                </div></div>
              `;
        }).join('')}
          </div>` : ''}
        </div>
      </div>
    `;
    }).join('');
    return `
    <div class="col-12">
      <div class="card border-secondary">
        <div class="card-header fw-semibold">Vulnerabilities</div>
        <div class="card-body p-2">${rows}</div>
      </div>
    </div>
  `;
}
function renderGroupsSection(groups, allProducts) {
    const rows = groups.map(g => `
    <div class="mb-2">
      <div class="small fw-semibold text-secondary mb-1">${escHtml(g.group_id)}${g.summary ? ` — ${escHtml(g.summary)}` : ''}</div>
      <div>${g.product_ids.map(pid => {
        const p = allProducts.get(pid);
        return `<span class="badge bg-secondary me-1 cursor-pointer product-link" data-product-id="${escHtml(pid)}">${escHtml(p?.name ?? pid)}</span>`;
    }).join('')}</div>
    </div>
  `).join('');
    return `
    <div class="col-12">
      <div class="card border-secondary">
        <div class="card-header fw-semibold">Product Groups</div>
        <div class="card-body">${rows}</div>
      </div>
    </div>
  `;
}
function renderNotesSection(notes) {
    const items = notes.map(n => `
    <div class="mb-2">
      <div class="small fw-semibold text-secondary">${escHtml(n.title ?? n.category)}</div>
      <div class="small">${escHtml(n.text)}</div>
    </div>
  `).join('<hr class="border-secondary my-2">');
    return `
    <div class="col-12">
      <div class="card border-secondary">
        <div class="card-header fw-semibold">Notes</div>
        <div class="card-body">${items}</div>
      </div>
    </div>
  `;
}
function formatProductName(name) {
    return escHtml(name);
}
function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    catch {
        return iso;
    }
}
