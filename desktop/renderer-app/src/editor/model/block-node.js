import { DEFAULT_BLOCK_TYPE } from "./block-types";

const toSafeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeAttrs = (attrs) => (attrs && typeof attrs === "object" ? attrs : {});

const normalizeChildren = (children) => (Array.isArray(children) ? children : []);

const normalizeInlineMarks = (marks) =>
  Array.isArray(marks) ? marks.map((mark) => String(mark || "")).filter(Boolean) : [];

const normalizeInlineToken = (token) => {
  const rawFrom = toSafeNumber(token?.rawFrom);
  const rawTo = Math.max(rawFrom, toSafeNumber(token?.rawTo, rawFrom));
  const textFrom = Math.max(rawFrom, toSafeNumber(token?.textFrom, rawFrom));
  const textTo = Math.max(textFrom, toSafeNumber(token?.textTo, textFrom));
  const line = Math.max(1, toSafeNumber(token?.line, 1));
  const columnRawFrom = Math.max(0, toSafeNumber(token?.columnRawFrom, 0));
  const columnRawTo = Math.max(columnRawFrom, toSafeNumber(token?.columnRawTo, columnRawFrom));
  const columnTextFrom = Math.max(0, toSafeNumber(token?.columnTextFrom, 0));
  const columnTextTo = Math.max(columnTextFrom, toSafeNumber(token?.columnTextTo, columnTextFrom));
  const children = Array.isArray(token?.children)
    ? token.children
        .filter((child) => child && typeof child === "object")
        .map((child) => normalizeInlineToken(child))
    : [];

  return {
    id: String(token?.id || ""),
    type: String(token?.type || "text"),
    marks: normalizeInlineMarks(token?.marks),
    rawFrom,
    rawTo,
    textFrom,
    textTo,
    line,
    columnRawFrom,
    columnRawTo,
    columnTextFrom,
    columnTextTo,
    rawText: String(token?.rawText || ""),
    text: String(token?.text || ""),
    attrs: normalizeAttrs(token?.attrs),
    rangeResolved: Boolean(token?.rangeResolved),
    children
  };
};

const normalizeInlineTokens = (tokens) =>
  Array.isArray(tokens)
    ? tokens
        .filter((token) => token && typeof token === "object")
        .map((token) => normalizeInlineToken(token))
    : [];

const normalizeInlineSegments = (segments) =>
  Array.isArray(segments)
    ? segments
        .filter((segment) => segment && typeof segment === "object")
        .map((segment) => {
          const from = toSafeNumber(segment.from);
          const to = Math.max(from, toSafeNumber(segment.to, from));
          const innerFrom = Math.max(from, toSafeNumber(segment.innerFrom, from));
          const innerTo = Math.max(innerFrom, toSafeNumber(segment.innerTo, innerFrom));
          const outerFrom = Math.max(0, toSafeNumber(segment.outerFrom, from));
          const outerTo = Math.max(outerFrom, toSafeNumber(segment.outerTo, Math.max(outerFrom, to)));
          const line = Math.max(1, toSafeNumber(segment.line, 1));
          const columnFrom = Math.max(0, toSafeNumber(segment.columnFrom, 0));
          const columnTo = Math.max(columnFrom, toSafeNumber(segment.columnTo, columnFrom));
          return {
            type: String(segment.type || "text"),
            marks: normalizeInlineMarks(segment.marks),
            from,
            to,
            innerFrom,
            innerTo,
            outerFrom,
            outerTo,
            line,
            columnFrom,
            columnTo,
            text: String(segment.text || "")
          };
        })
        .filter((segment) => segment.to > segment.from)
    : [];

export const createBlockNode = ({
  id,
  type = DEFAULT_BLOCK_TYPE,
  from = 0,
  to = 0,
  lineStart = 1,
  lineEnd = 1,
  rawText = "",
  attrs = {},
  inlineTokens = [],
  inlineSegments = [],
  children = null
} = {}) => ({
  id: String(id || `${String(type)}:${toSafeNumber(from)}:${toSafeNumber(to)}`),
  type: String(type || DEFAULT_BLOCK_TYPE),
  from: toSafeNumber(from),
  to: toSafeNumber(to),
  lineStart: Math.max(1, toSafeNumber(lineStart, 1)),
  lineEnd: Math.max(1, toSafeNumber(lineEnd, 1)),
  rawText: String(rawText || ""),
  attrs: normalizeAttrs(attrs),
  inlineTokens: normalizeInlineTokens(inlineTokens),
  inlineSegments: normalizeInlineSegments(inlineSegments),
  children: children == null ? undefined : normalizeChildren(children)
});
