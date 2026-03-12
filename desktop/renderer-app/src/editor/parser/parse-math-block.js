const OPEN_MATH_FENCE_PATTERN = /^\s{0,3}\$\$\s*$/;
const SINGLE_LINE_MATH_PATTERN = /^\s{0,3}\$\$(.+?)\$\$\s*$/;

const trimDollars = (text) => String(text || "").replace(/^\s{0,3}\$\$\s*/, "").replace(/\s*\$\$$/, "");

export const isMathBlockStartLine = (lineText) => {
  const line = String(lineText || "");
  return SINGLE_LINE_MATH_PATTERN.test(line) || OPEN_MATH_FENCE_PATTERN.test(line);
};

const isMathFenceLine = (lineText) => OPEN_MATH_FENCE_PATTERN.test(String(lineText || ""));

export const parseMathBlock = (lines, startIndex) => {
  const startLine = lines[startIndex];
  if (!startLine) {
    return null;
  }
  const lineText = String(startLine.text || "");
  const singleLineMatch = lineText.match(SINGLE_LINE_MATH_PATTERN);
  if (singleLineMatch) {
    const formula = trimDollars(lineText).trim();
    return {
      endIndex: startIndex,
      attrs: {
        formula,
        displayMode: true
      }
    };
  }

  if (!isMathFenceLine(lineText)) {
    return null;
  }

  let endIndex = startIndex;
  for (let cursor = startIndex + 1; cursor < lines.length; cursor += 1) {
    endIndex = cursor;
    if (isMathFenceLine(lines[cursor].text)) {
      break;
    }
  }

  return {
    endIndex,
    attrs: {
      formula: "",
      displayMode: true
    }
  };
};
