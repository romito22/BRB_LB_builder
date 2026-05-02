const SVG_NS = 'http://www.w3.org/2000/svg';
const FEET_PER_CANVAS = 20;
const PIXELS_PER_FOOT = 40;
const CANVAS_SPAN = FEET_PER_CANVAS * PIXELS_PER_FOOT;
const BAY_SPACING = 8 * PIXELS_PER_FOOT;
const STORY_HEIGHT = 8 * PIXELS_PER_FOOT;
const SHEET_PAD_X = 6 * PIXELS_PER_FOOT;
const SHEET_PAD_TOP = 5 * PIXELS_PER_FOOT;
const SHEET_PAD_BOTTOM = 3 * PIXELS_PER_FOOT;
const SNAP_DISTANCE = 36;

const state = {
  project: null,
  gridPoints: [],
  elements: [],
  placementMode: 'select',
  pendingStartPointId: null,
  selectedElementId: null,
  tableFilter: 'all',
  drag: null,
  pointerSvgPoint: null,
  snapPointId: null,
};

const els = {
  modal: document.getElementById('projectModal'),
  projectForm: document.getElementById('projectForm'),
  frameCanvas: document.getElementById('frameCanvas'),
  modeHint: document.getElementById('modeHint'),
  selectedBadge: document.getElementById('selectedBadge'),
  propertiesPanel: document.getElementById('propertiesPanel'),
  dataTableBody: document.getElementById('dataTableBody'),
  projectMeta: document.getElementById('projectMeta'),
  projectNameValue: document.getElementById('projectNameValue'),
  xLabelsValue: document.getElementById('xLabelsValue'),
  yLabelsValue: document.getElementById('yLabelsValue'),
  levelsValue: document.getElementById('levelsValue'),
  projectSetupBtn: document.getElementById('projectSetupBtn'),
  deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
};

function parseCsv(value) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function idPrefix(type) {
  return {
    column: 'COL',
    beam: 'BM',
    brb: 'BRB',
    gusset: 'GP',
    slab: 'SLAB',
    basePlate: 'BP',
    footing: 'FT',
    workPoint: 'WP',
  }[type];
}

function nextElementId(type) {
  const prefix = idPrefix(type);
  const count = state.elements.filter(element => element.type === type).length + 1;
  return `${prefix}-${String(count).padStart(3, '0')}`;
}

function nextMark(type) {
  const count = state.elements.filter(element => element.type === type).length + 1;
  return {
    column: `C${count}`,
    beam: `B${count}`,
    brb: `BRB-${count}`,
    gusset: `GP-${count}`,
    slab: `S-${count}`,
    basePlate: `BP-${count}`,
    footing: `FT-${count}`,
    workPoint: `WP-${count}`,
  }[type];
}

function gridPointId(xLabel, yLabel) {
  return `${xLabel}-${yLabel}`;
}

function verticalLabels() {
  return state.project?.yGridLabels?.length ? state.project.yGridLabels : projectLevels().slice().reverse();
}

function generateGridPoints(xGridLabels, yGridLabels) {
  const points = [];
  yGridLabels.forEach((yLabel, yIndex) => {
    xGridLabels.forEach((xLabel, xIndex) => {
      points.push({
        id: gridPointId(xLabel, yLabel),
        xLabel,
        yLabel,
        x: SHEET_PAD_X + xIndex * BAY_SPACING,
        y: SHEET_PAD_TOP + yIndex * STORY_HEIGHT,
      });
    });
  });
  return points;
}

function getPointById(pointId) {
  return state.gridPoints.find(point => point.id === pointId);
}

function getPointByLabels(xLabel, yLabel) {
  return state.gridPoints.find(point => point.xLabel === xLabel && point.yLabel === yLabel);
}

function projectLevels() {
  return state.project?.levels?.length ? state.project.levels : ['Level 1'];
}

function defaultLevel(preferRoof = false) {
  const levels = projectLevels();
  if (preferRoof) return levels.find(level => level.toLowerCase() === 'roof') || levels[levels.length - 1] || levels[0];
  return levels[0];
}

function lastLevel() {
  const levels = projectLevels();
  return levels[levels.length - 1] || levels[0];
}

function pointForColumnLevel(element, level) {
  const anchor = getPointById(element.gridPointId);
  if (!anchor) return null;
  return getPointByLabels(anchor.xLabel, level) || anchor;
}

function getElementStartEnd(element) {
  if (element.type === 'column') {
    if (element.startGridPointId || element.endGridPointId) {
      return [getPointById(element.startGridPointId), getPointById(element.endGridPointId)];
    }
    return [pointForColumnLevel(element, element.baseLevel), pointForColumnLevel(element, element.topLevel)];
  }
  if (element.type === 'beam' || element.type === 'brb' || element.type === 'slab') {
    return [getPointById(element.startGridPointId), getPointById(element.endGridPointId)];
  }
  const point = getPointById(element.attachedGridPointId);
  return [point, point];
}

function getMidpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function getAngle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

function getOffsetPoint(point, angle, offset) {
  return { x: point.x + Math.cos(angle) * offset, y: point.y + Math.sin(angle) * offset };
}

function getNormalOffset(p1, p2, offset) {
  const angle = getAngle(p1, p2) + Math.PI / 2;
  return { x: Math.cos(angle) * offset, y: Math.sin(angle) * offset };
}

