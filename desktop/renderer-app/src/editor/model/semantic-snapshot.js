const toTimestamp = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : Date.now();
};

export const createSemanticSnapshot = ({
  blocks = [],
  outline = [],
  generatedAt = Date.now()
} = {}) => ({
  blocks: Array.isArray(blocks) ? blocks : [],
  outline: Array.isArray(outline) ? outline : [],
  generatedAt: toTimestamp(generatedAt)
});
