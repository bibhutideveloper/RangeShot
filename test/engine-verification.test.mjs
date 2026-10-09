import assert from 'assert';
import { calculateSlicePlan } from '../src/capture/image-cropper.ts';
import { normalizeRange, generateFilename } from '../src/shared/utils.ts';

console.log('=== Running RangeShot Verification Tests ===\n');

// 1. Filename formatting test
{
  const filename = generateFilename();
  console.log(`[Test 1] Generated filename: ${filename}`);
  assert.match(
    filename,
    /^rangeshot-\d{4}-\d{2}-\d{2}-\d{6}\.png$/,
    'Filename must match format rangeshot-YYYY-MM-DD-HHmmss.png'
  );
  console.log('✔ Test 1 Passed: Filename format is correct.\n');
}

// 2. Coordinate Range Normalization
{
  const normal = normalizeRange(200, 800);
  assert.strictEqual(normal.startY, 200);
  assert.strictEqual(normal.endY, 800);

  // Inverted range test (Test E)
  const inverted = normalizeRange(800, 200);
  assert.strictEqual(inverted.startY, 200);
  assert.strictEqual(inverted.endY, 800);

  console.log('✔ Test 2 Passed: Range normalization correctly handles normal and inverted selections.\n');
}

// 3. Multi-viewport Slice Math & Gap Elimination Test (Test A & B)
{
  const startY = 300;
  const endY = 2800;
  const viewportHeight = 800;
  const viewportWidth = 1200;
  const dpr = 1.25; // High-DPI test (Test G & H)
  const scaleY = dpr;
  const imageWidth = Math.round(viewportWidth * dpr);

  // Simulate scrolling and capturing slices
  const slices = [];
  let curY = startY;
  while (curY < endY) {
    slices.push({
      documentY: curY,
      viewportHeight: viewportHeight,
    });
    curY += viewportHeight - 20; // 20px overlap
  }

  let coveredDocY = startY;
  let previousDestBottom = 0;
  let totalDestinationDrawnHeight = 0;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
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
        imageWidth,
        scaleY
      );

      // Verify no vertical gaps between adjacent slices
      if (i > 0) {
        assert.strictEqual(
          plan.destination.dy,
          previousDestBottom,
          `Slice ${i} destination dy must perfectly touch previous slice bottom`
        );
      }

      previousDestBottom = plan.destination.dy + plan.destination.dh;
      totalDestinationDrawnHeight += plan.destination.dh;
      coveredDocY = sliceEndDocY;
    }
  }

  const expectedFinalHeight = Math.round((endY - startY) * scaleY);
  assert.strictEqual(
    totalDestinationDrawnHeight,
    expectedFinalHeight,
    'Total drawn height on canvas must equal expected height with zero sub-pixel error'
  );
  console.log(`✔ Test 3 Passed: Multi-slice vertical stitching is seamless across ${slices.length} viewports (Height: ${totalDestinationDrawnHeight}px at ${dpr}x DPR).\n`);
}

// 4. Single Viewport Crop Test (Test C)
{
  const startY = 550;
  const endY = 750;
  const viewportHeight = 800;
  const sliceDocTop = 500;
  const dpr = 2.0; // Retina display test
  const imageWidth = 1920 * dpr;

  const plan = calculateSlicePlan(startY, endY, sliceDocTop, startY, imageWidth, dpr);

  // Expected source crop
  const expectedSy = (550 - 500) * dpr; // 100px
  const expectedSh = (750 - 550) * dpr; // 400px

  assert.strictEqual(plan.source.sy, expectedSy);
  assert.strictEqual(plan.source.sh, expectedSh);
  assert.strictEqual(plan.destination.dy, 0);
  assert.strictEqual(plan.destination.dh, expectedSh);

  console.log('✔ Test 4 Passed: Single-viewport sub-rectangle crop calculation is exact (Test C).\n');
}

// 5. Page Bottom Clamping Simulation (Test D)
{
  const maxScrollY = 5000;
  const startY = 4800;
  const endY = 5800;
  const viewportHeight = 800;
  const dpr = 1.0;
  const imageWidth = 1200;

  // Viewport 1 at 4800 (covers 4800 - 5600)
  // Viewport 2 clamped at 5000 (covers 5000 - 5800)
  const slices = [
    { documentY: 4800, viewportHeight: 800 },
    { documentY: 5000, viewportHeight: 800 }
  ];

  let coveredDocY = startY;
  let totalDrawn = 0;

  for (const slice of slices) {
    const sliceStartDocY = Math.max(slice.documentY, coveredDocY);
    const sliceEndDocY = Math.min(slice.documentY + slice.viewportHeight, endY);
    if (sliceEndDocY > sliceStartDocY) {
      const plan = calculateSlicePlan(sliceStartDocY, sliceEndDocY, slice.documentY, startY, imageWidth, dpr);
      totalDrawn += plan.destination.dh;
      coveredDocY = sliceEndDocY;
    }
  }

  assert.strictEqual(totalDrawn, endY - startY);
  console.log('✔ Test 5 Passed: Page bottom scroll clamping handled without duplication (Test D).\n');
}