function distanceToPoint(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function findNearestGridPoint(svgPoint, maxDistance = Infinity) {
  if (!state.gridPoints.length || !svgPoint) return null;
  let nearest = null;
  let bestDistance = Infinity;
  state.gridPoints.forEach(point => {
    const distance = distanceToPoint(point, svgPoint);
    if (distance < bestDistance) {
      nearest = point;
      bestDistance = distance;
    }
  });
  return bestDistance <= maxDistance ? nearest : null;
}

function selectedElement() {
  return state.elements.find(element => element.id === state.selectedElementId) || null;
}

function createSvg(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) element.setAttribute(key, value);
  });
  return element;
}

function append(parent, ...children) {
  children.forEach(child => child && parent.appendChild(child));
  return parent;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function drawingExtents() {
  const xLabels = state.project?.xGridLabels || ['A'];
  const yLabels = verticalLabels();
  const minX = SHEET_PAD_X;
  const minY = SHEET_PAD_TOP;
  const maxX = SHEET_PAD_X + (xLabels.length - 1) * BAY_SPACING;
  const maxY = SHEET_PAD_TOP + (yLabels.length - 1) * STORY_HEIGHT;
  return { minX, minY, maxX, maxY, xLabels, yLabels };
}

function canvasSize() {
  if (!state.project) return { width: CANVAS_SPAN, height: CANVAS_SPAN };
  return {
    width: CANVAS_SPAN,
    height: CANVAS_SPAN,
  };
}

function setPlacementMode(mode) {
  if (!state.project) {
    openProjectSetup();
    return;
  }
  state.placementMode = mode;
  state.pendingStartPointId = null;
  state.pointerSvgPoint = null;
  state.snapPointId = null;
  render();
}

function setSelectedElement(id) {
  state.selectedElementId = id;
  render();
}

function openProjectSetup() {
  els.modal.classList.add('is-open');
  document.getElementById('projectName')?.focus();
}

function closeProjectSetup() {
  els.modal.classList.remove('is-open');
}

function updateProjectInfo() {
  if (!state.project) return;
  els.projectMeta.textContent = `${state.project.name} - frame elevation`;
  els.projectNameValue.textContent = state.project.name;
  els.xLabelsValue.textContent = state.project.xGridLabels.join(', ');
  els.yLabelsValue.textContent = verticalLabels().join(', ');
  els.levelsValue.textContent = state.project.levels.join(', ');
}

function labelTag(x, y, text, anchor = 'start', className = 'label-tag') {
  const paddingX = 5;
  const width = Math.max(28, String(text).length * 7.1 + paddingX * 2);
  const height = 18;
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const group = createSvg('g', { class: className });
  append(
    group,
    createSvg('rect', { x: left, y: y - 13, width, height }),
    createSvg('text', { x: left + paddingX, y: y, class: 'element-label' }),
  );
  group.lastChild.textContent = text;
  return group;
}

function BoltPattern(point, angle, count = 4, spacing = 11) {
  const group = createSvg('g', { class: 'bolt-pattern' });
  const axis = angle + Math.PI / 2;
  for (let index = 0; index < count; index += 1) {
    const offset = index - (count - 1) / 2;
    append(group, createSvg('circle', {
      cx: point.x + Math.cos(axis) * spacing * offset,
      cy: point.y + Math.sin(axis) * spacing * offset,
      r: 3,
      class: 'bolt',
    }));
  }
  return group;
}

function Centerline(p1, p2, className = 'brb-centerline') {
  return createSvg('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: className });
}

function rotatedRect(start, end, width, className) {
  const length = distanceToPoint(start, end);
  if (!length) return null;
  const nx = -(end.y - start.y) / length;
  const ny = (end.x - start.x) / length;
  const half = width / 2;
  const points = [
    `${start.x + nx * half},${start.y + ny * half}`,
    `${end.x + nx * half},${end.y + ny * half}`,
    `${end.x - nx * half},${end.y - ny * half}`,
    `${start.x - nx * half},${start.y - ny * half}`,
  ].join(' ');
  return createSvg('polygon', { points, class: className });
}

function localPath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ') + ' Z';
}

function transformedPath(start, end, d, className) {
  const angleDeg = getAngle(start, end) * 180 / Math.PI;
  return createSvg('path', {
    d,
    class: className,
    transform: `translate(${start.x} ${start.y}) rotate(${angleDeg})`,
  });
}

function MemberStickSymbol(start, end, width, className) {
  const group = createSvg('g', { class: className });
  const normal = getNormalOffset(start, end, width / 2);
  append(group,
    createSvg('line', { x1: start.x + normal.x, y1: start.y + normal.y, x2: end.x + normal.x, y2: end.y + normal.y, class: 'member-edge' }),
    createSvg('line', { x1: start.x - normal.x, y1: start.y - normal.y, x2: end.x - normal.x, y2: end.y - normal.y, class: 'member-edge' }),
    Centerline(start, end, 'member-centerline'),
  );
  return group;
}

function DimensionLine(start, end, label, side = 'bottom') {
  const group = createSvg('g', { class: 'dimension' });
  const isVertical = side === 'right';
  append(group, createSvg('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'dimension-line' }));
  if (isVertical) {
    append(group,
      createSvg('path', { d: `M ${start.x} ${start.y} l -4 9 l 8 0 Z M ${end.x} ${end.y} l -4 -9 l 8 0 Z`, class: 'dimension-arrow' }),
      labelTag(start.x + 16, (start.y + end.y) / 2, label, 'middle'),
    );
  } else {
    append(group,
      createSvg('path', { d: `M ${start.x} ${start.y} l 9 -4 l 0 8 Z M ${end.x} ${end.y} l -9 -4 l 0 8 Z`, class: 'dimension-arrow' }),
      labelTag((start.x + end.x) / 2, start.y + 20, label, 'middle'),
    );
  }
  return group;
}

function SelectionHandles(element) {
  const [start, end] = getElementStartEnd(element);
  if (!start) return null;
  const group = createSvg('g', { class: 'selection-handles' });
  const points = element.type === 'gusset' ? [start] : [start, end].filter(Boolean);
  points.forEach(point => append(group, createSvg('circle', { cx: point.x, cy: point.y, r: 7, class: 'selection-grip' })));
  append(group, labelTag(points[0].x + 12, points[0].y - 14, `${element.mark} selected`, 'start', 'selection-tag'));
  return group;
}

function selectionOutlineFor(element) {
  const [start, end] = getElementStartEnd(element);
  if (!start) return null;
  if (element.type === 'gusset') {
    return createSvg('circle', { cx: start.x, cy: start.y, r: 56, class: 'selection-outline' });
  }
  const normal = getNormalOffset(start, end, 24);
  const points = [
    `${start.x + normal.x},${start.y + normal.y}`,
    `${end.x + normal.x},${end.y + normal.y}`,
    `${end.x - normal.x},${end.y - normal.y}`,
    `${start.x - normal.x},${start.y - normal.y}`,
  ].join(' ');
  return createSvg('polygon', { points, class: 'selection-outline' });
}

function renderCanvas() {
  const svg = els.frameCanvas;
  svg.innerHTML = '';
  svg.onclick = handleCanvasClick;
  const size = canvasSize();
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  svg.setAttribute('width', size.width);
  svg.setAttribute('height', size.height);

  if (!state.project) return;

  const { minX, minY, maxX, maxY } = drawingExtents();
  renderSheetBackground(svg, size);
  renderGrid(svg, minX, minY, maxX, maxY);
  renderDimensions(svg, minX, minY, maxX, maxY);

  state.elements.filter(element => element.type === 'beam').forEach(element => svg.appendChild(BeamSymbol(element)));
  state.elements.filter(element => element.type === 'brb').forEach(element => svg.appendChild(BRBSymbol(element)));
  state.elements.filter(element => element.type === 'column').forEach(element => svg.appendChild(ColumnSymbol(element)));
  state.elements.filter(element => element.type === 'gusset').forEach(element => svg.appendChild(GussetPlateSymbol(element)));

  renderSelection(svg);
  renderGridPoints(svg);
  renderPlacementPreview(svg);
}

function renderSheetBackground(svg, size) {
  const defs = createSvg('defs');
  const pattern = createSvg('pattern', {
    id: 'draftingGrid',
    width: 60,
    height: 60,
    patternUnits: 'userSpaceOnUse',
  });
  append(pattern,
    createSvg('path', { d: 'M 12 0 V 60 M 24 0 V 60 M 36 0 V 60 M 48 0 V 60 M 0 12 H 60 M 0 24 H 60 M 0 36 H 60 M 0 48 H 60', class: 'sheet-grid-minor' }),
    createSvg('path', { d: 'M 60 0 V 60 M 0 60 H 60', class: 'sheet-grid-major' }),
  );
  append(defs, pattern);
  append(svg, defs);
  append(svg,
    createSvg('rect', { x: 24, y: 24, width: size.width - 48, height: size.height - 48, class: 'drawing-sheet' }),
    createSvg('rect', { x: 24, y: 24, width: size.width - 48, height: size.height - 48, class: 'sheet-grid-fill' }),
  );
}

function renderGrid(svg, minX, minY, maxX, maxY) {
  verticalLabels().forEach((label, index) => {
    const y = SHEET_PAD_TOP + index * STORY_HEIGHT;
    append(svg, createSvg('line', { x1: minX - 42, y1: y, x2: maxX + 42, y2: y, class: 'grid-line' }));
    append(svg, labelTag(minX - 112, y + 4, label, 'start'));
  });

  state.project.xGridLabels.forEach((label, index) => {
    const x = SHEET_PAD_X + index * BAY_SPACING;
    append(svg, createSvg('line', { x1: x, y1: minY - 42, x2: x, y2: maxY + 42, class: 'grid-line' }));
    append(svg, createSvg('circle', { cx: x, cy: minY - 70, r: 17, class: 'grid-bubble' }));
    const topText = createSvg('text', { x, y: minY - 65, class: 'grid-label', 'text-anchor': 'middle' });
    topText.textContent = label;
    append(svg, topText, createSvg('circle', { cx: x, cy: maxY + 70, r: 17, class: 'grid-bubble' }));
    const bottomText = createSvg('text', { x, y: maxY + 75, class: 'grid-label', 'text-anchor': 'middle' });
    bottomText.textContent = label;
    append(svg, bottomText);
  });
  append(svg, createSvg('line', { x1: 52, y1: maxY + 104, x2: maxX + 116, y2: maxY + 104, class: 'sheet-title-line' }));
}

function renderDimensions(svg, minX, minY, maxX, maxY) {
  const bottomY = maxY + 116;
  const rightX = maxX + 86;
  append(svg,
    createSvg('line', { x1: minX, y1: maxY + 24, x2: minX, y2: bottomY + 10, class: 'extension-line' }),
    createSvg('line', { x1: maxX, y1: maxY + 24, x2: maxX, y2: bottomY + 10, class: 'extension-line' }),
    DimensionLine({ x: minX, y: bottomY }, { x: maxX, y: bottomY }, 'Frame Width'),
    createSvg('line', { x1: maxX + 24, y1: minY, x2: rightX + 10, y2: minY, class: 'extension-line' }),
    createSvg('line', { x1: maxX + 24, y1: maxY, x2: rightX + 10, y2: maxY, class: 'extension-line' }),
    DimensionLine({ x: rightX, y: minY }, { x: rightX, y: maxY }, 'Frame Height', 'right'),
  );
}

function renderGridPoints(svg) {
  state.gridPoints.forEach(point => {
    const isPending = state.pendingStartPointId === point.id;
    const isSnap = state.snapPointId === point.id;
    if (isSnap) append(svg, createSvg('circle', { cx: point.x, cy: point.y, r: 16, class: 'snap-halo' }));
    const circle = createSvg('circle', {
      cx: point.x,
      cy: point.y,
      r: isPending ? 8 : 4.5,
      class: `grid-point${isPending ? ' pending' : ''}`,
      'data-point-id': point.id,
    });
    circle.addEventListener('click', event => {
      event.stopPropagation();
      handleGridPointClick(point.id);
    });
    append(svg, circle);
  });
}

function renderSelection(svg) {
  const element = selectedElement();
  if (!element) return;
  append(svg, selectionOutlineFor(element), SelectionHandles(element));
}

function renderPlacementPreview(svg) {
  if (!state.pendingStartPointId || !['column', 'beam', 'brb'].includes(state.placementMode)) return;
  const start = getPointById(state.pendingStartPointId);
  if (!start) return;
  const end = state.snapPointId ? getPointById(state.snapPointId) : state.pointerSvgPoint;
  if (!end) return;
  append(svg, createSvg('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'placement-preview' }));
  const toolName = { column: 'Column', beam: 'Beam', brb: 'BRB' }[state.placementMode];
  const text = `Select end point for ${toolName}`;
  const group = createSvg('g', { class: 'instruction-banner' });
  append(group, createSvg('rect', { x: start.x + 18, y: start.y - 42, width: 188, height: 26 }));
  const label = createSvg('text', { x: start.x + 28, y: start.y - 24 });
  label.textContent = text;
  append(group, label);
  append(svg, group);
}

function elementClass(element) {
  return state.selectedElementId === element.id ? ' selected-element' : '';
}

function attachElementEvents(node, element) {
  node.addEventListener('click', event => {
    event.stopPropagation();
    if (state.placementMode === 'gusset' && element.type === 'brb') {
      const point = nearestBrbEndpoint(element, eventToSvgPoint(event));
      if (point) createGusset(point.id, element.id);
      return render();
    }
    setSelectedElement(element.id);
    state.placementMode = 'select';
    state.pendingStartPointId = null;
  });
}

function ColumnSymbol(element) {
  const [start, end] = getElementStartEnd(element);
  const group = createSvg('g', { class: `element column-element${elementClass(element)}`, 'data-id': element.id });
  if (!start || !end) return group;
  append(group, MemberStickSymbol(start, end, 24, 'column-stick'));
  const mid = getMidpoint(start, end);
  const normal = getNormalOffset(start, end, -30);
  append(group, labelTag(mid.x + normal.x, mid.y + normal.y, element.mark));
  attachElementEvents(group, element);
  return group;
}

function BeamSymbol(element) {
  const [start, end] = getElementStartEnd(element);
  const group = createSvg('g', { class: `element beam-element${elementClass(element)}`, 'data-id': element.id });
  if (!start || !end) return group;
  const y = start.y;
  append(group, MemberStickSymbol({ x: start.x, y }, { x: end.x, y }, 24, 'beam-stick'));
  append(group, labelTag((start.x + end.x) / 2, y - 24, element.mark, 'middle'));
  attachElementEvents(group, element);
  return group;
}

function BRBSymbol(element) {
  const [start, end] = getElementStartEnd(element);
  const group = createSvg('g', { class: `element brb-element${elementClass(element)}`, 'data-id': element.id });
  if (!start || !end) return group;
  const length = distanceToPoint(start, end);
  if (!length) return group;
  const angle = getAngle(start, end);
  const ux = (end.x - start.x) / length;
  const uy = (end.y - start.y) / length;
  const centerStart = { x: start.x - ux * 24, y: start.y - uy * 24 };
  const centerEnd = { x: end.x + ux * 24, y: end.y + uy * 24 };
  append(group, BrbOutline(start, end), Centerline(centerStart, centerEnd));
  renderBraceEndDetail(group, start, angle, 1);
  renderBraceEndDetail(group, end, angle + Math.PI, -1);

  const mid = getMidpoint(start, end);
  const normal = getNormalOffset(start, end, -28);
  const label = labelTag(mid.x + normal.x, mid.y + normal.y, element.mark, 'middle');
  append(group, label);
  attachElementEvents(group, element);
  return group;
}

function BrbOutline(start, end) {
  const length = Math.max(120, distanceToPoint(start, end));
  const nose = Math.min(32, length * 0.16);
  const notch = Math.min(44, length * 0.2);
  const d = [
    `M ${nose} -18`,
    `L ${length - notch} -18`,
    `L ${length - notch + 10} -29`,
    `Q ${length - 5} -38 ${length + 18} -19`,
    `Q ${length + 36} -2 ${length + 16} 18`,
    `L ${length - notch + 10} 29`,
    `L ${length - notch} 18`,
    `L ${nose} 18`,
    `L ${nose - 10} 29`,
    `Q ${-8} 38 ${-24} 19`,
    `Q ${-38} 0 ${-24} -19`,
    `Q ${-8} -38 ${nose - 10} -29`,
    'Z',
  ].join(' ');
  return transformedPath(start, end, d, 'brb-outline');
}

function renderBraceEndDetail(group, point, angle, side) {
  const plateNear = getOffsetPoint(point, angle, 10);
  const plateFar = getOffsetPoint(point, angle, 48);
  append(group,
    gussetPolygon(point, angle, 64, 38, side),
    rotatedRect(plateNear, plateFar, 18, 'connection-plate'),
    Centerline(point, plateFar, 'brb-pin-line'),
    createSvg('circle', { cx: point.x, cy: point.y, r: 5, class: 'bolt' }),
    BoltPattern(getOffsetPoint(point, angle, 30), angle, 3, 9),
  );
}

function gussetPolygon(point, angle, length = 62, depth = 42, side = 1) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy * side;
  const ny = ux * side;
  const shoulder = length * 0.48;
  const chamferX = length * 0.72;
  const midDepth = depth * 0.36;
  const points = [
    `${point.x},${point.y}`,
    `${point.x + nx * depth},${point.y + ny * depth}`,
    `${point.x + ux * shoulder + nx * depth},${point.y + uy * shoulder + ny * depth}`,
    `${point.x + ux * chamferX + nx * midDepth},${point.y + uy * chamferX + ny * midDepth}`,
    `${point.x + ux * length + nx * midDepth},${point.y + uy * length + ny * midDepth}`,
    `${point.x + ux * length},${point.y + uy * length}`,
  ].join(' ');
  return createSvg('polygon', { points, class: 'gusset-sketch' });
}

function GussetPlateSymbol(element) {
  const point = getPointById(element.attachedGridPointId);
  const group = createSvg('g', { class: `element gusset-element${elementClass(element)}`, 'data-id': element.id });
  if (!point) return group;
  const brb = state.elements.find(item => item.id === element.attachedToElementId && item.type === 'brb');
  let angle = -Math.PI / 4;
  let side = 1;
  if (brb) {
    const [start, end] = getElementStartEnd(brb);
    if (start && end) {
      angle = point.id === start.id ? getAngle(start, end) : getAngle(end, start);
      side = point.id === start.id ? 1 : -1;
    }
  }
  append(group,
    gussetPolygon(point, angle, 72, 48, side),
    Centerline(point, getOffsetPoint(point, angle, 62)),
    BoltPattern(getOffsetPoint(point, angle, 35), angle, Number(element.boltQuantity) || 6, 9),
    createSvg('circle', { cx: point.x, cy: point.y, r: 4, class: 'bolt' }),
  );
  const labelPoint = getOffsetPoint(point, angle, 32);
  append(group, labelTag(labelPoint.x + 10, labelPoint.y - 20, element.mark));
  attachElementEvents(group, element);
  return group;
}

function handleGridPointClick(pointId) {
  if (state.placementMode === 'gusset') {
    const brbHit = nearestBrbEndpoint(null, getPointById(pointId), 18);
    createGusset(pointId, brbHit?.elementId || '');
    return render();
  }
  if (state.placementMode === 'column' || state.placementMode === 'beam' || state.placementMode === 'brb') {
    if (!state.pendingStartPointId) {
      state.pendingStartPointId = pointId;
      state.snapPointId = pointId;
      return render();
    }
    if (state.pendingStartPointId === pointId) return;
    if (state.placementMode === 'column') createColumn(state.pendingStartPointId, pointId);
    if (state.placementMode === 'beam') createBeam(state.pendingStartPointId, pointId);
    if (state.placementMode === 'brb') createBrb(state.pendingStartPointId, pointId);
    state.pendingStartPointId = null;
    state.placementMode = 'select';
    return render();
  }
}

function handleCanvasClick(event) {
  if (!state.project) return;
  if (event.target.closest?.('.element')) return;
  const svgPoint = eventToSvgPoint(event);

  if (state.placementMode === 'column' || state.placementMode === 'beam' || state.placementMode === 'brb' || state.placementMode === 'gusset') {
    const nearest = findNearestGridPoint(svgPoint, SNAP_DISTANCE);
    if (nearest) handleGridPointClick(nearest.id);
    return;
  }
  if (state.placementMode === 'select') setSelectedElement(null);
}

function addColumn() {
  if (!state.project) {
    openProjectSetup();
    return;
  }
  setPlacementMode('column');
}

function createColumn(startGridPointId, endGridPointId) {
  const start = getPointById(startGridPointId);
  const end = getPointById(endGridPointId);
  const element = {
    id: nextElementId('column'),
    type: 'column',
    mark: nextMark('column'),
    size: 'W14x45',
    startGridPointId,
    endGridPointId,
    level: start?.xLabel === end?.xLabel ? `${start?.yLabel || ''} to ${end?.yLabel || ''}` : '',
    orientation: 'strong-axis',
    notes: '',
  };
  state.elements.push(element);
  state.selectedElementId = element.id;
}

function createBeam(startGridPointId, endGridPointId) {
  const start = getPointById(startGridPointId);
  const end = getPointById(endGridPointId);
  const element = {
    id: nextElementId('beam'),
    type: 'beam',
    mark: nextMark('beam'),
    size: 'W24x131',
    startGridPointId,
    endGridPointId,
    level: start?.yLabel || end?.yLabel || defaultLevel(true),
    connectionType: 'Shear',
    notes: '',
  };
  state.elements.push(element);
  state.selectedElementId = element.id;
}

function createBrb(startGridPointId, endGridPointId) {
  const element = {
    id: nextElementId('brb'),
    type: 'brb',
    mark: nextMark('brb'),
    frameName: 'BRBF-1',
    coreArea: '4.5 in2',
    braceSize: '',
    startGridPointId,
    endGridPointId,
    level: defaultLevel(),
    notes: '',
  };
  state.elements.push(element);
  state.selectedElementId = element.id;
}

function createGusset(pointId, attachedToElementId = '') {
  const element = {
    id: nextElementId('gusset'),
    type: 'gusset',
    mark: nextMark('gusset'),
    attachedGridPointId: pointId,
    attachedToElementId,
    thickness: '3/4"',
    width: '18"',
    height: '24"',
    boltDiameter: '7/8"',
    boltQuantity: 6,
    notes: '',
  };
  state.elements.push(element);
  state.selectedElementId = element.id;
  state.placementMode = 'select';
}

function nearestBrbEndpoint(brbElement, svgPoint, maxDistance = SNAP_DISTANCE) {
  const candidates = [];
  const brbs = brbElement ? [brbElement] : state.elements.filter(element => element.type === 'brb');
  brbs.forEach(brb => {
    const [start, end] = getElementStartEnd(brb);
    if (start) candidates.push({ point: start, elementId: brb.id });
    if (end) candidates.push({ point: end, elementId: brb.id });
  });
  let best = null;
  let bestDistance = Infinity;
  candidates.forEach(candidate => {
    const distance = distanceToPoint(candidate.point, svgPoint);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });
  return bestDistance <= maxDistance ? { ...best.point, elementId: best.elementId } : null;
}

function beginColumnDrag(event, elementId) {
  const element = state.elements.find(item => item.id === elementId);
  if (!element || element.type !== 'column') return;
  event.preventDefault();
  event.stopPropagation();
  state.drag = { elementId };
  els.frameCanvas.setPointerCapture(event.pointerId);
}

function eventToSvgPoint(event) {
  const point = els.frameCanvas.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(els.frameCanvas.getScreenCTM().inverse());
}

function handlePointerMove(event) {
  if (!state.project) return;
  const svgPoint = eventToSvgPoint(event);
  state.pointerSvgPoint = svgPoint;
  const snap = findNearestGridPoint(svgPoint, SNAP_DISTANCE);
  state.snapPointId = snap?.id || null;

  if (state.drag) {
    const element = state.elements.find(item => item.id === state.drag.elementId);
    if (element?.type === 'column' && !element.startGridPointId) {
      const point = findNearestGridPoint(svgPoint);
      if (point) {
        const base = getPointByLabels(point.xLabel, defaultLevel()) || point;
        element.gridPointId = base.id;
      }
    }
  }

  if (state.drag || state.pendingStartPointId || state.placementMode === 'column') renderCanvas();
}

function handlePointerLeave() {
  state.pointerSvgPoint = null;
  state.snapPointId = null;
  if (state.pendingStartPointId || state.placementMode === 'column') renderCanvas();
}

function handlePointerUp(event) {
  if (!state.drag) return;
  state.drag = null;
  try {
    els.frameCanvas.releasePointerCapture(event.pointerId);
  } catch (error) {
    // Pointer capture may already be released by the browser.
  }
  render();
}

function renderProperties() {
  const element = selectedElement();
  els.selectedBadge.textContent = element ? `${element.type.toUpperCase()} ${element.id}` : 'No element selected';

  if (!element) {
    els.propertiesPanel.className = 'panel-empty';
    els.propertiesPanel.textContent = 'No element selected';
    return;
  }

  els.propertiesPanel.className = 'property-form';
  els.propertiesPanel.innerHTML = propertiesTemplate(element);
  els.propertiesPanel.querySelectorAll('input, textarea, select').forEach(input => {
    input.addEventListener('input', () => updateElementField(element.id, input.name, input.value));
    input.addEventListener('change', () => updateElementField(element.id, input.name, input.value));
  });
}

function optionList(values, selected) {
  return values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function pointOptions(selected) {
  return optionList(state.gridPoints.map(point => point.id), selected);
}

function levelOptions(selected) {
  return optionList(projectLevels(), selected);
}

function propertiesTemplate(element) {
  const shared = `
    <div class="selection-summary"><span>${escapeHtml(element.type)}</span><strong>${escapeHtml(element.id)}</strong></div>
    <label>Mark<input name="mark" value="${escapeHtml(element.mark)}" /></label>
  `;
  const notes = `<label>Notes<textarea name="notes" rows="4">${escapeHtml(element.notes)}</textarea></label>`;
  if (element.type === 'column') {
    return `${shared}
      <label>Size<input name="size" value="${escapeHtml(element.size)}" /></label>
      <div class="form-grid">
        <label>Start<select name="startGridPointId">${pointOptions(element.startGridPointId)}</select></label>
        <label>End<select name="endGridPointId">${pointOptions(element.endGridPointId)}</select></label>
      </div>
      <label>Orientation<select name="orientation">${optionList(['strong-axis', 'weak-axis'], element.orientation)}</select></label>
      ${notes}`;
  }
  if (element.type === 'beam') {
    return `${shared}
      <label>Size<input name="size" value="${escapeHtml(element.size)}" /></label>
      <div class="form-grid">
        <label>Start<select name="startGridPointId">${pointOptions(element.startGridPointId)}</select></label>
        <label>End<select name="endGridPointId">${pointOptions(element.endGridPointId)}</select></label>
      </div>
      <label>Level<select name="level">${levelOptions(element.level)}</select></label>
      <label>Connection Type<input name="connectionType" value="${escapeHtml(element.connectionType)}" /></label>
      ${notes}`;
  }
  if (element.type === 'brb') {
    return `${shared}
      <label>Frame Name<input name="frameName" value="${escapeHtml(element.frameName)}" /></label>
      <div class="form-grid">
        <label>Core Area<input name="coreArea" value="${escapeHtml(element.coreArea)}" /></label>
        <label>Brace Size<input name="braceSize" value="${escapeHtml(element.braceSize)}" /></label>
      </div>
      <div class="form-grid">
        <label>Start<select name="startGridPointId">${pointOptions(element.startGridPointId)}</select></label>
        <label>End<select name="endGridPointId">${pointOptions(element.endGridPointId)}</select></label>
      </div>
      <label>Level<select name="level">${levelOptions(element.level)}</select></label>
      ${notes}`;
  }
  return `${shared}
    <label>Attached Grid Point<select name="attachedGridPointId">${pointOptions(element.attachedGridPointId)}</select></label>
    <label>Attached To Element ID<input name="attachedToElementId" value="${escapeHtml(element.attachedToElementId || '')}" /></label>
    <div class="form-grid">
      <label>Thickness<input name="thickness" value="${escapeHtml(element.thickness)}" /></label>
      <label>Width<input name="width" value="${escapeHtml(element.width)}" /></label>
      <label>Height<input name="height" value="${escapeHtml(element.height)}" /></label>
      <label>Bolt Dia.<input name="boltDiameter" value="${escapeHtml(element.boltDiameter)}" /></label>
    </div>
    <label>Bolt Quantity<input name="boltQuantity" type="number" value="${escapeHtml(element.boltQuantity)}" /></label>
    ${notes}`;
}

function updateElementField(id, field, value) {
  const element = state.elements.find(item => item.id === id);
  if (!element) return;
  element[field] = field === 'boltQuantity' ? Number(value) : value;
  renderCanvas();
  renderTable();
}

function locationFor(element) {
  if (element.type === 'column') return element.startGridPointId ? `${element.startGridPointId} -> ${element.endGridPointId}` : element.gridPointId;
  if (element.type === 'gusset') return element.attachedGridPointId;
  return `${element.startGridPointId} -> ${element.endGridPointId}`;
}

function sizeOrCoreArea(element) {
  if (element.type === 'brb') return element.coreArea || element.braceSize;
  if (element.type === 'gusset') return element.thickness;
  return element.size;
}

function levelFor(element) {
  if (element.type === 'column') {
    if (element.startGridPointId || element.endGridPointId) {
      const [start, end] = getElementStartEnd(element);
      return [start?.yLabel, end?.yLabel].filter(Boolean).join(' to ');
    }
    return `${element.baseLevel} to ${element.topLevel}`;
  }
  if (element.type === 'gusset') return '';
  return element.level;
}

function renderTable() {
  const filtered = state.tableFilter === 'all'
    ? state.elements
    : state.elements.filter(element => element.type === state.tableFilter);

  if (!filtered.length) {
    els.dataTableBody.innerHTML = '<tr><td colspan="7" class="empty-row">No elements created.</td></tr>';
    return;
  }

  els.dataTableBody.innerHTML = filtered.map(element => `
    <tr data-id="${escapeHtml(element.id)}" class="${state.selectedElementId === element.id ? 'selected-row' : ''}">
      <td>${escapeHtml(element.id)}</td>
      <td>${escapeHtml(element.type)}</td>
      <td>${escapeHtml(element.mark)}</td>
      <td>${escapeHtml(locationFor(element))}</td>
      <td>${escapeHtml(sizeOrCoreArea(element))}</td>
      <td>${escapeHtml(levelFor(element))}</td>
      <td>${escapeHtml(element.notes)}</td>
    </tr>
  `).join('');

  els.dataTableBody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => setSelectedElement(row.dataset.id));
  });
}

function renderModeHint() {
  const mode = state.placementMode;
  if (mode === 'select') els.modeHint.textContent = 'Select an element to edit its properties.';
  if (mode === 'column') els.modeHint.textContent = state.pendingStartPointId ? 'Select end point for Column.' : 'Click the start grid point for the column.';
  if (mode === 'beam') els.modeHint.textContent = state.pendingStartPointId ? 'Select end point for Beam.' : 'Click the start grid point for the beam.';
  if (mode === 'brb') els.modeHint.textContent = state.pendingStartPointId ? 'Select end point for BRB.' : 'Click the start grid point for the BRB.';
  if (mode === 'gusset') els.modeHint.textContent = 'Click a BRB endpoint or grid point to place a gusset plate.';
}

function render() {
  updateProjectInfo();
  renderModeHint();
  renderCanvas();
  renderProperties();
  renderTable();
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.classList.toggle('active', button.dataset.tool === state.placementMode);
  });
  document.querySelectorAll('[data-filter]').forEach(button => {
    button.classList.toggle('active', button.dataset.filter === state.tableFilter);
  });
}

