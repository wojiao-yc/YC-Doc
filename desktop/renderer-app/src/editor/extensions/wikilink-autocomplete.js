import { EditorView, ViewPlugin } from "@codemirror/view";
import { findOpenWikiLinkContext } from "../../utils/wiki-link";

const MAX_ITEMS = 8;

const normalizeItems = (itemsInput = []) =>
  (Array.isArray(itemsInput) ? itemsInput : [])
    .filter((item) => item && typeof item === "object" && item.insertText)
    .slice(0, MAX_ITEMS)
    .map((item, index) => ({
      id: String(item.id || `wikilink-item-${index}`),
      label: String(item.label || item.insertText || ""),
      detail: String(item.detail || ""),
      insertText: String(item.insertText || ""),
      tone: String(item.tone || "default")
    }));

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
  getSuggestions
} = {}) => {
  let autocompletePlugin = null;

  autocompletePlugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.context = null;
      this.items = [];
      this.selectedIndex = 0;
      this.renderFrame = 0;
      this.panel = document.createElement("div");
      this.panel.className = "yc-wikilink-autocomplete";
      this.panel.style.display = "none";
      document.body.appendChild(this.panel);
      this.updatePanel(true);
    }

    update(update) {
      if (!(update.docChanged || update.selectionSet || update.focusChanged)) {
        return;
      }
      this.updatePanel(false);
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
      this.panel.innerHTML = "";
    }

    applySelection(indexInput = this.selectedIndex) {
      if (!this.context || !this.items.length) {
        return false;
      }

      const index = Math.max(0, Math.min(this.items.length - 1, Number(indexInput || 0)));
      const item = this.items[index];
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

    updatePanel(forceResetSelection) {
      if (!this.view.hasFocus) {
        this.close();
        return;
      }

      const context = detectWikiLinkAutocompleteContext(this.view.state);
      if (!context || typeof getSuggestions !== "function") {
        this.close();
        return;
      }

      const items = normalizeItems(getSuggestions({
        query: context.query,
        noteQuery: context.noteQuery,
        headingQuery: context.headingQuery,
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
      this.panel.style.left = `${Math.round(coords.left)}px`;
      this.panel.style.top = `${Math.round(coords.bottom + 6)}px`;
      this.panel.classList.toggle(
        "is-dark",
        Boolean(document.getElementById("app")?.classList.contains("dark-ui"))
      );
      this.panel.innerHTML = "";

      for (let index = 0; index < this.items.length; index += 1) {
        const item = this.items[index];
        const button = document.createElement("button");
        button.type = "button";
        button.className = `yc-wikilink-autocomplete-item ${index === this.selectedIndex ? "is-active" : ""} ${item.tone ? `is-${item.tone}` : ""}`.trim();
        button.innerHTML = item.detail
          ? `<span class="yc-wikilink-autocomplete-label">${item.label}</span><span class="yc-wikilink-autocomplete-detail">${item.detail}</span>`
          : `<span class="yc-wikilink-autocomplete-label">${item.label}</span>`;
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.applySelection(index);
        });
        this.panel.appendChild(button);
      }
    }
  }, {
    eventHandlers: {
      keydown(event, view) {
        const plugin = view.plugin(autocompletePlugin);
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
      },
      blur(_event, view) {
        const plugin = view.plugin(autocompletePlugin);
        plugin?.close();
        return false;
      }
    }
  });

  return autocompletePlugin;
};
