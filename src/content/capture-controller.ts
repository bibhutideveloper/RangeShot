import { CaptureRange, CaptureSlice } from '../shared/types';
import { generateFilename, sleep } from '../shared/utils';
import { PageStateManager, getPageScrollY, setPageScrollY, findScrollContainer } from './page-state';
import { RangeShotOverlay } from './overlay';
import { captureCurrentViewport } from '../capture/viewport-capture';
import { stitchSlicesToBlobs } from '../capture/image-stitcher';

interface FixedElementInfo {
  element: HTMLElement;
  originalVisibility: string;
}

export class CaptureController {
  private pageState = new PageStateManager();
  private overlay: RangeShotOverlay;
  private isCapturing = false;
  private hiddenFixedElements: FixedElementInfo[] = [];

  constructor(overlay: RangeShotOverlay) {
    this.overlay = overlay;
  }

  /**
   * Execute the full range capture sequence
   */
  public async captureRange(range: CaptureRange): Promise<void> {
    if (this.isCapturing) return;
    this.isCapturing = true;

    const { startY, endY } = range;
    console.log(`[RangeShot] Starting multi-viewport capture for range: ${startY}px to ${endY}px (Total: ${endY - startY}px)`);

    // 1. Snapshot original page state before automatic capture starts
    this.pageState.captureSnapshot();
    this.pageState.hideScrollbarsAndTransitions();

    const slices: CaptureSlice[] = [];
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const dpr = window.devicePixelRatio || 1;

    // 2. Pre-calculate all necessary scroll positions between startY and endY
    const stepSize = Math.max(100, vh - 60); // 60px safety overlap
    const targetPositions: number[] = [];

    for (let y = startY; y < endY; y += stepSize) {
      targetPositions.push(y);
    }

    // Ensure the final target position can capture all content through endY
    const finalScrollTarget = Math.max(startY, endY - vh);
    if (
      targetPositions.length === 0 ||
      targetPositions[targetPositions.length - 1] < finalScrollTarget
    ) {
      targetPositions.push(finalScrollTarget);
    }

    console.log(`[RangeShot] Planned ${targetPositions.length} viewport captures at positions:`, targetPositions);

    try {
      // 3. Keep overlay 100% hidden during capture frames so NO overlay UI is ever captured
      this.overlay.hideForCapture();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      await sleep(100);

      // Suppress bottom-pinned prompt bars, composers, and floating buttons before any slice is captured
      this.suppressBottomFloatingElements();

      for (let i = 0; i < targetPositions.length; i++) {
        const targetY = targetPositions[i];
        const stepNum = i + 1;
        const totalSteps = targetPositions.length;

        console.log(`[RangeShot] Capturing section ${stepNum} of ${totalSteps}...`);

        // Scroll instantly to planned target position
        setPageScrollY(targetY);

        // Wait for browser compositor to layout and paint the new frame
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });

        // Allow paint and layout to settle
        await sleep(250);

        const actualScrollY = getPageScrollY();
        console.log(`[RangeShot] Step ${stepNum}/${totalSteps}: Scrolled to target ${targetY}px (actual: ${actualScrollY}px)`);

        // Hide small fixed headers on subsequent slices (slice 2+) to prevent duplicates
        if (i === 1) {
          this.suppressTopStickyHeaders();
        }

        const dataUrl = await captureCurrentViewport();

        slices.push({
          dataUrl,
          documentY: actualScrollY,
          viewportWidth: vw,
          viewportHeight: vh,
          devicePixelRatio: dpr,
        });

        // Delay between captures to stay safely within Chrome's captureVisibleTab quota
        await sleep(350);
      }

