import { marked } from "marked";
import { createBlockNode } from "../model/block-node";
import { BLOCK_TYPES } from "../model/block-types";
import { parseImageLine } from "./parse-image";
import { buildInlineModelForBlock } from "./parse-inline";
import { parseListLine } from "./parse-list";

const normalizeMarkdown = (markdown) => String(markdown || "").replace(/\r\n/g, "\n");

const makeBlockId = (type, from, to) => `${String(type)}:${from}:${to}`;

const buildLineStarts = (markdown) => {
  const starts = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
};

const lineNumberAtPos = (lineStarts, posInput) => {
  if (!lineStarts.length) {
    return 1;
  }
  const pos = Math.max(0, Number(posInput || 0));
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= pos) {
      low = mid + 1;
      continue;
    }
    high = mid - 1;
  }
  return Math.max(1, high + 1);
};

const toLineRange = (markdown, lineStarts, fromInput, toInput) => {
  const from = Math.max(0, Math.min(markdown.length, Number(fromInput || 0)));
  const to = Math.max(from, Math.min(markdown.length, Number(toInput || from)));
  const lineStart = lineNumberAtPos(lineStarts, from);
  const endAnchor = to > from ? to - 1 : from;
  const lineEnd = lineNumberAtPos(lineStarts, endAnchor);
  return {
    lineStart,
    lineEnd: Math.max(lineStart, lineEnd)
  };
};

const findRawRange = (markdown, rawInput, cursorInput = 0, maxToInput = markdown.length) => {
  const raw = String(rawInput || "");
  const cursor = Math.max(0, Math.min(markdown.length, Number(cursorInput || 0)));
  const maxTo = Math.max(cursor, Math.min(markdown.length, Number(maxToInput || markdown.length)));

  if (!raw) {
    return {
      from: cursor,
      to: cursor,
      nextCursor: cursor
    };
  }

  let from = markdown.indexOf(raw, cursor);
  if (from < 0 || from + raw.length > maxTo) {
    const localFrom = markdown.slice(cursor, maxTo).indexOf(raw);
    from = localFrom >= 0 ? cursor + localFrom : -1;
  }
  if (from < 0) {
    from = markdown.indexOf(raw);
  }
  if (from < 0) {
    from = cursor;
  }

  const to = Math.max(from, Math.min(markdown.length, from + raw.length));
  return {
    from,
    to,
    nextCursor: Math.max(cursor, to)
  };
};

const isMathBlockRaw = (rawInput) => {
  const raw = String(rawInput || "").trim();
  if (!raw) {
    return false;
  }
  if (/^\s{0,3}\$\$(.+?)\$\$\s*$/.test(raw)) {
    return true;
  }
  return /^\s{0,3}\$\$\s*\n[\s\S]*?\n\s{0,3}\$\$\s*$/.test(raw);
};

const extractMathFormula = (rawInput) => {
  let content = String(rawInput || "").trim();
  if (content.startsWith("$$")) {
    content = content.slice(2);
  }
  if (content.endsWith("$$")) {
    content = content.slice(0, -2);
  }
  return content.replace(/^\n+/, "").replace(/\n+$/, "");
};

const extractFenceFromRaw = (rawInput) => {
  const line = String(rawInput || "").split("\n")[0] || "";
  const trimmed = line.trimStart();
  return trimmed.startsWith("~~~") ? "~~~" : "```";
};

const countIndent = (lineText) => {
  let count = 0;
  for (const char of String(lineText || "")) {
    if (char === " ") {
      count += 1;
      continue;
    }
    if (char === "\t") {
      count += 2;
      continue;
    }
    break;
  }
  return count;
};

const firstLineOf = (raw) => String(raw || "").split("\n")[0] || "";

const buildLinesForRange = (markdown, from, to) => {
  const content = markdown.slice(from, to);
  const rawLines = content.split("\n");
  const lines = [];
  let cursor = from;

  for (let index = 0; index < rawLines.length; index += 1) {
    const text = rawLines[index];
    const hasNewline = index < rawLines.length - 1;
    const lineFrom = cursor;
    const lineTo = lineFrom + text.length + (hasNewline ? 1 : 0);
    lines.push({
      text,
      from: lineFrom,
      to: lineTo
    });
    cursor = lineTo;
  }

  return lines;
};

const tableColumnsOf = (token) => {
  if (Array.isArray(token?.header)) {
    return token.header.length;
  }
  const first = firstLineOf(token?.raw || "");
  const normalized = String(first).trim().replace(/^\|/, "").replace(/\|$/, "");
  if (!normalized) {
    return 0;
  }
  return normalized.split("|").length;
};

const extractListBlocksFromRange = (markdown, from, to) => {
  const lines = buildLinesForRange(markdown, from, to);
  const items = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const parsed = parseListLine(line.text);
    if (!parsed) {
      index += 1;
      continue;
    }

    const currentIndent = Number(parsed?.attrs?.indent || 0);
    let endIndex = index;
    let cursor = index + 1;

    while (cursor < lines.length) {
      const nextLine = lines[cursor];
      if (parseListLine(nextLine.text)) {
        break;
      }

      const trimmed = String(nextLine.text || "").trim();
      if (!trimmed) {
        endIndex = cursor;
        cursor += 1;
        continue;
      }

      if (countIndent(nextLine.text) <= currentIndent) {
        break;
      }

      endIndex = cursor;
      cursor += 1;
    }

    items.push({
      type: parsed.type,
      attrs: parsed.attrs || {},
      from: line.from,
      to: lines[endIndex].to
    });

    index = endIndex + 1;
  }

  return items;
};

