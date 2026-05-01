const state = {
  projectName: '',
  xLabels: [],
  yLabels: [],
  points: {},
  columns: [],
  selectedKey: null,
};

const modal = document.getElementById('projectModal');
const projectForm = document.getElementById('projectForm');
const newProjectBtn = document.getElementById('newProjectBtn');
const gridContainer = document.getElementById('gridContainer');
const emptyState = document.getElementById('emptyState');
const propertiesEmpty = document.getElementById('propertiesEmpty');
const columnForm = document.getElementById('columnForm');
const selectedLocation = document.getElementById('selectedLocation');
const dataTableBody = document.getElementById('dataTableBody');

const projectNameValue = document.getElementById('projectNameValue');
const xLabelsValue = document.getElementById('xLabelsValue');
const yLabelsValue = document.getElementById('yLabelsValue');

function parseLabels(raw) {
  return raw.split(',').map(v => v.trim()).filter(Boolean);
}

function pointKey(xLabel, yLabel) {
  return `${xLabel}__${yLabel}`;
}

function renderProjectInfo() {
  projectNameValue.textContent = state.projectName || 'Not set';
  xLabelsValue.textContent = state.xLabels.join(', ') || '-';
  yLabelsValue.textContent = state.yLabels.join(', ') || '-';
}

function renderGrid() {
  gridContainer.innerHTML = '';
  if (!state.xLabels.length || !state.yLabels.length) return;

  emptyState.classList.add('hidden');
  gridContainer.style.gridTemplateColumns = `repeat(${state.xLabels.length + 1}, 44px)`;

  gridContainer.appendChild(makeCell('', 'label-cell'));
  state.xLabels.forEach(x => gridContainer.appendChild(makeCell(x, 'label-cell')));

  state.yLabels.forEach(y => {
    gridContainer.appendChild(makeCell(y, 'label-cell'));
    state.xLabels.forEach(x => {
      const key = pointKey(x, y);
      if (!state.points[key]) state.points[key] = { xLabel: x, yLabel: y, columnId: null };
      const cell = makeCell('', 'intersection');
      if (state.selectedKey === key) cell.classList.add('selected');
      if (state.points[key].columnId) cell.innerHTML = '<span class="column-symbol">●</span>';
      cell.addEventListener('click', () => selectPoint(key));
      gridContainer.appendChild(cell);
    });
  });
}

function makeCell(text, cls) {
  const cell = document.createElement('div');
  cell.className = `grid-cell ${cls}`;
  cell.textContent = text;
  return cell;
}

function selectPoint(key) {
  state.selectedKey = key;
  const point = state.points[key];
  propertiesEmpty.classList.add('hidden');
  columnForm.classList.remove('hidden');
  selectedLocation.textContent = `${point.xLabel}, ${point.yLabel}`;

  const existing = state.columns.find(col => col.id === point.columnId);
  document.getElementById('colMark').value = existing?.mark || '';
  document.getElementById('colSize').value = existing?.size || '';
  document.getElementById('colBaseLevel').value = existing?.baseLevel || '';
  document.getElementById('colTopLevel').value = existing?.topLevel || '';
  document.getElementById('colNotes').value = existing?.notes || '';

  renderGrid();
}

function saveColumn(event) {
  event.preventDefault();
  if (!state.selectedKey) return;

  const point = state.points[state.selectedKey];
  const existingId = point.columnId;
  const column = {
    id: existingId || `C-${state.columns.length + 1}`,
    xLabel: point.xLabel,
    yLabel: point.yLabel,
    mark: document.getElementById('colMark').value.trim(),
    size: document.getElementById('colSize').value.trim(),
    baseLevel: document.getElementById('colBaseLevel').value.trim(),
    topLevel: document.getElementById('colTopLevel').value.trim(),
    notes: document.getElementById('colNotes').value.trim(),
  };

  if (existingId) {
    state.columns = state.columns.map(item => item.id === existingId ? column : item);
  } else {
    state.columns.push(column);
    point.columnId = column.id;
  }

  renderGrid();
  renderTable();
}

function renderTable() {
  if (!state.columns.length) {
    dataTableBody.innerHTML = '<tr><td colspan="7">No columns created.</td></tr>';
    return;
  }

  dataTableBody.innerHTML = state.columns.map(col => `
    <tr>
      <td>${col.id}</td>
      <td>${col.xLabel}, ${col.yLabel}</td>
      <td>${col.mark}</td>
      <td>${col.size}</td>
      <td>${col.baseLevel}</td>
      <td>${col.topLevel}</td>
      <td>${col.notes || '-'}</td>
    </tr>
  `).join('');
}

projectForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.projectName = document.getElementById('projectName').value.trim();
  state.xLabels = parseLabels(document.getElementById('xLabels').value);
  state.yLabels = parseLabels(document.getElementById('yLabels').value);
  state.points = {};
  state.columns = [];
  state.selectedKey = null;
  propertiesEmpty.classList.remove('hidden');
  columnForm.classList.add('hidden');

  renderProjectInfo();
  renderGrid();
  renderTable();
  modal.close();
});

columnForm.addEventListener('submit', saveColumn);
newProjectBtn.addEventListener('click', () => modal.showModal());
modal.showModal();
