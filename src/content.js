(() => {
  "use strict";

  const DEFAULT_SETTINGS = {
    fastRate: 3,
    autoQuality: true
  };
  const RATE_OPTIONS = [1.5, 2, 3];
  const HOLD_DELAY_MS = 250;
  const SEEK_SECONDS = 5;
  const OVERLAY_ID = "speeder-long-press-overlay";
  const PAGE_SCRIPT_ID = "speeder-page-quality-bridge";
  const QUALITY_APPLY_DELAY_MS = 700;
  const QUALITY_CHECK_INTERVAL_MS = 6000;
  const QUALITY_RESULT_TIMEOUT_MS = 1200;
  const QUALITIES = [
    "tiny",
    "small",
    "medium",
    "large",
    "hd720",
    "hd1080",
    "hd1440",
    "hd2160",
    "hd2880",
    "highres"
  ];

  let settings = { ...DEFAULT_SETTINGS };
  let holdTimer = null;
  let arrowDown = false;
  let fastForwarding = false;
  let savedPlaybackRate = null;
  let activeVideo = null;
  let qualityTimer = null;
  let qualityApplyTimer = null;
  let qualityApplyInFlight = false;
  let qualityRequestId = 0;
  let pageBridgeReady = false;
  let pageBridgePromise = null;

  const editableSelector = [
    "input",
    "textarea",
    "select",
    "[contenteditable='']",
    "[contenteditable='true']"
  ].join(",");

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return target.isContentEditable || Boolean(target.closest(editableSelector));
  }

  function shouldHandleArrowRight(event) {
    return (
      event.key === "ArrowRight" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !isEditableTarget(event.target) &&
      Boolean(getVideo())
    );
  }

  function getVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    return videos.find((video) => !video.paused || video.readyState > 0) || videos[0] || null;
  }

  function stopYouTubeShortcut(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onKeyDown(event) {
    if (!shouldHandleArrowRight(event)) {
      return;
    }

    stopYouTubeShortcut(event);

    if (arrowDown) {
      return;
    }

    arrowDown = true;
    activeVideo = getVideo();

    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      startFastForward();
    }, HOLD_DELAY_MS);
  }

  function onKeyUp(event) {
    if (event.key !== "ArrowRight" || !arrowDown) {
      return;
    }

    stopYouTubeShortcut(event);

    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
      seekForward();
    } else {
      stopFastForward();
    }

    arrowDown = false;
    activeVideo = null;
  }

  function startFastForward() {
    const video = activeVideo || getVideo();
    if (!video || fastForwarding) {
      return;
    }

    activeVideo = video;
    savedPlaybackRate = video.playbackRate || 1;
    video.playbackRate = settings.fastRate;
    fastForwarding = true;
    showOverlay();
  }

  function stopFastForward() {
    if (!fastForwarding) {
      hideOverlay();
      savedPlaybackRate = null;
      return;
    }

    const video = activeVideo || getVideo();
    if (video && savedPlaybackRate) {
      video.playbackRate = savedPlaybackRate;
    }

    fastForwarding = false;
    savedPlaybackRate = null;
    hideOverlay();
  }

  function seekForward() {
    const video = activeVideo || getVideo();
    if (!video) {
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    video.currentTime = Math.min(video.currentTime + SEEK_SECONDS, duration);
  }

  function cleanupInteraction() {
    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }

    stopFastForward();
    arrowDown = false;
    activeVideo = null;
  }

  function showOverlay() {
    const video = activeVideo || getVideo();
    const parent = getPlayerContainer(video);
    if (!parent) {
      return;
    }

    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = createOverlay();
    }

    updateOverlayRate(overlay);

    if (overlay.parentElement !== parent) {
      parent.appendChild(overlay);
    }

    overlay.classList.add("speeder-visible");
  }

  function createOverlay() {
    const overlay = document.createElement("div");
    const core = document.createElement("div");
    const rate = document.createElement("span");
    const label = document.createElement("span");
    const motion = document.createElement("div");

    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");

    core.className = "speeder-overlay-core";
    rate.className = "speeder-overlay-rate";
    label.className = "speeder-overlay-label";
    motion.className = "speeder-overlay-motion";

    label.textContent = "快进";

    for (let index = 0; index < 3; index += 1) {
      const chevron = document.createElement("span");
      motion.appendChild(chevron);
    }

    core.append(rate, label);
    overlay.append(core, motion);

    return overlay;
  }

  function updateOverlayRate(overlay = document.getElementById(OVERLAY_ID)) {
    const rate = overlay?.querySelector(".speeder-overlay-rate");
    if (rate) {
      rate.textContent = `${settings.fastRate}x`;
    }
  }

  function hideOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove("speeder-visible");
    }
  }

  function getPlayerContainer(video) {
    if (!video) {
      return null;
    }

    const player = video.closest(".html5-video-player, #movie_player");
    const parent = player || video.parentElement;
    if (parent instanceof HTMLElement) {
      parent.classList.add("speeder-overlay-host");
      return parent;
    }

    return null;
  }

  function sanitizeSettings(items) {
    const fastRate = Number(items.fastRate);

    return {
      fastRate: RATE_OPTIONS.includes(fastRate) ? fastRate : DEFAULT_SETTINGS.fastRate,
      autoQuality:
        typeof items.autoQuality === "boolean" ? items.autoQuality : DEFAULT_SETTINGS.autoQuality
    };
  }

  function readSettings() {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage?.sync) {
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }

      chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        resolve(sanitizeSettings(items));
      });
    });
  }

  function watchSettings() {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return;
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      const nextSettings = { ...settings };
      if (changes.fastRate) {
        const nextRate = Number(changes.fastRate.newValue);
        if (RATE_OPTIONS.includes(nextRate)) {
          nextSettings.fastRate = nextRate;
        }
      }

      if (changes.autoQuality && typeof changes.autoQuality.newValue === "boolean") {
        nextSettings.autoQuality = changes.autoQuality.newValue;
      }

      settings = nextSettings;
      updateOverlayRate();

      if (fastForwarding) {
        const video = activeVideo || getVideo();
        if (video) {
          video.playbackRate = settings.fastRate;
        }
      }

      if (settings.autoQuality) {
        startQualityWatcher();
      } else {
        stopQualityWatcher();
      }
    });
  }

  function injectPageBridge() {
    if (pageBridgeReady) {
      return Promise.resolve();
    }

    if (pageBridgePromise) {
      return pageBridgePromise;
    }

    pageBridgePromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.id = PAGE_SCRIPT_ID;
      script.src = chrome.runtime.getURL("src/page-quality.js");
      script.onload = () => {
        pageBridgeReady = true;
        script.remove();
        resolve();
      };
      script.onerror = () => {
        script.remove();
        pageBridgePromise = null;
        resolve();
      };
      (document.head || document.documentElement).appendChild(script);
    });

    return pageBridgePromise;
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        resolve(null);
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response);
      });
    });
  }

  async function getDisplayInfo() {
    const response = await sendRuntimeMessage({
      type: "speeder:get-display-info",
      frame: {
        screenX: window.screenX,
        screenY: window.screenY,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
      }
    });

    if (response?.ok && response.display) {
      return response.display;
    }

    return {
      width: Math.round(window.screen.width * window.devicePixelRatio),
      height: Math.round(window.screen.height * window.devicePixelRatio),
      scaleFactor: window.devicePixelRatio,
      fallback: true
    };
  }

  function maxQualityForDisplay(display) {
    const shortEdge = Math.min(display.width || 0, display.height || 0);

    if (shortEdge >= 4320) {
      return "highres";
    }
    if (shortEdge >= 2880) {
      return "hd2880";
    }
    if (shortEdge >= 2160) {
      return "hd2160";
    }
    if (shortEdge >= 1440) {
      return "hd1440";
    }
    if (shortEdge >= 1080) {
      return "hd1080";
    }
    if (shortEdge >= 720) {
      return "hd720";
    }
    if (shortEdge >= 480) {
      return "large";
    }
    if (shortEdge >= 360) {
      return "medium";
    }
    if (shortEdge >= 240) {
      return "small";
    }
    return "tiny";
  }

  function requestPageQuality(maxQuality) {
    const requestId = `${Date.now()}:${qualityRequestId += 1}`;

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener("speeder:quality-result", onResult);
        resolve({ ok: false, selected: maxQuality, error: "quality request timed out" });
      }, QUALITY_RESULT_TIMEOUT_MS);

      function onResult(event) {
        if (event.detail?.requestId !== requestId) {
          return;
        }

        window.clearTimeout(timeout);
        window.removeEventListener("speeder:quality-result", onResult);
        resolve(event.detail);
      }

      window.addEventListener("speeder:quality-result", onResult);
      window.dispatchEvent(
        new CustomEvent("speeder:apply-quality", {
          detail: {
            requestId,
            maxQuality
          }
        })
      );
    });
  }

  function scheduleQualityApply(delay = QUALITY_APPLY_DELAY_MS) {
    if (!settings.autoQuality) {
      return;
    }

    if (qualityApplyTimer) {
      window.clearTimeout(qualityApplyTimer);
    }

    qualityApplyTimer = window.setTimeout(() => {
      qualityApplyTimer = null;
      applyBestQuality();
    }, delay);
  }

  async function applyBestQuality() {
    if (!settings.autoQuality || qualityApplyInFlight || !getVideo()) {
      return;
    }

    qualityApplyInFlight = true;

    try {
      await injectPageBridge();
      const display = await getDisplayInfo();
      const maxQuality = maxQualityForDisplay(display);
      const result = await requestPageQuality(maxQuality);

      if (!result.ok) {
        await selectQualityFromMenu(result.selected || maxQuality);
      }
    } finally {
      qualityApplyInFlight = false;
    }
  }

  function startQualityWatcher() {
    if (qualityTimer) {
      window.clearInterval(qualityTimer);
    }

    scheduleQualityApply();
    qualityTimer = window.setInterval(() => {
      scheduleQualityApply(0);
    }, QUALITY_CHECK_INTERVAL_MS);
  }

  function stopQualityWatcher() {
    if (qualityTimer) {
      window.clearInterval(qualityTimer);
      qualityTimer = null;
    }

    if (qualityApplyTimer) {
      window.clearTimeout(qualityApplyTimer);
      qualityApplyTimer = null;
    }
  }

  function rankQuality(quality) {
    return QUALITIES.indexOf(quality);
  }

  function getQualityPattern(quality) {
    const patterns = {
      highres: /4320|2160|1440|8K|4K/i,
      hd2880: /2880|5K/i,
      hd2160: /2160|4K/i,
      hd1440: /1440/i,
      hd1080: /1080/i,
      hd720: /720/i,
      large: /480/i,
      medium: /360/i,
      small: /240/i,
      tiny: /144/i
    };

    return patterns[quality] || patterns.hd1080;
  }

  function getQualityMenuItems() {
    return Array.from(document.querySelectorAll(".ytp-panel-menu .ytp-menuitem"));
  }

  async function selectQualityFromMenu(targetQuality) {
    const settingsButton = document.querySelector(".ytp-settings-button");
    if (!(settingsButton instanceof HTMLElement)) {
      return false;
    }

    const wasOpen = settingsButton.getAttribute("aria-expanded") === "true";
    if (!wasOpen) {
      settingsButton.click();
      await delay(140);
    }

    const qualityItem = getQualityMenuItems().find((item) =>
      /Quality|画质|畫質|品質|화질|Qualität|Calidad|Qualité|Qualità|Качество/i.test(
        item.textContent || ""
      )
    );

    if (!(qualityItem instanceof HTMLElement)) {
      closePlayerMenu();
      return false;
    }

    qualityItem.click();
    await delay(160);

    const pattern = getQualityPattern(targetQuality);
    const items = getQualityMenuItems();
    const nonAutoItems = items.filter((item) => !/Auto|自动|自動|자동/i.test(item.textContent || ""));
    const matchingItem = nonAutoItems.find((item) => pattern.test(item.textContent || ""));
    const targetRank = rankQuality(targetQuality);
    const fallbackItem = [...nonAutoItems]
      .filter((item) => qualityRankFromText(item.textContent) <= targetRank)
      .sort(
        (left, right) =>
          qualityRankFromText(right.textContent) - qualityRankFromText(left.textContent)
      )[0];
    const itemToClick = matchingItem || fallbackItem;

    if (itemToClick instanceof HTMLElement) {
      itemToClick.click();
      await delay(120);
      closePlayerMenu();
      return true;
    }

    closePlayerMenu();
    return false;
  }

  function qualityRankFromText(text = "") {
    if (/4320|8K/i.test(text)) {
      return rankQuality("highres");
    }
    if (/2880|5K/i.test(text)) {
      return rankQuality("hd2880");
    }
    if (/2160|4K/i.test(text)) {
      return rankQuality("hd2160");
    }
    if (/1440/i.test(text)) {
      return rankQuality("hd1440");
    }
    if (/1080/i.test(text)) {
      return rankQuality("hd1080");
    }
    if (/720/i.test(text)) {
      return rankQuality("hd720");
    }
    if (/480/i.test(text)) {
      return rankQuality("large");
    }
    if (/360/i.test(text)) {
      return rankQuality("medium");
    }
    if (/240/i.test(text)) {
      return rankQuality("small");
    }
    if (/144/i.test(text)) {
      return rankQuality("tiny");
    }

    return -1;
  }

  function closePlayerMenu() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true
      })
    );
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function init() {
    settings = await readSettings();
    watchSettings();

    if (settings.autoQuality) {
      startQualityWatcher();
    }
  }

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", cleanupInteraction, true);
  window.addEventListener("resize", () => scheduleQualityApply(), true);
  document.addEventListener("loadedmetadata", () => scheduleQualityApply(), true);
  document.addEventListener("canplay", () => scheduleQualityApply(), true);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cleanupInteraction();
    } else {
      scheduleQualityApply();
    }
  });
  document.addEventListener("yt-navigate-start", cleanupInteraction);
  document.addEventListener("yt-navigate-finish", () => scheduleQualityApply());

  init();
})();
