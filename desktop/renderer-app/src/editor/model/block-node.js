import { DEFAULT_BLOCK_TYPE } from "./block-types";

const toSafeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeAttrs = (attrs) => (attrs && typeof attrs === "object" ? attrs : {});

const normalizeChildren = (children) => (Array.isArray(children) ? children : []);

export const createBlockNode = ({
  id,
  type = DEFAULT_BLOCK_TYPE,
  from = 0,
  to = 0,
  lineStart = 1,
  lineEnd = 1,
  rawText = "",
  attrs = {},
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
  children: children == null ? undefined : normalizeChildren(children)
});
