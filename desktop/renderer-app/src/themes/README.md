# Themes

`src/themes/` owns visual decisions.

Each theme folder should define CSS custom properties on a theme scope:

```css
#app[data-theme="your-theme-id"] {
  --yc-bg-app: #ffffff;
  --yc-text-primary: #0f172a;
}
```

## Structure

- `base/`
  Shared fallback tokens. Treat this as the default contract every component can read.
- `default-light/`
  Built-in light theme overrides.
- `default-dark/`
  Built-in dark theme overrides.
- `paper-amber/`
  Built-in warm paper theme overrides.
- `theme-template/`
  Copy this folder to start a new built-in theme.
- `*/meta.js`
  Theme metadata used by settings and runtime selection.

## Rules

- Put colors, fonts, radii, shadows, spacing accents, syntax emphasis, menu chrome, terminal chrome, and widget look in themes.
- Keep `src/styles/` structural. Styles should read tokens with `var(...)` and avoid hardcoded visual values.
- If a component still needs hardcoded colors, add a token to `base/index.css` first, then consume it from styles.
- Prefer semantic tokens like `--yc-menu-bg` or `--yc-code-block-bg` over raw palette names.

## Adding A Theme

1. Copy `theme-template/` to `your-theme-id/`.
2. Rename the selector in `index.css` to `#app[data-theme="your-theme-id"]`.
3. Add a `meta.js` file in the same folder.
4. Override the tokens you care about.

Built-in theme CSS and metadata are auto-discovered. You no longer need to edit `src/main.js` or `src/themes/registry.js` when adding a theme.

## Scope

Themes can control:

- App shell
- Sidebar and file tree typography
- Scrollbars and drag handles
- Menus and popovers
- Settings window chrome
- Terminal and runner panels
- Editor syntax colors
- Preview typography and markdown blocks
- Tables, math, images, callouts, and graph colors

If you want full theme control, add a token instead of adding another hardcoded style rule.
