import { EditorState } from "@codemirror/state";

export const createEditorState = ({ doc = "", extensions = [] } = {}) =>
  EditorState.create({
    doc: String(doc ?? ""),
    extensions
  });
