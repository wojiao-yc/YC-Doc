import { h, render } from "vue";
import { EditorView, ViewPlugin } from "@codemirror/view";
import AppIcon from "../../components/AppIcon.vue";
import { parseMarkdownToBlocks } from "../parser/parse-blocks.js";
import { resolveInlineFormattingPlaceholder } from "../utils/inline-formatting.js";

const MENU_GAP = 8;
const SUBMENU_GAP = 2;
const SUBMENU_OPEN_DELAY_MS = 140;
const SUBMENU_CLOSE_DELAY_MS = 240;
const DEFAULT_LINK_URL = "https://";
let contextMenuRuntimeOptions = {};
const TABLE_CELL_FORMAT_COMMAND_IDS = new Set([
  "add-link",
  "add-external-link",
  "format-bold",
  "format-italic",
  "format-strike",
  "format-highlight",
  "format-code",
  "format-math",
  "format-comment",
  "format-clear"
]);

export const setContextMenuRuntimeOptions = (nextOptions = {}) => {
  contextMenuRuntimeOptions = nextOptions && typeof nextOptions === "object"
    ? nextOptions
    : {};
};

const safeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const clampPos = (valueInput, docLengthInput) => {
  const docLength = Math.max(0, Number(docLengthInput || 0));
  const value = Number(valueInput);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(docLength, Math.round(value)));
};

const normalizeRange = (rangeInput, docLengthInput) => {
  const docLength = Math.max(0, Number(docLengthInput || 0));
  const from = clampPos(rangeInput?.from, docLength);
  const to = clampPos(rangeInput?.to, docLength);
  return {
    from: Math.min(from, to),
    to: Math.max(from, to)
  };
};

const resolveBlockRangeAtPos = (view, posInput) => {
  const doc = view?.state?.doc;
  if (!doc) {
    return null;
  }

  const docLength = Number(doc.length || 0);
  const pos = clampPos(posInput, docLength);
  const fallbackLine = doc.lineAt(pos);
  const fallbackRange = {
    from: fallbackLine.from,
    to: fallbackLine.to
  };

  let blocks = [];
  try {
    blocks = parseMarkdownToBlocks(doc.toString());
  } catch {
    blocks = [];
  }
  if (!Array.isArray(blocks) || !blocks.length) {
    return fallbackRange;
  }

  let pickedRange = null;
  let pickedSpan = Number.POSITIVE_INFINITY;
  for (const block of blocks) {
    const range = normalizeRange({
      from: block?.from,
      to: block?.to
    }, docLength);
    if (pos < range.from || pos > range.to) {
      continue;
    }
    const span = Math.max(0, range.to - range.from);
    if (span <= pickedSpan) {
      pickedSpan = span;
      pickedRange = range;
    }
  }

  return pickedRange || fallbackRange;
};

const selectionRangeOf = (view) => {
  const main = view.state.selection.main;
  return {
    from: Math.min(main.from, main.to),
    to: Math.max(main.from, main.to),
    empty: main.empty
  };
};

const clampIndex = (valueInput, minInput, maxInput) => {
  const min = Number.isFinite(minInput) ? minInput : 0;
  const max = Number.isFinite(maxInput) ? maxInput : min;
  const value = Number(valueInput);
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
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

const tableBlockStartFromId = (blockIdInput) => {
  const match = String(blockIdInput || "").match(/^table:(\d+)$/);
  if (!match) {
    return Number.NaN;
  }
  return Number(match[1]);
};

const isMarkdownTableLine = (lineTextInput) => /^\s*\|.*\|\s*$/.test(String(lineTextInput || ""));

const resolveTableRangeByBlockId = (view, blockIdInput) => {
  const blockStart = tableBlockStartFromId(blockIdInput);
  if (!Number.isFinite(blockStart)) {
    return null;
  }

  const doc = view?.state?.doc;
  if (!doc) {
    return null;
  }

  const docLength = Number(doc.length || 0);
  const safeStart = Math.max(0, Math.min(docLength, blockStart));
  let lineNumber = doc.lineAt(safeStart).number;
  let line = doc.line(lineNumber);
  if (!isMarkdownTableLine(line.text)) {
    let found = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const candidate = lineNumber + offset;
      if (candidate < 1 || candidate > doc.lines) {
        continue;
      }
      const candidateLine = doc.line(candidate);
      if (isMarkdownTableLine(candidateLine.text)) {
        lineNumber = candidate;
        line = candidateLine;
        found = 1;
        break;
      }
    }
    if (!found) {
      return null;
    }
  }

  let startLine = lineNumber;
  while (startLine > 1 && isMarkdownTableLine(doc.line(startLine - 1).text)) {
    startLine -= 1;
  }

  let endLine = lineNumber;
  while (endLine < doc.lines && isMarkdownTableLine(doc.line(endLine + 1).text)) {
    endLine += 1;
  }

  return {
    from: doc.line(startLine).from,
    to: doc.line(endLine).to
  };
};

const splitTableCells = (lineTextInput) =>
  String(lineTextInput || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => String(cell || "").trim());

const isTableDelimiterCell = (cellTextInput) => /^:?-{3,}:?$/.test(String(cellTextInput || "").trim());

