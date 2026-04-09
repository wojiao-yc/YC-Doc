import { marked } from "marked";
import { createBlockNode } from "../model/block-node.js";
import { BLOCK_TYPES } from "../model/block-types.js";
import { parseImageLine } from "./parse-image.js";
import { buildInlineModelForBlock } from "./parse-inline.js";
import { parseListLine } from "./parse-list.js";

const OPEN_MATH_FENCE_PATTERN = /^\s{0,3}\$\$\s*$/;
const SINGLE_LINE_MATH_PATTERN = /^\s{0,3}\$\$(.+?)\$\$\s*$/;
const BLOCKQUOTE_LINE_PATTERN = /^\s{0,3}>\s?/;
const CALLOUT_HEADER_PATTERN = /^\s{0,3}>\s*\[!([A-Za-z][A-Za-z0-9_-]*)\](?:[ \t]+(.*))?\s*$/;

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

const findRawRange = (markdown, rawInput, cursorInput = 0, maxToInput = markdown.length, fallbackText = "") => {
  const raw = String(rawInput || "");
  const cursor = Math.max(0, Math.min(markdown.length, Number(cursorInput || 0)));
  const maxTo = Math.max(cursor, Math.min(markdown.length, Number(maxToInput || markdown.length)));

  if (!raw && !fallbackText) {
    return {
      from: cursor,
      to: cursor,
      nextCursor: cursor
    };
  }

  // 优先使用 token.raw 精确匹配
  let from = -1;
  if (raw) {
    from = markdown.indexOf(raw, cursor);
    if (from >= 0 && from + raw.length <= maxTo) {
      const to = Math.max(from, Math.min(markdown.length, from + raw.length));
      return {
        from,
        to,
        nextCursor: Math.max(cursor, to)
      };
    }
  }

  // 如果精确匹配失败，尝试使用 fallbackText（token.text）进行匹配
  const searchText = raw || fallbackText;
  if (searchText) {
    from = markdown.indexOf(searchText, cursor);
    if (from >= 0 && from + searchText.length <= maxTo) {
      const to = Math.max(from, Math.min(markdown.length, from + searchText.length));
      return {
        from,
        to,
        nextCursor: Math.max(cursor, to)
      };
    }

    // 在整个文档范围内查找（不限制 cursor）
    from = markdown.indexOf(searchText);
    if (from >= 0) {
      const to = Math.max(from, Math.min(markdown.length, from + searchText.length));
      return {
        from,
        to,
        nextCursor: Math.max(cursor, to)
      };
    }
  }

  // 如果都找不到，返回 cursor 位置
  return {
    from: cursor,
    to: cursor,
    nextCursor: cursor
  };
};

const isMathBlockRaw = (rawInput) => {
  const raw = String(rawInput || "").trim();
  if (!raw) {
    return false;
  }
  if (SINGLE_LINE_MATH_PATTERN.test(raw)) {
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

const normalizeCalloutType = (typeInput) =>
  String(typeInput || "note")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    || "note";

const blockquoteAttrsFromRaw = (rawInput) => {
  const firstLine = String(rawInput || "").split("\n")[0] || "";
  const match = firstLine.match(CALLOUT_HEADER_PATTERN);
  if (!match) {
    return {};
  }
  return {
    callout: true,
    calloutType: normalizeCalloutType(match[1]),
    calloutTitle: String(match[2] || "").trim()
  };
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
      to: lineTo,
      hasNewline
    });
    cursor = lineTo;
  }

  return lines;
};

