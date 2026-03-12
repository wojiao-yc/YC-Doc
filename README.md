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

## Stage 2 语义快照（进行中）

目标: 建立 Markdown 真源到块级语义的统一快照层，供 current block、outline、后续 widget/行为规则复用。

### 已落地模块

- `desktop/renderer-app/src/editor/model/block-types.js`
- `desktop/renderer-app/src/editor/model/block-node.js`
- `desktop/renderer-app/src/editor/model/outline-node.js`
- `desktop/renderer-app/src/editor/model/semantic-snapshot.js`
- `desktop/renderer-app/src/editor/parser/parse-markdown.js`
- `desktop/renderer-app/src/editor/parser/parse-blocks.js`
- `desktop/renderer-app/src/editor/parser/parse-heading.js`
- `desktop/renderer-app/src/editor/parser/parse-list.js`
- `desktop/renderer-app/src/editor/parser/parse-image.js`
- `desktop/renderer-app/src/editor/parser/parse-code-block.js`
- `desktop/renderer-app/src/editor/parser/parse-math-block.js`
- `desktop/renderer-app/src/editor/runtime/block-index.js`
- `desktop/renderer-app/src/editor/runtime/current-block.js`
- `desktop/renderer-app/src/editor/runtime/outline.js`
- `desktop/renderer-app/src/editor/state/semantic-store.js`

### 当前能力（Stage 2 第一版）

- [x] 块类型系统与块节点结构（含 `from/to`、`lineStart/lineEnd`、`attrs`）
- [x] 统一解析入口 `parseMarkdownToSemanticSnapshot(markdown)`
- [x] 块级语义识别（paragraph / heading / list item / blockquote / code block / image / math block / thematic break / table / html block）
- [x] outline 提取（heading level + text + range）
- [x] current block lookup（基于 selection anchor）
- [x] 文本变更触发语义快照更新（debounce）
- [x] 选区变化触发 current block 更新（不重复全文 parse）

### 待继续增强

- [ ] 更严格的 CommonMark/GFM 一致性（当前为工程化第一版解析器）
- [ ] 嵌套 list / blockquote 的树形 children 构建（当前以平铺 blocks 为主）
- [ ] 大文档增量解析优化（当前为全量 parse + debounce）
- [ ] 阶段三行为规则（Enter/Backspace/Tab）接入语义层

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
