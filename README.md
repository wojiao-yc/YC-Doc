# Simple App

这个仓库现在包含两个核心部分：

- `web/`: Vite + Vue 3 + Tailwind + PWA 版本（本次先完成）。
- `desktop/`: Electron 桌面版（已接入真实 PTY）。
- `shared/`: Web 与 Desktop 共用的业务数据与可复用模块。
- `local-runner.ps1`: 本地命令执行桥（可选，供 Web 版本的“终端”功能调用）。

## Web/PWA 版本运行

> 建议在 conda 的 `torch` 环境里执行。

```powershell
cd d:\python\project\Simple\web
conda run -n torch npm install
conda run -n torch npm run dev
```

浏览器访问 `http://localhost:5173`。

## 桌面版（Electron + 真实 PTY）

桌面版直接使用 `node-pty`，不依赖 Local Runner，可运行需要 TTY/PTY 的交互命令（如 `claude`）。

```powershell
cd d:\python\project\Simple\desktop
npm install
npm run dev
```

说明：
- `npm run dev` 会同时启动 `web` 的 Vite 开发服务和 Electron 主进程。
- 若只运行打包后的前端（需先构建 `web/dist`），可执行：

```powershell
cd d:\python\project\Simple\desktop
npm run build:renderer
npm run start
```

### 构建 PWA

```powershell
cd d:\python\project\Simple\web
conda run -n torch npm run build
```

## 本地命令执行桥（Local Runner）

如果要在 UI 内执行本机命令，请先启动桥接服务：

```powershell
cd d:\python\project\Simple
powershell -ExecutionPolicy Bypass -File .\local-runner.ps1 -Port 8787 -Token "your-token" -DefaultCwd "d:\\python\\project\\Simple"
```

然后在 Web 界面的“终端”里填写同样的 Token 和 cwd。

当前 Local Runner 支持并自动适配以下终端：
- `PowerShell`（优先 `powershell.exe`，可回退）
- `pwsh`（PowerShell 7，若缺失会自动回退）
- `cmd`（Command Prompt）
- `bash`（若系统已安装）

现在默认启用会话模式（`sessionId + stream read/write`），可持续保留命令上下文（例如 `cd` 后目录状态会延续）。
若你更新了 `local-runner.ps1`，请务必重启 Local Runner 进程后再使用。

> 提示：Local Runner 允许执行本地命令，请只在可信环境使用。

## 模式说明

- 浏览器版：终端走 `local-runner.ps1`（HTTP 会话模式）。
- 桌面版：终端走 Electron IPC + `node-pty`（真实 PTY，会话流式读写）。
- 桌面版终端支持：多终端会话（新建/切换/关闭）、会话标签拖拽排序、会话下拉切换、右键粘贴、`Ctrl/Cmd + V` 粘贴、有选区时 `Ctrl/Cmd + C` 复制。
- 桌面版展示模式会自动进入无边框全屏，按 `Esc` 退出全屏。

## Markdown 图片

支持标准 Markdown 图片语法：

```markdown
![图片说明](https://example.com/demo.png)
```

本地图片建议放到 `web/public/` 下，再用根路径引用，例如：

```markdown
![示例图片](/images/demo.png)
```