const alignFromDelimiterCell = (cellTextInput) => {
  const cell = String(cellTextInput || "").trim();
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

const delimiterCellFromAlign = (alignInput) => {
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

const parseMarkdownTableModel = (rawTextInput) => {
  const lines = String(rawTextInput || "")
    .split("\n")
    .map((line) => String(line || ""))
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return null;
  }

  const headers = splitTableCells(lines[0]);
  const delimiterCells = splitTableCells(lines[1]);
  if (!headers.length || delimiterCells.length < headers.length) {
    return null;
  }
  for (let index = 0; index < headers.length; index += 1) {
    if (!isTableDelimiterCell(delimiterCells[index])) {
      return null;
    }
  }

  const columnCount = headers.length;
  const alignments = Array.from({ length: columnCount }, (_, index) => alignFromDelimiterCell(delimiterCells[index]));
  const rows = lines.slice(2).map((line) => {
    const cells = splitTableCells(line);
    return Array.from({ length: columnCount }, (_, index) => String(cells[index] || "").trim());
  });
  const indent = lines.find((line) => line.trim().length > 0)?.match(/^\s*/u)?.[0] || "";

  return {
    headers: Array.from({ length: columnCount }, (_, index) => String(headers[index] || "").trim()),
    alignments,
    rows,
    indent
  };
};

const serializeMarkdownTableModel = (modelInput) => {
  const headersSource = Array.isArray(modelInput?.headers) ? modelInput.headers : [];
  const columnCount = Math.max(1, Number(headersSource.length || 0));
  const headers = Array.from({ length: columnCount }, (_, index) => String(headersSource[index] || "").trim());
  const alignmentsSource = Array.isArray(modelInput?.alignments) ? modelInput.alignments : [];
  const delimiter = Array.from({ length: columnCount }, (_, index) => delimiterCellFromAlign(alignmentsSource[index]));
  const rowsSource = Array.isArray(modelInput?.rows) ? modelInput.rows : [];
  const rows = rowsSource.map((row) =>
    Array.from({ length: columnCount }, (_, index) => String(row?.[index] || "").trim())
  );
  const indent = String(modelInput?.indent || "");
  const lineOf = (cells) => `${indent}| ${cells.join(" | ")} |`;
  return [lineOf(headers), lineOf(delimiter), ...rows.map((row) => lineOf(row))].join("\n");
};

const persistTableByBlockId = (view, blockIdInput, transform) => {
  const blockId = String(blockIdInput || "");
  if (!blockId || typeof transform !== "function") {
    return false;
  }
  const range = resolveTableRangeByBlockId(view, blockId);
  if (!range) {
    return false;
  }
  const rawText = view.state.doc.sliceString(range.from, range.to);
  const model = parseMarkdownTableModel(rawText);
  if (!model) {
    return false;
  }
  const nextModel = transform(model);
  if (!nextModel) {
    return false;
  }
  const nextRaw = serializeMarkdownTableModel(nextModel);
  if (!nextRaw || nextRaw === rawText) {
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

const tableColumnCount = (model) => Math.max(1, Number(model?.headers?.length || 0));

const normalizeTableRows = (model) => {
  const columnCount = tableColumnCount(model);
  const rows = Array.isArray(model?.rows) ? model.rows : [];
  return rows.map((row) => Array.from({ length: columnCount }, (_, index) => String(row?.[index] || "")));
};

const normalizeTableHeaders = (model) =>
  Array.from({ length: tableColumnCount(model) }, (_, index) => String(model?.headers?.[index] || ""));

const normalizeTableAlignments = (model) =>
  Array.from({ length: tableColumnCount(model) }, (_, index) => String(model?.alignments?.[index] || ""));

const resolveTableRowIndex = (model, context = {}) => {
  const rows = Array.isArray(model?.rows) ? model.rows : [];
  if (!rows.length) {
    return 0;
  }
  return clampIndex(context.rowIndex, 0, rows.length - 1);
};

const resolveTableColIndex = (model, context = {}) =>
  clampIndex(context.colIndex, 0, Math.max(0, tableColumnCount(model) - 1));

const tableRowsWithInserted = (model, insertIndexInput, sourceRow = null) => {
  const rows = normalizeTableRows(model);
  const columnCount = tableColumnCount(model);
  const insertIndex = clampIndex(insertIndexInput, 0, rows.length);
  const nextRow = sourceRow
    ? Array.from({ length: columnCount }, (_, index) => String(sourceRow[index] || ""))
    : Array.from({ length: columnCount }, () => "");
  rows.splice(insertIndex, 0, nextRow);
  return rows;
};

const tableRowsSortedByColumn = (model, colIndexInput, direction = "asc") => {
  const rows = normalizeTableRows(model);
  if (rows.length <= 1) {
    return rows;
  }
  const colIndex = clampIndex(colIndexInput, 0, Math.max(0, tableColumnCount(model) - 1));
  const collator = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });
  const factor = direction === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = String(left.row[colIndex] || "").trim();
      const rightValue = String(right.row[colIndex] || "").trim();
      const compared = collator.compare(leftValue, rightValue) * factor;
      if (compared !== 0) {
        return compared;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.row);
};

const transformTableByCommand = (model, commandIdInput, context = {}) => {
  const commandId = String(commandIdInput || "");
  if (!commandId.startsWith("table-")) {
    return null;
  }

  const columnCount = tableColumnCount(model);
  const headers = normalizeTableHeaders(model);
  const alignments = normalizeTableAlignments(model);
  const rows = normalizeTableRows(model);
  const rowIndex = resolveTableRowIndex(model, context);
  const colIndex = resolveTableColIndex(model, context);

  if (commandId === "table-row-insert-above") {
    return {
      ...model,
      headers,
      alignments,
      rows: tableRowsWithInserted(model, rowIndex)
    };
  }
  if (commandId === "table-row-insert-below") {
    const insertIndex = rows.length ? rowIndex + 1 : 0;
    return {
      ...model,
      headers,
      alignments,
      rows: tableRowsWithInserted(model, insertIndex)
    };
  }
  if (commandId === "table-row-move-up") {
    if (rows.length <= 1) {
      return model;
    }
    return {
      ...model,
      headers,
      alignments,
      rows: moveArrayItem(rows, rowIndex, Math.max(0, rowIndex - 1))
    };
  }
  if (commandId === "table-row-move-down") {
    if (rows.length <= 1) {
      return model;
    }
    return {
      ...model,
      headers,
      alignments,
      rows: moveArrayItem(rows, rowIndex, Math.min(rows.length - 1, rowIndex + 1))
    };
  }
  if (commandId === "table-row-copy") {
    if (!rows.length) {
      return {
        ...model,
        headers,
        alignments,
        rows: tableRowsWithInserted(model, 0)
      };
    }
    return {
      ...model,
      headers,
      alignments,
      rows: tableRowsWithInserted(model, rowIndex + 1, rows[rowIndex])
    };
  }
  if (commandId === "table-row-delete") {
    if (!rows.length) {
      return model;
    }
    const nextRows = rows.slice();
    nextRows.splice(rowIndex, 1);
    return {
      ...model,
      headers,
      alignments,
      rows: nextRows
    };
  }

  if (commandId === "table-col-insert-left" || commandId === "table-col-insert-right") {
    const insertIndex = commandId === "table-col-insert-left" ? colIndex : colIndex + 1;
    const safeInsert = clampIndex(insertIndex, 0, columnCount);
    const nextHeaders = headers.slice();
    const nextAlignments = alignments.slice();
    nextHeaders.splice(safeInsert, 0, "");
    nextAlignments.splice(safeInsert, 0, "");
    const nextRows = rows.map((row) => {
      const nextRow = row.slice();
      nextRow.splice(safeInsert, 0, "");
      return nextRow;
    });
    return {
      ...model,
      headers: nextHeaders,
      alignments: nextAlignments,
      rows: nextRows
    };
  }
  if (commandId === "table-col-move-left") {
    if (columnCount <= 1) {
      return model;
    }
    const target = Math.max(0, colIndex - 1);
    return {
      ...model,
      headers: moveArrayItem(headers, colIndex, target),
      alignments: moveArrayItem(alignments, colIndex, target),
      rows: rows.map((row) => moveArrayItem(row, colIndex, target))
    };
  }
  if (commandId === "table-col-move-right") {
    if (columnCount <= 1) {
      return model;
    }
    const target = Math.min(columnCount - 1, colIndex + 1);
    return {
      ...model,
      headers: moveArrayItem(headers, colIndex, target),
      alignments: moveArrayItem(alignments, colIndex, target),
      rows: rows.map((row) => moveArrayItem(row, colIndex, target))
    };
  }
  if (commandId === "table-col-copy") {
    const insertIndex = colIndex + 1;
    const nextHeaders = headers.slice();
    const nextAlignments = alignments.slice();
    nextHeaders.splice(insertIndex, 0, headers[colIndex] || "");
    nextAlignments.splice(insertIndex, 0, alignments[colIndex] || "");
    const nextRows = rows.map((row) => {
      const nextRow = row.slice();
      nextRow.splice(insertIndex, 0, String(row[colIndex] || ""));
      return nextRow;
    });
    return {
      ...model,
      headers: nextHeaders,
      alignments: nextAlignments,
      rows: nextRows
    };
  }
  if (commandId === "table-col-delete") {
    if (columnCount <= 1) {
      return model;
    }
    const nextHeaders = headers.slice();
    const nextAlignments = alignments.slice();
    nextHeaders.splice(colIndex, 1);
    nextAlignments.splice(colIndex, 1);
    const nextRows = rows.map((row) => {
      const nextRow = row.slice();
      nextRow.splice(colIndex, 1);
      return nextRow;
    });
    return {
      ...model,
      headers: nextHeaders,
      alignments: nextAlignments,
      rows: nextRows
    };
  }
  if (commandId === "table-col-align-left" || commandId === "table-col-align-center" || commandId === "table-col-align-right") {
    const nextAlignments = alignments.slice();
    const align = commandId.endsWith("-center")
      ? "center"
      : commandId.endsWith("-right")
        ? "right"
        : "left";
    nextAlignments[colIndex] = align;
    return {
      ...model,
      headers,
      alignments: nextAlignments,
      rows
    };
  }
  if (commandId === "table-sort-asc" || commandId === "table-sort-desc") {
    return {
      ...model,
      headers,
      alignments,
      rows: tableRowsSortedByColumn(model, colIndex, commandId.endsWith("-desc") ? "desc" : "asc")
    };
  }
  return null;
};

const selectionRangeInsideElement = (element) => {
  if (!(element instanceof HTMLElement) || typeof window === "undefined" || typeof window.getSelection !== "function") {
    return null;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount <= 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
    return null;
  }
  return range;
};

const ensureTableCellSelectionRange = (editableCell) => {
  const cell = editableCell instanceof HTMLElement ? editableCell : null;
  if (!cell) {
    return null;
  }
  const directRange = selectionRangeInsideElement(cell);
  if (directRange && !directRange.collapsed) {
    return directRange;
  }
  const text = String(cell.textContent || "");
  if (!text.trim()) {
    return null;
  }
  const selection = window.getSelection();
  if (!selection) {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(cell);
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
};

const wrapTableCellSelectionWithTag = (editableCell, tagName, attributes = null) => {
  const cell = editableCell instanceof HTMLElement ? editableCell : null;
  if (!cell) {
    return false;
  }
  const range = ensureTableCellSelectionRange(cell);
  if (!range) {
    return false;
  }

  const wrapper = document.createElement(String(tagName || "span"));
  const attrs = attributes && typeof attributes === "object" ? attributes : null;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (!key || value == null) {
        continue;
      }
      wrapper.setAttribute(key, String(value));
    }
  }

  const fragment = range.extractContents();
  wrapper.appendChild(fragment);
  range.insertNode(wrapper);

  const selection = window.getSelection();
  if (selection) {
    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }
  cell.focus();
  return true;
};

