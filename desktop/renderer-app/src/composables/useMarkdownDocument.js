import { computed, ref, watch, nextTick, onBeforeUnmount } from "vue";
import { serializeImageLine } from "../editor/parser/parse-image.js";
import { normalizeMarkdownDocument, normalizeMarkdownText } from "../utils/markdown-normalize.js";

const MARKDOWN_SAVE_DELAY_MS = 500;
const MAX_MARKDOWN_FILE_BYTES = 20 * 1024 * 1024;
const SECTION_HEADING_PATTERN = /^#\s+(.*?)\s*$/;
const HEADING_LINE_PATTERN = /^\s{0,3}(#{1,6})[ \t]+(.+?)\s*$/;
const HEADING_SUBTITLE_META_PATTERN = /^\s*<!--\s*yc-heading-subtitle\s*:\s*(.*?)\s*-->\s*$/i;
const OPEN_FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})(.*)$/;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const trimOuterBlankLines = (value) => String(value || "").replace(/^\n+/, "").replace(/\n+$/, "");
const trimClosingHeadingHashes = (text) => String(text || "").replace(/[ \t]+#+[ \t]*$/, "").trim();
const normalizeHeadingSubtitle = (value) => String(value || "")
  .replace(/\r?\n+/g, " ")
  .replace(/\s+/g, " ")
  .replace(/-->/g, "")
  .trim();

const parseHeadingSubtitleMeta = (lineText = "") => {
  const match = String(lineText || "").match(HEADING_SUBTITLE_META_PATTERN);
  return match ? normalizeHeadingSubtitle(match[1]) : "";
};

const serializeHeadingSubtitleMeta = (subtitleInput = "") => {
  const subtitle = normalizeHeadingSubtitle(subtitleInput);
  return subtitle ? `<!-- yc-heading-subtitle:${subtitle} -->` : "";
};

const extractHeadingSubtitleFromBody = (rawBody = "") => {
  const normalized = normalizeMarkdownText(rawBody);
  const lines = normalized.split("\n");
  const subtitle = parseHeadingSubtitleMeta(lines[0] || "");
  if (!subtitle) {
    return {
      subtitle: "",
      content: trimOuterBlankLines(normalized)
    };
  }

  lines.splice(0, 1);
  if (lines[0] === "") {
    lines.splice(0, 1);
  }

  return {
    subtitle,
    content: trimOuterBlankLines(lines.join("\n"))
  };
};

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
    const { subtitle, content } = extractHeadingSubtitleFromBody(rawBody);
    sections.push({
      ...currentSection,
      end: sectionEnd,
      subtitle,
      content
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

    const headingMatch = !activeFence ? line.match(SECTION_HEADING_PATTERN) : null;
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
    const subtitle = serializeHeadingSubtitleMeta(section?.subtitle || "");
    const content = trimOuterBlankLines(normalizeMarkdownText(section?.content || ""));
    const headingLine = title ? `# ${title}` : "# ";
    if (subtitle && content) {
      return `${headingLine}\n${subtitle}\n\n${content}`;
    }
    if (subtitle) {
      return `${headingLine}\n${subtitle}`;
    }
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
      subtitle: String(section?.subtitle || "").trim(),
      content
    };
  });
};

const collectHeadingOutline = (rawMarkdown) => {
  const text = normalizeMarkdownText(rawMarkdown);
  const lines = text.split("\n");
  const headings = [];

  let activeFence = null;
  let offset = 0;

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
      const level = String(headingMatch[1] || "").length;
      const nextLine = lineIndex < lines.length - 1 ? String(lines[lineIndex + 1] || "") : "";
      const nextHasNewline = lineIndex + 1 < lines.length - 1;
      const subtitle = parseHeadingSubtitleMeta(nextLine);
      const subtitleMetaFrom = subtitle ? lineEnd : -1;
      const subtitleMetaTo = subtitle
        ? lineEnd + nextLine.length + (nextHasNewline ? 1 : 0)
        : -1;

      headings.push({
        id: `heading-outline-${headings.length + 1}`,
        level,
        title: trimClosingHeadingHashes(headingMatch[2] || ""),
        subtitle,
        from: lineStart,
        to: lineStart + line.length,
        lineEnd,
        subtitleMetaFrom,
        subtitleMetaTo
      });
    }

    offset = lineEnd;
  }

  return headings;
};

