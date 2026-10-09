import { CaptureRange, CaptureSlice } from '../shared/types';
import { calculateSlicePlan } from './image-cropper';

/**
 * Load an image data URL into an HTMLImageElement
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image slice: ' + err));
    img.src = dataUrl;
  });
}


export const MAX_SAFE_CANVAS_HEIGHT = 24000;
export const MAX_SAFE_CANVAS_WIDTH = 16384;
export const MAX_SAFE_CANVAS_AREA = 80_000_000; // ~80M pixels
export const MAX_CHUNK_DOC_HEIGHT = 22000; // Split into multiple parts if document height exceeds this

/**
 * Calculate safe canvas dimensions and scale factors that will never exceed browser limits
 */
function calculateSafeDimensions(
  chunkDocHeight: number,
  sourceCropWidth: number,
  sourceScaleY: number,
  sourceScaleX: number = sourceScaleY
) {
  let destScaleY = sourceScaleY;
  let destScaleX = sourceScaleX;
  let destWidth = sourceCropWidth;
  let destHeight = Math.round(chunkDocHeight * destScaleY);

  if (destHeight > MAX_SAFE_CANVAS_HEIGHT) {
    const ratio = MAX_SAFE_CANVAS_HEIGHT / destHeight;
    destScaleY *= ratio;
    destScaleX *= ratio;
    destHeight = MAX_SAFE_CANVAS_HEIGHT;
    destWidth = Math.round(sourceCropWidth * (destScaleX / sourceScaleX));
  }

  if (destWidth > MAX_SAFE_CANVAS_WIDTH) {
    const ratio = MAX_SAFE_CANVAS_WIDTH / destWidth;
    destScaleX *= ratio;
    destScaleY *= ratio;
    destWidth = MAX_SAFE_CANVAS_WIDTH;
    destHeight = Math.round(destHeight * ratio);
  }

  if (destWidth * destHeight > MAX_SAFE_CANVAS_AREA) {
    const areaRatio = Math.sqrt(MAX_SAFE_CANVAS_AREA / (destWidth * destHeight));
    destScaleY *= areaRatio;
    destScaleX *= areaRatio;
    destWidth = Math.round(destWidth * areaRatio);
    destHeight = Math.round(destHeight * areaRatio);
  }

  return { destWidth, destHeight, destScaleY };
}

/**
 * Stitches captured viewport slices into a single unified PNG image data URL.
 * Automatically adapts canvas dimensions so browser canvas limits are never exceeded.
 */
export async function stitchSlices(
  slices: CaptureSlice[],
  range: CaptureRange,
  onProgress?: (step: number, total: number) => void
): Promise<string> {
  if (!slices || slices.length === 0) {
    throw new Error('No image slices provided for stitching');
  }

  const { startY, endY, startX, endX } = range;
  const totalDocHeight = endY - startY;

  if (totalDocHeight <= 0) {
    throw new Error(`Invalid range dimensions: startY=${startY}, endY=${endY}`);
  }

  const firstSlice = slices[0];
  const viewportWidth = firstSlice.viewportWidth;
  const effectiveStartX = typeof startX === 'number'
    ? Math.max(0, Math.min(viewportWidth - 10, startX))
    : 0;
  const effectiveEndX = typeof endX === 'number'
    ? Math.min(viewportWidth, Math.max(effectiveStartX + 10, endX))
    : viewportWidth;
  const cropDocWidth = effectiveEndX - effectiveStartX;

  const firstImage = await loadImage(firstSlice.dataUrl);
  const sourceScaleY = firstImage.naturalHeight / firstSlice.viewportHeight;
  const sourceScaleX = firstImage.naturalWidth / firstSlice.viewportWidth;

  const sourceCropX = Math.round(effectiveStartX * sourceScaleX);
  const sourceCropWidth = Math.min(
    firstImage.naturalWidth - sourceCropX,
    Math.round(cropDocWidth * sourceScaleX)
  );

  const { destWidth, destHeight, destScaleY } = calculateSafeDimensions(
    totalDocHeight,
    sourceCropWidth,
    sourceScaleY,
    sourceScaleX
  );

  const canvas = document.createElement('canvas');
  canvas.width = destWidth;
  canvas.height = destHeight;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Failed to obtain 2D canvas rendering context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let coveredDocY = startY;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    if (onProgress) {
      onProgress(i + 1, slices.length);
    }

    const img = i === 0 ? firstImage : await loadImage(slice.dataUrl);

    const sliceDocTop = slice.documentY;
    const sliceDocBottom = slice.documentY + slice.viewportHeight;

    const sliceStartDocY = Math.max(sliceDocTop, coveredDocY);
    const sliceEndDocY = Math.min(sliceDocBottom, endY);

    if (sliceEndDocY > sliceStartDocY) {
      const plan = calculateSlicePlan(
        sliceStartDocY,
        sliceEndDocY,
        sliceDocTop,
        startY,
        img.naturalWidth,
        sourceScaleY,
        img.naturalHeight,
        destScaleY,
        destWidth,
        sourceCropX,
        sourceCropWidth
      );

      ctx.drawImage(
        img,
        plan.source.sx,
        plan.source.sy,
        plan.source.sw,
        plan.source.sh,
        plan.destination.dx,
        plan.destination.dy,
        plan.destination.dw,
        plan.destination.dh
      );

      coveredDocY = sliceEndDocY;
    }

    img.src = '';
  }

  const resultDataUrl = canvas.toDataURL('image/png');
  canvas.width = 0;
  canvas.height = 0;

  return resultDataUrl;
}

