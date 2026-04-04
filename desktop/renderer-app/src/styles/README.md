# Styles Guide

This directory now follows one rule:

1. `styles/` defines structure and selector ownership.
2. `themes/` defines the visual result through CSS variables.

If you want to change how something looks, prefer editing a theme file first.

## Load Order

Imported by [main.js](/d:/python/project/Homepage/YC-Doc/desktop/renderer-app/src/main.js) in this order:

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

Later files can override earlier files.

## File Ownership

`main.css`
- App shell, tabs, sidebars, terminal, preview markdown, settings window, toasts.

`editor.css`
- Minimal editor host baseline.

`document-layout.css`
- Editor canvas spacing and document layout.

`typography.css`
- Editor body typography structure.

`headings.css`
- Heading selectors and heading-level structure.

`lists.css`
- Bullet, ordered, and task list structure.

`blockquote.css`
- Blockquote and callout structure.

`code-block.css`
- Code block structure.

`special-blocks.css`
- Thematic break, image/math/table widgets, special block wrappers.

`editor-theme.css`
- Editor interaction tokens: selection, inline marks, wikilinks, autocomplete.

`editor-context-menu.css`
- Editor right-click menu layout.

`editor-context-menu-icons.css`
- Icon glyph mapping for context menu items.

## Syntax Map

Editor paragraph
- `typography.css`
- `.cm-block-paragraph`

Editor headings
- `headings.css`
- `.cm-block-heading-*`

Editor lists and task lists
- `lists.css`
- `.cm-block-bullet-list-item`
- `.cm-block-ordered-list-item`
- `.cm-block-task-list-item`

Editor blockquotes and callouts
- `blockquote.css`
- `.cm-block-blockquote`
- `.cm-block-callout-*`

Editor code blocks
- `code-block.css`
- `.cm-block-code-block`

Editor thematic break
- `special-blocks.css`
- `.cm-block-thematic-break`

Editor images
- `special-blocks.css`
- `.cm-block-image`
- `.cm-image-widget*`

Editor math
- `special-blocks.css`
- `.cm-block-math-block`
- `.cm-inline-math-widget`
- `.cm-math-widget*`

Editor tables
- `special-blocks.css`
- `.cm-table-widget*`

Preview markdown
- `main.css`
- `.markdown-render`

Inline syntax tokens
- `editor-theme.css`
- `.cm-inline-*`
- `.cm-source-*`
- `.cm-wiki-link*`

## Theme-First Variables

These are expected to live in `themes/*/index.css`.

Typography
- `--yc-font-ui`
- `--yc-font-body`
- `--yc-font-heading`
- `--yc-font-code`
- `--yc-font-mono`
- `--yc-font-widget-mono`
- `--yc-font-checkbox`
- `--yc-doc-font-size`
- `--yc-doc-line-height`
- `--yc-preview-font-size`
- `--yc-preview-line-height`

Headings
- `--yc-heading-color`
- `--yc-heading-font-weight`
- `--yc-heading-letter-spacing`
- `--yc-heading-l1-size`
- `--yc-heading-l1-line-height`
- `--yc-heading-l2-size`
- `--yc-heading-l2-line-height`
- `--yc-heading-l3-size`
- `--yc-heading-l3-line-height`
- `--yc-heading-l4-size`
- `--yc-heading-l4-line-height`
- `--yc-heading-l5-size`
- `--yc-heading-l5-line-height`
- `--yc-heading-l5-weight`
- `--yc-heading-l6-size`
- `--yc-heading-l6-line-height`
- `--yc-heading-l6-weight`

Blockquote and callout
- `--yc-blockquote-accent`
- `--yc-blockquote-color`
- `--yc-callout-note-bg`
- `--yc-callout-note-border`
- `--yc-callout-note-title`
- `--yc-callout-note-body`
- `--yc-callout-tip-bg`
- `--yc-callout-tip-border`
- `--yc-callout-tip-title`
- `--yc-callout-warning-bg`
- `--yc-callout-warning-border`
- `--yc-callout-warning-title`
- `--yc-callout-danger-bg`
- `--yc-callout-danger-border`
- `--yc-callout-danger-title`

