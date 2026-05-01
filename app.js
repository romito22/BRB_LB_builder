const SVG_NS = 'http://www.w3.org/2000/svg';

const state = {
  projectName: '',
  xLabels: [],
  yLabels: [],
  points: {},
  columns: [],
  selectedKey: null,
  activeTool: 'column',
};

const modal = document.getElementById('projectModal');
const projectForm = document.getElementById('projectForm');
const cancelProjectBtn = document.getElementById('cancelProjectBtn');
const newProjectBtn = document.getElementById('newProjectBtn');
const columnToolBtn = document.getElementById('columnToolBtn');
const sidebarColumnTool = document.getElementById('sidebarColumnTool');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const frameCanvas = document.getElementById('frameCanvas');
const emptyState = document.getElementById('emptyState');
const canvasSubtitle = document.getElementById('canvasSubtitle');
const selectedBadge = document.getElementById('selectedBadge');
const propertiesEmpty = document.getElementById('propertiesEmpty');
const columnForm = document.getElementById('columnForm');
const selectedLocation = document.getElementById('selectedLocation');
const dataTableBody = document.getElementById('dataTableBody');
const deleteColumnBtn = document.getElementById('deleteColumnBtn');
const columnCount = document.getElementById('columnCount');

const projectNameValue = document.getElementById('projectNameValue');
const xLabelsValue = document.getElementById('xLabelsValue');
const yLabelsValue = document.getElementById('yLabelsValue');

const columnInputs = {
  mark: document.getElementById('colMark'),
  size: document.getElementById('colSize'),
  baseLevel: document.getElementById('colBaseLevel'),
  topLevel: document.getElementById('colTopLevel'),
  notes: document.getElementById('colNotes'),
};

