import assert from "node:assert/strict";
import test from "node:test";
import { resolveEditorLinkActivation, safeExternalLinkHref } from "../runtime/link-activation.js";

test("resolveEditorLinkActivation picks wiki links under the cursor", () => {
  const markdown = "Before [[Project Plan]] after";
  const anchor = markdown.indexOf("Project") + 2;
  const activation = resolveEditorLinkActivation({
    markdown,
    selection: { anchor, head: anchor },
    currentRelPath: "notes/today.md",
    markdownFiles: [
      { relPath: "Project Plan.md", name: "Project Plan.md" }
    ]
  });

  assert.equal(activation?.type, "wiki");
  assert.equal(activation?.match?.parsed?.target, "Project Plan");
  assert.equal(activation?.resolution?.exists, true);
  assert.equal(activation?.resolution?.relPath, "Project Plan.md");
});

test("resolveEditorLinkActivation picks external markdown links under the cursor", () => {
  const markdown = "See [OpenAI](https://openai.com/docs) docs";
  const anchor = markdown.indexOf("OpenAI") + 2;
  const activation = resolveEditorLinkActivation({
    markdown,
    selection: { anchor, head: anchor }
  });

  assert.equal(activation?.type, "external");
  assert.equal(activation?.href, "https://openai.com/docs");
  assert.equal(activation?.text, "OpenAI");
});

test("resolveEditorLinkActivation keeps wiki block refs under the cursor", () => {
  const markdown = "Before [[Note#Heading^Block text|Shown]] after";
  const anchor = markdown.indexOf("Shown") + 2;
  const activation = resolveEditorLinkActivation({
    markdown,
    selection: { anchor, head: anchor },
    currentRelPath: "notes/today.md",
    markdownFiles: [
      { relPath: "Note.md", name: "Note.md" }
    ]
  });

  assert.equal(activation?.type, "wiki");
  assert.equal(activation?.match?.parsed?.anchor, "Heading");
  assert.equal(activation?.match?.parsed?.blockRef, "Block text");
  assert.equal(activation?.resolution?.blockRef, "Block text");
});

test("only safe external markdown links are keyboard-activatable", () => {
  assert.equal(safeExternalLinkHref("https://example.com"), "https://example.com");
  assert.equal(safeExternalLinkHref("mailto:test@example.com"), "mailto:test@example.com");
  assert.equal(safeExternalLinkHref("./note.md"), "");
  assert.equal(safeExternalLinkHref("#heading"), "");
});
