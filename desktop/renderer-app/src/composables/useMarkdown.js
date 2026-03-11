import { computed, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { marked } from "marked";
import { copyText } from "../utils/clipboard";
import { escapeHtml } from "../utils/escapeHtml";
import { normalizeImageHref } from "../utils/markdownVisualEditor";
import { highlightAllUnder, highlightCode } from "../utils/prism";

export const useMarkdown = (activeStep, deps, showToast) => {
  const renderer = new marked.Renderer();
  let highlightRetryTimer = null;
  let highlightRetryTimerLate = null;

  renderer.code = (code, infostring) => {
    const lang = ((infostring || "").match(/\S*/)?.[0] || "").trim();
    const highlighted = highlightCode(code, lang);
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
            <span class="code-meta">${highlighted.language || lang || "code"}</span>
          </div>
          <button class="code-copy" onclick="window.__copyCode('${id}', this)">Copy</button>
        </div>
        <div class="code-card-body">
          <pre><code id="${id}" class="language-${highlighted.language || "none"}">${highlighted.html}</code></pre>
        </div>
      </div>
    `;
  };

  renderer.image = (href, title, text) => {
    let src = href;
    let imgTitle = title;
    let alt = text;

    if (href && typeof href === "object") {
      src = href.href;
      imgTitle = href.title;
      alt = href.text;
    }

    const normalized = normalizeImageHref(src);
    if (!normalized) {
      return "";
    }

    const safeSrc = escapeHtml(normalized);
    const safeAlt = escapeHtml(String(alt || ""));
    const safeTitle = imgTitle ? ` title="${escapeHtml(String(imgTitle))}"` : "";
    return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy"${safeTitle} />`;
  };

  const renderedMarkdown = computed(() => marked.parse(activeStep.value?.content || "", {
    breaks: true,
    gfm: true,
    renderer
  }));

  const runHighlight = () => {
    const roots = Array.from(document.querySelectorAll('[data-preview="1"]'));
    roots.forEach((root) => highlightAllUnder(root));
  };

  const clearHighlightTimers = () => {
    if (highlightRetryTimer) {
      clearTimeout(highlightRetryTimer);
      highlightRetryTimer = null;
    }
    if (highlightRetryTimerLate) {
      clearTimeout(highlightRetryTimerLate);
      highlightRetryTimerLate = null;
    }
  };

  const postRender = async () => {
    await nextTick();
    runHighlight();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        runHighlight();
        requestAnimationFrame(() => {
          runHighlight();
        });
      });
    }
    clearHighlightTimers();
    highlightRetryTimer = setTimeout(() => {
      runHighlight();
      highlightRetryTimer = null;
    }, 90);
    highlightRetryTimerLate = setTimeout(() => {
      runHighlight();
      highlightRetryTimerLate = null;
    }, 260);
  };

  watch([renderedMarkdown, ...(deps || [])], () => {
    void postRender();
  }, { immediate: true, flush: "post" });

  const copyHandler = async (id, button) => {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }

    const ok = await copyText(node.innerText || "");
    if (button) {
      const prev = button.innerText;
      button.innerText = ok ? "Copied" : "Copy failed";
      setTimeout(() => {
        button.innerText = prev;
      }, 700);
    }
    if (ok && showToast) {
      showToast("Copied");
    }
  };

  onMounted(() => {
    window.__copyCode = copyHandler;
  });

  onBeforeUnmount(() => {
    clearHighlightTimers();
    if (window.__copyCode === copyHandler) {
      delete window.__copyCode;
    }
  });

  return { renderedMarkdown };
};
