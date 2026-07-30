import { CAPTURE_GEOMETRY } from './constants';
import type { CaptureIssue, FaceBounds } from './types';

/**
 * Face occupancy uses the smaller of the width and height ratios in the guide
 * field. This conservative dimension is less sensitive than area to small,
 * one-axis detector jitter and prevents a clipped forehead or chin from
 * appearing valid. Bounds and guide must be expressed in the same coordinate
 * space.
 */
export function calculateFaceOccupancy(
  faceBounds: FaceBounds | null,
  guideBounds: Pick<FaceBounds, 'width' | 'height'> = {
    width: CAPTURE_GEOMETRY.guideOvalWidth,
    height: CAPTURE_GEOMETRY.guideOvalHeight,
  },
): number | null {
  if (
    !faceBounds ||
    faceBounds.width <= 0 ||
    faceBounds.height <= 0 ||
    guideBounds.width <= 0 ||
    guideBounds.height <= 0
  ) {
    return null;
  }

  return Math.min(faceBounds.width / guideBounds.width, faceBounds.height / guideBounds.height);
}

export function occupancyIssue(
  occupancy: number | null,
): Extract<CaptureIssue, 'too-close' | 'too-far'> | null {
  if (occupancy === null) return null;
  if (occupancy < CAPTURE_GEOMETRY.minimumOccupancy) return 'too-far';
  if (occupancy > CAPTURE_GEOMETRY.maximumOccupancy) return 'too-close';
  return null;
}
