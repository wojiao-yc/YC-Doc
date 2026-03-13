import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

const safePosForLineLookup = (doc, pos) => {
  const length = Number(doc.length || 0);
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(length, Number(pos || 0)));
};

const resolveLineRange = (doc, block) => {
  const fromPos = safePosForLineLookup(doc, block.from);
  const toBase = Number(block.to || block.from);
  const toPos = safePosForLineLookup(doc, Math.max(fromPos, toBase > fromPos ? toBase - 1 : toBase));
  const fromLine = doc.lineAt(fromPos).number;
  const toLine = doc.lineAt(toPos).number;
  return { fromLine, toLine };
};

const normalizePresentationData = (input = {}) => ({
  blocks: Array.isArray(input.blocks) ? input.blocks : [],
  currentBlockId: String(input.currentBlockId || "")
});

const clampPos = (value, length) => Math.max(0, Math.min(Number(length || 0), Number(value || 0)));

const mapRange = (changes, fromInput, toInput, nextDocLength) => {
  const fromBase = Number(fromInput || 0);
  const toBase = Number(toInput || fromBase);
  const mappedFrom = clampPos(changes.mapPos(fromBase, 1), nextDocLength);
  const mappedTo = clampPos(changes.mapPos(toBase, -1), nextDocLength);
  return {
    from: Math.min(mappedFrom, mappedTo),
    to: Math.max(mappedFrom, mappedTo)
  };
};

const remapInlineSegments = (segments, changes, nextDocLength) =>
  (Array.isArray(segments) ? segments : [])
    .map((segment) => {
      const mappedRange = mapRange(changes, segment?.from, segment?.to, nextDocLength);
      return {
        ...segment,
        from: mappedRange.from,
        to: mappedRange.to,
        innerFrom: mappedRange.from,
        innerTo: mappedRange.to,
        outerFrom: mappedRange.from,
        outerTo: mappedRange.to
      };
    })
    .filter((segment) => segment.to > segment.from);

const remapPresentationBlocks = (blocks, changes, nextDocLength) =>
  blocks
    .map((block) => {
      const mappedRange = mapRange(changes, block?.from, block?.to, nextDocLength);
      return {
        ...block,
        from: mappedRange.from,
        to: mappedRange.to,
        inlineSegments: remapInlineSegments(block?.inlineSegments, changes, nextDocLength)
      };
    })
    .filter((block) => block.to > block.from);

const inlineClassesForSegment = (segment) => {
  const marks = Array.isArray(segment?.marks) ? segment.marks : [];
  const classes = [];

  if (marks.includes("del")) {
    classes.push("cm-inline-del");
  }
  if (marks.includes("codespan")) {
    classes.push("cm-inline-codespan");
  }

  return classes.join(" ");
};

export const setPresentationDataEffect = StateEffect.define();

const presentationDataField = StateField.define({
  create: () => normalizePresentationData(),
  update: (value, transaction) => {
    let next = value;
    for (const effect of transaction.effects) {
      if (effect.is(setPresentationDataEffect)) {
        next = normalizePresentationData(effect.value);
      }
    }
    return next;
  }
});

const classesForBlockLine = (block, currentBlockId, lineNumber, lineRange) => {
  const classes = [
    "cm-block",
    `cm-block-${String(block.type || "paragraph").replace(/_/g, "-")}`
  ];

  if (lineNumber === lineRange.fromLine) {
    classes.push("cm-block-start");
  }
  if (lineNumber === lineRange.toLine) {
    classes.push("cm-block-end");
  }
  if (String(block.id) === String(currentBlockId || "")) {
    classes.push("cm-block-current");
  }

  if (block.type === "heading") {
    const level = Math.max(1, Math.min(6, Number(block?.attrs?.level || 1)));
    classes.push(`cm-block-heading-l${level}`);
  }
  if (block.type === "task_list_item") {
    classes.push(block?.attrs?.checked ? "cm-task-checked" : "cm-task-unchecked");
  }
  if (block.type === "bullet_list_item" || block.type === "ordered_list_item" || block.type === "task_list_item") {
    const level = Math.max(1, Math.min(6, Number(block?.attrs?.level || 1)));
    classes.push(`cm-list-level-${level}`);
  }

  return classes.join(" ");
};

const buildDecorations = (view, blocks, currentBlockId) => {
  const decorations = [];
  const doc = view.state.doc;
  const docLength = Number(doc.length || 0);

  for (const block of blocks) {
    const lineRange = resolveLineRange(doc, block);
    for (let lineNumber = lineRange.fromLine; lineNumber <= lineRange.toLine; lineNumber += 1) {
      const line = doc.line(lineNumber);
      decorations.push(
        Decoration.line({
          attributes: {
            class: classesForBlockLine(block, currentBlockId, lineNumber, lineRange)
          }
        }).range(line.from)
      );
    }

    const inlineSegments = Array.isArray(block?.inlineSegments) ? block.inlineSegments : [];
    for (const segment of inlineSegments) {
      const className = inlineClassesForSegment(segment);
      if (!className) {
        continue;
      }
      const from = clampPos(segment?.from, docLength);
      const to = clampPos(segment?.to, docLength);
      if (to <= from) {
        continue;
      }
      decorations.push(
        Decoration.mark({
          class: className
        }).range(from, to)
      );
    }
  }

  return Decoration.set(decorations, true);
};

const isWholeDocumentReplacement = (update) => {
  let changeCount = 0;
  let replaceAll = true;

  update.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    changeCount += 1;
    if (
      fromA !== 0
      || toA !== update.startState.doc.length
      || fromB !== 0
      || toB !== update.state.doc.length
    ) {
      replaceAll = false;
    }
  });

  return changeCount === 1 && replaceAll;
};

class BlockPresentationPlugin {
  constructor(view) {
    const data = view.state.field(presentationDataField);
    this.blocks = data.blocks;
    this.currentBlockId = data.currentBlockId;
    this.decorations = buildDecorations(view, this.blocks, this.currentBlockId);
  }

  update(update) {
    const nextData = update.state.field(presentationDataField);
    const nextBlocks = nextData.blocks;
    const nextCurrentBlockId = nextData.currentBlockId;
    const blocksChanged = nextBlocks !== this.blocks;
    const currentChanged = nextCurrentBlockId !== this.currentBlockId;

    if (!blocksChanged && !currentChanged) {
      if (update.docChanged) {
        // A replace-all edit invalidates every old block range at once, so wait for the next snapshot.
        this.blocks = isWholeDocumentReplacement(update)
          ? []
          : remapPresentationBlocks(this.blocks, update.changes, update.state.doc.length);
        this.decorations = buildDecorations(update.view, this.blocks, this.currentBlockId);
      }
      return;
    }

    this.blocks = nextBlocks;
    this.currentBlockId = nextCurrentBlockId;
    this.decorations = buildDecorations(update.view, this.blocks, this.currentBlockId);
  }
}

export const presentationExtensions = [
  presentationDataField,
  EditorView.baseTheme({
    ".cm-line.cm-block": {
      transition: "background-color 120ms ease, color 120ms ease"
    }
  }),
  ViewPlugin.fromClass(BlockPresentationPlugin, {
    decorations: (plugin) => plugin.decorations
  })
];
