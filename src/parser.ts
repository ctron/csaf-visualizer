import type { BranchAncestor, CsafDocument, FullProductName, ParsedModel, Branch } from './types'

export function parseCsaf(json: string): ParsedModel {
  const doc: CsafDocument = JSON.parse(json)

  if (!doc.document) throw new Error('Missing required field: document')
  if (!doc.document.csaf_version) throw new Error('Missing required field: document.csaf_version')
  if (doc.document.csaf_version !== '2.0') {
    throw new Error(`Unsupported CSAF version: ${doc.document.csaf_version}. Only 2.0 is supported.`)
  }

  const allProducts = new Map<string, FullProductName>()
  const productAncestors = new Map<string, BranchAncestor[]>()

  if (doc.product_tree) {
    if (doc.product_tree.full_product_names) {
      for (const p of doc.product_tree.full_product_names) {
        allProducts.set(p.product_id, p)
      }
    }
    if (doc.product_tree.branches) {
      collectProductsFromBranches(doc.product_tree.branches, allProducts, productAncestors, [])
    }
    if (doc.product_tree.relationships) {
      for (const r of doc.product_tree.relationships) {
        allProducts.set(r.full_product_name.product_id, r.full_product_name)
      }
    }
  }

  return { doc, allProducts, productAncestors }
}

function collectProductsFromBranches(
  branches: Branch[],
  map: Map<string, FullProductName>,
  ancestorMap: Map<string, BranchAncestor[]>,
  path: BranchAncestor[],
): void {
  for (const branch of branches) {
    const currentPath = [...path, { name: branch.name, category: branch.category }]
    if (branch.product) {
      map.set(branch.product.product_id, branch.product)
      ancestorMap.set(branch.product.product_id, path)
    }
    if (branch.branches) {
      collectProductsFromBranches(branch.branches, map, ancestorMap, currentPath)
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
