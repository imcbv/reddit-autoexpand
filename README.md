# Reddit Auto-Expand Comments

A Chrome extension that expands all Reddit comments with one click - including downvoted, collapsed, and hidden comments.

## Setup & Testing Locally

### Step 1: Generate Icons

1. Open `generate-icons.html` in Chrome (double-click the file or drag it into Chrome)
2. Click each "Download" button to save the 3 icon sizes
3. Move the downloaded icons to the `icons/` folder:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

### Step 2: Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `reddit-autoexpand` folder (this folder)
5. The extension should appear with the orange icon

### Step 3: Test It

1. Go to any Reddit post with comments: https://www.reddit.com/r/AskReddit/
2. Click the extension icon in your toolbar (orange arrows icon)
3. Click **"Expand All Comments"** to expand everything at once
4. Or click **"Keep Expanding (Auto)"** for continuous expansion as you scroll

### Keyboard Shortcut

Press `Ctrl+Shift+E` (or `Cmd+Shift+E` on Mac) on any Reddit page to expand comments without opening the popup.

---

## Publishing to Chrome Web Store

### Step 1: Create Developer Account

1. Go to: https://chrome.google.com/webstore/devconsole/
2. Sign in with your Google account
3. Pay the one-time $5 developer registration fee
4. Complete account verification

### Step 2: Prepare for Submission

1. Create a ZIP file of the extension:
   ```bash
   cd "/Users/imcbv/Documents/Code/Digital Kitchen"
   zip -r reddit-autoexpand.zip reddit-autoexpand -x "*.DS_Store" -x "generate-icons.html" -x "README.md"
   ```

2. Prepare promotional images:
   - **Icon**: 128x128 PNG (you already have this)
   - **Screenshot**: At least one 1280x800 or 640x400 screenshot of the extension in action
   - **Promo tile** (optional): 440x280 PNG

### Step 3: Submit Extension

1. Go to Chrome Web Store Developer Dashboard
2. Click **New Item**
3. Upload your ZIP file
4. Fill in:
   - **Name**: Reddit Auto-Expand Comments
   - **Description**: Expand all Reddit comments with one click. No more clicking individual collapsed comments, downvoted replies, or "load more" buttons. Perfect for reading entire threads or copying discussions for LLM analysis.
   - **Category**: Productivity
   - **Language**: English
5. Upload screenshots
6. Click **Submit for review**

Review typically takes 1-3 business days.

---

## How It Works

The extension finds and clicks:
- Collapsed comment fold buttons
- "X more replies" buttons
- "Continue this thread" elements
- Hidden/downvoted comment toggles
- Old Reddit "load more comments" links

## Files

- `manifest.json` - Extension configuration
- `popup.html` - The popup UI
- `popup.js` - Popup button logic
- `content.js` - Script that runs on Reddit pages
- `icons/` - Extension icons (16, 48, 128px)
