export interface SliceDrawPlan {
  source: {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  };
  destination: {
    dx: number;
    dy: number;
    dw: number;
    dh: number;
  };
}

/**
 * Calculate exact source crop and destination placement for a slice
 */
export function calculateSlicePlan(
  sliceStartDocY: number,
  sliceEndDocY: number,
  sliceDocTop: number,
  rangeStartY: number,
  sourceImageWidth: number,
  sourceScaleY: number,
  sourceImageHeight?: number,
  destScaleY?: number,
  destWidth?: number,
  sourceCropX?: number,
  sourceCropWidth?: number
): SliceDrawPlan {
  // Source crop in image coordinates
  let sy = Math.max(0, Math.round((sliceStartDocY - sliceDocTop) * sourceScaleY));
  let sh = Math.max(0, Math.round((sliceEndDocY - sliceStartDocY) * sourceScaleY));

  if (typeof sourceImageHeight === 'number' && sourceImageHeight > 0) {
    sy = Math.min(sourceImageHeight - 1, sy);
    sh = Math.min(sourceImageHeight - sy, sh);
  }

  // Horizontal source crop in image coordinates
  const sx = typeof sourceCropX === 'number'
    ? Math.max(0, Math.min(sourceImageWidth - 1, Math.round(sourceCropX)))
    : 0;
  const sw = typeof sourceCropWidth === 'number'
    ? Math.max(1, Math.min(sourceImageWidth - sx, Math.round(sourceCropWidth)))
    : sourceImageWidth;

  // Destination placement on final canvas
  const effectiveDestScaleY = typeof destScaleY === 'number' ? destScaleY : sourceScaleY;
  const effectiveDestWidth = typeof destWidth === 'number' ? destWidth : sw;

  const dy = Math.round((sliceStartDocY - rangeStartY) * effectiveDestScaleY);
  const nextY = Math.round((sliceEndDocY - rangeStartY) * effectiveDestScaleY);
  const dh = Math.max(0, nextY - dy); // Prevents 1px rounding gaps

  return {
    source: {
      sx,
      sy,
      sw,
      sh,
    },
    destination: {
      dx: 0,
      dy,
      dw: effectiveDestWidth,
      dh,
    },
  };
}
