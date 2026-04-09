import { parseImageLine } from "./parse-image.js";

const BLOCK_TYPES = Object.freeze({
  IMAGE: "image",
  MATH_BLOCK: "math_block",
  CODE_BLOCK: "code_block",
  TABLE: "table"
});

export const SPECIAL_BLOCK_TYPE_LIST = Object.freeze(Object.values(BLOCK_TYPES));
export const SPECIAL_BLOCK_TYPES = new Set(SPECIAL_BLOCK_TYPE_LIST);

export const OPEN_CODE_FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
export const OPEN_MATH_FENCE_PATTERN = /^\s{0,3}\$\$\s*$/;
export const SINGLE_LINE_MATH_PATTERN = /^\s{0,3}\$\$(.+?)\$\$\s*$/;

const TABLE_DELIMITER_CELL_PATTERN = /^:?-{3,}:?$/;

const normalizeMarkdown = (markdownInput = "") => String(markdownInput || "").replace(/\r\n/g, "\n");

const makeBlockId = (type, from, to) => `${String(type)}:${Math.max(0, Number(from || 0))}:${Math.max(0, Number(to || 0))}`;

const buildLines = (markdownInput = "") => {
  const markdown = normalizeMarkdown(markdownInput);
  const parts = markdown.split("\n");
  const lines = [];
  let cursor = 0;

  for (let index = 0; index < parts.length; index += 1) {
    const text = String(parts[index] || "");
    const hasNewline = index < parts.length - 1;
    const from = cursor;
    const to = from + text.length + (hasNewline ? 1 : 0);
    lines.push({
      number: index + 1,
      text,
      from,
      to,
      hasNewline
    });
    cursor = to;
  }

  return lines;
};

const lineContentEnd = (line) => {
  const from = Math.max(0, Number(line?.from || 0));
  const to = Math.max(from, Number(line?.to || from));
  return line?.hasNewline ? Math.max(from, to - 1) : to;
};

const closeFencePatternFor = (fenceTokenInput = "") => {
  const fenceToken = String(fenceTokenInput || "");
  if (!fenceToken) {
    return /^$/;
  }
  const marker = fenceToken[0] === "~" ? "~" : "`";
  return new RegExp(`^\\s{0,3}${marker}{${fenceToken.length},}\\s*$`);
};

