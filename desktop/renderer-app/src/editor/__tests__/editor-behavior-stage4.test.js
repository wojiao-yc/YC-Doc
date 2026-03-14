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
  assert.match(app, /parseDelayMs:\s*0/);
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
});

test("presentation also supports block-level markdown rendering and source reveal", () => {
  const presentation = readSrc("editor/extensions/presentation.js");

  assert.match(presentation, /SOURCE_VISIBLE_BLOCK_TYPES/);
  assert.match(presentation, /addListPrefixDecorationsForBlock/);
  assert.match(presentation, /addBlockquotePrefixDecorationsForBlock/);
  assert.match(presentation, /addTablePreviewDecorationForBlock/);
  assert.match(presentation, /MarkdownTableWidget/);
  assert.match(presentation, /cm-table-widget/);
});

test("editor theme exposes inline style classes used by hidden-syntax rendering", () => {
  const theme = readSrc("styles/editor-theme.css");

  assert.match(theme, /\.cm-inline-em/);
  assert.match(theme, /\.cm-inline-strong/);
  assert.match(theme, /\.cm-inline-link/);
});

test("list and special-block styles include rendered widgets for hidden-source mode", () => {
  const lists = readSrc("styles/lists.css");
  const special = readSrc("styles/special-blocks.css");

  assert.match(lists, /\.cm-list-prefix-widget/);
  assert.match(special, /\.cm-table-widget/);
  assert.match(special, /\.cm-block-thematic-break\.cm-block-source-visible/);
});
