import { marked } from "marked";
import { escapeHtml } from "./escapeHtml";

const normalizeMarkdownText = (value) => String(value || "").replace(/\r\n/g, "\n");
const trimOuterBlankLines = (value) => String(value || "").replace(/^\n+/, "").replace(/\n+$/, "");
const readSourceUnitMarkdown = (node) =>
  normalizeMarkdownText(
    String(
      typeof node?.innerText === "string"
        ? node.innerText
        : (node?.textContent || "")
    )
  )
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "");
const getStoredMarkdown = (node) => normalizeMarkdownText(String(node?.getAttribute?.("data-md-raw") || ""));
const buildMarkdownAttr = (raw) => {
  const markdown = normalizeMarkdownText(raw);
  return markdown ? ` data-md-raw="${escapeHtml(markdown)}"` : "";
};
const MARKED_OPTIONS = Object.freeze({
  breaks: true,
  gfm: true
});

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "PRE",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "HR"
]);

const normalizeInlineText = (value) =>
  normalizeMarkdownText(value)
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "");

const wrapInlineCode = (value) => {
  const text = normalizeInlineText(value);
  const ticks = text.match(/`+/g) || [];
  const maxTickCount = ticks.reduce((max, item) => Math.max(max, item.length), 0);
  const fence = "`".repeat(maxTickCount + 1);
  const needsPad = text.startsWith("`") || text.endsWith("`");
  return `${fence}${needsPad ? " " : ""}${text}${needsPad ? " " : ""}${fence}`;
};

const serializeTable = (tableNode) => {
  const rows = Array.from(tableNode.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.children)
        .filter((cell) => ["TH", "TD"].includes(cell.tagName))
        .map((cell) => normalizeInlineText(cell.textContent || "").replace(/\|/g, "\\|").trim())
    )
    .filter((row) => row.length);

  if (!rows.length) {
    return "";
  }

  const header = rows[0];
  const divider = header.map(() => "---");
  const body = rows.slice(1);
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`)
  ];
  return lines.join("\n");
};

export const normalizeImageHref = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const isDesktop = typeof window !== "undefined" && Boolean(window.desktopPty?.isDesktop);

  const toDesktopImageUrl = (absolutePath) => {
    const full = String(absolutePath || "").trim();
    if (!full) {
      return "";
    }
    if (!isDesktop) {
      const unixPath = full.replace(/\\/g, "/");
      return `file:///${encodeURI(unixPath)}`;
    }
    return `ycdoc-file://local/${encodeURIComponent(full)}`;
  };

  if (/^[a-zA-Z]:[\\/]/.test(raw)) {
    return toDesktopImageUrl(raw);
  }

  if (/^\\\\/.test(raw)) {
    return `file:${encodeURI(raw.replace(/\\/g, "/"))}`;
  }

  if (/^(https?:|data:|blob:|file:|app:)/i.test(raw)) {
    if (/^file:/i.test(raw)) {
      try {
        const decodedRaw = decodeURI(raw);
        if (isDesktop) {
          const parsed = new URL(decodedRaw);
          let localPath = decodeURIComponent(parsed.pathname || "");
          if (/^\/[a-zA-Z]:\//.test(localPath)) {
            localPath = localPath.slice(1);
          }
          localPath = localPath.replace(/\//g, "\\");
          return toDesktopImageUrl(localPath);
        }
        return encodeURI(decodedRaw);
      } catch {
        return encodeURI(raw);
      }
    }
    return raw;
  }

  if (raw.includes("\\") && !raw.includes("://")) {
    return raw.replace(/\\/g, "/");
  }

  return raw;
};

const attachMarkdownAttrToHtml = (html, raw) => {
  const content = String(html || "").trim();
  const markdown = normalizeMarkdownText(raw);
  if (!content || !markdown || typeof document === "undefined") {
    return content;
  }
  const temp = document.createElement("div");
  temp.innerHTML = content;
  if (temp.childNodes.length === 1 && temp.firstElementChild instanceof HTMLElement) {
    temp.firstElementChild.setAttribute("data-md-raw", markdown);
    return temp.innerHTML.trim();
  }
  return content;
};

