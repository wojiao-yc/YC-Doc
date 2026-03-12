import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { EditorView, drawSelection, keymap } from "@codemirror/view";

export const coreExtensions = [
  drawSelection(),
  history(),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({
    spellcheck: "false",
    autocorrect: "off",
    autocapitalize: "off",
    "data-gramm": "false"
  }),
  keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap])
];
