import { Decoration, EditorView, ViewPlugin, WidgetType, keymap } from "@codemirror/view";
import { EditorState, Prec, StateEffect, StateField } from "@codemirror/state";
import katex from "katex";
import { marked } from "marked";
import { parseImageLine, serializeImageLine } from "../parser/parse-image.js";
import { copyText } from "../../utils/clipboard.js";
import { createAppIconSvgElement } from "../../utils/app-icon.js";
import { resolveWorkspaceAssetSrc } from "../../utils/workspace-media.js";

const HEADING_PREFIX_PATTERN = /^\s{0,3}#{1,6}[ \t]+/;
const BLOCKQUOTE_PREFIX_PATTERN = /^\s{0,3}>\s?/;
const CALLOUT_MARKER_WITH_PREFIX_PATTERN = /^(\s{0,3}>\s*)\[!([A-Za-z][A-Za-z0-9_-]*)\](?:[ \t]+)?/;
const TASK_LIST_PREFIX_PATTERN = /^(\s*)([-+*])\s+\[( |x|X)\]\s+/;
const BULLET_LIST_PREFIX_PATTERN = /^(\s*)([-+*])\s+/;
const ORDERED_LIST_PREFIX_PATTERN = /^(\s*)(\d+)([.)])\s+/;
const TASK_LIST_CHECKBOX_PATTERN = /^(\s*[-+*]\s+\[)( |x|X)(\]\s+)/;
const OPEN_CODE_FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const SINGLE_LINE_MATH_BLOCK_PATTERN = /^\s{0,3}\$\$(.+?)\$\$\s*$/;
const OPEN_MATH_FENCE_PATTERN = /^\s{0,3}\$\$\s*$/;
const INLINE_SYNTAX_TOKEN_TYPES = new Set([
  "em",
  "strong",
  "codespan",
  "del",
  "link",
  "wikilink",
  "math_inline",
  "mark",
  "comment"
]);
const SOURCE_VISIBLE_BLOCK_TYPES = new Set([
  "heading",
  "bullet_list_item",
  "ordered_list_item",
  "task_list_item",
  "blockquote",
  "thematic_break"
]);
const AUTO_SOURCE_REVEAL_BLOCK_TYPES = new Set([
  "image"
]);
const KEYBOARD_NAVIGABLE_SPECIAL_BLOCK_TYPES = new Set([
  "image",
  "math_block",
  "table"
]);

const isEditorStateReadOnly = (state) => Boolean(
  state?.facet?.(EditorState.readOnly)
  || state?.readOnly
);
const isEditorReadOnly = (view) => isEditorStateReadOnly(view?.state);

let presentationRuntimeOptions = {
  getCurrentRelPath: null,
  getWorkspaceRootPath: null
};

export const setPresentationRuntimeOptions = (nextOptions = {}) => {
  presentationRuntimeOptions = {
    getCurrentRelPath: typeof nextOptions?.getCurrentRelPath === "function"
      ? nextOptions.getCurrentRelPath
      : null,
    getWorkspaceRootPath: typeof nextOptions?.getWorkspaceRootPath === "function"
      ? nextOptions.getWorkspaceRootPath
      : null
  };
};

const safePosForLineLookup = (doc, pos) => {
  const length = Number(doc.length || 0);
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(length, Number(pos || 0)));
};

const charBefore = (doc, pos) => {
  const safePos = safePosForLineLookup(doc, pos);
  if (safePos <= 0) {
    return "";
  }
  return doc.sliceString(safePos - 1, safePos);
};

const resolveRangeEndPosForLineLookup = (doc, fromPos, toBaseInput) => {
  let to = safePosForLineLookup(doc, toBaseInput);
  if (to <= fromPos) {
    return fromPos;
  }

  // Trim visual-only trailing blank lines ("\n" + optional spaces/tabs) from line-class mapping.
  while (to > fromPos) {
    let cursor = to;
    while (cursor > fromPos) {
      const prevChar = charBefore(doc, cursor);
      if (prevChar === " " || prevChar === "\t") {
        cursor -= 1;
        continue;
      }
      break;
    }

    const prevChar = charBefore(doc, cursor);
    if (prevChar === "\n" || prevChar === "\r") {
      to = Math.max(fromPos, cursor - 1);
      continue;
    }
    break;
  }

  if (to <= fromPos) {
    return fromPos;
  }
  return to - 1;
};

const resolveLineRange = (doc, block) => {
  const fromPos = safePosForLineLookup(doc, block.from);
  const toBase = Number(block.to || block.from);
  const toPos = resolveRangeEndPosForLineLookup(doc, fromPos, Math.max(fromPos, toBase));
  const fromLine = doc.lineAt(fromPos).number;
  const toLine = doc.lineAt(toPos).number;
  return { fromLine, toLine };
};

const normalizePresentationData = (input = {}) => ({
  blocks: Array.isArray(input.blocks) ? input.blocks : [],
  currentBlockId: String(input.currentBlockId || "")
});

const clampPos = (value, length) => Math.max(0, Math.min(Number(length || 0), Number(value || 0)));
const resolveInlineWidgetMountOutsideHiddenBlock = (docLengthInput, fromInput, toInput) => {
  const docLength = Math.max(0, Number(docLengthInput || 0));
  const from = clampPos(fromInput, docLength);
  const to = Math.max(from, clampPos(toInput, docLength));

  if (to < docLength) {
    return {
      pos: clampPos(to + 1, docLength),
      side: -1
    };
  }

  if (from > 0) {
    return {
      pos: clampPos(from - 1, docLength),
      side: 1
    };
  }

  return {
    pos: from,
    side: -1
  };
};
const blockIdentityOf = (block) => {
  const explicitId = String(block?.id || "");
  if (explicitId) {
    return explicitId;
  }
  const blockType = String(block?.type || "paragraph");
  const blockFrom = Math.max(0, Number(block?.from || 0));
  return `${blockType}:${blockFrom}`;
};
const mathExpandKeyOf = (block) => {
  if (String(block?.type || "") !== "math_block") {
    return "";
  }
  return `math_block:${Math.max(0, Number(block?.from || 0))}`;
};
const imageExpandKeyOf = (block) => {
  if (String(block?.type || "") !== "image") {
    return "";
  }
  return `image:${Math.max(0, Number(block?.from || 0))}`;
};
const tableExpandKeyOf = (block) => {
  if (String(block?.type || "") !== "table") {
    return "";
  }
  return `table:${Math.max(0, Number(block?.from || 0))}`;
};
const codeBlockCopyKeyOf = (block) => {
  if (String(block?.type || "") !== "code_block") {
    return "";
  }
  return `code_block:${Math.max(0, Number(block?.from || 0))}`;
};
const DEFAULT_IMAGE_WIDTH = 520;
const MIN_IMAGE_WIDTH = 160;
const MAX_IMAGE_WIDTH = 1400;
const SOURCE_TOGGLE_ICON_COLLAPSED = "</>";
const SOURCE_TOGGLE_ICON_EXPANDED = ">/<";
const CALLOUT_LABELS = {
  note: "NOTE",
  tip: "TIP",
  info: "INFO",
  warning: "WARNING",
  caution: "CAUTION",
  danger: "DANGER",
  important: "IMPORTANT"
};
const CALLOUT_ICONS = {
  note: "✎",
  tip: "✦",
  info: "ℹ",
  warning: "⚠",
  caution: "⚠",
  danger: "⛔",
  important: "❗"
};

const normalizeCalloutType = (typeInput) =>
  String(typeInput || "note")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    || "note";

const calloutLabelForType = (typeInput) => {
  const normalized = normalizeCalloutType(typeInput);
  return CALLOUT_LABELS[normalized] || normalized.toUpperCase();
};
const calloutIconForType = (typeInput) => {
  const normalized = normalizeCalloutType(typeInput);
  return CALLOUT_ICONS[normalized] || "✎";
};

const normalizeImageWidth = (value, fallback = DEFAULT_IMAGE_WIDTH) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const rounded = Math.round(numeric);
  return Math.max(MIN_IMAGE_WIDTH, Math.min(MAX_IMAGE_WIDTH, rounded));
};

const pickBlockIdentityAtPos = (blocks, posInput, docLength) => {
  const pos = clampPos(posInput, docLength);
  let pickedId = "";
  let pickedSpan = Number.POSITIVE_INFINITY;
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const from = clampPos(block?.from, docLength);
    const to = clampPos(block?.to, docLength);
    const boundedTo = Math.max(from, to);
    if (pos < from || pos > boundedTo) {
      continue;
    }
    const span = Math.max(0, boundedTo - from);
    if (span <= pickedSpan) {
      pickedSpan = span;
      pickedId = blockIdentityOf(block);
    }
  }
  return pickedId;
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const closeFencePatternFor = (fenceToken = "") => {
  const token = String(fenceToken || "");
  if (!token) {
    return /^$/;
  }
  const marker = token[0] === "~" ? "~" : "`";
  return new RegExp(`^\\s{0,3}${marker}{${token.length},}\\s*$`);
};

const extractCodeBlockContent = (rawTextInput = "") => {
  const rawText = String(rawTextInput || "");
  if (!rawText) {
    return "";
  }

  const lines = rawText.split("\n");
  if (!lines.length) {
    return "";
  }

  const openMatch = String(lines[0] || "").match(OPEN_CODE_FENCE_PATTERN);
  if (!openMatch) {
    return rawText;
  }

  const closePattern = closeFencePatternFor(openMatch[1]);
  let closeLineIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (closePattern.test(String(lines[index] || ""))) {
      closeLineIndex = index;
      break;
    }
  }

  const contentLines = closeLineIndex >= 0
    ? lines.slice(1, closeLineIndex)
    : lines.slice(1);
  return contentLines.join("\n");
};

const renderMathHtml = (formulaInput, displayMode = false) => {
  const formula = String(formulaInput || "").trim();
  if (!formula) {
    return `<span class="cm-math-empty">${displayMode ? "Empty math block" : "Empty formula"}</span>`;
  }

  try {
    if (typeof katex?.renderToString === "function") {
      return katex.renderToString(formula, {
        displayMode: Boolean(displayMode),
        throwOnError: false,
        output: "html"
      });
    }
  } catch {
    // fall through
  }

  return `<span class="cm-math-fallback">${escapeHtml(formula)}</span>`;
};

const splitTableCells = (lineText) =>
  String(lineText || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => String(cell || "").trim());

const isPipeWrappedTableLine = (lineText) => /^\s*\|.*\|\s*$/.test(String(lineText || ""));

const isTableDelimiterCell = (cellText) => /^:?-{3,}:?$/.test(String(cellText || "").trim());

const tableCellAlign = (delimiterCellText) => {
  const cell = String(delimiterCellText || "").trim();
  if (!isTableDelimiterCell(cell)) {
    return "";
  }
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) {
    return "center";
  }
  if (right) {
    return "right";
  }
  if (left) {
    return "left";
  }
  return "";
};

const parseMarkdownTableRaw = (rawText) => {
  const lines = String(rawText || "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return null;
  }
  if (!isPipeWrappedTableLine(lines[0]) || !isPipeWrappedTableLine(lines[1])) {
    return null;
  }

  const headers = splitTableCells(lines[0]);
  const delimiter = splitTableCells(lines[1]);
  if (!headers.length || delimiter.length < headers.length) {
    return null;
  }

  const alignments = headers.map((_, index) => tableCellAlign(delimiter[index]));
  for (let index = 0; index < headers.length; index += 1) {
    if (!isTableDelimiterCell(delimiter[index])) {
      return null;
    }
  }

  const rows = [];
  for (const line of lines.slice(2)) {
    if (!isPipeWrappedTableLine(line)) {
      break;
    }
    const cells = splitTableCells(line);
    if (cells.length !== headers.length) {
      break;
    }
    rows.push(headers.map((_, index) => String(cells[index] || "").trim()));
  }

  return {
    headers: headers.map((cell) => String(cell || "")),
    rows,
    alignments
  };
};

const tableIndentOfRaw = (rawText) => {
  const lines = String(rawText || "").split("\n");
  for (const line of lines) {
    const text = String(line || "");
    if (!text.trim()) {
      continue;
    }
    return text.match(/^\s*/u)?.[0] || "";
  }
  return "";
};

const parseMarkdownTableModel = (rawText) => {
  const parsed = parseMarkdownTableRaw(rawText);
  if (!parsed) {
    return null;
  }

  const columnCount = Math.max(1, Number(parsed.headers?.length || 0));
  const headers = Array.from({ length: columnCount }, (_, index) => String(parsed.headers[index] || ""));
  const alignments = Array.from({ length: columnCount }, (_, index) => String(parsed.alignments[index] || ""));
  const rows = (Array.isArray(parsed.rows) ? parsed.rows : []).map((row) =>
    Array.from({ length: columnCount }, (_, index) => String(row?.[index] || ""))
  );

  return {
    headers,
    alignments,
    rows,
    indent: tableIndentOfRaw(rawText)
  };
};

const normalizeTableCellText = (value) =>
  String(value ?? "")
    .replace(/\r?\n/g, " ")
    .trim();

const TABLE_INLINE_ALLOWED_TAGS = new Set([
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "CODE",
  "DEL",
  "S",
  "MARK",
  "SUP",
  "SUB",
  "A",
  "BR"
]);

const safeTableLinkHref = (hrefInput) => {
  const href = String(hrefInput || "").trim();
  if (!href) {
    return "";
  }
  if (/^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(href)) {
    return href;
  }
  return "";
};

const sanitizeTableInlineHtml = (htmlInput) => {
  const html = String(htmlInput || "");
  if (!html) {
    return "";
  }

  if (typeof document === "undefined" || typeof Node === "undefined") {
    return escapeHtml(html);
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  const sanitizeChildren = (parentNode) => {
    const children = Array.from(parentNode.childNodes || []);
    for (const child of children) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const element = child;
      sanitizeChildren(element);
      const tag = String(element.tagName || "").toUpperCase();
      if (!TABLE_INLINE_ALLOWED_TAGS.has(tag)) {
        element.replaceWith(...Array.from(element.childNodes || []));
        continue;
      }

      if (tag === "A") {
        const href = safeTableLinkHref(element.getAttribute("href"));
        const title = String(element.getAttribute("title") || "").trim();
        if (href) {
          element.setAttribute("href", href);
        } else {
          element.removeAttribute("href");
        }
        if (title) {
          element.setAttribute("title", title);
        } else {
          element.removeAttribute("title");
        }
        for (const attr of Array.from(element.attributes || [])) {
          if (attr.name !== "href" && attr.name !== "title") {
            element.removeAttribute(attr.name);
          }
        }
      } else if (tag !== "BR") {
        for (const attr of Array.from(element.attributes || [])) {
          element.removeAttribute(attr.name);
        }
      }
    }
  };

  sanitizeChildren(template.content);
  return template.innerHTML;
};

const applyTableMarkSyntax = (htmlInput) => {
  const html = String(htmlInput || "");
  if (!html || !html.includes("==")) {
    return html;
  }

  const codeBlocks = [];
  const withCodePlaceholders = html.replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, (match) => {
    const index = codeBlocks.push(match) - 1;
    return `\u0000TABLE_CODE_${index}\u0000`;
  });

  const withMarks = withCodePlaceholders.replace(/==(?=\S)([\s\S]*?\S)==/g, "<mark>$1</mark>");
  return withMarks.replace(/\u0000TABLE_CODE_(\d+)\u0000/g, (_, indexText) => {
    const index = Number(indexText);
    if (!Number.isFinite(index) || index < 0 || index >= codeBlocks.length) {
      return "";
    }
    return codeBlocks[index] || "";
  });
};

const renderTableCellInlineHtml = (cellTextInput) => {
  const source = String(cellTextInput ?? "");
  if (!source) {
    return '<span class="cm-table-widget-cell-content"></span>';
  }

  try {
    if (typeof marked?.parseInline === "function") {
      const parsed = String(
        marked.parseInline(source, {
          gfm: true,
          breaks: true
        }) || ""
      );
      return `<span class="cm-table-widget-cell-content">${sanitizeTableInlineHtml(applyTableMarkSyntax(parsed))}</span>`;
    }
  } catch {
    // fall through
  }

  return `<span class="cm-table-widget-cell-content">${escapeHtml(source)}</span>`;
};

const tableDelimiterCellFromAlign = (alignInput) => {
  const align = String(alignInput || "").trim().toLowerCase();
  if (align === "center") {
    return ":---:";
  }
  if (align === "right") {
    return "---:";
  }
  if (align === "left") {
    return ":---";
  }
  return "---";
};

