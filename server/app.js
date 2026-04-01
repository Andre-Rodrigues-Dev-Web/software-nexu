const express = require("express");
const cors = require("cors");
const { attachRoutes } = require("./routes");

async function createServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: "file://", methods: ["GET", "POST"] }));
  app.use(express.json({ limit: "200kb" }));

  attachRoutes(app);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
    server.on("error", reject);
  });
}

module.exports = {
  createServer
};
