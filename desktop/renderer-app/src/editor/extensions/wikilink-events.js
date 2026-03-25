import { StateEffect } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { extractWikiLinksFromMarkdown, resolveWikiLink } from "../../utils/wiki-link";

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

const matchAtPos = (entries, posInput) => {
  const pos = Number(posInput || 0);
  return (Array.isArray(entries) ? entries : []).find((entry) => pos >= entry.rawFrom && pos <= entry.rawTo) || null;
};

export const createWikiLinkEventExtensions = ({
  getCurrentRelPath,
  getMarkdownFiles,
  onWikiLinkActivate
} = {}) => {
  let wikiLinkPlugin = null;

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
        if (Number(event.button) !== 0 || !(event.metaKey || event.ctrlKey)) {
          return false;
        }

        const plugin = view.plugin(wikiLinkPlugin);
        if (!plugin) {
          return false;
        }

        const pos = view.posAtCoords({
          x: Number(event.clientX || 0),
          y: Number(event.clientY || 0)
        });
        if (!Number.isFinite(pos)) {
          return false;
        }

        const entry = matchAtPos(plugin.entries, pos);
        if (!entry) {
          return false;
        }

        event.preventDefault();
        event.stopPropagation();
        if (typeof onWikiLinkActivate === "function") {
          onWikiLinkActivate({
            source: "editor",
            clientX: Number(event.clientX || 0),
            clientY: Number(event.clientY || 0),
            match: entry,
            resolution: entry.resolution
          });
        }
        return true;
      }
    }
  });

  return {
    extensions: [wikiLinkPlugin],
    refreshEffect: refreshWikiLinksEffect
  };
};
