export const extractCodeBlocks = (markdown) => {
  const md = String(markdown || "");
  const re = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = re.exec(md)) !== null) {
    const lang = (match[1] || "").trim().toLowerCase();
    const code = (match[2] || "").replace(/\s+$/g, "");
    const first = code.split("\n").find((line) => line.trim().length) || "";
    blocks.push({
      lang,
      code,
      preview: first.length > 42 ? `${first.slice(0, 42)}...` : first
    });
  }

  return blocks;
};
