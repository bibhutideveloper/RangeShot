import {
  MessageTypes,
  CaptureVisibleTabMessage,
  CaptureVisibleTabResponse,
} from '../shared/messages';

/**
 * Request background service worker to capture the visible tab
 */
export async function captureCurrentViewport(): Promise<string> {
  const message: CaptureVisibleTabMessage = {
    type: MessageTypes.CAPTURE_VISIBLE_TAB,
  };

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: CaptureVisibleTabResponse) => {
      const err = chrome.runtime.lastError;
      if (err) {
        return reject(new Error(err.message || 'Communication error with background'));
      }
      if (!response) {
        return reject(new Error('No response received from background capture service'));
      }
      if (!response.success || !response.dataUrl) {
        return reject(new Error(response.error || 'Failed to capture visible tab'));
      }
      resolve(response.dataUrl);
    });
  });
}
