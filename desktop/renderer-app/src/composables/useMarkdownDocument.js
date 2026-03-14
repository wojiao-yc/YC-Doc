import { ref, watch, nextTick, onBeforeUnmount } from "vue";

const MARKDOWN_SAVE_DELAY_MS = 500;
const MAX_MARKDOWN_FILE_BYTES = 20 * 1024 * 1024;
const HEADING_LINE_PATTERN = /^#\s+(.*?)\s*$/;
const OPEN_FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})(.*)$/;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeMarkdownText = (value) => String(value || "").replace(/\r\n/g, "\n");
const trimOuterBlankLines = (value) => String(value || "").replace(/^\n+/, "").replace(/\n+$/, "");
const trimClosingHeadingHashes = (text) => String(text || "").replace(/[ \t]+#+[ \t]*$/, "").trim();

const createBlankStep = (id = 1) => ({
  id,
  title: "",
  subtitle: "",
  content: ""
});

const createBlankSteps = () => [createBlankStep(1)];
const defaultStepTitle = (index) => `Step ${index + 1}`;

const closeFencePatternFor = (fenceToken) => {
  const marker = fenceToken[0] === "~" ? "~" : "`";
  const length = fenceToken.length;
  return new RegExp(`^\\s{0,3}${marker}{${length},}\\s*$`);
};

const collectHeadingSections = (rawMarkdown) => {
  const text = normalizeMarkdownText(rawMarkdown);
  const lines = text.split("\n");
  const sections = [];

  let activeFence = null;
  let currentSection = null;
  let offset = 0;

  const closeCurrentSectionAt = (endPos) => {
    if (!currentSection) {
      return;
    }
    const sectionEnd = Math.max(currentSection.start, Math.min(text.length, Number(endPos || 0)));
    const rawBody = text.slice(currentSection.bodyStart, sectionEnd);
    sections.push({
      ...currentSection,
      end: sectionEnd,
      content: trimOuterBlankLines(rawBody)
    });
    currentSection = null;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = String(lines[lineIndex] || "");
    const lineStart = offset;
    const hasNewline = lineIndex < lines.length - 1;
    const lineEnd = lineStart + line.length + (hasNewline ? 1 : 0);

    if (!activeFence) {
      const openFenceMatch = line.match(OPEN_FENCE_PATTERN);
      if (openFenceMatch) {
        activeFence = {
          marker: openFenceMatch[1][0] === "~" ? "~" : "`",
          length: openFenceMatch[1].length
        };
      }
    } else if (closeFencePatternFor(activeFence.marker.repeat(activeFence.length)).test(line)) {
      activeFence = null;
    }

    const headingMatch = !activeFence ? line.match(HEADING_LINE_PATTERN) : null;
    if (headingMatch) {
      closeCurrentSectionAt(lineStart);
      currentSection = {
        start: lineStart,
        headingFrom: lineStart,
        headingTo: lineStart + line.length,
        bodyStart: lineEnd,
        title: trimClosingHeadingHashes(headingMatch[1])
      };
    }

    offset = lineEnd;
  }

  closeCurrentSectionAt(text.length);

  const firstHeadingStart = sections[0]?.start ?? text.length;
  const prologue = text.slice(0, firstHeadingStart);

  return {
    text,
    prologue,
    sections
  };
};

const serializeHeadingSections = ({ prologue = "", sections = [] } = {}) => {
  const normalizedPrologue = trimOuterBlankLines(normalizeMarkdownText(prologue));
  const chunks = (Array.isArray(sections) ? sections : []).map((section) => {
    const title = trimClosingHeadingHashes(section?.title || "");
    const content = trimOuterBlankLines(normalizeMarkdownText(section?.content || ""));
    const headingLine = title ? `# ${title}` : "# ";
    return content ? `${headingLine}\n\n${content}` : headingLine;
  });

  let markdown = chunks.join("\n\n");
  if (normalizedPrologue) {
    markdown = markdown ? `${normalizedPrologue}\n\n${markdown}` : normalizedPrologue;
  }

  return markdown ? `${markdown}\n` : "";
};

const sectionsToSteps = ({ prologue = "", sections = [] } = {}) => {
  if (!sections.length) {
    const single = trimOuterBlankLines(prologue);
    if (!single) {
      return createBlankSteps();
    }
    return [{
      id: 1,
      title: "",
      subtitle: "",
      content: single
    }];
  }

  const leading = trimOuterBlankLines(prologue);
  return sections.map((section, index) => {
    let content = String(section?.content || "");
    if (index === 0 && leading) {
      content = content ? `${leading}\n\n${content}` : leading;
    }
    return {
      id: index + 1,
      title: String(section?.title || "").trim(),
      subtitle: "",
      content
    };
  });
};

export const useMarkdownDocument = ({
  steps,
  currentId,
  currentStepIndex,
  isEditMode,
  desktopDataBridge,
  isDesktopStorage,
  canWorkspaceFileIO,
  showToast,
  focusStepInEditMode
}) => {
  const activeMarkdownRelPath = ref("");
  const documentMarkdown = ref("");
  const markdownHydrating = ref(false);
  const saveStatus = ref("idle");
  const lastSavedAt = ref(0);
  const lastSaveError = ref("");

  let markdownSaveTimer = null;
  const lastSavedMarkdownByPath = new Map();

  const isSingleBlankStepList = (list) =>
    Array.isArray(list)
    && list.length === 1
    && !String(list[0]?.title || "").trim()
    && !String(list[0]?.subtitle || "").trim()
    && !String(list[0]?.content || "").trim();

  const stepDisplayTitle = (step, index = 0) => {
    const title = String(step?.title || "").trim();
    if (title) {
      return title;
    }
    const content = String(step?.content || "").trim();
    if ((steps.value?.length || 0) <= 1) {
      return content ? "Document" : "Blank Document";
    }
    return defaultStepTitle(index);
  };

  const stepPreviewText = (step) => {
    const lines = normalizeMarkdownText(step?.content || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines[0] || "Blank Content";
  };

  const parseMarkdownToSteps = (rawMarkdown) => {
    const model = collectHeadingSections(rawMarkdown);
    return sectionsToSteps(model);
  };

  const extractMarkdownSections = (rawMarkdown) => {
    const model = collectHeadingSections(rawMarkdown);
    return model.sections.map((section) => ({
      title: String(section.title || "").trim(),
      content: String(section.content || ""),
      startIndex: section.start,
      endIndex: section.end
    }));
  };

  const serializeStepsToMarkdown = (sourceSteps) => {
    const list = Array.isArray(sourceSteps) ? sourceSteps : [];
    if (!list.length || isSingleBlankStepList(list)) {
      return "";
    }

    const hasAnyHeadingTitle = list.some((step) => String(step?.title || "").trim().length > 0);
    if (!hasAnyHeadingTitle && list.length === 1) {
      const rawContent = trimOuterBlankLines(normalizeMarkdownText(list[0]?.content || ""));
      return rawContent ? `${rawContent}\n` : "";
    }

    const sections = list.map((step, index) => ({
      title: String(step?.title || "").trim() || defaultStepTitle(index),
      content: String(step?.content || "")
    }));

    return serializeHeadingSections({
      prologue: "",
      sections
    });
  };

  const formatBytes = (value) => {
    const bytes = Math.max(0, Number(value || 0));
    if (!bytes) {
      return "0 B";
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isMarkdownFileName = (name) => String(name || "").toLowerCase().endsWith(".md");

  const isMarkdownFileTooLarge = (size) => {
    const bytes = Number(size);
    return Number.isFinite(bytes) && bytes > MAX_MARKDOWN_FILE_BYTES;
  };

  const normalizeRelPath = (value) => String(value || "").trim();

  const getPathSnapshot = (targetRelPath = activeMarkdownRelPath.value) => {
    const relPath = normalizeRelPath(targetRelPath);
    if (!relPath || !lastSavedMarkdownByPath.has(relPath)) {
      return null;
    }
    return String(lastSavedMarkdownByPath.get(relPath) || "");
  };

  const setPathSnapshot = (targetRelPath, content) => {
    const relPath = normalizeRelPath(targetRelPath);
    if (!relPath) {
      return;
    }
    lastSavedMarkdownByPath.set(relPath, normalizeMarkdownText(content));
  };

  const syncStepsFromDocumentMarkdown = (rawMarkdown, preserveIndex = currentStepIndex.value) => {
    const parsed = parseMarkdownToSteps(rawMarkdown);
    const nextIndex = clamp(Number(preserveIndex) || 0, 0, Math.max(0, parsed.length - 1));
    steps.value = parsed;
    currentId.value = parsed[nextIndex]?.id ?? parsed[0]?.id ?? 1;
  };

  const loadMarkdown = (text, { markAsSaved = false, relPath = activeMarkdownRelPath.value } = {}) => {
    const normalized = normalizeMarkdownText(text);
    documentMarkdown.value = normalized;
    syncStepsFromDocumentMarkdown(normalized, 0);
    if (markAsSaved) {
      setPathSnapshot(relPath, normalized);
      saveStatus.value = "saved";
      lastSavedAt.value = 0;
      lastSaveError.value = "";
    }
    return normalized;
  };

  const updateMarkdown = (text) => {
    const normalized = normalizeMarkdownText(text);
    if (documentMarkdown.value === normalized) {
      return normalized;
    }
    documentMarkdown.value = normalized;
    return normalized;
  };

  const isMarkdownDirty = (targetRelPath = activeMarkdownRelPath.value, content = documentMarkdown.value) => {
    const relPath = normalizeRelPath(targetRelPath);
    if (!relPath) {
      return false;
    }
    const snapshot = getPathSnapshot(relPath);
    if (snapshot === null) {
      return true;
    }
    return snapshot !== normalizeMarkdownText(content);
  };

  const writeActiveMarkdownNow = async (
    targetRelPath = activeMarkdownRelPath.value,
    sourceMarkdown = documentMarkdown.value,
    { force = false } = {}
  ) => {
    const relPath = normalizeRelPath(targetRelPath);
    if (!isDesktopStorage || !canWorkspaceFileIO || !relPath || markdownHydrating.value) {
      return false;
    }
    try {
      const content = normalizeMarkdownText(sourceMarkdown);
      if (!force && !isMarkdownDirty(relPath, content)) {
        return false;
      }
      saveStatus.value = "saving";
      lastSaveError.value = "";
      const result = await desktopDataBridge.writeWorkspaceFile({
        relPath,
        content
      });
      if (!result?.ok) {
        throw new Error(String(result?.error || "write_workspace_file_failed"));
      }
      setPathSnapshot(relPath, content);
      lastSavedAt.value = Date.now();
      saveStatus.value = "saved";
      return true;
    } catch (error) {
      const errorMessage = String(error?.message || error || "unknown_error");
      saveStatus.value = "error";
      lastSaveError.value = errorMessage;
      showToast(`Save markdown failed: ${errorMessage}`);
      return false;
    }
  };

  const saveMarkdown = async (
    targetRelPath = activeMarkdownRelPath.value,
    sourceMarkdown = documentMarkdown.value,
    options = {}
  ) => writeActiveMarkdownNow(targetRelPath, sourceMarkdown, options);

  const scheduleActiveMarkdownSave = () => {
    if (!activeMarkdownRelPath.value || markdownHydrating.value || !isMarkdownDirty()) {
      return;
    }
    if (markdownSaveTimer) {
      clearTimeout(markdownSaveTimer);
    }
    markdownSaveTimer = setTimeout(() => {
      markdownSaveTimer = null;
      void saveMarkdown();
    }, MARKDOWN_SAVE_DELAY_MS);
  };

  const clearScheduledMarkdownSave = () => {
    if (!markdownSaveTimer) {
      return;
    }
    clearTimeout(markdownSaveTimer);
    markdownSaveTimer = null;
  };

  const flushPendingMarkdownSave = async (targetRelPath = activeMarkdownRelPath.value) => {
    const relPath = normalizeRelPath(targetRelPath);
    if (!relPath || markdownHydrating.value) {
      return;
    }
    clearScheduledMarkdownSave();
    await saveMarkdown(relPath);
  };

  const persistActiveMarkdownBeforeSwitch = async (targetRelPath = "") => {
    const currentRelPath = normalizeRelPath(activeMarkdownRelPath.value);
    const nextRelPath = normalizeRelPath(targetRelPath);
    if (!currentRelPath) {
      clearScheduledMarkdownSave();
      return;
    }
    if (!markdownSaveTimer && currentRelPath === nextRelPath && !isMarkdownDirty(currentRelPath)) {
      return;
    }
    if (!markdownSaveTimer && !isMarkdownDirty(currentRelPath)) {
      return;
    }
    await flushPendingMarkdownSave(currentRelPath);
  };

  const applyExternalMarkdownChange = async (nextMarkdown, { focusIndex = null, focusEditor = true } = {}) => {
    const normalized = updateMarkdown(nextMarkdown);
    const targetSteps = Number.isFinite(focusIndex) ? parseMarkdownToSteps(normalized) : null;
    await nextTick();
    if (!Number.isFinite(focusIndex)) {
      return;
    }
    const safeIndex = clamp(
      Number(focusIndex) || 0,
      0,
      Math.max(0, (targetSteps?.length || steps.value.length) - 1)
    );
    currentId.value = targetSteps?.[safeIndex]?.id ?? steps.value[safeIndex]?.id ?? steps.value[0]?.id ?? 1;
    if (focusEditor && isEditMode.value) {
      await focusStepInEditMode(safeIndex);
    }
  };

  const addStep = async () => {
    const model = collectHeadingSections(documentMarkdown.value);
    const sections = model.sections.map((section) => ({
      title: section.title,
      content: section.content
    }));

    if (!sections.length) {
      const insertTitle = defaultStepTitle(0);
      const base = trimOuterBlankLines(model.text);
      const nextMarkdown = base ? `${base}\n\n# ${insertTitle}\n` : `# ${insertTitle}\n`;
      await applyExternalMarkdownChange(nextMarkdown, { focusIndex: 0 });
      return;
    }

    const insertIndex = clamp(currentStepIndex.value + 1, 0, sections.length);
    sections.splice(insertIndex, 0, {
      title: defaultStepTitle(insertIndex),
      content: ""
    });
    const nextMarkdown = serializeHeadingSections({
      prologue: model.prologue,
      sections
    });
    await applyExternalMarkdownChange(nextMarkdown, { focusIndex: insertIndex });
  };

  const removeStep = async () => {
    const model = collectHeadingSections(documentMarkdown.value);
    if (!model.sections.length) {
      await applyExternalMarkdownChange("", { focusIndex: 0 });
      return;
    }

    const nextSections = model.sections.map((section) => ({
      title: section.title,
      content: section.content
    }));
    const idx = clamp(currentStepIndex.value, 0, Math.max(0, nextSections.length - 1));
    nextSections.splice(idx, 1);

    const nextMarkdown = serializeHeadingSections({
      prologue: model.prologue,
      sections: nextSections
    });
    const nextIndex = Math.max(0, idx - 1);
    await applyExternalMarkdownChange(nextMarkdown, { focusIndex: nextIndex });
  };

  const renameStepTitle = async (index, nextTitle) => {
    const model = collectHeadingSections(documentMarkdown.value);
    if (!model.sections.length) {
      return false;
    }

    const safeIndex = clamp(Number(index) || 0, 0, Math.max(0, model.sections.length - 1));
    const normalizedTitle = trimClosingHeadingHashes(nextTitle || "");

    const nextSections = model.sections.map((section) => ({
      title: section.title,
      content: section.content
    }));
    if (nextSections[safeIndex]?.title === normalizedTitle) {
      return false;
    }
    nextSections[safeIndex].title = normalizedTitle;

    const nextMarkdown = serializeHeadingSections({
      prologue: model.prologue,
      sections: nextSections
    });
    await applyExternalMarkdownChange(nextMarkdown, { focusIndex: safeIndex, focusEditor: false });
    return true;
  };

  const moveStep = async (fromIndexInput, toIndexInput) => {
    const model = collectHeadingSections(documentMarkdown.value);
    const count = model.sections.length;
    if (count <= 1) {
      return false;
    }

    const fromIndex = clamp(Number(fromIndexInput) || 0, 0, count - 1);
    const toIndex = clamp(Number(toIndexInput) || 0, 0, count - 1);
    if (fromIndex === toIndex) {
      return false;
    }

    const nextSections = model.sections.map((section) => ({
      title: section.title,
      content: section.content
    }));
    const [moved] = nextSections.splice(fromIndex, 1);
    nextSections.splice(toIndex, 0, moved);

    const nextMarkdown = serializeHeadingSections({
      prologue: model.prologue,
      sections: nextSections
    });
    await applyExternalMarkdownChange(nextMarkdown, { focusIndex: toIndex, focusEditor: false });
    return true;
  };

  const syncDocumentMarkdownFromSteps = (sourceSteps = steps.value) => {
    const nextMarkdown = serializeStepsToMarkdown(sourceSteps);
    updateMarkdown(nextMarkdown);
  };

  const loadStepsFromMarkdownFile = async (relPath, showSuccessToast = false) => {
    if (!isDesktopStorage || !canWorkspaceFileIO) {
      return;
    }
    const targetRelPath = normalizeRelPath(relPath);
    if (!targetRelPath) {
      return;
    }
    await persistActiveMarkdownBeforeSwitch(targetRelPath);
    markdownHydrating.value = true;
    try {
      const result = await desktopDataBridge.readWorkspaceFile({
        relPath: targetRelPath
      });
      if (!result?.ok) {
        if (result?.error === "workspace_file_too_large") {
          const actual = formatBytes(result?.size);
          const limit = formatBytes(result?.limitBytes || MAX_MARKDOWN_FILE_BYTES);
          showToast(`Markdown file too large, skipped: ${targetRelPath} (${actual} > ${limit})`);
          return;
        }
        throw new Error(String(result?.error || "read_workspace_file_failed"));
      }
      if (isMarkdownFileTooLarge(result?.size) || String(result.content || "").length > MAX_MARKDOWN_FILE_BYTES) {
        showToast(`Markdown file too large, skipped: ${targetRelPath}`);
        return;
      }
      const rawMarkdown = normalizeMarkdownText(result.content || "");
      loadMarkdown(rawMarkdown, { markAsSaved: true, relPath: targetRelPath });
      activeMarkdownRelPath.value = targetRelPath;
      if (showSuccessToast) {
        showToast(`Markdown loaded: ${targetRelPath}`);
      }
    } catch (error) {
      showToast(`Load markdown failed: ${String(error?.message || error || "unknown_error")}`);
    } finally {
      markdownHydrating.value = false;
    }
  };

  const resetBlankEditorState = ({ preserveActiveFile = false } = {}) => {
    const previousRelPath = normalizeRelPath(activeMarkdownRelPath.value);
    if (!preserveActiveFile) {
      activeMarkdownRelPath.value = "";
      if (previousRelPath) {
        lastSavedMarkdownByPath.delete(previousRelPath);
      }
    }
    documentMarkdown.value = "";
    steps.value = createBlankSteps();
    currentId.value = steps.value[0]?.id ?? 1;
  };

  const appendMarkdownImage = (url) => {
    const safeUrl = String(url || "").trim();
    if (!safeUrl) {
      return;
    }
    const current = String(documentMarkdown.value || "");
    const suffix = current.endsWith("\n") ? "\n" : "\n\n";
    documentMarkdown.value = `${current}${suffix}![image](${safeUrl})\n`;
  };

  documentMarkdown.value = serializeStepsToMarkdown(steps.value);
  syncStepsFromDocumentMarkdown(documentMarkdown.value, 0);

  watch(documentMarkdown, (value) => {
    if (markdownHydrating.value) {
      return;
    }
    syncStepsFromDocumentMarkdown(value);
    if (!activeMarkdownRelPath.value || !isMarkdownDirty()) {
      return;
    }
    scheduleActiveMarkdownSave();
  });

  watch(activeMarkdownRelPath, () => {
    clearScheduledMarkdownSave();
    if (!activeMarkdownRelPath.value) {
      saveStatus.value = "idle";
      lastSavedAt.value = 0;
      lastSaveError.value = "";
    }
  });

  onBeforeUnmount(() => {
    clearScheduledMarkdownSave();
  });

  return {
    activeMarkdownRelPath,
    addStep,
    appendMarkdownImage,
    clearScheduledMarkdownSave,
    documentMarkdown,
    extractMarkdownSections,
    flushPendingMarkdownSave,
    formatBytes,
    isMarkdownDirty,
    isMarkdownFileName,
    isMarkdownFileTooLarge,
    isSingleBlankStepList,
    lastSaveError,
    lastSavedAt,
    loadMarkdown,
    loadStepsFromMarkdownFile,
    markdownHydrating,
    moveStep,
    parseMarkdownToSteps,
    persistActiveMarkdownBeforeSwitch,
    removeStep,
    renameStepTitle,
    resetBlankEditorState,
    saveMarkdown,
    saveStatus,
    serializeHeadingSections,
    serializeStepsToMarkdown,
    stepDisplayTitle,
    stepPreviewText,
    syncDocumentMarkdownFromSteps,
    updateMarkdown,
    writeActiveMarkdownNow
  };
};

