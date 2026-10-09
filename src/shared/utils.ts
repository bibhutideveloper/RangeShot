/**
 * Wait for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format timestamp as YYYY-MM-DD-HHmmss
 */
export function formatTimestamp(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d}-${h}${min}${s}`;
}

/**
 * Format standard download filename for RangeShot
 */
export function generateFilename(): string {
  return `rangeshot-${formatTimestamp()}.png`;
}

import type { CaptureRange } from './types.ts';

/**
 * Normalize range so startY <= endY and startX <= endX
 */
export function normalizeRange(
  y1: number,
  y2: number,
  x1?: number,
  x2?: number
): CaptureRange {
  const range: CaptureRange = {
    startY: Math.min(y1, y2),
    endY: Math.max(y1, y2),
  };
  if (typeof x1 === 'number' && typeof x2 === 'number') {
    range.startX = Math.min(x1, x2);
    range.endX = Math.max(x1, x2);
  }
  return range;
}

/**
 * Clamp a number between min and max
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}
