import type { StructuralElement } from '../types/structural';

export interface ExportRow {
  id: string;
  type: string;
  mark: string;
  location: string;
  sizeOrCoreArea: string;
  level: string;
  notes: string;
}

export function elementToExportRow(element: StructuralElement): ExportRow {
  if (element.type === 'column') {
    return {
      id: element.id,
      type: element.type,
      mark: element.mark,
      location: element.gridPointId,
      sizeOrCoreArea: element.size,
      level: `${element.baseLevel} to ${element.topLevel}`,
      notes: element.notes,
    };
  }

  if (element.type === 'gusset') {
    return {
      id: element.id,
      type: element.type,
      mark: element.mark,
      location: element.attachedGridPointId,
      sizeOrCoreArea: element.thickness,
      level: '',
      notes: element.notes,
    };
  }

  return {
    id: element.id,
    type: element.type,
    mark: element.mark,
    location: `${element.startGridPointId} -> ${element.endGridPointId}`,
    sizeOrCoreArea: element.type === 'brb' ? element.coreArea || element.braceSize : element.size,
    level: element.level,
    notes: element.notes,
  };
}

export function toCsv(rows: ExportRow[]): string {
  const headers = ['id', 'type', 'mark', 'location', 'sizeOrCoreArea', 'level', 'notes'];
  return [headers, ...rows.map(row => headers.map(key => row[key as keyof ExportRow]))]
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
