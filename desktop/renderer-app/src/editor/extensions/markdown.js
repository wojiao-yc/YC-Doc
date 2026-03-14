import { Prec } from "@codemirror/state";
import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { keymap } from "@codemirror/view";

const OPEN_FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})(.*)$/;

const closeFencePatternFor = (fenceToken) => {
  const marker = fenceToken[0] === "~" ? "~" : "`";
  const length = fenceToken.length;
  return new RegExp(`^\\s{0,3}${marker}{${length},}\\s*$`);
};

const getLineIndent = (lineText) => {
  const match = String(lineText || "").match(/^\s{0,3}/);
  return match ? match[0] : "";
};

export const findUnclosedFenceAtLine = (doc, lineNumberInput) => {
  const lineNumber = Math.max(1, Math.min(Number(doc?.lines || 1), Number(lineNumberInput || 1)));
  let activeFence = null;

  for (let line = 1; line <= lineNumber; line += 1) {
    const text = String(doc.line(line).text || "");
    if (!activeFence) {
      const openMatch = text.match(OPEN_FENCE_PATTERN);
      if (!openMatch) {
        continue;
      }
      activeFence = {
        marker: openMatch[1][0] === "~" ? "~" : "`",
        length: openMatch[1].length,
        indent: getLineIndent(text),
        line
      };
      continue;
    }

    if (closeFencePatternFor(activeFence.marker.repeat(activeFence.length)).test(text)) {
      activeFence = null;
    }
  }

  return activeFence;
};

const hasClosingFenceBelow = (doc, fence, fromLineInput) => {
  const fromLine = Math.max(1, Math.min(Number(doc?.lines || 1), Number(fromLineInput || 1)));
  const closePattern = closeFencePatternFor(fence.marker.repeat(fence.length));

  for (let line = fromLine; line <= doc.lines; line += 1) {
    if (closePattern.test(String(doc.line(line).text || ""))) {
      return true;
    }
  }

  return false;
};

export const exitUnclosedFenceOnEmptyLine = (view) => {
  const selection = view?.state?.selection?.main;
  if (!selection?.empty || view.state.selection.ranges.length !== 1) {
    return false;
  }

  const doc = view.state.doc;
  const cursor = selection.head;
  const line = doc.lineAt(cursor);
  if (String(line.text || "").trim().length > 0) {
    return false;
  }

  const activeFence = findUnclosedFenceAtLine(doc, line.number);
  if (!activeFence || line.number <= activeFence.line) {
    return false;
  }
  if (hasClosingFenceBelow(doc, activeFence, line.number + 1)) {
    return false;
  }

  const closingFence = `${activeFence.indent}${activeFence.marker.repeat(activeFence.length)}`;
  view.dispatch({
    changes: {
      from: line.from,
      to: line.to,
      insert: `${closingFence}\n`
    },
    selection: {
      anchor: line.from + closingFence.length + 1
    },
    scrollIntoView: true,
    userEvent: "input"
  });
  return true;
};

export const markdownExtensions = [
  markdown(),
  Prec.high(
    keymap.of([
      {
        key: "Enter",
        run: exitUnclosedFenceOnEmptyLine
      },
      ...markdownKeymap
    ])
  )
];
