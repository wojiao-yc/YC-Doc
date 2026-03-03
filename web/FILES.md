# web/ 文件说明

本文件说明 `web/` 目录下每个文件/目录的作用。

## 顶层目录

- `node_modules/`：npm 安装的依赖产物，自动生成，不提交。
- `public/`：静态资源目录，构建时原样拷贝。
  - `icon.svg`：PWA 和页面的图标资源。
- `src/`：应用源码目录。
- `.gitignore`：忽略前端构建输出与依赖目录。
- `index.html`：应用入口 HTML，挂载 `#app`，由 Vite 注入脚本。
- `package.json`：前端依赖与脚本配置（dev/build/preview）。
- `package-lock.json`：npm 依赖锁定文件，自动生成。
- `postcss.config.cjs`：PostCSS 配置（Tailwind + Autoprefixer）。
- `tailwind.config.cjs`：Tailwind 扫描路径与主题配置。
- `tsconfig.json`：TypeScript 配置（目前主要是模板遗留，若迁移 TS 可使用）。
- `vite.config.js`：Vite 构建配置 + PWA 插件配置。

## src/ 目录

- `App.vue`：主界面与 UI 结构（侧边栏、编辑区、预览、终端）。
- `main.js`：应用入口，挂载 Vue，加载全局样式和 Prism 主题。
- `components/ToastMessage.vue`：轻量提示组件。
- `composables/`：可复用状态/逻辑（组合式函数）。
  - `useMarkdown.js`：Markdown 渲染与代码块复制。
  - `useResizable.js`：侧边栏/编辑区/预览宽度拖拽。
  - `useSteps.js`：步骤数据与拖拽排序逻辑。
  - `useTerminal.js`：终端抽屉与 Local Runner 调用。
  - `useToast.js`：全局提示管理。
- `data/steps.js`：默认步骤数据。
- `styles/main.css`：全局样式 + Markdown/终端/代码块样式。
- `utils/`：小工具函数。
  - `clipboard.js`：复制文本。
  - `codeBlocks.js`：从 Markdown 提取 fenced code blocks。
  - `escapeHtml.js`：转义 HTML。
  - `prism.js`：Prism 语法高亮初始化。

## 目前未使用的模板文件

以下文件来自 Vite 模板，目前未被项目引用，如不需要可删除：

- `src/counter.ts`
- `src/main.ts`
- `src/style.css`
- `src/typescript.svg`