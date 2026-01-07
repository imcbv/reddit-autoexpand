// Reddit Auto-Expand - Content Script
// This is the SINGLE source of truth for expansion logic

(function() {
  'use strict';

  let isRunning = false;
  let abortController = null;

  const CONFIG = {
    scrollInterval: 300,
    scrollTimeout: 20000,
    expandDelay: 400,
    maxPasses: 200,
    noProgressLimit: 5
  };

  const EXCLUDE_SELECTORS = [
    'header', 'nav', 'aside',
    '#right-sidebar-container',
    '[data-testid="subreddit-sidebar"]',
    'pdp-right-rail',
    '[slot="right-sidebar"]',
    'shreddit-async-loader[bundlename="sidebar"]'
  ];

  function isExcluded(el) {
    return EXCLUDE_SELECTORS.some(sel => el.closest(sel));
  }

  // Mark elements we've clicked using data attribute (survives scroll position changes)
  function markAsClicked(el) {
    el.setAttribute('data-reddit-expander-clicked', 'true');
  }

  function wasClicked(el) {
    return el.hasAttribute('data-reddit-expander-clicked');
  }

  function expandOnce() {
    let count = 0;

    // 1. Collapsed shreddit-comments (new Reddit)
    document.querySelectorAll('shreddit-comment[collapsed]').forEach(comment => {
      const btn = comment.querySelector('button');
      if (btn && !isExcluded(btn) && !wasClicked(btn)) {
        markAsClicked(btn);
        btn.click();
        count++;
      }
    });

    // 2. "More replies" / "More comments" buttons
    document.querySelectorAll('button').forEach(btn => {
      if (isExcluded(btn) || btn.offsetParent === null || wasClicked(btn)) return;

      const text = (btn.textContent || '').toLowerCase().trim();
      if (
        /^\d+\s*more\s*repl/i.test(text) ||
        /^more\s*comments?$/i.test(text) ||
        text === 'more replies' ||
        /^view\s*more/i.test(text)
      ) {
        markAsClicked(btn);
        btn.click();
        count++;
      }
    });

    // 3. Old Reddit
    document.querySelectorAll('.morecomments a, .morechildren a').forEach(link => {
      if (isExcluded(link) || link.offsetParent === null || wasClicked(link)) return;
      markAsClicked(link);
      link.click();
      count++;
    });

    // 4. Old Reddit collapsed threads
    document.querySelectorAll('.thing.collapsed > .entry .expand').forEach(btn => {
      if (!wasClicked(btn)) {
        markAsClicked(btn);
        btn.click();
        count++;
      }
    });

    return count;
  }

  // Use MutationObserver to wait for new content instead of dumb polling
  function waitForNewContent(timeout = 2000) {
    return new Promise(resolve => {
      let resolved = false;

      const observer = new MutationObserver((mutations) => {
        // Check if any comment-related nodes were added
        const hasNewComments = mutations.some(m =>
          m.addedNodes.length > 0 &&
          Array.from(m.addedNodes).some(n =>
            n.nodeType === 1 && (
              n.tagName === 'SHREDDIT-COMMENT' ||
              n.querySelector?.('shreddit-comment') ||
              n.classList?.contains('comment') ||
              n.querySelector?.('.comment')
            )
          )
        );

        if (hasNewComments && !resolved) {
          resolved = true;
          observer.disconnect();
          resolve(true);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          observer.disconnect();
          resolve(false);
        }
      }, timeout);
    });
  }

  // Scroll to load all lazy-loaded comments
  async function scrollToLoadAll(signal, onProgress) {
    return new Promise((resolve) => {
      let lastHeight = 0;
      let sameHeightCount = 0;
      let scrollCount = 0;

      const interval = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(interval);
          resolve();
          return;
        }

        window.scrollTo(0, document.body.scrollHeight);
        scrollCount++;
        onProgress?.(`Scrolling to load comments... (${scrollCount})`);

        if (document.body.scrollHeight === lastHeight) {
          sameHeightCount++;
          // Wait longer - 5 checks to account for slow loading
          if (sameHeightCount >= 5) {
            clearInterval(interval);
            window.scrollTo(0, 0);
            resolve();
          }
        } else {
          sameHeightCount = 0;
          lastHeight = document.body.scrollHeight;
        }
      }, CONFIG.scrollInterval);

      // Safety timeout
      setTimeout(() => {
        clearInterval(interval);
        window.scrollTo(0, 0);
        resolve();
      }, CONFIG.scrollTimeout);
    });
  }

  // Main expansion function
  async function runExpansion(signal, onProgress) {
    // Phase 1: Scroll to load all comments
    onProgress?.('Scrolling to load all comments...');
    await scrollToLoadAll(signal, onProgress);

    if (signal?.aborted) return { expanded: 0, aborted: true };

    await new Promise(r => setTimeout(r, 500));

    // Phase 2: Expand everything
    let totalExpanded = 0;
    let passes = 0;
    let noProgressCount = 0;

    while (passes < CONFIG.maxPasses) {
      if (signal?.aborted) return { expanded: totalExpanded, aborted: true };

      const count = expandOnce();
      totalExpanded += count;
      passes++;

      onProgress?.(`Expanding... (${totalExpanded} expanded)`);

      if (count === 0) {
        noProgressCount++;
        if (noProgressCount >= CONFIG.noProgressLimit) break;
      } else {
        noProgressCount = 0;
        // Wait for new content to load after clicking
        await waitForNewContent(1500);
      }

      await new Promise(r => setTimeout(r, CONFIG.expandDelay));
    }

    return { expanded: totalExpanded, aborted: false };
  }

  // Public API for popup to call
  window._redditExpander = {
    start: async (onProgress) => {
      if (isRunning) return { error: 'Already running' };

      isRunning = true;
      abortController = new AbortController();

      try {
        const result = await runExpansion(abortController.signal, onProgress);
        return result;
      } finally {
        isRunning = false;
        abortController = null;
      }
    },

    stop: () => {
      if (abortController) {
        abortController.abort();
        return { stopped: true };
      }
      return { stopped: false };
    },

    isRunning: () => isRunning,

    // Quick expand (for keyboard shortcut) - no scroll, just expand visible
    quickExpand: () => {
      const count = expandOnce();
      return { expanded: count };
    }
  };

  // Keyboard shortcut: Cmd+Shift+E (Mac) or Ctrl+Shift+E (Windows/Linux)
  document.addEventListener('keydown', async (e) => {
    // Use e.code for reliable key detection regardless of layout
    const isE = e.code === 'KeyE';
    const hasModifier = e.metaKey || e.ctrlKey;

    if (hasModifier && e.shiftKey && isE) {
      e.preventDefault();
      e.stopPropagation();

      if (isRunning) {
        console.log('Reddit Expander: Stopping...');
        window._redditExpander.stop();
      } else {
        console.log('Reddit Expander: Starting full expansion...');
        const result = await window._redditExpander.start((msg) => {
          console.log('Reddit Expander:', msg);
        });
        console.log('Reddit Expander: Done!', result);
      }
    }
  }, true); // Use capture phase to catch it before Reddit does

  console.log('Reddit Auto-Expand: Ready (Cmd/Ctrl+Shift+E to expand)');
})();
