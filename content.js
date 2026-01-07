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

    // 1. Collapsed shreddit-comments (new Reddit) - MUST pierce shadow DOM
    document.querySelectorAll('shreddit-comment').forEach(comment => {
      // Check if collapsed via attribute
      const isCollapsed = comment.hasAttribute('collapsed');

      if (isCollapsed) {
        // The button is inside shadow DOM - need to access shadowRoot
        const shadow = comment.shadowRoot;
        if (shadow) {
          // Find the details/summary element and click it, or find the button
          const details = shadow.querySelector('details');
          const summary = shadow.querySelector('summary');
          const btn = shadow.querySelector('button');

          // Click the summary to expand (this is the standard way for details/summary)
          try {
            if (summary && !wasClicked(comment)) {
              markAsClicked(comment);
              summary.click();
              count++;
            } else if (btn && !wasClicked(comment)) {
              markAsClicked(comment);
              btn.click();
              count++;
            } else if (details && !details.hasAttribute('open') && !wasClicked(comment)) {
              markAsClicked(comment);
              details.setAttribute('open', '');
              count++;
            }
          } catch (e) {
            // Click failed, continue to next element
          }
        } else {
          // Fallback for non-shadow DOM (shouldn't happen but just in case)
          try {
            const btn = comment.querySelector('button');
            if (btn && !wasClicked(btn)) {
              markAsClicked(btn);
              btn.click();
              count++;
            }
          } catch (e) {
            // Click failed, continue
          }
        }
      }
    });

    // 2-3. REMOVED - these were clicking Share/Reply/Award buttons incorrectly

    // 2. "More replies" / "More comments" buttons
    document.querySelectorAll('button').forEach(btn => {
      if (isExcluded(btn) || btn.offsetParent === null || wasClicked(btn)) return;

      // Skip dropdown menus, share buttons, etc.
      if (btn.hasAttribute('aria-haspopup')) return;
      if (btn.closest('faceplate-dropdown-menu')) return;
      if (btn.closest('shreddit-comment-action-row')) return;
      if (btn.closest('shreddit-overflow-menu')) return;

      const text = (btn.textContent || '').toLowerCase().trim();
      if (
        /^\d+\s*more\s*repl/i.test(text) ||
        /^more\s*comments?$/i.test(text) ||
        text === 'more replies' ||
        /^view\s*more/i.test(text) ||
        /^see\s*more/i.test(text) ||
        /^load\s*more/i.test(text)
      ) {
        try {
          markAsClicked(btn);
          btn.click();
          count++;
        } catch (e) {
          // Click failed, continue
        }
      }
    });

    // 5. Faceplate loaders (Reddit's lazy-load components)
    document.querySelectorAll('faceplate-partial[loading="action:click"]').forEach(partial => {
      try {
        const btn = partial.querySelector('button');
        if (btn && !isExcluded(btn) && !wasClicked(btn)) {
          const text = (btn.textContent || '').toLowerCase();
          if (text.includes('more') || text.includes('repl') || text.includes('comment')) {
            markAsClicked(btn);
            btn.click();
            count++;
          }
        }
      } catch (e) {
        // Click failed, continue
      }
    });

    // 6. Old Reddit
    document.querySelectorAll('.morecomments a, .morechildren a').forEach(link => {
      try {
        if (isExcluded(link) || link.offsetParent === null || wasClicked(link)) return;
        markAsClicked(link);
        link.click();
        count++;
      } catch (e) {
        // Click failed, continue
      }
    });

    // 7. Old Reddit collapsed threads
    document.querySelectorAll('.thing.collapsed > .entry .expand').forEach(btn => {
      try {
        if (!wasClicked(btn)) {
          markAsClicked(btn);
          btn.click();
          count++;
        }
      } catch (e) {
        // Click failed, continue
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

  // Scroll down once and back
  async function scrollOnce(signal) {
    if (signal?.aborted) return false;

    const startHeight = document.body.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 400));

    // Check if page grew
    const grew = document.body.scrollHeight > startHeight;
    return grew;
  }

  // Main expansion function - interleaves scrolling and expanding
  async function runExpansion(signal, onProgress) {
    let totalExpanded = 0;
    let rounds = 0;
    let noProgressRounds = 0;
    const maxRounds = 100;

    while (rounds < maxRounds) {
      if (signal?.aborted) return { expanded: totalExpanded, aborted: true };

      rounds++;
      let madeProgress = false;

      // Step 1: Scroll to load more content
      onProgress?.(`Round ${rounds}: Scrolling...`);
      let scrollGrew = true;
      let scrollAttempts = 0;

      while (scrollGrew && scrollAttempts < 20) {
        if (signal?.aborted) return { expanded: totalExpanded, aborted: true };
        scrollGrew = await scrollOnce(signal);
        if (scrollGrew) madeProgress = true;
        scrollAttempts++;
      }

      // Scroll back to top
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 300));

      // Step 2: Expand all visible "more replies" buttons
      onProgress?.(`Round ${rounds}: Expanding... (${totalExpanded} so far)`);

      let expandedThisRound = 0;
      let expandPass = 0;
      let noExpandCount = 0;

      while (expandPass < 20 && noExpandCount < 3) {
        if (signal?.aborted) return { expanded: totalExpanded, aborted: true };

        const count = expandOnce();
        expandedThisRound += count;
        expandPass++;

        if (count > 0) {
          madeProgress = true;
          noExpandCount = 0;
          // Wait for content to load
          await waitForNewContent(1000);
        } else {
          noExpandCount++;
        }

        await new Promise(r => setTimeout(r, 200));
      }

      totalExpanded += expandedThisRound;
      onProgress?.(`Round ${rounds}: Expanded ${expandedThisRound} (${totalExpanded} total)`);

      // Check if we made any progress this round
      if (!madeProgress) {
        noProgressRounds++;
        if (noProgressRounds >= 2) {
          // Double-check by scrolling one more time
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(r => setTimeout(r, 500));
          const finalCount = expandOnce();
          if (finalCount === 0) break;
          totalExpanded += finalCount;
        }
      } else {
        noProgressRounds = 0;
      }

      await new Promise(r => setTimeout(r, 300));
    }

    // Final scroll to top
    window.scrollTo(0, 0);

    return { expanded: totalExpanded, aborted: false };
  }

  // On-page toast notification
  function showToast(message, duration = 3000) {
    // Remove existing toast
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

    return toast;
  }

  function updateToast(message) {
    const toast = document.getElementById('reddit-expander-toast');
    if (toast) {
      toast.textContent = message;
    } else {
      showToast(message, 0); // Don't auto-hide during updates
    }
  }

  function hideToast() {
    const toast = document.getElementById('reddit-expander-toast');
    if (toast) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }

  // Public API for popup and background script to call
  window._redditExpander = {
    // Toast methods exposed for background.js
    showToast,
    updateToast,
    hideToast,

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
  }, true); // Use capture phase to catch it before Reddit does

  console.log('Reddit Auto-Expand: Ready (Cmd/Ctrl+Shift+E to expand)');
})();
