vi.mock("../../database/db", () => ({
  getDb: () => ({
    prepare: () => ({
      run: vi.fn(),
      all: vi.fn(() => []),
      get: vi.fn(() => null)
    })
  })
}));

const fs = require("fs");

const {
  getMemoryConsumption,
  getBundleSizeAnalysis,
  buildOptimizationSuggestions,
  compareWithPrevious
} = require("../../services/performanceDiagnosticsService");

describe("performanceDiagnosticsService", () => {
  it("returns memory metrics", () => {
    const memory = getMemoryConsumption();
    expect(typeof memory.heapUsedMb).toBe("number");
    expect(typeof memory.rssMb).toBe("number");
  });

  it("returns bundle analysis structure", () => {
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const analysis = getBundleSizeAnalysis();
    expect(Array.isArray(analysis.items)).toBe(true);
    existsSpy.mockRestore();
  });

  it("builds suggestions based on thresholds", () => {
    const suggestions = buildOptimizationSuggestions({
      apiResponseTimes: [{ averageMs: 400 }],
      memory: { heapUsedMb: 300 },
      bundle: { totalKb: 700 }
    });
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("detects degradation compared to previous report", () => {
    const previous = { apiResponseTimes: [{ averageMs: 100 }], memory: { heapUsedMb: 100 }, bundle: { totalKb: 100 } };
    const current = { apiResponseTimes: [{ averageMs: 130 }], memory: { heapUsedMb: 130 }, bundle: { totalKb: 100 } };
    const comparison = compareWithPrevious(current, previous);
    expect(comparison.hasDegradation).toBe(true);
  });
});
