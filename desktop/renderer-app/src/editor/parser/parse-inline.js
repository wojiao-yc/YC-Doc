import { marked } from "marked";
import { BLOCK_TYPES } from "../model/block-types";

const INLINE_BLOCK_TYPES = new Set([
  BLOCK_TYPES.PARAGRAPH,
  BLOCK_TYPES.HEADING,
  BLOCK_TYPES.BULLET_LIST_ITEM,
  BLOCK_TYPES.ORDERED_LIST_ITEM,
  BLOCK_TYPES.TASK_LIST_ITEM,
  BLOCK_TYPES.BLOCKQUOTE
]);

const MARK_TOKEN_TYPES = new Set(["em", "strong", "codespan", "del", "link"]);
const INNER_TEXT_RANGE_TOKEN_TYPES = new Set(["em", "strong", "codespan", "del", "link", "escape"]);
const INLINE_MATH_TOKEN_TYPE = "math_inline";
const INLINE_HIGHLIGHT_TOKEN_TYPE = "mark";
const INLINE_COMMENT_TOKEN_TYPE = "comment";
const INLINE_MATH_EXCLUDED_TOKEN_TYPES = new Set(["codespan"]);
const INLINE_MARK_EXCLUDED_TOKEN_TYPES = new Set(["codespan"]);

const HEADING_PREFIX_PATTERN = /^\s{0,3}#{1,6}[ \t]+/;
const LIST_PREFIX_PATTERN = /^(\s*)(?:[-+*]\s+\[(?: |x|X)\]\s+|[-+*]\s+|\d+[.)]\s+)/;
const BLOCKQUOTE_PREFIX_PATTERN = /^\s{0,3}>\s?/;

const asString = (value) => String(value ?? "");

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const sameMarks = (left = [], right = []) => {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
};

const withMark = (marks, tokenType) => {
  if (!MARK_TOKEN_TYPES.has(tokenType) || marks.includes(tokenType)) {
    return marks;
  }
  return [...marks, tokenType];
};

const tokenTypeOf = (token) => String(token?.type || "text");

const extractTokenAttrs = (tokenType, token) => {
  if (tokenType === "link") {
    return {
      href: asString(token?.href),
      title: token?.title == null ? undefined : asString(token?.title)
    };
  }
  return {};
};

const resolveTokenRange = (source, token, cursorInput = 0) => {
  const cursor = clamp(Number(cursorInput || 0), 0, source.length);
  const raw = asString(token?.raw);
  const text = asString(token?.text);

  if (raw) {
    if (source.startsWith(raw, cursor)) {
      const to = cursor + raw.length;
      return {
        from: cursor,
        to,
        nextCursor: to,
        resolved: true
      };
    }

    const foundRaw = source.indexOf(raw, cursor);
    if (foundRaw >= 0) {
      return {
        from: foundRaw,
        to: foundRaw + raw.length,
        nextCursor: foundRaw + raw.length,
        resolved: true
      };
    }

    if (text) {
      if (source.startsWith(text, cursor)) {
        const to = cursor + text.length;
        return {
          from: cursor,
          to,
          nextCursor: to,
          resolved: false
        };
      }
      const foundText = source.indexOf(text, cursor);
      if (foundText >= 0) {
        return {
          from: foundText,
          to: foundText + text.length,
          nextCursor: foundText + text.length,
          resolved: false
        };
      }
    }

    const fallbackTo = clamp(cursor + Math.max(raw.length, text.length, 1), cursor, source.length);
    return {
      from: cursor,
      to: fallbackTo,
      nextCursor: fallbackTo,
      resolved: false
    };
  }

  if (text) {
    if (source.startsWith(text, cursor)) {
      const to = cursor + text.length;
      return {
        from: cursor,
        to,
        nextCursor: to,
        resolved: true
      };
    }

    const foundText = source.indexOf(text, cursor);
    if (foundText >= 0) {
      return {
        from: foundText,
        to: foundText + text.length,
        nextCursor: foundText + text.length,
        resolved: true
      };
    }
  }

  return {
    from: cursor,
    to: cursor,
    nextCursor: cursor,
    resolved: false
  };
};

