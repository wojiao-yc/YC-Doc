import { Prec } from "@codemirror/state";
import { EditorView, ViewPlugin, keymap } from "@codemirror/view";
import { findOpenWikiLinkContext } from "../../utils/wiki-link.js";

const AUTOCOMPLETE_PANEL_GAP = 6;
const AUTOCOMPLETE_MAX_HEIGHT = 720;
const AUTOCOMPLETE_MIN_LIST_HEIGHT = 96;
const AUTOCOMPLETE_VIEWPORT_MARGIN = 12;
const WIKI_LINK_MENU_HINTS = [
  { token: "#", text: "可以链接到标题" },
  { token: "^", text: "链接文本块" },
  { token: "|", text: "指定显示的文本" }
];

const escapeHtml = (valueInput = "") =>
  String(valueInput || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeItems = (itemsInput = []) =>
  (Array.isArray(itemsInput) ? itemsInput : [])
    .filter((item) => item && typeof item === "object" && item.insertText)
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

const renderAutocompleteItemHtml = (item) => {
  const label = escapeHtml(item?.label || "");
  const detail = escapeHtml(item?.detail || "");
  const meta = escapeHtml(item?.meta || "");

  if (String(item?.layout || "") === "preview") {
    return [
      '<span class="yc-wikilink-autocomplete-main-row">',
      `<span class="yc-wikilink-autocomplete-label">${label}</span>`,
      meta ? `<span class="yc-wikilink-autocomplete-meta">${meta}</span>` : "",
      "</span>",
      detail ? `<span class="yc-wikilink-autocomplete-detail">${detail}</span>` : ""
    ].join("");
  }

  if (detail) {
    return `<span class="yc-wikilink-autocomplete-label">${label}</span><span class="yc-wikilink-autocomplete-detail">${detail}</span>`;
  }
  return `<span class="yc-wikilink-autocomplete-label">${label}</span>`;
};

const shouldShowFileSuggestionsForContext = ({ context = null, trigger = null } = {}) => {
  if (!context || context.mode !== "file") {
    return true;
  }

  if (!String(context.noteQuery || "").trim()) {
    return true;
  }

  return Boolean(trigger?.docChanged);
};

const detectWikiLinkAutocompleteContext = (state) => {
  const selection = state?.selection?.main;
  if (!selection?.empty) {
    return null;
  }

  const pos = Number(selection.head || 0);
  const line = state.doc.lineAt(pos);
  const offset = Math.max(0, Math.min(line.length, pos - line.from));
  const context = findOpenWikiLinkContext(String(line.text || ""), offset);
  if (!context || context.aliasQuery) {
    return null;
  }

  return {
    ...context,
    lineFrom: line.from,
    lineTo: line.to,
    from: line.from + context.replaceFrom,
    to: pos
  };
};

export const createWikiLinkAutocompleteExtension = ({
  getSuggestions,
  onSelectSuggestion = null
} = {}) => {
  let autocompletePlugin = null;

  const getAutocompletePlugin = (view) => view.plugin(autocompletePlugin);

  const handleAutocompleteKeydown = (view, event) => {
    const plugin = getAutocompletePlugin(view);
    if (!plugin || !plugin.context || !plugin.items.length) {
      return false;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      return plugin.moveSelection(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      return plugin.moveSelection(-1);
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      return plugin.applySelection();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      plugin.close();
      return true;
    }
    return false;
  };

  autocompletePlugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.context = null;
      this.items = [];
      this.selectedIndex = 0;
      this.renderFrame = 0;
      this.panel = document.createElement("div");
      this.panel.className = "yc-wikilink-autocomplete";
      this.list = document.createElement("div");
      this.list.className = "yc-wikilink-autocomplete-list";
      this.footer = document.createElement("div");
      this.footer.className = "yc-wikilink-autocomplete-footer";
      this.footer.innerHTML = WIKI_LINK_MENU_HINTS
        .map((hint) =>
          `<div class="yc-wikilink-autocomplete-hint"><span class="yc-wikilink-autocomplete-hint-token">${escapeHtml(hint.token)}</span><span class="yc-wikilink-autocomplete-hint-text">${escapeHtml(hint.text)}</span></div>`
        )
        .join("");
      this.panel.append(this.list, this.footer);
      this.panel.style.display = "none";
      document.body.appendChild(this.panel);
      this.updatePanel({ forceResetSelection: true });
    }

    update(update) {
      if (!(update.docChanged || update.selectionSet || update.focusChanged)) {
        return;
      }
      this.updatePanel({
        forceResetSelection: false,
        trigger: update
      });
    }

    destroy() {
      this.cancelRenderFrame();
      this.panel.remove();
    }

    cancelRenderFrame() {
      if (!this.renderFrame) {
        return;
      }
      window.cancelAnimationFrame(this.renderFrame);
      this.renderFrame = 0;
    }

    scheduleRender() {
      this.cancelRenderFrame();
      this.renderFrame = window.requestAnimationFrame(() => {
        this.renderFrame = 0;
        this.renderPanelNow();
      });
    }

    close() {
      this.cancelRenderFrame();
      this.context = null;
      this.items = [];
      this.selectedIndex = 0;
      this.panel.style.display = "none";
      this.list.innerHTML = "";
    }

    ensureSelectedItemVisible(target) {
      if (!target || typeof target.scrollIntoView !== "function") {
        return;
      }
      target.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    }

    positionPanel(coords) {
      const viewportWidth = Math.max(
        Number(window.innerWidth || 0),
        Number(document.documentElement?.clientWidth || 0)
      );
      const viewportHeight = Math.max(
        Number(window.innerHeight || 0),
        Number(document.documentElement?.clientHeight || 0)
      );
      const panelMaxHeight = Math.min(
        AUTOCOMPLETE_MAX_HEIGHT,
        Math.max(180, viewportHeight - AUTOCOMPLETE_VIEWPORT_MARGIN * 2)
      );
      this.panel.style.maxHeight = `${Math.round(panelMaxHeight)}px`;
      const footerHeight = Math.ceil(this.footer.getBoundingClientRect().height || 0);
      const listMaxHeight = Math.max(
        AUTOCOMPLETE_MIN_LIST_HEIGHT,
        panelMaxHeight - footerHeight - 16
      );
      this.list.style.maxHeight = `${Math.round(listMaxHeight)}px`;
      const rect = this.panel.getBoundingClientRect();
      const belowTop = Number(coords?.bottom || 0) + AUTOCOMPLETE_PANEL_GAP;
      const aboveTop = Number(coords?.top || 0) - rect.height - AUTOCOMPLETE_PANEL_GAP;
      const maxLeft = Math.max(
        AUTOCOMPLETE_VIEWPORT_MARGIN,
        viewportWidth - rect.width - AUTOCOMPLETE_VIEWPORT_MARGIN
      );
      const maxTop = Math.max(
        AUTOCOMPLETE_VIEWPORT_MARGIN,
        viewportHeight - rect.height - AUTOCOMPLETE_VIEWPORT_MARGIN
      );
      const left = Math.min(
        Math.max(AUTOCOMPLETE_VIEWPORT_MARGIN, Number(coords?.left || 0)),
        maxLeft
      );
      const fitsBelow = belowTop + rect.height <= viewportHeight - AUTOCOMPLETE_VIEWPORT_MARGIN;
      const fitsAbove = aboveTop >= AUTOCOMPLETE_VIEWPORT_MARGIN;
      const preferredTop = fitsBelow
        ? belowTop
        : (fitsAbove ? aboveTop : Math.min(Math.max(AUTOCOMPLETE_VIEWPORT_MARGIN, belowTop), maxTop));

      this.panel.style.left = `${Math.round(left)}px`;
      this.panel.style.top = `${Math.round(preferredTop)}px`;
    }

    applySelection(indexInput = this.selectedIndex) {
      if (!this.context || !this.items.length) {
        return false;
      }

      const index = Math.max(0, Math.min(this.items.length - 1, Number(indexInput || 0)));
      const item = this.items[index];
      const contextSnapshot = this.context ? { ...this.context } : null;
      const doc = this.view.state.doc;
      const hasClosing = doc.sliceString(this.context.to, Math.min(doc.length, this.context.to + 2)) === "]]";
      const insert = hasClosing ? item.insertText : `${item.insertText}]]`;

      this.view.dispatch({
        changes: {
          from: this.context.from,
          to: this.context.to,
          insert
        },
        selection: {
          anchor: this.context.from + insert.length,
          head: this.context.from + insert.length
        },
        scrollIntoView: true,
        userEvent: "input.complete"
      });

      this.close();
      if (typeof onSelectSuggestion === "function") {
        void Promise.resolve(onSelectSuggestion({
          item,
          context: contextSnapshot
        })).catch(() => {});
      }
      return true;
    }

    moveSelection(delta) {
      if (!this.items.length) {
        return false;
      }
      const length = this.items.length;
      this.selectedIndex = (this.selectedIndex + delta + length) % length;
      this.scheduleRender();
      return true;
    }

    updatePanel({ forceResetSelection = false, trigger = null } = {}) {
      if (!this.view.hasFocus) {
        this.close();
        return;
      }

      const context = detectWikiLinkAutocompleteContext(this.view.state);
      if (!context || typeof getSuggestions !== "function") {
        this.close();
        return;
      }
      if (!shouldShowFileSuggestionsForContext({ context, trigger })) {
        this.close();
        return;
      }

      const items = normalizeItems(getSuggestions({
        query: context.query,
        noteQuery: context.noteQuery,
        headingQuery: context.headingQuery,
        blockQuery: context.blockQuery,
        mode: context.mode
      }));

      if (!items.length) {
        this.close();
        return;
      }

      const sameContext = this.context
        && this.context.from === context.from
        && this.context.to === context.to
        && this.context.query === context.query
        && this.context.mode === context.mode;

      this.context = context;
      this.items = items;
      if (forceResetSelection || !sameContext) {
        this.selectedIndex = 0;
      } else if (this.selectedIndex >= items.length) {
        this.selectedIndex = items.length - 1;
      }
      this.scheduleRender();
    }

    renderPanelNow() {
      if (!this.context || !this.items.length) {
        this.close();
        return;
      }

      const coords = this.view.coordsAtPos(this.context.to);
      if (!coords) {
        this.close();
        return;
      }

      this.panel.style.display = "block";
      this.panel.classList.toggle(
        "is-dark",
        Boolean(document.getElementById("app")?.dataset?.themeMode === "dark")
      );
      this.list.innerHTML = "";
      let selectedButton = null;

      for (let index = 0; index < this.items.length; index += 1) {
        const item = this.items[index];
        const button = document.createElement("button");
        button.type = "button";
        button.className = `yc-wikilink-autocomplete-item ${index === this.selectedIndex ? "is-active" : ""} ${item.tone ? `is-${item.tone}` : ""}`.trim();
        button.innerHTML = renderAutocompleteItemHtml(item);
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.applySelection(index);
        });
        if (index === this.selectedIndex) {
          selectedButton = button;
        }
        this.list.appendChild(button);
      }
      this.ensureSelectedItemVisible(selectedButton);
      this.positionPanel(coords);
    }
  }, {
    eventHandlers: {
      keydown(event, view) {
        return handleAutocompleteKeydown(view, event);
      },
      blur(_event, view) {
        const plugin = getAutocompletePlugin(view);
        plugin?.close();
        return false;
      }
    }
  });

  return [
    autocompletePlugin,
    Prec.highest(
      keymap.of([
        {
          key: "ArrowDown",
          run: (view) => handleAutocompleteKeydown(view, { key: "ArrowDown", preventDefault() {} })
        },
        {
          key: "ArrowUp",
          run: (view) => handleAutocompleteKeydown(view, { key: "ArrowUp", preventDefault() {} })
        },
        {
          key: "Enter",
          run: (view) => handleAutocompleteKeydown(view, { key: "Enter", preventDefault() {} })
        },
        {
          key: "Tab",
          run: (view) => handleAutocompleteKeydown(view, { key: "Tab", preventDefault() {} })
        },
        {
          key: "Escape",
          run: (view) => handleAutocompleteKeydown(view, { key: "Escape", preventDefault() {} })
        }
      ])
    )
  ];
};
