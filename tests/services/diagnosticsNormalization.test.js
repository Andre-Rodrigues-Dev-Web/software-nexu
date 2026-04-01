const { compareVersions } = require("../../services/softwareService");
const { normalizeDriverRecord } = require("../../services/driverService");

describe("diagnostics normalization", () => {
  it("compares versions accurately", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
    expect(compareVersions("2.1.0", "2.1.0")).toBe(0);
    expect(compareVersions("2.3.0", "2.2.9")).toBe(1);
  });

  it("normalizes driver data", () => {
    const item = normalizeDriverRecord({
      DeviceName: "GPU A",
      DriverProviderName: "Vendor",
      DriverVersion: "1.2.3",
      DriverDate: "2022-05-01"
    });
    expect(item.deviceName).toBe("GPU A");
    expect(item.provider).toBe("Vendor");
    expect(item.version).toBe("1.2.3");
  });

  it("handles invalid driver date safely", () => {
    const item = normalizeDriverRecord({
      DeviceName: "Device B",
      DriverProviderName: "Vendor",
      DriverVersion: "9.9.9",
      DriverDate: "invalid-date-value"
    });
    expect(item.date).toBe(null);
  });
});
