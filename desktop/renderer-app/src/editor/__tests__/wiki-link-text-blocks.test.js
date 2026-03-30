import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEncodedWikiLinkBlockRef,
  collectWikiLinkTextBlocks,
  findWikiLinkTextBlockByReference,
  isEncodedWikiLinkBlockRef
} from "../../utils/wiki-link-text-blocks.js";
import { extractHeadingsFromMarkdown } from "../../utils/heading-slug.js";

test("buildEncodedWikiLinkBlockRef returns stable compact block tokens", () => {
  const first = buildEncodedWikiLinkBlockRef("Paragraph example");
  const duplicate = buildEncodedWikiLinkBlockRef("Paragraph example", 1);

  assert.match(first, /^b-[0-9a-z]{6,}$/);
  assert.match(duplicate, /^b-[0-9a-z]{6,}-2$/);
  assert.equal(isEncodedWikiLinkBlockRef(first), true);
});

test("collectWikiLinkTextBlocks scopes text blocks under a heading and keeps encoded refs", () => {
  const markdown = [
    "# Title",
    "",
    "Alpha paragraph",
    "",
    "## Child",
    "",
    "Beta paragraph",
    "",
    "## Sibling",
    "",
    "Alpha paragraph"
  ].join("\n");
  const headings = extractHeadingsFromMarkdown(markdown);
  const scoped = collectWikiLinkTextBlocks(markdown, {
    headings,
    anchor: "Child"
  });

  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.text, "Beta paragraph");
  assert.equal(isEncodedWikiLinkBlockRef(scoped[0]?.refToken), true);
});

test("findWikiLinkTextBlockByReference resolves encoded refs within a heading scope", () => {
  const markdown = [
    "# Title",
    "",
    "Alpha paragraph",
    "",
    "## Child",
    "",
    "Beta paragraph",
    "",
    "Gamma paragraph"
  ].join("\n");
  const headings = extractHeadingsFromMarkdown(markdown);
  const childBlocks = collectWikiLinkTextBlocks(markdown, {
    headings,
    anchor: "Child"
  });
  const targetRef = String(childBlocks[0]?.refToken || "");
  const targetBlock = findWikiLinkTextBlockByReference(markdown, {
    headings,
    anchor: "Child",
    blockRef: targetRef
  });

  assert.equal(targetBlock?.rawText?.trim(), "Beta paragraph");
});

test("collectWikiLinkTextBlocks keeps richer multiline preview text for long blocks", () => {
  const markdown = [
    "# Title",
    "",
    "$$",
    "A = 1 + 2 + 3",
    "B = 4 + 5 + 6",
    "C = 7 + 8 + 9",
    "D = 10 + 11 + 12",
    "$$"
  ].join("\n");
  const blocks = collectWikiLinkTextBlocks(markdown);
  const previewText = String(blocks[0]?.previewText || "");

  assert.match(previewText, /A = 1 \+ 2 \+ 3/);
  assert.match(previewText, /B = 4 \+ 5 \+ 6/);
  assert.match(previewText, /\.\.\.$/);
});