Code
- `--yc-code-block-font-size`
- `--yc-code-block-line-height`
- `--yc-code-block-color`
- `--yc-code-block-bg`
- `--yc-code-block-radius`
- `--yc-preview-code-inline-radius`
- `--yc-preview-code-inline-padding`
- `--yc-preview-code-inline-bg`
- `--yc-preview-code-inline-color`
- `--yc-preview-code-block-radius`
- `--yc-preview-code-block-padding`

Preview links and tasks
- `--yc-preview-image-radius`
- `--yc-preview-task-offset-y`
- `--yc-preview-task-check-size`
- `--yc-preview-task-gap`
- `--yc-preview-task-border-width`
- `--yc-preview-task-radius`
- `--yc-preview-link-radius`
- `--yc-preview-link-padding`
- `--yc-preview-link-hover-mix`
- `--yc-preview-link-hover-mix-dark`

Special blocks
- `--yc-thematic-break-gradient`
- `--yc-thematic-break-line-height`
- `--yc-special-block-border`
- `--yc-special-block-bg`

Images
- `--yc-image-widget-radius`
- `--yc-image-widget-shadow`
- `--yc-image-widget-shadow-hover`
- `--yc-image-widget-toolbar-bg`
- `--yc-image-widget-toolbar-bg-hover`
- `--yc-image-widget-toolbar-text`
- `--yc-image-resize-handle-color`
- `--yc-image-error-text`
- `--yc-image-error-bg`

Math
- `--yc-math-widget-outline`
- `--yc-math-widget-btn-color`
- `--yc-math-widget-btn-bg`
- `--yc-math-widget-btn-bg-hover`
- `--yc-math-fallback-color`

Tables
- `--yc-table-highlight-color`
- `--yc-table-highlight-bg`
- `--yc-table-highlight-bg-strong`
- `--yc-table-border`
- `--yc-table-head-bg`
- `--yc-table-code-bg`
- `--yc-table-code-shadow`
- `--yc-table-mark-bg`
- `--yc-table-mark-shadow`
- `--yc-table-link`
- `--yc-table-handle-color`
- `--yc-table-handle-active`
- `--yc-table-edge-btn-bg`
- `--yc-table-edge-btn-bg-hover`
- `--yc-table-edge-btn-color`
- `--yc-table-edge-btn-active`

Shell and meta UI
- `--yc-toast-bg`
- `--yc-toast-text`
- `--yc-toast-shadow`
- `--yc-header-title-color`
- `--yc-header-sub-color`
- `--yc-header-dot-color`
- `--yc-header-page-bg`
- `--yc-header-page-border`
- `--yc-header-page-text`
- `--yc-header-input-bg`
- `--yc-header-input-border`
- `--yc-header-input-text`
- `--yc-header-input-focus-border`
- `--yc-header-input-focus-shadow`

## What Still Belongs In JS

These are runtime-calculated and should stay in JS:

- Context menu screen position
- Drag/drop insertion caret position
- Table drag indicator geometry
- Resizable panel widths and split ratios
- Temporary `user-select` locking during drag
- Inline widget width values like `--yc-image-width`

## How To Create A New Theme

1. Add a folder under `src/themes/<theme-id>/index.css`
2. Scope variables with `#app[data-theme="<theme-id>"]`
3. Add theme metadata in `src/themes/<theme-id>/meta.js`
4. Theme stylesheets are auto-loaded from `src/themes/*/index.css`

Minimal example:

```css
#app[data-theme="my-theme"] {
  --yc-font-body: "IBM Plex Serif", serif;
  --yc-heading-color: #1f2937;
  --yc-code-block-bg: #f7f3ea;
  --yc-table-highlight-color: #b45309;
}
```
