import type { BranchAncestor, CsafDocument, FullProductName, ParsedModel, Branch, ProductStatusKey, ProductVulnEntry } from './types'

export function parseCsaf(json: string): ParsedModel {
  const doc: CsafDocument = JSON.parse(json)

  if (!doc.document) throw new Error('Missing required field: document')
  if (!doc.document.csaf_version) throw new Error('Missing required field: document.csaf_version')
  if (doc.document.csaf_version !== '2.0') {
    throw new Error(`Unsupported CSAF version: ${doc.document.csaf_version}. Only 2.0 is supported.`)
  }

  const allProducts = new Map<string, FullProductName>()
  const productAncestors = new Map<string, BranchAncestor[]>()
  const productBranchCategory = new Map<string, string>()

  if (doc.product_tree) {
    if (doc.product_tree.full_product_names) {
      for (const p of doc.product_tree.full_product_names) {
        allProducts.set(p.product_id, p)
      }
    }
    if (doc.product_tree.branches) {
      collectProductsFromBranches(doc.product_tree.branches, allProducts, productAncestors, productBranchCategory, [])
    }
    if (doc.product_tree.relationships) {
      for (const r of doc.product_tree.relationships) {
        allProducts.set(r.full_product_name.product_id, r.full_product_name)
      }
    }
  }

  const productVulnInfo = new Map<string, ProductVulnEntry[]>()

  const STATUS_KEYS: ProductStatusKey[] = [
    'known_affected', 'known_not_affected', 'fixed', 'first_fixed',
    'first_affected', 'last_affected', 'recommended', 'under_investigation',
  ]

  for (const vuln of doc.vulnerabilities ?? []) {
    const productStatuses = new Map<string, Set<ProductStatusKey>>()

    for (const key of STATUS_KEYS) {
      for (const pid of vuln.product_status?.[key] ?? []) {
        if (!productStatuses.has(pid)) productStatuses.set(pid, new Set())
        productStatuses.get(pid)!.add(key)
      }
    }

    for (const [pid, statuses] of productStatuses) {
      const remediations = (vuln.remediations ?? []).filter(
        r => r.product_ids?.includes(pid) ?? false
      )
      if (!productVulnInfo.has(pid)) productVulnInfo.set(pid, [])
      productVulnInfo.get(pid)!.push({ vuln, statuses: Array.from(statuses), remediations })
    }
  }

  return { doc, allProducts, productAncestors, productBranchCategory, productVulnInfo }
}

function collectProductsFromBranches(
  branches: Branch[],
  map: Map<string, FullProductName>,
  ancestorMap: Map<string, BranchAncestor[]>,
  categoryMap: Map<string, string>,
  path: BranchAncestor[],
): void {
  for (const branch of branches) {
    const currentPath = [...path, { name: branch.name, category: branch.category }]
    if (branch.product) {
      map.set(branch.product.product_id, branch.product)
      ancestorMap.set(branch.product.product_id, path)
      categoryMap.set(branch.product.product_id, branch.category)
    }
    if (branch.branches) {
      collectProductsFromBranches(branch.branches, map, ancestorMap, categoryMap, currentPath)
    }
  }
}

export function severityColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'CRITICAL': return 'danger'
    case 'HIGH': return 'danger'
    case 'MEDIUM': return 'warning'
    case 'LOW': return 'success'
    default: return 'secondary'
  }
}

export function relationshipLabel(category: string): string {
  return category.replace(/_/g, ' ')
}
