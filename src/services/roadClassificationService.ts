import { AsphaltedStretch } from '../types';

function getDistanceToSegmentMeters(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const latMetersPerDegree = 111320;
  const lngMetersPerDegree = 111320 * Math.cos((a.lat * Math.PI) / 180);

  const ax = 0;
  const ay = 0;

  const bx = (b.lng - a.lng) * lngMetersPerDegree;
  const by = (b.lat - a.lat) * latMetersPerDegree;

  const px = (p.lng - a.lng) * lngMetersPerDegree;
  const py = (p.lat - a.lat) * latMetersPerDegree;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt(px * px + py * py);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  const distX = px - projX;
  const distY = py - projY;

  return Math.sqrt(distX * distX + distY * distY);
}

export function isPointInStretch(
  lat: number,
  lng: number,
  stretch: AsphaltedStretch,
  maxDistanceMeters: number
): boolean {
  if (!stretch.coordinates || stretch.coordinates.length < 2) return false;

  const point = { lat, lng };

  for (let i = 0; i < stretch.coordinates.length - 1; i++) {
    const a = stretch.coordinates[i];
    const b = stretch.coordinates[i + 1];

    const dist = getDistanceToSegmentMeters(point, a, b);
    if (dist <= maxDistanceMeters) {
      return true;
    }
  }

  return false;
}

export interface RoadDetails {
  type: 'Estrada de Terra' | 'Vicinal Asfaltada';
  limit: number;
  excess: number;
  isInfraction: boolean;
  bgColor: string;
  color: string;
  borderColor: string;
}

export function classifyPoint(
  lat: number,
  lng: number,
  speed: number,
  stretches: AsphaltedStretch[],
  maxDistanceMeters: number = 30
): RoadDetails {
  let isAsphalt = false;

  for (const stretch of stretches) {
    if (isPointInStretch(lat, lng, stretch, maxDistanceMeters)) {
      isAsphalt = true;
      break;
    }
  }

  const type = isAsphalt ? 'Vicinal Asfaltada' : 'Estrada de Terra';
  const limit = isAsphalt ? 60 : 40;

  const isInfraction = speed > limit;
  const excess = isInfraction ? speed - limit : 0;

  // Visual classes for UI colors
  const bgColor = isAsphalt ? '#F3F4F6' : '#FEF3C7';
  const color = isAsphalt ? '#374151' : '#78350F';
  const borderColor = isAsphalt ? '#9CA3AF' : '#F59E0B';

  return {
    type,
    limit,
    excess,
    isInfraction,
    bgColor,
    color,
    borderColor,
  };
}
