const state = {
  projectName: '',
  xLabels: [],
  yLabels: [],
  points: {},
  selectedKey: null,
};

const modal = document.getElementById('projectModal');
const newProjectBtn = document.getElementById('newProjectBtn');
const projectForm = document.getElementById('projectForm');
const gridContainer = document.getElementById('gridContainer');
const emptyState = document.getElementById('emptyState');
const propertiesEmpty = document.getElementById('propertiesEmpty');
const propertiesContent = document.getElementById('propertiesContent');
const selectedLocation = document.getElementById('selectedLocation');
const selectedElement = document.getElementById('selectedElement');
const addColumnBtn = document.getElementById('addColumnBtn');
const dataTableBody = document.getElementById('dataTableBody');

function parseLabels(raw) {
  return raw.split(',').map(v => v.trim()).filter(Boolean);
}

function pointKey(xLabel, yLabel) {
  return `${xLabel}__${yLabel}`;
}

function renderGrid() {
  const { xLabels, yLabels } = state;
  gridContainer.innerHTML = '';
  if (!xLabels.length || !yLabels.length) return;

  emptyState.classList.add('hidden');
  gridContainer.style.gridTemplateColumns = `repeat(${xLabels.length + 1}, 44px)`;

  gridContainer.appendChild(makeCell('','label-cell'));
  xLabels.forEach(x => gridContainer.appendChild(makeCell(x, 'label-cell')));

  yLabels.forEach(y => {
    gridContainer.appendChild(makeCell(y, 'label-cell'));
    xLabels.forEach(x => {
      const key = pointKey(x, y);
      const point = state.points[key] || { xLabel: x, yLabel: y, elementType: null };
      state.points[key] = point;

      const cell = makeCell('', 'intersection');
      cell.dataset.key = key;
      if (state.selectedKey === key) cell.classList.add('selected');
      if (point.elementType === 'column') cell.innerHTML = '<span class="symbol">●</span>';
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
  propertiesContent.classList.remove('hidden');
  selectedLocation.textContent = `${point.xLabel}, ${point.yLabel}`;
  selectedElement.textContent = point.elementType || 'None';
  addColumnBtn.disabled = false;
  renderGrid();
}

function addColumnElement() {
  if (!state.selectedKey) return;
  state.points[state.selectedKey].elementType = 'column';
  selectPoint(state.selectedKey);
  renderDataTable();
}

function renderDataTable() {
  const rows = Object.values(state.points).filter(point => point.elementType);
  if (!rows.length) {
    dataTableBody.innerHTML = '<tr><td colspan="3">No elements added.</td></tr>';
    return;
  }

  dataTableBody.innerHTML = rows
    .map(point => `<tr><td>${point.xLabel}</td><td>${point.yLabel}</td><td>${point.elementType}</td></tr>`)
    .join('');
}

newProjectBtn.addEventListener('click', () => modal.showModal());

projectForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.projectName = document.getElementById('projectName').value.trim();
  state.xLabels = parseLabels(document.getElementById('xLabels').value);
  state.yLabels = parseLabels(document.getElementById('yLabels').value);
  state.points = {};
  state.selectedKey = null;

  addColumnBtn.disabled = true;
  propertiesEmpty.classList.remove('hidden');
  propertiesContent.classList.add('hidden');

  renderGrid();
  renderDataTable();
  modal.close();
});

addColumnBtn.addEventListener('click', addColumnElement);
modal.showModal();