const resolveInnerOffsetInRaw = (tokenType, rawText, text) => {
  const raw = asString(rawText);
  if (!raw) {
    return { from: 0, to: 0 };
  }

  if (!INNER_TEXT_RANGE_TOKEN_TYPES.has(tokenType)) {
    return { from: 0, to: raw.length };
  }

  if (tokenType === "link") {
    const openBracket = raw.indexOf("[");
    const closeBracketOpenParen = raw.indexOf("](");
    if (openBracket >= 0 && closeBracketOpenParen > openBracket) {
      return {
        from: openBracket + 1,
        to: closeBracketOpenParen
      };
    }
  }

  const content = asString(text);
  if (!content) {
    return { from: 0, to: raw.length };
  }

  const from = raw.indexOf(content);
  if (from >= 0) {
    return {
      from,
      to: from + content.length
    };
  }

  return { from: 0, to: raw.length };
};

const lexInlineTokens = (text) => {
  const source = asString(text);
  if (!source) {
    return [];
  }

  try {
    if (marked?.Lexer && typeof marked.Lexer.lexInline === "function") {
      const tokens = marked.Lexer.lexInline(source, { gfm: true });
      if (Array.isArray(tokens)) {
        return tokens;
      }
    }
  } catch {
    // fall through
  }

  try {
    const blockTokens = marked.lexer(source, { gfm: true });
    for (const token of blockTokens) {
      if (Array.isArray(token?.tokens) && token.tokens.length) {
        return token.tokens;
      }
    }
  } catch {
    // fall through
  }

  return [{ type: "text", raw: source, text: source }];
};

const normalizeTokenRawRange = (token) => {
  const rawFrom = Number(token?.rawFrom);
  const rawTo = Number(token?.rawTo);
  if (!Number.isFinite(rawFrom) || !Number.isFinite(rawTo) || rawTo <= rawFrom) {
    return null;
  }
  return {
    from: rawFrom,
    to: rawTo
  };
};

const collectTokenRangesByType = (tokens, types = new Set(), output = []) => {
  for (const token of Array.isArray(tokens) ? tokens : []) {
    const tokenType = asString(token?.type);
    const range = normalizeTokenRawRange(token);
    if (range && types.has(tokenType)) {
      output.push(range);
    }

    if (Array.isArray(token?.children) && token.children.length) {
      collectTokenRangesByType(token.children, types, output);
    }
  }
  return output;
};

const rangeIntersects = (leftFrom, leftTo, rightFrom, rightTo) => leftFrom < rightTo && leftTo > rightFrom;

const rangeIntersectsAny = (from, to, ranges = []) =>
  ranges.some((range) => rangeIntersects(from, to, Number(range?.from || 0), Number(range?.to || 0)));

const offsetInAnyRange = (offset, ranges = []) =>
  ranges.some((range) => offset >= Number(range?.from || 0) && offset < Number(range?.to || 0));

const isEscapedAt = (source, indexInput) => {
  const index = Number(indexInput || 0);
  if (index <= 0) {
    return false;
  }

  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (source[cursor] !== "\\") {
      break;
    }
    slashCount += 1;
  }
  return slashCount % 2 === 1;
};

const isSingleDollarDelimiterAt = (source, indexInput) => {
  const index = Number(indexInput || 0);
  if (index < 0 || index >= source.length) {
    return false;
  }
  if (source[index] !== "$") {
    return false;
  }
  if (isEscapedAt(source, index)) {
    return false;
  }
  if (source[index - 1] === "$" || source[index + 1] === "$") {
    return false;
  }
  return true;
};

