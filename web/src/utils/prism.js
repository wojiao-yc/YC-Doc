import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-python";
import { escapeHtml } from "./escapeHtml";

const normalizeLanguage = (lang) => {
  const raw = String(lang || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  const alias = {
    js: "javascript",
    node: "javascript",
    py: "python",
    ps1: "powershell",
    pwsh: "powershell",
    shell: "bash",
    sh: "bash",
    zsh: "bash",
    yml: "yaml"
  };
  return alias[raw] || raw;
};

export const highlightAllUnder = (root) => {
  if (!root) {
    return;
  }
  Prism.highlightAllUnder(root);
};

export const highlightCode = (code, lang) => {
  const language = normalizeLanguage(lang);
  const grammar = language ? Prism.languages[language] : null;
  if (!grammar) {
    return {
      html: escapeHtml(code),
      language
    };
  }
  try {
    return {
      html: Prism.highlight(String(code || ""), grammar, language),
      language
    };
  } catch {
    return {
      html: escapeHtml(code),
      language
    };
  }
};