export const useMarkdownDocument = ({
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
  const steps = ref(createBlankSteps());
  const currentId = ref(steps.value[0]?.id ?? 1);
  const activeStep = computed(
    () => steps.value.find((step) => step.id === currentId.value) || steps.value[0] || createBlankStep(1)
  );
  const currentStepIndex = computed(() =>
    Math.max(0, steps.value.findIndex((step) => step.id === currentId.value))
  );
  const isFirstStep = computed(() => currentStepIndex.value <= 0);
  const isLastStep = computed(() => currentStepIndex.value >= Math.max(0, steps.value.length - 1));

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

  const parseMarkdownToSteps = (rawMarkdown) => {
    const model = collectHeadingSections(rawMarkdown);
    return sectionsToSteps(model);
  };

  const extractMarkdownSections = (rawMarkdown) => {
    const model = collectHeadingSections(rawMarkdown);
    return model.sections.map((section) => ({
      title: String(section.title || "").trim(),
      subtitle: String(section.subtitle || "").trim(),
      content: String(section.content || ""),
      headingStart: section.headingFrom,
      headingEnd: section.headingTo,
      bodyStart: section.bodyStart,
      startIndex: section.start,
      endIndex: section.end
    }));
  };

  const extractHeadingOutline = (rawMarkdown) =>
    collectHeadingOutline(rawMarkdown).map((heading) => ({
      ...heading,
      title: String(heading.title || "").trim(),
      subtitle: String(heading.subtitle || "").trim()
    }));

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
      subtitle: String(step?.subtitle || "").trim(),
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
    lastSavedMarkdownByPath.set(relPath, normalizeMarkdownDocument(content));
  };

  const syncStepsFromDocumentMarkdown = (rawMarkdown, preserveIndex = currentStepIndex.value) => {
    const parsed = parseMarkdownToSteps(rawMarkdown);
    const nextIndex = clamp(Number(preserveIndex) || 0, 0, Math.max(0, parsed.length - 1));
    steps.value = parsed;
    currentId.value = parsed[nextIndex]?.id ?? parsed[0]?.id ?? 1;
  };

  const loadMarkdown = (text, { markAsSaved = false, relPath = activeMarkdownRelPath.value } = {}) => {
    const normalized = normalizeMarkdownDocument(text);
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
    const normalized = normalizeMarkdownDocument(text);
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
    return snapshot !== normalizeMarkdownDocument(content);
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
      const content = normalizeMarkdownDocument(sourceMarkdown);
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
      subtitle: section.subtitle,
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

  const loadMarkdownFile = async (relPath, showSuccessToast = false) => {
    if (!isDesktopStorage || !canWorkspaceFileIO) {
      return false;
    }
    const targetRelPath = normalizeRelPath(relPath);
    if (!targetRelPath) {
      return false;
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
          return false;
        }
        throw new Error(String(result?.error || "read_workspace_file_failed"));
      }
      if (isMarkdownFileTooLarge(result?.size) || String(result.content || "").length > MAX_MARKDOWN_FILE_BYTES) {
        showToast(`Markdown file too large, skipped: ${targetRelPath}`);
        return false;
      }
      const rawMarkdown = normalizeMarkdownDocument(result.content || "");
      loadMarkdown(rawMarkdown, { markAsSaved: true, relPath: targetRelPath });
      activeMarkdownRelPath.value = targetRelPath;
      if (showSuccessToast) {
        showToast(`Markdown loaded: ${targetRelPath}`);
      }
      return true;
    } catch (error) {
      showToast(`Load markdown failed: ${String(error?.message || error || "unknown_error")}`);
      return false;
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
    documentMarkdown.value = `${current}${suffix}${serializeImageLine({
      alt: "image",
      src: safeUrl
    })}\n`;
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
    activeStep,
    appendMarkdownImage,
    clearScheduledMarkdownSave,
    documentMarkdown,
    extractMarkdownSections,
    extractHeadingOutline,
    flushPendingMarkdownSave,
    formatBytes,
    currentId,
    currentStepIndex,
    isFirstStep,
    isMarkdownDirty,
    isMarkdownFileName,
    isMarkdownFileTooLarge,
    isLastStep,
    lastSaveError,
    lastSavedAt,
    loadMarkdown,
    loadMarkdownFile,
    markdownHydrating,
    moveStep,
    persistActiveMarkdownBeforeSwitch,
    resetBlankEditorState,
    saveMarkdown,
    saveStatus,
    serializeStepsToMarkdown,
    steps,
    stepDisplayTitle,
    updateMarkdown,
    writeActiveMarkdownNow
  };
};

