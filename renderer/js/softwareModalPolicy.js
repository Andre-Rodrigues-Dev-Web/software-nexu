(function exposeSoftwareModalPolicy(globalScope) {
  function shouldOpenSoftwareModal(options = {}) {
    const trigger = options.trigger || "manual";
    const selectedCount = Number(options.selectedCount || 0);
    const pendingCount = Number(options.pendingCount || 0);
    const preferenceEnabled = Boolean(options.preferenceEnabled);
    const alreadyShown = Boolean(options.alreadyShown);
    const updating = Boolean(options.updating);
    if (updating) {
      return false;
    }
    if (trigger === "manual") {
      return selectedCount > 0;
    }
    if (trigger === "auto") {
      return preferenceEnabled && pendingCount > 0 && !alreadyShown;
    }
    return false;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { shouldOpenSoftwareModal };
  }
  globalScope.softwareModalPolicy = { shouldOpenSoftwareModal };
})(typeof window !== "undefined" ? window : globalThis);
