const SVG_NS = 'http://www.w3.org/2000/svg';
const GRID_SPACING = 150;
const GRID_MARGIN_X = 92;
const GRID_MARGIN_Y = 86;
const MEMBER_OFFSET = 12;

const state = {
  project: null,
  gridPoints: [],
  elements: [],
  placementMode: 'select',
  pendingStartPointId: null,
  selectedElementId: null,
  tableFilter: 'all',
  drag: null,
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
  return { column: 'COL', beam: 'BM', brb: 'BRB', gusset: 'GP' }[type];
}

function nextElementId(type) {
  const prefix = idPrefix(type);
  const count = state.elements.filter(element => element.type === type).length + 1;
  return `${prefix}-${String(count).padStart(3, '0')}`;
}

function nextMark(type) {
  const count = state.elements.filter(element => element.type === type).length + 1;
  return { column: `C${count}`, beam: `B${count}`, brb: `BRB-${count}`, gusset: `GP-${count}` }[type];
}

function gridPointId(xLabel, yLabel) {
  return `${xLabel}-${yLabel}`;
}

function generateGridPoints(xGridLabels, yGridLabels) {
  const points = [];
  yGridLabels.forEach((yLabel, yIndex) => {
    xGridLabels.forEach((xLabel, xIndex) => {
      points.push({
        id: gridPointId(xLabel, yLabel),
        xLabel,
        yLabel,
        x: GRID_MARGIN_X + xIndex * GRID_SPACING,
        y: GRID_MARGIN_Y + yIndex * GRID_SPACING,
      });
    });
  });
  return points;
}

function getPoint(id) {
  return state.gridPoints.find(point => point.id === id);
}

function getPointByLabels(xLabel, yLabel) {
  return state.gridPoints.find(point => point.xLabel === xLabel && point.yLabel === yLabel);
}

function verticalLabels() {
  return state.project?.yGridLabels?.length ? state.project.yGridLabels : projectLevels().slice().reverse();
}

function pointForColumnLevel(element, level) {
  const anchor = getPoint(element.gridPointId);
  if (!anchor) return null;
  return getPointByLabels(anchor.xLabel, level) || anchor;
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function projectLevels() {
  return state.project?.levels?.length ? state.project.levels : ['Level 1'];
}

function defaultLevel(preferRoof = false) {
  const levels = projectLevels();
  if (preferRoof) {
    return levels.find(level => level.toLowerCase() === 'roof') || levels[0];
  }
  return levels[0];
}

function lastLevel() {
  const levels = projectLevels();
  return levels[levels.length - 1] || levels[0];
}

function setPlacementMode(mode) {
  if (!state.project) {
    openProjectSetup();
    return;
  }
  state.placementMode = mode;
  state.pendingStartPointId = null;
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.classList.toggle('active', button.dataset.tool === mode);
  });
  render();
}

function setSelectedElement(id) {
  state.selectedElementId = id;
  render();
}

function openProjectSetup() {
  els.modal.classList.add('is-open');
  const projectNameInput = document.getElementById('projectName');
  if (projectNameInput) projectNameInput.focus();
}

function closeProjectSetup() {
  els.modal.classList.remove('is-open');
}

function updateProjectInfo() {
  if (!state.project) return;
  els.projectMeta.textContent = `${state.project.name} - frame elevation`;
  els.projectNameValue.textContent = state.project.name;
  els.xLabelsValue.textContent = state.project.xGridLabels.join(', ');
  els.yLabelsValue.textContent = state.project.yGridLabels.join(', ');
  els.levelsValue.textContent = state.project.levels.join(', ');
}

function canvasSize() {
  if (!state.project) return { width: 720, height: 500 };
  return {
    width: GRID_MARGIN_X * 2 + Math.max(1, state.project.xGridLabels.length - 1) * GRID_SPACING + 90,
    height: GRID_MARGIN_Y * 2 + Math.max(1, verticalLabels().length - 1) * GRID_SPACING + 40,
  };
}

