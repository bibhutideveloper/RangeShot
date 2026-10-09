"use strict";
(() => {
  // src/shared/messages.ts
  var MessageTypes = {
    START_RANGE_SELECTION: "START_RANGE_SELECTION",
    RANGE_SELECTION_STARTED: "RANGE_SELECTION_STARTED",
    CAPTURE_VISIBLE_TAB: "CAPTURE_VISIBLE_TAB",
    DOWNLOAD_CAPTURE: "DOWNLOAD_CAPTURE",
    CANCEL_CAPTURE: "CANCEL_CAPTURE",
    CAPTURE_PROGRESS: "CAPTURE_PROGRESS",
    CAPTURE_COMPLETE: "CAPTURE_COMPLETE",
    CAPTURE_ERROR: "CAPTURE_ERROR"
  };

  // src/shared/constants.ts
  var STYLES = {
    Z_INDEX: 2147483647,
    // Maximum 32-bit integer for top-level overlay
    START_COLOR: "#10b981",
    // Emerald green
    END_COLOR: "#6366f1",
    // Indigo / violet
    SELECTION_BG: "rgba(99, 102, 241, 0.12)",
    SELECTION_BORDER: "rgba(99, 102, 241, 0.6)"
  };
  var INSTRUCTIONS = {
    SELECT_START: "Click to set START",
    START_SELECTED: "START selected",
    SELECT_END: "Scroll down and click to set END",
    END_MUST_BE_BELOW_START: "END must be below START. Scroll down and select END again.",
    RANGE_SELECTED: "Range selected",
    CAPTURING: "Capturing RangeShot..."
  };

  // src/content/overlay.ts
  var RangeShotOverlay = class {
    host = null;
    shadow = null;
    // UI Elements inside Shadow DOM
    guideLine = null;
    guideBadge = null;
    startMarker = null;
    startMarkerBadge = null;
    endMarker = null;
    endMarkerBadge = null;
    selectionBand = null;
    topPill = null;
    topPillTitle = null;
    topPillSub = null;
    toolbar = null;
    toolbarInfo = null;
    confirmBtn = null;
    cancelBtn = null;
    progressModal = null;
    progressText = null;
    progressBar = null;
    // Width adjustment UI elements & state
    startX = 0;
    endX = typeof window !== "undefined" ? window.innerWidth : 1200;
    isDraggingLeft = false;
    isDraggingRight = false;
    maskLeft = null;
    maskRight = null;
    handleLeft = null;
    handleRight = null;
    tooltipLeft = null;
    tooltipRight = null;
    pillWidthText = null;
    pillWidthReset = null;
    // Callbacks
    onConfirmCapture = null;
    onCancel = null;
    onWidthChanged = null;
    /**
     * Mount the isolated Shadow DOM overlay onto the page
     */
    mount() {
      if (this.host) return;
      this.host = document.createElement("rangeshot-host");
      this.host.id = "rangeshot-host";
      this.host.style.position = "absolute";
      this.host.style.top = "0";
      this.host.style.left = "0";
      this.host.style.width = "100%";
      this.host.style.height = `${Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        window.innerHeight
      )}px`;
      this.host.style.pointerEvents = "none";
      this.host.style.zIndex = `${STYLES.Z_INDEX}`;
      this.shadow = this.host.attachShadow({ mode: "open" });
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
            <span class="handle-icon">\u25C0</span>
            <span class="handle-label">Width</span>
          </div>
          <div class="handle-tooltip" id="tooltipLeft"></div>
        </div>

        <div class="width-handle handle-right" id="handleRight" title="Drag to adjust right boundary (Double-click to reset)">
          <div class="handle-line"></div>
          <div class="handle-tab">
            <span class="handle-label">Width</span>
            <span class="handle-icon">\u25B6</span>
          </div>
          <div class="handle-tooltip" id="tooltipRight"></div>
        </div>

        <!-- Interactive mouse guide -->
        <div class="guide-line" id="guideLine">
          <span class="guide-badge" id="guideBadge">Y: 0px</span>
        </div>

        <!-- Document Markers -->
        <div class="marker marker-start" id="startMarker">
          <span class="marker-badge" id="startMarkerBadge">\u2500\u2500 START \u2500\u2500</span>
        </div>
        <div class="marker marker-end" id="endMarker">
          <span class="marker-badge" id="endMarkerBadge">\u2500\u2500 END \u2500\u2500</span>
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
            <span class="pill-width-icon">\u2194</span>
            <span id="pillWidthText">Full Width</span>
            <button class="pill-width-reset" id="pillWidthReset" style="display: none;" title="Reset to full width">\u21BA</button>
          </div>
          <button class="top-pill-btn-close" id="topPillClose" title="Cancel capture">\u2715</button>
        </div>

        <!-- Floating Confirmation Toolbar -->
        <div class="toolbar" id="toolbar">
          <div class="toolbar-info">
            <div class="toolbar-title">Range selected</div>
            <div class="toolbar-details" id="toolbarDetails">START \u2192 END</div>
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
      this.guideLine = this.shadow.querySelector("#guideLine");
      this.guideBadge = this.shadow.querySelector("#guideBadge");
      this.startMarker = this.shadow.querySelector("#startMarker");
      this.startMarkerBadge = this.shadow.querySelector("#startMarkerBadge");
      this.endMarker = this.shadow.querySelector("#endMarker");
      this.endMarkerBadge = this.shadow.querySelector("#endMarkerBadge");
      this.selectionBand = this.shadow.querySelector("#selectionBand");
      this.topPill = this.shadow.querySelector("#topPill");
      this.topPillTitle = this.shadow.querySelector("#topPillTitle");
      this.topPillSub = this.shadow.querySelector("#topPillSub");
      this.toolbar = this.shadow.querySelector("#toolbar");
      this.toolbarInfo = this.shadow.querySelector("#toolbarDetails");
      this.confirmBtn = this.shadow.querySelector("#confirmBtn");
      this.cancelBtn = this.shadow.querySelector("#cancelBtn");
      this.progressModal = this.shadow.querySelector("#progressModal");
      this.progressText = this.shadow.querySelector("#progressText");
      this.progressBar = this.shadow.querySelector("#progressBar");
      this.maskLeft = this.shadow.querySelector("#maskLeft");
      this.maskRight = this.shadow.querySelector("#maskRight");
      this.handleLeft = this.shadow.querySelector("#handleLeft");
      this.handleRight = this.shadow.querySelector("#handleRight");
      this.tooltipLeft = this.shadow.querySelector("#tooltipLeft");
      this.tooltipRight = this.shadow.querySelector("#tooltipRight");
      this.pillWidthText = this.shadow.querySelector("#pillWidthText");
      this.pillWidthReset = this.shadow.querySelector("#pillWidthReset");
      this.setupWidthHandles();
      this.setWidthBounds(0, typeof window !== "undefined" ? window.innerWidth : 1200);
      const pillClose = this.shadow.querySelector("#topPillClose");
      pillClose?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onCancel?.();
      });
      this.confirmBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onConfirmCapture?.();
      });
      this.cancelBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onCancel?.();
      });
      document.documentElement.appendChild(this.host);
    }
    /**
     * Update the live mouse guide line
     */
    updateGuideLine(viewportY, documentY, label) {
      if (!this.guideLine || !this.guideBadge) return;
      this.guideLine.style.display = "block";
      this.guideLine.style.top = `${viewportY}px`;
      this.guideBadge.textContent = `${label}: ${documentY.toLocaleString()}px`;
    }
    /**
     * Hide the guide line
     */
    hideGuideLine() {
      if (this.guideLine) {
        this.guideLine.style.display = "none";
      }
    }
    /**
     * Keep host height matched to dynamic document height
     */
    updateHostHeight() {
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
    setStartMarker(documentY) {
      this.updateHostHeight();
      if (!this.startMarker || !this.startMarkerBadge) return;
      this.startMarker.style.display = "block";
      this.startMarker.style.top = `${documentY}px`;
      this.startMarkerBadge.textContent = `\u2500\u2500 START (${documentY.toLocaleString()}px) \u2500\u2500`;
    }
    /**
     * Set and show END marker
     */
    setEndMarker(documentY) {
      this.updateHostHeight();
      if (!this.endMarker || !this.endMarkerBadge) return;
      this.endMarker.style.display = "block";
      this.endMarker.style.top = `${documentY}px`;
      this.endMarkerBadge.textContent = `\u2500\u2500 END (${documentY.toLocaleString()}px) \u2500\u2500`;
    }
    /**
     * Render the highlight band between startY and endY
     */
    setSelectionBand(range) {
      this.updateHostHeight();
      if (!this.selectionBand) return;
      this.selectionBand.style.display = "block";
      this.selectionBand.style.top = `${range.startY}px`;
      this.selectionBand.style.height = `${range.endY - range.startY}px`;
    }
    /**
     * Set top pill instruction
     */
    setInstruction(title, sub) {
      if (this.topPill && this.topPillTitle && this.topPillSub) {
        this.topPill.classList.remove("warning");
        this.topPillTitle.textContent = title;
        if (sub) {
          this.topPillSub.textContent = sub;
          this.topPillSub.style.display = "block";
        } else {
          this.topPillSub.style.display = "none";
        }
      }
    }
    /**
     * Show warning message in top pill (e.g. END must be below START)
     */
    showWarning(message) {
      if (this.topPill && this.topPillTitle && this.topPillSub) {
        this.topPill.classList.add("warning");
        this.topPillTitle.textContent = message;
        this.topPillSub.style.display = "none";
      }
    }
    /**
     * Show floating confirmation panel with START -> END details
     */
    showConfirmation(range) {
      if (!this.toolbar || !this.toolbarInfo) return;
      const height = range.endY - range.startY;
      const width = typeof range.endX === "number" && typeof range.startX === "number" ? range.endX - range.startX : typeof window !== "undefined" ? window.innerWidth : 1200;
      this.toolbarInfo.textContent = `START: ${range.startY.toLocaleString()}px \u2192 END: ${range.endY.toLocaleString()}px (Height: ${height.toLocaleString()}px \u2022 Width: ${width.toLocaleString()}px)`;
      this.toolbar.style.display = "flex";
    }
    /**
     * Hide confirmation toolbar
     */
    hideToolbar() {
      if (this.toolbar) {
        this.toolbar.style.display = "none";
      }
    }
    /**
     * Reset all visuals
     */
    resetVisuals() {
      if (this.startMarker) this.startMarker.style.display = "none";
      if (this.endMarker) this.endMarker.style.display = "none";
      if (this.selectionBand) this.selectionBand.style.display = "none";
      this.hideToolbar();
      this.setWidthBounds(0, typeof window !== "undefined" ? window.innerWidth : 1200);
      this.setInstruction(INSTRUCTIONS.SELECT_START);
    }
    /**
     * Setup interactive drag listeners on left and right side handles
     */
    setupWidthHandles() {
      if (!this.handleLeft || !this.handleRight) return;
      const onLeftPointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isDraggingLeft = true;
        this.handleLeft?.classList.add("dragging");
        try {
          this.handleLeft?.setPointerCapture(e.pointerId);
        } catch (_) {
        }
        this.updateLeftFromClientX(e.clientX);
      };
      const onLeftPointerMove = (e) => {
        if (!this.isDraggingLeft) return;
        e.preventDefault();
        e.stopPropagation();
        this.updateLeftFromClientX(e.clientX);
      };
      const onLeftPointerUp = (e) => {
        if (!this.isDraggingLeft) return;
        this.isDraggingLeft = false;
        this.handleLeft?.classList.remove("dragging");
        try {
          this.handleLeft?.releasePointerCapture(e.pointerId);
        } catch (_) {
        }
      };
      this.handleLeft.addEventListener("pointerdown", onLeftPointerDown);
      this.handleLeft.addEventListener("pointermove", onLeftPointerMove);
      this.handleLeft.addEventListener("pointerup", onLeftPointerUp);
      this.handleLeft.addEventListener("pointercancel", onLeftPointerUp);
      this.handleLeft.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setWidthBounds(0, this.endX);
      });
      const onRightPointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isDraggingRight = true;
        this.handleRight?.classList.add("dragging");
        try {
          this.handleRight?.setPointerCapture(e.pointerId);
        } catch (_) {
        }
        this.updateRightFromClientX(e.clientX);
      };
      const onRightPointerMove = (e) => {
        if (!this.isDraggingRight) return;
        e.preventDefault();
        e.stopPropagation();
        this.updateRightFromClientX(e.clientX);
      };
      const onRightPointerUp = (e) => {
        if (!this.isDraggingRight) return;
        this.isDraggingRight = false;
        this.handleRight?.classList.remove("dragging");
        try {
          this.handleRight?.releasePointerCapture(e.pointerId);
        } catch (_) {
        }
      };
      this.handleRight.addEventListener("pointerdown", onRightPointerDown);
      this.handleRight.addEventListener("pointermove", onRightPointerMove);
      this.handleRight.addEventListener("pointerup", onRightPointerUp);
      this.handleRight.addEventListener("pointercancel", onRightPointerUp);
      this.handleRight.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setWidthBounds(this.startX, window.innerWidth);
      });
      this.pillWidthReset?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setWidthBounds(0, window.innerWidth);
      });
      window.addEventListener("resize", () => {
        if (this.endX > window.innerWidth || this.endX >= window.innerWidth - 10) {
          this.endX = window.innerWidth;
        }
        this.updateWidthVisuals();
      });
    }
    updateLeftFromClientX(clientX) {
      const minWidth = 80;
      const newStartX = Math.max(0, Math.min(this.endX - minWidth, clientX));
      this.setWidthBounds(newStartX, this.endX);
    }
    updateRightFromClientX(clientX) {
      const minWidth = 80;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      const newEndX = Math.min(vw, Math.max(this.startX + minWidth, clientX));
      this.setWidthBounds(this.startX, newEndX);
    }
    setWidthBounds(startX, endX) {
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      this.startX = Math.max(0, Math.min(vw - 20, Math.round(startX)));
      this.endX = Math.min(vw, Math.max(this.startX + 20, Math.round(endX)));
      this.updateWidthVisuals();
      this.onWidthChanged?.(this.startX, this.endX);
    }
    getWidthBounds() {
      return { startX: this.startX, endX: this.endX };
    }
    updateWidthVisuals() {
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
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
        this.pillWidthText.textContent = isFullWidth ? "Full Width" : `Width: ${width}px`;
      }
      if (this.pillWidthReset) {
        this.pillWidthReset.style.display = isFullWidth ? "none" : "inline-flex";
      }
    }
    /**
     * Temporarily hide the entire overlay during screenshot capture frames
     */
    hideForCapture() {
      if (this.host) {
        this.host.style.display = "none";
      }
    }
    /**
     * Unhide overlay after screenshot capture frames
     */
    showAfterCapture() {
      if (this.host) {
        this.host.style.display = "block";
      }
    }
    /**
     * Show capture & stitch progress modal
     */
    showProgress(message, percent = 0) {
      if (this.host) {
        this.host.style.display = "block";
      }
      if (this.topPill) this.topPill.style.display = "none";
      if (this.toolbar) this.toolbar.style.display = "none";
      if (this.progressModal && this.progressText && this.progressBar) {
        this.progressModal.style.display = "flex";
        this.progressText.textContent = message;
        this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      }
    }
    /**
     * Hide progress modal
     */
    hideProgress() {
      if (this.progressModal) {
        this.progressModal.style.display = "none";
      }
    }
    /**
     * Remove overlay completely from DOM
     */
    unmount() {
      if (this.host && this.host.parentNode) {
        this.host.parentNode.removeChild(this.host);
        this.host = null;
        this.shadow = null;
      }
    }
  };

  // src/content/page-state.ts
  var detectedScrollContainer = null;
  function findScrollContainer() {
    if (detectedScrollContainer && detectedScrollContainer.isConnected) {
      return detectedScrollContainer;
    }
    const doc = document.scrollingElement || document.documentElement;
    if (doc && doc.scrollHeight > window.innerHeight + 60 && window.scrollY > 0) {
      return null;
    }
    let bestContainer = null;
    let maxScrollableHeight = 0;
    const candidates = document.querySelectorAll(
      'main, [role="main"], #root, #app, #__next, article, div[class*="scroll"], div[class*="overflow"], div[tabindex="0"]'
    );
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (el.closest && el.closest("rangeshot-host")) continue;
      if (el.scrollHeight > el.clientHeight + 40) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
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
    const allElements = document.querySelectorAll("*");
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (el.closest && el.closest("rangeshot-host")) continue;
      if (el.scrollHeight > el.clientHeight + 60) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
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
  function getPageScrollY() {
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
  function getPageScrollX() {
    return window.scrollX || window.pageXOffset || (document.documentElement ? document.documentElement.scrollLeft || 0 : 0) || (document.body ? document.body.scrollLeft || 0 : 0) || 0;
  }
  function getEventDocumentY(e) {
    const scrollY = getPageScrollY();
    return Math.round(e.clientY + scrollY);
  }
  function setPageScrollY(y) {
    const container = findScrollContainer();
    if (container) {
      container.scrollTop = y;
    }
    window.scrollTo(0, y);
    window.scrollTo({
      left: getPageScrollX(),
      top: y,
      behavior: "instant"
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
  var PageStateManager = class {
    snapshot = null;
    styleElement = null;
    /**
     * Save the current scroll position and style settings
     */
    captureSnapshot() {
      this.snapshot = {
        originalScrollX: getPageScrollX(),
        originalScrollY: getPageScrollY(),
        htmlOverflow: document.documentElement.style.overflow,
        bodyOverflow: document.body.style.overflow
      };
      return this.snapshot;
    }
    /**
     * Temporarily suppress scrollbars and disable CSS smooth scroll transitions
     * so scrolling during capture happens instantly and cleanly.
     */
    hideScrollbarsAndTransitions() {
      if (!this.styleElement) {
        this.styleElement = document.createElement("style");
        this.styleElement.id = "rangeshot-scroll-suppressor";
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
    restoreScrollbarsAndTransitions() {
      if (this.styleElement && this.styleElement.parentNode) {
        this.styleElement.parentNode.removeChild(this.styleElement);
        this.styleElement = null;
      }
    }
    /**
     * Restore original page scroll position and styles
     */
    restoreOriginalPosition() {
      this.restoreScrollbarsAndTransitions();
      if (this.snapshot) {
        document.documentElement.style.overflow = this.snapshot.htmlOverflow;
        document.body.style.overflow = this.snapshot.bodyOverflow;
        setPageScrollY(this.snapshot.originalScrollY);
        window.scrollTo({
          left: this.snapshot.originalScrollX,
          top: this.snapshot.originalScrollY,
          behavior: "instant"
        });
      }
    }
  };

  // src/content/range-selector.ts
  var RangeSelector = class {
    state = "IDLE";
    startY = null;
    endY = null;
    startX = 0;
    endX = typeof window !== "undefined" ? window.innerWidth : 1200;
    overlay;
    lastClientY = null;
    // Event handlers bound to this instance
    handleMouseMoveBound = this.handleMouseMove.bind(this);
    handleScrollBound = this.handleScroll.bind(this);
    handleClickBound = this.handleClick.bind(this);
    handleKeyDownBound = this.handleKeyDown.bind(this);
    // Callbacks
    onRangeConfirmed = null;
    onCancelled = null;
    constructor(overlay) {
      this.overlay = overlay;
    }
    /**
     * Start the interactive range selection flow
     */
    start() {
      this.state = "SELECTING_START";
      this.startY = null;
      this.endY = null;
      this.startX = 0;
      this.endX = typeof window !== "undefined" ? window.innerWidth : 1200;
      this.lastClientY = null;
      this.overlay.mount();
      this.overlay.resetVisuals();
      this.overlay.setInstruction(INSTRUCTIONS.SELECT_START);
      this.overlay.onWidthChanged = (startX, endX) => {
        this.startX = startX;
        this.endX = endX;
      };
      this.overlay.onConfirmCapture = () => {
        this.confirmCurrentRange();
      };
      this.overlay.onCancel = () => {
        this.cancel();
      };
      window.addEventListener("mousemove", this.handleMouseMoveBound, { passive: true });
      window.addEventListener("scroll", this.handleScrollBound, { passive: true });
      window.addEventListener("click", this.handleClickBound, true);
      window.addEventListener("keydown", this.handleKeyDownBound);
    }
    /**
     * Mouse move: update guide line position and coordinate readout
     */
    handleMouseMove(e) {
      if (this.state !== "SELECTING_START" && this.state !== "SELECTING_END") {
        return;
      }
      this.lastClientY = e.clientY;
      const viewportY = e.clientY;
      const documentY = getEventDocumentY(e);
      const label = this.state === "SELECTING_START" ? "START" : "END";
      this.overlay.updateGuideLine(viewportY, documentY, label);
    }
    /**
     * Handle user scrolling: update guide line and badge in real time
     */
    handleScroll() {
      if (this.state !== "SELECTING_START" && this.state !== "SELECTING_END") {
        return;
      }
      if (this.lastClientY !== null) {
        const scrollY = getEventDocumentY({ clientY: 0 });
        const documentY = this.lastClientY + scrollY;
        const label = this.state === "SELECTING_START" ? "START" : "END";
        this.overlay.updateGuideLine(this.lastClientY, documentY, label);
      }
    }
    /**
     * Click: place START or END marker
     */
    handleClick(e) {
      const target = e.target;
      if (target && target.closest && target.closest("rangeshot-host")) {
        return;
      }
      const clickedDocY = getEventDocumentY(e);
      if (this.state === "SELECTING_START") {
        e.preventDefault();
        e.stopPropagation();
        this.startY = clickedDocY;
        this.overlay.setStartMarker(this.startY);
        this.overlay.setInstruction(
          INSTRUCTIONS.START_SELECTED,
          INSTRUCTIONS.SELECT_END
        );
        this.state = "SELECTING_END";
        return;
      }
      if (this.state === "SELECTING_END") {
        e.preventDefault();
        e.stopPropagation();
        if (this.startY === null) return;
        if (Math.abs(clickedDocY - this.startY) < 5) {
          this.overlay.showWarning("Selection range is too small. Please scroll down and select END.");
          return;
        }
        const finalStartY = Math.min(this.startY, clickedDocY);
        const finalEndY = Math.max(this.startY, clickedDocY);
        this.startY = finalStartY;
        this.endY = finalEndY;
        const bounds = this.overlay.getWidthBounds();
        this.startX = bounds.startX;
        this.endX = bounds.endX;
        const range = {
          startY: this.startY,
          endY: this.endY,
          startX: this.startX,
          endX: this.endX
        };
        this.overlay.setStartMarker(this.startY);
        this.overlay.setEndMarker(this.endY);
        this.overlay.setSelectionBand(range);
        this.overlay.hideGuideLine();
        this.overlay.showConfirmation(range);
        this.confirmCurrentRange();
        return;
      }
    }
    /**
     * Keydown handler: Escape to cancel, Enter to confirm
     */
    handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        this.cancel();
      } else if (e.key === "Enter" && this.state === "RANGE_SELECTED") {
        e.preventDefault();
        this.confirmCurrentRange();
      }
    }
    /**
     * Confirm currently selected range and trigger capture
     */
    confirmCurrentRange() {
      if (this.startY === null || this.endY === null) return;
      this.state = "CAPTURING";
      this.detachListeners();
      this.overlay.hideGuideLine();
      const bounds = this.overlay.getWidthBounds();
      this.startX = bounds.startX;
      this.endX = bounds.endX;
      const range = {
        startY: this.startY,
        endY: this.endY,
        startX: this.startX,
        endX: this.endX
      };
      this.onRangeConfirmed?.(range);
    }
    /**
     * Cancel selection and clean up
     */
    cancel() {
      this.state = "IDLE";
      this.detachListeners();
      this.overlay.unmount();
      this.onCancelled?.();
    }
    /**
     * Detach document event listeners
     */
    detachListeners() {
      window.removeEventListener("mousemove", this.handleMouseMoveBound);
      window.removeEventListener("scroll", this.handleScrollBound);
      window.removeEventListener("click", this.handleClickBound, true);
      window.removeEventListener("keydown", this.handleKeyDownBound);
    }
  };

  // src/shared/utils.ts
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function formatTimestamp(date = /* @__PURE__ */ new Date()) {
    const pad = (n) => n.toString().padStart(2, "0");
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    return `${y}-${m}-${d}-${h}${min}${s}`;
  }
  function generateFilename() {
    return `rangeshot-${formatTimestamp()}.png`;
  }

  // src/capture/viewport-capture.ts
  async function captureCurrentViewport() {
    const message = {
      type: MessageTypes.CAPTURE_VISIBLE_TAB
    };
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          return reject(new Error(err.message || "Communication error with background"));
        }
        if (!response) {
          return reject(new Error("No response received from background capture service"));
        }
        if (!response.success || !response.dataUrl) {
          return reject(new Error(response.error || "Failed to capture visible tab"));
        }
        resolve(response.dataUrl);
      });
    });
  }

  // src/capture/image-cropper.ts
  function calculateSlicePlan(sliceStartDocY, sliceEndDocY, sliceDocTop, rangeStartY, sourceImageWidth, sourceScaleY, sourceImageHeight, destScaleY, destWidth, sourceCropX, sourceCropWidth) {
    let sy = Math.max(0, Math.round((sliceStartDocY - sliceDocTop) * sourceScaleY));
    let sh = Math.max(0, Math.round((sliceEndDocY - sliceStartDocY) * sourceScaleY));
    if (typeof sourceImageHeight === "number" && sourceImageHeight > 0) {
      sy = Math.min(sourceImageHeight - 1, sy);
      sh = Math.min(sourceImageHeight - sy, sh);
    }
    const sx = typeof sourceCropX === "number" ? Math.max(0, Math.min(sourceImageWidth - 1, Math.round(sourceCropX))) : 0;
    const sw = typeof sourceCropWidth === "number" ? Math.max(1, Math.min(sourceImageWidth - sx, Math.round(sourceCropWidth))) : sourceImageWidth;
    const effectiveDestScaleY = typeof destScaleY === "number" ? destScaleY : sourceScaleY;
    const effectiveDestWidth = typeof destWidth === "number" ? destWidth : sw;
    const dy = Math.round((sliceStartDocY - rangeStartY) * effectiveDestScaleY);
    const nextY = Math.round((sliceEndDocY - rangeStartY) * effectiveDestScaleY);
    const dh = Math.max(0, nextY - dy);
    return {
      source: {
        sx,
        sy,
        sw,
        sh
      },
      destination: {
        dx: 0,
        dy,
        dw: effectiveDestWidth,
        dh
      }
    };
  }

  // src/capture/image-stitcher.ts
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error("Failed to load image slice: " + err));
      img.src = dataUrl;
    });
  }
  var MAX_SAFE_CANVAS_HEIGHT = 24e3;
  var MAX_SAFE_CANVAS_WIDTH = 16384;
  var MAX_SAFE_CANVAS_AREA = 8e7;
  var MAX_CHUNK_DOC_HEIGHT = 22e3;
  function calculateSafeDimensions(chunkDocHeight, sourceCropWidth, sourceScaleY, sourceScaleX = sourceScaleY) {
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
  async function renderChunkToBlob(slices, chunkStartY, chunkEndY, firstImage, sourceScaleY, sourceScaleX, sourceCropX, sourceCropWidth, onSliceProcessed) {
    const chunkHeight = chunkEndY - chunkStartY;
    const { destWidth, destHeight, destScaleY } = calculateSafeDimensions(
      chunkHeight,
      sourceCropWidth,
      sourceScaleY,
      sourceScaleX
    );
    const canvas = document.createElement("canvas");
    canvas.width = destWidth;
    canvas.height = destHeight;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("Failed to obtain 2D canvas rendering context");
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    let coveredDocY = chunkStartY;
    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      const sliceDocTop = slice.documentY;
      const sliceDocBottom = slice.documentY + slice.viewportHeight;
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
        img.src = "";
      }
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        canvas.width = 0;
        canvas.height = 0;
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert stitched canvas to PNG Blob"));
        }
      }, "image/png");
    });
  }
  async function stitchSlicesToBlobs(slices, range, onProgress) {
    if (!slices || slices.length === 0) {
      throw new Error("No image slices provided for stitching");
    }
    const { startY, endY, startX, endX } = range;
    const totalDocHeight = endY - startY;
    if (totalDocHeight <= 0) {
      throw new Error(`Invalid range dimensions: startY=${startY}, endY=${endY}`);
    }
    const firstSlice = slices[0];
    const viewportWidth = firstSlice.viewportWidth;
    const effectiveStartX = typeof startX === "number" ? Math.max(0, Math.min(viewportWidth - 10, startX)) : 0;
    const effectiveEndX = typeof endX === "number" ? Math.min(viewportWidth, Math.max(effectiveStartX + 10, endX)) : viewportWidth;
    const cropDocWidth = effectiveEndX - effectiveStartX;
    const firstImage = await loadImage(firstSlice.dataUrl);
    const sourceScaleY = firstImage.naturalHeight / firstSlice.viewportHeight;
    const sourceScaleX = firstImage.naturalWidth / firstSlice.viewportWidth;
    const sourceCropX = Math.round(effectiveStartX * sourceScaleX);
    const sourceCropWidth = Math.min(
      firstImage.naturalWidth - sourceCropX,
      Math.round(cropDocWidth * sourceScaleX)
    );
    const chunks = [];
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
    const blobs = [];
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

  // src/content/capture-controller.ts
  var CaptureController = class {
    pageState = new PageStateManager();
    overlay;
    isCapturing = false;
    hiddenFixedElements = [];
    constructor(overlay) {
      this.overlay = overlay;
    }
    /**
     * Execute the full range capture sequence
     */
    async captureRange(range) {
      if (this.isCapturing) return;
      this.isCapturing = true;
      const { startY, endY } = range;
      console.log(`[RangeShot] Starting multi-viewport capture for range: ${startY}px to ${endY}px (Total: ${endY - startY}px)`);
      this.pageState.captureSnapshot();
      this.pageState.hideScrollbarsAndTransitions();
      const slices = [];
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const dpr = window.devicePixelRatio || 1;
      const stepSize = Math.max(100, vh - 60);
      const targetPositions = [];
      for (let y = startY; y < endY; y += stepSize) {
        targetPositions.push(y);
      }
      const finalScrollTarget = Math.max(startY, endY - vh);
      if (targetPositions.length === 0 || targetPositions[targetPositions.length - 1] < finalScrollTarget) {
        targetPositions.push(finalScrollTarget);
      }
      console.log(`[RangeShot] Planned ${targetPositions.length} viewport captures at positions:`, targetPositions);
      try {
        this.overlay.hideForCapture();
        await new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
        await sleep(100);
        this.suppressBottomFloatingElements();
        for (let i = 0; i < targetPositions.length; i++) {
          const targetY = targetPositions[i];
          const stepNum = i + 1;
          const totalSteps = targetPositions.length;
          console.log(`[RangeShot] Capturing section ${stepNum} of ${totalSteps}...`);
          setPageScrollY(targetY);
          await new Promise((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            });
          });
          await sleep(250);
          const actualScrollY = getPageScrollY();
          console.log(`[RangeShot] Step ${stepNum}/${totalSteps}: Scrolled to target ${targetY}px (actual: ${actualScrollY}px)`);
          if (i === 1) {
            this.suppressTopStickyHeaders();
          }
          const dataUrl = await captureCurrentViewport();
          slices.push({
            dataUrl,
            documentY: actualScrollY,
            viewportWidth: vw,
            viewportHeight: vh,
            devicePixelRatio: dpr
          });
          await sleep(350);
        }
        console.log(`[RangeShot] Successfully captured ${slices.length} slices across range [${startY}, ${endY}].`);
      } catch (err) {
        console.error("[RangeShot] Error during multi-viewport capture:", err);
        this.cleanup();
        const message = err instanceof Error ? err.message : String(err);
        this.overlay.showProgress(`Capture failed: ${message}`, 100);
        await sleep(3500);
        this.overlay.unmount();
        return;
      } finally {
        this.cleanup();
      }
      try {
        this.overlay.showAfterCapture();
        this.overlay.showProgress("Stitching long screenshot...", 65);
        const blobs = await stitchSlicesToBlobs(slices, range, (current, total) => {
          const percent = 65 + Math.round(current / total * 25);
          this.overlay.showProgress(`Stitching section ${current} of ${total}...`, percent);
        });
        this.overlay.showProgress("Saving PNG...", 95);
        const baseFilename = generateFilename();
        if (blobs.length === 1) {
          await this.downloadBlob(blobs[0], baseFilename);
        } else {
          for (let p = 0; p < blobs.length; p++) {
            const partFilename = baseFilename.replace(".png", `-part${p + 1}.png`);
            await this.downloadBlob(blobs[p], partFilename);
            await sleep(400);
          }
        }
        const successMsg = blobs.length > 1 ? `Long screenshot saved in ${blobs.length} parts!` : "Long screenshot saved successfully!";
        this.overlay.showProgress(successMsg, 100);
        await sleep(1800);
        this.overlay.unmount();
      } catch (err) {
        console.error("[RangeShot] Error stitching or saving image:", err);
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
    hideElement(el) {
      if (!el || !el.isConnected) return;
      if (this.hiddenFixedElements.some((h) => h.element === el)) return;
      this.hiddenFixedElements.push({
        element: el,
        originalVisibility: el.style.visibility
      });
      el.style.visibility = "hidden";
    }
    /**
     * Suppress bottom-pinned elements (search/prompt input bars, composers, scroll-to-bottom buttons)
     * across ALL capture slices so they never overlay content in long screenshots.
     */
    suppressBottomFloatingElements() {
      const vh = window.innerHeight;
      const scrollContainer = findScrollContainer();
      const promptInputs = document.querySelectorAll(
        'textarea#prompt-textarea, #prompt-textarea, textarea[placeholder*="Ask"], textarea[placeholder*="Message"], textarea[placeholder*="Send"], form textarea, div[contenteditable="true"][data-placeholder], [class*="prompt-box"], [class*="composer"]'
      );
      for (let i = 0; i < promptInputs.length; i++) {
        const input = promptInputs[i];
        let current = input;
        while (current && current !== document.body && current !== document.documentElement) {
          if (scrollContainer && current === scrollContainer) break;
          const rect = current.getBoundingClientRect();
          if (rect.bottom >= vh - 60 && rect.top >= vh * 0.4 && rect.height < 350) {
            this.hideElement(current);
            break;
          }
          current = current.parentElement;
        }
      }
      const buttons = document.querySelectorAll('button, [role="button"], a[class*="btn"]');
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        if (btn.closest && btn.closest("rangeshot-host")) continue;
        const rect = btn.getBoundingClientRect();
        if (rect.top >= vh * 0.4 && rect.bottom <= vh) {
          const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
          const className = (btn.className || "").toString().toLowerCase();
          const hasDownIcon = btn.querySelector("svg") !== null;
          if (aria.includes("scroll") || aria.includes("bottom") || className.includes("scroll") || className.includes("bottom") || hasDownIcon && rect.width <= 60 && rect.height <= 60) {
            this.hideElement(btn);
          }
        }
      }
      const all = document.querySelectorAll("*");
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el.closest && el.closest("rangeshot-host")) continue;
        if (scrollContainer && (el === scrollContainer || el.contains(scrollContainer))) continue;
        const style = window.getComputedStyle(el);
        const isPinned = style.position === "fixed" || style.position === "sticky" || style.position === "absolute";
        if (!isPinned) continue;
        const rect = el.getBoundingClientRect();
        if (rect.bottom >= vh - 40 && rect.top >= vh * 0.5 && rect.height < 300) {
          this.hideElement(el);
        }
      }
    }
    /**
     * Suppress small sticky/fixed top headers (site navbars) on slices 2+
     */
    suppressTopStickyHeaders() {
      const scrollContainer = findScrollContainer();
      const all = document.querySelectorAll("*");
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el.closest && el.closest("rangeshot-host")) continue;
        if (scrollContainer && (el === scrollContainer || el.contains(scrollContainer))) continue;
        const style = window.getComputedStyle(el);
        if (style.position === "fixed" || style.position === "sticky") {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 60 && rect.height <= 120) {
            this.hideElement(el);
          }
        }
      }
    }
    /**
     * Restore fixed/sticky elements to their original visibility
     */
    restoreFixedElements() {
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
    async downloadBlob(blob, filename) {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
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
    cleanup() {
      this.restoreFixedElements();
      this.pageState.restoreOriginalPosition();
    }
  };

  // src/content/content-main.ts
  if (!window.__rangeshot_initialized) {
    let initRangeCapture = function() {
      if (activeOverlay) {
        activeOverlay.unmount();
      }
      activeOverlay = new RangeShotOverlay();
      activeSelector = new RangeSelector(activeOverlay);
      activeController = new CaptureController(activeOverlay);
      activeSelector.onRangeConfirmed = async (range) => {
        console.log("[RangeShot] Range confirmed, triggering controller:", range);
        if (activeController) {
          await activeController.captureRange(range);
        }
      };
      activeSelector.onCancelled = () => {
        console.log("[RangeShot] Selection cancelled by user.");
      };
      activeSelector.start();
    };
    initRangeCapture2 = initRangeCapture;
    window.__rangeshot_initialized = true;
    console.log("[RangeShot] Content script loaded and ready.");
    let activeOverlay = null;
    let activeSelector = null;
    let activeController = null;
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(
        (message, _sender, sendResponse) => {
          if (message.type === MessageTypes.START_RANGE_SELECTION) {
            initRangeCapture();
            sendResponse({ success: true });
            return true;
          }
          if (message.type === MessageTypes.CANCEL_CAPTURE) {
            if (activeSelector) {
              activeSelector.cancel();
            }
            sendResponse({ success: true });
            return true;
          }
          return false;
        }
      );
    }
    window.addEventListener("__rangeshot_test_start", () => {
      initRangeCapture();
    });
  }
  var initRangeCapture2;
})();
