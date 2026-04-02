const { shouldOpenSoftwareModal } = require("../../renderer/js/softwareModalPolicy");

describe("software modal policy", () => {
  it("does not auto-open on initialization when preference is disabled", () => {
    expect(shouldOpenSoftwareModal({
      trigger: "auto",
      pendingCount: 5,
      preferenceEnabled: false,
      alreadyShown: false,
      updating: false
    })).toBe(false);
  });

  it("does not auto-open when no real pending update exists", () => {
    expect(shouldOpenSoftwareModal({
      trigger: "auto",
      pendingCount: 0,
      preferenceEnabled: true,
      alreadyShown: false,
      updating: false
    })).toBe(false);
  });

  it("opens on manual interaction only with explicit selection", () => {
    expect(shouldOpenSoftwareModal({
      trigger: "manual",
      selectedCount: 0,
      updating: false
    })).toBe(false);
    expect(shouldOpenSoftwareModal({
      trigger: "manual",
      selectedCount: 2,
      updating: false
    })).toBe(true);
  });

  it("does not auto-open repeatedly after first auto prompt", () => {
    expect(shouldOpenSoftwareModal({
      trigger: "auto",
      pendingCount: 3,
      preferenceEnabled: true,
      alreadyShown: true,
      updating: false
    })).toBe(false);
  });
});
