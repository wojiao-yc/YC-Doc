const toTimestamp = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : Date.now();
};

export const createSemanticSnapshot = ({
  previewDocument = null,
  blocks = [],
  outline = [],
  generatedAt = Date.now()
} = {}) => ({
  previewDocument: previewDocument && typeof previewDocument === "object" ? previewDocument : null,
  blocks: Array.isArray(blocks) ? blocks : [],
  outline: Array.isArray(outline) ? outline : [],
  nodes: Array.isArray(previewDocument?.nodes) ? previewDocument.nodes : [],
  specialBlocks: Array.isArray(previewDocument?.specialBlocks) ? previewDocument.specialBlocks : [],
  generatedAt: toTimestamp(generatedAt)
});
