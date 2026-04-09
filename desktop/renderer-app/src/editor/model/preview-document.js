const toTimestamp = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : Date.now();
};

export const createPreviewDocument = ({
  markdown = "",
  nodes = [],
  blocks = [],
  outline = [],
  specialBlocks = [],
  generatedAt = Date.now()
} = {}) => ({
  markdown: String(markdown || ""),
  nodes: Array.isArray(nodes) ? nodes : [],
  blocks: Array.isArray(blocks) ? blocks : [],
  outline: Array.isArray(outline) ? outline : [],
  specialBlocks: Array.isArray(specialBlocks) ? specialBlocks : [],
  generatedAt: toTimestamp(generatedAt)
});
