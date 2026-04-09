import { h, render } from "vue";
import { EditorView, ViewPlugin } from "@codemirror/view";
import AppIcon from "../../components/AppIcon.vue";
import { parseMarkdownToPreviewDocument } from "../parser/parse-preview-document.js";
import { resolvePreviewBlockRangeAtPos, resolvePreviewBlockRangeById } from "../runtime/preview-document.js";
import { parseMarkdownTableModel, serializeMarkdownTableModel } from "../runtime/table-model.js";
import { resolveInlineFormattingPlaceholder } from "../utils/inline-formatting.js";

const MENU_GAP = 8;
const SUBMENU_GAP = 2;
const SUBMENU_OPEN_DELAY_MS = 140;
const SUBMENU_CLOSE_DELAY_MS = 640;
const DEFAULT_LINK_URL = "https://";
const DEFAULT_EXTERNAL_LINK_LABEL = "链接显示名";
const DEFAULT_EXTERNAL_LINK_TITLE = "链接标题";
let contextMenuRuntimeOptions = {};
let contextMenuLocaleText = (zh, en) => zh; // 默认返回中文

export const setContextMenuLocaleText = (fn) => {
  if (typeof fn === "function") {
    contextMenuLocaleText = fn;
  }
};

export const setContextMenuRuntimeOptions = (nextOptions = {}) => {
  contextMenuRuntimeOptions = nextOptions && typeof nextOptions === "object"
    ? nextOptions
    : {};
};

const i18n = (zhText, enText) => contextMenuLocaleText(zhText, enText);

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