function renderCanvas() {
  const svg = els.frameCanvas;
  svg.innerHTML = '';
  svg.onclick = () => {
    if (state.placementMode === 'select') setSelectedElement(null);
  };
  const size = canvasSize();
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  svg.setAttribute('width', size.width);
  svg.setAttribute('height', size.height);

  if (!state.project) return;

  const xLabels = state.project.xGridLabels;
  const yLabels = verticalLabels();
  const minX = GRID_MARGIN_X;
  const minY = GRID_MARGIN_Y;
  const maxX = GRID_MARGIN_X + (xLabels.length - 1) * GRID_SPACING;
  const maxY = GRID_MARGIN_Y + (yLabels.length - 1) * GRID_SPACING;

  xLabels.forEach((label, index) => {
    const x = GRID_MARGIN_X + index * GRID_SPACING;
    svg.appendChild(createSvg('line', { x1: x, y1: minY, x2: x, y2: maxY, class: 'grid-line' }));
    const text = createSvg('text', { x, y: 42, class: 'grid-label', 'text-anchor': 'middle' });
    text.textContent = label;
    svg.appendChild(text);
  });

  yLabels.forEach((label, index) => {
    const y = GRID_MARGIN_Y + index * GRID_SPACING;
    svg.appendChild(createSvg('line', { x1: minX, y1: y, x2: maxX, y2: y, class: 'grid-line' }));
    const text = createSvg('text', { x: 50, y: y + 5, class: 'grid-label', 'text-anchor': 'middle' });
    text.textContent = label;
    svg.appendChild(text);
  });

  renderElevationDimensions(svg, minX, minY, maxX, maxY);

  state.elements.forEach(element => {
    if (element.type === 'beam') renderBeam(svg, element);
    if (element.type === 'brb') renderBrb(svg, element);
    if (element.type === 'column') renderColumn(svg, element);
    if (element.type === 'gusset') renderGusset(svg, element);
  });

  state.gridPoints.forEach(point => {
    const circle = createSvg('circle', {
      cx: point.x,
      cy: point.y,
      r: state.pendingStartPointId === point.id ? 8 : 5,
      class: `grid-point${state.pendingStartPointId === point.id ? ' pending' : ''}`,
      'data-point-id': point.id,
    });
    circle.addEventListener('click', event => {
      event.stopPropagation();
      handleGridPointClick(point.id);
    });
    svg.appendChild(circle);
  });

}

function elementClass(element) {
  return state.selectedElementId === element.id ? ' selected-element' : '';
}

function attachElementEvents(node, element) {
  node.addEventListener('click', event => {
    event.stopPropagation();
    setSelectedElement(element.id);
    state.placementMode = 'select';
    state.pendingStartPointId = null;
  });
}

function appendMemberLine(group, x1, y1, x2, y2, className) {
  group.appendChild(createSvg('line', { x1, y1, x2, y2, class: `${className} member-shadow` }));
  group.appendChild(createSvg('line', { x1, y1, x2, y2, class: className }));
}

function appendRotatedRect(group, start, end, width, attrs) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return;
  const nx = -dy / length;
  const ny = dx / length;
  const half = width / 2;
  const points = [
    `${start.x + nx * half},${start.y + ny * half}`,
    `${end.x + nx * half},${end.y + ny * half}`,
    `${end.x - nx * half},${end.y - ny * half}`,
    `${start.x - nx * half},${start.y - ny * half}`,
  ].join(' ');
  group.appendChild(createSvg('polygon', { points, ...attrs }));
}

function renderBoltGroup(group, point, angle, count = 4) {
  const spacing = 11;
  const dx = Math.cos(angle) * spacing;
  const dy = Math.sin(angle) * spacing;
  for (let index = 0; index < count; index += 1) {
    const offset = index - (count - 1) / 2;
    group.appendChild(createSvg('circle', {
      cx: point.x + dx * offset,
      cy: point.y + dy * offset,
      r: 3.2,
      class: 'bolt',
    }));
  }
}

