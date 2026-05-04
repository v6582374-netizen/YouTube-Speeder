# Speeder

Speeder is a small Chrome extension for YouTube. Hold `ArrowRight` for 250ms to
temporarily play the current video at `3x`; release the key to restore your
previous playback speed. A short `ArrowRight` tap still skips forward 5 seconds.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `Speeder` folder.

## Behavior

- Runs only on `https://www.youtube.com/*`.
- Ignores editable fields such as the YouTube search box.
- Cleans up on blur, tab hide, and YouTube single-page navigation.
