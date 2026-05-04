(() => {
  "use strict";

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

  function getPlayer() {
    return document.getElementById("movie_player") || document.querySelector(".html5-video-player");
  }

  function getAvailableLevels(player) {
    if (typeof player?.getAvailableQualityLevels !== "function") {
      return [];
    }

    try {
      return player
        .getAvailableQualityLevels()
        .filter((quality) => QUALITIES.includes(quality));
    } catch {
      return [];
    }
  }

  function rank(quality) {
    return QUALITIES.indexOf(quality);
  }

  function chooseQuality(available, cap) {
    const cappedRank = rank(cap);
    const levels = available.filter((quality) => quality !== "auto");
    const allowed = levels.filter((quality) => rank(quality) <= cappedRank);

    if (allowed.length) {
      return allowed.sort((left, right) => rank(right) - rank(left))[0];
    }

    return levels.sort((left, right) => rank(left) - rank(right))[0] || cap;
  }

  function applyQuality(player, quality) {
    let attempted = false;

    if (typeof player.setPlaybackQualityRange === "function") {
      attempted = true;
      player.setPlaybackQualityRange(quality, quality);
    }

    if (typeof player.setPlaybackQuality === "function") {
      attempted = true;
      player.setPlaybackQuality(quality);
    }

    return attempted;
  }

  window.addEventListener("speeder:apply-quality", (event) => {
    const requestId = event.detail?.requestId;
    const maxQuality = event.detail?.maxQuality;
    const player = getPlayer();
    const available = getAvailableLevels(player);
    const selected = chooseQuality(available, maxQuality);
    let ok = false;
    let error = "";

    try {
      ok = Boolean(player && selected && applyQuality(player, selected));
    } catch (exception) {
      error = exception instanceof Error ? exception.message : String(exception);
    }

    window.dispatchEvent(
      new CustomEvent("speeder:quality-result", {
        detail: {
          requestId,
          ok,
          selected,
          available,
          error
        }
      })
    );
  });
})();
