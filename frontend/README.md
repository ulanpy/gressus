# Frontend

React + TypeScript + Vite operator UI for Gressus.

System context and operator views: [../docs/architecture.md](../docs/architecture.md).

## Local development

With backend running on `:8000`:

```bash
cd frontend
npm install
npm run dev
```

Vite dev server: http://localhost:5173 (proxies `/api` to the backend, `/ws` to insole bridge).

Insole heatmap layout: `src/constants/insoleGeometry/` (static sensor coordinates, size M/S).

Production build:

```bash
npm run build
npm run preview
```

In Docker, set `IS_DEBUG=false` in compose for preview mode instead of dev HMR.
