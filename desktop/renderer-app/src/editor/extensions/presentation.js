import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import katex from "katex";
import { parseImageLine, serializeImageLine } from "../parser/parse-image";

const HEADING_PREFIX_PATTERN = /^\s{0,3}#{1,6}[ \t]+/;
const BLOCKQUOTE_PREFIX_PATTERN = /^\s{0,3}>\s?/;
const CALLOUT_MARKER_WITH_PREFIX_PATTERN = /^(\s{0,3}>\s*)\[!([A-Za-z][A-Za-z0-9_-]*)\](?:[ \t]+)?/;
const TASK_LIST_PREFIX_PATTERN = /^(\s*)([-+*])\s+\[( |x|X)\]\s+/;
const BULLET_LIST_PREFIX_PATTERN = /^(\s*)([-+*])\s+/;
const ORDERED_LIST_PREFIX_PATTERN = /^(\s*)(\d+)([.)])\s+/;
const TASK_LIST_CHECKBOX_PATTERN = /^(\s*[-+*]\s+\[)( |x|X)(\]\s+)/;
const INLINE_SYNTAX_TOKEN_TYPES = new Set([
  "em",
  "strong",
  "codespan",
  "del",
  "link",
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
const DEFAULT_IMAGE_WIDTH = 520;
const MIN_IMAGE_WIDTH = 160;
const MAX_IMAGE_WIDTH = 1400;
const SOURCE_TOGGLE_ICON_COLLAPSED = "</>";
const SOURCE_TOGGLE_ICON_EXPANDED = ">/<";
const sourceToggleTitle = (isExpanded) => (isExpanded ? "Hide source" : "Show source");
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

  const rows = lines
    .slice(2)
    .map((line) => splitTableCells(line))
    .filter((cells) => cells.length > 0)
    .map((cells) => headers.map((_, index) => String(cells[index] || "").trim()));

  return {
    headers: headers.map((cell) => String(cell || "")),
    rows,
    alignments
  };
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

const normalizeImageSrc = (src) => {
  const srcStr = String(src || "");
  if (!srcStr) {
    return "";
  }
  // Keep remote URLs unchanged.
  if (srcStr.startsWith("http://") || srcStr.startsWith("https://")) {
    return srcStr;
  }
  // Keep normalized file protocol paths unchanged.
  if (srcStr.startsWith("file:///") || srcStr.startsWith("file://localhost/")) {
    return srcStr;
  }
  // Convert legacy file://C:/... to file:///C:/...
  if (srcStr.startsWith("file://")) {
    return `file:///${srcStr.slice(7)}`;
  }
  // Convert absolute Windows paths to file protocol.
  if (/^\/?[A-Za-z]:[/\\]/.test(srcStr)) {
    let filePath = srcStr.replace(/^\/+/, "");
    filePath = filePath.replace(/\\/g, "/");
    return `file:///${filePath}`;
  }
  // Convert absolute Unix paths to file protocol.
  if (srcStr.startsWith("/")) {
    return `file://${srcStr}`;
  }
  // Keep relative paths unchanged.
  return srcStr;
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
    const frame = document.createElement("span");
    frame.className = "cm-image-widget-frame";

    const img = document.createElement("img");
    img.src = normalizeImageSrc(this.src);
    img.alt = this.alt;
    if (this.title) {
      img.title = this.title;
    }
    img.className = "cm-image-widget-img";
    img.style.width = `${this.width}px`;

    // Fallback text for broken images.
    img.onerror = () => {
      img.style.display = "none";
      const errorMsg = document.createElement("span");
      errorMsg.className = "cm-image-widget-error";
      errorMsg.textContent = "[Image load failed]";
      frame.appendChild(errorMsg);
    };

    const toolbar = document.createElement("span");
    toolbar.className = "cm-image-widget-toolbar";

    const handle = document.createElement("span");
    handle.className = "cm-image-widget-resize-handle";
    handle.setAttribute("title", "Drag to resize image");
    handle.setAttribute("data-image-block-id", this.blockId);
    handle.setAttribute("data-image-width", String(this.width));
    handle.ondragstart = (event) => {
      event.preventDefault();
    };

    // Toggle source visibility for this image block.
    const btn = document.createElement("span");
    btn.className = "cm-image-widget-btn";
    btn.textContent = this.isExpanded ? SOURCE_TOGGLE_ICON_EXPANDED : SOURCE_TOGGLE_ICON_COLLAPSED;
    btn.setAttribute("title", sourceToggleTitle(this.isExpanded));
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
    btn.setAttribute("title", sourceToggleTitle(this.isExpanded));
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
  constructor({ rawText = "", blockId = "", isExpanded = false } = {}) {
    super();
    this.rawText = String(rawText || "");
    this.blockId = String(blockId || "");
    this.isExpanded = Boolean(isExpanded);
  }

  eq(other) {
    return (
      other instanceof TableBlockWidget
      && other.rawText === this.rawText
      && other.blockId === this.blockId
      && other.isExpanded === this.isExpanded
    );
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-table-widget";
    wrapper.setAttribute("data-table-block-id", this.blockId);

    const content = document.createElement("span");
    content.className = "cm-table-widget-content";

    const parsed = parseMarkdownTableRaw(this.rawText);
    if (!parsed) {
      const fallback = document.createElement("span");
      fallback.className = "cm-math-fallback";
      fallback.textContent = "Invalid markdown table";
      content.appendChild(fallback);
    } else {
      const tableEl = document.createElement("table");
      tableEl.className = "cm-table-widget-table";

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      parsed.headers.forEach((cellText, index) => {
        const th = document.createElement("th");
        const align = parsed.alignments[index];
        if (align) {
          th.style.textAlign = align;
        }
        th.textContent = cellText;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      tableEl.appendChild(thead);

      const tbody = document.createElement("tbody");
      parsed.rows.forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((cellText, index) => {
          const td = document.createElement("td");
          const align = parsed.alignments[index];
          if (align) {
            td.style.textAlign = align;
          }
          td.textContent = cellText;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tableEl.appendChild(tbody);
      content.appendChild(tableEl);
    }

    const btn = document.createElement("span");
    btn.className = "cm-table-widget-btn";
    btn.textContent = this.isExpanded ? SOURCE_TOGGLE_ICON_EXPANDED : SOURCE_TOGGLE_ICON_COLLAPSED;
    btn.setAttribute("title", sourceToggleTitle(this.isExpanded));
    btn.setAttribute("data-table-block-id", this.blockId);

    wrapper.appendChild(content);
    wrapper.appendChild(btn);
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
    wrapper.className = "cm-inline-math-widget";
    wrapper.setAttribute("data-math-inline-from", String(this.from));
    wrapper.setAttribute("data-math-inline-to", String(this.to));
    wrapper.setAttribute("title", "Click to edit formula source");
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

const addHiddenSyntaxRangeDecoration = (decorations, from, to) => {
  if (to <= from) {
    return;
  }
  decorations.push(Decoration.replace({}).range(from, to));
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

export const setPresentationDataEffect = StateEffect.define();

// Toggle hidden-source preview for image/math/table blocks.
export const toggleImageExpandEffect = StateEffect.define();
export const toggleMathExpandEffect = StateEffect.define();
export const toggleTableExpandEffect = StateEffect.define();
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

const tableExpandField = StateField.define({
  create: () => new Set(),
  update: (value, transaction) => {
    let next = new Set(value);
    for (const effect of transaction.effects) {
      if (effect.is(toggleTableExpandEffect)) {
        const tableId = String(effect.value || "");
        if (next.has(tableId)) {
          next.delete(tableId);
        } else {
          next.add(tableId);
        }
        continue;
      }
      if (effect.is(setPresentationDataEffect)) {
        const blocks = Array.isArray(effect.value?.blocks) ? effect.value.blocks : [];
        const validTableIds = new Set(
          blocks
            .map((block) => tableExpandKeyOf(block))
            .filter(Boolean)
        );
        next = validTableIds.size
          ? new Set([...next].filter((id) => validTableIds.has(id)))
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
  const selection = selectionSnapshotOf(view.state);
  const activeInlineToken = pickActiveInlineSyntaxToken(blocks, selection, docLength);
  const contextHighlightBlockId = view.state.field(contextHighlightField) || "";
  const imageExpandSet = view.state.field(imageExpandField) || new Set();
  const imageWidthMap = view.state.field(imageWidthField) || new Map();
  const mathExpandSet = view.state.field(mathExpandField) || new Set();
  const tableExpandSet = view.state.field(tableExpandField) || new Set();

  for (const block of blocks) {
    try {
      const blockFrom = clampPos(block?.from, docLength);
      const blockTo = clampPos(block?.to, docLength);
      const blockType = String(block?.type || "");
      const imageExpandKey = imageExpandKeyOf({ type: blockType, from: blockFrom });
      const mathExpandKey = mathExpandKeyOf({ type: blockType, from: blockFrom });
      const tableExpandKey = tableExpandKeyOf({ type: blockType, from: blockFrom });
      const isImageExpanded = imageExpandSet.has(imageExpandKey);
      const isMathExpanded = mathExpandSet.has(mathExpandKey);
      const isTableExpanded = tableExpandSet.has(tableExpandKey);
      // Keep source visible for focused source-first block types or expanded media/math blocks.
      const blockKeepsSourceVisible = (SOURCE_VISIBLE_BLOCK_TYPES.has(blockType)
        && selectionIntersectsRange(selection, blockFrom, blockTo)) || isImageExpanded || isMathExpanded || isTableExpanded;
      const hideImageSourceLines = blockType === "image" && !blockKeepsSourceVisible;
      const hideMathSourceLines = blockType === "math_block" && !blockKeepsSourceVisible;
      const hideTableSourceLines = blockType === "table" && !blockKeepsSourceVisible;

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
        const isMathSourceAnchorLine = hideMathSourceLines && lineNumber === lineRange.fromLine;
        const isMathSourceHiddenLine = hideMathSourceLines && !isMathSourceAnchorLine;
        const isTableSourceAnchorLine = hideTableSourceLines && lineNumber === lineRange.fromLine;
        const isTableSourceHiddenLine = hideTableSourceLines && !isTableSourceAnchorLine;
        const className = [
          baseClass,
          isImageSourceAnchorLine ? "cm-block-image-source-anchor" : "",
          isImageSourceHiddenLine ? "cm-block-image-source-hidden" : "",
          isMathSourceAnchorLine ? "cm-block-math-source-anchor" : "",
          isMathSourceHiddenLine ? "cm-block-math-source-hidden" : "",
          isTableSourceAnchorLine ? "cm-block-table-source-anchor" : "",
          isTableSourceHiddenLine ? "cm-block-table-source-hidden" : ""
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
        const widgetPos = isMathExpanded ? blockTo : blockFrom;
        const widgetSide = isMathExpanded ? 1 : -1;
        decorations.push(
          Decoration.widget({
            widget: new MathBlockWidget({ formula, blockId: mathExpandKey, isExpanded: isMathExpanded }),
            side: widgetSide
          }).range(widgetPos)
        );
      }

      if (blockType === "table") {
        const rawText = String(block?.rawText || "");
        const widgetPos = isTableExpanded ? blockTo : blockFrom;
        const widgetSide = isTableExpanded ? 1 : -1;
        decorations.push(
          Decoration.widget({
            widget: new TableBlockWidget({ rawText, blockId: tableExpandKey, isExpanded: isTableExpanded }),
            side: widgetSide
          }).range(widgetPos)
        );
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
    const contextHighlightChanged = updateHasEffect(update, setContextHighlightBlockEffect);
    const imageExpandChanged = updateHasEffect(update, toggleImageExpandEffect);
    const imageWidthChanged = updateHasEffect(update, setImageWidthEffect);
    const mathExpandChanged = updateHasEffect(update, toggleMathExpandEffect);
    const tableExpandChanged = updateHasEffect(update, toggleTableExpandEffect);

    if (!blocksChanged && !currentChanged) {
      if (update.docChanged) {
        // Any document edit can invalidate old ranges; wait for semantic snapshot instead of remapping stale blocks.
        this.blocks = [];
        this.decorations = buildDecorations(update.view, this.blocks, this.currentBlockId);
      } else if (
        selectionChanged
        || contextHighlightChanged
        || imageExpandChanged
        || imageWidthChanged
        || mathExpandChanged
        || tableExpandChanged
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
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  const data = view.state.field(presentationDataField);
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const docLength = Number(view.state.doc.length || 0);

  let highlightedBlockId = resolveContextBlockIdentityFromWidget(target, blocks, docLength);
  if (!highlightedBlockId) {
    const pos = view.posAtCoords({
      x: Number(event.clientX || 0),
      y: Number(event.clientY || 0)
    });
    if (Number.isFinite(pos)) {
      highlightedBlockId = pickBlockIdentityAtPos(blocks, pos, docLength);
    }
  }

  if (view.state.field(contextHighlightField) !== highlightedBlockId) {
    view.dispatch({
      effects: setContextHighlightBlockEffect.of(highlightedBlockId)
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

const presentationMouseDownHandler = (event, view) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  const taskToggle = target.closest("[data-task-toggle-from]");
  if (taskToggle) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const resizeHandle = target.closest(".cm-image-widget-resize-handle");
  if (!resizeHandle) {
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

const presentationClickHandler = (event, view) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  const taskToggle = target.closest("[data-task-toggle-from]");
  if (taskToggle) {
    event.preventDefault();
    event.stopPropagation();
    const lineFrom = Number(taskToggle.getAttribute("data-task-toggle-from"));
    if (Number.isFinite(lineFrom)) {
      return toggleTaskListStateAtLine(view, lineFrom);
    }
    return true;
  }

  const imageBtn = target.closest(".cm-image-widget-btn");
  if (imageBtn) {
    event.preventDefault();
    event.stopPropagation();
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
    const blockId = mathBtn.getAttribute("data-math-block-id");
    if (blockId) {
      view.dispatch({
        effects: toggleMathExpandEffect.of(blockId)
      });
      return true;
    }
  }

  const tableBtn = target.closest(".cm-table-widget-btn");
  if (tableBtn) {
    event.preventDefault();
    event.stopPropagation();
    const blockId = tableBtn.getAttribute("data-table-block-id");
    if (blockId) {
      view.dispatch({
        effects: toggleTableExpandEffect.of(blockId)
      });
      return true;
    }
  }

  const inlineMath = target.closest(".cm-inline-math-widget");
  if (inlineMath) {
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
  tableExpandField,
  EditorView.baseTheme({
    ".cm-line.cm-block": {
      transition: "background-color 120ms ease, color 120ms ease"
    }
  }),
  EditorView.domEventHandlers({
    contextmenu: presentationContextMenuHandler,
    mousedown: presentationMouseDownHandler,
    click: presentationClickHandler
  }),
  ViewPlugin.fromClass(BlockPresentationPlugin, {
    decorations: (plugin) => plugin.decorations
  })
];