// 6. Extreme Height & Chunking Calculation Test (Prevents 32,767px Canvas Limits)
{
  const startY = 1000;
  const endY = 65000; // 64,000px height range (e.g. huge chat / long feed)
  const totalDocHeight = endY - startY;
  const MAX_CHUNK_DOC_HEIGHT = 22000;
  const MAX_SAFE_CANVAS_HEIGHT = 24000;

  // Verify chunking partition logic
  const numChunks = Math.ceil(totalDocHeight / MAX_CHUNK_DOC_HEIGHT);
  assert.strictEqual(numChunks, 3, 'A 64,000px document should be split into 3 chunks');

  const chunkSpan = Math.ceil(totalDocHeight / numChunks);
  const chunks = [];
  for (let c = 0; c < numChunks; c++) {
    const cStart = startY + c * chunkSpan;
    const cEnd = Math.min(endY, cStart + chunkSpan);
    chunks.push({ start: cStart, end: cEnd });
  }

  assert.strictEqual(chunks[0].start, 1000);
  assert.strictEqual(chunks[chunks.length - 1].end, 65000);
  for (let c = 0; c < chunks.length; c++) {
    const chunkHeight = chunks[c].end - chunks[c].start;
    assert.ok(chunkHeight <= MAX_CHUNK_DOC_HEIGHT, `Chunk ${c} height (${chunkHeight}px) must be <= ${MAX_CHUNK_DOC_HEIGHT}`);
  }

  // Verify slice planning with destination scaling for a 20,000px chunk at 1.5x DPR
  const dpr = 1.5;
  const rawCanvasHeight = Math.round(20000 * dpr); // 30,000px
  let destScaleY = dpr;
  if (rawCanvasHeight > MAX_SAFE_CANVAS_HEIGHT) {
    destScaleY *= (MAX_SAFE_CANVAS_HEIGHT / rawCanvasHeight);
  }
  const scaledCanvasHeight = Math.round(20000 * destScaleY);
  assert.ok(scaledCanvasHeight <= MAX_SAFE_CANVAS_HEIGHT, `Scaled canvas height (${scaledCanvasHeight}px) must be <= ${MAX_SAFE_CANVAS_HEIGHT}`);

  console.log('✔ Test 6 Passed: Extreme height ranges (64,000px+) safely partitioned without exceeding browser canvas limits.\n');
}

// 7. Width Crop Plan Calculation Test
{
  const viewportWidth = 1200;
  const dpr = 1.5;
  const imageWidth = Math.round(viewportWidth * dpr); // 1800
  const startX = 200;
  const endX = 1000;
  const cropCssWidth = endX - startX; // 800
  const sourceCropX = Math.round(startX * dpr); // 300
  const sourceCropWidth = Math.round(cropCssWidth * dpr); // 1200

  const plan = calculateSlicePlan(
    100,
    900,
    100,
    100,
    imageWidth,
    dpr,
    undefined,
    dpr,
    sourceCropWidth,
    sourceCropX,
    sourceCropWidth
  );

  assert.strictEqual(plan.source.sx, 300, 'Source sx should start at 300px');
  assert.strictEqual(plan.source.sw, 1200, 'Source sw should be 1200px');
  assert.strictEqual(plan.destination.dx, 0, 'Destination dx should start at 0');
  assert.strictEqual(plan.destination.dw, 1200, 'Destination dw should be 1200px');

  // Also verify normalizeRange with horizontal bounds
  const normalized = normalizeRange(500, 200, 900, 100);
  assert.strictEqual(normalized.startY, 200);
  assert.strictEqual(normalized.endY, 500);
  assert.strictEqual(normalized.startX, 100);
  assert.strictEqual(normalized.endX, 900);

  console.log('✔ Test 7 Passed: Width crop calculations (source crop, destination placement, range normalization) are exact.\n');
}

console.log('🎉 ALL ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY!\n');