const pushBlock = (blocks, markdown, lineStarts, type, from, to, attrs = {}) => {
  if (to <= from) {
    return;
  }
  const range = toLineRange(markdown, lineStarts, from, to);
  const rawText = markdown.slice(from, to);
  const inlineModel = buildInlineModelForBlock({
    blockType: type,
    rawText,
    from,
    lineStart: range.lineStart
  });
  const inlineTokens = inlineModel.inlineTokens || [];
  const inlineSegments = inlineModel.inlineSegments || [];
  blocks.push(
    createBlockNode({
      id: makeBlockId(type, from, to),
      type,
      from,
      to,
      lineStart: range.lineStart,
      lineEnd: range.lineEnd,
      rawText,
      attrs,
      inlineTokens,
      inlineSegments
    })
  );
};

const parseParagraphLike = (raw) => {
  const image = parseImageLine(String(raw || "").trim());
  if (image) {
    return {
      type: BLOCK_TYPES.IMAGE,
      attrs: image
    };
  }
  if (isMathBlockRaw(raw)) {
    return {
      type: BLOCK_TYPES.MATH_BLOCK,
      attrs: {
        formula: extractMathFormula(raw),
        displayMode: true
      }
    };
  }
  return {
    type: BLOCK_TYPES.PARAGRAPH,
    attrs: {}
  };
};

const trimTrailingBlankLinesInRange = (markdown, fromInput, toInput) => {
  const from = Math.max(0, Math.min(markdown.length, Number(fromInput || 0)));
  const to = Math.max(from, Math.min(markdown.length, Number(toInput || from)));
  const raw = markdown.slice(from, to);
  const trimmed = raw.replace(/(?:\n[ \t]*)+$/u, "");
  return Math.max(from, from + trimmed.length);
};

const lexerTokens = (markdown) => {
  try {
    return marked.lexer(markdown, {
      gfm: true
    });
  } catch {
    return [];
  }
};

export const parseMarkdownToBlocks = (markdownInput) => {
  const markdown = normalizeMarkdown(markdownInput);
  if (!markdown) {
    return [];
  }

  const tokens = lexerTokens(markdown);
  const lineStarts = buildLineStarts(markdown);
  const blocks = [];
  let cursor = 0;

  if (!tokens.length) {
    const fallback = parseParagraphLike(markdown);
    pushBlock(blocks, markdown, lineStarts, fallback.type, 0, markdown.length, fallback.attrs);
    return blocks;
  }

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    const type = String(token.type || "");
    const raw = String(token.raw || "");

    if (type === "space") {
      const range = findRawRange(markdown, raw, cursor);
      cursor = range.nextCursor;
      continue;
    }

    if (type === "list") {
      const listRange = findRawRange(markdown, raw, cursor);
      cursor = listRange.nextCursor;
      const listItems = extractListBlocksFromRange(markdown, listRange.from, listRange.to);
      for (const item of listItems) {
        pushBlock(blocks, markdown, lineStarts, item.type, item.from, item.to, item.attrs);
      }
      continue;
    }

    const range = findRawRange(markdown, raw || token.text || "", cursor);
    cursor = range.nextCursor;

    if (type === "heading") {
      const trimmedTo = trimTrailingBlankLinesInRange(markdown, range.from, range.to);
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.HEADING, range.from, trimmedTo, {
        level: Number(token.depth || 1),
        text: String(token.text || "")
      });
      continue;
    }

    if (type === "code") {
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.CODE_BLOCK, range.from, range.to, {
        language: token.lang ? String(token.lang) : null,
        fence: extractFenceFromRaw(raw)
      });
      continue;
    }

    if (type === "blockquote") {
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.BLOCKQUOTE, range.from, range.to, {});
      continue;
    }

    if (type === "hr") {
      const trimmedTo = trimTrailingBlankLinesInRange(markdown, range.from, range.to);
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.THEMATIC_BREAK, range.from, trimmedTo, {});
      continue;
    }

    if (type === "table") {
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.TABLE, range.from, range.to, {
        columns: tableColumnsOf(token)
      });
      continue;
    }

    if (type === "html") {
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.HTML_BLOCK, range.from, range.to, {});
      continue;
    }

    if (type === "paragraph" || type === "text") {
      const paragraphLike = parseParagraphLike(raw);
      pushBlock(blocks, markdown, lineStarts, paragraphLike.type, range.from, range.to, paragraphLike.attrs);
      continue;
    }

    const fallback = parseParagraphLike(raw);
    pushBlock(blocks, markdown, lineStarts, fallback.type, range.from, range.to, fallback.attrs);
  }

  return blocks.sort((left, right) => left.from - right.from || left.to - right.to);
};