function renderElevationDimensions(svg, minX, minY, maxX, maxY) {
  const bottomY = maxY + 38;
  const rightX = maxX + 60;
  svg.appendChild(createSvg('line', { x1: minX, y1: bottomY, x2: maxX, y2: bottomY, class: 'dimension-line' }));
  svg.appendChild(createSvg('line', { x1: minX, y1: maxY + 12, x2: minX, y2: bottomY + 10, class: 'extension-line' }));
  svg.appendChild(createSvg('line', { x1: maxX, y1: maxY + 12, x2: maxX, y2: bottomY + 10, class: 'extension-line' }));
  svg.appendChild(createSvg('path', { d: `M ${minX} ${bottomY} l 9 -4 l 0 8 Z M ${maxX} ${bottomY} l -9 -4 l 0 8 Z`, class: 'dimension-arrow' }));
  const widthLabel = createSvg('text', { x: (minX + maxX) / 2, y: bottomY + 19, class: 'dimension-label', 'text-anchor': 'middle' });
  widthLabel.textContent = 'Wwp';
  svg.appendChild(widthLabel);

  svg.appendChild(createSvg('line', { x1: rightX, y1: minY, x2: rightX, y2: maxY, class: 'dimension-line' }));
  svg.appendChild(createSvg('line', { x1: maxX + 12, y1: minY, x2: rightX + 10, y2: minY, class: 'extension-line' }));
  svg.appendChild(createSvg('line', { x1: maxX + 12, y1: maxY, x2: rightX + 10, y2: maxY, class: 'extension-line' }));
  svg.appendChild(createSvg('path', { d: `M ${rightX} ${minY} l -4 9 l 8 0 Z M ${rightX} ${maxY} l -4 -9 l 8 0 Z`, class: 'dimension-arrow' }));
  const heightLabel = createSvg('text', { x: rightX + 19, y: (minY + maxY) / 2, class: 'dimension-label vertical-label', 'text-anchor': 'middle' });
  heightLabel.textContent = 'Hwp';
  svg.appendChild(heightLabel);
}

function renderColumn(svg, element) {
  const base = pointForColumnLevel(element, element.baseLevel);
  const top = pointForColumnLevel(element, element.topLevel);
  if (!base || !top) return;
  const x = base.x;
  const y1 = Math.min(base.y, top.y);
  const y2 = Math.max(base.y, top.y);
  const group = createSvg('g', { class: `element column-element${elementClass(element)}`, 'data-id': element.id });
  const web = createSvg('rect', { x: x - 5, y: y1, width: 10, height: y2 - y1, class: 'column-web' });
  const leftFlange = createSvg('rect', { x: x - 18, y: y1 - 12, width: 6, height: y2 - y1 + 24, class: 'column-flange' });
  const rightFlange = createSvg('rect', { x: x + 12, y: y1 - 12, width: 6, height: y2 - y1 + 24, class: 'column-flange' });
  group.append(web, leftFlange, rightFlange);
  const label = createSvg('text', { x: x + 24, y: y1 + 18, class: 'element-label' });
  label.textContent = element.mark;
  group.appendChild(label);
  group.addEventListener('pointerdown', event => beginColumnDrag(event, element.id));
  attachElementEvents(group, element);
  svg.appendChild(group);
}

function renderBeam(svg, element) {
  const start = getPoint(element.startGridPointId);
  const end = getPoint(element.endGridPointId);
  if (!start || !end) return;
  const group = createSvg('g', { class: `element beam-element${elementClass(element)}`, 'data-id': element.id });
  const y = start.y;
  appendMemberLine(group, start.x, y - MEMBER_OFFSET, end.x, y - MEMBER_OFFSET, 'beam-flange');
  appendMemberLine(group, start.x, y + MEMBER_OFFSET, end.x, y + MEMBER_OFFSET, 'beam-flange');
  group.appendChild(createSvg('line', { x1: start.x, y1: y, x2: end.x, y2: y, class: 'beam-web' }));
  const label = createSvg('text', {
    x: (start.x + end.x) / 2,
    y: y - 22,
    class: 'element-label',
    'text-anchor': 'middle',
  });
  label.textContent = element.mark;
  group.appendChild(label);
  attachElementEvents(group, element);
  svg.appendChild(group);
}

