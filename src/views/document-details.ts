import type { ParsedModel } from '../types'

/** Renders the document details tab with references, tracking history, publisher info, and more. */
export function renderDocumentDetails(container: HTMLElement, model: ParsedModel): void {
  const d = model.doc.document
  const sections: { html: string; col: string }[] = [
    { html: renderAggregateSeverity(d.aggregate_severity), col: 'col-12 col-md-6' },
    { html: renderDistribution(d.distribution), col: 'col-12 col-md-6' },
    { html: renderPublisher(d.publisher), col: 'col-12 col-md-6' },
    { html: renderTracking(d.tracking), col: 'col-12 col-md-6' },
    { html: renderReferences(d.references ?? []), col: 'col-12' },
    { html: renderAcknowledgments(d.acknowledgments ?? []), col: 'col-12' },
  ]

  container.innerHTML = `<div class="row g-3">${sections.map(s => `<div class="${s.col}">${s.html}</div>`).join('')}</div>`
}

function renderReferences(refs: import('../types').Reference[]): string {
  const body = refs.length > 0
    ? `<table class="table table-sm mb-0">
        <thead><tr><th style="width:1%">Type</th><th>Summary</th><th>URL</th></tr></thead>
        <tbody>${refs.map(r => `
          <tr>
            <td>${r.category ? `<span class="badge ${r.category === 'self' ? 'text-bg-primary' : 'text-bg-secondary'}">${esc(r.category)}</span>` : ''}</td>
            <td>${esc(r.summary)}</td>
            <td><a href="${esc(r.url)}" target="_blank" rel="noopener" class="text-break">${esc(r.url)}</a></td>
          </tr>
        `).join('')}</tbody>
      </table>`
    : `<span class="text-secondary">None</span>`

  return `
    <div class="card border-secondary">
      <div class="card-header fw-semibold">References</div>
      <div class="card-body">${body}</div>
    </div>
  `
}

function renderTracking(tracking: import('../types').Tracking): string {
  const revisions = [...tracking.revision_history].sort((a, b) => b.date.localeCompare(a.date))

  const revRows = revisions.map(r => `
    <tr>
      <td class="text-nowrap"><code>${esc(r.number)}</code></td>
      <td class="text-nowrap">${formatDate(r.date)}</td>
      <td>${esc(r.summary)}</td>
      ${r.legacy_version ? `<td><code>${esc(r.legacy_version)}</code></td>` : '<td></td>'}
    </tr>
  `).join('')

  const aliases = tracking.aliases?.length
    ? `<div class="mt-3">
        <div class="fw-semibold text-secondary mb-1">Aliases</div>
        <div>${tracking.aliases.map(a => `<span class="badge text-bg-secondary me-1">${esc(a)}</span>`).join('')}</div>
      </div>`
    : ''

  const generator = tracking.generator
    ? `<div class="mt-3">
        <div class="fw-semibold text-secondary mb-1">Generator</div>
        <div>
          ${tracking.generator.engine ? `${esc(tracking.generator.engine.name)}${tracking.generator.engine.version ? ` <span class="text-secondary">v${esc(tracking.generator.engine.version)}</span>` : ''}` : ''}
          ${tracking.generator.date ? ` <span class="text-secondary ms-2">${formatDate(tracking.generator.date)}</span>` : ''}
        </div>
      </div>`
    : ''

  return `
    <div class="card border-secondary">
      <div class="card-header fw-semibold">Tracking</div>
      <div class="card-body">
        <div class="row g-2 mb-3">
          <div class="col-sm-6 col-lg-3">
            <span class="text-secondary">Tracking ID</span><br>
            <code>${esc(tracking.id)}</code>
          </div>
          <div class="col-sm-6 col-lg-3">
            <span class="text-secondary">Status</span><br>
            <span class="badge bg-secondary">${esc(tracking.status)}</span>
          </div>
          <div class="col-sm-6 col-lg-3">
            <span class="text-secondary">Version</span><br>
            ${esc(tracking.version)}
          </div>
          <div class="col-sm-6 col-lg-3">
            <span class="text-secondary">Initial Release</span><br>
            ${formatDate(tracking.initial_release_date)}
          </div>
          <div class="col-sm-6 col-lg-3">
            <span class="text-secondary">Current Release</span><br>
            ${formatDate(tracking.current_release_date)}
          </div>
        </div>
        ${revisions.length > 0 ? `
        <div class="fw-semibold text-secondary mb-1">Revision History</div>
        <div class="table-responsive">
          <table class="table table-sm mb-0">
            <thead><tr><th>Version</th><th>Date</th><th>Summary</th><th>Legacy</th></tr></thead>
            <tbody>${revRows}</tbody>
          </table>
        </div>` : ''}
        ${aliases}
        ${generator}
      </div>
    </div>
  `
}

