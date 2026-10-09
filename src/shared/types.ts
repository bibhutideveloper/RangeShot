export interface CaptureRange {
  startY: number;
  endY: number;
  startX?: number;
  endX?: number;
}

export interface ViewportMetadata {
  documentY: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

export interface CaptureSlice extends ViewportMetadata {
  dataUrl: string;
}

export interface PageStateSnapshot {
  originalScrollX: number;
  originalScrollY: number;
  htmlOverflow: string;
  bodyOverflow: string;
}

export type SelectionState =
  | 'IDLE'
  | 'SELECTING_START'
  | 'SELECTING_END'
  | 'RANGE_SELECTED'
  | 'CAPTURING';

export interface StitchProgress {
  currentStep: number;
  totalSteps: number;
  statusMessage: string;
}
