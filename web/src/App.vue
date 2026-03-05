<template>
  <div
    id="app"
    v-cloak
    class="flex h-screen min-h-0 overflow-hidden bg-[#fcfcfc] text-slate-900"
    :class="{ 'dark-ui': isDark }"
  >
    <aside
      class="sidebar-panel flex flex-col flex-shrink-0 border-r min-h-0"
      :style="{ width: `${sidebarPanelWidth}px` }"
      :class="[
        isSidebarCollapsed ? 'is-collapsed' : '',
        isSidebarDragging ? 'is-dragging' : '',
        isSidebarHidden
          ? 'is-hidden border-transparent bg-transparent'
          : (isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-[#fafafa]')
      ]"
    >
      <div :class="isSidebarCollapsed ? 'px-2 py-3' : 'p-5 pb-4'">
        <div :class="isSidebarCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-start justify-between gap-2'">
          <div :class="isSidebarCollapsed ? 'flex items-center justify-center w-full' : 'flex items-center gap-3 min-w-0'">
            <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">G</div>
            <div v-if="!isSidebarCollapsed" class="min-w-0">
              <h1 class="font-bold text-lg tracking-tight truncate" :class="isDark ? 'text-slate-100' : 'text-gray-800'">
                Gemini Doc
              </h1>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-slate-500' : 'text-gray-400'">交互式汇报系统 Pro</p>
            </div>
          </div>
          <div v-if="isEditMode" :class="isSidebarCollapsed ? 'flex items-center justify-center w-full' : 'flex items-center gap-1 shrink-0'">
            <button
              type="button"
              class="sidebar-collapse-btn sidebar-tip-btn"
              :data-tip="isSidebarCollapsed ? '展开侧栏' : '折叠侧栏'"
              @click="toggleSidebarCollapse"
            >
              <span v-if="isSidebarCollapsed">›</span>
              <span v-else>‹</span>
            </button>
          </div>
        </div>
        <div v-if="!isSidebarCollapsed" class="sidebar-overall-progress" :class="isDark ? 'is-dark' : ''">
          <span class="sidebar-overall-progress-fill" :style="{ width: `${Math.round(sidebarChapterProgress * 100)}%` }"></span>
        </div>
      </div>

      <nav class="flex-1 min-h-0 overflow-y-auto">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          @click="currentId = step.id"
          :title="isSidebarCollapsed ? step.title : ''"
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
              :class="[
                isEditMode
                  ? (isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-200 text-gray-400')
                  : (index < currentStepIndex
                    ? 'bg-orange-500 text-white'
                    : (currentId === step.id
                      ? 'bg-orange-500 text-white'
                      : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-200 text-gray-400')))
              ]"
            >
              {{ isEditMode ? index + 1 : (index < currentStepIndex ? '✓' : index + 1) }}
            </div>
            <span class="nav-step-track" :class="isDark ? 'is-dark' : ''">
              <span class="nav-step-track-fill" :style="{ transform: `scaleY(${stepProgressForIndex(index)})` }"></span>
            </span>
          </div>

          <div v-if="!isSidebarCollapsed" class="flex-1 min-w-0">
            <div v-if="isEditMode" class="space-y-1">
              <input
                v-model="step.title"
                type="text"
                @click.stop
                class="w-full text-sm font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none px-1 py-0.5"
                :class="isDark ? 'text-slate-100 hover:border-slate-700' : 'text-gray-800'"
                placeholder="标题"
              />
              <input
                v-model="step.subtitle"
                type="text"
                @click.stop
                class="w-full text-[11px] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none px-1 py-0.5"
                :class="isDark ? 'text-slate-400 hover:border-slate-700' : 'text-gray-500'"
                placeholder="副标题（可选）"
              />
            </div>

            <div v-else class="flex flex-col" :class="{ 'justify-center': !step.subtitle, 'min-h-[2.5rem]': !step.subtitle }">
              <h3
                class="text-sm font-medium"
                :class="currentId === step.id ? 'text-orange-600 font-bold' : (isDark ? 'text-slate-300' : 'text-gray-600')"
              >
                {{ step.title }}
              </h3>
              <p v-if="step.subtitle" class="text-[11px] mt-1" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
                {{ step.subtitle }}
              </p>
            </div>
          </div>
        </div>
      </nav>

      <div
        v-if="isEditMode && !isSidebarCollapsed && !isSidebarHidden"
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
      </div>
    </aside>

    <div
      v-if="isEditMode"
      class="sidebar-resize-handle flex-shrink-0"
      :class="[
        isSidebarHidden ? 'is-hidden' : '',
        isDark ? 'is-dark' : ''
      ]"
      @mousedown="startSidebarResizeDrag"
    >
      <div class="sidebar-resize-line"></div>
    </div>

    <main ref="mainRef" class="relative flex-1 min-w-0 min-h-0 flex flex-col" :class="isDark ? 'bg-slate-950' : 'bg-white'">
      <header
        class="sticky top-0 z-30 px-10 py-5 border-b flex justify-between items-center backdrop-blur"
        :class="isDark ? 'border-slate-800 bg-slate-950/80' : 'border-gray-100 bg-white/80'"
      >
        <div class="header-meta header-meta-inline min-w-0 flex-1">
          <template v-if="isEditMode">
            <input
              v-model="activeStep.title"
              type="text"
              class="header-meta-input header-meta-input-title"
              :class="isDark ? 'is-dark' : ''"
              placeholder="步骤标题"
            />
            <input
              v-model="activeStep.subtitle"
              type="text"
              class="header-meta-input header-meta-input-sub"
              :class="isDark ? 'is-dark' : ''"
              placeholder="步骤副标题（可选）"
            />
          </template>
          <template v-else>
            <span class="header-meta-title">{{ activeStep.title }}</span>
            <span class="header-meta-dot">·</span>
            <span class="header-meta-sub header-meta-sub-inline">{{ activeStep.subtitle || "未设置副标题" }}</span>
          </template>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 flex-nowrap shrink-0">
          <template v-if="isEditMode">
            <div class="relative app-settings-popover">
              <button
                type="button"
                class="px-3 py-2 text-sm rounded-lg transition-all flex items-center justify-center shrink-0"
                :class="isDark ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                @click.stop="toggleSettingsPanel"
              >
                ⚙
              </button>
              <div
                v-if="settingsPanelOpen"
                class="absolute right-0 top-[calc(100%+10px)] z-40 w-80 rounded-xl border p-3 shadow-xl"
                :class="isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white text-gray-800'"
                @click.stop
              >
                <div class="text-xs mb-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">设置</div>
                <label
                  class="flex items-start gap-3 rounded-lg p-2 cursor-pointer transition-all"
                  :class="isDark ? 'hover:bg-slate-800/80' : 'hover:bg-gray-50'"
                >
                  <input
                    v-model="gestureNavigationEnabled"
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 accent-orange-500"
                  />
                  <span class="text-sm leading-6">
                    启用点击翻页模式（隐藏底部翻页按钮）
                  </span>
                </label>
              </div>
            </div>

            <button
              @click="toggleDark"
              class="px-3 py-2 text-sm rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              :class="isDark ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            >
              🌙 <span class="hidden xl:inline">主题</span>
            </button>

            <button
              @click="toggleMode"
              class="px-4 py-2 text-sm rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              :class="'bg-orange-500 text-white hover:bg-orange-600'"
            >
              <span>👁 <span class="hidden xl:inline">展示</span></span>
            </button>
          </template>
          <template v-else>
            <span class="header-meta-page">第 {{ currentStepIndex + 1 }} / {{ steps.length }} 页</span>
          </template>
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
            <div :key="currentId" class="flex flex-col">
              <div
                v-if="!isEditMode"
                class="mb-10 w-full relative mx-auto"
                :class="gestureNavigationEnabled ? 'px-12 md:px-20 lg:px-28' : 'px-2 md:px-4'"
                @click="handlePreviewNavClick"
              >
                <div class="mx-auto" :style="displayStyle">
                  <div data-preview="1" :class="isDark ? 'md-dark' : 'md-light'" v-html="renderedMarkdown"></div>
                </div>
              </div>

              <div
                v-else
                ref="editSplitRef"
                class="flex border rounded-xl overflow-hidden shadow-sm min-h-[520px]"
                :class="isDark ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-white'"
              >
                <div
                  class="min-w-0 border-r flex flex-col"
                  :style="{ width: `${editorPaneWidth}px` }"
                  :class="isDark ? 'border-slate-800' : 'border-gray-200'"
                >
                  <div
                    class="px-4 py-3 border-b flex items-center justify-between gap-2"
                    :class="isDark ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'"
                  >
                    <span class="text-sm font-medium" :class="isDark ? 'text-slate-100' : 'text-gray-700'">Markdown 编辑</span>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="px-2 py-1 text-xs rounded-lg transition-all"
                        :class="isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'"
                        @click="insertImageToMarkdown"
                      >
                        插入图片
                      </button>
                      <button
                        v-if="isDesktopPty"
                        type="button"
                        class="px-2 py-1 text-xs rounded-lg transition-all"
                        :class="isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'"
                        @click="openDesktopImageFolder"
                      >
                        图片目录
                      </button>
                    </div>
                  </div>
                  <textarea
                    v-model="activeStep.content"
                    class="flex-1 w-full p-6 font-mono text-sm leading-relaxed bg-transparent resize-none focus:outline-none"
                    :class="isDark ? 'text-slate-100' : 'text-gray-800'"
                    spellcheck="false"
                  ></textarea>
                </div>

                <div
                  class="w-2 cursor-col-resize flex-shrink-0"
                  :class="isDark ? 'bg-slate-950 hover:bg-orange-500/10' : 'bg-white hover:bg-orange-200/40'"
                  @mousedown="startEditorResize"
                >
                  <div class="w-px h-full mx-auto" :class="isDark ? 'bg-slate-800' : 'bg-gray-200'"></div>
                </div>

                <div class="flex-1 min-w-0 flex flex-col">
                  <div class="px-4 py-3 border-b flex items-center justify-between" :class="isDark ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-200'">
                    <span class="text-sm font-medium" :class="isDark ? 'text-slate-100' : 'text-gray-700'">实时预览（最终展示宽度）</span>
                    <div class="flex items-center gap-2 text-xs font-mono" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                      <span>宽度</span>
                      <span class="px-2 py-1 rounded-lg" :class="isDark ? 'bg-slate-800 text-slate-200' : 'bg-gray-200 text-gray-700'">
                        {{ displayWidth }}px
                      </span>
                      <button
                        @click="resetDisplayWidth"
                        class="px-2 py-1 rounded-lg transition-all"
                        :class="isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'"
                      >
                        重置
                      </button>
                    </div>
                  </div>

                  <div class="flex-1 p-6 overflow-y-auto relative">
                    <div class="mx-auto relative" :style="displayStyle">
                      <div data-preview="1" :class="isDark ? 'md-dark' : 'md-light'" v-html="renderedMarkdown"></div>
                      <div class="absolute top-0 -right-3 bottom-0 w-3 cursor-ew-resize" @mousedown="startDisplayResize">
                        <div class="w-px h-full mx-auto" :class="isDark ? 'bg-orange-400/40' : 'bg-orange-500/40'"></div>
                      </div>
                    </div>
                    <div class="mt-3 text-xs" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
                      提示：拖动预览右侧竖条可调整最终展示宽度。
                    </div>
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
            <button
              type="button"
              class="term-icon-btn term-tip-btn"
              :data-tip="terminalMaximized ? '还原面板' : '最大化面板'"
              :aria-label="terminalMaximized ? '还原面板' : '最大化面板'"
              @mousedown.stop
              @click="toggleTerminalMaximize"
            >
              <svg v-if="!terminalMaximized" class="term-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else class="term-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M5 3.5h7.5V11M11 5H3.5v7.5H11z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              class="term-icon-btn term-tip-btn"
              data-tip="隐藏面板"
              aria-label="隐藏面板"
              @mousedown.stop
              @click="closeTerminal"
            >
              <svg class="term-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
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

    <ToastMessage :toast="toast" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTermTerminal } from "xterm";
import ToastMessage from "./components/ToastMessage.vue";
import { useMarkdown } from "./composables/useMarkdown";
import { useResizable } from "./composables/useResizable";
import { useSteps } from "./composables/useSteps";
import { useTerminal } from "./composables/useTerminal";
import { useToast } from "./composables/useToast";

const mode = ref("view");
const isDark = ref(false);
const settingsPanelOpen = ref(false);
const gestureNavigationEnabled = ref(false);
const isEditMode = computed(() => mode.value === "edit");
const terminalPanelHeight = ref(320);
const terminalMaximized = ref(false);
const terminalTab = ref("terminal");
const mainRef = ref(null);
const contentScrollRef = ref(null);
const terminalViewportRef = ref(null);
const terminalSplitWrapRef = ref(null);
const isSidebarCollapsed = ref(false);
const isSidebarHidden = ref(false);
const isSidebarDragging = ref(false);
const currentContentReadProgress = ref(0);
const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_HIDE_SNAP = 44;
const SIDEBAR_COLLAPSE_SNAP = SIDEBAR_COLLAPSED_WIDTH + 34;
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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const TERMINAL_MIN_HEIGHT = 120;
const TERMINAL_HIDE_THRESHOLD = 56;
const TERMINAL_MAX_SNAP_GAP = 20;
const GESTURE_NAV_STORAGE_KEY = "yc-doc.gesture-nav.v1";

const { toast, showToast } = useToast();

const {
  steps,
  currentId,
  activeStep,
  currentStepIndex,
  isFirstStep,
  isLastStep,
  next,
  prev,
  addStep,
  removeStep,
  onDragStart,
  onDragOver,
  onDrop
} = useSteps(showToast);

const {
  sidebarWidth,
  editorPaneWidth,
  displayWidth,
  displayStyle,
  editSplitRef,
  startEditorResize,
  startDisplayResize,
  resetDisplayWidth
} = useResizable();

if (typeof window !== "undefined") {
  try {
    gestureNavigationEnabled.value = localStorage.getItem(GESTURE_NAV_STORAGE_KEY) === "1";
  } catch {
    gestureNavigationEnabled.value = false;
  }
}

const sidebarPanelWidth = computed(() => {
  if (isSidebarHidden.value) {
    return 0;
  }
  if (isSidebarCollapsed.value) {
    return SIDEBAR_COLLAPSED_WIDTH;
  }
  return sidebarWidth.value;
});

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
    target.closest("a, button, input, textarea, select, label, summary, [role='button'], .code-copy")
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

const closeSettingsPanel = () => {
  settingsPanelOpen.value = false;
};

const toggleSettingsPanel = () => {
  settingsPanelOpen.value = !settingsPanelOpen.value;
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
  isSidebarHidden.value = false;
  if (isSidebarCollapsed.value) {
    isSidebarCollapsed.value = false;
    sidebarWidth.value = clamp(sidebarWidth.value, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
  } else {
    isSidebarCollapsed.value = true;
  }
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
    queueSidebarDragWidth(startW + dx);
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

const { renderedMarkdown } = useMarkdown(activeStep, [isDark, mode, currentId], showToast);

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

const toggleMode = () => {
  closeSettingsPanel();
  const nextMode = isEditMode.value ? "view" : "edit";
  mode.value = nextMode;
  if (isDesktopPty.value && desktopWindowBridge?.setFullscreen) {
    const shouldFullscreen = nextMode === "view";
    void desktopWindowBridge.setFullscreen(shouldFullscreen).then(() => {
      desktopFullscreen.value = shouldFullscreen;
      nextTick(() => {
        void syncDesktopTerminalSize();
      });
    });
  }
};

const appendMarkdownImage = (url) => {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    return;
  }
  const current = String(activeStep.value?.content || "");
  const suffix = current.endsWith("\n") ? "\n" : "\n\n";
  activeStep.value.content = `${current}${suffix}![image](${safeUrl})\n`;
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
  const tag = document.activeElement?.tagName?.toLowerCase() || "";
  const typing = tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable;

  if (event.key === "Escape" && settingsPanelOpen.value) {
    event.preventDefault();
    closeSettingsPanel();
    return;
  }
  if (event.key === "Escape" && !isEditMode.value) {
    event.preventDefault();
    toggleMode();
    return;
  }
  if (event.key === "Escape" && desktopFullscreen.value) {
    event.preventDefault();
    if (desktopWindowBridge?.setFullscreen) {
      void desktopWindowBridge.setFullscreen(false).then(() => {
        desktopFullscreen.value = false;
      });
    }
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
  if (
    settingsPanelOpen.value &&
    !(target instanceof Element && target.closest(".app-settings-popover"))
  ) {
    closeSettingsPanel();
  }

  if (!desktopTabMenu.value.open) {
    return;
  }
  if (target instanceof Element && target.closest(".term-context-menu")) {
    return;
  }
  closeDesktopTabContextMenu();
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
  window.addEventListener("blur", releasePasteShortcutLocks);
  window.addEventListener("resize", refreshContentProgress);
  if (isDesktopPty.value) {
    terminalTab.value = "terminal";
    void syncDesktopFullscreenState();
    if (desktopWindowBridge?.setFullscreen) {
      void desktopWindowBridge.setFullscreen(mode.value === "view").then(() => {
        desktopFullscreen.value = mode.value === "view";
      });
    }
  }
  nextTick(() => {
    refreshContentProgress();
  });
});

onBeforeUnmount(() => {
  isSidebarDragging.value = false;
  cancelDesktopRenameDialog();
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
  finishSidebarDrag();
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
  window.removeEventListener("blur", releasePasteShortcutLocks);
  window.removeEventListener("resize", refreshContentProgress);
});
</script>
