import { CaptureRange } from '../shared/types';
import { INSTRUCTIONS, STYLES } from '../shared/constants';

export class RangeShotOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;

  // UI Elements inside Shadow DOM
  private guideLine: HTMLDivElement | null = null;
  private guideBadge: HTMLSpanElement | null = null;
  private startMarker: HTMLDivElement | null = null;
  private startMarkerBadge: HTMLSpanElement | null = null;
  private endMarker: HTMLDivElement | null = null;
  private endMarkerBadge: HTMLSpanElement | null = null;
  private selectionBand: HTMLDivElement | null = null;
  private topPill: HTMLDivElement | null = null;
  private topPillTitle: HTMLDivElement | null = null;
  private topPillSub: HTMLDivElement | null = null;
  private toolbar: HTMLDivElement | null = null;
  private toolbarInfo: HTMLDivElement | null = null;
  private confirmBtn: HTMLButtonElement | null = null;
  private cancelBtn: HTMLButtonElement | null = null;
  private progressModal: HTMLDivElement | null = null;
  private progressText: HTMLDivElement | null = null;
  private progressBar: HTMLDivElement | null = null;

  // Width adjustment UI elements & state
  private startX = 0;
  private endX = typeof window !== 'undefined' ? window.innerWidth : 1200;
  private isDraggingLeft = false;
  private isDraggingRight = false;
  private maskLeft: HTMLDivElement | null = null;
  private maskRight: HTMLDivElement | null = null;
  private handleLeft: HTMLDivElement | null = null;
  private handleRight: HTMLDivElement | null = null;
  private tooltipLeft: HTMLDivElement | null = null;
  private tooltipRight: HTMLDivElement | null = null;
  private pillWidthText: HTMLSpanElement | null = null;
  private pillWidthReset: HTMLButtonElement | null = null;

  // Callbacks
  public onConfirmCapture: (() => void) | null = null;
  public onCancel: (() => void) | null = null;
  public onWidthChanged: ((startX: number, endX: number) => void) | null = null;

  /**
   * Mount the isolated Shadow DOM overlay onto the page
   */
  public mount(): void {
    if (this.host) return;

    this.host = document.createElement('rangeshot-host');
    this.host.id = 'rangeshot-host';
    this.host.style.position = 'absolute';
    this.host.style.top = '0';
    this.host.style.left = '0';
    this.host.style.width = '100%';
    this.host.style.height = `${Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      window.innerHeight
    )}px`;
    this.host.style.pointerEvents = 'none';
    this.host.style.zIndex = `${STYLES.Z_INDEX}`;

    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Inject styles & template
    this.shadow.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        :host {
          all: initial;
        }

        .overlay-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        /* Interactive guide line tracking mouse cursor */
        .guide-line {
          position: fixed;
          left: 0;
          width: 100%;
          height: 2px;
          background: #3b82f6;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
          pointer-events: none;
          display: none;
          z-index: 20;
        }

        .guide-badge {
          position: absolute;
          right: 24px;
          top: -14px;
          background: #1e293b;
          color: #f8fafc;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid #3b82f6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          pointer-events: none;
        }

        /* Fixed START & END markers on document coordinates */
        .marker {
          position: absolute;
          left: 0;
          width: 100%;
          height: 2px;
          pointer-events: none;
          z-index: 10;
          display: none;
        }

        .marker-start {
          background: ${STYLES.START_COLOR};
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
        }

        .marker-end {
          background: ${STYLES.END_COLOR};
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.8);
        }

        .marker-badge {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          top: -12px;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 14px;
          border-radius: 9999px;
          letter-spacing: 0.5px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }

        .marker-start .marker-badge {
          background: ${STYLES.START_COLOR};
        }

        .marker-end .marker-badge {
          background: ${STYLES.END_COLOR};
        }

        /* Selection region highlight */
        .selection-band {
          position: absolute;
          left: 0;
          width: 100%;
          background: ${STYLES.SELECTION_BG};
          border-top: 1px dashed ${STYLES.START_COLOR};
          border-bottom: 1px dashed ${STYLES.END_COLOR};
          pointer-events: none;
          display: none;
          z-index: 5;
        }

        /* Top floating instruction pill */
        .top-pill {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15, 23, 42, 0.94);
          color: #f8fafc;
          padding: 10px 20px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          gap: 12px;
          pointer-events: auto;
          z-index: 100;
          user-select: none;
          transition: all 0.2s ease;
          animation: dropIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .top-pill.warning {
          background: rgba(185, 28, 28, 0.96);
          border-color: rgba(239, 68, 68, 0.6);
          box-shadow: 0 10px 25px -5px rgba(220, 38, 38, 0.5);
        }

        .pill-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 2px;
        }

        .pill-title {
          font-weight: 600;
          font-size: 13px;
        }

        .pill-sub {
          font-size: 11px;
          color: #94a3b8;
        }

        .top-pill.warning .pill-sub {
          color: #fecaca;
        }

        .pill-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 8px #3b82f6;
          flex-shrink: 0;
        }

        .top-pill.warning .pill-dot {
          background: #fca5a5;
          box-shadow: 0 0 8px #fca5a5;
        }

        .top-pill-btn-close {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #94a3b8;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .top-pill-btn-close:hover {
          background: rgba(239, 68, 68, 0.8);
          color: #fff;
        }

        .pill-divider {
          width: 1px;
          height: 18px;
          background: rgba(255, 255, 255, 0.2);
        }

        .pill-width-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 3px 9px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          color: #93c5fd;
          font-family: monospace;
          user-select: none;
        }

        .pill-width-icon {
          font-size: 12px;
          color: #60a5fa;
        }

        .pill-width-reset {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fca5a5;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
          padding: 0;
          margin-left: 2px;
        }

        .pill-width-reset:hover {
          background: rgba(239, 68, 68, 0.8);
          color: #fff;
        }

        /* Side Width Masks (dim area outside width bounds) */
        .width-mask {
          position: fixed;
          top: 0;
          height: 100vh;
          background: rgba(15, 23, 42, 0.45);
          pointer-events: none;
          z-index: 15;
          backdrop-filter: blur(1px);
        }

        .mask-left {
          left: 0;
          width: 0px;
        }

        .mask-right {
          right: 0;
          width: 0px;
        }

        /* Draggable Side Handles */
        .width-handle {
          position: fixed;
          top: 0;
          height: 100vh;
          width: 24px;
          margin-left: -12px;
          z-index: 25;
          cursor: col-resize;
          pointer-events: auto;
          user-select: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .handle-left {
          left: 0px;
        }

        .handle-right {
          left: 100%;
        }

        .handle-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          left: 50%;
          transform: translateX(-50%);
          background: #6366f1;
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.7);
          pointer-events: none;
          transition: background 0.15s ease, box-shadow 0.15s ease;
        }

        .width-handle:hover .handle-line,
        .width-handle.dragging .handle-line {
          background: #38bdf8;
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.9);
          width: 3px;
        }

        .handle-tab {
          position: absolute;
          top: 40%;
          transform: translateY(-50%);
          background: #1e1b4b;
          color: #f8fafc;
          border: 1px solid #6366f1;
          border-radius: 9999px;
          padding: 5px 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 10px rgba(99, 102, 241, 0.4);
          pointer-events: auto;
          cursor: col-resize;
          transition: all 0.15s ease;
        }

        .handle-left .handle-tab {
          left: 6px;
        }

        .handle-right .handle-tab {
          right: 6px;
        }

        .width-handle:hover .handle-tab,
        .width-handle.dragging .handle-tab {
          background: #4338ca;
          border-color: #38bdf8;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 0 14px rgba(56, 189, 248, 0.7);
          transform: translateY(-50%) scale(1.06);
        }

        .handle-tooltip {
          position: absolute;
          top: calc(40% - 36px);
          transform: translateX(-50%);
          left: 50%;
          background: rgba(15, 23, 42, 0.96);
          color: #38bdf8;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid rgba(56, 189, 248, 0.5);
          white-space: nowrap;
          pointer-events: none;
          display: none;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
        }

        .width-handle.dragging .handle-tooltip,
        .width-handle:hover .handle-tooltip {
          display: block;
        }

        /* Bottom Floating Confirmation Toolbar */
        .toolbar {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 12px;
          padding: 14px 22px;
          display: none;
          align-items: center;
          gap: 20px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          pointer-events: auto;
          z-index: 100;
          user-select: none;
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .toolbar-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .toolbar-title {
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
        }

        .toolbar-details {
          font-size: 12px;
          color: #94a3b8;
          font-family: monospace;
        }

        .btn-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        button.btn {
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn-primary {
          background: #4f46e5;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
        }

        .btn-primary:hover {
          background: #4338ca;
          transform: translateY(-1px);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.18);
        }

        /* Progress Modal */
        .progress-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(15, 23, 42, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          padding: 24px 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          display: none;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          min-width: 320px;
          pointer-events: auto;
          z-index: 101;
        }

        .spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(255, 255, 255, 0.15);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .progress-text {
          color: #f8fafc;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
        }

        .progress-track {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 9999px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          width: 0%;
          background: #6366f1;
          transition: width 0.2s ease;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes dropIn {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      </style>

      <div class="overlay-container">
        <!-- Side Width Crop Masks -->
        <div class="width-mask mask-left" id="maskLeft"></div>
        <div class="width-mask mask-right" id="maskRight"></div>

        <!-- Draggable Side Width Handles -->
        <div class="width-handle handle-left" id="handleLeft" title="Drag to adjust left boundary (Double-click to reset)">
          <div class="handle-line"></div>
          <div class="handle-tab">
            <span class="handle-icon">◀</span>
            <span class="handle-label">Width</span>
          </div>
          <div class="handle-tooltip" id="tooltipLeft"></div>
        </div>

        <div class="width-handle handle-right" id="handleRight" title="Drag to adjust right boundary (Double-click to reset)">
          <div class="handle-line"></div>
          <div class="handle-tab">
            <span class="handle-label">Width</span>
            <span class="handle-icon">▶</span>
          </div>
          <div class="handle-tooltip" id="tooltipRight"></div>
        </div>

        <!-- Interactive mouse guide -->
        <div class="guide-line" id="guideLine">
          <span class="guide-badge" id="guideBadge">Y: 0px</span>
        </div>

        <!-- Document Markers -->
        <div class="marker marker-start" id="startMarker">
          <span class="marker-badge" id="startMarkerBadge">── START ──</span>
        </div>
        <div class="marker marker-end" id="endMarker">
          <span class="marker-badge" id="endMarkerBadge">── END ──</span>
        </div>

        <!-- Highlight Band -->
        <div class="selection-band" id="selectionBand"></div>

        <!-- Top Instruction Pill -->
        <div class="top-pill" id="topPill">
          <div class="pill-dot"></div>
          <div class="pill-content">
            <div class="pill-title" id="topPillTitle">${INSTRUCTIONS.SELECT_START}</div>
            <div class="pill-sub" id="topPillSub" style="display: none;"></div>
          </div>
          <div class="pill-divider"></div>
          <div class="pill-width-badge" id="pillWidthBadge" title="Current capture width">
            <span class="pill-width-icon">↔</span>
            <span id="pillWidthText">Full Width</span>
            <button class="pill-width-reset" id="pillWidthReset" style="display: none;" title="Reset to full width">↺</button>
          </div>
          <button class="top-pill-btn-close" id="topPillClose" title="Cancel capture">✕</button>
        </div>

        <!-- Floating Confirmation Toolbar -->
        <div class="toolbar" id="toolbar">
          <div class="toolbar-info">
            <div class="toolbar-title">Range selected</div>
            <div class="toolbar-details" id="toolbarDetails">START → END</div>
          </div>
          <div class="btn-group">
            <button class="btn btn-primary" id="confirmBtn">Capture</button>
            <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
          </div>
        </div>

        <!-- Progress Modal -->
        <div class="progress-modal" id="progressModal">
          <div class="spinner"></div>
          <div class="progress-text" id="progressText">Preparing capture...</div>
          <div class="progress-track">
            <div class="progress-fill" id="progressBar"></div>
          </div>
        </div>
      </div>
    `;

    // Query elements
    this.guideLine = this.shadow.querySelector('#guideLine');
    this.guideBadge = this.shadow.querySelector('#guideBadge');
    this.startMarker = this.shadow.querySelector('#startMarker');
    this.startMarkerBadge = this.shadow.querySelector('#startMarkerBadge');
    this.endMarker = this.shadow.querySelector('#endMarker');
    this.endMarkerBadge = this.shadow.querySelector('#endMarkerBadge');
    this.selectionBand = this.shadow.querySelector('#selectionBand');
    this.topPill = this.shadow.querySelector('#topPill');
    this.topPillTitle = this.shadow.querySelector('#topPillTitle');
    this.topPillSub = this.shadow.querySelector('#topPillSub');
    this.toolbar = this.shadow.querySelector('#toolbar');
    this.toolbarInfo = this.shadow.querySelector('#toolbarDetails');
    this.confirmBtn = this.shadow.querySelector('#confirmBtn');
    this.cancelBtn = this.shadow.querySelector('#cancelBtn');
    this.progressModal = this.shadow.querySelector('#progressModal');
    this.progressText = this.shadow.querySelector('#progressText');
    this.progressBar = this.shadow.querySelector('#progressBar');

    // Query width adjustment elements
    this.maskLeft = this.shadow.querySelector('#maskLeft');
    this.maskRight = this.shadow.querySelector('#maskRight');
    this.handleLeft = this.shadow.querySelector('#handleLeft');
    this.handleRight = this.shadow.querySelector('#handleRight');
    this.tooltipLeft = this.shadow.querySelector('#tooltipLeft');
    this.tooltipRight = this.shadow.querySelector('#tooltipRight');
    this.pillWidthText = this.shadow.querySelector('#pillWidthText');
    this.pillWidthReset = this.shadow.querySelector('#pillWidthReset');

    this.setupWidthHandles();
    this.setWidthBounds(0, typeof window !== 'undefined' ? window.innerWidth : 1200);

    // Attach button listeners
    const pillClose = this.shadow.querySelector('#topPillClose');
    pillClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onCancel?.();
    });

    this.confirmBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onConfirmCapture?.();
    });

    this.cancelBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onCancel?.();
    });

    // Mount to document
    document.documentElement.appendChild(this.host);
  }

  /**
   * Update the live mouse guide line
   */
  public updateGuideLine(viewportY: number, documentY: number, label: string): void {
    if (!this.guideLine || !this.guideBadge) return;
    this.guideLine.style.display = 'block';
    this.guideLine.style.top = `${viewportY}px`;
    this.guideBadge.textContent = `${label}: ${documentY.toLocaleString()}px`;
  }

  /**
   * Hide the guide line
   */
  public hideGuideLine(): void {
    if (this.guideLine) {
      this.guideLine.style.display = 'none';
    }
  }

  /**
   * Keep host height matched to dynamic document height
   */
  public updateHostHeight(): void {
    if (this.host) {
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight,
        window.innerHeight
      );
      this.host.style.height = `${docHeight}px`;
    }
  }

  /**
   * Set and show START marker
   */
  public setStartMarker(documentY: number): void {
    this.updateHostHeight();
    if (!this.startMarker || !this.startMarkerBadge) return;
    this.startMarker.style.display = 'block';
    this.startMarker.style.top = `${documentY}px`;
    this.startMarkerBadge.textContent = `── START (${documentY.toLocaleString()}px) ──`;
  }

  /**
   * Set and show END marker
   */
  public setEndMarker(documentY: number): void {
    this.updateHostHeight();
    if (!this.endMarker || !this.endMarkerBadge) return;
    this.endMarker.style.display = 'block';
    this.endMarker.style.top = `${documentY}px`;
    this.endMarkerBadge.textContent = `── END (${documentY.toLocaleString()}px) ──`;
  }

  /**
   * Render the highlight band between startY and endY
   */
  public setSelectionBand(range: CaptureRange): void {
    this.updateHostHeight();
    if (!this.selectionBand) return;
    this.selectionBand.style.display = 'block';
    this.selectionBand.style.top = `${range.startY}px`;
    this.selectionBand.style.height = `${range.endY - range.startY}px`;
  }

  /**
   * Set top pill instruction
   */
  public setInstruction(title: string, sub?: string): void {
    if (this.topPill && this.topPillTitle && this.topPillSub) {
      this.topPill.classList.remove('warning');
      this.topPillTitle.textContent = title;
      if (sub) {
        this.topPillSub.textContent = sub;
        this.topPillSub.style.display = 'block';
      } else {
        this.topPillSub.style.display = 'none';
      }
    }
  }

  /**
   * Show warning message in top pill (e.g. END must be below START)
   */
  public showWarning(message: string): void {
    if (this.topPill && this.topPillTitle && this.topPillSub) {
      this.topPill.classList.add('warning');
      this.topPillTitle.textContent = message;
      this.topPillSub.style.display = 'none';
    }
  }

  /**
   * Show floating confirmation panel with START -> END details
   */
  public showConfirmation(range: CaptureRange): void {
    if (!this.toolbar || !this.toolbarInfo) return;
    const height = range.endY - range.startY;
    const width = (typeof range.endX === 'number' && typeof range.startX === 'number')
      ? range.endX - range.startX
      : (typeof window !== 'undefined' ? window.innerWidth : 1200);
    this.toolbarInfo.textContent = `START: ${range.startY.toLocaleString()}px → END: ${range.endY.toLocaleString()}px (Height: ${height.toLocaleString()}px • Width: ${width.toLocaleString()}px)`;
    this.toolbar.style.display = 'flex';
  }

  /**
   * Hide confirmation toolbar
   */
  public hideToolbar(): void {
    if (this.toolbar) {
      this.toolbar.style.display = 'none';
    }
  }

  /**
   * Reset all visuals
   */
  public resetVisuals(): void {
    if (this.startMarker) this.startMarker.style.display = 'none';
    if (this.endMarker) this.endMarker.style.display = 'none';
    if (this.selectionBand) this.selectionBand.style.display = 'none';
    this.hideToolbar();
    this.setWidthBounds(0, typeof window !== 'undefined' ? window.innerWidth : 1200);
    this.setInstruction(INSTRUCTIONS.SELECT_START);
  }

  /**
   * Setup interactive drag listeners on left and right side handles
   */
  private setupWidthHandles(): void {
    if (!this.handleLeft || !this.handleRight) return;

    // --- Left Handle dragging ---
    const onLeftPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDraggingLeft = true;
      this.handleLeft?.classList.add('dragging');
      try {
        this.handleLeft?.setPointerCapture(e.pointerId);
      } catch (_) {}
      this.updateLeftFromClientX(e.clientX);
    };

    const onLeftPointerMove = (e: PointerEvent) => {
      if (!this.isDraggingLeft) return;
      e.preventDefault();
      e.stopPropagation();
      this.updateLeftFromClientX(e.clientX);
    };

    const onLeftPointerUp = (e: PointerEvent) => {
      if (!this.isDraggingLeft) return;
      this.isDraggingLeft = false;
      this.handleLeft?.classList.remove('dragging');
      try {
        this.handleLeft?.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    this.handleLeft.addEventListener('pointerdown', onLeftPointerDown);
    this.handleLeft.addEventListener('pointermove', onLeftPointerMove);
    this.handleLeft.addEventListener('pointerup', onLeftPointerUp);
    this.handleLeft.addEventListener('pointercancel', onLeftPointerUp);

    // Double-click left handle to reset to 0
    this.handleLeft.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setWidthBounds(0, this.endX);
    });

    // --- Right Handle dragging ---
    const onRightPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDraggingRight = true;
      this.handleRight?.classList.add('dragging');
      try {
        this.handleRight?.setPointerCapture(e.pointerId);
      } catch (_) {}
      this.updateRightFromClientX(e.clientX);
    };

    const onRightPointerMove = (e: PointerEvent) => {
      if (!this.isDraggingRight) return;
      e.preventDefault();
      e.stopPropagation();
      this.updateRightFromClientX(e.clientX);
    };

    const onRightPointerUp = (e: PointerEvent) => {
      if (!this.isDraggingRight) return;
      this.isDraggingRight = false;
      this.handleRight?.classList.remove('dragging');
      try {
        this.handleRight?.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    this.handleRight.addEventListener('pointerdown', onRightPointerDown);
    this.handleRight.addEventListener('pointermove', onRightPointerMove);
    this.handleRight.addEventListener('pointerup', onRightPointerUp);
    this.handleRight.addEventListener('pointercancel', onRightPointerUp);

    // Double-click right handle to reset to window width
    this.handleRight.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setWidthBounds(this.startX, window.innerWidth);
    });

    // Reset button in top pill
    this.pillWidthReset?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setWidthBounds(0, window.innerWidth);
    });

    // Window resize
    window.addEventListener('resize', () => {
      if (this.endX > window.innerWidth || this.endX >= window.innerWidth - 10) {
        this.endX = window.innerWidth;
      }
      this.updateWidthVisuals();
    });
  }

  private updateLeftFromClientX(clientX: number): void {
    const minWidth = 80;
    const newStartX = Math.max(0, Math.min(this.endX - minWidth, clientX));
    this.setWidthBounds(newStartX, this.endX);
  }

  private updateRightFromClientX(clientX: number): void {
    const minWidth = 80;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const newEndX = Math.min(vw, Math.max(this.startX + minWidth, clientX));
    this.setWidthBounds(this.startX, newEndX);
  }

  public setWidthBounds(startX: number, endX: number): void {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    this.startX = Math.max(0, Math.min(vw - 20, Math.round(startX)));
    this.endX = Math.min(vw, Math.max(this.startX + 20, Math.round(endX)));
    this.updateWidthVisuals();
    this.onWidthChanged?.(this.startX, this.endX);
  }

  public getWidthBounds(): { startX: number; endX: number } {
    return { startX: this.startX, endX: this.endX };
  }

  private updateWidthVisuals(): void {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const width = this.endX - this.startX;
    const isFullWidth = this.startX <= 2 && this.endX >= vw - 2;

    if (this.maskLeft) {
      this.maskLeft.style.width = `${this.startX}px`;
    }
    if (this.maskRight) {
      this.maskRight.style.width = `${Math.max(0, vw - this.endX)}px`;
    }

    if (this.handleLeft) {
      this.handleLeft.style.left = `${this.startX}px`;
    }
    if (this.handleRight) {
      this.handleRight.style.left = `${this.endX}px`;
    }

    if (this.tooltipLeft) {
      this.tooltipLeft.textContent = `Width: ${width}px`;
    }
    if (this.tooltipRight) {
      this.tooltipRight.textContent = `Width: ${width}px`;
    }

    if (this.guideLine) {
      this.guideLine.style.left = `${this.startX}px`;
      this.guideLine.style.width = `${width}px`;
    }
    if (this.startMarker) {
      this.startMarker.style.left = `${this.startX}px`;
      this.startMarker.style.width = `${width}px`;
    }
    if (this.endMarker) {
      this.endMarker.style.left = `${this.startX}px`;
      this.endMarker.style.width = `${width}px`;
    }
    if (this.selectionBand) {
      this.selectionBand.style.left = `${this.startX}px`;
      this.selectionBand.style.width = `${width}px`;
    }

    if (this.pillWidthText) {
      this.pillWidthText.textContent = isFullWidth ? 'Full Width' : `Width: ${width}px`;
    }
    if (this.pillWidthReset) {
      this.pillWidthReset.style.display = isFullWidth ? 'none' : 'inline-flex';
    }
  }

  /**
   * Temporarily hide the entire overlay during screenshot capture frames
   */
  public hideForCapture(): void {
    if (this.host) {
      this.host.style.display = 'none';
    }
  }

  /**
   * Unhide overlay after screenshot capture frames
   */
  public showAfterCapture(): void {
    if (this.host) {
      this.host.style.display = 'block';
    }
  }

  /**
   * Show capture & stitch progress modal
   */
  public showProgress(message: string, percent = 0): void {
    if (this.host) {
      this.host.style.display = 'block';
    }
    if (this.topPill) this.topPill.style.display = 'none';
    if (this.toolbar) this.toolbar.style.display = 'none';
    if (this.progressModal && this.progressText && this.progressBar) {
      this.progressModal.style.display = 'flex';
      this.progressText.textContent = message;
      this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
  }

  /**
   * Hide progress modal
   */
  public hideProgress(): void {
    if (this.progressModal) {
      this.progressModal.style.display = 'none';
    }
  }

  /**
   * Remove overlay completely from DOM
   */
  public unmount(): void {
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
      this.host = null;
      this.shadow = null;
    }
  }
}
