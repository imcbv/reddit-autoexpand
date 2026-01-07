document.addEventListener('DOMContentLoaded', () => {
  const expandAllBtn = document.getElementById('expandAll');
  const statusEl = document.getElementById('status');

  let currentTabId = null;

  function setStatus(message, type = '') {
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
  }

  expandAllBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url?.includes('reddit.com')) {
        setStatus('Not a Reddit page', 'error');
        return;
      }

      currentTabId = tab.id;

      // Check if already running
      const [checkResult] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window._redditExpander?.isRunning?.() || false
      });

      if (checkResult?.result) {
        // Stop if running
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window._redditExpander?.stop?.()
        });
        expandAllBtn.textContent = 'Expand All Comments';
        setStatus('Stopped', '');
        return;
      }

      // Start expansion
      expandAllBtn.textContent = 'Stop';
      setStatus('Starting...');

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          if (!window._redditExpander) {
            return { error: 'Extension not loaded. Refresh the page.' };
          }
          return await window._redditExpander.start();
        }
      });

      const data = result?.result || {};

      if (data.error) {
        setStatus(data.error, 'error');
      } else if (data.aborted) {
        setStatus(`Stopped. Expanded ${data.expanded} items`, '');
      } else {
        setStatus(`Done! Expanded ${data.expanded} items`, 'success');
      }

    } catch (error) {
      setStatus('Error: ' + error.message, 'error');
    } finally {
      expandAllBtn.textContent = 'Expand All Comments';
    }
  });

  // Poll for status updates while running
  async function pollStatus() {
    if (!currentTabId) return;

    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: () => window._redditExpander?.isRunning?.() || false
      });

      if (result?.result) {
        expandAllBtn.textContent = 'Stop';
      } else {
        expandAllBtn.textContent = 'Expand All Comments';
      }
    } catch (e) {
      // Tab might be closed
    }
  }

  setInterval(pollStatus, 500);
});