const buildLinkMarkdown = (label, href, title) => {
  const safeHref = String(href || "").trim();
  if (!safeHref) {
    return String(label || "");
  }
  const safeLabel = String(label || safeHref);
  const titleSuffix = title ? ` "${String(title)}"` : "";
  return `[${safeLabel}](${safeHref}${titleSuffix})`;
};

const buildImageMarkdown = (alt, src, title) => {
  const safeSrc = String(src || "").trim();
  if (!safeSrc) {
    return "";
  }
  const titleSuffix = title ? ` "${String(title)}"` : "";
  return `![${String(alt || "")}](${safeSrc}${titleSuffix})`;
};

const findLooseInlineMarkdownMatch = (source, startIndex = 0) => {
  const text = String(source || "");
  const patterns = [
    { type: "strong", regex: /\*\*([^\s*\n](?:[^\n]*?[^\s*\n])?)\*\*/g },
    { type: "del", regex: /~~([^\s~\n](?:[^\n]*?[^\s~\n])?)~~/g },
    { type: "code", regex: /`([^`\n]+?)`/g },
    { type: "em", regex: /\*([^\s*\n](?:[^*\n]*?[^\s*\n])?)\*/g }
  ];

  let bestMatch = null;

  patterns.forEach(({ type, regex }) => {
    regex.lastIndex = Math.max(0, Number(startIndex || 0));
    const match = regex.exec(text);
    if (!match?.[0]) {
      return;
    }
    if (!bestMatch || match.index < bestMatch.index) {
      bestMatch = {
        type,
        index: match.index,
        raw: match[0],
        inner: match[1] || ""
      };
    }
  });

  return bestMatch;
};

const renderLooseInlineTextMarkdown = (value) => {
  const source = String(value || "");
  if (!source) {
    return "";
  }

  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    const match = findLooseInlineMarkdownMatch(source, cursor);
    if (!match) {
      output += escapeHtml(source.slice(cursor));
      break;
    }

    if (match.index > cursor) {
      output += escapeHtml(source.slice(cursor, match.index));
    }

    if (match.type === "code") {
      output += `<code${buildMarkdownAttr(match.raw)}>${escapeHtml(match.inner)}</code>`;
    } else if (match.type === "strong") {
      output += `<strong${buildMarkdownAttr(match.raw)}>${renderLooseInlineTextMarkdown(match.inner)}</strong>`;
    } else if (match.type === "del") {
      output += `<del${buildMarkdownAttr(match.raw)}>${renderLooseInlineTextMarkdown(match.inner)}</del>`;
    } else if (match.type === "em") {
      output += `<em${buildMarkdownAttr(match.raw)}>${renderLooseInlineTextMarkdown(match.inner)}</em>`;
    } else {
      output += escapeHtml(match.raw);
    }

    cursor = match.index + match.raw.length;
  }

  return output;
};

const renderFallbackBlockTokenToHtml = (token) =>
  attachMarkdownAttrToHtml(String(marked.parser([token], MARKED_OPTIONS) || "").trim(), token?.raw || "");

const renderInlineTokensToHtml = (tokens) =>
  (Array.isArray(tokens) ? tokens : []).map((token) => {
    if (!token || typeof token !== "object") {
      return "";
    }

    if (token.type === "escape") {
      return escapeHtml(String(token.text || ""));
    }

    if (token.type === "text") {
      return renderLooseInlineTextMarkdown(String(token.text || ""));
    }

    if (token.type === "html") {
      return String(token.raw || token.text || "");
    }

    if (token.type === "strong") {
      return `<strong${buildMarkdownAttr(token.raw)}>${renderInlineTokensToHtml(token.tokens || [])}</strong>`;
    }

    if (token.type === "em") {
      return `<em${buildMarkdownAttr(token.raw)}>${renderInlineTokensToHtml(token.tokens || [])}</em>`;
    }

    if (token.type === "del") {
      return `<del${buildMarkdownAttr(token.raw)}>${renderInlineTokensToHtml(token.tokens || [])}</del>`;
    }

    if (token.type === "codespan") {
      return `<code${buildMarkdownAttr(token.raw)}>${escapeHtml(String(token.text || ""))}</code>`;
    }

    if (token.type === "br") {
      return `<br${buildMarkdownAttr(token.raw)} />`;
    }

    if (token.type === "link") {
      const href = String(token.href || "").trim();
      const label = renderInlineTokensToHtml(token.tokens || []);
      if (!href) {
        return label;
      }
      const safeHref = escapeHtml(href);
      const safeTitle = token.title ? ` title="${escapeHtml(String(token.title))}"` : "";
      const markdownAttr = token.raw
        ? buildMarkdownAttr(token.raw)
        : buildMarkdownAttr(buildLinkMarkdown(String(token.text || ""), href, token.title));
      return `<a href="${safeHref}" data-md-href="${safeHref}"${markdownAttr}${safeTitle}>${label}</a>`;
    }

    if (token.type === "image") {
      const rawSrc = String(token.href || "").trim();
      const normalized = normalizeImageHref(rawSrc);
      if (!normalized) {
        return "";
      }
      const safeSrc = escapeHtml(normalized);
      const safeRawSrc = escapeHtml(rawSrc);
      const safeAlt = escapeHtml(String(token.text || ""));
      const safeTitle = token.title ? ` title="${escapeHtml(String(token.title))}"` : "";
      const markdownAttr = token.raw
        ? buildMarkdownAttr(token.raw)
        : buildMarkdownAttr(buildImageMarkdown(token.text, rawSrc, token.title));
      return `<img src="${safeSrc}" alt="${safeAlt}" data-md-src="${safeRawSrc}"${markdownAttr} loading="lazy"${safeTitle} />`;
    }

    return escapeHtml(String(token.raw || token.text || ""));
  }).join("");

const renderListItemTokensToHtml = (tokens, { loose = false } = {}) =>
  (Array.isArray(tokens) ? tokens : []).map((token) => {
    if (!token || typeof token !== "object") {
      return "";
    }

    if (token.type === "space") {
      return "";
    }

    if (token.type === "text") {
      const content = renderInlineTokensToHtml(token.tokens || [{ type: "text", text: token.text || "", raw: token.raw || "" }]);
      return loose ? `<p${buildMarkdownAttr(token.raw)}>${content || "<br />"}</p>` : (content || "<br />");
    }

    if (token.type === "paragraph") {
      const content = renderInlineTokensToHtml(token.tokens || []);
      return loose ? `<p${buildMarkdownAttr(token.raw)}>${content || "<br />"}</p>` : (content || "<br />");
    }

    return renderFallbackBlockTokenToHtml(token);
  }).join("");

const renderBlockTokensToHtml = (tokens) =>
  (Array.isArray(tokens) ? tokens : []).map((token) => {
    if (!token || typeof token !== "object") {
      return "";
    }

    if (token.type === "space") {
      return "";
    }

    if (token.type === "heading") {
      const depth = Math.max(1, Math.min(6, Number(token.depth || 1)));
      const content = renderInlineTokensToHtml(token.tokens || []);
      return `<h${depth}${buildMarkdownAttr(token.raw)}>${content || "<br />"}</h${depth}>`;
    }

    if (token.type === "paragraph") {
      const content = renderInlineTokensToHtml(token.tokens || []);
      return `<p${buildMarkdownAttr(token.raw)}>${content || "<br />"}</p>`;
    }

    if (token.type === "text") {
      const content = renderInlineTokensToHtml(token.tokens || [{ type: "text", text: token.text || "", raw: token.raw || "" }]);
      return `<p${buildMarkdownAttr(token.raw)}>${content || "<br />"}</p>`;
    }

    if (token.type === "blockquote") {
      const content = renderBlockTokensToHtml(token.tokens || []);
      return `<blockquote${buildMarkdownAttr(token.raw)}>${content || "<p><br /></p>"}</blockquote>`;
    }

    if (token.type === "list") {
      const tagName = token.ordered ? "ol" : "ul";
      const body = (Array.isArray(token.items) ? token.items : []).map((item) => {
        const checkbox = item?.task
          ? `<input ${item.checked ? 'checked="" ' : ""}disabled="" type="checkbox"> `
          : "";
        const content = renderListItemTokensToHtml(item?.tokens || [], { loose: Boolean(item?.loose || token.loose) });
        return `<li${buildMarkdownAttr(item?.raw)}>${checkbox}${content || "<br />"}</li>`;
      }).join("");
      return `<${tagName}${buildMarkdownAttr(token.raw)}>${body}</${tagName}>`;
    }

    if (token.type === "hr") {
      return `<hr${buildMarkdownAttr(token.raw || "---")} />`;
    }

    if (token.type === "code") {
      const text = normalizeMarkdownText(String(token.text || "")).replace(/\n$/, "");
      const lang = String(token.lang || "").trim();
      const safeLang = escapeHtml(lang);
      const safeCode = escapeHtml(text);
      const langAttr = safeLang ? ` data-code-lang="${safeLang}"` : "";
      const classAttr = safeLang ? ` class="language-${safeLang}"` : "";
      return `<pre${buildMarkdownAttr(token.raw)}${langAttr}><code${classAttr}>${safeCode}</code></pre>`;
    }

    return renderFallbackBlockTokenToHtml(token);
  }).join("");

const serializeImageNode = (node) => {
  const src = String(node.getAttribute("data-md-src") || node.getAttribute("src") || "").trim();
  if (!src) {
    return "";
  }
  const alt = String(node.getAttribute("alt") || "");
  return `![${alt}](${src})`;
};

const serializeInlineNodes = (nodes) =>
  nodes
    .map((node) => {
      if (!node) {
        return "";
      }
      if (node.nodeType === Node.TEXT_NODE) {
        return normalizeInlineText(node.textContent || "");
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const tag = node.tagName.toUpperCase();

      if (node.getAttribute?.("data-md-source-inline") === "1") {
        return readSourceUnitMarkdown(node);
      }
      if (node.hasAttribute?.("data-md-raw")) {
        return getStoredMarkdown(node);
      }

      const children = serializeInlineNodes(Array.from(node.childNodes || []));

      if (tag === "BR") {
        return "\n";
      }
      if (tag === "STRONG" || tag === "B") {
        return `**${children}**`;
      }
      if (tag === "EM" || tag === "I") {
        return `*${children}*`;
      }
      if (tag === "DEL" || tag === "S" || tag === "STRIKE") {
        return `~~${children}~~`;
      }
      if (tag === "U") {
        return `<u>${children}</u>`;
      }
      if (tag === "CODE") {
        return wrapInlineCode(node.textContent || "");
      }
      if (tag === "A") {
        const href = String(node.getAttribute("data-md-href") || node.getAttribute("href") || "").trim();
        return href ? `[${children || href}](${href})` : children;
      }
      if (tag === "IMG") {
        return serializeImageNode(node);
      }
      return children;
    })
    .join("");

const serializeList = (listNode, depth = 0) => {
  if (listNode?.hasAttribute?.("data-md-raw")) {
    return trimOuterBlankLines(getStoredMarkdown(listNode));
  }
  const ordered = listNode.tagName === "OL";
  const lines = [];

  Array.from(listNode.children)
    .filter((child) => child.tagName === "LI")
    .forEach((item, index) => {
      const prefix = ordered ? `${index + 1}. ` : "- ";
      const inlineNodes = [];
      const nestedBlocks = [];

      Array.from(item.childNodes || []).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes(child.tagName)) {
          nestedBlocks.push(child);
          return;
        }
        inlineNodes.push(child);
      });

      const inlineContent = trimOuterBlankLines(serializeInlineNodes(inlineNodes))
        .split("\n")
        .map((line) => line.trim())
        .join(" ")
        .trim();

      const baseLine = `${prefix}${inlineContent}`.trimEnd();
      lines.push(depth > 0 ? `${"  ".repeat(depth)}${baseLine}` : baseLine);

      nestedBlocks.forEach((block) => {
        const nested = serializeList(block, depth + 1);
        if (nested) {
          lines.push(nested);
        }
      });
    });

  return lines.join("\n");
};

const serializeBlockNodes = (nodes) => {
  const chunks = [];

  nodes.forEach((node) => {
    if (!node) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = trimOuterBlankLines(normalizeInlineText(node.textContent || ""));
      if (text) {
        chunks.push(text);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const tag = node.tagName.toUpperCase();
    let markdown = "";

    if (node.getAttribute?.("data-md-source-unit") === "1") {
      markdown = trimOuterBlankLines(readSourceUnitMarkdown(node));
      if (markdown) {
        chunks.push(markdown);
      }
      return;
    }
    if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "UL", "OL", "BLOCKQUOTE", "TABLE", "HR"].includes(tag) && node.hasAttribute?.("data-md-raw")) {
      markdown = trimOuterBlankLines(getStoredMarkdown(node));
      if (markdown) {
        chunks.push(markdown);
      }
      return;
    }

    if (/^H[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      const content = trimOuterBlankLines(serializeInlineNodes(Array.from(node.childNodes || [])));
      markdown = `${"#".repeat(level)} ${content}`;
    } else if (tag === "P") {
      markdown = trimOuterBlankLines(serializeInlineNodes(Array.from(node.childNodes || [])));
    } else if (tag === "PRE") {
      const codeNode = node.querySelector("code");
      const code = normalizeMarkdownText(codeNode ? codeNode.innerText : node.innerText).replace(/\n$/, "");
      const lang = String(node.getAttribute("data-code-lang") || codeNode?.getAttribute("data-code-lang") || "").trim();
      markdown = `\`\`\`${lang}\n${code}\n\`\`\``;
    } else if (tag === "UL" || tag === "OL") {
      markdown = serializeList(node);
    } else if (tag === "BLOCKQUOTE") {
      const inner = trimOuterBlankLines(serializeBlockNodes(Array.from(node.childNodes || [])));
      markdown = inner
        ? inner.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n")
        : ">";
    } else if (tag === "HR") {
      markdown = "---";
    } else if (tag === "TABLE") {
      markdown = serializeTable(node);
    } else if (tag === "IMG") {
      markdown = serializeImageNode(node);
    } else if (tag === "DIV" && node.classList.contains("code-card")) {
      const codeNode = node.querySelector("code");
      const code = normalizeMarkdownText(codeNode?.innerText || "").replace(/\n$/, "");
      const langClass = Array.from(codeNode?.classList || []).find((item) => item.startsWith("language-")) || "";
      const lang = langClass.replace(/^language-/, "");
      markdown = `\`\`\`${lang}\n${code}\n\`\`\``;
    } else if (BLOCK_TAGS.has(tag)) {
      markdown = trimOuterBlankLines(serializeBlockNodes(Array.from(node.childNodes || [])));
    } else {
      markdown = trimOuterBlankLines(serializeInlineNodes(Array.from(node.childNodes || [])));
    }

    markdown = trimOuterBlankLines(markdown);
    if (markdown) {
      chunks.push(markdown);
    }
  });

  return chunks.join("\n\n");
};

export const renderMarkdownToEditableHtml = (markdown) => {
  const tokens = marked.lexer(normalizeMarkdownText(markdown), MARKED_OPTIONS);
  const html = renderBlockTokensToHtml(tokens).trim();
  return html || "<p><br /></p>";
};

export const renderInlineMarkdownToHtml = (markdown) =>
  renderInlineTokensToHtml(marked.Lexer.lexInline(normalizeMarkdownText(markdown), MARKED_OPTIONS)).trim();

export const serializeRichEditorToMarkdown = (rootNode) => {
  if (!rootNode) {
    return "";
  }
  const markdown = trimOuterBlankLines(serializeBlockNodes(Array.from(rootNode.childNodes || [])));
  return markdown ? `${markdown}\n` : "";
};

export const isRichEditorEffectivelyEmpty = (rootNode) =>
  !trimOuterBlankLines(serializeRichEditorToMarkdown(rootNode));
