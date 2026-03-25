const normalizeWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();

const stripHeadingHashes = (value) =>
  normalizeWhitespace(String(value || "").replace(/[ \t]+#+[ \t]*$/, "").trim());

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildHeadingId = (slug, fallbackIndex) => {
  const safeSlug = String(slug || "").trim();
  if (safeSlug) {
    return `heading-${safeSlug}`;
  }
  return `heading-section-${Math.max(1, Number(fallbackIndex || 1))}`;
};

export const normalizeHeadingText = (value) => stripHeadingHashes(value);

export const slugifyHeading = (value) => {
  const normalized = normalizeHeadingText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const slug = normalized
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, " ")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || normalizeWhitespace(value).replace(/\s+/g, "-");
};

export const extractHeadingsFromMarkdown = (markdownInput = "") => {
  const markdown = String(markdownInput || "").replace(/\r\n/g, "\n");
  if (!markdown) {
    return [];
  }

  const lines = markdown.split("\n");
  const headings = [];
  const slugCounts = new Map();
  let offset = 0;
  let activeCodeFence = null;
  let mathFenceOpen = false;

  for (let index = 0; index < lines.length; index += 1) {
    const lineText = String(lines[index] || "");
    const lineStart = offset;
    const hasNewline = index < lines.length - 1;
    offset += lineText.length + (hasNewline ? 1 : 0);

    const codeFenceMatch = lineText.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (codeFenceMatch) {
      const fence = String(codeFenceMatch[1] || "");
      if (!activeCodeFence) {
        activeCodeFence = fence;
      } else if (fence[0] === activeCodeFence[0] && fence.length >= activeCodeFence.length) {
        activeCodeFence = null;
      }
      continue;
    }
    if (activeCodeFence) {
      continue;
    }

    if (/^\s{0,3}\$\$\s*$/.test(lineText)) {
      mathFenceOpen = !mathFenceOpen;
      continue;
    }
    if (mathFenceOpen) {
      continue;
    }

    const headingMatch = lineText.match(/^\s{0,3}(#{1,6})[ \t]+(.+?)\s*$/);
    if (!headingMatch) {
      continue;
    }

    const level = String(headingMatch[1] || "").length;
    const text = normalizeHeadingText(headingMatch[2] || "");
    const baseSlug = slugifyHeading(text);
    const slugIndex = (slugCounts.get(baseSlug) || 0) + 1;
    slugCounts.set(baseSlug, slugIndex);
    const slug = slugIndex > 1 ? `${baseSlug}-${slugIndex}` : baseSlug;

    headings.push({
      level,
      text,
      slug,
      id: buildHeadingId(slug, headings.length + 1),
      from: lineStart,
      to: lineStart + lineText.length,
      line: index + 1
    });
  }

  return headings;
};

export const findHeadingMatch = (headingsInput = [], anchorInput = "") => {
  const anchor = normalizeHeadingText(anchorInput);
  if (!anchor) {
    return null;
  }

  const headings = Array.isArray(headingsInput) ? headingsInput : [];
  const exact = headings.find((heading) => normalizeHeadingText(heading?.text) === anchor);
  if (exact) {
    return exact;
  }

  const slug = slugifyHeading(anchor);
  return headings.find((heading) => String(heading?.slug || "") === slug) || null;
};

export const applyHeadingIdsToHtml = (htmlInput = "", markdownInput = "") => {
  const html = String(htmlInput || "");
  const headings = extractHeadingsFromMarkdown(markdownInput);
  if (!html || !headings.length) {
    return html;
  }

  let headingIndex = 0;
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, level, innerHtml) => {
    const heading = headings[headingIndex] || null;
    headingIndex += 1;
    const fallbackSlug = slugifyHeading(String(innerHtml || "").replace(/<[^>]+>/g, " "));
    const slug = String(heading?.slug || fallbackSlug || `section-${headingIndex}`);
    const id = String(heading?.id || buildHeadingId(slug, headingIndex));
    const levelNumber = Math.max(1, Math.min(6, Number(level) || 1));
    return `<h${levelNumber} id="${id}" data-heading-slug="${slug}">${innerHtml}</h${levelNumber}>`;
  });
};

export const findHeadingHtmlIdByAnchor = (markdownInput = "", anchorInput = "") => {
  const headings = extractHeadingsFromMarkdown(markdownInput);
  const match = findHeadingMatch(headings, anchorInput);
  return match ? String(match.id || "") : "";
};

export const headingContainsAnchor = (headingInput = "", anchorInput = "") => {
  const heading = normalizeHeadingText(headingInput);
  const anchor = normalizeHeadingText(anchorInput);
  if (!heading || !anchor) {
    return false;
  }
  return new RegExp(`^${escapeRegExp(anchor)}$`, "i").test(heading);
};
