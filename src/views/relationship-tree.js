import * as d3 from 'd3';
import { showProductDetail } from '../main';
import { pihEntries } from '../pih';
import { labelAnchor, labelContentHeight, renderNodeLabels } from '../node-labels';
let relTreeState = null;
const RELATIONSHIP_COLORS = {
    default_component_of: '#f0ad4e',
    external_component_of: '#e67e22',
    installed_on: '#5bc0de',
    installed_with: '#5cb85c',
    optional_component_of: '#9b59b6',
};
const KIND_COLORS = {
    ancestor: '#6c757d',
    platform: '#5bc0de',
    combined: '#f0ad4e',
    component: '#5cb85c',
};
function relColor(cat) {
    return cat ? (RELATIONSHIP_COLORS[cat] ?? '#adb5bd') : '#adb5bd';
}
function getOrCreateAncestorNode(parent, ancestors, depth) {
    if (depth >= ancestors.length)
        return parent;
    const ancestor = ancestors[depth];
    parent.children = parent.children ?? [];
    let child = parent.children.find(c => c.nodeKind === 'ancestor' && c.name === ancestor.name);
    if (!child) {
        child = { name: ancestor.name, nodeKind: 'ancestor', children: [] };
        parent.children.push(child);
    }
    return getOrCreateAncestorNode(child, ancestors, depth + 1);
}
export function renderRelationshipTree(container, model) {
    container.innerHTML = '';
    const rels = model.doc.product_tree?.relationships;
    if (!rels || rels.length === 0) {
        container.innerHTML = '<div class="p-4 text-secondary">No relationships defined in this document.</div>';
        return;
    }
    const virtualRoot = { name: '__root__', nodeKind: 'ancestor', children: [] };
    for (const rel of rels) {
        const platformId = rel.relates_to_product_reference;
        const componentId = rel.product_reference;
        const combinedProduct = rel.full_product_name;
        const platformProduct = model.allProducts.get(platformId);
        const componentProduct = model.allProducts.get(componentId);
        const platformAncestors = model.productAncestors.get(platformId) ?? [];
        const ancestorParent = getOrCreateAncestorNode(virtualRoot, platformAncestors, 0);
        ancestorParent.children = ancestorParent.children ?? [];
        let platformNode = ancestorParent.children.find(c => c.nodeKind === 'platform' && c.productId === platformId);
        if (!platformNode) {
            platformNode = {
                name: platformProduct?.name ?? platformId,
                productId: platformId,
                product: platformProduct,
                nodeKind: 'platform',
                children: [],
            };
            ancestorParent.children.push(platformNode);
        }
        const combinedNode = {
            name: combinedProduct.name,
            productId: combinedProduct.product_id,
            product: combinedProduct,
            nodeKind: 'combined',
            relationCategory: rel.category,
            children: [
                {
                    name: componentProduct?.name ?? componentId,
                    productId: componentId,
                    product: componentProduct,
                    nodeKind: 'component',
                    relationCategory: rel.category,
                },
            ],
        };
        platformNode.children.push(combinedNode);
    }
    relTreeState = null;
    const legend = buildLegend();
    container.appendChild(legend);
    drawRelTree(container, virtualRoot);
}
function buildLegend() {
    const div = document.createElement('div');
    div.className = 'px-3 pt-2 pb-1 d-flex flex-wrap gap-3 border-bottom border-secondary align-items-center';
    const kindEntries = [
        [KIND_COLORS.ancestor, 'Branch ancestor'],
        [KIND_COLORS.platform, 'Platform / Host'],
        [KIND_COLORS.combined, 'Combined product (relationship)'],
        [KIND_COLORS.component, 'Component'],
    ];
    for (const [color, label] of kindEntries) {
        const item = document.createElement('span');
        item.className = 'd-flex align-items-center gap-1 small';
        item.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>${label}`;
        div.appendChild(item);
    }
    const sep = document.createElement('span');
    sep.className = 'text-secondary small';
    sep.textContent = '|';
    div.appendChild(sep);
    for (const [cat, color] of Object.entries(RELATIONSHIP_COLORS)) {
        const item = document.createElement('span');
        item.className = 'd-flex align-items-center gap-1 small';
        item.innerHTML = `<span style="width:20px;height:2px;background:${color};display:inline-block;flex-shrink:0"></span>${cat.replace(/_/g, ' ')}`;
        div.appendChild(item);
    }
    const hint = document.createElement('span');
    hint.className = 'ms-auto small text-secondary';
    hint.textContent = 'Drag to pan · Scroll to zoom · Click nodes for details';
    div.appendChild(hint);
    return div;
}
const REL_BASE_SLOT = 48;
function relContentHeight(node) {
    const kind = node.data.nodeKind;
    const isLeaf = kind === 'component';
    const pih = node.data.product?.product_identification_helper;
    const pihCount = pih ? pihEntries(pih).length : 0;
    const extraLines = kind === 'combined' ? 1 : 0;
    return labelContentHeight({
        hasProductId: !!node.data.productId && kind !== 'ancestor',
        extraLines,
        pihCount,
    }) + (isLeaf ? 0 : 4);
}
function measureDepthWidths(hierarchy) {
    const measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    measureSvg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    document.body.appendChild(measureSvg);
    const depthMaxWidth = new Map();
    hierarchy.each(n => {
        if (n.data.name === '__root__')
            return;
        const kind = n.data.nodeKind;
        const fontSize = kind === 'ancestor' ? '11px' : '12px';
        const fontWeight = kind === 'platform' ? '600' : '400';
        const texts = [n.data.name];
        if (n.data.productId && kind !== 'ancestor')
            texts.push(n.data.productId);
        if (kind === 'combined' && n.data.relationCategory)
            texts.push(n.data.relationCategory.replace(/_/g, ' '));
        let maxW = 0;
        for (const t of texts) {
            const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            el.style.fontSize = fontSize;
            el.style.fontWeight = fontWeight;
            el.textContent = t;
            measureSvg.appendChild(el);
            maxW = Math.max(maxW, el.getBBox().width);
        }
        const cur = depthMaxWidth.get(n.depth) ?? 0;
        if (maxW > cur)
            depthMaxWidth.set(n.depth, maxW);
    });
    document.body.removeChild(measureSvg);
    return depthMaxWidth;
}
function drawRelTree(container, root) {
    const hGap = 60;
    const vGap = 8;
    const hierarchy = d3.hierarchy(root);
    const depthMaxWidth = measureDepthWidths(hierarchy);
    const depthX = new Map();
    let x = 0;
    const maxDepth = Math.max(...depthMaxWidth.keys());
    for (let d = 0; d <= maxDepth; d++) {
        depthX.set(d, x);
        x += (depthMaxWidth.get(d) ?? 200) + hGap;
    }
    const treeLayout = d3.tree()
        .nodeSize([REL_BASE_SLOT + vGap, 260])
        .separation((a, b) => {
        const aH = relContentHeight(a);
        const bH = relContentHeight(b);
        const needed = (aH + bH) / 2 + vGap;
        return Math.max(1, needed / (REL_BASE_SLOT + vGap));
    });
    const pointRoot = treeLayout(hierarchy);
    pointRoot.each(n => { n.y = depthX.get(n.depth) ?? n.y; });
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
    const padding = 24;
    const lastDepthWidth = depthMaxWidth.get(maxDepth) ?? 200;
    const svgWidth = maxY - minY + lastDepthWidth + padding * 2;
    const svgHeight = maxX - minX + REL_BASE_SLOT + padding * 2;
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
    const linkGen = d3.linkHorizontal()
        .x(n => n.y)
        .y(n => n.x);
    g.selectAll('path.link')
        .data(pointRoot.links().filter(l => l.source.data.name !== '__root__'))
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', d => {
        if (d.target.data.nodeKind === 'ancestor')
            return '#495057';
        return relColor(d.target.data.relationCategory);
    })
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', d => d.target.data.nodeKind === 'component' ? '5,3' : 'none')
        .attr('d', linkGen);
    const visibleNodes = pointRoot.descendants().filter(n => n.data.name !== '__root__');
    const node = g.selectAll('g.node')
        .data(visibleNodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', n => `translate(${n.y},${n.x})`)
        .style('cursor', n => n.data.productId ? 'pointer' : 'default')
        .on('click', (_evt, n) => {
        const product = n.data.product ?? (n.data.productId ? { name: n.data.name, product_id: n.data.productId } : null);
        if (product)
            showProductDetail(product, n.data.nodeKind);
    });
    node.append('circle')
        .attr('r', n => {
        if (n.data.nodeKind === 'ancestor')
            return 5;
        if (n.data.nodeKind === 'platform')
            return 8;
        return 6;
    })
        .attr('fill', n => KIND_COLORS[n.data.nodeKind] ?? '#adb5bd')
        .attr('stroke', '#212529')
        .attr('stroke-width', 1.5);
    node.filter(n => n.data.nodeKind === 'combined').append('circle')
        .attr('r', 10)
        .attr('fill', 'none')
        .attr('stroke', n => relColor(n.data.relationCategory))
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,2');
    node.each(function (n) {
        const kind = n.data.nodeKind;
        const isLeaf = kind === 'component';
        const isTopLevel = n.parent?.data.name === '__root__';
        const anchor = labelAnchor(isLeaf, isTopLevel);
        const pih = n.data.product?.product_identification_helper;
        const entries = pih ? pihEntries(pih) : [];
        const nameColor = kind === 'ancestor'
            ? '#6c757d'
            : (n.data.product ? '#dee2e6' : '#adb5bd');
        const nameFontWeight = kind === 'platform' ? '600' : '400';
        const nameFontSize = kind === 'ancestor' ? '11px' : '12px';
        const nameTitle = `${n.data.name}${n.data.productId ? `\n${n.data.productId}` : ''}`;
        const extraLines = kind === 'combined' && n.data.relationCategory
            ? [{ text: n.data.relationCategory.replace(/_/g, ' '), color: relColor(n.data.relationCategory) }]
            : [];
        renderNodeLabels(this, {
            name: n.data.name,
            nameColor,
            nameFontSize,
            nameFontWeight,
            nameTitle,
            productId: kind !== 'ancestor' ? n.data.productId : undefined,
            extraLines,
            pihEntries: entries,
            anchor,
        });
    });
    relTreeState = { svg, zoom, nodeEls: node, containerEl: container };
}
export function highlightProductInRelTree(productId) {
    const state = relTreeState;
    if (!state)
        return;
    state.nodeEls.selectAll('circle.highlight-ring').remove();
    let found = null;
    state.nodeEls.each(function (n) {
        if (n.data.productId === productId) {
            found = n;
            const r = n.data.nodeKind === 'platform' ? 8 : 6;
            d3.select(this).append('circle')
                .attr('class', 'highlight-ring')
                .attr('r', r + 8)
                .attr('fill', 'none')
                .attr('stroke', '#ffc107')
                .attr('stroke-width', 2.5)
                .style('pointer-events', 'none');
        }
    });
    if (!found)
        return;
    const n = found;
    const containerEl = state.containerEl;
    const cw = containerEl.clientWidth || 800;
    const ch = containerEl.clientHeight || 600;
    const scale = 1.5;
    const tx = cw / 2 - n.y * scale;
    const ty = ch / 2 - n.x * scale;
    state.svg.transition().duration(600)
        .call(state.zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}
