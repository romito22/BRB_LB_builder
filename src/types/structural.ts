export interface Project {
  id: string;
  name: string;
  xGridLabels: string[];
  yGridLabels: string[];
  levels: string[];
  createdAt: string;
}

export interface GridPoint {
  id: string;
  xLabel: string;
  yLabel: string;
  x: number;
  y: number;
}

export interface StructuralElementBase {
  id: string;
  type: StructuralElementType;
  mark: string;
  notes: string;
}

export type StructuralElementType = 'column' | 'beam' | 'brb' | 'gusset';

export interface ColumnElement extends StructuralElementBase {
  type: 'column';
  size: string;
  gridPointId: string;
  baseLevel: string;
  topLevel: string;
  orientation: 'strong-axis' | 'weak-axis';
}

export interface BeamElement extends StructuralElementBase {
  type: 'beam';
  size: string;
  startGridPointId: string;
  endGridPointId: string;
  level: string;
  connectionType: string;
}

export interface BRBElement extends StructuralElementBase {
  type: 'brb';
  frameName: string;
  coreArea: string;
  braceSize: string;
  startGridPointId: string;
  endGridPointId: string;
  level: string;
}

export interface GussetPlateElement extends StructuralElementBase {
  type: 'gusset';
  attachedGridPointId: string;
  attachedToElementId?: string;
  thickness: string;
  width: string;
  height: string;
  boltDiameter: string;
  boltQuantity: number;
}

export type StructuralElement =
  | ColumnElement
  | BeamElement
  | BRBElement
  | GussetPlateElement;

export type PlacementMode = 'select' | 'column' | 'beam' | 'brb' | 'gusset';
