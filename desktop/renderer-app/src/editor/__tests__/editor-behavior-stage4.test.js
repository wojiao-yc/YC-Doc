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
});

test("presentation also supports block-level markdown rendering and source reveal", () => {
  const presentation = readSrc("editor/extensions/presentation.js");

  assert.match(presentation, /SOURCE_VISIBLE_BLOCK_TYPES/);
  assert.match(presentation, /addListPrefixDecorationsForBlock/);
  assert.match(presentation, /addBlockquotePrefixDecorationsForBlock/);
  assert.match(presentation, /TableBlockWidget/);
  assert.match(presentation, /toggleTableExpandEffect/);
  assert.match(presentation, /cm-table-widget/);
});

test("image source toggle updates immediately and prunes stale expanded-image ids", () => {
  const presentation = readSrc("editor/extensions/presentation.js");

  assert.match(presentation, /updateHasEffect\(update,\s*toggleImageExpandEffect\)/);
  assert.match(presentation, /selectionChanged/);
  assert.match(presentation, /imageExpandChanged/);
  assert.match(presentation, /effect\.is\(setPresentationDataEffect\)/);
  assert.match(presentation, /validImageIds/);
  assert.match(presentation, /this\.blocks = \[\]/);
  assert.match(presentation, /btn\.textContent\s*=\s*this\.isExpanded/);
  assert.match(presentation, /btn\.setAttribute\(\"title\"/);
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
});

test("editor includes custom right-click context menu extension with grouped commands", () => {
  const createEditor = readSrc("editor/core/create-editor.js");
  const menuExtension = readSrc("editor/extensions/context-menu.js");

  assert.match(createEditor, /contextMenuExtensions/);
  assert.match(createEditor, /\.\.\.contextMenuExtensions/);

  assert.match(menuExtension, /id:\s*"add-link"/);
  assert.match(menuExtension, /commandInsertWikiLink/);
  assert.match(menuExtension, /commandInsertExternalLink/);
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

  assert.match(createEditor, /onExternalLinkActivate/);
  assert.match(shell, /external-link-activate/);
  assert.match(app, /@external-link-activate="handleEditorExternalLinkActivate"/);
  assert.match(app, /mode === "block"/);
  assert.match(app, /getNoteTextBlocksForRelPath/);
  assert.match(linkEvents, /resolveEditorLinkActivation/);
  assert.match(linkEvents, /source:\s*"editor-keyboard"/);
  assert.match(linkEvents, /event\.key !== "Enter"/);
  assert.match(autocomplete, /WIKI_LINK_MENU_HINTS/);
  assert.match(autocomplete, /yc-wikilink-autocomplete-footer/);
  assert.match(presentation, /handleSpecialBlockVerticalNavigation/);
  assert.match(presentation, /focusTableBlockCellEditor/);
  assert.match(presentation, /isPlainTableVerticalArrowEvent/);
  assert.match(presentation, /moveTableCellEditorVerticalFocus/);
  assert.match(presentation, /event\.key !== "ArrowUp" && event\.key !== "ArrowDown"/);
});
