import { findHeadingMatch } from "./heading-slug.js";
import { parseMarkdownToBlocks } from "../editor/parser/parse-blocks.js";

const WIKI_LINK_NON_HEADING_BLOCK_TYPES = new Set([
  "paragraph",
  "bullet_list_item",
  "ordered_list_item",
  "task_list_item",
  "blockquote",
  "code_block",
  "math_block",
  "image",
  "table",
  "html_block"
]);

const BLOCK_REF_TOKEN_PATTERN = /^b-[0-9a-z]{6,}(?:-\d+)?$/i;

const normalizeText = (valueInput = "") =>
  String(valueInput || "")
    .replace(/\s+/g, " ")
    .trim();

const fnv1aHash = (valueInput = "") => {
  let hash = 0x811c9dc5;
  const value = String(valueInput || "");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

const truncatePreview = (valueInput = "", maxLengthInput = 84) => {
  const value = normalizeText(valueInput);
  const maxLength = Math.max(12, Number(maxLengthInput || 0));
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trim()}...`;
};

const scopeRangeForAnchor = (markdownInput = "", headingsInput = [], anchorInput = "") => {
  const markdown = String(markdownInput || "");
  const headings = Array.isArray(headingsInput) ? headingsInput : [];
  const headingMatch = findHeadingMatch(headings, anchorInput);
  if (!headingMatch) {
    return null;
  }

  const currentLevel = Math.max(1, Number(headingMatch.level || 1));
  const nextHeading = headings.find((heading) =>
    Number(heading?.from || 0) > Number(headingMatch.from || 0)
    && Math.max(1, Number(heading?.level || 1)) <= currentLevel
  );

  const from = Math.max(0, Number(headingMatch.to || headingMatch.from || 0));
  const to = nextHeading
    ? Math.max(from, Number(nextHeading.from || markdown.length))
    : markdown.length;

  return { from, to };
};

export const normalizeWikiLinkBlockText = normalizeText;

export const isEncodedWikiLinkBlockRef = (valueInput = "") =>
  BLOCK_REF_TOKEN_PATTERN.test(String(valueInput || "").trim());

export const buildEncodedWikiLinkBlockRef = (textInput = "", occurrenceIndexInput = 0) => {
  const text = normalizeText(textInput);
  if (!text) {
    return "";
  }

  const hash = fnv1aHash(text).toString(36).padStart(6, "0");
  const occurrenceIndex = Math.max(0, Number(occurrenceIndexInput || 0));
  return occurrenceIndex > 0 ? `b-${hash}-${occurrenceIndex + 1}` : `b-${hash}`;
};

export const collectWikiLinkTextBlocks = (markdownInput = "", {
  headings = [],
  anchor = ""
} = {}) => {
  const markdown = String(markdownInput || "");
  if (!markdown) {
    return [];
  }

  const allBlocks = parseMarkdownToBlocks(markdown)
    .filter((block) =>
      WIKI_LINK_NON_HEADING_BLOCK_TYPES.has(String(block?.type || ""))
      && normalizeText(block?.rawText).length > 0
    );

  const occurrenceCounts = new Map();
  const allEntries = allBlocks.map((block) => {
    const normalizedText = normalizeText(block?.rawText);
    const nextOccurrence = (occurrenceCounts.get(normalizedText) || 0) + 1;
    occurrenceCounts.set(normalizedText, nextOccurrence);
    return {
      block,
      refToken: buildEncodedWikiLinkBlockRef(normalizedText, nextOccurrence - 1),
      text: normalizedText,
      previewText: truncatePreview(normalizedText),
      lineStart: Math.max(1, Number(block?.lineStart || 1)),
      lineEnd: Math.max(1, Number(block?.lineEnd || block?.lineStart || 1)),
      type: String(block?.type || "paragraph")
    };
  });

  const normalizedAnchor = String(anchor || "").trim();
  if (!normalizedAnchor) {
    return allEntries;
  }

  const scopeRange = scopeRangeForAnchor(markdown, headings, normalizedAnchor);
  if (!scopeRange) {
    return [];
  }

  return allEntries.filter((entry) => {
    const from = Number(entry?.block?.from || 0);
    return from >= scopeRange.from && from < scopeRange.to;
  });
};

export const findWikiLinkTextBlockByReference = (markdownInput = "", {
  headings = [],
  anchor = "",
  blockRef = ""
} = {}) => {
  const ref = String(blockRef || "").trim();
  if (!ref) {
    return null;
  }

  const entries = collectWikiLinkTextBlocks(markdownInput, { headings, anchor });
  if (!entries.length) {
    return null;
  }

  if (isEncodedWikiLinkBlockRef(ref)) {
    const exact = entries.find((entry) => String(entry.refToken || "").toLowerCase() === ref.toLowerCase());
    return exact?.block || null;
  }

  const normalizedRef = normalizeText(ref).toLowerCase();
  const ranked = entries
    .map((entry) => {
      const text = String(entry.text || "").toLowerCase();
      let score = 0;
      if (text === normalizedRef) {
        score = 3;
      } else if (text.startsWith(normalizedRef)) {
        score = 2;
      } else if (text.includes(normalizedRef)) {
        score = 1;
      }
      return {
        block: entry.block,
        score
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || Number(left.block?.from || 0) - Number(right.block?.from || 0)
    );

  return ranked[0]?.block || null;
};
