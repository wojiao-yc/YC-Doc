import { createSemanticSnapshot } from "../model/semantic-snapshot";
import { parseMarkdownToBlocks } from "./parse-blocks";
import { buildOutlineFromBlocks } from "../runtime/outline";

export const parseMarkdownToSemanticSnapshot = (markdown) => {
  const blocks = parseMarkdownToBlocks(markdown);
  const outline = buildOutlineFromBlocks(blocks);
  return createSemanticSnapshot({
    blocks,
    outline,
    generatedAt: Date.now()
  });
};
