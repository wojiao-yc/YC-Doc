import { EditorView } from "@codemirror/view";

export const createEditorView = ({ state, parent }) =>
  new EditorView({
    state,
    parent
  });
