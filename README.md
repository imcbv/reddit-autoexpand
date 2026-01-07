# Reddit Auto-Expand Comments

A Chrome extension that expands all Reddit comments with one click - including downvoted, collapsed, and hidden comments.

## Features

- Expand all collapsed comments with one click
- Auto-scrolls to load lazy-loaded comments
- Keyboard shortcut: `Cmd+Shift+E` (Mac) / `Ctrl+Shift+E` (Windows/Linux)
- Works on both new and old Reddit
- Press shortcut again to stop

## Installation

Install from the [Chrome Web Store](https://chrome.google.com/webstore) (coming soon)

Or load locally for development:

1. Clone this repo
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select this folder

## Usage

1. Go to any Reddit post with comments
2. Click the extension icon and press **"Expand All Comments"**
3. Or use the keyboard shortcut: `Cmd+Shift+E` / `Ctrl+Shift+E`

## How It Works

The extension finds and clicks:
- Collapsed comment fold buttons
- "X more replies" buttons
- "Continue this thread" elements
- Hidden/downvoted comment toggles
- Old Reddit "load more comments" links

## Contributing

PRs welcome. The main logic is in `content.js`.

## Privacy

This extension collects no data. See [Privacy Policy](https://imcbv.github.io/reddit-autoexpand/privacy-policy.html).

## License

MIT
