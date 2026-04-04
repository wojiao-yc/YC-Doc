const STRIKETHROUGH_MARKER = "~~";

export const resolveInlineFormattingPlaceholder = ({
  prefix = "",
  suffix = "",
  placeholder = ""
} = {}) => {
  const explicitPlaceholder = String(placeholder || "");
  if (explicitPlaceholder) {
    return explicitPlaceholder;
  }

  if (String(prefix) === STRIKETHROUGH_MARKER && String(suffix) === STRIKETHROUGH_MARKER) {
    // Avoid producing a leading `~~~~` sequence, which Markdown parsers may
    // interpret as the start of a fenced code block when the cursor is at BOL.
    return " ";
  }

  return "";
};
