(() => {
  "use strict";

  const FAST_RATE = 3;
  const HOLD_DELAY_MS = 250;
  const SEEK_SECONDS = 5;
  const OVERLAY_ID = "speeder-long-press-overlay";

  let holdTimer = null;
  let arrowDown = false;
  let fastForwarding = false;
  let savedPlaybackRate = null;
  let activeVideo = null;

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
    video.playbackRate = FAST_RATE;
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

    rate.textContent = `${FAST_RATE}x`;
    label.textContent = "快进";

    for (let index = 0; index < 3; index += 1) {
      const chevron = document.createElement("span");
      motion.appendChild(chevron);
    }

    core.append(rate, label);
    overlay.append(core, motion);

    return overlay;
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

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", cleanupInteraction, true);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cleanupInteraction();
    }
  });
  document.addEventListener("yt-navigate-start", cleanupInteraction);
})();
