import { marked } from "marked";
import Prism from "prismjs";
import "prismjs/components/prism-markup.js";
import "prismjs/components/prism-css.js";
import "prismjs/components/prism-clike.js";
import "prismjs/components/prism-javascript.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-powershell.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-markdown.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-yaml.js";
import { applyHeadingIdsToHtml } from "./heading-slug.js";
import {
  describeWikiLinkResolution,
  replaceWikiLinksInMarkdown,
  resolveWikiLink
} from "./wiki-link.js";
import { renderAppIconSvgMarkup } from "./app-icon.js";
import { resolveWorkspaceAssetSrc } from "./workspace-media.js";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const encodeAttr = (value) => escapeHtml(String(value || ""));
const CALLOUT_HEAD_PATTERN = /^\s*\[!([A-Za-z][A-Za-z0-9_-]*)\](?:\s+(.*))?$/;
const CALLOUT_LABELS = Object.freeze({
  note: "NOTE",
  tip: "TIP",
  info: "INFO",
  warning: "WARNING",
  caution: "CAUTION",
  danger: "DANGER",
  important: "IMPORTANT"
});
const CALLOUT_ICONS = Object.freeze({
  note: "i",
  tip: "+",
  info: "i",
  warning: "!",
  caution: "!",
  danger: "!",
  important: "!"
});

const normalizeCodeLanguage = (value = "") => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  const normalized = raw.split(/\s+/)[0];
  if (["js", "mjs", "cjs"].includes(normalized)) {
    return "javascript";
  }
  if (["ts", "mts", "cts"].includes(normalized)) {
    return "typescript";
  }
  if (["tsx"].includes(normalized)) {
    return "tsx";
  }
  if (["jsx"].includes(normalized)) {
    return "jsx";
  }
  if (["html", "xml", "svg"].includes(normalized)) {
    return "markup";
  }
  if (["yml"].includes(normalized)) {
    return "yaml";
  }
  if (["sh", "shell", "zsh", "console"].includes(normalized)) {
    return "bash";
  }
  if (["ps1", "pwsh", "powershell"].includes(normalized)) {
    return "powershell";
  }
  if (["py"].includes(normalized)) {
    return "python";
  }
  if (["md"].includes(normalized)) {
    return "markdown";
  }
  return normalized;
};

const normalizeCalloutType = (valueInput = "") =>
  String(valueInput || "note")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    || "note";

const calloutLabelForType = (typeInput = "") => {
  const type = normalizeCalloutType(typeInput);
  return CALLOUT_LABELS[type] || type.toUpperCase();
};

const calloutIconForType = (typeInput = "") => {
  const type = normalizeCalloutType(typeInput);
  return CALLOUT_ICONS[type] || "!";
};

const highlightCodeBlock = (codeInput = "", languageInput = "") => {
  const code = String(codeInput || "");
  const language = normalizeCodeLanguage(languageInput);
  const grammar = language ? Prism.languages[language] : null;
  if (!grammar) {
    return {
      language,
      html: escapeHtml(code)
    };
  }
  return {
    language,
    html: Prism.highlight(code, grammar, language)
  };
};

const resolveMarkedCodeArgs = (codeOrToken, maybeInfoString) => {
  if (codeOrToken && typeof codeOrToken === "object" && !Array.isArray(codeOrToken)) {
    return {
      text: String(codeOrToken.text || ""),
      lang: String(codeOrToken.lang || codeOrToken.language || "")
    };
  }
  return {
    text: String(codeOrToken || ""),
    lang: String(maybeInfoString || "")
  };
};

const createWikiLinkHtml = (parsed, resolution) => {
  const classNames = ["wiki-link", "term-tip-btn"];
  if (resolution.ambiguous) {
    classNames.push("is-ambiguous");
  } else if (!resolution.exists) {
    classNames.push("is-unresolved");
  }

  const target = String(parsed.target || "");
  const anchor = String(parsed.anchor || "");
  const blockRef = String(parsed.blockRef || "");
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
    ` data-wiki-block-ref="${encodeAttr(blockRef)}"`,
    ` data-wiki-alias="${encodeAttr(alias)}"`,
    ` data-wiki-rel-path="${encodeAttr(relPath)}"`,
    ` data-wiki-state="${encodeAttr(resolution.ambiguous ? "ambiguous" : (resolution.exists ? "resolved" : "missing"))}"`,
    ` data-wiki-suggested-rel-path="${encodeAttr(suggestedRelPath)}"`,
    candidates ? ` data-wiki-candidates="${encodeAttr(candidates)}"` : "",
    ` data-tip="${encodeAttr(tooltip)}"`,
    `>${escapeHtml(displayText)}</a>`
  ].join("");
};

const normalizeImageSourcesInHtml = (htmlInput = "", {
  currentRelPath = "",
  workspaceRootPath = ""
} = {}) => {
  const html = String(htmlInput || "");
  return html.replace(/src="([^"]+)"/g, (match, src) => {
    const normalized = resolveWorkspaceAssetSrc(src, {
      currentRelPath,
      workspaceRootPath
    });
    if (!normalized || normalized === src) {
      return match;
    }
    return `src="${encodeAttr(normalized)}"`;
  });
};

const ensureImageClass = (htmlInput = "") => String(htmlInput || "").replace(/<img\b/g, '<img class="md-image"');

