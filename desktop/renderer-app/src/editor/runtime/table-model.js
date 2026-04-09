const clampColumnCount = (valueInput) => Math.max(1, Number(valueInput || 0));

export const splitMarkdownTableCells = (lineTextInput = "") =>
  String(lineTextInput || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => String(cell || "").trim());

export const isMarkdownPipeWrappedTableLine = (lineTextInput = "") =>
  /^\s*\|.*\|\s*$/.test(String(lineTextInput || ""));

export const isMarkdownTableDelimiterCell = (cellTextInput = "") =>
  /^:?-{3,}:?$/.test(String(cellTextInput || "").trim());

export const markdownTableAlignFromDelimiterCell = (cellTextInput = "") => {
  const cell = String(cellTextInput || "").trim();
  if (!isMarkdownTableDelimiterCell(cell)) {
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

export const markdownTableDelimiterCellFromAlign = (alignInput = "") => {
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

export const normalizeMarkdownTableCellText = (valueInput = "") =>
  String(valueInput ?? "")
    .replace(/\r?\n/g, " ")
    .trim();

export const parseMarkdownTableModel = (rawTextInput = "") => {
  const rawText = String(rawTextInput || "");
  const lines = rawText
    .split("\n")
    .map((line) => String(line || ""))
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return null;
  }
  if (!isMarkdownPipeWrappedTableLine(lines[0]) || !isMarkdownPipeWrappedTableLine(lines[1])) {
    return null;
  }

  const headers = splitMarkdownTableCells(lines[0]);
  const delimiterCells = splitMarkdownTableCells(lines[1]);
  if (!headers.length || delimiterCells.length < headers.length) {
    return null;
  }

  for (let index = 0; index < headers.length; index += 1) {
    if (!isMarkdownTableDelimiterCell(delimiterCells[index])) {
      return null;
    }
  }

  const columnCount = clampColumnCount(headers.length);
  const alignments = Array.from({ length: columnCount }, (_, index) =>
    markdownTableAlignFromDelimiterCell(delimiterCells[index])
  );
  const rows = [];

  for (const line of lines.slice(2)) {
    if (!isMarkdownPipeWrappedTableLine(line)) {
      break;
    }
    const cells = splitMarkdownTableCells(line);
    if (cells.length !== columnCount) {
      break;
    }
    rows.push(Array.from({ length: columnCount }, (_, index) => String(cells[index] || "").trim()));
  }

  const indent = lines.find((line) => line.trim().length > 0)?.match(/^\s*/u)?.[0] || "";

  return {
    headers: Array.from({ length: columnCount }, (_, index) => String(headers[index] || "").trim()),
    alignments,
    rows,
    indent
  };
};

export const serializeMarkdownTableModel = (modelInput = {}) => {
  const headersSource = Array.isArray(modelInput?.headers) ? modelInput.headers : [];
  const columnCount = clampColumnCount(headersSource.length);
  const headers = Array.from({ length: columnCount }, (_, index) =>
    normalizeMarkdownTableCellText(headersSource[index])
  );
  const alignmentsSource = Array.isArray(modelInput?.alignments) ? modelInput.alignments : [];
  const delimiterCells = Array.from({ length: columnCount }, (_, index) =>
    markdownTableDelimiterCellFromAlign(alignmentsSource[index])
  );
  const rowsSource = Array.isArray(modelInput?.rows) ? modelInput.rows : [];
  const rows = rowsSource.map((row) =>
    Array.from({ length: columnCount }, (_, index) => normalizeMarkdownTableCellText(row?.[index]))
  );
  const indent = String(modelInput?.indent || "");
  const lineOf = (cells) => `${indent}| ${cells.join(" | ")} |`;
  return [lineOf(headers), lineOf(delimiterCells), ...rows.map((row) => lineOf(row))].join("\n");
};