const surroundTableCellSelectionWithText = (editableCell, prefixInput, suffixInput) => {
  const cell = editableCell instanceof HTMLElement ? editableCell : null;
  if (!cell) {
    return false;
  }
  const range = ensureTableCellSelectionRange(cell);
  if (!range) {
    return false;
  }
  const selectedText = range.toString();
  const prefix = String(prefixInput || "");
  const suffix = String(suffixInput || "");
  const textNode = document.createTextNode(`${prefix}${selectedText}${suffix}`);
  range.deleteContents();
  range.insertNode(textNode);

  const selection = window.getSelection();
  if (selection) {
    const nextRange = document.createRange();
    nextRange.setStart(textNode, prefix.length);
    nextRange.setEnd(textNode, prefix.length + selectedText.length);
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }
  cell.focus();
  return true;
};

const applyTableCellInlineFormat = (commandIdInput, menuContext = {}) => {
  const commandId = String(commandIdInput || "");
  const editableCell = menuContext?.table?.editableCell;
  if (!(editableCell instanceof HTMLElement)) {
    return false;
  }

  const finalize = (handled) => {
    if (!handled) {
      return false;
    }
    try {
      editableCell.dispatchEvent(new Event("focusout", { bubbles: true }));
    } catch {
      // ignore
    }
    editableCell.focus();
    return true;
  };

  if (commandId === "format-bold") {
    return finalize(wrapTableCellSelectionWithTag(editableCell, "strong"));
  }
  if (commandId === "format-italic") {
    return finalize(wrapTableCellSelectionWithTag(editableCell, "em"));
  }
  if (commandId === "format-strike") {
    return finalize(wrapTableCellSelectionWithTag(editableCell, "del"));
  }
  if (commandId === "format-highlight") {
    return finalize(wrapTableCellSelectionWithTag(editableCell, "mark"));
  }
  if (commandId === "format-code") {
    return finalize(wrapTableCellSelectionWithTag(editableCell, "code"));
  }
  if (commandId === "format-math") {
    return finalize(surroundTableCellSelectionWithText(editableCell, "$", "$"));
  }
  if (commandId === "format-comment") {
    return finalize(surroundTableCellSelectionWithText(editableCell, "%%", "%%"));
  }
  if (commandId === "format-clear") {
    const range = ensureTableCellSelectionRange(editableCell);
    if (!range) {
      return false;
    }
    const cleaned = clearInlineMarkdownSyntax(range.toString());
    const textNode = document.createTextNode(cleaned);
    range.deleteContents();
    range.insertNode(textNode);
    return finalize(true);
  }
  if (commandId === "add-link") {
    return finalize(surroundTableCellSelectionWithText(editableCell, "[[", "]]"));
  }
  if (commandId === "add-external-link") {
    const prompted = promptLinkUrl(DEFAULT_LINK_URL);
    if (prompted == null) {
      return false;
    }
    const url = String(prompted || "").trim() || DEFAULT_LINK_URL;
    return finalize(wrapTableCellSelectionWithTag(editableCell, "a", { href: url }));
  }
  return false;
};

const resolveTableContextFromTarget = (targetInput) => {
  const target = targetInput instanceof Element ? targetInput : null;
  if (!target) {
    return null;
  }
  const tableHost = target.closest("[data-table-block-id]");
  if (!(tableHost instanceof Element)) {
    return null;
  }

  const blockId = String(tableHost.getAttribute("data-table-block-id") || "");
  if (!blockId) {
    return null;
  }

  const editableCell = target.closest("[data-table-edit='true']");
  const rowHandle = target.closest("[data-table-row-handle]");
  const colHandle = target.closest("[data-table-col-handle]");
  const tableCell = target.closest("td, th");
  const tableWidget = tableHost.closest(".cm-table-widget");

  const section = editableCell instanceof Element
    ? String(editableCell.getAttribute("data-table-section") || "body").toLowerCase()
    : tableCell?.tagName?.toLowerCase() === "th"
      ? "header"
      : "body";

  let rowIndex = Number.NaN;
  let colIndex = Number.NaN;
  let activeHandleAxis = "";

  if (editableCell instanceof Element) {
    rowIndex = Number(editableCell.getAttribute("data-table-row-index"));
    colIndex = Number(editableCell.getAttribute("data-table-col-index"));
  }
  if (rowHandle instanceof Element) {
    activeHandleAxis = "row";
    if (!Number.isFinite(rowIndex)) {
      rowIndex = Number(rowHandle.getAttribute("data-table-row-index"));
    }
  }
  if (colHandle instanceof Element) {
    activeHandleAxis = "column";
    if (!Number.isFinite(colIndex)) {
      colIndex = Number(colHandle.getAttribute("data-table-col-index"));
    }
  }

  if (!activeHandleAxis && tableWidget instanceof Element) {
    const selectedRowHandle = tableWidget.querySelector(".cm-table-widget-row-handle.is-selected-handle");
    const selectedColHandle = tableWidget.querySelector(".cm-table-widget-col-handle.is-selected-handle");
    if (selectedRowHandle) {
      activeHandleAxis = "row";
      if (!Number.isFinite(rowIndex)) {
        rowIndex = Number(selectedRowHandle.getAttribute("data-table-row-index"));
      }
    } else if (selectedColHandle) {
      activeHandleAxis = "column";
      if (!Number.isFinite(colIndex)) {
        colIndex = Number(selectedColHandle.getAttribute("data-table-col-index"));
      }
    }
  }

  if (tableWidget instanceof Element && activeHandleAxis === "row" && !Number.isFinite(rowIndex)) {
    const selectedRow = tableWidget.querySelector("tbody tr.is-handle-selected-row");
    if (selectedRow instanceof HTMLTableRowElement) {
      rowIndex = Number(selectedRow.sectionRowIndex);
    }
  }
  if (tableWidget instanceof Element && activeHandleAxis === "column" && !Number.isFinite(colIndex)) {
    const selectedColHandle = tableWidget.querySelector(".cm-table-widget-col-handle.is-selected-handle");
    if (selectedColHandle instanceof Element) {
      colIndex = Number(selectedColHandle.getAttribute("data-table-col-index"));
    }
    if (!Number.isFinite(colIndex)) {
      const selectedCell = tableWidget.querySelector("thead th.is-handle-selected-col, tbody td.is-handle-selected-col");
      if (selectedCell instanceof HTMLTableCellElement) {
        colIndex = Number(selectedCell.cellIndex);
      }
    }
  }
  if (tableCell instanceof HTMLTableCellElement) {
    if (!Number.isFinite(colIndex)) {
      colIndex = Number(tableCell.cellIndex);
    }
    if (!Number.isFinite(rowIndex) && tableCell.parentElement instanceof HTMLTableRowElement) {
      const row = tableCell.parentElement;
      const sectionEl = row.parentElement;
      if (sectionEl?.tagName?.toLowerCase() === "tbody") {
        rowIndex = Number(row.sectionRowIndex);
      }
    }
  }

  return {
    blockId,
    section,
    rowIndex: Number.isFinite(rowIndex) ? rowIndex : 0,
    colIndex: Number.isFinite(colIndex) ? colIndex : 0,
    activeHandleAxis,
    editableCell: editableCell instanceof HTMLElement ? editableCell : null
  };
};

const replaceSelection = (view, insert, selection = null) => {
  const range = selectionRangeOf(view);
  const text = String(insert ?? "");
  const fallbackCursor = range.from + text.length;
  const anchor = safeNumber(selection?.anchor, fallbackCursor);
  const head = safeNumber(selection?.head, anchor);
  view.dispatch({
    changes: {
      from: range.from,
      to: range.to,
      insert: text
    },
    selection: { anchor, head },
    scrollIntoView: true,
    userEvent: "input"
  });
  view.focus();
  return true;
};

const surroundSelection = (view, { prefix = "", suffix = "", placeholder = "" } = {}) => {
  const range = selectionRangeOf(view);
  const selectedText = view.state.sliceDoc(range.from, range.to);
  const inner = range.empty
    ? resolveInlineFormattingPlaceholder({ prefix, suffix, placeholder })
    : selectedText;
  const insert = `${prefix}${inner}${suffix}`;
  const innerFrom = range.from + String(prefix).length;
  const innerTo = innerFrom + inner.length;
  return replaceSelection(view, insert, { anchor: innerFrom, head: innerTo });
};

const selectedLinesRangeOf = (view) => {
  const doc = view.state.doc;
  const range = selectionRangeOf(view);
  const startLine = doc.lineAt(range.from);
  const endPos = range.empty ? range.from : Math.max(range.from, range.to - 1);
  const endLine = doc.lineAt(endPos);
  return {
    from: startLine.from,
    to: endLine.to
  };
};

const replaceSelectedLines = (view, transformLine) => {
  const doc = view.state.doc;
  const range = selectedLinesRangeOf(view);
  const raw = doc.sliceString(range.from, range.to);
  const lines = raw.split("\n");
  const next = lines.map((line, index) => transformLine(String(line || ""), index, lines)).join("\n");
  view.dispatch({
    changes: {
      from: range.from,
      to: range.to,
      insert: next
    },
    selection: {
      anchor: range.from,
      head: range.from + next.length
    },
    scrollIntoView: true,
    userEvent: "input"
  });
  view.focus();
  return true;
};