const serializeMarkdownTableModel = (modelInput) => {
  const headersSource = Array.isArray(modelInput?.headers) ? modelInput.headers : [];
  const columnCount = Math.max(1, Number(headersSource.length || 0));
  const headers = Array.from({ length: columnCount }, (_, index) => normalizeTableCellText(headersSource[index]));
  const alignmentsSource = Array.isArray(modelInput?.alignments) ? modelInput.alignments : [];
  const delimiterCells = Array.from({ length: columnCount }, (_, index) =>
    tableDelimiterCellFromAlign(alignmentsSource[index])
  );
  const rowsSource = Array.isArray(modelInput?.rows) ? modelInput.rows : [];
  const rows = rowsSource.map((row) =>
    Array.from({ length: columnCount }, (_, index) => normalizeTableCellText(row?.[index]))
  );
  const indent = String(modelInput?.indent || "");
  const lineOf = (cells) => `${indent}| ${cells.join(" | ")} |`;
  return [lineOf(headers), lineOf(delimiterCells), ...rows.map((row) => lineOf(row))].join("\n");
};

const clampIndex = (valueInput, minInput, maxInput) => {
  const min = Number.isFinite(minInput) ? minInput : 0;
  const max = Number.isFinite(maxInput) ? maxInput : min;
  const numeric = Number(valueInput);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(numeric)));
};

const isPlainTableVerticalArrowEvent = (event) => {
  if (!event || event.defaultPrevented || event.isComposing) {
    return false;
  }
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
    return false;
  }
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  return true;
};

const isPlainTableClipboardShortcutEvent = (event) => {
  if (!event || event.defaultPrevented || event.isComposing) {
    return false;
  }
  const key = String(event.key || "").toLowerCase();
  if (!key) {
    return false;
  }
  if ((!event.ctrlKey && !event.metaKey) || event.altKey) {
    return false;
  }
  return key === "c" || key === "x" || key === "v" || key === "a";
};

const tableCellEditorIdentityOf = (cellEditor) => {
  if (!(cellEditor instanceof HTMLElement)) {
    return null;
  }

  const blockId = String(cellEditor.getAttribute("data-table-block-id") || "");
  const section = String(cellEditor.getAttribute("data-table-section") || "body").toLowerCase();
  const colIndex = Number(cellEditor.getAttribute("data-table-col-index"));
  const rowIndexRaw = Number(cellEditor.getAttribute("data-table-row-index"));
  if (!blockId || !Number.isFinite(colIndex)) {
    return null;
  }

  return {
    blockId,
    section: section === "header" ? "header" : "body",
    rowIndex: Number.isFinite(rowIndexRaw) ? rowIndexRaw : -1,
    colIndex
  };
};

const tableVisualRowIndexOf = (cellIdentity) => {
  if (!cellIdentity) {
    return -1;
  }
  return cellIdentity.section === "header"
    ? 0
    : Math.max(0, Number(cellIdentity.rowIndex || 0)) + 1;
};

const resolveTableCellSectionAtVisualRow = (visualRowIndexInput) => {
  const visualRowIndex = Math.max(0, Number(visualRowIndexInput || 0));
  if (visualRowIndex <= 0) {
    return {
      section: "header",
      rowIndex: -1
    };
  }
  return {
    section: "body",
    rowIndex: visualRowIndex - 1
  };
};

const resolveTableCellSelectionTextOffset = (cellEditor) => {
  if (!(cellEditor instanceof HTMLElement) || typeof window === "undefined" || typeof document === "undefined") {
    return 0;
  }

  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount < 1) {
    return 0;
  }

  const range = selection.getRangeAt(0);
  if (!cellEditor.contains(range.endContainer)) {
    return 0;
  }

  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(cellEditor);
  prefixRange.setEnd(range.endContainer, range.endOffset);
  return Math.max(0, String(prefixRange.toString() || "").length);
};

const placeCaretAtTextOffsetInTableCell = (cellEditor, offsetInput = 0) => {
  if (!(cellEditor instanceof HTMLElement) || typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const selection = window.getSelection?.();
  if (!selection) {
    return false;
  }

  const offset = Math.max(0, Number(offsetInput || 0));
  const range = document.createRange();
  const textWalker = document.createTreeWalker(cellEditor, window.NodeFilter?.SHOW_TEXT ?? 4);
  let remaining = offset;
  let lastTextNode = null;
  let currentNode = textWalker.nextNode();

  while (currentNode) {
    const textNode = currentNode;
    const textLength = String(textNode.nodeValue || "").length;
    lastTextNode = textNode;
    if (remaining <= textLength) {
      range.setStart(textNode, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }
    remaining -= textLength;
    currentNode = textWalker.nextNode();
  }

  if (lastTextNode) {
    const lastLength = String(lastTextNode.nodeValue || "").length;
    range.setStart(lastTextNode, lastLength);
    range.collapse(true);
  } else {
    range.selectNodeContents(cellEditor);
    range.collapse(offset <= 0);
  }
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

const focusTableCellEditorElement = (cellEditor, textOffsetInput = 0) => {
  if (!(cellEditor instanceof HTMLElement)) {
    return false;
  }

  try {
    cellEditor.focus({ preventScroll: true });
  } catch {
    cellEditor.focus();
  }
  placeCaretAtTextOffsetInTableCell(cellEditor, textOffsetInput);
  if (typeof cellEditor.scrollIntoView === "function") {
    cellEditor.scrollIntoView({
      block: "nearest",
      inline: "nearest"
    });
  }
  return true;
};

const selectionRangeInsideTableCellEditor = (cellEditor) => {
  if (!(cellEditor instanceof HTMLElement) || typeof window === "undefined") {
    return null;
  }
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount < 1) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!cellEditor.contains(range.startContainer) || !cellEditor.contains(range.endContainer)) {
    return null;
  }
  return range;
};

const insertPlainTextIntoTableCellEditor = (cellEditor, textInput) => {
  if (!(cellEditor instanceof HTMLElement) || typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }
  const text = normalizeTableCellEditorText(textInput);
  const selection = window.getSelection?.();
  if (!selection) {
    return false;
  }
  const existingRange = selectionRangeInsideTableCellEditor(cellEditor);
  const activeRange = existingRange || document.createRange();
  if (!existingRange) {
    activeRange.selectNodeContents(cellEditor);
    activeRange.collapse(false);
  }
  const textNode = document.createTextNode(text);
  activeRange.deleteContents();
  activeRange.insertNode(textNode);

  const nextRange = document.createRange();
  nextRange.setStart(textNode, text.length);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  return true;
};

const resolveMaxTableBodyRowIndex = (tableWidget) => {
  if (!(tableWidget instanceof Element)) {
    return -1;
  }

  let maxRowIndex = -1;
  for (const cell of tableWidget.querySelectorAll('[data-table-edit="true"][data-table-section="body"]')) {
    const rowIndex = Number(cell.getAttribute("data-table-row-index"));
    if (Number.isFinite(rowIndex)) {
      maxRowIndex = Math.max(maxRowIndex, rowIndex);
    }
  }
  return maxRowIndex;
};

const resolveTableCellEditorAt = (tableWidget, blockIdInput, visualRowIndexInput, colIndexInput) => {
  if (!(tableWidget instanceof Element)) {
    return null;
  }

  const blockId = String(blockIdInput || "");
  const colIndex = Math.max(0, Number(colIndexInput || 0));
  const rowDescriptor = resolveTableCellSectionAtVisualRow(visualRowIndexInput);
  const selectorParts = [
    '[data-table-edit="true"]',
    `[data-table-block-id="${blockId}"]`,
    `[data-table-section="${rowDescriptor.section}"]`,
    `[data-table-col-index="${colIndex}"]`
  ];
  if (rowDescriptor.section === "body") {
    selectorParts.push(`[data-table-row-index="${rowDescriptor.rowIndex}"]`);
  }
  const target = tableWidget.querySelector(selectorParts.join(""));
  return target instanceof HTMLElement ? target : null;
};

const moveTableCellEditorVerticalFocus = (cellEditor, direction = 1) => {
  const cellIdentity = tableCellEditorIdentityOf(cellEditor);
  if (!cellIdentity) {
    return false;
  }

  const tableWidget = cellEditor.closest(".cm-table-widget");
  if (!(tableWidget instanceof Element)) {
    return false;
  }

  const currentVisualRowIndex = tableVisualRowIndexOf(cellIdentity);
  const maxVisualRowIndex = Math.max(0, resolveMaxTableBodyRowIndex(tableWidget) + 1);
  const targetVisualRowIndex = currentVisualRowIndex + (direction < 0 ? -1 : 1);
  if (targetVisualRowIndex < 0 || targetVisualRowIndex > maxVisualRowIndex) {
    return false;
  }
  const textOffset = resolveTableCellSelectionTextOffset(cellEditor);
  const target = resolveTableCellEditorAt(
    tableWidget,
    cellIdentity.blockId,
    targetVisualRowIndex,
    cellIdentity.colIndex
  );
  if (!target) {
    return false;
  }

  return focusTableCellEditorElement(target, textOffset);
};

const moveCursorOutsideTableFromCellEditor = (cellEditor, direction = 1) => {
  if (!(cellEditor instanceof HTMLElement)) {
    return false;
  }

  const cellIdentity = tableCellEditorIdentityOf(cellEditor);
  if (!cellIdentity?.blockId || !Number.isFinite(cellIdentity.colIndex)) {
    return false;
  }

  const view = EditorView.findFromDOM(cellEditor);
  if (!view) {
    return false;
  }

  const blockRange = resolveTableBlockRangeById(view, cellIdentity.blockId);
  if (!blockRange) {
    return false;
  }
  cellEditor.setAttribute(TABLE_CELL_SKIP_FOCUSOUT_COMMIT_ATTR, "1");

  const text = markdownFromTableCellEditor(cellEditor);
  setTableCellEditorSourceText(cellEditor, text);
  let persistedBlockTo = blockRange.to;
  const model = parseMarkdownTableModel(blockRange.rawText);
  if (model) {
    const nextModel = updateTableCellByPosition(model, {
      section: cellIdentity.section,
      rowIndex: cellIdentity.section === "body" ? cellIdentity.rowIndex : 0,
      colIndex: cellIdentity.colIndex,
      text
    });
    const nextRaw = serializeMarkdownTableModel(nextModel);
    if (nextRaw && nextRaw !== blockRange.rawText) {
      view.dispatch({
        changes: {
          from: blockRange.from,
          to: blockRange.to,
          insert: nextRaw
        },
        userEvent: "input"
      });
      persistedBlockTo = blockRange.from + nextRaw.length;
    }
  }

  try {
    cellEditor.blur();
  } catch {
    // ignore
  }
  const docLength = Number(view.state.doc.length || 0);
  const cursorRaw = cursorOutsideRange(
    docLength,
    blockRange.from,
    clampPos(persistedBlockTo, docLength),
    direction
  );
  const cursor = resolveNearestVisibleCursorPos(view, cursorRaw, direction);
  view.dispatch({
    selection: {
      anchor: cursor,
      head: cursor
    },
    scrollIntoView: true
  });
  view.focus();
  return true;
};

const moveArrayItem = (itemsInput, fromIndexInput, toIndexInput) => {
  const items = Array.isArray(itemsInput) ? itemsInput.slice() : [];
  if (!items.length) {
    return items;
  }

  const fromIndex = clampIndex(fromIndexInput, 0, items.length - 1);
  const toIndex = clampIndex(toIndexInput, 0, items.length - 1);
  if (fromIndex === toIndex) {
    return items;
  }

  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  return items;
};

const appendTableColumnRight = (modelInput) => {
  const columnCount = Math.max(1, Number(modelInput?.headers?.length || 0));
  const headers = Array.from({ length: columnCount }, (_, index) => String(modelInput?.headers?.[index] || ""));
  const alignments = Array.from({ length: columnCount }, (_, index) => String(modelInput?.alignments?.[index] || ""));
  const rows = Array.isArray(modelInput?.rows) ? modelInput.rows : [];

  return {
    ...modelInput,
    headers: [...headers, ""],
    alignments: [...alignments, ""],
    rows: rows.map((row) => [...Array.from({ length: columnCount }, (_, index) => String(row?.[index] || "")), ""])
  };
};

const appendTableRowBottom = (modelInput) => {
  const columnCount = Math.max(1, Number(modelInput?.headers?.length || 0));
  const rows = Array.isArray(modelInput?.rows) ? modelInput.rows : [];
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => String(row?.[index] || ""))
  );

  return {
    ...modelInput,
    rows: [...normalizedRows, Array.from({ length: columnCount }, () => "")]
  };
};

const moveTableRow = (modelInput, fromIndexInput, toIndexInput) => {
  const rows = Array.isArray(modelInput?.rows) ? modelInput.rows : [];
  if (rows.length <= 1) {
    return modelInput;
  }

  const columnCount = Math.max(1, Number(modelInput?.headers?.length || 0));
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => String(row?.[index] || ""))
  );
  const fromIndex = clampIndex(fromIndexInput, 0, normalizedRows.length - 1);
  const toIndex = clampIndex(toIndexInput, 0, normalizedRows.length - 1);
  if (fromIndex === toIndex) {
    return modelInput;
  }

  return {
    ...modelInput,
    rows: moveArrayItem(normalizedRows, fromIndex, toIndex)
  };
};

const moveTableColumn = (modelInput, fromIndexInput, toIndexInput) => {
  const columnCount = Math.max(1, Number(modelInput?.headers?.length || 0));
  if (columnCount <= 1) {
    return modelInput;
  }

  const fromIndex = clampIndex(fromIndexInput, 0, columnCount - 1);
  const toIndex = clampIndex(toIndexInput, 0, columnCount - 1);
  if (fromIndex === toIndex) {
    return modelInput;
  }

  const headers = Array.from({ length: columnCount }, (_, index) => String(modelInput?.headers?.[index] || ""));
  const alignments = Array.from({ length: columnCount }, (_, index) => String(modelInput?.alignments?.[index] || ""));
  const rows = Array.isArray(modelInput?.rows) ? modelInput.rows : [];
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => String(row?.[index] || ""))
  );

  return {
    ...modelInput,
    headers: moveArrayItem(headers, fromIndex, toIndex),
    alignments: moveArrayItem(alignments, fromIndex, toIndex),
    rows: normalizedRows.map((row) => moveArrayItem(row, fromIndex, toIndex))
  };
};

const normalizeTableCellEditorText = (textInput) =>
  String(textInput ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\r?\n/g, " ");

const TABLE_CELL_SOURCE_ATTR = "data-table-source-text";
const TABLE_CELL_SOURCE_MODE_ATTR = "data-table-source-mode";
const TABLE_CELL_SKIP_FOCUSOUT_COMMIT_ATTR = "data-table-skip-focusout-commit";

const tableCellEditorInSourceMode = (cellEditor) =>
  cellEditor instanceof HTMLElement
  && String(cellEditor.getAttribute(TABLE_CELL_SOURCE_MODE_ATTR) || "") === "1";

const setTableCellEditorSourceText = (cellEditor, textInput = "") => {
  if (!(cellEditor instanceof HTMLElement)) {
    return "";
  }
  const sourceText = normalizeTableCellEditorText(textInput);
  cellEditor.setAttribute(TABLE_CELL_SOURCE_ATTR, sourceText);
  return sourceText;
};

const tableCellEditorSourceTextOf = (cellEditor) => {
  if (!(cellEditor instanceof HTMLElement)) {
    return "";
  }
  const sourceAttr = cellEditor.getAttribute(TABLE_CELL_SOURCE_ATTR);
  if (typeof sourceAttr === "string") {
    return normalizeTableCellEditorText(sourceAttr);
  }
  return normalizeTableCellEditorText(cellEditor.textContent || "");
};

const renderTableCellEditorFromMarkdown = (cellEditor, sourceInput = "") => {
  if (!(cellEditor instanceof HTMLElement)) {
    return false;
  }
  const sourceText = setTableCellEditorSourceText(cellEditor, sourceInput);
  cellEditor.innerHTML = renderTableCellInlineHtml(sourceText);
  cellEditor.setAttribute(TABLE_CELL_SOURCE_MODE_ATTR, "0");
  return true;
};

