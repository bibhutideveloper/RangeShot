export const MessageTypes = {
  START_RANGE_SELECTION: 'START_RANGE_SELECTION',
  RANGE_SELECTION_STARTED: 'RANGE_SELECTION_STARTED',
  CAPTURE_VISIBLE_TAB: 'CAPTURE_VISIBLE_TAB',
  DOWNLOAD_CAPTURE: 'DOWNLOAD_CAPTURE',
  CANCEL_CAPTURE: 'CANCEL_CAPTURE',
  CAPTURE_PROGRESS: 'CAPTURE_PROGRESS',
  CAPTURE_COMPLETE: 'CAPTURE_COMPLETE',
  CAPTURE_ERROR: 'CAPTURE_ERROR',
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];

export interface StartRangeSelectionMessage {
  type: typeof MessageTypes.START_RANGE_SELECTION;
}

export interface RangeSelectionStartedMessage {
  type: typeof MessageTypes.RANGE_SELECTION_STARTED;
}

export interface CaptureVisibleTabMessage {
  type: typeof MessageTypes.CAPTURE_VISIBLE_TAB;
}

export interface CaptureVisibleTabResponse {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface DownloadCaptureMessage {
  type: typeof MessageTypes.DOWNLOAD_CAPTURE;
  dataUrl: string;
  filename: string;
}

export interface DownloadCaptureResponse {
  success: boolean;
  downloadId?: number;
  error?: string;
}

export interface CancelCaptureMessage {
  type: typeof MessageTypes.CANCEL_CAPTURE;
}

export interface CaptureProgressMessage {
  type: typeof MessageTypes.CAPTURE_PROGRESS;
  currentStep: number;
  totalSteps: number;
  message: string;
}

export interface CaptureCompleteMessage {
  type: typeof MessageTypes.CAPTURE_COMPLETE;
  filename: string;
}

export interface CaptureErrorMessage {
  type: typeof MessageTypes.CAPTURE_ERROR;
  error: string;
}

export type ExtensionMessage =
  | StartRangeSelectionMessage
  | RangeSelectionStartedMessage
  | CaptureVisibleTabMessage
  | DownloadCaptureMessage
  | CancelCaptureMessage
  | CaptureProgressMessage
  | CaptureCompleteMessage
  | CaptureErrorMessage;
