#!/usr/bin/env node

/** Downloads the CWE comprehensive view CSV from MITRE and extracts a slim ID→Name JSON lookup. */

import { createWriteStream, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { pipeline } from 'stream/promises'
import { createUnzip } from 'zlib'
import { tmpdir } from 'os'
import { join } from 'path'

const CSV_URL = 'https://cwe.mitre.org/data/csv/2000.csv.zip'
const OUTPUT = new URL('../src/cwe-names.json', import.meta.url).pathname

const zipPath = join(tmpdir(), 'cwe-2000.csv.zip')
const csvPath = join(tmpdir(), 'cwe-2000.csv')

console.log('Downloading CWE data from MITRE...')
const res = await fetch(CSV_URL)
if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
await pipeline(res.body, createWriteStream(zipPath))

console.log('Extracting...')
const { execSync } = await import('child_process')
execSync(`unzip -o "${zipPath}" -d "${tmpdir()}"`, { stdio: 'pipe' })

const csv = readFileSync(join(tmpdir(), '2000.csv'), 'utf8')
const result = {}
for (const line of csv.split('\n').slice(1)) {
  const m = line.match(/^(\d+),"([^"]*)"/)
  if (m) result[m[1]] = m[2]
}

writeFileSync(OUTPUT, JSON.stringify(result))
unlinkSync(zipPath)
unlinkSync(join(tmpdir(), '2000.csv'))

console.log(`Written ${Object.keys(result).length} CWE entries to src/cwe-names.json`)
