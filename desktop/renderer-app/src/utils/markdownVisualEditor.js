import { marked } from "marked";
import { escapeHtml } from "./escapeHtml";

const normalizeMarkdownText = (value) => String(value || "").replace(/\r\n/g, "\n");
const trimOuterBlankLines = (value) => String(value || "").replace(/^\n+/, "").replace(/\n+$/, "");

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

    if (node.getAttribute?.("data-md-transient")) {
      return;
    }

    const tag = node.tagName.toUpperCase();
    let markdown = "";

    if (/^H[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      const content = trimOuterBlankLines(serializeInlineNodes(Array.from(node.childNodes || [])));
      markdown = `${"#".repeat(level)} ${content}`.trim();
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

const createEditableRenderer = () => {
  const renderer = new marked.Renderer();

  renderer.code = (code, infostring) => {
    const lang = ((infostring || "").match(/\S*/)?.[0] || "").trim();
    const safeLang = escapeHtml(lang);
    const safeCode = escapeHtml(normalizeMarkdownText(code || "").replace(/\n$/, ""));
    const langAttr = safeLang ? ` data-code-lang="${safeLang}"` : "";
    const classAttr = safeLang ? ` class="language-${safeLang}"` : "";
    return `<pre data-md-block="code"${langAttr}><code${classAttr}>${safeCode}</code></pre>`;
  };

  renderer.image = (href, title, text) => {
    let src = href;
    let imgTitle = title;
    let alt = text;

    if (href && typeof href === "object") {
      src = href.href;
      imgTitle = href.title;
      alt = href.text;
    }

    const rawSrc = String(src || "").trim();
    const normalized = normalizeImageHref(rawSrc);
    if (!normalized) {
      return "";
    }

    const safeSrc = escapeHtml(normalized);
    const safeRawSrc = escapeHtml(rawSrc);
    const safeAlt = escapeHtml(String(alt || ""));
    const safeTitle = imgTitle ? ` title="${escapeHtml(String(imgTitle))}"` : "";
    return `<img src="${safeSrc}" alt="${safeAlt}" data-md-src="${safeRawSrc}" loading="lazy"${safeTitle} />`;
  };

  renderer.link = (href, title, text) => {
    let rawHref = href;
    let linkTitle = title;
    let label = text;

    if (href && typeof href === "object") {
      rawHref = href.href;
      linkTitle = href.title;
      label = href.text;
    }

    const safeHref = escapeHtml(String(rawHref || "").trim());
    const safeLabel = String(label || "");
    const safeTitle = linkTitle ? ` title="${escapeHtml(String(linkTitle))}"` : "";
    if (!safeHref) {
      return safeLabel;
    }
    return `<a href="${safeHref}" data-md-href="${safeHref}"${safeTitle}>${safeLabel}</a>`;
  };

  return renderer;
};

export const renderMarkdownToEditableHtml = (markdown) => {
  const html = String(marked.parse(normalizeMarkdownText(markdown), {
    breaks: true,
    gfm: true,
    renderer: createEditableRenderer()
  }) || "").trim();
  return html || "<p><br /></p>";
};

export const serializeRichEditorToMarkdown = (rootNode) => {
  if (!rootNode) {
    return "";
  }
  const markdown = trimOuterBlankLines(serializeBlockNodes(Array.from(rootNode.childNodes || [])));
  return markdown ? `${markdown}\n` : "";
};

export const isRichEditorEffectivelyEmpty = (rootNode) =>
  !trimOuterBlankLines(serializeRichEditorToMarkdown(rootNode));
