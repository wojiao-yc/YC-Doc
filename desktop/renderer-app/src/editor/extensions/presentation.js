import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

const HEADING_PREFIX_PATTERN = /^\s{0,3}#{1,6}[ \t]+/;
const BLOCKQUOTE_PREFIX_PATTERN = /^\s{0,3}>\s?/;
const TASK_LIST_PREFIX_PATTERN = /^(\s*)([-+*])\s+\[( |x|X)\]\s+/;
const BULLET_LIST_PREFIX_PATTERN = /^(\s*)([-+*])\s+/;
const ORDERED_LIST_PREFIX_PATTERN = /^(\s*)(\d+)([.)])\s+/;
const INLINE_SYNTAX_TOKEN_TYPES = new Set(["em", "strong", "codespan", "del", "link"]);
const SOURCE_VISIBLE_BLOCK_TYPES = new Set([
  "heading",
  "bullet_list_item",
  "ordered_list_item",
  "task_list_item",
  "blockquote",
  "thematic_break",
  "table"
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

const mapRange = (changes, fromInput, toInput, nextDocLength) => {
  const fromBase = Number(fromInput || 0);
  const toBase = Number(toInput || fromBase);
  const mappedFrom = clampPos(changes.mapPos(fromBase, 1), nextDocLength);
  const mappedTo = clampPos(changes.mapPos(toBase, -1), nextDocLength);
  return {
    from: Math.min(mappedFrom, mappedTo),
    to: Math.max(mappedFrom, mappedTo)
  };
};

const remapInlineSegments = (segments, changes, nextDocLength) =>
  (Array.isArray(segments) ? segments : [])
    .map((segment) => {
      const mappedRange = mapRange(changes, segment?.from, segment?.to, nextDocLength);
      return {
        ...segment,
        from: mappedRange.from,
        to: mappedRange.to,
        innerFrom: mappedRange.from,
        innerTo: mappedRange.to,
        outerFrom: mappedRange.from,
        outerTo: mappedRange.to
      };
    })
    .filter((segment) => segment.to > segment.from);

const remapInlineTokens = (tokens, changes, nextDocLength) =>
  (Array.isArray(tokens) ? tokens : [])
    .map((token) => {
      const mappedRawRange = mapRange(changes, token?.rawFrom, token?.rawTo, nextDocLength);
      const mappedTextRange = mapRange(changes, token?.textFrom, token?.textTo, nextDocLength);
      return {
        ...token,
        rawFrom: mappedRawRange.from,
        rawTo: mappedRawRange.to,
        textFrom: mappedTextRange.from,
        textTo: mappedTextRange.to,
        children: remapInlineTokens(token?.children, changes, nextDocLength)
      };
    })
    .filter((token) => token.rawTo > token.rawFrom);

const splitMarkdownTableRow = (lineInput) => {
  let source = String(lineInput || "").trim();
  if (source.startsWith("|")) {
    source = source.slice(1);
  }
  if (source.endsWith("|")) {
    source = source.slice(0, -1);
  }

  const cells = [];
  let cell = "";
  let escaped = false;

  for (const char of source) {
    if (escaped) {
      cell += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "|") {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
};

const isMarkdownTableDelimiterCell = (cellInput) => /^:?-{3,}:?$/.test(String(cellInput || "").trim());

const parseMarkdownTable = (rawTextInput) => {
  const lines = String(rawTextInput || "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return null;
  }

  const header = splitMarkdownTableRow(lines[0]);
  const delimiter = splitMarkdownTableRow(lines[1]);
  if (!delimiter.length || delimiter.some((cell) => !isMarkdownTableDelimiterCell(cell))) {
    return null;
  }

  const rows = lines.slice(2).map((line) => splitMarkdownTableRow(line));
  const columnCount = Math.max(
    header.length,
    rows.reduce((max, row) => Math.max(max, row.length), 0)
  );

  if (columnCount <= 0) {
    return null;
  }

  const normalizeRow = (row) => {
    const next = [...row];
    while (next.length < columnCount) {
      next.push("");
    }
    return next.slice(0, columnCount);
  };

  return {
    header: normalizeRow(header),
    rows: rows.map((row) => normalizeRow(row))
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

class MarkdownTableWidget extends WidgetType {
  constructor(rawText = "", from = 0) {
    super();
    this.rawText = String(rawText || "");
    this.from = Number(from || 0);
  }

  eq(other) {
    return (
      other instanceof MarkdownTableWidget
      && other.rawText === this.rawText
      && other.from === this.from
    );
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-table-widget";
    wrap.setAttribute("data-table-from", String(this.from));

    const parsed = parseMarkdownTable(this.rawText);
    if (!parsed) {
      const fallback = document.createElement("div");
      fallback.className = "cm-table-widget-fallback";
      fallback.textContent = "Table";
      wrap.appendChild(fallback);
      return wrap;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const cell of parsed.header) {
      const th = document.createElement("th");
      th.textContent = cell;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const row of parsed.rows) {
      const tr = document.createElement("tr");
      for (const cell of row) {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

const remapPresentationBlocks = (blocks, changes, nextDocLength) =>
  blocks
    .map((block) => {
      const mappedRange = mapRange(changes, block?.from, block?.to, nextDocLength);
      return {
        ...block,
        from: mappedRange.from,
        to: mappedRange.to,
        inlineTokens: remapInlineTokens(block?.inlineTokens, changes, nextDocLength),
        inlineSegments: remapInlineSegments(block?.inlineSegments, changes, nextDocLength)
      };
    })
    .filter((block) => block.to > block.from);

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
  if (block?.type === "task_list_item") {
    return block?.attrs?.checked ? "[x]" : "[ ]";
  }
  if (block?.type === "ordered_list_item") {
    const marker = String(block?.attrs?.marker || match?.[3] || ".");
    const index = Math.max(1, Number(block?.attrs?.index || match?.[2] || 1));
    return `${index}${marker}`;
  }
  return "-";
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
  decorations.push(
    Decoration.widget({
      widget: new ListPrefixWidget({
        blockType: String(block?.type || ""),
        text: listPrefixLabelForBlock(block, match),
        checked: Boolean(block?.attrs?.checked)
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

  for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const match = String(line.text || "").match(BLOCKQUOTE_PREFIX_PATTERN);
    if (!match) {
      continue;
    }
    const prefixFrom = line.from;
    const prefixTo = Math.min(line.to, line.from + match[0].length);
    addHiddenSyntaxRangeDecoration(decorations, prefixFrom, prefixTo);
  }
};

const addTablePreviewDecorationForBlock = (decorations, block, docLength) => {
  const from = clampPos(block?.from, docLength);
  const to = clampPos(block?.to, docLength);
  if (to <= from) {
    return;
  }
  decorations.push(
    Decoration.replace({
      block: true,
      widget: new MarkdownTableWidget(String(block?.rawText || ""), from)
    }).range(from, to)
  );
};

const isTokenRelatedToActiveToken = (token, activeToken) => {
  if (!activeToken) {
    return false;
  }
  const tokenInsideActive = token.rawFrom >= activeToken.rawFrom && token.rawTo <= activeToken.rawTo;
  const tokenContainsActive = token.rawFrom <= activeToken.rawFrom && token.rawTo >= activeToken.rawTo;
  return tokenInsideActive || tokenContainsActive;
};

export const setPresentationDataEffect = StateEffect.define();

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

const classesForBlockLine = (block, currentBlockId, lineNumber, lineRange, sourceVisible = false) => {
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

  return classes.join(" ");
};

const buildDecorations = (view, blocks, currentBlockId) => {
  const decorations = [];
  const doc = view.state.doc;
  const docLength = Number(doc.length || 0);
  const selection = selectionSnapshotOf(view.state);
  const activeInlineToken = pickActiveInlineSyntaxToken(blocks, selection, docLength);

  for (const block of blocks) {
    const blockFrom = clampPos(block?.from, docLength);
    const blockTo = clampPos(block?.to, docLength);
    const blockType = String(block?.type || "");
    const blockKeepsSourceVisible = SOURCE_VISIBLE_BLOCK_TYPES.has(blockType)
      && selectionIntersectsRange(selection, blockFrom, blockTo);

    const lineRange = resolveLineRange(doc, block);
    for (let lineNumber = lineRange.fromLine; lineNumber <= lineRange.toLine; lineNumber += 1) {
      const line = doc.line(lineNumber);
      decorations.push(
        Decoration.line({
          attributes: {
            class: classesForBlockLine(block, currentBlockId, lineNumber, lineRange, blockKeepsSourceVisible)
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
      } else if (blockType === "table") {
        addTablePreviewDecorationForBlock(decorations, block, docLength);
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
        continue;
      }
      addHiddenSyntaxDecorationsForToken(decorations, token);
    }
  }

  return Decoration.set(decorations, true);
};

const isWholeDocumentReplacement = (update) => {
  let changeCount = 0;
  let replaceAll = true;

  update.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    changeCount += 1;
    if (
      fromA !== 0
      || toA !== update.startState.doc.length
      || fromB !== 0
      || toB !== update.state.doc.length
    ) {
      replaceAll = false;
    }
  });

  return changeCount === 1 && replaceAll;
};

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

    if (!blocksChanged && !currentChanged) {
      if (update.docChanged) {
        // A replace-all edit invalidates every old block range at once, so wait for the next snapshot.
        this.blocks = isWholeDocumentReplacement(update)
          ? []
          : remapPresentationBlocks(this.blocks, update.changes, update.state.doc.length);
        this.decorations = buildDecorations(update.view, this.blocks, this.currentBlockId);
      } else if (selectionChanged) {
        this.decorations = buildDecorations(update.view, this.blocks, this.currentBlockId);
      }
      return;
    }

    this.blocks = nextBlocks;
    this.currentBlockId = nextCurrentBlockId;
    this.decorations = buildDecorations(update.view, this.blocks, this.currentBlockId);
  }
}

export const presentationExtensions = [
  presentationDataField,
  EditorView.baseTheme({
    ".cm-line.cm-block": {
      transition: "background-color 120ms ease, color 120ms ease"
    }
  }),
  ViewPlugin.fromClass(BlockPresentationPlugin, {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      mousedown: (event, view) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return false;
        }
        const tableRoot = target.closest(".cm-table-widget");
        if (!tableRoot) {
          return false;
        }
        const from = Number(tableRoot.getAttribute("data-table-from") || 0);
        if (!Number.isFinite(from)) {
          return false;
        }
        view.dispatch({
          selection: {
            anchor: Math.max(0, Math.min(view.state.doc.length, from))
          },
          scrollIntoView: true
        });
        view.focus();
        return true;
      }
    }
  })
];
