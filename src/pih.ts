import type { ProductIdentificationHelper } from './types'

export interface PihEntry {
  kind: string
  value: string
}

export function pihEntries(pih: ProductIdentificationHelper): PihEntry[] {
  const entries: PihEntry[] = []
  if (pih.purl) entries.push({ kind: 'purl', value: pih.purl })
  if (pih.cpe) entries.push({ kind: 'cpe', value: pih.cpe })
  for (const m of pih.model_numbers ?? []) entries.push({ kind: 'model', value: m })
  for (const s of pih.serial_numbers ?? []) entries.push({ kind: 'serial', value: s })
  for (const s of pih.skus ?? []) entries.push({ kind: 'sku', value: s })
  for (const h of pih.hashes ?? []) {
    for (const fh of h.file_hashes) {
      entries.push({ kind: fh.algorithm.toLowerCase(), value: `${h.filename}: ${fh.value}` })
    }
  }
  for (const u of pih.sbom_urls ?? []) entries.push({ kind: 'sbom', value: u })
  for (const g of pih.x_generic_uris ?? []) entries.push({ kind: 'uri', value: g.uri })
  return entries
}
