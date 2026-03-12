const OPEN_FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})(.*)$/;

const closeFencePatternFor = (fenceToken) => {
  const marker = fenceToken[0] === "~" ? "~" : "`";
  const length = fenceToken.length;
  return new RegExp(`^\\s{0,3}${marker}{${length},}\\s*$`);
};

export const parseCodeBlock = (lines, startIndex) => {
  const line = lines[startIndex];
  if (!line) {
    return null;
  }
  const openMatch = String(line.text || "").match(OPEN_FENCE_PATTERN);
  if (!openMatch) {
    return null;
  }

  const openingFence = openMatch[1];
  const fenceMarker = openingFence[0] === "~" ? "~~~" : "```";
  const infoString = String(openMatch[2] || "").trim();
  const language = infoString ? String(infoString.split(/\s+/)[0]) : null;
  const closePattern = closeFencePatternFor(openingFence);

  let endIndex = startIndex;
  for (let cursor = startIndex + 1; cursor < lines.length; cursor += 1) {
    if (closePattern.test(String(lines[cursor].text || ""))) {
      endIndex = cursor;
      break;
    }
    endIndex = cursor;
  }

  return {
    endIndex,
    attrs: {
      language,
      fence: fenceMarker
    }
  };
};
