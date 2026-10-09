import { MessageTypes, ExtensionMessage } from '../shared/messages';
import { RangeShotOverlay } from './overlay';
import { RangeSelector } from './range-selector';
import { CaptureController } from './capture-controller';

// Guard against multiple injections
if (!(window as unknown as { __rangeshot_initialized?: boolean }).__rangeshot_initialized) {
  (window as unknown as { __rangeshot_initialized?: boolean }).__rangeshot_initialized = true;

  console.log('[RangeShot] Content script loaded and ready.');

  let activeOverlay: RangeShotOverlay | null = null;
  let activeSelector: RangeSelector | null = null;
  let activeController: CaptureController | null = null;

  function initRangeCapture(): void {
    // If an existing session is running, clean it up first
    if (activeOverlay) {
      activeOverlay.unmount();
    }

    activeOverlay = new RangeShotOverlay();
    activeSelector = new RangeSelector(activeOverlay);
    activeController = new CaptureController(activeOverlay);

    activeSelector.onRangeConfirmed = async (range) => {
      console.log('[RangeShot] Range confirmed, triggering controller:', range);
      if (activeController) {
        await activeController.captureRange(range);
      }
    };

    activeSelector.onCancelled = () => {
      console.log('[RangeShot] Selection cancelled by user.');
    };

    activeSelector.start();
  }

  // Listen for messages from popup or background
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(
      (
        message: ExtensionMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (res: unknown) => void
      ) => {
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

  // Expose test trigger event for automated E2E tests
  window.addEventListener('__rangeshot_test_start', () => {
    initRangeCapture();
  });
}
