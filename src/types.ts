export interface CsafDocument {
  document: DocumentMeta
  product_tree?: ProductTree
  vulnerabilities?: Vulnerability[]
}

export interface DocumentMeta {
  title: string
  category: string
  csaf_version: string
  distribution?: Distribution
  publisher: Publisher
  references?: Reference[]
  tracking: Tracking
  notes?: Note[]
  acknowledgments?: Acknowledgment[]
  aggregate_severity?: AggregateSeverity
  lang?: string
  source_lang?: string
}

export interface Distribution {
  tlp?: { label: string; url?: string }
  text?: string
}

export interface Publisher {
  name: string
  namespace: string
  category: string
  contact_details?: string
  issuing_authority?: string
}

export interface Reference {
  category?: 'self' | 'external'
  summary: string
  url: string
}

export interface Tracking {
  id: string
  status: string
  version: string
  initial_release_date: string
  current_release_date: string
  revision_history: RevisionEntry[]
  generator?: Generator
  aliases?: string[]
}

export interface RevisionEntry {
  number: string
  date: string
  summary: string
  legacy_version?: string
}

export interface Generator {
  date?: string
  engine?: { name: string; version?: string }
}

export interface Note {
  category: string
  text: string
  title?: string
  audience?: string
}

export interface Acknowledgment {
  names?: string[]
  organizations?: string[]
  summary?: string
  urls?: string[]
}

export interface AggregateSeverity {
  text: string
  namespace?: string
}

export interface ProductTree {
  branches?: Branch[]
  full_product_names?: FullProductName[]
  relationships?: Relationship[]
  product_groups?: ProductGroup[]
}

export interface Branch {
  category: BranchCategory
  name: string
  branches?: Branch[]
  product?: FullProductName
}

export type BranchCategory =
  | 'architecture'
  | 'host_name'
  | 'language'
  | 'legacy'
  | 'patch_level'
  | 'product_family'
  | 'product_name'
  | 'product_version'
  | 'product_version_range'
  | 'service_pack'
  | 'specification'
  | 'vendor'

export interface FullProductName {
  name: string
  product_id: string
  product_identification_helper?: ProductIdentificationHelper
}

export interface ProductIdentificationHelper {
  cpe?: string
  purl?: string
  hashes?: Hash[]
  sbom_urls?: string[]
  model_numbers?: string[]
  serial_numbers?: string[]
  skus?: string[]
  x_generic_uris?: GenericUri[]
}

export interface Hash {
  file_hashes: FileHash[]
  filename: string
}

export interface FileHash {
  algorithm: string
  value: string
}

export interface GenericUri {
  namespace: string
  uri: string
}

export interface Relationship {
  category: RelationshipCategory
  full_product_name: FullProductName
  product_reference: string
  relates_to_product_reference: string
}

export type RelationshipCategory =
  | 'default_component_of'
  | 'external_component_of'
  | 'installed_on'
  | 'installed_with'
  | 'optional_component_of'

export interface ProductGroup {
  group_id: string
  product_ids: string[]
  summary?: string
}

export interface Vulnerability {
  cve?: string
  cwe?: Cwe
  title?: string
  notes?: Note[]
  references?: Reference[]
  acknowledgments?: Acknowledgment[]
  discovery_date?: string
  release_date?: string
  ids?: VulnId[]
  scores?: Score[]
  flags?: Flag[]
  threats?: Threat[]
  remediations?: Remediation[]
  product_status?: ProductStatus
  involvements?: Involvement[]
}

export interface Cwe {
  id: string
  name: string
}

export interface VulnId {
  system_name: string
  text: string
}

export interface Score {
  products: string[]
  cvss_v2?: CvssV2
  cvss_v3?: CvssV3
}

export interface CvssV2 {
  version: string
  vectorString: string
  baseScore: number
  baseSeverity?: string
  [key: string]: unknown
}

export interface CvssV3 {
  version: string
  vectorString: string
  baseScore: number
  baseSeverity: string
  [key: string]: unknown
}

export interface Flag {
  date?: string
  group_ids?: string[]
  label: string
  product_ids?: string[]
}

export interface Threat {
  category: string
  details: string
  date?: string
  group_ids?: string[]
  product_ids?: string[]
}

export interface Remediation {
  category: string
  details: string
  date?: string
  entitlements?: string[]
  group_ids?: string[]
  product_ids?: string[]
  restart_required?: { category: string; details?: string }
  url?: string
}

export interface ProductStatus {
  first_affected?: string[]
  first_fixed?: string[]
  fixed?: string[]
  known_affected?: string[]
  known_not_affected?: string[]
  last_affected?: string[]
  recommended?: string[]
  under_investigation?: string[]
}

export interface Involvement {
  party: string
  status: string
  date?: string
  summary?: string
}

export interface BranchAncestor {
  name: string
  category: string
}

export interface ParsedModel {
  doc: CsafDocument
  allProducts: Map<string, FullProductName>
  productAncestors: Map<string, BranchAncestor[]>
}
