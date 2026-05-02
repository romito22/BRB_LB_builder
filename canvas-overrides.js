(function () {
  const BRACE_ASSET = 'assets/brace.svg';
  const GUSSET_ASSET = 'assets/gusset_normal.svg';
  const BASE_PLATE_ASSET = 'assets/base_plate.svg';
  const FOOTING_ASSET = 'assets/footing.svg';
  const SLAB_ASSET = 'assets/slab_conc.svg';
  const WORK_POINT_ASSET = 'assets/work_point.svg';
  const GRID_MARK_ASSET = 'assets/grid_mark.svg';
  const LEVEL_MARK_ASSET = 'assets/level_mark.svg';
  const BRACE_VIEWBOX = { width: 26.286751, height: 205.07343, topPin: 24.45, bottomPin: 180.62 };
  const BASE_PLATE_VIEWBOX = { width: 45.786118, height: 3.8827007 };
  const FOOTING_VIEWBOX = { width: 45.786095, height: 3.7401545 };
  const SLAB_VIEWBOX = { width: 45.786095, height: 3.7401545 };
  const WORK_POINT_VIEWBOX = { width: 1.9726186, height: 1.9416088 };
  const MARK_VIEWBOX = { width: 171.72177, height: 9.39082 };
  const GUSSET_SIZE = 96;
  const MEMBER_HALF_WIDTH = 12;
  const GUSSET_SHORT_LEG = 68;
  const GUSSET_LONG_LEG = 96;
  const GUSSET_HOST_OFFSET = 32;
  const GUSSET_PIN_LOCAL = { x: 50, y: -38 };
  const originalSetPlacementMode = setPlacementMode;
  const originalPropertiesTemplate = propertiesTemplate;
  const originalNextElementId = nextElementId;
  const originalNextMark = nextMark;

  nextElementId = function nextElementIdOverride(type) {
    if (type === 'slab') {
      const count = state.elements.filter(element => element.type === type).length + 1;
      return `SLAB-${String(count).padStart(3, '0')}`;
    }
    if (type === 'basePlate') {
      const count = state.elements.filter(element => element.type === type).length + 1;
      return `BP-${String(count).padStart(3, '0')}`;
    }
    if (type === 'footing') {
      const count = state.elements.filter(element => element.type === type).length + 1;
      return `FT-${String(count).padStart(3, '0')}`;
    }
    if (type === 'workPoint') {
      const count = state.elements.filter(element => element.type === type).length + 1;
      return `WP-${String(count).padStart(3, '0')}`;
    }
    return originalNextElementId(type);
  };

  nextMark = function nextMarkOverride(type) {
    if (type === 'slab') {
      const count = state.elements.filter(element => element.type === type).length + 1;
      return `S-${count}`;
    }
    return originalNextMark(type);
  };

  pointOptions = function pointOptionsOverride(selected) {
    const values = state.gridPoints.map(point => point.id);
    if (selected && !values.includes(selected)) values.push(selected);
    return optionList(values, selected);
  };

  state.selectedElementIds = state.selectedElementIds || [];

  function selectionIds() {
    if (!state.selectedElementIds?.length && state.selectedElementId) {
      state.selectedElementIds = [state.selectedElementId];
    }
    state.selectedElementIds = (state.selectedElementIds || []).filter(id => state.elements.some(element => element.id === id));
    if (state.selectedElementId && state.elements.some(element => element.id === state.selectedElementId) && !state.selectedElementIds.includes(state.selectedElementId)) {
      state.selectedElementIds = [state.selectedElementId];
    } else if (!state.selectedElementIds.includes(state.selectedElementId)) {
      state.selectedElementId = state.selectedElementIds[state.selectedElementIds.length - 1] || null;
    }
    return state.selectedElementIds;
  }

  function setSelectionIds(ids) {
    state.selectedElementIds = [...new Set(ids.filter(Boolean))];
    state.selectedElementId = state.selectedElementIds[state.selectedElementIds.length - 1] || null;
  }

  function toggleElementSelection(id) {
    const ids = selectionIds();
    setSelectionIds(ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
    render();
  }

  selectedElement = function selectedElementOverride() {
    selectionIds();
    return state.elements.find(element => element.id === state.selectedElementId) || null;
  };

  setSelectedElement = function setSelectedElementOverride(id, additive = false) {
    if (additive && id) {
      toggleElementSelection(id);
      return;
    }
    setSelectionIds(id ? [id] : []);
    render();
  };

  elementClass = function elementClassOverride(element) {
    return selectionIds().includes(element.id) ? ' selected-element' : '';
  };

  renderSelection = function renderSelectionOverride(svg) {
    const ids = selectionIds();
    const selected = ids
      .map(id => state.elements.find(element => element.id === id))
      .filter(Boolean);
    selected.forEach(element => append(svg, selectionOutlineFor(element)));
    if (selected.length === 1) append(svg, SelectionHandles(selected[0]));
  };

  renderTable = function renderTableOverride() {
    const selected = selectionIds();
    const filtered = state.tableFilter === 'all'
      ? state.elements
      : state.elements.filter(element => element.type === state.tableFilter);
    if (!filtered.length) {
      els.dataTableBody.innerHTML = '<tr><td colspan="7" class="empty-row">No elements created.</td></tr>';
      return;
    }
    els.dataTableBody.innerHTML = filtered.map(element => `
      <tr data-id="${escapeHtml(element.id)}" class="${selected.includes(element.id) ? 'selected-row' : ''}">
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
      row.addEventListener('click', event => setSelectedElement(row.dataset.id, event.metaKey || event.ctrlKey));
    });
  };

  renderProperties = function renderPropertiesOverride() {
    const ids = selectionIds();
    const element = selectedElement();
    els.selectedBadge.textContent = ids.length > 1
      ? `${ids.length} elements selected`
      : element ? `${element.type.toUpperCase()} ${element.id}` : 'No element selected';
    if (!element) {
      els.propertiesPanel.className = 'panel-empty';
      els.propertiesPanel.textContent = 'No element selected';
      return;
    }
    els.propertiesPanel.className = 'property-form';
    els.propertiesPanel.innerHTML = ids.length > 1
      ? `<div class="selection-summary"><span>Multiple selection</span><strong>${ids.length} elements</strong></div><p class="panel-note">Properties show the last selected element. Delete removes all selected elements.</p>${propertiesTemplate(element)}`
      : propertiesTemplate(element);
    els.propertiesPanel.querySelectorAll('input, textarea, select').forEach(input => {
      input.addEventListener('input', () => updateElementField(element.id, input.name, input.value));
      input.addEventListener('change', () => updateElementField(element.id, input.name, input.value));
    });
  };

  deleteSelected = function deleteSelectedOverride() {
    const ids = selectionIds();
    if (!ids.length) return;
    state.elements = state.elements.filter(element => !ids.includes(element.id));
    setSelectionIds([]);
    render();
  };

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function projectCanvasWidthFt() {
    return clampNumber(state.project?.canvasWidthFt, 10, 200, FEET_PER_CANVAS);
  }

  function projectCanvasHeightFt() {
    return clampNumber(state.project?.canvasHeightFt, 10, 200, FEET_PER_CANVAS);
  }

  function projectBayWidthFt() {
    return clampNumber(state.project?.bayWidthFt, 1, 100, 8);
  }

  function projectStoryHeightFt() {
    return clampNumber(state.project?.storyHeightFt, 1, 100, 8);
  }

  function projectBaySpacing() {
    return projectBayWidthFt() * PIXELS_PER_FOOT;
  }

  function projectStorySpacing() {
    return projectStoryHeightFt() * PIXELS_PER_FOOT;
  }

  function formatFeet(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function readProjectSetupValues() {
    return {
      name: document.getElementById('projectName').value.trim(),
      xGridLabels: parseCsv(document.getElementById('xLabels').value),
      levels: parseCsv(document.getElementById('levels').value),
      canvasWidthFt: clampNumber(document.getElementById('canvasWidthFt')?.value, 10, 200, FEET_PER_CANVAS),
      canvasHeightFt: clampNumber(document.getElementById('canvasHeightFt')?.value, 10, 200, FEET_PER_CANVAS),
      bayWidthFt: clampNumber(document.getElementById('bayWidthFt')?.value, 1, 100, 8),
      storyHeightFt: clampNumber(document.getElementById('storyHeightFt')?.value, 1, 100, 8),
    };
  }

  function frameWidthFt() {
    return Math.max(0, (state.project?.xGridLabels?.length || 1) - 1) * projectBayWidthFt();
  }

  function frameHeightFt() {
    return Math.max(0, (verticalLabels().length || 1) - 1) * projectStoryHeightFt();
  }

  canvasSize = function canvasSizeOverride() {
    return {
      width: projectCanvasWidthFt() * PIXELS_PER_FOOT,
      height: projectCanvasHeightFt() * PIXELS_PER_FOOT,
    };
  };

  function gridOrigin() {
    const xLabels = state.project?.xGridLabels || ['A'];
    const yLabels = verticalLabels();
    const canvas = canvasSize();
    const frameWidth = Math.max(0, xLabels.length - 1) * projectBaySpacing();
    const frameHeight = Math.max(0, yLabels.length - 1) * projectStorySpacing();
    return {
      x: Math.max(PIXELS_PER_FOOT, (canvas.width - frameWidth) / 2),
      y: Math.max(PIXELS_PER_FOOT, (canvas.height - frameHeight) / 2),
    };
  }

  generateGridPoints = function generateGridPointsOverride(xGridLabels, yGridLabels) {
    const origin = gridOrigin();
    const points = [];
    yGridLabels.forEach((yLabel, yIndex) => {
      xGridLabels.forEach((xLabel, xIndex) => {
        points.push({
          id: gridPointId(xLabel, yLabel),
          xLabel,
          yLabel,
          x: origin.x + xIndex * projectBaySpacing(),
          y: origin.y + yIndex * projectStorySpacing(),
        });
      });
    });
    return points;
  };

  drawingExtents = function drawingExtentsOverride() {
    const xLabels = state.project?.xGridLabels || ['A'];
    const yLabels = verticalLabels();
    const origin = gridOrigin();
    const minX = origin.x;
    const minY = origin.y;
    const maxX = origin.x + (xLabels.length - 1) * projectBaySpacing();
    const maxY = origin.y + (yLabels.length - 1) * projectStorySpacing();
    return { minX, minY, maxX, maxY, xLabels, yLabels };
  };

  const originalGetPointById = getPointById;
  getPointById = function getPointByIdWithWorkspaceSnap(pointId) {
    if (typeof pointId === 'string' && pointId.startsWith('WG-')) {
      const [, xFt, yFt] = pointId.split('-');
      const x = Number(xFt) * PIXELS_PER_FOOT;
      const y = Number(yFt) * PIXELS_PER_FOOT;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return { id: pointId, xLabel: `${xFt}ft`, yLabel: `${yFt}ft`, x, y, isWorkspacePoint: true };
      }
    }
    return originalGetPointById(pointId);
  };

  function workspacePointId(xFt, yFt) {
    return `WG-${xFt}-${yFt}`;
  }

  const originalFindNearestGridPoint = findNearestGridPoint;
  findNearestGridPoint = function findNearestGridPointWithWorkspaceIntersections(svgPoint, maxDistance = Infinity) {
    const nearestStructural = originalFindNearestGridPoint(svgPoint, maxDistance);
    if (!svgPoint) return nearestStructural;
    const size = canvasSize();
    const xFt = Math.round(svgPoint.x / PIXELS_PER_FOOT);
    const yFt = Math.round(svgPoint.y / PIXELS_PER_FOOT);
    if (xFt < 0 || yFt < 0 || xFt > Math.round(size.width / PIXELS_PER_FOOT) || yFt > Math.round(size.height / PIXELS_PER_FOOT)) {
      return nearestStructural;
    }
    const workspacePoint = {
      id: workspacePointId(xFt, yFt),
      xLabel: `${xFt}ft`,
      yLabel: `${yFt}ft`,
      x: xFt * PIXELS_PER_FOOT,
      y: yFt * PIXELS_PER_FOOT,
      isWorkspacePoint: true,
    };
    const workspaceDistance = distanceToPoint(workspacePoint, svgPoint);
    if (workspaceDistance > maxDistance) return nearestStructural;
    if (!nearestStructural) return workspacePoint;
    return workspaceDistance <= distanceToPoint(nearestStructural, svgPoint) ? workspacePoint : nearestStructural;
  };

  getElementStartEnd = function getElementStartEndOverride(element) {
    if (element.type === 'column') {
      if (element.startGridPointId || element.endGridPointId) {
        return [getPointById(element.startGridPointId), getPointById(element.endGridPointId)];
      }
      return [pointForColumnLevel(element, element.baseLevel), pointForColumnLevel(element, element.topLevel)];
    }
    if (element.type === 'beam' || element.type === 'slab') {
      return [getPointById(element.startGridPointId), getPointById(element.endGridPointId)];
    }
    if (element.type === 'brb') {
      if (element.startGussetId || element.endGussetId) {
        return [getGussetPinPoint(element.startGussetId), getGussetPinPoint(element.endGussetId)];
      }
      return [getPointById(element.startGridPointId), getPointById(element.endGridPointId)];
    }
    const point = getGussetPinPoint(element.id) || getPointById(element.attachedGridPointId);
    return [point, point];
  };

  function isPointElement(element) {
    return ['gusset', 'basePlate', 'footing', 'workPoint'].includes(element?.type);
  }

  SelectionHandles = function SelectionHandlesOverride(element) {
    const [start, end] = getElementStartEnd(element);
    if (!start) return null;
    const group = createSvg('g', { class: 'selection-handles' });
    const handles = isPointElement(element)
      ? [{ point: start, handle: 'point' }]
      : [
          { point: start, handle: 'start' },
          { point: end, handle: 'end' },
        ].filter(item => item.point);
    handles.forEach(({ point, handle }) => {
      const grip = createSvg('circle', {
        cx: point.x,
        cy: point.y,
        r: 8,
        class: `selection-grip${state.drag?.elementId === element.id && state.drag?.handle === handle ? ' is-dragging' : ''}`,
        'data-drag-handle': handle,
      });
      grip.addEventListener('pointerdown', event => beginElementDrag(event, element.id, handle));
      append(group, grip);
    });
    const points = handles.map(item => item.point);
    append(group, labelTag(points[0].x + 12, points[0].y - 14, `${element.mark} selected`, 'start', 'selection-tag'));
    return group;
  };

  selectionOutlineFor = function selectionOutlineForOverride(element) {
    const [start, end] = getElementStartEnd(element);
    if (!start) return null;
    if (element.type === 'gusset') {
      return createSvg('circle', { cx: start.x, cy: start.y, r: 56, class: 'selection-outline' });
    }
    if (element.type === 'basePlate') {
      return createSvg('rect', { x: start.x - 38, y: start.y - 14, width: 76, height: 28, class: 'selection-outline' });
    }
    if (element.type === 'footing') {
      return createSvg('rect', { x: start.x - 44, y: start.y - 14, width: 88, height: 28, class: 'selection-outline' });
    }
    if (element.type === 'workPoint') {
      return createSvg('circle', { cx: start.x, cy: start.y, r: 18, class: 'selection-outline' });
    }
    const normal = getNormalOffset(start, end, 24);
    const points = [
      `${start.x + normal.x},${start.y + normal.y}`,
      `${end.x + normal.x},${end.y + normal.y}`,
      `${end.x - normal.x},${end.y - normal.y}`,
      `${start.x - normal.x},${start.y - normal.y}`,
    ].join(' ');
    return createSvg('polygon', { points, class: 'selection-outline' });
  };

  renderSheetBackground = function renderSheetBackgroundOverride(svg, size) {
    const group = createSvg('g', { class: 'workspace-grid', 'aria-hidden': 'true' });
    append(group, createSvg('rect', { x: 0, y: 0, width: size.width, height: size.height, class: 'workspace-grid-bg' }));
    const verticalCount = Math.round(size.width / PIXELS_PER_FOOT);
    const horizontalCount = Math.round(size.height / PIXELS_PER_FOOT);
    for (let index = 0; index <= verticalCount; index += 1) {
      const x = index * PIXELS_PER_FOOT;
      append(group, createSvg('line', { x1: x, y1: 0, x2: x, y2: size.height, class: 'workspace-grid-line' }));
    }
    for (let index = 0; index <= horizontalCount; index += 1) {
      const y = index * PIXELS_PER_FOOT;
      append(group, createSvg('line', { x1: 0, y1: y, x2: size.width, y2: y, class: 'workspace-grid-line' }));
    }
    append(svg, group);
  };

  renderCanvas = function renderCanvasOverride() {
    const svg = els.frameCanvas;
    svg.innerHTML = '';
    svg.onclick = handleCanvasClick;
    const size = canvasSize();
    svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
    svg.setAttribute('width', size.width);
    svg.setAttribute('height', size.height);
    svg.style.aspectRatio = `${size.width} / ${size.height}`;
    if (!state.project) return;
    const { minX, minY, maxX, maxY } = drawingExtents();
    renderSheetBackground(svg, size);
    renderGrid(svg, minX, minY, maxX, maxY);
    renderDimensions(svg, minX, minY, maxX, maxY);
    state.elements.filter(element => element.type === 'column').forEach(element => svg.appendChild(ColumnSymbol(element)));
    state.elements.filter(element => element.type === 'beam').forEach(element => svg.appendChild(BeamSymbol(element)));
    state.elements.filter(element => element.type === 'brb').forEach(element => svg.appendChild(BRBSymbol(element)));
    state.elements.filter(element => element.type === 'gusset').forEach(element => svg.appendChild(GussetPlateSymbol(element)));
    state.elements.filter(element => element.type === 'slab').forEach(element => svg.appendChild(SlabSymbol(element)));
    state.elements.filter(element => element.type === 'footing').forEach(element => svg.appendChild(FootingSymbol(element)));
    state.elements.filter(element => element.type === 'basePlate').forEach(element => svg.appendChild(BasePlateSymbol(element)));
    state.elements.filter(element => element.type === 'workPoint').forEach(element => svg.appendChild(WorkPointSymbol(element)));
    renderSelection(svg);
    renderGridPoints(svg);
    renderPlacementPreview(svg);
  };

  renderDimensions = function renderDimensionsOverride(svg, minX, minY, maxX, maxY) {
    const bottomY = maxY + 116;
    const rightX = maxX + 86;
    append(svg,
      createSvg('line', { x1: minX, y1: maxY + 24, x2: minX, y2: bottomY + 10, class: 'extension-line' }),
      createSvg('line', { x1: maxX, y1: maxY + 24, x2: maxX, y2: bottomY + 10, class: 'extension-line' }),
      DimensionLine({ x: minX, y: bottomY }, { x: maxX, y: bottomY }, `Frame Width ${formatFeet(frameWidthFt())} ft`),
      createSvg('line', { x1: maxX + 24, y1: minY, x2: rightX + 10, y2: minY, class: 'extension-line' }),
      createSvg('line', { x1: maxX + 24, y1: maxY, x2: rightX + 10, y2: maxY, class: 'extension-line' }),
      DimensionLine({ x: rightX, y: minY }, { x: rightX, y: maxY }, `Frame Height ${formatFeet(frameHeightFt())} ft`, 'right'),
    );
  };

  function MarkAsset(href, x, y, width, height, transform = '') {
    return assetImage(href, {
      x,
      y,
      width,
      height,
      preserveAspectRatio: 'none',
      class: 'grid-mark-asset',
      transform,
    });
  }

  function renderMarkerText(svg, x, y, text, className = 'grid-label', anchor = 'middle') {
    const label = createSvg('text', { x, y, class: className, 'text-anchor': anchor });
    label.textContent = text;
    append(svg, label);
  }

  renderGrid = function renderGridWithAssets(svg, minX, minY, maxX, maxY) {
    const levelLabelX = maxX + 128;
    const levelTargetX = maxX + 226;
    verticalLabels().forEach((label, index) => {
      const y = minY + index * projectStorySpacing();
      append(svg,
        createSvg('line', { x1: minX - 104, y1: y, x2: levelTargetX + 28, y2: y, class: 'grid-line grid-line-reference' }),
        createSvg('circle', { cx: levelTargetX, cy: y, r: 18, class: 'level-target-circle' }),
        createSvg('path', { d: `M ${levelTargetX} ${y - 18} V ${y + 18} M ${levelTargetX - 18} ${y} H ${levelTargetX + 18}`, class: 'level-target-cross' }),
      );
      renderMarkerText(svg, levelLabelX, y - 12, label, 'level-name-label', 'start');
    });

    state.project.xGridLabels.forEach((label, index) => {
      const x = minX + index * projectBaySpacing();
      append(svg,
        createSvg('line', { x1: x, y1: minY - 120, x2: x, y2: maxY + 84, class: 'grid-line grid-line-reference' }),
        createSvg('circle', { cx: x, cy: minY - 88, r: 19, class: 'grid-bubble' }),
      );
      renderMarkerText(svg, x, minY - 82, label, 'grid-name-label');
    });
    append(svg, createSvg('line', { x1: 52, y1: maxY + 104, x2: maxX + 116, y2: maxY + 104, class: 'sheet-title-line' }));
  };

  MemberStickSymbol = function MemberStickSymbolOverride(start, end, width, className) {
    const group = createSvg('g', { class: className });
    const normal = getNormalOffset(start, end, width / 2);
    const points = [
      `${start.x + normal.x},${start.y + normal.y}`,
      `${end.x + normal.x},${end.y + normal.y}`,
      `${end.x - normal.x},${end.y - normal.y}`,
      `${start.x - normal.x},${start.y - normal.y}`,
    ].join(' ');
    append(group,
      createSvg('polygon', { points, class: 'member-body' }),
      createSvg('line', { x1: start.x + normal.x, y1: start.y + normal.y, x2: end.x + normal.x, y2: end.y + normal.y, class: 'member-edge' }),
      createSvg('line', { x1: start.x - normal.x, y1: start.y - normal.y, x2: end.x - normal.x, y2: end.y - normal.y, class: 'member-edge' }),
      Centerline(start, end, 'member-centerline'),
    );
    return group;
  };

  renderPlacementPreview = function renderPlacementPreviewOverride(svg) {
    if (!state.pendingStartPointId || !['column', 'beam', 'slab'].includes(state.placementMode)) return;
    const start = getPointById(state.pendingStartPointId);
    if (!start) return;
    const end = state.snapPointId ? getPointById(state.snapPointId) : state.pointerSvgPoint;
    if (!end) return;
    append(svg, createSvg('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'placement-preview' }));
    const toolName = { column: 'Column', beam: 'Beam', slab: 'Slab', brb: 'BRB' }[state.placementMode];
    const text = `Select end point for ${toolName}`;
    const group = createSvg('g', { class: 'instruction-banner' });
    append(group, createSvg('rect', { x: start.x + 18, y: start.y - 42, width: 188, height: 26 }));
    const label = createSvg('text', { x: start.x + 28, y: start.y - 24 });
    label.textContent = text;
    append(group, label);
    append(svg, group);
  };

  ColumnSymbol = function ColumnSymbolOverride(element) {
    const [start, end] = getElementStartEnd(element);
    const group = createSvg('g', { class: `element column-element${elementClass(element)}`, 'data-id': element.id });
    if (!start || !end) return group;
    append(group, MemberStickSymbol(start, end, 24, 'column-stick'));
    const mid = getMidpoint(start, end);
    const normal = getNormalOffset(start, end, -30);
    append(group, labelTag(mid.x + normal.x, mid.y + normal.y, element.mark));
    attachElementEvents(group, element);
    return group;
  };

  function assetImage(href, attrs = {}) {
    const image = createSvg('image', {
      href,
      ...attrs,
    });
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
    image.setAttribute('draggable', 'false');
    return image;
  }

  function BraceAssetSymbol(start, end) {
    const length = distanceToPoint(start, end);
    if (!length) return null;
    const angleDeg = getAngle(start, end) * 180 / Math.PI;
    const pinDistance = BRACE_VIEWBOX.bottomPin - BRACE_VIEWBOX.topPin;
    const scaleY = length / pinDistance;
    const imageHeight = BRACE_VIEWBOX.height * scaleY;
    const imageWidth = Math.max(28, BRACE_VIEWBOX.width * scaleY * 1.35);
    const image = assetImage(BRACE_ASSET, {
      x: -imageWidth / 2,
      y: -BRACE_VIEWBOX.topPin * scaleY,
      width: imageWidth,
      height: imageHeight,
      preserveAspectRatio: 'none',
      class: 'brace-asset',
    });
    const group = createSvg('g', {
      class: 'brace-asset-wrap',
      transform: `translate(${start.x} ${start.y}) rotate(${angleDeg - 90})`,
    });
    append(group, image);
    return group;
  }

  function GussetAssetSymbol(point, angle, side = 1) {
    const angleDeg = angle * 180 / Math.PI;
    const flip = side < 0 ? ' scale(1 -1)' : '';
    const group = createSvg('g', {
      class: 'gusset-asset-wrap',
      transform: `translate(${point.x} ${point.y}) rotate(${angleDeg})${flip}`,
    });
    append(group, assetImage(GUSSET_ASSET, {
      x: 0,
      y: -GUSSET_SIZE,
      width: GUSSET_SIZE,
      height: GUSSET_SIZE,
      preserveAspectRatio: 'xMinYMax meet',
      class: 'gusset-asset',
    }));
    return group;
  }

  function BasePlateAssetSymbol(point) {
    const width = 72;
    const height = Math.max(8, width * BASE_PLATE_VIEWBOX.height / BASE_PLATE_VIEWBOX.width);
    const group = createSvg('g', { class: 'base-plate-asset-wrap' });
    append(group,
      createSvg('rect', { x: point.x - width / 2, y: point.y - height / 2, width, height, class: 'base-plate-body' }),
      assetImage(BASE_PLATE_ASSET, {
        x: point.x - width / 2,
        y: point.y - height / 2,
        width,
        height,
        preserveAspectRatio: 'none',
        class: 'base-plate-asset',
      }),
    );
    return group;
  }

  function FootingAssetSymbol(point) {
    const width = 84;
    const height = Math.max(9, width * FOOTING_VIEWBOX.height / FOOTING_VIEWBOX.width);
    const group = createSvg('g', { class: 'footing-asset-wrap' });
    append(group,
      createSvg('rect', { x: point.x - width / 2, y: point.y - height / 2, width, height, class: 'footing-body' }),
      assetImage(FOOTING_ASSET, {
        x: point.x - width / 2,
        y: point.y - height / 2,
        width,
        height,
        preserveAspectRatio: 'none',
        class: 'footing-asset',
      }),
    );
    return group;
  }

  function LinearConcreteAssetSymbol(start, end, asset, viewBox, className) {
    const length = distanceToPoint(start, end);
    if (!length) return null;
    const height = Math.max(12, length * viewBox.height / viewBox.width);
    const angleDeg = getAngle(start, end) * 180 / Math.PI;
    const group = createSvg('g', {
      class: `${className}-asset-wrap`,
      transform: `translate(${start.x} ${start.y}) rotate(${angleDeg})`,
    });
    append(group,
      createSvg('rect', { x: 0, y: -height / 2, width: length, height, class: `${className}-body` }),
      assetImage(asset, {
        x: 0,
        y: -height / 2,
        width: length,
        height,
        preserveAspectRatio: 'none',
        class: `${className}-asset`,
      }),
    );
    return group;
  }

  function WorkPointAssetSymbol(point) {
    const radius = 7;
    const assetSize = 16;
    const group = createSvg('g', { class: 'work-point-asset-wrap' });
    append(group,
      createSvg('circle', { cx: point.x, cy: point.y, r: radius, class: 'work-point-body' }),
      createSvg('line', { x1: point.x - radius - 5, y1: point.y, x2: point.x + radius + 5, y2: point.y, class: 'work-point-cross' }),
      createSvg('line', { x1: point.x, y1: point.y - radius - 5, x2: point.x, y2: point.y + radius + 5, class: 'work-point-cross' }),
      assetImage(WORK_POINT_ASSET, {
        x: point.x - assetSize / 2,
        y: point.y - assetSize / 2,
        width: assetSize,
        height: assetSize,
        preserveAspectRatio: 'xMidYMid meet',
        class: 'work-point-asset',
      }),
    );
    return group;
  }

  function frameCenterPoint() {
    const { minX, minY, maxX, maxY } = drawingExtents();
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  function unitVector(from, to) {
    const length = distanceToPoint(from, to);
    if (!length) return { x: 1, y: 0 };
    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  }

  function elementById(id, type = '') {
    return state.elements.find(item => item.id === id && (!type || item.type === type));
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function projectPointToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (!lengthSq) return { ...start };
    const t = clamp01(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq);
    return { x: start.x + dx * t, y: start.y + dy * t };
  }

  function distanceToSegment(point, start, end) {
    return distanceToPoint(point, projectPointToSegment(point, start, end));
  }

  function pointOnHost(host, point, tolerance = MEMBER_HALF_WIDTH + 8) {
    const [start, end] = getElementStartEnd(host);
    if (!start || !end || !point) return false;
    return distanceToSegment(point, start, end) <= tolerance;
  }

  function snapHostPoint(host, svgPoint) {
    const [start, end] = getElementStartEnd(host);
    if (!start || !end) return null;
    const projected = projectPointToSegment(svgPoint, start, end);
    const nearestEndpoint = distanceToPoint(start, projected) <= distanceToPoint(end, projected) ? start : end;
    if (distanceToPoint(nearestEndpoint, projected) <= SNAP_DISTANCE) return nearestEndpoint;
    return findNearestGridPoint(projected, PIXELS_PER_FOOT / 2) || {
      id: workspacePointId(Math.round(projected.x / PIXELS_PER_FOOT), Math.round(projected.y / PIXELS_PER_FOOT)),
      x: Math.round(projected.x / PIXELS_PER_FOOT) * PIXELS_PER_FOOT,
      y: Math.round(projected.y / PIXELS_PER_FOOT) * PIXELS_PER_FOOT,
      isWorkspacePoint: true,
    };
  }

  function hostsForGusset(anchorPoint, preferredHost = null) {
    const hosts = { column: null, beam: null };
    if (preferredHost?.type === 'column') hosts.column = preferredHost;
    if (preferredHost?.type === 'beam') hosts.beam = preferredHost;
    if (!hosts.column) hosts.column = state.elements.find(item => item.type === 'column' && pointOnHost(item, anchorPoint, MEMBER_HALF_WIDTH + 10)) || null;
    if (!hosts.beam) hosts.beam = state.elements.find(item => item.type === 'beam' && pointOnHost(item, anchorPoint, MEMBER_HALF_WIDTH + 10)) || null;
    return hosts;
  }

  function updateGussetHosts(element, preferredHost = null) {
    if (!element || element.type !== 'gusset') return;
    const anchor = getPointById(element.attachedGridPointId);
    if (!anchor) return;
    const hosts = hostsForGusset(anchor, preferredHost || elementById(element.hostElementId));
    element.hostColumnId = hosts.column?.id || '';
    element.hostBeamId = hosts.beam?.id || '';
    element.hostElementId = preferredHost?.id || element.hostColumnId || element.hostBeamId || element.hostElementId || '';
  }

  function rotateLocal(point, angle, side = 1) {
    const y = point.y * side;
    return {
      x: Math.cos(angle) * point.x - Math.sin(angle) * y,
      y: Math.sin(angle) * point.x + Math.cos(angle) * y,
    };
  }

  function hostEndpointForPoint(host, svgPoint) {
    const [start, end] = getElementStartEnd(host);
    if (!start || !end) return null;
    return distanceToPoint(start, svgPoint) <= distanceToPoint(end, svgPoint) ? start : end;
  }

  function normalSideTowardFrame(point, angle) {
    const center = frameCenterPoint();
    const toCenter = { x: center.x - point.x, y: center.y - point.y };
    const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
    return normal.x * toCenter.x + normal.y * toCenter.y >= 0 ? 1 : -1;
  }

  function gussetPlacementFor(element, point) {
    const anchor = getPointById(element.attachedGridPointId) || point;
    const center = frameCenterPoint();
    const column = elementById(element.hostColumnId, 'column') || elementById(element.hostElementId, 'column');
    const beam = elementById(element.hostBeamId, 'beam') || elementById(element.hostElementId, 'beam');
    const hosts = hostsForGusset(anchor, column || beam);
    const hostColumn = column || hosts.column;
    const hostBeam = beam || hosts.beam;
    const xDir = center.x >= anchor.x ? 1 : -1;
    const yDir = center.y >= anchor.y ? 1 : -1;
    const base = {
      x: hostColumn ? anchor.x + xDir * MEMBER_HALF_WIDTH : anchor.x,
      y: hostBeam ? anchor.y + yDir * MEMBER_HALF_WIDTH : anchor.y,
    };
    let points;
    if (hostColumn && hostBeam) {
      points = [
        base,
        { x: base.x + xDir * GUSSET_LONG_LEG, y: base.y },
        { x: base.x + xDir * GUSSET_LONG_LEG, y: base.y + yDir * GUSSET_SHORT_LEG },
        { x: base.x + xDir * GUSSET_SHORT_LEG, y: base.y + yDir * GUSSET_LONG_LEG },
        { x: base.x, y: base.y + yDir * GUSSET_LONG_LEG },
      ];
    } else if (hostBeam) {
      points = [
        { x: base.x - xDir * GUSSET_SHORT_LEG * 0.5, y: base.y },
        { x: base.x + xDir * GUSSET_SHORT_LEG * 0.5, y: base.y },
        { x: base.x + xDir * GUSSET_SHORT_LEG * 0.85, y: base.y + yDir * GUSSET_SHORT_LEG },
        { x: base.x, y: base.y + yDir * GUSSET_LONG_LEG },
        { x: base.x - xDir * GUSSET_SHORT_LEG * 0.85, y: base.y + yDir * GUSSET_SHORT_LEG },
      ];
    } else if (hostColumn) {
      points = [
        { x: base.x, y: base.y - yDir * GUSSET_SHORT_LEG * 0.5 },
        { x: base.x + xDir * GUSSET_SHORT_LEG, y: base.y - yDir * GUSSET_SHORT_LEG * 0.85 },
        { x: base.x + xDir * GUSSET_LONG_LEG, y: base.y },
        { x: base.x + xDir * GUSSET_SHORT_LEG, y: base.y + yDir * GUSSET_SHORT_LEG * 0.85 },
        { x: base.x, y: base.y + yDir * GUSSET_SHORT_LEG * 0.5 },
      ];
    } else {
      const inward = unitVector(anchor, center);
      const corner = {
        x: anchor.x + inward.x * GUSSET_HOST_OFFSET,
        y: anchor.y + inward.y * GUSSET_HOST_OFFSET,
      };
      points = [
        corner,
        { x: corner.x + xDir * GUSSET_LONG_LEG, y: corner.y },
        { x: corner.x + xDir * GUSSET_SHORT_LEG, y: corner.y + yDir * GUSSET_LONG_LEG },
        { x: corner.x, y: corner.y + yDir * GUSSET_SHORT_LEG },
      ];
    }
    const pin = {
      x: base.x + xDir * (hostColumn && hostBeam ? 52 : hostColumn ? 58 : 0),
      y: base.y + yDir * (hostColumn && hostBeam ? 52 : hostBeam ? 58 : 0),
    };
    if (!hostColumn && !hostBeam) {
      pin.x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      pin.y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    }
    const axisStart = { x: anchor.x, y: anchor.y };
    const axisEnd = pin;
    return {
      anchor,
      base,
      points,
      pin,
      axisStart,
      axisEnd,
      angle: getAngle(axisStart, axisEnd),
      side: normalSideTowardFrame(axisStart, getAngle(axisStart, axisEnd)),
      hostColumn,
      hostBeam,
    };
  }

  setPlacementMode = function setPlacementModeOverride(mode) {
    state.pendingStartGussetId = null;
    originalSetPlacementMode(mode);
  };

  const originalOpenProjectSetup = openProjectSetup;
  openProjectSetup = function openProjectSetupOverride() {
    originalOpenProjectSetup();
    const widthInput = document.getElementById('canvasWidthFt');
    const heightInput = document.getElementById('canvasHeightFt');
    const bayInput = document.getElementById('bayWidthFt');
    const storyInput = document.getElementById('storyHeightFt');
    if (widthInput) widthInput.value = String(projectCanvasWidthFt());
    if (heightInput) heightInput.value = String(projectCanvasHeightFt());
    if (bayInput) bayInput.value = String(projectBayWidthFt());
    if (storyInput) storyInput.value = String(projectStoryHeightFt());
  };

  const originalUpdateProjectInfo = updateProjectInfo;
  updateProjectInfo = function updateProjectInfoOverride() {
    originalUpdateProjectInfo();
    if (!state.project) return;
    els.projectMeta.textContent = `${state.project.name} - ${projectCanvasWidthFt()}ft x ${projectCanvasHeightFt()}ft canvas, ${projectBayWidthFt()}ft bays, ${projectStoryHeightFt()}ft stories`;
  };

  function getGussetPinPoint(gussetOrId) {
    const element = typeof gussetOrId === 'string'
      ? state.elements.find(item => item.id === gussetOrId)
      : gussetOrId;
    if (!element || element.type !== 'gusset') return null;
    const node = getPointById(element.attachedGridPointId);
    if (!node) return null;
    const placement = gussetPlacementFor(element, node);
    return {
      id: element.id,
      x: placement.pin.x,
      y: placement.pin.y,
    };
  }

  BRBSymbol = function BRBSymbolAssetOverride(element) {
    const [start, end] = getElementStartEnd(element);
    const group = createSvg('g', { class: `element brb-element${elementClass(element)}`, 'data-id': element.id });
    if (!start || !end) return group;
    append(group, BraceAssetSymbol(start, end));
    const mid = getMidpoint(start, end);
    const normal = getNormalOffset(start, end, -28);
    append(group, labelTag(mid.x + normal.x, mid.y + normal.y, element.mark, 'middle'));
    attachElementEvents(group, element);
    return group;
  };

  createColumn = function createColumnOverride(startGridPointId, endGridPointId) {
    const start = getPointById(startGridPointId);
    const end = getPointById(endGridPointId);
    if (!start || !end || Math.abs(start.x - end.x) > 0.1 || Math.abs(start.y - end.y) < 0.1) {
      els.modeHint.textContent = 'Column needs two different points on the same vertical gridline.';
      return null;
    }
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
    return element;
  };

  createBeam = function createBeamOverride(startGridPointId, endGridPointId) {
    const start = getPointById(startGridPointId);
    const end = getPointById(endGridPointId);
    if (!start || !end || Math.abs(start.y - end.y) > 0.1 || Math.abs(start.x - end.x) < 0.1) {
      els.modeHint.textContent = 'Beam needs two different points on the same level.';
      return null;
    }
    const element = {
      id: nextElementId('beam'),
      type: 'beam',
      mark: nextMark('beam'),
      size: 'W24x131',
      startGridPointId,
      endGridPointId,
      level: start.yLabel || end.yLabel || defaultLevel(true),
      connectionType: 'Shear',
      notes: '',
    };
    state.elements.push(element);
    state.selectedElementId = element.id;
    return element;
  };

  GussetPlateSymbol = function GussetPlateSymbolAssetOverride(element) {
    const node = getPointById(element.attachedGridPointId);
    const group = createSvg('g', { class: `element gusset-element${elementClass(element)}`, 'data-id': element.id });
    if (!node) return group;
    updateGussetHosts(element);
    const placement = gussetPlacementFor(element, node);
    const pinPoint = getGussetPinPoint(element);
    append(
      group,
      createSvg('polygon', { points: placement.points.map(item => `${item.x},${item.y}`).join(' '), class: 'gusset-plate-body' }),
      createSvg('line', { x1: placement.axisStart.x, y1: placement.axisStart.y, x2: placement.axisEnd.x, y2: placement.axisEnd.y, class: 'gusset-axis-line' }),
      pinPoint ? Centerline(node, pinPoint) : null,
      pinPoint ? BoltPattern(pinPoint, placement.angle, Number(element.boltQuantity) || 6, 9) : null,
      pinPoint ? createSvg('circle', { cx: pinPoint.x, cy: pinPoint.y, r: 4, class: 'bolt' }) : null,
    );
    const labelPoint = pinPoint || placement.base;
    append(group, labelTag(labelPoint.x + 10, labelPoint.y - 20, element.mark));
    attachElementEvents(group, element);
    return group;
  };

  function BasePlateSymbol(element) {
    const point = getPointById(element.attachedGridPointId);
    const group = createSvg('g', { class: `element base-plate-element${elementClass(element)}`, 'data-id': element.id });
    if (!point) return group;
    append(group, BasePlateAssetSymbol(point), labelTag(point.x + 10, point.y - 12, element.mark));
    attachElementEvents(group, element);
    return group;
  }

  function FootingSymbol(element) {
    const point = getPointById(element.attachedGridPointId);
    const group = createSvg('g', { class: `element footing-element${elementClass(element)}`, 'data-id': element.id });
    if (!point) return group;
    append(group, FootingAssetSymbol(point), labelTag(point.x + 10, point.y - 12, element.mark));
    attachElementEvents(group, element);
    return group;
  }

  function SlabSymbol(element) {
    const [start, end] = getElementStartEnd(element);
    const group = createSvg('g', { class: `element slab-element${elementClass(element)}`, 'data-id': element.id });
    if (!start || !end) return group;
    append(group, LinearConcreteAssetSymbol(start, end, SLAB_ASSET, SLAB_VIEWBOX, 'slab'));
    const mid = getMidpoint(start, end);
    append(group, labelTag(mid.x, mid.y - 18, element.mark, 'middle'));
    attachElementEvents(group, element);
    return group;
  }

  function WorkPointSymbol(element) {
    const point = getPointById(element.attachedGridPointId);
    const group = createSvg('g', { class: `element work-point-element${elementClass(element)}`, 'data-id': element.id });
    if (!point) return group;
    append(group, WorkPointAssetSymbol(point), labelTag(point.x + 12, point.y - 14, element.mark));
    attachElementEvents(group, element);
    return group;
  }

  function createPointElement(type, pointId) {
    const point = getPointById(pointId);
    if (!point || !['basePlate', 'footing', 'workPoint'].includes(type)) return null;
    const count = state.elements.filter(element => element.type === type).length + 1;
    const element = {
      id: nextElementId(type),
      type,
      mark: type === 'basePlate' ? `BP-${count}` : type === 'footing' ? `FT-${count}` : `WP-${count}`,
      attachedGridPointId: point.id,
      size: type === 'basePlate' ? 'BP 2ft-10in' : type === 'footing' ? 'Footing' : 'WP',
      level: point.yLabel || '',
      notes: '',
    };
    state.elements.push(element);
    state.selectedElementId = element.id;
    state.placementMode = 'select';
    return element;
  }

  function createSlab(startGridPointId, endGridPointId) {
    const start = getPointById(startGridPointId);
    const end = getPointById(endGridPointId);
    if (!start || !end || startGridPointId === endGridPointId) {
      els.modeHint.textContent = 'Slab needs two different grid points.';
      return null;
    }
    const count = state.elements.filter(element => element.type === 'slab').length + 1;
    const element = {
      id: nextElementId('slab'),
      type: 'slab',
      mark: `S-${count}`,
      size: 'Concrete slab',
      startGridPointId,
      endGridPointId,
      level: start.yLabel === end.yLabel ? start.yLabel : `${start.yLabel || ''} to ${end.yLabel || ''}`,
      notes: '',
    };
    state.elements.push(element);
    state.selectedElementId = element.id;
    state.placementMode = 'select';
    return element;
  }

  function captureElementPointPositions() {
    const pointFields = ['startGridPointId', 'endGridPointId', 'attachedGridPointId'];
    const snapshots = new Map();
    state.elements.forEach(element => {
      const item = {};
      pointFields.forEach(field => {
        if (!element[field]) return;
        const point = getPointById(element[field]);
        if (point) item[field] = { id: element[field], x: point.x, y: point.y };
      });
      snapshots.set(element.id, item);
    });
    return snapshots;
  }

  function pointIdFromSnapshot(snapshot) {
    if (!snapshot) return '';
    const existing = getPointById(snapshot.id);
    if (existing) return snapshot.id;
    const xFt = Math.round(snapshot.x / PIXELS_PER_FOOT);
    const yFt = Math.round(snapshot.y / PIXELS_PER_FOOT);
    return workspacePointId(xFt, yFt);
  }

  function restoreElementPointPositions(snapshots) {
    const pointFields = ['startGridPointId', 'endGridPointId', 'attachedGridPointId'];
    state.elements.forEach(element => {
      const item = snapshots.get(element.id);
      if (!item) return;
      pointFields.forEach(field => {
        if (!element[field] || !item[field]) return;
        element[field] = pointIdFromSnapshot(item[field]);
      });
      if (element.type === 'gusset') updateGussetHosts(element);
    });
  }

  function applyProjectLayout(values, preserveElements) {
    const elementSnapshots = preserveElements ? captureElementPointPositions() : null;
    const existingElements = preserveElements ? state.elements : [];
    const existingSelection = preserveElements ? selectionIds() : [];
    const createdAt = state.project?.createdAt || new Date().toISOString();
    state.project = {
      id: preserveElements ? state.project?.id || `PRJ-${Date.now()}` : `PRJ-${Date.now()}`,
      name: values.name,
      xGridLabels: values.xGridLabels,
      yGridLabels: values.levels.slice().reverse(),
      levels: values.levels,
      createdAt,
      canvasWidthFt: values.canvasWidthFt,
      canvasHeightFt: values.canvasHeightFt,
      bayWidthFt: values.bayWidthFt,
      storyHeightFt: values.storyHeightFt,
    };
    state.gridPoints = generateGridPoints(state.project.xGridLabels, state.project.yGridLabels);
    if (preserveElements) {
      state.elements = existingElements;
      restoreElementPointPositions(elementSnapshots);
      setSelectionIds(existingSelection.filter(id => state.elements.some(element => element.id === id)));
    } else {
      state.elements = [];
      setSelectionIds([]);
    }
    state.pendingStartPointId = null;
    state.pendingStartGussetId = null;
    state.placementMode = 'select';
  }

  function createGussetOnHost(host, svgPoint) {
    if (!host || !['beam', 'column'].includes(host.type)) return;
    const anchor = snapHostPoint(host, svgPoint);
    if (!anchor) return;
    const hosts = hostsForGusset(anchor, host);
    const element = {
      id: nextElementId('gusset'),
      type: 'gusset',
      mark: nextMark('gusset'),
      attachedGridPointId: anchor.id,
      hostElementId: host.id,
      hostColumnId: hosts.column?.id || '',
      hostBeamId: hosts.beam?.id || '',
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
    state.placementMode = 'select';
    state.pendingStartGussetId = null;
  }

  function createBrbBetweenGussets(startGussetId, endGussetId) {
    if (!startGussetId || !endGussetId || startGussetId === endGussetId) return;
    const startGusset = state.elements.find(item => item.id === startGussetId && item.type === 'gusset');
    const endGusset = state.elements.find(item => item.id === endGussetId && item.type === 'gusset');
    if (!startGusset || !endGusset) return;
    const element = {
      id: nextElementId('brb'),
      type: 'brb',
      mark: nextMark('brb'),
      frameName: 'BRBF-1',
      coreArea: '4.5 in2',
      braceSize: '',
      startGridPointId: startGusset.attachedGridPointId,
      endGridPointId: endGusset.attachedGridPointId,
      startGussetId,
      endGussetId,
      level: defaultLevel(),
      notes: '',
    };
    state.elements.push(element);
    startGusset.attachedToElementId = element.id;
    endGusset.attachedToElementId = element.id;
    state.selectedElementId = element.id;
    state.pendingStartGussetId = null;
    state.placementMode = 'select';
  }

  function handleGussetForBrace(gussetId) {
    if (!state.pendingStartGussetId) {
      state.pendingStartGussetId = gussetId;
      state.selectedElementId = gussetId;
      render();
      return;
    }
    createBrbBetweenGussets(state.pendingStartGussetId, gussetId);
    render();
  }

  function findNearestGussetPin(svgPoint, maxDistance = SNAP_DISTANCE) {
    let best = null;
    let bestDistance = Infinity;
    state.elements.filter(element => element.type === 'gusset').forEach(gusset => {
      const point = getGussetPinPoint(gusset);
      if (!point) return;
      const distance = distanceToPoint(point, svgPoint);
      if (distance < bestDistance) {
        best = { gusset, point };
        bestDistance = distance;
      }
    });
    return bestDistance <= maxDistance ? best : null;
  }

  function attachBrbEndpointToGusset(element, gusset, handle) {
    if (!element || element.type !== 'brb' || !gusset) return;
    if (handle === 'end') {
      if (element.startGussetId === gusset.id) return;
      element.endGussetId = gusset.id;
      element.endGridPointId = gusset.attachedGridPointId;
    } else {
      if (element.endGussetId === gusset.id) return;
      element.startGussetId = gusset.id;
      element.startGridPointId = gusset.attachedGridPointId;
    }
    state.elements.forEach(item => {
      if (item.type === 'gusset' && item.attachedToElementId === element.id && item.id !== element.startGussetId && item.id !== element.endGussetId) {
        item.attachedToElementId = '';
      }
    });
    const start = state.elements.find(item => item.id === element.startGussetId);
    const end = state.elements.find(item => item.id === element.endGussetId);
    if (start) start.attachedToElementId = element.id;
    if (end) end.attachedToElementId = element.id;
  }

  function beginElementDrag(event, elementId, handle = 'body') {
    if (state.placementMode !== 'select') return;
    const element = state.elements.find(item => item.id === elementId);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const [start, end] = getElementStartEnd(element);
    if (event.metaKey || event.ctrlKey) {
      setSelectionIds(selectionIds().includes(element.id)
        ? selectionIds().filter(id => id !== element.id)
        : [...selectionIds(), element.id]);
      state.selectionToggleConsumed = true;
      render();
      return;
    }
    if (!selectionIds().includes(element.id)) {
      setSelectionIds([element.id]);
    }
    state.drag = {
      elementId,
      handle,
      didMove: false,
      startSvgPoint: eventToSvgPoint(event),
      originalStartGridPointId: element.startGridPointId || element.attachedGridPointId || '',
      originalEndGridPointId: element.endGridPointId || '',
      originalStartPoint: start ? { ...start } : null,
      originalEndPoint: end ? { ...end } : null,
    };
    els.frameCanvas.setPointerCapture(event.pointerId);
    render();
  }

  function gridAddress(pointId) {
    const point = getPointById(pointId);
    if (!point || !state.project) return null;
    if (point.isWorkspacePoint) {
      return {
        xIndex: Math.round(point.x / PIXELS_PER_FOOT),
        yIndex: Math.round(point.y / PIXELS_PER_FOOT),
        workspace: true,
      };
    }
    return {
      xIndex: state.project.xGridLabels.indexOf(point.xLabel),
      yIndex: verticalLabels().indexOf(point.yLabel),
    };
  }

  function pointByAddress(xIndex, yIndex) {
    const xLabel = state.project?.xGridLabels?.[xIndex];
    const yLabel = verticalLabels()[yIndex];
    if (xLabel && yLabel) return getPointByLabels(xLabel, yLabel);
    const size = canvasSize();
    const x = xIndex * PIXELS_PER_FOOT;
    const y = yIndex * PIXELS_PER_FOOT;
    if (x < 0 || y < 0 || x > size.width || y > size.height) return null;
    return getPointById(workspacePointId(xIndex, yIndex));
  }

  function syncAttachedGussets(element, oldStartGridPointId, oldEndGridPointId) {
    if (element.type !== 'brb') return;
    state.elements.forEach(item => {
      if (item.type !== 'gusset' || item.attachedToElementId !== element.id) return;
      if (item.attachedGridPointId === oldStartGridPointId) item.attachedGridPointId = element.startGridPointId;
      if (item.attachedGridPointId === oldEndGridPointId) item.attachedGridPointId = element.endGridPointId;
    });
  }

  function dragEndpointTo(element, point) {
    const oldStartGridPointId = element.startGridPointId;
    const oldEndGridPointId = element.endGridPointId;
    if (state.drag.handle === 'point') {
      element.attachedGridPointId = point.id;
      if (element.type === 'gusset') {
        element.attachedToElementId = nearestBrbEndpoint(null, point, 18)?.elementId || element.attachedToElementId || '';
        updateGussetHosts(element);
      }
    } else if (state.drag.handle === 'end') {
      element.endGridPointId = point.id;
    } else {
      element.startGridPointId = point.id;
    }
    syncAttachedGussets(element, oldStartGridPointId, oldEndGridPointId);
  }

  function dragBodyTo(element, svgPoint) {
    const oldStartGridPointId = element.startGridPointId;
    const oldEndGridPointId = element.endGridPointId;
    const originalStartId = state.drag.originalStartGridPointId;
    const originalEndId = state.drag.originalEndGridPointId;
    const originalAddress = gridAddress(originalStartId);
    if (!originalAddress || !state.drag.startSvgPoint || !state.drag.originalStartPoint) return;
    const targetStart = findNearestGridPoint({
      x: state.drag.originalStartPoint.x + svgPoint.x - state.drag.startSvgPoint.x,
      y: state.drag.originalStartPoint.y + svgPoint.y - state.drag.startSvgPoint.y,
    }, SNAP_DISTANCE);
    if (!targetStart) return;
    if (isPointElement(element)) {
      element.attachedGridPointId = targetStart.id;
      if (element.type === 'gusset') {
        element.attachedToElementId = nearestBrbEndpoint(null, targetStart, 18)?.elementId || element.attachedToElementId || '';
        updateGussetHosts(element);
      }
      return;
    }
    const targetAddress = gridAddress(targetStart.id);
    const endAddress = gridAddress(originalEndId);
    if (!targetAddress || !endAddress) return;
    const movedEnd = pointByAddress(
      endAddress.xIndex + targetAddress.xIndex - originalAddress.xIndex,
      endAddress.yIndex + targetAddress.yIndex - originalAddress.yIndex,
    );
    if (!movedEnd) return;
    element.startGridPointId = targetStart.id;
    element.endGridPointId = movedEnd.id;
    syncAttachedGussets(element, oldStartGridPointId, oldEndGridPointId);
  }

  function handleDragPointerMove(event) {
    if (!state.drag) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const element = state.elements.find(item => item.id === state.drag.elementId);
    if (!element) return;
    const svgPoint = eventToSvgPoint(event);
    state.pointerSvgPoint = svgPoint;
    const isBrbEndpointDrag = element.type === 'brb' && state.drag.handle !== 'body' && (element.startGussetId || element.endGussetId);
    const nearestGusset = isBrbEndpointDrag ? findNearestGussetPin(svgPoint, SNAP_DISTANCE) : null;
    state.snapPointId = isBrbEndpointDrag ? null : findNearestGridPoint(svgPoint, SNAP_DISTANCE)?.id || null;
    const distance = Math.hypot(svgPoint.x - state.drag.startSvgPoint.x, svgPoint.y - state.drag.startSvgPoint.y);
    state.drag.didMove = state.drag.didMove || distance > 3;
    if (nearestGusset) attachBrbEndpointToGusset(element, nearestGusset.gusset, state.drag.handle);
    else if (state.drag.handle === 'body') dragBodyTo(element, svgPoint);
    else if (state.snapPointId) dragEndpointTo(element, getPointById(state.snapPointId));
    renderCanvas();
    renderTable();
  }

  function finishElementDrag(event) {
    if (!state.drag) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    state.justDragged = state.drag.didMove;
    state.drag = null;
    state.pointerSvgPoint = null;
    state.snapPointId = null;
    try {
      els.frameCanvas.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture may already be released by the browser.
    }
    render();
  }

  handleGridPointClick = function handleGridPointClickOverride(pointId) {
    if (state.placementMode === 'basePlate' || state.placementMode === 'footing' || state.placementMode === 'workPoint') {
      createPointElement(state.placementMode, pointId);
      return render();
    }
    if (state.placementMode === 'slab') {
      if (!state.pendingStartPointId) {
        state.pendingStartPointId = pointId;
        state.snapPointId = pointId;
        return render();
      }
      if (state.pendingStartPointId === pointId) return;
      const created = createSlab(state.pendingStartPointId, pointId);
      if (!created) {
        state.snapPointId = pointId;
        return render();
      }
      state.pendingStartPointId = null;
      state.placementMode = 'select';
      return render();
    }
    if (state.placementMode === 'column' || state.placementMode === 'beam') {
      if (!state.pendingStartPointId) {
        state.pendingStartPointId = pointId;
        state.snapPointId = pointId;
        return render();
      }
      if (state.pendingStartPointId === pointId) return;
      const created = state.placementMode === 'column'
        ? createColumn(state.pendingStartPointId, pointId)
        : createBeam(state.pendingStartPointId, pointId);
      if (!created) {
        state.snapPointId = pointId;
        return render();
      }
      state.pendingStartPointId = null;
      state.placementMode = 'select';
      return render();
    }
  };

  handleCanvasClick = function handleCanvasClickOverride(event) {
    if (!state.project) return;
    if (state.justDragged) {
      state.justDragged = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.target.closest?.('.element')) return;
    const svgPoint = eventToSvgPoint(event);
    if (state.placementMode === 'column' || state.placementMode === 'beam' || state.placementMode === 'slab' || state.placementMode === 'basePlate' || state.placementMode === 'footing' || state.placementMode === 'workPoint') {
      const nearest = findNearestGridPoint(svgPoint, SNAP_DISTANCE);
      if (nearest) handleGridPointClick(nearest.id);
      return;
    }
    if (state.placementMode === 'gusset' || state.placementMode === 'brb') return;
    if (state.placementMode === 'select') setSelectedElement(null);
  };

  attachElementEvents = function attachElementEventsOverride(node, element) {
    node.classList.add('drag-target');
    node.addEventListener('pointerdown', event => beginElementDrag(event, element.id, 'body'));
    node.addEventListener('click', event => {
      event.stopPropagation();
      const svgPoint = eventToSvgPoint(event);
      if (state.justDragged) {
        state.justDragged = false;
        return;
      }
      if (state.selectionToggleConsumed) {
        state.selectionToggleConsumed = false;
        return;
      }
      if (state.placementMode === 'gusset') {
        if (element.type === 'beam' || element.type === 'column') createGussetOnHost(element, svgPoint);
        return render();
      }
      if (state.placementMode === 'brb') {
        if (element.type === 'gusset') handleGussetForBrace(element.id);
        return render();
      }
      setSelectedElement(element.id, event.metaKey || event.ctrlKey);
      state.placementMode = 'select';
      state.pendingStartPointId = null;
    });
  };

  propertiesTemplate = function propertiesTemplateOverride(element) {
    if (element.type === 'basePlate' || element.type === 'footing' || element.type === 'workPoint') {
      const shared = `
        <div class="selection-summary"><span>${escapeHtml(element.type)}</span><strong>${escapeHtml(element.id)}</strong></div>
        <label>Mark<input name="mark" value="${escapeHtml(element.mark)}" /></label>
      `;
      const notes = `<label>Notes<textarea name="notes" rows="4">${escapeHtml(element.notes)}</textarea></label>`;
      return `${shared}
        <label>Attached Grid Point<select name="attachedGridPointId">${pointOptions(element.attachedGridPointId)}</select></label>
        <label>Size<input name="size" value="${escapeHtml(element.size || '')}" /></label>
        ${notes}`;
    }
    if (element.type === 'slab') {
      const shared = `
        <div class="selection-summary"><span>${escapeHtml(element.type)}</span><strong>${escapeHtml(element.id)}</strong></div>
        <label>Mark<input name="mark" value="${escapeHtml(element.mark)}" /></label>
      `;
      const notes = `<label>Notes<textarea name="notes" rows="4">${escapeHtml(element.notes)}</textarea></label>`;
      return `${shared}
        <label>Size<input name="size" value="${escapeHtml(element.size || '')}" /></label>
        <div class="form-grid">
          <label>Start<select name="startGridPointId">${pointOptions(element.startGridPointId)}</select></label>
          <label>End<select name="endGridPointId">${pointOptions(element.endGridPointId)}</select></label>
        </div>
        <label>Level<input name="level" value="${escapeHtml(element.level || '')}" /></label>
        ${notes}`;
    }
    if (element.type !== 'column') return originalPropertiesTemplate(element);
    const shared = `
      <div class="selection-summary"><span>${escapeHtml(element.type)}</span><strong>${escapeHtml(element.id)}</strong></div>
      <label>Mark<input name="mark" value="${escapeHtml(element.mark)}" /></label>
    `;
    const notes = `<label>Notes<textarea name="notes" rows="4">${escapeHtml(element.notes)}</textarea></label>`;
    return `${shared}
      <label>Size<input name="size" value="${escapeHtml(element.size)}" /></label>
      <div class="form-grid">
        <label>Start<select name="startGridPointId">${pointOptions(element.startGridPointId)}</select></label>
        <label>End<select name="endGridPointId">${pointOptions(element.endGridPointId)}</select></label>
      </div>
      <label>Orientation<select name="orientation">${optionList(['strong-axis', 'weak-axis'], element.orientation)}</select></label>
      ${notes}`;
  };

  locationFor = function locationForOverride(element) {
    if (element.type === 'column') return element.startGridPointId ? `${element.startGridPointId} -> ${element.endGridPointId}` : element.gridPointId;
    if (['gusset', 'basePlate', 'footing', 'workPoint'].includes(element.type)) return element.attachedGridPointId;
    return `${element.startGridPointId} -> ${element.endGridPointId}`;
  };

  levelFor = function levelForOverride(element) {
    if (element.type === 'column') {
      if (element.startGridPointId || element.endGridPointId) {
        const [start, end] = getElementStartEnd(element);
        return [start?.yLabel, end?.yLabel].filter(Boolean).join(' to ');
      }
      return `${element.baseLevel} to ${element.topLevel}`;
    }
    if (element.type === 'gusset') return '';
    if (element.type === 'basePlate' || element.type === 'footing' || element.type === 'workPoint') {
      return getPointById(element.attachedGridPointId)?.yLabel || element.level || '';
    }
    return element.level;
  };

  renderModeHint = function renderModeHintOverride() {
    const mode = state.placementMode;
    if (mode === 'select') els.modeHint.textContent = 'Select an element to edit its properties.';
    if (mode === 'column') els.modeHint.textContent = state.pendingStartPointId ? 'Select end point for Column.' : 'Click the start grid point for the column.';
    if (mode === 'beam') els.modeHint.textContent = state.pendingStartPointId ? 'Select end point for Beam.' : 'Click the start grid point for the beam.';
    if (mode === 'slab') els.modeHint.textContent = state.pendingStartPointId ? 'Select end grid point for Slab.' : 'Click the start grid point for the slab.';
    if (mode === 'brb') els.modeHint.textContent = state.pendingStartGussetId ? 'Click the second gusset plate for the BRB.' : 'Click the first gusset plate for the BRB.';
    if (mode === 'gusset') els.modeHint.textContent = 'Click a beam or column host near the end where the gusset belongs.';
    if (mode === 'basePlate') els.modeHint.textContent = 'Click one grid point to place a base plate.';
    if (mode === 'footing') els.modeHint.textContent = 'Click one grid point to place a footing.';
    if (mode === 'workPoint') els.modeHint.textContent = 'Click one grid point to place a work point.';
  };

  createProject = function createProjectOverride(event) {
    event?.preventDefault();
    applyProjectLayout(readProjectSetupValues(), false);
    closeProjectSetup();
    render();
  };

  function updateProjectLayout(event) {
    event?.preventDefault();
    applyProjectLayout(readProjectSetupValues(), true);
    closeProjectSetup();
    render();
  }

  els.projectForm.addEventListener('submit', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    createProject(event);
  }, true);

  document.getElementById('updateGridBtn')?.addEventListener('click', updateProjectLayout);

  els.frameCanvas.addEventListener('pointermove', handleDragPointerMove, true);
  els.frameCanvas.addEventListener('pointerup', finishElementDrag, true);
  els.frameCanvas.addEventListener('pointercancel', finishElementDrag, true);
  els.frameCanvas.addEventListener('dragstart', event => {
    event.preventDefault();
    event.stopPropagation();
  }, true);

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('theme-dark', isDark);
    const button = document.getElementById('themeToggleBtn');
    const icon = document.getElementById('themeToggleIcon');
    const label = document.getElementById('themeToggleLabel');
    if (button) {
      button.classList.toggle('active', isDark);
      button.setAttribute('aria-pressed', String(isDark));
      button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    }
    if (icon) icon.textContent = isDark ? '◯' : '◐';
    if (label) label.textContent = isDark ? 'Light' : 'Dark';
  }

  function storedTheme() {
    try {
      return localStorage.getItem('brb-lb-theme') || 'light';
    } catch (error) {
      return 'light';
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem('brb-lb-theme', theme);
    } catch (error) {
      // Local storage can be unavailable in private contexts.
    }
  }

  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
    setStoredTheme(nextTheme);
    applyTheme(nextTheme);
  });

  function setTableVisible(isVisible) {
    document.body.classList.toggle('table-hidden', !isVisible);
    const button = document.getElementById('tableToggleBtn');
    const label = document.getElementById('tableToggleLabel');
    if (button) {
      button.setAttribute('aria-pressed', String(isVisible));
      button.classList.toggle('active', isVisible);
    }
    if (label) label.textContent = isVisible ? 'Hide Table' : 'See Table';
  }

  document.getElementById('tableToggleBtn')?.addEventListener('click', () => {
    setTableVisible(document.body.classList.contains('table-hidden'));
  });

  document.getElementById('projectSetupCloseBtn')?.addEventListener('click', () => closeProjectSetup());

  els.deleteSelectedBtn.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    deleteSelected();
  }, true);

  function isEditingText(event) {
    const tagName = event.target?.tagName;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) || event.target?.isContentEditable;
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (els.modal.classList.contains('is-open')) closeProjectSetup();
      state.pendingStartPointId = null;
      state.pendingStartGussetId = null;
      state.drag = null;
      state.pointerSvgPoint = null;
      state.snapPointId = null;
      state.placementMode = 'select';
      setSelectionIds([]);
      render();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditingText(event)) {
      event.preventDefault();
      deleteSelected();
    }
  });

  applyTheme(storedTheme());
  setTableVisible(true);

  initializeDefaultProject = function initializeDefaultProjectOverride() {
    setProject('BRB Frame Layout', ['1', '2'], ['level 1', 'level 2'], false);
    state.project.canvasWidthFt = FEET_PER_CANVAS;
    state.project.canvasHeightFt = FEET_PER_CANVAS;
    state.project.bayWidthFt = 8;
    state.project.storyHeightFt = 8;
    state.gridPoints = generateGridPoints(state.project.xGridLabels, state.project.yGridLabels);
    render();
  };

  initializeDefaultProject();
}());
