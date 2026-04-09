const toSafeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeAttrs = (attrs) => (attrs && typeof attrs === "object" ? attrs : {});

const normalizeChildren = (children) => (Array.isArray(children) ? children : []);

const normalizeEditing = (editing) => {
  const sourceVisible = Boolean(editing?.sourceVisible);
  const widget = Boolean(editing?.widget);
  const previewEditable = Boolean(editing?.previewEditable);
  const sourceEditable = editing?.sourceEditable == null ? true : Boolean(editing.sourceEditable);
  const revealSourceWhenSelected = Boolean(editing?.revealSourceWhenSelected);
  const revealSourceWhenExpanded = Boolean(editing?.revealSourceWhenExpanded);
  const hideSourceLines = Boolean(editing?.hideSourceLines);
  const keyboardNavigable = Boolean(editing?.keyboardNavigable);
  return {
    sourceVisible,
    widget,
    previewEditable,
    sourceEditable,
    revealSourceWhenSelected,
    revealSourceWhenExpanded,
    hideSourceLines,
    keyboardNavigable
  };
};

export const createPreviewNode = ({
  id = "",
  type = "paragraph",
  role = "leaf",
  from = 0,
  to = 0,
  lineStart = 1,
  lineEnd = 1,
  rawText = "",
  attrs = {},
  inlineTokens = [],
  inlineSegments = [],
  source = null,
  editing = {},
  children = []
} = {}) => ({
  id: String(id || `${String(type)}:${toSafeNumber(from)}:${toSafeNumber(to)}`),
  type: String(type || "paragraph"),
  role: String(role || "leaf"),
  from: toSafeNumber(from),
  to: Math.max(toSafeNumber(from), toSafeNumber(to, toSafeNumber(from))),
  lineStart: Math.max(1, toSafeNumber(lineStart, 1)),
  lineEnd: Math.max(1, toSafeNumber(lineEnd, 1)),
  rawText: String(rawText || ""),
  attrs: normalizeAttrs(attrs),
  inlineTokens: Array.isArray(inlineTokens) ? inlineTokens : [],
  inlineSegments: Array.isArray(inlineSegments) ? inlineSegments : [],
  source: source && typeof source === "object" ? source : undefined,
  editing: normalizeEditing(editing),
  children: normalizeChildren(children)
});
