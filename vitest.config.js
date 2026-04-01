const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.js"],
    coverage: {
      reporter: ["text", "html"],
      include: ["services/**/*.js", "server/**/*.js", "database/repositories/**/*.js"]
    }
  }
});
