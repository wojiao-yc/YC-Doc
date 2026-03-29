import { marked } from "marked";
import { applyHeadingIdsToHtml } from "./heading-slug.js";
import {
  describeWikiLinkResolution,
  replaceWikiLinksInMarkdown,
  resolveWikiLink
} from "./wiki-link.js";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const encodeAttr = (value) => escapeHtml(String(value || ""));

const createWikiLinkHtml = (parsed, resolution) => {
  const classNames = ["wiki-link"];
  if (resolution.ambiguous) {
    classNames.push("is-ambiguous");
  } else if (!resolution.exists) {
    classNames.push("is-unresolved");
  }

  const target = String(parsed.target || "");
  const anchor = String(parsed.anchor || "");
  const alias = String(parsed.alias || "");
  const displayText = String(resolution.displayText || parsed.displayText || target || alias || parsed.raw || "");
  const relPath = String(resolution.relPath || "");
  const suggestedRelPath = String(resolution.suggestedRelPath || "");
  const tooltip = describeWikiLinkResolution(resolution);
  const candidates = Array.isArray(resolution.candidates) ? resolution.candidates.join("|") : "";

  return [
    `<a href="#"`,
    ` class="${classNames.join(" ")}"`,
    ` data-wiki-target="${encodeAttr(target)}"`,
    ` data-wiki-anchor="${encodeAttr(anchor)}"`,
    ` data-wiki-alias="${encodeAttr(alias)}"`,
    ` data-wiki-rel-path="${encodeAttr(relPath)}"`,
    ` data-wiki-state="${encodeAttr(resolution.ambiguous ? "ambiguous" : (resolution.exists ? "resolved" : "missing"))}"`,
    ` data-wiki-suggested-rel-path="${encodeAttr(suggestedRelPath)}"`,
    candidates ? ` data-wiki-candidates="${encodeAttr(candidates)}"` : "",
    ` title="${encodeAttr(tooltip)}"`,
    `>${escapeHtml(displayText)}</a>`
  ].join("");
};

const normalizeImageSourcesInHtml = (htmlInput = "") => {
  const html = String(htmlInput || "");
  return html.replace(/src="([^"]+)"/g, (match, src) => {
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return match;
    }
    if (src.startsWith("file:///") || src.startsWith("file://localhost/")) {
      return match;
    }
    if (src.startsWith("file://")) {
      return `src="file:///${src.slice(7)}"`;
    }
    if (/^\/?[A-Za-z]:[/\\]/.test(src)) {
      let filePath = src.replace(/^\/+/, "");
      filePath = filePath.replace(/\\/g, "/");
      return `src="file:///${filePath}"`;
    }
    return match;
  });
};

const ensureImageClass = (htmlInput = "") => String(htmlInput || "").replace(/<img\b/g, '<img class="md-image"');

const preprocessMathFormulas = (markdownInput = "", renderMathFormula = null) => {
  const markdown = String(markdownInput || "");
  if (!markdown) {
    return "";
  }

  let result = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const trimmed = String(formula || "").trim();
    if (!trimmed || typeof renderMathFormula !== "function") {
      return match;
    }
    return `<div class="math-block">${renderMathFormula(trimmed, true)}</div>`;
  });

  result = result.replace(/\$([^$\n]+?)\$/g, (match, formula) => {
    const trimmed = String(formula || "").trim();
    if (!trimmed || typeof renderMathFormula !== "function") {
      return match;
    }
    return `<span class="math-inline">${renderMathFormula(trimmed, false)}</span>`;
  });

  return result;
};

export const renderMarkdownToHtml = ({
  markdown = "",
  currentRelPath = "",
  markdownFiles = [],
  renderMathFormula = null
} = {}) => {
  const rawMarkdown = String(markdown || "");
  const withWikiLinks = replaceWikiLinksInMarkdown(rawMarkdown, (match) => {
    const resolution = resolveWikiLink(match.parsed, currentRelPath, markdownFiles);
    return createWikiLinkHtml(match.parsed, resolution);
  });

  const withMath = preprocessMathFormulas(withWikiLinks, renderMathFormula);
  const parsed = String(marked.parse(withMath, {
    breaks: true,
    gfm: true,
    renderer: new marked.Renderer()
  }) || "");

  const withHeadingIds = applyHeadingIdsToHtml(parsed, rawMarkdown);
  return ensureImageClass(normalizeImageSourcesInHtml(withHeadingIds));
};
