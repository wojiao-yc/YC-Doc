import { findHeadingMatch, normalizeHeadingText, slugifyHeading } from "./heading-slug.js";

const WIKI_LINK_OPEN = "[[";
const WIKI_LINK_CLOSE = "]]";

const asString = (value) => String(value || "");
const normalizePathSlashes = (value) => asString(value).replace(/\\/g, "/");
const trimSlashes = (value) => normalizePathSlashes(value).replace(/^\/+|\/+$/g, "");
const normalizeMarkdown = (value) => asString(value).replace(/\r\n/g, "\n");

const splitPathSegments = (value) => trimSlashes(value).split("/").filter(Boolean);

export const normalizeRelPath = (value) => {
  const input = trimSlashes(value);
  if (!input) {
    return "";
  }

  const output = [];
  for (const segment of splitPathSegments(input)) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      output.pop();
      continue;
    }
    output.push(segment);
  }
  return output.join("/");
};

export const dirnameOfRelPath = (value) => {
  const normalized = normalizeRelPath(value);
  if (!normalized.includes("/")) {
    return "";
  }
  return normalized.slice(0, normalized.lastIndexOf("/"));
};

export const basenameOfRelPath = (value) => {
  const normalized = normalizeRelPath(value);
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("/");
  return String(parts[parts.length - 1] || "");
};

export const stripMarkdownExtension = (value) => asString(value).replace(/\.md$/i, "");

export const ensureMarkdownExtension = (value) => {
  const normalized = normalizeRelPath(value);
  if (!normalized) {
    return "";
  }
  return /\.md$/i.test(normalized) ? normalized : `${normalized}.md`;
};

export const isExplicitWikiTarget = (targetInput = "") => {
  const target = trimSlashes(targetInput);
  if (!target) {
    return false;
  }
  return target.includes("/") || /\.md$/i.test(target);
};

export const wikiLinkDisplayTextOf = ({ target = "", anchor = "", blockRef = "", alias = "" } = {}) => {
  const safeAlias = asString(alias).trim();
  if (safeAlias) {
    return safeAlias;
  }
  const safeTarget = asString(target).trim();
  const safeAnchor = normalizeHeadingText(anchor);
  const safeBlockRef = asString(blockRef).replace(/\s+/g, " ").trim();
  return [
    safeTarget,
    safeAnchor ? `#${safeAnchor}` : "",
    safeBlockRef ? `^${safeBlockRef}` : ""
  ].join("");
};

export const parseWikiLinkBody = (bodyInput = "") => {
  const body = asString(bodyInput).trim();
  if (!body) {
    return {
      body: "",
      target: "",
      anchor: "",
      blockRef: "",
      alias: "",
      displayText: ""
    };
  }

  const aliasSeparatorIndex = body.indexOf("|");
  const head = aliasSeparatorIndex >= 0 ? body.slice(0, aliasSeparatorIndex) : body;
  const alias = aliasSeparatorIndex >= 0 ? body.slice(aliasSeparatorIndex + 1).trim() : "";
  const blockSeparatorIndex = head.indexOf("^");
  const headWithoutBlock = blockSeparatorIndex >= 0 ? head.slice(0, blockSeparatorIndex) : head;
  const blockRef = blockSeparatorIndex >= 0 ? head.slice(blockSeparatorIndex + 1).replace(/\s+/g, " ").trim() : "";
  const anchorSeparatorIndex = headWithoutBlock.indexOf("#");
  const target = (anchorSeparatorIndex >= 0 ? headWithoutBlock.slice(0, anchorSeparatorIndex) : headWithoutBlock).trim();
  const anchor = anchorSeparatorIndex >= 0 ? headWithoutBlock.slice(anchorSeparatorIndex + 1).trim() : "";

  return {
    body,
    target,
    anchor,
    blockRef,
    alias,
    displayText: wikiLinkDisplayTextOf({ target, anchor, blockRef, alias })
  };
};

export const parseWikiLinkRaw = (rawInput = "") => {
  const raw = asString(rawInput).trim();
  const match = raw.match(/^\[\[([\s\S]*?)\]\]$/);
  const body = match ? String(match[1] || "") : raw.replace(/^\[\[/, "").replace(/\]\]$/, "");
  return {
    raw,
    ...parseWikiLinkBody(body)
  };
};