function deleteSelected() {
  if (!state.selectedElementId) return;
  state.elements = state.elements.filter(element => element.id !== state.selectedElementId);
  state.selectedElementId = null;
  render();
}

function exportCsv() {
  if (!state.project) {
    openProjectSetup();
    return;
  }
  const headers = ['id', 'type', 'mark', 'location', 'sizeOrCoreArea', 'level', 'notes'];
  const rows = state.elements.map(element => [
    element.id,
    element.type,
    element.mark,
    locationFor(element),
    sizeOrCoreArea(element),
    levelFor(element),
    element.notes,
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.project?.name || 'structural-elements'}-export.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createProject(event) {
  event?.preventDefault();
  const name = document.getElementById('projectName').value.trim();
  const xGridLabels = parseCsv(document.getElementById('xLabels').value);
  const levels = parseCsv(document.getElementById('levels').value);
  setProject(name, xGridLabels, levels, false);
  closeProjectSetup();
  render();
}

function setProject(name, xGridLabels, levels, withStarterFrame = false) {
  const yGridLabels = levels.slice().reverse();
  state.project = {
    id: `PRJ-${Date.now()}`,
    name,
    xGridLabels,
    yGridLabels,
    levels,
    createdAt: new Date().toISOString(),
  };
  state.gridPoints = generateGridPoints(xGridLabels, yGridLabels);
  state.elements = [];
  state.selectedElementId = null;
  state.pendingStartPointId = null;
  state.placementMode = 'select';
  if (withStarterFrame) createStarterFrame();
}

function createStarterFrame() {
  const p = (x, y) => getPointByLabels(x, y)?.id;
  const col1Base = p('B', 'Level 1');
  const col1Top = p('B', 'Roof');
  const col2Base = p('D', 'Level 1');
  const col2Top = p('D', 'Roof');
  const roofA = p('A', 'Roof');
  const roofB = p('B', 'Roof');
  const roofC = p('C', 'Roof');
  const roofD = p('D', 'Roof');
  const level2B = p('B', 'Level 2');
  const level2C = p('C', 'Level 2');
  const level2D = p('D', 'Level 2');
  if (col1Base && col1Top) addStarterColumn(col1Base, col1Top);
  if (col2Base && col2Top) addStarterColumn(col2Base, col2Top);
  if (roofA && roofB) addStarterBeam(roofA, roofB);
  if (level2B && level2D) addStarterBeam(level2B, level2D);
  if (level2B && roofC) addStarterBrb(level2B, roofC);
  if (level2C && roofD) addStarterBrb(level2C, roofD);
  state.elements.filter(element => element.type === 'brb').forEach(brb => {
    createGusset(brb.startGridPointId, brb.id);
    createGusset(brb.endGridPointId, brb.id);
  });
  state.selectedElementId = state.elements.find(element => element.type === 'brb')?.id || state.elements[0]?.id || null;
  state.placementMode = 'select';
}

function addStarterColumn(startGridPointId, endGridPointId) {
  createColumn(startGridPointId, endGridPointId);
}

function addStarterBeam(startGridPointId, endGridPointId) {
  createBeam(startGridPointId, endGridPointId);
}

function addStarterBrb(startGridPointId, endGridPointId) {
  createBrb(startGridPointId, endGridPointId);
}

function initializeDefaultProject() {
  setProject('BRB Frame Layout', ['A', 'B'], ['1', '2'], false);
  render();
}

document.querySelectorAll('[data-tool]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.tool === 'column') return addColumn();
    setPlacementMode(button.dataset.tool);
  });
});

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    state.tableFilter = button.dataset.filter;
    render();
  });
});

els.projectForm.addEventListener('submit', createProject);
els.projectSetupBtn.addEventListener('click', openProjectSetup);
els.deleteSelectedBtn.addEventListener('click', deleteSelected);
els.exportCsvBtn.addEventListener('click', exportCsv);
els.frameCanvas.addEventListener('pointermove', handlePointerMove);
els.frameCanvas.addEventListener('pointerleave', handlePointerLeave);
els.frameCanvas.addEventListener('pointerup', handlePointerUp);
els.frameCanvas.addEventListener('pointercancel', handlePointerUp);

initializeDefaultProject();
