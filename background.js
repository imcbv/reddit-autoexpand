// Background service worker - handles keyboard shortcut command

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'expand-comments') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('reddit.com')) {
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          if (!window._redditExpander) {
            return;
          }

          // Show toast helper
          function showToast(message, duration = 3000) {
            const existing = document.getElementById('reddit-expander-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.id = 'reddit-expander-toast';
            toast.textContent = message;
            toast.style.cssText = `
              position: fixed;
              bottom: 20px;
              right: 20px;
              background: #ff4500;
              color: white;
              padding: 12px 20px;
              border-radius: 8px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              font-weight: 500;
              z-index: 999999;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              transition: opacity 0.3s;
            `;
            document.body.appendChild(toast);

            if (duration > 0) {
              setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
              }, duration);
            }
          }

          function updateToast(message) {
            const toast = document.getElementById('reddit-expander-toast');
            if (toast) {
              toast.textContent = message;
            } else {
              showToast(message, 0);
            }
          }

          if (window._redditExpander.isRunning()) {
            window._redditExpander.stop();
            showToast('Stopped', 2000);
          } else {
            showToast('Starting...', 0);
            const result = await window._redditExpander.start((msg) => {
              updateToast(msg);
            });
            if (result.aborted) {
              showToast(`Stopped. Expanded ${result.expanded} items`, 3000);
            } else {
              showToast(`Done! Expanded ${result.expanded} items`, 3000);
            }
          }
        }
      });
    } catch (error) {
      console.error('Reddit Expander: Error', error);
    }
  }
});
