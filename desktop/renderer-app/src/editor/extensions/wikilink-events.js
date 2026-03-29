import { Prec, StateEffect } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, keymap } from "@codemirror/view";
import { extractWikiLinksFromMarkdown, resolveWikiLink } from "../../utils/wiki-link.js";
import { resolveEditorLinkActivation } from "../runtime/link-activation.js";

const clampPos = (value, length) => Math.max(0, Math.min(Number(length || 0), Number(value || 0)));

const refreshWikiLinksEffect = StateEffect.define();

const updateHasEffect = (update, effectType) =>
  Boolean(update?.transactions?.some((transaction) =>
    Array.isArray(transaction?.effects) && transaction.effects.some((effect) => effect.is(effectType))
  ));

const classNameForResolution = (resolution) => {
  if (resolution?.ambiguous) {
    return "cm-wiki-link cm-wiki-link-ambiguous";
  }
  if (resolution?.exists) {
    return "cm-wiki-link cm-wiki-link-resolved";
  }
  return "cm-wiki-link cm-wiki-link-missing";
};

const titleForResolution = (resolution) => {
  if (resolution?.ambiguous) {
    const candidates = Array.isArray(resolution?.candidates) ? resolution.candidates : [];
    return candidates.length ? `Multiple matches: ${candidates.join(", ")}` : "Multiple matches";
  }
  if (resolution?.exists) {
    const anchor = String(resolution?.anchor || "").trim();
    return anchor ? `Open ${resolution.relPath} # ${anchor}` : `Open ${resolution.relPath}`;
  }
  const suggested = String(resolution?.suggestedRelPath || "").trim();
  return suggested ? `Missing note. Click to create ${suggested}` : "Missing note";
};

const buildWikiLinkEntries = (docText, getCurrentRelPath, getMarkdownFiles) => {
  const currentRelPath = typeof getCurrentRelPath === "function" ? String(getCurrentRelPath() || "") : "";
  const markdownFiles = typeof getMarkdownFiles === "function" ? getMarkdownFiles() : [];
  return extractWikiLinksFromMarkdown(String(docText || "")).map((match) => {
    const resolution = resolveWikiLink(match.parsed, currentRelPath, markdownFiles);
    return {
      ...match,
      resolution
    };
  });
};

const buildWikiLinkDecorations = (entries, docLength) => {
  const decorations = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const from = clampPos(entry?.rawFrom, docLength);
    const to = clampPos(entry?.rawTo, docLength);
    if (to <= from) {
      continue;
    }
    decorations.push(
      Decoration.mark({
        class: classNameForResolution(entry?.resolution),
        attributes: {
          title: titleForResolution(entry?.resolution)
        }
      }).range(from, to)
    );
  }
  try {
    return Decoration.set(decorations, true);
  } catch {
    return Decoration.none;
  }
};

export const createWikiLinkEventExtensions = ({
  getCurrentRelPath,
  getMarkdownFiles,
  onWikiLinkActivate,
  onExternalLinkActivate
} = {}) => {
  let wikiLinkPlugin = null;

  const activateResolvedLink = (activation, payload = {}) => {
    if (!activation) {
      return false;
    }

    const source = String(payload?.source || "editor");
    const clientX = Number(payload?.clientX || 0);
    const clientY = Number(payload?.clientY || 0);

    if (activation.type === "wiki") {
      if (typeof onWikiLinkActivate !== "function") {
        return false;
      }
      onWikiLinkActivate({
        source,
        clientX,
        clientY,
        match: activation.match,
        resolution: activation.resolution
      });
      return true;
    }

    if (activation.type === "external") {
      if (typeof onExternalLinkActivate !== "function") {
        return false;
      }
      onExternalLinkActivate({
        source,
        clientX,
        clientY,
        href: activation.href,
        title: activation.title,
        text: activation.text,
        token: activation.token
      });
      return true;
    }

    return false;
  };

  const resolveActivationForSelection = (view, selection = null) =>
    resolveEditorLinkActivation({
      markdown: view.state.doc.toString(),
      selection: selection || view.state.selection.main,
      currentRelPath: typeof getCurrentRelPath === "function" ? getCurrentRelPath() : "",
      markdownFiles: typeof getMarkdownFiles === "function" ? getMarkdownFiles() : []
    });

  const isKeyboardActivationEvent = (event) => {
    if (!event || event.defaultPrevented || event.isComposing) {
      return false;
    }
    if (event.key !== "Enter") {
      return false;
    }
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) {
      return false;
    }
    return true;
  };

  const runKeyboardActivation = (view) => {
    const activation = resolveActivationForSelection(view);
    return activateResolvedLink(activation, {
      source: "editor-keyboard"
    });
  };

  wikiLinkPlugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.entries = buildWikiLinkEntries(view.state.doc.toString(), getCurrentRelPath, getMarkdownFiles);
      this.decorations = buildWikiLinkDecorations(this.entries, view.state.doc.length);
    }

    update(update) {
      if (!update.docChanged && !updateHasEffect(update, refreshWikiLinksEffect)) {
        return;
      }
      this.entries = buildWikiLinkEntries(update.state.doc.toString(), getCurrentRelPath, getMarkdownFiles);
      this.decorations = buildWikiLinkDecorations(this.entries, update.state.doc.length);
    }
  }, {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      mousedown: (event, view) => {
        if (event.target instanceof Element && view?.contentDOM instanceof Element && !view.contentDOM.contains(event.target)) {
          return false;
        }
        if (Number(event.button) !== 0 || !(event.metaKey || event.ctrlKey)) {
          return false;
        }

        const pos = view.posAtCoords({
          x: Number(event.clientX || 0),
          y: Number(event.clientY || 0)
        });
        if (!Number.isFinite(pos)) {
          return false;
        }

        const activation = resolveActivationForSelection(view, { anchor: pos, head: pos });
        if (!activation) {
          return false;
        }

        if (!activateResolvedLink(activation, {
          source: "editor",
          clientX: Number(event.clientX || 0),
          clientY: Number(event.clientY || 0)
        })) {
          return false;
        }

        event.preventDefault();
        event.stopPropagation();
        return true;
      },
      keydown: (event, view) => {
        if (event.target instanceof Element && view?.contentDOM instanceof Element && !view.contentDOM.contains(event.target)) {
          return false;
        }
        if (!isKeyboardActivationEvent(event)) {
          return false;
        }

        const activation = resolveActivationForSelection(view);
        if (!activateResolvedLink(activation, {
          source: "editor-keyboard"
        })) {
          return false;
        }

        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    }
  });

  return {
    extensions: [
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: runKeyboardActivation
          },
          {
            key: "Ctrl-Enter",
            run: runKeyboardActivation
          },
          {
            key: "Cmd-Enter",
            run: runKeyboardActivation
          }
        ])
      ),
      wikiLinkPlugin
    ],
    refreshEffect: refreshWikiLinksEffect
  };
};
