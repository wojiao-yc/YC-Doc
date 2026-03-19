const IMAGE_PATTERN = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/;
const IMAGE_WIDTH_META_PATTERN = /\s*<!--\s*yc-image-width\s*:\s*(\d+)\s*-->\s*$/i;

const normalizeImageMetaWidth = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  const rounded = Math.round(numeric);
  return rounded > 0 ? rounded : undefined;
};

export const parseImageLine = (lineText) => {
  let source = String(lineText || "").trim();
  let width = undefined;

  const metaMatch = source.match(IMAGE_WIDTH_META_PATTERN);
  if (metaMatch) {
    width = normalizeImageMetaWidth(metaMatch[1]);
    source = source.slice(0, Number(metaMatch.index || 0)).trimEnd();
  }

  const match = source.match(IMAGE_PATTERN);
  if (!match) {
    return null;
  }
  return {
    alt: String(match[1] || ""),
    src: String(match[2] || ""),
    title: match[3] == null ? undefined : String(match[3] || ""),
    width
  };
};

export const serializeImageLine = ({ alt = "", src = "", title = undefined, width = undefined } = {}) => {
  const altText = String(alt || "");
  const srcText = String(src || "");
  const titleText = title == null ? "" : String(title || "");
  const titlePart = titleText ? ` "${titleText}"` : "";

  const normalizedWidth = normalizeImageMetaWidth(width);
  const widthMetaPart = Number.isFinite(normalizedWidth)
    ? ` <!-- yc-image-width:${normalizedWidth} -->`
    : "";

  return `![${altText}](${srcText}${titlePart})${widthMetaPart}`;
};
