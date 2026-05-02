(function () {
  const BRACE_ASSET = 'assets/brace.svg';
  const GUSSET_ASSET = 'assets/gusset_normal.svg';
  const GRID_MARK_ASSET = 'assets/grid_mark.svg';
  const LEVEL_MARK_ASSET = 'assets/level_mark.svg';
  const BRACE_VIEWBOX = { width: 26.286751, height: 205.07343, topPin: 24.45, bottomPin: 180.62 };
  const MARK_VIEWBOX = { width: 171.72177, height: 9.39082 };
  const GUSSET_SIZE = 96;
  const GUSSET_HOST_OFFSET = 32;
  const GUSSET_PIN_LOCAL = { x: 50, y: -38 };
  const originalSetPlacementMode = setPlacementMode;
  const originalPropertiesTemplate = propertiesTemplate;

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
    const frameWidth = Math.max(0, xLabels.length - 1) * BAY_SPACING;
    const frameHeight = Math.max(0, yLabels.length - 1) * STORY_HEIGHT;
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
          x: origin.x + xIndex * BAY_SPACING,
          y: origin.y + yIndex * STORY_HEIGHT,
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
    const maxX = origin.x + (xLabels.length - 1) * BAY_SPACING;
    const maxY = origin.y + (yLabels.length - 1) * STORY_HEIGHT;
    return { minX, minY, maxX, maxY, xLabels, yLabels };
  };

  getElementStartEnd = function getElementStartEndOverride(element) {
    if (element.type === 'column') {
      if (element.startGridPointId || element.endGridPointId) {
        return [getPointById(element.startGridPointId), getPointById(element.endGridPointId)];
      }
      return [pointForColumnLevel(element, element.baseLevel), pointForColumnLevel(element, element.topLevel)];
    }
    if (element.type === 'beam') {
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

  SelectionHandles = function SelectionHandlesOverride(element) {
    const [start, end] = getElementStartEnd(element);
    if (!start) return null;
    const group = createSvg('g', { class: 'selection-handles' });
    const handles = element.type === 'gusset'
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
    const defs = createSvg('defs');
    const pattern = createSvg('pattern', {
      id: 'draftingGrid',
      width: PIXELS_PER_FOOT,
      height: PIXELS_PER_FOOT,
      patternUnits: 'userSpaceOnUse',
    });
    append(pattern,
      createSvg('path', { d: `M ${PIXELS_PER_FOOT} 0 V ${PIXELS_PER_FOOT} M 0 ${PIXELS_PER_FOOT} H ${PIXELS_PER_FOOT}`, class: 'sheet-grid-major' }),
    );
    append(defs, pattern);
    append(svg, defs);
    append(svg,
      createSvg('rect', { x: 0, y: 0, width: size.width, height: size.height, class: 'drawing-sheet' }),
      createSvg('rect', { x: 0, y: 0, width: size.width, height: size.height, class: 'sheet-grid-fill' }),
    );
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
    state.elements.filter(element => element.type === 'beam').forEach(element => svg.appendChild(BeamSymbol(element)));
    state.elements.filter(element => element.type === 'brb').forEach(element => svg.appendChild(BRBSymbol(element)));
    state.elements.filter(element => element.type === 'column').forEach(element => svg.appendChild(ColumnSymbol(element)));
    state.elements.filter(element => element.type === 'gusset').forEach(element => svg.appendChild(GussetPlateSymbol(element)));
    renderSelection(svg);
    renderGridPoints(svg);
    renderPlacementPreview(svg);
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

  function renderMarkerText(svg, x, y, text, className = 'grid-label') {
    const label = createSvg('text', { x, y, class: className, 'text-anchor': 'middle' });
    label.textContent = text;
    append(svg, label);
  }

  renderGrid = function renderGridWithAssets(svg, minX, minY, maxX, maxY) {
    const levelMarkWidth = Math.min(176, Math.max(124, minX - 16));
    verticalLabels().forEach((label, index) => {
      const y = SHEET_PAD_TOP + index * STORY_HEIGHT;
      append(svg,
        createSvg('line', { x1: minX - 42, y1: y, x2: maxX + 42, y2: y, class: 'grid-line' }),
        MarkAsset(LEVEL_MARK_ASSET, minX - levelMarkWidth, y - MARK_VIEWBOX.height / 2, levelMarkWidth, MARK_VIEWBOX.height),
      );
      append(svg, labelTag(minX - levelMarkWidth + 8, y + 4, label, 'start'));
    });

    state.project.xGridLabels.forEach((label, index) => {
      const x = SHEET_PAD_X + index * BAY_SPACING;
      append(svg, createSvg('line', { x1: x, y1: minY - 42, x2: x, y2: maxY + 42, class: 'grid-line' }));
      append(svg,
        MarkAsset(GRID_MARK_ASSET, -142, -MARK_VIEWBOX.height / 2, 142, MARK_VIEWBOX.height, `translate(${x} ${minY - 28}) rotate(90)`),
        MarkAsset(GRID_MARK_ASSET, -142, -MARK_VIEWBOX.height / 2, 142, MARK_VIEWBOX.height, `translate(${x} ${maxY + 28}) rotate(-90)`),
      );
      renderMarkerText(svg, x, minY - 66, label);
      renderMarkerText(svg, x, maxY + 76, label);
    });
    append(svg, createSvg('line', { x1: 52, y1: maxY + 104, x2: maxX + 116, y2: maxY + 104, class: 'sheet-title-line' }));
  };

  renderPlacementPreview = function renderPlacementPreviewOverride(svg) {
    if (!state.pendingStartPointId || !['column', 'beam'].includes(state.placementMode)) return;
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

  function frameCenterPoint() {
    const { minX, minY, maxX, maxY } = drawingExtents();
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  function unitVector(from, to) {
    const length = distanceToPoint(from, to);
    if (!length) return { x: 1, y: 0 };
    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
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
    const node = getPointById(element.attachedGridPointId) || point;
    const center = frameCenterPoint();
    const inward = unitVector(node, center);
    const corner = {
      x: node.x + inward.x * GUSSET_HOST_OFFSET,
      y: node.y + inward.y * GUSSET_HOST_OFFSET,
    };
    const angle = getAngle(corner, center);
    return { corner, angle, side: normalSideTowardFrame(corner, angle) };
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
    if (widthInput) widthInput.value = String(projectCanvasWidthFt());
    if (heightInput) heightInput.value = String(projectCanvasHeightFt());
  };

  const originalUpdateProjectInfo = updateProjectInfo;
  updateProjectInfo = function updateProjectInfoOverride() {
    originalUpdateProjectInfo();
    if (!state.project) return;
    els.projectMeta.textContent = `${state.project.name} - ${projectCanvasWidthFt()}ft x ${projectCanvasHeightFt()}ft canvas`;
  };

  function getGussetPinPoint(gussetOrId) {
    const element = typeof gussetOrId === 'string'
      ? state.elements.find(item => item.id === gussetOrId)
      : gussetOrId;
    if (!element || element.type !== 'gusset') return null;
    const node = getPointById(element.attachedGridPointId);
    if (!node) return null;
    const placement = gussetPlacementFor(element, node);
    const pin = rotateLocal(GUSSET_PIN_LOCAL, placement.angle, placement.side);
    return {
      id: element.id,
      x: placement.corner.x + pin.x,
      y: placement.corner.y + pin.y,
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
  };

  GussetPlateSymbol = function GussetPlateSymbolAssetOverride(element) {
    const node = getPointById(element.attachedGridPointId);
    const group = createSvg('g', { class: `element gusset-element${elementClass(element)}`, 'data-id': element.id });
    if (!node) return group;
    const { corner, angle, side } = gussetPlacementFor(element, node);
    const pinPoint = getGussetPinPoint(element);
    append(
      group,
      GussetAssetSymbol(corner, angle, side),
      pinPoint ? Centerline(node, pinPoint) : null,
      pinPoint ? BoltPattern(pinPoint, angle, Number(element.boltQuantity) || 6, 9) : null,
      pinPoint ? createSvg('circle', { cx: pinPoint.x, cy: pinPoint.y, r: 4, class: 'bolt' }) : null,
    );
    const labelPoint = pinPoint || getOffsetPoint(corner, angle, 32);
    append(group, labelTag(labelPoint.x + 10, labelPoint.y - 20, element.mark));
    attachElementEvents(group, element);
    return group;
  };

  function createGussetOnHost(host, svgPoint) {
    if (!host || !['beam', 'column'].includes(host.type)) return;
    const endpoint = hostEndpointForPoint(host, svgPoint);
    if (!endpoint) return;
    const element = {
      id: nextElementId('gusset'),
      type: 'gusset',
      mark: nextMark('gusset'),
      attachedGridPointId: endpoint.id,
      hostElementId: host.id,
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
    state.selectedElementId = element.id;
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
    return {
      xIndex: state.project.xGridLabels.indexOf(point.xLabel),
      yIndex: verticalLabels().indexOf(point.yLabel),
    };
  }

  function pointByAddress(xIndex, yIndex) {
    const xLabel = state.project?.xGridLabels?.[xIndex];
    const yLabel = verticalLabels()[yIndex];
    return xLabel && yLabel ? getPointByLabels(xLabel, yLabel) : null;
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
      element.attachedToElementId = nearestBrbEndpoint(null, point, 18)?.elementId || element.attachedToElementId || '';
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
    if (element.type === 'gusset') {
      element.attachedGridPointId = targetStart.id;
      element.attachedToElementId = nearestBrbEndpoint(null, targetStart, 18)?.elementId || element.attachedToElementId || '';
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
    if (state.placementMode === 'column' || state.placementMode === 'beam') {
      if (!state.pendingStartPointId) {
        state.pendingStartPointId = pointId;
        state.snapPointId = pointId;
        return render();
      }
      if (state.pendingStartPointId === pointId) return;
      if (state.placementMode === 'column') createColumn(state.pendingStartPointId, pointId);
      if (state.placementMode === 'beam') createBeam(state.pendingStartPointId, pointId);
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
    if (state.placementMode === 'column' || state.placementMode === 'beam') {
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
      if (state.placementMode === 'gusset') {
        if (element.type === 'beam' || element.type === 'column') createGussetOnHost(element, svgPoint);
        return render();
      }
      if (state.placementMode === 'brb') {
        if (element.type === 'gusset') handleGussetForBrace(element.id);
        return render();
      }
      setSelectedElement(element.id);
      state.placementMode = 'select';
      state.pendingStartPointId = null;
    });
  };

  propertiesTemplate = function propertiesTemplateOverride(element) {
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
    if (element.type === 'gusset') return element.attachedGridPointId;
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
    return element.level;
  };

  renderModeHint = function renderModeHintOverride() {
    const mode = state.placementMode;
    if (mode === 'select') els.modeHint.textContent = 'Select an element to edit its properties.';
    if (mode === 'column') els.modeHint.textContent = state.pendingStartPointId ? 'Select end point for Column.' : 'Click the start grid point for the column.';
    if (mode === 'beam') els.modeHint.textContent = state.pendingStartPointId ? 'Select end point for Beam.' : 'Click the start grid point for the beam.';
    if (mode === 'brb') els.modeHint.textContent = state.pendingStartGussetId ? 'Click the second gusset plate for the BRB.' : 'Click the first gusset plate for the BRB.';
    if (mode === 'gusset') els.modeHint.textContent = 'Click a beam or column host near the end where the gusset belongs.';
  };

  createProject = function createProjectOverride(event) {
    event?.preventDefault();
    const name = document.getElementById('projectName').value.trim();
    const xGridLabels = parseCsv(document.getElementById('xLabels').value);
    const levels = parseCsv(document.getElementById('levels').value);
    const canvasWidthFt = clampNumber(document.getElementById('canvasWidthFt')?.value, 10, 200, FEET_PER_CANVAS);
    const canvasHeightFt = clampNumber(document.getElementById('canvasHeightFt')?.value, 10, 200, FEET_PER_CANVAS);
    setProject(name, xGridLabels, levels, false);
    state.project.canvasWidthFt = canvasWidthFt;
    state.project.canvasHeightFt = canvasHeightFt;
    state.gridPoints = generateGridPoints(state.project.xGridLabels, state.project.yGridLabels);
    closeProjectSetup();
    render();
  };

  els.projectForm.addEventListener('submit', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    createProject(event);
  }, true);

  els.frameCanvas.addEventListener('pointermove', handleDragPointerMove, true);
  els.frameCanvas.addEventListener('pointerup', finishElementDrag, true);
  els.frameCanvas.addEventListener('pointercancel', finishElementDrag, true);
  els.frameCanvas.addEventListener('dragstart', event => {
    event.preventDefault();
    event.stopPropagation();
  }, true);

  initializeDefaultProject = function initializeDefaultProjectOverride() {
    setProject('BRB Frame Layout', ['A', 'B'], ['1', '2'], false);
    state.project.canvasWidthFt = FEET_PER_CANVAS;
    state.project.canvasHeightFt = FEET_PER_CANVAS;
    render();
  };

  initializeDefaultProject();
}());
