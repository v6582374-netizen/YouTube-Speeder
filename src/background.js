(() => {
  "use strict";

  function getWindowCenter(frame) {
    const left = Number.isFinite(frame?.screenX) ? frame.screenX : 0;
    const top = Number.isFinite(frame?.screenY) ? frame.screenY : 0;
    const width = Number.isFinite(frame?.outerWidth) ? frame.outerWidth : 0;
    const height = Number.isFinite(frame?.outerHeight) ? frame.outerHeight : 0;

    return {
      x: left + width / 2,
      y: top + height / 2
    };
  }

  function containsPoint(bounds, point) {
    if (!bounds) {
      return false;
    }

    return (
      point.x >= bounds.left &&
      point.x < bounds.left + bounds.width &&
      point.y >= bounds.top &&
      point.y < bounds.top + bounds.height
    );
  }

  function normalizeDisplay(display) {
    const bounds = display.bounds || display.workArea || {};
    const scaleFactor = Number.isFinite(display.scaleFactor) ? display.scaleFactor : 1;
    const width = Math.round((bounds.width || 0) * scaleFactor);
    const height = Math.round((bounds.height || 0) * scaleFactor);

    return {
      id: display.id,
      isPrimary: Boolean(display.isPrimary),
      width,
      height,
      scaleFactor
    };
  }

  function chooseDisplay(displays, frame) {
    const center = getWindowCenter(frame);
    const containing = displays.find((display) => containsPoint(display.bounds, center));
    return containing || displays.find((display) => display.isPrimary) || displays[0] || null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "speeder:get-display-info") {
      return false;
    }

    if (!chrome.system?.display?.getInfo) {
      sendResponse({ ok: false, error: "system.display unavailable" });
      return false;
    }

    chrome.system.display.getInfo((displays) => {
      const error = chrome.runtime.lastError;
      if (error) {
        sendResponse({ ok: false, error: error.message });
        return;
      }

      const display = chooseDisplay(displays, message.frame);
      sendResponse({
        ok: Boolean(display),
        display: display ? normalizeDisplay(display) : null
      });
    });

    return true;
  });
})();
