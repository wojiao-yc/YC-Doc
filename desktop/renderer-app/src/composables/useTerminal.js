import { ref, watch } from "vue";
import { copyText } from "../utils/clipboard";
import { getDesktopBridge } from "../../../renderer/desktopBridge.js";

export const useTerminal = (_activeStep, showToast) => {
  const desktopBridge = getDesktopBridge();
  const isDesktopPty = ref(Boolean(desktopBridge && desktopBridge.isDesktop));

  const terminalOpen = ref(false);
  const executor = ref(localStorage.getItem("runnerExecutor") || "local-powershell");
  const cmdInput = ref("");
  const isRunning = ref(false);

  const runnerUrl = ref("http://127.0.0.1:8787");
  const runnerToken = ref(localStorage.getItem("runnerToken") || "");
  const runnerCwd = ref(localStorage.getItem("runnerCwd") || "");

  const bridgeOk = ref(false);
  const termLog = ref([]);

  const sessionId = ref("");
  const sessionShell = ref("");
  const readCursor = ref(0);

  let readTimer = null;
  let readBusy = false;
  let activeWorker = null;
  let activeWorkerDone = null;
  let desktopDataOff = null;
  let desktopExitOff = null;

  const streamListeners = new Set();

  const log = (line) => {
    termLog.value.push(String(line ?? ""));
  };

  const emitStream = (data, sourceSessionId = "", stream = "stdout") => {
    const text = String(data ?? "");
    if (!text) {
      return;
    }

    for (const handler of streamListeners) {
      try {
        handler({
          sessionId: String(sourceSessionId || ""),
          stream,
          data: text
        });
      } catch {
        // ignore listener errors
      }
    }

    if (!isDesktopPty.value || streamListeners.size === 0) {
      log(text);
    }
  };

  const onTerminalData = (handler) => {
    if (typeof handler !== "function") {
      return () => {};
    }
    streamListeners.add(handler);
    return () => {
      streamListeners.delete(handler);
    };
  };

  const appendLog = (line) => {
    log(line);
  };

  const clearLog = () => {
    termLog.value = [];
  };

  const copyWithToast = async (text) => {
    const ok = await copyText(text);
    if (showToast) {
      showToast(ok ? "Copied" : "Copy failed");
    }
    return ok;
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${runnerToken.value}`
  });

  const stopReadLoop = () => {
    if (readTimer) {
      clearInterval(readTimer);
      readTimer = null;
    }
  };

  const dropSessionState = () => {
    sessionId.value = "";
    sessionShell.value = "";
    readCursor.value = 0;
    stopReadLoop();
  };

  const setupDesktopBridge = () => {
    if (!isDesktopPty.value || desktopDataOff || desktopExitOff) {
      return;
    }
    desktopDataOff = desktopBridge.onData((payload) => {
      if (!payload) {
        return;
      }
      emitStream(payload.data, payload.sessionId, "stdout");
    });
    desktopExitOff = desktopBridge.onExit((payload) => {
      if (!payload) {
        return;
      }
      emitStream(`\r\n[exit] code=${payload.exitCode ?? 0}\r\n`, payload.sessionId, "meta");
      if (payload.sessionId === sessionId.value) {
        dropSessionState();
      }
    });
  };

  const pingBridge = async (silent = false) => {
    if (isDesktopPty.value) {
      bridgeOk.value = true;
      if (!silent && showToast) {
        showToast("Desktop PTY ready");
      }
      return;
    }

    try {
      const resp = await fetch(`${runnerUrl.value}/health`, { method: "GET" });
      bridgeOk.value = resp.ok;
      if (!silent && showToast) {
        showToast(bridgeOk.value ? "Local Runner OK" : "Local Runner offline");
      }
    } catch {
      bridgeOk.value = false;
      if (!silent && showToast) {
        showToast("Local Runner offline");
      }
    }
  };

  const runBrowserJS = async (js) =>
    new Promise((resolve) => {
      const workerCode = `
        self.console = {
          log: (...args) => self.postMessage({ type: 'log', data: args.map(String).join(' ') }),
          error: (...args) => self.postMessage({ type: 'err', data: args.map(String).join(' ') })
        };
        self.onmessage = async (e) => {
          try {
            const code = e.data || "";
            const fn = new Function(code);
            const result = fn();
            if (result && typeof result.then === 'function') await result;
            self.postMessage({ type: 'done' });
          } catch (err) {
            self.postMessage({ type: 'err', data: (err && err.stack) ? err.stack : String(err) });
            self.postMessage({ type: 'done' });
          }
        };
      `;
      const blob = new Blob([workerCode], { type: "text/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));
      activeWorker = worker;
      activeWorkerDone = resolve;

      worker.onmessage = (ev) => {
        const msg = ev.data || {};
        if (msg.type === "log") {
          log(`[js] ${msg.data}`);
        }
        if (msg.type === "err") {
          log(`[js:err] ${msg.data}`);
        }
        if (msg.type === "done") {
          worker.terminate();
          if (activeWorker === worker) {
            activeWorker = null;
            activeWorkerDone = null;
          }
          resolve();
        }
      };

      worker.postMessage(js || "");
    });

  const localShellFromExecutor = () => {
    if (executor.value === "local-bash") {
      return "bash";
    }
    if (executor.value === "local-cmd") {
      return "cmd";
    }
    if (executor.value === "local-pwsh") {
      return "pwsh";
    }
    return "powershell";
  };

  const readSession = async () => {
    if (isDesktopPty.value || !sessionId.value || readBusy) {
      return;
    }

    readBusy = true;
    try {
      const resp = await fetch(`${runnerUrl.value}/session/read`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sessionId: sessionId.value,
          cursor: readCursor.value,
          limit: 200
        })
      });

      if (!resp.ok) {
        if (resp.status === 404 || resp.status === 410) {
          dropSessionState();
          return;
        }
        const data = await resp.json().catch(() => ({}));
        log(`[session:err] HTTP ${resp.status} ${JSON.stringify(data)}`);
        return;
      }

      const data = await resp.json().catch(() => ({}));
      const chunks = Array.isArray(data.chunks) ? data.chunks : [];
      for (const chunk of chunks) {
        if (chunk && typeof chunk.data !== "undefined") {
          emitStream(chunk.data, sessionId.value, chunk.stream || "stdout");
        }
      }
      if (typeof data.cursor === "number") {
        readCursor.value = data.cursor;
      }
      if (data.alive === false) {
        dropSessionState();
      }
    } catch (err) {
      log(`[session:err] ${String(err)}`);
      bridgeOk.value = false;
    } finally {
      readBusy = false;
    }
  };

  const startReadLoop = () => {
    if (isDesktopPty.value) {
      return;
    }
    stopReadLoop();
    readTimer = setInterval(() => {
      void readSession();
    }, 220);
  };

  const terminateRemoteSession = async () => {
    if (!sessionId.value) {
      dropSessionState();
      return;
    }

    if (isDesktopPty.value) {
      try {
        await desktopBridge.kill(sessionId.value);
      } catch {
        // ignore
      } finally {
        dropSessionState();
      }
      return;
    }

    if (!runnerToken.value) {
      dropSessionState();
      return;
    }

    try {
      await fetch(`${runnerUrl.value}/session/terminate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ sessionId: sessionId.value })
      });
    } catch {
      // ignore
    } finally {
      dropSessionState();
    }
  };

  const ensureSession = async (shell) => {
    if (sessionId.value && sessionShell.value === shell) {
      return true;
    }

    if (sessionId.value && sessionShell.value !== shell) {
      await terminateRemoteSession();
    }

    if (isDesktopPty.value) {
      setupDesktopBridge();
      try {
        const created = await desktopBridge.createSession({
          shell,
          cwd: runnerCwd.value || ""
        });
        sessionId.value = String(created.sessionId || "");
        sessionShell.value = shell;
        bridgeOk.value = true;
        if (!sessionId.value) {
          log("[session:err] Missing sessionId.");
          return false;
        }
        return true;
      } catch (err) {
        bridgeOk.value = false;
        log(`[pty:err] ${String(err)}`);
        return false;
      }
    }

    await pingBridge(true);
    if (!bridgeOk.value) {
      log("[local] Local Runner is offline.");
      return false;
    }
    if (!runnerToken.value) {
      log("[local] Missing token.");
      return false;
    }

    try {
      const resp = await fetch(`${runnerUrl.value}/session/create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          shell,
          cwd: runnerCwd.value || ""
        })
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        log(`[session:err] HTTP ${resp.status} ${JSON.stringify(data)}`);
        if (resp.status === 404) {
          log("[session] Runner does not support session mode. Restart with latest script.");
        }
        return false;
      }

      const data = await resp.json().catch(() => ({}));
      sessionId.value = String(data.sessionId || "");
      sessionShell.value = shell;
      readCursor.value = Number(data.cursor || 0);
      if (!sessionId.value) {
        log("[session:err] Missing sessionId.");
        return false;
      }

      startReadLoop();
      void readSession();
      return true;
    } catch (err) {
      log(`[session:err] ${String(err)}`);
      bridgeOk.value = false;
      return false;
    }
  };

  const createDesktopSession = async (shell) => {
    if (!isDesktopPty.value) {
      return "";
    }
    setupDesktopBridge();
    try {
      const created = await desktopBridge.createSession({
        shell,
        cwd: runnerCwd.value || ""
      });
      const sid = String(created?.sessionId || "");
      if (!sid) {
        return "";
      }
      bridgeOk.value = true;
      sessionId.value = sid;
      sessionShell.value = shell;
      return sid;
    } catch (err) {
      bridgeOk.value = false;
      log(`[pty:err] ${String(err)}`);
      if (showToast) {
        showToast(`创建终端失败: ${String(err)}`);
      }
      return "";
    }
  };

  const setActiveDesktopSession = (sid, shell = "") => {
    if (!isDesktopPty.value) {
      return;
    }
    sessionId.value = String(sid || "");
    if (shell) {
      sessionShell.value = String(shell);
    }
  };

  const writeTerminalRaw = async (input, targetSessionId = "") => {
    const text = String(input ?? "");
    if (!text) {
      return;
    }
    const shell = localShellFromExecutor();
    const targetSid = String(targetSessionId || "");

    let ok = true;
    if (!isDesktopPty.value || !targetSid) {
      ok = await ensureSession(shell);
    } else {
      setupDesktopBridge();
      ok = true;
    }
    if (!ok) {
      return;
    }

    if (isDesktopPty.value) {
      try {
        const sid = targetSid || sessionId.value;
        if (!sid) {
          if (showToast) {
            showToast("当前终端会话不存在");
          }
          return;
        }
        await desktopBridge.write(sid, text);
      } catch (err) {
        log(`[pty:err] ${String(err)}`);
        if (showToast) {
          showToast(`终端写入失败: ${String(err)}`);
        }
      }
      return;
    }

    try {
      const resp = await fetch(`${runnerUrl.value}/session/write`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sessionId: targetSid || sessionId.value,
          input: text
        })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        log(`[session:err] HTTP ${resp.status} ${JSON.stringify(data)}`);
        if (resp.status === 404 || resp.status === 410) {
          dropSessionState();
        }
      }
    } catch (err) {
      log(`[session:err] ${String(err)}`);
      bridgeOk.value = false;
    }
  };

  const runLocalSessionWrite = async (cmd, targetSessionId = "") => {
    await writeTerminalRaw(`${cmd}\r\n`, targetSessionId);
  };

  const resizeTerminalSession = async (cols, rows, targetSessionId = "") => {
    if (!isDesktopPty.value) {
      return;
    }
    const sid = String(targetSessionId || sessionId.value || "");
    if (!sid) {
      return;
    }
    const width = Math.max(2, Number(cols || 0));
    const height = Math.max(1, Number(rows || 0));
    try {
      await desktopBridge.resize(sid, width, height);
    } catch {
      // ignore resize errors
    }
  };

  const killTerminalSession = async (targetSessionId = "") => {
    const sid = String(targetSessionId || sessionId.value || "");
    if (!sid) {
      return;
    }
    if (isDesktopPty.value) {
      try {
        await desktopBridge.kill(sid);
      } catch {
        // ignore
      }
      if (sid === sessionId.value) {
        dropSessionState();
      }
      return;
    }
    await terminateRemoteSession();
  };

  const stopExecution = async () => {
    let stopped = false;

    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
      if (activeWorkerDone) {
        activeWorkerDone();
        activeWorkerDone = null;
      }
      log("[terminated] Browser JS execution stopped.");
      stopped = true;
    }

    if (sessionId.value) {
      await terminateRemoteSession();
      log("[terminated] Terminal session closed.");
      stopped = true;
    }

    if (!stopped) {
      log("[terminated] No active task.");
    }

    isRunning.value = false;
  };

  const runText = async (text, langHint = "") => {
    const code = String(text || "").trim();
    if (!code) {
      return;
    }

    const lang = (langHint || "").toLowerCase();
    const isShell = ["bash", "sh", "zsh"].includes(lang);
    const isPwsh = ["powershell", "ps1", "pwsh"].includes(lang);

    isRunning.value = true;
    try {
      if (lang && (lang === "js" || lang === "javascript")) {
        await runBrowserJS(code);
        return;
      }
      if (lang && isShell) {
        await ensureSession("bash");
        await runLocalSessionWrite(code);
        return;
      }
      if (lang && isPwsh) {
        await ensureSession("powershell");
        await runLocalSessionWrite(code);
        return;
      }

      if (executor.value === "browser-js") {
        await runBrowserJS(code);
        return;
      }
      await runLocalSessionWrite(code);
    } finally {
      isRunning.value = false;
    }
  };

  const runInput = async (text = cmdInput.value) => {
    await runText(text, "");
  };

  const runCodeBlock = async (block) => {
    await runText(block.code, block.lang);
  };

  const toggleTerminal = async () => {
    terminalOpen.value = !terminalOpen.value;
    if (terminalOpen.value) {
      await pingBridge(true);
    }
  };

  const disposeTerminal = () => {
    stopReadLoop();
    if (desktopDataOff) {
      desktopDataOff();
      desktopDataOff = null;
    }
    if (desktopExitOff) {
      desktopExitOff();
      desktopExitOff = null;
    }
  };

  watch(runnerToken, (value) => {
    localStorage.setItem("runnerToken", value || "");
    if (!isDesktopPty.value && !value) {
      void terminateRemoteSession();
    }
  });

  watch(runnerCwd, (value) => {
    localStorage.setItem("runnerCwd", value || "");
    if (sessionId.value) {
      void terminateRemoteSession();
    }
  });

  watch(executor, (value) => {
    localStorage.setItem("runnerExecutor", value || "local-powershell");
    if (sessionId.value) {
      void terminateRemoteSession();
    }
  });

  return {
    terminalOpen,
    executor,
    cmdInput,
    isRunning,
    runnerToken,
    runnerCwd,
    runnerUrl,
    bridgeOk,
    termLog,
    isDesktopPty,
    clearLog,
    pingBridge,
    toggleTerminal,
    runCodeBlock,
    runInput,
    stopExecution,
    appendLog,
    copyText: copyWithToast,
    onTerminalData,
    createDesktopSession,
    setActiveDesktopSession,
    ensureTerminalSession: ensureSession,
    writeTerminalRaw,
    resizeTerminalSession,
    killTerminalSession,
    currentSessionId: sessionId,
    currentSessionShell: sessionShell,
    disposeTerminal
  };
};
