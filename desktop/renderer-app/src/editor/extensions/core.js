import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { EditorView, drawSelection, keymap } from "@codemirror/view";

export const coreExtensions = [
  drawSelection(),
  history(),
  search({
    top: true
  }),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({
    spellcheck: "false",
    autocorrect: "off",
    autocapitalize: "off",
    "data-gramm": "false"
  }),
  keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap])
];
