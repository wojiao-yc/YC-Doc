# YC-Doc Stage 1 Baseline

本项目当前定位是桌面 Markdown 写作器，阶段一目标是先做稳定地基，不追求完整所见即所得。

## Stage 1 技术选型（已落地）

- 运行形态: Electron 桌面版
- 前端框架: Vite + Vue 3
- 编辑器内核: CodeMirror 6
- Markdown 真源: `documentMarkdown` 字符串
- 状态组织: Vue composables（`useMarkdownDocument` 等轻量方案）
- 文件读写: Electron preload 暴露的 `desktopDataBridge`

## Stage 1 核心结构（编辑器相关）

- `desktop/renderer-app/src/editor/core/`: `EditorState` / `EditorView` / `createMarkdownEditor`
- `desktop/renderer-app/src/editor/extensions/`: core keymap、history、markdown、theme
- `desktop/renderer-app/src/editor/EditorShell.vue`: 编辑器组件壳
- `desktop/renderer-app/src/composables/useMarkdownDocument.js`: 文档真源状态与保存流程

## 阶段一清单对照

- [x] 项目骨架稳定（Electron + Vue + renderer workspace）
- [x] CodeMirror 核心实例封装（创建、更新文档、销毁）
- [x] Markdown 语言支持、基础 keymap、history
- [x] 文档真源状态: 当前 Markdown、当前文件路径、dirty、上次保存内容
- [x] 文档状态: 上次保存时间（`lastSavedAt`）与保存状态（`saveStatus`）
- [x] 自动保存（500ms debounce + dirty 检查）
- [x] 保存失败提示（toast）
- [x] 保存成功提示（手动保存和状态条反馈）
- [x] Ctrl/Cmd + S 手动保存快捷键
- [x] Electron 文件能力（新建/打开/写入）
- [x] 写作向基础布局（单栏、宽度限制、行高字号）
- [x] 撤销/重做、复制粘贴、全选、光标移动（依赖 CodeMirror）
- [x] 查找能力（Ctrl/Cmd + F，CodeMirror Search Panel）
- [ ] 重启后恢复同一文档（需要显式验收测试）

## 当前遗漏（优先级）

1. 重启恢复同一文档的自动化或手动验收记录。

## 开发与构建

在 `desktop` 目录执行:

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
npm install
npm run dev
```

仅构建渲染层:

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
npm run build -w renderer-app
```

打包桌面应用:

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
npm run pack:win
```
