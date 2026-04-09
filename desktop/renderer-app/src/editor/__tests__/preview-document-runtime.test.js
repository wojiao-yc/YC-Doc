import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdownToSemanticSnapshot } from "../parser/parse-markdown.js";
import { parseMarkdownToPreviewDocument } from "../parser/parse-preview-document.js";
import {
  resolveCurrentPreviewNodeId,
  resolvePreviewBlockRangeAtPos,
  resolvePreviewBlockRangeById,
  resolvePreviewCodeBlockRangeById
} from "../runtime/preview-document.js";

const SAMPLE_MARKDOWN = [
  "# Title",
  "",
  "![Diagram](./assets/demo.png)",
  "",
  "```js",
  "const answer = 42",
  "```",
  "",
  "| Name | Score |",
  "| :--- | ---: |",
  "| Alice | 10 |"
].join("\n");

test("parseMarkdownToPreviewDocument caches and exposes preview nodes", () => {
  const first = parseMarkdownToPreviewDocument(SAMPLE_MARKDOWN);
  const second = parseMarkdownToPreviewDocument(SAMPLE_MARKDOWN);
  const headingNode = first.nodes.find((node) => node.type === "heading");
  const imageNode = first.nodes.find((node) => node.type === "image");
  const tableNode = first.nodes.find((node) => node.type === "table");

  assert.equal(first, second);
  assert.ok(Array.isArray(first.nodes));
  assert.ok(first.nodes.some((node) => node.type === "image"));
  assert.ok(first.nodes.some((node) => node.type === "code_block"));
  assert.ok(first.nodes.some((node) => node.type === "table"));
  assert.equal(headingNode?.editing?.revealSourceWhenSelected, true);
  assert.equal(imageNode?.editing?.hideSourceLines, true);
  assert.equal(tableNode?.editing?.keyboardNavigable, true);
});

test("preview runtime resolves block ranges by cursor position and block identity", () => {
  const previewDocument = parseMarkdownToPreviewDocument(SAMPLE_MARKDOWN);
  const tableNode = previewDocument.nodes.find((node) => node.type === "table");
  const codeNode = previewDocument.nodes.find((node) => node.type === "code_block");

  assert.ok(tableNode);
  assert.ok(codeNode);

  const tableRangeFromStateKey = resolvePreviewBlockRangeById(
    previewDocument,
    `table:${tableNode.from}`,
    "table"
  );
  const tableRangeFromFullId = resolvePreviewBlockRangeById(previewDocument, tableNode.id, "table");
  const pickedRange = resolvePreviewBlockRangeAtPos(previewDocument, tableNode.from + 1);
  const codeRange = resolvePreviewCodeBlockRangeById(previewDocument, `code_block:${codeNode.from}`);

  assert.ok(tableRangeFromStateKey);
  assert.ok(tableRangeFromFullId);
  assert.ok(pickedRange);
  assert.ok(codeRange);
  assert.equal(tableRangeFromStateKey?.from, tableNode.from);
  assert.equal(tableRangeFromFullId?.to, tableNode.to);
  assert.equal(pickedRange?.node?.type, "table");
  assert.equal(
    SAMPLE_MARKDOWN.slice(codeRange.contentFrom, codeRange.contentTo).trim(),
    "const answer = 42"
  );
  assert.equal(resolveCurrentPreviewNodeId(previewDocument, 2), previewDocument.nodes[0]?.id);
});

test("semantic snapshot carries preview document data", () => {
  const snapshot = parseMarkdownToSemanticSnapshot(SAMPLE_MARKDOWN);

  assert.ok(snapshot.previewDocument);
  assert.ok(Array.isArray(snapshot.nodes));
  assert.ok(Array.isArray(snapshot.specialBlocks));
  assert.deepEqual(snapshot.blocks, snapshot.previewDocument.blocks);
  assert.deepEqual(snapshot.outline, snapshot.previewDocument.outline);
});

test("preview parser recognizes empty-header tables from insert template", () => {
  const previewDocument = parseMarkdownToPreviewDocument([
    "|  |  |",
    "| --- | --- |",
    "|  |  |"
  ].join("\n"));

  const tableNode = previewDocument.nodes.find((node) => node.type === "table");

  assert.ok(tableNode);
  assert.equal(tableNode?.editing?.keyboardNavigable, true);
  assert.equal(tableNode?.rawText, "|  |  |\n| --- | --- |\n|  |  |");
});

test("preview parser keeps adjacent image lines as separate blocks", () => {
  const previewDocument = parseMarkdownToPreviewDocument([
    "![One](./one.png)",
    "![Two](./two.png)"
  ].join("\n"));

  const imageNodes = previewDocument.nodes.filter((node) => node.type === "image");

  assert.equal(imageNodes.length, 2);
  assert.notEqual(imageNodes[0]?.from, imageNodes[1]?.from);
});
