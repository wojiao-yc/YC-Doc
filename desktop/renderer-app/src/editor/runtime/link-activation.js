import { parseMarkdownToBlocks } from "../parser/parse-blocks.js";
import { resolveWikiLink } from "../../utils/wiki-link.js";

const ACTIVATABLE_LINK_TYPES = new Set(["wikilink", "link"]);

const clampPos = (valueInput, lengthInput) => {
  const length = Math.max(0, Number(lengthInput || 0));
  const value = Number(valueInput);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(length, Math.round(value)));
};

const normalizeSelection = (selectionInput = {}, docLengthInput = 0) => {
  const docLength = Math.max(0, Number(docLengthInput || 0));
  const anchor = clampPos(selectionInput?.anchor, docLength);
  const head = clampPos(selectionInput?.head, docLength);
  const from = Math.min(anchor, head);
  const to = Math.max(anchor, head);
  return {
    anchor,
    head,
    from,
    to,
    empty: from === to
  };
};

const selectionIntersectsRange = (selection, fromInput, toInput) => {
  const from = Number(fromInput || 0);
  const to = Math.max(from, Number(toInput || from));
  if (to <= from) {
    return false;
  }

  if (selection.empty) {
    return selection.head >= from && selection.head <= to;
  }
  return selection.from < to && selection.to > from;
};

const collectActivatableLinkTokens = (tokensInput = [], depth = 0, output = []) => {
  const tokens = Array.isArray(tokensInput) ? tokensInput : [];
  for (const token of tokens) {
    const type = String(token?.type || "");
    if (ACTIVATABLE_LINK_TYPES.has(type)) {
      output.push({
        ...token,
        depth
      });
    }
    if (Array.isArray(token?.children) && token.children.length) {
      collectActivatableLinkTokens(token.children, depth + 1, output);
    }
  }
  return output;
};

const pickActiveLinkToken = (blocksInput = [], selectionInput = {}, docLengthInput = 0) => {
  const blocks = Array.isArray(blocksInput) ? blocksInput : [];
  const selection = normalizeSelection(selectionInput, docLengthInput);
  const candidates = [];

  for (const block of blocks) {
    const tokens = collectActivatableLinkTokens(block?.inlineTokens);
    for (const token of tokens) {
      if (!selectionIntersectsRange(selection, token?.rawFrom, token?.rawTo)) {
        continue;
      }
      candidates.push(token);
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => {
    const leftSpan = Math.max(0, Number(left?.rawTo || 0) - Number(left?.rawFrom || 0));
    const rightSpan = Math.max(0, Number(right?.rawTo || 0) - Number(right?.rawFrom || 0));
    if (leftSpan !== rightSpan) {
      return leftSpan - rightSpan;
    }
    if (Number(left?.depth || 0) !== Number(right?.depth || 0)) {
      return Number(right?.depth || 0) - Number(left?.depth || 0);
    }
    return Number(left?.rawFrom || 0) - Number(right?.rawFrom || 0);
  });

  return candidates[0];
};

export const safeExternalLinkHref = (hrefInput) => {
  const href = String(hrefInput || "").trim();
  if (!href) {
    return "";
  }
  if (/^(https?:|mailto:)/i.test(href)) {
    return href;
  }
  return "";
};

export const resolveEditorLinkActivation = ({
  markdown = "",
  selection = {},
  currentRelPath = "",
  markdownFiles = []
} = {}) => {
  const docText = String(markdown || "");
  if (!docText) {
    return null;
  }

  const blocks = parseMarkdownToBlocks(docText);
  const token = pickActiveLinkToken(blocks, selection, docText.length);
  if (!token) {
    return null;
  }

  if (String(token.type || "") === "wikilink") {
    const parsed = {
      target: String(token?.attrs?.target || ""),
      anchor: String(token?.attrs?.anchor || ""),
      alias: String(token?.attrs?.alias || ""),
      body: String(token?.attrs?.body || "")
    };
    return {
      type: "wiki",
      token,
      match: {
        raw: String(token?.rawText || ""),
        rawFrom: Number(token?.rawFrom || 0),
        rawTo: Number(token?.rawTo || 0),
        parsed
      },
      resolution: resolveWikiLink(parsed, currentRelPath, markdownFiles)
    };
  }

  const href = safeExternalLinkHref(token?.attrs?.href);
  if (!href) {
    return null;
  }

  return {
    type: "external",
    href,
    title: String(token?.attrs?.title || ""),
    text: String(token?.text || ""),
    token
  };
};
