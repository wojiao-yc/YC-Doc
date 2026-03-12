import { BLOCK_TYPES } from "../model/block-types";

const TASK_PATTERN = /^(\s*)([-+*])\s+\[( |x|X)\]\s+(.*)$/;
const BULLET_PATTERN = /^(\s*)([-+*])\s+(.*)$/;
const ORDERED_PATTERN = /^(\s*)(\d+)([.)])\s+(.*)$/;

const countIndent = (rawIndent) => {
  let count = 0;
  for (const char of String(rawIndent || "")) {
    count += char === "\t" ? 2 : 1;
  }
  return count;
};

const toListLevel = (indent) => Math.max(1, Math.min(6, Math.floor(Number(indent || 0) / 2) + 1));

export const parseListLine = (lineText) => {
  const line = String(lineText || "");

  const taskMatch = line.match(TASK_PATTERN);
  if (taskMatch) {
    const indent = countIndent(taskMatch[1]);
    return {
      type: BLOCK_TYPES.TASK_LIST_ITEM,
      attrs: {
        indent,
        level: toListLevel(indent),
        marker: taskMatch[2],
        checked: taskMatch[3].toLowerCase() === "x",
        text: taskMatch[4]
      }
    };
  }

  const orderedMatch = line.match(ORDERED_PATTERN);
  if (orderedMatch) {
    const indent = countIndent(orderedMatch[1]);
    return {
      type: BLOCK_TYPES.ORDERED_LIST_ITEM,
      attrs: {
        indent,
        level: toListLevel(indent),
        index: Number(orderedMatch[2]),
        marker: orderedMatch[3],
        text: orderedMatch[4]
      }
    };
  }

  const bulletMatch = line.match(BULLET_PATTERN);
  if (bulletMatch) {
    const indent = countIndent(bulletMatch[1]);
    return {
      type: BLOCK_TYPES.BULLET_LIST_ITEM,
      attrs: {
        indent,
        level: toListLevel(indent),
        marker: bulletMatch[2],
        text: bulletMatch[3]
      }
    };
  }

  return null;
};