function renderBrb(svg, element) {
  const start = getPoint(element.startGridPointId);
  const end = getPoint(element.endGridPointId);
  if (!start || !end) return;
  const group = createSvg('g', { class: `element brb-element${elementClass(element)}`, 'data-id': element.id });
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const inset = 42;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const ux = (end.x - start.x) / length;
  const uy = (end.y - start.y) / length;
  const braceStart = { x: start.x + ux * inset, y: start.y + uy * inset };
  const braceEnd = { x: end.x - ux * inset, y: end.y - uy * inset };
  appendRotatedRect(group, braceStart, braceEnd, 24, { class: 'brb-body' });
  group.appendChild(createSvg('line', { x1: braceStart.x, y1: braceStart.y, x2: braceEnd.x, y2: braceEnd.y, class: 'brb-centerline' }));
  [start, end].forEach((point, index) => {
    const dir = index === 0 ? 1 : -1;
    const tip = { x: point.x + ux * inset * dir, y: point.y + uy * inset * dir };
    const shoulder = { x: point.x + ux * 58 * dir, y: point.y + uy * 58 * dir };
    appendRotatedRect(group, point, shoulder, 38, { class: 'gusset-sketch' });
    group.appendChild(createSvg('line', { x1: point.x, y1: point.y, x2: tip.x, y2: tip.y, class: 'brb-pin-line' }));
    renderBoltGroup(group, { x: point.x + ux * 22 * dir, y: point.y + uy * 22 * dir }, angle, 4);
  });
  const label = createSvg('text', {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2 - 10,
    class: 'brb-label',
    'text-anchor': 'middle',
  });
  label.textContent = element.mark;
  group.appendChild(label);
  attachElementEvents(group, element);
  svg.appendChild(group);
}

function renderGusset(svg, element) {
  const point = getPoint(element.attachedGridPointId);
  if (!point) return;
  const group = createSvg('g', { class: `element gusset-element${elementClass(element)}`, 'data-id': element.id });
  group.appendChild(createSvg('polygon', {
    points: `${point.x},${point.y} ${point.x + 54},${point.y} ${point.x},${point.y - 54}`,
  }));
  renderBoltGroup(group, { x: point.x + 22, y: point.y - 18 }, -0.8, Number(element.boltQuantity) || 4);
  const label = createSvg('text', { x: point.x + 12, y: point.y - 38, class: 'element-label' });
  label.textContent = element.mark;
  group.appendChild(label);
  attachElementEvents(group, element);
  svg.appendChild(group);
}

function handleGridPointClick(pointId) {
  if (state.placementMode === 'gusset') {
    const element = {
      id: nextElementId('gusset'),
      type: 'gusset',
      mark: nextMark('gusset'),
      attachedGridPointId: pointId,
      attachedToElementId: '',
      thickness: '3/4"',
      width: '18"',
      height: '24"',
      boltDiameter: '7/8"',
      boltQuantity: 6,
      notes: '',
    };
    state.elements.push(element);
    state.selectedElementId = element.id;
    return render();
  }

  if (state.placementMode === 'beam' || state.placementMode === 'brb') {
    if (!state.pendingStartPointId) {
      state.pendingStartPointId = pointId;
      return render();
    }
    if (state.pendingStartPointId === pointId) return;
    if (state.placementMode === 'beam') createBeam(state.pendingStartPointId, pointId);
    if (state.placementMode === 'brb') createBrb(state.pendingStartPointId, pointId);
    state.pendingStartPointId = null;
    state.placementMode = 'select';
    return render();
  }
}

