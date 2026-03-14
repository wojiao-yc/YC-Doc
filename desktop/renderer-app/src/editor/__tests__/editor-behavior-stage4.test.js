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

test("addStep treats non-empty markdown as appendable even when parsed as a single blank step", () => {
  const markdownDoc = readSrc("composables/useMarkdownDocument.js");

  assert.match(markdownDoc, /hasNonWhitespaceMarkdown/);
  assert.match(
    markdownDoc,
    /isSingleBlankStepList\(list\)\s*&&\s*!hasNonWhitespaceMarkdown\(sourceMarkdown\)/
  );
});

test("addStep has a forced append fallback when step count does not grow", () => {
  const markdownDoc = readSrc("composables/useMarkdownDocument.js");

  assert.match(markdownDoc, /appendHeadingStep/);
  assert.match(markdownDoc, /nextParsed\.length <= list\.length/);
  assert.match(markdownDoc, /const forcedMarkdown = appendHeadingStep/);
  assert.match(markdownDoc, /await applyExternalMarkdownChange\(forcedMarkdown/);
});

test("external markdown updates derive target focus id from parsed next steps", () => {
  const markdownDoc = readSrc("composables/useMarkdownDocument.js");

  assert.match(markdownDoc, /const targetSteps = Number\.isFinite\(focusIndex\) \? parseMarkdownToSteps\(normalized\) : null/);
  assert.match(markdownDoc, /currentId\.value = targetSteps\?\.\[safeIndex\]\?\.id/);
});

test("pending markdown-sync flag is not cleared by a standalone currentId watcher", () => {
  const markdownDoc = readSrc("composables/useMarkdownDocument.js");
  assert.doesNotMatch(markdownDoc, /watch\(currentId/);
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
