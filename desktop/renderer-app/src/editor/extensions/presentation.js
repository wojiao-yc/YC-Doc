import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";

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

const remapPresentationBlocks = (blocks, changes, nextDocLength) =>
  blocks.map((block) => {
    const fromInput = Number(block?.from || 0);
    const toInput = Number(block?.to || fromInput);
    const mappedFrom = clampPos(changes.mapPos(fromInput, 1), nextDocLength);
    const mappedTo = clampPos(changes.mapPos(toInput, -1), nextDocLength);
    const from = Math.min(mappedFrom, mappedTo);
    const to = Math.max(mappedFrom, mappedTo);
    return {
      ...block,
      from,
      to
    };
  });

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

const buildLineDecorations = (view, blocks, currentBlockId) => {
  const builder = new RangeSetBuilder();
  const doc = view.state.doc;

  for (const block of blocks) {
    const lineRange = resolveLineRange(doc, block);
    for (let lineNumber = lineRange.fromLine; lineNumber <= lineRange.toLine; lineNumber += 1) {
      const line = doc.line(lineNumber);
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          attributes: {
            class: classesForBlockLine(block, currentBlockId, lineNumber, lineRange)
          }
        })
      );
    }
  }

  return builder.finish();
};

class BlockPresentationPlugin {
  constructor(view) {
    const data = view.state.field(presentationDataField);
    this.blocks = data.blocks;
    this.currentBlockId = data.currentBlockId;
    this.decorations = buildLineDecorations(view, this.blocks, this.currentBlockId);
  }

  update(update) {
    const nextData = update.state.field(presentationDataField);
    const nextBlocks = nextData.blocks;
    const nextCurrentBlockId = nextData.currentBlockId;
    const blocksChanged = nextBlocks !== this.blocks;
    const currentChanged = nextCurrentBlockId !== this.currentBlockId;

    if (!blocksChanged && !currentChanged) {
      if (update.docChanged) {
        this.blocks = remapPresentationBlocks(this.blocks, update.changes, update.state.doc.length);
        this.decorations = buildLineDecorations(update.view, this.blocks, this.currentBlockId);
      }
      return;
    }

    this.blocks = nextBlocks;
    this.currentBlockId = nextCurrentBlockId;
    this.decorations = buildLineDecorations(update.view, this.blocks, this.currentBlockId);
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
