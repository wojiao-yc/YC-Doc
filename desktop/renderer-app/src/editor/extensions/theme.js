import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";

const createBaseTheme = (dark = false) => EditorView.theme(
  {
    "&": {
      color: "var(--yc-text-primary)",
      backgroundColor: "transparent"
    },
    ".cm-content": {
      caretColor: "var(--yc-accent)"
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--yc-accent)"
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "var(--yc-editor-selection)"
    },
    ".cm-gutters": {
      border: "none",
      backgroundColor: "transparent",
      color: "var(--yc-text-subtle)"
    }
  },
  { dark }
);

const lightTheme = createBaseTheme(false);
const darkTheme = createBaseTheme(true);

export const createEditorThemeExtension = (isDark = false) => [
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  isDark ? darkTheme : lightTheme
];
