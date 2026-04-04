import { basenameOfRelPath, dirnameOfRelPath, normalizeRelPath } from "./wiki-link";

const REMOTE_ASSET_PATTERN = /^(https?:|data:|blob:)/i;
const FILE_URL_PATTERN = /^file:\/\/\/|^file:\/\/localhost\//i;
const LEGACY_FILE_URL_PATTERN = /^file:\/\//i;
const WINDOWS_ABS_PATH_PATTERN = /^\/?[A-Za-z]:[/\\]/;

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
  ".avif"
]);

const normalizeFsPath = (value = "") => String(value || "").replace(/\\/g, "/");

const trimTrailingSlashes = (value = "") => String(value || "").replace(/[\\/]+$/, "");

const toFileUrl = (value = "") => {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }
  if (FILE_URL_PATTERN.test(input)) {
    return input;
  }
  if (LEGACY_FILE_URL_PATTERN.test(input)) {
    return `file:///${input.slice(7)}`;
  }
  if (WINDOWS_ABS_PATH_PATTERN.test(input)) {
    return `file:///${normalizeFsPath(input).replace(/^\/+/, "")}`;
  }
  if (input.startsWith("/")) {
    return `file://${normalizeFsPath(input)}`;
  }
  return input;
};

const splitRelSegments = (value = "") => {
  const normalized = normalizeRelPath(value);
  return normalized ? normalized.split("/") : [];
};

export const isImageFileName = (value = "") => {
  const name = String(value || "").trim().toLowerCase();
  if (!name) {
    return false;
  }
  for (const ext of IMAGE_EXTENSIONS) {
    if (name.endsWith(ext)) {
      return true;
    }
  }
  return false;
};

export const relativeRelPathFromFile = (fromFileRelPath = "", toRelPath = "") => {
  const targetSegments = splitRelSegments(toRelPath);
  if (!targetSegments.length) {
    return "";
  }

  const fromDirSegments = splitRelSegments(dirnameOfRelPath(fromFileRelPath));
  let shared = 0;
  while (
    shared < fromDirSegments.length
    && shared < targetSegments.length
    && fromDirSegments[shared] === targetSegments[shared]
  ) {
    shared += 1;
  }

  const upward = new Array(Math.max(0, fromDirSegments.length - shared)).fill("..");
  const downward = targetSegments.slice(shared);
  return [...upward, ...downward].join("/") || basenameOfRelPath(toRelPath);
};

export const resolveWorkspaceAssetSrc = (srcInput = "", {
  currentRelPath = "",
  workspaceRootPath = ""
} = {}) => {
  const src = String(srcInput || "").trim();
  if (!src) {
    return "";
  }
  if (REMOTE_ASSET_PATTERN.test(src)) {
    return src;
  }
  if (FILE_URL_PATTERN.test(src) || LEGACY_FILE_URL_PATTERN.test(src) || WINDOWS_ABS_PATH_PATTERN.test(src)) {
    return toFileUrl(src);
  }
  if (src.startsWith("/")) {
    return toFileUrl(src);
  }

  const rootPath = trimTrailingSlashes(workspaceRootPath);
  if (!rootPath) {
    return src;
  }

  const currentDir = dirnameOfRelPath(currentRelPath);
  const resolvedRelPath = normalizeRelPath(currentDir ? `${currentDir}/${src}` : src);
  if (!resolvedRelPath) {
    return src;
  }
  return toFileUrl(`${normalizeFsPath(rootPath)}/${resolvedRelPath}`);
};
