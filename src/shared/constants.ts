export const EXTENSION_NAME = 'RangeShot';
export const ROOT_ELEMENT_ID = 'rangeshot-overlay-root';
export const SHADOW_HOST_TAG = 'rangeshot-host';

export const TIMINGS = {
  // Settle time after window.scrollTo to let layout/paint stabilize
  SCROLL_SETTLE_MS: 180,
  // Toast auto-hide delay
  TOAST_DURATION_MS: 3000,
} as const;

export const STYLES = {
  Z_INDEX: 2147483647, // Maximum 32-bit integer for top-level overlay
  START_COLOR: '#10b981', // Emerald green
  END_COLOR: '#6366f1', // Indigo / violet
  SELECTION_BG: 'rgba(99, 102, 241, 0.12)',
  SELECTION_BORDER: 'rgba(99, 102, 241, 0.6)',
} as const;

export const INSTRUCTIONS = {
  SELECT_START: 'Click to set START',
  START_SELECTED: 'START selected',
  SELECT_END: 'Scroll down and click to set END',
  END_MUST_BE_BELOW_START: 'END must be below START. Scroll down and select END again.',
  RANGE_SELECTED: 'Range selected',
  CAPTURING: 'Capturing RangeShot...',
} as const;
