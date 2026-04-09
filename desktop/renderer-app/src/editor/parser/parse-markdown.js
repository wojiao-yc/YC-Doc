import { createSemanticSnapshot } from "../model/semantic-snapshot.js";
import { parseMarkdownToPreviewDocument } from "./parse-preview-document.js";

let cachedMarkdown = null;
let cachedSnapshot = null;

export const parseMarkdownToSemanticSnapshot = (markdown) => {
  const normalizedMarkdown = String(markdown || "").replace(/\r\n/g, "\n");
  if (cachedSnapshot && cachedMarkdown === normalizedMarkdown) {
    return cachedSnapshot;
  }

  const previewDocument = parseMarkdownToPreviewDocument(normalizedMarkdown);
  const snapshot = createSemanticSnapshot({
    previewDocument,
    blocks: previewDocument.blocks,
    outline: previewDocument.outline,
    generatedAt: previewDocument.generatedAt
  });

  cachedMarkdown = normalizedMarkdown;
  cachedSnapshot = snapshot;
  return snapshot;
};
