# RangeShot 📸

Production-quality Google Chrome Extension built with **Manifest V3** and **TypeScript** to capture long, vertically stitched screenshots between exact user-defined **START** and **END** points.

Unlike conventional full-page screenshot extensions that blindly capture from the very top of the page, **RangeShot** lets you pinpoint precisely where the capture begins and ends.

---

## Features

- **Exact Document Range Capture**: Click to set a START point, scroll naturally, and click to set an END point.
- **Shadow DOM Isolation**: The UI overlay is isolated inside a custom Shadow DOM host (`<rangeshot-host>`), preventing style bleeding to and from host webpages.
- **Dynamic Guideline & Live Badges**: Live horizontal guide tracks cursor position showing exact document Y coordinates in real-time.
- **Inverted Range Normalization**: If END is selected above START, coordinates are automatically swapped.
- **DPR-Aware Canvas Stitching**: Accounts for `window.devicePixelRatio` (100%, 125%, 150%, Retina displays) so output images are sharp and proportioned.
- **Seamless Multi-Viewport Math**: Slices are placed at exact document coordinate offsets, eliminating vertical gaps and duplicate content.
- **Scroll Restoration**: Instantly restores the page's original scroll position after capture completes.
- **Local-First & Private**: 100% in-browser processing. Zero external servers or telemetry.

---

## Project Structure

```
RangeShot/
├── manifest.json              # Extension Manifest V3
├── package.json               # Dependencies & scripts
├── tsconfig.json              # Strict TypeScript configuration
├── build.mjs                  # Fast bundler producing production dist/
├── public/
│   ├── manifest.json
│   └── icons/                 # 16x16, 48x48, 128x128 PNG icons
├── src/
│   ├── background/
│   │   └── service-worker.ts  # Viewport capture & Downloads API handler
│   ├── content/
│   │   ├── content-main.ts    # Content script entry point & message bus
│   │   ├── overlay.ts         # Encapsulated Shadow DOM markers & floating toolbar
│   │   ├── range-selector.ts  # State machine for coordinate selection
│   │   ├── capture-controller.ts # Viewport scroll orchestrator & progress
│   │   └── page-state.ts      # Scroll snapshot and scrollbar suppressor
│   ├── capture/
│   │   ├── viewport-capture.ts# Communication with background capture API
│   │   ├── image-stitcher.ts  # Canvas vertical stitching engine
│   │   └── image-cropper.ts   # DPR-aware slice crop calculations
│   ├── popup/
│   │   ├── popup.html         # Clean extension popup
│   │   ├── popup.ts           # Tab validator & capture trigger
│   │   └── popup.css          # Modern dark-mode popup styles
│   └── shared/
│       ├── constants.ts       # Shared constants and UI messages
│       ├── messages.ts        # Strongly typed message definitions
│       ├── types.ts           # Interfaces (CaptureRange, Slices, etc.)
│       └── utils.ts           # Range normalization, sleep, filename generator
├── test/
│   └── engine-verification.test.mjs # Automated unit/integration tests
└── test-page/
    ├── index.html             # ~6,400px test page with coordinate ruler
    └── styles.css             # Section styles, fixed headers & buttons
```

---

## How to Install in Chrome

1. Build the extension:
   ```bash
   npm run build
   ```
2. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
3. Enable **Developer mode** toggle in the top right corner.
4. Click **Load unpacked**.
5. Select the `dist` folder:
   ```
   D:\Bibhuti\Project\RangeShot\dist
   ```
6. The **RangeShot** extension is now installed and active!

---

## How to Test

You can test using the included local test fixture:
1. Open the file in Chrome:
   ```
   D:\Bibhuti\Project\RangeShot\dist\test-page\index.html
   ```
2. Click the **RangeShot** extension icon in the Chrome toolbar.
3. Click **Capture Range**.
4. Move your mouse to see the live document Y coordinate guide.
5. Click anywhere to set the **START** point.
6. Scroll down normally to Section 3, 4, or 5.
7. Click to set the **END** point.
8. Click **Capture Range** in the bottom floating toolbar (or press Enter).
9. Watch RangeShot scroll, stitch the slices, and download `rangeshot-<timestamp>.png`!

---

## Acceptance Test Scenarios

- **Test A (Top to Deep Section)**: START at ~300px → END at ~2800px.
- **Test B (Middle Section)**: START at ~1900px → END at ~4200px.
- **Test C (Same Viewport)**: START at ~550px → END at ~750px (single-slice crop).
- **Test D (Page Bottom)**: START at ~5200px → END at ~5900px (scroll clamping handled).
- **Test E (Inverted Selection)**: Click START at ~4400px, scroll UP to ~2200px, click END. (Auto-normalized).
- **Test F (Cancel/Reset)**: Press `Escape` or click Cancel/Reset to dismiss overlay and restore state.
- **Test G (Browser Zoom)**: Test at 125% and 150% zoom; DPR scaling ensures crisp output.
- **Test H (Scroll Restoration)**: Page scroll position is restored to its exact pre-capture position.

---

## Automated Tests

Run the test suite:
```bash
npm test
```
Outputs:
```
✔ Test 1 Passed: Filename format is correct.
✔ Test 2 Passed: Range normalization correctly handles normal and inverted selections.
✔ Test 3 Passed: Multi-slice vertical stitching is seamless across 4 viewports (Height: 3125px at 1.25x DPR).
✔ Test 4 Passed: Single-viewport sub-rectangle crop calculation is exact (Test C).
✔ Test 5 Passed: Page bottom scroll clamping handled without duplication (Test D).
🎉 ALL ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY!
```

---

## Known Limitations (Phase 1)

1. **Fixed & Sticky Elements**: Elements with `position: fixed` or `position: sticky` (like top navbars) will appear repeated on each captured viewport slice. The architecture in `capture-controller.ts` includes the `handleFixedElements` hook to hide them on subsequent slices in Phase 2.
2. **Special Chrome URLs**: As mandated by Chrome extension security policies, RangeShot cannot run on `chrome://`, `chrome-extension://`, or the Chrome Web Store. The popup surfaces clear explanations when opened on these pages.