const enterTableCellEditorSourceMode = (cellEditor) => {
  if (!(cellEditor instanceof HTMLElement) || tableCellEditorInSourceMode(cellEditor)) {
    return false;
  }

  const textOffset = resolveTableCellSelectionTextOffset(cellEditor);
  const sourceText = tableCellEditorSourceTextOf(cellEditor);
  cellEditor.textContent = sourceText;
  cellEditor.setAttribute(TABLE_CELL_SOURCE_MODE_ATTR, "1");
  placeCaretAtTextOffsetInTableCell(cellEditor, textOffset);
  return true;
};

const updateTableCellByPosition = (
  modelInput,
  {
    section = "body",
    rowIndex: rowIndexInput = 0,
    colIndex: colIndexInput = 0,
    text = ""
  } = {}
) => {
  const headers = Array.isArray(modelInput?.headers) ? modelInput.headers : [];
  const columnCount = Math.max(1, Number(headers.length || 0));
  const colIndex = clampIndex(colIndexInput, 0, columnCount - 1);
  const nextText = normalizeTableCellEditorText(text);

  if (section === "header") {
    const nextHeaders = Array.from({ length: columnCount }, (_, index) => String(headers[index] || ""));
    if (nextHeaders[colIndex] === nextText) {
      return modelInput;
    }
    nextHeaders[colIndex] = nextText;
    return {
      ...modelInput,
      headers: nextHeaders
    };
  }

  const rows = Array.isArray(modelInput?.rows) ? modelInput.rows : [];
  if (!rows.length) {
    return modelInput;
  }

  const rowIndex = clampIndex(rowIndexInput, 0, rows.length - 1);
  const nextRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => String(row?.[index] || ""))
  );
  if (nextRows[rowIndex][colIndex] === nextText) {
    return modelInput;
  }
  nextRows[rowIndex][colIndex] = nextText;
  return {
    ...modelInput,
    rows: nextRows
  };
};

const bindTableCellEditorDomEvents = (cellEditor) => {
  if (!(cellEditor instanceof HTMLElement)) {
    return;
  }

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  cellEditor.addEventListener("mousedown", stopBubble);
  cellEditor.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      event.preventDefault();
    }
    stopBubble(event);
  });
  cellEditor.addEventListener("focus", (event) => {
    stopBubble(event);
    enterTableCellEditorSourceMode(cellEditor);
  });
  cellEditor.addEventListener("copy", stopBubble);
  cellEditor.addEventListener("cut", stopBubble);
  cellEditor.addEventListener("paste", (event) => {
    stopBubble(event);
    const pastedText = event.clipboardData?.getData("text/plain");
    if (typeof pastedText !== "string") {
      return;
    }
    event.preventDefault();
    insertPlainTextIntoTableCellEditor(cellEditor, pastedText);
  });
  cellEditor.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (isPlainTableClipboardShortcutEvent(event)) {
      return;
    }
    if (isPlainTableVerticalArrowEvent(event)) {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      if (!moveTableCellEditorVerticalFocus(cellEditor, direction)) {
        if (!moveCursorOutsideTableFromCellEditor(cellEditor, direction)) {
          cellEditor.blur();
        }
      }
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      cellEditor.blur();
    }
  });
};

const tableInlineNodesToMarkdown = (nodesInput = []) => {
  const nodes = Array.isArray(nodesInput) ? nodesInput : [];
  let result = "";

  for (const node of nodes) {
    if (node?.nodeType === Node.TEXT_NODE) {
      result += normalizeTableCellEditorText(node.nodeValue || "");
      continue;
    }
    if (node?.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const element = node;
    const tag = String(element.tagName || "").toUpperCase();
    const inner = tableInlineNodesToMarkdown(Array.from(element.childNodes || []));

    if (tag === "BR") {
      result += " ";
      continue;
    }
    if (tag === "STRONG" || tag === "B") {
      result += inner ? `**${inner}**` : "";
      continue;
    }
    if (tag === "EM" || tag === "I") {
      result += inner ? `*${inner}*` : "";
      continue;
    }
    if (tag === "U") {
      result += inner ? `<u>${inner}</u>` : "";
      continue;
    }
    if (tag === "DEL" || tag === "S") {
      result += inner ? `~~${inner}~~` : "";
      continue;
    }
    if (tag === "MARK") {
      result += inner ? `==${inner}==` : "";
      continue;
    }
    if (tag === "SUP") {
      result += inner ? `<sup>${inner}</sup>` : "";
      continue;
    }
    if (tag === "SUB") {
      result += inner ? `<sub>${inner}</sub>` : "";
      continue;
    }
    if (tag === "CODE") {
      const codeText = normalizeTableCellEditorText(element.textContent || inner || "");
      result += codeText ? `\`${codeText.replace(/`/g, "\\`")}\`` : "";
      continue;
    }
    if (tag === "A") {
      const label = inner || normalizeTableCellEditorText(element.textContent || "");
      const href = safeTableLinkHref(element.getAttribute("href"));
      const title = String(element.getAttribute("title") || "").trim();
      if (!href) {
        result += label;
        continue;
      }
      const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
      result += `[${label}](${href}${titlePart})`;
      continue;
    }

    result += inner;
  }

  return result;
};

const markdownFromTableCellEditor = (cellEditor) => {
  if (!(cellEditor instanceof HTMLElement)) {
    return "";
  }
  if (tableCellEditorInSourceMode(cellEditor)) {
    return normalizeTableCellEditorText(cellEditor.textContent || "");
  }
  if (typeof Node === "undefined") {
    return normalizeTableCellEditorText(cellEditor.textContent || "");
  }
  return normalizeTableCellEditorText(tableInlineNodesToMarkdown(Array.from(cellEditor.childNodes || [])));
};

class ListPrefixWidget extends WidgetType {
  constructor({ blockType = "", text = "", checked = false } = {}) {
    super();
    this.blockType = String(blockType || "");
    this.text = String(text || "");
    this.checked = Boolean(checked);
  }