const buildInlineMathTokens = ({
  source,
  baseFrom,
  line,
  lineFrom,
  state,
  excludedRanges = []
}) => {
  const tokens = [];
  if (!source || !source.includes("$")) {
    return tokens;
  }

  const safeBaseFrom = Number(baseFrom || 0);
  const safeLine = Math.max(1, Number(line || 1));
  const safeLineFrom = Number(lineFrom || 0);
  let cursor = 0;

  while (cursor < source.length) {
    if (!isSingleDollarDelimiterAt(source, cursor)) {
      cursor += 1;
      continue;
    }

    const openOffset = cursor;
    const openPos = safeBaseFrom + openOffset;
    if (offsetInAnyRange(openPos, excludedRanges)) {
      cursor += 1;
      continue;
    }

    let closeOffset = -1;
    for (let next = openOffset + 1; next < source.length; next += 1) {
      if (!isSingleDollarDelimiterAt(source, next)) {
        continue;
      }
      const closePos = safeBaseFrom + next;
      if (offsetInAnyRange(closePos, excludedRanges)) {
        continue;
      }

      const candidateTo = closePos + 1;
      if (rangeIntersectsAny(openPos, candidateTo, excludedRanges)) {
        continue;
      }

      closeOffset = next;
      break;
    }

    if (closeOffset < 0) {
      cursor += 1;
      continue;
    }

    const rawFrom = openPos;
    const rawTo = safeBaseFrom + closeOffset + 1;
    const textFrom = rawFrom + 1;
    const textTo = Math.max(textFrom, rawTo - 1);
    const formula = source.slice(openOffset + 1, closeOffset);
    if (!formula.trim() || formula.startsWith(" ") || formula.endsWith(" ")) {
      cursor = closeOffset + 1;
      continue;
    }

    tokens.push({
      id: `it_${state.nextTokenId}`,
      type: INLINE_MATH_TOKEN_TYPE,
      marks: [],
      rawFrom,
      rawTo,
      textFrom,
      textTo,
      line: safeLine,
      columnRawFrom: Math.max(0, rawFrom - safeLineFrom),
      columnRawTo: Math.max(0, rawTo - safeLineFrom),
      columnTextFrom: Math.max(0, textFrom - safeLineFrom),
      columnTextTo: Math.max(0, textTo - safeLineFrom),
      rawText: source.slice(openOffset, closeOffset + 1),
      text: formula,
      attrs: {
        formula,
        displayMode: false
      },
      rangeResolved: true,
      children: []
    });
    state.nextTokenId += 1;
    cursor = closeOffset + 1;
  }

  return tokens;
};

const isDelimiterAt = (source, indexInput, delimiter) => {
  const index = Number(indexInput || 0);
  const delim = String(delimiter || "");
  if (!delim) {
    return false;
  }
  if (index < 0 || index + delim.length > source.length) {
    return false;
  }
  if (source.slice(index, index + delim.length) !== delim) {
    return false;
  }
  return !isEscapedAt(source, index);
};

const buildDelimitedInlineTokens = ({
  source,
  baseFrom,
  line,
  lineFrom,
  state,
  delimiter,
  tokenType,
  excludedRanges = []
}) => {
  const tokens = [];
  const delim = String(delimiter || "");
  const type = String(tokenType || "");
  if (!source || !delim || !type) {
    return tokens;
  }
  if (!source.includes(delim)) {
    return tokens;
  }

  const safeBaseFrom = Number(baseFrom || 0);
  const safeLine = Math.max(1, Number(line || 1));
  const safeLineFrom = Number(lineFrom || 0);
  const delimLength = delim.length;
  let cursor = 0;

  while (cursor <= source.length - delimLength) {
    if (!isDelimiterAt(source, cursor, delim)) {
      cursor += 1;
      continue;
    }

    const openOffset = cursor;
    const openPos = safeBaseFrom + openOffset;
    const openTo = openPos + delimLength;
    if (offsetInAnyRange(openPos, excludedRanges) || rangeIntersectsAny(openPos, openTo, excludedRanges)) {
      cursor += 1;
      continue;
    }

    let closeOffset = -1;
    for (let next = openOffset + delimLength; next <= source.length - delimLength; next += 1) {
      if (!isDelimiterAt(source, next, delim)) {
        continue;
      }

      const closePos = safeBaseFrom + next;
      const candidateTo = closePos + delimLength;
      if (offsetInAnyRange(closePos, excludedRanges) || rangeIntersectsAny(openPos, candidateTo, excludedRanges)) {
        continue;
      }

      closeOffset = next;
      break;
    }

    if (closeOffset < 0) {
      cursor += 1;
      continue;
    }

    const rawFrom = openPos;
    const rawTo = safeBaseFrom + closeOffset + delimLength;
    const textFrom = rawFrom + delimLength;
    const textTo = Math.max(textFrom, rawTo - delimLength);
    const innerText = source.slice(openOffset + delimLength, closeOffset);
    if (!innerText) {
      cursor = closeOffset + delimLength;
      continue;
    }

    tokens.push({
      id: `it_${state.nextTokenId}`,
      type,
      marks: [],
      rawFrom,
      rawTo,
      textFrom,
      textTo,
      line: safeLine,
      columnRawFrom: Math.max(0, rawFrom - safeLineFrom),
      columnRawTo: Math.max(0, rawTo - safeLineFrom),
      columnTextFrom: Math.max(0, textFrom - safeLineFrom),
      columnTextTo: Math.max(0, textTo - safeLineFrom),
      rawText: source.slice(openOffset, closeOffset + delimLength),
      text: innerText,
      attrs: {},
      rangeResolved: true,
      children: []
    });
    state.nextTokenId += 1;
    cursor = closeOffset + delimLength;
  }

  return tokens;
};