const wrapTablesInHtml = (htmlInput = "") =>
  String(htmlInput || "")
    .replace(/<table>/g, '<div class="md-table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");

const decorateCalloutBlockquotesInHtml = (htmlInput = "") =>
  String(htmlInput || "").replace(
    /<blockquote>\s*<p>([\s\S]*?)<\/p>\s*([\s\S]*?)<\/blockquote>/g,
    (match, firstParagraphRaw, bodyRaw) => {
      const firstParagraph = String(firstParagraphRaw || "").trim();
      const firstParagraphParts = firstParagraph
        .split(/<br\s*\/?>/gi)
        .map((part) => String(part || "").trim());
      const markerOnly = String(firstParagraphParts[0] || "").replace(/<[^>]*>/g, "").trim();
      const headMatch = markerOnly.match(CALLOUT_HEAD_PATTERN);
      if (!headMatch) {
        return match;
      }

      const calloutType = normalizeCalloutType(headMatch[1]);
      const calloutLabel = calloutLabelForType(calloutType);
      const calloutIcon = calloutIconForType(calloutType);
      const title = String(headMatch[2] || "").trim();
      const firstParagraphBody = firstParagraphParts.slice(1).join("<br>").trim();
      const extraBody = String(bodyRaw || "").trim();
      const body = [
        firstParagraphBody ? `<p>${firstParagraphBody}</p>` : "",
        extraBody
      ]
        .filter(Boolean)
        .join("");

      const titleHtml = title
        ? `<span class="md-callout-subtitle">${escapeHtml(title)}</span>`
        : "";

      return [
        `<div class="md-callout md-callout-${encodeAttr(calloutType)}">`,
        '<div class="md-callout-head">',
        `<span class="md-callout-icon" aria-hidden="true">${escapeHtml(calloutIcon)}</span>`,
        `<span class="md-callout-title">${escapeHtml(calloutLabel)}</span>`,
        titleHtml,
        "</div>",
        body ? `<div class="md-callout-body">${body}</div>` : "",
        "</div>"
      ].join("");
    }
  );

const applyHighlightMarkSyntax = (htmlInput = "") => {
  const html = String(htmlInput || "");
  if (!html || !html.includes("==")) {
    return html;
  }

  const protectedBlocks = [];
  const withPlaceholders = html.replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const index = protectedBlocks.push(match) - 1;
    return `\u0000HTML_MARK_${index}\u0000`;
  });

  const withMarks = withPlaceholders.replace(/==(?=\S)([\s\S]*?\S)==/g, "<mark>$1</mark>");
  return withMarks.replace(/\u0000HTML_MARK_(\d+)\u0000/g, (_, indexText) => {
    const index = Number(indexText);
    if (!Number.isFinite(index) || index < 0 || index >= protectedBlocks.length) {
      return "";
    }
    return protectedBlocks[index] || "";
  });
};

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
  workspaceRootPath = "",
  renderMathFormula = null
} = {}) => {
  const rawMarkdown = String(markdown || "");
  const withWikiLinks = replaceWikiLinksInMarkdown(rawMarkdown, (match) => {
    const resolution = resolveWikiLink(match.parsed, currentRelPath, markdownFiles);
    return createWikiLinkHtml(match.parsed, resolution);
  });

  const withMath = preprocessMathFormulas(withWikiLinks, renderMathFormula);
  const renderer = new marked.Renderer();
  renderer.code = (codeOrToken, maybeInfoString) => {
    const { text, lang } = resolveMarkedCodeArgs(codeOrToken, maybeInfoString);
    const { language, html } = highlightCodeBlock(text, lang);
    const languageClass = language ? `language-${encodeAttr(language)}` : "";
    const preClass = ` class="md-code-block${languageClass ? ` ${languageClass}` : ""}"`;
    const codeClass = languageClass ? ` class="${languageClass}"` : "";
    const legacyCopyButton = [
      '<div class="md-code-actions">',
      '<button type="button" class="md-code-action-trigger" aria-label="代码操作">',
      '<span class="md-code-action-trigger-dots" aria-hidden="true"></span>',
      "</button>",
      '<div class="md-code-action-menu" role="menu">',
      '<button type="button" class="md-code-copy-btn" data-copy-code aria-label="复制代码" role="menuitem">',
      '<span class="md-code-copy-icon" aria-hidden="true"></span>',
      '<span class="md-code-copy-label">复制代码</span>',
      "</button>",
      "</div>",
      "</div>"
    ].join("");
    void legacyCopyButton;
    const copyButton = [
      '<div class="md-code-actions">',
      '<button type="button" class="md-code-copy-btn" data-copy-code aria-label="\u590d\u5236\u4ee3\u7801">',
      renderAppIconSvgMarkup("copy", "md-code-copy-icon-svg"),
      "</button>",
      "</div>"
    ].join("");
    return `<pre${preClass}>${copyButton}<code${codeClass}>${html}</code></pre>`;
  };
  const parsed = String(marked.parse(withMath, {
    breaks: true,
    gfm: true,
    renderer
  }) || "");

  const withHighlights = applyHighlightMarkSyntax(parsed);
  const withCallouts = decorateCalloutBlockquotesInHtml(withHighlights);
  const withTables = wrapTablesInHtml(withCallouts);
  const withHeadingIds = applyHeadingIdsToHtml(withTables, rawMarkdown);
  return ensureImageClass(normalizeImageSourcesInHtml(withHeadingIds, {
    currentRelPath,
    workspaceRootPath
  }));
};
