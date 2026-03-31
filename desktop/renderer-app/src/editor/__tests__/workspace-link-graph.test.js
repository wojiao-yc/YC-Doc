import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkspaceLinkGraph,
  extractWorkspaceTags
} from "../../utils/workspace-link-graph.js";

test("extractWorkspaceTags keeps distinct markdown tags in source order", () => {
  const tags = extractWorkspaceTags([
    "#paper notes",
    "",
    "Discuss #video and #memory.",
    "Repeat #video should dedupe."
  ].join("\n"));

  assert.deepEqual(tags, ["paper", "video", "memory"]);
});

test("buildWorkspaceLinkGraph derives nodes, edges, folders, and backlink sizing", () => {
  const graph = buildWorkspaceLinkGraph({
    files: [
      { relPath: "projects/a.md", name: "a.md" },
      { relPath: "research/b.md", name: "b.md" },
      { relPath: "c.md", name: "c.md" }
    ],
    notesByPath: {
      "projects/a.md": { title: "Project A" },
      "research/b.md": { title: "Paper B" },
      "c.md": { title: "Loose C" }
    },
    contentsByPath: {
      "projects/a.md": "See [[Paper B]] #project",
      "research/b.md": "#paper",
      "c.md": ""
    },
    forwardLinks: {
      "projects/a.md": [
        { targetRelPath: "research/b.md" }
      ]
    },
    backlinks: {
      "research/b.md": [
        { sourceRelPath: "projects/a.md" }
      ]
    }
  });

  const nodeA = graph.nodes.find((node) => node.id === "projects/a.md");
  const nodeB = graph.nodes.find((node) => node.id === "research/b.md");
  const nodeC = graph.nodes.find((node) => node.id === "c.md");

  assert.equal(graph.stats.nodeCount, 3);
  assert.equal(graph.stats.edgeCount, 1);
  assert.equal(graph.stats.isolatedCount, 1);
  assert.equal(graph.edges[0]?.sourceId, "projects/a.md");
  assert.equal(graph.edges[0]?.targetId, "research/b.md");
  assert.equal(nodeA?.folderKey, "projects");
  assert.equal(nodeB?.primaryTag, "paper");
  assert.equal(nodeC?.folderKey, "Root");
  assert.equal(nodeC?.isolated, true);
  assert.equal((nodeB?.radius || 0) > (nodeA?.radius || 0), true);
});
