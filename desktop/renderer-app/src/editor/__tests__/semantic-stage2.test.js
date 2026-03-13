import assert from "node:assert/strict";
import test from "node:test";
import { parseListLine } from "../parser/parse-list";
import { parseMarkdownToBlocks } from "../parser/parse-blocks";
import { parseMarkdownToSemanticSnapshot } from "../parser/parse-markdown";
import { findBlockContextByPos } from "../runtime/block-index";
import { findCurrentBlock } from "../runtime/current-block";

const flattenInlineTokens = (tokens = []) =>
  tokens.flatMap((token) => [token, ...flattenInlineTokens(token?.children || [])]);

test("parseListLine keeps ordered marker from the list prefix", () => {
  const dot = parseListLine("12. list item with ) in content");
  const paren = parseListLine("3) list item with . in content");

  assert.equal(dot?.type, "ordered_list_item");
  assert.equal(dot?.attrs?.marker, ".");
  assert.equal(paren?.type, "ordered_list_item");
  assert.equal(paren?.attrs?.marker, ")");
});

test("math block parser only starts from valid block fences or single-line $$...$$", () => {
  const blocks = parseMarkdownToBlocks("$$inline only open\nnext line");
  assert.equal(blocks[0]?.type, "paragraph");

  const singleLine = parseMarkdownToBlocks("$$E=mc^2$$");
  assert.equal(singleLine[0]?.type, "math_block");

  const fenced = parseMarkdownToBlocks("$$\na+b\n$$\n\nend");
  assert.equal(fenced[0]?.type, "math_block");
  assert.equal(fenced[1]?.type, "paragraph");
});

test("findBlockContextByPos returns no current block for inter-block gaps", () => {
  const blocks = parseMarkdownToBlocks("A\n\nB");
  const gapPos = 2;
  const context = findBlockContextByPos(blocks, gapPos);
  const current = findCurrentBlock(blocks, gapPos);

  assert.equal(blocks.length, 2);
  assert.equal(context.index, -1);
  assert.equal(current.index, -1);
  assert.equal(current.inBlock, false);
  assert.equal(current.prevBlock?.rawText.trim(), "A");
  assert.equal(current.nextBlock?.rawText.trim(), "B");
});

test("findBlockContextByPos falls back to the last block at document end", () => {
  const markdown = "A\n\nB";
  const blocks = parseMarkdownToBlocks(markdown);
  const context = findBlockContextByPos(blocks, markdown.length);
  const current = findCurrentBlock(blocks, markdown.length);

  assert.equal(context.index, blocks.length - 1);
  assert.equal(current.index, blocks.length - 1);
  assert.equal(current.block?.rawText.trim(), "B");
});

test("stage2 block parser extracts major block types and attrs", () => {
  const markdown = [
    "# Title",
    "",
    "Paragraph line",
    "",
    "- bullet item",
    "1. ordered item",
    "- [x] task item",
    "",
    "> quote line",
    "",
    "```js",
    "console.log(1)",
    "```",
    "",
    "![alt](https://example.com/a.png \"img\")",
    "",
    "$$",
    "a+b",
    "$$",
    "",
    "---",
    "",
    "| a | b |",
    "| - | - |",
    "| 1 | 2 |",
    "",
    "<div>html</div>"
  ].join("\n");

  const blocks = parseMarkdownToBlocks(markdown);
  const types = blocks.map((block) => block.type);

  assert.equal(types.includes("heading"), true);
  assert.equal(types.includes("paragraph"), true);
  assert.equal(types.includes("bullet_list_item"), true);
  assert.equal(types.includes("ordered_list_item"), true);
  assert.equal(types.includes("task_list_item"), true);
  assert.equal(types.includes("blockquote"), true);
  assert.equal(types.includes("code_block"), true);
  assert.equal(types.includes("image"), true);
  assert.equal(types.includes("math_block"), true);
  assert.equal(types.includes("thematic_break"), true);
  assert.equal(types.includes("table"), true);
  assert.equal(types.includes("html_block"), true);

  const heading = blocks.find((block) => block.type === "heading");
  const ordered = blocks.find((block) => block.type === "ordered_list_item");
  const task = blocks.find((block) => block.type === "task_list_item");
  const code = blocks.find((block) => block.type === "code_block");
  const image = blocks.find((block) => block.type === "image");
  const math = blocks.find((block) => block.type === "math_block");

  assert.equal(heading?.attrs?.level, 1);
  assert.equal(ordered?.attrs?.index, 1);
  assert.equal(task?.attrs?.checked, true);
  assert.equal(code?.attrs?.language, "js");
  assert.equal(image?.attrs?.src, "https://example.com/a.png");
  assert.equal(math?.attrs?.displayMode, true);
});

