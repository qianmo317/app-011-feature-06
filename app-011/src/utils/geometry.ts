import type { Pt, Room, WallSegment } from '../types';

export function dist(a: Pt, b: Pt): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function polygonArea(polygon: Pt[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

export function polygonPerimeter(polygon: Pt[]): number {
  let perim = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perim += dist(polygon[i], polygon[j]);
  }
  return perim;
}

export function getWallSegments(room: Room): WallSegment[] {
  const segs: WallSegment[] = [];
  const n = room.polygon.length;
  for (let i = 0; i < n; i++) {
    const p1 = room.polygon[i];
    const p2 = room.polygon[(i + 1) % n];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthMm = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    segs.push({ roomId: room.id, index: i, p1, p2, lengthMm, angle });
  }
  return segs;
}

export function snapAngle(dx: number, dy: number, stepDeg = 15): number {
  const angle = Math.atan2(dy, dx);
  const stepRad = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(angle / stepRad) * stepRad;
  return snapped;
}

export function snapPoint(
  pt: Pt,
  refs: Pt[],
  snapDist = 10
): { pt: Pt; snapped: boolean } {
  for (const ref of refs) {
    if (dist(pt, ref) < snapDist) {
      return { pt: { ...ref }, snapped: true };
    }
  }
  return { pt, snapped: false };
}

export function ptToMm(pt: number, scale = 1): number {
  return Math.round(pt * scale);
}

export function mmToPt(mm: number, scale = 1): number {
  return mm / scale;
}

export function formatMm(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)}m`;
  }
  return `${Math.round(mm)}mm`;
}
