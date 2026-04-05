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
import { resolveWorkspaceAssetSrc } from "./workspace-media.js";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const encodeAttr = (value) => escapeHtml(String(value || ""));

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
  const classNames = ["wiki-link"];
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
    ` title="${encodeAttr(tooltip)}"`,
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
    const preClass = languageClass ? ` class="${languageClass}"` : "";
    const codeClass = languageClass ? ` class="${languageClass}"` : "";
    return `<pre${preClass}><code${codeClass}>${html}</code></pre>`;
  };
  const parsed = String(marked.parse(withMath, {
    breaks: true,
    gfm: true,
    renderer
  }) || "");

  const withHeadingIds = applyHeadingIdsToHtml(parsed, rawMarkdown);
  return ensureImageClass(normalizeImageSourcesInHtml(withHeadingIds, {
    currentRelPath,
    workspaceRootPath
  }));
};