const isEscapedAt = (source, indexInput) => {
  const index = Number(indexInput || 0);
  if (index <= 0) {
    return false;
  }
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (source[cursor] !== "\\") {
      break;
    }
    slashCount += 1;
  }
  return slashCount % 2 === 1;
};

const createWikiLinkMatch = ({ markdown, rawFrom, rawTo, lineNumber, lineText }) => {
  const raw = markdown.slice(rawFrom, rawTo);
  const parsed = parseWikiLinkRaw(raw);
  return {
    raw,
    rawFrom,
    rawTo,
    lineNumber,
    lineText: asString(lineText),
    parsed,
    displayText: parsed.displayText
  };
};

const processWikiLinksInInlineText = ({
  line,
  markdown,
  lineStart,
  lineNumber,
  matches,
  replacer
}) => {
  const source = asString(line);
  let result = "";
  let cursor = 0;
  let activeCodeDelimiter = "";

  while (cursor < source.length) {
    const tickMatch = source.slice(cursor).match(/^`+/);
    if (tickMatch) {
      const ticks = String(tickMatch[0] || "");
      if (!activeCodeDelimiter) {
        activeCodeDelimiter = ticks;
      } else if (ticks === activeCodeDelimiter) {
        activeCodeDelimiter = "";
      }
      result += ticks;
      cursor += ticks.length;
      continue;
    }

    if (!activeCodeDelimiter && source.startsWith(WIKI_LINK_OPEN, cursor) && !isEscapedAt(source, cursor)) {
      const closeIndex = source.indexOf(WIKI_LINK_CLOSE, cursor + WIKI_LINK_OPEN.length);
      if (closeIndex >= 0) {
        const rawFrom = lineStart + cursor;
        const rawTo = lineStart + closeIndex + WIKI_LINK_CLOSE.length;
        const match = createWikiLinkMatch({
          markdown,
          rawFrom,
          rawTo,
          lineNumber,
          lineText: source
        });
        matches.push(match);
        result += typeof replacer === "function" ? asString(replacer(match)) : match.raw;
        cursor = closeIndex + WIKI_LINK_CLOSE.length;
        continue;
      }
    }

    result += source[cursor];
    cursor += 1;
  }

  return result;
};

const scanMarkdownWikiLinks = (markdownInput = "", replacer = null) => {
  const markdown = normalizeMarkdown(markdownInput);
  const lines = markdown.split("\n");
  const matches = [];
  const transformedLines = [];
  let offset = 0;
  let activeCodeFence = null;
  let mathFenceOpen = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = asString(lines[index]);
    const lineStart = offset;
    const hasNewline = index < lines.length - 1;
    offset += line.length + (hasNewline ? 1 : 0);

    const codeFenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (codeFenceMatch) {
      const fence = String(codeFenceMatch[1] || "");
      if (!activeCodeFence) {
        activeCodeFence = fence;
      } else if (fence[0] === activeCodeFence[0] && fence.length >= activeCodeFence.length) {
        activeCodeFence = null;
      }
      transformedLines.push(line);
      continue;
    }
    if (activeCodeFence) {
      transformedLines.push(line);
      continue;
    }

    if (/^\s{0,3}\$\$\s*$/.test(line)) {
      mathFenceOpen = !mathFenceOpen;
      transformedLines.push(line);
      continue;
    }
    if (mathFenceOpen) {
      transformedLines.push(line);
      continue;
    }

    transformedLines.push(processWikiLinksInInlineText({
      line,
      markdown,
      lineStart,
      lineNumber: index + 1,
      matches,
      replacer
    }));
  }

  return {
    matches,
    transformedMarkdown: transformedLines.join("\n")
  };
};

export const extractWikiLinksFromMarkdown = (markdownInput = "") =>
  scanMarkdownWikiLinks(markdownInput).matches;

export const replaceWikiLinksInMarkdown = (markdownInput = "", replacer = null) =>
  scanMarkdownWikiLinks(markdownInput, replacer).transformedMarkdown;

export const findOpenWikiLinkContext = (lineInput = "", cursorOffsetInput = 0) => {
  const line = asString(lineInput);
  const cursorOffset = Math.max(0, Math.min(line.length, Number(cursorOffsetInput || 0)));
  let activeCodeDelimiter = "";
  let lastOpen = -1;
  let cursor = 0;

  while (cursor < cursorOffset) {
    const tickMatch = line.slice(cursor).match(/^`+/);
    if (tickMatch) {
      const ticks = String(tickMatch[0] || "");
      if (!activeCodeDelimiter) {
        activeCodeDelimiter = ticks;
      } else if (ticks === activeCodeDelimiter) {
        activeCodeDelimiter = "";
      }
      cursor += ticks.length;
      continue;
    }

    if (!activeCodeDelimiter && line.startsWith(WIKI_LINK_OPEN, cursor) && !isEscapedAt(line, cursor)) {
      lastOpen = cursor;
      cursor += WIKI_LINK_OPEN.length;
      continue;
    }

    if (!activeCodeDelimiter && line.startsWith(WIKI_LINK_CLOSE, cursor)) {
      lastOpen = -1;
      cursor += WIKI_LINK_CLOSE.length;
      continue;
    }

    cursor += 1;
  }

  if (lastOpen < 0) {
    return null;
  }

  const rawQuery = line.slice(lastOpen + WIKI_LINK_OPEN.length, cursorOffset);
  if (rawQuery.includes(WIKI_LINK_CLOSE)) {
    return null;
  }

  const aliasIndex = rawQuery.indexOf("|");
  const searchableQuery = aliasIndex >= 0 ? rawQuery.slice(0, aliasIndex) : rawQuery;
  const blockIndex = searchableQuery.indexOf("^");
  const searchableHead = blockIndex >= 0 ? searchableQuery.slice(0, blockIndex) : searchableQuery;
  const anchorIndex = searchableHead.indexOf("#");
  const noteQuery = anchorIndex >= 0 ? searchableHead.slice(0, anchorIndex) : searchableHead;
  const headingQuery = anchorIndex >= 0 ? searchableHead.slice(anchorIndex + 1) : "";
  const blockQuery = blockIndex >= 0 ? searchableQuery.slice(blockIndex + 1) : "";

  return {
    openFrom: lastOpen,
    replaceFrom: lastOpen + WIKI_LINK_OPEN.length,
    query: rawQuery,
    noteQuery,
    headingQuery,
    blockQuery,
    aliasQuery: aliasIndex >= 0 ? rawQuery.slice(aliasIndex + 1) : "",
    mode: blockIndex >= 0 ? "block" : (anchorIndex >= 0 ? "heading" : "file")
  };
};