const collectTokenNodes = ({
  source,
  tokens,
  baseFrom,
  line,
  lineFrom,
  marks,
  state
}) => {
  const nodes = [];
  let cursor = 0;

  for (const token of tokens) {
    const tokenType = tokenTypeOf(token);
    const range = resolveTokenRange(source, token, cursor);
    cursor = Math.max(cursor, range.nextCursor);
    if (range.to <= range.from) {
      continue;
    }

    const rawFrom = baseFrom + range.from;
    const rawTo = baseFrom + range.to;
    const rawText = source.slice(range.from, range.to);
    const nextMarks = withMark(marks, tokenType);
    const nestedTokens = Array.isArray(token?.tokens) ? token.tokens : [];
    const children = nestedTokens.length
      ? collectTokenNodes({
          source: rawText,
          tokens: nestedTokens,
          baseFrom: rawFrom,
          line,
          lineFrom,
          marks: nextMarks,
          state
        })
      : [];

    let textFrom = rawFrom;
    let textTo = rawTo;
    let text = asString(token?.text);

    if (children.length) {
      textFrom = children[0].textFrom;
      textTo = children[children.length - 1].textTo;
      text = children.map((child) => child.text).join("");
    } else {
      const innerOffset = resolveInnerOffsetInRaw(tokenType, rawText, token?.text);
      textFrom = clamp(rawFrom + innerOffset.from, rawFrom, rawTo);
      textTo = clamp(rawFrom + innerOffset.to, textFrom, rawTo);
      if (!text) {
        text = rawText.slice(textFrom - rawFrom, textTo - rawFrom);
      }
    }

    const node = {
      id: `it_${state.nextTokenId}`,
      type: tokenType,
      marks: [...nextMarks],
      rawFrom,
      rawTo,
      textFrom,
      textTo,
      line,
      columnRawFrom: Math.max(0, rawFrom - lineFrom),
      columnRawTo: Math.max(0, rawTo - lineFrom),
      columnTextFrom: Math.max(0, textFrom - lineFrom),
      columnTextTo: Math.max(0, textTo - lineFrom),
      rawText,
      text,
      attrs: extractTokenAttrs(tokenType, token),
      rangeResolved: Boolean(range.resolved),
      children
    };

    state.nextTokenId += 1;
    nodes.push(node);
  }

  return nodes;
};

const appendSegment = (segments, segment) => {
  if (!segment || segment.to <= segment.from) {
    return;
  }

  const previous = segments[segments.length - 1];
  if (
    previous &&
    previous.line === segment.line &&
    previous.to === segment.from &&
    previous.type === segment.type &&
    sameMarks(previous.marks, segment.marks) &&
    previous.outerTo === segment.outerFrom
  ) {
    previous.to = segment.to;
    previous.innerTo = segment.innerTo;
    previous.outerTo = segment.outerTo;
    previous.columnTo = segment.columnTo;
    previous.text += segment.text;
    return;
  }

  segments.push(segment);
};

