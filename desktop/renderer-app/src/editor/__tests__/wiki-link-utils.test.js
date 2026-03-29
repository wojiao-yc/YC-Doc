import assert from "node:assert/strict";
import test from "node:test";
import {
  findOpenWikiLinkContext,
  parseWikiLinkRaw,
  resolveWikiLink
} from "../../utils/wiki-link.js";

test("parseWikiLinkRaw supports heading, block refs, and alias", () => {
  const parsed = parseWikiLinkRaw("[[Note#Heading^Block text|Shown text]]");

  assert.equal(parsed.target, "Note");
  assert.equal(parsed.anchor, "Heading");
  assert.equal(parsed.blockRef, "Block text");
  assert.equal(parsed.alias, "Shown text");
  assert.equal(parsed.displayText, "Shown text");
});

test("findOpenWikiLinkContext switches to block mode after caret enters ^ query", () => {
  const line = "Go to [[Note#Heading^Block";
  const context = findOpenWikiLinkContext(line, line.length);

  assert.equal(context?.mode, "block");
  assert.equal(context?.noteQuery, "Note");
  assert.equal(context?.headingQuery, "Heading");
  assert.equal(context?.blockQuery, "Block");
  assert.equal(context?.aliasQuery, "");
});

test("resolveWikiLink keeps block refs on resolved wiki links", () => {
  const resolution = resolveWikiLink(
    { target: "Note", anchor: "Heading", blockRef: "Block text", alias: "" },
    "daily/today.md",
    [{ relPath: "Note.md", name: "Note.md" }]
  );

  assert.equal(resolution?.exists, true);
  assert.equal(resolution?.relPath, "Note.md");
  assert.equal(resolution?.anchor, "Heading");
  assert.equal(resolution?.blockRef, "Block text");
  assert.equal(resolution?.displayText, "Note#Heading^Block text");
});
