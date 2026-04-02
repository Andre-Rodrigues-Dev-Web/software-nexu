vi.mock("../../services/windowsCommandService", () => ({
  executePowerShell: vi.fn(async (command) => {
    if (command.includes("Test-Connection")) {
      return { ok: true, output: "true" };
    }
    if (command.includes("Checkpoint-Computer")) {
      return { ok: true, output: "" };
    }
    return { ok: true, output: "" };
  })
}));

const { inferDriverCategory, normalizeDriverRecord, updateSingleDriver } = require("../../services/driverService");

describe("driverService", () => {
  it("classifies driver categories", () => {
    expect(inferDriverCategory("NVIDIA Display Adapter")).toBe("video");
    expect(inferDriverCategory("Realtek Audio")).toBe("audio");
    expect(inferDriverCategory("Wireless Network Adapter")).toBe("network");
    expect(inferDriverCategory("Generic Input Device")).toBe("other");
  });

  it("normalizes driver fields with compatibility and versions", () => {
    const row = normalizeDriverRecord({
      DeviceName: "GPU Device",
      DriverProviderName: "Vendor",
      DriverVersion: "1.0.0",
      DriverDate: "2022-01-01"
    });
    expect(row.id).toContain("gpu-device");
    expect(row.currentVersion).toBe("1.0.0");
    expect(row.latestKnownVersion).toBe("1.0.1");
    expect(row.compatible).toBe(true);
  });

  it("updates one compatible driver with restore point option", async () => {
    const result = await updateSingleDriver({
      id: "driver-a",
      deviceName: "Video Driver",
      provider: "Vendor",
      outdated: true,
      compatible: true
    }, { createRestorePoint: true });
    expect(result.status).toBe("updated");
  });
});