function parseLabels(raw) {
  return raw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function pointKey(xLabel, yLabel) {
  return `${xLabel}__${yLabel}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function renderProjectInfo() {
  projectNameValue.textContent = state.projectName || 'Not set';
  xLabelsValue.textContent = state.xLabels.join(', ') || '-';
  yLabelsValue.textContent = state.yLabels.join(', ') || '-';
  columnCount.textContent = String(state.columns.length);
  canvasSubtitle.textContent = state.projectName
    ? `${state.xLabels.length} x ${state.yLabels.length} grid`
    : 'Create a project to render the grid.';
}

function ensurePoints() {
  state.yLabels.forEach(yLabel => {
    state.xLabels.forEach(xLabel => {
      const key = pointKey(xLabel, yLabel);
      if (!state.points[key]) {
        state.points[key] = { key, xLabel, yLabel, columnId: null };
      }
    });
  });
}

function getExistingColumnAtSelectedPoint() {
  if (!state.selectedKey) return null;
  const point = state.points[state.selectedKey];
  return state.columns.find(column => column.id === point?.columnId) || null;
}

function getCanvasMetrics() {
  const xCount = Math.max(state.xLabels.length - 1, 1);
  const yCount = Math.max(state.yLabels.length - 1, 1);
  const spacingX = 120;
  const spacingY = 95;
  const paddingLeft = 76;
  const paddingTop = 54;
  const paddingRight = 46;
  const paddingBottom = 52;

  return {
    spacingX,
    spacingY,
    paddingLeft,
    paddingTop,
    width: paddingLeft + xCount * spacingX + paddingRight,
    height: paddingTop + yCount * spacingY + paddingBottom,
  };
}

function pointPosition(xIndex, yIndex, metrics) {
  return {
    x: metrics.paddingLeft + xIndex * metrics.spacingX,
    y: metrics.paddingTop + yIndex * metrics.spacingY,
  };
}

function renderGrid() {
  frameCanvas.innerHTML = '';

  if (!state.xLabels.length || !state.yLabels.length) {
    emptyState.classList.remove('hidden');
    frameCanvas.classList.add('hidden');
    selectedBadge.textContent = 'No point selected';
    return;
  }

  ensurePoints();
  emptyState.classList.add('hidden');
  frameCanvas.classList.remove('hidden');

  const metrics = getCanvasMetrics();
  frameCanvas.setAttribute('viewBox', `0 0 ${metrics.width} ${metrics.height}`);
  frameCanvas.setAttribute('width', metrics.width);
  frameCanvas.setAttribute('height', metrics.height);

  const gridLayer = createSvgElement('g', { class: 'grid-layer' });
  const pointLayer = createSvgElement('g', { class: 'point-layer' });
  const columnLayer = createSvgElement('g', { class: 'column-layer' });
  const labelLayer = createSvgElement('g', { class: 'label-layer' });

  state.xLabels.forEach((xLabel, xIndex) => {
    const top = pointPosition(xIndex, 0, metrics);
    const bottom = pointPosition(xIndex, state.yLabels.length - 1, metrics);
    gridLayer.appendChild(createSvgElement('line', {
      x1: top.x,
      y1: top.y,
      x2: bottom.x,
      y2: bottom.y,
      class: 'grid-line',
    }));

    const label = createSvgElement('text', {
      x: top.x,
      y: 24,
      class: 'axis-label',
      'text-anchor': 'middle',
    });
    label.textContent = xLabel;
    labelLayer.appendChild(label);
  });

  state.yLabels.forEach((yLabel, yIndex) => {
    const left = pointPosition(0, yIndex, metrics);
    const right = pointPosition(state.xLabels.length - 1, yIndex, metrics);
    gridLayer.appendChild(createSvgElement('line', {
      x1: left.x,
      y1: left.y,
      x2: right.x,
      y2: right.y,
      class: 'grid-line',
    }));

    const label = createSvgElement('text', {
      x: 28,
      y: left.y + 4,
      class: 'axis-label',
      'text-anchor': 'middle',
    });
    label.textContent = yLabel;
    labelLayer.appendChild(label);
  });

  state.columns.forEach(column => {
    const xIndex = state.xLabels.indexOf(column.xLabel);
    const yIndex = state.yLabels.indexOf(column.yLabel);
    if (xIndex === -1 || yIndex === -1) return;
    const { x, y } = pointPosition(xIndex, yIndex, metrics);
    const group = createSvgElement('g', {
      class: `column-symbol${state.points[state.selectedKey]?.columnId === column.id ? ' selected-column' : ''}`,
      'data-column-id': column.id,
    });
    group.appendChild(createSvgElement('rect', {
      x: x - 13,
      y: y - 13,
      width: 26,
      height: 26,
      rx: 3,
    }));
    group.appendChild(createSvgElement('line', { x1: x - 18, y1: y, x2: x + 18, y2: y }));
    group.appendChild(createSvgElement('line', { x1: x, y1: y - 18, x2: x, y2: y + 18 }));

    const mark = createSvgElement('text', {
      x: x + 18,
      y: y - 18,
      class: 'column-mark',
    });
    mark.textContent = column.mark || column.id;
    group.appendChild(mark);
    columnLayer.appendChild(group);
  });

  state.yLabels.forEach((yLabel, yIndex) => {
    state.xLabels.forEach((xLabel, xIndex) => {
      const key = pointKey(xLabel, yLabel);
      const { x, y } = pointPosition(xIndex, yIndex, metrics);
      const target = createSvgElement('circle', {
        cx: x,
        cy: y,
        r: state.selectedKey === key ? 9 : 6,
        class: `intersection-point${state.selectedKey === key ? ' selected' : ''}`,
        tabindex: 0,
        role: 'button',
        'aria-label': `Grid ${xLabel}, ${yLabel}`,
      });
      target.addEventListener('click', () => selectPoint(key));
      target.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectPoint(key);
        }
      });
      pointLayer.appendChild(target);
    });
  });

  frameCanvas.append(gridLayer, columnLayer, pointLayer, labelLayer);
}

function selectPoint(key) {
  state.selectedKey = key;
  const point = state.points[key];
  const existing = getExistingColumnAtSelectedPoint();

  propertiesEmpty.classList.add('hidden');
  columnForm.classList.remove('hidden');
  selectedLocation.textContent = `${point.xLabel}, ${point.yLabel}`;
  selectedBadge.textContent = `Selected: ${point.xLabel}, ${point.yLabel}`;

  columnInputs.mark.value = existing?.mark || '';
  columnInputs.size.value = existing?.size || '';
  columnInputs.baseLevel.value = existing?.baseLevel || '';
  columnInputs.topLevel.value = existing?.topLevel || '';
  columnInputs.notes.value = existing?.notes || '';
  deleteColumnBtn.classList.toggle('hidden', !existing);

  renderGrid();
}

function nextColumnId() {
  let index = state.columns.length + 1;
  let id = `COL-${String(index).padStart(3, '0')}`;
  while (state.columns.some(column => column.id === id)) {
    index += 1;
    id = `COL-${String(index).padStart(3, '0')}`;
  }
  return id;
}

function saveColumn(event) {
  event.preventDefault();
  if (!state.selectedKey) return;

  const point = state.points[state.selectedKey];
  const existingId = point.columnId;
  const column = {
    id: existingId || nextColumnId(),
    xLabel: point.xLabel,
    yLabel: point.yLabel,
    mark: columnInputs.mark.value.trim(),
    size: columnInputs.size.value.trim(),
    baseLevel: columnInputs.baseLevel.value.trim(),
    topLevel: columnInputs.topLevel.value.trim(),
    notes: columnInputs.notes.value.trim(),
  };

  if (existingId) {
    state.columns = state.columns.map(item => item.id === existingId ? column : item);
  } else {
    state.columns.push(column);
    point.columnId = column.id;
  }

  deleteColumnBtn.classList.remove('hidden');
  renderProjectInfo();
  renderGrid();
  renderTable();
}

function deleteSelectedColumn() {
  if (!state.selectedKey) return;
  const point = state.points[state.selectedKey];
  if (!point.columnId) return;

  state.columns = state.columns.filter(column => column.id !== point.columnId);
  point.columnId = null;
  Object.values(columnInputs).forEach(input => { input.value = ''; });
  deleteColumnBtn.classList.add('hidden');
  renderProjectInfo();
  renderGrid();
  renderTable();
}

function renderTable() {
  if (!state.columns.length) {
    dataTableBody.innerHTML = '<tr><td colspan="7" class="empty-row">No columns created.</td></tr>';
    return;
  }

  dataTableBody.innerHTML = state.columns.map(column => `
    <tr data-column-id="${escapeHtml(column.id)}">
      <td>${escapeHtml(column.id)}</td>
      <td>${escapeHtml(column.xLabel)}, ${escapeHtml(column.yLabel)}</td>
      <td>${escapeHtml(column.mark)}</td>
      <td>${escapeHtml(column.size)}</td>
      <td>${escapeHtml(column.baseLevel)}</td>
      <td>${escapeHtml(column.topLevel)}</td>
      <td>${escapeHtml(column.notes || '-')}</td>
    </tr>
  `).join('');

  dataTableBody.querySelectorAll('tr[data-column-id]').forEach(row => {
    row.addEventListener('click', () => {
      const column = state.columns.find(item => item.id === row.dataset.columnId);
      if (column) selectPoint(pointKey(column.xLabel, column.yLabel));
    });
  });
}

function exportCsv() {
  const headers = ['ID', 'Grid Location', 'Mark', 'Size', 'Base Level', 'Top Level', 'Notes'];
  const rows = state.columns.map(column => [
    column.id,
    `${column.xLabel},${column.yLabel}`,
    column.mark,
    column.size,
    column.baseLevel,
    column.topLevel,
    column.notes,
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.projectName || 'brb-lb-builder'}-columns.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setActiveTool(toolName) {
  state.activeTool = toolName;
  const isColumn = toolName === 'column';
  columnToolBtn.classList.toggle('active', isColumn);
  columnToolBtn.setAttribute('aria-pressed', String(isColumn));
  sidebarColumnTool.classList.toggle('active', isColumn);
}

projectForm.addEventListener('submit', event => {
  event.preventDefault();
  const xLabels = parseLabels(document.getElementById('xLabels').value);
  const yLabels = parseLabels(document.getElementById('yLabels').value);
  if (!xLabels.length || !yLabels.length) return;

  state.projectName = document.getElementById('projectName').value.trim();
  state.xLabels = xLabels;
  state.yLabels = yLabels;
  state.points = {};
  state.columns = [];
  state.selectedKey = null;
  propertiesEmpty.classList.remove('hidden');
  columnForm.classList.add('hidden');
  selectedBadge.textContent = 'No point selected';

  renderProjectInfo();
  renderGrid();
  renderTable();
  modal.close();
});

newProjectBtn.addEventListener('click', () => modal.showModal());
cancelProjectBtn.addEventListener('click', () => modal.close());
columnForm.addEventListener('submit', saveColumn);
deleteColumnBtn.addEventListener('click', deleteSelectedColumn);
columnToolBtn.addEventListener('click', () => setActiveTool('column'));
sidebarColumnTool.addEventListener('click', () => setActiveTool('column'));
exportCsvBtn.addEventListener('click', exportCsv);

renderProjectInfo();
renderGrid();
renderTable();
modal.showModal();
