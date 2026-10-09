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

// src/popup/popup.ts
document.addEventListener("DOMContentLoaded", async () => {
  const captureRangeBtn = document.getElementById("captureRangeBtn");
  const statusArea = document.getElementById("statusArea");
  if (!captureRangeBtn) return;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id || !activeTab.url) {
    showError(captureRangeBtn, statusArea, "No active tab found.");
    return;
  }
  const restrictedProtocols = ["chrome:", "chrome-extension:", "edge:", "devtools:", "about:"];
  const isRestrictedUrl = restrictedProtocols.some((protocol) => activeTab.url?.startsWith(protocol)) || activeTab.url?.includes("chromewebstore.google.com") || activeTab.url?.includes("chrome.google.com/webstore");
  if (isRestrictedUrl) {
    showError(
      captureRangeBtn,
      statusArea,
      "RangeShot cannot capture special browser pages. Please open a regular website or local HTML file."
    );
    return;
  }
  captureRangeBtn.addEventListener("click", async () => {
    captureRangeBtn.disabled = true;
    try {
      const message = {
        type: MessageTypes.START_RANGE_SELECTION
      };
      chrome.tabs.sendMessage(activeTab.id, message, async (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError || !response) {
          console.log("[RangeShot] Injecting content script on demand...");
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["content.js"]
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(activeTab.id, message, () => {
                window.close();
              });
            }, 100);
          } catch (injectErr) {
            console.error("[RangeShot] Injection failed:", injectErr);
            showError(
              captureRangeBtn,
              statusArea,
              "Could not activate on this page. Try refreshing the page."
            );
          }
        } else {
          window.close();
        }
      });
    } catch (err) {
      console.error("[RangeShot] Error sending start message:", err);
      showError(captureRangeBtn, statusArea, "Failed to activate RangeShot.");
    }
  });
});
function showError(button, statusArea, message) {
  button.disabled = true;
  if (statusArea) {
    statusArea.innerHTML = `<div class="alert-message">${message}</div>`;
  }
}