const flattenTokenNodesToSegments = ({
  nodes,
  lineFrom,
  markScope = {},
  segments = []
}) => {
  for (const node of nodes) {
    const nextScope = { ...markScope };
    if (MARK_TOKEN_TYPES.has(node.type)) {
      nextScope[node.type] = node;
    }

    if (Array.isArray(node.children) && node.children.length) {
      flattenTokenNodesToSegments({
        nodes: node.children,
        lineFrom,
        markScope: nextScope,
        segments
      });
      continue;
    }

    if (node.textTo <= node.textFrom) {
      continue;
    }

    const deepestMark = node.marks.length ? nextScope[node.marks[node.marks.length - 1]] : null;
    const outerFrom = deepestMark ? deepestMark.rawFrom : node.rawFrom;
    const outerTo = deepestMark ? deepestMark.rawTo : node.rawTo;

    appendSegment(segments, {
      type: node.type,
      marks: [...node.marks],
      from: node.textFrom,
      to: node.textTo,
      innerFrom: node.textFrom,
      innerTo: node.textTo,
      outerFrom,
      outerTo,
      line: node.line,
      columnFrom: Math.max(0, node.textFrom - lineFrom),
      columnTo: Math.max(0, node.textTo - lineFrom),
      text: node.text
    });
  }

  return segments;
};

const fallbackLineModel = ({ source, from, line, lineFrom, state }) => {
  const rawFrom = Number(from || 0);
  const rawTo = rawFrom + source.length;
  const token = {
    id: `it_${state.nextTokenId}`,
    type: "text",
    marks: [],
    rawFrom,
    rawTo,
    textFrom: rawFrom,
    textTo: rawTo,
    line,
    columnRawFrom: Math.max(0, rawFrom - lineFrom),
    columnRawTo: Math.max(0, rawTo - lineFrom),
    columnTextFrom: Math.max(0, rawFrom - lineFrom),
    columnTextTo: Math.max(0, rawTo - lineFrom),
    rawText: source,
    text: source,
    attrs: {},
    rangeResolved: true,
    children: []
  };
  state.nextTokenId += 1;

  return {
    inlineTokens: [token],
    inlineSegments: [
      {
        type: "text",
        marks: [],
        from: rawFrom,
        to: rawTo,
        innerFrom: rawFrom,
        innerTo: rawTo,
        outerFrom: rawFrom,
        outerTo: rawTo,
        line,
        columnFrom: Math.max(0, rawFrom - lineFrom),
        columnTo: Math.max(0, rawTo - lineFrom),
        text: source
      }
    ]
  };
};

