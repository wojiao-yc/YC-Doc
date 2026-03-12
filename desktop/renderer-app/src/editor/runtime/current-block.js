import { findBlockContextByPos } from "./block-index";

const normalizePos = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const selectionPosByStrategy = (selection, strategy = "anchor") => {
  const anchor = normalizePos(selection?.anchor);
  const head = normalizePos(selection?.head);

  if (strategy === "head") {
    return head;
  }
  if (strategy === "middle") {
    return Math.floor((anchor + head) / 2);
  }
  return anchor;
};

export const findCurrentBlock = (blocks = [], pos = 0) => {
  const context = findBlockContextByPos(blocks, pos);
  const index = context.index;
  const block = index >= 0 ? blocks[index] : null;
  const prevIndex = index >= 0 ? index - 1 : context.prevIndex;
  const nextIndex = index >= 0 ? index + 1 : context.nextIndex;

  return {
    pos: normalizePos(pos),
    index,
    block,
    prevBlock: prevIndex >= 0 ? blocks[prevIndex] : null,
    nextBlock: nextIndex >= 0 ? blocks[nextIndex] : null,
    inBlock: index >= 0,
    isMultiLine: Number(block?.lineEnd || 0) > Number(block?.lineStart || 0)
  };
};

export const findCurrentBlockFromSelection = (blocks = [], selection = {}, strategy = "anchor") =>
  findCurrentBlock(blocks, selectionPosByStrategy(selection, strategy));
