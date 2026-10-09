import puppeteer from 'puppeteer-core';
import assert from 'assert';
import path from 'path';

import http from 'http';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXTENSION_DIST = path.resolve('dist');
const PORT = 8765;
const TEST_PAGE_URL = `http://127.0.0.1:${PORT}/index.html`;

function startLocalServer() {
  const server = http.createServer((req, res) => {
    let filePath = path.join(EXTENSION_DIST, 'test-page', req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function runE2ETests() {
  console.log('=== Starting RangeShot End-to-End Chrome Browser Tests ===\n');

  const server = await startLocalServer();
  console.log(`[E2E] Local test server running on: http://127.0.0.1:${PORT}`);

  console.log(`[E2E] Launching Chrome from: ${CHROME_PATH}`);
  console.log(`[E2E] Loading unpacked extension from: ${EXTENSION_DIST}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      `--disable-extensions-except=${EXTENSION_DIST}`,
      `--load-extension=${EXTENSION_DIST}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,900',
    ],
  });

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => console.log('[Browser Console]', msg.text()));
    page.on('pageerror', (err) => console.log('[Browser Error]', err));
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

    console.log(`[E2E] Navigating to test page: ${TEST_PAGE_URL}`);
    await page.goto(TEST_PAGE_URL, { waitUntil: 'load' });

    // Inject compiled content script
    await page.addScriptTag({ path: path.join(EXTENSION_DIST, 'content.js') });

    // Helper to query shadow DOM of rangeshot-host
    async function getShadowText(selector) {
      return page.evaluate((sel) => {
        const host = document.querySelector('rangeshot-host');
        if (!host || !host.shadowRoot) return null;
        const el = host.shadowRoot.querySelector(sel);
        return el ? el.textContent.trim() : null;
      }, selector);
    }

    async function isShadowElementVisible(selector) {
      return page.evaluate((sel) => {
        const host = document.querySelector('rangeshot-host');
        if (!host || !host.shadowRoot) return false;
        const el = host.shadowRoot.querySelector(sel);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }, selector);
    }

    // --- TEST 1: Activate Extension & Verify Start Mode ---
    console.log('\n--- Test 1: Activate Range Selection Mode ---');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('__rangeshot_test_start'));
    });

    const hostExists = await page.evaluate(() => !!document.querySelector('rangeshot-host'));
    assert.strictEqual(hostExists, true, 'rangeshot-host must be mounted in DOM');

    const initialTitle = await getShadowText('#topPillTitle');
    console.log(`[E2E] Initial Instruction: "${initialTitle}"`);
    assert.strictEqual(initialTitle, 'Click to set START', 'Instruction must be "Click to set START"');
    console.log('✔ Test 1 Passed: Extension overlay mounted with "Click to set START".');

    // --- TEST 2: Select START Point ---
    console.log('\n--- Test 2: Select START Point (Y = 350px) ---');
    await page.evaluate(() => {
      // Simulate click at viewport clientY = 350 (window.scrollY = 0 => docY = 350)
      window.dispatchEvent(new MouseEvent('click', { clientY: 350, bubbles: true }));
    });

    const startMarkerVisible = await isShadowElementVisible('#startMarker');
    const startBadgeText = await getShadowText('#startMarkerBadge');
    const startTitle = await getShadowText('#topPillTitle');
    const startSub = await getShadowText('#topPillSub');

    console.log(`[E2E] START Marker Badge: "${startBadgeText}"`);
    console.log(`[E2E] Pill Title: "${startTitle}" | Sub: "${startSub}"`);

    assert.strictEqual(startMarkerVisible, true, 'START marker must be visible');
    assert.match(startBadgeText, /START.*350/i, 'START badge must display 350px coordinate');
    assert.strictEqual(startTitle, 'START selected', 'Pill title must say "START selected"');
    assert.strictEqual(startSub, 'Scroll down and click to set END', 'Pill subtext must say "Scroll down and click to set END"');
    console.log('✔ Test 2 Passed: START point set at 350px with visible marker and updated instructions.');

    // --- TEST 3: Attempt END Point Within 5px (Small Range Rejection Test) ---
    console.log('\n--- Test 3: Reject Zero/Trivial Range (Y = 352px vs START = 350px) ---');
    await page.evaluate(() => {
      // Click within 2px of START
      window.dispatchEvent(new MouseEvent('click', { clientY: 352, bubbles: true }));
    });

    const warningTitle = await getShadowText('#topPillTitle');
    console.log(`[E2E] Warning Displayed: "${warningTitle}"`);
    assert.strictEqual(
      warningTitle,
      'Selection range is too small. Please scroll down and select END.',
      'Must display rejection message when selection range is trivial'
    );
    console.log('✔ Test 3 Passed: Trivial selection range cleanly rejected with explicit warning message.');

    // --- TEST 4: User Scrolls Down & Selects Valid END (Triggers Automatic Capture) ---
    console.log('\n--- Test 4: Scroll Down & Select Valid END (Y = 2500px) with Automatic Capture ---');
    
    // Set up mock for capture API
    await page.evaluate(() => {
      if (!window.chrome) window.chrome = {};
      if (!window.chrome.runtime) window.chrome.runtime = {};
      window.__capturedSliceCount = 0;
      window.chrome.runtime.sendMessage = function (msg, cb) {
        if (msg.type === 'CAPTURE_VISIBLE_TAB') {
          window.__capturedSliceCount++;
          cb && cb({
            success: true,
            dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          });
          return true;
        }
      };

      // User scrolls down to 2000px
      window.scrollTo(0, 2000);
      // User clicks at viewport clientY = 500 => documentY = 2000 + 500 = 2500px
      // This automatically triggers the capture workflow without manual confirmation
      window.dispatchEvent(new MouseEvent('click', { clientY: 500, bubbles: true }));
    });

    // Wait for capture controller to finish and clean up
    await page.waitForFunction(() => !document.querySelector('rangeshot-host'), { timeout: 15000 });

    const capturedCount = await page.evaluate(() => window.__capturedSliceCount);
    console.log(`[E2E] Automatically captured slices: ${capturedCount}`);
    assert.ok(capturedCount >= 2, 'Automatic capture must capture multi-viewport slices across 350px -> 2500px range');
    console.log('✔ Test 4 Passed: Clicking END automatically captured entire scrolled range and finished.');

    // --- TEST 5: Cancel Workflow ---
    console.log('\n--- Test 5: Cancel Selection Workflow ---');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('__rangeshot_test_start'));
      const host = document.querySelector('rangeshot-host');
      const closeBtn = host.shadowRoot.querySelector('#topPillClose');
      closeBtn.click();
    });

    const hostAfterCancel = await page.evaluate(() => !!document.querySelector('rangeshot-host'));
    assert.strictEqual(hostAfterCancel, false, 'rangeshot-host must be completely removed on Cancel');
    console.log('✔ Test 5 Passed: Cancel button cleanly unmounts overlay and cleans up.');

    // --- TEST 6: Scroll Restoration Test ---
    console.log('\n--- Test 6: Scroll Restoration Verification ---');
    await page.evaluate(() => window.scrollTo(0, 1850));
    const preCaptureScrollY = await page.evaluate(() => window.scrollY);
    assert.strictEqual(preCaptureScrollY, 1850, 'Page scroll must be at 1850px');

    await page.evaluate(async () => {
      window.dispatchEvent(new CustomEvent('__rangeshot_test_start'));
      // START at docY = 1900 (window.scrollY is 1850, clientY is 50)
      window.dispatchEvent(new MouseEvent('click', { clientY: 50, bubbles: true }));
      // END at docY = 2400 (window.scrollY is 1850, clientY is 550) -> triggers automatic capture
      window.dispatchEvent(new MouseEvent('click', { clientY: 550, bubbles: true }));
    });

    // Wait for capture to finish
    await page.waitForFunction(() => !document.querySelector('rangeshot-host'), { timeout: 10000 });

    // Verify scroll restoration: must equal 1850px!
    const postCaptureScrollY = await page.evaluate(() => window.scrollY);
    console.log(`[E2E] Pre-capture scroll Y: ${preCaptureScrollY}px | Post-capture scroll Y: ${postCaptureScrollY}px`);
    assert.strictEqual(postCaptureScrollY, 1850, 'Page scroll must be restored to original pre-capture position');
    console.log('✔ Test 6 Passed: Original scroll position restored accurately after capture.');

    // --- TEST 7: Multi-Viewport Long Screenshot Verification (START -> Scroll -> END) ---
    console.log('\n--- Test 7: Multi-Viewport Long Screenshot (START=300px, Scroll down, END=3000px) ---');

    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      window.dispatchEvent(new CustomEvent('__rangeshot_test_start'));

      // START near top: Y = 300px
      window.dispatchEvent(new MouseEvent('click', { clientY: 300, bubbles: true }));

      // User manually scrolls down to Y = 2500px
      window.scrollTo(0, 2500);

      window.__capturedSliceCount = 0;
      window.chrome.runtime.sendMessage = function (msg, cb) {
        if (msg.type === 'CAPTURE_VISIBLE_TAB') {
          window.__capturedSliceCount++;
          cb && cb({
            success: true,
            dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          });
          return true;
        }
      };

      // User clicks END after scroll at docY = 3000px (window.scrollY = 2500, clientY = 500)
      // Automatically begins capture
      window.dispatchEvent(new MouseEvent('click', { clientY: 500, bubbles: true }));
    });

    // Wait for capture to finish
    await page.waitForFunction(() => !document.querySelector('rangeshot-host'), { timeout: 20000 });

    const capturedSlices = await page.evaluate(() => window.__capturedSliceCount);
    console.log(`[E2E] Number of viewports captured across range: ${capturedSlices}`);

    assert.ok(capturedSlices >= 3, `Must capture multiple viewports (captured: ${capturedSlices}), NOT only one viewport!`);
    console.log(`✔ Test 7 Passed: Successfully captured ${capturedSlices} viewports across 2,700px range for a true long screenshot.\n`);

    // --- TEST 8: Draggable Width Handles and Custom Width Cropping ---
    console.log('\n--- Test 8: Draggable Width Handles & Custom Width Crop ---');

    await page.evaluate(() => {
      window.scrollTo(0, 0);
      window.dispatchEvent(new CustomEvent('__rangeshot_test_start'));
    });

    // Verify handles are present
    const leftHandleExists = await page.evaluate(() => {
      const host = document.querySelector('rangeshot-host');
      return !!host?.shadowRoot?.querySelector('#handleLeft');
    });
    const rightHandleExists = await page.evaluate(() => {
      const host = document.querySelector('rangeshot-host');
      return !!host?.shadowRoot?.querySelector('#handleRight');
    });
    assert.strictEqual(leftHandleExists, true, 'Left width handle must be present in shadow root');
    assert.strictEqual(rightHandleExists, true, 'Right width handle must be present in shadow root');

    const initialWidthText = await getShadowText('#pillWidthText');
    console.log(`[E2E] Initial Width Display: "${initialWidthText}"`);
    assert.strictEqual(initialWidthText, 'Full Width', 'Initial width display must be "Full Width"');

    // Simulate dragging left handle to 200px and right handle to 1000px
    await page.evaluate(() => {
      const host = document.querySelector('rangeshot-host');
      const handleLeft = host.shadowRoot.querySelector('#handleLeft');
      const handleRight = host.shadowRoot.querySelector('#handleRight');

      // Drag left handle to 200
      handleLeft.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
      handleLeft.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, bubbles: true }));
      handleLeft.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, bubbles: true }));

      // Drag right handle to 1000
      handleRight.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1280, bubbles: true }));
      handleRight.dispatchEvent(new PointerEvent('pointermove', { clientX: 1000, bubbles: true }));
      handleRight.dispatchEvent(new PointerEvent('pointerup', { clientX: 1000, bubbles: true }));
    });

    const updatedWidthText = await getShadowText('#pillWidthText');
    console.log(`[E2E] Adjusted Width Display: "${updatedWidthText}"`);
    assert.strictEqual(updatedWidthText, 'Width: 800px', 'Width display must reflect 1000px - 200px = 800px');

    // Reset width test via the reset button
    await page.evaluate(() => {
      const host = document.querySelector('rangeshot-host');
      const resetBtn = host.shadowRoot.querySelector('#pillWidthReset');
      resetBtn.click();
    });

    const resetWidthText = await getShadowText('#pillWidthText');
    console.log(`[E2E] Reset Width Display: "${resetWidthText}"`);
    assert.strictEqual(resetWidthText, 'Full Width', 'Reset button must restore "Full Width"');

    // Cancel to clean up
    await page.evaluate(() => {
      const host = document.querySelector('rangeshot-host');
      const closeBtn = host.shadowRoot.querySelector('#topPillClose');
      closeBtn.click();
    });
    console.log('✔ Test 8 Passed: Draggable width handles, live width readout, and full-width reset verified.\n');

    console.log('🎉 ALL 8 END-TO-END CHROME BROWSER TESTS PASSED PERFECTLY!\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runE2ETests().catch((err) => {
  console.error('\n❌ E2E Test Suite Failed:', err);
  process.exit(1);
});