const parseInlineModelFromLine = ({ lineText, from, line, lineFrom, state }) => {
  const source = asString(lineText);
  const safeFrom = Number(from || 0);
  const safeLine = Math.max(1, Number(line || 1));
  const safeLineFrom = Number(lineFrom || 0);
  if (!source) {
    return {
      inlineTokens: [],
      inlineSegments: []
    };
  }

  const tokens = lexInlineTokens(source);
  const inlineTokens = collectTokenNodes({
    source,
    tokens,
    baseFrom: safeFrom,
    line: safeLine,
    lineFrom: safeLineFrom,
    marks: [],
    state
  });
  const inlineSegments = flattenTokenNodesToSegments({
    nodes: inlineTokens,
    lineFrom: safeLineFrom
  });

  const addInlineMathTokens = (tokensInput) => {
    const tokensList = Array.isArray(tokensInput) ? tokensInput : [];
    const excludedRanges = collectTokenRangesByType(tokensList, INLINE_MATH_EXCLUDED_TOKEN_TYPES);
    const mathTokens = buildInlineMathTokens({
      source,
      baseFrom: safeFrom,
      line: safeLine,
      lineFrom: safeLineFrom,
      state,
      excludedRanges
    });
    if (!mathTokens.length) {
      return tokensList;
    }
    return [...tokensList, ...mathTokens].sort((left, right) => {
      if (left.rawFrom !== right.rawFrom) {
        return left.rawFrom - right.rawFrom;
      }
      return left.rawTo - right.rawTo;
    });
  };

  const addInlineMarkTokens = (tokensInput) => {
    const tokensList = Array.isArray(tokensInput) ? tokensInput : [];
    const excludedRanges = collectTokenRangesByType(tokensList, INLINE_MARK_EXCLUDED_TOKEN_TYPES);
    const highlightTokens = buildDelimitedInlineTokens({
      source,
      baseFrom: safeFrom,
      line: safeLine,
      lineFrom: safeLineFrom,
      state,
      delimiter: "==",
      tokenType: INLINE_HIGHLIGHT_TOKEN_TYPE,
      excludedRanges
    });
    const commentTokens = buildDelimitedInlineTokens({
      source,
      baseFrom: safeFrom,
      line: safeLine,
      lineFrom: safeLineFrom,
      state,
      delimiter: "%%",
      tokenType: INLINE_COMMENT_TOKEN_TYPE,
      excludedRanges
    });
    if (!highlightTokens.length && !commentTokens.length) {
      return tokensList;
    }
    return [...tokensList, ...highlightTokens, ...commentTokens].sort((left, right) => {
      if (left.rawFrom !== right.rawFrom) {
        return left.rawFrom - right.rawFrom;
      }
      return left.rawTo - right.rawTo;
    });
  };

  if (inlineTokens.length && inlineSegments.length) {
    const withMarkTokens = addInlineMarkTokens(inlineTokens);
    return {
      inlineTokens: addInlineMathTokens(withMarkTokens),
      inlineSegments
    };
  }

  const fallback = fallbackLineModel({
    source,
    from: safeFrom,
    line: safeLine,
    lineFrom: safeLineFrom,
    state
  });
  fallback.inlineTokens = addInlineMathTokens(addInlineMarkTokens(fallback.inlineTokens));
  return fallback;
};

const contentStartOffsetForLine = (blockType, lineText, lineIndex) => {
  const line = asString(lineText);
  if (!line) {
    return 0;
  }

  if (blockType === BLOCK_TYPES.HEADING && lineIndex === 0) {
    const match = line.match(HEADING_PREFIX_PATTERN);
    return match ? match[0].length : 0;
  }

  if (
    (blockType === BLOCK_TYPES.BULLET_LIST_ITEM ||
      blockType === BLOCK_TYPES.ORDERED_LIST_ITEM ||
      blockType === BLOCK_TYPES.TASK_LIST_ITEM) &&
    lineIndex === 0
  ) {
    const match = line.match(LIST_PREFIX_PATTERN);
    return match ? match[0].length : 0;
  }

  if (blockType === BLOCK_TYPES.BLOCKQUOTE) {
    const match = line.match(BLOCKQUOTE_PREFIX_PATTERN);
    return match ? match[0].length : 0;
  }

  return 0;
};

export const buildInlineModelForBlock = ({
  blockType,
  rawText,
  from = 0,
  lineStart = 1
}) => {
  const type = String(blockType || "");
  if (!INLINE_BLOCK_TYPES.has(type)) {
    return {
      inlineTokens: [],
      inlineSegments: []
    };
  }

  const raw = asString(rawText);
  if (!raw) {
    return {
      inlineTokens: [],
      inlineSegments: []
    };
  }

  const lines = raw.split("\n");
  const inlineTokens = [];
  const inlineSegments = [];
  const state = {
    nextTokenId: 0
  };
  let offset = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index];
    const lineFrom = Number(from || 0) + offset;
    const lineNumber = Math.max(1, Number(lineStart || 1) + index);
    const contentOffset = clamp(contentStartOffsetForLine(type, lineText, index), 0, lineText.length);
    const content = lineText.slice(contentOffset);
    const contentFrom = lineFrom + contentOffset;

    if (content) {
      const model = parseInlineModelFromLine({
        lineText: content,
        from: contentFrom,
        line: lineNumber,
        lineFrom,
        state
      });
      inlineTokens.push(...model.inlineTokens);
      inlineSegments.push(...model.inlineSegments);
    }

    if (index < lines.length - 1) {
      offset += lineText.length + 1;
    } else {
      offset += lineText.length;
    }
  }

  return {
    inlineTokens,
    inlineSegments
  };
};
