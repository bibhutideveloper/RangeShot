import { PageStateSnapshot } from '../shared/types';

let detectedScrollContainer: HTMLElement | null = null;

/**
 * Find the primary scrolling container on the page if window itself isn't scrolling.
 * Accurately detects SPAs like ChatGPT, Claude, Twitter, Discord, and Slack.
 */
export function findScrollContainer(): HTMLElement | null {
  if (detectedScrollContainer && detectedScrollContainer.isConnected) {
    return detectedScrollContainer;
  }

  // If document itself is scrolling (standard webpage)
  const doc = document.scrollingElement || document.documentElement;
  if (doc && doc.scrollHeight > window.innerHeight + 60 && window.scrollY > 0) {
    return null; // Window is actively scrolling
  }

  let bestContainer: HTMLElement | null = null;
  let maxScrollableHeight = 0;

  // Search common app containers first
  const candidates = document.querySelectorAll<HTMLElement>(
    'main, [role="main"], #root, #app, #__next, article, div[class*="scroll"], div[class*="overflow"], div[tabindex="0"]'
  );

  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    if (el.closest && el.closest('rangeshot-host')) continue;
    if (el.scrollHeight > el.clientHeight + 40) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        const diff = el.scrollHeight - el.clientHeight;
        if (diff > maxScrollableHeight) {
          maxScrollableHeight = diff;
          bestContainer = el;
        }
      }
    }
  }

  if (bestContainer) {
    detectedScrollContainer = bestContainer;
    return bestContainer;
  }

  // Fallback: search all elements with overflow-y scroll/auto
  const allElements = document.querySelectorAll<HTMLElement>('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.closest && el.closest('rangeshot-host')) continue;
    if (el.scrollHeight > el.clientHeight + 60) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        const diff = el.scrollHeight - el.clientHeight;
        if (diff > maxScrollableHeight) {
          maxScrollableHeight = diff;
          bestContainer = el;
        }
      }
    }
  }

  detectedScrollContainer = bestContainer;
  return bestContainer;
}

/**
 * Reset detected container cache
 */
export function resetScrollContainerCache(): void {
  detectedScrollContainer = null;
}

/**
 * Get current vertical scroll position across any browser document structure
 */
export function getPageScrollY(): number {
  const container = findScrollContainer();
  if (container) {
    return container.scrollTop;
  }

  return Math.max(
    window.scrollY || 0,
    window.pageYOffset || 0,
    document.documentElement ? document.documentElement.scrollTop || 0 : 0,
    document.body ? document.body.scrollTop || 0 : 0,
    document.scrollingElement ? document.scrollingElement.scrollTop || 0 : 0
  );
}

/**
 * Get current horizontal scroll position
 */
export function getPageScrollX(): number {
  return (
    window.scrollX ||
    window.pageXOffset ||
    (document.documentElement ? document.documentElement.scrollLeft || 0 : 0) ||
    (document.body ? document.body.scrollLeft || 0 : 0) ||
    0
  );
}

/**
 * Calculate the accurate document Y coordinate for any mouse event,
 * taking into account page scroll and inner scrolling elements.
 */
export function getEventDocumentY(e: MouseEvent): number {
  const scrollY = getPageScrollY();
  return Math.round(e.clientY + scrollY);
}

/**
 * Set vertical scroll position instantly on window and all potential document containers
 */
export function setPageScrollY(y: number): void {
  const container = findScrollContainer();
  if (container) {
    container.scrollTop = y;
  }

  window.scrollTo(0, y);
  window.scrollTo({
    left: getPageScrollX(),
    top: y,
    behavior: 'instant',
  });

  if (document.documentElement) {
    document.documentElement.scrollTop = y;
  }
  if (document.body) {
    document.body.scrollTop = y;
  }
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = y;
  }
}

/**
 * Handles saving and restoring page state (scroll position, scrollbars, smooth scrolling)
 */
export class PageStateManager {
  private snapshot: PageStateSnapshot | null = null;
  private styleElement: HTMLStyleElement | null = null;

  /**
   * Save the current scroll position and style settings
   */
  public captureSnapshot(): PageStateSnapshot {
    this.snapshot = {
      originalScrollX: getPageScrollX(),
      originalScrollY: getPageScrollY(),
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
    };
    return this.snapshot;
  }

  /**
   * Temporarily suppress scrollbars and disable CSS smooth scroll transitions
   * so scrolling during capture happens instantly and cleanly.
   */
  public hideScrollbarsAndTransitions(): void {
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'rangeshot-scroll-suppressor';
      this.styleElement.textContent = `
        html, body, * {
          scroll-behavior: auto !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        ::-webkit-scrollbar {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
        }
      `;
      (document.head || document.documentElement).appendChild(this.styleElement);
    }
  }

  /**
   * Restore scrollbars and transitions to their previous state
   */
  public restoreScrollbarsAndTransitions(): void {
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
      this.styleElement = null;
    }
  }

  /**
   * Restore original page scroll position and styles
   */
  public restoreOriginalPosition(): void {
    this.restoreScrollbarsAndTransitions();

    if (this.snapshot) {
      document.documentElement.style.overflow = this.snapshot.htmlOverflow;
      document.body.style.overflow = this.snapshot.bodyOverflow;

      setPageScrollY(this.snapshot.originalScrollY);
      window.scrollTo({
        left: this.snapshot.originalScrollX,
        top: this.snapshot.originalScrollY,
        behavior: 'instant',
      });
    }
  }
}
