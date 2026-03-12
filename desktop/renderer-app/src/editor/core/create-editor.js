import { Compartment } from "@codemirror/state";
import { openSearchPanel } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { createEditorState } from "./create-state";
import { createEditorView } from "./create-view";
import { coreExtensions } from "../extensions/core";
import { markdownExtensions } from "../extensions/markdown";
import { createEditorThemeExtension } from "../extensions/theme";

export const createMarkdownEditor = ({
  parent,
  doc = "",
  dark = false,
  onChange = null
}) => {
  const themeCompartment = new Compartment();
  const updateListener = EditorView.updateListener.of((update) => {
    if (!update.docChanged || typeof onChange !== "function") {
      return;
    }
    onChange(update.state.doc.toString(), update);
  });

  const state = createEditorState({
    doc,
    extensions: [
      ...coreExtensions,
      ...markdownExtensions,
      themeCompartment.of(createEditorThemeExtension(Boolean(dark))),
      updateListener
    ]
  });

  const view = createEditorView({ state, parent });

  const getDoc = () => view.state.doc.toString();

  const setDoc = (nextDoc) => {
    const next = String(nextDoc ?? "");
    if (next === getDoc()) {
      return;
    }
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: next
      }
    });
  };

  const setDark = (nextDark) => {
    view.dispatch({
      effects: themeCompartment.reconfigure(createEditorThemeExtension(Boolean(nextDark)))
    });
  };

  return {
    view,
    getDoc,
    setDoc,
    setDark,
    focus: () => view.focus(),
    openSearch: () => openSearchPanel(view),
    destroy: () => view.destroy()
  };
};
