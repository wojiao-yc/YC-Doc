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
const THEME_SYNTAX = Object.freeze({
  keyword: "var(--yc-syntax-keyword)",
  variable: "var(--yc-text-primary)",
  property: "var(--yc-syntax-attribute)",
  selector: "var(--yc-syntax-link)",
  function: "var(--yc-syntax-link)",
  type: "var(--yc-syntax-type)",
  parameter: "var(--yc-syntax-meta)",
  number: "var(--yc-syntax-number)",
  string: "var(--yc-syntax-string)",
  comment: "var(--yc-syntax-comment)",
  punctuation: "var(--yc-syntax-delimiter)",
  operator: "var(--yc-syntax-operator)",
  invalid: "var(--yc-callout-danger-title)"
});
const TAG_TAG_NAME = tags.tagName || tags.name;
const TAG_ATTRIBUTE_NAME = tags.attributeName || tags.propertyName;
const TAG_PUNCTUATION = tags.punctuation || tags.separator;

const themeHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.operatorKeyword],
    color: THEME_SYNTAX.keyword,
    fontWeight: "640"
  },
  {
    tag: [tags.variableName, tags.special(tags.variableName)],
    color: THEME_SYNTAX.variable
  },
  {
    tag: tags.propertyName,
    color: THEME_SYNTAX.property
  },
  {
    tag: [tags.name, tags.character, tags.macroName],
    color: THEME_SYNTAX.variable
  },
  {
    tag: [TAG_TAG_NAME, TAG_ATTRIBUTE_NAME],
    color: THEME_SYNTAX.selector
  },
  {
    tag: tags.deleted,
    color: THEME_SYNTAX.operator
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.labelName],
    color: THEME_SYNTAX.function
  },
  {
    tag: [tags.url, tags.link],
    color: THEME_SYNTAX.function,
    textDecoration: "underline"
  },
  {
    tag: [tags.color, tags.typeName, tags.className, tags.namespace],
    color: THEME_SYNTAX.type,
    fontWeight: "560"
  },
  {
    tag: [tags.constant(tags.name), tags.standard(tags.name)],
    color: THEME_SYNTAX.number
  },
  {
    tag: [tags.definition(tags.name), tags.annotation],
    color: THEME_SYNTAX.parameter,
    fontWeight: "560"
  },
  {
    tag: [tags.number, tags.changed, tags.atom, tags.bool],
    color: THEME_SYNTAX.number
  },
  {
    tag: [tags.processingInstruction, tags.string, tags.inserted, tags.escape],
    color: THEME_SYNTAX.string
  },
  {
    tag: [tags.special(tags.string), tags.regexp],
    color: THEME_SYNTAX.parameter
  },
  {
    tag: tags.meta,
    color: THEME_SYNTAX.parameter
  },
  {
    tag: tags.comment,
    color: THEME_SYNTAX.comment,
    fontStyle: "italic"
  },
  {
    tag: [tags.separator, tags.brace, TAG_PUNCTUATION],
    color: THEME_SYNTAX.punctuation
  },
  {
    tag: [tags.operator, tags.modifier, tags.self],
    color: THEME_SYNTAX.operator
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
    color: THEME_SYNTAX.invalid
  }
]);

export const createEditorThemeExtension = (isDark = false) => [
  syntaxHighlighting(themeHighlightStyle),
  isDark ? darkTheme : lightTheme
];
