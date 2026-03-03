import { computed, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { marked } from "marked";
import { copyText } from "../utils/clipboard";
import { escapeHtml } from "../utils/escapeHtml";
import { highlightAllUnder } from "../utils/prism";

export const useMarkdown = (activeStep, deps, showToast) => {
  const renderer = new marked.Renderer();

  renderer.code = (code, infostring) => {
    const lang = ((infostring || "").match(/\S*/)?.[0] || "").trim();
    const safe = escapeHtml(code);
    const id = `code_${Math.random().toString(36).slice(2, 10)}`;

    return `
      <div class="code-card">
        <div class="code-card-header">
          <div class="flex items-center min-w-0">
            <div class="dots">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
            </div>
            <span class="code-meta">${lang || "code"}</span>
          </div>
          <button class="code-copy" onclick="window.__copyCode('${id}', this)">复制</button>
        </div>
        <div class="code-card-body">
          <pre><code id="${id}" class="language-${lang || "none"}">${safe}</code></pre>
        </div>
      </div>
    `;
  };

  marked.setOptions({ breaks: true, gfm: true, renderer, sanitize: false });

  const renderedMarkdown = computed(() =>
    marked.parse(activeStep.value?.content || "")
  );

  const postRender = async () => {
    await nextTick();
    const roots = Array.from(document.querySelectorAll('[data-preview="1"]'));
    roots.forEach((root) => highlightAllUnder(root));
  };

  watch([renderedMarkdown, ...(deps || [])], postRender, { immediate: true });

  const copyHandler = async (id, button) => {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }

    const ok = await copyText(node.innerText || "");
    if (button) {
      const prev = button.innerText;
      button.innerText = ok ? "已复制" : "复制失败";
      setTimeout(() => {
        button.innerText = prev;
      }, 700);
    }
    if (ok && showToast) {
      showToast("已复制");
    }
  };

  onMounted(() => {
    window.__copyCode = copyHandler;
  });

  onBeforeUnmount(() => {
    if (window.__copyCode === copyHandler) {
      delete window.__copyCode;
    }
  });

  return { renderedMarkdown };
};
