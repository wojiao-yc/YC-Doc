import { ref, watch, nextTick, onBeforeUnmount } from "vue";

const MARKDOWN_SAVE_DELAY_MS = 500;
const MAX_MARKDOWN_FILE_BYTES = 20 * 1024 * 1024;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const createBlankStep = (id = 1) => ({
  id,
  title: "",
  subtitle: "",
  content: ""
});
const createBlankSteps = () => [createBlankStep(1)];
const normalizeMarkdownText = (value) => String(value || "").replace(/\r\n/g, "\n");
const trimOuterBlankLines = (value) => String(value || "").replace(/^\n+/, "").replace(/\n+$/, "");
const hasNonWhitespaceMarkdown = (value) => trimOuterBlankLines(normalizeMarkdownText(value)).length > 0;
const appendHeadingStep = (markdown, title) => {
  const base = trimOuterBlankLines(normalizeMarkdownText(markdown));
  const safeTitle = String(title || "").trim() || "步骤";
  return base ? `${base}\n\n# ${safeTitle}\n` : `# ${safeTitle}\n`;
};
const isBlankStep = (step) =>
  !String(step?.title || "").trim()
  && !String(step?.subtitle || "").trim()
  && !String(step?.content || "").trim();

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
  let pendingDocumentMarkdownFromSteps = null;
  let pendingStepsFromDocumentMarkdown = false;
  const lastSavedMarkdownByPath = new Map();

  const isSingleBlankStepList = (list) =>
    Array.isArray(list)
    && list.length === 1
    && isBlankStep(list[0]);

  const defaultStepTitle = (index) => `步骤 ${index + 1}`;

  const stepDisplayTitle = (step, index = 0) => {
    const title = String(step?.title || "").trim();
    if (title) {
      return title;
    }
    const content = String(step?.content || "").trim();
    if ((steps.value?.length || 0) <= 1) {
      return content ? "文档" : "空白文档";
    }
    return defaultStepTitle(index);
  };

  const stepPreviewText = (step) => {
    const lines = normalizeMarkdownText(step?.content || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines[0] || "空白内容";
  };

  const extractMarkdownSections = (rawMarkdown) => {
    const text = normalizeMarkdownText(rawMarkdown);
    const lines = text.split("\n");
    const sections = [];
    let fenceChar = "";
    let pendingPrefixLines = [];
    let currentSection = null;
    let offset = 0;

    const pushSection = (endIndex) => {
      if (!currentSection) {
        return;
      }
      sections.push({
        title: currentSection.title,
        content: trimOuterBlankLines(currentSection.lines.join("\n")),
        startIndex: currentSection.startIndex,
        endIndex
      });
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineStart = offset;
      const hasNewline = index < lines.length - 1;
      const lineEnd = lineStart + line.length + (hasNewline ? 1 : 0);
      const fenceMatch = line.match(/^(```|~~~)/);
      if (fenceMatch) {
        const nextFenceChar = fenceMatch[1][0];
        fenceChar = fenceChar === nextFenceChar ? "" : (fenceChar || nextFenceChar);
      }

      const headingMatch = !fenceChar ? line.match(/^#\s+(.*?)\s*$/) : null;
      if (headingMatch) {
        pushSection(lineStart);
        const prefixStart = pendingPrefixLines[0]?.startIndex;
        currentSection = {
          title: String(headingMatch[1] || "").trim(),
          lines: sections.length === 0 ? pendingPrefixLines.map((item) => item.line) : [],
          startIndex: sections.length === 0 && Number.isFinite(prefixStart) ? prefixStart : lineStart
        };
        pendingPrefixLines = [];
        offset = lineEnd;
        continue;
      }

      const lineRecord = { line, startIndex: lineStart };
      if (currentSection) {
        currentSection.lines.push(line);
      } else {
        pendingPrefixLines.push(lineRecord);
      }
      offset = lineEnd;
    }

    pushSection(text.length);

    if (!sections.length) {
      return [{
        title: "",
        content: trimOuterBlankLines(text),
        startIndex: 0,
        endIndex: text.length
      }];
    }

    return sections;
  };

  const parseMarkdownToSteps = (rawMarkdown) => {
    const text = normalizeMarkdownText(rawMarkdown);
    const sections = extractMarkdownSections(text);

    if (!sections.length) {
      const single = trimOuterBlankLines(text);
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

    return sections.map((section, index) => ({
      id: index + 1,
      title: String(section.title || "").trim(),
      subtitle: "",
      content: String(section.content || "")
    }));
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

  const serializeStepsToMarkdown = (sourceSteps) => {
    const normalizedSteps = Array.isArray(sourceSteps) ? sourceSteps : [];
    if (!normalizedSteps.length || isSingleBlankStepList(normalizedSteps)) {
      return "";
    }
    if (normalizedSteps.length === 1 && !String(normalizedSteps[0]?.title || "").trim()) {
      const rawContent = trimOuterBlankLines(normalizeMarkdownText(normalizedSteps[0]?.content || ""));
      return rawContent ? `${rawContent}\n` : "";
    }
    const chunks = normalizedSteps.map((step, index) => {
      const title = String(step?.title || "").trim() || defaultStepTitle(index);
      const content = trimOuterBlankLines(normalizeMarkdownText(step?.content || ""));
      return content ? `# ${title}\n\n${content}` : `# ${title}`;
    });
    return `${chunks.join("\n\n").trim()}\n`;
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

  const loadMarkdown = (text, { markAsSaved = false, relPath = activeMarkdownRelPath.value } = {}) => {
    const normalized = normalizeMarkdownText(text);
    documentMarkdown.value = normalized;
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

  const syncDocumentMarkdownFromSteps = (sourceSteps = steps.value) => {
    const nextMarkdown = serializeStepsToMarkdown(sourceSteps);
    if (documentMarkdown.value === nextMarkdown) {
      return;
    }
    pendingDocumentMarkdownFromSteps = nextMarkdown;
    documentMarkdown.value = nextMarkdown;
  };

  const applyExternalMarkdownChange = async (nextMarkdown, { focusIndex = null } = {}) => {
    const normalized = updateMarkdown(nextMarkdown);
    const targetSteps = Number.isFinite(focusIndex) ? parseMarkdownToSteps(normalized) : null;
    await nextTick();
    if (Number.isFinite(focusIndex)) {
      const safeIndex = clamp(
        Number(focusIndex) || 0,
        0,
        Math.max(0, (targetSteps?.length || steps.value.length) - 1)
      );
      currentId.value = targetSteps?.[safeIndex]?.id ?? steps.value[safeIndex]?.id ?? steps.value[0]?.id ?? 1;
      if (isEditMode.value) {
        await focusStepInEditMode(safeIndex);
      }
    }
  };

  const syncStepsFromDocumentMarkdown = (rawMarkdown, preserveIndex = currentStepIndex.value) => {
    const parsed = parseMarkdownToSteps(rawMarkdown);
    const targetIndex = clamp(Number(preserveIndex) || 0, 0, Math.max(0, parsed.length - 1));
    pendingStepsFromDocumentMarkdown = true;
    steps.value = parsed;
    currentId.value = parsed[targetIndex]?.id ?? parsed[0]?.id ?? 1;
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
      showToast(`保存 Markdown 失败: ${errorMessage}`);
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
    pendingDocumentMarkdownFromSteps = null;
    pendingStepsFromDocumentMarkdown = false;
    try {
      const result = await desktopDataBridge.readWorkspaceFile({
        relPath: targetRelPath
      });
      if (!result?.ok) {
        if (result?.error === "workspace_file_too_large") {
          const actual = formatBytes(result?.size);
          const limit = formatBytes(result?.limitBytes || MAX_MARKDOWN_FILE_BYTES);
          showToast(`Markdown 文件过大，已跳过: ${targetRelPath} (${actual} > ${limit})`);
          return;
        }
        throw new Error(String(result?.error || "read_workspace_file_failed"));
      }
      if (isMarkdownFileTooLarge(result?.size) || String(result.content || "").length > MAX_MARKDOWN_FILE_BYTES) {
        showToast(`Markdown 文件过大，已跳过: ${targetRelPath}`);
        return;
      }
      const rawMarkdown = normalizeMarkdownText(result.content || "");
      const parsed = parseMarkdownToSteps(rawMarkdown);
      loadMarkdown(rawMarkdown, { markAsSaved: true, relPath: targetRelPath });
      steps.value = parsed;
      currentId.value = parsed[0]?.id ?? 1;
      activeMarkdownRelPath.value = targetRelPath;
      if (showSuccessToast) {
        showToast(`已载入 Markdown: ${targetRelPath}`);
      }
    } catch (error) {
      showToast(`载入 Markdown 失败: ${String(error?.message || error || "unknown_error")}`);
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
    pendingStepsFromDocumentMarkdown = false;
    pendingDocumentMarkdownFromSteps = "";
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

  const addStep = async () => {
    const sourceMarkdown = documentMarkdown.value;
    const list = parseMarkdownToSteps(sourceMarkdown);
    if (!list.length || (isSingleBlankStepList(list) && !hasNonWhitespaceMarkdown(sourceMarkdown))) {
      await applyExternalMarkdownChange(`# ${defaultStepTitle(0)}\n`, { focusIndex: 0 });
      return;
    }

    const insertIndex = clamp(currentStepIndex.value + 1, 0, list.length);
    const nextSteps = list.map((step) => ({ ...step }));
    nextSteps.splice(insertIndex, 0, {
      id: 0,
      title: defaultStepTitle(insertIndex),
      subtitle: "",
      content: ""
    });

    const nextMarkdown = serializeStepsToMarkdown(nextSteps);
    const nextParsed = parseMarkdownToSteps(nextMarkdown);
    if (nextParsed.length <= list.length) {
      const forcedMarkdown = appendHeadingStep(sourceMarkdown, defaultStepTitle(Math.max(1, list.length)));
      const forcedParsed = parseMarkdownToSteps(forcedMarkdown);
      const forcedFocus = Math.max(0, forcedParsed.length - 1);
      await applyExternalMarkdownChange(forcedMarkdown, { focusIndex: forcedFocus });
      return;
    }

    await applyExternalMarkdownChange(nextMarkdown, { focusIndex: insertIndex });
  };

  const removeStep = async () => {
    const list = parseMarkdownToSteps(documentMarkdown.value);
    if (!list.length || isSingleBlankStepList(list)) {
      await applyExternalMarkdownChange("", { focusIndex: 0 });
      return;
    }
    const idx = clamp(currentStepIndex.value, 0, Math.max(0, list.length - 1));
    if (list.length === 1) {
      await applyExternalMarkdownChange("", { focusIndex: 0 });
      return;
    }
    const nextSteps = list.map((step) => ({ ...step }));
    nextSteps.splice(idx, 1);
    const nextIndex = Math.max(0, idx - 1);
    await applyExternalMarkdownChange(serializeStepsToMarkdown(nextSteps), { focusIndex: nextIndex });
  };

  documentMarkdown.value = serializeStepsToMarkdown(steps.value);

  watch(documentMarkdown, (value) => {
    if (markdownHydrating.value) {
      return;
    }
    if (pendingDocumentMarkdownFromSteps !== null && value === pendingDocumentMarkdownFromSteps) {
      pendingDocumentMarkdownFromSteps = null;
      return;
    }
    pendingDocumentMarkdownFromSteps = null;
    syncStepsFromDocumentMarkdown(value);
    if (!activeMarkdownRelPath.value || !isMarkdownDirty()) {
      return;
    }
    scheduleActiveMarkdownSave();
  });

  watch(steps, () => {
    if (pendingStepsFromDocumentMarkdown) {
      pendingStepsFromDocumentMarkdown = false;
    } else {
      syncDocumentMarkdownFromSteps();
    }
    if (!activeMarkdownRelPath.value || markdownHydrating.value || !isMarkdownDirty()) {
      return;
    }
    scheduleActiveMarkdownSave();
  }, { deep: true });

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
    appendMarkdownImage,
    clearScheduledMarkdownSave,
    documentMarkdown,
    extractMarkdownSections,
    flushPendingMarkdownSave,
    formatBytes,
    isMarkdownFileName,
    isMarkdownFileTooLarge,
    isMarkdownDirty,
    isSingleBlankStepList,
    lastSaveError,
    lastSavedAt,
    loadMarkdown,
    loadStepsFromMarkdownFile,
    markdownHydrating,
    parseMarkdownToSteps,
    persistActiveMarkdownBeforeSwitch,
    removeStep,
    resetBlankEditorState,
    saveMarkdown,
    saveStatus,
    serializeStepsToMarkdown,
    stepDisplayTitle,
    stepPreviewText,
    syncDocumentMarkdownFromSteps,
    updateMarkdown,
    writeActiveMarkdownNow,
    addStep
  };
};
