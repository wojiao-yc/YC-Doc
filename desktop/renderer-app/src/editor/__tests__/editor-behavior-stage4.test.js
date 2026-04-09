import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(testDir, "..", "..");
const readSrc = (relativePath) => readFileSync(resolve(srcDir, relativePath), "utf8");

test("semantic parsing is configured with zero debounce to reduce transient style flicker", () => {
  const app = readSrc("App.vue");
  const semanticStore = readSrc("editor/state/semantic-store.js");
  assert.match(app, /parseDelayMs:\s*0/);
  assert.match(semanticStore, /if \(delay <= 0\)\s*\{\s*parseNow\(\);\s*return;\s*\}/);
});

test("markdown sidebar logic is rebuilt around H1 sections", () => {
  const markdownDoc = readSrc("composables/useMarkdownDocument.js");

  assert.match(markdownDoc, /HEADING_LINE_PATTERN/);
  assert.match(markdownDoc, /collectHeadingSections/);
  assert.match(markdownDoc, /serializeHeadingSections/);
  assert.match(markdownDoc, /sectionsToSteps/);
  assert.match(markdownDoc, /const addStep = async/);
  assert.match(markdownDoc, /const removeStep = async/);
  assert.match(markdownDoc, /const renameStepTitle = async/);
  assert.match(markdownDoc, /const moveStep = async/);
  assert.match(markdownDoc, /sections\.splice\(insertIndex,\s*0/);
});

test("external markdown updates still derive target focus id from parsed next steps", () => {
  const markdownDoc = readSrc("composables/useMarkdownDocument.js");

  assert.match(markdownDoc, /const targetSteps = Number\.isFinite\(focusIndex\) \? parseMarkdownToSteps\(normalized\) : null/);
  assert.match(markdownDoc, /currentId\.value = targetSteps\?\.\[safeIndex\]\?\.id/);
});

test("app sidebar uses explicit handlers for title editing and drag reorder", () => {
  const app = readSrc("App.vue");
  assert.match(app, /handleActiveStepTitleInput/);
  assert.match(app, /handleStepTitleInput/);
  assert.match(app, /onStepDragStart/);
  assert.match(app, /onStepDrop/);
  assert.match(app, /renameStepTitle/);
  assert.match(app, /moveStep/);
});

test("presentation hides markdown syntax by default and keeps active token source visible", () => {
  const presentation = readSrc("editor/extensions/presentation.js");

  assert.match(presentation, /HEADING_PREFIX_PATTERN/);
  assert.match(presentation, /INLINE_SYNTAX_TOKEN_TYPES/);
  assert.match(presentation, /pickActiveInlineSyntaxToken/);
  assert.match(presentation, /Decoration\.replace\(\{\}\)/);
  assert.match(presentation, /selectionSet/);
  assert.match(presentation, /blockKeepsSourceVisible/);
  assert.match(presentation, /isTokenRelatedToActiveToken/);
  assert.match(presentation, /AUTO_SOURCE_REVEAL_BLOCK_TYPES/);
  assert.doesNotMatch(presentation, /"math_block"\s*\]/);
});

test("presentation keeps tables in widget mode without block-level source toggles", () => {
  const presentation = readSrc("editor/extensions/presentation.js");

  assert.match(presentation, /SOURCE_VISIBLE_BLOCK_TYPES/);
  assert.match(presentation, /addListPrefixDecorationsForBlock/);
  assert.match(presentation, /addBlockquotePrefixDecorationsForBlock/);
  assert.match(presentation, /TableBlockWidget/);
  assert.match(presentation, /cm-table-widget/);
  assert.doesNotMatch(presentation, /toggleTableExpandEffect/);
  assert.doesNotMatch(presentation, /cm-table-widget-btn/);
});

