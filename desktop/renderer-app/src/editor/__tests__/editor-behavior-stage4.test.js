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