const BLOCK_PREFIX_PATTERN = /^(\s{0,3})(?:>\s*|#{1,6}[ \t]+|[-+*][ \t]+\[(?: |x|X)\][ \t]+|[-+*][ \t]+|\d+[.)][ \t]+)/;

const stripParagraphPrefix = (lineInput) => {
  let line = String(lineInput || "");
  for (let index = 0; index < 4; index += 1) {
    const next = line.replace(BLOCK_PREFIX_PATTERN, "$1");
    if (next === line) {
      break;
    }
    line = next;
  }
  return line;
};

const applyParagraphStyle = (view, style) => {
  let orderedIndex = 1;
  const headingMatch = String(style || "").match(/^h([1-6])$/);
  const headingLevel = headingMatch ? Number(headingMatch[1]) : 0;

  return replaceSelectedLines(view, (line) => {
    const normalized = stripParagraphPrefix(line);
    const content = normalized.trimStart();
    const hasContent = Boolean(content);

    if (style === "paragraph") {
      return normalized;
    }
    if (style === "bullet") {
      return hasContent ? `- ${content}` : "- ";
    }
    if (style === "ordered") {
      const text = hasContent ? `${orderedIndex}. ${content}` : `${orderedIndex}. `;
      orderedIndex += 1;
      return text;
    }
    if (style === "task") {
      return hasContent ? `- [ ] ${content}` : "- [ ] ";
    }
    if (style === "quote") {
      return hasContent ? `> ${content}` : "> ";
    }
    if (headingLevel >= 1 && headingLevel <= 6) {
      return hasContent ? `${"#".repeat(headingLevel)} ${content}` : `${"#".repeat(headingLevel)} `;
    }
    return line;
  });
};

const clearInlineMarkdownSyntax = (sourceInput) => {
  let source = String(sourceInput || "");
  const patterns = [
    [/\[\[([\s\S]+?)\]\]/g, "$1"],
    [/\[([^\]]+)\]\(([^)]+)\)/g, "$1"],
    [/%%([\s\S]+?)%%/g, "$1"],
    [/==([\s\S]+?)==/g, "$1"],
    [/~~([\s\S]+?)~~/g, "$1"],
    [/`([^`\n]+)`/g, "$1"],
    [/\$([^$\n]+)\$/g, "$1"],
    [/\*\*([\s\S]+?)\*\*/g, "$1"],
    [/__([\s\S]+?)__/g, "$1"],
    [/\*([^*\n]+)\*/g, "$1"],
    [/_([^_\n]+)_/g, "$1"]
  ];
  for (const [pattern, replacement] of patterns) {
    source = source.replace(pattern, replacement);
  }
  return source;
};

const commandClearFormat = (view) => {
  const range = selectionRangeOf(view);
  if (range.empty) {
    return false;
  }
  const selectedText = view.state.sliceDoc(range.from, range.to);
  const cleaned = clearInlineMarkdownSyntax(selectedText);
  return replaceSelection(view, cleaned, {
    anchor: range.from,
    head: range.from + cleaned.length
  });
};

const promptLinkUrl = (defaultValue = DEFAULT_LINK_URL) => {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    return defaultValue;
  }
  return window.prompt("请输入链接地址", defaultValue);
};

const commandInsertWikiLink = (view) => {
  const range = selectionRangeOf(view);
  const linkText = view.state.sliceDoc(range.from, range.to).trim();
  const markdown = `[[${linkText}]]`;
  return replaceSelection(view, markdown, {
    anchor: range.from + 2,
    head: range.from + 2 + linkText.length
  });
};

const commandInsertExternalLink = (view) => {
  const range = selectionRangeOf(view);
  const selectedText = view.state.sliceDoc(range.from, range.to).trim();
  const linkText = selectedText || "";
  const suggestedUrl = /^https?:\/\//i.test(selectedText) ? selectedText : DEFAULT_LINK_URL;
  const prompted = promptLinkUrl(suggestedUrl);
  if (prompted == null) {
    return false;
  }
  const url = String(prompted || "").trim() || DEFAULT_LINK_URL;
  const markdown = `[${linkText}](${url})`;
  return replaceSelection(view, markdown, {
    anchor: range.from + 1,
    head: range.from + 1 + linkText.length
  });
};

const insertBlockTemplate = (view, { prefixLine = "", suffixLine = "", placeholder = "" } = {}) => {
  const range = selectionRangeOf(view);
  const selectedText = view.state.sliceDoc(range.from, range.to);
  const inner = range.empty ? String(placeholder || "") : selectedText;
  const insert = `${prefixLine}\n${inner}\n${suffixLine}`;
  const innerFrom = range.from + String(prefixLine).length + 1;
  const innerTo = innerFrom + inner.length;
  return replaceSelection(view, insert, { anchor: innerFrom, head: innerTo });
};

const commandInsertFootnote = (view) => {
  const docText = view.state.doc.toString();
  const matches = [...docText.matchAll(/\[\^(\d+)\]:/g)];
  const nextNumber = matches.reduce((max, match) => Math.max(max, Number(match[1] || 0)), 0) + 1;
  const ref = `[^${nextNumber}]`;
  const definition = `\n\n[^${nextNumber}]: `;
  const insert = `${ref}${definition}`;
  const range = selectionRangeOf(view);
  return replaceSelection(view, insert, {
    anchor: range.from + insert.length,
    head: range.from + insert.length
  });
};

const commandInsertTable = (view) =>
  replaceSelection(
    view,
    "|  |  |\n| --- | --- |\n|  |  |"
  );

const commandInsertCallout = (view) =>
  replaceSelection(view, "> [!NOTE]\n> ");

const commandInsertDivider = (view) =>
  replaceSelection(view, "\n---\n");

const commandInsertCodeBlock = (view) =>
  insertBlockTemplate(view, {
    prefixLine: "```",
    suffixLine: "```"
  });

const commandInsertMathBlock = (view) =>
  insertBlockTemplate(view, {
    prefixLine: "$$",
    suffixLine: "$$"
  });

const commandInsertDatabase = (view) =>
  replaceSelection(
    view,
    "|  |  |  |  |\n| --- | --- | --- | --- |\n|  |  |  |  |"
  );

const commandInsertImage = async (view) => {
  const handler = contextMenuRuntimeOptions?.requestImageMarkdown;
  if (typeof handler !== "function") {
    return false;
  }
  const markdown = String(await handler() || "").trim();
  if (!markdown) {
    return false;
  }
  return replaceSelection(view, markdown);
};

const writeClipboardText = async (text) => {
  const clipboard = globalThis?.navigator?.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") {
    return false;
  }
  await clipboard.writeText(String(text || ""));
  return true;
};

const readClipboardText = async () => {
  const clipboard = globalThis?.navigator?.clipboard;
  if (!clipboard || typeof clipboard.readText !== "function") {
    return null;
  }
  return clipboard.readText();
};

const commandCopy = async (view) => {
  const range = selectionRangeOf(view);
  if (range.empty) {
    return false;
  }
  const text = view.state.sliceDoc(range.from, range.to);
  await writeClipboardText(text);
  view.focus();
  return true;
};

const commandCut = async (view) => {
  const range = selectionRangeOf(view);
  if (range.empty) {
    return false;
  }
  const text = view.state.sliceDoc(range.from, range.to);
  await writeClipboardText(text);
  view.dispatch({
    changes: {
      from: range.from,
      to: range.to,
      insert: ""
    },
    selection: {
      anchor: range.from,
      head: range.from
    },
    scrollIntoView: true,
    userEvent: "delete.cut"
  });
  view.focus();
  return true;
};

const commandPaste = async (view, { plain = false } = {}) => {
  const raw = await readClipboardText();
  if (raw == null) {
    return false;
  }
  const text = plain ? String(raw).replace(/\r\n/g, "\n") : String(raw);
  return replaceSelection(view, text);
};

const commandSelectAll = (view) => {
  view.dispatch({
    selection: {
      anchor: 0,
      head: view.state.doc.length
    },
    scrollIntoView: true,
    userEvent: "select.all"
  });
  view.focus();
  return true;
};

const commandSelectBlock = (view, menuContext = {}) => {
  const docLength = Number(view?.state?.doc?.length || 0);
  const range = normalizeRange(menuContext?.blockRange, docLength);
  if (range.to <= range.from) {
    return false;
  }
  view.dispatch({
    selection: {
      anchor: range.from,
      head: range.to
    },
    scrollIntoView: true,
    userEvent: "select.block"
  });
  view.focus();
  return true;
};

