import assert from "node:assert/strict";
import test from "node:test";
import { parseListLine } from "../parser/parse-list";
import { parseMarkdownToBlocks } from "../parser/parse-blocks";
import { parseMarkdownToSemanticSnapshot } from "../parser/parse-markdown";
import { findBlockContextByPos } from "../runtime/block-index";
import { findCurrentBlock } from "../runtime/current-block";

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
