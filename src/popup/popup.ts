import { MessageTypes, StartRangeSelectionMessage } from '../shared/messages';

document.addEventListener('DOMContentLoaded', async () => {
  const captureRangeBtn = document.getElementById('captureRangeBtn') as HTMLButtonElement | null;
  const statusArea = document.getElementById('statusArea') as HTMLDivElement | null;

  if (!captureRangeBtn) return;

  // 1. Check current active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab || !activeTab.id || !activeTab.url) {
    showError(captureRangeBtn, statusArea, 'No active tab found.');
    return;
  }

  // 2. Validate URL restrictions
  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'devtools:', 'about:'];
  const isRestrictedUrl =
    restrictedProtocols.some((protocol) => activeTab.url?.startsWith(protocol)) ||
    activeTab.url?.includes('chromewebstore.google.com') ||
    activeTab.url?.includes('chrome.google.com/webstore');

  if (isRestrictedUrl) {
    showError(
      captureRangeBtn,
      statusArea,
      'RangeShot cannot capture special browser pages. Please open a regular website or local HTML file.'
    );
    return;
  }

  // 3. Bind click handler
  captureRangeBtn.addEventListener('click', async () => {
    captureRangeBtn.disabled = true;

    try {
      // First attempt to send message directly to existing content script
      const message: StartRangeSelectionMessage = {
        type: MessageTypes.START_RANGE_SELECTION,
      };

      chrome.tabs.sendMessage(activeTab.id!, message, async (response) => {
        const lastError = chrome.runtime.lastError;

        // If content script was not already loaded (e.g., tab opened before extension install)
        if (lastError || !response) {
          console.log('[RangeShot] Injecting content script on demand...');
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id! },
              files: ['content.js'],
            });

            // Re-send message after injection
            setTimeout(() => {
              chrome.tabs.sendMessage(activeTab.id!, message, () => {
                window.close();
              });
            }, 100);
          } catch (injectErr) {
            console.error('[RangeShot] Injection failed:', injectErr);
            showError(
              captureRangeBtn,
              statusArea,
              'Could not activate on this page. Try refreshing the page.'
            );
          }
        } else {
          // Successfully initiated, close popup to yield focus to the webpage
          window.close();
        }
      });
    } catch (err) {
      console.error('[RangeShot] Error sending start message:', err);
      showError(captureRangeBtn, statusArea, 'Failed to activate RangeShot.');
    }
  });
});

function showError(
  button: HTMLButtonElement,
  statusArea: HTMLDivElement | null,
  message: string
): void {
  button.disabled = true;
  if (statusArea) {
    statusArea.innerHTML = `<div class="alert-message">${message}</div>`;
  }
}
