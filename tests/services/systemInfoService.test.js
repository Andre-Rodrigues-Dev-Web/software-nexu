const { toPercent, formatBytes } = require("../../services/systemInfoService");

describe("systemInfoService", () => {
  it("normalizes percentage bounds", () => {
    expect(toPercent(101.8)).toBe(100);
    expect(toPercent(-8)).toBe(0);
    expect(toPercent(55.55)).toBe(55.5);
  });

  it("formats byte values", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024 * 1024 * 4)).toBe("4.0 MB");
  });
});