const executeCommand = async (view, commandId, menuContext = {}) => {
  const normalizedCommandId = String(commandId || "");
  const tableContext = menuContext?.table || null;

  if (tableContext?.blockId && normalizedCommandId.startsWith("table-")) {
    if (tableContext?.editableCell instanceof HTMLElement) {
      try {
        tableContext.editableCell.dispatchEvent(new Event("focusout", { bubbles: true }));
      } catch {
        // ignore
      }
    }
    return persistTableByBlockId(view, tableContext.blockId, (model) =>
      transformTableByCommand(model, normalizedCommandId, tableContext)
    );
  }

  if (tableContext?.editableCell && TABLE_CELL_FORMAT_COMMAND_IDS.has(normalizedCommandId)) {
    return applyTableCellInlineFormat(normalizedCommandId, menuContext);
  }

  try {
    switch (normalizedCommandId) {
      case "add-link":
        return commandInsertWikiLink(view);
      case "add-external-link":
        return commandInsertExternalLink(view);
      case "format-bold":
        return surroundSelection(view, { prefix: "**", suffix: "**" });
      case "format-italic":
        return surroundSelection(view, { prefix: "*", suffix: "*" });
      case "format-strike":
        return surroundSelection(view, { prefix: "~~", suffix: "~~" });
      case "format-highlight":
        return surroundSelection(view, { prefix: "==", suffix: "==" });
      case "format-code":
        return surroundSelection(view, { prefix: "`", suffix: "`" });
      case "format-math":
        return surroundSelection(view, { prefix: "$", suffix: "$" });
      case "format-comment":
        return surroundSelection(view, { prefix: "%%", suffix: "%%" });
      case "format-clear":
        return commandClearFormat(view);
      case "paragraph-bullet":
        return applyParagraphStyle(view, "bullet");
      case "paragraph-ordered":
        return applyParagraphStyle(view, "ordered");
      case "paragraph-task":
        return applyParagraphStyle(view, "task");
      case "paragraph-h1":
        return applyParagraphStyle(view, "h1");
      case "paragraph-h2":
        return applyParagraphStyle(view, "h2");
      case "paragraph-h3":
        return applyParagraphStyle(view, "h3");
      case "paragraph-h4":
        return applyParagraphStyle(view, "h4");
      case "paragraph-h5":
        return applyParagraphStyle(view, "h5");
      case "paragraph-h6":
        return applyParagraphStyle(view, "h6");
      case "paragraph-text":
        return applyParagraphStyle(view, "paragraph");
      case "paragraph-quote":
        return applyParagraphStyle(view, "quote");
      case "insert-footnote":
        return commandInsertFootnote(view);
      case "insert-table":
        return commandInsertTable(view);
      case "insert-callout":
        return commandInsertCallout(view);
      case "insert-divider":
        return commandInsertDivider(view);
      case "insert-image":
        return commandInsertImage(view);
      case "insert-code-block":
        return commandInsertCodeBlock(view);
      case "insert-math-block":
        return commandInsertMathBlock(view);
      case "insert-database":
        return commandInsertDatabase(view);
      case "clipboard-cut":
        return commandCut(view);
      case "clipboard-copy":
        return commandCopy(view);
      case "clipboard-paste":
        return commandPaste(view);
      case "clipboard-paste-plain":
        return commandPaste(view, { plain: true });
      case "select-all":
        return commandSelectAll(view);
      case "select-block":
        return commandSelectBlock(view, menuContext);
      default:
        return false;
    }
  } catch (error) {
    console.error("[yc-editor] context menu command failed:", commandId, error);
    return false;
  }
};

const MENU_DEFINITION = [
  { id: "add-link", icon: "+", label: "新增链接" },
  { id: "add-external-link", icon: "->", label: "新增外部链接" },
  { type: "separator" },
  {
    id: "format",
    icon: "Aa",
    label: "文本格式",
    children: [
      { id: "format-bold", icon: "B", label: "粗体" },
      { id: "format-italic", icon: "I", label: "斜体" },
      { id: "format-strike", icon: "S", label: "删除线" },
      { id: "format-highlight", icon: "H", label: "高亮" },
      { type: "separator" },
      { id: "format-code", icon: "</>", label: "代码" },
      { id: "format-math", icon: "M", label: "数学" },
      { id: "format-comment", icon: "%", label: "注释" },
      { type: "separator" },
      { id: "format-clear", icon: "X", label: "清除格式" }
    ]
  },
  {
    id: "paragraph",
    icon: "P",
    label: "段落设置",
    children: [
      { id: "paragraph-bullet", icon: "*", label: "无序列表" },
      { id: "paragraph-ordered", icon: "1.", label: "有序列表" },
      { id: "paragraph-task", icon: "[]", label: "任务列表" },
      { type: "separator" },
      { id: "paragraph-h1", icon: "H1", label: "标题 1" },
      { id: "paragraph-h2", icon: "H2", label: "标题 2" },
      { id: "paragraph-h3", icon: "H3", label: "标题 3" },
      { id: "paragraph-h4", icon: "H4", label: "标题 4" },
      { id: "paragraph-h5", icon: "H5", label: "标题 5" },
      { id: "paragraph-h6", icon: "H6", label: "标题 6" },
      { id: "paragraph-text", icon: "T", label: "正文" },
      { type: "separator" },
      { id: "paragraph-quote", icon: ">", label: "引用" }
    ]
  },
  {
    id: "insert",
    icon: "+",
    label: "插入",
    children: [
      { id: "insert-footnote", icon: "fn", label: "脚注" },
      { id: "insert-table", icon: "tbl", label: "表格" },
      { id: "insert-callout", icon: "!", label: "标注" },
      { id: "insert-divider", icon: "-", label: "分隔线" },
      { type: "separator" },
      { id: "insert-code-block", icon: "{}", label: "代码块" },
      { id: "insert-math-block", icon: "M", label: "数学块" },
      { id: "insert-database", icon: "db", label: "新建数据库" }
    ]
  },
  { type: "separator" },
  { id: "clipboard-cut", icon: "cut", label: "剪切" },
  { id: "clipboard-copy", icon: "cpy", label: "复制" },
  { id: "clipboard-paste", icon: "pst", label: "粘贴" },
  { id: "clipboard-paste-plain", icon: "T", label: "以纯文本形式粘贴" },
  { type: "separator" },
  { id: "select-block", icon: "[]", label: "选中块" },
  { id: "select-all", icon: "*", label: "全选" }
];

const EDITOR_INSERT_IMAGE_ITEM = Object.freeze({
  id: "insert-image",
  icon: "img",
  label: "图片"
});

const EDITOR_SETTINGS_MENU_ITEM = Object.freeze({
  id: "editor-settings",
  icon: "cfg",
  label: "设置",
  children: [
    { id: "editor-width-narrower", icon: "<-", label: "收窄编辑区" },
    { id: "editor-width-wider", icon: "->", label: "放宽编辑区" },
    { id: "editor-width-reset", icon: "[]", label: "重置编辑区宽度" },
    { type: "separator" },
    { id: "editor-debug-toggle", icon: "dbg", label: "切换调试面板" }
  ]
});

const withEditorMenuExtras = (itemsInput = []) => {
  return (Array.isArray(itemsInput) ? itemsInput : []).map((item) => {
    if (!item || item.type === "separator" || item.id !== "insert" || !Array.isArray(item.children)) {
      return item;
    }
    const separatorIndex = item.children.findIndex((child, index, list) =>
      child?.type === "separator" && list[index + 1]?.id === "insert-code-block"
    );
    const insertChildren = separatorIndex >= 0
      ? [
          ...item.children.slice(0, separatorIndex + 1),
          EDITOR_INSERT_IMAGE_ITEM,
          ...item.children.slice(separatorIndex + 1)
        ]
      : [...item.children, EDITOR_INSERT_IMAGE_ITEM];
    return {
      ...item,
      children: insertChildren
    };
  });
};

const TABLE_ROW_ACTIONS = [
  { id: "table-row-insert-above", icon: "^", label: "在上方新增行" },
  { id: "table-row-insert-below", icon: "v", label: "在下方新增行" },
  { type: "separator" },
  { id: "table-row-move-up", icon: "up", label: "向上移动行" },
  { id: "table-row-move-down", icon: "dn", label: "向下移动行" },
  { type: "separator" },
  { id: "table-row-copy", icon: "cpy", label: "复制行" },
  { id: "table-row-delete", icon: "del", label: "删除行" }
];

