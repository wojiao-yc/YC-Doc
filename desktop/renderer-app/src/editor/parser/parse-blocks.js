import { marked } from "marked";
import { createBlockNode } from "../model/block-node";
import { BLOCK_TYPES } from "../model/block-types";
import { parseImageLine } from "./parse-image";
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

const orderedMarkerFromLine = (lineText) => {
  const match = String(lineText || "").match(/^(\s*)\d+([.)])\s+/);
  return match ? match[2] : ".";
};

const bulletMarkerFromLine = (lineText) => {
  const match = String(lineText || "").match(/^(\s*)([-+*])\s+/);
  return match ? match[2] : "-";
};

const firstLineOf = (raw) => String(raw || "").split("\n")[0] || "";

const listItemAttrs = (item, listToken, itemIndex, itemRaw) => {
  const firstLine = firstLineOf(itemRaw);
  const parsed = parseListLine(firstLine);
  if (parsed) {
    return {
      type: parsed.type,
      attrs: parsed.attrs || {}
    };
  }

  const indent = countIndent(firstLine);
  const text = String(item?.text || "").trim();

  if (item?.task) {
    return {
      type: BLOCK_TYPES.TASK_LIST_ITEM,
      attrs: {
        indent,
        marker: bulletMarkerFromLine(firstLine),
        checked: Boolean(item.checked),
        text
      }
    };
  }

  if (listToken?.ordered) {
    const start = Number(listToken.start || 1);
    return {
      type: BLOCK_TYPES.ORDERED_LIST_ITEM,
      attrs: {
        indent,
        index: start + itemIndex,
        marker: orderedMarkerFromLine(firstLine),
        text
      }
    };
  }

  return {
    type: BLOCK_TYPES.BULLET_LIST_ITEM,
    attrs: {
      indent,
      marker: bulletMarkerFromLine(firstLine),
      text
    }
  };
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

const toListItems = (token) => (Array.isArray(token?.items) ? token.items : []);

const pushBlock = (blocks, markdown, lineStarts, type, from, to, attrs = {}) => {
  if (to <= from) {
    return;
  }
  const range = toLineRange(markdown, lineStarts, from, to);
  blocks.push(
    createBlockNode({
      id: makeBlockId(type, from, to),
      type,
      from,
      to,
      lineStart: range.lineStart,
      lineEnd: range.lineEnd,
      rawText: markdown.slice(from, to),
      attrs
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
      let itemCursor = listRange.from;
      const items = toListItems(token);
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const itemRaw = String(item?.raw || "");
        const itemRange = findRawRange(markdown, itemRaw, itemCursor, listRange.to);
        itemCursor = itemRange.nextCursor;
        const itemInfo = listItemAttrs(item, token, index, itemRaw);
        pushBlock(blocks, markdown, lineStarts, itemInfo.type, itemRange.from, itemRange.to, itemInfo.attrs);
      }
      continue;
    }

    const range = findRawRange(markdown, raw || token.text || "", cursor);
    cursor = range.nextCursor;

    if (type === "heading") {
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.HEADING, range.from, range.to, {
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
      pushBlock(blocks, markdown, lineStarts, BLOCK_TYPES.THEMATIC_BREAK, range.from, range.to, {});
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