test("blocks keep stable ordered ranges and current-block lookup works inside each block", () => {
  const markdown = [
    "# A",
    "",
    "text",
    "",
    "- [ ] task",
    "",
    "```ts",
    "const n = 1",
    "```"
  ].join("\n");
  const blocks = parseMarkdownToBlocks(markdown);

  assert.equal(blocks.length > 0, true);
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    assert.equal(typeof block.from, "number");
    assert.equal(typeof block.to, "number");
    assert.equal(block.to > block.from, true);
    assert.equal(block.lineEnd >= block.lineStart, true);
    if (index > 0) {
      assert.equal(block.from >= blocks[index - 1].to, true);
    }

    const pos = Math.max(block.from, block.to - 1);
    const current = findCurrentBlock(blocks, pos);
    assert.equal(current.index, index);
  }
});

test("semantic snapshot generates heading outline with level, text and range", () => {
  const markdown = [
    "# Intro",
    "",
    "text",
    "",
    "## Details",
    "",
    "more text"
  ].join("\n");
  const snapshot = parseMarkdownToSemanticSnapshot(markdown);

  assert.equal(Array.isArray(snapshot.blocks), true);
  assert.equal(Array.isArray(snapshot.outline), true);
  assert.equal(snapshot.outline.length, 2);
  assert.equal(snapshot.outline[0].level, 1);
  assert.equal(snapshot.outline[0].text, "Intro");
  assert.equal(snapshot.outline[1].level, 2);
  assert.equal(snapshot.outline[1].text, "Details");
  assert.equal(snapshot.outline[0].from < snapshot.outline[0].to, true);
  assert.equal(snapshot.outline[1].from < snapshot.outline[1].to, true);
});

test("nested list items are parsed as independent blocks with increasing levels", () => {
  const markdown = [
    "- parent",
    "  - child",
    "    - grand child",
    "- sibling"
  ].join("\n");
  const blocks = parseMarkdownToBlocks(markdown);
  const listBlocks = blocks.filter((block) =>
    block.type === "bullet_list_item" || block.type === "ordered_list_item" || block.type === "task_list_item"
  );

  assert.equal(listBlocks.length, 4);
  assert.equal(listBlocks[0].attrs?.level, 1);
  assert.equal(listBlocks[1].attrs?.level, 2);
  assert.equal(listBlocks[2].attrs?.level, 3);
  assert.equal(listBlocks[3].attrs?.level, 1);

  for (let index = 1; index < listBlocks.length; index += 1) {
    assert.equal(listBlocks[index].from >= listBlocks[index - 1].to, true);
  }
});

test("inline segments preserve in-line syntax order and offsets", () => {
  const markdown = "normal *italic* **bold** *again*";
  const blocks = parseMarkdownToBlocks(markdown);
  const paragraph = blocks.find((block) => block.type === "paragraph");
  const inlineSegments = paragraph?.inlineSegments || [];

  assert.equal(Array.isArray(inlineSegments), true);
  assert.equal(inlineSegments.length >= 6, true);

  const compact = inlineSegments.map((segment) => ({
    text: segment.text,
    marks: segment.marks
  }));
  assert.deepEqual(compact.slice(0, 6), [
    { text: "normal ", marks: [] },
    { text: "italic", marks: ["em"] },
    { text: " ", marks: [] },
    { text: "bold", marks: ["strong"] },
    { text: " ", marks: [] },
    { text: "again", marks: ["em"] }
  ]);

  for (let index = 0; index < inlineSegments.length; index += 1) {
    const segment = inlineSegments[index];
    assert.equal(typeof segment.from, "number");
    assert.equal(typeof segment.to, "number");
    assert.equal(segment.to > segment.from, true);
    assert.equal(markdown.slice(segment.from, segment.to), segment.text);
    if (index > 0) {
      assert.equal(segment.from >= inlineSegments[index - 1].to, true);
    }
  }
});

