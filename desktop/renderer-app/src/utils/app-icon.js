const APP_ICON_PATHS = Object.freeze({
  copy:
    "M810.666667 170.666667H426.666667V85.333333h384a85.333333 85.333333 0 0 1 85.333333 85.333334v469.333333h-85.333333V170.666667zM128 341.333333a85.333333 85.333333 0 0 1 85.333333-85.333333h426.666667c47.04 0 85.333333 38.037333 85.333333 85.269333v512.234667A85.12 85.12 0 0 1 640.064 938.666667H213.248A85.248 85.248 0 0 1 128 853.333333V341.333333z m512 0H213.333333v512h426.666667V341.333333z"
});

export const APP_ICON_COPY_PATH = APP_ICON_PATHS.copy;

export const getAppIconPath = (name = "") => APP_ICON_PATHS[String(name || "")] || "";

const createSvgElement = (path, className = "") => {
  if (!path) {
    return null;
  }

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 1024 1024");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  if (className) {
    svg.setAttribute("class", className);
  }

  const pathElement = document.createElementNS(ns, "path");
  pathElement.setAttribute("d", path);
  svg.appendChild(pathElement);
  return svg;
};

export const createAppIconSvgElement = (name = "", className = "") =>
  createSvgElement(getAppIconPath(name), className);

export const renderAppIconSvgMarkup = (name = "", className = "") => {
  const path = getAppIconPath(name);
  if (!path) {
    return "";
  }

  const classAttr = className ? ` class="${String(className)}"` : "";
  return `<svg${classAttr} viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true"><path d="${path}"></path></svg>`;
};
