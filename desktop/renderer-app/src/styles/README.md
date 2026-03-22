# Styles 目录说明

本文档用于说明 `desktop/renderer-app/src/styles` 下每个样式文件的职责，以及哪些样式仍然由 JS 在运行时动态计算。

## 1. 样式加载顺序（覆盖优先级）

样式由 `src/main.js` 按以下顺序引入，后引入文件会覆盖前面的同权重规则：

1. `main.css`
2. `editor.css`
3. `document-layout.css`
4. `typography.css`
5. `headings.css`
6. `lists.css`
7. `blockquote.css`
8. `code-block.css`
9. `special-blocks.css`
10. `editor-theme.css`
11. `editor-context-menu.css`
12. `editor-context-menu-icons.css`

## 2. 每个样式文件负责什么

| 文件 | 主要作用 | 关键选择器/变量 |
| --- | --- | --- |
| `main.css` | 应用壳层与非编辑器区域样式（窗口栏、侧栏、终端、弹层、暗色模式等） | `.app-chrome-*`、`.sidebar-*`、`.term-*`、`.runner-*`、`.dark-ui *` |
| `editor.css` | 编辑器宿主的最基础透明背景兜底 | `.yc-editor-shell`、`.yc-editor-host .cm-editor` |
| `document-layout.css` | 文档画布布局、内边距、背景渐变 | `:root --yc-doc-*`、`.yc-editor-shell`、`.yc-editor-shell::before` |
| `typography.css` | 正文字体、字号、行高、光标色、段落间距 | `.cm-scroller`、`.cm-content`、`.cm-block-paragraph` |
| `headings.css` | H1~H6 标题排版 | `.cm-block-heading-l1` ~ `.cm-block-heading-l6` |
| `lists.css` | 无序/有序/任务列表、层级缩进、任务框 | `--yc-list-level`、`.cm-task-checkbox-widget` |
| `blockquote.css` | 引用块与 callout 提示块 | `.cm-block-blockquote`、`.cm-block-callout-*` |
| `code-block.css` | 代码块字体、背景、圆角、当前块视觉 | `.cm-block-code-block` |
| `special-blocks.css` | 分割线、图片块、数学块、表格块、源代码折叠态、拖拽/高亮/插入手柄 | `.cm-image-widget*`、`.cm-math-widget*`、`.cm-table-widget*` |
| `editor-theme.css` | 编辑器交互主题（选区、光标、搜索命中、行高亮、行内格式 token） | `.cm-selectionBackground`、`.cm-inline-*`、`.cm-source-*` |
| `editor-context-menu.css` | 编辑器右键菜单容器、项、分割线、暗色模式 | `.yc-editor-context-*` |
| `editor-context-menu-icons.css` | 右键菜单图标映射（可自由替换） | `.yc-editor-context-icon[data-icon-id="..."]::before` |

## 3. 文章内容语法块 -> 对应样式

| 文章元素/语法 | 对应样式文件 | 关键类名 |
| --- | --- | --- |
| 普通段落 | `typography.css` | `.cm-block-paragraph` |
| 标题（# ~ ######） | `headings.css` | `.cm-block-heading-*` |
| 列表/任务列表 | `lists.css` | `.cm-block-bullet-list-item`、`.cm-block-task-list-item` |
| 引用/Callout | `blockquote.css` | `.cm-block-blockquote`、`.cm-block-callout-*` |
| 代码块 | `code-block.css` | `.cm-block-code-block` |
| 分割线 | `special-blocks.css` | `.cm-block-thematic-break` |
| 图片块 | `special-blocks.css` | `.cm-block-image`、`.cm-image-widget*` |
| 数学块/行内数学 | `special-blocks.css` | `.cm-block-math-block`、`.cm-inline-math-widget` |
| 表格块 | `special-blocks.css` | `.cm-table-widget*` |
| 表格内文本格式（粗体/斜体/删除线/代码/高亮/上下标/链接） | `special-blocks.css` | `.cm-table-widget-cell-editor strong/em/del/code/mark/sup/sub/a` |
| 行内格式 token（链接/高亮/注释/删除线/行内代码等） | `editor-theme.css` | `.cm-inline-link`、`.cm-inline-mark`、`.cm-inline-comment`、`.cm-inline-codespan` |

## 4. 可直接调的核心变量

建议优先改变量，不改结构类名。

### 4.1 文档布局变量（`document-layout.css`）

- `--yc-doc-side-padding`
- `--yc-doc-top-padding`
- `--yc-doc-bottom-padding`
- `--yc-doc-bg-light`
- `--yc-doc-bg-dark`

### 4.2 表格变量（`special-blocks.css`，`.cm-table-widget`）

- `--yc-table-gutter-top/right/bottom/left`：表格四边手柄与留白
- `--yc-table-highlight-color`：行列拖拽与选中高亮主色
- `--yc-table-highlight-bg`：行列高亮背景
- `--yc-table-highlight-radius`：高亮圆角

### 4.3 图片变量（`special-blocks.css` + JS 动态注入）

- `--yc-image-width`：图片展示宽度（由 `presentation.js` 在每个图片 widget 上设置）

### 4.4 交互过渡变量（`editor-theme.css`）

- `--yc-block-transition-duration`：块高亮/颜色过渡时长

## 5. 仍在 JS 里动态计算的样式（必须运行时）

以下项目不是“写死视觉值”，而是跟鼠标坐标/布局尺寸/拖拽状态绑定，无法完全静态放进 CSS：

| 位置 | 动态项 | 说明 |
| --- | --- | --- |
| `editor/extensions/context-menu.js` | 右键菜单与子菜单 `left/top` | 由鼠标位置与视口边界实时计算 |
| `editor/extensions/presentation.js` | 表格拖拽落点指示器 `left/top/width/height` | 由拖拽目标实时计算 |
| `editor/extensions/presentation.js` | `document.body.style.userSelect` | 拖拽过程中临时禁选，结束恢复 |
| `App.vue`、`composables/useResizable.js` | 面板宽度/分割比例/菜单定位等 `:style` | 这些是状态驱动布局，不是固定视觉 token |

## 6. 已迁移到 CSS 可控的项（本次整理）

1. 表格对齐：从 `th/td.style.textAlign` 改为 `data-table-align + CSS`，可在 `special-blocks.css` 统一改。
2. 图片错误隐藏：从 `img.style.display = "none"` 改为 `is-image-error` 类控制。
3. 块行过渡：从 `EditorView.baseTheme` 内联样式改到 `editor-theme.css`。
4. 图片宽度：通过 `--yc-image-width` 变量承接，样式层可统一控制表现。

## 7. 右键菜单图标如何改

仅需改 `editor-context-menu-icons.css`：

```css
.yc-editor-context-icon[data-icon-id="table-row-insert-above"]::before {
  content: "↑";
}
```

你可以继续使用字符、符号、或替换成你自己的图标字体映射。

## 8. 新增样式文件注意事项

1. 文件放在 `src/styles/`。
2. 在 `src/main.js` 中 `import "./styles/你的文件.css";`。
3. 若需要覆盖已有规则，放在被覆盖文件之后引入。
