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

export const parseListLine = (lineText) => {
  const line = String(lineText || "");

  const taskMatch = line.match(TASK_PATTERN);
  if (taskMatch) {
    return {
      type: BLOCK_TYPES.TASK_LIST_ITEM,
      attrs: {
        indent: countIndent(taskMatch[1]),
        marker: taskMatch[2],
        checked: taskMatch[3].toLowerCase() === "x",
        text: taskMatch[4]
      }
    };
  }

  const orderedMatch = line.match(ORDERED_PATTERN);
  if (orderedMatch) {
    return {
      type: BLOCK_TYPES.ORDERED_LIST_ITEM,
      attrs: {
        indent: countIndent(orderedMatch[1]),
        index: Number(orderedMatch[2]),
        marker: orderedMatch[3],
        text: orderedMatch[4]
      }
    };
  }

  const bulletMatch = line.match(BULLET_PATTERN);
  if (bulletMatch) {
    return {
      type: BLOCK_TYPES.BULLET_LIST_ITEM,
      attrs: {
        indent: countIndent(bulletMatch[1]),
        marker: bulletMatch[2],
        text: bulletMatch[3]
      }
    };
  }

  return null;
};