function renderPublisher(publisher: import('../types').Publisher): string {
  return `
    <div class="card border-secondary">
      <div class="card-header fw-semibold">Publisher</div>
      <div class="card-body">
        <div class="row g-2">
          <div class="col-sm-6">
            <span class="text-secondary">Name</span><br>
            ${esc(publisher.name)}
          </div>
          <div class="col-sm-6">
            <span class="text-secondary">Category</span><br>
            <span class="badge bg-secondary">${esc(publisher.category)}</span>
          </div>
          <div class="col-12">
            <span class="text-secondary">Namespace</span><br>
            <a href="${esc(publisher.namespace)}" target="_blank" rel="noopener">${esc(publisher.namespace)}</a>
          </div>
        </div>
        ${publisher.contact_details ? `
        <div class="mt-3">
          <div class="fw-semibold text-secondary mb-1">Contact Details</div>
          <div>${esc(publisher.contact_details)}</div>
        </div>` : ''}
        ${publisher.issuing_authority ? `
        <div class="mt-3">
          <div class="fw-semibold text-secondary mb-1">Issuing Authority</div>
          <div>${esc(publisher.issuing_authority)}</div>
        </div>` : ''}
      </div>
    </div>
  `
}

function renderAcknowledgments(acks: import('../types').Acknowledgment[]): string {
  const body = acks.length > 0
    ? `<ul class="list-group list-group-flush">${acks.map(a => {
        const parts: string[] = []
        if (a.names?.length) parts.push(a.names.map(n => esc(n)).join(', '))
        if (a.organizations?.length) parts.push(a.organizations.map(o => `<span class="badge text-bg-secondary">${esc(o)}</span>`).join(' '))
        if (a.summary) parts.push(`<span class="text-secondary">${esc(a.summary)}</span>`)
        if (a.urls?.length) parts.push(a.urls.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join(' '))
        return `<li class="list-group-item">${parts.join(' &mdash; ')}</li>`
      }).join('')}</ul>`
    : `<div class="card-body"><span class="text-secondary">None</span></div>`

  return `
    <div class="card border-secondary">
      <div class="card-header fw-semibold">Acknowledgments</div>
      ${body}
    </div>
  `
}

function renderDistribution(dist: import('../types').Distribution | undefined): string {
  if (!dist) {
    return `
      <div class="card border-secondary">
        <div class="card-header fw-semibold">Distribution</div>
        <div class="card-body"><span class="text-secondary">None</span></div>
      </div>
    `
  }
  const parts: string[] = []
  if (dist.tlp) {
    const tlpStyles: Record<string, string> = {
      WHITE: 'background:#ffffff;color:#000000;border:1px solid #adb5bd',
      CLEAR: 'background:#ffffff;color:#000000;border:1px solid #adb5bd',
      GREEN: 'background:#33cc00;color:#000000',
      AMBER: 'background:#ffc000;color:#000000',
      'AMBER+STRICT': 'background:#ffc000;color:#000000',
      RED:   'background:#cc0033;color:#ffffff',
    }
    const style = tlpStyles[dist.tlp.label] ?? 'background:#6c757d;color:#ffffff'
    parts.push(`<div class="mb-2"><span class="badge" style="${style}">TLP:${esc(dist.tlp.label)}</span></div>`)
    if (dist.tlp.url) {
      parts.push(`<div class="mb-2"><a href="${esc(dist.tlp.url)}" target="_blank" rel="noopener">${esc(dist.tlp.url)}</a></div>`)
    }
  }
  if (dist.text) {
    parts.push(`<div>${esc(dist.text)}</div>`)
  }

  return `
    <div class="card border-secondary">
      <div class="card-header fw-semibold">Distribution</div>
      <div class="card-body">${parts.join('')}</div>
    </div>
  `
}

function renderAggregateSeverity(sev: import('../types').AggregateSeverity | undefined): string {
  const body = sev
    ? `<div class="fw-semibold">${esc(sev.text)}</div>${sev.namespace ? `<div class="text-secondary">${esc(sev.namespace)}</div>` : ''}`
    : `<span class="text-secondary">None</span>`
  return `
    <div class="card border-secondary">
      <div class="card-header fw-semibold">Aggregate Severity</div>
      <div class="card-body">${body}</div>
    </div>
  `
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}