function addColumn() {
  if (!state.project) {
    openProjectSetup();
    return;
  }
  const bottomLevel = defaultLevel();
  const xIndex = Math.floor((state.project?.xGridLabels.length || 1) / 2);
  const xLabel = state.project?.xGridLabels[xIndex];
  const point = getPointByLabels(xLabel, bottomLevel) || state.gridPoints[Math.floor(state.gridPoints.length / 2)] || state.gridPoints[0];
  if (!point) return;
  const element = {
    id: nextElementId('column'),
    type: 'column',
    mark: nextMark('column'),
    size: 'W14x45',
    gridPointId: point.id,
    baseLevel: defaultLevel(),
    topLevel: lastLevel(),
    orientation: 'strong-axis',
    notes: '',
  };
  state.elements.push(element);
  state.selectedElementId = element.id;
  state.placementMode = 'select';
  render();
}

function createBeam(startGridPointId, endGridPointId) {
  const element = {
    id: nextElementId('beam'),
    type: 'beam',
    mark: nextMark('beam'),
    size: 'W24x131',
    startGridPointId,
    endGridPointId,
    level: defaultLevel(true),
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

function beginColumnDrag(event, elementId) {
  const element = state.elements.find(item => item.id === elementId);
  if (!element || element.type !== 'column') return;
  event.preventDefault();
  event.stopPropagation();
  state.drag = { elementId };
  els.frameCanvas.setPointerCapture(event.pointerId);
}

function nearestGridPoint(svgPoint) {
  let nearest = state.gridPoints[0];
  let bestDistance = Infinity;
  state.gridPoints.forEach(point => {
    const distance = Math.hypot(point.x - svgPoint.x, point.y - svgPoint.y);
    if (distance < bestDistance) {
      nearest = point;
      bestDistance = distance;
    }
  });
  return nearest;
}

function eventToSvgPoint(event) {
  const point = els.frameCanvas.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(els.frameCanvas.getScreenCTM().inverse());
}

function handlePointerMove(event) {
  if (!state.drag) return;
  const element = state.elements.find(item => item.id === state.drag.elementId);
  if (!element || element.type !== 'column') return;
  const point = nearestGridPoint(eventToSvgPoint(event));
  element.gridPointId = point.id;
  render();
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
      <label>Grid Point<select name="gridPointId">${pointOptions(element.gridPointId)}</select></label>
      <div class="form-grid">
        <label>Base Level<select name="baseLevel">${levelOptions(element.baseLevel)}</select></label>
        <label>Top Level<select name="topLevel">${levelOptions(element.topLevel)}</select></label>
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
  if (element.type === 'column') return element.gridPointId;
  if (element.type === 'gusset') return element.attachedGridPointId;
  return `${element.startGridPointId} -> ${element.endGridPointId}`;
}

function sizeOrCoreArea(element) {
  if (element.type === 'brb') return element.coreArea || element.braceSize;
  if (element.type === 'gusset') return element.thickness;
  return element.size;
}

function levelFor(element) {
  if (element.type === 'column') return `${element.baseLevel} to ${element.topLevel}`;
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
  if (mode === 'column') els.modeHint.textContent = 'Add Column creates a draggable column that snaps to grid points.';
  if (mode === 'beam') els.modeHint.textContent = state.pendingStartPointId ? `Beam start: ${state.pendingStartPointId}. Click an end grid point.` : 'Click the start grid point for the beam.';
  if (mode === 'brb') els.modeHint.textContent = state.pendingStartPointId ? `BRB start: ${state.pendingStartPointId}. Click an end grid point.` : 'Click the start grid point for the BRB.';
  if (mode === 'gusset') els.modeHint.textContent = 'Click a grid point to attach a gusset plate.';
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
  event.preventDefault();
  const name = document.getElementById('projectName').value.trim();
  const xGridLabels = parseCsv(document.getElementById('xLabels').value);
  const levels = parseCsv(document.getElementById('levels').value);
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
  closeProjectSetup();
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
els.frameCanvas.addEventListener('pointerup', handlePointerUp);
els.frameCanvas.addEventListener('pointercancel', handlePointerUp);

openProjectSetup();
render();
