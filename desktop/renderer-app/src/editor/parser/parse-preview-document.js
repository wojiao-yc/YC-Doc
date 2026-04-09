import { createPreviewDocument } from "../model/preview-document.js";
import { createPreviewNode } from "../model/preview-node.js";
import { BLOCK_TYPES } from "../model/block-types.js";
import { parseMarkdownToBlocks } from "./parse-blocks.js";
import { parseSpecialBlocksFromMarkdown } from "./parse-special-blocks.js";
import { buildOutlineFromBlocks } from "../runtime/outline.js";

const normalizeMarkdown = (markdownInput = "") => String(markdownInput || "").replace(/\r\n/g, "\n");
let cachedMarkdown = null;
let cachedPreviewDocument = null;

const PREVIEW_NODE_ROLE_MAP = Object.freeze({
  [BLOCK_TYPES.PARAGRAPH]: "paragraph",
  [BLOCK_TYPES.HEADING]: "heading",
  [BLOCK_TYPES.BULLET_LIST_ITEM]: "list_item",
  [BLOCK_TYPES.ORDERED_LIST_ITEM]: "list_item",
  [BLOCK_TYPES.TASK_LIST_ITEM]: "list_item",
  [BLOCK_TYPES.BLOCKQUOTE]: "blockquote",
  [BLOCK_TYPES.CODE_BLOCK]: "container",
  [BLOCK_TYPES.IMAGE]: "figure",
  [BLOCK_TYPES.MATH_BLOCK]: "figure",
  [BLOCK_TYPES.THEMATIC_BREAK]: "divider",
  [BLOCK_TYPES.TABLE]: "figure",
  [BLOCK_TYPES.HTML_BLOCK]: "container"
});

const roleOfBlock = (block) => PREVIEW_NODE_ROLE_MAP[String(block?.type || "")] || "paragraph";

const editingOfBlock = (block, specialBlock = null) => {
  const type = String(block?.type || "");
  if (type === BLOCK_TYPES.IMAGE) {
    return {
      widget: true,
      sourceVisible: false,
      previewEditable: false,
      sourceEditable: true,
      revealSourceWhenExpanded: true,
      hideSourceLines: true,
      keyboardNavigable: true
    };
  }
  if (type === BLOCK_TYPES.MATH_BLOCK) {
    return {
      widget: true,
      sourceVisible: false,
      previewEditable: false,
      sourceEditable: true,
      revealSourceWhenExpanded: true,
      hideSourceLines: true,
      keyboardNavigable: true
    };
  }
  if (type === BLOCK_TYPES.TABLE) {
    return {
      widget: true,
      sourceVisible: false,
      previewEditable: true,
      sourceEditable: true,
      hideSourceLines: true,
      keyboardNavigable: true
    };
  }
  if (type === BLOCK_TYPES.CODE_BLOCK) {
    return {
      widget: true,
      sourceVisible: true,
      previewEditable: false,
      sourceEditable: true
    };
  }
  if (type === BLOCK_TYPES.HTML_BLOCK) {
    return {
      widget: false,
      sourceVisible: true,
      previewEditable: false,
      sourceEditable: true
    };
  }
  if (specialBlock) {
    return {
      widget: true,
      sourceVisible: false,
      previewEditable: false,
      sourceEditable: true,
      hideSourceLines: true
    };
  }
  if (
    type === BLOCK_TYPES.HEADING
    || type === BLOCK_TYPES.BULLET_LIST_ITEM
    || type === BLOCK_TYPES.ORDERED_LIST_ITEM
    || type === BLOCK_TYPES.TASK_LIST_ITEM
    || type === BLOCK_TYPES.BLOCKQUOTE
    || type === BLOCK_TYPES.THEMATIC_BREAK
  ) {
    return {
      widget: false,
      sourceVisible: false,
      previewEditable: false,
      sourceEditable: true,
      revealSourceWhenSelected: true
    };
  }
  return {
    widget: false,
    sourceVisible: false,
    previewEditable: false,
    sourceEditable: true
  };
};

const buildSpecialBlockIndex = (specialBlocks = []) => {
  const byTypeAndFrom = new Map();

  for (const block of Array.isArray(specialBlocks) ? specialBlocks : []) {
    const type = String(block?.type || "");
    const from = Math.max(0, Number(block?.from || 0));
    byTypeAndFrom.set(`${type}:${from}`, block);
  }

  return {
    byTypeAndFrom
  };
};

const resolveSpecialBlockForSemanticBlock = (block, specialIndex) => {
  const type = String(block?.type || "");
  const from = Math.max(0, Number(block?.from || 0));
  return specialIndex?.byTypeAndFrom?.get?.(`${type}:${from}`) || null;
};

const createPreviewNodeFromBlock = (block, specialBlock = null) =>
  createPreviewNode({
    id: String(block?.id || specialBlock?.id || ""),
    type: String(block?.type || "paragraph"),
    role: roleOfBlock(block),
    from: Number(block?.from || specialBlock?.from || 0),
    to: Number(block?.to || specialBlock?.to || 0),
    lineStart: Number(block?.lineStart || specialBlock?.lineStart || 1),
    lineEnd: Number(block?.lineEnd || specialBlock?.lineEnd || 1),
    rawText: String(block?.rawText || specialBlock?.rawText || ""),
    attrs: {
      ...(block?.attrs || {}),
      ...(specialBlock?.attrs || {})
    },
    inlineTokens: Array.isArray(block?.inlineTokens) ? block.inlineTokens : [],
    inlineSegments: Array.isArray(block?.inlineSegments) ? block.inlineSegments : [],
    source: specialBlock?.source || undefined,
    editing: editingOfBlock(block, specialBlock)
  });

export const parseMarkdownToPreviewDocument = (markdownInput = "") => {
  const markdown = normalizeMarkdown(markdownInput);
  if (cachedPreviewDocument && cachedMarkdown === markdown) {
    return cachedPreviewDocument;
  }

  const blocks = parseMarkdownToBlocks(markdown);
  const specialBlocks = parseSpecialBlocksFromMarkdown(markdown);
  const specialIndex = buildSpecialBlockIndex(specialBlocks);
  const outline = buildOutlineFromBlocks(blocks);
  const nodes = blocks.map((block) =>
    createPreviewNodeFromBlock(block, resolveSpecialBlockForSemanticBlock(block, specialIndex))
  );

  const previewDocument = createPreviewDocument({
    markdown,
    nodes,
    blocks,
    outline,
    specialBlocks,
    generatedAt: Date.now()
  });

  cachedMarkdown = markdown;
  cachedPreviewDocument = previewDocument;
  return previewDocument;
};
