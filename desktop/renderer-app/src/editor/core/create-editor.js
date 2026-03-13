import { Compartment } from "@codemirror/state";
import { openSearchPanel } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { createEditorState } from "./create-state";
import { createEditorView } from "./create-view";
import { coreExtensions } from "../extensions/core";
import { markdownExtensions } from "../extensions/markdown";
import { presentationExtensions, setPresentationDataEffect } from "../extensions/presentation";
import { createEditorThemeExtension } from "../extensions/theme";

export const createMarkdownEditor = ({
  parent,
  doc = "",
  dark = false,
  onChange = null,
  onSelectionChange = null
}) => {
  const themeCompartment = new Compartment();
  const updateListener = EditorView.updateListener.of((update) => {
    if ((update.selectionSet || update.docChanged) && typeof onSelectionChange === "function") {
      const mainSelection = update.state.selection.main;
      onSelectionChange({
        anchor: mainSelection.anchor,
        head: mainSelection.head
      }, update);
    }
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
      ...presentationExtensions,
      themeCompartment.of(createEditorThemeExtension(Boolean(dark))),
      updateListener
    ]
  });

  const view = createEditorView({ state, parent });
  if (typeof onSelectionChange === "function") {
    const mainSelection = view.state.selection.main;
    onSelectionChange({
      anchor: mainSelection.anchor,
      head: mainSelection.head
    });
  }

  const getDoc = () => view.state.doc.toString();

  const setDoc = (nextDoc, { presentationData = null } = {}) => {
    const next = String(nextDoc ?? "");
    if (next === getDoc()) {
      if (presentationData) {
        setPresentationData(presentationData);
      }
      return;
    }
    const effects = presentationData
      ? [setPresentationDataEffect.of({
          blocks: Array.isArray(presentationData?.blocks) ? presentationData.blocks : [],
          currentBlockId: String(presentationData?.currentBlockId || "")
        })]
      : [];
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: next
      },
      effects
    });
  };

  const setDark = (nextDark) => {
    view.dispatch({
      effects: themeCompartment.reconfigure(createEditorThemeExtension(Boolean(nextDark)))
    });
  };

  const setPresentationData = ({ blocks = [], currentBlockId = "" } = {}) => {
    view.dispatch({
      effects: setPresentationDataEffect.of({
        blocks: Array.isArray(blocks) ? blocks : [],
        currentBlockId: String(currentBlockId || "")
      })
    });
  };

  return {
    view,
    getDoc,
    setDoc,
    setDark,
    setPresentationData,
    focus: () => view.focus(),
    openSearch: () => openSearchPanel(view),
    destroy: () => view.destroy()
  };
};
