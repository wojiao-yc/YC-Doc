import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

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

const themeHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.operatorKeyword],
    color: "var(--yc-syntax-keyword)"
  },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName, tags.special(tags.variableName)],
    color: "var(--yc-syntax-attribute)"
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName, tags.url, tags.link],
    color: "var(--yc-syntax-link)",
    textDecoration: "underline"
  },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name), tags.typeName, tags.className, tags.namespace],
    color: "var(--yc-syntax-type)"
  },
  {
    tag: [tags.definition(tags.name), tags.annotation],
    color: "var(--yc-syntax-meta)"
  },
  {
    tag: [tags.number, tags.changed, tags.atom, tags.bool],
    color: "var(--yc-syntax-number)"
  },
  {
    tag: [tags.processingInstruction, tags.string, tags.inserted, tags.regexp, tags.escape],
    color: "var(--yc-syntax-string)"
  },
  {
    tag: tags.meta,
    color: "var(--yc-syntax-meta)"
  },
  {
    tag: tags.comment,
    color: "var(--yc-syntax-comment)",
    fontStyle: "italic"
  },
  {
    tag: [tags.separator, tags.brace, tags.operator, tags.modifier, tags.self],
    color: "var(--yc-syntax-operator)"
  },
  {
    tag: tags.strong,
    fontWeight: "700"
  },
  {
    tag: tags.emphasis,
    fontStyle: "italic"
  },
  {
    tag: tags.strikethrough,
    textDecoration: "line-through"
  },
  {
    tag: tags.heading,
    color: "var(--yc-text-primary)",
    fontWeight: "700"
  },
  {
    tag: tags.invalid,
    color: "var(--yc-callout-danger-title)"
  }
]);

export const createEditorThemeExtension = (isDark = false) => [
  syntaxHighlighting(themeHighlightStyle),
  isDark ? darkTheme : lightTheme
];
