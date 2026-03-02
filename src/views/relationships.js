import * as d3 from 'd3';
import { relationshipLabel } from '../parser';
import { showProductDetail } from '../main';
const RELATIONSHIP_COLORS = {
    default_component_of: '#f0ad4e',
    external_component_of: '#e67e22',
    installed_on: '#5bc0de',
    installed_with: '#5cb85c',
    optional_component_of: '#9b59b6',
};
function relColor(cat) {
    return RELATIONSHIP_COLORS[cat] ?? '#adb5bd';
}
export function renderRelationships(container, model) {
    container.innerHTML = '';
    const rels = model.doc.product_tree?.relationships;
    if (!rels || rels.length === 0) {
        container.innerHTML = '<div class="p-4 text-secondary">No relationships defined in this document.</div>';
        return;
    }
    const legend = buildLegend();
    container.appendChild(legend);
    const svgWrap = document.createElement('div');
    svgWrap.style.flex = '1';
    svgWrap.style.minHeight = '0';
    svgWrap.style.position = 'relative';
    container.appendChild(svgWrap);
    const nodeMap = new Map();
    function getOrCreate(pid, product, isRelProduct = false) {
        if (!nodeMap.has(pid)) {
            const p = product ?? model.allProducts.get(pid);
            nodeMap.set(pid, { id: pid, name: p?.name ?? pid, product: p, isRelProduct });
        }
        return nodeMap.get(pid);
    }
    const links = [];
    for (const rel of rels) {
        const relNode = getOrCreate(rel.full_product_name.product_id, rel.full_product_name, true);
        const srcNode = getOrCreate(rel.product_reference);
        const tgtNode = getOrCreate(rel.relates_to_product_reference);
        links.push({ source: srcNode.id, target: relNode.id, category: rel.category });
        links.push({ source: relNode.id, target: tgtNode.id, category: rel.category });
    }
    const nodes = Array.from(nodeMap.values());
    const width = svgWrap.clientWidth || 800;
    const height = svgWrap.clientHeight || 600;
    const svg = d3.select(svgWrap)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', 'transparent');
    svg.append('defs').selectAll('marker')
        .data(Object.keys(RELATIONSHIP_COLORS))
        .enter()
        .append('marker')
        .attr('id', d => `arrow-${d}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 22)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', d => relColor(d));
    svg.append('defs').append('marker')
        .attr('id', 'arrow-default')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 22)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#adb5bd');
    const sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide(40))
        .alphaDecay(0.04)
        .on('end', () => sim.stop());
    const linkSel = svg.append('g').selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', d => relColor(d.category))
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.7)
        .attr('marker-end', d => `url(#arrow-${d.category in RELATIONSHIP_COLORS ? d.category : 'default'})`);
    const linkLabelSel = svg.append('g').selectAll('text')
        .data(links)
        .enter()
        .append('text')
        .attr('font-size', '9px')
        .attr('fill', d => relColor(d.category))
        .attr('text-anchor', 'middle')
        .text(d => relationshipLabel(d.category));
    const nodeSel = svg.append('g').selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .style('cursor', 'pointer')
        .call(d3.drag()
        .on('start', (event, d) => {
        if (!event.active)
            sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    })
        .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
    })
        .on('end', (event, d) => {
        if (!event.active)
            sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }))
        .on('click', (_evt, d) => {
        const product = d.product ?? { name: d.name, product_id: d.id };
        showProductDetail(product);
    });
    nodeSel.append('circle')
        .attr('r', d => d.isRelProduct ? 14 : 10)
        .attr('fill', d => d.isRelProduct ? '#343a40' : '#212529')
        .attr('stroke', d => d.isRelProduct ? '#f0ad4e' : '#6c757d')
        .attr('stroke-width', 2);
    nodeSel.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', d => (d.isRelProduct ? 14 : 10) + 13)
        .attr('font-size', '11px')
        .attr('fill', '#dee2e6')
        .text(d => truncate(d.name, 20))
        .append('title')
        .text(d => `${d.name}\n${d.id}`);
    nodeSel.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', d => (d.isRelProduct ? 14 : 10) + 23)
        .attr('font-size', '9px')
        .attr('fill', '#6c757d')
        .text(d => d.id);
    sim.on('tick', () => {
        linkSel
            .attr('x1', d => d.source.x ?? 0)
            .attr('y1', d => d.source.y ?? 0)
            .attr('x2', d => d.target.x ?? 0)
            .attr('y2', d => d.target.y ?? 0);
        linkLabelSel
            .attr('x', d => ((d.source.x ?? 0) + (d.target.x ?? 0)) / 2)
            .attr('y', d => ((d.source.y ?? 0) + (d.target.y ?? 0)) / 2 - 4);
        nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
    const zoom = d3.zoom()
        .scaleExtent([0.2, 4])
        .on('zoom', e => {
        svg.selectAll('g').attr('transform', e.transform.toString());
    });
    svg.call(zoom);
}
function buildLegend() {
    const div = document.createElement('div');
    div.className = 'px-3 pt-2 pb-1 d-flex flex-wrap gap-2 border-bottom border-secondary align-items-center';
    for (const [cat, color] of Object.entries(RELATIONSHIP_COLORS)) {
        const item = document.createElement('span');
        item.className = 'd-flex align-items-center gap-1 small';
        item.innerHTML = `<span style="width:24px;height:2px;background:${color};display:inline-block;"></span>${cat.replace(/_/g, ' ')}`;
        div.appendChild(item);
    }
    const hint = document.createElement('span');
    hint.className = 'ms-auto small text-secondary';
    hint.textContent = 'Drag nodes · Scroll to zoom · Click for details';
    div.appendChild(hint);
    return div;
}
function truncate(s, len) {
    return s.length > len ? s.slice(0, len - 1) + '…' : s;
}