test("inline segments ignore heading marker prefix and keep heading content offsets", () => {
  const markdown = "# Title *focus*";
  const blocks = parseMarkdownToBlocks(markdown);
  const heading = blocks.find((block) => block.type === "heading");
  const inlineSegments = heading?.inlineSegments || [];

  assert.equal(inlineSegments.length >= 2, true);
  assert.deepEqual(
    inlineSegments.slice(0, 2).map((segment) => ({ text: segment.text, marks: segment.marks })),
    [
      { text: "Title ", marks: [] },
      { text: "focus", marks: ["em"] }
    ]
  );
  assert.equal(inlineSegments[0].from, markdown.indexOf("Title"));
});

test("inline token tree keeps stable outer and inner ranges for repeated and nested syntax", () => {
  const markdown = [
    "**a** **a**",
    "",
    "**hello `x` world**",
    "",
    "[link](a) and [link](b)",
    "",
    "_this is **nested** text_",
    "",
    "Use `a` and `a`",
    "",
    "~~del~~ and ~~del~~"
  ].join("\n");
  const blocks = parseMarkdownToBlocks(markdown);
  const allInlineTokens = flattenInlineTokens(blocks.flatMap((block) => block.inlineTokens || []));
  const allInlineSegments = blocks.flatMap((block) => block.inlineSegments || []);

  assert.equal(allInlineTokens.length > 0, true);
  assert.equal(allInlineSegments.length > 0, true);

  for (const token of allInlineTokens) {
    assert.equal(token.rawTo >= token.rawFrom, true);
    assert.equal(token.textTo >= token.textFrom, true);
    assert.equal(token.rawFrom <= token.textFrom, true);
    assert.equal(token.rawTo >= token.textTo, true);
    assert.equal(markdown.slice(token.rawFrom, token.rawTo), token.rawText);
    if (token.textTo > token.textFrom) {
      assert.equal(markdown.slice(token.textFrom, token.textTo), token.text);
    }
  }

  const strongTokens = allInlineTokens.filter((token) => token.type === "strong");
  const linkTokens = allInlineTokens.filter((token) => token.type === "link");
  assert.equal(strongTokens.length >= 3, true);
  assert.equal(strongTokens.every((token) => token.rawTo > token.textTo), true);
  assert.deepEqual(linkTokens.map((token) => token.attrs?.href), ["a", "b"]);

  for (const segment of allInlineSegments) {
    assert.equal(segment.outerFrom <= segment.from, true);
    assert.equal(segment.outerTo >= segment.to, true);
    assert.equal(markdown.slice(segment.from, segment.to), segment.text);
    if (segment.marks.length > 0) {
      assert.equal(segment.outerTo > segment.to, true);
    }
  }
});

test("inline model works for blockquote and list line prefixes", () => {
  const markdown = ["> quote with **bold** and `code`", "", "- item with [link](url)"].join("\n");
  const blocks = parseMarkdownToBlocks(markdown);
  const quote = blocks.find((block) => block.type === "blockquote");
  const bullet = blocks.find((block) => block.type === "bullet_list_item");

  assert.equal(Boolean(quote), true);
  assert.equal(Boolean(bullet), true);

  const quoteSegments = quote?.inlineSegments || [];
  const bulletSegments = bullet?.inlineSegments || [];

  assert.equal(
    quoteSegments.some((segment) => segment.text === "bold" && segment.marks.includes("strong")),
    true
  );
  assert.equal(
    quoteSegments.some((segment) => segment.text === "code" && segment.marks.includes("codespan")),
    true
  );
  assert.equal(
    bulletSegments.some((segment) => segment.text === "link" && segment.marks.includes("link")),
    true
  );
});
