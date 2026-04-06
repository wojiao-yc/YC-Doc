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
import { parseMarkdownToBlocks } from "../parser/parse-blocks.js";

const OPEN_FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})(.*)$/;

const closeFencePatternFor = (fenceToken) => {
  const marker = fenceToken[0] === "~" ? "~" : "`";
  const length = fenceToken.length;
  return new RegExp(`^\\s{0,3}${marker}{${length},}\\s*$`);
};

const clampPos = (valueInput, docLengthInput) => {
  const docLength = Math.max(0, Number(docLengthInput || 0));
  const value = Number(valueInput);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(docLength, Math.round(value)));
};

const normalizeCodeLanguage = (value = "") => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  const normalized = raw.split(/\s+/)[0];
  if (["js", "mjs", "cjs"].includes(normalized)) {
    return "javascript";
  }
  if (["ts", "mts", "cts"].includes(normalized)) {
    return "typescript";
  }
  if (normalized === "tsx") {
    return "tsx";
  }
  if (normalized === "jsx") {
    return "jsx";
  }
  if (["html", "xml", "svg"].includes(normalized)) {
    return "markup";
  }
  if (normalized === "yml") {
    return "yaml";
  }
  if (["sh", "shell", "zsh", "console"].includes(normalized)) {
    return "bash";
  }
  if (["ps1", "pwsh", "powershell"].includes(normalized)) {
    return "powershell";
  }
  if (normalized === "py") {
    return "python";
  }
  if (normalized === "md") {
    return "markdown";
  }
  return normalized;
};

const sanitizeTokenType = (valueInput = "") =>
  String(valueInput || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

const resolveFenceContentRange = (block, docLength) => {
  if (String(block?.type || "") !== "code_block") {
    return null;
  }

  const blockFrom = clampPos(block?.from, docLength);
  const blockTo = clampPos(block?.to, docLength);
  if (blockTo <= blockFrom) {
    return null;
  }

  const rawText = String(block?.rawText || "");
  if (!rawText) {
    return null;
  }

  const lines = rawText.split("\n");
  if (!lines.length) {
    return null;
  }

  const openLine = String(lines[0] || "");
  const openMatch = openLine.match(OPEN_FENCE_PATTERN);
  if (!openMatch) {
    return null;
  }

  const lineStarts = [0];
  for (let index = 0; index < lines.length - 1; index += 1) {
    lineStarts.push(lineStarts[index] + String(lines[index] || "").length + 1);
  }

  const infoString = String(openMatch[2] || "").trim();
  const infoLanguage = infoString ? String(infoString.split(/\s+/)[0]) : "";
  const language = normalizeCodeLanguage(block?.attrs?.language || infoLanguage);

  const fenceToken = openMatch[1];
  const closePattern = closeFencePatternFor(fenceToken);
  let closeLineIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (closePattern.test(String(lines[index] || ""))) {
      closeLineIndex = index;
      break;
    }
  }

  const contentFromOffset = lines.length > 1 ? lineStarts[1] : rawText.length;
  const contentToOffset = closeLineIndex >= 0
    ? lineStarts[closeLineIndex]
    : rawText.length;

  const contentFrom = clampPos(blockFrom + contentFromOffset, docLength);
  const contentTo = clampPos(blockFrom + contentToOffset, docLength);
  if (contentTo <= contentFrom) {
    return null;
  }

  return {
    from: contentFrom,
    to: contentTo,
    language
  };
};

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
    blocks = parseMarkdownToBlocks(docText);
  } catch {
    blocks = [];
  }

  for (const block of Array.isArray(blocks) ? blocks : []) {
    const contentRange = resolveFenceContentRange(block, docLength);
    if (!contentRange?.language) {
      continue;
    }

    const grammar = Prism.languages[contentRange.language];
    if (!grammar) {
      continue;
    }

    const code = doc.sliceString(contentRange.from, contentRange.to);
    if (!code.trim()) {
      continue;
    }
    addPrismTokenDecorations(decorations, code, contentRange.from, grammar);
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
