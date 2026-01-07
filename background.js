// Background service worker - handles keyboard shortcut command

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'expand-comments') {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('reddit.com')) {
      console.log('Reddit Expander: Not a Reddit page');
      return;
    }

    // Toggle expansion on the page
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          if (!window._redditExpander) {
            console.log('Reddit Expander: Not loaded yet');
            return;
          }

          if (window._redditExpander.isRunning()) {
            console.log('Reddit Expander: Stopping...');
            window._redditExpander.stop();
          } else {
            console.log('Reddit Expander: Starting...');
            const result = await window._redditExpander.start((msg) => {
              console.log('Reddit Expander:', msg);
            });
            console.log('Reddit Expander: Done!', result);
          }
        }
      });
    } catch (error) {
      console.error('Reddit Expander: Error executing script', error);
    }
  }
});

console.log('Reddit Expander: Background service worker loaded');
