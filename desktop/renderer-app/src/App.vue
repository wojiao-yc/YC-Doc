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
      <div class="app-chrome-no-drag">
        <button
          type="button"
          class="term-window-btn term-tip-btn"
          :data-tip="isFileSidebarHidden ? '展开左边栏' : '收起左边栏'"
          :aria-label="isFileSidebarHidden ? '展开左边栏' : '收起左边栏'"
          @click="toggleFileSidebarCollapse"
        >
          <svg class="chrome-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1.8" y="2.2" width="12.4" height="11.6" rx="2" stroke="currentColor" stroke-width="1.2" />
            <path
              :d="isFileSidebarHidden ? 'M11.2 3.8v8.4' : 'M4.8 3.8v8.4'"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
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
          <svg class="chrome-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1.8" y="2.2" width="12.4" height="11.6" rx="2" stroke="currentColor" stroke-width="1.2" />
            <path
              :d="isSidebarHidden ? 'M4.8 3.8v8.4' : 'M11.2 3.8v8.4'"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="term-window-btn term-tip-btn"
          data-tip="最小化"
          aria-label="最小化"
          @click="handleWindowMinimize"
        >
          <svg class="chrome-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 8h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
        </button>
        <button
          type="button"
          class="term-window-btn term-tip-btn"
          :data-tip="windowIsMaximized ? '还原' : '最大化'"
          :aria-label="windowIsMaximized ? '还原' : '最大化'"
          @click="handleWindowToggleMaximize"
        >
          <svg v-if="windowIsMaximized" class="chrome-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="4.7" y="3.3" width="7.1" height="7.1" rx="0.8" stroke="currentColor" stroke-width="1.2" />
            <path d="M3.4 5.5V12h6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
          <svg v-else class="chrome-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="3.5" y="3.5" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </button>
        <button
          type="button"
          class="term-window-btn term-window-btn-close term-tip-btn"
          data-tip="关闭"
          aria-label="关闭"
          @click="handleWindowClose"
        >
          <svg class="chrome-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4.5 4.5l7 7m0-7-7 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
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
      <div :class="isFileSidebarCollapsed ? 'px-2 py-3' : 'p-4 pb-3'" class="border-b" :style="{ borderColor: isDark ? '#1e293b' : '#e5e7eb' }">
        <div :class="isFileSidebarCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-start justify-between gap-2'">
          <div :class="isFileSidebarCollapsed ? 'flex items-center justify-center w-full' : 'flex items-center gap-2 min-w-0'">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold bg-orange-500">FS</div>
            <div v-if="!isFileSidebarCollapsed" class="min-w-0">
              <h2 class="text-sm font-semibold truncate" :class="isDark ? 'text-slate-100' : 'text-gray-800'">文件管理</h2>
              <p class="text-[11px] mt-0.5 truncate" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
                {{ storageLocationText }}
              </p>
            </div>
          </div>
        </div>
        <div v-if="!isFileSidebarCollapsed" class="mt-3 flex items-center gap-2">
          <button
            type="button"
            class="w-9 h-9 rounded-lg border inline-flex items-center justify-center transition-all term-tip-btn"
            :class="isDark ? 'border-slate-700 text-slate-200 bg-slate-900 hover:bg-slate-800' : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-100'"
            @click="createStorageFile"
            data-tip="新建文件"
            aria-label="新建文件"
          >
            <svg class="chrome-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 11.8V13h1.2l6.8-6.8-1.2-1.2L3 11.8z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
              <path d="M9.7 4.3l1.2-1.2 1.2 1.2-1.2 1.2-1.2-1.2z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            class="w-9 h-9 rounded-lg border inline-flex items-center justify-center transition-all term-tip-btn"
            :class="isDark ? 'border-slate-700 text-slate-200 bg-slate-900 hover:bg-slate-800' : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-100'"
            @click="createStorageFolder"
            data-tip="新建文件夹"
            aria-label="新建文件夹"
          >
            <svg class="chrome-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.8 4.5h3l1 1h6.4v6.8H2.8V4.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
              <path d="M8 7.2v3.2M6.4 8.8h3.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div v-if="!isFileSidebarCollapsed && isDesktopStorage" class="mt-2 flex items-center gap-2">
          <button
            type="button"
            class="px-2.5 py-1.5 text-xs rounded-lg border transition-all"
            :class="isDark ? 'border-slate-700 text-slate-200 bg-slate-900 hover:bg-slate-800' : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-100'"
            @click="openStorageRootDir"
          >
            打开目录
          </button>
          <button
            v-if="canPickWorkspaceRoot"
            type="button"
            class="px-2.5 py-1.5 text-xs rounded-lg border transition-all"
            :class="isDark ? 'border-slate-700 text-slate-200 bg-slate-900 hover:bg-slate-800' : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-100'"
            @click="pickStorageRootDir"
          >
            选择目录
          </button>
        </div>
        <p v-if="!isFileSidebarCollapsed" class="text-[11px] mt-2" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
          {{ storageStats }}
        </p>
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
              <span @click.stop="toggleStorageFolder(item.id)">{{ isStorageFolderExpanded(item.id) ? '▾' : '▸' }}</span>
            </template>
            <template v-else>
              •
            </template>
          </span>
          <span class="text-xs">{{ item.type === "folder" ? "📁" : "📄" }}</span>
          <span v-if="!isFileSidebarCollapsed" class="truncate text-xs">{{ item.name }}</span>
        </button>
      </nav>
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
        class="flex-1 min-h-0 overflow-y-auto"
        :class="isDark ? 'bg-slate-950' : 'bg-white'"
        @scroll.passive="onContentScroll"
      >
        <div class="mx-auto relative w-full px-10 py-10" :class="isEditMode ? 'max-w-6xl' : 'max-w-none'">
          <transition name="fade" mode="out-in">
            <div :key="contentPaneKey" class="flex flex-col">
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
                </div>

                <div class="relative flex-1 overflow-y-auto py-2">
                  <div class="mx-auto" :style="displayStyle">
                    <EditorShell
                      ref="markdownEditorRef"
                      :model-value="documentMarkdown"
                      :dark="isDark"
                      @selection-change="handleEditorSelectionChange"
                      @update:model-value="updateMarkdown"
                    />
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
        <footer
          v-if="!(gestureNavigationEnabled && !isEditMode)"
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
                <svg class="term-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
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
              <svg class="term-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2.5" y="3" width="11" height="10" stroke="currentColor" stroke-width="1.2" rx="1.2"/>
                <path d="M8 3v10" stroke="currentColor" stroke-width="1.2"/>
              </svg>
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
              <svg class="term-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 4.5h10M6.2 2.5h3.6m-5.6 2 0.6 8.2h6.4l0.6-8.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6.8 6.4v4.4M9.2 6.4v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div
          v-if="desktopTabMenu.open"
          class="term-context-menu"
          :style="{ left: `${desktopTabMenu.x}px`, top: `${desktopTabMenu.y}px` }"
          @mousedown.stop
        >
          <button type="button" class="term-context-item" @click="openDesktopRenameDialog(desktopTabMenu.sid)">
            重命名
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
            v-model="activeStep.title"
            type="text"
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
          @dragstart="onDragStart($event, index, isEditMode)"
          @dragover="onDragOver($event, isEditMode)"
          @drop="onDrop($event, index, isEditMode)"
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
                v-model="step.title"
                type="text"
                @click.stop
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
      class="term-context-menu"
      :style="{ left: `${storageNodeMenu.x}px`, top: `${storageNodeMenu.y}px` }"
      @mousedown.stop
    >
      <button type="button" class="term-context-item" @click="openStorageRenameDialog(storageNodeMenu.nodeId)">
        重命名
      </button>
      <button type="button" class="term-context-item is-danger" @click="deleteStorageNode(storageNodeMenu.nodeId)">
        删除
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
import { marked } from "marked";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTermTerminal } from "xterm";
import ToastMessage from "./components/ToastMessage.vue";
import EditorShell from "./editor";
import { useSemanticStore } from "./editor/state/semantic-store";
import { useMarkdownDocument } from "./composables/useMarkdownDocument";
import { useResizable } from "./composables/useResizable";
import { useSteps } from "./composables/useSteps";
import { useTerminal } from "./composables/useTerminal";
import { useToast } from "./composables/useToast";

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
const terminalViewportRef = ref(null);
const terminalSplitWrapRef = ref(null);
const currentContentReadProgress = ref(0);
const isSidebarCollapsed = ref(false);
const isSidebarHidden = ref(false);
const isSidebarDragging = ref(false);
const isFileSidebarCollapsed = ref(false);
const isFileSidebarHidden = ref(false);
const isFileSidebarDragging = ref(false);
const fileSidebarWidth = ref(280);
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
const storageRenameInputRef = ref(null);
const desktopTabMenu = ref({
  open: false,
  x: 0,
  y: 0,
  sid: ""
});
const desktopRenameDialog = ref({
  open: false,
  sid: "",
  value: ""
});
const desktopRenameInputRef = ref(null);
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

