import { Compartment, EditorState } from "@codemirror/state";
import { openSearchPanel } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { createEditorState } from "./create-state.js";
import { createEditorView } from "./create-view.js";
import { coreExtensions } from "../extensions/core.js";
import { markdownExtensions } from "../extensions/markdown.js";
import { codeBlockHighlightExtensions } from "../extensions/code-block-highlight.js";
import { presentationExtensions, setPresentationDataEffect } from "../extensions/presentation.js";
import { contextMenuExtensions } from "../extensions/context-menu.js";
import { createWikiLinkEventExtensions } from "../extensions/wikilink-events.js";
import { createWikiLinkAutocompleteExtension, setWikilinkLocaleText } from "../extensions/wikilink-autocomplete.js";
import { createEditorThemeExtension } from "../extensions/theme.js";

export { setWikilinkLocaleText };

export const createMarkdownEditor = ({
  parent,
  doc = "",
  dark = false,
  readOnly = false,
  onChange = null,
  onSelectionChange = null,
  onWikiLinkActivate = null,
  onExternalLinkActivate = null,
  onWikiLinkSuggestionSelect = null,
  getWikiLinkCurrentRelPath = () => "",
  getWikiLinkMarkdownFiles = () => [],
  getWikiLinkSuggestions = () => []
}) => {
  const themeCompartment = new Compartment();
  const editableCompartment = new Compartment();
  const wikiLinkEventConfig = createWikiLinkEventExtensions({
    getCurrentRelPath: getWikiLinkCurrentRelPath,
    getMarkdownFiles: getWikiLinkMarkdownFiles,
    onWikiLinkActivate,
    onExternalLinkActivate
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
      ...codeBlockHighlightExtensions,
      ...presentationExtensions,
      ...wikiLinkEventConfig.extensions,
      wikiLinkAutocompleteExtension,
      ...contextMenuExtensions,
      editableCompartment.of([
        EditorState.readOnly.of(Boolean(readOnly)),
        EditorView.editable.of(!readOnly)
      ]),
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

  const setReadOnly = (nextReadOnly) => {
    view.dispatch({
      effects: editableCompartment.reconfigure([
        EditorState.readOnly.of(Boolean(nextReadOnly)),
        EditorView.editable.of(!nextReadOnly)
      ])
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

  const setCursor = (posInput = 0, { focus = true, scrollIntoView = true } = {}) => {
    const docLength = Number(view.state.doc.length || 0);
    const pos = Math.max(0, Math.min(docLength, Number(posInput) || 0));
    view.dispatch({
      selection: {
        anchor: pos,
        head: pos
      },
      scrollIntoView: Boolean(scrollIntoView)
    });
    if (focus) {
      view.focus();
    }
  };

  const posFromCoords = (xInput, yInput) => {
    const x = Number(xInput);
    const y = Number(yInput);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    const resolved = view.posAtCoords({ x, y });
    return Number.isFinite(resolved) ? resolved : null;
  };

  const describeTextInsertAtCoords = (xInput, yInput) => {
    const pos = posFromCoords(xInput, yInput);
    if (!Number.isFinite(pos)) {
      return null;
    }
    let coords = view.coordsAtPos(pos);
    if (!coords && pos > 0) {
      coords = view.coordsAtPos(pos - 1, 1);
    }
    if (!coords) {
      const x = Number(xInput);
      const y = Number(yInput);
      const fallbackHeight = Math.max(18, Number(view.defaultLineHeight || 0));
      return {
        pos,
        left: Number.isFinite(x) ? x : 0,
        right: Number.isFinite(x) ? x : 0,
        top: Number.isFinite(y) ? y - fallbackHeight / 2 : 0,
        bottom: Number.isFinite(y) ? y + fallbackHeight / 2 : fallbackHeight,
        height: fallbackHeight
      };
    }
    const top = Number(coords.top || 0);
    const bottom = Number(coords.bottom || coords.top || 0);
    return {
      pos,
      left: Number(coords.left || 0),
      right: Number(coords.right || coords.left || 0),
      top,
      bottom,
      height: Math.max(1, bottom - top)
    };
  };

  const setCursorAtCoords = (xInput, yInput, options = {}) => {
    const placement = describeTextInsertAtCoords(xInput, yInput);
    if (!placement) {
      return false;
    }
    setCursor(placement.pos, options);
    return true;
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

  const insertText = (textInput = "") => {
    const text = String(textInput ?? "");
    const range = view.state.selection.main;
    const from = Math.min(range.anchor, range.head);
    const to = Math.max(range.anchor, range.head);
    const cursor = from + text.length;
    view.dispatch({
      changes: {
        from,
        to,
        insert: text
      },
      selection: {
        anchor: cursor,
        head: cursor
      },
      scrollIntoView: true
    });
    view.focus();
    return true;
  };

  const insertTextAtCoords = (textInput = "", xInput, yInput) => {
    const text = String(textInput ?? "");
    const pos = posFromCoords(xInput, yInput);
    if (!Number.isFinite(pos)) {
      return insertText(text);
    }
    const cursor = pos + text.length;
    view.dispatch({
      changes: {
        from: pos,
        to: pos,
        insert: text
      },
      selection: {
        anchor: cursor,
        head: cursor
      },
      scrollIntoView: true
    });
    view.focus();
    return true;
  };

  return {
    view,
    getDoc,
    setDoc,
    setDark,
    setReadOnly,
    setPresentationData,
    setCursor,
    describeTextInsertAtCoords,
    setCursorAtCoords,
    insertText,
    insertTextAtCoords,
    refreshWikiLinks,
    focus: () => view.focus(),
    openSearch: () => openSearchPanel(view),
    destroy: () => view.destroy()
  };
};