const normalizedFileItems = (filesInput = []) =>
  (Array.isArray(filesInput) ? filesInput : [])
    .filter((item) => item && typeof item === "object" && item.relPath)
    .map((item) => ({
      ...item,
      relPath: normalizeRelPath(item.relPath),
      name: asString(item.name || basenameOfRelPath(item.relPath)),
      fileName: asString(item.fileName || item.name || basenameOfRelPath(item.relPath)),
      baseName: stripMarkdownExtension(asString(item.baseName || basenameOfRelPath(item.relPath)))
    }));

const explicitPathCandidatesFor = (targetInput = "", currentRelPath = "") => {
  const target = normalizeRelPath(targetInput);
  if (!target) {
    return [];
  }

  const withExt = ensureMarkdownExtension(target);
  const candidates = new Set([withExt]);
  const currentDir = dirnameOfRelPath(currentRelPath);
  if (currentDir && !target.startsWith(`${currentDir}/`)) {
    candidates.add(ensureMarkdownExtension(`${currentDir}/${target}`));
  }
  return [...candidates].filter(Boolean);
};

export const suggestRelPathForMissing = (targetInput = "", currentRelPath = "") => {
  const target = trimSlashes(targetInput);
  if (!target) {
    return "";
  }

  if (isExplicitWikiTarget(target)) {
    return ensureMarkdownExtension(target);
  }

  const currentDir = dirnameOfRelPath(currentRelPath);
  const suggestedName = ensureMarkdownExtension(target);
  return currentDir ? normalizeRelPath(`${currentDir}/${suggestedName}`) : suggestedName;
};

