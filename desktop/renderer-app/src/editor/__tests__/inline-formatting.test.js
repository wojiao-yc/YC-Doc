import assert from "node:assert/strict";
import test from "node:test";
import { resolveInlineFormattingPlaceholder } from "../utils/inline-formatting.js";

test("strikethrough uses a replaceable placeholder for empty selections", () => {
  assert.equal(
    resolveInlineFormattingPlaceholder({ prefix: "~~", suffix: "~~" }),
    " "
  );
});

test("explicit placeholders still win over the fallback behavior", () => {
  assert.equal(
    resolveInlineFormattingPlaceholder({ prefix: "~~", suffix: "~~", placeholder: "text" }),
    "text"
  );
});

test("other inline wrappers keep empty selections empty by default", () => {
  assert.equal(
    resolveInlineFormattingPlaceholder({ prefix: "**", suffix: "**" }),
    ""
  );
  assert.equal(
    resolveInlineFormattingPlaceholder({ prefix: "`", suffix: "`" }),
    ""
  );
});
