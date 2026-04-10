# MarkVein

首先，必须要说的是，该项目完全是一时兴起，想着看看在完全不编写代码的情况下vibe coding能否自己做出一个还算能用的markdown编辑器

MarkVein 是一个基于 Electron、Vue 3 和 CodeMirror 6 的桌面 Markdown 工作区应用。

它以本地 Markdown 文件作为唯一内容来源，适合写作、知识整理、演示稿编写，以及包含图片、数学公式、代码块、表格的文档编辑。

## 功能概览

- 本地工作区：直接读取和保存本地 `.md` 文件。
- Markdown 编辑与展示一体化：支持编辑态、阅读态、演示态切换。
- 富内容块支持：代码块、数学块、表格、图片、引用、列表、Wiki Link (仿obsidian)。
- 工作区文件树：新建文件、新建文件夹、重命名、移动、删除、导入文件。
- 内置终端：在桌面端直接打开本地终端会话。
- 自动保存与 PDF 导出：文档变更会自动落盘，也支持导出 PDF(这个导出PDF效果很差)。

## 当前目录结构

- `MarkVein.png`
  Electron 应用图标来源文件。
- `desktop/main.cjs`
  Electron 主进程，负责窗口、工作区文件读写、图片导入、终端 IPC 等能力。
- `desktop/preload.cjs`
  预加载桥接层，向前端暴露桌面能力。
- `desktop/renderer-app`
  前端源码目录，也是现在唯一保留的 renderer 源码入口。
- `desktop/renderer-dist`
  前端构建输出目录，由 `npm run build:renderer` 生成。
- `desktop/package.json`
  桌面端脚本、Electron Builder 配置、应用命名与打包配置。



## 本地开发

在 `desktop` 目录执行：

```powershell
cd \PATH\desktop
npm install
npm run dev
```

说明：

- `npm run dev` 会同时启动 Vite 前端开发服务器和 Electron 桌面窗口。
- 前端源码位于 `desktop/renderer-app`。
- Electron 主进程入口为 `desktop/main.cjs`。

## 构建前端

如果只想生成前端资源，可以执行：

```powershell
cd \PATH\desktop
npm run build:renderer
```

构建结果会输出到 `desktop/renderer-dist`。

## 打包桌面应用

在 `desktop` 目录执行：

```powershell
cd \PATH\desktop
npm install
npm run pack:win
```

打包完成后，安装包会生成在 `desktop/dist/` 下。
当前配置会使用以下品牌信息：

- 应用名称：`MarkVein`
- Electron `appId`：`com.markvein.desktop`
- Windows 可执行文件名：`MarkVein`
- 图标文件：`MarkVein.png`

默认安装包名称格式为：

```text
MarkVein-0.1.0-setup.exe
```

如果你只想先生成未安装版目录，可以使用：

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
npm run pack:dir
```

补充说明：

- 首次安装后，应用默认会在“文档”目录下创建 `MarkVein-Workspace` 作为默认工作区。
- 如果安装包没有做代码签名，其他 Windows 电脑上可能会出现 SmartScreen 安全提示，这是未签名桌面应用的常见现象。

## 使用方式

### 1. 打开应用

启动 MarkVein 后，应用会自动加载当前工作区。

### 2. 选择或切换工作区

- 可以在左侧文件区管理工作区文件。
- 可以切换工作区根目录。
- 默认工作区路径通常位于用户“文档”目录下的 `MarkVein-Workspace`。

### 3. 新建 Markdown 文件

- 在左侧文件树中创建新文件或新文件夹。
- 选择 `.md` 文件后，编辑器会直接读取并显示其内容。

### 4. 编辑内容

- 支持普通 Markdown 语法。
- 支持图片、表格、数学公式、代码块等内容块。
- 文档内容会按照 Markdown 文件直接保存。



