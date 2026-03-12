const HEADING_PATTERN = /^\s{0,3}(#{1,6})[ \t]+(.+?)\s*$/;

const trimClosingHeadingHashes = (text) => String(text || "").replace(/[ \t]+#+[ \t]*$/, "").trim();

export const parseHeadingLine = (lineText) => {
  const line = String(lineText || "");
  const match = line.match(HEADING_PATTERN);
  if (!match) {
    return null;
  }
  return {
    level: match[1].length,
    text: trimClosingHeadingHashes(match[2])
  };
};
