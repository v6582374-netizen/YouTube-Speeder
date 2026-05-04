# Speeder

Speeder is a small Chrome extension for YouTube. Hold `ArrowRight` for 250ms to
temporarily play the current video at your selected speed; release the key to
restore your previous playback speed. A short `ArrowRight` tap still skips
forward 5 seconds.

Click the extension icon to choose a hold speed of `1.5x`, `2x`, or `3x`. The
popup also includes an automatic highest-quality toggle. When enabled, Speeder
uses the current display configuration to keep YouTube on the highest available
quality that fits the screen, without considering network conditions.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `Speeder` folder.

## Behavior

- Runs only on `https://www.youtube.com/*`.
- Ignores editable fields such as the YouTube search box.
- Cleans up on blur, tab hide, and YouTube single-page navigation.
- Stores speed and quality preferences with `chrome.storage.sync`.
- Uses Chrome's display information permission to choose a screen-matched
  maximum quality.

## Icon

The icon uses the Lucide `fast-forward` mark style under the ISC license:
https://lucide.dev/icons/fast-forward and https://lucide.dev/license
