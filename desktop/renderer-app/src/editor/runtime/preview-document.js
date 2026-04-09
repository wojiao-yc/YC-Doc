import { isSpecialBlockType, specialBlockStateKeyOf } from "../parser/parse-special-blocks.js";

const clampPos = (valueInput, docLengthInput) => {
  const docLength = Math.max(0, Number(docLengthInput || 0));
  const value = Number(valueInput);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(docLength, Math.round(value)));
};

const nodesOf = (previewDocumentInput) =>
  Array.isArray(previewDocumentInput?.nodes) ? previewDocumentInput.nodes : [];

const docLengthOf = (previewDocumentInput) => Number(previewDocumentInput?.markdown?.length || 0);

export const previewNodeStateKeyOf = (nodeInput = null) => {
  const type = String(nodeInput?.type || "");
  if (!isSpecialBlockType(type)) {
    return "";
  }
  return specialBlockStateKeyOf(type, nodeInput?.from);
};

export const previewNodeIdentityMatches = (nodeInput = null, identityInput = "") => {
  const identity = String(identityInput || "");
  if (!identity || !nodeInput) {
    return false;
  }
  if (String(nodeInput?.id || "") === identity) {
    return true;
  }
  const stateKey = previewNodeStateKeyOf(nodeInput);
  return Boolean(stateKey && stateKey === identity);
};

export const previewNodeIdentityOf = (nodeInput = null) =>
  String(nodeInput?.id || previewNodeStateKeyOf(nodeInput) || "");

export const findPreviewNodeById = (previewDocumentInput, identityInput = "", expectedTypeInput = "") => {
  const identity = String(identityInput || "");
  const expectedType = String(expectedTypeInput || "");
  if (!identity) {
    return null;
  }

  for (const node of nodesOf(previewDocumentInput)) {
    if (expectedType && String(node?.type || "") !== expectedType) {
      continue;
    }
    if (previewNodeIdentityMatches(node, identity)) {
      return node;
    }
  }

  return null;
};

export const resolvePreviewNodeAtPos = (previewDocumentInput, posInput = 0) =>
  resolvePreviewBlockRangeAtPos(previewDocumentInput, posInput)?.node || null;

export const resolveCurrentPreviewNodeId = (previewDocumentInput, posInput = 0) =>
  previewNodeIdentityOf(resolvePreviewNodeAtPos(previewDocumentInput, posInput));

export const specialPreviewNodesOf = (previewDocumentInput) =>
  nodesOf(previewDocumentInput).filter((node) => isSpecialBlockType(node?.type));

export const resolvePreviewBlockRangeById = (previewDocumentInput, identityInput = "", expectedTypeInput = "") => {
  const node = findPreviewNodeById(previewDocumentInput, identityInput, expectedTypeInput);
  if (!node) {
    return null;
  }

  const docLength = docLengthOf(previewDocumentInput);
  const from = clampPos(node?.from, docLength);
  const to = Math.max(from, clampPos(node?.to, docLength));

  return {
    from,
    to,
    rawText: String(node?.rawText || ""),
    node
  };
};

export const resolvePreviewCodeBlockRangeById = (previewDocumentInput, identityInput = "") => {
  const range = resolvePreviewBlockRangeById(previewDocumentInput, identityInput, "code_block");
  if (!range) {
    return null;
  }

  const docLength = docLengthOf(previewDocumentInput);
  const from = range.from;
  return {
    ...range,
    contentFrom: Math.max(from, clampPos(range.node?.source?.contentFrom, docLength)),
    contentTo: Math.max(from, clampPos(range.node?.source?.contentTo, docLength))
  };
};

export const resolvePreviewBlockRangeAtPos = (previewDocumentInput, posInput = 0, fallbackRangeInput = null) => {
  const docLength = docLengthOf(previewDocumentInput);
  const pos = clampPos(posInput, docLength);
  let pickedRange = null;
  let pickedSpan = Number.POSITIVE_INFINITY;

  for (const node of nodesOf(previewDocumentInput)) {
    const from = clampPos(node?.from, docLength);
    const to = Math.max(from, clampPos(node?.to, docLength));
    if (pos < from || pos > to) {
      continue;
    }
    const span = Math.max(0, to - from);
    if (span <= pickedSpan) {
      pickedSpan = span;
      pickedRange = {
        from,
        to,
        rawText: String(node?.rawText || ""),
        node
      };
    }
  }

  return pickedRange || fallbackRangeInput || null;
};