const TABLE_COLUMN_ACTIONS = [
  { id: "table-col-insert-left", icon: "<", label: "在左侧新增列" },
  { id: "table-col-insert-right", icon: ">", label: "在右侧新增列" },
  { type: "separator" },
  { id: "table-col-move-left", icon: "<-", label: "向左移动列" },
  { id: "table-col-move-right", icon: "->", label: "向右移动列" },
  { type: "separator" },
  { id: "table-col-align-left", icon: "L", label: "左对齐" },
  { id: "table-col-align-center", icon: "C", label: "居中对齐" },
  { id: "table-col-align-right", icon: "R", label: "右对齐" },
  { type: "separator" },
  { id: "table-col-copy", icon: "cpy", label: "复制列" },
  { id: "table-col-delete", icon: "del", label: "删除列" }
];

const TABLE_SORT_ACTIONS = [
  { id: "table-sort-asc", icon: "A^", label: "按列升序 (A-Z)" },
  { id: "table-sort-desc", icon: "Zv", label: "按列降序 (Z-A)" }
];

const TABLE_MENU_DEFINITION = [
  {
    id: "table-row",
    icon: "row",
    label: "行",
    children: TABLE_ROW_ACTIONS
  },
  {
    id: "table-col",
    icon: "col",
    label: "列",
    children: TABLE_COLUMN_ACTIONS
  },
  { type: "separator" },
  ...TABLE_SORT_ACTIONS
];

const CONTEXT_MENU_ICON_NAME_BY_ID = Object.freeze({
  "add-link": "link",
  "add-external-link": "external-link",
  format: "tool",
  "format-bold": "bold",
  "format-italic": "italic",
  "format-strike": "strikethrough",
  "format-highlight": "highlight",
  "format-code": "code",
  "format-math": "formula",
  "format-comment": "message",
  "format-clear": "eraser",
  paragraph: "menu",
  "paragraph-bullet": "unordered-list",
  "paragraph-ordered": "ordered-list",
  "paragraph-task": "check-square",
  "paragraph-h1": "h1",
  "paragraph-h2": "h2",
  "paragraph-h3": "h3",
  "paragraph-h4": "h4",
  "paragraph-h5": "h5",
  "paragraph-h6": "h6",
  "paragraph-text": "line-height",
  "paragraph-quote": "quote",
  insert: "add",
  "insert-footnote": "file",
  "insert-table": "apps",
  "insert-callout": "notification",
  "insert-divider": "minimize",
  "insert-image": "image",
  "insert-code-block": "code-block",
  "insert-math-block": "formula",
  "insert-database": "storage",
  "editor-settings": "settings",
  "editor-width-narrower": "arrow-left",
  "editor-width-wider": "arrow-right",
  "editor-width-reset": "restore",
  "editor-debug-toggle": "tool",
  "clipboard-cut": "scissor",
  "clipboard-copy": "copy",
  "clipboard-paste": "paste",
  "clipboard-paste-plain": "paste",
  "select-block": "scan",
  "select-all": "select-all",
  "table-row": "list",
  "table-col": "apps",
  "table-row-insert-above": "arrow-up",
  "table-row-insert-below": "arrow-down",
  "table-row-move-up": "arrow-up",
  "table-row-move-down": "arrow-down",
  "table-row-copy": "copy",
  "table-row-delete": "delete",
  "table-col-insert-left": "arrow-left",
  "table-col-insert-right": "arrow-right",
  "table-col-move-left": "arrow-left",
  "table-col-move-right": "arrow-right",
  "table-col-align-left": "align-left",
  "table-col-align-center": "align-center",
  "table-col-align-right": "align-right",
  "table-col-copy": "copy",
  "table-col-delete": "delete",
  "table-sort-asc": "sort-asc",
  "table-sort-desc": "sort-desc"
});

const resolveContextMenuIconName = (itemIdInput) => CONTEXT_MENU_ICON_NAME_BY_ID[String(itemIdInput || "")] || "";

const mountContextMenuAppIcon = (hostInput, iconNameInput, svgClassNameInput, fallbackTextInput = "") => {
  const host = hostInput instanceof HTMLElement ? hostInput : null;
  if (!host) {
    return;
  }
  host.dataset.ycAppIconHost = "true";
  host.setAttribute("aria-hidden", "true");
  host.textContent = "";
  host.classList.remove("is-fallback");
  const iconName = String(iconNameInput || "").trim();
  if (iconName) {
    render(h(AppIcon, {
      name: iconName,
      class: String(svgClassNameInput || "")
    }), host);
    return;
  }
  render(null, host);
  const fallbackText = String(fallbackTextInput || "").trim();
  if (!fallbackText) {
    return;
  }
  host.classList.add("is-fallback");
  host.textContent = fallbackText;
};

const mountContextMenuItemIcon = (host, item) =>
  mountContextMenuAppIcon(host, resolveContextMenuIconName(item?.id), "yc-editor-context-icon-svg", item?.icon);

const mountContextMenuArrowIcon = (host) =>
  mountContextMenuAppIcon(host, "chevron-right", "yc-editor-context-arrow-svg");

const disposeMountedContextMenuIcons = (rootInput) => {
  const root = rootInput instanceof HTMLElement ? rootInput : null;
  if (!root) {
    return;
  }
  Array.from(root.querySelectorAll('[data-yc-app-icon-host="true"]')).forEach((host) => {
    render(null, host);
  });
};

const menuDefinitionForContext = (menuContext = {}) => {
  const tableContext = menuContext?.table || null;
  const rootMenu = withEditorMenuExtras(MENU_DEFINITION);
  if (!tableContext?.blockId) {
    return rootMenu;
  }
  if (tableContext.activeHandleAxis === "row") {
    return TABLE_ROW_ACTIONS;
  }
  if (tableContext.activeHandleAxis === "column") {
    return [...TABLE_COLUMN_ACTIONS, { type: "separator" }, ...TABLE_SORT_ACTIONS];
  }
  return [...TABLE_MENU_DEFINITION, { type: "separator" }, ...rootMenu];
};

const withDisabledState = (items, view, menuContext = {}) => {
  const selection = selectionRangeOf(view);
  const canReadClipboard = Boolean(globalThis?.navigator?.clipboard?.readText);
  const canWriteClipboard = Boolean(globalThis?.navigator?.clipboard?.writeText);
  const hasBlockRange = Number.isFinite(menuContext?.blockRange?.from) && Number.isFinite(menuContext?.blockRange?.to)
    && Number(menuContext.blockRange.to) > Number(menuContext.blockRange.from);
  const canInsertImage = typeof contextMenuRuntimeOptions?.requestImageMarkdown === "function";
  const canOpenEditorSettings = typeof contextMenuRuntimeOptions?.onEditorSettingCommand === "function";
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item?.type === "separator") {
      return item;
    }
    const id = String(item?.id || "");
    let disabled = false;
    if (id === "clipboard-cut" || id === "clipboard-copy") {
      disabled = selection.empty || !canWriteClipboard;
    } else if (id === "clipboard-paste" || id === "clipboard-paste-plain") {
      disabled = !canReadClipboard;
    } else if (id === "select-block") {
      disabled = !hasBlockRange;
    } else if (id === "insert-image") {
      disabled = !canInsertImage;
    } else if (
      id === "editor-settings"
      || id === "editor-width-narrower"
      || id === "editor-width-wider"
      || id === "editor-width-reset"
      || id === "editor-debug-toggle"
    ) {
      disabled = !canOpenEditorSettings;
    }
    return {
      ...item,
      disabled,
      children: item?.children ? withDisabledState(item.children, view, menuContext) : undefined
    };
  });
};

const shouldKeepSelectionOnContextMenu = (view, pos) => {
  const selection = selectionRangeOf(view);
  if (selection.empty) {
    return false;
  }
  return pos >= selection.from && pos <= selection.to;
};