const lineContentEnd = (line) => {
  const from = Math.max(0, Number(line?.from || 0));
  const to = Math.max(from, Number(line?.to || from));
  if (line?.hasNewline) {
    return Math.max(from, to - 1);
  }
  return to;
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

const tableCellsFromLine = (lineText) => String(lineText || "").trim().replace(/^\|/, "").replace(/\|$/, "").split("|");

const isPipeWrappedTableLine = (lineText) => /^\s*\|.*\|\s*$/.test(String(lineText || ""));

const isTableDelimiterLine = (lineText) => {
  const trimmed = String(lineText || "").trim();
  if (!isPipeWrappedTableLine(trimmed)) {
    return false;
  }
  const cells = tableCellsFromLine(trimmed);
  if (!cells.length) {
    return false;
  }
  return cells.every((cell) => /^:?-{3,}:?$/.test(String(cell || "").trim()));
};

const isTableHeaderLine = (lineText) => {
  const trimmed = String(lineText || "").trim();
  if (!trimmed || !isPipeWrappedTableLine(trimmed)) {
    return false;
  }
  const cells = tableCellsFromLine(trimmed);
  return cells.length >= 2 && cells.some((cell) => String(cell || "").trim().length > 0);
};

const isTableBodyLine = (lineText, expectedColumnCount = 0) => {
  const trimmed = String(lineText || "").trim();
  if (!trimmed || !isPipeWrappedTableLine(trimmed)) {
    return false;
  }
  const cells = tableCellsFromLine(trimmed);
  if (!cells.length) {
    return false;
  }
  return expectedColumnCount > 0 ? cells.length === expectedColumnCount : true;
};

const tableColumnCountFromHeaderLine = (lineText) => {
  const normalized = String(lineText || "").trim().replace(/^\|/, "").replace(/\|$/, "");
  if (!normalized) {
    return 0;
  }
  return normalized.split("|").length;
};

const parseParagraphRangeToBlocks = (markdown, from, to) => {
  const lines = buildLinesForRange(markdown, from, to);
  if (!lines.length) {
    return [];
  }

  const blocks = [];
  let paragraphFrom = -1;
  let paragraphTo = -1;

  const flushParagraph = () => {
    if (paragraphFrom < 0 || paragraphTo <= paragraphFrom) {
      paragraphFrom = -1;
      paragraphTo = -1;
      return;
    }
    const trimmedTo = trimTrailingBlankLinesInRange(markdown, paragraphFrom, paragraphTo);
    if (trimmedTo > paragraphFrom) {
      const raw = markdown.slice(paragraphFrom, trimmedTo);
      const paragraphLike = parseParagraphLike(raw);
      blocks.push({
        type: paragraphLike.type,
        from: paragraphFrom,
        to: trimmedTo,
        attrs: paragraphLike.attrs
      });
    }
    paragraphFrom = -1;
    paragraphTo = -1;
  };

  const appendParagraphLine = (line) => {
    if (paragraphFrom < 0) {
      paragraphFrom = line.from;
    }
    paragraphTo = line.to;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineText = String(line?.text || "");
    const trimmed = lineText.trim();

    if (!trimmed) {
      appendParagraphLine(line);
      continue;
    }

    const image = parseImageLine(trimmed);
    if (image) {
      flushParagraph();
      const blockTo = lineContentEnd(line);
      if (blockTo > line.from) {
        blocks.push({
          type: BLOCK_TYPES.IMAGE,
          from: line.from,
          to: blockTo,
          attrs: image
        });
      }
      continue;
    }

    if (SINGLE_LINE_MATH_PATTERN.test(lineText)) {
      flushParagraph();
      const blockTo = lineContentEnd(line);
      if (blockTo > line.from) {
        blocks.push({
          type: BLOCK_TYPES.MATH_BLOCK,
          from: line.from,
          to: blockTo,
          attrs: {
            formula: extractMathFormula(markdown.slice(line.from, blockTo)),
            displayMode: true
          }
        });
      }
      continue;
    }

    if (OPEN_MATH_FENCE_PATTERN.test(lineText)) {
      let fenceEndIndex = -1;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        if (OPEN_MATH_FENCE_PATTERN.test(lines[cursor].text)) {
          fenceEndIndex = cursor;
          break;
        }
      }

      if (fenceEndIndex >= 0) {
        flushParagraph();
        const blockTo = lineContentEnd(lines[fenceEndIndex]);
        if (blockTo > line.from) {
          const raw = markdown.slice(line.from, blockTo);
          blocks.push({
            type: BLOCK_TYPES.MATH_BLOCK,
            from: line.from,
            to: blockTo,
            attrs: {
              formula: extractMathFormula(raw),
              displayMode: true
            }
          });
        }
        index = fenceEndIndex;
        continue;
      }
    }

    const nextLine = lines[index + 1];
    if (nextLine && isTableHeaderLine(lineText) && isTableDelimiterLine(nextLine.text)) {
      flushParagraph();
      const tableColumnCount = tableColumnCountFromHeaderLine(lineText);
      let tableEndIndex = index + 1;
      while (
        tableEndIndex + 1 < lines.length
        && isTableBodyLine(lines[tableEndIndex + 1].text, tableColumnCount)
      ) {
        tableEndIndex += 1;
      }

      const blockTo = lineContentEnd(lines[tableEndIndex]);
      if (blockTo > line.from) {
        blocks.push({
          type: BLOCK_TYPES.TABLE,
          from: line.from,
          to: blockTo,
          attrs: {
            columns: tableColumnCount
          }
        });
      }
      index = tableEndIndex;
      continue;
    }

    appendParagraphLine(line);
  }

  flushParagraph();
  return blocks;
};

const extractListBlocksFromRange = (markdown, from, to) => {
  const lines = buildLinesForRange(markdown, from, to);
  if (!lines.length) {
    return [];
  }

  const blocks = [];
  let plainFrom = -1;
  let plainTo = -1;

  const flushPlain = () => {
    if (plainFrom < 0 || plainTo <= plainFrom) {
      plainFrom = -1;
      plainTo = -1;
      return;
    }
    blocks.push(...parseParagraphRangeToBlocks(markdown, plainFrom, plainTo));
    plainFrom = -1;
    plainTo = -1;
  };

  for (const line of lines) {
    const parsed = parseListLine(line.text);
    if (!parsed) {
      if (plainFrom < 0) {
        plainFrom = line.from;
      }
      plainTo = line.to;
      continue;
    }

    flushPlain();
    const blockTo = lineContentEnd(line);
    if (blockTo > line.from) {
      blocks.push({
        type: parsed.type,
        attrs: parsed.attrs || {},
        from: line.from,
        to: blockTo
      });
    }
  }

  flushPlain();
  return blocks;
};