/**
 * Render a single sub-range chunk into a PNG Blob
 */
async function renderChunkToBlob(
  slices: CaptureSlice[],
  chunkStartY: number,
  chunkEndY: number,
  firstImage: HTMLImageElement,
  sourceScaleY: number,
  sourceScaleX: number,
  sourceCropX: number,
  sourceCropWidth: number,
  onSliceProcessed?: () => void
): Promise<Blob> {
  const chunkHeight = chunkEndY - chunkStartY;

  const { destWidth, destHeight, destScaleY } = calculateSafeDimensions(
    chunkHeight,
    sourceCropWidth,
    sourceScaleY,
    sourceScaleX
  );

  const canvas = document.createElement('canvas');
  canvas.width = destWidth;
  canvas.height = destHeight;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Failed to obtain 2D canvas rendering context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let coveredDocY = chunkStartY;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const sliceDocTop = slice.documentY;
    const sliceDocBottom = slice.documentY + slice.viewportHeight;

    // Skip slices completely outside this chunk
    if (sliceDocBottom <= chunkStartY || sliceDocTop >= chunkEndY) {
      continue;
    }

    const img = i === 0 ? firstImage : await loadImage(slice.dataUrl);

    const sliceStartDocY = Math.max(sliceDocTop, coveredDocY);
    const sliceEndDocY = Math.min(sliceDocBottom, chunkEndY);

    if (sliceEndDocY > sliceStartDocY) {
      const plan = calculateSlicePlan(
        sliceStartDocY,
        sliceEndDocY,
        sliceDocTop,
        chunkStartY,
        img.naturalWidth,
        sourceScaleY,
        img.naturalHeight,
        destScaleY,
        destWidth,
        sourceCropX,
        sourceCropWidth
      );

      ctx.drawImage(
        img,
        plan.source.sx,
        plan.source.sy,
        plan.source.sw,
        plan.source.sh,
        plan.destination.dx,
        plan.destination.dy,
        plan.destination.dw,
        plan.destination.dh
      );

      coveredDocY = sliceEndDocY;
    }

    onSliceProcessed?.();
    if (i !== 0) {
      img.src = '';
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert stitched canvas to PNG Blob'));
      }
    }, 'image/png');
  });
}

/**
 * Stitches captured viewport slices into one or more PNG Blobs.
 * - Automatically prevents browser canvas overflow and crashes by adaptive scaling.
 * - Automatically splits extremely long ranges (> 22,000px) into clean, consecutive parts.
 */
export async function stitchSlicesToBlobs(
  slices: CaptureSlice[],
  range: CaptureRange,
  onProgress?: (step: number, total: number) => void
): Promise<Blob[]> {
  if (!slices || slices.length === 0) {
    throw new Error('No image slices provided for stitching');
  }

  const { startY, endY, startX, endX } = range;
  const totalDocHeight = endY - startY;

  if (totalDocHeight <= 0) {
    throw new Error(`Invalid range dimensions: startY=${startY}, endY=${endY}`);
  }

  const firstSlice = slices[0];
  const viewportWidth = firstSlice.viewportWidth;
  const effectiveStartX = typeof startX === 'number'
    ? Math.max(0, Math.min(viewportWidth - 10, startX))
    : 0;
  const effectiveEndX = typeof endX === 'number'
    ? Math.min(viewportWidth, Math.max(effectiveStartX + 10, endX))
    : viewportWidth;
  const cropDocWidth = effectiveEndX - effectiveStartX;

  const firstImage = await loadImage(firstSlice.dataUrl);
  const sourceScaleY = firstImage.naturalHeight / firstSlice.viewportHeight;
  const sourceScaleX = firstImage.naturalWidth / firstSlice.viewportWidth;

  const sourceCropX = Math.round(effectiveStartX * sourceScaleX);
  const sourceCropWidth = Math.min(
    firstImage.naturalWidth - sourceCropX,
    Math.round(cropDocWidth * sourceScaleX)
  );

  // Determine chunks: single image if within safe limit, or multiple parts if extremely long
  const chunks: { start: number; end: number }[] = [];
  if (totalDocHeight <= MAX_CHUNK_DOC_HEIGHT) {
    chunks.push({ start: startY, end: endY });
  } else {
    const numChunks = Math.ceil(totalDocHeight / MAX_CHUNK_DOC_HEIGHT);
    const chunkSpan = Math.ceil(totalDocHeight / numChunks);
    for (let c = 0; c < numChunks; c++) {
      const cStart = startY + c * chunkSpan;
      const cEnd = Math.min(endY, cStart + chunkSpan);
      chunks.push({ start: cStart, end: cEnd });
    }
  }

  const blobs: Blob[] = [];
  let totalSlicesProcessed = 0;
  const totalSlicesExpected = slices.length * chunks.length;

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    const blob = await renderChunkToBlob(
      slices,
      chunk.start,
      chunk.end,
      firstImage,
      sourceScaleY,
      sourceScaleX,
      sourceCropX,
      sourceCropWidth,
      () => {
        totalSlicesProcessed++;
        onProgress?.(totalSlicesProcessed, totalSlicesExpected);
      }
    );
    blobs.push(blob);
  }

  return blobs;
}

/**
 * Backward-compatible single-blob stitcher
 */
export async function stitchSlicesToBlob(
  slices: CaptureSlice[],
  range: CaptureRange,
  onProgress?: (step: number, total: number) => void
): Promise<Blob> {
  const blobs = await stitchSlicesToBlobs(slices, range, onProgress);
  return blobs[0];
}
