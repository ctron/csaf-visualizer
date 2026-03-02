# CSAF 2.0 Visualizer

[![CI](https://github.com/ctron/csaf-visualizer/actions/workflows/deploy.yaml/badge.svg)](https://github.com/ctron/csaf-visualizer/actions/workflows/deploy.yaml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen)](https://ctron.github.io/csaf-visualizer/)
[![License](https://img.shields.io/github/license/ctron/csaf-visualizer)](LICENSE)

A browser-based visualizer for [CSAF 2.0](https://docs.oasis-open.org/csaf/csaf/v2.0/csaf-v2.0.html) (Common Security Advisory Framework) JSON documents.

## Features

- **Overview** — document metadata, vulnerability severity summary, product counts, product status donut chart, vulnerability cards with affected/fixed product badges and remediation cards
- **Product Tree** — interactive zoomable/pannable tree of the CSAF product tree with branch categories, product identification helpers (PURL, CPE, hashes, etc.)
- **Relationships** — tabular view of all product relationships
- **Relationship Tree** — interactive zoomable/pannable tree of product relationships grouped by platform and branch ancestors

### Interactions

- Click any product badge in the overview to navigate to the Relationship Tree and highlight that node
- Hover a product badge to highlight related badges across affected, fixed, and remediation sections
- Click tree nodes to open a product detail panel with full identification helper data
- Expand/collapse long product lists with the +N more toggle
- Browser back button returns to the previous tab

## Usage

Paste a CSAF 2.0 JSON document into the text area on the left and click **Parse & Visualize**.

### Loading from a URL

Click **Load from URL…** in the sidebar to expand the URL loader. Enter the document URL and optionally a CORS proxy, then click **Load**.

You can also pass these as query parameters to share a direct link:

| Parameter    | Description                                        |
|--------------|----------------------------------------------------|
| `url`        | URL of the CSAF JSON document to load              |
| `cors-proxy` | CORS proxy prefix to prepend to the URL (optional) |

The target URL is URL-encoded and appended directly to the proxy prefix, so the proxy field should end with the appropriate separator, e.g.:

* https://ctron.github.io/csaf-visualizer/?url=https://security.access.redhat.com/data/csaf/v2/vex/2024/cve-2024-0232.json&cors-proxy=https://whateverorigin.org/get?url=
* https://ctron.github.io/csaf-visualizer/?url=https://msrc.microsoft.com/csaf/vex/2025/msrc_cve-2025-40005.json&cors-proxy=https://whateverorigin.org/get?url=
* https://ctron.github.io/csaf-visualizer/?url=https://cert-portal.siemens.com/productcert/csaf/ssa-979775.json&cors-proxy=https://whateverorigin.org/get?url=
* https://ctron.github.io/csaf-visualizer/?url=https://www.se.com/.well-known/csaf/2025/sevd-2025-042-02.json&cors-proxy=https://whateverorigin.org/get?url=

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output is written to `dist/`.

## Deployment

The app is automatically deployed to GitHub Pages on every push to `main` via GitHub Actions. Enable Pages in your repository settings under **Settings → Pages → Source → GitHub Actions**.

## Tech Stack

- [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [D3.js v7](https://d3js.org/) — tree layouts, zoom, SVG rendering
- [Bootstrap 5.3](https://getbootstrap.com/) — UI components and theming