const parseBlockquoteRangeToBlocks = (markdown, from, to) => {
  const lines = buildLinesForRange(markdown, from, to);
  if (!lines.length) {
    return [];
  }

  const blocks = [];
  let quoteFrom = -1;
  let quoteTo = -1;
  let plainFrom = -1;
  let plainTo = -1;

  const flushQuote = () => {
    if (quoteFrom < 0 || quoteTo <= quoteFrom) {
      quoteFrom = -1;
      quoteTo = -1;
      return;
    }
    const trimmedTo = trimTrailingBlankLinesInRange(markdown, quoteFrom, quoteTo);
    if (trimmedTo > quoteFrom) {
      const raw = markdown.slice(quoteFrom, trimmedTo);
      blocks.push({
        type: BLOCK_TYPES.BLOCKQUOTE,
        from: quoteFrom,
        to: trimmedTo,
        attrs: blockquoteAttrsFromRaw(raw)
      });
    }
    quoteFrom = -1;
    quoteTo = -1;
  };

  const flushPlain = () => {
    if (plainFrom < 0 || plainTo <= plainFrom) {
      plainFrom = -1;
      plainTo = -1;
      return;
    }
    blocks.push(...parseParagraphRangeToBlocks(markdown, plainFrom, plainTo));
    plainFrom = -1;
    plainTo = -1;
  };

  for (const line of lines) {
    if (BLOCKQUOTE_LINE_PATTERN.test(String(line.text || ""))) {
      flushPlain();
      if (quoteFrom < 0) {
        quoteFrom = line.from;
      }
      quoteTo = line.to;
      continue;
    }

    flushQuote();
    if (plainFrom < 0) {
      plainFrom = line.from;
    }
    plainTo = line.to;
  }

  flushQuote();
  flushPlain();
  return blocks;
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
    const text = String(token.text || "");

    if (type === "space") {
      const range = findRawRange(markdown, raw, cursor, markdown.length, text);
      cursor = range.nextCursor;
      continue;
    }

    if (type === "list") {
      const listRange = findRawRange(markdown, raw, cursor, markdown.length, text);
      cursor = listRange.nextCursor;
      const listItems = extractListBlocksFromRange(markdown, listRange.from, listRange.to);
      for (const item of listItems) {
        pushBlock(blocks, markdown, lineStarts, item.type, item.from, item.to, item.attrs);
      }
      continue;
    }

    const range = findRawRange(markdown, raw || text, cursor, markdown.length, text);
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
      const quoteBlocks = parseBlockquoteRangeToBlocks(markdown, range.from, range.to);
      if (!quoteBlocks.length) {
        pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.BLOCKQUOTE, range.from, range.to, {});
        continue;
      }
      for (const quoteBlock of quoteBlocks) {
        pushBlock(
          blocks,
          markdown,
          lineStarts,
          quoteBlock.type,
          quoteBlock.from,
          quoteBlock.to,
          quoteBlock.attrs || {}
        );
      }
      continue;
    }

    if (type === "hr") {
      const trimmedTo = trimTrailingBlankLinesInRange(markdown, range.from, range.to);
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.THEMATIC_BREAK, range.from, trimmedTo, {});
      continue;
    }

    if (type === "table") {
      const trimmedTo = trimTrailingBlankLinesInRange(markdown, range.from, range.to);
      const strictBlocks = parseParagraphRangeToBlocks(markdown, range.from, trimmedTo);
      if (strictBlocks.length) {
        for (const strictBlock of strictBlocks) {
          pushBlock(
            blocks,
            markdown,
            lineStarts,
            strictBlock.type,
            strictBlock.from,
            strictBlock.to,
            strictBlock.type === BLOCK_TYPES.TABLE
              ? {
                  columns: Number(strictBlock.attrs?.columns || tableColumnsOf(token) || 0)
                }
              : (strictBlock.attrs || {})
          );
        }
        continue;
      }
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.TABLE, range.from, trimmedTo, {
        columns: tableColumnsOf(token)
      });
      continue;
    }

    if (type === "html") {
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.HTML_BLOCK, range.from, range.to, {});
      continue;
    }

    if (type === "paragraph" || type === "text") {
      const paragraphBlocks = parseParagraphRangeToBlocks(markdown, range.from, range.to);
      if (!paragraphBlocks.length) {
        const paragraphLike = parseParagraphLike(raw);
        pushBlock(blocks, markdown, lineStarts, paragraphLike.type, range.from, range.to, paragraphLike.attrs);
        continue;
      }
      for (const paragraphBlock of paragraphBlocks) {
        pushBlock(
          blocks,
          markdown,
          lineStarts,
          paragraphBlock.type,
          paragraphBlock.from,
          paragraphBlock.to,
          paragraphBlock.attrs || {}
        );
      }
      continue;
    }

    const fallback = parseParagraphLike(raw);
    pushBlock(blocks, markdown, lineStarts, fallback.type, range.from, range.to, fallback.attrs);
  }

  return blocks.sort((left, right) => left.from - right.from || left.to - right.to);
};
