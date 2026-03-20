import assert from "node:assert/strict";
import test from "node:test";
import { EditorState } from "@codemirror/state";
import {
  exitBlockquoteOnEmptyQuoteLine,
  exitUnclosedFenceOnEmptyLine,
  findUnclosedFenceAtLine,
  isEmptyBlockquoteLine
} from "../extensions/markdown";

const runEnter = (doc, anchor) => {
  const state = EditorState.create({
    doc,
    selection: { anchor }
  });
  let dispatched = null;
  const view = {
    state,
    dispatch: (spec) => {
      dispatched = spec;
    }
  };

  const handled = exitUnclosedFenceOnEmptyLine(view);
  if (!handled) {
    return {
      handled,
      doc: state.doc.toString(),
      anchor: state.selection.main.anchor
    };
  }

  const transaction = state.update(dispatched);
  return {
    handled,
    doc: transaction.state.doc.toString(),
    anchor: transaction.state.selection.main.anchor
  };
};

const runBlockquoteEnter = (doc, anchor) => {
  const state = EditorState.create({
    doc,
    selection: { anchor }
  });
  let dispatched = null;
  const view = {
    state,
    dispatch: (spec) => {
      dispatched = spec;
    }
  };

  const handled = exitBlockquoteOnEmptyQuoteLine(view);
  if (!handled) {
    return {
      handled,
      doc: state.doc.toString(),
      anchor: state.selection.main.anchor
    };
  }

  const transaction = state.update(dispatched);
  return {
    handled,
    doc: transaction.state.doc.toString(),
    anchor: transaction.state.selection.main.anchor
  };
};

test("findUnclosedFenceAtLine returns the latest active fenced block", () => {
  const markdown = ["```", "a", "```", "```", "b"].join("\n");
  const active = findUnclosedFenceAtLine(EditorState.create({ doc: markdown }).doc, 5);

  assert.equal(active?.marker, "`");
  assert.equal(active?.length, 3);
  assert.equal(active?.line, 4);
});

test("Enter on empty line closes an unclosed fenced code block", () => {
  const markdown = ["```js", "const n = 1", "", "next"].join("\n");
  const anchor = markdown.indexOf("\n\nnext") + 1;
  const result = runEnter(markdown, anchor);

  assert.equal(result.handled, true);
  assert.equal(result.doc, ["```js", "const n = 1", "```", "next"].join("\n"));
});

test("Enter does not auto-close when a closing fence already exists below", () => {
  const markdown = ["```js", "", "```", "next"].join("\n");
  const anchor = markdown.indexOf("\n\n```") + 1;
  const result = runEnter(markdown, anchor);

  assert.equal(result.handled, false);
  assert.equal(result.doc, markdown);
});

test("auto-close keeps fence marker type and indentation", () => {
  const markdown = ["  ~~~python", "", "tail"].join("\n");
  const anchor = markdown.indexOf("\n\ntail") + 1;
  const result = runEnter(markdown, anchor);

  assert.equal(result.handled, true);
  assert.equal(result.doc, ["  ~~~python", "  ~~~", "tail"].join("\n"));
});

test("Enter on empty blockquote line exits quote in one keypress", () => {
  const markdown = ["> quote", "> ", "tail"].join("\n");
  const anchor = markdown.indexOf("\n> \n") + 3;
  const result = runBlockquoteEnter(markdown, anchor);

  assert.equal(result.handled, true);
  assert.equal(result.doc, ["> quote", "", "tail"].join("\n"));
});

test("Enter on non-empty blockquote line keeps default behavior", () => {
  const markdown = ["> quote", "tail"].join("\n");
  const anchor = markdown.indexOf("quote") + 2;
  const result = runBlockquoteEnter(markdown, anchor);

  assert.equal(result.handled, false);
  assert.equal(result.doc, markdown);
});

test("empty blockquote matcher ignores zero-width characters and nested quote prefixes", () => {
  assert.equal(isEmptyBlockquoteLine("> \u200B"), true);
  assert.equal(isEmptyBlockquoteLine("> > \u2060"), true);
  assert.equal(isEmptyBlockquoteLine("> note"), false);
});

test("Enter exits nested empty blockquote line in one keypress", () => {
  const markdown = ["> quote", "> > ", "tail"].join("\n");
  const anchor = markdown.indexOf("\n> > \n") + 4;
  const result = runBlockquoteEnter(markdown, anchor);

  assert.equal(result.handled, true);
  assert.equal(result.doc, ["> quote", "", "tail"].join("\n"));
});
