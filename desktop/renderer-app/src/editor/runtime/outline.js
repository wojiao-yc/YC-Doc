import { BLOCK_TYPES } from "../model/block-types";
import { createOutlineNode } from "../model/outline-node";

const headingTextOf = (block) => {
  const text = String(block?.attrs?.text || "").trim();
  if (text) {
    return text;
  }
  return String(block?.rawText || "")
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/[ \t]+#+[ \t]*$/, "")
    .trim();
};

export const buildOutlineFromBlocks = (blocks = []) =>
  blocks
    .filter((block) => block?.type === BLOCK_TYPES.HEADING)
    .map((block) =>
      createOutlineNode({
        id: String(block.id || ""),
        level: Number(block?.attrs?.level || 1),
        text: headingTextOf(block),
        from: Number(block?.from || 0),
        to: Number(block?.to || 0)
      })
    );
