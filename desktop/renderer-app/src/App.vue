<template>
  <div
    id="app"
    v-cloak
    class="flex h-screen min-h-0 overflow-hidden bg-[#fcfcfc] text-slate-900 flex-col"
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
      <div class="app-chrome-no-drag">
        <button
          type="button"
          class="term-window-btn term-tip-btn"
          :data-tip="isFileSidebarHidden ? '展开左边栏' : '收起左边栏'"
          :aria-label="isFileSidebarHidden ? '展开左边栏' : '收起左边栏'"
          @click="toggleFileSidebarCollapse"
        >
          <AppIcon name="panel-left" :collapsed="isFileSidebarHidden" class="chrome-icon" />
        </button>
      </div>
      <div class="editor-chrome-tabs-wrap app-chrome-no-drag">
        <div class="editor-chrome-tabs" :class="isDark ? 'is-dark' : ''">
          <button
            v-for="tab in editorTabsWithMeta"
            :key="tab.id"
            type="button"
            class="editor-tab"
            :class="activeEditorTabId === tab.id ? 'editor-tab-active' : ''"
            :title="tab.title"
            @click="switchEditorTab(tab.id)"
          >
            <span class="editor-tab-icon" aria-hidden="true">
              <AppIcon :name="tab.kind === 'graph' ? 'graph' : 'file'" class="chrome-icon" />
            </span>
            <span class="editor-tab-label">{{ tab.label }}</span>
            <span class="editor-tab-close" @mousedown.stop @click.stop="closeEditorTab(tab.id)">x</span>
          </button>
        </div>
        <button
          type="button"
          class="editor-tab-add term-tip-btn"
          data-tip="Open graph"
          aria-label="Open graph"
          @click="openWorkspaceGraph"
        >
          <AppIcon name="graph" class="chrome-icon" />
        </button>
      </div>
      <div class="app-chrome-drag" @mousedown="handleChromeDragMouseDown"></div>
      <div class="app-chrome-no-drag">
        <button
          type="button"
          class="term-window-btn term-tip-btn"
          :data-tip="isSidebarHidden ? '展开右边栏' : '收起右边栏'"
          :aria-label="isSidebarHidden ? '展开右边栏' : '收起右边栏'"
          @click="toggleSidebarCollapse"
        >
          <AppIcon name="panel-right" :collapsed="isSidebarHidden" class="chrome-icon" />
        </button>
        <button
          type="button"
          class="term-window-btn term-tip-btn"
          data-tip="最小化"
          aria-label="最小化"
          @click="handleWindowMinimize"
        >
          <AppIcon name="minimize" class="chrome-icon" />
        </button>
        <button
          type="button"
          class="term-window-btn term-tip-btn"
          :data-tip="windowIsMaximized ? '还原' : '最大化'"
          :aria-label="windowIsMaximized ? '还原' : '最大化'"
          @click="handleWindowToggleMaximize"
        >
          <AppIcon :name="windowIsMaximized ? 'restore' : 'maximize'" class="chrome-icon" />
        </button>
        <button
          type="button"
          class="term-window-btn term-window-btn-close term-tip-btn"
          data-tip="关闭"
          aria-label="关闭"
          @click="handleWindowClose"
        >
          <AppIcon name="close" class="chrome-icon" />
        </button>
      </div>
    </div>

    <div class="flex flex-1 min-h-0 min-w-0">
    <aside
      v-if="isEditMode"
      class="sidebar-panel file-sidebar-panel flex flex-col flex-shrink-0 border-r min-h-0"
      :style="{ width: `${fileSidebarPanelWidth}px` }"
      :class="[
        isFileSidebarCollapsed ? 'is-collapsed' : '',
        isFileSidebarDragging ? 'is-dragging' : '',
        isFileSidebarHidden
          ? 'is-hidden border-transparent bg-transparent'
          : (isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-[#fafafa]')
      ]"
    >
      <div
        class="border-b"
        :class="isFileSidebarCollapsed ? 'px-2 py-3' : 'px-3 py-3'"
        :style="{ borderColor: isDark ? '#1e293b' : '#e5e7eb' }"
      >
        <div :class="isFileSidebarCollapsed ? 'flex flex-col items-center gap-1.5' : 'flex items-center gap-1.5'">
          <!-- File sidebar actions and tree icons are also centralized in `AppIcon.vue`. -->
          <button
            type="button"
            class="term-window-btn term-tip-btn file-sidebar-tool-btn"
            data-tip="新建文件"
            aria-label="新建文件"
            @click="createStorageFile"
          >
            <AppIcon name="new-file" class="chrome-icon file-sidebar-icon" />
          </button>
          <button
            type="button"
            class="term-window-btn term-tip-btn file-sidebar-tool-btn"
            data-tip="新建文件夹"
            aria-label="新建文件夹"
            @click="createStorageFolder"
          >
            <AppIcon name="new-folder" class="chrome-icon file-sidebar-icon" />
          </button>
          <button
            type="button"
            class="term-window-btn term-tip-btn file-sidebar-tool-btn"
            :class="storageSortMode === 'name-desc' ? 'is-active' : ''"
            :data-tip="storageSortTooltip"
            :aria-label="storageSortTooltip"
            @click="toggleStorageSortMode"
          >
            <AppIcon :name="storageSortMode === 'name-desc' ? 'sort-desc' : 'sort-asc'" class="chrome-icon file-sidebar-icon" />
          </button>
          <button
            type="button"
            class="term-window-btn term-tip-btn file-sidebar-tool-btn"
            data-tip="关系图谱"
            aria-label="关系图谱"
            @click="openWorkspaceGraph"
          >
            <AppIcon name="graph" class="chrome-icon file-sidebar-icon" />
          </button>
        </div>
      </div>

      <nav class="flex-1 min-h-0 overflow-y-auto p-2">
        <button
          v-for="item in visibleStorageNodes"
          :key="item.id"
          type="button"
          class="w-full rounded-lg mb-1 transition-all flex items-center gap-2 text-left"
          :title="isFileSidebarCollapsed ? item.name : ''"
          :style="{ padding: '6px 8px', paddingLeft: `${8 + item.depth * 14}px` }"
          :class="selectedStorageNodeId === item.id
            ? (isDark ? 'bg-orange-500/15 text-orange-200' : 'bg-orange-50 text-orange-700')
            : (isDark ? 'text-slate-300 hover:bg-slate-900/70' : 'text-gray-700 hover:bg-gray-100')"
          @click="selectStorageNode(item.id)"
          @contextmenu.prevent.stop="openStorageNodeContextMenu($event, item.id)"
        >
          <span class="w-4 h-4 inline-flex items-center justify-center text-[11px]">
            <template v-if="item.type === 'folder'">
              <span class="file-tree-toggle" @click.stop="toggleStorageFolder(item.id)">
                <AppIcon
                  :name="isStorageFolderExpanded(item.id) ? 'chevron-down' : 'chevron-right'"
                  class="file-tree-chevron"
                />
              </span>
            </template>
            <template v-else>
              <span class="file-tree-toggle-placeholder"></span>
            </template>
          </span>
          <span class="inline-flex items-center justify-center">
            <AppIcon
              :name="item.type === 'folder' ? (isStorageFolderExpanded(item.id) ? 'folder-open' : 'folder') : 'file'"
              class="file-tree-node-icon"
            />
          </span>
          <span v-if="!isFileSidebarCollapsed" class="truncate text-xs">{{ item.name }}</span>
        </button>
      </nav>

      <div
        v-if="!isFileSidebarCollapsed"
        class="file-sidebar-footer border-t"
        :style="{ borderColor: isDark ? '#1e293b' : '#e5e7eb' }"
      >
        <div class="file-sidebar-workspace-bar" :class="isDark ? 'is-dark' : ''">
          <button
            type="button"
            class="file-sidebar-workspace-main"
            :class="isDark ? 'is-dark' : ''"
            :title="storageLocationText"
            @click="handleWorkspaceFooterPrimaryAction"
          >
            <AppIcon name="workspace-switch" class="workspace-switch-icon" />
            <span class="truncate text-sm">{{ workspaceDisplayName }}</span>
          </button>

          <div class="relative workspace-footer-panel-shell">
            <button
              type="button"
              class="term-window-btn term-tip-btn file-sidebar-tool-btn"
              data-tip="工作区信息"
              aria-label="工作区信息"
              @click.stop="toggleWorkspaceFooterPanel('info')"
            >
              <AppIcon name="info" class="chrome-icon file-sidebar-icon" />
            </button>
            <div
              v-if="workspaceFooterPanel === 'info'"
              class="workspace-footer-popover"
              :class="isDark ? 'is-dark' : ''"
            >
              <div class="workspace-footer-popover-title">工作区信息</div>
              <div class="workspace-footer-info-list">
                <div class="workspace-footer-info-row">
                  <span class="workspace-footer-info-label">名称</span>
                  <span class="workspace-footer-info-value">{{ workspaceDisplayName }}</span>
                </div>
                <div class="workspace-footer-info-row">
                  <span class="workspace-footer-info-label">统计</span>
                  <span class="workspace-footer-info-value">{{ storageStats }}</span>
                </div>
              </div>
              <p class="workspace-footer-popover-path">{{ storageLocationText }}</p>
            </div>
          </div>

          <div class="relative workspace-footer-panel-shell">
            <button
              type="button"
              class="term-window-btn term-tip-btn file-sidebar-tool-btn"
              data-tip="工作区设置"
              aria-label="工作区设置"
              @click.stop="toggleWorkspaceFooterPanel('settings')"
            >
              <AppIcon name="settings" class="chrome-icon file-sidebar-icon" />
            </button>
            <div
              v-if="workspaceFooterPanel === 'settings'"
              class="workspace-footer-popover workspace-footer-actions"
              :class="isDark ? 'is-dark' : ''"
            >
              <button
                v-if="canPickWorkspaceRoot"
                type="button"
                class="workspace-footer-action"
                :class="isDark ? 'is-dark' : ''"
                @click="handleWorkspaceFooterSwitch"
              >
                <AppIcon name="workspace-switch" class="workspace-footer-action-icon" />
                <span>切换工作区</span>
              </button>
              <button
                v-if="canOpenWorkspaceRoot"
                type="button"
                class="workspace-footer-action"
                :class="isDark ? 'is-dark' : ''"
                @click="handleWorkspaceFooterOpenDir"
              >
                <AppIcon name="open-folder" class="workspace-footer-action-icon" />
                <span>打开当前目录</span>
              </button>
              <p
                v-if="!canPickWorkspaceRoot && !canOpenWorkspaceRoot"
                class="workspace-footer-empty"
              >
                当前环境不支持工作区设置
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <div
      v-if="isEditMode"
      class="sidebar-resize-handle file-sidebar-resize-handle flex-shrink-0"
      :class="[
        isFileSidebarHidden ? 'is-hidden' : '',
        isDark ? 'is-dark' : ''
      ]"
      @mousedown="startFileSidebarResizeDrag"
    >
      <div class="sidebar-resize-line"></div>
    </div>

    <main ref="mainRef" class="relative flex-1 min-w-0 min-h-0 flex flex-col" :class="isDark ? 'bg-slate-950' : 'bg-white'">
      <header
        v-if="!isEditMode"
        class="sticky top-0 z-30 px-10 py-5 border-b flex justify-between items-center backdrop-blur"
        :class="isDark ? 'border-slate-800 bg-slate-950/80' : 'border-gray-100 bg-white/80'"
        :style="viewHeaderStyle"
      >
        <div class="header-meta header-meta-inline min-w-0 flex-1">
          <span class="header-meta-title">{{ stepDisplayTitle(activeStep, currentStepIndex) }}</span>
          <span class="header-meta-dot">·</span>
          <span class="header-meta-sub header-meta-sub-inline">{{ activeStep.subtitle || stepPreviewText(activeStep) }}</span>
        </div>
        <div class="flex items-center gap-2 sm:gap-3 flex-nowrap shrink-0">
          <span class="header-meta-page">第 {{ currentStepIndex + 1 }} / {{ steps.length }} 页</span>
        </div>
      </header>

      <section
        v-show="!terminalMaximized"
        ref="contentScrollRef"
        class="flex-1 min-h-0"
        :class="[
          isDark ? 'bg-slate-950' : 'bg-white',
          isEditMode && isWorkspaceGraphTabActive ? 'overflow-hidden' : 'overflow-y-auto'
        ]"
        @scroll.passive="onContentScroll"
      >
        <div
          class="relative w-full"
          :class="[
            !isEditMode
              ? 'mx-auto max-w-none px-10 py-10'
              : (isWorkspaceGraphTabActive
                ? 'h-full px-0 py-0'
                : 'mx-auto max-w-6xl px-10 py-10')
          ]"
        >
          <transition name="fade" mode="out-in">
            <div :key="contentPaneKey" class="flex flex-col" :class="isEditMode && isWorkspaceGraphTabActive ? 'h-full' : ''">
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
                  <div
                    data-preview="1"
                    class="markdown-render"
                    :class="isDark ? 'markdown-render-dark' : 'markdown-render-light'"
                    v-html="renderedMarkdown"
                  ></div>
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
                v-else
                class="min-h-[520px] flex flex-col"
              >
                <div class="px-1 pb-4 flex flex-col items-start gap-3">
                  <span class="text-sm font-medium" :class="isDark ? 'text-slate-100' : 'text-gray-700'">Markdown 编辑</span>
                  <div class="flex w-full items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      class="px-2 py-1 text-xs rounded-lg transition-all"
                      :class="isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'"
                      @mousedown.prevent
                      @click="insertImageToMarkdown"
                    >
                      插入图片
                    </button>
                    <button
                      v-if="isDesktopPty"
                      type="button"
                      class="px-2 py-1 text-xs rounded-lg transition-all"
                      :class="isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'"
                      @mousedown.prevent
                      @click="openDesktopImageFolder"
                    >
                      图片目录
                    </button>
                    <button
                      type="button"
                      class="px-2 py-1 text-xs rounded-lg transition-all"
                      :class="isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'"
                      @mousedown.prevent
                      @click="adjustVisualEditorWidth(-80)"
                    >
                      更窄
                    </button>
                    <button
                      type="button"
                      class="px-2 py-1 text-xs rounded-lg transition-all"
                      :class="isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'"
                      @mousedown.prevent
                      @click="adjustVisualEditorWidth(80)"
                    >
                      更宽
                    </button>
                    <span class="text-xs font-mono px-2 py-1 rounded-lg" :class="isDark ? 'bg-slate-800 text-slate-300' : 'bg-gray-200 text-gray-600'">
                      {{ displayWidth }}px
                    </span>
                    <button
                      type="button"
                      class="px-2 py-1 text-xs rounded-lg transition-all"
                      :class="isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'"
                      @mousedown.prevent
                      @click="resetDisplayWidth"
                    >
                      重置宽度
                    </button>
                    <button
                      type="button"
                      class="px-2 py-1 text-xs rounded-lg transition-all"
                      :class="isDark ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/40' : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'"
                      @mousedown.prevent
                      @click="handleManualSaveCurrentMarkdown"
                    >
                      保存
                    </button>
                    <span class="text-xs px-2 py-1 rounded-lg"
                      :class="saveStatusChipClass"
                      :title="saveStatusTooltip"
                    >
                      {{ saveStatusLabel }}
                    </span>
                    <span class="text-xs px-2 py-1 rounded-lg border"
                      :class="isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-gray-100 text-gray-700 border-gray-200'"
                      :title="currentBlockDebugTitle"
                    >
                      {{ currentBlockLabel }}
                    </span>
                    <span class="text-xs px-2 py-1 rounded-lg border"
                      :class="isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-gray-100 text-gray-700 border-gray-200'"
                    >
                      Outline {{ semanticOutline.length }}
                    </span>
                  </div>
                  <div
                    class="w-full rounded-lg border px-2 py-2 text-[11px] font-mono leading-5 max-h-44 overflow-auto"
                    :class="isDark ? 'bg-slate-900/70 text-slate-200 border-slate-700' : 'bg-gray-50 text-slate-700 border-gray-200'"
                  >
                    <div class="flex items-center gap-2 flex-wrap mb-1">
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

                <div class="relative flex-1 overflow-y-auto py-2">
                  <div class="mx-auto" :style="displayStyle">
                    <EditorShell
                      ref="markdownEditorRef"
                      :model-value="documentMarkdown"
                      :dark="isDark"
                      :presentation-blocks="semanticBlocks"
                      :current-block-id="currentSemanticBlockId"
                      :current-rel-path="activeMarkdownRelPath"
                      :wiki-link-files="workspaceMarkdownFiles"
                      :wiki-link-suggestions="getWikiLinkSuggestions"
                      :wiki-link-suggestion-select="handleWikiLinkSuggestionSelect"
                      @selection-change="handleEditorSelectionChange"
                      @update:model-value="updateMarkdown"
                      @wiki-link-activate="handleEditorWikiLinkActivate"
                      @external-link-activate="handleEditorExternalLinkActivate"
                    />
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
        <footer
          v-if="!(gestureNavigationEnabled && !isEditMode) && !isWorkspaceGraphTabActive"
          class="px-10 py-6 border-t flex items-center justify-center"
          :class="isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-100 bg-white'"
        >
          <div class="flex items-center gap-6">
            <button
              @click="prev"
              :disabled="isFirstStep"
              class="px-8 py-2 border rounded-full text-sm disabled:opacity-30 transition-all"
              :class="isDark ? 'border-slate-800 hover:bg-slate-900 text-slate-100' : 'border-gray-200 hover:bg-gray-50 text-gray-800'"
            >
              ← 上一步
            </button>
            <button
              @click="next"
              :disabled="isLastStep"
              class="px-8 py-2 bg-orange-500 text-white rounded-full text-sm font-medium shadow-lg shadow-orange-200 hover:bg-orange-600 disabled:opacity-30 transition-all"
            >
              {{ isLastStep ? '已完成' : '下一步 →' }}
            </button>
          </div>
        </footer>
      </section>

      <section
        v-if="terminalOpen"
        class="term-shell border-t min-h-0 flex flex-col"
        :class="[
          terminalMaximized ? 'term-shell-max' : 'flex-shrink-0',
          isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-white'
        ]"
      >
        <div
          class="term-tabs-bar border-b"
          :class="isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-white'"
          @mousedown="startTerminalPullResize"
        >
          <!-- Terminal toolbar icons also come from `AppIcon.vue` to keep this section focused on behavior. -->
          <div class="flex items-center gap-1 min-w-0">
            <template v-if="isDesktopPty">
              <button
                type="button"
                class="term-icon-btn term-tip-btn"
                data-tip="新建终端"
                aria-label="新建终端"
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
                终端
              </button>
              <button
                type="button"
                class="term-tab"
                :class="terminalTab === 'runner' ? 'term-tab-active' : ''"
                @mousedown.stop
                @click="openTerminalPanel('runner')"
              >
                Local Runner
              </button>
            </template>
          </div>

          <div v-if="terminalOpen" class="ml-auto flex items-center gap-1.5">
            <button
              v-if="isDesktopPty"
              type="button"
              class="term-icon-btn term-tip-btn"
              :data-tip="desktopSplit ? '关闭分屏' : '分屏终端'"
              :aria-label="desktopSplit ? '关闭分屏' : '分屏终端'"
              @mousedown.stop
              @click="toggleDesktopSplit"
            >
              <AppIcon name="split" class="term-icon" />
            </button>
            <select
              v-if="isDesktopPty && desktopSessions.length"
              class="term-session-select"
              :value="activeDesktopSessionId"
              @mousedown.stop
              @change="switchDesktopTerminal($event.target.value)"
            >
              <option v-for="session in desktopSessions" :key="session.id" :value="session.id">
                {{ session.label }} · {{ session.shell }}
              </option>
            </select>
            <button
              type="button"
              class="term-icon-btn term-tip-btn"
              data-tip="终止终端"
              aria-label="终止终端"
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
            <span>重命名</span>
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
              <div v-if="!termLog.length" class="term-line term-muted">终端已就绪，输入命令后按 Enter 执行。</div>
              <div v-for="(line, idx) in termLog" :key="idx" class="term-line">{{ line }}</div>
              <div v-if="isRunning" class="term-line term-running">[running] 命令执行中...</div>
              <div class="term-line term-entry-line">
                <span class="term-prompt">{{ terminalPrompt }}</span>
                <input
                  v-model="cmdInput"
                  type="text"
                  class="term-inline-input"
                  placeholder="输入命令并回车..."
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
              <button type="button" class="runner-btn" @click="pingBridge(false)">检查连接</button>
              <span class="runner-status" :class="bridgeOk ? 'is-ok' : 'is-off'">
                <i></i>{{ bridgeOk ? "Local Runner 已连接" : "Local Runner 未连接" }}
              </span>
            </div>
          </div>
          <div v-else class="runner-panel flex-1 min-h-0 overflow-y-auto p-5">
            <div class="runner-status is-ok"><i></i>桌面版已接入 PTY，无需 Local Runner。</div>
          </div>
        </div>
      </section>

      <div v-if="!terminalOpen" class="term-edge-grab" @mousedown="startTerminalPullResize"></div>
    </main>

    <div
      v-if="isEditMode"
      class="sidebar-resize-handle inspector-resize-handle flex-shrink-0"
      :class="[
        isInspectorSidebarHidden ? 'is-hidden' : '',
        isDark ? 'is-dark' : ''
      ]"
      @mousedown="startSidebarResizeDrag"
    >
      <div class="sidebar-resize-line"></div>
    </div>

    <aside
      v-if="showInspectorSidebar"
      class="sidebar-panel inspector-sidebar-panel flex flex-col flex-shrink-0 border-l min-h-0"
      :style="{ width: `${inspectorSidebarPanelWidth}px` }"
      :class="[
        isInspectorSidebarCollapsed ? 'is-collapsed' : '',
        isEditMode && isSidebarDragging ? 'is-dragging' : '',
        isInspectorSidebarHidden
          ? 'is-hidden border-transparent bg-transparent'
          : (isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-[#fafafa]')
      ]"
    >
      <div :class="isInspectorSidebarCollapsed ? 'px-2 py-3' : 'p-4 pb-3'" class="border-b" :style="{ borderColor: isDark ? '#1e293b' : '#e5e7eb' }">
        <div :class="isInspectorSidebarCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-start justify-between gap-2'">
          <div :class="isInspectorSidebarCollapsed ? 'flex items-center justify-center w-full' : 'flex items-center gap-2 min-w-0'">
            <div class="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              {{ isEditMode ? "ED" : "ST" }}
            </div>
            <div v-if="!isInspectorSidebarCollapsed" class="min-w-0">
              <h2 class="text-sm font-semibold tracking-tight truncate" :class="isDark ? 'text-slate-100' : 'text-gray-800'">
                {{ isEditMode ? "编辑控制栏" : "步骤栏" }}
              </h2>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
                {{ isEditMode ? "原顶栏 + 原步骤栏" : `第 ${currentStepIndex + 1} / ${steps.length} 步` }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="isEditMode && !isInspectorSidebarCollapsed" class="mt-3 space-y-2">
          <input
            :value="activeStep?.title || ''"
            type="text"
            @input="handleActiveStepTitleInput"
            class="w-full h-9 rounded-lg border px-3 text-sm font-medium focus:outline-none"
            :class="isDark ? 'border-slate-700 bg-slate-900 text-slate-100 focus:border-orange-400' : 'border-gray-200 bg-white text-gray-800 focus:border-orange-500'"
            placeholder="步骤标题"
          />
        </div>
        <div v-if="!isInspectorSidebarCollapsed" class="sidebar-overall-progress" :class="isDark ? 'is-dark' : ''">
          <span class="sidebar-overall-progress-fill" :style="{ width: `${Math.round(sidebarChapterProgress * 100)}%` }"></span>
        </div>
      </div>

      <nav class="flex-1 min-h-0 overflow-y-auto">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          @click="handleStepSelection(step.id, index)"
          :title="isInspectorSidebarCollapsed ? stepDisplayTitle(step, index) : ''"
          :draggable="isEditMode"
          @dragstart="onStepDragStart($event, index)"
          @dragend="onStepDragEnd"
          @dragover="onStepDragOver($event)"
          @drop="onStepDrop($event, index)"
          class="nav-step-item px-4 py-3.5 flex items-start gap-3 cursor-pointer transition-all border-l-4"
          :class="[
            currentId === step.id
              ? (isDark ? 'bg-orange-500/10 border-orange-400' : 'bg-orange-50/60 border-orange-500')
              : (isDark ? 'border-transparent hover:bg-slate-900/60' : 'border-transparent hover:bg-gray-100')
          ]"
        >
          <div class="nav-step-side">
            <div
              class="mt-1 w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all"
              :class="isDark ? 'bg-slate-800 text-slate-300' : 'bg-gray-200 text-gray-500'"
            >
              {{ index + 1 }}
            </div>
            <span class="nav-step-track" :class="isDark ? 'is-dark' : ''">
              <span class="nav-step-track-fill" :style="{ transform: `scaleY(${stepProgressForIndex(index)})` }"></span>
            </span>
          </div>

          <div v-if="!isInspectorSidebarCollapsed" class="flex-1 min-w-0">
            <div v-if="isEditMode" class="space-y-1">
              <input
                :value="step.title"
                type="text"
                @click.stop
                @input="handleStepTitleInput(index, $event)"
                class="w-full text-sm font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none px-1 py-0.5"
                :class="isDark ? 'text-slate-100 hover:border-slate-700' : 'text-gray-800'"
                placeholder="标题"
              />
              <div class="truncate text-[11px] px-1" :class="isDark ? 'text-slate-500' : 'text-gray-500'">
                {{ stepPreviewText(step) }}
              </div>
            </div>
            <div v-else class="min-w-0 space-y-1 px-1">
              <div class="truncate text-sm font-medium" :class="isDark ? 'text-slate-100' : 'text-gray-800'">
                {{ stepDisplayTitle(step, index) }}
              </div>
              <div class="truncate text-[11px]" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                {{ step.subtitle || stepPreviewText(step) }}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <section
        v-if="!isInspectorSidebarCollapsed && !isInspectorSidebarHidden && activeMarkdownRelPath"
        class="border-t px-4 py-3 space-y-3"
        :class="isDark ? 'border-slate-800' : 'border-gray-200'"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate" :class="isDark ? 'text-slate-100' : 'text-gray-800'">
              Backlinks
            </div>
            <p class="text-[11px]" :class="isDark ? 'text-slate-500' : 'text-gray-500'">
              {{ wikiLinkIndexLoading ? "索引更新中..." : `当前文档 ${currentBacklinks.length} 条反向链接` }}
            </p>
          </div>
          <span
            class="text-[11px] px-2 py-1 rounded-full border"
            :class="isDark ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-gray-200 bg-white text-gray-600'"
          >
            {{ currentBacklinks.length }}
          </span>
        </div>

        <div v-if="currentBacklinks.length" class="space-y-2 max-h-64 overflow-y-auto pr-1">
          <button
            v-for="(link, index) in currentBacklinks"
            :key="`${link.sourceRelPath}:${link.rawFrom}:${index}`"
            type="button"
            class="wiki-backlink-card w-full rounded-xl border px-3 py-2 text-left transition-all"
            :class="isDark
              ? 'border-slate-800 bg-slate-900/50 hover:border-orange-400/40 hover:bg-slate-900'
              : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40'"
            @click="openBacklinkEntry(link)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate text-sm font-medium" :class="isDark ? 'text-slate-100' : 'text-gray-800'">
                {{ link.sourceTitle || link.sourceFileName }}
              </span>
              <span class="text-[11px] shrink-0" :class="isDark ? 'text-slate-500' : 'text-gray-500'">
                L{{ link.lineNumber }}
              </span>
            </div>
            <div class="mt-1 truncate text-[11px]" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
              {{ link.sourceRelPath }}
            </div>
            <div class="mt-2 text-xs leading-5" :class="isDark ? 'text-slate-300' : 'text-slate-600'">
              {{ link.contextText || link.raw }}
            </div>
          </button>
        </div>
        <div
          v-else
          class="rounded-xl border px-3 py-4 text-xs leading-5"
          :class="isDark ? 'border-slate-800 bg-slate-900/40 text-slate-400' : 'border-gray-200 bg-white text-gray-500'"
        >
          当前还没有其它文档链接到这篇笔记。
        </div>
      </section>

      <div
        v-if="isEditMode && !isInspectorSidebarCollapsed && !isInspectorSidebarHidden"
        class="border-t p-4 space-y-3"
        :class="isDark ? 'border-slate-800' : 'border-gray-200'"
      >
        <button
          @click="addStep"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg border transition-all"
          :class="isDark
            ? 'border-orange-300/30 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25'
            : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'"
        >
          ＋ 添加新步骤
        </button>
        <button
          @click="removeStep"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg border transition-all"
          :class="isDark
            ? 'border-rose-300/30 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25'
            : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'"
        >
          🗑 删除当前步骤
        </button>

        <div class="space-y-2 rounded-lg border p-3" :class="isDark ? 'border-slate-800 bg-slate-900/40' : 'border-gray-200 bg-white'">
          <label class="flex items-center gap-2 text-xs" :class="isDark ? 'text-slate-300' : 'text-gray-700'">
            <input v-model="gestureNavigationEnabled" type="checkbox" :class="isDark ? 'accent-cyan-400' : 'accent-blue-600'" />
            翻页模式
          </label>
          <label class="flex items-center gap-2 text-xs" :class="isDark ? 'text-slate-300' : 'text-gray-700'">
            <input v-model="collapseHeaderInView" type="checkbox" :class="isDark ? 'accent-cyan-400' : 'accent-blue-600'" />
            展示模式收起顶栏
          </label>
          <label class="flex items-center gap-2 text-xs" :class="isDark ? 'text-slate-300' : 'text-gray-700'">
            <input v-model="collapseStepsSidebarInView" type="checkbox" :class="isDark ? 'accent-cyan-400' : 'accent-blue-600'" />
            展示模式收起原始步骤栏
          </label>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="px-3 py-2 text-sm rounded-lg transition-all"
            :class="isDark ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            @click="toggleDark"
          >
            🌙 主题
          </button>
          <button
            type="button"
            class="px-3 py-2 text-sm rounded-lg transition-all bg-orange-500 text-white hover:bg-orange-600"
            @click="toggleMode"
          >
            👁 展示
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
        <span>重命名</span>
      </button>
      <button type="button" class="term-context-item is-danger" role="menuitem" @click="deleteStorageNode(storageNodeMenu.nodeId)">
        <AppIcon name="delete" class="storage-context-icon" />
        <span>删除</span>
      </button>
    </div>

    <div v-if="desktopRenameDialog.open" class="term-rename-mask" @mousedown.self="cancelDesktopRenameDialog">
      <div class="term-rename-card" @mousedown.stop>
        <div class="term-rename-title">重命名终端</div>
        <input
          ref="desktopRenameInputRef"
          v-model="desktopRenameDialog.value"
          class="term-rename-input"
          maxlength="40"
          @keydown.enter.prevent="confirmDesktopRenameDialog"
          @keydown.esc.prevent="cancelDesktopRenameDialog"
        />
        <div class="term-rename-actions">
          <button type="button" class="term-rename-btn" @click="cancelDesktopRenameDialog">取消</button>
          <button type="button" class="term-rename-btn is-primary" @click="confirmDesktopRenameDialog">确定</button>
        </div>
      </div>
    </div>

    <div v-if="storageRenameDialog.open" class="term-rename-mask" @mousedown.self="cancelStorageRenameDialog">
      <div class="term-rename-card" @mousedown.stop>
        <div class="term-rename-title">{{ storageRenameDialog.kind === "folder" ? "重命名文件夹" : "重命名文件" }}</div>
        <input
          ref="storageRenameInputRef"
          v-model="storageRenameDialog.value"
          class="term-rename-input"
          @keydown.enter.prevent="confirmStorageRenameDialog"
          @keydown.esc.prevent="cancelStorageRenameDialog"
        />
        <div class="term-rename-actions">
          <button type="button" class="term-rename-btn" @click="cancelStorageRenameDialog">取消</button>
          <button type="button" class="term-rename-btn is-primary" @click="confirmStorageRenameDialog">确定</button>
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
import { useSemanticStore } from "./editor/state/semantic-store";
import { useMarkdownDocument } from "./composables/useMarkdownDocument";
import { useResizable } from "./composables/useResizable";
import { useSteps } from "./composables/useSteps";
import { useTerminal } from "./composables/useTerminal";
import { useToast } from "./composables/useToast";
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
    // 如果 katex 不可用，尝试动态 require
    if (typeof require === "function") {
      const katexRequired = require("katex");
      if (katexRequired?.renderToString) {
        return katexRequired.renderToString(formula, {
          displayMode: displayMode,
          throwOnError: false,
          errorColor: "#cc0000"
        });
      }
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

const mode = ref("edit");
const isDark = ref(false);
const gestureNavigationEnabled = ref(false);
const collapseHeaderInView = ref(false);
const collapseStepsSidebarInView = ref(false);
const isEditMode = computed(() => mode.value === "edit");
const terminalPanelHeight = ref(320);
const terminalMaximized = ref(false);
const terminalTab = ref("terminal");
const mainRef = ref(null);
const contentScrollRef = ref(null);
const markdownEditorRef = ref(null);
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
const fileSidebarWidth = ref(280);
const storageSortMode = ref("name-asc");
const STORAGE_ROOT_ID = "workspace-root";
const storageTree = ref(null);
const storageRootPath = ref("");
const storageLoading = ref(false);
const storageFolderExpandedMap = ref({ [STORAGE_ROOT_ID]: true });
const selectedStorageNodeId = ref(STORAGE_ROOT_ID);
const windowIsMaximized = ref(false);
const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_HIDE_SNAP = 44;
const SIDEBAR_COLLAPSE_SNAP = SIDEBAR_COLLAPSED_WIDTH + 34;
const FILE_SIDEBAR_COLLAPSED_WIDTH = 68;
const FILE_SIDEBAR_MIN_WIDTH = 220;
const FILE_SIDEBAR_MAX_WIDTH = 520;
const FILE_SIDEBAR_HIDE_SNAP = 44;
const FILE_SIDEBAR_COLLAPSE_SNAP = FILE_SIDEBAR_COLLAPSED_WIDTH + 30;
const desktopPrimaryTerminalRef = ref(null);
const desktopSecondaryTerminalRef = ref(null);
const desktopSessions = ref([]);
const activeDesktopSessionId = ref("");
const desktopSessionSeq = ref(1);
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
const storageRenameDialog = ref({
  open: false,
  nodeId: "",
  value: "",
  kind: "file"
});
const workspaceFooterPanel = ref("");
const storageRenameInputRef = ref(null);
const storageNodeMenuRef = ref(null);
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
const canWorkspaceFileIO = Boolean(
  desktopDataBridge?.readWorkspaceFile
  && desktopDataBridge?.writeWorkspaceFile
);
const isDesktopWindowControls = Boolean(
  desktopWindowBridge?.minimize
  && desktopWindowBridge?.toggleMaximize
  && desktopWindowBridge?.close
);
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
const STORAGE_TREE_STORAGE_KEY = "yc-doc.storage-tree.v1";
const STORAGE_EXPANDED_STORAGE_KEY = "yc-doc.storage-expanded.v1";
const STORAGE_SELECTED_STORAGE_KEY = "yc-doc.storage-selected.v1";
const STORAGE_SORT_MODE_STORAGE_KEY = "yc-doc.storage-sort-mode.v1";
const WIKI_LINK_INDEX_DEBOUNCE_MS = 220;

const { toast, showToast } = useToast();
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

const renderedMarkdown = computed(() => {
  if (isEditMode.value) {
    return "";
  }
  const content = String(activeStep.value?.content || "");
  try {
    return renderMarkdownToHtml({
      markdown: content,
      currentRelPath: activeMarkdownRelPath.value,
      markdownFiles: workspaceMarkdownFiles.value,
      renderMathFormula
    });
  } catch (e) {
    return "";
  }
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
  if (typeof markdownEditorRef.value?.focusPosition === "function") {
    markdownEditorRef.value.focusPosition(focusPos);
    return;
  }
  if (typeof markdownEditorRef.value?.focus === "function") {
    markdownEditorRef.value.focus();
  }
}

const {
  activeMarkdownRelPath,
  appendMarkdownImage,
  clearScheduledMarkdownSave,
  documentMarkdown,
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
  renameStepTitle,
  removeStep,
  resetBlankEditorState,
  saveMarkdown,
  saveStatus,
  updateMarkdown,
  serializeStepsToMarkdown,
  stepDisplayTitle,
  stepPreviewText,
  writeActiveMarkdownNow,
  addStep
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

const handleEditorSelectionChange = (selection) => {
  editorSelection.value = {
    anchor: Number(selection?.anchor || 0),
    head: Number(selection?.head || 0)
  };
};

const {
  blocks: semanticBlocks,
  outline: semanticOutline,
  currentBlock: currentSemanticBlock
} = useSemanticStore({
  markdownRef: documentMarkdown,
  selectionRef: editorSelection,
  parseDelayMs: 0,
  currentBlockStrategy: "anchor"
});

const activeSemanticBlock = computed(() => {
  const current = currentSemanticBlock.value;
  return current?.block || current?.prevBlock || current?.nextBlock || null;
});

const currentSemanticBlockId = computed(() => String(activeSemanticBlock.value?.id || ""));

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

const handleActiveStepTitleInput = (event) => {
  const nextTitle = String(event?.target?.value || "");
  void renameStepTitle(currentStepIndex.value, nextTitle);
};

const handleStepTitleInput = (index, event) => {
  const nextTitle = String(event?.target?.value || "");
  void renameStepTitle(index, nextTitle);
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

if (typeof window !== "undefined") {
  try {
    gestureNavigationEnabled.value = localStorage.getItem(GESTURE_NAV_STORAGE_KEY) === "1";
    collapseHeaderInView.value = localStorage.getItem(VIEW_HEADER_COLLAPSE_STORAGE_KEY) === "1";
    collapseStepsSidebarInView.value = localStorage.getItem(VIEW_STEPS_SIDEBAR_COLLAPSE_STORAGE_KEY) === "1";
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
    storageSortMode.value = rawStorageSortMode === "name-desc" ? "name-desc" : "name-asc";
  } catch {
    gestureNavigationEnabled.value = false;
    collapseHeaderInView.value = false;
    collapseStepsSidebarInView.value = false;
    storageTree.value = null;
    storageFolderExpandedMap.value = { [STORAGE_ROOT_ID]: true };
    selectedStorageNodeId.value = STORAGE_ROOT_ID;
    storageSortMode.value = "name-asc";
  }
}

const makeStorageNodeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultStorageTree = () => ({
  id: STORAGE_ROOT_ID,
  type: "folder",
  name: "Local Storage",
  relPath: "",
  absPath: "",
  children: [
    {
      id: makeStorageNodeId("file"),
      type: "file",
      name: "未命名.md",
      relPath: "未命名.md",
      absPath: "",
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
  const name = String(raw.name || fallbackName || (type === "folder" ? "新建文件夹" : "未命名.md")).trim()
    || (type === "folder" ? "新建文件夹" : "未命名.md");
  if (type === "file") {
    return { id, type, name, relPath, absPath, children: [] };
  }
  const children = Array.isArray(raw.children)
    ? raw.children.map((item, index) => normalizeStorageNode(item, `${id}-${index}`, "未命名"))
    : [];
  return { id, type, name, relPath, absPath, children };
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
    children: []
  };
}

const normalizeDesktopStorageNode = (source, isRoot = false) => {
  const raw = source && typeof source === "object" ? source : {};
  const type = raw.type === "file" ? "file" : "folder";
  const relPath = String(raw.relPath || "");
  const absPath = String(raw.absPath || "");
  const size = Number(raw.size || 0);
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
    children
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

const compareStorageNodes = (a, b) => {
  if (a.type !== b.type) {
    return a.type === "folder" ? -1 : 1;
  }
  const direction = storageSortMode.value === "name-desc" ? -1 : 1;
  return direction * String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
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

const storageSortTooltip = computed(() =>
  storageSortMode.value === "name-desc" ? "排序：名称降序" : "排序：名称升序"
);

const workspaceDisplayName = computed(() => {
  if (isDesktopStorage) {
    const trimmedPath = String(storageRootPath.value || "").replace(/[\\/]+$/, "");
    const segments = trimmedPath.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] || "Workspace";
  }
  return String(storageTree.value?.name || "Local Storage");
});

const isStorageFolderExpanded = (id) => storageFolderExpandedMap.value[id] !== false;

const visibleStorageNodes = computed(() => {
  const list = [];
  const walk = (node, depth) => {
    if (!node) {
      return;
    }
    list.push({
      id: node.id,
      type: node.type,
      name: node.name,
      relPath: node.relPath || "",
      depth
    });
    if (node.type !== "folder" || !isStorageFolderExpanded(node.id)) {
      return;
    }
    const ordered = [...(Array.isArray(node.children) ? node.children : [])].sort(compareStorageNodes);
    for (const child of ordered) {
      walk(child, depth + 1);
    }
  };
  const rootChildren = Array.isArray(storageTree.value?.children) ? storageTree.value.children : [];
  const orderedRoots = [...rootChildren].sort(compareStorageNodes);
  for (const child of orderedRoots) {
    walk(child, 0);
  }
  return list;
});

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
    label: resolveEditorTabLabel(tab),
    title: tab.kind === "graph" ? "Graph" : String(tab.relPath || "")
  }))
);

const isWorkspaceGraphTabActive = computed(() => activeEditorTabId.value === EDITOR_GRAPH_TAB_ID);

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
    return;
  }
  await openMarkdownFileByRelPath(targetTab.relPath, {
    showMissingToast: false
  });
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
      activeEditorTabId.value = currentRelPath ? ensureEditorFileTab(currentRelPath) : (remainingTabs[0]?.id || "");
    }
    return;
  }

  if (!closedLoadedFile) {
    if (activeEditorTabId.value === tabId) {
      const nextFileTab = pickNeighborFileTab(remainingTabs, index);
      if (nextFileTab?.relPath) {
        await openMarkdownFileByRelPath(nextFileTab.relPath, {
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
    await openMarkdownFileByRelPath(nextFileTab.relPath, {
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
  markdownEditorRef.value?.refreshWikiLinks?.();
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
  } catch {
    // ignore storage failure
  }
};

const ensureSelectedStorageNodeValid = () => {
  const current = String(selectedStorageNodeId.value || "");
  if (findStorageNodeInTree(storageTree.value, current)) {
    return;
  }
  selectedStorageNodeId.value = STORAGE_ROOT_ID;
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

const closeWorkspaceFooterPanel = () => {
  workspaceFooterPanel.value = "";
};

const toggleWorkspaceFooterPanel = (panel) => {
  const targetPanel = String(panel || "").trim();
  workspaceFooterPanel.value = workspaceFooterPanel.value === targetPanel ? "" : targetPanel;
};

const handleWorkspaceFooterPrimaryAction = async () => {
  closeWorkspaceFooterPanel();
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
  if (!canPickWorkspaceRoot) {
    return;
  }
  await pickStorageRootDir();
};

const handleWorkspaceFooterOpenDir = async () => {
  closeWorkspaceFooterPanel();
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
  return window.confirm(`确认删除${targetLabel}“${nodeName}”吗？`);
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
    if (typeof markdownEditorRef.value?.focusPosition === "function") {
      markdownEditorRef.value.focusPosition(targetPos);
    } else {
      markdownEditorRef.value?.focus?.();
    }
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
      label: `创建 ${rawTarget}`,
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

const toggleStorageSortMode = () => {
  storageSortMode.value = storageSortMode.value === "name-desc" ? "name-asc" : "name-desc";
  showToast(storageSortMode.value === "name-desc" ? "文件树已切换为名称降序" : "文件树已切换为名称升序");
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
    element.closest("a, button, input, textarea, select, label, summary, [role='button']")
  );
};

const handlePreviewNavClick = (event) => {
  const targetElement = event?.target instanceof Element
    ? event.target
    : (event?.target?.parentElement instanceof Element ? event.target.parentElement : null);
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
      label: trimmed
    };
  });
  showToast(`已重命名为 ${trimmed}`);
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
  const sid = await createDesktopSession(shell);
  if (!sid) {
    return;
  }
  desktopSessions.value.push({
    id: sid,
    label: `终端 ${desktopSessionSeq.value}`,
    shell
  });
  desktopSessionSeq.value += 1;
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
  if (isDesktopPty.value) {
    const sid = paneSessionIdOf(activeDesktopPane.value) || activeDesktopSessionId.value;
    if (!sid) {
      return;
    }
    await closeDesktopTerminal(sid);
    return;
  }
  await stopExecution();
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
  if (event.button !== 0 || !windowIsMaximized.value) {
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
    void syncDesktopMaximizeState();
  });
};

const xtermLightTheme = {
  background: "#ffffff",
  foreground: "#0f172a",
  cursor: "#f97316"
};

const xtermDarkTheme = {
  background: "#0f172a",
  foreground: "#e2e8f0",
  cursor: "#fb923c"
};

const applyXtermTheme = () => {
  for (const pane of ["primary", "secondary"]) {
    const term = termOf(pane);
    if (term) {
      term.options.theme = isDark.value ? xtermDarkTheme : xtermLightTheme;
    }
  }
};

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
          theme: isDark.value ? xtermDarkTheme : xtermLightTheme
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
        term.options.theme = isDark.value ? xtermDarkTheme : xtermLightTheme;
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

watch(isDark, () => {
  applyXtermTheme();
});

watch([currentId, mode, terminalMaximized, terminalOpen, terminalPanelHeight], () => {
  nextTick(() => {
    refreshContentProgress();
  });
});

watch(renderedMarkdown, () => {
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

watch(storageSortMode, (mode) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_SORT_MODE_STORAGE_KEY, mode === "name-desc" ? "name-desc" : "name-asc");
  } catch {
    // ignore storage failure
  }
});

watch([isFileSidebarCollapsed, isFileSidebarHidden], ([collapsed, hidden]) => {
  if (collapsed || hidden) {
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

const toggleDark = () => {
  isDark.value = !isDark.value;
};

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

const toggleMode = async () => {
  const nextMode = isEditMode.value ? "view" : "edit";
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

const insertImageToMarkdown = async () => {
  if (isDesktopPty.value && desktopWindowBridge?.pickImage) {
    try {
      const picked = await desktopWindowBridge.pickImage();
      if (!picked || picked.canceled) {
        return;
      }
      if (picked.ok && picked.markdownUrl) {
        appendMarkdownImage(picked.markdownUrl);
        showToast("已插入图片");
        return;
      }
      showToast(`插入失败: ${picked?.error || "unknown_error"}`);
      return;
    } catch (error) {
      showToast(`插入失败: ${error?.message || "unknown_error"}`);
      return;
    }
  }

  showToast("Web 版请将图片放在 web/public/images，并使用 /images/xxx.png");
};

const openDesktopImageFolder = async () => {
  if (!(isDesktopPty.value && desktopWindowBridge?.openImageDir)) {
    showToast("仅桌面版支持打开图片目录");
    return;
  }
  try {
    const result = await desktopWindowBridge.openImageDir();
    if (result?.ok) {
      showToast("已打开图片目录");
    } else {
      showToast(`打开失败: ${result?.error || "unknown_error"}`);
    }
  } catch (error) {
    showToast(`打开失败: ${error?.message || "unknown_error"}`);
  }
};

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

const resizeTerminalFrom = (startY, startH) => {
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
    const dy = startY - ev.clientY;
    applyTerminalDragHeight(startH + dy);
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
  const startH = terminalOpen.value
    ? (terminalMaximized.value ? getTerminalMaxHeight() : terminalPanelHeight.value)
    : 0;
  resizeTerminalFrom(event.clientY, startH);
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
    markdownEditorRef.value?.openSearch?.();
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
  if (target instanceof Element && target.closest(".workspace-footer-panel-shell")) {
    return;
  }
  closeDesktopTabContextMenu();
  closeStorageNodeContextMenu();
  closeWorkspaceFooterPanel();
};

const onGlobalKeyup = (event) => {
  const key = String(event.key || "").toLowerCase();
  if (["control", "meta", "shift"].includes(key)) {
    releasePasteShortcutLocks();
  }
};

onMounted(() => {
  window.addEventListener("keydown", onGlobalTermContextMenuKeydown, true);
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("keyup", onGlobalKeyup, true);
  window.addEventListener("mousedown", onGlobalPointerDown, true);
  window.addEventListener("blur", releaseTransientPointerState);
  window.addEventListener("focus", clearBodyInteractionStyles);
  window.addEventListener("blur", closeDesktopTabContextMenu);
  window.addEventListener("blur", closeStorageNodeContextMenu);
  window.addEventListener("blur", closeWorkspaceFooterPanel);
  window.addEventListener("blur", releasePasteShortcutLocks);
  window.addEventListener("resize", refreshContentProgress);
  if (isDesktopStorage) {
    void loadDesktopStorageTree();
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
  window.removeEventListener("keydown", onGlobalTermContextMenuKeydown, true);
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("keyup", onGlobalKeyup, true);
  window.removeEventListener("mousedown", onGlobalPointerDown, true);
  window.removeEventListener("blur", releaseTransientPointerState);
  window.removeEventListener("focus", clearBodyInteractionStyles);
  window.removeEventListener("blur", closeDesktopTabContextMenu);
  window.removeEventListener("blur", closeStorageNodeContextMenu);
  window.removeEventListener("blur", closeWorkspaceFooterPanel);
  window.removeEventListener("blur", releasePasteShortcutLocks);
  window.removeEventListener("resize", refreshContentProgress);
  if (desktopWindowMaximizeOff) {
    desktopWindowMaximizeOff();
    desktopWindowMaximizeOff = null;
  }
});
</script>
