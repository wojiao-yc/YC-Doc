import { normalizeMarkdownDocument } from "../../utils/markdown-normalize.js";
import { findOpenWikiLinkContext, parseWikiLinkRaw } from "../../utils/wiki-link.js";
import { createMuyaInstance } from "./muya-runtime.js";

let wikiLinkLocaleText = (zhText, _enText) => zhText;

export const setWikilinkLocaleText = (nextLocaleText) => {
  if (typeof nextLocaleText === "function") {
    wikiLinkLocaleText = nextLocaleText;
  }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const escapeRegExp = (valueInput = "") => String(valueInput || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getOwnerWindow = (node) => node?.ownerDocument?.defaultView ?? window;

const nodeInsideRoot = (root, node) =>
  node === root || (node instanceof Node && root.contains(node));

const getTextLength = (root) => String(root?.textContent || "").length;

const getRangeFromPoint = (root, xInput, yInput) => {
  const x = Number(xInput);
  const y = Number(yInput);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const doc = root?.ownerDocument;
  if (!doc) {
    return null;
  }

  let range = null;
  if (typeof doc.caretRangeFromPoint === "function") {
    range = doc.caretRangeFromPoint(x, y);
  } else if (typeof doc.caretPositionFromPoint === "function") {
    const caret = doc.caretPositionFromPoint(x, y);
    if (caret?.offsetNode) {
      range = doc.createRange();
      range.setStart(caret.offsetNode, caret.offset || 0);
      range.collapse(true);
    }
  }

  if (!range || !nodeInsideRoot(root, range.startContainer)) {
    return null;
  }

  return range;
};

const offsetFromRoot = (root, node, offset) => {
  if (!nodeInsideRoot(root, node)) {
    return 0;
  }

  try {
    const doc = root.ownerDocument;
    const range = doc.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, Number(offset) || 0);
    return range.toString().length;
  } catch {
    return 0;
  }
};

const createCollapsedRangeAtOffset = (root, rawOffset) => {
  const doc = root.ownerDocument;
  const win = getOwnerWindow(root);
  const nodeFilter = win?.NodeFilter || NodeFilter;
  const range = doc.createRange();
  const targetOffset = Math.max(0, Number(rawOffset) || 0);
  let remaining = targetOffset;

  const walker = doc.createTreeWalker(root, nodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const textLength = String(current.textContent || "").length;
    if (remaining <= textLength) {
      range.setStart(current, remaining);
      range.collapse(true);
      return range;
    }
    remaining -= textLength;
    current = walker.nextNode();
  }

  range.selectNodeContents(root);
  range.collapse(false);
  return range;
};

const setSelectionRange = (root, range) => {
  if (!range || !nodeInsideRoot(root, range.startContainer)) {
    return false;
  }
  const win = getOwnerWindow(root);
  const selection = win?.getSelection?.();
  if (!selection) {
    return false;
  }
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

const selectionOffsetsFromRoot = (root) => {
  const selection = getOwnerWindow(root)?.getSelection?.();
  if (!selection || !selection.anchorNode || !selection.focusNode) {
    return null;
  }
  if (!nodeInsideRoot(root, selection.anchorNode) || !nodeInsideRoot(root, selection.focusNode)) {
    return null;
  }

  return {
    anchor: offsetFromRoot(root, selection.anchorNode, selection.anchorOffset),
    head: offsetFromRoot(root, selection.focusNode, selection.focusOffset)
  };
};

const placementFromRange = (root, range) => {
  if (!range) {
    return null;
  }
  const rect = range.getBoundingClientRect();
  const placementPos = offsetFromRoot(root, range.startContainer, range.startOffset);
  const fallbackHeight = 20;
  const top = Number.isFinite(rect?.top) ? rect.top : 0;
  const bottom = Number.isFinite(rect?.bottom) ? rect.bottom : top + fallbackHeight;
  const left = Number.isFinite(rect?.left) ? rect.left : 0;
  const right = Number.isFinite(rect?.right) ? rect.right : left;
  const height = Math.max(1, bottom - top);
  return {
    pos: Math.max(0, placementPos),
    left,
    right,
    top,
    bottom,
    height
  };
};

const placementFromCoords = (root, xInput, yInput) => {
  const range = getRangeFromPoint(root, xInput, yInput);
  return placementFromRange(root, range);
};

const ensureSelectionInRoot = (root) => {
  const win = getOwnerWindow(root);
  const selection = win?.getSelection?.();
  if (selection?.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (nodeInsideRoot(root, range.startContainer)) {
      return true;
    }
  }
  const endRange = createCollapsedRangeAtOffset(root, getTextLength(root));
  return setSelectionRange(root, endRange);
};

const dispatchInputEvent = (root, text = "") => {
  try {
    root.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: false,
      inputType: "insertText",
      data: text
    }));
  } catch {
    root.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

const insertTextUsingSelection = (root, textInput = "") => {
  const text = String(textInput ?? "");
  if (!text) {
    return true;
  }

  root.focus();
  ensureSelectionInRoot(root);
  const doc = root.ownerDocument;
  if (typeof doc.execCommand === "function" && doc.execCommand("insertText", false, text)) {
    return true;
  }

  const selection = getOwnerWindow(root)?.getSelection?.();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const textNode = doc.createTextNode(text);
  range.insertNode(textNode);
  const nextRange = doc.createRange();
  nextRange.setStart(textNode, textNode.length);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  dispatchInputEvent(root, text);
  return true;
};

const selectedTextInRoot = (root) => {
  const selection = getOwnerWindow(root)?.getSelection?.();
  if (!selection || selection.rangeCount === 0) {
    return "";
  }
  const range = selection.getRangeAt(0);
  if (!nodeInsideRoot(root, range.commonAncestorContainer)) {
    return "";
  }
  return String(selection.toString() || "");
};

const setMuyaReadOnly = (root, value) => {
  const next = Boolean(value);
  root.setAttribute("contenteditable", next ? "false" : "true");
  root.classList.toggle("yc-muya-readonly", next);
};

const setMuyaDark = (root, value) => {
  root.classList.toggle("yc-muya-dark", Boolean(value));
};

const normalizeWikiLinkSuggestionItems = (itemsInput = []) =>
  (Array.isArray(itemsInput) ? itemsInput : [])
    .filter((item) => item && typeof item === "object" && String(item.insertText || "").trim())
    .map((item, index) => ({
      id: String(item.id || `wikilink-item-${index}`),
      label: String(item.label || item.insertText || ""),
      detail: String(item.detail || ""),
      meta: String(item.meta || ""),
      insertText: String(item.insertText || ""),
      tone: String(item.tone || "default"),
      action: String(item.action || ""),
      createRelPath: String(item.createRelPath || ""),
      layout: String(item.layout || "default")
    }));

export const createMarkdownEditor = ({
  parent,
  doc = "",
  dark = false,
  readOnly = false,
  presentationEnabled = true,
  onChange = null,
  onSelectionChange = null,
  onWikiLinkActivate = null,
  onExternalLinkActivate = null,
  onWikiLinkSuggestionSelect = null,
  getWikiLinkCurrentRelPath = () => "",
  getWikiLinkMarkdownFiles = () => [],
  getWikiLinkSuggestions = () => []
}) => {
  const normalizedDoc = normalizeMarkdownDocument(doc);
  parent.textContent = "";
  const mount = parent.ownerDocument.createElement("div");
  mount.className = `${String(parent.className || "").trim()} yc-muya-mount`.trim();
  parent.appendChild(mount);

  const muya = createMuyaInstance(mount, {
    markdown: normalizedDoc,
    presentationEnabled
  });

  const root = muya.domNode;
  let destroyed = false;
  let suppressChange = false;
  let readOnlyState = Boolean(readOnly);
  let contextMenuEl = null;
  let contextMenuOutsideHandler = null;
  let contextMenuKeyHandler = null;
  let autocompleteMenuEl = null;
  let autocompleteListEl = null;
  let autocompleteFooterEl = null;
  let autocompleteOutsideHandler = null;
  let autocompleteWindowResizeHandler = null;
  let autocompleteWindowScrollHandler = null;
  let autocompleteState = null;

  setMuyaDark(root, dark);
  setMuyaReadOnly(root, readOnlyState);

  const emitSelectionChange = () => {
    if (destroyed || typeof onSelectionChange !== "function") {
      return;
    }
    const selection = selectionOffsetsFromRoot(root);
    if (!selection) {
      return;
    }
    onSelectionChange(selection);
  };

  const handleDocumentSelectionChange = () => {
    emitSelectionChange();
    updateWikiLinkAutocomplete();
  };

  const ownerDocument = root.ownerDocument;
  ownerDocument.addEventListener("selectionchange", handleDocumentSelectionChange, true);

  const getDoc = () => String(muya.getMarkdown?.() || "");

  const closeWikiLinkAutocomplete = () => {
    if (autocompleteOutsideHandler) {
      ownerDocument.removeEventListener("mousedown", autocompleteOutsideHandler, true);
      autocompleteOutsideHandler = null;
    }
    const ownerWindow = getOwnerWindow(root);
    if (autocompleteWindowResizeHandler) {
      ownerWindow?.removeEventListener?.("resize", autocompleteWindowResizeHandler, true);
      autocompleteWindowResizeHandler = null;
    }
    if (autocompleteWindowScrollHandler) {
      ownerWindow?.removeEventListener?.("scroll", autocompleteWindowScrollHandler, true);
      autocompleteWindowScrollHandler = null;
    }
    if (autocompleteMenuEl) {
      autocompleteMenuEl.remove();
      autocompleteMenuEl = null;
    }
    autocompleteListEl = null;
    autocompleteFooterEl = null;
    autocompleteState = null;
  };

  const renderWikiLinkAutocompleteHints = () => {
    if (!autocompleteFooterEl) {
      return;
    }
    autocompleteFooterEl.textContent = "";
    const hintItems = [
      { token: "#", text: wikiLinkLocaleText("Link to headings", "Link to headings") },
      { token: "^", text: wikiLinkLocaleText("Link to text block", "Link to text block") },
      { token: "|", text: wikiLinkLocaleText("Display text", "Display text") }
    ];
    for (const hintItem of hintItems) {
      const hint = ownerDocument.createElement("div");
      hint.className = "yc-wikilink-autocomplete-hint";
      const token = ownerDocument.createElement("span");
      token.className = "yc-wikilink-autocomplete-hint-token";
      token.textContent = hintItem.token;
      const text = ownerDocument.createElement("span");
      text.className = "yc-wikilink-autocomplete-hint-text";
      text.textContent = hintItem.text;
      hint.append(token, text);
      autocompleteFooterEl.appendChild(hint);
    }
  };

  const positionWikiLinkAutocomplete = () => {
    if (!autocompleteMenuEl || !autocompleteState?.context) {
      return;
    }
    const selection = getOwnerWindow(root)?.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect?.() || root.getBoundingClientRect();
    const viewportWidth = Math.max(
      Number(getOwnerWindow(root)?.innerWidth || 0),
      Number(ownerDocument.documentElement?.clientWidth || 0)
    );
    const viewportHeight = Math.max(
      Number(getOwnerWindow(root)?.innerHeight || 0),
      Number(ownerDocument.documentElement?.clientHeight || 0)
    );
    const panelRect = autocompleteMenuEl.getBoundingClientRect();
    const gap = 6;
    let left = Number.isFinite(rect?.left) ? rect.left : 12;
    let top = (Number.isFinite(rect?.bottom) ? rect.bottom : 12) + gap;

    if (left + panelRect.width > viewportWidth - 12) {
      left = viewportWidth - panelRect.width - 12;
    }
    if (left < 12) {
      left = 12;
    }

    if (top + panelRect.height > viewportHeight - 12) {
      top = (Number.isFinite(rect?.top) ? rect.top : top) - panelRect.height - gap;
    }
    if (top < 12) {
      top = 12;
    }

    autocompleteMenuEl.style.left = `${Math.round(left)}px`;
    autocompleteMenuEl.style.top = `${Math.round(top)}px`;
  };

  const applyWikiLinkSuggestion = async (indexInput = 0) => {
    if (!autocompleteState?.items?.length) {
      return false;
    }
    const index = clamp(Number(indexInput) || 0, 0, autocompleteState.items.length - 1);
    const item = autocompleteState.items[index];
    const context = autocompleteState.context || {};
    const selection = selectionOffsetsFromRoot(root);
    const cursorPos = clamp(Number(selection?.head ?? context.cursorPos ?? 0), 0, getTextLength(root));
    const query = String(context.query || "");
    const insertText = String(item?.insertText || "");
    const shouldAppendClose = context.hasClosing ? "" : "]]";
    let inserted = false;

    if (query && insertText.toLowerCase().startsWith(query.toLowerCase())) {
      const suffix = insertText.slice(query.length);
      inserted = insertTextUsingSelection(root, `${suffix}${shouldAppendClose}`);
    } else {
      const fromPos = clamp(cursorPos - query.length, 0, cursorPos);
      const fromRange = createCollapsedRangeAtOffset(root, fromPos);
      const toRange = createCollapsedRangeAtOffset(root, cursorPos);
      const replaceRange = ownerDocument.createRange();
      replaceRange.setStart(fromRange.startContainer, fromRange.startOffset);
      replaceRange.setEnd(toRange.startContainer, toRange.startOffset);
      setSelectionRange(root, replaceRange);
      inserted = insertTextUsingSelection(root, `${insertText}${shouldAppendClose}`);
    }

    if (!inserted) {
      return false;
    }

    closeWikiLinkAutocomplete();
    focus();
    if (typeof onWikiLinkSuggestionSelect === "function") {
      void Promise.resolve(onWikiLinkSuggestionSelect({
        item,
        context
      })).catch(() => {});
    }
    return true;
  };

  const setWikiLinkAutocompleteActive = (nextIndexInput = 0) => {
    if (!autocompleteListEl || !autocompleteState?.items?.length) {
      return false;
    }
    const buttons = [...autocompleteListEl.querySelectorAll(".yc-wikilink-autocomplete-item")];
    if (!buttons.length) {
      return false;
    }
    const nextIndex = clamp(Number(nextIndexInput) || 0, 0, buttons.length - 1);
    autocompleteState.selectedIndex = nextIndex;
    for (let index = 0; index < buttons.length; index += 1) {
      const button = buttons[index];
      button.classList.toggle("is-active", index === nextIndex);
    }
    const active = buttons[nextIndex];
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    }
    return true;
  };

  const renderWikiLinkAutocompleteItems = () => {
    if (!autocompleteListEl || !autocompleteState?.items?.length) {
      return;
    }
    autocompleteListEl.textContent = "";
    const items = autocompleteState.items;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const button = ownerDocument.createElement("button");
      button.type = "button";
      button.className = `yc-wikilink-autocomplete-item ${item.tone ? `is-${item.tone}` : ""}`.trim();
      button.dataset.index = String(index);

      if (item.layout === "preview") {
        const mainRow = ownerDocument.createElement("span");
        mainRow.className = "yc-wikilink-autocomplete-main-row";
        const labelEl = ownerDocument.createElement("span");
        labelEl.className = "yc-wikilink-autocomplete-label";
        labelEl.textContent = item.label;
        mainRow.appendChild(labelEl);
        if (item.meta) {
          const metaEl = ownerDocument.createElement("span");
          metaEl.className = "yc-wikilink-autocomplete-meta";
          metaEl.textContent = item.meta;
          mainRow.appendChild(metaEl);
        }
        button.appendChild(mainRow);
      } else {
        const labelEl = ownerDocument.createElement("span");
        labelEl.className = "yc-wikilink-autocomplete-label";
        labelEl.textContent = item.label;
        button.appendChild(labelEl);
      }

      if (item.detail) {
        const detailEl = ownerDocument.createElement("span");
        detailEl.className = "yc-wikilink-autocomplete-detail";
        detailEl.textContent = item.detail;
        button.appendChild(detailEl);
      }

      button.addEventListener("mouseenter", () => {
        setWikiLinkAutocompleteActive(index);
      });
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void applyWikiLinkSuggestion(index);
      });
      autocompleteListEl.appendChild(button);
    }
    setWikiLinkAutocompleteActive(autocompleteState.selectedIndex);
  };

  const ensureWikiLinkAutocompleteMenu = () => {
    if (autocompleteMenuEl) {
      return;
    }
    const menu = ownerDocument.createElement("div");
    menu.className = "yc-wikilink-autocomplete";
    menu.setAttribute("role", "listbox");
    const list = ownerDocument.createElement("div");
    list.className = "yc-wikilink-autocomplete-list";
    const footer = ownerDocument.createElement("div");
    footer.className = "yc-wikilink-autocomplete-footer";
    menu.append(list, footer);
    ownerDocument.body.appendChild(menu);
    autocompleteMenuEl = menu;
    autocompleteListEl = list;
    autocompleteFooterEl = footer;

    autocompleteOutsideHandler = (event) => {
      const target = event?.target;
      if (target instanceof Node && (menu.contains(target) || root.contains(target))) {
        return;
      }
      closeWikiLinkAutocomplete();
    };
    ownerDocument.addEventListener("mousedown", autocompleteOutsideHandler, true);
    const ownerWindow = getOwnerWindow(root);
    autocompleteWindowResizeHandler = () => {
      positionWikiLinkAutocomplete();
    };
    autocompleteWindowScrollHandler = () => {
      positionWikiLinkAutocomplete();
    };
    ownerWindow?.addEventListener?.("resize", autocompleteWindowResizeHandler, true);
    ownerWindow?.addEventListener?.("scroll", autocompleteWindowScrollHandler, true);
  };

  const resolveWikiLinkAutocompleteContext = () => {
    const selection = getOwnerWindow(root)?.getSelection?.();
    if (!selection || !selection.anchorNode || !selection.isCollapsed || !nodeInsideRoot(root, selection.anchorNode)) {
      return null;
    }
    const prefixRange = ownerDocument.createRange();
    prefixRange.selectNodeContents(root);
    prefixRange.setEnd(selection.anchorNode, Number(selection.anchorOffset || 0));
    const prefixText = String(prefixRange.toString() || "");

    const suffixRange = ownerDocument.createRange();
    suffixRange.selectNodeContents(root);
    suffixRange.setStart(selection.anchorNode, Number(selection.anchorOffset || 0));
    const suffixText = String(suffixRange.toString() || "");

    const linePrefix = (prefixText.match(/[^\n\r]*$/) || [""])[0];
    const lineSuffix = (suffixText.match(/^[^\n\r]*/) || [""])[0];
    const lineText = `${linePrefix}${lineSuffix}`;
    const context = findOpenWikiLinkContext(lineText, linePrefix.length);
    if (!context || context.aliasQuery) {
      return null;
    }
    const offsets = selectionOffsetsFromRoot(root);
    const cursorPos = clamp(Number(offsets?.head || 0), 0, getTextLength(root));
    return {
      ...context,
      cursorPos,
      hasClosing: suffixText.startsWith("]]")
    };
  };

  const updateWikiLinkAutocomplete = () => {
    if (destroyed || readOnlyState || typeof getWikiLinkSuggestions !== "function") {
      closeWikiLinkAutocomplete();
      return;
    }
    const context = resolveWikiLinkAutocompleteContext();
    if (!context) {
      closeWikiLinkAutocomplete();
      return;
    }
    let rawItems = [];
    try {
      rawItems = getWikiLinkSuggestions({
        query: context.query,
        noteQuery: context.noteQuery,
        headingQuery: context.headingQuery,
        blockQuery: context.blockQuery,
        mode: context.mode
      });
    } catch {
      rawItems = [];
    }
    const items = normalizeWikiLinkSuggestionItems(rawItems);
    if (!items.length) {
      closeWikiLinkAutocomplete();
      return;
    }

    const previous = autocompleteState;
    const sameContext = Boolean(previous
      && previous.context
      && previous.context.query === context.query
      && previous.context.mode === context.mode
      && previous.context.openFrom === context.openFrom);
    const selectedIndex = sameContext
      ? clamp(Number(previous.selectedIndex || 0), 0, items.length - 1)
      : 0;

    autocompleteState = {
      context,
      items,
      selectedIndex
    };
    ensureWikiLinkAutocompleteMenu();
    if (autocompleteMenuEl) {
      autocompleteMenuEl.classList.toggle("is-dark", root.classList.contains("yc-muya-dark"));
    }
    renderWikiLinkAutocompleteHints();
    renderWikiLinkAutocompleteItems();
    positionWikiLinkAutocomplete();
  };

  const closeContextMenu = () => {
    if (contextMenuOutsideHandler) {
      ownerDocument.removeEventListener("mousedown", contextMenuOutsideHandler, true);
      contextMenuOutsideHandler = null;
    }
    if (contextMenuKeyHandler) {
      ownerDocument.removeEventListener("keydown", contextMenuKeyHandler, true);
      contextMenuKeyHandler = null;
    }
    if (contextMenuEl) {
      contextMenuEl.remove();
      contextMenuEl = null;
    }
  };

  const runContextMenuCommand = async (commandIdInput = "") => {
    const commandId = String(commandIdInput || "");
    const selectedText = selectedTextInRoot(root).trim();
    const canWrite = !readOnlyState;

    if (commandId === "copy") {
      ownerDocument.execCommand?.("copy");
      return true;
    }
    if (commandId === "cut") {
      if (!canWrite) {
        return false;
      }
      ownerDocument.execCommand?.("cut");
      return true;
    }
    if (commandId === "paste") {
      if (!canWrite) {
        return false;
      }
      const windowNavigator = getOwnerWindow(root)?.navigator;
      const clipboardText = await windowNavigator?.clipboard?.readText?.().catch(() => "");
      if (clipboardText) {
        insertTextUsingSelection(root, clipboardText);
        return true;
      }
      ownerDocument.execCommand?.("paste");
      return true;
    }
    if (commandId === "select-all") {
      muya.selectAll?.();
      return true;
    }
    if (commandId === "undo") {
      if (!canWrite) {
        return false;
      }
      muya.undo?.();
      return true;
    }
    if (commandId === "redo") {
      if (!canWrite) {
        return false;
      }
      muya.redo?.();
      return true;
    }
    if (commandId === "insert-wikilink") {
      if (!canWrite) {
        return false;
      }
      const target = selectedText || wikiLinkLocaleText("New Note", "New Note");
      insertTextUsingSelection(root, `[[${target}]]`);
      return true;
    }
    if (commandId === "insert-link") {
      if (!canWrite) {
        return false;
      }
      const label = selectedText || wikiLinkLocaleText("Link", "Link");
      insertTextUsingSelection(root, `[${label}](https://)`);
      return true;
    }
    return false;
  };

  const openContextMenu = (xInput, yInput) => {
    closeContextMenu();
    const x = Number(xInput) || 0;
    const y = Number(yInput) || 0;
    const menu = ownerDocument.createElement("div");
    menu.className = `yc-editor-context-menu ${root.classList.contains("yc-muya-dark") ? "is-dark" : ""}`.trim();
    menu.style.left = `${Math.max(8, Math.round(x))}px`;
    menu.style.top = `${Math.max(8, Math.round(y))}px`;
    menu.setAttribute("role", "menu");
    menu.tabIndex = -1;

    const menuItems = [
      { id: "copy", label: wikiLinkLocaleText("Copy", "Copy"), disabled: false },
      { id: "cut", label: wikiLinkLocaleText("Cut", "Cut"), disabled: readOnlyState },
      { id: "paste", label: wikiLinkLocaleText("Paste", "Paste"), disabled: readOnlyState },
      { id: "select-all", label: wikiLinkLocaleText("Select All", "Select All"), disabled: false },
      { id: "undo", label: wikiLinkLocaleText("Undo", "Undo"), disabled: readOnlyState },
      { id: "redo", label: wikiLinkLocaleText("Redo", "Redo"), disabled: readOnlyState },
      { id: "insert-wikilink", label: wikiLinkLocaleText("Insert WikiLink", "Insert WikiLink"), disabled: readOnlyState },
      { id: "insert-link", label: wikiLinkLocaleText("Insert Link", "Insert Link"), disabled: readOnlyState }
    ];

    for (const item of menuItems) {
      const button = ownerDocument.createElement("button");
      button.type = "button";
      button.className = "yc-editor-context-item";
      button.textContent = item.label;
      button.disabled = Boolean(item.disabled);
      button.setAttribute("role", "menuitem");
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await runContextMenuCommand(item.id);
        closeContextMenu();
        focus();
      });
      menu.appendChild(button);
    }

    ownerDocument.body.appendChild(menu);
    contextMenuEl = menu;

    contextMenuOutsideHandler = (event) => {
      const target = event?.target;
      if (target instanceof Node && menu.contains(target)) {
        return;
      }
      closeContextMenu();
    };
    contextMenuKeyHandler = (event) => {
      if (String(event?.key || "") === "Escape") {
        event.preventDefault();
        closeContextMenu();
        focus();
      }
    };
    ownerDocument.addEventListener("mousedown", contextMenuOutsideHandler, true);
    ownerDocument.addEventListener("keydown", contextMenuKeyHandler, true);
  };

  const handleJsonChange = () => {
    if (destroyed || suppressChange || typeof onChange !== "function") {
      return;
    }
    onChange(getDoc());
    emitSelectionChange();
    updateWikiLinkAutocomplete();
  };

  muya.on("json-change", handleJsonChange);

  const emitWikiLinkFromSelectionText = () => {
    const selection = getOwnerWindow(root)?.getSelection?.();
    const textNodeType = getOwnerWindow(root)?.Node?.TEXT_NODE ?? 3;
    const anchorNode = selection?.anchorNode;
    if (!selection || !anchorNode || anchorNode.nodeType !== textNodeType || !nodeInsideRoot(root, anchorNode)) {
      return false;
    }
    const lineText = String(anchorNode.textContent || "");
    if (!lineText.includes("[[") || !lineText.includes("]]")) {
      return false;
    }
    const caretOffset = Math.max(0, Number(selection.anchorOffset || 0));
    const matches = [...lineText.matchAll(/\[\[([^\]]+)\]\]/g)];
    const current = matches.find((entry) => {
      const raw = String(entry[0] || "");
      const index = Number(entry.index || 0);
      return caretOffset >= index && caretOffset <= index + raw.length;
    });
    if (!current || typeof onWikiLinkActivate !== "function") {
      return false;
    }
    const raw = String(current[0] || "");
    const parsed = parseWikiLinkRaw(raw);
    onWikiLinkActivate({
      match: {
        raw,
        parsed
      },
      resolution: {
        exists: false
      }
    });
    return true;
  };

  const handleClick = (event) => {
    closeContextMenu();
    const target = event.target;
    if (!(target instanceof Element)) {
      emitWikiLinkFromSelectionText();
      return;
    }
    const link = target.closest("a");
    if (!(link instanceof HTMLAnchorElement) || !root.contains(link)) {
      emitWikiLinkFromSelectionText();
      return;
    }

    const href = String(link.getAttribute("href") || link.href || "").trim();
    if (!href) {
      return;
    }

    const text = String(link.textContent || "").trim();
    if (/^\[\[.*\]\]$/.test(text) && typeof onWikiLinkActivate === "function") {
      event.preventDefault();
      const raw = text.slice(2, -2);
      onWikiLinkActivate({
        match: {
          parsed: {
            raw: text,
            target: raw
          }
        },
        resolution: {
          exists: false
        }
      });
      return;
    }

    if (/^(https?:|mailto:)/i.test(href) && typeof onExternalLinkActivate === "function") {
      event.preventDefault();
      onExternalLinkActivate({
        href,
        text
      });
    }
  };

  root.addEventListener("click", handleClick, true);

  const handleWikiLinkAutocompleteKeydown = (event) => {
    if (!autocompleteState?.items?.length) {
      return;
    }
    const key = String(event?.key || "");
    if (key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      setWikiLinkAutocompleteActive((autocompleteState.selectedIndex || 0) + 1);
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setWikiLinkAutocompleteActive((autocompleteState.selectedIndex || 0) - 1);
      return;
    }
    if (key === "Enter" || key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      void applyWikiLinkSuggestion(autocompleteState.selectedIndex || 0);
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeWikiLinkAutocomplete();
    }
  };

  const handleWikiLinkAutocompleteInput = () => {
    updateWikiLinkAutocomplete();
  };

  root.addEventListener("keydown", handleWikiLinkAutocompleteKeydown, true);
  root.addEventListener("keyup", handleWikiLinkAutocompleteInput, true);
  root.addEventListener("input", handleWikiLinkAutocompleteInput, true);

  const handleContextMenu = (event) => {
    if (!(event instanceof MouseEvent)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    closeWikiLinkAutocomplete();
    openContextMenu(event.clientX, event.clientY);
  };

  root.addEventListener("contextmenu", handleContextMenu, true);

  const focus = () => {
    try {
      muya.focus?.();
    } catch {
      root.focus();
    }
  };

  const setDoc = (nextDocInput) => {
    const next = normalizeMarkdownDocument(nextDocInput);
    if (next === getDoc()) {
      return;
    }
    suppressChange = true;
    try {
      muya.setContent(next, false);
    } finally {
      suppressChange = false;
    }
    emitSelectionChange();
  };

  const setDark = (nextDark) => {
    setMuyaDark(root, nextDark);
    if (autocompleteMenuEl) {
      autocompleteMenuEl.classList.toggle("is-dark", root.classList.contains("yc-muya-dark"));
    }
  };

  const setReadOnly = (nextReadOnly) => {
    readOnlyState = Boolean(nextReadOnly);
    setMuyaReadOnly(root, readOnlyState);
    closeContextMenu();
    if (readOnlyState) {
      closeWikiLinkAutocomplete();
    }
  };

  const setPresentationEnabled = (_nextEnabled) => {
    // Muya does not expose a dedicated source/presentation switch.
  };

  const setCursor = (posInput = 0, { focus: shouldFocus = true } = {}) => {
    const maxLength = getTextLength(root);
    const pos = clamp(Number(posInput) || 0, 0, maxLength);
    const range = createCollapsedRangeAtOffset(root, pos);
    const placed = setSelectionRange(root, range);
    if (placed && shouldFocus) {
      focus();
    }
    return placed;
  };

  const describeTextInsertAtCoords = (xInput, yInput) => placementFromCoords(root, xInput, yInput);

  const setCursorAtCoords = (xInput, yInput, options = {}) => {
    const range = getRangeFromPoint(root, xInput, yInput);
    if (!range) {
      return false;
    }
    range.collapse(true);
    const placed = setSelectionRange(root, range);
    if (placed && options?.focus !== false) {
      focus();
    }
    return placed;
  };

  const insertText = (textInput = "") => {
    if (readOnlyState) {
      return false;
    }
    return insertTextUsingSelection(root, textInput);
  };

  const insertTextAtCoords = (textInput = "", xInput, yInput) => {
    if (readOnlyState) {
      return false;
    }
    const range = getRangeFromPoint(root, xInput, yInput);
    if (!range) {
      return insertText(textInput);
    }
    range.collapse(true);
    setSelectionRange(root, range);
    return insertText(textInput);
  };

  const refreshWikiLinks = () => {
    void getWikiLinkCurrentRelPath;
    void getWikiLinkMarkdownFiles;
    updateWikiLinkAutocomplete();
  };

  const openSearch = () => {
    const query = getOwnerWindow(root)?.prompt?.(wikiLinkLocaleText("Find text", "Find text"), "");
    if (!query) {
      return false;
    }
    try {
      muya.search?.(String(query), { isRegexp: false });
      muya.find?.("next");
      focus();
      return true;
    } catch {
      return false;
    }
  };

  const focusHeading = (payloadInput = null) => {
    const payload = payloadInput && typeof payloadInput === "object"
      ? payloadInput
      : { title: String(payloadInput || "") };
    const headingText = String(payload?.title || "").trim();
    if (!headingText) {
      return false;
    }
    const escaped = escapeRegExp(headingText);
    const pattern = `^#{1,6}\\s+${escaped}(?:\\s+\\{#.*\\})?\\s*$`;
    try {
      muya.search?.(pattern, { isRegexp: true, isCaseSensitive: false });
      muya.find?.("next");
      focus();
      return true;
    } catch {
      return false;
    }
  };

  emitSelectionChange();

  return {
    view: null,
    getDoc,
    setDoc,
    setDark,
    setReadOnly,
    setPresentationEnabled,
    setCursor,
    describeTextInsertAtCoords,
    setCursorAtCoords,
    insertText,
    insertTextAtCoords,
    refreshWikiLinks,
    focusHeading,
    focus,
    openSearch,
    destroy: () => {
      destroyed = true;
      closeContextMenu();
      closeWikiLinkAutocomplete();
      ownerDocument.removeEventListener("selectionchange", handleDocumentSelectionChange, true);
      root.removeEventListener("click", handleClick, true);
      root.removeEventListener("keydown", handleWikiLinkAutocompleteKeydown, true);
      root.removeEventListener("keyup", handleWikiLinkAutocompleteInput, true);
      root.removeEventListener("input", handleWikiLinkAutocompleteInput, true);
      root.removeEventListener("contextmenu", handleContextMenu, true);
      muya.destroy?.();
    }
  };
};

