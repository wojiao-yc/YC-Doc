import { Compartment } from "@codemirror/state";
import { openSearchPanel } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { createEditorState } from "./create-state";
import { createEditorView } from "./create-view";
import { coreExtensions } from "../extensions/core";
import { markdownExtensions } from "../extensions/markdown";
import { presentationExtensions, setPresentationDataEffect } from "../extensions/presentation";
import { contextMenuExtensions } from "../extensions/context-menu";
import { createWikiLinkEventExtensions } from "../extensions/wikilink-events";
import { createWikiLinkAutocompleteExtension } from "../extensions/wikilink-autocomplete";
import { createEditorThemeExtension } from "../extensions/theme";

export const createMarkdownEditor = ({
  parent,
  doc = "",
  dark = false,
  onChange = null,
  onSelectionChange = null,
  onWikiLinkActivate = null,
  onWikiLinkSuggestionSelect = null,
  getWikiLinkCurrentRelPath = () => "",
  getWikiLinkMarkdownFiles = () => [],
  getWikiLinkSuggestions = () => []
}) => {
  const themeCompartment = new Compartment();
  const wikiLinkEventConfig = createWikiLinkEventExtensions({
    getCurrentRelPath: getWikiLinkCurrentRelPath,
    getMarkdownFiles: getWikiLinkMarkdownFiles,
    onWikiLinkActivate
  });
  const wikiLinkAutocompleteExtension = createWikiLinkAutocompleteExtension({
    getSuggestions: getWikiLinkSuggestions,
    onSelectSuggestion: onWikiLinkSuggestionSelect
  });
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
      ...wikiLinkEventConfig.extensions,
      wikiLinkAutocompleteExtension,
      ...contextMenuExtensions,
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

  const setCursor = (posInput = 0) => {
    const docLength = Number(view.state.doc.length || 0);
    const pos = Math.max(0, Math.min(docLength, Number(posInput) || 0));
    view.dispatch({
      selection: {
        anchor: pos,
        head: pos
      },
      scrollIntoView: true
    });
    view.focus();
  };

  const refreshWikiLinks = () => {
    if (!wikiLinkEventConfig?.refreshEffect) {
      return;
    }
    view.dispatch({
      effects: wikiLinkEventConfig.refreshEffect.of({
        ts: Date.now()
      })
    });
  };

  return {
    view,
    getDoc,
    setDoc,
    setDark,
    setPresentationData,
    setCursor,
    refreshWikiLinks,
    focus: () => view.focus(),
    openSearch: () => openSearchPanel(view),
    destroy: () => view.destroy()
  };
};