export const resolveWikiLink = (parsedInput = {}, currentRelPath = "", filesInput = []) => {
  const fallbackBody = [
    asString(parsedInput?.target).trim(),
    parsedInput?.anchor ? `#${asString(parsedInput.anchor).trim()}` : "",
    parsedInput?.blockRef ? `^${asString(parsedInput.blockRef).replace(/\s+/g, " ").trim()}` : "",
    parsedInput?.alias ? `|${asString(parsedInput.alias).trim()}` : ""
  ].join("");
  const parsed = typeof parsedInput === "string" ? parseWikiLinkRaw(parsedInput) : {
    raw: asString(parsedInput.raw),
    ...parseWikiLinkBody(parsedInput.body || fallbackBody)
  };
  const target = asString(parsed.target).trim();
  const anchor = normalizeHeadingText(parsed.anchor);
  const blockRef = asString(parsed.blockRef).replace(/\s+/g, " ").trim();
  const alias = asString(parsed.alias).trim();
  const displayText = wikiLinkDisplayTextOf({ target, anchor, blockRef, alias });
  const files = normalizedFileItems(filesInput);

  if (!target) {
    if ((anchor || blockRef) && currentRelPath) {
      const relPath = normalizeRelPath(currentRelPath);
      return {
        ok: true,
        exists: true,
        ambiguous: false,
        relPath,
        fileName: basenameOfRelPath(relPath),
        target,
        anchor,
        blockRef,
        alias,
        displayText
      };
    }

    return {
      ok: false,
      exists: false,
      ambiguous: false,
      relPath: "",
      target,
      anchor,
      blockRef,
      alias,
      displayText,
      suggestedRelPath: ""
    };
  }

  let candidates = [];
  if (isExplicitWikiTarget(target)) {
    const explicitCandidates = explicitPathCandidatesFor(target, currentRelPath);
    candidates = files.filter((item) => explicitCandidates.includes(item.relPath));
  } else {
    const baseTarget = stripMarkdownExtension(target);
    candidates = files.filter((item) => stripMarkdownExtension(item.fileName) === baseTarget);
  }

  if (candidates.length > 1) {
    return {
      ok: false,
      exists: false,
      ambiguous: true,
      target,
      anchor,
      blockRef,
      alias,
      displayText,
      candidates: candidates.map((item) => item.relPath)
    };
  }

  if (candidates.length === 1) {
    const [resolved] = candidates;
    return {
      ok: true,
      exists: true,
      ambiguous: false,
      relPath: resolved.relPath,
      fileName: resolved.fileName,
      target,
      anchor,
      blockRef,
      alias,
      displayText
    };
  }

  return {
    ok: true,
    exists: false,
    ambiguous: false,
    relPath: "",
    target,
    anchor,
    blockRef,
    alias,
    displayText,
    suggestedRelPath: suggestRelPathForMissing(target, currentRelPath)
  };
};

export const preferredWikiTargetForFile = (fileInput = {}, filesInput = []) => {
  const file = fileInput && typeof fileInput === "object" ? fileInput : {};
  const relPath = normalizeRelPath(file.relPath || "");
  if (!relPath) {
    return "";
  }

  const fileName = basenameOfRelPath(relPath);
  const baseName = stripMarkdownExtension(fileName);
  const files = normalizedFileItems(filesInput);
  const duplicates = files.filter((item) => stripMarkdownExtension(item.fileName) === baseName);
  if (duplicates.length === 1) {
    return baseName;
  }
  return relPath;
};

export const describeWikiLinkResolution = (resolutionInput = {}) => {
  const resolution = resolutionInput && typeof resolutionInput === "object" ? resolutionInput : {};
  if (resolution.ambiguous) {
    const candidates = Array.isArray(resolution.candidates) ? resolution.candidates : [];
    return candidates.length
      ? `Multiple matching notes: ${candidates.join(", ")}`
      : "Multiple matching notes";
  }
  if (resolution.exists) {
    const heading = normalizeHeadingText(resolution.anchor);
    const blockRef = asString(resolution.blockRef).replace(/\s+/g, " ").trim();
    if (heading || blockRef) {
      return `Open ${resolution.relPath}${heading ? ` # ${heading}` : ""}${blockRef ? ` ^ ${blockRef}` : ""}`;
    }
    return `Open ${resolution.relPath}`;
  }
  if (resolution.suggestedRelPath) {
    return `Missing note. Click to create ${resolution.suggestedRelPath}`;
  }
  return "Missing note";
};

export const findHeadingTargetByAnchor = (headingsInput = [], anchorInput = "") => {
  const match = findHeadingMatch(headingsInput, anchorInput);
  if (!match) {
    return null;
  }
  return {
    ...match,
    normalizedAnchor: normalizeHeadingText(anchorInput),
    slug: String(match.slug || slugifyHeading(anchorInput))
  };
};
