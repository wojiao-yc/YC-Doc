# MarkVein

MarkVein 是一个基于 Electron、Vue 3 和 CodeMirror 6 的桌面 Markdown 工作区应用。

它以本地 Markdown 文件作为唯一内容来源，适合写作、知识整理、演示稿编写，以及包含图片、数学公式、代码块、表格的文档编辑。

## 功能概览

- 本地工作区模式：直接读取和保存本地 `.md` 文件，不再依赖单独的 `steps.js` 示例数据。
- Markdown 编辑与展示一体化：支持编辑态、阅读态、演示态切换。
- 富内容块支持：代码块、数学块、表格、图片、引用、列表、Wiki Link。
- 工作区文件树：新建文件、新建文件夹、重命名、移动、删除、导入文件。
- 内置终端：在桌面端直接打开本地终端会话。
- 自动保存与 PDF 导出：文档变更会自动落盘，也支持导出 PDF。

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

说明：
现在仓库里不再区分旧的 `desktop/renderer` 和新的 `desktop/renderer-app` 逻辑来源。前端源码统一放在 `desktop/renderer-app` 中，`desktop/renderer-dist` 仅作为打包产物目录。

## 开发环境

建议在 Windows 下开发和打包，并确保以下工具已经安装且加入 PATH：

- Node.js
- npm

如果终端执行 `node -v` 或 `npm -v` 提示找不到命令，请先修复环境变量，再继续下面的步骤。

## 本地开发

在 `desktop` 目录执行：

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
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
cd D:\python\project\Homepage\YC-Doc\desktop
npm run build:renderer
```

构建结果会输出到 `desktop/renderer-dist`。

## 打包桌面应用

在 `desktop` 目录执行：

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
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

## 如何分发给其他人

最直接的方式是把 `desktop/dist/` 目录里生成的 Windows 安装包发给其他人下载。

推荐流程：

1. 在你的机器上执行 `npm run pack:win`。
2. 从 `desktop/dist/` 取出生成的 `.exe` 安装包。
3. 把该安装包上传到网盘、GitHub Release、内网文件服务器或网站下载页。
4. 让对方直接下载安装即可。

补充说明：

- 首次安装后，应用默认会在“文档”目录下创建 `MarkVein-Workspace` 作为默认工作区。
- 如果安装包没有做代码签名，其他 Windows 电脑上可能会出现 SmartScreen 安全提示，这是未签名桌面应用的常见现象。
- 如果准备长期对外发布，建议后续补充代码签名证书和版本发布页。

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
- 文档内容会按照 Markdown 文件直接保存，不再写入单独的步骤缓存文件。

### 5. 导出或分享

- 可以在应用内导出 PDF。
- 也可以直接把工作区中的 Markdown 文件复制给别人。

## 命名与图标

项目已统一使用 `MarkVein` 作为桌面应用名称，相关配置集中在：

- `desktop/package.json`
- `desktop/main.cjs`
- `desktop/renderer-app/package.json`
- `MarkVein.png`

如果后续需要更换品牌图标，替换 `MarkVein.png` 并重新执行 `npm run pack:win` 即可。
