const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("velance", {
  getApiBaseUrl: () => {
    const search = new URLSearchParams(window.location.search);
    const apiPort = search.get("apiPort") || "47832";
    return `http://127.0.0.1:${apiPort}/api`;
  }
});
