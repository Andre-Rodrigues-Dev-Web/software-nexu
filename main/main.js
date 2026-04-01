const path = require("path");
const { app, BrowserWindow } = require("electron");
const { createServer } = require("../server/app");
const { initializeDatabase } = require("../database/db");

let mainWindow;
let serverHandle;

async function createMainWindow() {
  await initializeDatabase();
  const { server, port } = await createServer();
  serverHandle = server;

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: "Velance System Care",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"), {
    query: { apiPort: String(port) }
  });
}

function handleFatalError(error) {
  console.error("Velance startup error:", error);
  if (serverHandle) {
    serverHandle.close();
  }
  app.quit();
}

process.on("unhandledRejection", handleFatalError);
process.on("uncaughtException", handleFatalError);

app.whenReady().then(createMainWindow).catch(handleFatalError);

app.on("window-all-closed", () => {
  if (serverHandle) {
    serverHandle.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch(handleFatalError);
  }
});
