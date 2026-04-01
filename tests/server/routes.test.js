const express = require("express");
const request = require("supertest");
const { describe, it, expect } = require("vitest");
const { attachRoutes } = require("../../server/routes");

function makeApp() {
  const app = express();
  app.use(express.json());
  attachRoutes(app);
  return app;
}

describe("routes", () => {
  it("returns cleanup preview success", async () => {
    const response = await request(makeApp())
      .post("/api/cleanup/preview")
      .send({ selectedTargets: ["userTemp"] });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
  });

  it("returns validation error for invalid cleanup payload", async () => {
    const response = await request(makeApp())
      .post("/api/cleanup/preview")
      .send({ selectedTargets: "bad" });
    expect(response.status).toBe(400);
  });

  it("returns settings payload", async () => {
    const response = await request(makeApp()).get("/api/settings");
    expect(response.status).toBe(200);
    expect(typeof response.body).toBe("object");
  });
});
