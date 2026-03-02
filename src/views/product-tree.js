import * as d3 from 'd3';
import { showProductDetail } from '../main';
import { pihEntries } from '../pih';
import { labelAnchor, labelContentHeight, renderNodeLabels } from '../node-labels';
const BRANCH_COLORS = {
    vendor: '#f0ad4e',
    product_name: '#5bc0de',
    product_version: '#5cb85c',
    product_version_range: '#5cb85c',
    product_family: '#9b59b6',
    architecture: '#e67e22',
    language: '#1abc9c',
    patch_level: '#3498db',
    service_pack: '#2980b9',
    host_name: '#e74c3c',
    legacy: '#95a5a6',
    specification: '#34495e',
};
function getCategoryColor(category) {
    return category ? (BRANCH_COLORS[category] ?? '#adb5bd') : '#adb5bd';
}
function branchesToTree(branches) {
    return branches.map(b => ({
        name: b.name,
        category: b.category,
        product: b.product,
        children: b.branches ? branchesToTree(b.branches) : undefined,
    }));
}
export function renderProductTree(container, model) {
    container.innerHTML = '';
    const tree = model.doc.product_tree;
    if (!tree) {
        container.innerHTML = '<div class="p-4 text-secondary">No product tree in this document.</div>';
        return;
    }
    const roots = [];
    if (tree.branches) {
        roots.push(...branchesToTree(tree.branches));
    }
    if (tree.full_product_names) {
        for (const p of tree.full_product_names) {
            roots.push({ name: p.name, product: p });
        }
    }
    if (roots.length === 0) {
        container.innerHTML = '<div class="p-4 text-secondary">Product tree contains no branches or products.</div>';
        return;
    }
    const virtualRoot = { name: '__root__', children: roots };
    const legend = buildLegend();
    container.appendChild(legend);
    drawTree(container, virtualRoot);
}
function buildLegend() {
    const div = document.createElement('div');
    div.className = 'px-3 pt-2 pb-1 d-flex flex-wrap gap-2 border-bottom border-secondary';
    const categories = Object.entries(BRANCH_COLORS);
    for (const [cat, color] of categories) {
        const item = document.createElement('span');
        item.className = 'd-flex align-items-center gap-1 small';
        item.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>${cat.replace(/_/g, ' ')}`;
        div.appendChild(item);
    }
    const hint = document.createElement('span');
    hint.className = 'ms-auto small text-secondary';
    hint.textContent = 'Drag to pan · Scroll to zoom · Click nodes for details';
    div.appendChild(hint);
    return div;
}
const BASE_NODE_HEIGHT = 28;
function nodeSlotHeight(node) {
    const pih = node.data.product?.product_identification_helper;
    const pihCount = pih ? pihEntries(pih).length : 0;
    return labelContentHeight({
        hasProductId: !!node.data.product,
        extraLines: 0,
        pihCount,
    });
}
function drawTree(container, root) {
    const nodeWidth = 180;
    const hGap = 40;
    const vGap = 8;
    const hierarchy = d3.hierarchy(root);
    const treeLayout = d3.tree()
        .nodeSize([BASE_NODE_HEIGHT + vGap, nodeWidth + hGap])
        .separation((a, b) => {
        const aH = nodeSlotHeight(a);
        const bH = nodeSlotHeight(b);
        const needed = (aH + bH) / 2 + vGap;
        const base = BASE_NODE_HEIGHT + vGap;
        return needed / base;
    });
    const pointRoot = treeLayout(hierarchy);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pointRoot.each(node => {
        if (node.x < minX)
            minX = node.x;
        if (node.x > maxX)
            maxX = node.x;
        if (node.y < minY)
            minY = node.y;
        if (node.y > maxY)
            maxY = node.y;
    });
    const padding = 20;
    const svgWidth = maxY - minY + nodeWidth + padding * 2;
    const svgHeight = maxX - minX + BASE_NODE_HEIGHT + padding * 2;
    const width = container.clientWidth || 800;
    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .style('min-width', `${svgWidth}px`)
        .style('min-height', `${svgHeight}px`);
    const g = svg.append('g');
    const initialX = padding - minY + (width - svgWidth) / 2;
    const initialY = padding - minX;
    const initialTransform = d3.zoomIdentity.translate(initialX, initialY);
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', e => g.attr('transform', e.transform.toString()));
    svg.call(zoom);
    svg.call(zoom.transform, initialTransform);
    g.selectAll('path.link')
        .data(pointRoot.links().filter(l => l.source.data.name !== '__root__'))
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', '#495057')
        .attr('stroke-width', 1.5)
        .attr('d', d3.linkHorizontal()
        .x(n => n.y)
        .y(n => n.x));
    const visibleNodes = pointRoot.descendants().filter(n => n.data.name !== '__root__');
    const node = g.selectAll('g.node')
        .data(visibleNodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', n => `translate(${n.y},${n.x})`)
        .style('cursor', n => n.data.product ? 'pointer' : 'default')
        .on('click', (_evt, n) => {
        if (n.data.product)
            showProductDetail(n.data.product, n.data.category);
    });
    node.append('circle')
        .attr('r', 6)
        .attr('fill', n => getCategoryColor(n.data.category))
        .attr('stroke', '#212529')
        .attr('stroke-width', 1.5);
    node.each(function (n) {
        const isLeaf = !n.children || n.children.length === 0;
        const isTopLevel = n.parent?.data.name === '__root__';
        const anchor = labelAnchor(isLeaf, isTopLevel);
        const pih = n.data.product?.product_identification_helper;
        const entries = pih ? pihEntries(pih) : [];
        renderNodeLabels(this, {
            name: n.data.name,
            nameColor: n.data.product ? '#dee2e6' : '#adb5bd',
            nameFontWeight: n.data.product ? '500' : '400',
            nameTitle: n.data.name + (n.data.product ? ` [${n.data.product.product_id}]` : ''),
            productId: n.data.product?.product_id,
            pihEntries: entries,
            anchor,
        });
    });
}
