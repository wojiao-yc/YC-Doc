const { contextBridge, ipcRenderer, clipboard } = require("electron");

contextBridge.exposeInMainWorld("desktopPty", {
  isDesktop: true,
  platform: process.platform,
  createSession: (options = {}) => ipcRenderer.invoke("desktop:pty:create", options),
  write: (sessionId, data) => ipcRenderer.invoke("desktop:pty:write", { sessionId, data }),
  resize: (sessionId, cols, rows) => ipcRenderer.invoke("desktop:pty:resize", { sessionId, cols, rows }),
  kill: (sessionId) => ipcRenderer.invoke("desktop:pty:kill", { sessionId }),
  list: () => ipcRenderer.invoke("desktop:pty:list"),
  clipboardReadText: () => clipboard.readText(),
  clipboardWriteText: (text) => clipboard.writeText(String(text ?? "")),
  onData: (handler) => {
    if (typeof handler !== "function") {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("desktop:pty:data", listener);
    return () => {
      ipcRenderer.removeListener("desktop:pty:data", listener);
    };
  },
  onExit: (handler) => {
    if (typeof handler !== "function") {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("desktop:pty:exit", listener);
    return () => {
      ipcRenderer.removeListener("desktop:pty:exit", listener);
    };
  }
});

contextBridge.exposeInMainWorld("desktopWindow", {
  setFullscreen: (enabled) => ipcRenderer.invoke("desktop:window:set-fullscreen", { enabled: Boolean(enabled) }),
  isFullscreen: () => ipcRenderer.invoke("desktop:window:is-fullscreen"),
  getImageDir: () => ipcRenderer.invoke("desktop:assets:get-image-dir"),
  openImageDir: () => ipcRenderer.invoke("desktop:assets:open-image-dir"),
  pickImage: () => ipcRenderer.invoke("desktop:assets:pick-image")
});

contextBridge.exposeInMainWorld("desktopData", {
  getStepsPath: () => ipcRenderer.invoke("desktop:data:get-steps-path"),
  loadSteps: () => ipcRenderer.invoke("desktop:data:load-steps"),
  saveSteps: (payload = {}) => ipcRenderer.invoke("desktop:data:save-steps", payload)
});
