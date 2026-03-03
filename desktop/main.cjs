const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const pty = require("node-pty");

let mainWindow = null;
const sessions = new Map();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const resolveCwd = (cwd) => {
  const target = String(cwd || "").trim();
  if (!target) {
    return process.cwd();
  }
  if (fs.existsSync(target)) {
    return target;
  }
  return process.cwd();
};

const resolveShell = (requested) => {
  const raw = String(requested || "").toLowerCase();

  if (process.platform === "win32") {
    if (raw === "cmd") {
      return { file: "cmd.exe", args: ["/Q"], resolved: "cmd.exe" };
    }
    if (raw === "bash") {
      return { file: "bash.exe", args: ["-i"], resolved: "bash.exe" };
    }
    if (raw === "pwsh") {
      return { file: "pwsh.exe", args: ["-NoLogo", "-NoExit"], resolved: "pwsh.exe" };
    }
    return { file: "powershell.exe", args: ["-NoLogo", "-NoExit"], resolved: "powershell.exe" };
  }

  if (raw === "bash" || raw === "sh") {
    return { file: "bash", args: ["-i"], resolved: "bash" };
  }
  if (raw === "pwsh" || raw === "powershell") {
    return { file: "pwsh", args: ["-NoLogo", "-NoExit"], resolved: "pwsh" };
  }
  return { file: process.env.SHELL || "bash", args: ["-i"], resolved: process.env.SHELL || "bash" };
};

const killAllSessions = () => {
  for (const [sessionId, item] of sessions) {
    try {
      item.pty.kill();
    } catch {
      // ignore
    }
    sessions.delete(sessionId);
  }
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    const built = path.join(__dirname, "..", "web", "dist", "index.html");
    await mainWindow.loadFile(built);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

ipcMain.handle("desktop:pty:create", async (_event, payload = {}) => {
  const shellTarget = resolveShell(payload.shell);
  const cols = clamp(Number(payload.cols || 120), 20, 400);
  const rows = clamp(Number(payload.rows || 30), 5, 200);
  const cwd = resolveCwd(payload.cwd);
  const env = {
    ...process.env,
    TERM: "xterm-256color"
  };

  const spawned = pty.spawn(shellTarget.file, shellTarget.args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env
  });

  const sessionId = randomUUID().replace(/-/g, "");
  sessions.set(sessionId, {
    sessionId,
    shell: shellTarget.resolved,
    cwd,
    pty: spawned
  });

  spawned.onData((data) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send("desktop:pty:data", { sessionId, data });
  });

  spawned.onExit((exit) => {
    sessions.delete(sessionId);
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send("desktop:pty:exit", {
      sessionId,
      exitCode: exit?.exitCode ?? 0,
      signal: exit?.signal ?? 0
    });
  });

  return {
    sessionId,
    shell: shellTarget.resolved,
    cwd,
    pid: spawned.pid
  };
});

ipcMain.handle("desktop:pty:write", async (_event, payload = {}) => {
  const sessionId = String(payload.sessionId || "");
  const data = String(payload.data || "");
  const item = sessions.get(sessionId);
  if (!item) {
    throw new Error("session_not_found");
  }
  if (data.length > 0) {
    item.pty.write(data);
  }
  return { ok: true };
});

ipcMain.handle("desktop:pty:resize", async (_event, payload = {}) => {
  const sessionId = String(payload.sessionId || "");
  const item = sessions.get(sessionId);
  if (!item) {
    throw new Error("session_not_found");
  }
  const cols = clamp(Number(payload.cols || 80), 20, 400);
  const rows = clamp(Number(payload.rows || 24), 5, 200);
  item.pty.resize(cols, rows);
  return { ok: true };
});

ipcMain.handle("desktop:pty:kill", async (_event, payload = {}) => {
  const sessionId = String(payload.sessionId || "");
  const item = sessions.get(sessionId);
  if (!item) {
    return { ok: true };
  }
  try {
    item.pty.kill();
  } catch {
    // ignore
  }
  sessions.delete(sessionId);
  return { ok: true };
});

ipcMain.handle("desktop:pty:list", async () => ({
  sessions: [...sessions.values()].map((item) => ({
    sessionId: item.sessionId,
    shell: item.shell,
    cwd: item.cwd,
    pid: item.pty.pid
  }))
}));

ipcMain.handle("desktop:window:set-fullscreen", async (_event, payload = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false };
  }
  const enabled = Boolean(payload.enabled);
  mainWindow.setFullScreen(enabled);
  mainWindow.setMenuBarVisibility(false);
  return { ok: true, fullscreen: mainWindow.isFullScreen() };
});

ipcMain.handle("desktop:window:is-fullscreen", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  return mainWindow.isFullScreen();
});

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killAllSessions();
});