export const normalizeCodeLanguage = (valueInput = "") => {
  const raw = String(valueInput || "").trim().toLowerCase();
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

const splitTableCells = (lineTextInput = "") =>
  String(lineTextInput || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => String(cell || "").trim());

const isPipeWrappedTableLine = (lineTextInput = "") => /^\s*\|.*\|\s*$/.test(String(lineTextInput || ""));

const isTableDelimiterLine = (lineTextInput = "") => {
  const trimmed = String(lineTextInput || "").trim();
  if (!isPipeWrappedTableLine(trimmed)) {
    return false;
  }
  const cells = splitTableCells(trimmed);
  return Boolean(cells.length) && cells.every((cell) => TABLE_DELIMITER_CELL_PATTERN.test(cell));
};

const isTableHeaderLine = (lineTextInput = "") => {
  const trimmed = String(lineTextInput || "").trim();
  if (!trimmed || !isPipeWrappedTableLine(trimmed)) {
    return false;
  }
  const cells = splitTableCells(trimmed);
  return cells.length >= 2;
};

const isTableBodyLine = (lineTextInput = "", expectedColumnCount = 0) => {
  const trimmed = String(lineTextInput || "").trim();
  if (!trimmed || !isPipeWrappedTableLine(trimmed)) {
    return false;
  }
  const cells = splitTableCells(trimmed);
  if (!cells.length) {
    return false;
  }
  return expectedColumnCount > 0 ? cells.length === expectedColumnCount : true;
};

const extractMathFormula = (rawInput = "") => {
  const raw = String(rawInput || "");
  const singleLineMatch = raw.match(SINGLE_LINE_MATH_PATTERN);
  if (singleLineMatch) {
    return String(singleLineMatch[1] || "").trim();
  }

  let content = raw.trim();
  if (content.startsWith("$$")) {
    content = content.slice(2);
  }
  if (content.endsWith("$$")) {
    content = content.slice(0, -2);
  }
  return content.replace(/^\n+/, "").replace(/\n+$/, "");
};

const createDescriptor = ({
  type,
  from,
  to,
  lineStart,
  lineEnd,
  rawText,
  attrs = {},
  source = {}
} = {}) => ({
  id: makeBlockId(type, from, to),
  type,
  from,
  to,
  lineStart,
  lineEnd,
  rawText: String(rawText || ""),
  attrs,
  source
});

const parseImageDescriptor = (markdown, line) => {
  const trimmed = String(line?.text || "").trim();
  if (!trimmed) {
    return null;
  }
  const attrs = parseImageLine(trimmed);
  if (!attrs?.src) {
    return null;
  }

  const from = Math.max(0, Number(line?.from || 0));
  const to = lineContentEnd(line);
  const rawText = markdown.slice(from, to);
  return createDescriptor({
    type: BLOCK_TYPES.IMAGE,
    from,
    to,
    lineStart: Number(line?.number || 1),
    lineEnd: Number(line?.number || 1),
    rawText,
    attrs,
    source: {
      kind: "image_line",
      from,
      to
    }
  });
};

const parseSingleLineMathDescriptor = (markdown, line) => {
  const lineText = String(line?.text || "");
  if (!SINGLE_LINE_MATH_PATTERN.test(lineText)) {
    return null;
  }

  const rawLine = lineText;
  const leading = rawLine.match(/^\s*/u)?.[0] || "";
  const trailing = rawLine.match(/\s*$/u)?.[0] || "";
  const sourceStart = leading.length;
  const sourceEnd = Math.max(sourceStart, rawLine.length - trailing.length);
  const source = rawLine.slice(sourceStart, sourceEnd);
  if (!(source.startsWith("$$") && source.endsWith("$$") && source.length >= 4)) {
    return null;
  }

  const from = Math.max(0, Number(line?.from || 0));
  const to = lineContentEnd(line);
  const rawText = markdown.slice(from, to);
  const baseFrom = from + sourceStart;
  const contentFrom = baseFrom + 2;
  const contentTo = baseFrom + source.length - 2;

  return createDescriptor({
    type: BLOCK_TYPES.MATH_BLOCK,
    from,
    to,
    lineStart: Number(line?.number || 1),
    lineEnd: Number(line?.number || 1),
    rawText,
    attrs: {
      formula: extractMathFormula(rawText),
      displayMode: true
    },
    source: {
      kind: "math_single_line",
      contentFrom,
      contentTo,
      openFenceFrom: baseFrom,
      openFenceTo: baseFrom + 2,
      closeFenceFrom: baseFrom + source.length - 2,
      closeFenceTo: baseFrom + source.length
    }
  });
};

const parseFencedMathDescriptor = (markdown, lines, startIndex) => {
  const startLine = lines[startIndex];
  if (!OPEN_MATH_FENCE_PATTERN.test(String(startLine?.text || ""))) {
    return null;
  }

  let endIndex = startIndex;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    endIndex = index;
    if (OPEN_MATH_FENCE_PATTERN.test(String(lines[index]?.text || ""))) {
      break;
    }
  }

  const endLine = lines[endIndex];
  const from = Math.max(0, Number(startLine?.from || 0));
  const to = lineContentEnd(endLine);
  const rawText = markdown.slice(from, to);
  const contentFrom = startLine?.hasNewline ? Number(startLine.to || from) : lineContentEnd(startLine);
  const hasClosingFence = endIndex > startIndex && OPEN_MATH_FENCE_PATTERN.test(String(endLine?.text || ""));
  const contentTo = hasClosingFence ? Math.max(contentFrom, Number(endLine?.from || contentFrom)) : to;
  const leading = String(startLine?.text || "").match(/^\s*/u)?.[0] || "";
  const closeLeading = String(endLine?.text || "").match(/^\s*/u)?.[0] || "";

  return {
    descriptor: createDescriptor({
      type: BLOCK_TYPES.MATH_BLOCK,
      from,
      to,
      lineStart: Number(startLine?.number || 1),
      lineEnd: Number(endLine?.number || startLine?.number || 1),
      rawText,
      attrs: {
        formula: extractMathFormula(rawText),
        displayMode: true
      },
      source: {
        kind: "math_fence",
        contentFrom,
        contentTo,
        openFenceFrom: from + leading.length,
        openFenceTo: from + leading.length + 2,
        closeFenceFrom: hasClosingFence ? Number(endLine?.from || to) + closeLeading.length : null,
        closeFenceTo: hasClosingFence ? Number(endLine?.from || to) + closeLeading.length + 2 : null
      }
    }),
    endIndex
  };
};