const previewDocumentOfView = (view) => {
  const doc = view?.state?.doc;
  if (!doc) {
    return null;
  }
  try {
    return parseMarkdownToPreviewDocument(doc.toString());
  } catch {
    return null;
  }
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

  const previewDocument = previewDocumentOfView(view);
  const range = resolvePreviewBlockRangeAtPos(previewDocument, pos, fallbackRange);
  return normalizeRange(range || fallbackRange, docLength);
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

const resolveTableRangeByBlockId = (view, blockIdInput) => {
  const doc = view?.state?.doc;
  if (!doc) {
    return null;
  }

  const docLength = Number(doc.length || 0);
  const previewDocument = previewDocumentOfView(view);
  const range = resolvePreviewBlockRangeById(previewDocument, blockIdInput, "table");
  if (!range) {
    return null;
  }
  return normalizeRange(range, docLength);
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

const normalizeTableCellClipboardText = (textInput) =>
  String(textInput ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\r?\n/g, " ");

const resolveTableCellEditingRange = (
  editableCell,
  {
    selectAllIfMissing = false,
    collapseToEndIfMissing = false
  } = {}
) => {
  const cell = editableCell instanceof HTMLElement ? editableCell : null;
  if (!cell || typeof window === "undefined" || typeof window.getSelection !== "function") {
    return null;
  }
  const directRange = selectionRangeInsideElement(cell);
  if (directRange) {
    return directRange;
  }
  const selection = window.getSelection();
  if (!selection) {
    return null;
  }
  const text = String(cell.textContent || "");
  if (!text && !collapseToEndIfMissing) {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(cell);
  if (!selectAllIfMissing || !text) {
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
};

const finalizeTableCellDomChange = (editableCell) => {
  if (!(editableCell instanceof HTMLElement)) {
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

const tableCellSelectionText = (editableCell) => {
  const range = ensureTableCellSelectionRange(editableCell);
  if (!range) {
    return "";
  }
  return normalizeTableCellClipboardText(range.toString());
};

const replaceTableCellSelectionWithText = (
  editableCell,
  textInput,
  {
    collapseToEndIfMissing = false,
    selectionStart = null,
    selectionEnd = null
  } = {}
) => {
  const cell = editableCell instanceof HTMLElement ? editableCell : null;
  if (!cell) {
    return false;
  }
  const range = resolveTableCellEditingRange(cell, { collapseToEndIfMissing });
  if (!range) {
    return false;
  }
  const text = normalizeTableCellClipboardText(textInput);
  const textNode = document.createTextNode(text);
  range.deleteContents();
  range.insertNode(textNode);

  const selection = window.getSelection();
  if (selection) {
    const nextRange = document.createRange();
    const hasExplicitSelection = Number.isFinite(selectionStart) && Number.isFinite(selectionEnd);
    if (hasExplicitSelection) {
      const from = Math.max(0, Math.min(text.length, Number(selectionStart)));
      const to = Math.max(from, Math.min(text.length, Number(selectionEnd)));
      nextRange.setStart(textNode, from);
      nextRange.setEnd(textNode, to);
    } else {
      nextRange.setStart(textNode, text.length);
      nextRange.collapse(true);
    }
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }
  return finalizeTableCellDomChange(cell);
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

const composeExternalLinkMarkdown = (labelInput, urlInput, titleInput = "") => {
  const label = String(labelInput || "");
  const url = String(urlInput || "").trim() || DEFAULT_LINK_URL;
  const title = String(titleInput || "").trim();
  const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
  return `[${label}](${url}${titlePart})`;
};

const buildExternalLinkTemplate = (selectedTextInput = "") => {
  const selectedText = String(selectedTextInput || "").trim();
  const looksLikeUrl = /^https?:\/\//i.test(selectedText);
  const label = looksLikeUrl
    ? DEFAULT_EXTERNAL_LINK_LABEL
    : selectedText || DEFAULT_EXTERNAL_LINK_LABEL;
  const url = looksLikeUrl ? selectedText : DEFAULT_LINK_URL;
  const title = DEFAULT_EXTERNAL_LINK_TITLE;
  const markdown = composeExternalLinkMarkdown(label, url, title);
  const labelStart = 1;
  const urlStart = markdown.indexOf(url);
  return selectedText && !looksLikeUrl
    ? {
        markdown,
        selectionStart: urlStart,
        selectionEnd: urlStart + url.length
      }
    : {
        markdown,
        selectionStart: labelStart,
        selectionEnd: labelStart + label.length
      };
};

const insertTableCellExternalLink = (editableCell, selectedTextInput = "") => {
  const { markdown, selectionStart, selectionEnd } = buildExternalLinkTemplate(selectedTextInput);
  return replaceTableCellSelectionWithText(editableCell, markdown, {
    collapseToEndIfMissing: true,
    selectionStart,
    selectionEnd
  });
};

const applyTableCellInlineFormat = (commandIdInput, menuContext = {}) => {
  const commandId = String(commandIdInput || "");
  const editableCell = menuContext?.table?.editableCell;
  if (!(editableCell instanceof HTMLElement)) {
    return false;
  }

  const finalize = (handled) => {
    return handled ? finalizeTableCellDomChange(editableCell) : false;
  };

  const selectedText = tableCellSelectionText(editableCell);

  if (commandId === "format-bold") {
    return finalize(surroundTableCellSelectionWithText(editableCell, "**", "**"));
  }
  if (commandId === "format-italic") {
    return finalize(surroundTableCellSelectionWithText(editableCell, "*", "*"));
  }
  if (commandId === "format-strike") {
    return finalize(surroundTableCellSelectionWithText(editableCell, "~~", "~~"));
  }
  if (commandId === "format-highlight") {
    return finalize(surroundTableCellSelectionWithText(editableCell, "==", "=="));
  }
  if (commandId === "format-code") {
    return finalize(surroundTableCellSelectionWithText(editableCell, "`", "`"));
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
    return insertTableCellExternalLink(editableCell, selectedText);
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
  return window.prompt(i18n("请输入链接地址", "Enter link URL"), defaultValue);
};

const promptLinkTitle = (defaultValue = "") => {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    return defaultValue;
  }
  return window.prompt(i18n("请输入链接title（可选）", "Enter link title (optional)"), defaultValue);
};

const buildExternalLinkMarkdown = (labelInput, urlInput, titleInput = "") => {
  const label = String(labelInput || "");
  const url = String(urlInput || "").trim() || DEFAULT_LINK_URL;
  const title = String(titleInput || "").trim();
  const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
  return `[${label}](${url}${titlePart})`;
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
  const { markdown, selectionStart, selectionEnd } = buildExternalLinkTemplate(selectedText);
  return replaceSelection(view, markdown, {
    anchor: range.from + selectionStart,
    head: range.from + selectionEnd
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

const commandTableCellCopy = async (menuContext = {}) => {
  const editableCell = menuContext?.table?.editableCell;
  if (!(editableCell instanceof HTMLElement)) {
    return false;
  }
  const text = tableCellSelectionText(editableCell);
  if (!text) {
    return false;
  }
  await writeClipboardText(text);
  editableCell.focus();
  return true;
};

const commandTableCellCut = async (menuContext = {}) => {
  const editableCell = menuContext?.table?.editableCell;
  if (!(editableCell instanceof HTMLElement)) {
    return false;
  }
  const text = tableCellSelectionText(editableCell);
  if (!text) {
    return false;
  }
  await writeClipboardText(text);
  return replaceTableCellSelectionWithText(editableCell, "");
};

const commandTableCellPaste = async (menuContext = {}, { plain = false } = {}) => {
  const editableCell = menuContext?.table?.editableCell;
  if (!(editableCell instanceof HTMLElement)) {
    return false;
  }
  const raw = await readClipboardText();
  if (raw == null) {
    return false;
  }
  const text = plain ? String(raw).replace(/\r\n/g, "\n") : String(raw);
  return replaceTableCellSelectionWithText(editableCell, text, {
    collapseToEndIfMissing: true
  });
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

  if (tableContext?.editableCell) {
    if (normalizedCommandId === "clipboard-cut") {
      return commandTableCellCut(menuContext);
    }
    if (normalizedCommandId === "clipboard-copy") {
      return commandTableCellCopy(menuContext);
    }
    if (normalizedCommandId === "clipboard-paste") {
      return commandTableCellPaste(menuContext);
    }
    if (normalizedCommandId === "clipboard-paste-plain") {
      return commandTableCellPaste(menuContext, { plain: true });
    }
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

const buildMenuDefinition = () => [
  { id: "add-link", icon: "+", label: i18n("新增链接", "Add Wiki Link") },
  { id: "add-external-link", icon: "->", label: i18n("新增外部链接", "Add External Link") },
  { type: "separator" },
  {
    id: "format",
    icon: "Aa",
    label: i18n("文本格式", "Text Format"),
    children: [
      { id: "format-bold", icon: "B", label: i18n("粗体", "Bold") },
      { id: "format-italic", icon: "I", label: i18n("斜体", "Italic") },
      { id: "format-strike", icon: "S", label: i18n("删除线", "Strikethrough") },
      { id: "format-highlight", icon: "H", label: i18n("高亮", "Highlight") },
      { type: "separator" },
      { id: "format-code", icon: "</>", label: i18n("代码", "Code") },
      { id: "format-math", icon: "M", label: i18n("数学", "Math") },
      { id: "format-comment", icon: "%", label: i18n("注释", "Comment") },
      { type: "separator" },
      { id: "format-clear", icon: "X", label: i18n("清除格式", "Clear Format") }
    ]
  },
  {
    id: "paragraph",
    icon: "P",
    label: i18n("段落设置", "Paragraph"),
    children: [
      { id: "paragraph-bullet", icon: "*", label: i18n("无序列表", "Bullet List") },
      { id: "paragraph-ordered", icon: "1.", label: i18n("有序列表", "Ordered List") },
      { id: "paragraph-task", icon: "[]", label: i18n("任务列表", "Task List") },
      { type: "separator" },
      { id: "paragraph-h1", icon: "H1", label: i18n("标题 1", "Heading 1") },
      { id: "paragraph-h2", icon: "H2", label: i18n("标题 2", "Heading 2") },
      { id: "paragraph-h3", icon: "H3", label: i18n("标题 3", "Heading 3") },
      { id: "paragraph-h4", icon: "H4", label: i18n("标题 4", "Heading 4") },
      { id: "paragraph-h5", icon: "H5", label: i18n("标题 5", "Heading 5") },
      { id: "paragraph-h6", icon: "H6", label: i18n("标题 6", "Heading 6") },
      { id: "paragraph-text", icon: "T", label: i18n("正文", "Paragraph") },
      { type: "separator" },
      { id: "paragraph-quote", icon: ">", label: i18n("引用", "Quote") }
    ]
  },
  {
    id: "insert",
    icon: "+",
    label: i18n("插入", "Insert"),
    children: [
      { id: "insert-footnote", icon: "fn", label: i18n("脚注", "Footnote") },
      { id: "insert-table", icon: "tbl", label: i18n("表格", "Table") },
      { id: "insert-callout", icon: "!", label: i18n("标注", "Callout") },
      { id: "insert-divider", icon: "-", label: i18n("分隔线", "Divider") },
      { type: "separator" },
      { id: "insert-code-block", icon: "{}", label: i18n("代码块", "Code Block") },
      { id: "insert-math-block", icon: "M", label: i18n("数学块", "Math Block") }
    ]
  },
  { type: "separator" },
  { id: "clipboard-cut", icon: "cut", label: i18n("剪切", "Cut") },
  { id: "clipboard-copy", icon: "cpy", label: i18n("复制", "Copy") },
  { id: "clipboard-paste", icon: "pst", label: i18n("粘贴", "Paste") },
  { id: "clipboard-paste-plain", icon: "T", label: i18n("以纯文本形式粘贴", "Paste as Plain Text") },
  { type: "separator" },
  { id: "select-block", icon: "[]", label: i18n("选中块", "Select Block") },
  { id: "select-all", icon: "*", label: i18n("全选", "Select All") }
];

const buildEditorInsertImageItem = () => ({
  id: "insert-image",
  icon: "img",
  label: i18n("图片", "Image")
});

const withEditorMenuExtras = (itemsInput = []) => {
  const insertImageItem = buildEditorInsertImageItem();
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
          insertImageItem,
          ...item.children.slice(separatorIndex + 1)
        ]
      : [...item.children, insertImageItem];
    return {
      ...item,
      children: insertChildren
    };
  });
};

const buildTableRowActions = () => [
  { id: "table-row-insert-above", icon: "^", label: i18n("在上方新增行", "Insert Row Above") },
  { id: "table-row-insert-below", icon: "v", label: i18n("在下方新增行", "Insert Row Below") },
  { type: "separator" },
  { id: "table-row-move-up", icon: "up", label: i18n("向上移动行", "Move Row Up") },
  { id: "table-row-move-down", icon: "dn", label: i18n("向下移动行", "Move Row Down") },
  { type: "separator" },
  { id: "table-row-copy", icon: "cpy", label: i18n("复制行", "Copy Row") },
  { id: "table-row-delete", icon: "del", label: i18n("删除行", "Delete Row") }
];

const buildTableColumnActions = () => [
  { id: "table-col-insert-left", icon: "<", label: i18n("在左侧新增列", "Insert Column Left") },
  { id: "table-col-insert-right", icon: ">", label: i18n("在右侧新增列", "Insert Column Right") },
  { type: "separator" },
  { id: "table-col-move-left", icon: "<-", label: i18n("向左移动列", "Move Column Left") },
  { id: "table-col-move-right", icon: "->", label: i18n("向右移动列", "Move Column Right") },
  { type: "separator" },
  { id: "table-col-align-left", icon: "L", label: i18n("左对齐", "Align Left") },
  { id: "table-col-align-center", icon: "C", label: i18n("居中对齐", "Align Center") },
  { id: "table-col-align-right", icon: "R", label: i18n("右对齐", "Align Right") },
  { type: "separator" },
  { id: "table-col-copy", icon: "cpy", label: i18n("复制列", "Copy Column") },
  { id: "table-col-delete", icon: "del", label: i18n("删除列", "Delete Column") }
];

const buildTableSortActions = () => [
  { id: "table-sort-asc", icon: "A^", label: i18n("按列升序 (A-Z)", "Sort Ascending (A-Z)") },
  { id: "table-sort-desc", icon: "Zv", label: i18n("按列降序 (Z-A)", "Sort Descending (Z-A)") }
];

const buildTableMenuDefinition = () => [
  {
    id: "table-row",
    icon: "row",
    label: i18n("行", "Row"),
    children: buildTableRowActions()
  },
  {
    id: "table-col",
    icon: "col",
    label: i18n("列", "Column"),
    children: buildTableColumnActions()
  },
  { type: "separator" },
  ...buildTableSortActions()
];

const CONTEXT_MENU_ICON_NAME_BY_ID = Object.freeze({
  "add-link": "link",
  "add-external-link": "external-link",
  format: "format-brush",
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
  "paragraph-quote": "quote",
  insert: "add",
  "insert-footnote": "footnote-mark",
  "insert-table": "apps",
  "insert-callout": "notification",
  "insert-divider": "minimize",
  "insert-image": "image",
  "insert-code-block": "code-block",
  "insert-math-block": "formula",
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
  const rootMenu = withEditorMenuExtras(buildMenuDefinition());
  const tableRowActions = buildTableRowActions();
  const tableColumnActions = buildTableColumnActions();
  const tableSortActions = buildTableSortActions();
  if (!tableContext?.blockId) {
    return rootMenu;
  }
  if (tableContext.activeHandleAxis === "row") {
    return tableRowActions;
  }
  if (tableContext.activeHandleAxis === "column") {
    return [...tableColumnActions, { type: "separator" }, ...tableSortActions];
  }
  if (tableContext.editableCell) {
    const filteredRootMenu = rootMenu.filter((item) =>
      item?.type === "separator" || (item?.id !== "paragraph" && item?.id !== "insert")
    );
    return [...buildTableMenuDefinition(), { type: "separator" }, ...filteredRootMenu];
  }
  return [...buildTableMenuDefinition(), { type: "separator" }, ...rootMenu];
};

const withDisabledState = (items, view, menuContext = {}) => {
  const selection = selectionRangeOf(view);
  const canReadClipboard = Boolean(globalThis?.navigator?.clipboard?.readText);
  const canWriteClipboard = Boolean(globalThis?.navigator?.clipboard?.writeText);
  const hasBlockRange = Number.isFinite(menuContext?.blockRange?.from) && Number.isFinite(menuContext?.blockRange?.to)
    && Number(menuContext.blockRange.to) > Number(menuContext.blockRange.from);
  const tableEditableCell = menuContext?.table?.editableCell instanceof HTMLElement
    ? menuContext.table.editableCell
    : null;
  const tableCellSelection = tableEditableCell ? selectionRangeInsideElement(tableEditableCell) : null;
  const tableCellSelectedText = tableCellSelection && !tableCellSelection.collapsed
    ? normalizeTableCellClipboardText(tableCellSelection.toString())
    : "";
  const tableCellHasClipboardSource = Boolean(tableCellSelectedText || String(tableEditableCell?.textContent || "").trim());
  const canInsertImage = typeof contextMenuRuntimeOptions?.requestImageMarkdown === "function";
  const canOpenEditorSettings = typeof contextMenuRuntimeOptions?.onEditorSettingCommand === "function";
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item?.type === "separator") {
      return item;
    }
    const id = String(item?.id || "");
    let disabled = false;
    if (id === "clipboard-cut" || id === "clipboard-copy") {
      disabled = tableEditableCell
        ? !tableCellHasClipboardSource || !canWriteClipboard
        : selection.empty || !canWriteClipboard;
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

  clearMenuActiveState(menuEl) {
    if (!(menuEl instanceof HTMLElement)) {
      return;
    }
    if (menuEl === this.subMenuEl) {
      this.submenuActiveIndex = -1;
    } else if (menuEl === this.rootMenuEl) {
      this.rootActiveIndex = -1;
    }
    this.getMenuButtons(menuEl).forEach((button) => {
      button.classList.remove("is-active");
    });
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

  getRootMenuItemFromEventTarget(target) {
    if (!(this.rootMenuEl instanceof HTMLElement) || !(target instanceof Element)) {
      return null;
    }
    const item = target.closest(".yc-editor-context-item");
    if (!(item instanceof HTMLButtonElement) || !this.rootMenuEl.contains(item)) {
      return null;
    }
    return item;
  }

  isRelatedTargetWithinActiveRootItem(target) {
    if (!(this.activeSubmenuItemEl instanceof HTMLButtonElement) || !(target instanceof Node)) {
      return false;
    }
    return this.activeSubmenuItemEl === target || this.activeSubmenuItemEl.contains(target);
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
      this.clearMenuActiveState(this.rootMenuEl);
    }, SUBMENU_CLOSE_DELAY_MS);
  }

  closeSubMenu() {
    this.clearSubmenuTimers();
    this.clearMenuActiveState(this.subMenuEl);
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
    if (!this.pointerInRootMenu) {
      this.clearMenuActiveState(this.rootMenuEl);
    }
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
        if (related instanceof Node && menu.contains(related)) {
          return;
        }
        if (this.isRelatedTargetWithinActiveRootItem(related)) {
          return;
        }
        this.scheduleCloseSubmenu();
        return;
      } else {
        this.pointerInRootMenu = false;
        if (related instanceof Node && this.subMenuEl?.contains(related)) {
          return;
        }
        this.clearMenuActiveState(this.rootMenuEl);
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
      button.dataset.menuId = String(item?.id || "");
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
          if (!isSubmenu && this.activeSubmenuItemEl && this.activeSubmenuItemEl !== button) {
            this.closeSubMenu();
          }
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
          if (!isSubmenu && this.activeSubmenuItemEl && this.activeSubmenuItemEl !== button) {
            this.closeSubMenu();
          }
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

