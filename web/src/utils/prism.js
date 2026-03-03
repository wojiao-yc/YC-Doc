import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-python";

export const highlightAllUnder = (root) => {
  if (!root) {
    return;
  }
  Prism.highlightAllUnder(root);
};
