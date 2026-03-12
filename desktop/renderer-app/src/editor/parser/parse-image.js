const IMAGE_PATTERN = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/;

export const parseImageLine = (lineText) => {
  const match = String(lineText || "").trim().match(IMAGE_PATTERN);
  if (!match) {
    return null;
  }
  return {
    alt: String(match[1] || ""),
    src: String(match[2] || ""),
    title: match[3] == null ? undefined : String(match[3] || "")
  };
};