const parseCodeBlockDescriptor = (markdown, lines, startIndex) => {
  const startLine = lines[startIndex];
  const openMatch = String(startLine?.text || "").match(OPEN_CODE_FENCE_PATTERN);
  if (!openMatch) {
    return null;
  }

  const openingFence = String(openMatch[1] || "");
  const infoString = String(openMatch[2] || "").trim();
  const language = infoString ? String(infoString.split(/\s+/)[0] || "") : "";
  const closePattern = closeFencePatternFor(openingFence);
  let endIndex = startIndex;
  let hasClosingFence = false;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    endIndex = index;
    if (closePattern.test(String(lines[index]?.text || ""))) {
      hasClosingFence = true;
      break;
    }
  }

  const endLine = lines[endIndex];
  const from = Math.max(0, Number(startLine?.from || 0));
  const to = lineContentEnd(endLine);
  const rawText = markdown.slice(from, to);
  const contentFrom = startLine?.hasNewline ? Number(startLine.to || from) : lineContentEnd(startLine);
  const contentTo = hasClosingFence ? Math.max(contentFrom, Number(endLine?.from || contentFrom)) : to;
  const leading = String(startLine?.text || "").match(/^\s*/u)?.[0] || "";
  const closeLeading = String(endLine?.text || "").match(/^\s*/u)?.[0] || "";

  return {
    descriptor: createDescriptor({
      type: BLOCK_TYPES.CODE_BLOCK,
      from,
      to,
      lineStart: Number(startLine?.number || 1),
      lineEnd: Number(endLine?.number || startLine?.number || 1),
      rawText,
      attrs: {
        language: language || null,
        normalizedLanguage: normalizeCodeLanguage(language),
        fence: openingFence[0] === "~" ? "~~~" : "```",
        infoString: infoString || ""
      },
      source: {
        kind: "code_fence",
        contentFrom,
        contentTo,
        openFenceFrom: from + leading.length,
        openFenceTo: from + leading.length + openingFence.length,
        closeFenceFrom: hasClosingFence ? Number(endLine?.from || to) + closeLeading.length : null,
        closeFenceTo: hasClosingFence ? Number(endLine?.from || to) + closeLeading.length + openingFence.length : null
      }
    }),
    endIndex
  };
};

const parseTableDescriptor = (markdown, lines, startIndex) => {
  const headerLine = lines[startIndex];
  const delimiterLine = lines[startIndex + 1];
  if (!headerLine || !delimiterLine) {
    return null;
  }
  if (!isTableHeaderLine(headerLine.text) || !isTableDelimiterLine(delimiterLine.text)) {
    return null;
  }

  const expectedColumnCount = splitTableCells(headerLine.text).length;
  let endIndex = startIndex + 1;
  while (endIndex + 1 < lines.length && isTableBodyLine(lines[endIndex + 1].text, expectedColumnCount)) {
    endIndex += 1;
  }

  const endLine = lines[endIndex];
  const from = Math.max(0, Number(headerLine?.from || 0));
  const to = lineContentEnd(endLine);
  const rawText = markdown.slice(from, to);

  return {
    descriptor: createDescriptor({
      type: BLOCK_TYPES.TABLE,
      from,
      to,
      lineStart: Number(headerLine?.number || 1),
      lineEnd: Number(endLine?.number || headerLine?.number || 1),
      rawText,
      attrs: {
        columns: expectedColumnCount
      },
      source: {
        kind: "table",
        from,
        to
      }
    }),
    endIndex
  };
};

export const parseSpecialBlocksFromMarkdown = (markdownInput = "") => {
  const markdown = normalizeMarkdown(markdownInput);
  if (!markdown) {
    return [];
  }

  const lines = buildLines(markdown);
  const descriptors = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineText = String(line?.text || "");
    const trimmed = lineText.trim();
    if (!trimmed) {
      continue;
    }

    const codeBlock = parseCodeBlockDescriptor(markdown, lines, index);
    if (codeBlock) {
      descriptors.push(codeBlock.descriptor);
      index = codeBlock.endIndex;
      continue;
    }

    const singleLineMath = parseSingleLineMathDescriptor(markdown, line);
    if (singleLineMath) {
      descriptors.push(singleLineMath);
      continue;
    }

    const fencedMath = parseFencedMathDescriptor(markdown, lines, index);
    if (fencedMath) {
      descriptors.push(fencedMath.descriptor);
      index = fencedMath.endIndex;
      continue;
    }

    const table = parseTableDescriptor(markdown, lines, index);
    if (table) {
      descriptors.push(table.descriptor);
      index = table.endIndex;
      continue;
    }

    const image = parseImageDescriptor(markdown, line);
    if (image) {
      descriptors.push(image);
    }
  }

  return descriptors;
};

export const isSpecialBlockType = (valueInput = "") => SPECIAL_BLOCK_TYPES.has(String(valueInput || ""));

export const specialBlockStateKeyOf = (blockOrType, fromInput = null) => {
  if (typeof blockOrType === "object" && blockOrType) {
    const type = String(blockOrType.type || "");
    if (!isSpecialBlockType(type)) {
      return "";
    }
    const from = Math.max(0, Number(blockOrType.from || 0));
    return `${type}:${from}`;
  }

  const type = String(blockOrType || "");
  if (!isSpecialBlockType(type)) {
    return "";
  }
  const from = Math.max(0, Number(fromInput || 0));
  return `${type}:${from}`;
};

export const remapSpecialBlockStateKey = (keyInput = "", changes = null) => {
  const key = String(keyInput || "");
  if (!key || !changes || typeof changes.mapPos !== "function") {
    return key;
  }

  const match = key.match(/^([a-z_]+):(\d+)$/);
  if (!match) {
    return key;
  }

  const type = String(match[1] || "");
  const from = Number(match[2]);
  if (!isSpecialBlockType(type) || !Number.isFinite(from)) {
    return key;
  }

  return `${type}:${changes.mapPos(from, -1)}`;
};
