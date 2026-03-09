# YC-Doc (Desktop Only)

All required code has been consolidated into `desktop/`.

## Kept Structure

- `desktop/`: Electron app root
- `desktop/renderer-app/`: renderer source (Vite + Vue)
- `desktop/data/`: shared content/data source used by renderer

## Development

Install from `desktop` only (workspaces install both desktop and renderer deps), then run dev mode:

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
npm install
npm run dev
```

## Build Desktop App

```powershell
cd D:\python\project\Homepage\YC-Doc\desktop
npm run pack:win
```

Build output is in `desktop/dist/`.