const { toast, showToast } = useToast();

const {
  steps,
  currentId,
  activeStep,
  currentStepIndex,
  isFirstStep,
  isLastStep,
  next: baseNext,
  prev: basePrev,
  onDragStart,
  onDragOver,
  onDrop
} = useSteps(showToast);

const {
  sidebarWidth,
  displayWidth,
  displayStyle,
  resetDisplayWidth
} = useResizable();

const adjustVisualEditorWidth = (delta) => {
  const maxWidth = typeof window === "undefined" ? 2200 : Math.min(2200, window.innerWidth - 80);
  displayWidth.value = clamp(displayWidth.value + Number(delta || 0), 520, Math.max(520, maxWidth));
};

const contentPaneKey = computed(() => (isEditMode.value ? mode.value : `${mode.value}:${currentId.value}`));
const renderedMarkdown = computed(() => {
  if (isEditMode.value) {
    return "";
  }
  return String(marked.parse(String(activeStep.value?.content || ""), { breaks: true, gfm: true }) || "");
});

async function focusStepInEditMode(index) {
  const safeIndex = clamp(Number(index) || 0, 0, Math.max(0, steps.value.length - 1));
  const targetId = steps.value[safeIndex]?.id;
  if (targetId != null && targetId !== currentId.value) {
    currentId.value = targetId;
  }
  await nextTick();
  if (typeof markdownEditorRef.value?.focus === "function") {
    markdownEditorRef.value.focus();
  }
}

