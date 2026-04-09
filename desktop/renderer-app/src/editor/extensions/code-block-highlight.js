import { ViewPlugin, Decoration } from "@codemirror/view";
import Prism from "prismjs";
import "prismjs/components/prism-markup.js";
import "prismjs/components/prism-css.js";
import "prismjs/components/prism-clike.js";
import "prismjs/components/prism-javascript.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-powershell.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-markdown.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-yaml.js";
import { parseMarkdownToPreviewDocument } from "../parser/parse-preview-document.js";

const clampPos = (valueInput, docLengthInput) => {
  const docLength = Math.max(0, Number(docLengthInput || 0));
  const value = Number(valueInput);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(docLength, Math.round(value)));
};

const sanitizeTokenType = (valueInput = "") =>
  String(valueInput || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

const classListFromTokenStack = (tokenStack = []) => {
  const unique = new Set();
  for (const token of tokenStack) {
    const normalized = sanitizeTokenType(token);
    if (normalized) {
      unique.add(`cm-code-token-${normalized}`);
    }
  }
  return Array.from(unique);
};

const addPrismTokenDecorations = (decorations, code, codeFrom, grammar) => {
  if (!grammar || !code) {
    return;
  }

  let offset = 0;
  const tokenTree = Prism.tokenize(code, grammar);

  const walk = (node, tokenStack = []) => {
    if (typeof node === "string") {
      const length = node.length;
      if (length <= 0) {
        return;
      }
      const classes = classListFromTokenStack(tokenStack);
      if (classes.length) {
        decorations.push(
          Decoration.mark({
            class: classes.join(" ")
          }).range(codeFrom + offset, codeFrom + offset + length)
        );
      }
      offset += length;
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, tokenStack);
      }
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    const aliases = Array.isArray(node.alias)
      ? node.alias
      : (node.alias ? [node.alias] : []);
    const nextStack = [...tokenStack, node.type, ...aliases];
    walk(node.content, nextStack);
  };

  walk(tokenTree, []);
};

const buildCodeBlockHighlightDecorations = (view) => {
  const decorations = [];
  const doc = view.state.doc;
  const docText = doc.toString();
  const docLength = Number(doc.length || 0);
  let blocks = [];

  try {
    blocks = (parseMarkdownToPreviewDocument(docText)?.specialBlocks || [])
      .filter((block) => String(block?.type || "") === "code_block");
  } catch {
    blocks = [];
  }

  for (const block of Array.isArray(blocks) ? blocks : []) {
    const contentFrom = clampPos(block?.source?.contentFrom, docLength);
    const contentTo = clampPos(block?.source?.contentTo, docLength);
    const language = String(block?.attrs?.normalizedLanguage || "");
    if (!language || contentTo <= contentFrom) {
      continue;
    }

    const grammar = Prism.languages[language];
    if (!grammar) {
      continue;
    }

    const code = doc.sliceString(contentFrom, contentTo);
    if (!code.trim()) {
      continue;
    }
    addPrismTokenDecorations(decorations, code, contentFrom, grammar);
  }

  try {
    return Decoration.set(decorations, true);
  } catch {
    return Decoration.none;
  }
};

class CodeBlockHighlightController {
  constructor(view) {
    this.decorations = buildCodeBlockHighlightDecorations(view);
  }

  update(update) {
    if (!update.docChanged) {
      return;
    }
    this.decorations = buildCodeBlockHighlightDecorations(update.view);
  }
}

const codeBlockHighlightPlugin = ViewPlugin.fromClass(CodeBlockHighlightController, {
  decorations: (instance) => instance.decorations
});

export const codeBlockHighlightExtensions = [codeBlockHighlightPlugin];
