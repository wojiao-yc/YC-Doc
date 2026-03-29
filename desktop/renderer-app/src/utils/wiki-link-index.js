import { extractHeadingsFromMarkdown } from "./heading-slug.js";
import {
  basenameOfRelPath,
  extractWikiLinksFromMarkdown,
  normalizeRelPath,
  resolveWikiLink,
  stripMarkdownExtension
} from "./wiki-link.js";

const toContextText = (lineTextInput = "") => String(lineTextInput || "").replace(/\s+/g, " ").trim();

const noteTitleOf = (relPath, markdown, headings = []) => {
  const firstHeading = Array.isArray(headings) ? headings[0] : null;
  if (firstHeading?.text) {
    return String(firstHeading.text);
  }
  return stripMarkdownExtension(basenameOfRelPath(relPath));
};

export const buildWikiLinkIndex = async ({
  files = [],
  readFile,
  overridesByPath = {}
} = {}) => {
  const markdownFiles = (Array.isArray(files) ? files : [])
    .filter((item) => item && typeof item === "object" && item.relPath)
    .map((item) => ({
      ...item,
      relPath: normalizeRelPath(item.relPath)
    }));

  const contentsByPath = {};
  const notesByPath = {};
  const forwardLinks = {};
  const backlinks = {};
  const unresolvedLinks = {};
  const ambiguousLinks = {};

  for (const file of markdownFiles) {
    const relPath = normalizeRelPath(file.relPath);
    try {
      const override = Object.prototype.hasOwnProperty.call(overridesByPath, relPath)
        ? overridesByPath[relPath]
        : undefined;
      const content = override == null
        ? String(await readFile(relPath))
        : String(override);
      contentsByPath[relPath] = content;
      const headings = extractHeadingsFromMarkdown(content);
      notesByPath[relPath] = {
        relPath,
        fileName: String(file.name || basenameOfRelPath(relPath)),
        baseName: stripMarkdownExtension(file.name || basenameOfRelPath(relPath)),
        title: noteTitleOf(relPath, content, headings),
        headings
      };
    } catch {
      contentsByPath[relPath] = "";
      notesByPath[relPath] = {
        relPath,
        fileName: String(file.name || basenameOfRelPath(relPath)),
        baseName: stripMarkdownExtension(file.name || basenameOfRelPath(relPath)),
        title: stripMarkdownExtension(file.name || basenameOfRelPath(relPath)),
        headings: []
      };
    }
  }

  for (const file of markdownFiles) {
    const sourceRelPath = normalizeRelPath(file.relPath);
    const sourceMarkdown = String(contentsByPath[sourceRelPath] || "");
    const links = extractWikiLinksFromMarkdown(sourceMarkdown);
    if (!links.length) {
      continue;
    }

    for (const link of links) {
      const resolution = resolveWikiLink(link.parsed, sourceRelPath, markdownFiles);
      const entry = {
        sourceRelPath,
        sourceTitle: String(notesByPath[sourceRelPath]?.title || stripMarkdownExtension(file.name || basenameOfRelPath(sourceRelPath))),
        sourceFileName: String(file.name || basenameOfRelPath(sourceRelPath)),
        raw: String(link.raw || ""),
        rawFrom: Number(link.rawFrom || 0),
        rawTo: Number(link.rawTo || 0),
        lineNumber: Number(link.lineNumber || 1),
        contextText: toContextText(link.lineText),
        target: String(link.parsed?.target || ""),
        anchor: String(link.parsed?.anchor || ""),
        blockRef: String(link.parsed?.blockRef || ""),
        alias: String(link.parsed?.alias || ""),
        displayText: String(link.displayText || "")
      };

      if (resolution.exists && resolution.relPath) {
        const targetRelPath = normalizeRelPath(resolution.relPath);
        const forwardEntry = {
          ...entry,
          targetRelPath
        };
        if (!forwardLinks[sourceRelPath]) {
          forwardLinks[sourceRelPath] = [];
        }
        forwardLinks[sourceRelPath].push(forwardEntry);

        if (!backlinks[targetRelPath]) {
          backlinks[targetRelPath] = [];
        }
        backlinks[targetRelPath].push(forwardEntry);
        continue;
      }

      if (resolution.ambiguous) {
        if (!ambiguousLinks[sourceRelPath]) {
          ambiguousLinks[sourceRelPath] = [];
        }
        ambiguousLinks[sourceRelPath].push({
          ...entry,
          candidates: Array.isArray(resolution.candidates) ? resolution.candidates : []
        });
        continue;
      }

      if (!unresolvedLinks[sourceRelPath]) {
        unresolvedLinks[sourceRelPath] = [];
      }
      unresolvedLinks[sourceRelPath].push({
        ...entry,
        suggestedRelPath: String(resolution.suggestedRelPath || "")
      });
    }
  }

  return {
    files: markdownFiles,
    notesByPath,
    contentsByPath,
    forwardLinks,
    backlinks,
    unresolvedLinks,
    ambiguousLinks
  };
};
