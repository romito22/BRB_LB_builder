import type { GridPoint } from '../types/structural';

export const GRID_SPACING = 120;
export const GRID_MARGIN = 80;

export function gridPointId(xLabel: string, yLabel: string): string {
  return `${xLabel}-${yLabel}`;
}

export function generateGridPoints(
  xGridLabels: string[],
  yGridLabels: string[],
): GridPoint[] {
  const points: GridPoint[] = [];

  yGridLabels.forEach((yLabel, yIndex) => {
    xGridLabels.forEach((xLabel, xIndex) => {
      points.push({
        id: gridPointId(xLabel, yLabel),
        xLabel,
        yLabel,
        x: GRID_MARGIN + xIndex * GRID_SPACING,
        y: GRID_MARGIN + yIndex * GRID_SPACING,
      });
    });
  });

  return points;
}
