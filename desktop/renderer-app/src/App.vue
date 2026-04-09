<template>
  <div
    id="app"
    v-cloak
    class="app-root-shell flex h-screen min-h-0 overflow-hidden flex-col"
    :data-theme="activeThemeId"
    :data-theme-mode="currentThemeMode"
    :style="appThemeInlineStyle"
    :class="{
      'dark-ui': isDark,
      'desktop-frameless-windowed': isDesktopWindowControls && !windowIsMaximized
    }"
  >
    <div
      v-if="isEditMode"
      class="app-chrome-bar"
      :class="isDark ? 'is-dark' : ''"
    >
      <!-- App chrome icons are centralized in `AppIcon.vue` to keep shell layout readable. -->
      <div
        class="app-chrome-no-drag app-chrome-leading"
        :style="chromeLeadingStyle"
      >
        <button
          type="button"
          class="term-window-btn term-tip-btn chrome-sidebar-toggle-btn"
          :data-tip="isFileSidebarHidden ? localeText('展开左边栏', 'Expand Left Sidebar') : localeText('收起左边栏', 'Collapse Left Sidebar')"
          :aria-label="isFileSidebarHidden ? localeText('展开左边栏', 'Expand Left Sidebar') : localeText('收起左边栏', 'Collapse Left Sidebar')"
          @click="toggleFileSidebarCollapse"
        >
          <AppIcon name="panel-left" :collapsed="isFileSidebarHidden" class="chrome-icon" />
        </button>
        <div v-if="showChromeStatsChip" class="chrome-stats-shell">
          <button
            type="button"
            class="chrome-stats-chip"
            :aria-label="chromeStatsAriaLabel"
            @click="cycleChromeStatsMetric"
          >
            <span class="chrome-stats-chip-label">{{ chromeStatsDisplayLabel }} {{ formatCount(chromeStatsDisplayValue) }}</span>
          </button>
          <div class="chrome-stats-popover" role="tooltip">
            <div class="chrome-stats-row">
              <span>Words:</span>
              <strong>{{ formatCount(editorDocumentStats.words) }}</strong>
            </div>
            <div class="chrome-stats-row">
              <span>Characters:</span>
              <strong>{{ formatCount(editorDocumentStats.characters) }}</strong>
            </div>
            <div class="chrome-stats-row">
              <span>Paragraphs:</span>
              <strong>{{ formatCount(editorDocumentStats.paragraphs) }}</strong>
            </div>
          </div>
        </div>
      </div>
      <div class="editor-chrome-tabs-wrap">
        <div class="editor-chrome-tabs app-chrome-no-drag" :class="isDark ? 'is-dark' : ''">
          <button
            v-for="tab in editorTabsWithMeta"
            :key="tab.id"
            type="button"
            class="editor-tab editor-tab-tip-btn"
            :class="[
              activeEditorTabId === tab.id ? 'editor-tab-active' : '',
              draggedEditorTabDropId === tab.id && draggedEditorTabDropSide === 'before' ? 'is-drop-before' : '',
              draggedEditorTabDropId === tab.id && draggedEditorTabDropSide === 'after' ? 'is-drop-after' : ''
            ]"
            :data-tip="tab.title || ''"
            :aria-label="tab.title || tab.label"
            draggable="true"
            @click="switchEditorTab(tab.id)"
            @dragstart="onEditorTabDragStart(tab.id)"
            @dragover="onEditorTabDragOver($event, tab.id)"
            @drop="onEditorTabDrop($event, tab.id)"
            @dragend="onEditorTabDragEnd"
          >
            <span class="editor-tab-icon" aria-hidden="true">
              <AppIcon :name="tab.displayKind" class="chrome-icon" />
            </span>
            <span class="editor-tab-label">{{ tab.label }}</span>
            <span class="editor-tab-close" @mousedown.stop @click.stop="closeEditorTab(tab.id)">x</span>
          </button>
        </div>
        <div class="editor-chrome-drag-fill" @mousedown="handleChromeDragMouseDown"></div>
      </div>
      <div class="app-chrome-no-drag app-chrome-trailing">
        <button
          type="button"
          class="term-window-btn term-tip-btn chrome-sidebar-toggle-btn"
          :data-tip="isSidebarHidden ? localeText('展开右边栏', 'Expand Right Sidebar') : localeText('收起右边栏', 'Collapse Right Sidebar')"
          :aria-label="isSidebarHidden ? localeText('展开右边栏', 'Expand Right Sidebar') : localeText('收起右边栏', 'Collapse Right Sidebar')"
          @click="toggleSidebarCollapse"
        >
          <AppIcon name="panel-right" :collapsed="isSidebarHidden" class="chrome-icon" />
        </button>
        <button
          type="button"
          class="term-window-btn term-tip-btn"
          :data-tip="localeText('最小化', 'Minimize')"
          :aria-label="localeText('最小化', 'Minimize')"
          @click="handleWindowMinimize"
        >
          <AppIcon name="minimize" class="chrome-icon" />
        </button>
        <button
          type="button"
          class="term-window-btn term-tip-btn"
          :data-tip="windowIsMaximized ? localeText('还原', 'Restore') : localeText('最大化', 'Maximize')"
          :aria-label="windowIsMaximized ? localeText('还原', 'Restore') : localeText('最大化', 'Maximize')"
          @click="handleWindowToggleMaximize"
        >
          <AppIcon :name="windowIsMaximized ? 'restore' : 'maximize'" class="chrome-icon" />
        </button>
        <button
          type="button"
          class="term-window-btn term-window-btn-close term-tip-btn"
          :data-tip="localeText('关闭', 'Close')"
          :aria-label="localeText('关闭', 'Close')"
          @click="handleWindowClose"
        >
          <AppIcon name="close" class="chrome-icon" />
        </button>
      </div>
    </div>

    <div class="flex flex-1 min-h-0 min-w-0">
    <aside
      v-if="isEditMode"
      class="sidebar-panel file-sidebar-panel themed-sidebar-shell flex flex-col flex-shrink-0 border-r min-h-0"
      :style="{ width: `${fileSidebarPanelWidth}px` }"
      :class="[
        isFileSidebarCollapsed ? 'is-collapsed' : '',
        isFileSidebarDragging ? 'is-dragging' : '',
        isFileSidebarHidden ? 'is-hidden border-transparent bg-transparent' : ''
      ]"
    >
      <div
        class="border-b themed-divider"
        :class="isFileSidebarCollapsed ? 'px-2 py-3' : 'px-3 py-3 space-y-3'"
      >
        <div :class="isFileSidebarCollapsed ? 'file-sidebar-tools is-collapsed' : 'file-sidebar-tools'">
          <!-- File sidebar actions and tree icons are also centralized in `AppIcon.vue`. -->
          <button
            type="button"
            class="term-window-btn term-tip-btn file-sidebar-tool-btn"
            :data-tip="localeText('新建文件', 'New File')"
            :aria-label="localeText('新建文件', 'New File')"
            @click="createStorageFile"
          >
            <AppIcon name="new-file" class="chrome-icon file-sidebar-icon" />
          </button>
          <button
            type="button"
            class="term-window-btn term-tip-btn file-sidebar-tool-btn"
            :data-tip="localeText('新建文件夹', 'New Folder')"
            :aria-label="localeText('新建文件夹', 'New Folder')"
            @click="createStorageFolder"
          >
            <AppIcon name="new-folder" class="chrome-icon file-sidebar-icon" />
          </button>
          <div class="relative storage-sort-menu-shell">
          <button
            type="button"
            class="term-window-btn term-tip-btn file-sidebar-tool-btn"
            :class="isStorageSortMenuOpen ? 'is-active' : ''"
            :data-tip="storageSortTooltip"
              :aria-label="storageSortTooltip"
              @click.stop="toggleStorageSortMenu"
            >
              <AppIcon :name="storageSortIconName" class="chrome-icon file-sidebar-icon" />
            </button>
            <div
              v-if="isStorageSortMenuOpen"
              class="storage-sort-menu"
              :class="isDark ? 'is-dark' : ''"
              @mousedown.stop
            >
              <template v-for="option in STORAGE_SORT_OPTIONS" :key="option.value">
                <div v-if="option.dividerBefore" class="storage-sort-menu-divider"></div>
                <button
                  type="button"
                  class="storage-sort-menu-item"
                  :class="[
                    isDark ? 'is-dark' : '',
                    storageSortMode === option.value ? 'is-active' : ''
                  ]"
                  @click.stop="applyStorageSortMode(option.value)"
                >
                  <span class="storage-sort-menu-label">{{ option.label }}</span>
                  <span class="storage-sort-menu-check" aria-hidden="true">
                    <AppIcon v-if="storageSortMode === option.value" name="check" class="storage-sort-menu-check-icon" />
                  </span>
                </button>
              </template>
            </div>
          </div>
          <button
            type="button"
            class="term-window-btn term-tip-btn file-sidebar-tool-btn"
            :data-tip="allStorageFoldersExpanded ? localeText('全部收起', 'Collapse All') : localeText('全部展开', 'Expand All')"
            :aria-label="allStorageFoldersExpanded ? localeText('全部收起', 'Collapse All') : localeText('全部展开', 'Expand All')"
            :disabled="!hasStorageFolders"
            @click="toggleAllStorageFolders"
          >
            <AppIcon :name="allStorageFoldersExpanded ? 'collapse-all' : 'expand-all'" class="chrome-icon file-sidebar-icon" />
          </button>
          <button
            type="button"
            class="term-window-btn term-tip-btn file-sidebar-tool-btn"
            :data-tip="localeText('关系图谱', 'Graph View')"
            :aria-label="localeText('关系图谱', 'Graph View')"
            @click="openWorkspaceGraph"
          >
            <AppIcon name="graph" class="chrome-icon file-sidebar-icon" />
          </button>
        </div>

        <label v-if="!isFileSidebarCollapsed" class="file-tree-search-shell">
          <AppIcon name="search" class="file-tree-search-icon" />
          <input
            v-model="storageSearchQuery"
            type="search"
            class="file-tree-search-input"
            :placeholder="localeText('搜索工作区...', 'Search Workspace...')"
            spellcheck="false"
          />
        </label>
      </div>

      <nav
        ref="fileTreeNavRef"
        class="file-tree-nav flex-1 min-h-0 overflow-y-auto p-2"
        :class="[
          isDark ? 'is-dark' : '',
          isStorageTreeImportActive ? 'is-import-active' : ''
        ]"
        tabindex="0"
        @dragover="onStorageTreeRootDragOver"
        @drop="onStorageTreeRootDrop"
        @dragleave="onStorageTreeRootDragLeave"
        @paste.capture="onStorageTreePaste"
      >
        <button
          v-for="item in visibleStorageNodes"
          :key="item.id"
          type="button"
          class="file-tree-row w-full rounded-lg mb-1 transition-all text-left"
          :data-tip="isFileSidebarCollapsed ? item.name : ''"
          :class="[
            selectedStorageNodeId === item.id ? 'is-selected' : '',
            isFileSidebarCollapsed ? 'sidebar-tip-btn' : '',
            storageTreeDropTargetId === item.id ? 'is-drop-target' : ''
          ]"
          :draggable="item.id !== STORAGE_ROOT_ID"
          @click="selectStorageNode(item.id)"
          @contextmenu.prevent.stop="openStorageNodeContextMenu($event, item.id)"
          @dragstart="onStorageNodeDragStart($event, item.id)"
          @dragend="onStorageNodeDragEnd"
          @dragover="onStorageNodeDragOver($event, item.id)"
          @drop="onStorageNodeDrop($event, item.id)"
        >
          <span v-if="isFileSidebarCollapsed" class="file-tree-collapsed-icon">
            <AppIcon
              :name="storageNodeIconName(item)"
              class="file-tree-collapsed-glyph"
            />
          </span>
          <template v-else>
            <span class="file-tree-guides" :style="{ width: `${item.depth * FILE_TREE_INDENT_STEP}px` }" aria-hidden="true">
              <span
                v-for="guideDepth in item.guideDepths"
                :key="guideDepth"
                class="file-tree-guide"
                :style="{ left: `${guideDepth * FILE_TREE_INDENT_STEP + FILE_TREE_GUIDE_OFFSET}px` }"
              ></span>
            </span>
            <span class="file-tree-toggle-slot">
              <template v-if="item.type === 'folder'">
                <span class="file-tree-toggle" @click.stop="toggleStorageFolder(item.id)">
                  <AppIcon
                    :name="isStorageFolderExpanded(item.id) ? 'chevron-down' : 'chevron-right'"
                    class="file-tree-chevron"
                  />
                </span>
              </template>
              <template v-else>
                <span class="file-tree-file-icon-shell">
                  <AppIcon :name="storageNodeIconName(item)" class="file-tree-file-icon" />
                </span>
              </template>
            </span>
            <span class="file-tree-entry-content">
              <span class="file-tree-entry-head">
                <span class="file-tree-label truncate">{{ item.name }}</span>
                <span
                  v-if="item.searchMatchCount"
                  class="file-tree-match-count"
                >
                  {{ item.searchMatchCount }}
                </span>
              </span>
              <span
                v-if="item.searchMatches?.length"
                class="file-tree-search-matches"
              >
                <span
                  v-for="(match, matchIndex) in item.searchMatches"
                  :key="`${item.id}-match-${matchIndex}`"
                  class="file-tree-search-match"
                  @click.stop="openStorageSearchMatch(item, match.rawPos)"
                  v-html="match.html"
                ></span>
                <span
                  v-if="item.searchOverflowCount > 0"
                  class="file-tree-search-more"
                  @click.stop="expandStorageSearchMatches(item.id)"
                >
                  {{ localeText(`还有 ${item.searchOverflowCount} 处匹配`, `+${item.searchOverflowCount} more matches`) }}
                </span>
                <span
                  v-else-if="storageSearchMatchDisplayLimit(item.id) > STORAGE_SEARCH_MATCH_BATCH && item.searchMatchCount > STORAGE_SEARCH_MATCH_BATCH"
                  class="file-tree-search-more"
                  @click.stop="collapseStorageSearchMatches(item.id)"
                >
                  {{ localeText('收起匹配', 'Collapse Matches') }}
                </span>
              </span>
            </span>
          </template>
        </button>
      </nav>

      <div
        v-if="!isFileSidebarCollapsed"
        class="file-sidebar-footer border-t themed-divider"
      >
        <div class="file-sidebar-workspace-bar" :class="isDark ? 'is-dark' : ''">
          <button
            type="button"
            class="file-sidebar-workspace-main"
            :class="[isDark ? 'is-dark' : '', isFileSidebarCollapsed ? 'sidebar-tip-btn' : 'term-tip-btn']"
            :data-tip="storageLocationText"
            @click="handleWorkspaceFooterPrimaryAction"
            @dragover="onStorageTreeRootDragOver"
            @drop="onStorageTreeRootDrop"
            @dragleave="onStorageTreeRootDragLeave"
          >
            <AppIcon name="workspace-switch" class="workspace-switch-icon" />
            <span class="truncate text-sm">{{ workspaceDisplayName }}</span>
          </button>

          <div class="relative workspace-footer-panel-shell">
            <button
              type="button"
              class="term-window-btn term-tip-btn file-sidebar-tool-btn workspace-footer-tool-btn"
              :data-tip="localeText('工作区信息', 'Workspace Info')"
              :aria-label="localeText('工作区信息', 'Workspace Info')"
              @click.stop="toggleWorkspaceFooterPanel('info')"
            >
              <AppIcon name="info" class="chrome-icon file-sidebar-icon workspace-footer-icon" />
            </button>
            <div
              v-if="workspaceFooterPanel === 'info'"
              class="workspace-footer-popover"
              :class="isDark ? 'is-dark' : ''"
            >
              <div class="workspace-footer-popover-title">{{ localeText('工作区信息', 'Workspace Info') }}</div>
              <div class="workspace-footer-info-list">
                <div class="workspace-footer-info-row">
                  <span class="workspace-footer-info-label">{{ localeText('名称', 'Name') }}</span>
                  <span class="workspace-footer-info-value">{{ workspaceDisplayName }}</span>
                </div>
                <div class="workspace-footer-info-row">
                  <span class="workspace-footer-info-label">{{ localeText('统计', 'Stats') }}</span>
                  <span class="workspace-footer-info-value">{{ storageStats }}</span>
                </div>
              </div>
              <p class="workspace-footer-popover-path">{{ storageLocationText }}</p>
            </div>
          </div>

          <div class="relative workspace-footer-panel-shell">
            <button
              type="button"
              class="term-window-btn term-tip-btn file-sidebar-tool-btn workspace-footer-tool-btn"
              :data-tip="localeText('工作区设置', 'Workspace Settings')"
              :aria-label="localeText('工作区设置', 'Workspace Settings')"
              @click.stop="openSettingsWindow('general')"
            >
              <AppIcon name="settings" class="chrome-icon file-sidebar-icon workspace-footer-icon" />
            </button>
          </div>
        </div>
      </div>
    </aside>

    <div
      v-if="isEditMode"
      class="sidebar-resize-handle file-sidebar-resize-handle flex-shrink-0"
      :class="[
        isFileSidebarDragging ? 'is-dragging' : '',
        isFileSidebarHidden ? 'is-hidden' : '',
        isDark ? 'is-dark' : ''
      ]"
      @mousedown="startFileSidebarResizeDrag"
    >
      <div class="sidebar-resize-line"></div>
    </div>

    <aside
      v-if="showInspectorSidebar && !isEditMode"
      class="sidebar-panel inspector-sidebar-panel themed-sidebar-shell flex flex-col flex-shrink-0 border-r min-h-0"
      :style="{ width: `${inspectorSidebarPanelWidth}px` }"
    >
      <div class="px-4 py-3 border-b themed-divider">
        <div class="flex items-center justify-between gap-3">
          <h2 class="inspector-header-title text-sm font-semibold tracking-tight truncate">
            {{ localeText('目录表', 'Table of Contents') }}
          </h2>
          <span class="inspector-header-subtitle shrink-0 text-xs">
            {{ localeText(`第 ${currentStepIndex + 1} / ${steps.length} 页`, `Page ${currentStepIndex + 1} / ${steps.length}`) }}
          </span>
        </div>

        <div class="sidebar-overall-progress mt-2.5" :class="isDark ? 'is-dark' : ''">
          <span class="sidebar-overall-progress-fill" :style="{ width: `${Math.round(sidebarChapterProgress * 100)}%` }"></span>
        </div>
      </div>

      <nav class="flex-1 min-h-0 overflow-y-auto">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          @click="handleStepSelection(step.id, index)"
          class="nav-step-item nav-display-item px-4 py-2.5 flex items-center gap-2.5 cursor-pointer transition-all border-l-4"
          :class="currentId === step.id ? 'is-active' : ''"
        >
          <div class="nav-step-side">
            <div
              class="nav-step-index-badge w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all"
              :class="currentId === step.id ? 'is-active' : ''"
            >
              {{ index + 1 }}
            </div>
            <span class="nav-step-track" :class="isDark ? 'is-dark' : ''">
              <span class="nav-step-track-fill" :style="{ transform: `scaleY(${stepProgressForIndex(index)})` }"></span>
            </span>
          </div>

          <div class="flex-1 min-w-0">
            <div class="min-w-0 px-1 flex min-h-[28px] items-center">
              <div class="inspector-step-title truncate text-sm font-medium">
                {{ stepDisplayTitle(step, index) }}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </aside>

    <main ref="mainRef" class="workspace-main-shell relative flex-1 min-w-0 min-h-0 flex flex-col">
      <header
        v-if="!isEditMode"
        class="viewer-header-shell sticky top-0 z-30 px-10 py-5 border-b flex justify-between items-center backdrop-blur"
        :style="viewHeaderStyle"
      >
        <div class="header-meta header-meta-inline min-w-0 flex-1">
          <span class="header-meta-title is-single-line">
            {{ stepDisplayTitle(activeStep, currentStepIndex) }}
          </span>
        </div>
        <div class="flex items-center gap-2 sm:gap-3 flex-nowrap shrink-0">
          <span class="header-meta-page">{{ localeText(`第 ${currentStepIndex + 1} / ${steps.length} 页`, `Page ${currentStepIndex + 1} / ${steps.length}`) }}</span>
        </div>
      </header>

      <section
        v-show="!terminalMaximized"
        ref="contentScrollRef"
        class="workspace-content-shell flex-1 min-h-0"
        :class="[
          !isEditMode ? 'flex flex-col overflow-y-auto' : '',
          isEditMode && isWorkspaceGraphTabActive ? 'overflow-hidden' : 'overflow-y-auto'
        ]"
        :style="(!isEditMode && !gestureNavigationEnabled && !isWorkspaceGraphTabActive && !terminalMaximized)
          ? { paddingBottom: '88px' }
          : null"
        @scroll.passive="onContentScroll"
      >
        <div
          class="relative w-full"
          :class="[
            !isEditMode
              ? 'mx-auto max-w-none px-10 py-10 flex flex-1 flex-col'
              : (isWorkspaceGraphTabActive
                ? 'h-full px-0 py-0'
                : 'mx-auto max-w-6xl px-10 py-10')
          ]"
        >
          <transition name="fade" mode="out-in">
            <div
              :key="contentPaneKey"
              class="flex flex-col"
              :class="[
                !isEditMode ? 'min-h-full flex-1' : '',
                isEditMode && isWorkspaceGraphTabActive ? 'h-full' : ''
              ]"
            >
              <div
                v-if="!isEditMode"
                class="mb-10 w-full relative mx-auto"
                :class="[
                  gestureNavigationEnabled ? 'px-12 md:px-20 lg:px-28' : 'px-2 md:px-4',
                  gestureNavigationEnabled ? 'min-h-[100vh]' : ''
                ]"
                @click="handlePreviewNavClick"
              >
                <div class="mx-auto" :style="displayStyle">
                  <div class="yc-view-render-shell is-readonly-view">
                    <EditorShell
                      ref="markdownViewRef"
                      read-only
                      presentation-enabled
                      :model-value="viewModeMarkdown"
                      :dark="isDark"
                      :current-rel-path="activeMarkdownRelPath"
                      :wiki-link-files="workspaceMarkdownFiles"
                      :wiki-link-suggestions="getWikiLinkSuggestions"
                      :wiki-link-suggestion-select="handleWikiLinkSuggestionSelect"
                      :locale-text="localeText"
                      @wiki-link-activate="handleEditorWikiLinkActivate"
                      @external-link-activate="handleEditorExternalLinkActivate"
                    />
                  </div>
                </div>
              </div>

              <div
                v-else-if="isWorkspaceGraphTabActive"
                class="flex-1 min-h-0 h-full"
              >
                <WorkspaceLinkGraph
                  :graph-data="workspaceGraphData"
                  :active-rel-path="activeMarkdownRelPath"
                  :is-dark="isDark"
                  @close="closeWorkspaceGraph"
                  @open-note="handleWorkspaceGraphOpenNote"
                />
              </div>

              <div
                v-else-if="isImagePreviewTabActive"
                class="min-h-[520px] flex flex-col"
              >
                <div class="mx-auto w-full max-w-5xl" :style="displayStyle">
                  <div
                    class="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 py-1"
                    :class="isDark ? 'text-slate-200' : 'text-gray-700'"
                  >
                    <div class="min-w-0">
                      <div class="truncate text-sm font-medium">{{ activeImagePreviewNode?.name || "Image" }}</div>
                      <div class="truncate text-xs opacity-70">{{ activeImagePreviewNode?.relPath || "" }}</div>
                    </div>
                    <div class="text-xs opacity-70">{{ formatBytes(activeImagePreviewNode?.size || 0) }}</div>
                  </div>
                  <div class="flex min-h-[420px] items-center justify-center p-2 md:p-4">
                    <img
                      v-if="activeImagePreviewSrc"
                      :src="activeImagePreviewSrc"
                      :alt="activeImagePreviewNode?.name || 'image'"
                      class="max-h-[72vh] w-auto max-w-full object-contain select-none"
                      draggable="false"
                    />
                    <div
                      v-else
                      class="text-sm opacity-70"
                    >
                      {{ localeText('无法预览当前图片', 'Cannot preview current image') }}
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-else
                class="min-h-[520px] flex flex-col"
              >
                <div class="relative flex-1 overflow-y-auto py-2">
                  <div class="mx-auto" :style="displayStyle">
                    <div
                      class="rounded-[28px]"
                      @dragover.capture="onEditorImageDragOver"
                      @drop.capture="onEditorImageDrop"
                      @dragleave.capture="onEditorImageDragLeave"
                      @paste.capture="onEditorImagePaste"
                    >
                      <EditorShell
                        v-if="isSourceMode"
                        ref="markdownSourceRef"
                        :presentation-enabled="false"
                        :model-value="documentMarkdown"
                        :dark="isDark"
                        :current-rel-path="activeMarkdownRelPath"
                        :wiki-link-files="workspaceMarkdownFiles"
                        :wiki-link-suggestions="getWikiLinkSuggestions"
                        :wiki-link-suggestion-select="handleWikiLinkSuggestionSelect"
                        :locale-text="localeText"
                        @selection-change="handleEditorSelectionChange"
                        @update:model-value="updateMarkdown"
                        @wiki-link-activate="handleEditorWikiLinkActivate"
                        @external-link-activate="handleEditorExternalLinkActivate"
                      />
                      <EditorShell
                        v-else
                        ref="markdownEditorRef"
                        presentation-enabled
                        :model-value="documentMarkdown"
                        :dark="isDark"
                        :current-rel-path="activeMarkdownRelPath"
                        :wiki-link-files="workspaceMarkdownFiles"
                        :wiki-link-suggestions="getWikiLinkSuggestions"
                        :wiki-link-suggestion-select="handleWikiLinkSuggestionSelect"
                        :locale-text="localeText"
                        @selection-change="handleEditorSelectionChange"
                        @update:model-value="updateMarkdown"
                        @wiki-link-activate="handleEditorWikiLinkActivate"
                        @external-link-activate="handleEditorExternalLinkActivate"
                      />
                    </div>
                  </div>
                </div>
                <div
                  v-if="showEditorDebugPanel"
                  class="px-1 pt-3 pb-2"
                >
                  <div
                    class="w-full rounded-lg border px-3 py-3 text-[11px] font-mono leading-5 max-h-44 overflow-auto"
                    :class="isDark ? 'bg-slate-900/70 text-slate-200 border-slate-700' : 'bg-gray-50 text-slate-700 border-gray-200'"
                  >
                    <div class="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        class="px-1.5 py-0.5 rounded border term-tip-btn"
                        :class="saveStatusChipClass"
                        :data-tip="saveStatusTooltip"
                      >
                        {{ saveStatusLabel }}
                      </span>
                      <span
                        class="px-1.5 py-0.5 rounded border term-tip-btn"
                        :class="isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-300 text-gray-700'"
                        :data-tip="currentBlockDebugTitle"
                      >
                        {{ currentBlockLabel }}
                      </span>
                      <span
                        class="px-1.5 py-0.5 rounded border"
                        :class="isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-300 text-gray-700'"
                      >
                        Outline {{ semanticOutline.length }}
                      </span>
                      <span
                        class="px-1.5 py-0.5 rounded border"
                        :class="isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-300 text-gray-700'"
                      >
                        Width {{ displayWidth }}px
                      </span>
                      <span
                        class="px-1.5 py-0.5 rounded border"
                        :class="isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-300 text-gray-700'"
                      >
                        Inline Segments {{ activeInlineSegmentCount }}
                      </span>
                      <span
                        class="px-1.5 py-0.5 rounded border"
                        :class="isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-300 text-gray-700'"
                      >
                        Inline Tokens {{ activeInlineTokenCount }}
                      </span>
                    </div>
                    <div v-if="inlineDebugLines.length" class="space-y-0.5">
                      <div v-for="(line, index) in inlineDebugLines" :key="`inline-debug-${index}`">{{ line }}</div>
                    </div>
                    <div v-else class="opacity-70">No inline debug data for current block.</div>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </section>

      <footer
        v-if="!isEditMode && !gestureNavigationEnabled && !isWorkspaceGraphTabActive && !terminalMaximized"
        class="viewer-footer-shell viewer-footer-floating px-10 py-6 border-t flex items-center justify-center"
      >
        <div class="flex items-center gap-6">
          <button
            @click="prev"
            :disabled="isFirstStep"
            class="themed-secondary-btn px-8 py-2 rounded-full text-sm disabled:opacity-30"
          >
            {{ localeText('← 上一章', '← Previous') }}
          </button>
          <button
            @click="next"
            :disabled="isLastStep"
            class="themed-accent-btn px-8 py-2 rounded-full text-sm font-medium disabled:opacity-30"
          >
            {{ isLastStep ? localeText('已完成', 'Completed') : localeText('下一章 →', 'Next →') }}
          </button>
        </div>
      </footer>

      <section
        v-if="terminalOpen"
        class="term-shell border-t min-h-0 flex flex-col"
        :class="terminalMaximized ? 'term-shell-max' : 'flex-shrink-0'"
      >
        <div
          class="term-tabs-bar border-b"
          @mousedown="startTerminalPullResize"
        >
          <!-- Terminal toolbar icons also come from `AppIcon.vue` to keep this section focused on behavior. -->
          <div class="flex items-center gap-1 min-w-0">
            <template v-if="isDesktopPty">
              <button
                type="button"
                class="term-icon-btn term-tip-btn"
                :data-tip="localeText('新建终端', 'New Terminal')"
                :aria-label="localeText('新建终端', 'New Terminal')"
                @mousedown.stop
                @click="createDesktopTerminal"
              >
                <AppIcon name="add" class="term-icon" />
              </button>
              <button
                v-for="session in desktopSessions"
                :key="session.id"
                type="button"
                class="term-tab term-tab-session"
                :class="activeDesktopSessionId === session.id ? 'term-tab-active' : ''"
                draggable="true"
                @mousedown.stop
                @dragstart="onDesktopTabDragStart(session.id)"
                @dragover.prevent
                @drop="onDesktopTabDrop(session.id)"
                @contextmenu.prevent.stop="openDesktopTabContextMenu($event, session.id)"
                @click="switchDesktopTerminal(session.id)"
              >
                <span class="truncate">{{ session.label }}</span>
                <span class="term-tab-close" @mousedown.stop @click.stop="closeDesktopTerminal(session.id)">×</span>
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="term-tab"
                :class="terminalTab === 'terminal' ? 'term-tab-active' : ''"
                @mousedown.stop
                @click="openTerminalPanel('terminal')"
              >
                {{ localeText('终端', 'Terminal') }}
              </button>
              <button
                type="button"
                class="term-tab"
                :class="terminalTab === 'runner' ? 'term-tab-active' : ''"
                @mousedown.stop
                @click="openTerminalPanel('runner')"
              >
                {{ localeText('本地运行器', 'Local Runner') }}
              </button>
            </template>
          </div>

          <div v-if="terminalOpen" class="ml-auto flex items-center gap-1.5">
            <button
              v-if="isDesktopPty"
              type="button"
              class="term-icon-btn term-tip-btn"
              :data-tip="desktopSplit ? localeText('关闭分屏', 'Close Split') : localeText('分屏终端', 'Split Terminal')"
              :aria-label="desktopSplit ? localeText('关闭分屏', 'Close Split') : localeText('分屏终端', 'Split Terminal')"
              @mousedown.stop
              @click="toggleDesktopSplit"
            >
              <AppIcon name="split" class="term-icon" />
            </button>
            <div v-if="isDesktopPty && desktopSessions.length" class="term-session-select-shell">
              <select
                class="term-session-select"
                :value="activeDesktopSessionId"
                @mousedown.stop
                @change="switchDesktopTerminal($event.target.value)"
              >
                <option v-for="session in desktopSessions" :key="session.id" :value="session.id">
                  {{ session.label }} · {{ session.shell }}
                </option>
              </select>
              <AppIcon name="chevron-down" class="term-session-select-icon" />
            </div>
            <button
              type="button"
              class="term-icon-btn term-tip-btn"
              :data-tip="localeText('终止终端', 'Kill Terminal')"
              :aria-label="localeText('终止终端', 'Kill Terminal')"
              @mousedown.stop
              @click="terminateCurrentTerminal"
            >
              <AppIcon name="terminate" class="term-icon" />
            </button>
          </div>
        </div>
        <div
          v-if="desktopTabMenu.open"
          ref="desktopTabMenuRef"
          class="term-context-menu"
          role="menu"
          tabindex="-1"
          :style="{ left: `${desktopTabMenu.x}px`, top: `${desktopTabMenu.y}px` }"
          @mousedown.stop
          @keydown="onTermContextMenuKeydown($event, 'desktop-tab')"
        >
          <button type="button" class="term-context-item" role="menuitem" @click="openDesktopRenameDialog(desktopTabMenu.sid)">
            <AppIcon name="rename" class="storage-context-icon" />
            <span>{{ localeText('重命名', 'Rename') }}</span>
          </button>
        </div>

        <div
          v-if="terminalOpen"
          class="term-dock min-h-0 flex flex-col"
          :class="terminalMaximized ? 'flex-1' : ''"
          :style="terminalMaximized ? null : { height: `${terminalPanelHeight}px` }"
        >
          <div v-if="terminalTab === 'terminal'" class="flex-1 min-h-0 flex flex-col">
            <div
              v-if="isDesktopPty"
              ref="terminalSplitWrapRef"
              class="term-split-wrap flex-1 min-h-0"
              :class="{ 'term-split-two': desktopSplit }"
            >
              <div
                class="term-pane min-h-0"
                :class="[desktopSplit ? 'term-pane-fixed' : 'flex-1', { 'is-focused': activeDesktopPane === 'primary' }]"
                :style="desktopSplit ? { flexBasis: `${desktopSplitRatio}%` } : null"
                @mousedown="focusDesktopPane('primary')"
              >
                <div ref="desktopPrimaryTerminalRef" class="term-xterm term-xterm-pane flex-1 min-h-0"></div>
              </div>
              <div
                v-if="desktopSplit"
                class="term-splitter"
                @mousedown.prevent="startDesktopSplitResize"
                @dblclick.prevent="resetDesktopSplitRatio"
              ></div>
              <div
                v-if="desktopSplit"
                class="term-pane term-pane-fixed min-h-0"
                :class="{ 'is-focused': activeDesktopPane === 'secondary' }"
                :style="{ flexBasis: `${100 - desktopSplitRatio}%` }"
                @mousedown="focusDesktopPane('secondary')"
              >
                <div ref="desktopSecondaryTerminalRef" class="term-xterm term-xterm-pane flex-1 min-h-0"></div>
              </div>
            </div>
            <div v-else ref="terminalViewportRef" class="term-screen flex-1 min-h-0 overflow-y-auto">
              <div v-if="!termLog.length" class="term-line term-muted">{{ localeText('终端已就绪，输入命令后按 Enter 执行。', 'Terminal ready. Enter command and press Enter to execute.') }}</div>
              <div v-for="(line, idx) in termLog" :key="idx" class="term-line">{{ line }}</div>
              <div v-if="isRunning" class="term-line term-running">[running] {{ localeText('命令执行中...', 'Executing command...') }}</div>
              <div class="term-line term-entry-line">
                <span class="term-prompt">{{ terminalPrompt }}</span>
                <input
                  v-model="cmdInput"
                  type="text"
                  class="term-inline-input"
                  :placeholder="localeText('输入命令并回车...', 'Enter command and press Enter...')"
                  autocomplete="off"
                  spellcheck="false"
                  @keydown="onTerminalInputKeydown"
                />
              </div>
            </div>
          </div>

          <div v-else-if="!isDesktopPty" class="runner-panel flex-1 min-h-0 overflow-y-auto p-5">
            <div class="runner-grid">
              <label class="runner-field">
                <span>执行器</span>
                <select v-model="executor" class="runner-input">
                  <option value="local-powershell">PowerShell (Local Runner)</option>
                  <option value="local-pwsh">PowerShell 7 / pwsh</option>
                  <option value="local-cmd">Command Prompt (cmd)</option>
                  <option value="local-bash">Bash (Local Runner)</option>
                  <option value="browser-js">Browser JS</option>
                </select>
              </label>

              <label class="runner-field" v-if="executor.startsWith('local')">
                <span>Token</span>
                <input v-model="runnerToken" class="runner-input" placeholder="与 Local Runner 启动参数一致" />
              </label>

              <label class="runner-field" v-if="executor.startsWith('local')">
                <span>工作目录 CWD</span>
                <input v-model="runnerCwd" class="runner-input" placeholder="例如 D:\\python\\project\\Simple\\web" />
              </label>
            </div>

            <div class="runner-actions">
              <button type="button" class="runner-btn" @click="pingBridge(false)">{{ localeText('检查连接', 'Check Connection') }}</button>
              <span class="runner-status" :class="bridgeOk ? 'is-ok' : 'is-off'">
                <i></i>{{ bridgeOk ? localeText('Local Runner 已连接', 'Local Runner Connected') : localeText('Local Runner 未连接', 'Local Runner Disconnected') }}
              </span>
            </div>
          </div>
          <div v-else class="runner-panel flex-1 min-h-0 overflow-y-auto p-5">
            <div class="runner-status is-ok"><i></i>{{ localeText('桌面版已接入 PTY，无需 Local Runner。', 'Desktop version has PTY connected, no Local Runner needed.') }}</div>
          </div>
        </div>
      </section>

      <div v-if="!terminalOpen" class="term-edge-grab" @mousedown="startTerminalPullResize"></div>
    </main>

    <div
      v-if="isEditMode"
      class="sidebar-resize-handle inspector-resize-handle flex-shrink-0"
      :class="[
        isSidebarDragging ? 'is-dragging' : '',
        isInspectorSidebarHidden ? 'is-hidden' : '',
        isDark ? 'is-dark' : ''
      ]"
      @mousedown="startSidebarResizeDrag"
    >
      <div class="sidebar-resize-line"></div>
    </div>

    <aside
      v-if="showInspectorSidebar && isEditMode"
      class="sidebar-panel inspector-sidebar-panel themed-sidebar-shell flex flex-col flex-shrink-0 border-l min-h-0"
      :style="{ width: `${inspectorSidebarPanelWidth}px` }"
      :class="[
        isInspectorSidebarCollapsed ? 'is-collapsed' : '',
        isEditMode && isSidebarDragging ? 'is-dragging' : '',
        isInspectorSidebarHidden ? 'is-hidden border-transparent bg-transparent' : ''
      ]"
    >
      <div :class="isInspectorSidebarCollapsed ? 'px-2 py-3' : (isEditMode ? 'px-4 py-3' : 'p-4 pb-3')" class="border-b themed-divider">
        <template v-if="isEditMode">
          <div :class="isInspectorSidebarCollapsed ? 'flex items-center justify-center w-full' : 'flex items-center min-w-0'">
            <h2 class="inspector-header-title text-sm font-semibold tracking-tight truncate">
              {{ isInspectorSidebarCollapsed ? localeText('目录', 'Contents') : localeText('目录表', 'Table of Contents') }}
            </h2>
          </div>
        </template>
        <template v-else>
          <div :class="isInspectorSidebarCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-start justify-between gap-2'">
            <div :class="isInspectorSidebarCollapsed ? 'flex items-center justify-center w-full' : 'flex items-center gap-2 min-w-0'">
              <div class="inspector-header-badge w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold">
                ST
              </div>
              <div v-if="!isInspectorSidebarCollapsed" class="min-w-0">
                <h2 class="inspector-header-title text-sm font-semibold tracking-tight truncate">
                  {{ localeText('步骤栏', 'Steps') }}
                </h2>
                <p class="inspector-header-subtitle text-xs mt-0.5">
                  {{ localeText(`第 ${currentStepIndex + 1} / ${steps.length} 步`, `Step ${currentStepIndex + 1} / ${steps.length}`) }}
                </p>
              </div>
            </div>
          </div>

          <div v-if="!isInspectorSidebarCollapsed" class="sidebar-overall-progress" :class="isDark ? 'is-dark' : ''">
            <span class="sidebar-overall-progress-fill" :style="{ width: `${Math.round(sidebarChapterProgress * 100)}%` }"></span>
          </div>
        </template>
      </div>

      <nav class="flex-1 min-h-0 overflow-y-auto">
        <template v-if="isEditMode">
          <div
            v-for="heading in visibleEditorHeadingOutline"
            :key="heading.id"
            @click="handleOutlineSelection(heading)"
            class="nav-step-item nav-outline-item flex cursor-pointer transition-all border-l-4"
            :class="[
              activeEditorOutlineIndex === heading.outlineIndex ? 'is-active' : '',
              isInspectorSidebarCollapsed ? 'sidebar-tip-btn' : '',
              'items-center'
            ]"
            :data-tip="isInspectorSidebarCollapsed ? (heading.title || '') : ''"
          >
            <div class="nav-outline-content" :style="outlineIndentStyle(heading)">
              <div class="nav-step-side nav-outline-side">
                <button
                  v-if="heading.hasChildren"
                  type="button"
                  class="nav-outline-toggle"
                  @click.stop="toggleOutlineCollapse(heading.id)"
                >
                  <AppIcon :name="heading.isCollapsed ? 'chevron-right' : 'chevron-down'" class="nav-outline-chevron" />
                </button>
                <span
                  v-else
                  class="nav-outline-toggle-spacer"
                  aria-hidden="true"
                ></span>
              </div>

              <div
                v-if="!isInspectorSidebarCollapsed"
                class="flex-1 min-w-0 nav-outline-body"
                :class="'flex min-h-[30px] items-center is-single-line'"
              >
                <div class="w-full min-w-0 px-1 py-0.5 text-sm font-medium truncate">
                  {{ heading.title || localeText('标题', 'Untitled') }}
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="!visibleEditorHeadingOutline.length && !isInspectorSidebarCollapsed"
            class="inspector-empty-card mx-4 mt-4 px-3 py-4 text-xs leading-5"
            :class="isActiveMarkdownEmpty ? 'is-plain-empty' : 'rounded-xl border'"
          >
            当前文档还没有可用标题，写入 `#` 到 `######` 标题后会显示在这里。
          </div>
        </template>
      </nav>

      <section
        v-if="isEditMode && !isInspectorSidebarCollapsed && !isInspectorSidebarHidden && activeMarkdownRelPath"
        class="border-t themed-divider px-4 py-3 space-y-3"
      >
        <button
          type="button"
          class="inspector-panel-toggle w-full"
          :aria-expanded="backlinksExpanded ? 'true' : 'false'"
          @click="backlinksExpanded = !backlinksExpanded"
        >
          <div class="min-w-0">
            <div class="inspector-section-title text-sm font-semibold truncate">
              {{ localeText('反向链接', 'Backlinks') }}
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="inspector-badge inspector-count-text text-[11px]">
              {{ currentBacklinks.length }}
            </span>
            <AppIcon
              :name="backlinksExpanded ? 'chevron-down' : 'chevron-right'"
              class="inspector-panel-toggle-icon"
            />
          </div>
        </button>

        <div
          v-if="backlinksExpanded && currentBacklinks.length"
          class="wiki-backlinks-list space-y-1.5 max-h-64 overflow-y-auto pr-1"
        >
          <button
            v-for="(link, index) in currentBacklinks"
            :key="`${link.sourceRelPath}:${link.rawFrom}:${index}`"
            type="button"
            class="wiki-backlink-card w-full px-2 py-2 text-left transition-all"
            @click="openBacklinkEntry(link)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="backlink-card-title truncate text-sm font-medium">
                {{ link.sourceTitle || link.sourceFileName }}
              </span>
              <span class="backlink-card-meta text-[11px] shrink-0">
                L{{ link.lineNumber }}
              </span>
            </div>
            <div class="backlink-card-meta mt-1 truncate text-[11px]">
              {{ link.sourceRelPath }}
            </div>
            <div class="backlink-card-body mt-2 text-xs leading-5">
              {{ link.contextText || link.raw }}
            </div>
          </button>
        </div>
        <div
          v-else-if="backlinksExpanded"
          class="inspector-empty-card px-2 py-3 text-xs leading-5"
        >
          {{ localeText('当前还没有其它文档链接到这篇笔记。', 'No other documents link to this note yet.') }}
        </div>
      </section>

      <div
        v-if="isEditMode && !isInspectorSidebarCollapsed && !isInspectorSidebarHidden"
        class="border-t themed-divider p-4"
      >
        <div class="mode-switch-toolbar">
          <button
            type="button"
            class="mode-switch-btn"
            :class="mode === 'source' ? 'is-active' : ''"
            :disabled="!canUseSourceMode"
            @click="setWorkspaceMode('source')"
          >
            <AppIcon name="code" class="mode-switch-icon" />
            <span class="mode-switch-label">{{ localeText("源码", "Source") }}</span>
          </button>
          <span class="mode-switch-divider" aria-hidden="true"></span>
          <button
            type="button"
            class="mode-switch-btn"
            :class="mode === 'preview' ? 'is-active' : ''"
            @click="setWorkspaceMode('preview')"
          >
            <AppIcon name="eye" class="mode-switch-icon" />
            <span class="mode-switch-label">{{ localeText("预览", "Preview") }}</span>
          </button>
          <span class="mode-switch-divider" aria-hidden="true"></span>
          <button
            type="button"
            class="mode-switch-btn"
            :class="mode === 'view' ? 'is-active' : ''"
            :disabled="!canUsePresentMode"
            @click="setWorkspaceMode('view')"
          >
            <AppIcon name="whiteboard" class="mode-switch-icon" />
            <span class="mode-switch-label">{{ localeText("展示", "Present") }}</span>
          </button>
        </div>
      </div>
    </aside>
    </div>
    <div
      v-if="storageNodeMenu.open"
      ref="storageNodeMenuRef"
      class="term-context-menu"
      role="menu"
      tabindex="-1"
      :style="{ left: `${storageNodeMenu.x}px`, top: `${storageNodeMenu.y}px` }"
      @mousedown.stop
      @keydown="onTermContextMenuKeydown($event, 'storage-node')"
    >
      <button type="button" class="term-context-item" role="menuitem" @click="openStorageRenameDialog(storageNodeMenu.nodeId)">
        <AppIcon name="rename" class="storage-context-icon" />
        <span>{{ localeText('重命名', 'Rename') }}</span>
      </button>
      <button type="button" class="term-context-item" role="menuitem" @click="copyStorageNode(storageNodeMenu.nodeId, 'cut')">
        <AppIcon name="scissor" class="storage-context-icon" />
        <span>{{ localeText('剪切', 'Cut') }}</span>
      </button>
      <button type="button" class="term-context-item" role="menuitem" @click="copyStorageNode(storageNodeMenu.nodeId, 'copy')">
        <AppIcon name="copy" class="storage-context-icon" />
        <span>{{ localeText('复制', 'Copy') }}</span>
      </button>
      <button type="button" class="term-context-item" role="menuitem" :disabled="!canPasteIntoStorageNode(storageNodeMenu.nodeId)" @click="pasteIntoStorageNode(storageNodeMenu.nodeId)">
        <AppIcon name="paste" class="storage-context-icon" />
        <span>{{ localeText('粘贴', 'Paste') }}</span>
      </button>
      <button type="button" class="term-context-item" role="menuitem" :disabled="!canRevealStorageNode(storageNodeMenu.nodeId)" @click="revealStorageNodeInExplorer(storageNodeMenu.nodeId)">
        <AppIcon name="open-folder" class="storage-context-icon" />
        <span>{{ localeText('在文件夹中显示', 'Show in Folder') }}</span>
      </button>
      <button type="button" class="term-context-item is-danger" role="menuitem" @click="deleteStorageNode(storageNodeMenu.nodeId)">
        <AppIcon name="delete" class="storage-context-icon" />
        <span>{{ localeText('删除', 'Delete') }}</span>
      </button>
    </div>

    <div
      v-if="settingsWindow.open"
      class="settings-window-mask"
      :class="isDark ? 'is-dark' : ''"
      @mousedown.self="closeSettingsWindow"
    >
      <div
        class="settings-window"
        :class="isDark ? 'is-dark' : ''"
        @mousedown.stop
      >
        <aside class="settings-window-sidebar" :class="isDark ? 'is-dark' : ''">
          <div class="settings-window-sidebar-title">{{ localeText("设置", "Settings") }}</div>
          <button
            v-for="section in settingsSections"
            :key="section.id"
            type="button"
            class="settings-window-nav-item"
            :class="[
              isDark ? 'is-dark' : '',
              settingsWindow.section === section.id ? 'is-active' : ''
            ]"
            @click="openSettingsWindow(section.id)"
          >
            <AppIcon :name="section.icon" class="settings-window-nav-icon" />
            <span>{{ section.label }}</span>
          </button>
        </aside>

        <section class="settings-window-content" :class="isDark ? 'is-dark' : ''">
          <button
            type="button"
            class="settings-window-close"
            :class="isDark ? 'is-dark' : ''"
            :aria-label="localeText('关闭设置', 'Close Settings')"
            @click="closeSettingsWindow"
          >
            <AppIcon name="close" class="settings-window-close-icon" />
          </button>

          <div class="settings-window-scroll">
            <template v-if="settingsWindow.section === 'general'">
              <div class="settings-window-card" :class="isDark ? 'is-dark' : ''">
                <div class="settings-window-card-header">
                  <div class="settings-window-card-title">{{ localeText("工作区", "Workspace") }}</div>
                  <div class="settings-window-card-desc">{{ localeText("当前工作区名称和存储位置", "Current workspace name and storage location") }}</div>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText("工作区名称", "Workspace Name") }}</div>
                    <div class="settings-window-card-row-desc">{{ workspaceDisplayName }}</div>
                  </div>
                  <div class="settings-window-card-row-right"></div>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText("存储统计", "Storage Stats") }}</div>
                    <div class="settings-window-card-row-desc">{{ storageStats }}</div>
                  </div>
                  <div class="settings-window-card-row-right"></div>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText("存储位置", "Storage Location") }}</div>
                    <div class="settings-window-card-row-desc">{{ storageLocationText }}</div>
                  </div>
                  <div class="settings-window-card-row-right">
                    <button
                      v-if="canPickWorkspaceRoot"
                      type="button"
                      class="settings-window-button"
                      @click="handleWorkspaceFooterSwitch"
                    >
                      {{ localeText("切换", "Switch") }}
                    </button>
                    <button
                      v-if="canOpenWorkspaceRoot"
                      type="button"
                      class="settings-window-button"
                      :class="isDark ? 'is-dark' : ''"
                      @click="handleWorkspaceFooterOpenDir"
                    >
                      {{ localeText("打开", "Open") }}
                    </button>
                    <button
                      v-if="canExportCurrentDocumentPdf"
                      type="button"
                      class="settings-window-button"
                      :class="isDark ? 'is-dark' : ''"
                      @click="handleExportCurrentDocumentPdf"
                    >
                      {{ localeText("导出 PDF", "Export PDF") }}
                    </button>
                  </div>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText("语言", "Language") }}</div>
                    <div class="settings-window-card-row-desc">{{ localeText("切换应用界面语言", "Switch app interface language") }}</div>
                  </div>
                  <div class="settings-window-card-row-right">
                    <select
                      v-model="appLanguage"
                      class="settings-window-select"
                      :aria-label="localeText('应用语言', 'Application Language')"
                    >
                      <option value="zh-CN">简体中文</option>
                      <option value="en-US">English</option>
                    </select>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="settingsWindow.section === 'editor'">
              <div class="settings-window-card" :class="isDark ? 'is-dark' : ''">
                <div class="settings-window-card-header">
                  <div class="settings-window-card-title">{{ localeText('编辑区布局', 'Editor Layout') }}</div>
                  <div class="settings-window-card-desc">{{ localeText('调整编辑器宽度', 'Adjust editor width') }}</div>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText('编辑区宽度', 'Editor Width') }}</div>
                    <div class="settings-window-card-row-desc">{{ localeText(`当前宽度 ${displayWidth}px`, `Current width: ${displayWidth}px`) }}</div>
                  </div>
                  <div class="settings-window-card-row-right">
                    <button type="button" class="settings-window-button" :class="isDark ? 'is-dark' : ''" @click="handleWorkspaceFooterEditorSetting('editor-width-narrower')">{{ localeText('收窄', 'Narrower') }}</button>
                    <button type="button" class="settings-window-button" :class="isDark ? 'is-dark' : ''" @click="handleWorkspaceFooterEditorSetting('editor-width-wider')">{{ localeText('放宽', 'Wider') }}</button>
                    <button type="button" class="settings-window-button" :class="isDark ? 'is-dark' : ''" @click="handleWorkspaceFooterEditorSetting('editor-width-reset')">{{ localeText('重置', 'Reset') }}</button>
                  </div>
                </div>
              </div>

              <div class="settings-window-card" :class="isDark ? 'is-dark' : ''">
                <div class="settings-window-card-header">
                  <div class="settings-window-card-title">{{ localeText('调试面板', 'Debug Panel') }}</div>
                  <div class="settings-window-card-desc">{{ localeText('编辑器底部调试信息面板', 'Editor bottom debug info panel') }}</div>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText('调试面板', 'Debug Panel') }}</div>
                    <div class="settings-window-card-row-desc">{{ showEditorDebugPanel ? localeText('已开启', 'Enabled') : localeText('已关闭', 'Disabled') }}</div>
                  </div>
                  <div class="settings-window-card-row-right">
                    <input
                      :checked="showEditorDebugPanel"
                      type="checkbox"
                      class="settings-window-checkbox"
                      @change="handleWorkspaceFooterEditorSetting('editor-debug-toggle')"
                    />
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="settingsWindow.section === 'view'">
              <div class="settings-window-card" :class="isDark ? 'is-dark' : ''">
                <div class="settings-window-card-header">
                  <div class="settings-window-card-title">{{ localeText('展示模式', 'Presentation Mode') }}</div>
                  <div class="settings-window-card-desc">{{ localeText('阅读态的翻页和界面折叠', 'Paging and UI collapse in reading mode') }}</div>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText('翻页模式', 'Gesture Navigation') }}</div>
                  </div>
                  <div class="settings-window-card-row-right">
                    <input v-model="gestureNavigationEnabled" type="checkbox" class="settings-window-checkbox" />
                  </div>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText('收起顶栏', 'Collapse Header') }}</div>
                  </div>
                  <div class="settings-window-card-row-right">
                    <input v-model="collapseHeaderInView" type="checkbox" class="settings-window-checkbox" />
                  </div>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText("收起步骤栏", "Collapse Steps Sidebar") }}</div>
                  </div>
                  <div class="settings-window-card-row-right">
                    <input v-model="collapseStepsSidebarInView" type="checkbox" class="settings-window-checkbox" />
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="settingsWindow.section === 'appearance'">
              <div class="settings-window-card" :class="isDark ? 'is-dark' : ''">
                <div class="settings-window-card-header">
                  <div class="settings-window-card-title">{{ localeText('主题', 'Theme') }}</div>
                  <div class="settings-window-card-desc">{{ localeText('选择应用的主题风格', 'Choose app theme style') }}</div>
                </div>
                <div class="settings-theme-grid">
                  <button
                    v-for="theme in availableThemes"
                    :key="theme.id"
                    type="button"
                    class="settings-theme-card"
                    :class="[activeThemeId === theme.id ? 'is-active' : '', isDark ? 'is-dark' : '']"
                    @click="applyThemeSelection(theme.id)"
                  >
                    <span class="settings-theme-swatch" :style="{ background: theme.swatch }"></span>
                    <span class="settings-theme-name">{{ theme.label }}</span>
                    <span class="settings-theme-meta">{{ theme.metaLabel }}</span>
                  </button>
                </div>
                <div class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText('导入主题', 'Import Theme') }}</div>
                    <div class="settings-window-card-row-desc">{{ localeText('支持 .css 或 .json 格式', 'Supports .css or .json format') }}</div>
                  </div>
                  <div class="settings-window-card-row-right">
                    <button type="button" class="settings-window-button" @click="triggerThemeImport">{{ localeText('导入', 'Import') }}</button>
                    <button
                      v-if="activeImportedTheme"
                      type="button"
                      class="settings-window-button"
                      :class="isDark ? 'is-dark' : ''"
                      @click="removeImportedTheme(activeImportedTheme.id)"
                    >
                      {{ localeText('移除', 'Remove') }}
                    </button>
                  </div>
                </div>
                <div v-if="activeImportedTheme" class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText('导入主题基础模式', 'Imported Theme Base Mode') }}</div>
                  </div>
                  <div class="settings-window-card-row-right">
                    <button type="button" class="settings-window-button" :class="isDark ? 'is-dark' : ''" @click="setImportedThemeMode(activeImportedTheme.id, 'light')">{{ localeText('浅色', 'Light') }}</button>
                    <button type="button" class="settings-window-button" :class="isDark ? 'is-dark' : ''" @click="setImportedThemeMode(activeImportedTheme.id, 'dark')">{{ localeText('深色', 'Dark') }}</button>
                  </div>
                </div>
              </div>

              <div class="settings-window-card" :class="isDark ? 'is-dark' : ''">
                <div v-if="!isThemeAccentAdjustableThemeActive" class="settings-window-card-row">
                  <div class="settings-window-card-row-left">
                    <div class="settings-window-card-row-label">{{ localeText('提示', 'Hint') }}</div>
                    <div class="settings-window-card-row-desc">{{ localeText('当前主题不支持自定义主题色，请切换到 Default Light 或 Default Dark', 'Current theme does not support custom accent color, please switch to Default Light or Default Dark') }}</div>
                  </div>
                  <div class="settings-window-card-row-right"></div>
                </div>
                <template v-else>
                  <div class="settings-window-card-row settings-window-card-row-theme-toggle">
                    <div class="settings-window-card-row-left">
                      <div class="settings-window-card-title">{{ localeText('自定义主题色', 'Custom Accent Color') }}</div>
                    </div>
                    <div class="settings-window-card-row-right">
                      <button type="button" class="settings-window-button" :disabled="!isThemeAccentAdjustableThemeActive" @click="resetThemeAccentTheme">{{ localeText('重置', 'Reset') }}</button>
                      <input v-model="themeAccentEnabled" type="checkbox" class="settings-window-checkbox" :disabled="!isThemeAccentAdjustableThemeActive" />
                    </div>
                  </div>
                  <div class="settings-window-card-row settings-window-card-row-theme-color">
                    <div class="settings-window-card-row-left">
                      <div class="settings-theme-color-editor" :class="themeAccentPickerEnabled ? '' : 'is-disabled'">
                        <div class="settings-theme-color-main">
                          <div class="settings-theme-color-left">
                            <div class="settings-theme-color-title-row">
                              <span class="settings-window-card-row-label">{{ localeText('主题色', 'Accent Color') }}</span>
                              <div class="settings-theme-color-title-tools">
                                <span class="settings-theme-color-mini-preview" :style="{ background: themeAccentHex }"></span>
                                <button
                                  type="button"
                                  class="term-window-btn term-tip-btn file-sidebar-tool-btn settings-theme-color-eyedropper-btn"
                                  :disabled="!themeAccentPickerEnabled || !themeAccentEyeDropperSupported"
                                  :data-tip="localeText('吸管取色', 'Eye Dropper')"
                                  :aria-label="localeText('吸管取色', 'Eye Dropper')"
                                  :title="themeAccentEyeDropperSupported ? localeText('吸管取色', 'Eye Dropper') : localeText('当前环境不支持吸管取色', 'Eye dropper not supported in current environment')"
                                  @click="handleThemeAccentEyeDropperPick"
                                >
                                  <AppIcon name="eyedropper" class="chrome-icon settings-theme-color-eyedropper-icon" />
                                </button>
                              </div>
                            </div>
                            <div class="settings-theme-color-inputs-section">
                              <div class="settings-theme-color-hex-input">
                                <span class="settings-theme-color-input-label">HEX</span>
                                <input v-model="themeAccentHex" type="text" class="settings-theme-color-input-field" :disabled="!themeAccentPickerEnabled" />
                              </div>
                              <div class="settings-theme-color-rgb-inputs">
                                <span class="settings-theme-color-input-label">RGB</span>
                                <div class="settings-theme-color-rgb-grid">
                                  <input v-model.number="themeAccentRed" type="number" class="settings-theme-color-input-field" min="0" max="255" step="1" :disabled="!themeAccentPickerEnabled" />
                                  <input v-model.number="themeAccentGreen" type="number" class="settings-theme-color-input-field" min="0" max="255" step="1" :disabled="!themeAccentPickerEnabled" />
                                  <input v-model.number="themeAccentBlue" type="number" class="settings-theme-color-input-field" min="0" max="255" step="1" :disabled="!themeAccentPickerEnabled" />
                                </div>
                              </div>
                            </div>
                            <input
                              v-model.number="themeAccentHue"
                              class="settings-theme-color-hue-slider"
                              type="range"
                              min="0"
                              max="360"
                              step="1"
                              :disabled="!themeAccentPickerEnabled"
                            />
                          </div>
                          <div class="settings-theme-color-sv-picker">
                            <div
                              ref="themeColorSvAreaRef"
                              class="settings-theme-color-sv-area"
                              :style="{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${themeAccentHue}, 100%, 50%))` }"
                              @mousedown="startSvDrag"
                            >
                              <div
                                class="settings-theme-color-sv-cursor"
                                :style="{ background: themeAccentHex, left: `${themeAccentPickerSaturation}%`, top: `${100 - themeAccentValue}%` }"
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </section>
      </div>
    </div>

    <input
      ref="settingsThemeFileInputRef"
      type="file"
      class="sr-only"
      accept=".css,.json,application/json,text/css"
      @change="handleThemeFileImport"
    />

    <div v-if="desktopRenameDialog.open" class="term-rename-mask" @mousedown.self="cancelDesktopRenameDialog">
      <div class="term-rename-card" @mousedown.stop>
        <div class="term-rename-title">{{ localeText('重命名终端', 'Rename Terminal') }}</div>
        <input
          ref="desktopRenameInputRef"
          v-model="desktopRenameDialog.value"
          class="term-rename-input"
          maxlength="40"
          @keydown.enter.prevent="confirmDesktopRenameDialog"
          @keydown.esc.prevent="cancelDesktopRenameDialog"
        />
        <div class="term-rename-actions">
          <button type="button" class="term-rename-btn" @click="cancelDesktopRenameDialog">{{ localeText('取消', 'Cancel') }}</button>
          <button type="button" class="term-rename-btn is-primary" @click="confirmDesktopRenameDialog">{{ localeText('确定', 'Confirm') }}</button>
        </div>
      </div>
    </div>

    <div v-if="storageRenameDialog.open" class="term-rename-mask" @mousedown.self="cancelStorageRenameDialog">
      <div class="term-rename-card" @mousedown.stop>
        <div class="term-rename-title">{{ storageRenameDialog.kind === "folder" ? localeText('重命名文件夹', 'Rename Folder') : localeText('重命名文件', 'Rename File') }}</div>
        <input
          ref="storageRenameInputRef"
          v-model="storageRenameDialog.value"
          class="term-rename-input"
          @keydown.enter.prevent="confirmStorageRenameDialog"
          @keydown.esc.prevent="cancelStorageRenameDialog"
        />
        <div class="term-rename-actions">
          <button type="button" class="term-rename-btn" @click="cancelStorageRenameDialog">{{ localeText('取消', 'Cancel') }}</button>
          <button type="button" class="term-rename-btn is-primary" @click="confirmStorageRenameDialog">{{ localeText('确定', 'Confirm') }}</button>
        </div>
      </div>
    </div>

    <ToastMessage :toast="toast" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import katex from "katex";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTermTerminal } from "xterm";
// App-wide icon registry used by the shell, file tree, and terminal toolbars.
import AppIcon from "./components/AppIcon.vue";
import ToastMessage from "./components/ToastMessage.vue";
import WorkspaceLinkGraph from "./components/WorkspaceLinkGraph.vue";
import EditorShell from "./editor";
import { setContextMenuRuntimeOptions, setContextMenuLocaleText } from "./editor/extensions/context-menu.js";
import { serializeImageLine } from "./editor/parser/parse-image.js";
import { setPresentationRuntimeOptions } from "./editor/extensions/presentation.js";
import { useSemanticStore } from "./editor/state/semantic-store";
import { useMarkdownDocument } from "./composables/useMarkdownDocument";
import { useResizable } from "./composables/useResizable";
import { useSteps } from "./composables/useSteps";
import { useTerminal } from "./composables/useTerminal";
import { useToast } from "./composables/useToast";
import {
  DEFAULT_THEME_ID,
  buildThemeCatalog,
  fallbackThemeIdForMode,
  normalizeThemeMode,
  normalizeImportedThemeDefinition,
  resolveThemeDefinition,
  resolveThemeMode,
  resolveXtermTheme
} from "./themes/registry.js";
import { extractHeadingsFromMarkdown, findHeadingMatch, slugifyHeading } from "./utils/heading-slug";
import { renderMarkdownToHtml } from "./utils/render-markdown";
import { buildWikiLinkIndex } from "./utils/wiki-link-index";
import {
  collectWikiLinkTextBlocks,
  findWikiLinkTextBlockByReference,
  normalizeWikiLinkBlockText
} from "./utils/wiki-link-text-blocks.js";
import {
  basenameOfRelPath,
  dirnameOfRelPath,
  ensureMarkdownExtension,
  normalizeRelPath,
  preferredWikiTargetForFile,
  resolveWikiLink,
  stripMarkdownExtension,
  suggestRelPathForMissing
} from "./utils/wiki-link";
import { isImageFileName, relativeRelPathFromFile, resolveWorkspaceAssetSrc } from "./utils/workspace-media.js";
import { buildWorkspaceLinkGraph } from "./utils/workspace-link-graph.js";

// 渲染数学公式
const renderMathFormula = (formula, displayMode) => {
  try {
    if (typeof katex?.renderToString === "function") {
      return katex.renderToString(formula, {
        displayMode: displayMode,
        throwOnError: false,
        errorColor: "#cc0000"
      });
    }
    // 回退：返回原始公式
    return displayMode
      ? `<div class="math-block">${formula}</div>`
      : `<span class="math-inline">${formula}</span>`;
  } catch (e) {
    return displayMode
      ? `<div class="math-block">${formula}</div>`
      : `<span class="math-inline">${formula}</span>`;
  }
};

const preprocessMathFormulas = (markdown) => {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  let result = markdown;

  // 处理 $$...$$ 块级公式（先处理块级再处理行内，避免冲突）
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const trimmedFormula = formula.trim();
    if (!trimmedFormula) return match;
    return `<div class="math-block">${renderMathFormula(trimmedFormula, true)}</div>`;
  });

  // 处理 $...$ 行内公式
  result = result.replace(/\$([^$\n]+?)\$/g, (match, formula) => {
    const trimmedFormula = formula.trim();
    if (!trimmedFormula) return match;
    return `<span class="math-inline">${renderMathFormula(trimmedFormula, false)}</span>`;
  });

  // 使用 marked 解析剩余的 markdown
  const parsed = marked.parse(result, {
    breaks: true,
    gfm: true,
    // 确保图片使用默认的渲染器
    renderer: new marked.Renderer()
  });

  // 处理图片路径
  let processedHtml = parsed;

  // 处理 file:// 协议和本地路径
  processedHtml = processedHtml.replace(/src="([^"]+)"/g, (match, src) => {
    // 如果已经是 http/https 协议，不做处理
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return match;
    }
    // 如果已经是 file:// 协议（正确格式 file:///），直接返回
    if (src.startsWith("file:///") || src.startsWith("file://localhost/")) {
      return match;
    }
    // 处理旧格式的 file:// 协议（如 file://C:/），转换为正确格式
    if (src.startsWith("file://")) {
      // file://C:/Users/... -> file:///C:/Users/...
      return `src="file:///${src.slice(7)}"`;
    }
    // 处理 Windows 本地绝对路径（如 C:/、D:/ 或 /C:/、/D:/）
    // 支持：C:/、/C:/、C:\、/C\ 等格式
    if (/^\/?[A-Za-z]:[/\\]/.test(src)) {
      // 移除开头的 /（如果存在）
      let filePath = src.replace(/^\/+/, "");
      // 转换反斜杠为正斜杠
      filePath = filePath.replace(/\\/g, "/");
      return `src="file:///${filePath}"`;
    }
    // Unix 绝对路径（如 /assets/img/...）和其他路径保持原样
    return match;
  });

  // 确保图片标签有正确的类名（使用更可靠的正则表达式）
  return processedHtml.replace(/<img\b/g, '<img class="md-image"');
};

const mode = ref("preview");
const gestureNavigationEnabled = ref(false);
const collapseHeaderInView = ref(false);
const collapseStepsSidebarInView = ref(false);
const appLanguage = ref("zh-CN");
const availableThemes = computed(() => buildThemeCatalog(importedThemes.value));
const currentThemeDefinition = computed(() => resolveThemeDefinition(activeThemeId.value, importedThemes.value));
const currentThemeMode = computed(() => resolveThemeMode(activeThemeId.value, importedThemes.value));
const isDark = computed(() => currentThemeMode.value === "dark");
const themeAccentEnabled = ref(false);
const themeAccentRed = ref(155);
const themeAccentGreen = ref(109);
const themeAccentBlue = ref(72);
const themeAccentSaturation = ref(100);
const themeAccentHue = ref(25);
const themeAccentPickerSaturation = ref(0);
const themeAccentValue = ref(0);
const themeColorSvAreaRef = ref(null);
const themeAccentEyeDropperSupported = computed(() => (
  typeof window !== "undefined"
  && typeof window.EyeDropper === "function"
));
let svDragging = false;
let syncingThemeAccentRgbFromPicker = false;
let syncingThemeAccentPickerFromRgb = false;

const hsvToRgb = (hueInput = 0, saturationInput = 0, valueInput = 0) => {
  const hue = ((Number(hueInput) % 360) + 360) % 360;
  const saturation = clamp(Number(saturationInput) || 0, 0, 100) / 100;
  const value = clamp(Number(valueInput) || 0, 0, 100) / 100;
  const chroma = value * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = secondary;
  } else if (segment < 2) {
    red = secondary;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = secondary;
  } else if (segment < 4) {
    green = secondary;
    blue = chroma;
  } else if (segment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }
  const match = value - chroma;
  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  };
};

const rgbToHsv = ({ r = 0, g = 0, b = 0 } = {}, fallbackHueInput = 0) => {
  const red = clamp(Number(r) || 0, 0, 255) / 255;
  const green = clamp(Number(g) || 0, 0, 255) / 255;
  const blue = clamp(Number(b) || 0, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = ((Number(fallbackHueInput) % 360) + 360) % 360;
  if (delta > 0) {
    if (max === red) {
      hue = (((green - blue) / delta) + (green < blue ? 6 : 0)) * 60;
    } else if (max === green) {
      hue = (((blue - red) / delta) + 2) * 60;
    } else {
      hue = (((red - green) / delta) + 4) * 60;
    }
  }
  const saturation = max <= 0 ? 0 : (delta / max) * 100;
  const value = max * 100;
  return {
    h: hue,
    s: saturation,
    v: value
  };
};

const syncThemeAccentRgbFromPicker = () => {
  const rgb = hsvToRgb(
    themeAccentHue.value,
    themeAccentPickerSaturation.value,
    themeAccentValue.value
  );
  syncingThemeAccentRgbFromPicker = true;
  applyThemeAccentRgb(rgb);
  syncingThemeAccentRgbFromPicker = false;
};

const syncThemeAccentPickerFromRgb = ({ preserveHue = true } = {}) => {
  syncingThemeAccentPickerFromRgb = true;
  const hsv = rgbToHsv({
    r: themeAccentRed.value,
    g: themeAccentGreen.value,
    b: themeAccentBlue.value
  }, preserveHue ? themeAccentHue.value : 0);
  themeAccentHue.value = clamp(Math.round(hsv.h), 0, 360);
  themeAccentPickerSaturation.value = clamp(Math.round(hsv.s), 0, 100);
  themeAccentValue.value = clamp(Math.round(hsv.v), 0, 100);
  syncingThemeAccentPickerFromRgb = false;
};

watch([themeAccentHue, themeAccentPickerSaturation, themeAccentValue], () => {
  const nextHue = clamp(Number(themeAccentHue.value) || 0, 0, 360);
  const nextPickerSaturation = clamp(Number(themeAccentPickerSaturation.value) || 0, 0, 100);
  const nextValue = clamp(Number(themeAccentValue.value) || 0, 0, 100);
  if (themeAccentHue.value !== nextHue) {
    themeAccentHue.value = nextHue;
  }
  if (themeAccentPickerSaturation.value !== nextPickerSaturation) {
    themeAccentPickerSaturation.value = nextPickerSaturation;
  }
  if (themeAccentValue.value !== nextValue) {
    themeAccentValue.value = nextValue;
  }
  if (!syncingThemeAccentPickerFromRgb) {
    syncThemeAccentRgbFromPicker();
  }
}, { flush: "sync" });

watch([themeAccentRed, themeAccentGreen, themeAccentBlue], () => {
  if (syncingThemeAccentRgbFromPicker || svDragging) {
    return;
  }
  syncThemeAccentPickerFromRgb({ preserveHue: true });
});

const updateSvFromEvent = (event) => {
  if (!svDragging) {
    return;
  }
  const areaElement = themeColorSvAreaRef.value;
  if (!(areaElement instanceof HTMLElement)) {
    return;
  }
  const rect = areaElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }
  const ratioX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const ratioY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  themeAccentPickerSaturation.value = Math.round(ratioX * 100);
  themeAccentValue.value = Math.round((1 - ratioY) * 100);
};

const startSvDrag = (event) => {
  if (!themeAccentPickerEnabled.value) {
    return;
  }
  if (typeof event?.clientX !== "number" || typeof event?.clientY !== "number") {
    return;
  }
  svDragging = true;
  updateSvFromEvent(event);
  window.addEventListener("mousemove", updateSvFromEvent);
  window.addEventListener("mouseup", stopSvDrag);
};

const stopSvDrag = () => {
  if (!svDragging) {
    return;
  }
  svDragging = false;
  window.removeEventListener("mousemove", updateSvFromEvent);
  window.removeEventListener("mouseup", stopSvDrag);
  persistThemeAccentThemePrefs();
};

const handleThemeAccentEyeDropperPick = async () => {
  if (!themeAccentPickerEnabled.value || !themeAccentEyeDropperSupported.value) {
    return;
  }
  try {
    const eyeDropper = new window.EyeDropper();
    const result = await eyeDropper.open();
    const pickedHex = String(result?.sRGBHex || "").trim();
    if (pickedHex) {
      themeAccentHex.value = pickedHex;
    }
  } catch {
    // User canceled or platform rejected; keep current color.
  }
};
const activeImportedTheme = computed(() => (
  currentThemeDefinition.value?.kind === "imported" ? currentThemeDefinition.value : null
));
const isEditMode = computed(() => mode.value !== "view");
const isSourceMode = computed(() => mode.value === "source");
const terminalPanelHeight = ref(320);
const terminalMaximized = ref(false);
const terminalTab = ref("terminal");
const mainRef = ref(null);
const contentScrollRef = ref(null);
const markdownEditorRef = ref(null);
const markdownSourceRef = ref(null);
const markdownViewRef = ref(null);
const fileTreeNavRef = ref(null);
const showEditorDebugPanel = ref(false);
const editorSelection = ref({ anchor: 0, head: 0 });
const draggedStepIndex = ref(-1);
const terminalViewportRef = ref(null);
const terminalSplitWrapRef = ref(null);
const currentContentReadProgress = ref(0);
const isSidebarCollapsed = ref(false);
const isSidebarHidden = ref(false);
const isSidebarDragging = ref(false);
const isFileSidebarCollapsed = ref(false);
const isFileSidebarHidden = ref(false);
const isFileSidebarDragging = ref(false);
const EDITOR_GRAPH_TAB_ID = "__workspace_graph__";
const editorTabs = ref([]);
const activeEditorTabId = ref("");
let restoringEditorTabs = false;
let pendingEditorTabsRestoreSnapshot = "";
let bootstrappingEditorTabs = false;
const draggedEditorTabId = ref("");
const draggedEditorTabDropId = ref("");
const draggedEditorTabDropSide = ref("");
const draggedStorageNodeId = ref("");
const storageTreeDropTargetId = ref("");
const isStorageTreeImportActive = ref(false);
const editorImageImportActive = ref(false);
const fileSidebarWidth = ref(190);
const storageSearchQuery = ref("");
const expandedStorageSearchMatchLimitMap = ref({});
const storageSortMode = ref("name-asc");
const STORAGE_ROOT_ID = "workspace-root";
const storageTree = ref(null);
const storageRootPath = ref("");
const storageLoading = ref(false);
const storageFolderExpandedMap = ref({ [STORAGE_ROOT_ID]: true });
const selectedStorageNodeId = ref(STORAGE_ROOT_ID);
const windowIsMaximized = ref(false);
const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_HIDE_SNAP = 44;
const SIDEBAR_COLLAPSE_SNAP = SIDEBAR_COLLAPSED_WIDTH + 34;
const FILE_SIDEBAR_COLLAPSED_WIDTH = 68;
const FILE_SIDEBAR_MIN_WIDTH = 180;
const FILE_SIDEBAR_MAX_WIDTH = 560;
const FILE_SIDEBAR_HIDE_SNAP = 44;
const FILE_SIDEBAR_COLLAPSE_SNAP = FILE_SIDEBAR_COLLAPSED_WIDTH + 30;
const FILE_TREE_INDENT_STEP = 18;
const FILE_TREE_GUIDE_OFFSET = 7;
const STORAGE_SORT_DEFAULT_MODE = "name-asc";
const STORAGE_SORT_OPTIONS = computed(() => [
  { value: "name-asc", label: localeText("文件名 (A-Z)", "Name (A-Z)") },
  { value: "name-desc", label: localeText("文件名 (Z-A)", "Name (Z-A)") },
  { value: "updated-desc", label: localeText("编辑时间（从新到旧）", "Modified (Newest First)"), dividerBefore: true },
  { value: "updated-asc", label: localeText("编辑时间（从旧到新）", "Modified (Oldest First)") },
  { value: "created-desc", label: localeText("创建时间（从新到旧）", "Created (Newest First)"), dividerBefore: true },
  { value: "created-asc", label: localeText("创建时间（从旧到新）", "Created (Oldest First)") }
]);

const STORAGE_SORT_OPTION_MAP = computed(() =>
  Object.fromEntries(STORAGE_SORT_OPTIONS.value.map((option) => [option.value, option]))
);
const desktopPrimaryTerminalRef = ref(null);
const desktopSecondaryTerminalRef = ref(null);
const desktopSessions = ref([]);
const activeDesktopSessionId = ref("");
const desktopSessionSeq = ref(1);
const DEFAULT_DESKTOP_SESSION_ZH_PATTERN = /^终端\s+(\d+)$/u;
const DEFAULT_DESKTOP_SESSION_EN_PATTERN = /^terminal\s+(\d+)$/iu;
const desktopSessionLabelByIndex = (indexInput = 1) => {
  const index = Math.max(1, Math.round(Number(indexInput) || 1));
  return localeText(`终端 ${index}`, `Terminal ${index}`);
};
const detectAutoDesktopSessionLabelIndex = (labelInput = "") => {
  const label = String(labelInput || "").trim();
  if (!label) {
    return Number.NaN;
  }
  const zhMatch = label.match(DEFAULT_DESKTOP_SESSION_ZH_PATTERN);
  if (zhMatch) {
    return Math.max(1, Number(zhMatch[1] || 1));
  }
  const enMatch = label.match(DEFAULT_DESKTOP_SESSION_EN_PATTERN);
  if (enMatch) {
    return Math.max(1, Number(enMatch[1] || 1));
  }
  return Number.NaN;
};
const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target || {}, key);
const refreshDesktopSessionLanguageLabels = () => {
  const sessions = Array.isArray(desktopSessions.value) ? desktopSessions.value : [];
  if (!sessions.length) {
    return;
  }
  let changed = false;
  const next = sessions.map((session) => {
    const hasAutoLabelIndex = hasOwn(session, "autoLabelIndex");
    const explicitAutoLabelIndex = Number(session?.autoLabelIndex);
    if (hasAutoLabelIndex && !(Number.isFinite(explicitAutoLabelIndex) && explicitAutoLabelIndex > 0)) {
      return session;
    }
    const resolvedAutoLabelIndex = Number.isFinite(explicitAutoLabelIndex) && explicitAutoLabelIndex > 0
      ? explicitAutoLabelIndex
      : detectAutoDesktopSessionLabelIndex(session?.label);
    if (!(Number.isFinite(resolvedAutoLabelIndex) && resolvedAutoLabelIndex > 0)) {
      return session;
    }
    const nextLabel = desktopSessionLabelByIndex(resolvedAutoLabelIndex);
    if (String(session?.label || "") === nextLabel && explicitAutoLabelIndex === resolvedAutoLabelIndex) {
      return session;
    }
    changed = true;
    return {
      ...session,
      label: nextLabel,
      autoLabelIndex: resolvedAutoLabelIndex
    };
  });
  if (changed) {
    desktopSessions.value = next;
  }
};
const desktopFullscreen = ref(false);
const desktopSplit = ref(false);
const desktopSplitRatio = ref(50);
const activeDesktopPane = ref("primary");
const primaryPaneSessionId = ref("");
const secondaryPaneSessionId = ref("");
const storageNodeMenu = ref({
  open: false,
  x: 0,
  y: 0,
  nodeId: ""
});
const storageClipboard = ref({
  mode: "",
  nodeId: "",
  relPath: "",
  nodeType: "file",
  name: ""
});
const storageRenameDialog = ref({
  open: false,
  nodeId: "",
  value: "",
  kind: "file"
});
const isStorageSortMenuOpen = ref(false);
const workspaceFooterPanel = ref("");
const settingsWindow = ref({
  open: false,
  section: "general"
});
const activeThemeId = ref(DEFAULT_THEME_ID);
const importedThemes = ref([]);
const settingsThemeFileInputRef = ref(null);
const storageRenameInputRef = ref(null);
const storageNodeMenuRef = ref(null);
const backlinksExpanded = ref(true);
const desktopTabMenu = ref({
  open: false,
  x: 0,
  y: 0,
  sid: ""
});
const desktopTabMenuRef = ref(null);
const desktopRenameDialog = ref({
  open: false,
  sid: "",
  value: ""
});
const desktopRenameInputRef = ref(null);
const TERM_CONTEXT_ITEM_SELECTOR = ".term-context-item:not(:disabled)";

const getTermContextMenuItems = (menuEl) => (
  menuEl instanceof HTMLElement
    ? Array.from(menuEl.querySelectorAll(TERM_CONTEXT_ITEM_SELECTOR))
        .filter((item) => item instanceof HTMLButtonElement)
    : []
);

const focusTermContextMenuItem = (menuEl, indexInput = 0) => {
  const items = getTermContextMenuItems(menuEl);
  if (!items.length) {
    return false;
  }
  const length = items.length;
  const rawIndex = Number(indexInput);
  const normalizedIndex = Number.isFinite(rawIndex)
    ? ((Math.round(rawIndex) % length) + length) % length
    : 0;
  const target = items[normalizedIndex];
  target.focus();
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({
      block: "nearest"
    });
  }
  return true;
};

const moveTermContextMenuFocus = (menuEl, delta) => {
  const items = getTermContextMenuItems(menuEl);
  if (!items.length) {
    return false;
  }
  const activeIndex = items.findIndex((item) => item === document.activeElement);
  const startIndex = activeIndex >= 0 ? activeIndex : (delta < 0 ? 0 : -1);
  return focusTermContextMenuItem(menuEl, startIndex + delta);
};

const closeTermContextMenuByType = (menuType = "") => {
  if (menuType === "desktop-tab") {
    closeDesktopTabContextMenu();
    return;
  }
  if (menuType === "storage-node") {
    closeStorageNodeContextMenu();
  }
};

const getOpenTermContextMenuState = () => {
  if (storageNodeMenu.value.open && storageNodeMenuRef.value instanceof HTMLElement) {
    return {
      type: "storage-node",
      menuEl: storageNodeMenuRef.value
    };
  }
  if (desktopTabMenu.value.open && desktopTabMenuRef.value instanceof HTMLElement) {
    return {
      type: "desktop-tab",
      menuEl: desktopTabMenuRef.value
    };
  }
  return null;
};

const getActiveTermContextMenuItem = (menuEl) => {
  const active = document.activeElement;
  if (active instanceof HTMLButtonElement && menuEl?.contains(active) && !active.disabled) {
    return active;
  }
  const items = getTermContextMenuItems(menuEl);
  return items[0] || null;
};

const activateTermContextMenuItem = (menuEl) => {
  const target = getActiveTermContextMenuItem(menuEl);
  if (!target) {
    return false;
  }
  target.click();
  return true;
};

const onGlobalTermContextMenuKeydown = (event) => {
  const state = getOpenTermContextMenuState();
  if (!state) {
    return;
  }

  const { menuEl, type } = state;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    event.stopPropagation();
    moveTermContextMenuFocus(menuEl, 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    event.stopPropagation();
    moveTermContextMenuFocus(menuEl, -1);
    return;
  }

  if (event.key === "Home") {
    event.preventDefault();
    event.stopPropagation();
    focusTermContextMenuItem(menuEl, 0);
    return;
  }

  if (event.key === "End") {
    event.preventDefault();
    event.stopPropagation();
    const items = getTermContextMenuItems(menuEl);
    if (items.length) {
      focusTermContextMenuItem(menuEl, items.length - 1);
    }
    return;
  }

  if (event.key === "Enter" || event.key === "Tab" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    activateTermContextMenuItem(menuEl);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeTermContextMenuByType(type);
  }
};

const onTermContextMenuKeydown = (event, menuType = "") => {
  const menuEl = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  if (!menuEl) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    event.stopPropagation();
    moveTermContextMenuFocus(menuEl, 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    event.stopPropagation();
    moveTermContextMenuFocus(menuEl, -1);
    return;
  }

  if (event.key === "Home") {
    event.preventDefault();
    event.stopPropagation();
    focusTermContextMenuItem(menuEl, 0);
    return;
  }

  if (event.key === "End") {
    event.preventDefault();
    event.stopPropagation();
    const items = getTermContextMenuItems(menuEl);
    if (items.length) {
      focusTermContextMenuItem(menuEl, items.length - 1);
    }
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeTermContextMenuByType(menuType);
  }
};

const desktopSessionBuffers = new Map();
const desktopWindowBridge = typeof window !== "undefined" ? window.desktopWindow : null;
const desktopPtyBridge = typeof window !== "undefined" ? window.desktopPty : null;
const desktopDataBridge = typeof window !== "undefined" ? window.desktopData : null;
const isDesktopStorage = Boolean(
  desktopDataBridge?.getWorkspaceRoot
  && desktopDataBridge?.readWorkspaceTree
  && desktopDataBridge?.createWorkspaceFile
  && desktopDataBridge?.createWorkspaceFolder
);
const canPickWorkspaceRoot = Boolean(desktopDataBridge?.pickWorkspaceRoot);
const canOpenWorkspaceRoot = Boolean(desktopDataBridge?.openWorkspaceDir);
const canExportPdf = Boolean(desktopWindowBridge?.exportPdf);
const canWorkspaceFileIO = Boolean(
  desktopDataBridge?.readWorkspaceFile
  && desktopDataBridge?.writeWorkspaceFile
);
const isDesktopWindowControls = Boolean(
  desktopWindowBridge?.minimize
  && desktopWindowBridge?.toggleMaximize
  && desktopWindowBridge?.close
);
const getDesktopDataBridge = () => (
  typeof window !== "undefined" && window.desktopData
    ? window.desktopData
    : desktopDataBridge
);
const getDesktopDataMethod = (name) => {
  const bridge = getDesktopDataBridge();
  return typeof bridge?.[name] === "function" ? bridge[name].bind(bridge) : null;
};
const paneTerminals = { primary: null, secondary: null };
const paneFits = { primary: null, secondary: null };
const paneInputs = { primary: null, secondary: null };
const paneContextHandlers = { primary: null, secondary: null };
const panePasteHandlers = { primary: null, secondary: null };
const paneFocusHandlers = { primary: null, secondary: null };
const panePasteShortcutLock = { primary: false, secondary: false };
const panePasteHotkeyAt = { primary: 0, secondary: 0 };
const paneBuildQueues = {
  primary: Promise.resolve(),
  secondary: Promise.resolve()
};
let xtermStreamOff = null;
let draggedDesktopSessionId = "";
const pasteGuard = {
  sessionId: "",
  text: "",
  ts: 0
};
let terminalResizeSyncTimer = null;
let terminalDragSizing = false;
let sidebarDragRaf = 0;
let sidebarDragPendingWidth = null;
let sidebarDragMoveHandler = null;
let sidebarDragUpHandler = null;
let fileSidebarDragRaf = 0;
let fileSidebarDragPendingWidth = null;
let fileSidebarDragMoveHandler = null;
let fileSidebarDragUpHandler = null;
let desktopSplitDragMoveHandler = null;
let desktopSplitDragUpHandler = null;
let terminalResizeMoveHandler = null;
let terminalResizeUpHandler = null;
let desktopWindowMaximizeOff = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const TERMINAL_MIN_HEIGHT = 120;
const TERMINAL_HIDE_THRESHOLD = 56;
const TERMINAL_MAX_SNAP_GAP = 20;
const GESTURE_NAV_STORAGE_KEY = "yc-doc.gesture-nav.v1";
const VIEW_HEADER_COLLAPSE_STORAGE_KEY = "yc-doc.view-header-collapse.v1";
const VIEW_STEPS_SIDEBAR_COLLAPSE_STORAGE_KEY = "yc-doc.view-steps-sidebar-collapse.v1";
const APP_LANGUAGE_STORAGE_KEY = "yc-doc.app-language.v1";
const STORAGE_TREE_STORAGE_KEY = "yc-doc.storage-tree.v1";
const STORAGE_EXPANDED_STORAGE_KEY = "yc-doc.storage-expanded.v1";
const STORAGE_SELECTED_STORAGE_KEY = "yc-doc.storage-selected.v1";
const STORAGE_SORT_MODE_STORAGE_KEY = "yc-doc.storage-sort-mode.v1";
const EDITOR_TABS_STORAGE_KEY = "yc-doc.editor-tabs.v2";
const LEGACY_EDITOR_TABS_STORAGE_KEY = "yc-doc.editor-tabs.v1";
const THEME_PREFS_STORAGE_KEY = "yc-doc.theme-prefs.v2";
const LEGACY_THEME_PREFS_STORAGE_KEY = "yc-doc.theme-prefs.v1";
const THEME_ACCENT_THEME_STORAGE_KEY = "yc-doc.theme-accent-theme.v1";
const WIKI_LINK_INDEX_DEBOUNCE_MS = 220;
const CUSTOM_THEME_STYLE_ID = "yc-doc-custom-theme-style";
const LEGACY_THEME_COLOR_THEME_ID = "theme-color";
const DEFAULT_DARK_THEME_ID = "default-dark";
const ACCENT_CUSTOMIZABLE_THEME_IDS = new Set([DEFAULT_THEME_ID, DEFAULT_DARK_THEME_ID]);
const normalizeAppLanguage = (languageInput = "") => {
  const normalized = String(languageInput || "").trim().toLowerCase();
  if (normalized.startsWith("en")) {
    return "en-US";
  }
  return "zh-CN";
};
const isEnglishLanguage = computed(() => normalizeAppLanguage(appLanguage.value) === "en-US");
const localeText = (zhTextInput = "", enTextInput = "") => {
  const zhText = String(zhTextInput || enTextInput || "");
  const enText = String(enTextInput || zhTextInput || "");
  return isEnglishLanguage.value ? enText : zhText;
};
const SETTINGS_SECTION_CONFIG = Object.freeze([
  { id: "general", labelZh: "通用", labelEn: "General", icon: "settings" },
  { id: "editor", labelZh: "编辑器", labelEn: "Editor", icon: "tool" },
  { id: "view", labelZh: "展示模式", labelEn: "Presentation", icon: "image" },
  { id: "appearance", labelZh: "外观", labelEn: "Appearance", icon: "apps" }
]);
const settingsSections = computed(() => SETTINGS_SECTION_CONFIG.map((section) => ({
  id: section.id,
  icon: section.icon,
  label: localeText(section.labelZh, section.labelEn)
})));

const normalizeLegacyThemeSelection = (themeIdInput = DEFAULT_THEME_ID, legacyModeInput = "dark") => {
  const themeId = String(themeIdInput || "").trim() || DEFAULT_THEME_ID;
  return themeId === LEGACY_THEME_COLOR_THEME_ID
    ? fallbackThemeIdForMode(legacyModeInput)
    : themeId;
};

const { toast, showToast } = useToast();
const clampByte = (value, fallback = 0) => {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) ? Math.round(numeric) : fallback, 0, 255);
};

const padHex = (value) => clampByte(value).toString(16).padStart(2, "0");

const rgbToHex = ({ r = 0, g = 0, b = 0 } = {}) => `#${padHex(r)}${padHex(g)}${padHex(b)}`;

const hexToRgb = (value, fallback = { r: 155, g: 109, b: 72 }) => {
  const raw = String(value || "").trim().replace(/^#/, "");
  const normalized = raw.length === 3
    ? raw.split("").map((segment) => segment + segment).join("")
    : raw;
  if (!/^[\da-fA-F]{6}$/.test(normalized)) {
    return {
      r: clampByte(fallback.r, 155),
      g: clampByte(fallback.g, 109),
      b: clampByte(fallback.b, 72)
    };
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
};

const rgbToCss = ({ r = 0, g = 0, b = 0 } = {}, alpha = 1) => (
  alpha >= 1
    ? `rgb(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)})`
    : `rgba(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}, ${clamp(Number(alpha) || 0, 0, 1)})`
);

const rgbToHsl = ({ r = 0, g = 0, b = 0 } = {}) => {
  const red = clampByte(r) / 255;
  const green = clampByte(g) / 255;
  const blue = clampByte(b) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  let hue = 0;
  switch (max) {
    case red:
      hue = ((green - blue) / delta) + (green < blue ? 6 : 0);
      break;
    case green:
      hue = ((blue - red) / delta) + 2;
      break;
    default:
      hue = ((red - green) / delta) + 4;
      break;
  }
  return {
    h: hue * 60,
    s: saturation,
    l: lightness
  };
};

const hslToRgb = ({ h = 0, s = 0, l = 0 } = {}) => {
  const hue = ((Number(h) % 360) + 360) % 360;
  const saturation = clamp(Number(s) || 0, 0, 1);
  const lightness = clamp(Number(l) || 0, 0, 1);
  if (saturation === 0) {
    const gray = Math.round(lightness * 255);
    return { r: gray, g: gray, b: gray };
  }
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = secondary;
  } else if (segment < 2) {
    red = secondary;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = secondary;
  } else if (segment < 4) {
    green = secondary;
    blue = chroma;
  } else if (segment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }
  const match = lightness - chroma / 2;
  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  };
};

const shiftHue = (hue = 0, delta = 0) => (((Number(hue) || 0) + Number(delta || 0)) % 360 + 360) % 360;

const relativeLuminance = ({ r = 0, g = 0, b = 0 } = {}) => {
  const normalize = (value) => {
    const channel = clampByte(value) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
};

const applyThemeAccentRgb = (rgbInput = {}) => {
  themeAccentRed.value = clampByte(rgbInput.r, themeAccentRed.value);
  themeAccentGreen.value = clampByte(rgbInput.g, themeAccentGreen.value);
  themeAccentBlue.value = clampByte(rgbInput.b, themeAccentBlue.value);
};

const themeAccentHex = computed({
  get: () => rgbToHex({
    r: themeAccentRed.value,
    g: themeAccentGreen.value,
    b: themeAccentBlue.value
  }),
  set: (value) => {
    applyThemeAccentRgb(hexToRgb(value, {
      r: themeAccentRed.value,
      g: themeAccentGreen.value,
      b: themeAccentBlue.value
    }));
  }
});

const themeAccentPresetLabel = computed(() => {
  if (themeAccentSaturation.value <= 82) {
    return "低饱和";
  }
  if (themeAccentSaturation.value >= 122) {
    return "高饱和";
  }
  return "标准";
});

const isThemeAccentAdjustableThemeActive = computed(() => ACCENT_CUSTOMIZABLE_THEME_IDS.has(activeThemeId.value));
const isThemeAccentOverrideActive = computed(() => themeAccentEnabled.value && isThemeAccentAdjustableThemeActive.value);
const themeAccentPickerEnabled = computed(() => isThemeAccentOverrideActive.value);
const effectiveThemeAccentRgb = computed(() => ({
  r: themeAccentRed.value,
  g: themeAccentGreen.value,
  b: themeAccentBlue.value
}));
const effectiveThemeAccentSaturation = computed(() => themeAccentSaturation.value);

const buildThemeAccentPalette = ({ rgb = null, saturation = 100, dark = false } = {}) => {
  if (!rgb) {
    return null;
  }
  const saturationScale = clamp((Number(saturation) || 100) / 100, 0.65, 1.45);
  const baseHsl = rgbToHsl(rgb);
  const accentRgb = hslToRgb({
    h: baseHsl.h,
    s: clamp(baseHsl.s * saturationScale, 0.18, 0.96),
    l: clamp(baseHsl.l, dark ? 0.54 : 0.3, dark ? 0.78 : 0.66)
  });
  const accentHsl = rgbToHsl(accentRgb);
  const accentStrongRgb = hslToRgb({
    h: accentHsl.h,
    s: clamp(accentHsl.s * 1.04, 0.18, 1),
    l: clamp(accentHsl.l + (dark ? 0.08 : -0.1), 0.16, 0.86)
  });
  const accentSoftAlpha = dark ? 0.22 : 0.12;
  const accentSoftStrongAlpha = dark ? 0.32 : 0.22;
  const accentContrast = relativeLuminance(accentRgb) > 0.5 ? "#1f2937" : "#ffffff";
  const textOnAccentRgb = hslToRgb({
    h: accentHsl.h,
    s: clamp(accentHsl.s * 0.96, 0.16, 1),
    l: clamp(accentHsl.l + (dark ? 0.18 : -0.16), 0.18, 0.9)
  });
  const linkRgb = hslToRgb({
    h: shiftHue(accentHsl.h, dark ? 10 : 6),
    s: clamp(accentHsl.s * 0.9, 0.14, 0.92),
    l: clamp(accentHsl.l + (dark ? 0.14 : -0.02), 0.26, 0.82)
  });
  const linkHoverRgb = hslToRgb({
    h: shiftHue(accentHsl.h, dark ? 6 : 2),
    s: clamp(accentHsl.s * 0.95, 0.16, 0.96),
    l: clamp(accentHsl.l + (dark ? 0.2 : -0.08), 0.18, 0.88)
  });
  const editorMetaKeyRgb = hslToRgb({
    h: shiftHue(accentHsl.h, 10),
    s: clamp(accentHsl.s * 0.8, 0.14, 0.92),
    l: clamp(accentHsl.l + (dark ? 0.08 : -0.02), 0.24, 0.82)
  });
  const editorMetaNumberRgb = hslToRgb({
    h: shiftHue(accentHsl.h, -8),
    s: clamp(accentHsl.s * 0.92, 0.16, 0.98),
    l: clamp(accentHsl.l + (dark ? 0.12 : -0.06), 0.22, 0.88)
  });
  return {
    accentRgb,
    accentStrongRgb,
    accentSoftAlpha,
    accentSoftStrongAlpha,
    accentContrast,
    textOnAccentRgb,
    linkRgb,
    linkHoverRgb,
    editorMetaKeyRgb,
    editorMetaNumberRgb
  };
};

const buildThemeAccentThemeStyle = ({ enabled = false, rgb = null, saturation = 100, dark = false } = {}) => {
  if (!enabled || !rgb) {
    return {};
  }
  const palette = buildThemeAccentPalette({ rgb, saturation, dark });
  if (!palette) {
    return {};
  }
  const {
    accentRgb,
    accentStrongRgb,
    accentSoftAlpha,
    accentSoftStrongAlpha,
    accentContrast,
    textOnAccentRgb,
    linkRgb,
    linkHoverRgb,
    editorMetaKeyRgb,
    editorMetaNumberRgb
  } = palette;
  const blockquoteColor = dark
    ? `color-mix(in srgb, var(--yc-text-primary) 84%, ${rgbToCss(linkRgb)} 16%)`
    : `color-mix(in srgb, var(--yc-text-secondary) 84%, ${rgbToCss(linkRgb)} 16%)`;
  const noteBg = dark
    ? `color-mix(in srgb, var(--yc-bg-panel-alt) 88%, ${rgbToCss(accentRgb)} 12%)`
    : `color-mix(in srgb, var(--yc-bg-panel-alt) 94%, ${rgbToCss(accentRgb)} 6%)`;
  const noteBorder = dark
    ? `color-mix(in srgb, var(--yc-border-contrast) 52%, ${rgbToCss(accentStrongRgb)} 48%)`
    : `color-mix(in srgb, var(--yc-border-contrast) 70%, ${rgbToCss(accentStrongRgb)} 30%)`;
  const previewCalloutBg = dark
    ? `color-mix(in srgb, var(--yc-bg-panel) 92%, ${rgbToCss(accentRgb)} 8%)`
    : `color-mix(in srgb, var(--yc-bg-panel) 96%, ${rgbToCss(accentRgb)} 4%)`;
  const previewCalloutHeadBg = dark
    ? `color-mix(in srgb, var(--yc-bg-subtle-hover) 76%, ${rgbToCss(accentRgb)} 24%)`
    : `color-mix(in srgb, var(--yc-bg-subtle-hover) 88%, ${rgbToCss(accentRgb)} 12%)`;
  return {
    "--yc-accent": rgbToCss(accentRgb),
    "--yc-accent-strong": rgbToCss(accentStrongRgb),
    "--yc-accent-soft": rgbToCss(accentRgb, accentSoftAlpha),
    "--yc-accent-soft-strong": rgbToCss(accentRgb, accentSoftStrongAlpha),
    "--yc-accent-contrast": accentContrast,
    "--yc-text-on-accent": rgbToCss(textOnAccentRgb),
    "--yc-link": rgbToCss(linkRgb),
    "--yc-link-hover": rgbToCss(linkHoverRgb),
    "--yc-link-soft": rgbToCss(linkRgb, dark ? 0.18 : 0.1),
    "--yc-link-decoration": rgbToCss(linkRgb, dark ? 0.7 : 0.5),
    "--yc-bg-active": rgbToCss(accentRgb, dark ? 0.16 : 0.1),
    "--yc-bg-selected": rgbToCss(accentRgb, dark ? 0.12 : 0.08),
    "--yc-bg-drop-target": rgbToCss(accentRgb, dark ? 0.18 : 0.14),
    "--yc-bg-drop-shadow": rgbToCss(accentStrongRgb, dark ? 0.34 : 0.24),
    "--yc-editor-selection": rgbToCss(accentRgb, dark ? 0.22 : 0.16),
    "--yc-editor-selection-native": rgbToCss(accentRgb, dark ? 0.24 : 0.18),
    "--yc-preview-selection": rgbToCss(accentRgb, dark ? 0.18 : 0.14),
    "--yc-input-selection-bg": rgbToCss(accentRgb, dark ? 0.28 : 0.22),
    "--yc-input-selection-text": accentContrast,
    "--yc-input-focus-bg": dark
      ? `color-mix(in srgb, var(--yc-bg-panel) 72%, ${rgbToCss(accentRgb, 0.08)} 28%)`
      : `color-mix(in srgb, var(--yc-bg-panel) 86%, ${rgbToCss(accentRgb, 0.08)} 14%)`,
    "--yc-input-focus-border": rgbToCss(accentRgb, dark ? 0.46 : 0.34),
    "--yc-input-focus-ring": `0 0 0 2px ${rgbToCss(accentRgb, dark ? 0.18 : 0.14)}`,
    "--yc-editor-markdown-prefix": rgbToCss(accentStrongRgb),
    "--yc-annotation-color": rgbToCss(linkRgb),
    "--yc-annotation-bg": rgbToCss(linkRgb, dark ? 0.14 : 0.1),
    "--yc-editor-inline-comment": rgbToCss(linkRgb),
    "--yc-editor-inline-comment-bg": rgbToCss(linkRgb, dark ? 0.12 : 0.08),
    "--yc-editor-inline-comment-shadow": rgbToCss(linkRgb, dark ? 0.18 : 0.12),
    "--yc-syntax-keyword": rgbToCss(accentStrongRgb),
    "--yc-syntax-type": rgbToCss(linkHoverRgb),
    "--yc-syntax-string": rgbToCss(editorMetaKeyRgb),
    "--yc-syntax-number": rgbToCss(editorMetaNumberRgb),
    "--yc-syntax-attribute": rgbToCss(accentRgb),
    "--yc-syntax-meta": rgbToCss(linkRgb),
    "--yc-syntax-delimiter": rgbToCss(linkRgb),
    "--yc-syntax-link": rgbToCss(linkRgb),
    "--yc-editor-search-bg": rgbToCss(accentRgb, dark ? 0.22 : 0.16),
    "--yc-editor-search-outline": rgbToCss(accentStrongRgb, dark ? 0.52 : 0.38),
    "--yc-editor-context-line": rgbToCss(accentRgb, dark ? 0.12 : 0.08),
    "--yc-editor-delim": rgbToCss(linkRgb, dark ? 0.76 : 0.9),
    "--yc-editor-image-alt": rgbToCss(editorMetaKeyRgb),
    "--yc-editor-image-title": rgbToCss(accentStrongRgb),
    "--yc-editor-meta-key": rgbToCss(editorMetaKeyRgb),
    "--yc-editor-meta-number": rgbToCss(editorMetaNumberRgb),
    "--yc-editor-comment-link": rgbToCss(linkRgb),
    "--yc-editor-link-bg": rgbToCss(linkRgb, dark ? 0.14 : 0.1),
    "--yc-editor-link-resolved-bg": rgbToCss(linkRgb, dark ? 0.18 : 0.12),
    "--yc-wikilink-color": rgbToCss(linkRgb),
    "--yc-wikilink-bg": "transparent",
    "--yc-wikilink-hover-bg": "transparent",
    "--yc-wikilink-source-delim": rgbToCss(linkRgb),
    "--yc-wikilink-resolved-color": rgbToCss(linkRgb),
    "--yc-wikilink-resolved-bg": "transparent",
    "--yc-wikilink-missing-bg": "transparent",
    "--yc-wikilink-ambiguous-bg": "transparent",
    "--yc-mode-switch-active-bg": rgbToCss(accentRgb, dark ? 0.22 : 0.16),
    "--yc-mode-switch-active-text": rgbToCss(accentStrongRgb),
    "--yc-mode-switch-active-shadow": "none",
    "--yc-blockquote-accent": rgbToCss(accentStrongRgb),
    "--yc-blockquote-border": rgbToCss(accentStrongRgb),
    "--yc-blockquote-color": blockquoteColor,
    "--yc-callout-note-bg": noteBg,
    "--yc-callout-note-border": noteBorder,
    "--yc-callout-note-title": rgbToCss(accentStrongRgb),
    "--yc-callout-note-body": blockquoteColor,
    "--yc-preview-callout-border": noteBorder,
    "--yc-preview-callout-bg": previewCalloutBg,
    "--yc-preview-callout-head-border": noteBorder,
    "--yc-preview-callout-head-bg": previewCalloutHeadBg,
    "--yc-preview-callout-head-color": rgbToCss(accentStrongRgb),
    "--yc-table-highlight-color": rgbToCss(accentStrongRgb),
    "--yc-table-highlight-bg": rgbToCss(accentRgb, dark ? 0.16 : 0.1),
    "--yc-table-highlight-bg-strong": rgbToCss(accentRgb, dark ? 0.26 : 0.16),
    "--yc-table-handle-active": rgbToCss(accentStrongRgb),
    "--yc-table-edge-btn-active": rgbToCss(accentStrongRgb),
    "--yc-file-tree-search-highlight-bg": rgbToCss(accentRgb, dark ? 0.18 : 0.12),
    "--yc-file-tree-search-highlight-shadow": `inset 0 -1px 0 ${rgbToCss(accentStrongRgb, dark ? 0.72 : 0.54)}`,
    "--yc-file-tree-search-highlight-text": dark ? "#f3e8ff" : rgbToCss(accentStrongRgb),
    "--yc-graph-root-node": rgbToCss(accentRgb, dark ? 0.56 : 0.62),
    "--yc-graph-node-fill": rgbToCss(accentRgb, dark ? 0.56 : 0.62),
    "--yc-graph-node-hover": rgbToCss(accentRgb),
    "--yc-graph-arrow": rgbToCss(accentStrongRgb, dark ? 0.88 : 0.78),
    "--yc-graph-edge": rgbToCss(accentRgb, dark ? 0.24 : 0.18),
    "--yc-graph-edge-active": rgbToCss(accentRgb, dark ? 0.82 : 0.74),
    "--yc-progress-fill": `linear-gradient(90deg, ${rgbToCss(accentRgb)} 0%, ${rgbToCss(accentStrongRgb)} 100%)`
  };
};

const resolvedXtermTheme = computed(() => {
  const baseTheme = resolveXtermTheme(activeThemeId.value, importedThemes.value);
  if (!isThemeAccentOverrideActive.value) {
    return baseTheme;
  }
  const palette = buildThemeAccentPalette({
    rgb: effectiveThemeAccentRgb.value,
    saturation: effectiveThemeAccentSaturation.value,
    dark: currentThemeMode.value === "dark"
  });
  if (!palette) {
    return baseTheme;
  }
  const accentContrast = palette.accentContrast === "#ffffff" ? "#111827" : "#ffffff";
  return {
    ...baseTheme,
    cursor: rgbToCss(palette.accentRgb),
    cursorAccent: accentContrast,
    selectionBackground: rgbToCss(palette.accentRgb, currentThemeMode.value === "dark" ? 0.28 : 0.22),
    selectionInactiveBackground: rgbToCss(palette.accentRgb, currentThemeMode.value === "dark" ? 0.16 : 0.12)
  };
});

const appThemeInlineStyle = computed(() => buildThemeAccentThemeStyle({
  enabled: isThemeAccentOverrideActive.value,
  rgb: effectiveThemeAccentRgb.value,
  saturation: effectiveThemeAccentSaturation.value,
  dark: currentThemeMode.value === "dark"
}));

const bridgedFloatingThemeVars = new Set();

const clearFloatingThemeBridge = () => {
  if (typeof document === "undefined" || !document.body) {
    return;
  }
  const body = document.body;
  for (const name of bridgedFloatingThemeVars) {
    body.style.removeProperty(name);
  }
  bridgedFloatingThemeVars.clear();
  delete body.dataset.theme;
  delete body.dataset.themeMode;
  body.classList.remove("dark-ui");
};

const syncFloatingThemeBridge = () => {
  if (typeof window === "undefined" || typeof document === "undefined" || !document.body) {
    return;
  }
  const appRoot = document.getElementById("app");
  if (!appRoot) {
    return;
  }
  const computedStyle = window.getComputedStyle(appRoot);
  const nextNames = new Set();
  for (let index = 0; index < computedStyle.length; index += 1) {
    const propertyName = computedStyle.item(index);
    if (!propertyName || !propertyName.startsWith("--yc-")) {
      continue;
    }
    const value = computedStyle.getPropertyValue(propertyName);
    if (!value) {
      continue;
    }
    document.body.style.setProperty(propertyName, value);
    nextNames.add(propertyName);
  }
  for (const propertyName of bridgedFloatingThemeVars) {
    if (!nextNames.has(propertyName)) {
      document.body.style.removeProperty(propertyName);
    }
  }
  bridgedFloatingThemeVars.clear();
  nextNames.forEach((propertyName) => bridgedFloatingThemeVars.add(propertyName));
  document.body.dataset.theme = String(activeThemeId.value || "");
  document.body.dataset.themeMode = String(currentThemeMode.value || "light");
  document.body.classList.toggle("dark-ui", currentThemeMode.value === "dark");
};

watch(
  [activeThemeId, currentThemeMode, appThemeInlineStyle],
  () => {
    nextTick(syncFloatingThemeBridge);
  },
  {
    immediate: true,
    deep: true,
    flush: "post"
  }
);

onMounted(() => {
  syncFloatingThemeBridge();
  syncThemeAccentPickerFromRgb();
});

onBeforeUnmount(() => {
  stopSvDrag();
  clearFloatingThemeBridge();
});

const persistThemeAccentThemePrefs = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(THEME_ACCENT_THEME_STORAGE_KEY, JSON.stringify({
      enabled: themeAccentEnabled.value,
      r: clampByte(themeAccentRed.value, 155),
      g: clampByte(themeAccentGreen.value, 109),
      b: clampByte(themeAccentBlue.value, 72),
      saturation: clamp(Number(themeAccentSaturation.value) || 100, 65, 145)
    }));
  } catch {
    // ignore storage failure
  }
};

const resetThemeAccentTheme = () => {
  themeAccentEnabled.value = false;
  applyThemeAccentRgb({ r: 155, g: 109, b: 72 });
  themeAccentSaturation.value = 100;
  persistThemeAccentThemePrefs();
};
const createEmptyWikiLinkIndex = () => ({
  files: [],
  notesByPath: {},
  contentsByPath: {},
  forwardLinks: {},
  backlinks: {},
  unresolvedLinks: {},
  ambiguousLinks: {}
});
const wikiLinkIndexState = ref(createEmptyWikiLinkIndex());
const wikiLinkIndexLoading = ref(false);
const pendingPreviewHeadingSlug = ref("");
let wikiLinkIndexTimer = null;
let wikiLinkIndexSeq = 0;

const clearBodyInteractionStyles = () => {
  if (typeof document === "undefined" || !document.body) {
    return;
  }
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
};

const releaseTransientPointerState = ({ syncTerminal = true } = {}) => {
  const shouldSyncTerminal = syncTerminal && terminalDragSizing && terminalOpen.value;

  isSidebarDragging.value = false;
  isFileSidebarDragging.value = false;
  terminalDragSizing = false;

  if (sidebarDragMoveHandler) {
    window.removeEventListener("mousemove", sidebarDragMoveHandler);
    sidebarDragMoveHandler = null;
  }
  if (sidebarDragUpHandler) {
    window.removeEventListener("mouseup", sidebarDragUpHandler);
    sidebarDragUpHandler = null;
  }
  if (fileSidebarDragMoveHandler) {
    window.removeEventListener("mousemove", fileSidebarDragMoveHandler);
    fileSidebarDragMoveHandler = null;
  }
  if (fileSidebarDragUpHandler) {
    window.removeEventListener("mouseup", fileSidebarDragUpHandler);
    fileSidebarDragUpHandler = null;
  }
  if (desktopSplitDragMoveHandler) {
    window.removeEventListener("mousemove", desktopSplitDragMoveHandler);
    desktopSplitDragMoveHandler = null;
  }
  if (desktopSplitDragUpHandler) {
    window.removeEventListener("mouseup", desktopSplitDragUpHandler);
    desktopSplitDragUpHandler = null;
  }
  if (terminalResizeMoveHandler) {
    window.removeEventListener("mousemove", terminalResizeMoveHandler);
    terminalResizeMoveHandler = null;
  }
  if (terminalResizeUpHandler) {
    window.removeEventListener("mouseup", terminalResizeUpHandler);
    terminalResizeUpHandler = null;
  }

  finishSidebarDrag();
  finishFileSidebarDrag();
  clearBodyInteractionStyles();

  if (shouldSyncTerminal) {
    requestDesktopTerminalSizeSync(0);
    nextTick(scrollTerminalToBottom);
  }
};

const {
  steps,
  currentId,
  activeStep,
  currentStepIndex,
  isFirstStep,
  isLastStep,
  next: baseNext,
  prev: basePrev
} = useSteps(showToast);

const {
  sidebarWidth,
  displayWidth,
  displayStyle,
  resetDisplayWidth
} = useResizable();

const adjustVisualEditorWidth = (delta) => {
  const maxWidth = typeof window === "undefined" ? 1160 : Math.min(1160, window.innerWidth - 80);
  displayWidth.value = clamp(displayWidth.value + Number(delta || 0), 520, Math.max(520, maxWidth));
};

const contentPaneKey = computed(() => (
  isEditMode.value
    ? `${mode.value}:${activeEditorTabId.value || activeMarkdownRelPath.value || "blank"}`
    : `${mode.value}:${currentId.value}`
));

const canUseSourceMode = computed(() => (
  isEditMode.value
  && !isWorkspaceGraphTabActive.value
  && !isImagePreviewTabActive.value
  && Boolean(activeMarkdownRelPath.value)
));

const canUsePresentMode = computed(() => (
  !isWorkspaceGraphTabActive.value
  && !isImagePreviewTabActive.value
  && Boolean(activeMarkdownRelPath.value)
));

const getActiveMarkdownEditorApi = () => (
  isSourceMode.value
    ? markdownSourceRef.value
    : markdownEditorRef.value
);

const canExportCurrentDocumentPdf = computed(() => Boolean(
  canExportPdf
  && activeMarkdownRelPath.value
  && !isImagePreviewTabActive.value
  && !isWorkspaceGraphTabActive.value
));

const focusMarkdownPosition = (posInput = 0) => {
  const markdown = String(documentMarkdown.value || "");
  const targetPos = clamp(Number(posInput || 0), 0, markdown.length);
  const editorApi = getActiveMarkdownEditorApi();
  if (typeof editorApi?.focusPosition === "function") {
    editorApi.focusPosition(targetPos);
    return true;
  }
  if (typeof editorApi?.focus === "function") {
    editorApi.focus();
    return true;
  }
  return false;
};

const normalizeMarkdownForStats = (value = "") => String(value || "")
  .replace(/\r\n/g, "\n")
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, " $1 ")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, " $1 ")
  .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_match, target, alias) => ` ${alias || target} `)
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^\s{0,3}[-*+]\s+/gm, "")
  .replace(/^\s{0,3}\d+\.\s+/gm, "")
  .replace(/[`*_~>#|]/g, " ");

const countMarkdownWords = (value = "") => {
  const plain = normalizeMarkdownForStats(value);
  const cjkMatches = plain.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) || [];
  const nonCjk = plain.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, " ");
  const wordMatches = nonCjk.match(/[\p{Letter}\p{Number}]+(?:['’-][\p{Letter}\p{Number}]+)*/gu) || [];
  return wordMatches.length + cjkMatches.length;
};

const countMarkdownCharacters = (value = "") =>
  normalizeMarkdownForStats(value)
    .replace(/\s+/g, "")
    .length;

const countMarkdownParagraphs = (value = "") =>
  normalizeMarkdownForStats(value)
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .length;

const editorDocumentStats = computed(() => {
  const markdown = String(documentMarkdown.value || "");
  return {
    words: countMarkdownWords(markdown),
    characters: countMarkdownCharacters(markdown),
    paragraphs: countMarkdownParagraphs(markdown)
  };
});

const CHROME_STATS_METRICS = Object.freeze(["words", "characters", "paragraphs"]);
const CHROME_STATS_LABELS = Object.freeze({
  words: "W",
  characters: "C",
  paragraphs: "P"
});
const CHROME_STATS_TITLES = Object.freeze({
  words: "字数",
  characters: "字符数",
  paragraphs: "段落数"
});

const chromeStatsMetric = ref("words");
const formatCount = (valueInput = 0) => new Intl.NumberFormat("en-US").format(
  Math.max(0, Number(valueInput || 0))
);

const chromeStatsDisplayLabel = computed(() => (
  CHROME_STATS_LABELS[chromeStatsMetric.value] || "W"
));

const chromeStatsDisplayValue = computed(() => (
  editorDocumentStats.value?.[chromeStatsMetric.value] ?? 0
));

const chromeStatsAriaLabel = computed(() => {
  const currentTitle = CHROME_STATS_TITLES[chromeStatsMetric.value] || "字数";
  return `${currentTitle} ${formatCount(chromeStatsDisplayValue.value)}，点击切换统计维度`;
});

const cycleChromeStatsMetric = () => {
  const currentIndex = CHROME_STATS_METRICS.indexOf(chromeStatsMetric.value);
  const nextIndex = currentIndex >= 0
    ? (currentIndex + 1) % CHROME_STATS_METRICS.length
    : 0;
  chromeStatsMetric.value = CHROME_STATS_METRICS[nextIndex];
};

const renderedMarkdown = computed(() => {
  const content = String(documentMarkdown.value || activeStep.value?.content || "");
  try {
    return renderMarkdownToHtml({
      markdown: content,
      currentRelPath: activeMarkdownRelPath.value,
      markdownFiles: workspaceMarkdownFiles.value,
      workspaceRootPath: storageRootPath.value,
      renderMathFormula
    });
  } catch (e) {
    return "";
  }
});

const viewModeMarkdown = computed(() => {
  if (typeof serializeStepsToMarkdown !== "function") {
    return String(documentMarkdown.value || activeStep.value?.content || "");
  }
  const currentStep = activeStep.value && typeof activeStep.value === "object"
    ? {
        ...activeStep.value,
        title: String(activeStep.value.title || ""),
        subtitle: String(activeStep.value.subtitle || ""),
        content: String(activeStep.value.content || "")
      }
    : null;
  if (!currentStep) {
    return String(documentMarkdown.value || "");
  }
  return serializeStepsToMarkdown([currentStep]);
});

async function focusStepInEditMode(index) {
  const safeIndex = clamp(Number(index) || 0, 0, Math.max(0, steps.value.length - 1));
  const targetId = steps.value[safeIndex]?.id;
  if (targetId != null && targetId !== currentId.value) {
    currentId.value = targetId;
  }
  await nextTick();
  const markdown = String(documentMarkdown.value || "");
  const stepSections = typeof extractMarkdownSections === "function"
    ? extractMarkdownSections(markdown)
    : [];
  const targetSection = Array.isArray(stepSections) ? stepSections[safeIndex] : null;
  const focusPos = targetSection
    ? clamp(
        Number.isFinite(targetSection.bodyStart) ? targetSection.bodyStart : targetSection.startIndex,
        0,
        markdown.length
      )
    : 0;
  focusMarkdownPosition(focusPos);
}

const {
  activeMarkdownRelPath,
  clearScheduledMarkdownSave,
  documentMarkdown,
  extractHeadingOutline,
  extractMarkdownSections,
  flushPendingMarkdownSave,
  formatBytes,
  isMarkdownDirty,
  isMarkdownFileName,
  isMarkdownFileTooLarge,
  lastSaveError,
  lastSavedAt,
  isSingleBlankStepList,
  loadStepsFromMarkdownFile,
  markdownHydrating,
  moveStep,
  parseMarkdownToSteps,
  persistActiveMarkdownBeforeSwitch,
  resetBlankEditorState,
  saveMarkdown,
  saveStatus,
  updateMarkdown,
  serializeStepsToMarkdown,
  stepDisplayTitle,
  writeActiveMarkdownNow
} = useMarkdownDocument({
  steps,
  currentId,
  currentStepIndex,
  isEditMode,
  desktopDataBridge,
  isDesktopStorage,
  canWorkspaceFileIO,
  showToast,
  focusStepInEditMode
});

const isActiveMarkdownEmpty = computed(() =>
  !String(documentMarkdown.value || "")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
    .trim()
);

const handleEditorSelectionChange = (selection) => {
  editorSelection.value = {
    anchor: Number(selection?.anchor || 0),
    head: Number(selection?.head || 0)
  };
};

const {
  outline: semanticOutline,
  currentBlock: currentSemanticBlock
} = useSemanticStore({
  markdownRef: documentMarkdown,
  selectionRef: editorSelection,
  parseDelayMs: 0,
  currentBlockStrategy: "anchor"
});

const viewHeadingOutline = computed(() => extractHeadingsFromMarkdown(viewModeMarkdown.value));

const activeSemanticBlock = computed(() => {
  const current = currentSemanticBlock.value;
  return current?.block || current?.prevBlock || current?.nextBlock || null;
});

const editorHeadingOutline = computed(() => (
  typeof extractHeadingOutline === "function"
    ? extractHeadingOutline(documentMarkdown.value)
    : []
));

const collapsedOutlineHeadingIds = ref([]);

const buildOutlineTree = (outlineInput = [], collapsedIds = new Set()) => {
  const roots = [];
  const stack = [];
  for (let index = 0; index < (Array.isArray(outlineInput) ? outlineInput.length : 0); index += 1) {
    const heading = outlineInput[index];
    const node = {
      ...heading,
      outlineIndex: index,
      depth: Math.max(0, Number(heading?.level || 1) - 1),
      children: [],
      hasChildren: false,
      isCollapsed: collapsedIds.has(String(heading?.id || ""))
    };

    while (stack.length && Number(stack[stack.length - 1]?.level || 1) >= Number(node.level || 1)) {
      stack.pop();
    }

    const parent = stack[stack.length - 1] || null;
    if (parent) {
      parent.children.push(node);
      parent.hasChildren = true;
    } else {
      roots.push(node);
    }
    stack.push(node);
  }
  return roots;
};

const flattenOutlineTree = (nodes = [], collapsedIds = new Set(), output = []) => {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const nodeId = String(node?.id || "");
    output.push({
      ...node,
      hasChildren: Array.isArray(node?.children) && node.children.length > 0,
      isCollapsed: collapsedIds.has(nodeId)
    });
    if (Array.isArray(node?.children) && node.children.length && !collapsedIds.has(nodeId)) {
      flattenOutlineTree(node.children, collapsedIds, output);
    }
  }
  return output;
};

const collapsedOutlineHeadingIdSet = computed(() => new Set(
  (Array.isArray(collapsedOutlineHeadingIds.value) ? collapsedOutlineHeadingIds.value : [])
    .map((id) => String(id || ""))
    .filter(Boolean)
));

const editorHeadingOutlineTree = computed(() => buildOutlineTree(
  editorHeadingOutline.value,
  collapsedOutlineHeadingIdSet.value
));

const visibleEditorHeadingOutline = computed(() => flattenOutlineTree(
  editorHeadingOutlineTree.value,
  collapsedOutlineHeadingIdSet.value
));

const activeEditorOutlineIndex = computed(() => {
  const outline = editorHeadingOutline.value;
  if (!outline.length) {
    return -1;
  }
  const rawPos = clamp(
    Number(editorSelection.value?.head ?? editorSelection.value?.anchor ?? 0),
    0,
    String(documentMarkdown.value || "").length
  );
  let activeIndex = -1;
  for (let index = 0; index < outline.length; index += 1) {
    if (rawPos < Number(outline[index]?.from || 0)) {
      break;
    }
    activeIndex = index;
  }
  return activeIndex < 0 ? 0 : activeIndex;
});

const outlineIndentStyle = (heading) => ({
  marginLeft: `${Math.max(0, Number(heading?.depth ?? Number(heading?.level || 1) - 1)) * 8}px`
});

const handleOutlineSelection = async (heading) => {
  const markdown = String(documentMarkdown.value || "");
  const rawPos = clamp(Number(heading?.from || 0), 0, markdown.length);
  const stepIndex = findStepIndexForRawPos(markdown, rawPos);
  currentId.value = steps.value?.[stepIndex]?.id ?? currentId.value;
  await nextTick();
  focusMarkdownPosition(rawPos);
};

const toggleOutlineCollapse = (headingIdInput = "") => {
  const headingId = String(headingIdInput || "").trim();
  if (!headingId) {
    return;
  }
  const collapsed = new Set(collapsedOutlineHeadingIdSet.value);
  if (collapsed.has(headingId)) {
    collapsed.delete(headingId);
  } else {
    collapsed.add(headingId);
  }
  collapsedOutlineHeadingIds.value = [...collapsed];
};

const currentBlockLabel = computed(() => {
  const block = activeSemanticBlock.value;
  if (!block) {
    return "Block none";
  }
  return `Block ${block.type}`;
});

const currentBlockDebugTitle = computed(() => {
  const block = activeSemanticBlock.value;
  if (!block) {
    return "当前无块";
  }
  const lineStart = Number(block.lineStart || 0);
  const lineEnd = Number(block.lineEnd || lineStart);
  return `${block.type}  L${lineStart}-${lineEnd}  [${block.from}, ${block.to})`;
});

const flattenInlineTokens = (tokens = []) =>
  (Array.isArray(tokens) ? tokens : []).flatMap((token) => [
    token,
    ...flattenInlineTokens(token?.children || [])
  ]);

const activeInlineSegments = computed(() => {
  const block = activeSemanticBlock.value;
  return Array.isArray(block?.inlineSegments) ? block.inlineSegments : [];
});

const activeInlineTokens = computed(() => {
  const block = activeSemanticBlock.value;
  return flattenInlineTokens(Array.isArray(block?.inlineTokens) ? block.inlineTokens : []);
});

const activeInlineSegmentCount = computed(() => activeInlineSegments.value.length);
const activeInlineTokenCount = computed(() => activeInlineTokens.value.length);

const formatMarks = (marks) => {
  const list = Array.isArray(marks) ? marks.filter(Boolean) : [];
  return list.length ? list.join("|") : "-";
};

const inlineDebugLines = computed(() => {
  const segmentLines = activeInlineSegments.value.slice(0, 10).map((segment, index) => {
    const preview = String(segment?.text || "").replace(/\n/g, "\\n");
    return [
      `S${index + 1}`,
      `[${segment.from},${segment.to})`,
      `inner=[${segment.innerFrom},${segment.innerTo})`,
      `outer=[${segment.outerFrom},${segment.outerTo})`,
      `type=${segment.type}`,
      `marks=${formatMarks(segment.marks)}`,
      `text="${preview}"`
    ].join("  ");
  });

  const tokenLines = activeInlineTokens.value.slice(0, 8).map((token, index) => {
    const preview = String(token?.text || "").replace(/\n/g, "\\n");
    return [
      `T${index + 1}`,
      `[${token.rawFrom},${token.rawTo})`,
      `text=[${token.textFrom},${token.textTo})`,
      `type=${token.type}`,
      `marks=${formatMarks(token.marks)}`,
      `text="${preview}"`
    ].join("  ");
  });

  return [...segmentLines, ...tokenLines];
});

const formatSaveTime = (value) => {
  if (!value) {
    return "";
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return "";
  }
};

const saveStatusLabel = computed(() => {
  if (!activeMarkdownRelPath.value) {
    return "未关联文件";
  }
  if (saveStatus.value === "saving") {
    return "保存中...";
  }
  if (saveStatus.value === "error") {
    return "保存失败";
  }
  if (isMarkdownDirty()) {
    return "未保存";
  }
  const savedAt = formatSaveTime(lastSavedAt.value);
  return savedAt ? `已保存 ${savedAt}` : "已同步";
});

const saveStatusTooltip = computed(() => {
  if (saveStatus.value === "error" && lastSaveError.value) {
    return `保存失败: ${lastSaveError.value}`;
  }
  return activeMarkdownRelPath.value || "";
});

const saveStatusChipClass = computed(() =>
  saveStatus.value === "error"
    ? (isDark.value ? "bg-rose-500/20 text-rose-200 border border-rose-500/40" : "bg-rose-50 text-rose-700 border border-rose-200")
    : isMarkdownDirty()
      ? (isDark.value ? "bg-amber-500/20 text-amber-200 border border-amber-500/40" : "bg-amber-50 text-amber-700 border border-amber-200")
      : (isDark.value ? "bg-slate-800 text-slate-200 border border-slate-700" : "bg-gray-100 text-gray-700 border border-gray-200")
);

const handleManualSaveCurrentMarkdown = async () => {
  if (!activeMarkdownRelPath.value) {
    showToast("当前没有可保存的 Markdown 文件");
    return;
  }
  const saved = await saveMarkdown();
  if (saved) {
    showToast("Markdown 已保存");
    return;
  }
  if (saveStatus.value !== "error") {
    showToast("无需保存，内容已是最新");
  }
};

const onStepDragStart = (event, index) => {
  if (!isEditMode.value) {
    return;
  }
  draggedStepIndex.value = Number(index);
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
};

const onStepDragOver = (event) => {
  if (!isEditMode.value) {
    return;
  }
  event.preventDefault();
  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
};

const onStepDragEnd = () => {
  draggedStepIndex.value = -1;
};

const onStepDrop = async (event, targetIndex) => {
  if (!isEditMode.value) {
    return;
  }
  event.preventDefault();
  const fromIndex = Number(draggedStepIndex.value);
  const toIndex = Number(targetIndex);
  draggedStepIndex.value = -1;
  if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex) || fromIndex < 0 || toIndex < 0) {
    return;
  }
  await moveStep(fromIndex, toIndex);
};

const handleStepSelection = async (stepId, index) => {
  currentId.value = stepId;
  if (!isEditMode.value) {
    return;
  }
  await focusStepInEditMode(index);
};

const next = async () => {
  const nextIndex = currentStepIndex.value + 1;
  if (nextIndex >= steps.value.length) {
    return;
  }
  baseNext();
  if (!isEditMode.value) {
    return;
  }
  await focusStepInEditMode(nextIndex);
};

const prev = async () => {
  const previousIndex = currentStepIndex.value - 1;
  if (previousIndex < 0) {
    return;
  }
  basePrev();
  if (!isEditMode.value) {
    return;
  }
  await focusStepInEditMode(previousIndex);
};

const normalizeStorageSortMode = (mode) => {
  const optionMap = STORAGE_SORT_OPTION_MAP.value;
  return optionMap[String(mode || "").trim()]
    ? String(mode || "").trim()
    : STORAGE_SORT_DEFAULT_MODE;
};

const ensureCustomThemeStyleElement = () => {
  if (typeof document === "undefined") {
    return null;
  }
  let styleEl = document.getElementById(CUSTOM_THEME_STYLE_ID);
  if (!(styleEl instanceof HTMLStyleElement)) {
    styleEl = document.createElement("style");
    styleEl.id = CUSTOM_THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  return styleEl;
};

const applyImportedThemeStyle = () => {
  if (typeof document === "undefined") {
    return;
  }
  const existing = document.getElementById(CUSTOM_THEME_STYLE_ID);
  const importedTheme = activeImportedTheme.value;
  if (!importedTheme?.cssText) {
    existing?.remove();
    return;
  }
  const styleEl = ensureCustomThemeStyleElement();
  if (!styleEl) {
    return;
  }
  styleEl.textContent = String(importedTheme.cssText || "");
};

const persistThemePrefs = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(THEME_PREFS_STORAGE_KEY, JSON.stringify({
      activeThemeId: activeThemeId.value,
      importedThemes: importedThemes.value
    }));
  } catch {
    // ignore storage failure
  }
};

const applyThemePreference = () => {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.ycTheme = String(activeThemeId.value || DEFAULT_THEME_ID);
    document.documentElement.dataset.ycThemeMode = currentThemeMode.value;
    document.documentElement.style.colorScheme = currentThemeMode.value;
  }
  applyImportedThemeStyle();
  persistThemePrefs();
};

if (typeof window !== "undefined") {
  try {
    let legacyThemeAccentBaseMode = "dark";
    const rawThemeAccentThemePrefs = localStorage.getItem(THEME_ACCENT_THEME_STORAGE_KEY);
    if (rawThemeAccentThemePrefs) {
      const parsedThemeAccentThemePrefs = JSON.parse(rawThemeAccentThemePrefs);
      themeAccentEnabled.value = parsedThemeAccentThemePrefs?.enabled === true;
      legacyThemeAccentBaseMode = normalizeThemeMode(parsedThemeAccentThemePrefs?.baseMode || "dark");
      applyThemeAccentRgb({
        r: parsedThemeAccentThemePrefs?.r,
        g: parsedThemeAccentThemePrefs?.g,
        b: parsedThemeAccentThemePrefs?.b
      });
      themeAccentSaturation.value = clamp(Number(parsedThemeAccentThemePrefs?.saturation) || 100, 65, 145);
    } else {
      applyThemeAccentRgb({ r: 155, g: 109, b: 72 });
    }
    const rawThemePrefs = localStorage.getItem(THEME_PREFS_STORAGE_KEY) || localStorage.getItem(LEGACY_THEME_PREFS_STORAGE_KEY);
    if (rawThemePrefs) {
      const parsedThemePrefs = JSON.parse(rawThemePrefs);
      const nextImportedThemes = Array.isArray(parsedThemePrefs?.importedThemes)
        ? parsedThemePrefs.importedThemes
        : (parsedThemePrefs?.importedTheme ? [parsedThemePrefs.importedTheme] : []);
      importedThemes.value = nextImportedThemes
        .map((theme) => normalizeImportedThemeDefinition(theme))
        .filter(Boolean);
      activeThemeId.value = normalizeLegacyThemeSelection(parsedThemePrefs?.activeThemeId || DEFAULT_THEME_ID, legacyThemeAccentBaseMode);
      if (!buildThemeCatalog(importedThemes.value).some((theme) => theme?.id === activeThemeId.value)) {
        activeThemeId.value = DEFAULT_THEME_ID;
      }
      if (
        activeThemeId.value.startsWith("imported-theme")
        && !importedThemes.value.some((theme) => theme?.id === activeThemeId.value)
      ) {
        activeThemeId.value = DEFAULT_THEME_ID;
      }
    }
    gestureNavigationEnabled.value = localStorage.getItem(GESTURE_NAV_STORAGE_KEY) === "1";
    collapseHeaderInView.value = localStorage.getItem(VIEW_HEADER_COLLAPSE_STORAGE_KEY) === "1";
    collapseStepsSidebarInView.value = localStorage.getItem(VIEW_STEPS_SIDEBAR_COLLAPSE_STORAGE_KEY) === "1";
    appLanguage.value = normalizeAppLanguage(
      localStorage.getItem(APP_LANGUAGE_STORAGE_KEY)
      || (typeof navigator !== "undefined" ? navigator.language : "")
      || "zh-CN"
    );
    if (!isDesktopStorage) {
      const rawTree = localStorage.getItem(STORAGE_TREE_STORAGE_KEY);
      const parsedTree = rawTree ? JSON.parse(rawTree) : null;
      if (parsedTree && typeof parsedTree === "object") {
        storageTree.value = parsedTree;
      }
    }
    const rawExpanded = localStorage.getItem(STORAGE_EXPANDED_STORAGE_KEY);
    const parsedExpanded = rawExpanded ? JSON.parse(rawExpanded) : null;
    if (parsedExpanded && typeof parsedExpanded === "object") {
      storageFolderExpandedMap.value = parsedExpanded;
    }
    const selectedId = String(localStorage.getItem(STORAGE_SELECTED_STORAGE_KEY) || "").trim();
    if (selectedId) {
      selectedStorageNodeId.value = selectedId;
    }
    const rawStorageSortMode = String(localStorage.getItem(STORAGE_SORT_MODE_STORAGE_KEY) || "").trim();
    storageSortMode.value = normalizeStorageSortMode(rawStorageSortMode);
    pendingEditorTabsRestoreSnapshot = String(
      localStorage.getItem(EDITOR_TABS_STORAGE_KEY) || localStorage.getItem(LEGACY_EDITOR_TABS_STORAGE_KEY) || ""
    );
    bootstrappingEditorTabs = Boolean(pendingEditorTabsRestoreSnapshot);
  } catch {
    gestureNavigationEnabled.value = false;
    collapseHeaderInView.value = false;
    collapseStepsSidebarInView.value = false;
    appLanguage.value = "zh-CN";
    storageTree.value = null;
    storageFolderExpandedMap.value = { [STORAGE_ROOT_ID]: true };
    selectedStorageNodeId.value = STORAGE_ROOT_ID;
    storageSortMode.value = STORAGE_SORT_DEFAULT_MODE;
    activeThemeId.value = DEFAULT_THEME_ID;
    importedThemes.value = [];
    pendingEditorTabsRestoreSnapshot = "";
    bootstrappingEditorTabs = false;
  }
}

applyThemePreference();

watch([themeAccentEnabled, themeAccentRed, themeAccentGreen, themeAccentBlue, themeAccentSaturation], () => {
  const nextRed = clampByte(themeAccentRed.value, 155);
  const nextGreen = clampByte(themeAccentGreen.value, 109);
  const nextBlue = clampByte(themeAccentBlue.value, 72);
  const nextSaturation = clamp(Number(themeAccentSaturation.value) || 100, 65, 145);
  if (themeAccentRed.value !== nextRed) {
    themeAccentRed.value = nextRed;
  }
  if (themeAccentGreen.value !== nextGreen) {
    themeAccentGreen.value = nextGreen;
  }
  if (themeAccentBlue.value !== nextBlue) {
    themeAccentBlue.value = nextBlue;
  }
  if (themeAccentSaturation.value !== nextSaturation) {
    themeAccentSaturation.value = nextSaturation;
  }
  persistThemeAccentThemePrefs();
});

const makeStorageNodeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultStorageTree = () => ({
  id: STORAGE_ROOT_ID,
  type: "folder",
  name: "Local Storage",
  relPath: "",
  absPath: "",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  children: [
    {
      id: makeStorageNodeId("file"),
      type: "file",
      name: "未命名.md",
      relPath: "未命名.md",
      absPath: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      children: []
    }
  ]
});

const cloneStorageTree = (source) => JSON.parse(JSON.stringify(source));

const normalizeStorageNode = (source, fallbackId, fallbackName) => {
  const raw = source && typeof source === "object" ? source : {};
  const type = raw.type === "file" ? "file" : "folder";
  const id = String(raw.id || fallbackId || makeStorageNodeId(type));
  const relPath = String(raw.relPath || "");
  const absPath = String(raw.absPath || "");
  const createdAt = Number(raw.createdAt || 0);
  const updatedAt = Number(raw.updatedAt || 0);
  const name = String(raw.name || fallbackName || (type === "folder" ? "新建文件夹" : "未命名.md")).trim()
    || (type === "folder" ? "新建文件夹" : "未命名.md");
  if (type === "file") {
    return { id, type, name, relPath, absPath, createdAt, updatedAt, children: [] };
  }
  const children = Array.isArray(raw.children)
    ? raw.children.map((item, index) => normalizeStorageNode(item, `${id}-${index}`, "未命名"))
    : [];
  return { id, type, name, relPath, absPath, createdAt, updatedAt, children };
};

const ensureStorageTree = (source) => {
  const fallback = createDefaultStorageTree();
  if (!source || typeof source !== "object") {
    return fallback;
  }
  const root = normalizeStorageNode(source, STORAGE_ROOT_ID, "Local Storage");
  root.id = STORAGE_ROOT_ID;
  root.type = "folder";
  root.name = root.name || "Local Storage";
  root.relPath = "";
  root.children = Array.isArray(root.children) ? root.children : [];
  if (!root.children.length) {
    root.children.push({
      id: makeStorageNodeId("file"),
      type: "file",
      name: "未命名.md",
      relPath: "未命名.md",
      absPath: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      children: []
    });
  }
  return root;
};

storageTree.value = ensureStorageTree(storageTree.value);
if (isDesktopStorage) {
  storageTree.value = {
    id: STORAGE_ROOT_ID,
    type: "folder",
    name: "存储根目录",
    relPath: "",
    absPath: "",
    createdAt: 0,
    updatedAt: 0,
    children: []
  };
}

const normalizeDesktopStorageNode = (source, isRoot = false) => {
  const raw = source && typeof source === "object" ? source : {};
  const type = raw.type === "file" ? "file" : "folder";
  const relPath = String(raw.relPath || "");
  const absPath = String(raw.absPath || "");
  const size = Number(raw.size || 0);
  const createdAt = Number(raw.createdAt || 0);
  const updatedAt = Number(raw.updatedAt || 0);
  const id = isRoot ? STORAGE_ROOT_ID : (relPath || makeStorageNodeId(type));
  const name = String(raw.name || (isRoot ? "存储根目录" : (type === "folder" ? "新建文件夹" : "未命名.md")));
  const children = Array.isArray(raw.children)
    ? raw.children.map((item) => normalizeDesktopStorageNode(item, false))
    : [];
  return {
    id,
    type,
    name,
    relPath,
    absPath,
    size,
    createdAt,
    updatedAt,
    children
  };
};

// 恢复之前保存的标签页
const restoreEditorTabs = async (savedTabsJsonInput = "") => {
  const savedTabsJson = String(
    savedTabsJsonInput
    || pendingEditorTabsRestoreSnapshot
    || localStorage.getItem(EDITOR_TABS_STORAGE_KEY)
    || localStorage.getItem(LEGACY_EDITOR_TABS_STORAGE_KEY)
    || ""
  );

  try {
    if (!isDesktopStorage || !savedTabsJson) {
      return;
    }
    let loadedPayload = null;
    try {
      loadedPayload = JSON.parse(savedTabsJson);
    } catch {
      // ignore
    }
    const loadedTabs = Array.isArray(loadedPayload)
      ? loadedPayload
      : (Array.isArray(loadedPayload?.tabs) ? loadedPayload.tabs : []);
    const preferredActiveTabId = String(
      Array.isArray(loadedPayload)
        ? ""
        : (loadedPayload?.activeTabId || "")
    ).trim();
    const preferredActiveRelPath = normalizeRelPath(
      Array.isArray(loadedPayload)
        ? ""
        : String(loadedPayload?.activeTabRelPath || "")
    );
    if (!Array.isArray(loadedTabs) || !loadedTabs.length) {
      return;
    }
    const tabsToRestore = ensureEditorTabs(
      loadedTabs.filter((tabItem) => {
        if (tabItem?.kind === "graph" || tabItem?.id === EDITOR_GRAPH_TAB_ID) {
          return true;
        }
        const relPath = normalizeRelPath(tabItem?.relPath);
        return relPath && findStorageNodeByRelPath(storageTree.value, relPath)?.node;
      })
    );
    if (!tabsToRestore.length) {
      return;
    }

    const isPreferredTab = (tabItem) =>
      (preferredActiveTabId && tabItem?.id === preferredActiveTabId)
      || (
        preferredActiveRelPath
        && tabItem?.kind === "file"
        && normalizeRelPath(tabItem?.relPath) === preferredActiveRelPath
      );

    const prioritizedTabs = (preferredActiveTabId || preferredActiveRelPath)
      ? [
          ...tabsToRestore.filter((tabItem) => !isPreferredTab(tabItem)),
          ...tabsToRestore.filter((tabItem) => isPreferredTab(tabItem))
        ]
      : tabsToRestore;

    restoringEditorTabs = true;
    editorTabs.value = [];
    activeEditorTabId.value = "";
    try {
      for (let i = 0; i < prioritizedTabs.length; i++) {
        const tabItem = prioritizedTabs[i];
        if (tabItem?.kind === "graph") {
          ensureWorkspaceGraphTab();
          continue;
        }
        const relPath = normalizeRelPath(tabItem?.relPath);
        if (!relPath) {
          continue;
        }
        if (!findStorageNodeByRelPath(storageTree.value, relPath)?.node) {
          continue;
        }
        await openEditorFileTabByRelPath(relPath, {
          showMissingToast: false
        });
      }

      if (preferredActiveTabId === EDITOR_GRAPH_TAB_ID && editorTabs.value.some((tab) => tab.id === EDITOR_GRAPH_TAB_ID)) {
        activeEditorTabId.value = EDITOR_GRAPH_TAB_ID;
      } else if (preferredActiveRelPath && findStorageNodeByRelPath(storageTree.value, preferredActiveRelPath)?.node) {
        const desiredTabId = createEditorFileTabId(preferredActiveRelPath);
        if (editorTabs.value.some((tab) => tab.id === desiredTabId)) {
          activeEditorTabId.value = desiredTabId;
        }
      } else if (preferredActiveTabId && editorTabs.value.some((tab) => tab.id === preferredActiveTabId)) {
        activeEditorTabId.value = preferredActiveTabId;
      } else if (!activeEditorTabId.value) {
        activeEditorTabId.value = editorTabs.value[editorTabs.value.length - 1]?.id || "";
      }
    } finally {
      restoringEditorTabs = false;
    }
  } finally {
    pendingEditorTabsRestoreSnapshot = "";
    bootstrappingEditorTabs = false;
    persistStorageState();
  }
};

const buildEditorTabsStoragePayload = () => {
  const tabs = editorTabs.value.map((tab) => (
    tab.kind === "graph"
      ? { kind: "graph", id: tab.id }
      : { kind: "file", relPath: tab.relPath, id: tab.id }
  ));
  const activeTab = editorTabs.value.find((tab) => tab.id === activeEditorTabId.value) || null;
  return {
    tabs,
    activeTabId: String(activeEditorTabId.value || ""),
    activeTabRelPath: String(activeTab?.kind === "file" ? activeTab?.relPath || "" : "")
  };
};

const loadDesktopStorageTree = async ({ preferredNodeId = "", preferredMarkdownRelPath = "" } = {}) => {
  if (!isDesktopStorage) {
    return;
  }
  storageLoading.value = true;
  try {
    const rootResult = await desktopDataBridge.getWorkspaceRoot();
    if (rootResult?.ok && rootResult.rootPath) {
      storageRootPath.value = String(rootResult.rootPath);
    }

    const treeResult = await desktopDataBridge.readWorkspaceTree();
    if (!(treeResult?.ok && treeResult.tree)) {
      throw new Error(String(treeResult?.error || "read_tree_failed"));
    }

    storageTree.value = normalizeDesktopStorageNode(treeResult.tree, true);
    pruneMissingEditorTabs();
    if (treeResult.rootPath) {
      storageRootPath.value = String(treeResult.rootPath);
    }
    const preferredId = String(preferredNodeId || "").trim();
    if (preferredId && findStorageNodeInTree(storageTree.value, preferredId)) {
      selectedStorageNodeId.value = preferredId;
    } else {
      ensureSelectedStorageNodeValid();
    }
    const preferredMarkdownPath = String(preferredMarkdownRelPath || "").trim();

    const preferredMarkdownMatch = preferredMarkdownPath
      ? findStorageNodeByRelPath(storageTree.value, preferredMarkdownPath)
      : null;
    if (preferredMarkdownMatch?.node && canAutoLoadMarkdownNode(preferredMarkdownMatch.node)) {
      expandStorageAncestors(preferredMarkdownMatch.parentIds);
      selectedStorageNodeId.value = String(preferredMarkdownMatch.node.id || selectedStorageNodeId.value);
    }
    const selected = findStorageNodeInTree(storageTree.value, selectedStorageNodeId.value);
    if (
      preferredMarkdownPath
      && canAutoLoadMarkdownNode(selected?.node)
      && String(selected?.node?.relPath || "") === preferredMarkdownPath
    ) {
      await loadMarkdownFileInEditor(preferredMarkdownPath, { showSuccessToast: false });
    } else if (canAutoLoadMarkdownNode(selected?.node)) {
      await loadMarkdownFileInEditor(String(selected.node.relPath || ""), { showSuccessToast: false });
    } else {
      const shouldAutoPickFirstMarkdown = !selected?.node || selected.node.id === STORAGE_ROOT_ID;
      const firstMarkdown = shouldAutoPickFirstMarkdown ? findFirstMarkdownNode(storageTree.value) : null;
      if (firstMarkdown?.relPath) {
        selectedStorageNodeId.value = String(firstMarkdown.id || selectedStorageNodeId.value);
        await loadMarkdownFileInEditor(String(firstMarkdown.relPath), { showSuccessToast: false });
        return;
      }
      if (selected?.node?.type === "file" && isImageFileName(selected.node.name)) {
        activeEditorTabId.value = ensureEditorFileTab(String(selected.node.relPath || ""));
        return;
      }
      if (selected?.node?.type === "file" && isMarkdownFileName(selected.node.name)) {
        showToast(`已跳过超大 Markdown: ${selected.node.name} (${formatBytes(selected.node.size)})`);
      }
      resetBlankEditorState();
    }
  } catch (error) {
    showToast(`读取存储目录失败: ${String(error?.message || error || "unknown_error")}`);
    resetBlankEditorState();
    storageTree.value = ensureStorageTree(storageTree.value);
    pruneMissingEditorTabs();
  } finally {
    storageLoading.value = false;
  }
};

const refreshDesktopStorageTreeSnapshot = async ({ preferredNodeId = "" } = {}) => {
  if (!isDesktopStorage) {
    return false;
  }

  const rootResult = await desktopDataBridge.getWorkspaceRoot();
  if (rootResult?.ok && rootResult.rootPath) {
    storageRootPath.value = String(rootResult.rootPath);
  }

  const treeResult = await desktopDataBridge.readWorkspaceTree();
  if (!(treeResult?.ok && treeResult.tree)) {
    throw new Error(String(treeResult?.error || "read_tree_failed"));
  }

  storageTree.value = normalizeDesktopStorageNode(treeResult.tree, true);
  if (treeResult.rootPath) {
    storageRootPath.value = String(treeResult.rootPath);
  }

  const preferredId = String(preferredNodeId || "").trim();
  if (preferredId && findStorageNodeInTree(storageTree.value, preferredId)) {
    selectedStorageNodeId.value = preferredId;
  } else {
    ensureSelectedStorageNodeValid();
  }

  return true;
};

const findStorageNodeInTree = (node, targetId, parentId = "") => {
  if (!node || !targetId) {
    return null;
  }
  if (node.id === targetId) {
    return { node, parentId };
  }
  if (node.type !== "folder" || !Array.isArray(node.children)) {
    return null;
  }
  for (const child of node.children) {
    const found = findStorageNodeInTree(child, targetId, node.id);
    if (found) {
      return found;
    }
  }
  return null;
};

const isRelPathAffectedByNode = (fileRelPath, nodeRelPath, nodeType) => {
  const filePath = String(fileRelPath || "").trim();
  const targetPath = String(nodeRelPath || "").trim();
  if (!filePath || !targetPath) {
    return false;
  }
  if (nodeType === "folder") {
    return filePath === targetPath || filePath.startsWith(`${targetPath}/`);
  }
  return filePath === targetPath;
};

const joinStorageRelPath = (parentRelPath, name) =>
  parentRelPath ? `${parentRelPath}/${name}` : name;

const rebuildLocalStorageRelPaths = (node, parentRelPath = "") => {
  if (!node || typeof node !== "object") {
    return;
  }
  node.relPath = node.id === STORAGE_ROOT_ID ? "" : joinStorageRelPath(parentRelPath, String(node.name || ""));
  if (node.type !== "folder" || !Array.isArray(node.children)) {
    return;
  }
  for (const child of node.children) {
    rebuildLocalStorageRelPaths(child, node.relPath);
  }
};

const canAutoLoadMarkdownNode = (node) =>
  Boolean(
    node
    && node.type === "file"
    && isMarkdownFileName(node.name)
    && !isMarkdownFileTooLarge(node.size)
  );

const findFirstMarkdownNode = (node) => {
  if (!node) {
    return null;
  }
  if (canAutoLoadMarkdownNode(node)) {
    return node;
  }
  if (node.type !== "folder" || !Array.isArray(node.children)) {
    return null;
  }
  for (const child of node.children) {
    const found = findFirstMarkdownNode(child);
    if (found) {
      return found;
    }
  }
  return null;
};

const compareStorageNodeNames = (a, b) =>
  String(a?.name || "").localeCompare(String(b?.name || ""), "zh-CN");

const getStorageNodeSortTime = (node, field) => {
  const value = Number(node?.[field] || 0);
  return Number.isFinite(value) ? value : 0;
};

const compareStorageNodes = (a, b) => {
  if (a.type !== b.type) {
    return a.type === "folder" ? -1 : 1;
  }
  const mode = normalizeStorageSortMode(storageSortMode.value);
  if (mode === "name-desc") {
    return -1 * compareStorageNodeNames(a, b);
  }
  if (mode === "updated-desc" || mode === "updated-asc") {
    const direction = mode === "updated-desc" ? -1 : 1;
    const delta = getStorageNodeSortTime(a, "updatedAt") - getStorageNodeSortTime(b, "updatedAt");
    if (delta !== 0) {
      return direction * delta;
    }
    return compareStorageNodeNames(a, b);
  }
  if (mode === "created-desc" || mode === "created-asc") {
    const direction = mode === "created-desc" ? -1 : 1;
    const delta = getStorageNodeSortTime(a, "createdAt") - getStorageNodeSortTime(b, "createdAt");
    if (delta !== 0) {
      return direction * delta;
    }
    return compareStorageNodeNames(a, b);
  }
  return compareStorageNodeNames(a, b);
};

const fileSidebarPanelWidth = computed(() => {
  if (isFileSidebarHidden.value) {
    return 0;
  }
  if (isFileSidebarCollapsed.value) {
    return FILE_SIDEBAR_COLLAPSED_WIDTH;
  }
  return fileSidebarWidth.value;
});

const chromeLeadingWidth = computed(() => (
  Math.max(
    Number(fileSidebarPanelWidth.value || 0),
    116
  )
));

const showChromeStatsChip = computed(() => true);

const chromeLeadingStyle = computed(() => ({
  width: `${chromeLeadingWidth.value}px`
}));

const showInspectorSidebar = computed(() => isEditMode.value || !collapseStepsSidebarInView.value);
const isInspectorSidebarCollapsed = computed(() => isEditMode.value && isSidebarCollapsed.value);
const isInspectorSidebarHidden = computed(() => isEditMode.value && isSidebarHidden.value);

const sidebarPanelWidth = computed(() => {
  if (isSidebarHidden.value) {
    return 0;
  }
  if (isSidebarCollapsed.value) {
    return SIDEBAR_COLLAPSED_WIDTH;
  }
  return sidebarWidth.value;
});

const inspectorSidebarPanelWidth = computed(() => {
  if (!showInspectorSidebar.value) {
    return 0;
  }
  if (!isEditMode.value) {
    return clamp(sidebarWidth.value, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
  }
  return sidebarPanelWidth.value;
});

const viewHeaderStyle = computed(() => {
  if (!collapseHeaderInView.value) {
    return { overflow: "visible" };
  }
  return {
    height: "0px",
    minHeight: "0px",
    paddingTop: "0px",
    paddingBottom: "0px",
    borderBottomWidth: "0px",
    overflow: "hidden"
  };
});

const storageLocationText = computed(() => {
  if (isDesktopStorage) {
    return storageRootPath.value || "正在读取真实目录...";
  }
  return "浏览器本地存储";
});

const storageStats = computed(() => {
  if (storageLoading.value) {
    return "加载中...";
  }
  let folderCount = 0;
  let fileCount = 0;
  const walk = (node) => {
    if (!node) {
      return;
    }
    if (node.type === "folder") {
      folderCount += 1;
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child);
        }
      }
      return;
    }
    fileCount += 1;
  };
  walk(storageTree.value);
  return `${Math.max(0, folderCount - 1)} 文件夹 / ${fileCount} 文件`;
});

const storageSortLabel = computed(() => {
  const options = STORAGE_SORT_OPTIONS.value;
  const optionMap = Object.fromEntries(options.map((option) => [option.value, option]));
  return optionMap[normalizeStorageSortMode(storageSortMode.value)]?.label
    || optionMap[STORAGE_SORT_DEFAULT_MODE].label;
});

const storageSortIconName = computed(() =>
  normalizeStorageSortMode(storageSortMode.value).endsWith("-desc") ? "sort-desc" : "sort-asc"
);

const storageSortTooltip = computed(() => localeText("排序：", "Sort: ") + storageSortLabel.value);

const workspaceDisplayName = computed(() => {
  if (isDesktopStorage) {
    const trimmedPath = String(storageRootPath.value || "").replace(/[\\/]+$/, "");
    const segments = trimmedPath.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] || "Workspace";
  }
  return String(storageTree.value?.name || "Local Storage");
});

const isStorageFolderExpanded = (id) => storageFolderExpandedMap.value[id] !== false;

const normalizedStorageSearchQuery = computed(() => (
  String(storageSearchQuery.value || "").trim().toLowerCase()
));

const STORAGE_SEARCH_MATCH_BATCH = 6;

watch(normalizedStorageSearchQuery, () => {
  expandedStorageSearchMatchLimitMap.value = {};
});

const escapeSearchSnippetHtml = (value = "") => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const compactSearchSnippetText = (value = "", { trimStart = false, trimEnd = false } = {}) => {
  let text = String(value || "").replace(/\s+/g, " ");
  if (trimStart) {
    text = text.replace(/^\s+/g, "");
  }
  if (trimEnd) {
    text = text.replace(/\s+$/g, "");
  }
  return text;
};

const buildSearchSnippets = (textInput = "", queryInput = "", limit = STORAGE_SEARCH_MATCH_BATCH) => {
  const query = String(queryInput || "").trim().toLowerCase();
  const text = String(textInput || "");
  if (!query || !text) {
    return {
      matches: [],
      total: 0
    };
  }

  const normalizedText = text.toLowerCase();
  const snippets = [];
  let total = 0;
  let cursor = 0;

  while (cursor < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(query, cursor);
    if (matchIndex < 0) {
      break;
    }
    total += 1;
    if (snippets.length < limit) {
      const before = 20;
      const after = 28;
      const start = Math.max(0, matchIndex - before);
      const end = Math.min(text.length, matchIndex + query.length + after);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < text.length ? "..." : "";
      const rawBefore = compactSearchSnippetText(text.slice(start, matchIndex), { trimStart: true });
      const rawMatch = compactSearchSnippetText(text.slice(matchIndex, matchIndex + query.length));
      const rawAfter = compactSearchSnippetText(text.slice(matchIndex + query.length, end), { trimEnd: true });
      snippets.push({
        rawPos: matchIndex,
        html: `${prefix}${escapeSearchSnippetHtml(rawBefore)}<mark class="file-tree-search-highlight">${escapeSearchSnippetHtml(rawMatch)}</mark>${escapeSearchSnippetHtml(rawAfter)}${suffix}`
      });
    }
    cursor = matchIndex + Math.max(1, query.length);
  }

  return {
    matches: snippets,
    total
  };
};

const storageSearchMatchDisplayLimit = (nodeIdInput = "") => {
  const nodeId = String(nodeIdInput || "");
  const explicit = Number(expandedStorageSearchMatchLimitMap.value?.[nodeId] || 0);
  return explicit > 0 ? explicit : STORAGE_SEARCH_MATCH_BATCH;
};

const expandStorageSearchMatches = (nodeIdInput = "") => {
  const nodeId = String(nodeIdInput || "");
  if (!nodeId) {
    return;
  }
  expandedStorageSearchMatchLimitMap.value = {
    ...expandedStorageSearchMatchLimitMap.value,
    [nodeId]: storageSearchMatchDisplayLimit(nodeId) + STORAGE_SEARCH_MATCH_BATCH
  };
};

const collapseStorageSearchMatches = (nodeIdInput = "") => {
  const nodeId = String(nodeIdInput || "");
  if (!nodeId) {
    return;
  }
  const nextMap = { ...expandedStorageSearchMatchLimitMap.value };
  delete nextMap[nodeId];
  expandedStorageSearchMatchLimitMap.value = nextMap;
};

const buildStorageSearchMeta = (node, query = "") => {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery || !node || node.type !== "file") {
    return {
      searchMatches: [],
      searchMatchCount: 0,
      searchOverflowCount: 0
    };
  }

  const relPath = normalizeRelPath(node.relPath || "");
  const markdown = isMarkdownFileName(String(node.name || relPath))
    ? (relPath === normalizeRelPath(activeMarkdownRelPath.value)
      ? String(documentMarkdown.value || "")
      : String(wikiLinkIndexState.value?.contentsByPath?.[relPath] || ""))
    : "";
  const plainText = markdown.replace(/\r\n/g, "\n");
  const snippetResult = buildSearchSnippets(
    plainText,
    normalizedQuery,
    storageSearchMatchDisplayLimit(node.id)
  );

  return {
    searchMatches: snippetResult.matches,
    searchMatchCount: snippetResult.total,
    searchOverflowCount: Math.max(0, snippetResult.total - snippetResult.matches.length)
  };
};

const buildVisibleStorageNodeEntry = (node, depth, guideDepths = [], query = "") => ({
  id: node.id,
  type: node.type,
  name: node.name,
  relPath: node.relPath || "",
  depth,
  guideDepths,
  ...buildStorageSearchMeta(node, query)
});

const buildExpandedStorageEntries = (node, depth, guideDepths = [], query = "") => {
  if (!node) {
    return [];
  }
  const entries = [buildVisibleStorageNodeEntry(node, depth, guideDepths, query)];
  if (node.type !== "folder") {
    return entries;
  }
  const ordered = [...(Array.isArray(node.children) ? node.children : [])].sort(compareStorageNodes);
  for (const child of ordered) {
    entries.push(...buildExpandedStorageEntries(child, depth + 1, [...guideDepths, depth], query));
  }
  return entries;
};

const storageNodeMatchesSearch = (node, query = "") => {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery || !node) {
    return true;
  }
  const relPath = normalizeRelPath(node.relPath || "");
  const chunks = [node.name, relPath];
  if (node.type === "file" && isMarkdownFileName(String(node.name || relPath))) {
    const note = wikiLinkIndexState.value?.notesByPath?.[relPath];
    const noteHeadings = Array.isArray(note?.headings)
      ? note.headings.map((heading) => String(heading?.text || heading?.title || "")).join("\n")
      : "";
    const markdown = relPath === normalizeRelPath(activeMarkdownRelPath.value)
      ? String(documentMarkdown.value || "")
      : String(wikiLinkIndexState.value?.contentsByPath?.[relPath] || "");
    chunks.push(noteHeadings, markdown);
  }
  return chunks.join("\n").toLowerCase().includes(normalizedQuery);
};

const buildFilteredStorageEntries = (node, depth, guideDepths = [], query = "") => {
  if (!node) {
    return [];
  }
  if (storageNodeMatchesSearch(node, query)) {
    return buildExpandedStorageEntries(node, depth, guideDepths, query);
  }
  if (node.type !== "folder") {
    return [];
  }
  const childEntries = [];
  const ordered = [...(Array.isArray(node.children) ? node.children : [])].sort(compareStorageNodes);
  for (const child of ordered) {
    childEntries.push(...buildFilteredStorageEntries(child, depth + 1, [...guideDepths, depth], query));
  }
  if (!childEntries.length) {
    return [];
  }
  return [buildVisibleStorageNodeEntry(node, depth, guideDepths, query), ...childEntries];
};

const visibleStorageNodes = computed(() => {
  const query = normalizedStorageSearchQuery.value;
  if (query) {
    const rootChildren = Array.isArray(storageTree.value?.children) ? storageTree.value.children : [];
    const orderedRoots = [...rootChildren].sort(compareStorageNodes);
    return orderedRoots.flatMap((child) => buildFilteredStorageEntries(child, 0, [], query));
  }

  const list = [];
  const walk = (node, depth, guideDepths = []) => {
    if (!node) {
      return;
    }
    list.push(buildVisibleStorageNodeEntry(node, depth, guideDepths));
    if (node.type !== "folder" || !isStorageFolderExpanded(node.id)) {
      return;
    }
    const ordered = [...(Array.isArray(node.children) ? node.children : [])].sort(compareStorageNodes);
    for (const child of ordered) {
      walk(child, depth + 1, [...guideDepths, depth]);
    }
  };
  const rootChildren = Array.isArray(storageTree.value?.children) ? storageTree.value.children : [];
  const orderedRoots = [...rootChildren].sort(compareStorageNodes);
  for (const child of orderedRoots) {
    walk(child, 0, []);
  }
  return list;
});

const collectStorageFolderIds = (node, output = []) => {
  if (!node || node.type !== "folder") {
    return output;
  }
  output.push(String(node.id || ""));
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectStorageFolderIds(child, output);
  }
  return output;
};

const storageFolderIds = computed(() => (
  collectStorageFolderIds(storageTree.value, []).filter((id) => id && id !== STORAGE_ROOT_ID)
));

const hasStorageFolders = computed(() => storageFolderIds.value.length > 0);

const allStorageFoldersExpanded = computed(() => {
  const folderIds = storageFolderIds.value;
  return folderIds.length > 0
    && folderIds.every((id) => storageFolderExpandedMap.value[id] !== false);
});

const toggleAllStorageFolders = () => {
  const folderIds = storageFolderIds.value;
  if (!folderIds.length) {
    return;
  }
  if (allStorageFoldersExpanded.value) {
    storageFolderExpandedMap.value = Object.fromEntries(
      [STORAGE_ROOT_ID, ...folderIds].map((id) => [id, id === STORAGE_ROOT_ID])
    );
    return;
  }
  storageFolderExpandedMap.value = Object.fromEntries(
    [STORAGE_ROOT_ID, ...folderIds].map((id) => [id, true])
  );
};

const storageNodeIconName = (node) => {
  if (String(node?.type || "") === "folder") {
    return isStorageFolderExpanded(String(node?.id || ""))
      ? "folder-open"
      : "folder";
  }
  return isImageFileName(String(node?.name || node?.relPath || ""))
    ? "image"
    : "file";
};

const findStorageNodeByRelPath = (node, relPathInput, parentIds = []) => {
  const targetRelPath = normalizeRelPath(relPathInput);
  if (!node || !targetRelPath) {
    return null;
  }
  if (normalizeRelPath(node.relPath || "") === targetRelPath) {
    return {
      node,
      parentIds
    };
  }
  if (node.type !== "folder" || !Array.isArray(node.children)) {
    return null;
  }
  for (const child of node.children) {
    const found = findStorageNodeByRelPath(child, targetRelPath, [...parentIds, node.id]);
    if (found) {
      return found;
    }
  }
  return null;
};

const createEditorFileTabId = (relPathInput = "") => {
  const relPath = normalizeRelPath(relPathInput);
  return relPath ? `file:${relPath}` : "";
};

const dedupeEditorTabs = (tabs = []) => {
  const seen = new Set();
  return (Array.isArray(tabs) ? tabs : []).filter((tab) => {
    const id = String(tab?.id || "");
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

const buildEditorTab = (tabInput = {}) => {
  const kind = tabInput.kind === "graph" ? "graph" : "file";
  if (kind === "graph") {
    return {
      id: EDITOR_GRAPH_TAB_ID,
      kind: "graph"
    };
  }

  const relPath = normalizeRelPath(tabInput.relPath);
  return {
    id: createEditorFileTabId(relPath),
    kind: "file",
    relPath
  };
};

const ensureEditorTabs = (tabs = []) =>
  dedupeEditorTabs(
    (Array.isArray(tabs) ? tabs : [])
      .map((tab) => buildEditorTab(tab))
      .filter((tab) => (tab.kind === "graph" ? true : Boolean(tab.relPath)))
  );

const ensureEditorFileTab = (relPathInput = "") => {
  const relPath = normalizeRelPath(relPathInput);
  if (!relPath) {
    return "";
  }
  const tabId = createEditorFileTabId(relPath);
  if (!editorTabs.value.some((tab) => tab.id === tabId)) {
    editorTabs.value = ensureEditorTabs([
      ...editorTabs.value,
      { kind: "file", relPath }
    ]);
  }
  return tabId;
};

const ensureWorkspaceGraphTab = () => {
  if (!editorTabs.value.some((tab) => tab.id === EDITOR_GRAPH_TAB_ID)) {
    editorTabs.value = ensureEditorTabs([
      ...editorTabs.value,
      { kind: "graph" }
    ]);
  }
  return EDITOR_GRAPH_TAB_ID;
};

const resolveEditorTabDisplayKind = (tab) => {
  if (tab?.kind === "graph") {
    return "graph";
  }
  const relPath = normalizeRelPath(tab?.relPath);
  const matched = findStorageNodeByRelPath(storageTree.value, relPath);
  const fileName = String(matched?.node?.name || basenameOfRelPath(relPath));
  return isImageFileName(fileName) ? "image" : "file";
};

const resolveEditorTabLabel = (tab) => {
  if (tab?.kind === "graph") {
    return "Graph";
  }
  const relPath = normalizeRelPath(tab?.relPath);
  const matched = findStorageNodeByRelPath(storageTree.value, relPath);
  const baseName = String(
    matched?.node?.name
    || basenameOfRelPath(relPath)
    || relPath
    || "Untitled"
  );
  return stripMarkdownExtension(baseName) || "Untitled";
};

const editorTabsWithMeta = computed(() =>
  editorTabs.value.map((tab) => ({
    ...tab,
    displayKind: resolveEditorTabDisplayKind(tab),
    label: resolveEditorTabLabel(tab),
    title: tab.kind === "graph" ? "Graph" : String(tab.relPath || "")
  }))
);

const isWorkspaceGraphTabActive = computed(() => activeEditorTabId.value === EDITOR_GRAPH_TAB_ID);
const activeEditorTab = computed(() =>
  editorTabs.value.find((tab) => tab.id === activeEditorTabId.value) || null
);
const activeEditorFileRelPath = computed(() =>
  activeEditorTab.value?.kind === "file"
    ? normalizeRelPath(activeEditorTab.value.relPath)
    : ""
);
const activeImagePreviewMatch = computed(() => {
  const relPath = activeEditorFileRelPath.value;
  if (!relPath || !isImageFileName(basenameOfRelPath(relPath))) {
    return null;
  }
  return findStorageNodeByRelPath(storageTree.value, relPath);
});
const isImagePreviewTabActive = computed(() => Boolean(activeImagePreviewMatch.value?.node));
const activeImagePreviewNode = computed(() => activeImagePreviewMatch.value?.node || null);
const activeImagePreviewSrc = computed(() =>
  resolveWorkspaceAssetSrc(
    activeImagePreviewNode.value?.absPath || activeImagePreviewNode.value?.relPath || "",
    {
      currentRelPath: activeMarkdownRelPath.value,
      workspaceRootPath: storageRootPath.value
    }
  )
);

watch([mode, canUseSourceMode, canUsePresentMode], ([currentMode, sourceAllowed, presentAllowed]) => {
  if (currentMode === "source" && !sourceAllowed) {
    mode.value = "preview";
    return;
  }
  if (currentMode === "view" && !presentAllowed) {
    mode.value = "preview";
    void applyDesktopFullscreenForMode("preview");
  }
});

const pickNeighborFileTab = (tabs = [], preferredIndex = 0) => {
  const list = Array.isArray(tabs) ? tabs : [];
  if (!list.length) {
    return null;
  }
  const safeIndex = clamp(Number(preferredIndex) || 0, 0, Math.max(0, list.length - 1));
  for (let offset = 0; offset < list.length; offset += 1) {
    const right = list[safeIndex + offset];
    if (right?.kind === "file") {
      return right;
    }
    const left = list[safeIndex - offset];
    if (offset > 0 && left?.kind === "file") {
      return left;
    }
  }
  return list.find((tab) => tab?.kind === "file") || null;
};

const pruneMissingEditorTabs = () => {
  const nextTabs = ensureEditorTabs(
    editorTabs.value.filter((tab) =>
      tab.kind === "graph" || Boolean(findStorageNodeByRelPath(storageTree.value, tab.relPath))
    )
  );
  editorTabs.value = nextTabs;
  if (activeEditorTabId.value && !nextTabs.some((tab) => tab.id === activeEditorTabId.value)) {
    const currentRelPath = normalizeRelPath(activeMarkdownRelPath.value);
    if (currentRelPath && findStorageNodeByRelPath(storageTree.value, currentRelPath)?.node) {
      activeEditorTabId.value = ensureEditorFileTab(activeMarkdownRelPath.value);
      return;
    }
    activeEditorTabId.value = nextTabs[0]?.id || "";
  }
};

const dropEditorTabsForNode = (nodeRelPathInput = "", nodeType = "file") => {
  const nodeRelPath = normalizeRelPath(nodeRelPathInput);
  if (!nodeRelPath) {
    return;
  }
  editorTabs.value = ensureEditorTabs(
    editorTabs.value.filter((tab) =>
      tab.kind === "graph" || !isRelPathAffectedByNode(tab.relPath, nodeRelPath, nodeType)
    )
  );
};

const remapEditorTabsForNode = (previousRelPathInput = "", nextRelPathInput = "", nodeType = "file") => {
  const previousRelPath = normalizeRelPath(previousRelPathInput);
  const nextRelPath = normalizeRelPath(nextRelPathInput);
  if (!previousRelPath || !nextRelPath || previousRelPath === nextRelPath) {
    return;
  }

  const activeTab = editorTabs.value.find((tab) => tab.id === activeEditorTabId.value) || null;
  const nextTabs = editorTabs.value.map((tab) => {
    if (tab.kind !== "file" || !isRelPathAffectedByNode(tab.relPath, previousRelPath, nodeType)) {
      return tab;
    }
    const suffix = nodeType === "folder"
      ? String(tab.relPath || "").slice(previousRelPath.length).replace(/^\/+/, "")
      : "";
    const mappedRelPath = nodeType === "folder" && suffix ? `${nextRelPath}/${suffix}` : nextRelPath;
    return buildEditorTab({
      kind: "file",
      relPath: mappedRelPath
    });
  });

  editorTabs.value = ensureEditorTabs(nextTabs);

  if (activeTab?.kind === "file" && isRelPathAffectedByNode(activeTab.relPath, previousRelPath, nodeType)) {
    const suffix = nodeType === "folder"
      ? String(activeTab.relPath || "").slice(previousRelPath.length).replace(/^\/+/, "")
      : "";
    const mappedRelPath = nodeType === "folder" && suffix ? `${nextRelPath}/${suffix}` : nextRelPath;
    activeEditorTabId.value = createEditorFileTabId(mappedRelPath);
  }
};

const mapRelPathThroughNodeChange = (fileRelPathInput = "", previousRelPathInput = "", nextRelPathInput = "", nodeType = "file") => {
  const fileRelPath = normalizeRelPath(fileRelPathInput);
  const previousRelPath = normalizeRelPath(previousRelPathInput);
  const nextRelPath = normalizeRelPath(nextRelPathInput);
  if (!fileRelPath || !previousRelPath || !nextRelPath || !isRelPathAffectedByNode(fileRelPath, previousRelPath, nodeType)) {
    return fileRelPath;
  }
  if (nodeType !== "folder") {
    return nextRelPath;
  }
  const suffix = fileRelPath.slice(previousRelPath.length).replace(/^\/+/, "");
  return suffix ? `${nextRelPath}/${suffix}` : nextRelPath;
};

const loadMarkdownFileInEditor = async (relPathInput, { showSuccessToast = false } = {}) => {
  const relPath = normalizeRelPath(relPathInput);
  if (!relPath) {
    return false;
  }
  const loaded = await loadStepsFromMarkdownFile(relPath, showSuccessToast);
  if (!loaded) {
    return false;
  }
  activeEditorTabId.value = ensureEditorFileTab(relPath);
  return true;
};

const switchEditorTab = async (tabIdInput = "") => {
  const tabId = String(tabIdInput || "").trim();
  const targetTab = editorTabs.value.find((tab) => tab.id === tabId);
  if (!targetTab) {
    return;
  }
  if (targetTab.kind === "graph") {
    activeEditorTabId.value = ensureWorkspaceGraphTab();
    scheduleWikiLinkIndexRebuild();
    persistStorageState();
    return;
  }
  await openEditorFileTabByRelPath(targetTab.relPath, {
    showMissingToast: false
  });
  persistStorageState();
};

const closeEditorTab = async (tabIdInput = "") => {
  const tabId = String(tabIdInput || "").trim();
  const index = editorTabs.value.findIndex((tab) => tab.id === tabId);
  if (index < 0) {
    return;
  }

  const tab = editorTabs.value[index];
  const remainingTabs = ensureEditorTabs(editorTabs.value.filter((item) => item.id !== tabId));
  const graphWasActive = isWorkspaceGraphTabActive.value;
  const closedLoadedFile = tab.kind === "file"
    && normalizeRelPath(tab.relPath) === normalizeRelPath(activeMarkdownRelPath.value);

  editorTabs.value = remainingTabs;

  if (tab.kind === "graph") {
    if (activeEditorTabId.value === tabId) {
      const currentRelPath = normalizeRelPath(activeMarkdownRelPath.value);
      if (currentRelPath) {
        activeEditorTabId.value = ensureEditorFileTab(currentRelPath);
      } else if (remainingTabs[0]?.relPath) {
        await openEditorFileTabByRelPath(remainingTabs[0].relPath, {
          showMissingToast: false
        });
      } else {
        activeEditorTabId.value = remainingTabs[0]?.id || "";
      }
    }
    return;
  }

  if (!closedLoadedFile) {
    if (activeEditorTabId.value === tabId) {
      const nextFileTab = pickNeighborFileTab(remainingTabs, index);
      if (nextFileTab?.relPath) {
        await openEditorFileTabByRelPath(nextFileTab.relPath, {
          showMissingToast: false
        });
      } else {
        activeEditorTabId.value = remainingTabs.find((item) => item.kind === "graph")?.id || "";
      }
    }
    return;
  }

  const nextFileTab = pickNeighborFileTab(remainingTabs, index);
  if (nextFileTab?.relPath) {
    await openEditorFileTabByRelPath(nextFileTab.relPath, {
      showMissingToast: false
    });
    if (graphWasActive && remainingTabs.some((item) => item.kind === "graph")) {
      activeEditorTabId.value = EDITOR_GRAPH_TAB_ID;
    }
    return;
  }

  await persistActiveMarkdownBeforeSwitch();
  resetBlankEditorState();
  activeEditorTabId.value = graphWasActive && remainingTabs.some((item) => item.kind === "graph")
    ? EDITOR_GRAPH_TAB_ID
    : "";
};

const createWikiLinkFileByRelPath = async (relPathInput = "") => {
  const normalizedRelPath = normalizeRelPath(ensureMarkdownExtension(relPathInput));
  if (!normalizedRelPath) {
    showToast("创建文件失败");
    return false;
  }

  const existing = findStorageNodeByRelPath(storageTree.value, normalizedRelPath);
  if (existing?.node) {
    return true;
  }

  const parentRelPath = dirnameOfRelPath(normalizedRelPath);
  const fileName = basenameOfRelPath(normalizedRelPath);
  if (!fileName) {
    showToast("创建文件失败");
    return false;
  }

  if (isDesktopStorage) {
    try {
      const result = await desktopDataBridge.createWorkspaceFile({
        parentRelPath,
        name: fileName
      });
      if (!result?.ok) {
        throw new Error(String(result?.error || "create_file_failed"));
      }
      await refreshDesktopStorageTreeSnapshot({
        preferredNodeId: String(selectedStorageNodeId.value || "")
      });
    } catch (error) {
      showToast(`创建文件失败: ${String(error?.message || error || "unknown_error")}`);
      return false;
    }
  } else {
    const parentMatch = parentRelPath
      ? findStorageNodeByRelPath(storageTree.value, parentRelPath)
      : { node: storageTree.value, parentIds: [] };
    if (!parentMatch?.node || parentMatch.node.type !== "folder") {
      showToast(`创建文件失败: 找不到目录 ${parentRelPath || "/"}`);
      return false;
    }

    const fileNode = {
      id: normalizedRelPath,
      type: "file",
      name: fileName,
      relPath: normalizedRelPath,
      absPath: "",
      size: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      children: []
    };
    if (!createStorageNodeAt(String(parentMatch.node.id || STORAGE_ROOT_ID), fileNode)) {
      showToast("创建文件失败");
      return false;
    }
    storageFolderExpandedMap.value = {
      ...storageFolderExpandedMap.value,
      [String(parentMatch.node.id || STORAGE_ROOT_ID)]: true
    };
    persistStorageState();
  }

  const created = findStorageNodeByRelPath(storageTree.value, normalizedRelPath);
  if (created?.parentIds?.length) {
    expandStorageAncestors(created.parentIds);
  }
  showToast(`已创建文件: ${fileName}`);
  await nextTick();
  getActiveMarkdownEditorApi()?.refreshWikiLinks?.();
  return true;
};

const collectMarkdownNodesFromTree = (node, output = []) => {
  if (!node) {
    return output;
  }
  if (node.type === "file" && isMarkdownFileName(node.name)) {
    output.push({
      id: String(node.id || node.relPath || ""),
      name: String(node.name || basenameOfRelPath(node.relPath)),
      relPath: normalizeRelPath(node.relPath || ""),
      fileName: String(node.name || basenameOfRelPath(node.relPath)),
      size: Number(node.size || 0)
    });
    return output;
  }
  if (node.type !== "folder" || !Array.isArray(node.children)) {
    return output;
  }
  for (const child of node.children) {
    collectMarkdownNodesFromTree(child, output);
  }
  return output;
};

const workspaceMarkdownFiles = computed(() => collectMarkdownNodesFromTree(storageTree.value, []));
const workspaceGraphData = computed(() => {
  const contentsByPath = {
    ...(wikiLinkIndexState.value?.contentsByPath || {})
  };
  const activeRelPath = normalizeRelPath(activeMarkdownRelPath.value);
  if (activeRelPath) {
    contentsByPath[activeRelPath] = String(documentMarkdown.value || "");
  }

  return buildWorkspaceLinkGraph({
    files: workspaceMarkdownFiles.value,
    notesByPath: wikiLinkIndexState.value?.notesByPath || {},
    contentsByPath,
    forwardLinks: wikiLinkIndexState.value?.forwardLinks || {},
    backlinks: wikiLinkIndexState.value?.backlinks || {}
  });
});

const persistStorageState = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!isDesktopStorage) {
      localStorage.setItem(STORAGE_TREE_STORAGE_KEY, JSON.stringify(storageTree.value));
    }
    localStorage.setItem(STORAGE_EXPANDED_STORAGE_KEY, JSON.stringify(storageFolderExpandedMap.value));
    localStorage.setItem(STORAGE_SELECTED_STORAGE_KEY, selectedStorageNodeId.value);
    if (!bootstrappingEditorTabs) {
      // 保存标签页状态
      localStorage.setItem(EDITOR_TABS_STORAGE_KEY, JSON.stringify(buildEditorTabsStoragePayload()));
    }
  } catch {
    // ignore storage failure
  }
};

const handleWindowBeforeUnload = () => {
  persistStorageState();
};

const ensureSelectedStorageNodeValid = () => {
  const current = String(selectedStorageNodeId.value || "");
  if (findStorageNodeInTree(storageTree.value, current)) {
    return;
  }
  selectedStorageNodeId.value = STORAGE_ROOT_ID;
};

const imageAltTextForRelPath = (relPathInput = "") => {
  const fileName = basenameOfRelPath(relPathInput);
  return String(fileName || "image").replace(/\.[^.]+$/u, "") || "image";
};

const isImageTransferFile = (file) =>
  Boolean(file && (String(file.type || "").startsWith("image/") || isImageFileName(String(file.name || ""))));

const extractImageFilesFromDataTransfer = (dataTransfer) => {
  const directFiles = Array.from(dataTransfer?.files || []).filter((file) => isImageTransferFile(file));
  if (directFiles.length) {
    return directFiles;
  }
  return Array.from(dataTransfer?.items || [])
    .filter((item) => item?.kind === "file" && String(item.type || "").startsWith("image/"))
    .map((item) => item.getAsFile?.())
    .filter((file) => isImageTransferFile(file));
};

const hasImageFilesInDataTransfer = (dataTransfer) => {
  if (!dataTransfer) {
    return false;
  }
  if (extractImageFilesFromDataTransfer(dataTransfer).length > 0) {
    return true;
  }
  const transferTypes = Array.from(dataTransfer.types || []);
  if (transferTypes.includes("Files") && !Array.from(dataTransfer.items || []).length) {
    return true;
  }
  return Array.from(dataTransfer.items || []).some((item) =>
    item?.kind === "file" && String(item.type || "").startsWith("image/")
  );
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("invalid_file"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read_file_failed"));
    reader.readAsDataURL(file);
  });

const readFileAsBase64 = async (file) => {
  const dataUrl = await readFileAsDataUrl(file);
  const [, base64Content = ""] = String(dataUrl || "").split(",", 2);
  return base64Content;
};

const getStorageFolderNodeByRelPath = (parentRelPathInput = "") => {
  const parentRelPath = normalizeRelPath(parentRelPathInput);
  if (!parentRelPath) {
    return storageTree.value;
  }
  return findStorageNodeByRelPath(storageTree.value, parentRelPath)?.node || null;
};

const pickUniqueStorageChildName = (parentRelPathInput = "", requestedNameInput = "") => {
  const requestedName = String(requestedNameInput || "").trim() || "image.png";
  const parentNode = getStorageFolderNodeByRelPath(parentRelPathInput);
  if (!parentNode || parentNode.type !== "folder") {
    return requestedName;
  }
  const usedNames = new Set(
    (Array.isArray(parentNode.children) ? parentNode.children : [])
      .map((child) => String(child?.name || "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (!usedNames.has(requestedName.toLowerCase())) {
    return requestedName;
  }
  const extensionIndex = requestedName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0;
  const baseName = hasExtension ? requestedName.slice(0, extensionIndex) : requestedName;
  const extension = hasExtension ? requestedName.slice(extensionIndex) : "";
  let attempt = 1;
  let candidate = requestedName;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${baseName} (${attempt})${extension}`;
    attempt += 1;
  }
  return candidate;
};

const openImagePreviewByRelPath = async (relPathInput = "", { showMissingToast = true } = {}) => {
  const relPath = normalizeRelPath(relPathInput);
  if (!relPath) {
    return false;
  }
  let matched = findStorageNodeByRelPath(storageTree.value, relPath);
  if (!matched && isDesktopStorage) {
    await refreshDesktopStorageTreeSnapshot({
      preferredNodeId: relPath
    });
    matched = findStorageNodeByRelPath(storageTree.value, relPath);
  }
  if (!matched?.node) {
    if (showMissingToast) {
      showToast(`找不到图片: ${relPath}`);
    }
    return false;
  }
  expandStorageAncestors(matched.parentIds);
  selectedStorageNodeId.value = String(matched.node.id || selectedStorageNodeId.value);
  activeEditorTabId.value = ensureEditorFileTab(relPath);
  persistStorageState();
  return true;
};

const openEditorFileTabByRelPath = async (relPathInput = "", { showMissingToast = true } = {}) => {
  const relPath = normalizeRelPath(relPathInput);
  if (!relPath) {
    return false;
  }
  if (isImageFileName(basenameOfRelPath(relPath))) {
    return openImagePreviewByRelPath(relPath, { showMissingToast });
  }
  return openMarkdownFileByRelPath(relPath, { showMissingToast });
};

const importSingleImageToWorkspace = async (file, parentRelPath = "") => {
  if (!isDesktopStorage) {
    throw new Error("workspace_import_unavailable");
  }
  const importWorkspaceFile = getDesktopDataMethod("importWorkspaceFile");
  const writeWorkspaceFile = getDesktopDataMethod("writeWorkspaceFile");
  const sourcePath = String(file?.path || "").trim();
  const requestedName = String(file?.name || "").trim() || "image.png";
  const payload = {
    parentRelPath,
    name: requestedName
  };

  if (importWorkspaceFile) {
    const result = sourcePath
      ? await importWorkspaceFile({
          ...payload,
          sourcePath
        })
      : await importWorkspaceFile({
          ...payload,
          dataUrl: await readFileAsDataUrl(file)
        });
    if (!result?.ok) {
      throw new Error(String(result?.error || "import_workspace_file_failed"));
    }
    return {
      name: String(result.name || requestedName),
      relPath: String(result.relPath || ""),
      absPath: String(result.absPath || ""),
      fileUrl: String(result.fileUrl || "")
    };
  }

  if (!writeWorkspaceFile) {
    throw new Error("当前桌面会话不支持导入图片，请重启桌面应用");
  }

  const finalName = pickUniqueStorageChildName(parentRelPath, requestedName);
  const relPath = joinStorageRelPath(parentRelPath, finalName);
  const result = await writeWorkspaceFile({
    relPath,
    content: await readFileAsBase64(file),
    encoding: "base64"
  });
  if (!result?.ok) {
    throw new Error(String(result?.error || "import_workspace_file_failed"));
  }
  return {
    name: finalName,
    relPath,
    absPath: String(result.absPath || ""),
    fileUrl: resolveWorkspaceAssetSrc(relPath, {
      workspaceRootPath: storageRootPath.value
    })
  };
};

const importImageFilesToWorkspace = async (filesInput, {
  parentRelPath = "",
  preferredNodeId = ""
} = {}) => {
  const files = (Array.isArray(filesInput) ? filesInput : Array.from(filesInput || []))
    .filter((file) => isImageTransferFile(file));
  const imported = [];
  const failed = [];
  for (const file of files) {
    try {
      imported.push(await importSingleImageToWorkspace(file, parentRelPath));
    } catch (error) {
      failed.push({
        name: String(file?.name || ""),
        error: String(error?.message || error || "import_workspace_file_failed")
      });
    }
  }
  if (imported.length) {
    await refreshDesktopStorageTreeSnapshot({
      preferredNodeId: String(preferredNodeId || selectedStorageNodeId.value || "")
    });
  }
  return { imported, failed };
};

const moveLocalStorageNodeToFolder = (nodeIdInput = "", targetFolderIdInput = "") => {
  const nodeId = String(nodeIdInput || "").trim();
  const targetFolderId = String(targetFolderIdInput || "").trim();
  if (!nodeId || !targetFolderId || nodeId === STORAGE_ROOT_ID || nodeId === targetFolderId) {
    return null;
  }
  const draft = cloneStorageTree(storageTree.value);
  const sourceMatch = findStorageNodeInTree(draft, nodeId);
  const targetMatch = findStorageNodeInTree(draft, targetFolderId);
  if (!sourceMatch || !sourceMatch.parentId || !targetMatch || targetMatch.node.type !== "folder") {
    return null;
  }
  const sourceNode = sourceMatch.node;
  if (
    sourceNode.type === "folder"
    && isRelPathAffectedByNode(String(targetMatch.node.relPath || ""), String(sourceNode.relPath || ""), "folder")
  ) {
    return null;
  }
  const sourceParent = findStorageNodeInTree(draft, sourceMatch.parentId);
  if (!sourceParent?.node || sourceParent.node.type !== "folder") {
    return null;
  }
  const previousRelPath = String(sourceNode.relPath || "");
  sourceParent.node.children = (Array.isArray(sourceParent.node.children) ? sourceParent.node.children : [])
    .filter((child) => child.id !== nodeId);
  targetMatch.node.children = [...(Array.isArray(targetMatch.node.children) ? targetMatch.node.children : []), sourceNode];
  rebuildLocalStorageRelPaths(sourceNode, String(targetMatch.node.relPath || ""));
  storageTree.value = draft;
  return {
    node: sourceNode,
    previousRelPath,
    relPath: String(sourceNode.relPath || ""),
    targetFolderId
  };
};

const moveStorageNodeToFolder = async (nodeIdInput = "", targetFolderIdInput = "") => {
  const nodeId = String(nodeIdInput || "").trim();
  const targetFolderId = String(targetFolderIdInput || "").trim();
  const sourceMatch = findStorageNodeInTree(storageTree.value, nodeId);
  const targetMatch = findStorageNodeInTree(storageTree.value, targetFolderId);
  if (!sourceMatch || !targetMatch || targetMatch.node.type !== "folder") {
    return false;
  }
  if (sourceMatch.node.id === STORAGE_ROOT_ID || sourceMatch.node.id === targetMatch.node.id) {
    return false;
  }
  if (
    sourceMatch.node.type === "folder"
    && isRelPathAffectedByNode(String(targetMatch.node.relPath || ""), String(sourceMatch.node.relPath || ""), "folder")
  ) {
    showToast("不能把文件夹移动到自己的子目录里");
    return false;
  }

  const previousRelPath = String(sourceMatch.node.relPath || "");
  const targetFolderRelPath = String(targetMatch.node.relPath || "");
  const affectedActiveFile = isRelPathAffectedByNode(
    activeMarkdownRelPath.value,
    previousRelPath,
    sourceMatch.node.type
  );

  if (isDesktopStorage) {
    const moveWorkspaceNode = getDesktopDataMethod("moveWorkspaceNode");
    if (!moveWorkspaceNode) {
      showToast("当前桌面会话不支持移动文件，请重启桌面应用");
      return false;
    }
    try {
      if (affectedActiveFile && activeMarkdownRelPath.value) {
        clearScheduledMarkdownSave();
        await writeActiveMarkdownNow(activeMarkdownRelPath.value);
      }
      const result = await moveWorkspaceNode({
        relPath: previousRelPath,
        targetParentRelPath: targetFolderRelPath
      });
      if (!result?.ok) {
        throw new Error(String(result?.error || "move_workspace_node_failed"));
      }
      const nextNodeRelPath = String(result.relPath || previousRelPath);
      const nextActiveRelPath = affectedActiveFile
        ? mapRelPathThroughNodeChange(activeMarkdownRelPath.value, previousRelPath, nextNodeRelPath, sourceMatch.node.type)
        : "";
      remapEditorTabsForNode(previousRelPath, nextNodeRelPath, sourceMatch.node.type);
      selectedStorageNodeId.value = nextNodeRelPath;
      let syncErrorMessage = "";
      try {
        await refreshDesktopStorageTreeSnapshot({
          preferredNodeId: nextNodeRelPath
        });
        const nextNodeMatch = findStorageNodeByRelPath(storageTree.value, nextNodeRelPath);
        if (nextNodeMatch?.parentIds?.length) {
          expandStorageAncestors(nextNodeMatch.parentIds);
        }
      } catch (error) {
        syncErrorMessage = String(error?.message || error || "refresh_tree_failed");
      }
      if (affectedActiveFile && nextActiveRelPath) {
        try {
          const reloaded = await loadMarkdownFileInEditor(nextActiveRelPath, {
            showSuccessToast: false
          });
          if (!reloaded) {
            activeMarkdownRelPath.value = nextActiveRelPath;
            activeEditorTabId.value = ensureEditorFileTab(nextActiveRelPath);
          }
        } catch (error) {
          if (!syncErrorMessage) {
            syncErrorMessage = String(error?.message || error || "reload_markdown_failed");
          }
          activeMarkdownRelPath.value = nextActiveRelPath;
          activeEditorTabId.value = ensureEditorFileTab(nextActiveRelPath);
        }
      }
      persistStorageState();
      showToast(
        syncErrorMessage
          ? `已移动到 ${targetMatch.node.name}，但界面刷新失败: ${syncErrorMessage}`
          : `已移动到 ${targetMatch.node.name}`
      );
      return true;
    } catch (error) {
      showToast(`移动失败: ${String(error?.message || error || "unknown_error")}`);
      return false;
    }
  }

  const moved = moveLocalStorageNodeToFolder(nodeId, targetFolderId);
  if (!moved) {
    showToast("移动失败");
    return false;
  }
  remapEditorTabsForNode(previousRelPath, moved.relPath, sourceMatch.node.type);
  if (affectedActiveFile) {
    activeMarkdownRelPath.value = mapRelPathThroughNodeChange(
      activeMarkdownRelPath.value,
      previousRelPath,
      moved.relPath,
      sourceMatch.node.type
    );
  }
  selectedStorageNodeId.value = String(moved.node.id || moved.relPath || targetFolderId);
  persistStorageState();
  showToast(`已移动到 ${targetMatch.node.name}`);
  return true;
};

const insertImportedImagesIntoEditor = async (filesInput, { clientX = null, clientY = null } = {}) => {
  const files = (Array.isArray(filesInput) ? filesInput : Array.from(filesInput || []))
    .filter((file) => isImageTransferFile(file));
  if (!files.length) {
    return;
  }
  if (!activeMarkdownRelPath.value) {
    showToast("请先打开一个 Markdown 文件再插入图片");
    return;
  }
  try {
    const { imported, failed } = await importImageFilesToWorkspace(files, {
      parentRelPath: dirnameOfRelPath(activeMarkdownRelPath.value),
      preferredNodeId: String(selectedStorageNodeId.value || "")
    });
    if (!imported.length) {
      showToast(`插入失败: ${failed[0]?.error || "unknown_error"}`);
      return;
    }
    const markdown = imported
      .map((item) => {
        const relTarget = relativeRelPathFromFile(activeMarkdownRelPath.value, item.relPath);
        const src = relTarget || item.fileUrl || item.relPath;
        return serializeImageLine({
          alt: imageAltTextForRelPath(item.relPath),
          src
        });
      })
      .join("\n");
    insertMarkdownIntoEditorAtPoint(markdown, clientX, clientY);
    activeEditorTabId.value = ensureEditorFileTab(activeMarkdownRelPath.value);
    showToast(
      failed.length
        ? `已插入 ${imported.length} 张图片，${failed.length} 张失败`
        : `已插入 ${imported.length} 张图片`
    );
  } catch (error) {
    showToast(`插入失败: ${String(error?.message || error || "unknown_error")}`);
  }
};

const finalizeTreeImageImport = async ({ imported = [], failed = [] } = {}) => {
  if (!imported.length) {
    if (failed.length) {
      showToast(`导入失败: ${failed[0]?.error || "unknown_error"}`);
    }
    return;
  }
  if (imported.length === 1) {
    await openImagePreviewByRelPath(imported[0].relPath, {
      showMissingToast: false
    });
  } else {
    const matched = findStorageNodeByRelPath(storageTree.value, imported[0].relPath);
    if (matched?.parentIds?.length) {
      expandStorageAncestors(matched.parentIds);
    }
    selectedStorageNodeId.value = String(matched?.node?.id || imported[0].relPath || selectedStorageNodeId.value);
    persistStorageState();
  }
  showToast(
    failed.length
      ? `已导入 ${imported.length} 张图片，${failed.length} 张失败`
      : `已导入 ${imported.length} 张图片`
  );
};

const clearStorageTreeHoverState = () => {
  storageTreeDropTargetId.value = "";
  isStorageTreeImportActive.value = false;
};

const resetStorageTreeDragState = () => {
  draggedStorageNodeId.value = "";
  clearStorageTreeHoverState();
};

const selectStorageNode = async (id) => {
  const targetId = String(id || "").trim();
  if (!targetId) {
    return;
  }
  selectedStorageNodeId.value = targetId;
  const matched = findStorageNodeInTree(storageTree.value, targetId);
  if (matched?.node?.type === "folder") {
    storageFolderExpandedMap.value = {
      ...storageFolderExpandedMap.value,
      [targetId]: true
    };
  } else if (matched?.node?.type === "file" && isImageFileName(matched.node.name)) {
    await openImagePreviewByRelPath(String(matched.node.relPath || ""), {
      showMissingToast: true
    });
  } else if (matched?.node?.type === "file" && isMarkdownFileName(matched.node.name)) {
    const targetRelPath = String(matched.node.relPath || "");
    if (normalizeRelPath(targetRelPath) === normalizeRelPath(activeMarkdownRelPath.value)) {
      activeEditorTabId.value = ensureEditorFileTab(targetRelPath);
      persistStorageState();
      return;
    }
    if (isMarkdownFileTooLarge(matched.node.size)) {
      showToast(`Markdown 文件过大，无法载入: ${matched.node.name} (${formatBytes(matched.node.size)})`);
      persistStorageState();
      return;
    }
    await loadMarkdownFileInEditor(targetRelPath, { showSuccessToast: true });
  }
  persistStorageState();
};

const toggleStorageFolder = (id) => {
  const targetId = String(id || "").trim();
  if (!targetId) {
    return;
  }
  storageFolderExpandedMap.value = {
    ...storageFolderExpandedMap.value,
    [targetId]: !isStorageFolderExpanded(targetId)
  };
  persistStorageState();
};

const closeStorageSortMenu = () => {
  isStorageSortMenuOpen.value = false;
};

const toggleStorageSortMenu = () => {
  closeWorkspaceFooterPanel();
  isStorageSortMenuOpen.value = !isStorageSortMenuOpen.value;
};

const applyStorageSortMode = (mode) => {
  const nextMode = normalizeStorageSortMode(mode);
  const changed = storageSortMode.value !== nextMode;
  storageSortMode.value = nextMode;
  closeStorageSortMenu();
  if (changed) {
    const options = STORAGE_SORT_OPTIONS.value;
    const optionMap = Object.fromEntries(options.map((option) => [option.value, option]));
    const label = optionMap[nextMode]?.label || "";
    showToast(localeText(`文件树已按 ${label} 排序`, `File tree sorted by: ${label}`));
  }
};

const closeWorkspaceFooterPanel = () => {
  workspaceFooterPanel.value = "";
};

const toggleWorkspaceFooterPanel = (panel) => {
  const targetPanel = String(panel || "").trim();
  closeStorageSortMenu();
  if (workspaceFooterPanel.value === targetPanel) {
    closeWorkspaceFooterPanel();
    return;
  }
  workspaceFooterPanel.value = targetPanel;
};

const currentSettingsSectionLabel = computed(() =>
  settingsSections.value.find((section) => section.id === settingsWindow.value.section)?.label || localeText("设置", "Settings")
);

const openSettingsWindow = (sectionInput = "general") => {
  const nextSection = SETTINGS_SECTION_CONFIG.some((section) => section.id === sectionInput)
    ? sectionInput
    : "general";
  closeWorkspaceFooterPanel();
  closeStorageSortMenu();
  settingsWindow.value = {
    open: true,
    section: nextSection
  };
};

const closeSettingsWindow = () => {
  settingsWindow.value = {
    open: false,
    section: settingsWindow.value.section || "general"
  };
};

const applyThemeSelection = (themeIdInput = DEFAULT_THEME_ID) => {
  const themeId = normalizeLegacyThemeSelection(themeIdInput, currentThemeMode.value);
  const nextTheme = resolveThemeDefinition(themeId, importedThemes.value);
  activeThemeId.value = nextTheme?.id || DEFAULT_THEME_ID;
  applyThemePreference();
};

const setImportedThemeMode = (themeIdInput = "", modeInput = "light") => {
  const themeId = String(themeIdInput || "").trim();
  if (!themeId) {
    return;
  }
  const themeIndex = importedThemes.value.findIndex((theme) => theme?.id === themeId);
  if (themeIndex < 0) {
    return;
  }
  const currentTheme = importedThemes.value[themeIndex];
  const nextTheme = normalizeImportedThemeDefinition({
    ...currentTheme,
    mode: modeInput
  });
  if (!nextTheme) {
    return;
  }
  importedThemes.value = importedThemes.value.map((theme, index) => (
    index === themeIndex ? nextTheme : theme
  ));
  if (activeThemeId.value === themeId) {
    applyThemePreference();
  } else {
    persistThemePrefs();
  }
};

const removeImportedTheme = (themeIdInput = "") => {
  const themeId = String(themeIdInput || "").trim();
  if (!themeId) {
    return;
  }
  const currentTheme = importedThemes.value.find((theme) => theme?.id === themeId);
  if (!currentTheme) {
    return;
  }
  importedThemes.value = importedThemes.value.filter((theme) => theme?.id !== themeId);
  if (activeThemeId.value === themeId) {
    activeThemeId.value = fallbackThemeIdForMode(currentTheme.mode);
  }
  applyThemePreference();
};

const triggerThemeImport = () => {
  settingsThemeFileInputRef.value?.click?.();
};

const parseImportedThemeFile = async (file) => {
  const fileName = String(file?.name || "").trim() || "导入主题";
  const rawText = await file.text();
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".json")) {
    const parsed = JSON.parse(rawText);
    const nextTheme = normalizeImportedThemeDefinition({
      ...parsed,
      name: String(parsed?.name || fileName.replace(/\.[^.]+$/, "") || "导入主题").trim(),
      importedAt: Date.now()
    }, isDark.value ? "dark" : "light");
    if (!nextTheme) {
      throw new Error("theme_json_missing_css");
    }
    return nextTheme;
  }
  const nextTheme = normalizeImportedThemeDefinition({
    name: fileName.replace(/\.[^.]+$/, "") || "导入主题",
    mode: isDark.value ? "dark" : "light",
    importedAt: Date.now(),
    cssText: rawText
  }, isDark.value ? "dark" : "light");
  if (!nextTheme) {
    throw new Error("invalid_theme_file");
  }
  return nextTheme;
};

const handleThemeFileImport = async (event) => {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }
  try {
    const nextTheme = normalizeImportedThemeDefinition(await parseImportedThemeFile(file), isDark.value ? "dark" : "light");
    if (!nextTheme) {
      throw new Error("invalid_theme_file");
    }
    importedThemes.value = [
      ...importedThemes.value.filter((theme) => theme?.id !== nextTheme.id),
      nextTheme
    ];
    activeThemeId.value = nextTheme.id;
    applyThemePreference();
    showToast(`已导入主题: ${nextTheme.label}`);
  } catch (error) {
    showToast(`导入主题失败: ${String(error?.message || error || "unknown_error")}`);
  } finally {
    if (input) {
      input.value = "";
    }
  }
};

const handleWorkspaceFooterPrimaryAction = async () => {
  closeWorkspaceFooterPanel();
  closeStorageSortMenu();
  if (canPickWorkspaceRoot) {
    await pickStorageRootDir();
    return;
  }
  if (canOpenWorkspaceRoot) {
    await openStorageRootDir();
  }
};

const handleWorkspaceFooterSwitch = async () => {
  closeWorkspaceFooterPanel();
  closeStorageSortMenu();
  if (!canPickWorkspaceRoot) {
    return;
  }
  await pickStorageRootDir();
};

const handleWorkspaceFooterOpenDir = async () => {
  closeWorkspaceFooterPanel();
  closeStorageSortMenu();
  await openStorageRootDir();
};

const resolveStorageTargetFolderId = () => {
  const matched = findStorageNodeInTree(storageTree.value, selectedStorageNodeId.value);
  if (!matched) {
    return STORAGE_ROOT_ID;
  }
  if (matched.node.type === "folder") {
    return matched.node.id;
  }
  return matched.parentId || STORAGE_ROOT_ID;
};

const resolveStorageTargetFolderRelPath = () => {
  const matched = findStorageNodeInTree(storageTree.value, selectedStorageNodeId.value);
  if (!matched) {
    return "";
  }
  if (matched.node.type === "folder") {
    return String(matched.node.relPath || "");
  }
  const parent = findStorageNodeInTree(storageTree.value, matched.parentId || STORAGE_ROOT_ID);
  return String(parent?.node?.relPath || "");
};

const askStorageName = (title, fallbackName) => {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    return fallbackName;
  }
  const value = window.prompt(title, fallbackName);
  return String(value || "").trim();
};

const createStorageNodeAt = (folderId, node) => {
  const draft = cloneStorageTree(storageTree.value);
  const matched = findStorageNodeInTree(draft, folderId);
  if (!matched || matched.node.type !== "folder") {
    return false;
  }
  const children = Array.isArray(matched.node.children) ? matched.node.children : [];
  children.push(node);
  matched.node.children = children;
  storageTree.value = draft;
  return true;
};

const createStorageFile = async () => {
  const name = isDesktopStorage ? "untitled.md" : (() => {
    const rawName = askStorageName("请输入文件名", "未命名.md");
    if (!rawName) {
      return "";
    }
    return rawName.includes(".") ? rawName : `${rawName}.md`;
  })();
  if (!name) {
    return;
  }

  if (isDesktopStorage) {
    try {
      const result = await desktopDataBridge.createWorkspaceFile({
        parentRelPath: resolveStorageTargetFolderRelPath(),
        name
      });
      if (!result?.ok) {
        throw new Error(String(result?.error || "create_file_failed"));
      }
      const nextRelPath = String(result.relPath || "");
      selectedStorageNodeId.value = nextRelPath || selectedStorageNodeId.value;
      await loadDesktopStorageTree({
        preferredNodeId: nextRelPath,
        preferredMarkdownRelPath: String(result.name || "").toLowerCase().endsWith(".md") ? nextRelPath : ""
      });
      persistStorageState();
      showToast(`已创建文件: ${result.name || name}`);
      return;
    } catch (error) {
      showToast(`创建文件失败: ${String(error?.message || error || "unknown_error")}`);
      return;
    }
  }

  const folderId = resolveStorageTargetFolderId();
  const parentMatch = findStorageNodeInTree(storageTree.value, folderId);
  const parentRel = String(parentMatch?.node?.relPath || "");
  const fileNode = {
    id: makeStorageNodeId("file"),
    type: "file",
    name,
    relPath: parentRel ? `${parentRel}/${name}` : name,
    absPath: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children: []
  };
  if (!createStorageNodeAt(folderId, fileNode)) {
    showToast("创建文件失败");
    return;
  }
  storageFolderExpandedMap.value = {
    ...storageFolderExpandedMap.value,
    [folderId]: true
  };
  selectedStorageNodeId.value = fileNode.id;
  persistStorageState();
};

const createStorageFolder = async () => {
  const name = isDesktopStorage ? "new-folder" : askStorageName("请输入文件夹名", "新建文件夹");
  if (!name) {
    return;
  }

  if (isDesktopStorage) {
    try {
      const result = await desktopDataBridge.createWorkspaceFolder({
        parentRelPath: resolveStorageTargetFolderRelPath(),
        name
      });
      if (!result?.ok) {
        throw new Error(String(result?.error || "create_folder_failed"));
      }
      const nextRelPath = String(result.relPath || "");
      selectedStorageNodeId.value = nextRelPath || selectedStorageNodeId.value;
      await loadDesktopStorageTree({ preferredNodeId: nextRelPath });
      persistStorageState();
      showToast(`已创建文件夹: ${result.name || name}`);
      return;
    } catch (error) {
      showToast(`创建文件夹失败: ${String(error?.message || error || "unknown_error")}`);
      return;
    }
  }

  const folderId = resolveStorageTargetFolderId();
  const parentMatch = findStorageNodeInTree(storageTree.value, folderId);
  const parentRel = String(parentMatch?.node?.relPath || "");
  const folderNode = {
    id: makeStorageNodeId("folder"),
    type: "folder",
    name,
    relPath: parentRel ? `${parentRel}/${name}` : name,
    absPath: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children: []
  };
  if (!createStorageNodeAt(folderId, folderNode)) {
    showToast("创建文件夹失败");
    return;
  }
  storageFolderExpandedMap.value = {
    ...storageFolderExpandedMap.value,
    [folderId]: true,
    [folderNode.id]: true
  };
  selectedStorageNodeId.value = folderNode.id;
  persistStorageState();
};

const renameLocalStorageNode = (nodeId, nextName) => {
  const draft = cloneStorageTree(storageTree.value);
  const matched = findStorageNodeInTree(draft, nodeId);
  if (!matched || matched.node.id === STORAGE_ROOT_ID) {
    return null;
  }
  matched.node.name = nextName;
  const parent = findStorageNodeInTree(draft, matched.parentId || STORAGE_ROOT_ID);
  rebuildLocalStorageRelPaths(matched.node, String(parent?.node?.relPath || ""));
  storageTree.value = draft;
  return matched.node;
};

const deleteLocalStorageNode = (nodeId) => {
  const draft = cloneStorageTree(storageTree.value);
  const matched = findStorageNodeInTree(draft, nodeId);
  if (!matched || !matched.parentId) {
    return null;
  }
  const parent = findStorageNodeInTree(draft, matched.parentId);
  if (!parent?.node || parent.node.type !== "folder") {
    return null;
  }
  parent.node.children = (Array.isArray(parent.node.children) ? parent.node.children : [])
    .filter((child) => child.id !== nodeId);
  storageTree.value = draft;
  return {
    parentId: matched.parentId,
    node: matched.node
  };
};

const splitStorageNodeName = (nameInput = "", isFolder = false) => {
  const name = String(nameInput || "").trim();
  if (isFolder) {
    return {
      base: name || "新建文件夹",
      ext: ""
    };
  }
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) {
    return {
      base: name || "未命名",
      ext: ""
    };
  }
  return {
    base: name.slice(0, dotIndex) || "未命名",
    ext: name.slice(dotIndex)
  };
};

const pickUniqueStorageClipboardName = (folderNode, requestedNameInput = "", isFolder = false) => {
  const requestedName = String(requestedNameInput || "").trim();
  const { base, ext } = splitStorageNodeName(requestedName, isFolder);
  const existingNames = new Set(
    (Array.isArray(folderNode?.children) ? folderNode.children : [])
      .map((child) => String(child?.name || "").trim().toLowerCase())
      .filter(Boolean)
  );
  let index = 0;
  while (index < 10000) {
    const suffix = index === 0 ? " 副本" : ` 副本 ${index + 1}`;
    const candidate = `${base}${suffix}${ext}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    index += 1;
  }
  return `${base}-${Date.now()}${ext}`;
};

const cloneStorageNodeClipboardBranch = (sourceNode, parentRelPath = "", forcedNameInput = "") => {
  const type = sourceNode?.type === "folder" ? "folder" : "file";
  const name = String(forcedNameInput || sourceNode?.name || (type === "folder" ? "新建文件夹" : "未命名.md")).trim()
    || (type === "folder" ? "新建文件夹" : "未命名.md");
  const relPath = joinStorageRelPath(parentRelPath, name);
  const createdAt = Date.now();
  const updatedAt = createdAt;
  const children = type === "folder"
    ? (Array.isArray(sourceNode?.children) ? sourceNode.children : [])
        .map((child) => cloneStorageNodeClipboardBranch(child, relPath))
    : [];
  return {
    id: relPath || makeStorageNodeId(type),
    type,
    name,
    relPath,
    absPath: "",
    size: Number(sourceNode?.size || 0),
    createdAt,
    updatedAt,
    children
  };
};

const duplicateLocalStorageNodeToFolder = (nodeIdInput = "", targetFolderIdInput = "") => {
  const nodeId = String(nodeIdInput || "").trim();
  const targetFolderId = String(targetFolderIdInput || "").trim();
  if (!nodeId || !targetFolderId || nodeId === STORAGE_ROOT_ID) {
    return null;
  }
  const draft = cloneStorageTree(storageTree.value);
  const sourceMatch = findStorageNodeInTree(draft, nodeId);
  const targetMatch = findStorageNodeInTree(draft, targetFolderId);
  if (!sourceMatch || !targetMatch || targetMatch.node.type !== "folder") {
    return null;
  }
  if (
    sourceMatch.node.type === "folder"
    && isRelPathAffectedByNode(String(targetMatch.node.relPath || ""), String(sourceMatch.node.relPath || ""), "folder")
  ) {
    return { error: "cannot_copy_into_descendant" };
  }
  const nextName = pickUniqueStorageClipboardName(
    targetMatch.node,
    String(sourceMatch.node.name || ""),
    sourceMatch.node.type === "folder"
  );
  const duplicatedNode = cloneStorageNodeClipboardBranch(
    sourceMatch.node,
    String(targetMatch.node.relPath || ""),
    nextName
  );
  targetMatch.node.children = [
    ...(Array.isArray(targetMatch.node.children) ? targetMatch.node.children : []),
    duplicatedNode
  ];
  storageTree.value = draft;
  return {
    node: duplicatedNode,
    relPath: String(duplicatedNode.relPath || ""),
    parentId: targetFolderId
  };
};

const canRevealStorageNode = (nodeIdInput = "") => {
  const nodeId = String(nodeIdInput || "").trim();
  if (!isDesktopStorage || !nodeId || nodeId === STORAGE_ROOT_ID) {
    return false;
  }
  return Boolean(getDesktopDataMethod("revealWorkspaceNode"));
};

const resolveStoragePasteTarget = (nodeIdInput = "") => {
  const nodeId = String(nodeIdInput || selectedStorageNodeId.value || "").trim();
  if (!nodeId) {
    return null;
  }
  const matched = findStorageNodeInTree(storageTree.value, nodeId);
  if (!matched) {
    return null;
  }
  if (matched.node.type === "folder") {
    return {
      folderId: String(matched.node.id || ""),
      folderRelPath: String(matched.node.relPath || "")
    };
  }
  const parentMatch = findStorageNodeInTree(storageTree.value, matched.parentId || STORAGE_ROOT_ID);
  return {
    folderId: String(parentMatch?.node?.id || STORAGE_ROOT_ID),
    folderRelPath: String(parentMatch?.node?.relPath || "")
  };
};

const canPasteIntoStorageNode = (nodeIdInput = "") => {
  const clip = storageClipboard.value;
  if (!clip?.mode || !clip?.nodeId || !clip?.relPath) {
    return false;
  }
  const target = resolveStoragePasteTarget(nodeIdInput);
  if (!target?.folderId) {
    return false;
  }
  if (clip.mode === "cut" && target.folderId === String(findStorageNodeInTree(storageTree.value, clip.nodeId)?.parentId || STORAGE_ROOT_ID)) {
    return true;
  }
  if (
    clip.nodeType === "folder"
    && isRelPathAffectedByNode(String(target.folderRelPath || ""), String(clip.relPath || ""), "folder")
  ) {
    return false;
  }
  return target.folderId !== clip.nodeId;
};

const copyStorageNode = (nodeIdInput = "", modeInput = "copy") => {
  closeStorageNodeContextMenu();
  const nodeId = String(nodeIdInput || "").trim();
  const mode = modeInput === "cut" ? "cut" : "copy";
  const matched = findStorageNodeInTree(storageTree.value, nodeId);
  if (!matched || matched.node.id === STORAGE_ROOT_ID) {
    return;
  }
  storageClipboard.value = {
    mode,
    nodeId,
    relPath: String(matched.node.relPath || ""),
    nodeType: matched.node.type === "folder" ? "folder" : "file",
    name: String(matched.node.name || "")
  };
  showToast(`${mode === "cut" ? "已剪切" : "已复制"}: ${matched.node.name}`);
};

const revealStorageNodeInExplorer = async (nodeIdInput = "") => {
  closeStorageNodeContextMenu();
  const nodeId = String(nodeIdInput || "").trim();
  const matched = findStorageNodeInTree(storageTree.value, nodeId);
  if (!matched || matched.node.id === STORAGE_ROOT_ID) {
    return;
  }
  const revealWorkspaceNode = getDesktopDataMethod("revealWorkspaceNode");
  if (!isDesktopStorage || !revealWorkspaceNode) {
    showToast("当前环境不支持在资源管理器中显示");
    return;
  }
  try {
    const result = await revealWorkspaceNode({
      relPath: String(matched.node.relPath || "")
    });
    if (!result?.ok) {
      throw new Error(String(result?.error || "reveal_workspace_node_failed"));
    }
  } catch (error) {
    showToast(`打开失败: ${String(error?.message || error || "unknown_error")}`);
  }
};

const pasteIntoStorageNode = async (nodeIdInput = "") => {
  closeStorageNodeContextMenu();
  const clip = storageClipboard.value;
  if (!clip?.mode || !clip?.nodeId || !clip?.relPath) {
    return;
  }
  const target = resolveStoragePasteTarget(nodeIdInput);
  if (!target?.folderId) {
    return;
  }
  if (
    clip.nodeType === "folder"
    && isRelPathAffectedByNode(String(target.folderRelPath || ""), String(clip.relPath || ""), "folder")
  ) {
    showToast("不能粘贴到自己的子目录里");
    return;
  }
  if (clip.mode === "cut") {
    const moved = await moveStorageNodeToFolder(clip.nodeId, target.folderId);
    if (moved) {
      storageClipboard.value = {
        mode: "",
        nodeId: "",
        relPath: "",
        nodeType: "file",
        name: ""
      };
    }
    return;
  }

  const sourceMatch = findStorageNodeInTree(storageTree.value, clip.nodeId);
  if (!sourceMatch || sourceMatch.node.id === STORAGE_ROOT_ID) {
    showToast("找不到要复制的文件");
    return;
  }

  if (isDesktopStorage) {
    const duplicateWorkspaceNode = getDesktopDataMethod("duplicateWorkspaceNode");
    if (!duplicateWorkspaceNode) {
      showToast("当前桌面会话不支持复制文件，请重启桌面应用");
      return;
    }
    try {
      const result = await duplicateWorkspaceNode({
        relPath: String(sourceMatch.node.relPath || ""),
        targetParentRelPath: String(target.folderRelPath || "")
      });
      if (!result?.ok) {
        throw new Error(String(result?.error || "duplicate_workspace_node_failed"));
      }
      await loadDesktopStorageTree({
        preferredNodeId: String(result.relPath || target.folderId),
        preferredMarkdownRelPath: normalizeRelPath(activeMarkdownRelPath.value)
      });
      showToast(`已复制到 ${basenameOfRelPath(String(result.relPath || "")) || target.folderRelPath || "/"}`);
      return;
    } catch (error) {
      showToast(`复制失败: ${String(error?.message || error || "unknown_error")}`);
      return;
    }
  }

  const duplicated = duplicateLocalStorageNodeToFolder(clip.nodeId, target.folderId);
  if (!duplicated) {
    showToast("复制失败");
    return;
  }
  if (duplicated.error === "cannot_copy_into_descendant") {
    showToast("不能粘贴到自己的子目录里");
    return;
  }
  selectedStorageNodeId.value = String(duplicated.node?.id || target.folderId);
  storageFolderExpandedMap.value = {
    ...storageFolderExpandedMap.value,
    [target.folderId]: true
  };
  persistStorageState();
  showToast(`已复制: ${duplicated.node?.name || sourceMatch.node.name}`);
};

const closeStorageNodeContextMenu = () => {
  if (!storageNodeMenu.value.open) {
    return;
  }
  storageNodeMenu.value.open = false;
};

const openStorageNodeContextMenu = (event, nodeId) => {
  const targetId = String(nodeId || "").trim();
  if (!targetId || targetId === STORAGE_ROOT_ID) {
    return;
  }
  closeDesktopTabContextMenu();
  selectedStorageNodeId.value = targetId;
  const matched = findStorageNodeInTree(storageTree.value, targetId);
  if (matched?.node?.type === "folder") {
    storageFolderExpandedMap.value = {
      ...storageFolderExpandedMap.value,
      [targetId]: true
    };
  }
  persistStorageState();
  storageNodeMenu.value = {
    open: true,
    x: event.clientX,
    y: event.clientY,
    nodeId: targetId
  };
};

const openStorageRenameDialog = (nodeId) => {
  closeStorageNodeContextMenu();
  const targetId = String(nodeId || "").trim();
  const matched = findStorageNodeInTree(storageTree.value, targetId);
  if (!matched || matched.node.id === STORAGE_ROOT_ID) {
    return;
  }
  storageRenameDialog.value = {
    open: true,
    nodeId: targetId,
    value: String(matched.node.name || ""),
    kind: matched.node.type === "folder" ? "folder" : "file"
  };
  nextTick(() => {
    const input = storageRenameInputRef.value;
    if (input && typeof input.focus === "function") {
      input.focus();
      if (typeof input.select === "function") {
        input.select();
      }
    }
  });
};

const cancelStorageRenameDialog = () => {
  if (!storageRenameDialog.value.open) {
    return;
  }
  storageRenameDialog.value = {
    open: false,
    nodeId: "",
    value: "",
    kind: "file"
  };
};

const confirmStorageNodeDeletion = async (node) => {
  const targetLabel = node.type === "folder" ? "文件夹" : "文件";
  const nodeName = String(node?.name || "").trim();

  if (isDesktopStorage && desktopDataBridge?.confirmWorkspaceDelete) {
    try {
      const result = await desktopDataBridge.confirmWorkspaceDelete({
        kind: node.type,
        name: nodeName
      });
      if (result?.ok) {
        return Boolean(result.confirmed);
      }
    } catch {
      // Fall back to the browser confirm below.
    }
  }

  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return true;
  }
  return window.confirm(`确认删除${targetLabel}"${nodeName}"吗？`);
};

const renameStorageNode = async (nodeId, nextName) => {
  const targetId = String(nodeId || "").trim();
  const trimmedName = String(nextName || "").trim();
  const matched = findStorageNodeInTree(storageTree.value, targetId);
  if (!matched || matched.node.id === STORAGE_ROOT_ID) {
    return false;
  }
  if (!trimmedName) {
    return false;
  }

  const previousRelPath = String(matched.node.relPath || "");
  const affectedActiveFile = isRelPathAffectedByNode(
    activeMarkdownRelPath.value,
    previousRelPath,
    matched.node.type
  );
  const renamedActiveRelPath = affectedActiveFile
    ? mapRelPathThroughNodeChange(activeMarkdownRelPath.value, previousRelPath, joinStorageRelPath(dirnameOfRelPath(previousRelPath), trimmedName), matched.node.type)
    : "";

  if (isDesktopStorage && desktopDataBridge?.renameWorkspaceNode) {
    try {
      if (affectedActiveFile && activeMarkdownRelPath.value) {
        clearScheduledMarkdownSave();
        await writeActiveMarkdownNow(activeMarkdownRelPath.value);
      }
      const result = await desktopDataBridge.renameWorkspaceNode({
        relPath: previousRelPath,
        name: trimmedName
      });
      if (!result?.ok) {
        throw new Error(String(result?.error || "rename_workspace_node_failed"));
      }
      const nextNodeRelPath = String(result.relPath || joinStorageRelPath(dirnameOfRelPath(previousRelPath), trimmedName));
      const nextActiveRelPath = affectedActiveFile
        ? mapRelPathThroughNodeChange(activeMarkdownRelPath.value, previousRelPath, nextNodeRelPath, matched.node.type)
        : "";
      remapEditorTabsForNode(previousRelPath, nextNodeRelPath, matched.node.type);
      selectedStorageNodeId.value = String(nextNodeRelPath || matched.node.id);
      await loadDesktopStorageTree({
        preferredNodeId: String(nextNodeRelPath || matched.node.id),
        preferredMarkdownRelPath: nextActiveRelPath
      });
      persistStorageState();
      showToast(`已重命名为 ${result.name || trimmedName}`);
      return true;
    } catch (error) {
      showToast(`重命名失败: ${String(error?.message || error || "unknown_error")}`);
      return false;
    }
  }

  const renamedNode = renameLocalStorageNode(targetId, trimmedName);
  if (!renamedNode) {
    showToast("重命名失败");
    return false;
  }

  selectedStorageNodeId.value = renamedNode.id;
  remapEditorTabsForNode(previousRelPath, String(renamedNode.relPath || ""), matched.node.type);
  if (renamedNode.type === "file" && isMarkdownFileName(renamedNode.name)) {
    activeMarkdownRelPath.value = String(renamedNode.relPath || "");
  } else if (renamedActiveRelPath) {
    activeMarkdownRelPath.value = renamedActiveRelPath;
  }
  persistStorageState();
  showToast(`已重命名为 ${trimmedName}`);
  return true;
};

const confirmStorageRenameDialog = async () => {
  const targetId = String(storageRenameDialog.value.nodeId || "");
  const trimmedName = String(storageRenameDialog.value.value || "").trim();
  if (!targetId || !trimmedName) {
    return;
  }
  const renamed = await renameStorageNode(targetId, trimmedName);
  if (renamed) {
    cancelStorageRenameDialog();
  }
};

const deleteStorageNode = async (nodeId) => {
  closeStorageNodeContextMenu();
  const targetId = String(nodeId || "").trim();
  const matched = findStorageNodeInTree(storageTree.value, targetId);
  if (!matched || matched.node.id === STORAGE_ROOT_ID) {
    return;
  }
  const targetLabel = matched.node.type === "folder" ? "文件夹" : "文件";
  releaseTransientPointerState();
  const confirmed = await confirmStorageNodeDeletion(matched.node);
  if (!confirmed) {
    return;
  }

  const targetRelPath = String(matched.node.relPath || "");
  const affectedActiveFile = isRelPathAffectedByNode(
    activeMarkdownRelPath.value,
    targetRelPath,
    matched.node.type
  );
  const graphWasActive = isWorkspaceGraphTabActive.value;
  if (affectedActiveFile) {
    clearScheduledMarkdownSave();
  }

  if (isDesktopStorage && desktopDataBridge?.deleteWorkspaceNode) {
    try {
      const result = await desktopDataBridge.deleteWorkspaceNode({
        relPath: targetRelPath
      });
      if (!result?.ok) {
        throw new Error(String(result?.error || "delete_workspace_node_failed"));
      }
      selectedStorageNodeId.value = matched.parentId || STORAGE_ROOT_ID;
      dropEditorTabsForNode(targetRelPath, matched.node.type);
      await loadDesktopStorageTree({
        preferredNodeId: matched.parentId || STORAGE_ROOT_ID
      });
      pruneMissingEditorTabs();
      const nextFileTab = editorTabs.value.find((tab) => tab.kind === "file");
      if (affectedActiveFile && nextFileTab?.relPath) {
        await openMarkdownFileByRelPath(nextFileTab.relPath, {
          showMissingToast: false
        });
        if (graphWasActive && editorTabs.value.some((tab) => tab.kind === "graph")) {
          activeEditorTabId.value = EDITOR_GRAPH_TAB_ID;
        }
      } else if (affectedActiveFile) {
        resetBlankEditorState();
        activeEditorTabId.value = graphWasActive && editorTabs.value.some((tab) => tab.kind === "graph")
          ? EDITOR_GRAPH_TAB_ID
          : "";
      }
      persistStorageState();
      showToast(`已删除${targetLabel}: ${matched.node.name}`);
      return;
    } catch (error) {
      showToast(`删除失败: ${String(error?.message || error || "unknown_error")}`);
      return;
    }
  }

  const removed = deleteLocalStorageNode(targetId);
  if (!removed) {
    showToast("删除失败");
    return;
  }
  selectedStorageNodeId.value = removed.parentId || STORAGE_ROOT_ID;
  dropEditorTabsForNode(targetRelPath, matched.node.type);
  const nextFileTab = editorTabs.value.find((tab) => tab.kind === "file");
  if (affectedActiveFile && nextFileTab?.relPath) {
    await openMarkdownFileByRelPath(nextFileTab.relPath, {
      showMissingToast: false
    });
    if (graphWasActive && editorTabs.value.some((tab) => tab.kind === "graph")) {
      activeEditorTabId.value = EDITOR_GRAPH_TAB_ID;
    }
  } else if (affectedActiveFile) {
    resetBlankEditorState();
    activeEditorTabId.value = graphWasActive && editorTabs.value.some((tab) => tab.kind === "graph")
      ? EDITOR_GRAPH_TAB_ID
      : "";
  }
  persistStorageState();
  showToast(`已删除${targetLabel}: ${matched.node.name}`);
};

const currentBacklinks = computed(() => {
  const relPath = normalizeRelPath(activeMarkdownRelPath.value);
  if (!relPath) {
    return [];
  }
  const links = wikiLinkIndexState.value?.backlinks?.[relPath];
  return [...(Array.isArray(links) ? links : [])].sort((left, right) =>
    String(left?.sourceRelPath || "").localeCompare(String(right?.sourceRelPath || ""), "zh-CN")
    || (Number(left?.lineNumber || 0) - Number(right?.lineNumber || 0))
    || (Number(left?.rawFrom || 0) - Number(right?.rawFrom || 0))
  );
});

const expandStorageAncestors = (ids = []) => {
  const nextMap = { ...storageFolderExpandedMap.value };
  for (const id of Array.isArray(ids) ? ids : []) {
    if (!id) {
      continue;
    }
    nextMap[id] = true;
  }
  storageFolderExpandedMap.value = nextMap;
};

const escapeSelectorAttr = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

const getMarkdownForRelPath = (relPathInput = "") => {
  const relPath = normalizeRelPath(relPathInput);
  if (!relPath) {
    return "";
  }
  if (relPath === normalizeRelPath(activeMarkdownRelPath.value)) {
    return String(documentMarkdown.value || "");
  }
  return String(wikiLinkIndexState.value?.contentsByPath?.[relPath] || "");
};

const getNoteHeadingsForRelPath = (relPathInput = "") => {
  const relPath = normalizeRelPath(relPathInput);
  if (!relPath) {
    return [];
  }
  if (relPath === normalizeRelPath(activeMarkdownRelPath.value)) {
    return extractHeadingsFromMarkdown(String(documentMarkdown.value || ""));
  }
  const note = wikiLinkIndexState.value?.notesByPath?.[relPath];
  return Array.isArray(note?.headings) ? note.headings : extractHeadingsFromMarkdown(getMarkdownForRelPath(relPath));
};

const getNoteTextBlocksForRelPath = (relPathInput = "", { anchor = "" } = {}) => {
  const relPath = normalizeRelPath(relPathInput);
  if (!relPath) {
    return [];
  }

  return collectWikiLinkTextBlocks(getMarkdownForRelPath(relPath), {
    headings: getNoteHeadingsForRelPath(relPath),
    anchor
  });
};

const findNoteTextBlockTarget = ({
  relPath = "",
  anchor = "",
  blockRef = ""
} = {}) => {
  const normalizedBlockRef = normalizeWikiLinkBlockText(blockRef).toLowerCase();
  if (!normalizedBlockRef) {
    return null;
  }

  return findWikiLinkTextBlockByReference(getMarkdownForRelPath(relPath), {
    headings: getNoteHeadingsForRelPath(relPath),
    anchor,
    blockRef: normalizedBlockRef
  });
};

const findStepIndexForRawPos = (markdownInput = "", rawPosInput = 0) => {
  const markdown = String(markdownInput || "");
  const rawPos = clamp(Number(rawPosInput || 0), 0, markdown.length);
  const sections = typeof extractMarkdownSections === "function"
    ? extractMarkdownSections(markdown)
    : [];
  if (!Array.isArray(sections) || !sections.length) {
    return 0;
  }
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const sectionStart = Number.isFinite(section?.startIndex) ? section.startIndex : 0;
    const sectionEnd = Number.isFinite(section?.endIndex) ? section.endIndex : markdown.length;
    if (rawPos >= sectionStart && rawPos < sectionEnd) {
      return index;
    }
  }
  return clamp(sections.length - 1, 0, sections.length - 1);
};

const scrollPreviewHeadingIntoView = (anchorInput = "") => {
  const slug = slugifyHeading(anchorInput);
  if (!slug) {
    return false;
  }
  if (!isEditMode.value) {
    const headingMatch = findHeadingMatch(viewHeadingOutline.value, anchorInput)
      || viewHeadingOutline.value.find((heading) => String(heading?.slug || "") === slug)
      || null;
    const localPos = Number(headingMatch?.from);
    if (Number.isFinite(localPos)) {
      markdownViewRef.value?.focusPosition?.(localPos);
      return true;
    }
  }
  const host = contentScrollRef.value;
  if (!(host instanceof HTMLElement)) {
    return false;
  }
  const target = host.querySelector(`[data-preview="1"] [data-heading-slug="${escapeSelectorAttr(slug)}"]`);
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  target.scrollIntoView({
    block: "center",
    behavior: "smooth"
  });
  return true;
};

const jumpWithinCurrentDocument = async ({ rawPos = null, anchor = "" } = {}) => {
  const markdown = String(documentMarkdown.value || "");
  let targetPos = Number.isFinite(rawPos) ? clamp(Number(rawPos), 0, markdown.length) : null;
  let headingSlug = "";

  if (anchor) {
    const headingMatch = findHeadingMatch(getNoteHeadingsForRelPath(activeMarkdownRelPath.value), anchor);
    if (headingMatch) {
      if (!Number.isFinite(targetPos)) {
        targetPos = clamp(Number(headingMatch.from || 0), 0, markdown.length);
      }
      headingSlug = String(headingMatch.slug || slugifyHeading(anchor));
    } else {
      headingSlug = slugifyHeading(anchor);
    }
  }

  if (!Number.isFinite(targetPos)) {
    targetPos = 0;
  }

  const stepIndex = findStepIndexForRawPos(markdown, targetPos);
  currentId.value = steps.value?.[stepIndex]?.id ?? steps.value?.[0]?.id ?? currentId.value;

  await nextTick();

  if (isEditMode.value) {
    focusMarkdownPosition(targetPos);
    return true;
  }

  pendingPreviewHeadingSlug.value = headingSlug;
  if (headingSlug) {
    await nextTick();
    scrollPreviewHeadingIntoView(headingSlug);
  }
  return true;
};

const openMarkdownFileByRelPath = async (relPathInput, { anchor = "", rawPos = null, showMissingToast = true } = {}) => {
  const relPath = normalizeRelPath(relPathInput);
  if (!relPath) {
    return false;
  }

  if (relPath === normalizeRelPath(activeMarkdownRelPath.value)) {
    const currentMatched = findStorageNodeByRelPath(storageTree.value, relPath);
    if (currentMatched?.node) {
      expandStorageAncestors(currentMatched.parentIds);
      selectedStorageNodeId.value = String(currentMatched.node.id || selectedStorageNodeId.value);
    }
    activeEditorTabId.value = ensureEditorFileTab(relPath);
    return jumpWithinCurrentDocument({ rawPos, anchor });
  }

  let matched = findStorageNodeByRelPath(storageTree.value, relPath);
  if (!matched && isDesktopStorage) {
    await loadDesktopStorageTree({
      preferredNodeId: relPath,
      preferredMarkdownRelPath: relPath
    });
    matched = findStorageNodeByRelPath(storageTree.value, relPath);
  }

  if (!matched?.node) {
    if (showMissingToast) {
      showToast(`找不到文档: ${relPath}`);
    }
    return false;
  }

  expandStorageAncestors(matched.parentIds);
  selectedStorageNodeId.value = String(matched.node.id || selectedStorageNodeId.value);
  if (relPath !== normalizeRelPath(activeMarkdownRelPath.value)) {
    await selectStorageNode(String(matched.node.id || ""));
  }
  return jumpWithinCurrentDocument({ rawPos, anchor });
};

const openStorageSearchMatch = async (item, rawPosInput = 0) => {
  const relPath = normalizeRelPath(item?.relPath || "");
  if (!relPath) {
    return false;
  }
  return openMarkdownFileByRelPath(relPath, {
    rawPos: Number(rawPosInput || 0),
    showMissingToast: true
  });
};

const openBacklinkEntry = async (entry) => {
  if (!entry?.sourceRelPath) {
    return;
  }
  await openMarkdownFileByRelPath(entry.sourceRelPath, {
    rawPos: Number(entry.rawFrom || 0)
  });
};

const openWikiLinkResolved = async (resolutionInput = {}) => {
  const resolution = resolutionInput && typeof resolutionInput === "object" ? resolutionInput : {};
  if (!resolution.exists || !resolution.relPath) {
    return false;
  }
  const blockTarget = resolution.blockRef
    ? findNoteTextBlockTarget({
        relPath: resolution.relPath,
        anchor: String(resolution.anchor || ""),
        blockRef: String(resolution.blockRef || "")
      })
    : null;
  if (resolution.blockRef && !blockTarget) {
    return false;
  }
  return openMarkdownFileByRelPath(resolution.relPath, {
    anchor: String(resolution.anchor || ""),
    rawPos: Number.isFinite(blockTarget?.from) ? Number(blockTarget.from) : null
  });
};

const handleWikiLinkActivate = async ({ match = null, resolution = null } = {}) => {
  const parsed = match?.parsed || {};
  const latestResolution = resolveWikiLink(parsed, activeMarkdownRelPath.value, workspaceMarkdownFiles.value);
  if (latestResolution.exists && latestResolution.relPath) {
    const opened = await openWikiLinkResolved(latestResolution);
    if (!opened && latestResolution.blockRef) {
      showToast(`Wiki Link text block not found: ${String(latestResolution.blockRef || "")}`);
    }
    return;
  }
  if (latestResolution?.ambiguous) {
    showToast("Wiki Link 匹配到多个文档，请把链接写得更明确一些");
    return;
  }
  const missingTarget = String(
    latestResolution?.suggestedRelPath
    || parsed.target
    || resolution?.suggestedRelPath
    || "目标文档"
  );
  showToast(`Wiki Link 未找到: ${missingTarget}`);
};

const handleEditorWikiLinkActivate = (payload) => {
  void handleWikiLinkActivate(payload);
};

const openExternalLink = async (hrefInput) => {
  const href = String(hrefInput || "").trim();
  if (!/^(https?:|mailto:)/i.test(href)) {
    showToast("澶栭儴閾炬帴鍦板潃鏃犳晥");
    return false;
  }

  try {
    if (typeof window !== "undefined" && typeof window.desktopWindow?.openExternal === "function") {
      const result = await window.desktopWindow.openExternal(href);
      if (result?.ok === false) {
        throw new Error(String(result?.error || "open_external_failed"));
      }
      return true;
    }

    if (typeof window !== "undefined" && typeof window.open === "function") {
      window.open(href, "_blank", "noopener,noreferrer");
      return true;
    }
  } catch (error) {
    showToast(`鎵撳紑澶栭儴閾炬帴澶辫触: ${String(error?.message || error || "unknown_error")}`);
    return false;
  }

  showToast("褰撳墠鐜涓嶆敮鎸佹墦寮€澶栭儴閾炬帴");
  return false;
};

const handleEditorExternalLinkActivate = (payload) => {
  void openExternalLink(payload?.href);
};

const handleWikiLinkSuggestionSelect = async ({ item = null } = {}) => {
  if (String(item?.action || "") !== "create-note") {
    return false;
  }
  const relPath = String(item?.createRelPath || item?.detail || item?.insertText || "");
  return createWikiLinkFileByRelPath(relPath);
};

const getWikiLinkSuggestions = ({ mode = "file", noteQuery = "", headingQuery = "", blockQuery = "" } = {}) => {
  const files = workspaceMarkdownFiles.value;
  const notesByPath = wikiLinkIndexState.value?.notesByPath || {};
  const normalizedNoteQuery = String(noteQuery || "").trim().toLowerCase();

  if (mode === "heading") {
    const baseTarget = String(noteQuery || "").trim();
    const currentRelPath = normalizeRelPath(activeMarkdownRelPath.value);
    const resolution = baseTarget
      ? resolveWikiLink({ target: baseTarget }, currentRelPath, files)
      : (currentRelPath ? { exists: true, relPath: currentRelPath } : null);
    if (!resolution?.exists || !resolution.relPath) {
      return [];
    }

    const normalizedHeadingQuery = String(headingQuery || "").trim().toLowerCase();
    const insertTarget = baseTarget
      || preferredWikiTargetForFile({ relPath: resolution.relPath, name: basenameOfRelPath(resolution.relPath) }, files)
      || stripMarkdownExtension(basenameOfRelPath(resolution.relPath));

    return getNoteHeadingsForRelPath(resolution.relPath)
      .filter((heading) => {
        const text = String(heading?.text || "").trim();
        if (!text) {
          return false;
        }
        return !normalizedHeadingQuery || text.toLowerCase().includes(normalizedHeadingQuery);
      })
      .slice(0, 8)
      .map((heading, index) => ({
        id: `${resolution.relPath}#${heading.slug || index}`,
        label: String(heading.text || ""),
        detail: resolution.relPath === normalizeRelPath(activeMarkdownRelPath.value) ? "" : resolution.relPath,
        meta: `H${Math.max(1, Number(heading?.level || 1))}`,
        insertText: `${insertTarget}#${String(heading.text || "")}`,
        tone: "default",
        layout: "preview"
      }));
  }

  if (mode === "block") {
    const baseTarget = String(noteQuery || "").trim();
    const baseAnchor = String(headingQuery || "").trim();
    const currentRelPath = normalizeRelPath(activeMarkdownRelPath.value);
    const resolution = baseTarget
      ? resolveWikiLink({ target: baseTarget }, currentRelPath, files)
      : (currentRelPath ? { exists: true, relPath: currentRelPath } : null);
    if (!resolution?.exists || !resolution.relPath) {
      return [];
    }

    const insertTarget = baseTarget
      || preferredWikiTargetForFile({ relPath: resolution.relPath, name: basenameOfRelPath(resolution.relPath) }, files)
      || stripMarkdownExtension(basenameOfRelPath(resolution.relPath));
    const blockPrefix = `${insertTarget}${baseAnchor ? `#${baseAnchor}` : ""}^`;
    const normalizedBlockQuery = normalizeWikiLinkBlockText(blockQuery).toLowerCase();

    return getNoteTextBlocksForRelPath(resolution.relPath, { anchor: baseAnchor })
      .map((entry, index) => {
        const insertBlockRef = String(entry?.refToken || "");
        const label = String(entry?.previewText || "");
        const lineStart = Math.max(1, Number(entry?.lineStart || 1));
        return {
          id: `${resolution.relPath}^${String(insertBlockRef || index)}`,
          label,
          detail: `^${insertBlockRef}`,
          meta: `L${lineStart}`,
          insertText: `${blockPrefix}${insertBlockRef}`,
          tone: "default",
          layout: "preview",
          lineStart,
          blockText: String(entry?.text || ""),
        };
      })
      .filter((item) => item.label && (!normalizedBlockQuery || item.blockText.toLowerCase().includes(normalizedBlockQuery)))
      .sort((left, right) =>
        Number(left.lineStart || 0) - Number(right.lineStart || 0)
        || String(left.id || "").localeCompare(String(right.id || ""), "zh-CN")
      )
      .map(({ blockText, lineStart, ...item }) => item);
  }

  const fileItems = files
    .map((file) => {
      const relPath = normalizeRelPath(file.relPath);
      const note = notesByPath[relPath] || {};
      const insertText = preferredWikiTargetForFile(file, files) || relPath;
      const label = String(note.title || stripMarkdownExtension(file.name || basenameOfRelPath(relPath)));
      const haystack = `${label}\n${relPath}\n${stripMarkdownExtension(file.name || "")}`.toLowerCase();
      const insertTextLower = insertText.toLowerCase();
      return {
        id: relPath,
        label,
        detail: relPath,
        insertText,
        tone: "default",
        exact: normalizedNoteQuery && (insertTextLower === normalizedNoteQuery || label.toLowerCase() === normalizedNoteQuery),
        starts: normalizedNoteQuery && (insertTextLower.startsWith(normalizedNoteQuery) || label.toLowerCase().startsWith(normalizedNoteQuery)),
        haystack
      };
    })
    .filter((item) => !normalizedNoteQuery || item.haystack.includes(normalizedNoteQuery))
    .sort((left, right) =>
      Number(Boolean(right.exact)) - Number(Boolean(left.exact))
      || Number(Boolean(right.starts)) - Number(Boolean(left.starts))
      || String(left.detail || "").localeCompare(String(right.detail || ""), "zh-CN")
    )
    .slice(0, 8)
    .map(({ exact, starts, haystack, ...item }) => item);

  const rawTarget = String(noteQuery || "").trim();
  if (!rawTarget) {
    return fileItems;
  }

  const exactExisting = files.some((file) => {
    const relPath = normalizeRelPath(file.relPath);
    const preferredTarget = preferredWikiTargetForFile(file, files);
    return String(preferredTarget || "").toLowerCase() === rawTarget.toLowerCase()
      || relPath === normalizeRelPath(ensureMarkdownExtension(rawTarget));
  });

  if (!exactExisting) {
    fileItems.unshift({
      id: `create:${rawTarget}`,
      label: localeText(`创建 ${rawTarget}`, `Create ${rawTarget}`),
      detail: suggestRelPathForMissing(rawTarget, activeMarkdownRelPath.value),
      insertText: rawTarget,
      tone: "warning",
      action: "create-note",
      createRelPath: suggestRelPathForMissing(rawTarget, activeMarkdownRelPath.value)
    });
  }

  return fileItems.slice(0, 8);
};

const rebuildWikiLinkIndex = async () => {
  const files = workspaceMarkdownFiles.value;
  if (!files.length || !desktopDataBridge?.readWorkspaceFile) {
    wikiLinkIndexState.value = {
      ...createEmptyWikiLinkIndex(),
      files
    };
    return;
  }

  const buildSeq = ++wikiLinkIndexSeq;
  wikiLinkIndexLoading.value = true;
  try {
    const activeRelPath = normalizeRelPath(activeMarkdownRelPath.value);
    const overridesByPath = activeRelPath
      ? {
          [activeRelPath]: String(documentMarkdown.value || "")
        }
      : {};

    const index = await buildWikiLinkIndex({
      files,
      overridesByPath,
      readFile: async (relPathInput) => {
        const relPath = normalizeRelPath(relPathInput);
        if (relPath === activeRelPath) {
          return String(documentMarkdown.value || "");
        }
        const result = await desktopDataBridge.readWorkspaceFile({
          relPath
        });
        if (!result?.ok) {
          throw new Error(String(result?.error || "read_workspace_file_failed"));
        }
        return String(result.content || "");
      }
    });

    if (buildSeq !== wikiLinkIndexSeq) {
      return;
    }
    wikiLinkIndexState.value = index;
  } catch {
    if (buildSeq !== wikiLinkIndexSeq) {
      return;
    }
    wikiLinkIndexState.value = {
      ...createEmptyWikiLinkIndex(),
      files
    };
  } finally {
    if (buildSeq === wikiLinkIndexSeq) {
      wikiLinkIndexLoading.value = false;
    }
  }
};

const scheduleWikiLinkIndexRebuild = () => {
  if (wikiLinkIndexTimer) {
    clearTimeout(wikiLinkIndexTimer);
  }
  wikiLinkIndexTimer = setTimeout(() => {
    wikiLinkIndexTimer = null;
    void rebuildWikiLinkIndex();
  }, WIKI_LINK_INDEX_DEBOUNCE_MS);
};

const openStorageRootDir = async () => {
  if (!isDesktopStorage || !desktopDataBridge?.openWorkspaceDir) {
    showToast("当前环境不支持打开真实目录");
    return;
  }
  try {
    const result = await desktopDataBridge.openWorkspaceDir();
    if (!result?.ok) {
      throw new Error(String(result?.error || "open_workspace_failed"));
    }
  } catch (error) {
    showToast(`打开目录失败: ${String(error?.message || error || "unknown_error")}`);
  }
};

const pickStorageRootDir = async () => {
  if (!isDesktopStorage || !canPickWorkspaceRoot) {
    showToast("当前环境不支持选择真实目录");
    return;
  }
  try {
    const result = await desktopDataBridge.pickWorkspaceRoot();
    if (result?.canceled) {
      return;
    }
    if (!result?.ok) {
      throw new Error(String(result?.error || "pick_workspace_root_failed"));
    }
    await loadDesktopStorageTree();
    showToast(`已切换目录: ${String(result.rootPath || storageRootPath.value || "")}`);
  } catch (error) {
    showToast(`选择目录失败: ${String(error?.message || error || "unknown_error")}`);
  }
};

ensureSelectedStorageNodeValid();

const measureContentReadProgress = () => {
  const el = contentScrollRef.value;
  if (!el || isEditMode.value) {
    return 0;
  }
  const scrollable = el.scrollHeight - el.clientHeight;
  if (scrollable <= 2) {
    return 1;
  }
  return clamp(el.scrollTop / scrollable, 0, 1);
};

const refreshContentProgress = () => {
  currentContentReadProgress.value = measureContentReadProgress();
};

const onContentScroll = () => {
  currentContentReadProgress.value = measureContentReadProgress();
};

const isPreviewInteractiveTarget = (target) => {
  const element = target instanceof Element
    ? target
    : (target?.parentElement instanceof Element ? target.parentElement : null);
  if (!(element instanceof Element)) {
    return false;
  }
  return Boolean(
    element.closest([
      "a",
      "button",
      "input",
      "textarea",
      "select",
      "label",
      "summary",
      "[role='button']",
      ".cm-wiki-link",
      ".cm-inline-link",
      ".cm-code-block-copy-btn",
      ".cm-code-block-copy-trigger",
      ".cm-image-widget-btn",
      ".cm-math-widget-btn",
      ".cm-table-widget-cell-editor",
      ".cm-task-checkbox-widget"
    ].join(", "))
  );
};

const copyPreviewCodeBlock = async (buttonElInput) => {
  const buttonEl = buttonElInput instanceof HTMLElement ? buttonElInput : null;
  const codeEl = buttonEl?.closest("pre")?.querySelector("code");
  const codeText = String(codeEl?.textContent || "");
  if (!codeText) {
    showToast("没有可复制的代码");
    return;
  }
  try {
    await writeDesktopClipboard(codeText);
    showToast("代码已复制");
  } catch {
    showToast("复制失败");
  }
};

const handlePreviewNavClick = (event) => {
  const targetElement = event?.target instanceof Element
    ? event.target
    : (event?.target?.parentElement instanceof Element ? event.target.parentElement : null);
  const copyButton = targetElement?.closest("[data-copy-code]") || null;
  if (copyButton instanceof HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    void copyPreviewCodeBlock(copyButton);
    return;
  }
  const target = targetElement?.closest(".wiki-link") || null;
  if (target instanceof HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    const match = {
      parsed: {
        target: String(target.dataset.wikiTarget || ""),
        anchor: String(target.dataset.wikiAnchor || ""),
        blockRef: String(target.dataset.wikiBlockRef || ""),
        alias: String(target.dataset.wikiAlias || "")
      }
    };
    void handleWikiLinkActivate({
      source: "preview",
      clientX: Number(event.clientX || 0),
      clientY: Number(event.clientY || 0),
      match,
      resolution: resolveWikiLink(match.parsed, activeMarkdownRelPath.value, workspaceMarkdownFiles.value)
    });
    return;
  }
  if (!(gestureNavigationEnabled.value && !isEditMode.value)) {
    return;
  }
  if (event.defaultPrevented || isPreviewInteractiveTarget(event.target)) {
    return;
  }
  const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
  if (selection && String(selection).trim()) {
    return;
  }
  const host = event.currentTarget;
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const rect = host.getBoundingClientRect();
  const x = event.clientX - rect.left;
  if (x >= rect.width / 2) {
    next();
  } else {
    prev();
  }
};

const sidebarChapterProgress = computed(() => {
  const total = steps.value.length;
  if (!total || currentStepIndex.value < 0) {
    return 0;
  }
  const completed = clamp(currentStepIndex.value, 0, total - 1);
  const current = clamp(currentContentReadProgress.value, 0, 1);
  return clamp((completed + current) / total, 0, 1);
});

const stepProgressForIndex = (index) => {
  if (index < currentStepIndex.value) {
    return 1;
  }
  if (index > currentStepIndex.value) {
    return 0;
  }
  return clamp(currentContentReadProgress.value, 0, 1);
};

const toggleSidebarCollapse = () => {
  if (isSidebarHidden.value) {
    isSidebarHidden.value = false;
    isSidebarCollapsed.value = false;
    sidebarWidth.value = clamp(sidebarWidth.value, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
    nextTick(() => {
      refreshContentProgress();
    });
    return;
  }
  isSidebarHidden.value = true;
  isSidebarCollapsed.value = false;
  nextTick(() => {
    refreshContentProgress();
  });
};

const applySidebarDragWidth = (rawWidth) => {
  const width = Number(rawWidth) || 0;
  if (width <= SIDEBAR_HIDE_SNAP) {
    isSidebarHidden.value = true;
    isSidebarCollapsed.value = false;
    return;
  }

  isSidebarHidden.value = false;
  if (width <= SIDEBAR_COLLAPSE_SNAP) {
    isSidebarCollapsed.value = true;
    return;
  }

  isSidebarCollapsed.value = false;
  sidebarWidth.value = clamp(Math.round(width), SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
};

const queueSidebarDragWidth = (rawWidth) => {
  sidebarDragPendingWidth = rawWidth;
  if (sidebarDragRaf) {
    return;
  }
  sidebarDragRaf = window.requestAnimationFrame(() => {
    sidebarDragRaf = 0;
    if (sidebarDragPendingWidth == null) {
      return;
    }
    const pending = sidebarDragPendingWidth;
    sidebarDragPendingWidth = null;
    applySidebarDragWidth(pending);
  });
};

const finishSidebarDrag = () => {
  if (sidebarDragRaf) {
    window.cancelAnimationFrame(sidebarDragRaf);
    sidebarDragRaf = 0;
  }
  if (sidebarDragPendingWidth != null) {
    applySidebarDragWidth(sidebarDragPendingWidth);
    sidebarDragPendingWidth = null;
  }
  if (!isSidebarHidden.value && !isSidebarCollapsed.value) {
    sidebarWidth.value = clamp(sidebarWidth.value, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
  }
};

const startSidebarResizeDrag = (event) => {
  event.preventDefault();
  isSidebarDragging.value = true;
  const startX = event.clientX;
  const startW = isSidebarHidden.value
    ? 0
    : (isSidebarCollapsed.value ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth.value);

  document.body.style.userSelect = "none";

  if (sidebarDragMoveHandler) {
    window.removeEventListener("mousemove", sidebarDragMoveHandler);
    sidebarDragMoveHandler = null;
  }
  if (sidebarDragUpHandler) {
    window.removeEventListener("mouseup", sidebarDragUpHandler);
    sidebarDragUpHandler = null;
  }

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    queueSidebarDragWidth(startW - dx);
  };

  const onUp = () => {
    isSidebarDragging.value = false;
    clearBodyInteractionStyles();
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    sidebarDragMoveHandler = null;
    sidebarDragUpHandler = null;
    finishSidebarDrag();
    nextTick(() => {
      refreshContentProgress();
    });
  };

  sidebarDragMoveHandler = onMove;
  sidebarDragUpHandler = onUp;
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};

const toggleFileSidebarCollapse = () => {
  if (isFileSidebarHidden.value) {
    isFileSidebarHidden.value = false;
    isFileSidebarCollapsed.value = false;
    fileSidebarWidth.value = clamp(fileSidebarWidth.value, FILE_SIDEBAR_MIN_WIDTH, FILE_SIDEBAR_MAX_WIDTH);
    nextTick(() => {
      refreshContentProgress();
    });
    return;
  }
  isFileSidebarHidden.value = true;
  isFileSidebarCollapsed.value = false;
  nextTick(() => {
    refreshContentProgress();
  });
};

const applyFileSidebarDragWidth = (rawWidth) => {
  const width = Number(rawWidth) || 0;
  if (width <= FILE_SIDEBAR_HIDE_SNAP) {
    isFileSidebarHidden.value = true;
    isFileSidebarCollapsed.value = false;
    return;
  }

  isFileSidebarHidden.value = false;
  if (width <= FILE_SIDEBAR_COLLAPSE_SNAP) {
    isFileSidebarCollapsed.value = true;
    return;
  }

  isFileSidebarCollapsed.value = false;
  fileSidebarWidth.value = clamp(Math.round(width), FILE_SIDEBAR_MIN_WIDTH, FILE_SIDEBAR_MAX_WIDTH);
};

const queueFileSidebarDragWidth = (rawWidth) => {
  fileSidebarDragPendingWidth = rawWidth;
  if (fileSidebarDragRaf) {
    return;
  }
  fileSidebarDragRaf = window.requestAnimationFrame(() => {
    fileSidebarDragRaf = 0;
    if (fileSidebarDragPendingWidth == null) {
      return;
    }
    const pending = fileSidebarDragPendingWidth;
    fileSidebarDragPendingWidth = null;
    applyFileSidebarDragWidth(pending);
  });
};

const finishFileSidebarDrag = () => {
  if (fileSidebarDragRaf) {
    window.cancelAnimationFrame(fileSidebarDragRaf);
    fileSidebarDragRaf = 0;
  }
  if (fileSidebarDragPendingWidth != null) {
    applyFileSidebarDragWidth(fileSidebarDragPendingWidth);
    fileSidebarDragPendingWidth = null;
  }
  if (!isFileSidebarHidden.value && !isFileSidebarCollapsed.value) {
    fileSidebarWidth.value = clamp(fileSidebarWidth.value, FILE_SIDEBAR_MIN_WIDTH, FILE_SIDEBAR_MAX_WIDTH);
  }
};

const startFileSidebarResizeDrag = (event) => {
  event.preventDefault();
  isFileSidebarDragging.value = true;
  const startX = event.clientX;
  const startW = isFileSidebarHidden.value
    ? 0
    : (isFileSidebarCollapsed.value ? FILE_SIDEBAR_COLLAPSED_WIDTH : fileSidebarWidth.value);

  document.body.style.userSelect = "none";

  if (fileSidebarDragMoveHandler) {
    window.removeEventListener("mousemove", fileSidebarDragMoveHandler);
    fileSidebarDragMoveHandler = null;
  }
  if (fileSidebarDragUpHandler) {
    window.removeEventListener("mouseup", fileSidebarDragUpHandler);
    fileSidebarDragUpHandler = null;
  }

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    queueFileSidebarDragWidth(startW + dx);
  };

  const onUp = () => {
    isFileSidebarDragging.value = false;
    clearBodyInteractionStyles();
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    fileSidebarDragMoveHandler = null;
    fileSidebarDragUpHandler = null;
    finishFileSidebarDrag();
    nextTick(() => {
      refreshContentProgress();
    });
  };

  fileSidebarDragMoveHandler = onMove;
  fileSidebarDragUpHandler = onUp;
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};

const {
  terminalOpen,
  executor,
  cmdInput,
  isRunning,
  runnerToken,
  runnerCwd,
  bridgeOk,
  termLog,
  isDesktopPty,
  pingBridge,
  runInput,
  stopExecution,
  appendLog,
  onTerminalData,
  createDesktopSession,
  setActiveDesktopSession,
  writeTerminalRaw,
  resizeTerminalSession,
  killTerminalSession,
  disposeTerminal
} = useTerminal(activeStep, showToast);

const terminalPrompt = computed(() => {
  const cwd = runnerCwd.value || "D:\\python\\project\\Simple\\web";
  if (executor.value === "local-cmd") {
    return `${cwd}>`;
  }
  if (executor.value === "local-bash") {
    return `local:${cwd}$`;
  }
  if (executor.value === "browser-js") {
    return "js>";
  }
  return `(torch) PS ${cwd}>`;
});

const shellFromExecutor = () => {
  if (executor.value === "local-bash") {
    return "bash";
  }
  if (executor.value === "local-cmd") {
    return "cmd";
  }
  if (executor.value === "local-pwsh") {
    return "pwsh";
  }
  return "powershell";
};

const activeDesktopLabel = computed(() => {
  if (!isDesktopPty.value) {
    return "desktop-pty";
  }
  const current = desktopSessions.value.find((item) => item.id === activeDesktopSessionId.value);
  return current ? `${current.label} · ${current.shell}` : "desktop-pty";
});

const visiblePanes = computed(() => (desktopSplit.value ? ["primary", "secondary"] : ["primary"]));

const paneSessionIdOf = (pane) => (pane === "secondary" ? secondaryPaneSessionId.value : primaryPaneSessionId.value);

const setPaneSessionId = (pane, sid) => {
  const value = String(sid || "");
  if (pane === "secondary") {
    secondaryPaneSessionId.value = value;
  } else {
    primaryPaneSessionId.value = value;
  }
};

const paneHostOf = (pane) => (pane === "secondary" ? desktopSecondaryTerminalRef.value : desktopPrimaryTerminalRef.value);

const termOf = (pane) => paneTerminals[pane];

const fitOf = (pane) => paneFits[pane];

const getSessionById = (sid) => desktopSessions.value.find((item) => item.id === sid);

const ensureActiveSessionFromPane = () => {
  const sid = paneSessionIdOf(activeDesktopPane.value);
  if (!sid) {
    return;
  }
  activeDesktopSessionId.value = sid;
  const target = getSessionById(sid);
  if (target) {
    setActiveDesktopSession(target.id, target.shell);
  }
};

const readDesktopClipboard = async () => {
  if (desktopPtyBridge?.clipboardReadText) {
    return String(await desktopPtyBridge.clipboardReadText());
  }
  if (navigator.clipboard?.readText) {
    return String(await navigator.clipboard.readText());
  }
  return "";
};

const writeDesktopClipboard = async (text) => {
  const value = String(text ?? "");
  if (desktopPtyBridge?.clipboardWriteText) {
    await desktopPtyBridge.clipboardWriteText(value);
    return;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  }
};

const appendDesktopBuffer = (sid, chunk) => {
  const id = String(sid || "");
  if (!id) {
    return;
  }
  const prev = desktopSessionBuffers.get(id) || "";
  const merged = `${prev}${String(chunk || "")}`;
  if (merged.length > 180000) {
    desktopSessionBuffers.set(id, merged.slice(-120000));
  } else {
    desktopSessionBuffers.set(id, merged);
  }
};

const onDesktopTabDragStart = (sid) => {
  draggedDesktopSessionId = String(sid || "");
};

const onDesktopTabDrop = (targetSid) => {
  const sourceSid = draggedDesktopSessionId;
  draggedDesktopSessionId = "";
  if (!sourceSid || !targetSid || sourceSid === targetSid) {
    return;
  }
  const arr = [...desktopSessions.value];
  const from = arr.findIndex((item) => item.id === sourceSid);
  const to = arr.findIndex((item) => item.id === targetSid);
  if (from < 0 || to < 0) {
    return;
  }
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
  desktopSessions.value = arr;
};

const onEditorTabDragStart = (tabId) => {
  draggedEditorTabId.value = String(tabId || "");
  draggedEditorTabDropId.value = "";
  draggedEditorTabDropSide.value = "";
};

const onEditorTabDragOver = (event, tabId) => {
  const sourceTabId = String(draggedEditorTabId.value || "");
  const targetTabId = String(tabId || "");
  if (!sourceTabId || !targetTabId) {
    return;
  }
  event.preventDefault();
  const currentTarget = event?.currentTarget;
  let dropSide = "after";
  if (currentTarget instanceof Element) {
    const rect = currentTarget.getBoundingClientRect();
    dropSide = event.clientX < (rect.left + rect.width / 2) ? "before" : "after";
  }
  draggedEditorTabDropId.value = targetTabId;
  draggedEditorTabDropSide.value = dropSide;
  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
};

const onEditorTabDrop = (event, targetTabId) => {
  event.preventDefault();
  const sourceTabId = String(draggedEditorTabId.value || "");
  const targetId = String(targetTabId || "");
  const dropSide = draggedEditorTabDropSide.value === "before" ? "before" : "after";
  draggedEditorTabId.value = "";
  draggedEditorTabDropId.value = "";
  draggedEditorTabDropSide.value = "";
  if (!sourceTabId || !targetId || sourceTabId === targetId) {
    return;
  }
  const arr = [...editorTabs.value];
  const from = arr.findIndex((item) => item.id === sourceTabId);
  if (from < 0) {
    return;
  }
  const [moved] = arr.splice(from, 1);
  const targetIndex = arr.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) {
    return;
  }
  const insertIndex = dropSide === "before" ? targetIndex : targetIndex + 1;
  arr.splice(insertIndex, 0, moved);
  editorTabs.value = arr;
  persistStorageState();
};

const onEditorTabDragEnd = () => {
  draggedEditorTabId.value = "";
  draggedEditorTabDropId.value = "";
  draggedEditorTabDropSide.value = "";
};

const onStorageNodeDragStart = (event, nodeId) => {
  const targetId = String(nodeId || "").trim();
  if (!targetId || targetId === STORAGE_ROOT_ID) {
    return;
  }
  const matched = findStorageNodeInTree(storageTree.value, targetId);
  const isImageNode = Boolean(
    matched?.node?.type === "file"
    && isImageFileName(String(matched.node.name || matched.node.relPath || ""))
  );
  draggedStorageNodeId.value = targetId;
  clearStorageTreeHoverState();
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = isImageNode ? "copyMove" : "move";
    event.dataTransfer.setData("application/x-yc-storage-node", targetId);
  }
};

const onStorageNodeDragEnd = () => {
  resetStorageTreeDragState();
  clearEditorDropPointPreview();
};

const resolveDraggedStorageNode = (dataTransfer = null) => {
  const transferId = String(dataTransfer?.getData?.("application/x-yc-storage-node") || "").trim();
  const draggedId = transferId || String(draggedStorageNodeId.value || "").trim();
  if (!draggedId || draggedId === STORAGE_ROOT_ID) {
    return null;
  }
  return findStorageNodeInTree(storageTree.value, draggedId)?.node || null;
};

const onStorageNodeDragOver = (event, nodeId) => {
  const targetId = String(nodeId || "").trim();
  const matched = findStorageNodeInTree(storageTree.value, targetId);
  if (!matched?.node || matched.node.type !== "folder") {
    return;
  }
  const acceptsInternalMove = Boolean(draggedStorageNodeId.value);
  const acceptsImport = hasImageFilesInDataTransfer(event?.dataTransfer);
  if (!acceptsInternalMove && !acceptsImport) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  storageTreeDropTargetId.value = targetId;
  isStorageTreeImportActive.value = acceptsImport && !acceptsInternalMove;
  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = acceptsInternalMove ? "move" : "copy";
  }
};

const onStorageNodeDrop = async (event, nodeId) => {
  const targetId = String(nodeId || "").trim();
  const matched = findStorageNodeInTree(storageTree.value, targetId);
  if (!matched?.node || matched.node.type !== "folder") {
    resetStorageTreeDragState();
    return;
  }
  event.stopPropagation();
  const sourceId = String(draggedStorageNodeId.value || "");
  if (sourceId) {
    event.preventDefault();
    resetStorageTreeDragState();
    await moveStorageNodeToFolder(sourceId, targetId);
    return;
  }
  const files = extractImageFilesFromDataTransfer(event?.dataTransfer);
  resetStorageTreeDragState();
  if (!files.length) {
    return;
  }
  event.preventDefault();
  const { imported, failed } = await importImageFilesToWorkspace(files, {
    parentRelPath: String(matched.node.relPath || ""),
    preferredNodeId: targetId
  });
  await finalizeTreeImageImport({ imported, failed });
};

const onStorageTreeRootDragOver = (event) => {
  const acceptsInternalMove = Boolean(draggedStorageNodeId.value);
  const acceptsImport = hasImageFilesInDataTransfer(event?.dataTransfer);
  if (!acceptsInternalMove && !acceptsImport) {
    return;
  }
  event.preventDefault();
  storageTreeDropTargetId.value = STORAGE_ROOT_ID;
  isStorageTreeImportActive.value = acceptsImport && !acceptsInternalMove;
  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = acceptsInternalMove ? "move" : "copy";
  }
};

const onStorageTreeRootDrop = async (event) => {
  const sourceId = String(draggedStorageNodeId.value || "");
  if (sourceId) {
    event.preventDefault();
    resetStorageTreeDragState();
    await moveStorageNodeToFolder(sourceId, STORAGE_ROOT_ID);
    return;
  }
  const files = extractImageFilesFromDataTransfer(event?.dataTransfer);
  resetStorageTreeDragState();
  if (!files.length) {
    return;
  }
  event.preventDefault();
  const { imported, failed } = await importImageFilesToWorkspace(files, {
    parentRelPath: "",
    preferredNodeId: STORAGE_ROOT_ID
  });
  await finalizeTreeImageImport({ imported, failed });
};

const onStorageTreeRootDragLeave = (event) => {
  const currentTarget = event?.currentTarget;
  const relatedTarget = event?.relatedTarget;
  if (currentTarget instanceof Element && relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return;
  }
  clearStorageTreeHoverState();
};

const onStorageTreePaste = async (event) => {
  const files = extractImageFilesFromDataTransfer(event?.clipboardData);
  if (!files.length) {
    return;
  }
  event.preventDefault();
  const preferredFolderId = resolveStorageTargetFolderId();
  const { imported, failed } = await importImageFilesToWorkspace(files, {
    parentRelPath: resolveStorageTargetFolderRelPath(),
    preferredNodeId: preferredFolderId
  });
  await finalizeTreeImageImport({ imported, failed });
};

const resolveDraggedStorageImageNode = (dataTransfer = null) => {
  const node = resolveDraggedStorageNode(dataTransfer);
  if (!node || node.type !== "file" || !isImageFileName(node.name)) {
    return null;
  }
  return node;
};

const insertMarkdownIntoEditorAtPoint = (markdown, xInput = null, yInput = null) => {
  const editorApi = getActiveMarkdownEditorApi();
  const x = Number(xInput);
  const y = Number(yInput);
  if (Number.isFinite(x) && Number.isFinite(y) && typeof editorApi?.insertMarkdownAtPoint === "function") {
    editorApi.insertMarkdownAtPoint(markdown, x, y);
    return true;
  }
  if (typeof editorApi?.focusPosition === "function") {
    const anchor = Number(editorSelection.value?.head ?? editorSelection.value?.anchor ?? 0);
    editorApi.focusPosition(anchor);
  }
  editorApi?.insertMarkdown?.(markdown);
  return true;
};

const moveEditorCursorToPoint = (xInput = null, yInput = null) => {
  const editorApi = getActiveMarkdownEditorApi();
  const x = Number(xInput);
  const y = Number(yInput);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }
  return Boolean(editorApi?.moveCursorToPoint?.(x, y));
};

const clearEditorDropPointPreview = () => {
  getActiveMarkdownEditorApi()?.clearPointPreview?.();
};

const insertWorkspaceImageLinkIntoEditor = async (imageRelPathInput = "", { clientX = null, clientY = null } = {}) => {
  const imageRelPath = normalizeRelPath(imageRelPathInput);
  if (!imageRelPath) {
    return false;
  }
  if (!activeMarkdownRelPath.value) {
    showToast("请先打开一个 Markdown 文件再插入图片");
    return false;
  }
  const src = relativeRelPathFromFile(activeMarkdownRelPath.value, imageRelPath) || imageRelPath;
  insertMarkdownIntoEditorAtPoint(serializeImageLine({
    alt: imageAltTextForRelPath(imageRelPath),
    src
  }), clientX, clientY);
  activeEditorTabId.value = ensureEditorFileTab(activeMarkdownRelPath.value);
  return true;
};

const onEditorImageDragOver = (event) => {
  const draggedImageNode = resolveDraggedStorageImageNode(event?.dataTransfer);
  if (!draggedImageNode && !hasImageFilesInDataTransfer(event?.dataTransfer)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  clearStorageTreeHoverState();
  if (!moveEditorCursorToPoint(event?.clientX, event?.clientY)) {
    clearEditorDropPointPreview();
  }
  editorImageImportActive.value = true;
  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
};

const onEditorImageDragLeave = (event) => {
  const currentTarget = event?.currentTarget;
  const relatedTarget = event?.relatedTarget;
  if (currentTarget instanceof Element && relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return;
  }
  event.stopPropagation();
  editorImageImportActive.value = false;
  clearEditorDropPointPreview();
};

const onEditorImageDrop = async (event) => {
  const draggedImageNode = resolveDraggedStorageImageNode(event?.dataTransfer);
  editorImageImportActive.value = false;
  clearEditorDropPointPreview();
  if (draggedImageNode?.relPath) {
    event.preventDefault();
    event.stopPropagation();
    resetStorageTreeDragState();
    await insertWorkspaceImageLinkIntoEditor(String(draggedImageNode.relPath || ""), {
      clientX: event?.clientX,
      clientY: event?.clientY
    });
    return;
  }
  const files = extractImageFilesFromDataTransfer(event?.dataTransfer);
  if (!files.length) {
    clearEditorDropPointPreview();
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  await insertImportedImagesIntoEditor(files, {
    clientX: event?.clientX,
    clientY: event?.clientY
  });
};

const onEditorImagePaste = async (event) => {
  const files = extractImageFilesFromDataTransfer(event?.clipboardData);
  if (!files.length) {
    return;
  }
  event.preventDefault();
  await insertImportedImagesIntoEditor(files);
};

const closeDesktopTabContextMenu = () => {
  if (!desktopTabMenu.value.open) {
    return;
  }
  desktopTabMenu.value.open = false;
};

const openDesktopTabContextMenu = (event, sid) => {
  const id = String(sid || "");
  if (!id) {
    return;
  }
  closeStorageNodeContextMenu();
  desktopTabMenu.value = {
    open: true,
    x: event.clientX,
    y: event.clientY,
    sid: id
  };
};

const openDesktopRenameDialog = (sid) => {
  closeDesktopTabContextMenu();
  const id = String(sid || "");
  const target = desktopSessions.value.find((item) => item.id === id);
  if (!target) {
    return;
  }
  desktopRenameDialog.value = {
    open: true,
    sid: id,
    value: target.label || ""
  };
  nextTick(() => {
    const input = desktopRenameInputRef.value;
    if (input && typeof input.focus === "function") {
      input.focus();
      if (typeof input.select === "function") {
        input.select();
      }
    }
  });
};

const cancelDesktopRenameDialog = () => {
  if (!desktopRenameDialog.value.open) {
    return;
  }
  desktopRenameDialog.value = {
    open: false,
    sid: "",
    value: ""
  };
};

const confirmDesktopRenameDialog = () => {
  const sid = String(desktopRenameDialog.value.sid || "");
  if (!sid) {
    cancelDesktopRenameDialog();
    return;
  }
  const trimmed = String(desktopRenameDialog.value.value || "").trim();
  if (!trimmed) {
    return;
  }
  desktopSessions.value = desktopSessions.value.map((item) => {
    if (item.id !== sid) {
      return item;
    }
    return {
      ...item,
      label: trimmed,
      autoLabelIndex: -1
    };
  });
  showToast(localeText(`已重命名为 ${trimmed}`, `Renamed to ${trimmed}`));
  cancelDesktopRenameDialog();
};

const resetDesktopSplitRatio = () => {
  desktopSplitRatio.value = 50;
  void nextTick(() => {
    void syncDesktopTerminalSize();
  });
};

const startDesktopSplitResize = (event) => {
  if (!desktopSplit.value) {
    return;
  }
  const root = terminalSplitWrapRef.value;
  if (!root) {
    return;
  }
  const rect = root.getBoundingClientRect();
  if (!rect.width) {
    return;
  }
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";

  if (desktopSplitDragMoveHandler) {
    window.removeEventListener("mousemove", desktopSplitDragMoveHandler);
    desktopSplitDragMoveHandler = null;
  }
  if (desktopSplitDragUpHandler) {
    window.removeEventListener("mouseup", desktopSplitDragUpHandler);
    desktopSplitDragUpHandler = null;
  }

  const onMove = (ev) => {
    const raw = ((ev.clientX - rect.left) / rect.width) * 100;
    desktopSplitRatio.value = clamp(Math.round(raw), 18, 82);
    void nextTick(() => {
      void syncDesktopTerminalSize();
    });
  };
  const onUp = () => {
    clearBodyInteractionStyles();
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    desktopSplitDragMoveHandler = null;
    desktopSplitDragUpHandler = null;
  };
  desktopSplitDragMoveHandler = onMove;
  desktopSplitDragUpHandler = onUp;
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};

const focusDesktopPane = (pane) => {
  activeDesktopPane.value = pane;
  ensureActiveSessionFromPane();
  const term = termOf(pane);
  if (term) {
    term.focus();
  }
};

const normalizeDesktopPanes = async () => {
  const sessionIds = desktopSessions.value.map((item) => item.id);
  if (!sessionIds.length) {
    primaryPaneSessionId.value = "";
    secondaryPaneSessionId.value = "";
    activeDesktopSessionId.value = "";
    return;
  }

  if (!sessionIds.includes(primaryPaneSessionId.value)) {
    primaryPaneSessionId.value = sessionIds[0];
  }
  if (desktopSplit.value) {
    if (!sessionIds.includes(secondaryPaneSessionId.value)) {
      secondaryPaneSessionId.value = sessionIds.find((id) => id !== primaryPaneSessionId.value) || primaryPaneSessionId.value;
    }
  } else {
    secondaryPaneSessionId.value = "";
  }
  ensureActiveSessionFromPane();
};

const createDesktopTerminal = async () => {
  if (!isDesktopPty.value) {
    return;
  }
  const shell = shellFromExecutor();
  const sid = await createDesktopSession(shell, storageRootPath.value || runnerCwd.value || "");
  if (!sid) {
    return;
  }
  const labelIndex = Math.max(1, Number(desktopSessionSeq.value || 1));
  desktopSessions.value.push({
    id: sid,
    label: desktopSessionLabelByIndex(labelIndex),
    shell,
    autoLabelIndex: labelIndex
  });
  desktopSessionSeq.value = labelIndex + 1;
  desktopSessionBuffers.set(sid, "");
  if (!primaryPaneSessionId.value) {
    primaryPaneSessionId.value = sid;
  } else if (desktopSplit.value && !secondaryPaneSessionId.value) {
    secondaryPaneSessionId.value = sid;
  } else {
    setPaneSessionId(activeDesktopPane.value, sid);
  }
  activeDesktopSessionId.value = sid;
  if (desktopSplit.value && secondaryPaneSessionId.value === sid) {
    activeDesktopPane.value = "secondary";
  }
  setActiveDesktopSession(sid, shell);
  await nextTick();
  await buildPaneTerminal("primary");
  if (desktopSplit.value) {
    await buildPaneTerminal("secondary");
  }
  renderPaneFromBuffer("primary");
  if (desktopSplit.value) {
    renderPaneFromBuffer("secondary");
  }
  focusDesktopPane(activeDesktopPane.value);
  await syncDesktopTerminalSize();
};

const switchDesktopTerminal = async (sid) => {
  if (!isDesktopPty.value) {
    return;
  }
  closeDesktopTabContextMenu();
  const target = desktopSessions.value.find((item) => item.id === sid);
  if (!target) {
    return;
  }
  setPaneSessionId(activeDesktopPane.value, target.id);
  activeDesktopSessionId.value = target.id;
  setActiveDesktopSession(target.id, target.shell);
  renderPaneFromBuffer(activeDesktopPane.value);
  focusDesktopPane(activeDesktopPane.value);
  await syncDesktopTerminalSize();
};

const onPaneSessionChange = async (pane, sid) => {
  const target = getSessionById(String(sid || ""));
  if (!target) {
    return;
  }
  setPaneSessionId(pane, target.id);
  activeDesktopPane.value = pane;
  activeDesktopSessionId.value = target.id;
  setActiveDesktopSession(target.id, target.shell);
  renderPaneFromBuffer(pane);
  await syncDesktopTerminalSize();
};

const toggleDesktopSplit = async () => {
  if (!isDesktopPty.value) {
    return;
  }
  if (!desktopSplit.value) {
    desktopSplit.value = true;
    if (!secondaryPaneSessionId.value || secondaryPaneSessionId.value === primaryPaneSessionId.value) {
      const other = desktopSessions.value.find((item) => item.id !== primaryPaneSessionId.value);
      if (other) {
        secondaryPaneSessionId.value = other.id;
      } else {
        await createDesktopTerminal();
        secondaryPaneSessionId.value = activeDesktopSessionId.value || primaryPaneSessionId.value;
      }
    }
    await nextTick();
    await initDesktopTerminal();
    renderPaneFromBuffer("secondary");
    await syncDesktopTerminalSize();
    return;
  }
  desktopSplit.value = false;
  disposeDesktopPaneTerminal("secondary");
  secondaryPaneSessionId.value = "";
  activeDesktopPane.value = "primary";
  ensureActiveSessionFromPane();
  await nextTick();
  await syncDesktopTerminalSize();
};

const closeDesktopTerminal = async (sid) => {
  if (!isDesktopPty.value) {
    return;
  }
  closeDesktopTabContextMenu();
  const targetId = String(sid || "");
  if (!targetId) {
    return;
  }
  await killTerminalSession(targetId);
  desktopSessions.value = desktopSessions.value.filter((item) => item.id !== targetId);
  desktopSessionBuffers.delete(targetId);
  await normalizeDesktopPanes();

  if (!desktopSessions.value.length) {
    await createDesktopTerminal();
    return;
  }
  renderPaneFromBuffer("primary");
  if (desktopSplit.value) {
    renderPaneFromBuffer("secondary");
    if (activeDesktopPane.value !== "secondary") {
      focusDesktopPane("primary");
    } else {
      focusDesktopPane("secondary");
    }
    return;
  }
  focusDesktopPane("primary");
};

const terminateCurrentTerminal = async () => {
  try {
    if (isDesktopPty.value) {
      const sid = paneSessionIdOf(activeDesktopPane.value) || activeDesktopSessionId.value;
      if (sid) {
        await closeDesktopTerminal(sid);
      }
      return;
    }
    await stopExecution();
  } finally {
    closeTerminal();
  }
};

const syncDesktopFullscreenState = async () => {
  if (!desktopWindowBridge?.isFullscreen) {
    desktopFullscreen.value = false;
    return;
  }
  desktopFullscreen.value = Boolean(await desktopWindowBridge.isFullscreen());
};

const applyDesktopFullscreenForMode = async (nextMode) => {
  if (!desktopWindowBridge?.setFullscreen) {
    desktopFullscreen.value = false;
    return;
  }
  try {
    const result = await desktopWindowBridge.setFullscreen(nextMode === "view");
    if (typeof result?.fullscreen === "boolean") {
      desktopFullscreen.value = result.fullscreen;
      return;
    }
  } catch {
    // fall back to explicit state sync
  }
  await syncDesktopFullscreenState();
};

const syncDesktopMaximizeState = async () => {
  if (!desktopWindowBridge?.isMaximized) {
    windowIsMaximized.value = false;
    return;
  }
  try {
    windowIsMaximized.value = Boolean(await desktopWindowBridge.isMaximized());
  } catch {
    windowIsMaximized.value = false;
  }
};

const bindDesktopWindowMaximizeListener = () => {
  if (!desktopWindowBridge?.onMaximizedChanged) {
    return;
  }
  if (desktopWindowMaximizeOff) {
    desktopWindowMaximizeOff();
    desktopWindowMaximizeOff = null;
  }
  desktopWindowMaximizeOff = desktopWindowBridge.onMaximizedChanged((payload) => {
    if (typeof payload?.maximized === "boolean") {
      windowIsMaximized.value = payload.maximized;
      return;
    }
    void syncDesktopMaximizeState();
  });
};

const handleWindowMinimize = () => {
  if (isDesktopWindowControls && desktopWindowBridge?.minimize) {
    void desktopWindowBridge.minimize();
    return;
  }
  minimizeTerminalPanel();
};

const handleWindowToggleMaximize = async () => {
  if (isDesktopWindowControls && desktopWindowBridge?.toggleMaximize) {
    try {
      const result = await desktopWindowBridge.toggleMaximize();
      if (typeof result?.maximized === "boolean") {
        windowIsMaximized.value = result.maximized;
      } else {
        await syncDesktopMaximizeState();
      }
    } catch {
      await syncDesktopMaximizeState();
    }
    return;
  }
  toggleTerminalMaximize();
};

const handleWindowClose = () => {
  if (isDesktopWindowControls && desktopWindowBridge?.close) {
    void desktopWindowBridge.close();
    return;
  }
  closeTerminal();
};

const handleChromeDragMouseDown = (event) => {
  if (event.button !== 0) {
    return;
  }
  if (!desktopFullscreen.value && !windowIsMaximized.value) {
    return;
  }
  if (!desktopWindowBridge?.dragFromMaximized) {
    return;
  }
  void desktopWindowBridge.dragFromMaximized({
    screenX: Number(event.screenX || 0),
    screenY: Number(event.screenY || 0),
    clientX: Number(event.clientX || 0),
    viewportWidth: Number(window.innerWidth || 1)
  }).then(() => {
    void syncDesktopFullscreenState();
    void syncDesktopMaximizeState();
  });
};

const applyXtermTheme = () => {
  const xtermTheme = resolvedXtermTheme.value;
  for (const pane of ["primary", "secondary"]) {
    const term = termOf(pane);
    if (term) {
      term.options.theme = xtermTheme;
    }
  }
};

watch([activeThemeId, importedThemes, resolvedXtermTheme], () => {
  applyXtermTheme();
}, { deep: true });

const releasePasteShortcutLocks = () => {
  panePasteShortcutLock.primary = false;
  panePasteShortcutLock.secondary = false;
  panePasteHotkeyAt.primary = 0;
  panePasteHotkeyAt.secondary = 0;
};

const disposeDesktopPaneTerminal = (pane) => {
  const host = paneHostOf(pane);
  if (host && paneContextHandlers[pane]) {
    host.removeEventListener("contextmenu", paneContextHandlers[pane]);
    paneContextHandlers[pane] = null;
  }
  if (host && panePasteHandlers[pane]) {
    host.removeEventListener("paste", panePasteHandlers[pane], true);
    panePasteHandlers[pane] = null;
  }
  if (host && paneFocusHandlers[pane]) {
    host.removeEventListener("mousedown", paneFocusHandlers[pane], true);
    paneFocusHandlers[pane] = null;
  }
  panePasteShortcutLock[pane] = false;
  panePasteHotkeyAt[pane] = 0;
  if (paneInputs[pane]) {
    paneInputs[pane].dispose();
    paneInputs[pane] = null;
  }
  if (paneTerminals[pane]) {
    paneTerminals[pane].dispose();
    paneTerminals[pane] = null;
  }
  if (host) {
    host.innerHTML = "";
  }
  paneFits[pane] = null;
};

const disposeDesktopTerminal = () => {
  disposeDesktopPaneTerminal("primary");
  disposeDesktopPaneTerminal("secondary");
  if (xtermStreamOff) {
    xtermStreamOff();
    xtermStreamOff = null;
  }
};

const shouldSkipDuplicatePaste = (sid, text) => {
  const now = Date.now();
  if (
    pasteGuard.sessionId === sid &&
    pasteGuard.text === text &&
    now - pasteGuard.ts < 280
  ) {
    return true;
  }
  pasteGuard.sessionId = sid;
  pasteGuard.text = text;
  pasteGuard.ts = now;
  return false;
};

const pasteClipboardToPane = async (pane) => {
  const sid = paneSessionIdOf(pane);
  if (!sid) {
    return;
  }
  try {
    const text = await readDesktopClipboard();
    if (!text) {
      return;
    }
    if (shouldSkipDuplicatePaste(sid, text)) {
      return;
    }
    const term = termOf(pane);
    if (term && typeof term.paste === "function") {
      term.paste(text);
      return;
    }
    await writeTerminalRaw(text, sid);
  } catch {
    // ignore
  }
};

const copyPaneSelection = async (pane) => {
  const term = termOf(pane);
  if (!term || !term.hasSelection()) {
    return false;
  }
  const selected = term.getSelection();
  if (!selected) {
    return false;
  }
  await writeDesktopClipboard(selected);
  term.clearSelection();
  return true;
};

const renderPaneFromBuffer = (pane) => {
  const term = termOf(pane);
  if (!term) {
    return;
  }
  term.reset();
  const sid = paneSessionIdOf(pane);
  if (!sid) {
    return;
  }
  const snapshot = desktopSessionBuffers.get(sid) || "";
  if (snapshot) {
    term.write(snapshot);
  }
};

const ensureDesktopStream = () => {
  if (xtermStreamOff) {
    return;
  }
  xtermStreamOff = onTerminalData((payload) => {
    if (!payload || !payload.sessionId) {
      return;
    }
    appendDesktopBuffer(payload.sessionId, payload.data);

    if (payload.stream === "meta" && payload.data.includes("[exit]")) {
      desktopSessions.value = desktopSessions.value.filter((item) => item.id !== payload.sessionId);
      void normalizeDesktopPanes();
    }

    for (const pane of visiblePanes.value) {
      const term = termOf(pane);
      if (!term) {
        continue;
      }
      if (paneSessionIdOf(pane) === payload.sessionId) {
        term.write(payload.data);
      }
    }
  });
};

const buildPaneTerminal = async (pane) => {
  if (!isDesktopPty.value) {
    return;
  }
  paneBuildQueues[pane] = paneBuildQueues[pane]
    .catch(() => {})
    .then(async () => {
      try {
        let host = paneHostOf(pane);
        if (!host) {
          return;
        }
        const existing = termOf(pane);
        if (existing && host.querySelector(".xterm")) {
          return;
        }
        disposeDesktopPaneTerminal(pane);
        host = paneHostOf(pane);
        if (!host) {
          return;
        }

        const term = new XTermTerminal({
          fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
          fontSize: 13,
          lineHeight: 1.45,
          cursorBlink: true,
          convertEol: false,
          rightClickSelectsWord: true,
          allowTransparency: false,
          theme: resolvedXtermTheme.value
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(host);
        const xtermNodes = host.querySelectorAll(":scope > .xterm");
        if (xtermNodes.length > 1) {
          for (let i = 0; i < xtermNodes.length - 1; i += 1) {
            xtermNodes[i].remove();
          }
        }
        term.options.theme = resolvedXtermTheme.value;
        fit.fit();

        term.attachCustomKeyEventHandler((ev) => {
          const key = String(ev.key || "").toLowerCase();
          const ctrlOrCmd = ev.ctrlKey || ev.metaKey;

          if (ev.type === "keyup" && ["control", "meta", "shift"].includes(key)) {
            panePasteShortcutLock[pane] = false;
          }

          if ((ctrlOrCmd && key === "v") || (ev.shiftKey && key === "insert")) {
            if (ev.type === "keydown") {
              const now = Date.now();
              if (ev.repeat || panePasteShortcutLock[pane]) {
                return false;
              }
              if (now - panePasteHotkeyAt[pane] < 260) {
                return false;
              }
              panePasteHotkeyAt[pane] = now;
              panePasteShortcutLock[pane] = true;
              void pasteClipboardToPane(pane);
            }
            return false;
          }

          if (ctrlOrCmd && key === "c") {
            if (term.hasSelection()) {
              if (ev.type === "keydown") {
                void copyPaneSelection(pane);
              }
              return false;
            }
            return true;
          }
          return true;
        });

        paneContextHandlers[pane] = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (term.hasSelection()) {
            void copyPaneSelection(pane);
            return;
          }
          void pasteClipboardToPane(pane);
        };
        host.addEventListener("contextmenu", paneContextHandlers[pane]);

        panePasteHandlers[pane] = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (panePasteShortcutLock[pane]) {
            return;
          }
          panePasteShortcutLock[pane] = true;
          void pasteClipboardToPane(pane).finally(() => {
            // native paste path has no modifier key-up; release lock in micro-delay
            setTimeout(() => {
              panePasteShortcutLock[pane] = false;
            }, 60);
          });
        };
        host.addEventListener("paste", panePasteHandlers[pane], true);

        paneInputs[pane] = term.onData((data) => {
          const sid = paneSessionIdOf(pane);
          if (!sid) {
            return;
          }
          void writeTerminalRaw(data, sid);
        });

        paneFocusHandlers[pane] = () => {
          activeDesktopPane.value = pane;
          ensureActiveSessionFromPane();
        };
        host.addEventListener("mousedown", paneFocusHandlers[pane], true);

        paneTerminals[pane] = term;
        paneFits[pane] = fit;
        renderPaneFromBuffer(pane);
      } catch (err) {
        const detail = String(err);
        showToast(`终端初始化失败: ${detail}`);
      }
    });
  return paneBuildQueues[pane];
};

const syncDesktopTerminalSize = async () => {
  if (!isDesktopPty.value) {
    return;
  }
  for (const pane of visiblePanes.value) {
    const term = termOf(pane);
    const fit = fitOf(pane);
    const sid = paneSessionIdOf(pane);
    if (!term || !fit || !sid) {
      continue;
    }
    fit.fit();
    const cols = Math.max(2, term.cols || 80);
    const rows = Math.max(1, term.rows || 24);
    await resizeTerminalSession(cols, rows, sid);
  }
};

const requestDesktopTerminalSizeSync = (delay = 0) => {
  if (!isDesktopPty.value || !terminalOpen.value || terminalTab.value !== "terminal") {
    return;
  }
  if (terminalResizeSyncTimer) {
    clearTimeout(terminalResizeSyncTimer);
    terminalResizeSyncTimer = null;
  }
  terminalResizeSyncTimer = setTimeout(() => {
    terminalResizeSyncTimer = null;
    void nextTick(() => {
      void syncDesktopTerminalSize();
    });
  }, Math.max(0, Number(delay || 0)));
};

const initDesktopTerminal = async () => {
  if (!isDesktopPty.value || !terminalOpen.value || terminalTab.value !== "terminal") {
    return;
  }
  ensureDesktopStream();
  if (!desktopSessions.value.length) {
    await createDesktopTerminal();
  }
  await normalizeDesktopPanes();
  await nextTick();
  await buildPaneTerminal("primary");
  if (desktopSplit.value) {
    await buildPaneTerminal("secondary");
  }
  renderPaneFromBuffer("primary");
  if (desktopSplit.value) {
    renderPaneFromBuffer("secondary");
  }
  focusDesktopPane(activeDesktopPane.value);
  await syncDesktopTerminalSize();
};

const getTerminalMaxHeight = () => {
  const mainEl = mainRef.value;
  if (!mainEl) {
    return Math.max(280, window.innerHeight - 120);
  }
  const mainH = mainEl.getBoundingClientRect().height;
  return Math.max(280, Math.floor(mainH));
};

const scrollTerminalToBottom = () => {
  const el = terminalViewportRef.value;
  if (!el) {
    return;
  }
  el.scrollTop = el.scrollHeight;
};

watch(termLog, () => {
  if (isDesktopPty.value) {
    return;
  }
  nextTick(scrollTerminalToBottom);
}, { deep: true });

watch(terminalOpen, (open) => {
  if (open && !isDesktopPty.value) {
    nextTick(scrollTerminalToBottom);
  }
});

watch(importedThemes, () => {
  if (activeImportedTheme.value) {
    applyThemePreference();
    return;
  }
  persistThemePrefs();
}, { deep: true });

watch([currentId, mode, terminalMaximized, terminalOpen, terminalPanelHeight], () => {
  nextTick(() => {
    refreshContentProgress();
  });
});

watch(viewModeMarkdown, () => {
  nextTick(() => {
    refreshContentProgress();
    if (pendingPreviewHeadingSlug.value) {
      scrollPreviewHeadingIntoView(pendingPreviewHeadingSlug.value);
      pendingPreviewHeadingSlug.value = "";
    }
  });
});

watch([terminalOpen, terminalTab], async ([open, tab]) => {
  if (!isDesktopPty.value) {
    return;
  }
  if (open && tab === "terminal") {
    await nextTick();
    await initDesktopTerminal();
    await syncDesktopTerminalSize();
    focusDesktopPane(activeDesktopPane.value);
    return;
  }
  disposeDesktopTerminal();
});

watch(gestureNavigationEnabled, (enabled) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(GESTURE_NAV_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failure
  }
});

watch(collapseHeaderInView, (enabled) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(VIEW_HEADER_COLLAPSE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failure
  }
});

watch(collapseStepsSidebarInView, (enabled) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(VIEW_STEPS_SIDEBAR_COLLAPSE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failure
  }
});

watch(appLanguage, (nextLanguage) => {
  const normalized = normalizeAppLanguage(nextLanguage);
  if (normalized !== appLanguage.value) {
    appLanguage.value = normalized;
    return;
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = normalized;
  }
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // ignore storage failure
  }
  refreshDesktopSessionLanguageLabels();
}, { immediate: true });

watch(storageTree, () => {
  ensureSelectedStorageNodeValid();
  persistStorageState();
}, { deep: true });

watch(storageFolderExpandedMap, () => {
  persistStorageState();
}, { deep: true });

watch(selectedStorageNodeId, () => {
  ensureSelectedStorageNodeValid();
  persistStorageState();
});

watch(editorTabs, () => {
  if (restoringEditorTabs) {
    return;
  }
  persistStorageState();
}, { deep: true });

watch(activeEditorTabId, () => {
  if (restoringEditorTabs) {
    return;
  }
  persistStorageState();
});

watch(editorHeadingOutline, (outline) => {
  const validIds = new Set(
    (Array.isArray(outline) ? outline : [])
      .map((heading) => String(heading?.id || ""))
      .filter(Boolean)
  );
  collapsedOutlineHeadingIds.value = collapsedOutlineHeadingIds.value.filter((id) => validIds.has(String(id || "")));
}, { deep: true });

watch(storageSortMode, (mode) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_SORT_MODE_STORAGE_KEY, normalizeStorageSortMode(mode));
  } catch {
    // ignore storage failure
  }
});

watch([isFileSidebarCollapsed, isFileSidebarHidden], ([collapsed, hidden]) => {
  if (collapsed || hidden) {
    closeStorageSortMenu();
    closeWorkspaceFooterPanel();
  }
});

watch(
  [workspaceMarkdownFiles, activeMarkdownRelPath, documentMarkdown],
  () => {
    scheduleWikiLinkIndexRebuild();
  },
  { deep: true }
);

watch([terminalPanelHeight, terminalMaximized], () => {
  if (!isDesktopPty.value || !terminalOpen.value || terminalTab.value !== "terminal") {
    return;
  }
  requestDesktopTerminalSizeSync(terminalDragSizing ? 180 : 30);
});

watch([desktopSplit, primaryPaneSessionId, secondaryPaneSessionId], async () => {
  if (!isDesktopPty.value || !terminalOpen.value || terminalTab.value !== "terminal") {
    return;
  }
  await nextTick();
  await buildPaneTerminal("primary");
  if (desktopSplit.value) {
    await buildPaneTerminal("secondary");
  }
  renderPaneFromBuffer("primary");
  if (desktopSplit.value) {
    renderPaneFromBuffer("secondary");
  }
  await syncDesktopTerminalSize();
});

const openWorkspaceGraph = () => {
  activeEditorTabId.value = ensureWorkspaceGraphTab();
  scheduleWikiLinkIndexRebuild();
};

const closeWorkspaceGraph = () => {
  void closeEditorTab(EDITOR_GRAPH_TAB_ID);
};

const handleWorkspaceGraphOpenNote = (relPathInput = "") => {
  void openMarkdownFileByRelPath(relPathInput, {
    showMissingToast: true
  });
};

const normalizeWorkspaceMode = (modeInput = "") => {
  const normalized = String(modeInput || "").trim().toLowerCase();
  if (normalized === "source" || normalized === "view") {
    return normalized;
  }
  return "preview";
};

const setWorkspaceMode = async (nextModeInput = "") => {
  let nextMode = normalizeWorkspaceMode(nextModeInput);
  if (nextMode === "source" && !canUseSourceMode.value) {
    nextMode = "preview";
  }
  if (nextMode === "view" && !canUsePresentMode.value) {
    nextMode = "preview";
  }
  if (mode.value === nextMode) {
    return;
  }
  if (nextMode === "view") {
    editorTabs.value = ensureEditorTabs(editorTabs.value.filter((tab) => tab.kind !== "graph"));
    if (activeEditorTabId.value === EDITOR_GRAPH_TAB_ID) {
      const currentRelPath = normalizeRelPath(activeMarkdownRelPath.value);
      activeEditorTabId.value = currentRelPath ? ensureEditorFileTab(currentRelPath) : "";
    }
    await flushPendingMarkdownSave();
  }
  mode.value = nextMode;
  await applyDesktopFullscreenForMode(nextMode);
  nextTick(() => {
    void syncDesktopTerminalSize();
  });
};

const toggleMode = async () => {
  await setWorkspaceMode(mode.value === "view" ? "preview" : "view");
};

const requestEditorContextImageMarkdown = async () => {
  if (!(isDesktopPty.value && desktopWindowBridge?.pickImage)) {
    showToast("当前环境不支持直接插入图片");
    return "";
  }
  try {
    const picked = await desktopWindowBridge.pickImage();
    if (!picked || picked.canceled) {
      return "";
    }
    if (picked.ok && picked.markdownUrl) {
      showToast("已插入图片");
      return serializeImageLine({
        alt: "image",
        src: picked.markdownUrl
      });
    }
    showToast(`插入失败: ${picked?.error || "unknown_error"}`);
  } catch (error) {
    showToast(`插入失败: ${error?.message || "unknown_error"}`);
  }
  return "";
};

const handleEditorContextSettingCommand = async (commandIdInput = "") => {
  const commandId = String(commandIdInput || "");
  if (commandId === "editor-width-narrower") {
    adjustVisualEditorWidth(-80);
    return true;
  }
  if (commandId === "editor-width-wider") {
    adjustVisualEditorWidth(80);
    return true;
  }
  if (commandId === "editor-width-reset") {
    resetDisplayWidth();
    return true;
  }
  if (commandId === "editor-debug-toggle") {
    showEditorDebugPanel.value = !showEditorDebugPanel.value;
    return true;
  }
  return false;
};

const handleWorkspaceFooterEditorSetting = async (commandIdInput = "") => {
  await handleEditorContextSettingCommand(commandIdInput);
};

const buildPdfExportCss = () => {
  if (typeof window === "undefined") {
    return "";
  }
  const root = document.getElementById("app") || document.documentElement;
  const styles = window.getComputedStyle(root);
  const readVar = (name, fallback = "") => String(styles.getPropertyValue(name) || fallback).trim() || fallback;
  return `
    :root {
      color-scheme: ${currentThemeMode.value};
      --pdf-bg: ${readVar("--yc-bg-panel", "#ffffff")};
      --pdf-text: ${readVar("--yc-text-secondary", "#334155")};
      --pdf-heading: ${readVar("--yc-heading-color", readVar("--yc-text-primary", "#0f172a"))};
      --pdf-link: ${readVar("--yc-link", "#46617f")};
      --pdf-link-decoration: ${readVar("--yc-link-decoration", "rgba(70, 97, 127, 0.46)")};
      --pdf-code-bg: ${readVar("--yc-preview-code-inline-bg", "#f3f6fa")};
      --pdf-code-color: ${readVar("--yc-preview-code-inline-color", "#0f172a")};
      --pdf-table-wrap-border: ${readVar("--yc-preview-table-wrap-border", "#dbe4ec")};
      --pdf-table-wrap-bg: ${readVar("--yc-preview-table-wrap-bg", "#ffffff")};
      --pdf-table-cell-border: ${readVar("--yc-preview-table-cell-border", "#dbe4ec")};
      --pdf-table-head-bg: ${readVar("--yc-preview-table-head-bg", "#f3f6fa")};
      --pdf-table-head-color: ${readVar("--yc-preview-table-head-color", "#0f172a")};
      --pdf-blockquote-border: ${readVar("--yc-blockquote-border", readVar("--yc-blockquote-accent", "#94a3b8"))};
      --pdf-blockquote-color: ${readVar("--yc-blockquote-color", "#334155")};
      --pdf-mark-bg: ${readVar("--yc-mark-bg", "rgba(255, 221, 51, 0.78)")};
      --pdf-mark-shadow: ${readVar("--yc-mark-shadow", "rgba(234, 179, 8, 0.42)")};
      --pdf-annotation: ${readVar("--yc-annotation-color", readVar("--yc-link", "#46617f"))};
      --pdf-annotation-bg: ${readVar("--yc-annotation-bg", "rgba(70, 97, 127, 0.1)")};
      --pdf-wikilink: ${readVar("--yc-wikilink-color", readVar("--yc-link", "#46617f"))};
      --pdf-wikilink-decoration: ${readVar("--yc-wikilink-decoration", readVar("--yc-link-decoration", "rgba(70, 97, 127, 0.46)"))};
    }
    body {
      background: var(--pdf-bg);
      color: var(--pdf-text);
      font-family: ${readVar("--yc-font-body", "\"PingFang SC\", \"Microsoft YaHei\", sans-serif")};
      font-size: ${readVar("--yc-preview-font-size", "14px")};
      line-height: ${readVar("--yc-preview-line-height", "1.8")};
      padding: 32px 40px 40px;
    }
    .markdown-render { color: var(--pdf-text); }
    .markdown-render h1, .markdown-render h2, .markdown-render h3, .markdown-render h4, .markdown-render h5, .markdown-render h6 {
      color: var(--pdf-heading);
      font-family: ${readVar("--yc-font-heading", "\"PingFang SC\", \"Microsoft YaHei\", sans-serif")};
    }
    .markdown-render a,
    .markdown-render .wiki-link {
      color: var(--pdf-wikilink);
      text-decoration: underline;
      text-decoration-color: var(--pdf-wikilink-decoration);
      background: transparent;
    }
    .markdown-render code {
      background: var(--pdf-code-bg);
      color: var(--pdf-code-color);
      border-radius: ${readVar("--yc-preview-code-inline-radius", "6px")};
      padding: ${readVar("--yc-preview-code-inline-padding", "0.1em 0.35em")};
    }
    .markdown-render pre {
      overflow: hidden;
      border-radius: ${readVar("--yc-preview-code-block-radius", "10px")};
    }
    .markdown-render .md-table-wrap {
      border: 1px solid var(--pdf-table-wrap-border);
      border-radius: 12px;
      background: var(--pdf-table-wrap-bg);
      overflow: hidden;
    }
    .markdown-render .md-table-wrap table { width: 100%; border-collapse: collapse; }
    .markdown-render .md-table-wrap th,
    .markdown-render .md-table-wrap td {
      border-right: 1px solid var(--pdf-table-cell-border);
      border-bottom: 1px solid var(--pdf-table-cell-border);
      padding: 0.52rem 0.68rem;
      text-align: left;
      vertical-align: top;
    }
    .markdown-render .md-table-wrap th {
      background: var(--pdf-table-head-bg);
      color: var(--pdf-table-head-color);
    }
    .markdown-render blockquote {
      border-left: 3px solid var(--pdf-blockquote-border);
      color: var(--pdf-blockquote-color);
      padding-left: 0.92rem;
      margin-left: 0;
    }
    .markdown-render mark {
      background: var(--pdf-mark-bg);
      box-shadow: inset 0 0 0 1px var(--pdf-mark-shadow);
      border-radius: 4px;
      padding: 0 0.12em;
    }
    .markdown-render sup, .markdown-render sub, .markdown-render sup a, .markdown-render sub a {
      color: var(--pdf-annotation);
    }
    .markdown-render sup a, .markdown-render sub a {
      background: var(--pdf-annotation-bg);
      text-decoration: none;
      border-radius: 999px;
      padding: 0 0.28em;
    }
    img { max-width: 100%; height: auto; break-inside: avoid; }
    @page { margin: 16mm 14mm; }
  `;
};

const handleExportCurrentDocumentPdf = async () => {
  if (!canExportCurrentDocumentPdf.value || !desktopWindowBridge?.exportPdf) {
    showToast("当前环境不支持导出 PDF");
    return;
  }
  const relPath = normalizeRelPath(activeMarkdownRelPath.value);
  if (!relPath) {
    showToast("请先打开一个 Markdown 文件");
    return;
  }
  try {
    const result = await desktopWindowBridge.exportPdf({
      title: stripMarkdownExtension(basenameOfRelPath(relPath) || "document"),
      html: `<div class="markdown-render markdown-render-${currentThemeMode.value}">${renderedMarkdown.value}</div>`,
      cssText: buildPdfExportCss()
    });
    if (result?.ok) {
      showToast(`已导出 PDF: ${String(result.filePath || "")}`);
      return;
    }
    if (!result?.canceled) {
      showToast(`导出 PDF 失败: ${String(result?.error || "unknown_error")}`);
    }
  } catch (error) {
    showToast(`导出 PDF 失败: ${String(error?.message || error || "unknown_error")}`);
  }
};

setContextMenuRuntimeOptions({
  requestImageMarkdown: requestEditorContextImageMarkdown
});

setContextMenuLocaleText(localeText);

setPresentationRuntimeOptions({
  getCurrentRelPath: () => activeMarkdownRelPath.value,
  getWorkspaceRootPath: () => storageRootPath.value
});

const openTerminalPanel = (tab = terminalTab.value) => {
  if (isDesktopPty.value && tab === "runner") {
    tab = "terminal";
  }
  terminalTab.value = tab;
  if (!terminalOpen.value) {
    terminalOpen.value = true;
    terminalMaximized.value = false;
    terminalPanelHeight.value = Math.max(terminalPanelHeight.value, 220);
  }
  void pingBridge(true);
};

const closeTerminal = () => {
  cancelDesktopRenameDialog();
  closeDesktopTabContextMenu();
  terminalOpen.value = false;
  terminalMaximized.value = false;
};

const minimizeTerminalPanel = () => {
  if (!terminalOpen.value) {
    openTerminalPanel(terminalTab.value);
  }
  terminalOpen.value = true;
  terminalMaximized.value = false;
  terminalPanelHeight.value = TERMINAL_MIN_HEIGHT;
};

const toggleTerminalMaximize = () => {
  if (!terminalOpen.value) {
    openTerminalPanel(terminalTab.value);
    terminalMaximized.value = true;
    terminalPanelHeight.value = getTerminalMaxHeight();
    return;
  }
  terminalMaximized.value = !terminalMaximized.value;
  if (terminalMaximized.value) {
    terminalPanelHeight.value = getTerminalMaxHeight();
  }
};

const applyTerminalDragHeight = (rawHeight) => {
  const maxH = getTerminalMaxHeight();
  if (rawHeight <= TERMINAL_HIDE_THRESHOLD) {
    closeTerminal();
    return;
  }
  if (rawHeight >= maxH - TERMINAL_MAX_SNAP_GAP) {
    terminalOpen.value = true;
    terminalMaximized.value = true;
    terminalPanelHeight.value = maxH;
    return;
  }
  terminalOpen.value = true;
  terminalMaximized.value = false;
  terminalPanelHeight.value = clamp(Math.round(rawHeight), TERMINAL_MIN_HEIGHT, maxH);
};

const measureTerminalHeightFromClientY = (clientYInput) => {
  const clientY = Number(clientYInput || 0);
  return Math.max(0, Math.round(window.innerHeight - clientY));
};

const resizeTerminalFrom = () => {
  terminalDragSizing = true;
  document.body.style.userSelect = "none";

  if (terminalResizeMoveHandler) {
    window.removeEventListener("mousemove", terminalResizeMoveHandler);
    terminalResizeMoveHandler = null;
  }
  if (terminalResizeUpHandler) {
    window.removeEventListener("mouseup", terminalResizeUpHandler);
    terminalResizeUpHandler = null;
  }

  const onMove = (ev) => {
    applyTerminalDragHeight(measureTerminalHeightFromClientY(ev.clientY));
  };

  const onUp = () => {
    terminalDragSizing = false;
    clearBodyInteractionStyles();
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    terminalResizeMoveHandler = null;
    terminalResizeUpHandler = null;
    if (terminalOpen.value) {
      requestDesktopTerminalSizeSync(0);
      nextTick(scrollTerminalToBottom);
    }
  };

  terminalResizeMoveHandler = onMove;
  terminalResizeUpHandler = onUp;
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};

const startTerminalPullResize = (event) => {
  event.preventDefault();
  applyTerminalDragHeight(measureTerminalHeightFromClientY(event.clientY));
  resizeTerminalFrom();
};

const runTerminalCommand = async () => {
  if (isDesktopPty.value) {
    return;
  }
  if (isRunning.value) {
    return;
  }
  const command = String(cmdInput.value || "").trim();
  if (!command) {
    return;
  }
  appendLog(`${terminalPrompt.value} ${command}`);
  cmdInput.value = "";
  await runInput(command);
  await nextTick();
  scrollTerminalToBottom();
};

const onTerminalInputKeydown = (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void runTerminalCommand();
  }
};

const onKeydown = (event) => {
  if (event.defaultPrevented) {
    return;
  }

  const key = String(event.key || "").toLowerCase();
  const mod = event.ctrlKey || event.metaKey;
  const tag = document.activeElement?.tagName?.toLowerCase() || "";
  const typing = tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable;

  if (isEditMode.value && mod && key === "s") {
    event.preventDefault();
    void handleManualSaveCurrentMarkdown();
    return;
  }

  if (isEditMode.value && mod && key === "f") {
    event.preventDefault();
    getActiveMarkdownEditorApi()?.openSearch?.();
    return;
  }

  if (event.key === "Escape" && settingsWindow.value.open) {
    event.preventDefault();
    closeSettingsWindow();
    return;
  }

  if (event.key === "Escape" && !isEditMode.value) {
    event.preventDefault();
    toggleMode();
    return;
  }
  if (event.key === "Escape" && terminalOpen.value) {
    closeTerminal();
    return;
  }
  if (!typing && (event.key === "ArrowRight" || event.key === "PageDown")) {
    next();
  }
  if (!typing && (event.key === "ArrowLeft" || event.key === "PageUp")) {
    prev();
  }
};

const onGlobalPointerDown = (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest(".term-context-menu")) {
    return;
  }
  if (target instanceof Element && target.closest(".storage-sort-menu-shell")) {
    return;
  }
  if (target instanceof Element && target.closest(".workspace-footer-panel-shell")) {
    return;
  }
  closeDesktopTabContextMenu();
  closeStorageNodeContextMenu();
  closeStorageSortMenu();
  closeWorkspaceFooterPanel();
};

const onGlobalKeyup = (event) => {
  const key = String(event.key || "").toLowerCase();
  if (["control", "meta", "shift"].includes(key)) {
    releasePasteShortcutLocks();
  }
};

onMounted(() => {
  window.addEventListener("beforeunload", handleWindowBeforeUnload);
  window.addEventListener("keydown", onGlobalTermContextMenuKeydown, true);
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("keyup", onGlobalKeyup, true);
  window.addEventListener("mousedown", onGlobalPointerDown, true);
  window.addEventListener("blur", releaseTransientPointerState);
  window.addEventListener("focus", clearBodyInteractionStyles);
  window.addEventListener("blur", closeDesktopTabContextMenu);
  window.addEventListener("blur", closeStorageNodeContextMenu);
  window.addEventListener("blur", closeStorageSortMenu);
  window.addEventListener("blur", closeWorkspaceFooterPanel);
  window.addEventListener("blur", releasePasteShortcutLocks);
  window.addEventListener("resize", refreshContentProgress);
  if (isDesktopStorage) {
    const initialEditorTabsSnapshot = pendingEditorTabsRestoreSnapshot;
    void loadDesktopStorageTree().then(() => {
      void restoreEditorTabs(initialEditorTabsSnapshot);
    });
  }
  if (isDesktopPty.value) {
    terminalTab.value = "terminal";
  }
  if (desktopWindowBridge?.isFullscreen) {
    void syncDesktopFullscreenState();
  }
  if (desktopWindowBridge?.setFullscreen) {
    void desktopWindowBridge.setFullscreen(false).then(() => {
      void syncDesktopFullscreenState();
    });
  }
  if (isDesktopWindowControls) {
    void syncDesktopMaximizeState();
    bindDesktopWindowMaximizeListener();
  }
  scheduleWikiLinkIndexRebuild();
  nextTick(() => {
    refreshContentProgress();
  });
});

onBeforeUnmount(() => {
  persistStorageState();
  setContextMenuRuntimeOptions({});
  setPresentationRuntimeOptions({});
  if (typeof document !== "undefined") {
    document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove();
  }
  releaseTransientPointerState({ syncTerminal: false });
  cancelDesktopRenameDialog();
  cancelStorageRenameDialog();
  if (wikiLinkIndexTimer) {
    clearTimeout(wikiLinkIndexTimer);
    wikiLinkIndexTimer = null;
  }
  if (activeMarkdownRelPath.value && !markdownHydrating.value) {
    void flushPendingMarkdownSave(activeMarkdownRelPath.value);
  }
  disposeDesktopTerminal();
  disposeTerminal();
  if (terminalResizeSyncTimer) {
    clearTimeout(terminalResizeSyncTimer);
    terminalResizeSyncTimer = null;
  }
  window.removeEventListener("beforeunload", handleWindowBeforeUnload);
  window.removeEventListener("keydown", onGlobalTermContextMenuKeydown, true);
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("keyup", onGlobalKeyup, true);
  window.removeEventListener("mousedown", onGlobalPointerDown, true);
  window.removeEventListener("blur", releaseTransientPointerState);
  window.removeEventListener("focus", clearBodyInteractionStyles);
  window.removeEventListener("blur", closeDesktopTabContextMenu);
  window.removeEventListener("blur", closeStorageNodeContextMenu);
  window.removeEventListener("blur", closeStorageSortMenu);
  window.removeEventListener("blur", closeWorkspaceFooterPanel);
  window.removeEventListener("blur", releasePasteShortcutLocks);
  window.removeEventListener("resize", refreshContentProgress);
  if (desktopWindowMaximizeOff) {
    desktopWindowMaximizeOff();
    desktopWindowMaximizeOff = null;
  }
});
</script>
