const { app, BrowserWindow, dialog, ipcMain, protocol, screen, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const pty = require("node-pty");

let mainWindow = null;
const sessions = new Map();
const MAX_WORKSPACE_MARKDOWN_BYTES = 20 * 1024 * 1024;

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

const ensureDesktopImageDir = () => {
  const dir = path.join(app.getPath("userData"), "images");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const ensureDesktopDataDir = () => {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const getStepsDataPath = () => path.join(ensureDesktopDataDir(), "steps.json");
const getWorkspaceConfigPath = () => path.join(ensureDesktopDataDir(), "workspace-root.json");

const readWorkspaceRootConfig = () => {
  const filePath = getWorkspaceConfigPath();
  if (!fs.existsSync(filePath)) {
    return "";
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const target = String(parsed?.rootPath || "").trim();
    return target;
  } catch {
    return "";
  }
};

const writeWorkspaceRootConfig = (rootPath) => {
  const filePath = getWorkspaceConfigPath();
  const record = {
    rootPath: String(rootPath || "").trim(),
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
};

const normalizeAbsolutePath = (rawPath = "") => {
  const target = String(rawPath || "").trim();
  if (!target) {
    throw new Error("invalid_path");
  }
  return path.resolve(target);
};

const setWorkspaceRootDir = (rawPath) => {
  const absPath = normalizeAbsolutePath(rawPath);
  fs.mkdirSync(absPath, { recursive: true });
  if (!fs.statSync(absPath).isDirectory()) {
    throw new Error("workspace_root_not_directory");
  }
  writeWorkspaceRootConfig(absPath);
  return absPath;
};

const ensureWorkspaceDir = () => {
  const fallback = path.join(app.getPath("documents"), "YC-Doc-Workspace");
  const stored = readWorkspaceRootConfig();
  const candidates = stored ? [stored, fallback] : [fallback];

  for (const candidate of candidates) {
    try {
      const absPath = path.resolve(candidate);
      fs.mkdirSync(absPath, { recursive: true });
      if (!fs.statSync(absPath).isDirectory()) {
        throw new Error("workspace_root_not_directory");
      }
      if (stored !== absPath) {
        writeWorkspaceRootConfig(absPath);
      }
      return absPath;
    } catch {
      // try next candidate
    }
  }

  const safeFallback = path.resolve(fallback);
  fs.mkdirSync(safeFallback, { recursive: true });
  writeWorkspaceRootConfig(safeFallback);
  return safeFallback;
};

const sanitizeWorkspaceName = (input, fallback) => {
  const cleaned = String(input || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ");
  const safe = cleaned.replace(/^\.+$/, "_");
  return safe || fallback;
};

const normalizeWorkspaceRelPath = (rawRelPath = "") => {
  const asPosix = String(rawRelPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const normalized = path.posix.normalize(asPosix || ".");
  if (normalized.startsWith("..")) {
    throw new Error("invalid_relative_path");
  }
  return normalized === "." ? "" : normalized;
};

const resolveWorkspacePath = (rootDir, rawRelPath = "") => {
  const relPath = normalizeWorkspaceRelPath(rawRelPath);
  const absRoot = path.resolve(rootDir);
  const absTarget = path.resolve(absRoot, relPath.split("/").join(path.sep));
  const relative = path.relative(absRoot, absTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("workspace_path_escape");
  }
  return { absRoot, absTarget, relPath };
};

const toWorkspaceRel = (absRoot, absPath) => {
  const rel = path.relative(absRoot, absPath);
  if (!rel || rel === ".") {
    return "";
  }
  return rel.split(path.sep).join("/");
};

/* legacy block kept for compatibility notes:
const pickUniqueName = (targetDir, requestedName, asFolder) => {
  const original = String(requestedName || "").trim();
  const ext = asFolder ? "" : path.extname(original);
  const base = asFolder
    ? original
    : path.basename(original, ext) || "未命名";
  let index = 0;
  while (index < 10000) {
    const suffix = index === 0 ? "" : ` (${index})`;
    const candidate = asFolder ? `${base}${suffix}` : `${base}${suffix}${ext}`;
    if (!fs.existsSync(path.join(targetDir, candidate))) {
      return candidate;
    }
    index += 1;
  }
  throw new Error("name_conflict_too_many");
};

const readWorkspaceTreeNode = (absPath, relPath = "") => {
  const name = relPath ? path.basename(absPath) : "存储根目录";
  const stat = fs.statSync(absPath);

  if (!stat.isDirectory()) {
    return {
      type: "file",
      name,
      relPath,
      absPath,
      size: stat.size,
      children: []
    };
  }

  const children = [];
  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  for (const entry of entries) {
    const childAbs = path.join(absPath, entry.name);
    const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      children.push(readWorkspaceTreeNode(childAbs, childRel));
      continue;
    }
    if (entry.isFile()) {
      children.push({
        type: "file",
        name: entry.name,
        relPath: childRel,
        absPath: childAbs,
        size: fs.statSync(childAbs).size,
        children: []
      });
    }
  }
  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "zh-CN");
  });

  return {
    type: "folder",
    name,
    relPath,
    absPath,
    size: 0,
    children
  };
};

*/

const pickUniqueName = (targetDir, requestedName, asFolder) => {
  const original = String(requestedName || "").trim();
  const ext = asFolder ? "" : path.extname(original);
  const base = asFolder
    ? original
    : path.basename(original, ext) || "untitled";
  let index = 0;
  while (index < 10000) {
    const suffix = index === 0 ? "" : ` (${index})`;
    const candidate = asFolder ? `${base}${suffix}` : `${base}${suffix}${ext}`;
    if (!fs.existsSync(path.join(targetDir, candidate))) {
      return candidate;
    }
    index += 1;
  }
  throw new Error("name_conflict_too_many");
};

const readWorkspaceTreeNode = (absPath, relPath = "") => {
  const name = relPath ? path.basename(absPath) : "workspace";
  const stat = fs.statSync(absPath);

  if (!stat.isDirectory()) {
    return {
      type: "file",
      name,
      relPath,
      absPath,
      size: stat.size,
      children: []
    };
  }

  const children = [];
  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  for (const entry of entries) {
    const childAbs = path.join(absPath, entry.name);
    const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      children.push(readWorkspaceTreeNode(childAbs, childRel));
      continue;
    }
    if (entry.isFile()) {
      children.push({
        type: "file",
        name: entry.name,
        relPath: childRel,
        absPath: childAbs,
        size: fs.statSync(childAbs).size,
        children: []
      });
    }
  }
  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "zh-CN");
  });

  return {
    type: "folder",
    name,
    relPath,
    absPath,
    size: 0,
    children
  };
};

const resolveWorkspaceNodeTarget = (rootPath, rawRelPath = "") => {
  const { absRoot, absTarget, relPath } = resolveWorkspacePath(rootPath, rawRelPath);
  if (!relPath) {
    throw new Error("cannot_modify_workspace_root");
  }
  if (!fs.existsSync(absTarget)) {
    throw new Error("target_not_found");
  }
  const parentRelPathRaw = path.posix.dirname(relPath);
  const parentRelPath = parentRelPathRaw === "." ? "" : parentRelPathRaw;
  const { absTarget: parentAbs } = resolveWorkspacePath(rootPath, parentRelPath);
  return {
    absRoot,
    absTarget,
    relPath,
    parentAbs,
    parentRelPath,
    currentName: path.posix.basename(relPath)
  };
};

const toFileUrl = (targetPath) => pathToFileURL(String(targetPath || "")).href;

const normalizeSavedSteps = (input) =>
  (Array.isArray(input) ? input : [])
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: Number(item.id) || index + 1,
      title: String(item.title || `Step ${index + 1}`),
      subtitle: String(item.subtitle || ""),
      content: String(item.content || "")
    }));

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
    frame: false,
    thickFrame: true,
    backgroundColor: "#f8fafc",
    hasShadow: true,
    roundedCorners: true,
    ...(process.platform === "darwin" ? { titleBarStyle: "hidden" } : {}),
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
    const bundledRenderer = path.join(__dirname, "renderer-dist", "index.html");
    const legacyRenderer = path.join(__dirname, "renderer-app", "dist", "index.html");
    const built = fs.existsSync(bundledRenderer) ? bundledRenderer : legacyRenderer;
    if (fs.existsSync(built)) {
      await mainWindow.loadFile(built);
    } else {
      const message = "Renderer build not found. Run `npm run build:renderer` in desktop/ first.";
      await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(message)}`);
    }
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const emitMaximizedChanged = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send("desktop:window:maximized-changed", {
      maximized: mainWindow.isMaximized()
    });
  };

  mainWindow.on("maximize", emitMaximizedChanged);
  mainWindow.on("unmaximize", emitMaximizedChanged);
  mainWindow.on("enter-full-screen", emitMaximizedChanged);
  mainWindow.on("leave-full-screen", emitMaximizedChanged);
  emitMaximizedChanged();

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

ipcMain.handle("desktop:window:minimize", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false };
  }
  mainWindow.minimize();
  return { ok: true };
});

ipcMain.handle("desktop:window:toggle-maximize", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, maximized: false };
  }
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return { ok: true, maximized: mainWindow.isMaximized() };
});

ipcMain.handle("desktop:window:is-maximized", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  return mainWindow.isMaximized();
});

ipcMain.handle("desktop:window:drag-from-maximized", async (_event, payload = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, maximized: false };
  }
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }
  if (!mainWindow.isMaximized()) {
    return { ok: true, maximized: false };
  }
  const screenX = Number(payload?.screenX || 0);
  const screenY = Number(payload?.screenY || 0);
  const clientX = Number(payload?.clientX || 0);
  const viewportWidth = Math.max(1, Number(payload?.viewportWidth || 1));
  const pointerRatio = clamp(clientX / viewportWidth, 0.06, 0.94);

  mainWindow.unmaximize();
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: Math.round(screenX),
    y: Math.round(screenY)
  });
  const workArea = display?.workArea || { x: 0, y: 0, width: bounds.width, height: bounds.height };
  const targetX = Math.round(screenX - bounds.width * pointerRatio);
  const targetY = Math.round(screenY - 14);
  const maxX = workArea.x + Math.max(0, workArea.width - bounds.width);
  const maxY = workArea.y + Math.max(0, workArea.height - bounds.height);

  mainWindow.setPosition(
    clamp(targetX, workArea.x, maxX),
    clamp(targetY, workArea.y, maxY)
  );

  return { ok: true, maximized: false };
});

ipcMain.handle("desktop:window:close", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false };
  }
  mainWindow.close();
  return { ok: true };
});

ipcMain.handle("desktop:data:get-steps-path", async () => ({
  ok: true,
  path: getStepsDataPath()
}));

ipcMain.handle("desktop:data:load-steps", async () => {
  const filePath = getStepsDataPath();
  if (!fs.existsSync(filePath)) {
    return { ok: true, exists: false, steps: [], currentId: null, path: filePath };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const steps = normalizeSavedSteps(Array.isArray(parsed) ? parsed : parsed?.steps);
    const currentId = Number(Array.isArray(parsed) ? null : parsed?.currentId);
    return {
      ok: true,
      exists: true,
      steps,
      currentId: Number.isFinite(currentId) ? currentId : null,
      path: filePath
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "read_failed"),
      path: filePath
    };
  }
});

ipcMain.handle("desktop:data:save-steps", async (_event, payload = {}) => {
  const filePath = getStepsDataPath();
  try {
    const steps = normalizeSavedSteps(payload?.steps);
    const requestedCurrentId = Number(payload?.currentId);
    const fallbackCurrentId = steps[0]?.id ?? 1;
    const currentId = Number.isFinite(requestedCurrentId) ? requestedCurrentId : fallbackCurrentId;
    const record = {
      version: 1,
      updatedAt: new Date().toISOString(),
      currentId,
      steps
    };
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(record, null, 2), "utf8");
    fs.renameSync(tempPath, filePath);
    return { ok: true, path: filePath };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "write_failed"),
      path: filePath
    };
  }
});

ipcMain.handle("desktop:data:get-workspace-root", async () => {
  const rootPath = ensureWorkspaceDir();
  return {
    ok: true,
    rootPath
  };
});

ipcMain.handle("desktop:data:read-workspace-tree", async () => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot } = resolveWorkspacePath(rootPath, "");
    const tree = readWorkspaceTreeNode(absRoot, "");
    return {
      ok: true,
      rootPath: absRoot,
      tree
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "read_workspace_failed"),
      rootPath
    };
  }
});

/* legacy create handlers (kept commented due historical encoding issues)
ipcMain.handle("desktop:data:create-workspace-file", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot, absTarget: parentAbs, relPath: parentRelPath } = resolveWorkspacePath(
      rootPath,
      payload?.parentRelPath || ""
    );
    if (!fs.existsSync(parentAbs)) {
      fs.mkdirSync(parentAbs, { recursive: true });
    }
    if (!fs.statSync(parentAbs).isDirectory()) {
      throw new Error("parent_not_directory");
    }
    /*
    /*

    let requested = sanitizeWorkspaceName(payload?.name, "未命名.md");
    if (!path.extname(requested)) {
      requested = `${requested}.md`;
    }
    * /
    let requested = sanitizeWorkspaceName(payload?.name, "untitled.md");
    if (!path.extname(requested)) {
      requested = `${requested}.md`;
    }
    const finalName = pickUniqueName(parentAbs, requested, false);
    const targetAbs = path.join(parentAbs, finalName);
    fs.writeFileSync(targetAbs, "", { encoding: "utf8", flag: "wx" });
    const relPath = toWorkspaceRel(absRoot, targetAbs);

    return {
      ok: true,
      rootPath: absRoot,
      parentRelPath,
      name: finalName,
      relPath,
      absPath: targetAbs
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "create_workspace_file_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:create-workspace-folder", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot, absTarget: parentAbs, relPath: parentRelPath } = resolveWorkspacePath(
      rootPath,
      payload?.parentRelPath || ""
    );
    if (!fs.existsSync(parentAbs)) {
      fs.mkdirSync(parentAbs, { recursive: true });
    }
    if (!fs.statSync(parentAbs).isDirectory()) {
      throw new Error("parent_not_directory");
    }

    const requested = sanitizeWorkspaceName(payload?.name, "新建文件夹");
    * /
    const requested = sanitizeWorkspaceName(payload?.name, "new-folder");
    const finalName = pickUniqueName(parentAbs, requested, true);
    const targetAbs = path.join(parentAbs, finalName);
    fs.mkdirSync(targetAbs, { recursive: false });
    const relPath = toWorkspaceRel(absRoot, targetAbs);

    return {
      ok: true,
      rootPath: absRoot,
      parentRelPath,
      name: finalName,
      relPath,
      absPath: targetAbs
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "create_workspace_folder_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:read-workspace-file", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot, absTarget, relPath } = resolveWorkspacePath(rootPath, payload?.relPath || "");
    if (!relPath) {
      throw new Error("invalid_file_path");
    }
    if (!fs.existsSync(absTarget)) {
      throw new Error("file_not_found");
    }
    const stat = fs.statSync(absTarget);
    if (!stat.isFile()) {
      throw new Error("target_not_file");
    }
    if (stat.size > MAX_WORKSPACE_MARKDOWN_BYTES) {
      return {
        ok: false,
        error: "workspace_file_too_large",
        rootPath: absRoot,
        relPath,
        absPath: absTarget,
        size: stat.size,
        limitBytes: MAX_WORKSPACE_MARKDOWN_BYTES
      };
    }
    const content = fs.readFileSync(absTarget, "utf8");
    return {
      ok: true,
      rootPath: absRoot,
      relPath,
      absPath: absTarget,
      size: stat.size,
      content
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "read_workspace_file_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:write-workspace-file", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot, absTarget, relPath } = resolveWorkspacePath(rootPath, payload?.relPath || "");
    if (!relPath) {
      throw new Error("invalid_file_path");
    }
    const parentAbs = path.dirname(absTarget);
    fs.mkdirSync(parentAbs, { recursive: true });
    if (fs.existsSync(absTarget) && !fs.statSync(absTarget).isFile()) {
      throw new Error("target_not_file");
    }
    const content = String(payload?.content ?? "");
    fs.writeFileSync(absTarget, content, "utf8");
    return {
      ok: true,
      rootPath: absRoot,
      relPath,
      absPath: absTarget
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "write_workspace_file_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:open-workspace-dir", async () => {
  const rootPath = ensureWorkspaceDir();
  const error = await shell.openPath(rootPath);
  return {
    ok: !error,
    rootPath,
    error: String(error || "")
  };
});

*/

ipcMain.handle("desktop:data:create-workspace-file", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot, absTarget: parentAbs, relPath: parentRelPath } = resolveWorkspacePath(
      rootPath,
      payload?.parentRelPath || ""
    );
    fs.mkdirSync(parentAbs, { recursive: true });
    if (!fs.statSync(parentAbs).isDirectory()) {
      throw new Error("parent_not_directory");
    }

    let requested = sanitizeWorkspaceName(payload?.name, "untitled.md");
    if (!path.extname(requested)) {
      requested = `${requested}.md`;
    }
    const finalName = pickUniqueName(parentAbs, requested, false);
    const targetAbs = path.join(parentAbs, finalName);
    fs.writeFileSync(targetAbs, "", { encoding: "utf8", flag: "wx" });
    const relPath = toWorkspaceRel(absRoot, targetAbs);

    return {
      ok: true,
      rootPath: absRoot,
      parentRelPath,
      name: finalName,
      relPath,
      absPath: targetAbs
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "create_workspace_file_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:create-workspace-folder", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot, absTarget: parentAbs, relPath: parentRelPath } = resolveWorkspacePath(
      rootPath,
      payload?.parentRelPath || ""
    );
    fs.mkdirSync(parentAbs, { recursive: true });
    if (!fs.statSync(parentAbs).isDirectory()) {
      throw new Error("parent_not_directory");
    }

    const requested = sanitizeWorkspaceName(payload?.name, "new-folder");
    const finalName = pickUniqueName(parentAbs, requested, true);
    const targetAbs = path.join(parentAbs, finalName);
    fs.mkdirSync(targetAbs, { recursive: false });
    const relPath = toWorkspaceRel(absRoot, targetAbs);

    return {
      ok: true,
      rootPath: absRoot,
      parentRelPath,
      name: finalName,
      relPath,
      absPath: targetAbs
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "create_workspace_folder_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:rename-workspace-node", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const {
      absRoot,
      absTarget,
      relPath,
      parentAbs,
      parentRelPath,
      currentName
    } = resolveWorkspaceNodeTarget(rootPath, payload?.relPath || "");
    const stat = fs.statSync(absTarget);
    const requestedName = sanitizeWorkspaceName(payload?.name, "");
    if (!requestedName) {
      throw new Error("invalid_name");
    }
    if (requestedName === currentName) {
      return {
        ok: true,
        rootPath: absRoot,
        relPath,
        previousRelPath: relPath,
        absPath: absTarget,
        type: stat.isDirectory() ? "folder" : "file",
        name: currentName
      };
    }
    const nextAbs = path.join(parentAbs, requestedName);
    if (fs.existsSync(nextAbs)) {
      throw new Error("target_already_exists");
    }
    fs.renameSync(absTarget, nextAbs);
    const nextRelPath = parentRelPath ? `${parentRelPath}/${requestedName}` : requestedName;
    return {
      ok: true,
      rootPath: absRoot,
      relPath: nextRelPath,
      previousRelPath: relPath,
      absPath: nextAbs,
      type: stat.isDirectory() ? "folder" : "file",
      name: requestedName
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "rename_workspace_node_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:delete-workspace-node", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot, absTarget, relPath } = resolveWorkspaceNodeTarget(rootPath, payload?.relPath || "");
    const stat = fs.statSync(absTarget);
    fs.rmSync(absTarget, { recursive: true, force: false });
    return {
      ok: true,
      rootPath: absRoot,
      relPath,
      type: stat.isDirectory() ? "folder" : "file"
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "delete_workspace_node_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:open-workspace-dir", async () => {
  const rootPath = ensureWorkspaceDir();
  const error = await shell.openPath(rootPath);
  return {
    ok: !error,
    rootPath,
    error: String(error || "")
  };
});

ipcMain.handle("desktop:data:read-workspace-file", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot, absTarget, relPath } = resolveWorkspacePath(rootPath, payload?.relPath || "");
    if (!relPath) {
      throw new Error("invalid_file_path");
    }
    if (!fs.existsSync(absTarget)) {
      throw new Error("file_not_found");
    }
    if (!fs.statSync(absTarget).isFile()) {
      throw new Error("target_not_file");
    }
    const content = fs.readFileSync(absTarget, "utf8");
    return {
      ok: true,
      rootPath: absRoot,
      relPath,
      absPath: absTarget,
      content
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "read_workspace_file_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:write-workspace-file", async (_event, payload = {}) => {
  const rootPath = ensureWorkspaceDir();
  try {
    const { absRoot, absTarget, relPath } = resolveWorkspacePath(rootPath, payload?.relPath || "");
    if (!relPath) {
      throw new Error("invalid_file_path");
    }
    const parentAbs = path.dirname(absTarget);
    fs.mkdirSync(parentAbs, { recursive: true });
    if (fs.existsSync(absTarget) && !fs.statSync(absTarget).isFile()) {
      throw new Error("target_not_file");
    }
    const content = String(payload?.content ?? "");
    fs.writeFileSync(absTarget, content, "utf8");
    return {
      ok: true,
      rootPath: absRoot,
      relPath,
      absPath: absTarget
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "write_workspace_file_failed"),
      rootPath
    };
  }
});

ipcMain.handle("desktop:data:pick-workspace-root", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: "window_unavailable" };
  }
  const currentRoot = ensureWorkspaceDir();
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: "Select workspace root",
    defaultPath: currentRoot,
    properties: ["openDirectory", "createDirectory"]
  });
  if (picked.canceled || !picked.filePaths || picked.filePaths.length === 0) {
    return { ok: false, canceled: true, rootPath: currentRoot };
  }
  try {
    const rootPath = setWorkspaceRootDir(picked.filePaths[0]);
    return { ok: true, rootPath };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "set_workspace_root_failed"),
      rootPath: currentRoot
    };
  }
});

ipcMain.handle("desktop:assets:get-image-dir", async () => {
  const dir = ensureDesktopImageDir();
  return { ok: true, dir };
});

ipcMain.handle("desktop:assets:open-image-dir", async () => {
  const dir = ensureDesktopImageDir();
  const error = await shell.openPath(dir);
  return {
    ok: !error,
    dir,
    error: String(error || "")
  };
});

ipcMain.handle("desktop:assets:pick-image", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: "window_unavailable" };
  }

  const picked = await dialog.showOpenDialog(mainWindow, {
    title: "Select image to insert",
    properties: ["openFile"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]
      }
    ]
  });

  if (picked.canceled || !picked.filePaths || picked.filePaths.length === 0) {
    return { canceled: true };
  }

  try {
    const source = String(picked.filePaths[0] || "");
    const imageDir = ensureDesktopImageDir();
    const ext = path.extname(source) || ".png";
    const stem = path.basename(source, ext).replace(/[^\w.-]+/g, "_").slice(0, 60) || "image";
    const copied = path.join(imageDir, `${Date.now()}-${stem}${ext}`);
    fs.copyFileSync(source, copied);
    return {
      ok: true,
      filePath: copied,
      markdownUrl: toFileUrl(copied)
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "copy_failed")
    };
  }
});

app.whenReady().then(async () => {
  protocol.registerFileProtocol("ycdoc-file", (request, callback) => {
    try {
      const parsed = new URL(request.url);
      if (parsed.hostname !== "local") {
        callback({ error: -10 });
        return;
      }

      const encoded = String(parsed.pathname || "").replace(/^\/+/, "");
      const decoded = decodeURIComponent(encoded);
      const target = path.normalize(decoded);

      if (!path.isAbsolute(target) || !fs.existsSync(target)) {
        callback({ error: -6 });
        return;
      }

      callback(target);
    } catch {
      callback({ error: -324 });
    }
  });

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

