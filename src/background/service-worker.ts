import {
  MessageTypes,
  CaptureVisibleTabResponse,
  DownloadCaptureResponse,
  ExtensionMessage,
} from '../shared/messages';

console.log('[RangeShot] Background Service Worker initialized.');

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === MessageTypes.CAPTURE_VISIBLE_TAB) {
      const windowId = sender.tab?.windowId ?? null;
      handleCaptureVisibleTab(windowId, sendResponse);
      return true; // Keep channel open for async response
    }

    if (message.type === MessageTypes.DOWNLOAD_CAPTURE) {
      handleDownloadCapture(message.dataUrl, message.filename, sendResponse);
      return true; // Keep channel open for async response
    }

    return false;
  }
);

/**
 * Capture the currently active visible tab as PNG with automatic rate-limit retry
 */
function handleCaptureVisibleTab(
  windowId: number | null,
  sendResponse: (res: CaptureVisibleTabResponse) => void,
  retryCount = 0
) {
  try {
    const captureOptions = { format: 'png' as const };
    const callback = (dataUrl?: string) => {
      const err = chrome.runtime.lastError;
      if (err) {
        // If hit Chrome's MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND rate limit, retry with backoff
        if (
          err.message &&
          err.message.includes('MAX_CAPTURE_VISIBLE_TAB') &&
          retryCount < 4
        ) {
          console.warn(`[RangeShot] Rate limit hit, retrying in 350ms (attempt ${retryCount + 1})...`);
          setTimeout(() => {
            handleCaptureVisibleTab(windowId, sendResponse, retryCount + 1);
          }, 350);
          return;
        }

        console.error('[RangeShot] Error capturing visible tab:', err.message);
        sendResponse({
          success: false,
          error: err.message || 'Failed to capture visible tab',
        });
      } else if (!dataUrl) {
        console.error('[RangeShot] No image data returned');
        sendResponse({
          success: false,
          error: 'No image data returned from captureVisibleTab',
        });
      } else {
        sendResponse({
          success: true,
          dataUrl,
        });
      }
    };

    if (windowId !== null) {
      chrome.tabs.captureVisibleTab(windowId, captureOptions, callback);
    } else {
      chrome.tabs.captureVisibleTab(captureOptions, callback);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[RangeShot] Exception during captureVisibleTab:', errorMsg);
    sendResponse({
      success: false,
      error: errorMsg,
    });
  }
}

/**
 * Trigger file download via chrome.downloads API
 */
function handleDownloadCapture(
  dataUrl: string,
  filename: string,
  sendResponse: (res: DownloadCaptureResponse) => void
) {
  try {
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: filename,
        saveAs: false,
      },
      (downloadId) => {
        const err = chrome.runtime.lastError;
        if (err) {
          console.error('[RangeShot] Download failed:', err.message);
          sendResponse({
            success: false,
            error: err.message || 'Download failed',
          });
        } else {
          console.log('[RangeShot] Download started with ID:', downloadId);
          sendResponse({
            success: true,
            downloadId,
          });
        }
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[RangeShot] Exception during download:', errorMsg);
    sendResponse({
      success: false,
      error: errorMsg,
    });
  }
}
