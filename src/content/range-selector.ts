import { CaptureRange, SelectionState } from '../shared/types';
import { INSTRUCTIONS } from '../shared/constants';
import { RangeShotOverlay } from './overlay';
import { getEventDocumentY } from './page-state';

export class RangeSelector {
  private state: SelectionState = 'IDLE';
  private startY: number | null = null;
  private endY: number | null = null;
  private startX = 0;
  private endX = typeof window !== 'undefined' ? window.innerWidth : 1200;
  private overlay: RangeShotOverlay;

  private lastClientY: number | null = null;

  // Event handlers bound to this instance
  private handleMouseMoveBound = this.handleMouseMove.bind(this);
  private handleScrollBound = this.handleScroll.bind(this);
  private handleClickBound = this.handleClick.bind(this);
  private handleKeyDownBound = this.handleKeyDown.bind(this);

  // Callbacks
  public onRangeConfirmed: ((range: CaptureRange) => void) | null = null;
  public onCancelled: (() => void) | null = null;

  constructor(overlay: RangeShotOverlay) {
    this.overlay = overlay;
  }

  /**
   * Start the interactive range selection flow
   */
  public start(): void {
    this.state = 'SELECTING_START';
    this.startY = null;
    this.endY = null;
    this.startX = 0;
    this.endX = typeof window !== 'undefined' ? window.innerWidth : 1200;
    this.lastClientY = null;

    this.overlay.mount();
    this.overlay.resetVisuals();
    this.overlay.setInstruction(INSTRUCTIONS.SELECT_START);

    // Track interactive width adjustments
    this.overlay.onWidthChanged = (startX: number, endX: number) => {
      this.startX = startX;
      this.endX = endX;
    };

    // Bind UI actions
    this.overlay.onConfirmCapture = () => {
      this.confirmCurrentRange();
    };

    this.overlay.onCancel = () => {
      this.cancel();
    };

    // Attach document event listeners
    window.addEventListener('mousemove', this.handleMouseMoveBound, { passive: true });
    window.addEventListener('scroll', this.handleScrollBound, { passive: true });
    window.addEventListener('click', this.handleClickBound, true); // capture phase
    window.addEventListener('keydown', this.handleKeyDownBound);
  }

  /**
   * Mouse move: update guide line position and coordinate readout
   */
  private handleMouseMove(e: MouseEvent): void {
    if (this.state !== 'SELECTING_START' && this.state !== 'SELECTING_END') {
      return;
    }

    this.lastClientY = e.clientY;
    const viewportY = e.clientY;
    const documentY = getEventDocumentY(e);
    const label = this.state === 'SELECTING_START' ? 'START' : 'END';

    this.overlay.updateGuideLine(viewportY, documentY, label);
  }

  /**
   * Handle user scrolling: update guide line and badge in real time
   */
  private handleScroll(): void {
    if (this.state !== 'SELECTING_START' && this.state !== 'SELECTING_END') {
      return;
    }

    if (this.lastClientY !== null) {
      const scrollY = getEventDocumentY({ clientY: 0 } as MouseEvent);
      const documentY = this.lastClientY + scrollY;
      const label = this.state === 'SELECTING_START' ? 'START' : 'END';
      this.overlay.updateGuideLine(this.lastClientY, documentY, label);
    }
  }

  /**
   * Click: place START or END marker
   */
  private handleClick(e: MouseEvent): void {
    // If clicking on our own UI (close button / dialog), ignore
    const target = e.target as HTMLElement | null;
    if (target && target.closest && target.closest('rangeshot-host')) {
      return;
    }

    const clickedDocY = getEventDocumentY(e);

    if (this.state === 'SELECTING_START') {
      e.preventDefault();
      e.stopPropagation();

      this.startY = clickedDocY;
      this.overlay.setStartMarker(this.startY);
      this.overlay.setInstruction(
        INSTRUCTIONS.START_SELECTED,
        INSTRUCTIONS.SELECT_END
      );
      this.state = 'SELECTING_END';
      return;
    }

    if (this.state === 'SELECTING_END') {
      e.preventDefault();
      e.stopPropagation();

      if (this.startY === null) return;

      // Reject if selection range is virtually zero (< 5px)
      if (Math.abs(clickedDocY - this.startY) < 5) {
        this.overlay.showWarning('Selection range is too small. Please scroll down and select END.');
        return;
      }

      // Automatically normalize range so startY < endY regardless of scroll direction
      const finalStartY = Math.min(this.startY, clickedDocY);
      const finalEndY = Math.max(this.startY, clickedDocY);

      this.startY = finalStartY;
      this.endY = finalEndY;
      const bounds = this.overlay.getWidthBounds();
      this.startX = bounds.startX;
      this.endX = bounds.endX;
      const range: CaptureRange = {
        startY: this.startY,
        endY: this.endY,
        startX: this.startX,
        endX: this.endX,
      };

      // Update markers and selection highlight
      this.overlay.setStartMarker(this.startY);
      this.overlay.setEndMarker(this.endY);
      this.overlay.setSelectionBand(range);
      this.overlay.hideGuideLine();
      this.overlay.showConfirmation(range);

      // AUTOMATIC CAPTURE: Immediately trigger capture without extra manual steps
      this.confirmCurrentRange();
      return;
    }
  }

  /**
   * Keydown handler: Escape to cancel, Enter to confirm
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel();
    } else if (e.key === 'Enter' && this.state === 'RANGE_SELECTED') {
      e.preventDefault();
      this.confirmCurrentRange();
    }
  }

  /**
   * Confirm currently selected range and trigger capture
   */
  public confirmCurrentRange(): void {
    if (this.startY === null || this.endY === null) return;

    this.state = 'CAPTURING';
    this.detachListeners();
    this.overlay.hideGuideLine();

    const bounds = this.overlay.getWidthBounds();
    this.startX = bounds.startX;
    this.endX = bounds.endX;
    const range: CaptureRange = {
      startY: this.startY,
      endY: this.endY,
      startX: this.startX,
      endX: this.endX,
    };
    this.onRangeConfirmed?.(range);
  }

  /**
   * Cancel selection and clean up
   */
  public cancel(): void {
    this.state = 'IDLE';
    this.detachListeners();
    this.overlay.unmount();
    this.onCancelled?.();
  }

  /**
   * Detach document event listeners
   */
  private detachListeners(): void {
    window.removeEventListener('mousemove', this.handleMouseMoveBound);
    window.removeEventListener('scroll', this.handleScrollBound);
    window.removeEventListener('click', this.handleClickBound, true);
    window.removeEventListener('keydown', this.handleKeyDownBound);
  }
}
