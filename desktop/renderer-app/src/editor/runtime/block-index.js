const normalizePos = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeIndex = (index, length) => (index >= 0 && index < length ? index : -1);

export const findBlockContextByPos = (blocks = [], posInput = 0) => {
  if (!Array.isArray(blocks) || !blocks.length) {
    return {
      pos: normalizePos(posInput),
      index: -1,
      prevIndex: -1,
      nextIndex: -1
    };
  }

  const pos = normalizePos(posInput);
  let low = 0;
  let high = blocks.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = blocks[mid];
    const from = Number(block?.from || 0);
    const to = Number(block?.to || from);

    if (pos < from) {
      high = mid - 1;
      continue;
    }
    if (pos >= to) {
      low = mid + 1;
      continue;
    }
    return {
      pos,
      index: mid,
      prevIndex: normalizeIndex(mid - 1, blocks.length),
      nextIndex: normalizeIndex(mid + 1, blocks.length)
    };
  }

  const lastIndex = blocks.length - 1;
  const lastTo = Number(blocks[lastIndex]?.to || 0);
  if (pos >= lastTo) {
    return {
      pos,
      index: lastIndex,
      prevIndex: normalizeIndex(lastIndex - 1, blocks.length),
      nextIndex: -1
    };
  }

  const insertionIndex = Math.max(0, Math.min(blocks.length, low));
  const prevIndex = insertionIndex - 1;
  const nextIndex = insertionIndex >= blocks.length ? -1 : insertionIndex;

  return {
    pos,
    index: -1,
    prevIndex: normalizeIndex(prevIndex, blocks.length),
    nextIndex: normalizeIndex(nextIndex, blocks.length)
  };
};

export const findBlockIndexByPos = (blocks = [], posInput = 0) =>
  findBlockContextByPos(blocks, posInput).index;
