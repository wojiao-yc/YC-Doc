export const normalizeMarkdownText = (value = "") => String(value ?? "").replace(/\r\n/g, "\n");

export const ensureTrailingBlankLine = (value = "") => {
  const normalized = normalizeMarkdownText(value);
  if (!normalized || normalized.endsWith("\n")) {
    return normalized;
  }
  return `${normalized}\n`;
};

export const normalizeMarkdownDocument = (value = "") => ensureTrailingBlankLine(value);
