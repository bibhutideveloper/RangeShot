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

// src/background/service-worker.ts
console.log("[RangeShot] Background Service Worker initialized.");
chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (message.type === MessageTypes.CAPTURE_VISIBLE_TAB) {
      const windowId = sender.tab?.windowId ?? null;
      handleCaptureVisibleTab(windowId, sendResponse);
      return true;
    }
    if (message.type === MessageTypes.DOWNLOAD_CAPTURE) {
      handleDownloadCapture(message.dataUrl, message.filename, sendResponse);
      return true;
    }
    return false;
  }
);
function handleCaptureVisibleTab(windowId, sendResponse, retryCount = 0) {
  try {
    const captureOptions = { format: "png" };
    const callback = (dataUrl) => {
      const err = chrome.runtime.lastError;
      if (err) {
        if (err.message && err.message.includes("MAX_CAPTURE_VISIBLE_TAB") && retryCount < 4) {
          console.warn(`[RangeShot] Rate limit hit, retrying in 350ms (attempt ${retryCount + 1})...`);
          setTimeout(() => {
            handleCaptureVisibleTab(windowId, sendResponse, retryCount + 1);
          }, 350);
          return;
        }
        console.error("[RangeShot] Error capturing visible tab:", err.message);
        sendResponse({
          success: false,
          error: err.message || "Failed to capture visible tab"
        });
      } else if (!dataUrl) {
        console.error("[RangeShot] No image data returned");
        sendResponse({
          success: false,
          error: "No image data returned from captureVisibleTab"
        });
      } else {
        sendResponse({
          success: true,
          dataUrl
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
    console.error("[RangeShot] Exception during captureVisibleTab:", errorMsg);
    sendResponse({
      success: false,
      error: errorMsg
    });
  }
}
function handleDownloadCapture(dataUrl, filename, sendResponse) {
  try {
    chrome.downloads.download(
      {
        url: dataUrl,
        filename,
        saveAs: false
      },
      (downloadId) => {
        const err = chrome.runtime.lastError;
        if (err) {
          console.error("[RangeShot] Download failed:", err.message);
          sendResponse({
            success: false,
            error: err.message || "Download failed"
          });
        } else {
          console.log("[RangeShot] Download started with ID:", downloadId);
          sendResponse({
            success: true,
            downloadId
          });
        }
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[RangeShot] Exception during download:", errorMsg);
    sendResponse({
      success: false,
      error: errorMsg
    });
  }
}
