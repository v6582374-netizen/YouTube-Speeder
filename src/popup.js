(() => {
  "use strict";

  const DEFAULT_SETTINGS = {
    fastRate: 3,
    autoQuality: true
  };
  const RATE_OPTIONS = [1.5, 2, 3];

  const speedValue = document.getElementById("speed-value");
  const status = document.getElementById("status");
  const qualityToggle = document.getElementById("quality-toggle");
  const speedButtons = Array.from(document.querySelectorAll(".speed-option"));

  let settings = { ...DEFAULT_SETTINGS };
  let statusTimer = null;

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
      chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        resolve(sanitizeSettings(items));
      });
    });
  }

  function writeSettings(nextSettings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(nextSettings, resolve);
    });
  }

  function render() {
    speedValue.textContent = `${settings.fastRate}x`;

    speedButtons.forEach((button) => {
      const selected = Number(button.dataset.rate) === settings.fastRate;
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });

    qualityToggle.setAttribute("aria-checked", String(settings.autoQuality));
  }

  function showStatus(message) {
    status.textContent = message;

    if (statusTimer) {
      window.clearTimeout(statusTimer);
    }

    statusTimer = window.setTimeout(() => {
      status.textContent = "";
    }, 1200);
  }

  async function updateSettings(nextSettings) {
    settings = sanitizeSettings({ ...settings, ...nextSettings });
    render();
    await writeSettings(settings);
    showStatus("已保存");
  }

  speedButtons.forEach((button) => {
    button.addEventListener("click", () => {
      updateSettings({ fastRate: Number(button.dataset.rate) });
    });
  });

  qualityToggle.addEventListener("click", () => {
    updateSettings({ autoQuality: !settings.autoQuality });
  });

  readSettings().then((storedSettings) => {
    settings = storedSettings;
    render();
  });
})();
