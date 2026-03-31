<template>
  <!-- Window chrome icons -->
  <svg
    v-if="name === 'panel-left'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="1.8" y="2.2" width="12.4" height="11.6" rx="2" />
    <path :d="collapsed ? 'M11.2 3.8v8.4' : 'M4.8 3.8v8.4'" />
  </svg>

  <svg
    v-else-if="name === 'panel-right'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="1.8" y="2.2" width="12.4" height="11.6" rx="2" />
    <path :d="collapsed ? 'M4.8 3.8v8.4' : 'M11.2 3.8v8.4'" />
  </svg>

  <svg
    v-else-if="name === 'minimize'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 8h8" />
  </svg>

  <svg
    v-else-if="name === 'maximize'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
  </svg>

  <svg
    v-else-if="name === 'restore'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="4.7" y="3.3" width="7.1" height="7.1" rx="0.8" />
    <path d="M3.4 5.5V12h6.5" />
  </svg>

  <svg
    v-else-if="name === 'close'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4.5 4.5l7 7m0-7-7 7" />
  </svg>

  <!-- Workspace, editor, and storage icons -->
  <svg
    v-else-if="name === 'graph'"
    viewBox="0 0 1024 1024"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M341.333333 251.733333v4.266667-4.266667zM341.333333 264.533333v10.666667c2.133333 14.933333 4.266667 29.866667 10.666667 44.8v2.133333c0 2.133333 2.133333 2.133333 2.133333 4.266667v-2.133333 4.266666l2.133334 6.4c14.933333 29.866667 36.266667 53.333333 64 70.4 27.733333 17.066667 59.733333 25.6 91.733333 25.6s64-10.666667 91.733333-27.733333c27.733333-17.066667 49.066667-42.666667 61.866667-72.533333l2.133333-4.266667v-2.133333l2.133334-6.4c8.533333-23.466667 10.666667-46.933333 10.666666-70.4-2.133333-23.466667-8.533333-46.933333-19.2-68.266667s-27.733333-40.533333-44.8-55.466667c-19.2-17.066667-40.533333-27.733333-64-34.133333-23.466667-6.4-46.933333-6.4-70.4-2.133333-23.466667 4.266667-46.933333 12.8-66.133333 27.733333-19.2 12.8-36.266667 32-49.066667 51.2-12.8 21.333333-21.333333 42.666667-23.466666 66.133333V256c-2.133333 2.133333-2.133333 4.266667-2.133334 8.533333z m110.933334-68.266666C467.2 179.2 488.533333 170.666667 512 170.666667s44.8 8.533333 59.733333 25.6c17.066667 14.933333 25.6 36.266667 25.6 59.733333 0 23.466667-8.533333 44.8-25.6 59.733333-14.933333 17.066667-36.266667 25.6-59.733333 25.6s-44.8-8.533333-59.733333-25.6c-17.066667-14.933333-25.6-36.266667-25.6-59.733333 0-23.466667 8.533333-44.8 25.6-59.733333zM870.4 499.2l-2.133333-6.4c-17.066667-91.733333-68.266667-174.933333-145.066667-230.4v-4.266667 4.266667c0 32-8.533333 64-23.466667 91.733333 40.533333 38.4 68.266667 85.333333 81.066667 140.8 32-6.4 61.866667-4.266667 89.6 4.266667zM241.066667 492.8c12.8-53.333333 40.533333-102.4 81.066666-138.666667-14.933333-27.733333-21.333333-59.733333-23.466666-91.733333l-6.4 4.266667-6.4 4.266666c-72.533333 57.6-119.466667 138.666667-132.266667 228.266667 27.733333-8.533333 57.6-10.666667 87.466667-6.4zM155.733333 544h-2.133333 2.133333zM153.6 544h-2.133333 2.133333zM217.6 533.333333H213.333333h4.266667zM625.066667 808.533333c-34.133333 14.933333-72.533333 23.466667-113.066667 23.466667-38.4 0-76.8-8.533333-113.066667-23.466667-14.933333 25.6-34.133333 49.066667-57.6 66.133334 51.2 27.733333 108.8 42.666667 170.666667 42.666666 59.733333 0 117.333333-14.933333 170.666667-42.666666-23.466667-17.066667-42.666667-40.533333-57.6-66.133334zM149.333333 546.133333zM341.333333 817.066667l4.266667-4.266667 2.133333-2.133333c4.266667-4.266667 6.4-10.666667 10.666667-14.933334l2.133333-2.133333 2.133334-2.133333-2.133334 2.133333 2.133334-2.133333V789.333333c12.8-23.466667 21.333333-51.2 21.333333-78.933333s-6.4-55.466667-17.066667-81.066667c-12.8-25.6-32-46.933333-53.333333-61.866666-23.466667-17.066667-49.066667-25.6-76.8-29.866667H221.866667L213.333333 533.333333c-6.4 0-14.933333 0-21.333333 2.133334-4.266667 0-10.666667 2.133333-14.933333 2.133333-2.133333 0-4.266667 0-6.4 2.133333-4.266667 2.133333-8.533333 2.133333-12.8 4.266667h-2.133334l-6.4 2.133333c-23.466667 8.533333-44.8 23.466667-61.866666 42.666667-17.066667 19.2-29.866667 42.666667-38.4 66.133333s-8.533333 51.2-4.266667 76.8c4.266667 25.6 14.933333 49.066667 29.866667 70.4s34.133333 38.4 57.6 51.2c23.466667 12.8 46.933333 19.2 72.533333 21.333334 25.6 2.133333 51.2-2.133333 74.666667-12.8s44.8-25.6 61.866666-44.8z m-68.266666-53.333334c-14.933333 17.066667-36.266667 25.6-59.733334 25.6-23.466667 0-44.8-8.533333-59.733333-25.6C136.533333 748.8 128 727.466667 128 704c0-23.466667 8.533333-44.8 25.6-59.733333 14.933333-17.066667 36.266667-25.6 59.733333-25.6 23.466667 0 44.8 8.533333 59.733334 25.6 17.066667 17.066667 25.6 38.4 25.6 59.733333 0 23.466667-8.533333 44.8-25.6 59.733333zM149.333333 546.133333zM814.933333 533.333333H810.666667h4.266666zM968.533333 637.866667c-8.533333-21.333333-23.466667-42.666667-40.533333-57.6-17.066667-17.066667-38.4-29.866667-59.733333-36.266667-4.266667-2.133333-8.533333-2.133333-12.8-4.266667-12.8-4.266667-23.466667-6.4-36.266667-6.4H791.466667c-27.733333 4.266667-55.466667 14.933333-78.933334 32s-40.533333 38.4-53.333333 64c-12.8 25.6-17.066667 53.333333-17.066667 83.2 2.133333 27.733333 10.666667 55.466667 25.6 81.066667 4.266667 6.4 8.533333 10.666667 12.8 17.066667l2.133334 2.133333 4.266666 4.266667c2.133333 4.266667 6.4 6.4 10.666667 10.666666 4.266667 2.133333 6.4 6.4 10.666667 8.533334 4.266667 2.133333 6.4 4.266667 10.666666 8.533333l2.133334 2.133333 4.266666 2.133334h-2.133333 4.266667c21.333333 12.8 42.666667 19.2 66.133333 23.466666 23.466667 2.133333 46.933333 0 70.4-6.4 23.466667-6.4 44.8-19.2 61.866667-34.133333 17.066667-14.933333 32-34.133333 42.666666-55.466667s14.933333-44.8 17.066667-68.266666c-4.266667-23.466667-8.533333-46.933333-17.066667-70.4z m-98.133333 125.866666c-14.933333 17.066667-36.266667 25.6-59.733333 25.6s-44.8-8.533333-59.733334-25.6c-17.066667-14.933333-25.6-36.266667-25.6-59.733333 0-23.466667 8.533333-44.8 25.6-59.733333C768 627.2 789.333333 618.666667 810.666667 618.666667s44.8 8.533333 59.733333 25.6C887.466667 661.333333 896 682.666667 896 704c0 23.466667-8.533333 44.8-25.6 59.733333z" />
  </svg>

  <svg
    v-else-if="name === 'file'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4.3 2.5h4.5l2.7 2.8v8.1H4.3z" />
    <path d="M8.8 2.5v2.9h2.7" />
    <path d="M6 8.4h3.8M6 10.7h3.8" />
  </svg>

  <svg
    v-else-if="name === 'new-file'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4.1 2.6h4.3l2.8 2.8v7.9H4.1z" />
    <path d="M8.4 2.6v2.9h2.8" />
    <path d="M8 8v3.2M6.4 9.6h3.2" />
  </svg>

  <svg
    v-else-if="name === 'new-folder'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M2.2 4.6h3.1l1.2 1.3h7.3v5.6a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1z" />
    <path d="M8 7.3v3.1M6.45 8.85h3.1" />
  </svg>

  <svg
    v-else-if="name === 'folder'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M2.2 4.9h3.2l1.2 1.2h7.2v5.4a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1z" />
  </svg>

  <svg
    v-else-if="name === 'folder-open'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M2.2 5h3.1l1.2 1.2h7l-.9 4.9a1 1 0 0 1-1 .8H3.1a1 1 0 0 1-1-1z" />
    <path d="M2.8 6.2h11" />
  </svg>

  <svg
    v-else-if="name === 'workspace-switch'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3.1 4.2 5 2.3l1.9 1.9M5 2.7v4.8" />
    <path d="M12.9 11.8 11 13.7l-1.9-1.9M11 13.3V8.5" />
    <path d="M6.5 5.1h5.3M4.2 10.9h5.3" />
  </svg>

  <svg
    v-else-if="name === 'sort-asc'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 4h5.7M3 7.9h4.1M3 11.8h2.6" />
    <path d="M11.4 12V4.2m0 0-2 2m2-2 2 2" />
  </svg>

  <svg
    v-else-if="name === 'sort-desc'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 4h5.7M3 7.9h4.1M3 11.8h2.6" />
    <path d="M11.4 4v7.8m0 0-2-2m2 2 2-2" />
  </svg>

  <svg
    v-else-if="name === 'info'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="8" cy="8" r="5.8" />
    <path d="M8 7v3.4" />
    <circle cx="8" cy="4.6" r=".7" fill="currentColor" stroke="none" />
  </svg>

  <svg
    v-else-if="name === 'settings'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m8 2.2.8 1.5 1.7.4 1.2-1 .9.9-1 1.2.4 1.7 1.5.8v1.1l-1.5.8-.4 1.7 1 1.2-.9.9-1.2-1-1.7.4-.8 1.5H6.9l-.8-1.5-1.7-.4-1.2 1-.9-.9 1-1.2-.4-1.7-1.5-.8V7.4l1.5-.8.4-1.7-1-1.2.9-.9 1.2 1 1.7-.4.8-1.5Z" />
    <circle cx="8" cy="8" r="2" />
  </svg>

  <!-- Tree controls and context actions -->
  <svg
    v-else-if="name === 'chevron-right'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.35"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m6.2 3.8 4 4.2-4 4.2" />
  </svg>

  <svg
    v-else-if="name === 'chevron-down'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.35"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m3.8 6.2 4.2 4 4.2-4" />
  </svg>

  <svg
    v-else-if="name === 'rename'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3.2 11.6V13h1.4l6.1-6.1-1.4-1.4z" />
    <path d="m8.9 4.8 1.4-1.4 1.4 1.4-1.4 1.4z" />
  </svg>

  <svg
    v-else-if="name === 'delete'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 4.5h9" />
    <path d="M6.2 4.5v-1h3.6v1" />
    <path d="M5.2 4.5v7.1a1 1 0 0 0 1 1h3.6a1 1 0 0 0 1-1V4.5" />
    <path d="M6.9 6.8v3.4M9.1 6.8v3.4" />
  </svg>

  <svg
    v-else-if="name === 'open-folder'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M2.3 5h3.1l1.1 1.1h7.2v5.2a1 1 0 0 1-1 1H3.3a1 1 0 0 1-1-1z" />
    <path d="m8.3 8.1 2.2 2.2m0 0V8.5m0 1.8H8.7" />
  </svg>

  <!-- Terminal controls -->
  <svg
    v-else-if="name === 'add'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M8 3v10M3 8h10" />
  </svg>

  <svg
    v-else-if="name === 'split'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="2.5" y="3" width="11" height="10" rx="1.2" />
    <path d="M8 3v10" />
  </svg>

  <svg
    v-else-if="name === 'terminate'"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 4.5h10M6.2 2.5h3.6m-5.6 2 .6 8.2h6.4l.6-8.2" />
    <path d="M6.8 6.4v4.4M9.2 6.4v4.4" />
  </svg>

  <!-- Safe fallback so missing names are visible during development -->
  <svg
    v-else
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="8" cy="8" r="5.5" />
  </svg>
</template>

<script setup>
defineProps({
  // `name` selects the icon variant; `collapsed` covers the two panel-toggle glyphs.
  name: {
    type: String,
    default: ""
  },
  collapsed: {
    type: Boolean,
    default: false
  }
});
</script>
