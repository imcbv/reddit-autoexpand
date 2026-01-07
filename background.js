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
          const api = window._redditExpander;
          if (!api) return;

          if (api.isRunning()) {
            api.stop();
            api.showToast('Stopped', 2000);
          } else {
            api.showToast('Starting...', 0);
            const result = await api.start((msg) => {
              api.updateToast(msg);
            });
            if (result.aborted) {
              api.showToast(`Stopped. Expanded ${result.expanded} items`, 3000);
            } else {
              api.showToast(`Done! Expanded ${result.expanded} items`, 3000);
            }
          }
        }
      });
    } catch (error) {
      console.error('Reddit Expander: Error', error);
    }
  }
});
