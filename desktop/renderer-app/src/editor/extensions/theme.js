import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";

const lightTheme = EditorView.theme({
  "&": {
    color: "#0f172a",
    backgroundColor: "#ffffff"
  },
  ".cm-content": {
    caretColor: "#f97316"
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#f97316"
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "#fed7aa"
  },
  ".cm-gutters": {
    border: "none",
    backgroundColor: "transparent",
    color: "#94a3b8"
  }
});

const darkTheme = EditorView.theme(
  {
    "&": {
      color: "#e2e8f0",
      backgroundColor: "#0b1220"
    },
    ".cm-content": {
      caretColor: "#fb923c"
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#fb923c"
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "#7c2d12"
    },
    ".cm-gutters": {
      border: "none",
      backgroundColor: "transparent",
      color: "#64748b"
    }
  },
  { dark: true }
);

export const createEditorThemeExtension = (isDark = false) => [
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  isDark ? darkTheme : lightTheme
];
