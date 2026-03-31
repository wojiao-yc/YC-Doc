import {
  basenameOfRelPath,
  normalizeRelPath,
  stripMarkdownExtension
} from "./wiki-link.js";

const TAG_PATTERN = /(^|[\s(>])#([\p{L}\p{N}_/-]{1,64})/gu;
const ROOT_FOLDER_LABEL = "Root";
const NO_TAG_LABEL = "No tag";

const asArray = (valueInput) => (Array.isArray(valueInput) ? valueInput : []);

const countEntries = (itemsInput = []) => {
  const counts = new Map();
  for (const item of asArray(itemsInput)) {
    const key = String(item || "").trim();
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: key,
      count
    }))
    .sort((left, right) =>
      Number(right.count || 0) - Number(left.count || 0)
      || String(left.label || "").localeCompare(String(right.label || ""), "zh-CN")
    );
};

const topLevelFolderOf = (relPathInput = "") => {
  const relPath = normalizeRelPath(relPathInput);
  if (!relPath) {
    return ROOT_FOLDER_LABEL;
  }
  const segments = relPath.split("/").filter(Boolean);
  return segments.length > 1 ? String(segments[0] || ROOT_FOLDER_LABEL) : ROOT_FOLDER_LABEL;
};

export const extractWorkspaceTags = (markdownInput = "") => {
  const markdown = String(markdownInput || "");
  const tags = [];
  const seen = new Set();

  for (const match of markdown.matchAll(TAG_PATTERN)) {
    const tag = String(match?.[2] || "").trim();
    if (!tag) {
      continue;
    }
    const normalized = tag.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    tags.push(tag);
  }

  return tags;
};

export const buildWorkspaceLinkGraph = ({
  files = [],
  notesByPath = {},
  contentsByPath = {},
  forwardLinks = {},
  backlinks = {}
} = {}) => {
  const normalizedFiles = asArray(files)
    .filter((item) => item && typeof item === "object" && item.relPath)
    .map((item) => ({
      ...item,
      relPath: normalizeRelPath(item.relPath)
    }))
    .filter((item) => item.relPath);

  const nodes = normalizedFiles.map((file) => {
    const relPath = normalizeRelPath(file.relPath);
    const note = notesByPath?.[relPath] || {};
    const markdown = String(contentsByPath?.[relPath] || "");
    const folderKey = topLevelFolderOf(relPath);
    const tags = extractWorkspaceTags(markdown);
    const primaryTag = String(tags[0] || NO_TAG_LABEL);
    const incoming = asArray(backlinks?.[relPath]);
    const outgoing = asArray(forwardLinks?.[relPath]);
    const backlinksCount = incoming.length;
    const outgoingCount = outgoing.length;
    const totalLinks = backlinksCount + outgoingCount;
    const radius = 8 + Math.min(18, Math.sqrt(backlinksCount) * 4 + Math.sqrt(totalLinks) * 1.35);

    return {
      id: relPath,
      relPath,
      title: String(
        note?.title
        || stripMarkdownExtension(file.name || basenameOfRelPath(relPath))
        || relPath
      ),
      folderKey,
      tags,
      primaryTag,
      backlinksCount,
      outgoingCount,
      totalLinks,
      radius,
      isolated: totalLinks === 0
    };
  });

  const knownNodeIds = new Set(nodes.map((node) => node.id));
  const edgeMap = new Map();

  for (const [sourceRelPathRaw, linksInput] of Object.entries(forwardLinks || {})) {
    const sourceRelPath = normalizeRelPath(sourceRelPathRaw);
    if (!knownNodeIds.has(sourceRelPath)) {
      continue;
    }

    for (const link of asArray(linksInput)) {
      const targetRelPath = normalizeRelPath(link?.targetRelPath || "");
      if (!targetRelPath || !knownNodeIds.has(targetRelPath)) {
        continue;
      }

      const edgeId = `${sourceRelPath}=>${targetRelPath}`;
      const existing = edgeMap.get(edgeId);
      if (existing) {
        existing.count += 1;
        continue;
      }

      edgeMap.set(edgeId, {
        id: edgeId,
        sourceId: sourceRelPath,
        targetId: targetRelPath,
        count: 1,
        strength: 1
      });
    }
  }

  const edges = [...edgeMap.values()]
    .map((edge) => ({
      ...edge,
      strength: 0.65 + Math.log2(Number(edge.count || 1) + 1) * 0.35
    }))
    .sort((left, right) =>
      String(left.sourceId || "").localeCompare(String(right.sourceId || ""), "zh-CN")
      || String(left.targetId || "").localeCompare(String(right.targetId || ""), "zh-CN")
    );

  const folderGroups = countEntries(nodes.map((node) => node.folderKey));
  const tagGroups = countEntries(nodes.map((node) => node.primaryTag));

  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      isolatedCount: nodes.filter((node) => node.isolated).length
    },
    groups: {
      folders: folderGroups,
      tags: tagGroups
    }
  };
};
