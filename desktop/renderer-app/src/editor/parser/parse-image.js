const IMAGE_PATTERN = /^!\[([^\]]*)\]\((?:<([^>]+)>|([^)\s]+))(?:\s+"([^"]*)")?\)\s*$/;
const IMAGE_WIDTH_META_PATTERN = /\s*<!--\s*yc-image-width\s*:\s*(\d+)\s*-->\s*$/i;
const MARKDOWN_IMAGE_SRC_SAFE_PATTERN = /^[^\s()<>]+$/;

const normalizeImageMetaWidth = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  const rounded = Math.round(numeric);
  return rounded > 0 ? rounded : undefined;
};

const unwrapMarkdownImageSrc = (value = "") => {
  const source = String(value || "").trim();
  if (source.startsWith("<") && source.endsWith(">")) {
    return source.slice(1, -1);
  }
  return source;
};

export const formatMarkdownImageSrc = (value = "") => {
  const source = unwrapMarkdownImageSrc(value);
  if (!source) {
    return "";
  }
  return MARKDOWN_IMAGE_SRC_SAFE_PATTERN.test(source) ? source : `<${source}>`;
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
    src: String(match[2] || match[3] || ""),
    title: match[4] == null ? undefined : String(match[4] || ""),
    width
  };
};

export const serializeImageLine = ({ alt = "", src = "", title = undefined, width = undefined } = {}) => {
  const altText = String(alt || "");
  const srcText = formatMarkdownImageSrc(src);
  const titleText = title == null ? "" : String(title || "");
  const titlePart = titleText ? ` "${titleText}"` : "";

  const normalizedWidth = normalizeImageMetaWidth(width);
  const widthMetaPart = Number.isFinite(normalizedWidth)
    ? ` <!-- yc-image-width:${normalizedWidth} -->`
    : "";

  return `![${altText}](${srcText}${titlePart})${widthMetaPart}`;
};