      console.log(`[RangeShot] Successfully captured ${slices.length} slices across range [${startY}, ${endY}].`);
    } catch (err) {
      console.error('[RangeShot] Error during multi-viewport capture:', err);
      this.cleanup();
      const message = err instanceof Error ? err.message : String(err);
      this.overlay.showProgress(`Capture failed: ${message}`, 100);
      await sleep(3500);
      this.overlay.unmount();
      return;
    } finally {
      // 4. Immediately restore original scroll position and styles
      this.cleanup();
    }

    // 5. Stitch slices into a long screenshot
    try {
      this.overlay.showAfterCapture();
      this.overlay.showProgress('Stitching long screenshot...', 65);

      const blobs = await stitchSlicesToBlobs(slices, range, (current, total) => {
        const percent = 65 + Math.round((current / total) * 25);
        this.overlay.showProgress(`Stitching section ${current} of ${total}...`, percent);
      });

      this.overlay.showProgress('Saving PNG...', 95);
      const baseFilename = generateFilename();

      if (blobs.length === 1) {
        await this.downloadBlob(blobs[0], baseFilename);
      } else {
        for (let p = 0; p < blobs.length; p++) {
          const partFilename = baseFilename.replace('.png', `-part${p + 1}.png`);
          await this.downloadBlob(blobs[p], partFilename);
          await sleep(400);
        }
      }

      const successMsg = blobs.length > 1
        ? `Long screenshot saved in ${blobs.length} parts!`
        : 'Long screenshot saved successfully!';
      this.overlay.showProgress(successMsg, 100);
      await sleep(1800);
      this.overlay.unmount();
    } catch (err) {
      console.error('[RangeShot] Error stitching or saving image:', err);
      const message = err instanceof Error ? err.message : String(err);
      this.overlay.showProgress(`Processing error: ${message}`, 100);
      await sleep(3500);
      this.overlay.unmount();
    } finally {
      this.isCapturing = false;
    }
  }

  /**
   * Helper to safely hide an element without layout shift
   */
  private hideElement(el: HTMLElement): void {
    if (!el || !el.isConnected) return;
    if (this.hiddenFixedElements.some((h) => h.element === el)) return;
    this.hiddenFixedElements.push({
      element: el,
      originalVisibility: el.style.visibility,
    });
    el.style.visibility = 'hidden';
  }

  /**
   * Suppress bottom-pinned elements (search/prompt input bars, composers, scroll-to-bottom buttons)
   * across ALL capture slices so they never overlay content in long screenshots.
   */
  private suppressBottomFloatingElements(): void {
    const vh = window.innerHeight;
    const scrollContainer = findScrollContainer();

    // 1. Target known AI/chat prompt boxes & composers (ChatGPT, Claude, Gemini, Copilot, etc.)
    const promptInputs = document.querySelectorAll<HTMLElement>(
      'textarea#prompt-textarea, #prompt-textarea, textarea[placeholder*="Ask"], textarea[placeholder*="Message"], textarea[placeholder*="Send"], form textarea, div[contenteditable="true"][data-placeholder], [class*="prompt-box"], [class*="composer"]'
    );

    for (let i = 0; i < promptInputs.length; i++) {
      const input = promptInputs[i];
      let current: HTMLElement | null = input;
      // Ascend to the bottom-pinned container wrapper (usually form or div pinned to bottom)
      while (current && current !== document.body && current !== document.documentElement) {
        if (scrollContainer && current === scrollContainer) break;
        const rect = current.getBoundingClientRect();
        // If this container is in the bottom half and near the bottom edge
        if (rect.bottom >= vh - 60 && rect.top >= vh * 0.4 && rect.height < 350) {
          this.hideElement(current);
          break;
        }
        current = current.parentElement;
      }
    }

    // 2. Target scroll-to-bottom buttons and floating action buttons
    const buttons = document.querySelectorAll<HTMLElement>('button, [role="button"], a[class*="btn"]');
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      if (btn.closest && btn.closest('rangeshot-host')) continue;
      const rect = btn.getBoundingClientRect();
      // Round buttons or buttons in lower portion of the screen
      if (rect.top >= vh * 0.4 && rect.bottom <= vh) {
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const className = (btn.className || '').toString().toLowerCase();
        const hasDownIcon = btn.querySelector('svg') !== null;
        if (
          aria.includes('scroll') ||
          aria.includes('bottom') ||
          className.includes('scroll') ||
          className.includes('bottom') ||
          (hasDownIcon && rect.width <= 60 && rect.height <= 60)
        ) {
          this.hideElement(btn);
        }
      }
    }

    // 3. Target any generic bottom-fixed floating bars (e.g. cookie bars, bottom toolbars, floating widgets)
    const all = document.querySelectorAll<HTMLElement>('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.closest && el.closest('rangeshot-host')) continue;
      if (scrollContainer && (el === scrollContainer || el.contains(scrollContainer))) continue;

      const style = window.getComputedStyle(el);
      const isPinned = style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute';
      if (!isPinned) continue;

      const rect = el.getBoundingClientRect();
      // Bottom-docked elements
      if (rect.bottom >= vh - 40 && rect.top >= vh * 0.5 && rect.height < 300) {
        this.hideElement(el);
      }
    }
  }

  /**
   * Suppress small sticky/fixed top headers (site navbars) on slices 2+
   */
  private suppressTopStickyHeaders(): void {
    const scrollContainer = findScrollContainer();

    const all = document.querySelectorAll<HTMLElement>('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.closest && el.closest('rangeshot-host')) continue;
      if (scrollContainer && (el === scrollContainer || el.contains(scrollContainer))) continue;

      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') {
        const rect = el.getBoundingClientRect();
        // Top headers: near top, height <= 120px
        if (rect.top <= 60 && rect.height <= 120) {
          this.hideElement(el);
        }
      }
    }
  }

  /**
   * Restore fixed/sticky elements to their original visibility
   */
  private restoreFixedElements(): void {
    for (const item of this.hiddenFixedElements) {
      if (item.element && item.element.isConnected) {
        item.element.style.visibility = item.originalVisibility;
      }
    }
    this.hiddenFixedElements = [];
  }

  /**
   * Trigger download via binary Blob URL
   */
  private async downloadBlob(blob: Blob, filename: string): Promise<void> {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
      URL.revokeObjectURL(blobUrl);
    }, 2500);
  }

  /**
   * Restore original page scroll and styles
   */
  private cleanup(): void {
    this.restoreFixedElements();
    this.pageState.restoreOriginalPosition();
  }
}
