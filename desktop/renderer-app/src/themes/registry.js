const cloneXtermTheme = (theme = {}) => {
  const nextTheme = {
    background: String(theme.background || "#ffffff"),
    foreground: String(theme.foreground || "#0f172a"),
    cursor: String(theme.cursor || "#f97316")
  };
  if (theme.cursorAccent) {
    nextTheme.cursorAccent = String(theme.cursorAccent);
  }
  if (theme.selectionBackground) {
    nextTheme.selectionBackground = String(theme.selectionBackground);
  }
  if (theme.selectionInactiveBackground) {
    nextTheme.selectionInactiveBackground = String(theme.selectionInactiveBackground);
  }
  if (theme.selectionForeground) {
    nextTheme.selectionForeground = String(theme.selectionForeground);
  }
  return nextTheme;
};

export const DEFAULT_THEME_ID = "default-light";
export const IMPORTED_THEME_ID_PREFIX = "imported-theme-";

const DEFAULT_LIGHT_XTERM_THEME = Object.freeze({
  background: "#ffffff",
  foreground: "#0f172a",
  cursor: "#f97316"
});

const DEFAULT_DARK_XTERM_THEME = Object.freeze({
  background: "#0f172a",
  foreground: "#e2e8f0",
  cursor: "#fb923c"
});

export const normalizeThemeMode = (modeInput = "") => (
  String(modeInput || "").trim().toLowerCase() === "dark" ? "dark" : "light"
);

export const fallbackThemeIdForMode = (modeInput = "light") => (
  normalizeThemeMode(modeInput) === "dark" ? "default-dark" : DEFAULT_THEME_ID
);

const themeMetaModules = import.meta.glob("./*/meta.js", { eager: true, import: "default" });

const inferThemeIdFromPath = (path = "") => {
  const match = String(path || "").match(/^\.\/([^/]+)\/meta\.js$/);
  return String(match?.[1] || "").trim();
};

const normalizeBuiltInThemeDefinition = (value, path = "") => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const inferredId = inferThemeIdFromPath(path);
  const id = String(value.id || inferredId).trim() || inferredId;
  if (!id) {
    return null;
  }

  const mode = normalizeThemeMode(value.mode || (id.includes("dark") ? "dark" : "light"));
  const fallbackXtermTheme = mode === "dark" ? DEFAULT_DARK_XTERM_THEME : DEFAULT_LIGHT_XTERM_THEME;
  const order = Number(value.order);

  return {
    id,
    kind: "built-in",
    label: String(value.label || id).trim() || id,
    metaLabel: String(value.metaLabel || (mode === "dark" ? "Dark" : "Light")).trim() || "Theme",
    description: String(value.description || "Built-in theme.").trim() || "Built-in theme.",
    mode,
    swatch: String(value.swatch || (
      mode === "dark"
        ? "linear-gradient(135deg, #111827 0%, #020617 100%)"
        : "linear-gradient(135deg, #ffffff 0%, #f6f7fb 100%)"
    )).trim(),
    xtermTheme: cloneXtermTheme(value.xtermTheme || fallbackXtermTheme),
    order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER
  };
};

export const BUILT_IN_THEMES = Object.freeze(
  Object.entries(themeMetaModules)
    .map(([path, value]) => normalizeBuiltInThemeDefinition(value, path))
    .filter(Boolean)
    .sort((left, right) => (
      left.order - right.order
      || left.label.localeCompare(right.label, "en")
      || left.id.localeCompare(right.id, "en")
    ))
    .map(({ order, ...theme }) => Object.freeze(theme))
);

const BUILT_IN_THEME_MAP = new Map(BUILT_IN_THEMES.map((theme) => [theme.id, theme]));

const makeImportedThemeId = (nameInput = "", importedAtInput = Date.now()) => {
  const slug = String(nameInput || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "custom";
  const importedAt = Number.isFinite(Number(importedAtInput)) ? Number(importedAtInput) : Date.now();
  return `${IMPORTED_THEME_ID_PREFIX}${slug}-${importedAt.toString(36)}`;
};

export const normalizeImportedThemeDefinition = (value, fallbackMode = "light") => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const name = String(value.name || value.label || "").trim() || "Imported Theme";
  const cssText = String(value.cssText || value.css || "").trim();
  if (!cssText) {
    return null;
  }

  const importedAt = Number.isFinite(Number(value.importedAt))
    ? Number(value.importedAt)
    : Date.now();
  const mode = normalizeThemeMode(value.mode || fallbackMode);
  const id = String(value.id || "").trim() || makeImportedThemeId(name, importedAt);

  return {
    id,
    kind: "imported",
    label: name,
    name,
    metaLabel: "Imported",
    description: String(value.description || "External imported theme.").trim() || "External imported theme.",
    mode,
    swatch: String(value.swatch || "linear-gradient(135deg, #f97316 0%, #fb7185 100%)"),
    cssText,
    importedAt,
    xtermTheme: cloneXtermTheme(value.xtermTheme || value.xterm || (
      mode === "dark"
        ? BUILT_IN_THEME_MAP.get("default-dark")?.xtermTheme || DEFAULT_DARK_XTERM_THEME
        : BUILT_IN_THEME_MAP.get(DEFAULT_THEME_ID)?.xtermTheme || DEFAULT_LIGHT_XTERM_THEME
    ))
  };
};

export const buildThemeCatalog = (importedThemesInput = []) => {
  const importedThemes = Array.isArray(importedThemesInput)
    ? importedThemesInput.map((theme) => normalizeImportedThemeDefinition(theme)).filter(Boolean)
    : [];
  return [...BUILT_IN_THEMES, ...importedThemes];
};

export const resolveThemeDefinition = (themeIdInput = DEFAULT_THEME_ID, importedThemesInput = []) => {
  const themeId = String(themeIdInput || "").trim() || DEFAULT_THEME_ID;
  if (BUILT_IN_THEME_MAP.has(themeId)) {
    return BUILT_IN_THEME_MAP.get(themeId);
  }
  const importedThemes = Array.isArray(importedThemesInput) ? importedThemesInput : [];
  const importedTheme = importedThemes
    .map((theme) => normalizeImportedThemeDefinition(theme))
    .find((theme) => theme?.id === themeId);
  return importedTheme || BUILT_IN_THEME_MAP.get(DEFAULT_THEME_ID) || BUILT_IN_THEMES[0] || null;
};

export const resolveThemeMode = (themeIdInput = DEFAULT_THEME_ID, importedThemesInput = []) =>
  normalizeThemeMode(resolveThemeDefinition(themeIdInput, importedThemesInput)?.mode);

export const resolveXtermTheme = (themeIdInput = DEFAULT_THEME_ID, importedThemesInput = []) =>
  cloneXtermTheme(resolveThemeDefinition(themeIdInput, importedThemesInput)?.xtermTheme);
