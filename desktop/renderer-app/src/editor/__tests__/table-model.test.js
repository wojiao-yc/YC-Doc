import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdownTableModel, serializeMarkdownTableModel } from "../runtime/table-model.js";

test("parseMarkdownTableModel reads alignment, rows, and indentation", () => {
  const raw = [
    "  | Name | Score |",
    "  | :--- | ---: |",
    "  | Alice | 10 |",
    "  | Bob | 20 |"
  ].join("\n");

  const model = parseMarkdownTableModel(raw);

  assert.deepEqual(model, {
    headers: ["Name", "Score"],
    alignments: ["left", "right"],
    rows: [
      ["Alice", "10"],
      ["Bob", "20"]
    ],
    indent: "  "
  });
});

test("serializeMarkdownTableModel normalizes cell content and preserves indent", () => {
  const serialized = serializeMarkdownTableModel({
    headers: [" Name ", "Score"],
    alignments: ["left", "right"],
    rows: [["Alice\nSmith", " 10 "]],
    indent: "    "
  });

  assert.equal(
    serialized,
    [
      "    | Name | Score |",
      "    | :--- | ---: |",
      "    | Alice Smith | 10 |"
    ].join("\n")
  );
});

test("parseMarkdownTableModel rejects incomplete tables", () => {
  assert.equal(parseMarkdownTableModel("| only one line |"), null);
  assert.equal(parseMarkdownTableModel("| A | B |\n| nope | nope |"), null);
});