const {
  activeMarkdownRelPath,
  appendMarkdownImage,
  clearScheduledMarkdownSave,
  documentMarkdown,
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
  parseMarkdownToSteps,
  persistActiveMarkdownBeforeSwitch,
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
  outline: semanticOutline,
  currentBlock: currentSemanticBlock
} = useSemanticStore({
  markdownRef: documentMarkdown,
  selectionRef: editorSelection,
  parseDelayMs: 70,
  currentBlockStrategy: "anchor"
});

const currentBlockLabel = computed(() => {
  const block = currentSemanticBlock.value?.block;
  if (!block) {
    return "Block none";
  }
  return `Block ${block.type}`;
});

const currentBlockDebugTitle = computed(() => {
  const block = currentSemanticBlock.value?.block;
  if (!block) {
    return "当前无块";
  }
  const lineStart = Number(block.lineStart || 0);
  const lineEnd = Number(block.lineEnd || lineStart);
  return `${block.type}  L${lineStart}-${lineEnd}  [${block.from}, ${block.to})`;
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
  } catch {
    gestureNavigationEnabled.value = false;
    collapseHeaderInView.value = false;
    collapseStepsSidebarInView.value = false;
    storageTree.value = null;
    storageFolderExpandedMap.value = { [STORAGE_ROOT_ID]: true };
    selectedStorageNodeId.value = STORAGE_ROOT_ID;
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

const loadDesktopStorageTree = async () => {
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
    if (treeResult.rootPath) {
      storageRootPath.value = String(treeResult.rootPath);
    }
    ensureSelectedStorageNodeValid();
    const selected = findStorageNodeInTree(storageTree.value, selectedStorageNodeId.value);
    if (canAutoLoadMarkdownNode(selected?.node)) {
      void loadStepsFromMarkdownFile(String(selected.node.relPath || ""), false);
    } else {
      const shouldAutoPickFirstMarkdown = !selected?.node || selected.node.id === STORAGE_ROOT_ID;
      const firstMarkdown = shouldAutoPickFirstMarkdown ? findFirstMarkdownNode(storageTree.value) : null;
      if (firstMarkdown?.relPath) {
        selectedStorageNodeId.value = String(firstMarkdown.id || selectedStorageNodeId.value);
        void loadStepsFromMarkdownFile(String(firstMarkdown.relPath), false);
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
  } finally {
    storageLoading.value = false;
  }
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
  return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
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
  walk(storageTree.value, 0);
  return list;
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
    await persistActiveMarkdownBeforeSwitch();
    resetBlankEditorState();
  } else if (matched?.node?.type === "file" && isMarkdownFileName(matched.node.name)) {
    if (isMarkdownFileTooLarge(matched.node.size)) {
      showToast(`Markdown 文件过大，无法载入: ${matched.node.name} (${formatBytes(matched.node.size)})`);
      await persistActiveMarkdownBeforeSwitch();
      resetBlankEditorState();
      persistStorageState();
      return;
    }
    await loadStepsFromMarkdownFile(String(matched.node.relPath || ""), true);
  } else {
    await persistActiveMarkdownBeforeSwitch();
    resetBlankEditorState();
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
      selectedStorageNodeId.value = String(result.relPath || selectedStorageNodeId.value);
      await loadDesktopStorageTree();
      if (String(result.name || "").toLowerCase().endsWith(".md")) {
        await loadStepsFromMarkdownFile(String(result.relPath || ""), false);
      }
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
      selectedStorageNodeId.value = String(result.relPath || selectedStorageNodeId.value);
      await loadDesktopStorageTree();
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
      selectedStorageNodeId.value = String(result.relPath || matched.node.id);
      await loadDesktopStorageTree();
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
  if (renamedNode.type === "file" && isMarkdownFileName(renamedNode.name)) {
    activeMarkdownRelPath.value = String(renamedNode.relPath || "");
  } else {
    resetBlankEditorState();
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
  const confirmed = typeof window === "undefined" || typeof window.confirm !== "function"
    ? true
    : window.confirm(`确认删除${targetLabel}“${matched.node.name}”吗？`);
  if (!confirmed) {
    return;
  }

  const targetRelPath = String(matched.node.relPath || "");
  const affectedActiveFile = isRelPathAffectedByNode(
    activeMarkdownRelPath.value,
    targetRelPath,
    matched.node.type
  );
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
      await loadDesktopStorageTree();
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
  resetBlankEditorState();
  persistStorageState();
  showToast(`已删除${targetLabel}: ${matched.node.name}`);
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
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest("a, button, input, textarea, select, label, summary, [role='button']")
  );
};

const handlePreviewNavClick = (event) => {
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
    document.body.style.userSelect = "";
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
    document.body.style.userSelect = "";
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

  const onMove = (ev) => {
    const raw = ((ev.clientX - rect.left) / rect.width) * 100;
    desktopSplitRatio.value = clamp(Math.round(raw), 18, 82);
    void nextTick(() => {
      void syncDesktopTerminalSize();
    });
  };
  const onUp = () => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
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

const toggleMode = async () => {
  const nextMode = isEditMode.value ? "view" : "edit";
  if (nextMode === "view") {
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

  const onMove = (ev) => {
    const dy = startY - ev.clientY;
    applyTerminalDragHeight(startH + dy);
  };

  const onUp = () => {
    terminalDragSizing = false;
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (terminalOpen.value) {
      requestDesktopTerminalSizeSync(0);
      nextTick(scrollTerminalToBottom);
    }
  };

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
  closeDesktopTabContextMenu();
  closeStorageNodeContextMenu();
};

const onGlobalKeyup = (event) => {
  const key = String(event.key || "").toLowerCase();
  if (["control", "meta", "shift"].includes(key)) {
    releasePasteShortcutLocks();
  }
};

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("keyup", onGlobalKeyup, true);
  window.addEventListener("mousedown", onGlobalPointerDown, true);
  window.addEventListener("blur", closeDesktopTabContextMenu);
  window.addEventListener("blur", closeStorageNodeContextMenu);
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
  nextTick(() => {
    refreshContentProgress();
  });
});

onBeforeUnmount(() => {
  isSidebarDragging.value = false;
  isFileSidebarDragging.value = false;
  cancelDesktopRenameDialog();
  cancelStorageRenameDialog();
  if (activeMarkdownRelPath.value && !markdownHydrating.value) {
    void flushPendingMarkdownSave(activeMarkdownRelPath.value);
  }
  disposeDesktopTerminal();
  disposeTerminal();
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
  finishSidebarDrag();
  finishFileSidebarDrag();
  document.body.style.userSelect = "";
  if (terminalResizeSyncTimer) {
    clearTimeout(terminalResizeSyncTimer);
    terminalResizeSyncTimer = null;
  }
  terminalDragSizing = false;
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("keyup", onGlobalKeyup, true);
  window.removeEventListener("mousedown", onGlobalPointerDown, true);
  window.removeEventListener("blur", closeDesktopTabContextMenu);
  window.removeEventListener("blur", closeStorageNodeContextMenu);
  window.removeEventListener("blur", releasePasteShortcutLocks);
  window.removeEventListener("resize", refreshContentProgress);
  if (desktopWindowMaximizeOff) {
    desktopWindowMaximizeOff();
    desktopWindowMaximizeOff = null;
  }
});
</script>
