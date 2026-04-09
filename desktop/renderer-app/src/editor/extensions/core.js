import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { search, searchKeymap } from "@codemirror/search";
import { EditorView, keymap } from "@codemirror/view";

const enforceTrailingBlankLine = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.docChanged) {
    return transaction;
  }
  const nextDoc = transaction.newDoc;
  if (nextDoc.length <= 0 || nextDoc.sliceString(nextDoc.length - 1, nextDoc.length) === "\n") {
    return transaction;
  }
  return [
    transaction,
    {
      sequential: true,
      changes: {
        from: nextDoc.length,
        to: nextDoc.length,
        insert: "\n"
      }
    }
  ];
});

export const coreExtensions = [
  enforceTrailingBlankLine,
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