  eq(other) {
    return (
      other instanceof ListPrefixWidget
      && other.blockType === this.blockType
      && other.text === this.text
      && other.checked === this.checked
    );
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = `cm-list-prefix-widget cm-list-prefix-${this.blockType.replace(/_/g, "-")}`;
    span.textContent = this.text;
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

class CalloutLabelWidget extends WidgetType {
  constructor({ type = "note", showText = false } = {}) {
    super();
    this.type = normalizeCalloutType(type);
    this.label = calloutLabelForType(type);
    this.icon = calloutIconForType(type);
    this.showText = Boolean(showText);
  }

  eq(other) {
    return (
      other instanceof CalloutLabelWidget
      && other.type === this.type
      && other.label === this.label
      && other.icon === this.icon
      && other.showText === this.showText
    );
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = `cm-callout-label-widget cm-callout-label-${this.type}`;
    span.setAttribute("aria-hidden", "true");

    const icon = document.createElement("span");
    icon.className = "cm-callout-label-icon";
    icon.textContent = this.icon;
    span.appendChild(icon);

    if (this.showText) {
      const text = document.createElement("span");
      text.className = "cm-callout-label-text";
      text.textContent = this.label;
      span.appendChild(text);
    }
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor({ checked = false, lineFrom = 0 } = {}) {
    super();
    this.checked = Boolean(checked);
    this.lineFrom = Math.max(0, Number(lineFrom || 0));
  }

  eq(other) {
    return (
      other instanceof TaskCheckboxWidget
      && other.checked === this.checked
      && other.lineFrom === this.lineFrom
    );
  }

  toDOM() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cm-task-checkbox-widget${this.checked ? " is-checked" : ""}`;
    button.setAttribute("data-task-toggle-from", String(this.lineFrom));
    button.setAttribute("aria-label", this.checked ? "Mark task as not done" : "Mark task as done");
    button.textContent = this.checked ? "\u2713" : "";
    return button;
  }

  ignoreEvent() {
    return false;
  }
}

class CodeBlockCopyWidget extends WidgetType {
  constructor({ blockId = "" } = {}) {
    super();
    this.blockId = String(blockId || "");
  }

  eq(other) {
    return other instanceof CodeBlockCopyWidget && other.blockId === this.blockId;
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-code-block-copy-widget";

    const copyButtonEl = document.createElement("button");
    copyButtonEl.type = "button";
    copyButtonEl.className = "cm-code-block-copy-btn";
    copyButtonEl.setAttribute("data-code-block-id", this.blockId);
    copyButtonEl.setAttribute("aria-label", "\u590d\u5236\u4ee3\u7801");

    const copyIconEl = createAppIconSvgElement("copy", "cm-code-block-copy-icon-svg");
    if (copyIconEl) {
      copyButtonEl.appendChild(copyIconEl);
    }

    wrapper.appendChild(copyButtonEl);
    return wrapper;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "cm-code-block-copy-trigger";
    trigger.setAttribute("aria-label", "代码操作");

    const triggerDots = document.createElement("span");
    triggerDots.className = "cm-code-block-copy-trigger-dots";
    triggerDots.setAttribute("aria-hidden", "true");
    trigger.appendChild(triggerDots);

    const menu = document.createElement("span");
    menu.className = "cm-code-block-copy-menu";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-code-block-copy-btn";
    button.setAttribute("data-code-block-id", this.blockId);
    button.setAttribute("aria-label", "复制代码块");

    const icon = createAppIconSvgElement("copy", "cm-code-block-copy-icon-svg");
    button.setAttribute("aria-label", "\u590d\u5236\u4ee3\u7801");

    const label = document.createElement("span");
    label.className = "cm-code-block-copy-label";
    label.textContent = "复制";

    button.appendChild(icon);
    button.appendChild(label);
    menu.appendChild(button);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

const normalizeImageSrc = (src) => {
  const srcStr = String(src || "");
  if (!srcStr) {
    return "";
  }
  return resolveWorkspaceAssetSrc(srcStr, {
    currentRelPath: typeof presentationRuntimeOptions.getCurrentRelPath === "function"
      ? presentationRuntimeOptions.getCurrentRelPath()
      : "",
    workspaceRootPath: typeof presentationRuntimeOptions.getWorkspaceRootPath === "function"
      ? presentationRuntimeOptions.getWorkspaceRootPath()
      : ""
  });
};

class ImageWidget extends WidgetType {
  constructor({ src = "", alt = "", title = "", blockId = "", isExpanded = false, width = DEFAULT_IMAGE_WIDTH } = {}) {
    super();
    this.src = String(src || "");
    this.alt = String(alt || "");
    this.title = title != null ? String(title || "") : "";
    this.blockId = String(blockId || "");
    this.isExpanded = Boolean(isExpanded);
    this.width = normalizeImageWidth(width);
  }

  eq(other) {
    return (
      other instanceof ImageWidget
      && other.src === this.src
      && other.alt === this.alt
      && other.title === this.title
      && other.blockId === this.blockId
      && other.isExpanded === this.isExpanded
      && other.width === this.width
    );
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-image-widget";
    wrapper.setAttribute("data-image-block-id", this.blockId);
    wrapper.style.setProperty("--yc-image-width", `${this.width}px`);
    const frame = document.createElement("span");
    frame.className = "cm-image-widget-frame";

    const img = document.createElement("img");
    img.src = normalizeImageSrc(this.src);
    img.alt = this.alt;
    if (this.title) {
      img.title = this.title;
    }
    img.className = "cm-image-widget-img";

    // Fallback text for broken images.
    img.onerror = () => {
      frame.classList.add("is-image-error");
      if (!frame.querySelector(".cm-image-widget-error")) {
        const errorMsg = document.createElement("span");
        errorMsg.className = "cm-image-widget-error";
        errorMsg.textContent = "[Image load failed]";
        frame.appendChild(errorMsg);
      }
    };

    const toolbar = document.createElement("span");
    toolbar.className = "cm-image-widget-toolbar";

    const handle = document.createElement("span");
    handle.className = "cm-image-widget-resize-handle term-tip-btn";
    handle.setAttribute("data-tip", "拖动调整图片尺寸");
    handle.setAttribute("data-image-block-id", this.blockId);
    handle.setAttribute("data-image-width", String(this.width));
    handle.ondragstart = (event) => {
      event.preventDefault();
    };

    // Toggle source visibility for this image block.
    const btn = document.createElement("span");
    btn.className = "cm-image-widget-btn";
    btn.textContent = this.isExpanded ? SOURCE_TOGGLE_ICON_EXPANDED : SOURCE_TOGGLE_ICON_COLLAPSED;
    btn.setAttribute("data-image-block-id", this.blockId);

    toolbar.appendChild(btn);
    frame.appendChild(img);
    frame.appendChild(toolbar);
    frame.appendChild(handle);
    wrapper.appendChild(frame);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

class MathBlockWidget extends WidgetType {
  constructor({ formula = "", blockId = "", isExpanded = false } = {}) {
    super();
    this.formula = String(formula || "");
    this.blockId = String(blockId || "");
    this.isExpanded = Boolean(isExpanded);
  }

  eq(other) {
    return (
      other instanceof MathBlockWidget
      && other.formula === this.formula
      && other.blockId === this.blockId
      && other.isExpanded === this.isExpanded
    );
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-math-widget";
    wrapper.setAttribute("data-math-block-id", this.blockId);

    const content = document.createElement("span");
    content.className = "cm-math-widget-content";
    try {
      content.innerHTML = renderMathHtml(this.formula, true);
    } catch {
      content.textContent = this.formula || "Math render failed";
    }

    const btn = document.createElement("span");
    btn.className = "cm-math-widget-btn";
    btn.textContent = this.isExpanded ? SOURCE_TOGGLE_ICON_EXPANDED : SOURCE_TOGGLE_ICON_COLLAPSED;
    btn.setAttribute("data-math-block-id", this.blockId);

    wrapper.appendChild(content);
    wrapper.appendChild(btn);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

class TableBlockWidget extends WidgetType {
  constructor({ rawText = "", blockId = "", readOnly = false } = {}) {
    super();
    this.rawText = String(rawText || "");
    this.blockId = String(blockId || "");
    this.readOnly = Boolean(readOnly);
  }

  eq(other) {
    return (
      other instanceof TableBlockWidget
      && other.rawText === this.rawText
      && other.blockId === this.blockId
      && other.readOnly === this.readOnly
    );
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-table-widget";
    wrapper.setAttribute("data-table-block-id", this.blockId);

    const content = document.createElement("span");
    content.className = "cm-table-widget-content";

    const model = parseMarkdownTableModel(this.rawText);
    if (!model) {
      const fallback = document.createElement("span");
      fallback.className = "cm-math-fallback";
      fallback.textContent = "Invalid markdown table";
      content.appendChild(fallback);
    } else {
      const editable = !this.readOnly;
      const tableEl = document.createElement("table");
      tableEl.className = "cm-table-widget-table";

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      model.headers.forEach((cellText, index) => {
        const th = document.createElement("th");
        const align = model.alignments[index];
        if (align) {
          th.setAttribute("data-table-align", align);
        }

        const cellEditor = document.createElement("span");
        cellEditor.className = "cm-table-widget-cell-editor";
        cellEditor.contentEditable = editable ? "true" : "false";
        cellEditor.spellcheck = false;
        cellEditor.tabIndex = editable ? 0 : -1;
        cellEditor.setAttribute("data-table-edit", "true");
        cellEditor.setAttribute("data-table-block-id", this.blockId);
        cellEditor.setAttribute("data-table-section", "header");
        cellEditor.setAttribute("data-table-col-index", String(index));
        renderTableCellEditorFromMarkdown(cellEditor, cellText);
        if (editable) {
          bindTableCellEditorDomEvents(cellEditor);
        }
        th.appendChild(cellEditor);

        const colHandle = document.createElement("button");
        colHandle.type = "button";
        colHandle.className = "cm-table-widget-col-handle";
        colHandle.textContent = "";
        colHandle.setAttribute("aria-label", "拖动移动此列");
        colHandle.setAttribute("data-table-col-handle", "true");
        colHandle.setAttribute("data-table-block-id", this.blockId);
        colHandle.setAttribute("data-table-col-index", String(index));
        th.appendChild(colHandle);

        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      tableEl.appendChild(thead);

      const tbody = document.createElement("tbody");
      model.rows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        row.forEach((cellText, index) => {
          const td = document.createElement("td");
          const align = model.alignments[index];
          if (align) {
            td.setAttribute("data-table-align", align);
          }

          const cellEditor = document.createElement("span");
          cellEditor.className = "cm-table-widget-cell-editor";
          cellEditor.contentEditable = editable ? "true" : "false";
          cellEditor.spellcheck = false;
          cellEditor.tabIndex = editable ? 0 : -1;
          cellEditor.setAttribute("data-table-edit", "true");
          cellEditor.setAttribute("data-table-block-id", this.blockId);
          cellEditor.setAttribute("data-table-section", "body");
          cellEditor.setAttribute("data-table-row-index", String(rowIndex));
          cellEditor.setAttribute("data-table-col-index", String(index));
          renderTableCellEditorFromMarkdown(cellEditor, cellText);
          if (editable) {
            bindTableCellEditorDomEvents(cellEditor);
          }
          td.appendChild(cellEditor);

          if (index === 0) {
            td.classList.add("cm-table-widget-row-anchor");
            const rowHandle = document.createElement("button");
            rowHandle.type = "button";
            rowHandle.className = "cm-table-widget-row-handle";
            rowHandle.textContent = "";
            rowHandle.setAttribute("aria-label", "拖动移动此行");
            rowHandle.setAttribute("data-table-row-handle", "true");
            rowHandle.setAttribute("data-table-block-id", this.blockId);
            rowHandle.setAttribute("data-table-row-index", String(rowIndex));
            td.appendChild(rowHandle);
          }

          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tableEl.appendChild(tbody);
      content.appendChild(tableEl);

      const addColumnBtn = document.createElement("button");
      addColumnBtn.type = "button";
      addColumnBtn.className = "cm-table-widget-edge-btn cm-table-widget-add-col-btn";
      addColumnBtn.textContent = "+";
      addColumnBtn.setAttribute("aria-label", "在右侧插入一列");
      addColumnBtn.setAttribute("data-table-action", "add-column-right");
      addColumnBtn.setAttribute("data-table-block-id", this.blockId);
      wrapper.appendChild(addColumnBtn);

      const addRowBtn = document.createElement("button");
      addRowBtn.type = "button";
      addRowBtn.className = "cm-table-widget-edge-btn cm-table-widget-add-row-btn";
      addRowBtn.textContent = "+";
      addRowBtn.setAttribute("aria-label", "在下方插入一行");
      addRowBtn.setAttribute("data-table-action", "add-row-bottom");
      addRowBtn.setAttribute("data-table-block-id", this.blockId);
      wrapper.appendChild(addRowBtn);

      const dropIndicator = document.createElement("span");
      dropIndicator.className = "cm-table-widget-drop-indicator";
      dropIndicator.setAttribute("data-table-drop-indicator", "true");
      wrapper.appendChild(dropIndicator);
    }

    wrapper.appendChild(content);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

class InlineMathWidget extends WidgetType {
  constructor({ formula = "", from = 0, to = 0 } = {}) {
    super();
    this.formula = String(formula || "");
    this.from = Number(from || 0);
    this.to = Number(to || this.from);
  }

  eq(other) {
    return (
      other instanceof InlineMathWidget
      && other.formula === this.formula
      && other.from === this.from
      && other.to === this.to
    );
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-inline-math-widget term-tip-btn";
    wrapper.setAttribute("data-math-inline-from", String(this.from));
    wrapper.setAttribute("data-math-inline-to", String(this.to));
    wrapper.setAttribute("data-tip", "点击编辑公式源码");
    try {
      wrapper.innerHTML = renderMathHtml(this.formula, false);
    } catch {
      wrapper.textContent = this.formula || "Formula render failed";
    }
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

const inlineClassesForSegment = (segment) => {
  const marks = Array.isArray(segment?.marks) ? segment.marks : [];
  const classes = [];

  if (marks.includes("em")) {
    classes.push("cm-inline-em");
  }
  if (marks.includes("strong")) {
    classes.push("cm-inline-strong");
  }
  if (marks.includes("del")) {
    classes.push("cm-inline-del");
  }
  if (marks.includes("codespan")) {
    classes.push("cm-inline-codespan");
  }
  if (marks.includes("link")) {
    classes.push("cm-inline-link");
  }

  return classes.join(" ");
};

const selectionSnapshotOf = (state) => {
  const docLength = Number(state.doc.length || 0);
  const main = state.selection.main;
  const anchor = clampPos(main.anchor, docLength);
  const head = clampPos(main.head, docLength);
  const from = Math.min(anchor, head);
  const to = Math.max(anchor, head);
  return {
    anchor,
    head,
    from,
    to,
    empty: from === to
  };
};

const normalizeTokenRange = (token, docLength) => {
  const rawFrom = clampPos(token?.rawFrom, docLength);
  const rawTo = clampPos(token?.rawTo, docLength);
  const boundedRawFrom = Math.min(rawFrom, rawTo);
  const boundedRawTo = Math.max(rawFrom, rawTo);
  const textFromBase = clampPos(token?.textFrom, docLength);
  const textToBase = clampPos(token?.textTo, docLength);
  const textFrom = Math.max(boundedRawFrom, Math.min(boundedRawTo, textFromBase));
  const textTo = Math.max(textFrom, Math.min(boundedRawTo, textToBase));
  return {
    rawFrom: boundedRawFrom,
    rawTo: boundedRawTo,
    textFrom,
    textTo
  };
};

const tokenIdentity = (token) =>
  [
    token.type,
    token.rawFrom,
    token.rawTo,
    token.textFrom,
    token.textTo,
    token.depth
  ].join(":");

const collectInlineSyntaxTokens = (tokens, docLength, depth = 0, output = []) => {
  for (const token of Array.isArray(tokens) ? tokens : []) {
    const type = String(token?.type || "");
    const range = normalizeTokenRange(token, docLength);
    if (INLINE_SYNTAX_TOKEN_TYPES.has(type) && range.rawTo > range.rawFrom) {
      const item = {
        type,
        depth,
        rawFrom: range.rawFrom,
        rawTo: range.rawTo,
        textFrom: range.textFrom,
        textTo: range.textTo
      };
      output.push({
        ...item,
        key: tokenIdentity(item)
      });
    }

    if (Array.isArray(token?.children) && token.children.length) {
      collectInlineSyntaxTokens(token.children, docLength, depth + 1, output);
    }
  }
  return output;
};

const selectionIntersectsRange = (selection, fromInput, toInput) => {
  const from = Number(fromInput || 0);
  const to = Math.max(from, Number(toInput || from));
  if (to <= from) {
    return false;
  }

  if (selection.empty) {
    return selection.head >= from && selection.head <= to;
  }
  return selection.from < to && selection.to > from;
};

const pickActiveInlineSyntaxToken = (blocks, selection, docLength) => {
  const candidates = [];

  for (const block of blocks) {
    const tokens = collectInlineSyntaxTokens(block?.inlineTokens, docLength);
    for (const token of tokens) {
      if (!selectionIntersectsRange(selection, token.rawFrom, token.rawTo)) {
        continue;
      }
      candidates.push(token);
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => {
    const leftSpan = left.rawTo - left.rawFrom;
    const rightSpan = right.rawTo - right.rawFrom;
    if (leftSpan !== rightSpan) {
      return leftSpan - rightSpan;
    }
    if (left.depth !== right.depth) {
      return right.depth - left.depth;
    }
    return left.rawFrom - right.rawFrom;
  });

  return candidates[0];
};

const headingPrefixRangeForBlock = (block, docLength) => {
  if (block?.type !== "heading") {
    return null;
  }

  const firstLine = String(block?.rawText || "").split("\n")[0] || "";
  const match = firstLine.match(HEADING_PREFIX_PATTERN);
  if (!match) {
    return null;
  }

  const from = clampPos(block?.from, docLength);
  const to = clampPos(from + match[0].length, docLength);
  if (to <= from) {
    return null;
  }

  return {
    from,
    to
  };
};

const HEADING_SUBTITLE_META_PATTERN = /^\s*<!--\s*yc-heading-subtitle\s*:/i;

const addHiddenSyntaxRangeDecoration = (decorations, from, to) => {
  if (to <= from) {
    return;
  }
  decorations.push(Decoration.replace({}).range(from, to));
};

const isHeadingSubtitleMetaBlock = (block, doc) => {
  if (block?.type !== "html_block") {
    return false;
  }
  return HEADING_SUBTITLE_META_PATTERN.test(String(doc.sliceString(block.from, block.to) || ""));
};

const addHiddenSyntaxRangeDecorationsByLine = (decorations, doc, fromInput, toInput, docLength) => {
  const from = clampPos(fromInput, docLength);
  const to = clampPos(toInput, docLength);
  if (to <= from) {
    return;
  }

  const fromLine = doc.lineAt(from).number;
  const toLine = doc.lineAt(Math.max(from, to - 1)).number;
  for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const rangeFrom = Math.max(line.from, from);
    const rangeTo = Math.min(line.to, to);
    if (rangeTo <= rangeFrom) {
      continue;
    }
    addHiddenSyntaxRangeDecoration(decorations, rangeFrom, rangeTo);
  }
};

const addHiddenSyntaxDecorationsForToken = (decorations, token) => {
  const leftFrom = token.rawFrom;
  const leftTo = Math.max(leftFrom, Math.min(token.rawTo, token.textFrom));
  addHiddenSyntaxRangeDecoration(decorations, leftFrom, leftTo);

  const rightFrom = Math.max(token.rawFrom, Math.min(token.rawTo, token.textTo));
  const rightTo = token.rawTo;
  addHiddenSyntaxRangeDecoration(decorations, rightFrom, rightTo);
};

const listPrefixMatchForLine = (blockType, lineText) => {
  if (blockType === "task_list_item") {
    return String(lineText || "").match(TASK_LIST_PREFIX_PATTERN);
  }
  if (blockType === "ordered_list_item") {
    return String(lineText || "").match(ORDERED_LIST_PREFIX_PATTERN);
  }
  if (blockType === "bullet_list_item") {
    return String(lineText || "").match(BULLET_LIST_PREFIX_PATTERN);
  }
  return null;
};

const listPrefixLabelForBlock = (block, match) => {
  if (block?.type === "ordered_list_item") {
    const marker = String(block?.attrs?.marker || match?.[3] || ".");
    const index = Math.max(1, Number(block?.attrs?.index || match?.[2] || 1));
    return `${index}${marker}`;
  }
  return "\u2022";
};

const addListPrefixDecorationsForBlock = (decorations, doc, block, docLength) => {
  const fromPos = clampPos(block?.from, docLength);
  const line = doc.lineAt(fromPos);
  const match = listPrefixMatchForLine(block?.type, line.text);
  if (!match) {
    return;
  }
  const prefixFrom = line.from;
  const prefixTo = Math.min(line.to, line.from + match[0].length);
  if (prefixTo <= prefixFrom) {
    return;
  }
  addHiddenSyntaxRangeDecoration(decorations, prefixFrom, prefixTo);
  if (String(block?.type || "") === "task_list_item") {
    decorations.push(
      Decoration.widget({
        widget: new TaskCheckboxWidget({
          checked: Boolean(block?.attrs?.checked),
          lineFrom: line.from
        }),
        side: -1
      }).range(prefixTo)
    );
    return;
  }
  decorations.push(
    Decoration.widget({
      widget: new ListPrefixWidget({
        blockType: String(block?.type || ""),
        text: listPrefixLabelForBlock(block, match),
        checked: false
      }),
      side: -1
    }).range(prefixTo)
  );
};

const addBlockquotePrefixDecorationsForBlock = (decorations, doc, block, docLength) => {
  const fromPos = clampPos(block?.from, docLength);
  const toPos = clampPos(block?.to, docLength);
  if (toPos <= fromPos) {
    return;
  }
  const fromLine = doc.lineAt(fromPos).number;
  const toLine = doc.lineAt(Math.max(fromPos, toPos - 1)).number;
  const isCallout = Boolean(block?.attrs?.callout);
  const calloutType = normalizeCalloutType(block?.attrs?.calloutType);
  const calloutTitle = String(block?.attrs?.calloutTitle || "").trim();

  for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const match = String(line.text || "").match(BLOCKQUOTE_PREFIX_PATTERN);
    if (!match) {
      continue;
    }
    const prefixFrom = line.from;
    const prefixTo = Math.min(line.to, line.from + match[0].length);
    addHiddenSyntaxRangeDecoration(decorations, prefixFrom, prefixTo);

    if (!isCallout || lineNumber !== fromLine) {
      continue;
    }

    const calloutMatch = String(line.text || "").match(CALLOUT_MARKER_WITH_PREFIX_PATTERN);
    if (!calloutMatch) {
      continue;
    }

    const quotePrefix = String(calloutMatch[1] || "");
    const fullMarker = String(calloutMatch[0] || "");
    const markerFrom = Math.min(line.to, line.from + quotePrefix.length);
    const markerTo = Math.min(line.to, line.from + fullMarker.length);
    if (markerTo <= markerFrom) {
      continue;
    }

    addHiddenSyntaxRangeDecoration(decorations, markerFrom, markerTo);
    decorations.push(
      Decoration.widget({
        widget: new CalloutLabelWidget({
          type: calloutType,
          showText: !calloutTitle
        }),
        side: -1
      }).range(markerTo)
    );
  }
};

const isTokenRelatedToActiveToken = (token, activeToken) => {
  if (!activeToken) {
    return false;
  }
  const tokenInsideActive = token.rawFrom >= activeToken.rawFrom && token.rawTo <= activeToken.rawTo;
  const tokenContainsActive = token.rawFrom <= activeToken.rawFrom && token.rawTo >= activeToken.rawTo;
  return tokenInsideActive || tokenContainsActive;
};

const addInlineMathPreviewDecorationForToken = (decorations, doc, token, docLength) => {
  const rawFrom = clampPos(token?.rawFrom, docLength);
  const rawTo = clampPos(token?.rawTo, docLength);
  if (rawTo <= rawFrom) {
    return;
  }

  const textFrom = clampPos(token?.textFrom, docLength);
  const textTo = clampPos(token?.textTo, docLength);
  const formula = doc.sliceString(textFrom, textTo);

  addHiddenSyntaxRangeDecoration(decorations, rawFrom, rawTo);
  decorations.push(
    Decoration.widget({
      widget: new InlineMathWidget({
        formula,
        from: rawFrom,
        to: rawTo
      }),
      side: 1
    }).range(rawTo)
  );
};

const inlineClassForSyntaxToken = (tokenTypeInput) => {
  const tokenType = String(tokenTypeInput || "");
  if (tokenType === "wikilink") {
    return "cm-inline-link";
  }
  if (tokenType === "mark") {
    return "cm-inline-mark";
  }
  if (tokenType === "comment") {
    return "cm-inline-comment";
  }
  return "";
};

const addInlineSyntaxMarkDecorationForToken = (decorations, token, docLength, className) => {
  const cls = String(className || "").trim();
  if (!cls) {
    return;
  }
  const from = clampPos(token?.textFrom, docLength);
  const to = clampPos(token?.textTo, docLength);
  if (to <= from) {
    return;
  }
  decorations.push(
    Decoration.mark({
      class: cls
    }).range(from, to)
  );
};

const addSourceSyntaxMarkDecoration = (decorations, fromInput, toInput, className) => {
  const from = Number(fromInput || 0);
  const to = Number(toInput || 0);
  const cls = String(className || "").trim();
  if (to <= from || !cls) {
    return;
  }
  decorations.push(
    Decoration.mark({
      class: cls
    }).range(from, to)
  );
};

const addMathFormulaTokenMarks = (decorations, formulaText, formulaFrom) => {
  const formula = String(formulaText || "");
  const baseFrom = Number(formulaFrom || 0);
  if (!formula) {
    return;
  }

  for (const match of formula.matchAll(/\\[A-Za-z]+/g)) {
    const raw = String(match[0] || "");
    if (!raw) {
      continue;
    }
    const start = baseFrom + Number(match.index || 0);
    addSourceSyntaxMarkDecoration(decorations, start, start + raw.length, "cm-source-math-command");
  }

  for (const match of formula.matchAll(/\b\d+(?:\.\d+)?\b/g)) {
    const raw = String(match[0] || "");
    if (!raw) {
      continue;
    }
    const start = baseFrom + Number(match.index || 0);
    addSourceSyntaxMarkDecoration(decorations, start, start + raw.length, "cm-source-math-number");
  }

  for (const match of formula.matchAll(/[+\-*/=^_()[\]{}<>]/g)) {
    const raw = String(match[0] || "");
    if (!raw) {
      continue;
    }
    const start = baseFrom + Number(match.index || 0);
    addSourceSyntaxMarkDecoration(decorations, start, start + raw.length, "cm-source-math-operator");
  }
};

const addWikiLinkSourceSyntaxDecorationsForToken = (decorations, token) => {
  const rawFrom = Number(token?.rawFrom || 0);
  const rawTo = Number(token?.rawTo || 0);
  if (rawTo <= rawFrom) {
    return;
  }
  addSourceSyntaxMarkDecoration(decorations, rawFrom, rawTo, "cm-source-wikilink-delim");
};

const addImageSourceSyntaxDecorationsForBlock = (decorations, doc, fromInput, toInput, docLength) => {
  const from = clampPos(fromInput, docLength);
  const to = clampPos(toInput, docLength);
  if (to <= from) {
    return;
  }

  const rawLine = doc.sliceString(from, to);
  const leading = rawLine.match(/^\s*/u)?.[0] || "";
  const trailing = rawLine.match(/\s*$/u)?.[0] || "";
  const sourceStart = leading.length;
  const sourceEnd = Math.max(sourceStart, rawLine.length - trailing.length);
  const source = rawLine.slice(sourceStart, sourceEnd);
  if (!source.startsWith("![")) {
    return;
  }

  const baseFrom = from + sourceStart;
  const altClose = source.indexOf("](");
  if (altClose < 2) {
    return;
  }

  const srcStart = altClose + 2;
  const closeParen = source.indexOf(")", srcStart);
  if (closeParen < 0) {
    return;
  }

  let srcEnd = srcStart;
  while (srcEnd < closeParen && !/\s/u.test(source[srcEnd])) {
    srcEnd += 1;
  }
  if (srcEnd <= srcStart) {
    return;
  }

  addSourceSyntaxMarkDecoration(decorations, baseFrom, baseFrom + 2, "cm-source-image-delim");
  addSourceSyntaxMarkDecoration(decorations, baseFrom + 2, baseFrom + altClose, "cm-source-image-alt");
  addSourceSyntaxMarkDecoration(decorations, baseFrom + altClose, baseFrom + altClose + 2, "cm-source-image-delim");
  addSourceSyntaxMarkDecoration(decorations, baseFrom + srcStart, baseFrom + srcEnd, "cm-source-image-url");

  let cursor = srcEnd;
  while (cursor < closeParen && /\s/u.test(source[cursor])) {
    cursor += 1;
  }
  if (cursor < closeParen && source[cursor] === "\"") {
    const titleQuoteOpen = cursor;
    const titleQuoteClose = source.indexOf("\"", titleQuoteOpen + 1);
    if (titleQuoteClose > titleQuoteOpen && titleQuoteClose < closeParen + 1) {
      const tail = source.slice(titleQuoteClose + 1, closeParen);
      if (/^\s*$/u.test(tail)) {
        addSourceSyntaxMarkDecoration(
          decorations,
          baseFrom + titleQuoteOpen,
          baseFrom + titleQuoteOpen + 1,
          "cm-source-image-delim"
        );
        addSourceSyntaxMarkDecoration(
          decorations,
          baseFrom + titleQuoteOpen + 1,
          baseFrom + titleQuoteClose,
          "cm-source-image-title"
        );
        addSourceSyntaxMarkDecoration(
          decorations,
          baseFrom + titleQuoteClose,
          baseFrom + titleQuoteClose + 1,
          "cm-source-image-delim"
        );
      }
    }
  }

  addSourceSyntaxMarkDecoration(
    decorations,
    baseFrom + closeParen,
    baseFrom + closeParen + 1,
    "cm-source-image-delim"
  );

  const commentStart = source.indexOf("<!--", closeParen + 1);
  if (commentStart < 0) {
    return;
  }
  const commentEnd = source.indexOf("-->", commentStart + 4);
  if (commentEnd < 0) {
    return;
  }

  addSourceSyntaxMarkDecoration(
    decorations,
    baseFrom + commentStart,
    baseFrom + commentStart + 4,
    "cm-source-image-meta-delim"
  );
  addSourceSyntaxMarkDecoration(
    decorations,
    baseFrom + commentEnd,
    baseFrom + commentEnd + 3,
    "cm-source-image-meta-delim"
  );

  const commentBody = source.slice(commentStart + 4, commentEnd);
  const keyMatch = commentBody.match(/yc-image-width/i);
  if (keyMatch && Number.isFinite(keyMatch.index)) {
    const keyFrom = baseFrom + commentStart + 4 + Number(keyMatch.index || 0);
    const keyTo = keyFrom + String(keyMatch[0] || "").length;
    addSourceSyntaxMarkDecoration(decorations, keyFrom, keyTo, "cm-source-image-meta-key");
  }

  const numberMatch = commentBody.match(/:\s*(\d+)/);
  if (numberMatch && Number.isFinite(numberMatch.index)) {
    const fullStart = baseFrom + commentStart + 4 + Number(numberMatch.index || 0);
    const colonOffset = String(numberMatch[0] || "").indexOf(":");
    if (colonOffset >= 0) {
      const colonFrom = fullStart + colonOffset;
      addSourceSyntaxMarkDecoration(decorations, colonFrom, colonFrom + 1, "cm-source-image-meta-delim");
    }
    const value = String(numberMatch[1] || "");
    const valueOffset = String(numberMatch[0] || "").lastIndexOf(value);
    if (value && valueOffset >= 0) {
      const valueFrom = fullStart + valueOffset;
      addSourceSyntaxMarkDecoration(
        decorations,
        valueFrom,
        valueFrom + value.length,
        "cm-source-image-meta-number"
      );
    }
  }
};

const addMathSourceSyntaxDecorationsForBlock = (decorations, doc, fromInput, toInput, docLength) => {
  const from = clampPos(fromInput, docLength);
  const to = clampPos(toInput, docLength);
  if (to <= from) {
    return;
  }

  const fromLine = doc.lineAt(from).number;
  const toLine = doc.lineAt(Math.max(from, to - 1)).number;

  if (fromLine === toLine) {
    const line = doc.line(fromLine);
    const segmentFrom = Math.max(line.from, from);
    const segmentTo = Math.min(line.to, to);
    const raw = doc.sliceString(segmentFrom, segmentTo);
    const leading = raw.match(/^\s*/u)?.[0] || "";
    const trailing = raw.match(/\s*$/u)?.[0] || "";
    const sourceStart = leading.length;
    const sourceEnd = Math.max(sourceStart, raw.length - trailing.length);
    const source = raw.slice(sourceStart, sourceEnd);
    if (!(source.startsWith("$$") && source.endsWith("$$") && source.length >= 4)) {
      return;
    }

    const baseFrom = segmentFrom + sourceStart;
    const closeStart = source.length - 2;
    addSourceSyntaxMarkDecoration(decorations, baseFrom, baseFrom + 2, "cm-source-math-delim");
    addMathFormulaTokenMarks(decorations, source.slice(2, closeStart), baseFrom + 2);
    addSourceSyntaxMarkDecoration(
      decorations,
      baseFrom + closeStart,
      baseFrom + closeStart + 2,
      "cm-source-math-delim"
    );
    return;
  }

  const firstLine = doc.line(fromLine);
  const firstFrom = Math.max(firstLine.from, from);
  const firstTo = Math.min(firstLine.to, to);
  const firstRaw = doc.sliceString(firstFrom, firstTo);
  const firstLeading = firstRaw.match(/^\s*/u)?.[0] || "";
  const firstBaseFrom = firstFrom + firstLeading.length;
  const firstTrimmed = firstRaw.trim();
  const firstMarker = firstTrimmed.indexOf("$$");
  if (firstMarker >= 0) {
    addSourceSyntaxMarkDecoration(
      decorations,
      firstBaseFrom + firstMarker,
      firstBaseFrom + firstMarker + 2,
      "cm-source-math-delim"
    );
  }

  for (let lineNumber = fromLine + 1; lineNumber < toLine; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const lineRaw = doc.sliceString(line.from, line.to);
    const lineLeading = lineRaw.match(/^\s*/u)?.[0] || "";
    const lineTrailing = lineRaw.match(/\s*$/u)?.[0] || "";
    const lineStart = lineLeading.length;
    const lineEnd = Math.max(lineStart, lineRaw.length - lineTrailing.length);
    if (lineEnd <= lineStart) {
      continue;
    }
    const formulaText = lineRaw.slice(lineStart, lineEnd);
    addMathFormulaTokenMarks(decorations, formulaText, line.from + lineStart);
  }

  const lastLine = doc.line(toLine);
  const lastFrom = Math.max(lastLine.from, from);
  const lastTo = Math.min(lastLine.to, to);
  const lastRaw = doc.sliceString(lastFrom, lastTo);
  const lastLeading = lastRaw.match(/^\s*/u)?.[0] || "";
  const lastBaseFrom = lastFrom + lastLeading.length;
  const lastTrimmed = lastRaw.trim();
  const lastMarker = lastTrimmed.indexOf("$$");
  if (lastMarker >= 0) {
    addSourceSyntaxMarkDecoration(
      decorations,
      lastBaseFrom + lastMarker,
      lastBaseFrom + lastMarker + 2,
      "cm-source-math-delim"
    );
  }
};

const addMathSourceSyntaxDecorationsWithoutBlocks = (decorations, doc, docLength) => {
  const totalLines = Number(doc?.lines || 0);
  if (totalLines <= 0 || docLength <= 0) {
    return;
  }

  let lineNumber = 1;
  while (lineNumber <= totalLines) {
    const line = doc.line(lineNumber);
    const lineText = doc.sliceString(line.from, line.to);

    if (SINGLE_LINE_MATH_BLOCK_PATTERN.test(lineText)) {
      addMathSourceSyntaxDecorationsForBlock(decorations, doc, line.from, line.to, docLength);
      lineNumber += 1;
      continue;
    }

    if (!OPEN_MATH_FENCE_PATTERN.test(lineText)) {
      lineNumber += 1;
      continue;
    }

    const blockFrom = line.from;
    let blockEndLine = lineNumber;
    for (let cursor = lineNumber + 1; cursor <= totalLines; cursor += 1) {
      blockEndLine = cursor;
      const nextLine = doc.line(cursor);
      const nextText = doc.sliceString(nextLine.from, nextLine.to);
      if (OPEN_MATH_FENCE_PATTERN.test(nextText)) {
        break;
      }
    }
    const blockTo = doc.line(blockEndLine).to;
    addMathSourceSyntaxDecorationsForBlock(decorations, doc, blockFrom, blockTo, docLength);
    lineNumber = blockEndLine + 1;
  }
};

export const setPresentationDataEffect = StateEffect.define();

// Toggle hidden-source preview for image/math blocks.
export const toggleImageExpandEffect = StateEffect.define();
export const toggleMathExpandEffect = StateEffect.define();
export const setImageWidthEffect = StateEffect.define();
export const setContextHighlightBlockEffect = StateEffect.define();

const presentationDataField = StateField.define({
  create: () => normalizePresentationData(),
  update: (value, transaction) => {
    let next = value;
    for (const effect of transaction.effects) {
      if (effect.is(setPresentationDataEffect)) {
        next = normalizePresentationData(effect.value);
      }
    }
    return next;
  }
});

// Expanded image block keys.
const imageExpandField = StateField.define({
  create: () => new Set(),
  update: (value, transaction) => {
    let next = new Set(value);
    for (const effect of transaction.effects) {
      if (effect.is(toggleImageExpandEffect)) {
        const imageId = String(effect.value || "");
        if (next.has(imageId)) {
          next.delete(imageId);
        } else {
          next.add(imageId);
        }
        continue;
      }
      if (effect.is(setPresentationDataEffect)) {
        const blocks = Array.isArray(effect.value?.blocks) ? effect.value.blocks : [];
        const validImageIds = new Set(
          blocks
            .map((block) => imageExpandKeyOf(block))
            .filter(Boolean)
        );
        next = validImageIds.size
          ? new Set([...next].filter((id) => validImageIds.has(id)))
          : new Set();
      }
    }
    return next;
  }
});

const contextHighlightField = StateField.define({
  create: () => "",
  update: (value, transaction) => {
    let next = String(value || "");
    for (const effect of transaction.effects) {
      if (effect.is(setContextHighlightBlockEffect)) {
        next = String(effect.value || "");
        continue;
      }
      if (effect.is(setPresentationDataEffect)) {
        const blocks = Array.isArray(effect.value?.blocks) ? effect.value.blocks : [];
        const validBlockIds = new Set(blocks.map((block) => blockIdentityOf(block)).filter(Boolean));
        if (!validBlockIds.has(next)) {
          next = "";
        }
      }
    }
    return next;
  }
});

const imageWidthField = StateField.define({
  create: () => new Map(),
  update: (value, transaction) => {
    let next = new Map(value);
    for (const effect of transaction.effects) {
      if (effect.is(setImageWidthEffect)) {
        const blockId = String(effect.value?.blockId || "");
        const width = normalizeImageWidth(effect.value?.width, Number.NaN);
        if (blockId && Number.isFinite(width)) {
          next.set(blockId, width);
        }
        continue;
      }
      if (effect.is(setPresentationDataEffect)) {
        const blocks = Array.isArray(effect.value?.blocks) ? effect.value.blocks : [];
        const hydrated = new Map();
        for (const block of blocks) {
          const imageId = imageExpandKeyOf(block);
          if (!imageId) {
            continue;
          }
          const widthFromSource = normalizeImageWidth(block?.attrs?.width, Number.NaN);
          if (Number.isFinite(widthFromSource)) {
            hydrated.set(imageId, widthFromSource);
          }
        }
        next = hydrated;
      }
    }
    return next;
  }
});

const mathExpandField = StateField.define({
  create: () => new Set(),
  update: (value, transaction) => {
    let next = new Set(value);
    for (const effect of transaction.effects) {
      if (effect.is(toggleMathExpandEffect)) {
        const mathId = String(effect.value || "");
        if (next.has(mathId)) {
          next.delete(mathId);
        } else {
          next.add(mathId);
        }
        continue;
      }
      if (effect.is(setPresentationDataEffect)) {
        const blocks = Array.isArray(effect.value?.blocks) ? effect.value.blocks : [];
        const validMathIds = new Set(
          blocks
            .map((block) => mathExpandKeyOf(block))
            .filter(Boolean)
        );
        next = validMathIds.size
          ? new Set([...next].filter((id) => validMathIds.has(id)))
          : new Set();
      }
    }
    return next;
  }
});

const classesForBlockLine = (
  block,
  currentBlockId,
  contextHighlightBlockId,
  lineNumber,
  lineRange,
  sourceVisible = false
) => {
  const classes = [
    "cm-block",
    `cm-block-${String(block.type || "paragraph").replace(/_/g, "-")}`
  ];

  if (lineNumber === lineRange.fromLine) {
    classes.push("cm-block-start");
  }
  if (lineNumber === lineRange.toLine) {
    classes.push("cm-block-end");
  }
  if (String(block.id) === String(currentBlockId || "")) {
    classes.push("cm-block-current");
  }
  if (blockIdentityOf(block) === String(contextHighlightBlockId || "")) {
    classes.push("cm-block-context-current");
  }
  if (sourceVisible) {
    classes.push("cm-block-source-visible");
  }

  if (block.type === "heading") {
    const level = Math.max(1, Math.min(6, Number(block?.attrs?.level || 1)));
    classes.push(`cm-block-heading-l${level}`);
  }
  if (block.type === "task_list_item") {
    classes.push(block?.attrs?.checked ? "cm-task-checked" : "cm-task-unchecked");
  }
  if (block.type === "bullet_list_item" || block.type === "ordered_list_item" || block.type === "task_list_item") {
    const level = Math.max(1, Math.min(6, Number(block?.attrs?.level || 1)));
    classes.push(`cm-list-level-${level}`);
  }
  if (block.type === "blockquote" && block?.attrs?.callout) {
    const calloutType = normalizeCalloutType(block?.attrs?.calloutType);
    classes.push("cm-block-callout");
    classes.push(`cm-block-callout-${calloutType}`);
    if (lineNumber === lineRange.fromLine) {
      classes.push("cm-block-callout-head");
    }
  }

  return classes.join(" ");
};

const buildDecorations = (view, blocks, currentBlockId) => {
  const decorations = [];
  const doc = view.state.doc;
  const docLength = Number(doc.length || 0);
  const readOnly = isEditorReadOnly(view);
  const selection = selectionSnapshotOf(view.state);
  const activeInlineToken = readOnly
    ? null
    : pickActiveInlineSyntaxToken(blocks, selection, docLength);
  const contextHighlightBlockId = view.state.field(contextHighlightField) || "";
  const imageExpandSet = view.state.field(imageExpandField) || new Set();
  const imageWidthMap = view.state.field(imageWidthField) || new Map();
  const mathExpandSet = view.state.field(mathExpandField) || new Set();
  for (const block of blocks) {
    try {
      const blockFrom = clampPos(block?.from, docLength);
      const blockTo = clampPos(block?.to, docLength);
      const blockType = String(block?.type || "");
      const imageExpandKey = imageExpandKeyOf({ type: blockType, from: blockFrom });
      const mathExpandKey = mathExpandKeyOf({ type: blockType, from: blockFrom });
      const tableBlockId = tableExpandKeyOf({ type: blockType, from: blockFrom });
      const isImageExpanded = imageExpandSet.has(imageExpandKey);
      const isMathExpanded = mathExpandSet.has(mathExpandKey);
      const blockSelectionVisible = selectionIntersectsRange(selection, blockFrom, blockTo);
      // Keep source visible for focused source-first block types or expanded media/math blocks.
      const blockKeepsSourceVisible = !readOnly && ((
        (SOURCE_VISIBLE_BLOCK_TYPES.has(blockType) || AUTO_SOURCE_REVEAL_BLOCK_TYPES.has(blockType))
        && blockSelectionVisible
      ) || isImageExpanded || isMathExpanded);
      const hideImageSourceLines = blockType === "image" && !blockKeepsSourceVisible;
      const hideMathSourceLines = blockType === "math_block" && !blockKeepsSourceVisible;
      const hideTableSourceLines = blockType === "table" && !blockKeepsSourceVisible;
      const hideHeadingSubtitleMetaLines = isHeadingSubtitleMetaBlock(block, doc);

      const lineRange = resolveLineRange(doc, block);
      for (let lineNumber = lineRange.fromLine; lineNumber <= lineRange.toLine; lineNumber += 1) {
        const line = doc.line(lineNumber);
        const baseClass = classesForBlockLine(
          block,
          currentBlockId,
          contextHighlightBlockId,
          lineNumber,
          lineRange,
          blockKeepsSourceVisible
        );
        const isImageSourceAnchorLine = hideImageSourceLines && lineNumber === lineRange.fromLine;
        const isImageSourceHiddenLine = hideImageSourceLines && !isImageSourceAnchorLine;
        const isMathSourceHiddenLine = hideMathSourceLines;
        const isTableSourceHiddenLine = hideTableSourceLines;
        const className = [
          baseClass,
          isImageSourceAnchorLine ? "cm-block-image-source-anchor" : "",
          isImageSourceHiddenLine ? "cm-block-image-source-hidden" : "",
          isMathSourceHiddenLine ? "cm-block-math-source-hidden" : "",
          isTableSourceHiddenLine ? "cm-block-table-source-hidden" : "",
          hideHeadingSubtitleMetaLines ? "cm-block-heading-subtitle-hidden" : ""
        ]
          .filter(Boolean)
          .join(" ");
        decorations.push(
          Decoration.line({
            attributes: {
              class: className
            }
          }).range(line.from)
        );
      }

      if (!blockKeepsSourceVisible) {
        if (blockType === "heading") {
          const headingPrefixRange = headingPrefixRangeForBlock(block, docLength);
          if (headingPrefixRange) {
            addHiddenSyntaxRangeDecoration(decorations, headingPrefixRange.from, headingPrefixRange.to);
          }
        } else if (
          blockType === "bullet_list_item"
          || blockType === "ordered_list_item"
          || blockType === "task_list_item"
        ) {
          addListPrefixDecorationsForBlock(decorations, doc, block, docLength);
        } else if (blockType === "blockquote") {
          addBlockquotePrefixDecorationsForBlock(decorations, doc, block, docLength);
        } else if (blockType === "thematic_break") {
          addHiddenSyntaxRangeDecoration(decorations, blockFrom, blockTo);
        } else if (blockType === "image" || blockType === "math_block" || blockType === "table") {
          addHiddenSyntaxRangeDecorationsByLine(decorations, doc, blockFrom, blockTo, docLength);
        } else if (hideHeadingSubtitleMetaLines) {
          addHiddenSyntaxRangeDecorationsByLine(decorations, doc, blockFrom, blockTo, docLength);
        }
      }

      if (blockKeepsSourceVisible) {
        if (blockType === "image") {
          addImageSourceSyntaxDecorationsForBlock(decorations, doc, blockFrom, blockTo, docLength);
        } else if (blockType === "math_block") {
          addMathSourceSyntaxDecorationsForBlock(decorations, doc, blockFrom, blockTo, docLength);
        }
      }

      // Always mount image preview widget.
      if (blockType === "image") {
        const attrs = block?.attrs || {};
        const src = String(attrs.src || "");
        const alt = String(attrs.alt || "");
        const title = attrs.title != null ? String(attrs.title || "") : "";
        const persistedWidth = normalizeImageWidth(attrs.width, Number.NaN);
        const imageWidth = normalizeImageWidth(
          imageWidthMap.get(imageExpandKey),
          Number.isFinite(persistedWidth) ? persistedWidth : DEFAULT_IMAGE_WIDTH
        );
        const widgetPos = isImageExpanded ? blockTo : blockFrom;
        const widgetSide = isImageExpanded ? 1 : -1;
        if (src) {
          decorations.push(
            Decoration.widget({
              widget: new ImageWidget({
                src,
                alt,
                title,
                blockId: imageExpandKey,
                isExpanded: isImageExpanded,
                width: imageWidth
              }),
              side: widgetSide
            }).range(widgetPos)
          );
        }
      }

      if (blockType === "math_block") {
        const attrs = block?.attrs || {};
        const formula = String(attrs.formula || "").trim();
        let widgetPos = blockFrom;
        let widgetSide = -1;
        if (hideMathSourceLines) {
          const mount = resolveInlineWidgetMountOutsideHiddenBlock(docLength, blockFrom, blockTo);
          widgetPos = mount.pos;
          widgetSide = mount.side;
        }
        decorations.push(
          Decoration.widget({
            widget: new MathBlockWidget({ formula, blockId: mathExpandKey, isExpanded: isMathExpanded }),
            side: widgetSide
          }).range(widgetPos)
        );
      }

      if (blockType === "table") {
        const rawText = String(block?.rawText || "");
        // Keep table widget above source when source is visible, matching math-block behavior.
        let widgetPos = blockFrom;
        let widgetSide = -1;
        if (hideTableSourceLines) {
          const mount = resolveInlineWidgetMountOutsideHiddenBlock(docLength, blockFrom, blockTo);
          widgetPos = mount.pos;
          widgetSide = mount.side;
        }
        decorations.push(
          Decoration.widget({
            widget: new TableBlockWidget({
              rawText,
              blockId: tableBlockId,
              readOnly
            }),
            side: widgetSide
          }).range(widgetPos)
        );
      }

      if (blockType === "code_block") {
        const blockId = codeBlockCopyKeyOf({ type: blockType, from: blockFrom });
        if (blockId) {
          decorations.push(
            Decoration.widget({
              widget: new CodeBlockCopyWidget({ blockId }),
              side: -1
            }).range(blockFrom)
          );
        }
      }

      const inlineSegments = Array.isArray(block?.inlineSegments) ? block.inlineSegments : [];
      for (const segment of inlineSegments) {
        const className = inlineClassesForSegment(segment);
        if (!className) {
          continue;
        }
        const from = clampPos(segment?.from, docLength);
        const to = clampPos(segment?.to, docLength);
        if (to <= from) {
          continue;
        }
        decorations.push(
          Decoration.mark({
            class: className
          }).range(from, to)
        );
      }

      const syntaxTokens = collectInlineSyntaxTokens(block?.inlineTokens, docLength);
      for (const token of syntaxTokens) {
        if (blockKeepsSourceVisible) {
          continue;
        }
        if (isTokenRelatedToActiveToken(token, activeInlineToken)) {
          if (token.type === "wikilink") {
            addWikiLinkSourceSyntaxDecorationsForToken(decorations, token);
          }
          continue;
        }
        if (token.type === "math_inline") {
          addInlineMathPreviewDecorationForToken(decorations, doc, token, docLength);
          continue;
        }
        const tokenClass = inlineClassForSyntaxToken(token.type);
        if (tokenClass) {
          addInlineSyntaxMarkDecorationForToken(decorations, token, docLength, tokenClass);
        }
        addHiddenSyntaxDecorationsForToken(decorations, token);
      }
    } catch (error) {
      // Ignore a single-block render error to keep the editor alive.
      console.error("[yc-editor] block presentation error", error, block);
    }
  }
  if (!Array.isArray(blocks) || blocks.length === 0) {
    addMathSourceSyntaxDecorationsWithoutBlocks(decorations, doc, docLength);
  }
  try {
    return Decoration.set(decorations, true);
  } catch (error) {
    console.error("[yc-editor] decoration set error", error);
    return Decoration.none;
  }
};

const transactionHasEffect = (transaction, effectType) =>
  Boolean(transaction?.effects?.some((effect) => effect.is(effectType)));

const updateHasEffect = (update, effectType) =>
  Boolean(update?.transactions?.some((transaction) => transactionHasEffect(transaction, effectType)));

class BlockPresentationPlugin {
  constructor(view) {
    const data = view.state.field(presentationDataField);
    this.blocks = data.blocks;
    this.currentBlockId = data.currentBlockId;
    this.decorations = buildDecorations(view, this.blocks, this.currentBlockId);
  }

  update(update) {
    const nextData = update.state.field(presentationDataField);
    const nextBlocks = nextData.blocks;
    const nextCurrentBlockId = nextData.currentBlockId;
    const blocksChanged = nextBlocks !== this.blocks;
    const currentChanged = nextCurrentBlockId !== this.currentBlockId;
    const selectionChanged = update.selectionSet;
    const readOnlyChanged = isEditorStateReadOnly(update.startState) !== isEditorStateReadOnly(update.state);
    const contextHighlightChanged = updateHasEffect(update, setContextHighlightBlockEffect);
    const imageExpandChanged = updateHasEffect(update, toggleImageExpandEffect);
    const imageWidthChanged = updateHasEffect(update, setImageWidthEffect);
    const mathExpandChanged = updateHasEffect(update, toggleMathExpandEffect);
    if (!blocksChanged && !currentChanged) {
      if (update.docChanged) {
        // Keep existing block styling mapped through document edits until the next semantic snapshot arrives.
        // This avoids transient flicker on block backgrounds such as code block shells while typing.
        this.decorations = this.decorations.map(update.changes);
      } else if (
        selectionChanged
        || readOnlyChanged
        || contextHighlightChanged
        || imageExpandChanged
        || imageWidthChanged
        || mathExpandChanged
      ) {
        this.decorations = buildDecorations(update.view, this.blocks, this.currentBlockId);
      }
      return;
    }

    this.blocks = nextBlocks;
    this.currentBlockId = nextCurrentBlockId;
    this.decorations = buildDecorations(update.view, this.blocks, this.currentBlockId);
  }
}

const resolveContextBlockIdentityFromWidget = (target, blocks, docLength) => {
  const imageBlockKey = String(target.closest("[data-image-block-id]")?.getAttribute("data-image-block-id") || "");
  if (imageBlockKey) {
    for (const block of blocks) {
      const from = clampPos(block?.from, docLength);
      if (imageExpandKeyOf({ type: block?.type, from }) === imageBlockKey) {
        return blockIdentityOf(block);
      }
    }
  }

  const mathBlockKey = String(target.closest("[data-math-block-id]")?.getAttribute("data-math-block-id") || "");
  if (mathBlockKey) {
    for (const block of blocks) {
      const from = clampPos(block?.from, docLength);
      if (mathExpandKeyOf({ type: block?.type, from }) === mathBlockKey) {
        return blockIdentityOf(block);
      }
    }
  }

  const tableBlockKey = String(target.closest("[data-table-block-id]")?.getAttribute("data-table-block-id") || "");
  if (tableBlockKey) {
    for (const block of blocks) {
      const from = clampPos(block?.from, docLength);
      if (tableExpandKeyOf({ type: block?.type, from }) === tableBlockKey) {
        return blockIdentityOf(block);
      }
    }
  }

  return "";
};

const presentationContextMenuHandler = (event, view) => {
  if (view.state.field(contextHighlightField)) {
    view.dispatch({
      effects: setContextHighlightBlockEffect.of("")
    });
  }
  return false;
};

const resolveImageBlockRangeById = (view, blockId) => {
  const targetBlockId = String(blockId || "");
  if (!targetBlockId) {
    return null;
  }

  const data = view.state.field(presentationDataField);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const docLength = Number(view.state.doc.length || 0);
  for (const block of blocks) {
    const from = clampPos(block?.from, docLength);
    const to = Math.max(from, clampPos(block?.to, docLength));
    if (imageExpandKeyOf({ type: block?.type, from }) === targetBlockId) {
      return { from, to };
    }
  }
  return null;
};

const resolveCodeBlockRangeById = (view, blockId) => {
  const targetBlockId = String(blockId || "");
  if (!targetBlockId) {
    return null;
  }

  const data = view.state.field(presentationDataField);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const doc = view.state.doc;
  const docLength = Number(doc.length || 0);
  for (const block of blocks) {
    const from = clampPos(block?.from, docLength);
    const to = Math.max(from, clampPos(block?.to, docLength));
    if (codeBlockCopyKeyOf({ type: block?.type, from }) === targetBlockId) {
      return {
        from,
        to,
        rawText: doc.sliceString(from, to)
      };
    }
  }
  return null;
};

const resolveMathBlockRangeById = (view, blockId) => {
  const targetBlockId = String(blockId || "");
  if (!targetBlockId) {
    return null;
  }

  const data = view.state.field(presentationDataField);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const docLength = Number(view.state.doc.length || 0);
  for (const block of blocks) {
    const from = clampPos(block?.from, docLength);
    const to = Math.max(from, clampPos(block?.to, docLength));
    if (mathExpandKeyOf({ type: block?.type, from }) === targetBlockId) {
      return { from, to };
    }
  }
  return null;
};

const cursorOutsideRange = (docLengthInput, fromInput, toInput, direction = -1) => {
  const docLength = Math.max(0, Number(docLengthInput || 0));
  const from = clampPos(fromInput, docLength);
  const to = Math.max(from, clampPos(toInput, docLength));

  if (direction < 0) {
    if (from > 0) {
      return from - 1;
    }
    if (to < docLength) {
      return to + 1;
    }
    return 0;
  }

  if (to < docLength) {
    return to + 1;
  }
  if (from > 0) {
    return from - 1;
  }
  return 0;
};

const hasVisibleCursorAtPos = (view, posInput) => {
  const pos = clampPos(posInput, Number(view?.state?.doc?.length || 0));
  if (!view || typeof view.coordsAtPos !== "function") {
    return true;
  }
  try {
    return Boolean(view.coordsAtPos(pos));
  } catch {
    return false;
  }
};

const resolveNearestVisibleCursorPos = (view, posInput, direction = 1) => {
  const docLength = Number(view?.state?.doc?.length || 0);
  const start = clampPos(posInput, docLength);
  if (hasVisibleCursorAtPos(view, start)) {
    return start;
  }

  const step = direction < 0 ? -1 : 1;
  let forward = start;
  for (let index = 0; index < 256; index += 1) {
    forward += step;
    if (forward < 0 || forward > docLength) {
      break;
    }
    if (hasVisibleCursorAtPos(view, forward)) {
      return forward;
    }
  }

  let backward = start;
  for (let index = 0; index < 256; index += 1) {
    backward -= step;
    if (backward < 0 || backward > docLength) {
      break;
    }
    if (hasVisibleCursorAtPos(view, backward)) {
      return backward;
    }
  }

  return start;
};

const resolveTableBlockRangeById = (view, blockId) => {
  const targetBlockId = String(blockId || "");
  if (!targetBlockId) {
    return null;
  }

  const doc = view.state.doc;
  const docLength = Number(doc.length || 0);
  const match = targetBlockId.match(/^table:(\d+)$/);
  if (!match) {
    return null;
  }

  const blockStart = clampPos(Number(match[1]), docLength);
  let lineNumber = doc.lineAt(blockStart).number;
  let headerLineNumber = 0;
  const isHeaderAt = (candidateLineNumber) => {
    if (candidateLineNumber < 1 || candidateLineNumber >= doc.lines) {
      return false;
    }
    const headerLine = doc.line(candidateLineNumber);
    const delimiterLine = doc.line(candidateLineNumber + 1);
    return isPipeWrappedTableLine(headerLine.text)
      && isPipeWrappedTableLine(delimiterLine.text)
      && parseMarkdownTableRaw(`${headerLine.text}\n${delimiterLine.text}`) !== null;
  };

  if (!isHeaderAt(lineNumber)) {
    for (let offset = -2; offset <= 2; offset += 1) {
      const candidate = lineNumber + offset;
      if (isHeaderAt(candidate)) {
        headerLineNumber = candidate;
        break;
      }
    }
  } else {
    headerLineNumber = lineNumber;
  }

  if (!headerLineNumber) {
    return null;
  }

  const headerCells = splitTableCells(doc.line(headerLineNumber).text);
  const expectedColumnCount = headerCells.length;
  let endLine = headerLineNumber + 1;
  while (endLine < doc.lines) {
    const nextLineText = doc.line(endLine + 1).text;
    if (!isPipeWrappedTableLine(nextLineText)) {
      break;
    }
    if (splitTableCells(nextLineText).length !== expectedColumnCount) {
      break;
    }
    endLine += 1;
  }

  const from = doc.line(headerLineNumber).from;
  const to = doc.line(endLine).to;
  return {
    from,
    to,
    rawText: doc.sliceString(from, to)
  };
};

const persistTableByBlockId = (view, blockId, transformTableModel) => {
  if (typeof transformTableModel !== "function") {
    return false;
  }

  const range = resolveTableBlockRangeById(view, blockId);
  if (!range) {
    return false;
  }

  const model = parseMarkdownTableModel(range.rawText);
  if (!model) {
    return false;
  }

  const nextModel = transformTableModel(model);
  if (!nextModel) {
    return false;
  }

  const nextRaw = serializeMarkdownTableModel(nextModel);
  if (!nextRaw || nextRaw === range.rawText) {
    return false;
  }

  view.dispatch({
    changes: {
      from: range.from,
      to: range.to,
      insert: nextRaw
    },
    userEvent: "input"
  });
  view.focus();
  return true;
};

const tableInsertIndexFromRects = (rects, pointer, axis) => {
  const axisKey = axis === "x" ? "left" : "top";
  const sizeKey = axis === "x" ? "right" : "bottom";
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    const center = (Number(rect[axisKey]) + Number(rect[sizeKey])) / 2;
    if (pointer < center) {
      return index;
    }
  }
  return rects.length;
};

const tableDropLinePosFromInsertIndex = (rects, insertIndexInput, axis) => {
  if (!rects.length) {
    return 0;
  }

  const insertIndex = clampIndex(insertIndexInput, 0, rects.length);
  if (axis === "x") {
    if (insertIndex <= 0) {
      return Number(rects[0].left || 0);
    }
    if (insertIndex >= rects.length) {
      return Number(rects[rects.length - 1].right || 0);
    }
    return Number(rects[insertIndex].left || 0);
  }

  if (insertIndex <= 0) {
    return Number(rects[0].top || 0);
  }
  if (insertIndex >= rects.length) {
    return Number(rects[rects.length - 1].bottom || 0);
  }
  return Number(rects[insertIndex].top || 0);
};

const targetIndexFromInsertIndex = (sourceIndexInput, insertIndexInput, itemCountInput) => {
  const itemCount = Math.max(1, Number(itemCountInput || 0));
  const sourceIndex = clampIndex(sourceIndexInput, 0, itemCount - 1);
  const insertIndex = clampIndex(insertIndexInput, 0, itemCount);
  const targetIndex = insertIndex > sourceIndex ? insertIndex - 1 : insertIndex;
  return clampIndex(targetIndex, 0, itemCount - 1);
};

const clearTableHandleSelection = (view) => {
  const root = view?.dom;
  if (!(root instanceof Element)) {
    return;
  }

  for (const node of root.querySelectorAll(".is-handle-selected-row")) {
    node.classList.remove("is-handle-selected-row");
  }
  for (const node of root.querySelectorAll(".is-handle-selected-col")) {
    node.classList.remove("is-handle-selected-col");
  }
  for (const node of root.querySelectorAll(".is-selected-handle")) {
    node.classList.remove("is-selected-handle");
  }
};

const selectTableHandleTarget = (view, handle, axis) => {
  if (!(handle instanceof Element)) {
    return;
  }

  const wrapper = handle.closest(".cm-table-widget");
  if (!(wrapper instanceof HTMLElement)) {
    return;
  }

  const tableEl = wrapper.querySelector(".cm-table-widget-table");
  if (!(tableEl instanceof HTMLElement)) {
    return;
  }

  clearTableHandleSelection(view);
  handle.classList.add("is-selected-handle");

  if (axis === "row") {
    const rowIndex = Number(handle.getAttribute("data-table-row-index"));
    if (!Number.isFinite(rowIndex)) {
      return;
    }
    const rows = Array.from(tableEl.querySelectorAll("tbody tr"));
    const safeIndex = clampIndex(rowIndex, 0, Math.max(0, rows.length - 1));
    const row = rows[safeIndex];
    if (row instanceof Element) {
      row.classList.add("is-handle-selected-row");
    }
    return;
  }

  const colIndex = Number(handle.getAttribute("data-table-col-index"));
  if (!Number.isFinite(colIndex)) {
    return;
  }
  const headerCells = Array.from(tableEl.querySelectorAll("thead th"));
  const safeColIndex = clampIndex(colIndex, 0, Math.max(0, headerCells.length - 1));
  const colSelector = `thead th:nth-child(${safeColIndex + 1}), tbody td:nth-child(${safeColIndex + 1})`;
  for (const cell of tableEl.querySelectorAll(colSelector)) {
    cell.classList.add("is-handle-selected-col");
  }
};

const startTableDragReorder = (event, view, handle, axis) => {
  const wrapper = handle.closest(".cm-table-widget");
  if (!(wrapper instanceof HTMLElement)) {
    return true;
  }

  const tableEl = wrapper.querySelector(".cm-table-widget-table");
  if (!(tableEl instanceof HTMLElement)) {
    return true;
  }

  const indicator = wrapper.querySelector("[data-table-drop-indicator]");
  if (!(indicator instanceof HTMLElement)) {
    return true;
  }

  const blockId = String(handle.getAttribute("data-table-block-id") || "");
  if (!blockId) {
    return true;
  }

  const isColumnDrag = axis === "column";
  const indexAttr = isColumnDrag ? "data-table-col-index" : "data-table-row-index";
  const sourceIndexRaw = Number(handle.getAttribute(indexAttr));
  if (!Number.isFinite(sourceIndexRaw)) {
    return true;
  }

  const itemElements = isColumnDrag
    ? Array.from(tableEl.querySelectorAll("thead th"))
    : Array.from(tableEl.querySelectorAll("tbody tr"));
  if (itemElements.length <= 1) {
    return true;
  }

  const sourceIndex = clampIndex(sourceIndexRaw, 0, itemElements.length - 1);
  let lastInsertIndex = sourceIndex;
  let lastTargetIndex = sourceIndex;
  const axisKey = isColumnDrag ? "x" : "y";
  const dragSourceElements = isColumnDrag
    ? Array.from(
      tableEl.querySelectorAll(`thead th:nth-child(${sourceIndex + 1}), tbody td:nth-child(${sourceIndex + 1})`)
    )
    : [itemElements[sourceIndex]].filter(Boolean);

  const setDragSourceActive = (active) => {
    for (const element of dragSourceElements) {
      if (!(element instanceof Element)) {
        continue;
      }
      element.classList.toggle("is-drag-source", Boolean(active));
    }
  };

  const measureRects = () => itemElements.map((item) => item.getBoundingClientRect());

  const updateDropIndicator = (insertIndex, targetIndex) => {
    if (targetIndex === sourceIndex) {
      indicator.classList.remove("is-active", "is-row", "is-column");
      indicator.style.left = "";
      indicator.style.top = "";
      indicator.style.width = "";
      indicator.style.height = "";
      return;
    }

    const itemRects = measureRects();
    const wrapperRect = wrapper.getBoundingClientRect();
    const tableRect = tableEl.getBoundingClientRect();
    const dropPos = tableDropLinePosFromInsertIndex(itemRects, insertIndex, axisKey);

    indicator.classList.add("is-active");
    indicator.classList.toggle("is-column", isColumnDrag);
    indicator.classList.toggle("is-row", !isColumnDrag);
    if (isColumnDrag) {
      indicator.style.left = `${Math.round(dropPos - wrapperRect.left)}px`;
      indicator.style.top = `${Math.round(tableRect.top - wrapperRect.top)}px`;
      indicator.style.height = `${Math.round(tableRect.height)}px`;
      indicator.style.width = "";
    } else {
      indicator.style.top = `${Math.round(dropPos - wrapperRect.top)}px`;
      indicator.style.left = `${Math.round(tableRect.left - wrapperRect.left)}px`;
      indicator.style.width = `${Math.round(tableRect.width)}px`;
      indicator.style.height = "";
    }
  };

  const pointerValueOf = (moveEvent) =>
    Number(isColumnDrag ? moveEvent.clientX : moveEvent.clientY);

  const onMouseMove = (moveEvent) => {
    moveEvent.preventDefault();
    const itemRects = measureRects();
    const pointerValue = pointerValueOf(moveEvent);
    const insertIndex = tableInsertIndexFromRects(itemRects, pointerValue, axisKey);
    const targetIndex = targetIndexFromInsertIndex(sourceIndex, insertIndex, itemElements.length);
    lastInsertIndex = insertIndex;
    lastTargetIndex = targetIndex;
    updateDropIndicator(insertIndex, targetIndex);
  };

  const endDrag = () => {
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
    wrapper.classList.remove("is-table-dragging", "is-table-row-dragging", "is-table-column-dragging");
    indicator.classList.remove("is-active", "is-row", "is-column");
    indicator.style.left = "";
    indicator.style.top = "";
    indicator.style.width = "";
    indicator.style.height = "";
    setDragSourceActive(false);
    document.body.style.userSelect = previousUserSelect;
  };

  const onMouseUp = (upEvent) => {
    upEvent.preventDefault();
    endDrag();
    const targetIndex = clampIndex(lastTargetIndex, 0, itemElements.length - 1);
    if (targetIndex === sourceIndex) {
      view.focus();
      return;
    }

    persistTableByBlockId(
      view,
      blockId,
      isColumnDrag
        ? (model) => moveTableColumn(model, sourceIndex, targetIndex)
        : (model) => moveTableRow(model, sourceIndex, targetIndex)
    );
  };

  const previousUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  wrapper.classList.add("is-table-dragging");
  wrapper.classList.toggle("is-table-column-dragging", isColumnDrag);
  wrapper.classList.toggle("is-table-row-dragging", !isColumnDrag);
  setDragSourceActive(true);

  const initialRects = measureRects();
  const initialPointer = pointerValueOf(event);
  lastInsertIndex = tableInsertIndexFromRects(initialRects, initialPointer, axisKey);
  lastTargetIndex = targetIndexFromInsertIndex(sourceIndex, lastInsertIndex, itemElements.length);
  updateDropIndicator(lastInsertIndex, lastTargetIndex);

  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseup", onMouseUp, true);
  view.focus();
  return true;
};

const handleTableAction = (view, blockId, actionInput) => {
  const action = String(actionInput || "");
  if (!action || !blockId) {
    return false;
  }
  flushActiveTableCellEditor(view, blockId);

  if (action === "add-column-right") {
    return persistTableByBlockId(view, blockId, (model) => appendTableColumnRight(model));
  }
  if (action === "add-row-bottom") {
    return persistTableByBlockId(view, blockId, (model) => appendTableRowBottom(model));
  }
  return false;
};

const activeTableCellEditorOf = (view) => {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (!(active instanceof HTMLElement)) {
    return null;
  }
  const root = view?.dom;
  if (!(root instanceof Element) || !root.contains(active)) {
    return null;
  }
  return active.matches?.("[data-table-edit='true']")
    ? active
    : active.closest?.("[data-table-edit='true']");
};

const flushActiveTableCellEditor = (view, blockIdInput = "") => {
  const activeCell = activeTableCellEditorOf(view);
  if (!(activeCell instanceof HTMLElement)) {
    return null;
  }

  const blockId = String(blockIdInput || "").trim();
  if (blockId && String(activeCell.getAttribute("data-table-block-id") || "") !== blockId) {
    return null;
  }

  const text = markdownFromTableCellEditor(activeCell);
  commitTableCellEdit(view, activeCell, text);
  const root = view?.dom;
  if (!(root instanceof Element)) {
    return null;
  }
  return root.querySelector(
    [
      "[data-table-edit='true']",
      `[data-table-block-id="${String(activeCell.getAttribute("data-table-block-id") || "")}"]`,
      `[data-table-section="${String(activeCell.getAttribute("data-table-section") || "")}"]`,
      `[data-table-col-index="${String(activeCell.getAttribute("data-table-col-index") || "")}"]`,
      ...(activeCell.hasAttribute("data-table-row-index")
        ? [`[data-table-row-index="${String(activeCell.getAttribute("data-table-row-index") || "")}"]`]
        : [])
    ].join("")
  );
};

const resolveFreshTableHandle = (view, handle, axis) => {
  if (!(handle instanceof Element)) {
    return null;
  }
  const blockId = String(handle.getAttribute("data-table-block-id") || "");
  if (!blockId) {
    return null;
  }
  const axisAttr = axis === "column" ? "data-table-col-index" : "data-table-row-index";
  const axisValue = String(handle.getAttribute(axisAttr) || "");
  const selector = axis === "column"
    ? `[data-table-col-handle][data-table-block-id="${blockId}"][data-table-col-index="${axisValue}"]`
    : `[data-table-row-handle][data-table-block-id="${blockId}"][data-table-row-index="${axisValue}"]`;
  const root = view?.dom;
  if (!(root instanceof Element)) {
    return null;
  }
  const resolved = root.querySelector(selector);
  return resolved instanceof Element ? resolved : null;
};

const commitTableCellEdit = (view, editableCell, textInput = null) => {
  if (!(editableCell instanceof HTMLElement)) {
    return false;
  }

  const blockId = String(editableCell.getAttribute("data-table-block-id") || "");
  const section = String(editableCell.getAttribute("data-table-section") || "body").toLowerCase();
  const rowIndex = Number(editableCell.getAttribute("data-table-row-index"));
  const colIndex = Number(editableCell.getAttribute("data-table-col-index"));
  const text = typeof textInput === "string"
    ? normalizeTableCellEditorText(textInput)
    : markdownFromTableCellEditor(editableCell);
  setTableCellEditorSourceText(editableCell, text);
  if (!blockId || !Number.isFinite(colIndex)) {
    return false;
  }

  return persistTableByBlockId(view, blockId, (model) =>
    updateTableCellByPosition(model, {
      section,
      rowIndex: Number.isFinite(rowIndex) ? rowIndex : 0,
      colIndex,
      text
    })
  );
};

const toggleTaskListStateAtLine = (view, lineFromInput) => {
  const doc = view.state.doc;
  const docLength = Number(doc.length || 0);
  const lineFrom = clampPos(lineFromInput, docLength);
  const line = doc.lineAt(lineFrom);
  const text = String(line.text || "");
  const match = text.match(TASK_LIST_CHECKBOX_PATTERN);
  if (!match) {
    return false;
  }

  const markerFrom = line.from + String(match[1] || "").length;
  const markerTo = markerFrom + 1;
  const current = String(match[2] || " ").toLowerCase();
  const next = current === "x" ? " " : "x";

  view.dispatch({
    changes: {
      from: markerFrom,
      to: markerTo,
      insert: next
    },
    userEvent: "input"
  });
  view.focus();
  return true;
};

const persistImageWidthToMarkdown = (view, blockId, widthInput) => {
  const range = resolveImageBlockRangeById(view, blockId);
  if (!range) {
    return;
  }

  const width = normalizeImageWidth(widthInput, Number.NaN);
  if (!Number.isFinite(width)) {
    return;
  }

  const doc = view.state.doc;
  const rawLine = doc.sliceString(range.from, range.to);
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return;
  }

  const parsed = parseImageLine(trimmed);
  if (!parsed || !parsed.src) {
    return;
  }

  const leadingWhitespace = rawLine.match(/^\s*/u)?.[0] || "";
  const widthForSource = width === DEFAULT_IMAGE_WIDTH ? undefined : width;
  const nextLine = `${leadingWhitespace}${serializeImageLine({
    alt: parsed.alt,
    src: parsed.src,
    title: parsed.title,
    width: widthForSource
  })}`;

  if (nextLine === rawLine) {
    return;
  }

  view.dispatch({
    changes: {
      from: range.from,
      to: range.to,
      insert: nextLine
    },
    effects: setImageWidthEffect.of({
      blockId: String(blockId || ""),
      width
    }),
    userEvent: "input"
  });
};

const isPlainVerticalArrowEvent = (event) => {
  if (!event || event.defaultPrevented || event.isComposing) {
    return false;
  }
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
    return false;
  }
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  return true;
};

const blockExpandedForKeyboardNavigation = (view, block) => {
  const type = String(block?.type || "");
  if (type === "image") {
    return view.state.field(imageExpandField).has(imageExpandKeyOf(block));
  }
  if (type === "math_block") {
    return view.state.field(mathExpandField).has(mathExpandKeyOf(block));
  }
  return false;
};

const showCodeBlockCopyFeedback = (button, ok) => {
  if (!(button instanceof HTMLElement)) {
    return;
  }

  const feedbackResetTimer = Number(button.dataset.resetTimer || 0);
  if (feedbackResetTimer) {
    window.clearTimeout(feedbackResetTimer);
  }

  const feedbackLabelText = ok ? "\u5df2\u590d\u5236" : "\u590d\u5236\u5931\u8d25";
  button.dataset.copyState = ok ? "copied" : "failed";
  button.setAttribute("aria-label", feedbackLabelText);
  button.title = feedbackLabelText;

  const feedbackTimer = window.setTimeout(() => {
    if (!button.isConnected) {
      return;
    }
    button.setAttribute("aria-label", "\u590d\u5236\u4ee3\u7801");
    button.title = "";
    delete button.dataset.copyState;
    delete button.dataset.resetTimer;
  }, 1400);
  button.dataset.resetTimer = String(feedbackTimer);
  return;

  const label = button.querySelector(".cm-code-block-copy-label");
  if (!(label instanceof HTMLElement)) {
    return;
  }

  const resetTimer = Number(button.dataset.resetTimer || 0);
  if (resetTimer) {
    window.clearTimeout(resetTimer);
  }

  label.textContent = ok ? "已复制" : "失败";
  button.dataset.copyState = ok ? "copied" : "failed";
  const timer = window.setTimeout(() => {
    if (!button.isConnected) {
      return;
    }
    label.textContent = "复制";
    delete button.dataset.copyState;
    delete button.dataset.resetTimer;
  }, 1400);
  button.dataset.resetTimer = String(timer);
};

const placeCaretInEditableCell = (editableCell, placeAtEnd = false) => {
  if (!(editableCell instanceof HTMLElement) || typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }
  const selection = window.getSelection?.();
  if (!selection) {
    return false;
  }

  const range = document.createRange();
  range.selectNodeContents(editableCell);
  range.collapse(!placeAtEnd);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

const focusTableBlockCellEditor = (view, blockIdInput, direction = 1) => {
  const blockId = String(blockIdInput || "");
  if (!blockId) {
    return false;
  }

  const root = view?.dom;
  if (!(root instanceof Element)) {
    return false;
  }

  const editors = Array.from(
    root.querySelectorAll(`.cm-table-widget[data-table-block-id="${blockId}"] [data-table-edit="true"]`)
  ).filter((node) => node instanceof HTMLElement);
  if (!editors.length) {
    return false;
  }

  const target = direction < 0 ? editors[editors.length - 1] : editors[0];
  const applyFocus = () => {
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
    placeCaretInEditableCell(target, direction < 0);
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    }
  };

  applyFocus();
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      if (target.isConnected) {
        applyFocus();
      }
    });
  }
  return true;
};

const moveCursorIntoSpecialBlockSource = (view, block, direction = 1) => {
  const docLength = Number(view.state.doc.length || 0);
  const from = clampPos(block?.from, docLength);
  const to = clampPos(block?.to, docLength);
  if (to <= from) {
    return false;
  }

  const cursor = direction < 0 ? Math.max(from, to - 1) : from;
  view.dispatch({
    selection: {
      anchor: cursor,
      head: cursor
    },
    scrollIntoView: true
  });
  view.focus();
  return true;
};

const resolveKeyboardNavigableSpecialBlock = (view, direction = 1) => {
  const data = view.state.field(presentationDataField);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  if (!blocks.length) {
    return null;
  }

  const selection = selectionSnapshotOf(view.state);
  if (!selection.empty) {
    return null;
  }

  const doc = view.state.doc;
  const docLength = Number(doc.length || 0);
  const cursorLine = doc.lineAt(selection.head).number;
  let adjacentMatch = null;

  for (const block of blocks) {
    const blockType = String(block?.type || "");
    if (!KEYBOARD_NAVIGABLE_SPECIAL_BLOCK_TYPES.has(blockType) || blockExpandedForKeyboardNavigation(view, block)) {
      continue;
    }

    const blockFrom = clampPos(block?.from, docLength);
    const blockTo = clampPos(block?.to, docLength);
    if (blockTo <= blockFrom) {
      continue;
    }

    if (blockType === "table" && selectionIntersectsRange(selection, blockFrom, blockTo)) {
      return block;
    }

    const lineRange = resolveLineRange(doc, block);
    const isAdjacent = direction < 0
      ? cursorLine === lineRange.toLine + 1
      : cursorLine === lineRange.fromLine - 1;
    if (!isAdjacent) {
      continue;
    }

    adjacentMatch = block;
    break;
  }

  return adjacentMatch;
};

const runSpecialBlockVerticalNavigation = (view, direction = 1) => {
  if (isEditorReadOnly(view)) {
    return false;
  }

  const block = resolveKeyboardNavigableSpecialBlock(view, direction);
  if (!block) {
    return false;
  }

  const handled = String(block?.type || "") === "table"
    ? focusTableBlockCellEditor(view, tableExpandKeyOf(block), direction)
    : moveCursorIntoSpecialBlockSource(view, block, direction);
  return handled;
};

const handleSpecialBlockVerticalNavigation = (event, view) => {
  if (!isPlainVerticalArrowEvent(event)) {
    return false;
  }

  const direction = event.key === "ArrowUp" ? -1 : 1;
  if (!runSpecialBlockVerticalNavigation(view, direction)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  return true;
};

const specialBlockNavigationKeymap = Prec.highest(
  keymap.of([
    {
      key: "ArrowUp",
      run: (view) => runSpecialBlockVerticalNavigation(view, -1)
    },
    {
      key: "ArrowDown",
      run: (view) => runSpecialBlockVerticalNavigation(view, 1)
    }
  ])
);

const presentationMouseDownHandler = (event, view) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }
  const readOnly = isEditorReadOnly(view);

  const codeCopyWidget = target.closest(".cm-code-block-copy-widget");
  if (codeCopyWidget) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const codeCopyButton = target.closest(".cm-code-block-copy-btn");
  if (codeCopyButton) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const taskToggle = target.closest("[data-task-toggle-from]");
  if (taskToggle) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const tableEditableCell = target.closest("[data-table-edit='true']");
  if (tableEditableCell) {
    if (readOnly) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    clearTableHandleSelection(view);
    event.stopPropagation();
    return false;
  }

  const tableActionButton = target.closest("[data-table-action]");
  if (tableActionButton) {
    const blockId = String(tableActionButton.getAttribute("data-table-block-id") || "");
    flushActiveTableCellEditor(view, blockId);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const tableRowHandle = target.closest("[data-table-row-handle]");
  if (tableRowHandle instanceof Element) {
    if (readOnly) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    const blockId = String(tableRowHandle.getAttribute("data-table-block-id") || "");
    flushActiveTableCellEditor(view, blockId);
    const freshHandle = resolveFreshTableHandle(view, tableRowHandle, "row") || tableRowHandle;
    selectTableHandleTarget(view, freshHandle, "row");
    event.preventDefault();
    event.stopPropagation();
    return startTableDragReorder(event, view, freshHandle, "row");
  }

  const tableColumnHandle = target.closest("[data-table-col-handle]");
  if (tableColumnHandle instanceof Element) {
    if (readOnly) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    const blockId = String(tableColumnHandle.getAttribute("data-table-block-id") || "");
    flushActiveTableCellEditor(view, blockId);
    const freshHandle = resolveFreshTableHandle(view, tableColumnHandle, "column") || tableColumnHandle;
    selectTableHandleTarget(view, freshHandle, "column");
    event.preventDefault();
    event.stopPropagation();
    return startTableDragReorder(event, view, freshHandle, "column");
  }

  const tableWidget = target.closest(".cm-table-widget");
  if (tableWidget instanceof Element) {
    if (readOnly) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    event.preventDefault();
    event.stopPropagation();
    clearTableHandleSelection(view);
    return true;
  }

  const resizeHandle = target.closest(".cm-image-widget-resize-handle");
  if (!resizeHandle) {
    if (Number(event.button) === 0) {
      clearTableHandleSelection(view);
    }
    if (Number(event.button) === 0 && view.state.field(contextHighlightField)) {
      view.dispatch({
        effects: setContextHighlightBlockEffect.of("")
      });
    }
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  const blockId = String(resizeHandle.getAttribute("data-image-block-id") || "");
  const startWidthRaw = Number(resizeHandle.getAttribute("data-image-width"));
  if (!blockId || !Number.isFinite(startWidthRaw)) {
    return true;
  }

  const startWidth = normalizeImageWidth(startWidthRaw);
  const startClientX = Number(event.clientX || 0);
  let lastWidth = startWidth;

  const onMouseMove = (moveEvent) => {
    moveEvent.preventDefault();
    const deltaX = Number(moveEvent.clientX || 0) - startClientX;
    const nextWidth = normalizeImageWidth(startWidth + deltaX);
    if (nextWidth === lastWidth) {
      return;
    }
    lastWidth = nextWidth;
    view.dispatch({
      effects: setImageWidthEffect.of({
        blockId,
        width: nextWidth
      })
    });
  };

  const onMouseUp = () => {
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
    if (lastWidth !== startWidth) {
      persistImageWidthToMarkdown(view, blockId, lastWidth);
    }
  };

  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseup", onMouseUp, true);
  view.focus();
  return true;
};

const presentationKeyDownHandler = (event, view) => {
  const target = event.target;
  if (target instanceof Element && view?.contentDOM instanceof Element && !view.contentDOM.contains(target)) {
    return false;
  }

  const readOnly = isEditorReadOnly(view);
  if (readOnly) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (target instanceof Element) {
    const tableEditableCell = target.closest("[data-table-edit='true']");
    if (tableEditableCell) {
      event.stopPropagation();
      if (isPlainTableClipboardShortcutEvent(event)) {
        return false;
      }
      if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        if (tableEditableCell instanceof HTMLElement) {
          tableEditableCell.blur();
        }
        return true;
      }
      return false;
    }
  }

  return handleSpecialBlockVerticalNavigation(event, view);
};

const presentationFocusOutHandler = (event, view) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  const tableEditableCell = target.closest("[data-table-edit='true']");
  if (!(tableEditableCell instanceof HTMLElement)) {
    return false;
  }

  if (String(tableEditableCell.getAttribute(TABLE_CELL_SKIP_FOCUSOUT_COMMIT_ATTR) || "") === "1") {
    tableEditableCell.removeAttribute(TABLE_CELL_SKIP_FOCUSOUT_COMMIT_ATTR);
    if (tableEditableCell.isConnected) {
      renderTableCellEditorFromMarkdown(tableEditableCell, markdownFromTableCellEditor(tableEditableCell));
    }
    return false;
  }

  const text = markdownFromTableCellEditor(tableEditableCell);
  commitTableCellEdit(view, tableEditableCell, text);
  if (tableEditableCell.isConnected) {
    renderTableCellEditorFromMarkdown(tableEditableCell, text);
  }
  return false;
};

const presentationClickHandler = (event, view) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }
  const readOnly = isEditorReadOnly(view);

  const codeCopyTrigger = target.closest(".cm-code-block-copy-trigger");
  if (codeCopyTrigger instanceof HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const codeCopyButton = target.closest(".cm-code-block-copy-btn");
  if (codeCopyButton instanceof HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    const blockId = String(codeCopyButton.getAttribute("data-code-block-id") || "");
    const blockRange = resolveCodeBlockRangeById(view, blockId);
    const codeText = extractCodeBlockContent(String(blockRange?.rawText || ""));
    void copyText(codeText).then((ok) => {
      showCodeBlockCopyFeedback(codeCopyButton, ok && Boolean(codeText));
    });
    return true;
  }

  const taskToggle = target.closest("[data-task-toggle-from]");
  if (taskToggle) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) {
      return true;
    }
    const lineFrom = Number(taskToggle.getAttribute("data-task-toggle-from"));
    if (Number.isFinite(lineFrom)) {
      return toggleTaskListStateAtLine(view, lineFrom);
    }
    return true;
  }

  const tableActionButton = target.closest("[data-table-action]");
  if (tableActionButton) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) {
      return true;
    }
    const action = String(tableActionButton.getAttribute("data-table-action") || "");
    const blockId = String(tableActionButton.getAttribute("data-table-block-id") || "");
    return handleTableAction(view, blockId, action);
  }

  const tableDragHandle = target.closest("[data-table-row-handle], [data-table-col-handle]");
  if (tableDragHandle) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const tableWidget = target.closest(".cm-table-widget");
  if (tableWidget instanceof Element) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) {
      return true;
    }
    const hostCell = target.closest("th, td");
    const targetEditor = (
      hostCell?.querySelector?.("[data-table-edit='true']")
      || tableWidget.querySelector("[data-table-edit='true']")
    );
    if (targetEditor instanceof HTMLElement) {
      try {
        targetEditor.focus({ preventScroll: true });
      } catch {
        targetEditor.focus();
      }
    }
    return true;
  }

  const imageBtn = target.closest(".cm-image-widget-btn");
  if (imageBtn) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) {
      return true;
    }
    const blockId = imageBtn.getAttribute("data-image-block-id");
    if (blockId) {
      view.dispatch({
        effects: toggleImageExpandEffect.of(blockId)
      });
      return true;
    }
  }

  const mathBtn = target.closest(".cm-math-widget-btn");
  if (mathBtn) {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) {
      return true;
    }
    const blockId = mathBtn.getAttribute("data-math-block-id");
    if (blockId) {
      const blockRange = resolveMathBlockRangeById(view, blockId);
      const isExpanded = view.state.field(mathExpandField).has(blockId);
      const docLength = Number(view.state.doc.length || 0);
      const selection = (
        isExpanded && blockRange
          ? {
              anchor: resolveNearestVisibleCursorPos(
                view,
                cursorOutsideRange(docLength, blockRange.from, blockRange.to, -1),
                -1
              ),
              head: resolveNearestVisibleCursorPos(
                view,
                cursorOutsideRange(docLength, blockRange.from, blockRange.to, -1),
                -1
              )
            }
          : null
      );
      const dispatchPayload = {
        effects: toggleMathExpandEffect.of(blockId)
      };
      if (selection) {
        dispatchPayload.selection = selection;
        dispatchPayload.scrollIntoView = true;
      }
      view.dispatch(dispatchPayload);
      if (selection) {
        view.focus();
      }
      return true;
    }
  }

  const inlineMath = target.closest(".cm-inline-math-widget");
  if (inlineMath) {
    if (readOnly) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    const from = Number(inlineMath.getAttribute("data-math-inline-from"));
    const to = Number(inlineMath.getAttribute("data-math-inline-to"));
    if (Number.isFinite(from)) {
      const docLength = Number(view.state.doc.length || 0);
      const safeTo = Number.isFinite(to) ? clampPos(to, docLength) : clampPos(from + 1, docLength);
      const cursor = clampPos(Math.min(Math.max(from + 1, from), safeTo), docLength);
      view.dispatch({
        selection: {
          anchor: cursor,
          head: cursor
        }
      });
      view.focus();
      return true;
    }
  }

  return false;
};

export const presentationExtensions = [
  presentationDataField,
  contextHighlightField,
  imageExpandField,
  imageWidthField,
  mathExpandField,
  specialBlockNavigationKeymap,
  EditorView.domEventHandlers({
    contextmenu: presentationContextMenuHandler,
    mousedown: presentationMouseDownHandler,
    keydown: presentationKeyDownHandler,
    focusout: presentationFocusOutHandler,
    click: presentationClickHandler
  }),
  ViewPlugin.fromClass(BlockPresentationPlugin, {
    decorations: (plugin) => plugin.decorations
  })
];
