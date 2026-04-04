const cloneXtermTheme = (theme = {}) => ({
  background: String(theme.background || "#ffffff"),
  foreground: String(theme.foreground || "#0f172a"),
  cursor: String(theme.cursor || "#f97316")
});

export const DEFAULT_THEME_ID = "default-light";
export const IMPORTED_THEME_ID_PREFIX = "imported-theme-";

export const normalizeThemeMode = (modeInput = "") => (
  String(modeInput || "").trim().toLowerCase() === "dark" ? "dark" : "light"
);

export const fallbackThemeIdForMode = (modeInput = "light") => (
  normalizeThemeMode(modeInput) === "dark" ? "default-dark" : DEFAULT_THEME_ID
);

export const BUILT_IN_THEMES = Object.freeze([
  {
    id: "default-light",
    kind: "built-in",
    label: "Default Light",
    metaLabel: "Light",
    description: "Clean light workspace with neutral contrast.",
    mode: "light",
    swatch: "linear-gradient(135deg, #ffffff 0%, #f6f7fb 100%)",
    xtermTheme: {
      background: "#ffffff",
      foreground: "#0f172a",
      cursor: "#f97316"
    }
  },
  {
    id: "default-dark",
    kind: "built-in",
    label: "Default Dark",
    metaLabel: "Dark",
    description: "Cool dark workspace with stronger contrast.",
    mode: "dark",
    swatch: "linear-gradient(135deg, #111827 0%, #020617 100%)",
    xtermTheme: {
      background: "#0f172a",
      foreground: "#e2e8f0",
      cursor: "#fb923c"
    }
  },
  {
    id: "paper-amber",
    kind: "built-in",
    label: "Paper Amber",
    metaLabel: "Warm",
    description: "Warm paper-like theme with softer edges.",
    mode: "light",
    swatch: "linear-gradient(135deg, #fff8ec 0%, #f5dfb4 100%)",
    xtermTheme: {
      background: "#fff8ec",
      foreground: "#43302b",
      cursor: "#c2410c"
    }
  }
]);

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
        ? BUILT_IN_THEME_MAP.get("default-dark")?.xtermTheme
        : BUILT_IN_THEME_MAP.get(DEFAULT_THEME_ID)?.xtermTheme
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
  return importedTheme || BUILT_IN_THEME_MAP.get(DEFAULT_THEME_ID);
};

export const resolveThemeMode = (themeIdInput = DEFAULT_THEME_ID, importedThemesInput = []) =>
  normalizeThemeMode(resolveThemeDefinition(themeIdInput, importedThemesInput)?.mode);

export const resolveXtermTheme = (themeIdInput = DEFAULT_THEME_ID, importedThemesInput = []) =>
  cloneXtermTheme(resolveThemeDefinition(themeIdInput, importedThemesInput)?.xtermTheme);