test("image source toggle updates immediately and prunes stale expanded-image ids", () => {
  const presentation = readSrc("editor/extensions/presentation.js");

  assert.match(presentation, /updateHasEffect\(update,\s*toggleImageExpandEffect\)/);
  assert.match(presentation, /selectionChanged/);
  assert.match(presentation, /imageExpandChanged/);
  assert.match(presentation, /effect\.is\(setPresentationDataEffect\)/);
  assert.match(presentation, /validImageIds/);
  assert.match(presentation, /this\.decorations = this\.decorations\.map\(update\.changes\)/);
  assert.match(presentation, /btn\.textContent\s*=\s*this\.isExpanded/);
  assert.match(presentation, /btn\.className = "cm-image-widget-btn"/);
  assert.match(presentation, /const AUTO_SOURCE_REVEAL_BLOCK_TYPES = new Set\(\[\]\)/);
  assert.match(presentation, /if \(hideImageSourceLines\) \{\s*const mount = resolveInlineWidgetMountOutsideHiddenBlock/);
  assert.doesNotMatch(presentation, /isImageSourceAnchorLine/);
  assert.doesNotMatch(presentation, /sourceToggleTitle/);
});

test("editor theme exposes inline style classes used by hidden-syntax rendering", () => {
  const theme = readSrc("styles/editor-theme.css");

  assert.match(theme, /\.cm-inline-em/);
  assert.match(theme, /\.cm-inline-strong/);
  assert.match(theme, /\.cm-inline-link/);
});

test("image and math source code use token-level syntax highlight classes", () => {
  const presentation = readSrc("editor/extensions/presentation.js");
  const theme = readSrc("styles/editor-theme.css");

  assert.match(presentation, /addImageSourceSyntaxDecorationsForBlock/);
  assert.match(presentation, /addMathSourceSyntaxDecorationsForBlock/);
  assert.match(presentation, /cm-source-image-url/);
  assert.match(presentation, /cm-source-math-command/);

  assert.match(theme, /\.cm-source-image-delim/);
  assert.match(theme, /\.cm-source-image-alt/);
  assert.match(theme, /\.cm-source-image-url/);
  assert.match(theme, /\.cm-source-image-title/);
  assert.match(theme, /\.cm-source-math-delim/);
  assert.match(theme, /\.cm-source-math-command/);
  assert.match(theme, /\.cm-source-math-number/);
});

test("list and special-block styles include rendered widgets for hidden-source mode", () => {
  const lists = readSrc("styles/lists.css");
  const special = readSrc("styles/special-blocks.css");
  const presentation = readSrc("editor/extensions/presentation.js");

  assert.match(lists, /\.cm-list-prefix-widget/);
  assert.match(lists, /\.cm-task-checkbox-widget/);
  assert.match(lists, /text-decoration-line:\s*line-through/);
  assert.match(presentation, /TaskCheckboxWidget/);
  assert.match(presentation, /toggleTaskListStateAtLine/);
  assert.match(presentation, /data-task-toggle-from/);
  assert.match(special, /\.cm-table-widget/);
  assert.match(special, /\.cm-block-thematic-break\.cm-block-source-visible/);
  assert.doesNotMatch(presentation, /cm-table-widget-btn term-tip-btn/);
  assert.doesNotMatch(presentation, /cm-table-widget-col-handle term-tip-btn/);
  assert.doesNotMatch(presentation, /cm-table-widget-row-handle term-tip-btn/);
});

test("preview markdown keeps code-copy buttons and unified selection styling for tables and code blocks", () => {
  const renderer = readSrc("utils/render-markdown.js");
  const mainCss = readSrc("styles/main.css");

  assert.match(renderer, /md-code-copy-btn/);
  assert.match(renderer, /data-copy-code/);
  assert.match(renderer, /renderAppIconSvgMarkup\("copy", "md-code-copy-icon-svg"\)/);
  assert.match(mainCss, /\.markdown-render \.md-code-copy-btn \{/);
  assert.match(mainCss, /\.markdown-render \.md-code-copy-btn \.md-code-copy-icon-svg \{/);
  assert.match(mainCss, /z-index:\s*1/);
  assert.match(mainCss, /user-select:\s*none/);
  assert.match(mainCss, /\.markdown-render::selection/);
  assert.match(mainCss, /\.markdown-render \*::selection/);
  assert.match(mainCss, /background-color:\s*transparent/);
});

test("math widgets only use the explicit toggle button and no longer auto-open source below", () => {
  const presentation = readSrc("editor/extensions/presentation.js");

  assert.match(presentation, /resolveMathBlockRangeById/);
  assert.match(presentation, /effects:\s*toggleMathExpandEffect\.of\(blockId\)/);
  assert.match(presentation, /cursorOutsideRange/);
  assert.doesNotMatch(presentation, /mathWidget && !target\.closest\("\.cm-math-widget-btn"\)/);
});

test("editor code blocks expose a copy button and explicit selection styling", () => {
  const core = readSrc("editor/extensions/core.js");
  const presentation = readSrc("editor/extensions/presentation.js");
  const codeBlockCss = readSrc("styles/code-block.css");
  const themeCss = readSrc("styles/editor-theme.css");

  assert.doesNotMatch(core, /drawSelection/);
  assert.match(presentation, /CodeBlockCopyWidget/);
  assert.match(presentation, /createAppIconSvgElement\("copy", "cm-code-block-copy-icon-svg"\)/);
  assert.match(presentation, /cm-code-block-copy-btn/);
  assert.match(presentation, /resolveCodeBlockRangeById/);
  assert.match(presentation, /extractCodeBlockContent/);
  assert.match(presentation, /copyText\(codeText\)/);
  assert.match(presentation, /cm-table-widget-cell-content/);
  assert.match(codeBlockCss, /\.yc-editor-host \.cm-code-block-copy-btn \{/);
  assert.match(codeBlockCss, /\.yc-editor-host \.cm-code-block-copy-btn \.cm-code-block-copy-icon-svg \{/);
  assert.match(themeCss, /\.yc-editor-host \.cm-content::selection/);
  assert.match(themeCss, /\.yc-editor-host \.cm-content \*::selection/);
});

test("table cells switch to markdown source text on focus without restoring block-level source toggle", () => {
  const presentation = readSrc("editor/extensions/presentation.js");

  assert.match(presentation, /renderTableCellEditorFromMarkdown/);
  assert.match(presentation, /enterTableCellEditorSourceMode/);
  assert.match(presentation, /cellEditor\.addEventListener\("focus",/);
  assert.match(presentation, /data-table-source-mode/);
  assert.doesNotMatch(presentation, /cm-table-widget-btn/);
});

test("table cells keep native clipboard shortcuts local and expose table-aware clipboard commands", () => {
  const presentation = readSrc("editor/extensions/presentation.js");
  const menuExtension = readSrc("editor/extensions/context-menu.js");

  assert.match(presentation, /isPlainTableClipboardShortcutEvent/);
  assert.match(presentation, /cellEditor\.addEventListener\("copy", stopBubble\)/);
  assert.match(presentation, /const insertPlainTextIntoTableCellEditor =/);
  assert.match(presentation, /event\.clipboardData\?\.getData\("text\/plain"\)/);

  assert.match(menuExtension, /const TABLE_CELL_FORMAT_COMMAND_IDS = new Set\(\[/);
  assert.match(menuExtension, /surroundTableCellSelectionWithText\(editableCell, "\*\*", "\*\*"\)/);
  assert.match(menuExtension, /buildExternalLinkTemplate/);
  assert.match(menuExtension, /const commandTableCellPaste = async/);
  assert.match(menuExtension, /tableContext\?\.editableCell\) \{\s*if \(normalizedCommandId === "clipboard-cut"/);
  assert.match(menuExtension, /item\?\.id !== "paragraph" && item\?\.id !== "insert"/);
});

test("editor chrome tabs hide vertical overflow to avoid a right-edge scrollbar stub", () => {
  const mainCss = readSrc("styles/main.css");

  assert.match(mainCss, /\.editor-chrome-tabs-wrap\s*\{[\s\S]*overflow-y:\s*hidden;/);
  assert.match(mainCss, /\.editor-chrome-tabs\s*\{[\s\S]*overflow-y:\s*hidden;/);
});

test("editor includes custom right-click context menu extension with grouped commands", () => {
  const createEditor = readSrc("editor/core/create-editor.js");
  const menuExtension = readSrc("editor/extensions/context-menu.js");

  assert.match(createEditor, /contextMenuExtensions/);
  assert.match(createEditor, /\.\.\.contextMenuExtensions/);

  assert.match(menuExtension, /id:\s*"add-link"/);
  assert.match(menuExtension, /commandInsertWikiLink/);
  assert.match(menuExtension, /commandInsertExternalLink/);
  assert.match(menuExtension, /buildExternalLinkTemplate/);
  assert.match(menuExtension, /DEFAULT_EXTERNAL_LINK_LABEL/);
  assert.match(menuExtension, /\[\[\$\{linkText\}\]\]/);
  assert.match(menuExtension, /id:\s*"format"/);
  assert.match(menuExtension, /id:\s*"paragraph"/);
  assert.match(menuExtension, /id:\s*"insert"/);
  assert.match(menuExtension, /clipboard-cut/);
  assert.match(menuExtension, /select-all/);
});

test("keyboard activation and special-block navigation are wired through the editor", () => {
  const createEditor = readSrc("editor/core/create-editor.js");
  const shell = readSrc("editor/EditorShell.vue");
  const app = readSrc("App.vue");
  const linkEvents = readSrc("editor/extensions/wikilink-events.js");
  const presentation = readSrc("editor/extensions/presentation.js");
  const autocomplete = readSrc("editor/extensions/wikilink-autocomplete.js");
  const theme = readSrc("styles/editor-theme.css");

  assert.match(createEditor, /onExternalLinkActivate/);
  assert.match(shell, /external-link-activate/);
  assert.match(app, /@external-link-activate="handleEditorExternalLinkActivate"/);
  assert.match(app, /mode === "block"/);
  assert.match(app, /getNoteTextBlocksForRelPath/);
  assert.match(app, /meta:\s*`L\$\{lineStart\}`/);
  assert.match(app, /Number\(left\.lineStart \|\| 0\) - Number\(right\.lineStart \|\| 0\)/);
  assert.match(linkEvents, /resolveEditorLinkActivation/);
  assert.match(linkEvents, /source:\s*"editor-keyboard"/);
  assert.match(linkEvents, /event\.key !== "Enter"/);
  assert.match(autocomplete, /WIKI_LINK_MENU_HINTS/);
  assert.match(autocomplete, /renderAutocompleteItemHtml/);
  assert.match(autocomplete, /shouldShowFileSuggestionsForContext/);
  assert.match(autocomplete, /Boolean\(trigger\?\.docChanged\)/);
  assert.match(autocomplete, /yc-wikilink-autocomplete-list/);
  assert.match(autocomplete, /ensureSelectedItemVisible/);
  assert.match(autocomplete, /positionPanel\(coords\)/);
  assert.match(autocomplete, /window\.innerHeight/);
  assert.match(autocomplete, /this\.panel\.style\.maxHeight/);
  assert.match(autocomplete, /this\.list\.style\.maxHeight/);
  assert.match(autocomplete, /fitsBelow/);
  assert.match(autocomplete, /fitsAbove/);
  assert.match(autocomplete, /scrollIntoView\(\{\s*block:\s*"nearest"/);
  assert.doesNotMatch(autocomplete, /MAX_ITEMS/);
  assert.match(autocomplete, /yc-wikilink-autocomplete-meta/);
  assert.match(autocomplete, /yc-wikilink-autocomplete-footer/);
  assert.match(theme, /max-height:\s*min\(72vh,\s*720px\)/);
  assert.match(theme, /\.yc-wikilink-autocomplete-list/);
  assert.match(theme, /flex:\s*0 0 auto/);
  assert.match(theme, /scrollbar-gutter:\s*stable/);
  assert.match(theme, /overflow-y:\s*auto/);
  assert.match(theme, /white-space:\s*nowrap/);
  assert.doesNotMatch(autocomplete, /fullQuery\.trim/);
  assert.match(presentation, /handleSpecialBlockVerticalNavigation/);
  assert.match(presentation, /focusTableBlockCellEditor/);
  assert.match(presentation, /isPlainTableVerticalArrowEvent/);
  assert.match(presentation, /moveTableCellEditorVerticalFocus/);
  assert.match(presentation, /event\.key !== "ArrowUp" && event\.key !== "ArrowDown"/);
});

test("workspace graph view is wired through app state, graph data, and force-layout rendering", () => {
  const app = readSrc("App.vue");
  const graphView = readSrc("components/WorkspaceLinkGraph.vue");
  const graphUtil = readSrc("utils/workspace-link-graph.js");

  assert.match(app, /WorkspaceLinkGraph/);
  assert.match(app, /workspaceGraphOpen/);
  assert.match(app, /workspaceGraphData/);
  assert.match(app, /openWorkspaceGraph/);
  assert.match(app, /handleWorkspaceGraphOpenNote/);
  assert.match(app, /buildWorkspaceLinkGraph/);
  assert.match(app, /@open-note="handleWorkspaceGraphOpenNote"/);

  assert.match(graphUtil, /extractWorkspaceTags/);
  assert.match(graphUtil, /backlinksCount/);
  assert.match(graphUtil, /folderKey/);
  assert.match(graphUtil, /primaryTag/);

  assert.match(graphView, /requestAnimationFrame/);
  assert.match(graphView, /handleNodePointerDown/);
  assert.match(graphView, /handleWheel/);
  assert.match(graphView, /hoveredNodeId/);
  assert.match(graphView, /marker-end/);
  assert.match(graphView, /:viewBox="svgViewBox"/);
  assert.match(graphView, /const svgViewBox = computed/);
  assert.match(graphView, /graphTransform/);
});