class EditorContextMenuController {
  constructor(view) {
    this.view = view;
    this.rootMenuEl = null;
    this.subMenuEl = null;
    this.activeSubmenuItemEl = null;
    this.menuContext = null;
    this.submenuOpenTimer = null;
    this.submenuCloseTimer = null;
    this.pointerInRootMenu = false;
    this.pointerInSubmenu = false;
    this.rootActiveIndex = -1;
    this.submenuActiveIndex = -1;

    this.onOutsideMouseDown = this.onOutsideMouseDown.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);
    this.onDocumentKeyDown = this.onDocumentKeyDown.bind(this);
  }

  update(update) {
    if (update.docChanged && this.rootMenuEl) {
      this.closeMenu();
    }
  }

  destroy() {
    this.closeMenu();
  }

  isDarkMode() {
    return Boolean(this.view.dom.closest('.yc-editor-shell')?.closest('#app')?.dataset?.themeMode === "dark");
  }

  getMenuButtons(menuEl) {
    if (!(menuEl instanceof HTMLElement)) {
      return [];
    }
    return Array.from(menuEl.querySelectorAll(".yc-editor-context-item"))
      .filter((button) => button instanceof HTMLButtonElement && !button.disabled);
  }

  getMenuActiveIndex(menuEl) {
    if (menuEl === this.subMenuEl) {
      return this.submenuActiveIndex;
    }
    if (menuEl === this.rootMenuEl) {
      return this.rootActiveIndex;
    }
    return -1;
  }

  setMenuActiveIndex(menuEl, indexInput = -1) {
    if (!(menuEl instanceof HTMLElement)) {
      return false;
    }
    const buttons = this.getMenuButtons(menuEl);
    if (!buttons.length) {
      if (menuEl === this.subMenuEl) {
        this.submenuActiveIndex = -1;
      } else if (menuEl === this.rootMenuEl) {
        this.rootActiveIndex = -1;
      }
      return false;
    }
    const length = buttons.length;
    const rawIndex = Number(indexInput);
    const nextIndex = Number.isFinite(rawIndex)
      ? ((Math.round(rawIndex) % length) + length) % length
      : 0;
    if (menuEl === this.subMenuEl) {
      this.submenuActiveIndex = nextIndex;
    } else if (menuEl === this.rootMenuEl) {
      this.rootActiveIndex = nextIndex;
    }
    this.syncMenuActiveState(menuEl);
    return true;
  }

  syncMenuActiveState(menuEl) {
    if (!(menuEl instanceof HTMLElement)) {
      return;
    }
    const buttons = this.getMenuButtons(menuEl);
    const activeIndex = this.getMenuActiveIndex(menuEl);
    buttons.forEach((button, index) => {
      button.classList.toggle("is-active", index === activeIndex);
    });
    if (activeIndex >= 0 && activeIndex < buttons.length) {
      const activeButton = buttons[activeIndex];
      if (typeof activeButton.scrollIntoView === "function") {
        activeButton.scrollIntoView({
          block: "nearest"
        });
      }
    }
  }

  focusMenuItem(menuEl, indexInput = 0) {
    return this.setMenuActiveIndex(menuEl, indexInput);
  }

  focusFirstMenuItem(menuEl) {
    return this.focusMenuItem(menuEl, 0);
  }

  focusLastMenuItem(menuEl) {
    const buttons = this.getMenuButtons(menuEl);
    return buttons.length ? this.focusMenuItem(menuEl, buttons.length - 1) : false;
  }

  moveMenuFocus(menuEl, delta) {
    const buttons = this.getMenuButtons(menuEl);
    if (!buttons.length) {
      return false;
    }
    const activeIndex = this.getMenuActiveIndex(menuEl);
    const startIndex = activeIndex >= 0 ? activeIndex : (delta < 0 ? 0 : -1);
    return this.focusMenuItem(menuEl, startIndex + delta);
  }

  getFocusedMenuItem(menuEl) {
    const buttons = this.getMenuButtons(menuEl);
    if (!buttons.length) {
      return null;
    }
    let activeIndex = this.getMenuActiveIndex(menuEl);
    if (activeIndex < 0 || activeIndex >= buttons.length) {
      activeIndex = 0;
      this.setMenuActiveIndex(menuEl, activeIndex);
    }
    return buttons[activeIndex] || null;
  }

  getActiveMenuElement() {
    return this.subMenuEl || this.rootMenuEl;
  }

  handleContextMenu(event) {
    if (!(event instanceof MouseEvent)) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();

    const target = event.target instanceof Element ? event.target : null;
    const pos = this.view.posAtCoords({
      x: safeNumber(event.clientX, 0),
      y: safeNumber(event.clientY, 0)
    });
    const safePos = Number.isFinite(pos) ? pos : this.view.state.selection.main.head;
    let blockRange = resolveBlockRangeAtPos(this.view, safePos);
    const tableContext = resolveTableContextFromTarget(target);
    if (tableContext?.blockId) {
      const tableRange = resolveTableRangeByBlockId(this.view, tableContext.blockId);
      if (tableRange) {
        blockRange = tableRange;
      }
    }
    this.menuContext = {
      blockRange,
      ...(tableContext ? { table: tableContext } : {})
    };

    if (!tableContext) {
      if (Number.isFinite(pos) && !shouldKeepSelectionOnContextMenu(this.view, pos)) {
        this.view.dispatch({
          selection: {
            anchor: pos,
            head: pos
          },
          scrollIntoView: true
        });
      }
    }

    this.openMenu(event.clientX, event.clientY, this.menuContext);
    return true;
  }

  openMenu(clientX, clientY, menuContext = {}) {
    this.closeMenu();
    this.pointerInRootMenu = false;
    this.pointerInSubmenu = false;
    this.menuContext = menuContext && typeof menuContext === "object" ? menuContext : {};
    const items = withDisabledState(menuDefinitionForContext(this.menuContext), this.view, this.menuContext);
    this.rootMenuEl = this.buildMenuElement(items, false);
    if (!this.rootMenuEl) {
      return;
    }
    document.body.appendChild(this.rootMenuEl);
    this.positionMenuElement(this.rootMenuEl, safeNumber(clientX, 0), safeNumber(clientY, 0));
    this.focusFirstMenuItem(this.rootMenuEl);
    this.bindGlobalCloseEvents();
  }

  closeMenu() {
    this.clearSubmenuTimers();
    if (this.subMenuEl) {
      disposeMountedContextMenuIcons(this.subMenuEl);
      this.subMenuEl.remove();
      this.subMenuEl = null;
    }
    if (this.rootMenuEl) {
      disposeMountedContextMenuIcons(this.rootMenuEl);
      this.rootMenuEl.remove();
      this.rootMenuEl = null;
    }
    this.activeSubmenuItemEl = null;
    this.menuContext = null;
    this.pointerInRootMenu = false;
    this.pointerInSubmenu = false;
    this.rootActiveIndex = -1;
    this.submenuActiveIndex = -1;
    this.unbindGlobalCloseEvents();
  }

  bindGlobalCloseEvents() {
    document.addEventListener("mousedown", this.onOutsideMouseDown, true);
    window.addEventListener("keydown", this.onDocumentKeyDown, true);
    window.addEventListener("resize", this.onWindowResize, true);
    window.addEventListener("blur", this.onWindowBlur, true);
  }

  unbindGlobalCloseEvents() {
    document.removeEventListener("mousedown", this.onOutsideMouseDown, true);
    window.removeEventListener("keydown", this.onDocumentKeyDown, true);
    window.removeEventListener("resize", this.onWindowResize, true);
    window.removeEventListener("blur", this.onWindowBlur, true);
  }

  onOutsideMouseDown(event) {
    const target = event?.target;
    if (!(target instanceof Node)) {
      this.closeMenu();
      return;
    }
    if (this.rootMenuEl?.contains(target) || this.subMenuEl?.contains(target)) {
      return;
    }
    this.closeMenu();
  }

  onWindowResize() {
    this.closeMenu();
  }

  onWindowBlur() {
    this.closeMenu();
  }

  onDocumentKeyDown(event) {
    if (!this.rootMenuEl) {
      return;
    }

    const activeMenu = this.getActiveMenuElement();
    if (!activeMenu) {
      return;
    }

    if (event?.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      if (activeMenu === this.rootMenuEl && this.subMenuEl) {
        this.closeSubMenu();
      }
      this.moveMenuFocus(activeMenu, 1);
      return;
    }

    if (event?.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (activeMenu === this.rootMenuEl && this.subMenuEl) {
        this.closeSubMenu();
      }
      this.moveMenuFocus(activeMenu, -1);
      return;
    }

    if (event?.key === "Home") {
      event.preventDefault();
      event.stopPropagation();
      if (activeMenu === this.rootMenuEl && this.subMenuEl) {
        this.closeSubMenu();
      }
      this.focusFirstMenuItem(activeMenu);
      return;
    }

    if (event?.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      if (activeMenu === this.rootMenuEl && this.subMenuEl) {
        this.closeSubMenu();
      }
      this.focusLastMenuItem(activeMenu);
      return;
    }

    if (event?.key === "ArrowRight") {
      const focusedItem = this.getFocusedMenuItem(activeMenu);
      const item = focusedItem?._ycMenuItem;
      if (item?.children?.length && focusedItem instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        this.openSubmenuForItem(item, focusedItem);
        this.focusFirstMenuItem(this.subMenuEl);
      }
      return;
    }

    if (event?.key === "ArrowLeft") {
      if (activeMenu === this.subMenuEl && this.activeSubmenuItemEl instanceof HTMLButtonElement) {
        event.preventDefault();
        event.stopPropagation();
        const parentItem = this.activeSubmenuItemEl;
        const parentIndex = this.getMenuButtons(this.rootMenuEl).findIndex((button) => button === parentItem);
        this.closeSubMenu();
        this.focusMenuItem(this.rootMenuEl, parentIndex);
      }
      return;
    }

    if (event?.key === "Enter" || event?.key === " ") {
      const focusedItem = this.getFocusedMenuItem(activeMenu);
      if (!focusedItem) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const item = focusedItem._ycMenuItem;
      if (item?.children?.length && focusedItem instanceof HTMLElement) {
        this.openSubmenuForItem(item, focusedItem);
        this.focusFirstMenuItem(this.subMenuEl);
        return;
      }
      focusedItem.click();
      return;
    }

    if (event?.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (activeMenu === this.subMenuEl && this.activeSubmenuItemEl instanceof HTMLButtonElement) {
        const parentItem = this.activeSubmenuItemEl;
        const parentIndex = this.getMenuButtons(this.rootMenuEl).findIndex((button) => button === parentItem);
        this.closeSubMenu();
        this.focusMenuItem(this.rootMenuEl, parentIndex);
        return;
      }
      this.closeMenu();
      this.view.focus();
    }
  }

  clearSubmenuOpenTimer() {
    if (!this.submenuOpenTimer) {
      return;
    }
    window.clearTimeout(this.submenuOpenTimer);
    this.submenuOpenTimer = null;
  }

  clearSubmenuCloseTimer() {
    if (!this.submenuCloseTimer) {
      return;
    }
    window.clearTimeout(this.submenuCloseTimer);
    this.submenuCloseTimer = null;
  }

  clearSubmenuTimers() {
    this.clearSubmenuOpenTimer();
    this.clearSubmenuCloseTimer();
  }

  scheduleOpenSubmenu(item, itemEl) {
    if (!item?.children?.length || !(itemEl instanceof HTMLElement)) {
      return;
    }
    this.clearSubmenuCloseTimer();
    if (this.activeSubmenuItemEl === itemEl && this.subMenuEl) {
      return;
    }
    this.clearSubmenuOpenTimer();
    this.submenuOpenTimer = window.setTimeout(() => {
      this.submenuOpenTimer = null;
      this.openSubmenuForItem(item, itemEl);
    }, SUBMENU_OPEN_DELAY_MS);
  }

  scheduleCloseSubmenu() {
    if (!this.subMenuEl && !this.activeSubmenuItemEl && !this.submenuOpenTimer) {
      return;
    }
    this.clearSubmenuOpenTimer();
    this.clearSubmenuCloseTimer();
    this.submenuCloseTimer = window.setTimeout(() => {
      this.submenuCloseTimer = null;
      if (this.pointerInRootMenu || this.pointerInSubmenu) {
        return;
      }
      this.closeSubMenu();
    }, SUBMENU_CLOSE_DELAY_MS);
  }

  closeSubMenu() {
    this.clearSubmenuTimers();
    if (this.subMenuEl) {
      disposeMountedContextMenuIcons(this.subMenuEl);
      this.subMenuEl.remove();
      this.subMenuEl = null;
    }
    if (this.activeSubmenuItemEl) {
      this.activeSubmenuItemEl.classList.remove("is-open");
      this.activeSubmenuItemEl = null;
    }
    this.pointerInSubmenu = false;
    this.submenuActiveIndex = -1;
  }

  async runItemCommand(item) {
    if (!item || item.disabled || !item.id) {
      return;
    }
    const done = await executeCommand(this.view, item.id, this.menuContext || {});
    if (done !== false) {
      this.closeMenu();
    }
  }

  openSubmenuForItem(item, itemEl) {
    if (!item?.children?.length || !(itemEl instanceof HTMLElement) || !this.rootMenuEl) {
      return;
    }
    this.clearSubmenuOpenTimer();
    this.clearSubmenuCloseTimer();

    if (this.activeSubmenuItemEl === itemEl && this.subMenuEl) {
      return;
    }

    this.closeSubMenu();
    const submenuItems = withDisabledState(item.children, this.view, this.menuContext);
    const submenuEl = this.buildMenuElement(submenuItems, true);
    if (!submenuEl) {
      return;
    }
    document.body.appendChild(submenuEl);
    this.subMenuEl = submenuEl;
    this.activeSubmenuItemEl = itemEl;
    itemEl.classList.add("is-open");
    const rootIndex = this.getMenuButtons(this.rootMenuEl).findIndex((button) => button === itemEl);
    this.focusMenuItem(this.rootMenuEl, rootIndex);
    this.focusFirstMenuItem(this.subMenuEl);

    const itemRect = itemEl.getBoundingClientRect();
    const menuRect = submenuEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = itemRect.right + SUBMENU_GAP;
    if (left + menuRect.width > viewportWidth - MENU_GAP) {
      left = itemRect.left - menuRect.width - SUBMENU_GAP;
    }
    left = Math.max(MENU_GAP, Math.min(left, viewportWidth - menuRect.width - MENU_GAP));

    let top = itemRect.top;
    if (top + menuRect.height > viewportHeight - MENU_GAP) {
      top = viewportHeight - menuRect.height - MENU_GAP;
    }
    top = Math.max(MENU_GAP, top);

    submenuEl.style.left = `${Math.round(left)}px`;
    submenuEl.style.top = `${Math.round(top)}px`;
  }

  buildMenuElement(items, isSubmenu = false) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      return null;
    }

    const menu = document.createElement("div");
    menu.className = `yc-editor-context-menu${isSubmenu ? " yc-editor-context-submenu" : ""}`;
    menu.setAttribute("role", "menu");
    menu.tabIndex = -1;
    if (this.isDarkMode()) {
      menu.classList.add("is-dark");
    }
    menu.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    menu.addEventListener("mouseenter", () => {
      if (isSubmenu) {
        this.pointerInSubmenu = true;
      } else {
        this.pointerInRootMenu = true;
      }
      this.clearSubmenuCloseTimer();
    });
    menu.addEventListener("mouseleave", (event) => {
      const related = event?.relatedTarget;
      if (isSubmenu) {
        this.pointerInSubmenu = false;
        if (related instanceof Node && this.rootMenuEl?.contains(related)) {
          return;
        }
      } else {
        this.pointerInRootMenu = false;
        if (related instanceof Node && this.subMenuEl?.contains(related)) {
          return;
        }
      }
      this.scheduleCloseSubmenu();
    });

    for (const item of list) {
      if (item?.type === "separator") {
        const separator = document.createElement("div");
        separator.className = "yc-editor-context-separator";
        menu.appendChild(separator);
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "yc-editor-context-item";
      button.setAttribute("role", "menuitem");
      button._ycMenuItem = item;
      if (item?.disabled) {
        button.classList.add("is-disabled");
        button.disabled = true;
      }
      if (Array.isArray(item?.children) && item.children.length) {
        button.classList.add("has-submenu");
      }

      const icon = document.createElement("span");
      icon.className = "yc-editor-context-icon";
      mountContextMenuItemIcon(icon, item);

      const label = document.createElement("span");
      label.className = "yc-editor-context-label";
      label.textContent = String(item?.label || "");

      button.appendChild(icon);
      button.appendChild(label);

      if (Array.isArray(item?.children) && item.children.length) {
        const arrow = document.createElement("span");
        arrow.className = "yc-editor-context-arrow";
        mountContextMenuArrowIcon(arrow);
        button.appendChild(arrow);

        button.addEventListener("mouseenter", () => {
          const index = this.getMenuButtons(menu).findIndex((entry) => entry === button);
          this.focusMenuItem(menu, index);
          this.scheduleOpenSubmenu(item, button);
        });
        button.addEventListener("mouseleave", (event) => {
          const related = event?.relatedTarget;
          if (related instanceof Node && this.subMenuEl?.contains(related)) {
            return;
          }
          this.scheduleCloseSubmenu();
        });
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.openSubmenuForItem(item, button);
        });
      } else {
        button.addEventListener("mouseenter", () => {
          const index = this.getMenuButtons(menu).findIndex((entry) => entry === button);
          this.focusMenuItem(menu, index);
          this.scheduleCloseSubmenu();
        });
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await this.runItemCommand(item);
        });
      }

      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });

      menu.appendChild(button);
    }

    return menu;
  }

  positionMenuElement(menu, clientX, clientY) {
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = safeNumber(clientX, 0);
    let top = safeNumber(clientY, 0);

    if (left + rect.width > viewportWidth - MENU_GAP) {
      left = viewportWidth - rect.width - MENU_GAP;
    }
    if (top + rect.height > viewportHeight - MENU_GAP) {
      top = viewportHeight - rect.height - MENU_GAP;
    }

    left = Math.max(MENU_GAP, left);
    top = Math.max(MENU_GAP, top);

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }
}

const editorContextMenuPlugin = ViewPlugin.fromClass(EditorContextMenuController, {
  eventHandlers: {
    contextmenu(event) {
      return this.handleContextMenu(event);
    }
  }
});

export const contextMenuExtensions = [editorContextMenuPlugin];

