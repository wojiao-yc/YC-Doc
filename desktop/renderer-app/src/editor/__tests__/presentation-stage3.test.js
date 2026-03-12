import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(testDir, "..", "..");
const readSrc = (relativePath) => readFileSync(resolve(srcDir, relativePath), "utf8");

test("stage3 style modules are loaded by the renderer entry", () => {
  const main = readSrc("main.js");
  const expectedImports = [
    "./styles/document-layout.css",
    "./styles/typography.css",
    "./styles/headings.css",
    "./styles/lists.css",
    "./styles/blockquote.css",
    "./styles/code-block.css",
    "./styles/special-blocks.css",
    "./styles/editor-theme.css"
  ];

  for (const importPath of expectedImports) {
    assert.match(main, new RegExp(`import\\s+["']${importPath.replace(/\./g, "\\.")}["']`));
  }
});

test("stage3 css files contain core block-presentation selectors", () => {
  const headings = readSrc("styles/headings.css");
  const lists = readSrc("styles/lists.css");
  const blockquote = readSrc("styles/blockquote.css");
  const codeBlock = readSrc("styles/code-block.css");
  const special = readSrc("styles/special-blocks.css");
  const editorTheme = readSrc("styles/editor-theme.css");

  assert.match(headings, /\.cm-line\.cm-block-heading-l1/);
  assert.match(headings, /\.cm-line\.cm-block-heading-l2/);
  assert.match(lists, /\.cm-line\.cm-list-level-2/);
  assert.match(lists, /\.cm-line\.cm-block-task-list-item\.cm-task-checked/);
  assert.match(blockquote, /\.cm-line\.cm-block-blockquote/);
  assert.match(codeBlock, /\.cm-line\.cm-block-code-block/);
  assert.match(special, /\.cm-line\.cm-block-thematic-break/);
  assert.match(special, /\.cm-line\.cm-block-image/);
  assert.match(editorTheme, /\.cm-line\.cm-block-current/);
});

test("editor wires presentation extension and accepts semantic snapshot input", () => {
  const createEditor = readSrc("editor/core/create-editor.js");
  const presentation = readSrc("editor/extensions/presentation.js");
  const shell = readSrc("editor/EditorShell.vue");
  const app = readSrc("App.vue");
  const theme = readSrc("editor/extensions/theme.js");

  assert.match(createEditor, /presentationExtensions/);
  assert.match(createEditor, /setPresentationDataEffect/);
  assert.match(createEditor, /setPresentationData\s*=\s*\(/);
  assert.match(createEditor, /setPresentationDataEffect\.of/);

  assert.match(presentation, /setPresentationDataEffect/);
  assert.match(presentation, /StateField\.define/);
  assert.match(presentation, /cm-block-current/);
  assert.match(presentation, /cm-block-heading-l/);
  assert.match(presentation, /cm-list-level-/);

  assert.match(shell, /presentationBlocks/);
  assert.match(shell, /currentBlockId/);
  assert.match(shell, /setPresentationData/);
  assert.match(app, /:presentation-blocks=\"semanticBlocks\"/);
  assert.match(app, /:current-block-id=\"currentSemanticBlockId\"/);

  assert.doesNotMatch(theme, /\.cm-activeLine/);
});
