export const COPY_ICON_PATH = "M810.666667 170.666667H426.666667V85.333333h384a85.333333 85.333333 0 0 1 85.333333 85.333334v469.333333h-85.333333V170.666667zM128 341.333333a85.333333 85.333333 0 0 1 85.333333-85.333333h426.666667c47.04 0 85.333333 38.037333 85.333333 85.269333v512.234667A85.12 85.12 0 0 1 640.064 938.666667H213.248A85.248 85.248 0 0 1 128 853.333333V341.333333z m512 0H213.333333v512h426.666667V341.333333z";

export const createCopyIconSvgElement = (className = "") => {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 1024 1024");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  if (className) {
    svg.setAttribute("class", className);
  }

  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", COPY_ICON_PATH);
  svg.appendChild(path);
  return svg;
};

export const renderCopyIconSvgMarkup = (className = "") => {
  const classAttr = className ? ` class="${String(className)}"` : "";
  return `<svg${classAttr} viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true"><path d="${COPY_ICON_PATH}"></path></svg>`;
};
