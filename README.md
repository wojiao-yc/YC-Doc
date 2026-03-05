# YC-Doc

Project layout:

- `web/`: Web/PWA frontend
- `desktop/`: Electron desktop app (real PTY)
- `shared/`: shared runtime modules
- `data/`: content data (steps)

## Dev mode (kept)

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
npm install
npm run dev
```

`npm run dev` still runs both Vite dev server and Electron.

## Build EXE directly (without dev mode)

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
npm install
npm run pack:win
```

Output: `desktop/dist/` (Windows installer `.exe`).

## Build renderer only

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
npm run build:renderer
```

Output: `desktop/renderer-dist/`.

## Markdown images

- Desktop app:
  - In Edit mode, click `插入图片` in the Markdown editor header.
  - The image is copied to the app data folder (`.../images`) and inserted as `file:///...`.
  - Click `图片目录` to open that folder directly.
- Web app:
  - Put image files in `web/public/images/`.
  - Reference them in Markdown as `/images/your-image.png`.

## Save behavior (important)

- Web mode: steps are saved in browser `localStorage`.
- Desktop mode (`npm run start` or packaged EXE):
  - Also saves to a persistent file: `AppData/.../data/steps.json`.
  - So edited Markdown/steps will survive app restart.
