(function () {
  const BRACE_ASSET = 'assets/brace.svg';
  const GUSSET_ASSET = 'assets/gusset_normal.svg';
  const GRID_MARK_ASSET = 'assets/grid_mark.svg';
  const LEVEL_MARK_ASSET = 'assets/level_mark.svg';
  const BRACE_VIEWBOX = { width: 11.58579, height: 202.38155, topPin: 13.45, bottomPin: 188.95 };
  const MARK_VIEWBOX = { width: 171.72177, height: 9.39082 };
  const GUSSET_SIZE = 76;
  const originalPropertiesTemplate = propertiesTemplate;

  getElementStartEnd = function getElementStartEndOverride(element) {
    if (element.type === 'column') {
      if (element.startGridPointId || element.endGridPointId) {
        return [getPointById(element.startGridPointId), getPointById(element.endGridPointId)];
      }
      return [pointForColumnLevel(element, element.baseLevel), pointForColumnLevel(element, element.topLevel)];
    }
    if (element.type === 'beam' || element.type === 'brb') {
      return [getPointById(element.startGridPointId), getPointById(element.endGridPointId)];
    }
    const point = getPointById(element.attachedGridPointId);
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

  function normalSideTowardFrame(point, angle) {
    const center = frameCenterPoint();
    const toCenter = { x: center.x - point.x, y: center.y - point.y };
    const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
    return normal.x * toCenter.x + normal.y * toCenter.y >= 0 ? 1 : -1;
  }

  function gussetPlacementFor(element, point) {
    const brb = state.elements.find(item => item.id === element.attachedToElementId && item.type === 'brb');
    if (brb) {
      const [start, end] = getElementStartEnd(brb);
      if (start && end) {
        const other = point.id === start.id ? end : start;
        const angle = getAngle(point, other);
        return { angle, side: normalSideTowardFrame(point, angle) };
      }
    }
    const center = frameCenterPoint();
    const angle = getAngle(point, center);
    return { angle, side: normalSideTowardFrame(point, angle) };
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
    const point = getPointById(element.attachedGridPointId);
    const group = createSvg('g', { class: `element gusset-element${elementClass(element)}`, 'data-id': element.id });
    if (!point) return group;
    const { angle, side } = gussetPlacementFor(element, point);
    append(
      group,
      GussetAssetSymbol(point, angle, side),
      Centerline(point, getOffsetPoint(point, angle, 62)),
      BoltPattern(getOffsetPoint(point, angle, 35), angle, Number(element.boltQuantity) || 6, 9),
      createSvg('circle', { cx: point.x, cy: point.y, r: 4, class: 'bolt' }),
    );
    const labelPoint = getOffsetPoint(point, angle, 32);
    append(group, labelTag(labelPoint.x + 10, labelPoint.y - 20, element.mark));
    attachElementEvents(group, element);
    return group;
  };

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
    state.snapPointId = findNearestGridPoint(svgPoint, SNAP_DISTANCE)?.id || null;
    const distance = Math.hypot(svgPoint.x - state.drag.startSvgPoint.x, svgPoint.y - state.drag.startSvgPoint.y);
    state.drag.didMove = state.drag.didMove || distance > 3;
    if (state.drag.handle === 'body') dragBodyTo(element, svgPoint);
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
    if (state.placementMode === 'column' || state.placementMode === 'beam' || state.placementMode === 'brb' || state.placementMode === 'gusset') {
      const nearest = findNearestGridPoint(svgPoint, SNAP_DISTANCE);
      if (nearest) handleGridPointClick(nearest.id);
      return;
    }
    if (state.placementMode === 'select') setSelectedElement(null);
  };

  attachElementEvents = function attachElementEventsOverride(node, element) {
    node.classList.add('drag-target');
    node.addEventListener('pointerdown', event => beginElementDrag(event, element.id, 'body'));
    node.addEventListener('click', event => {
      event.stopPropagation();
      if (state.justDragged) {
        state.justDragged = false;
        return;
      }
      if (state.placementMode === 'gusset' && element.type === 'brb') {
        const point = nearestBrbEndpoint(element, eventToSvgPoint(event));
        if (point) createGusset(point.id, element.id);
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
    if (mode === 'brb') els.modeHint.textContent = state.pendingStartPointId ? 'Select end point for BRB.' : 'Click the start grid point for the BRB.';
    if (mode === 'gusset') els.modeHint.textContent = 'Click a BRB endpoint or grid point to place a gusset plate.';
  };

  createProject = function createProjectOverride(event) {
    event?.preventDefault();
    const name = document.getElementById('projectName').value.trim();
    const xGridLabels = parseCsv(document.getElementById('xLabels').value);
    const levels = parseCsv(document.getElementById('levels').value);
    setProject(name, xGridLabels, levels, false);
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
    render();
  };

  initializeDefaultProject();
}());
