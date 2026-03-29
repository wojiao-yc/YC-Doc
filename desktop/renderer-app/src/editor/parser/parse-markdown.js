import { createSemanticSnapshot } from "../model/semantic-snapshot.js";
import { parseMarkdownToBlocks } from "./parse-blocks.js";
import { buildOutlineFromBlocks } from "../runtime/outline.js";

let cachedMarkdown = null;
let cachedSnapshot = null;

export const parseMarkdownToSemanticSnapshot = (markdown) => {
  const normalizedMarkdown = String(markdown || "").replace(/\r\n/g, "\n");
  if (cachedSnapshot && cachedMarkdown === normalizedMarkdown) {
    return cachedSnapshot;
  }

  const blocks = parseMarkdownToBlocks(normalizedMarkdown);
  const outline = buildOutlineFromBlocks(blocks);
  const snapshot = createSemanticSnapshot({
    blocks,
    outline,
    generatedAt: Date.now()
  });

  cachedMarkdown = normalizedMarkdown;
  cachedSnapshot = snapshot;
  return snapshot;
};
