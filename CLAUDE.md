# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**QueQueFalta** is a shared grocery list PWA for home use, built with React 19 + Vite and Firebase (Firestore + Google Auth). It is hosted on GitHub Pages under the path `/quequefalta/`. Mobile-first (max-width 480px), no automated tests.

## Commands

```bash
npm install --legacy-peer-deps       # install dependencies (legacy flag required)
npm run dev                          # dev server (Vite HMR)
npm run build                        # production build → ./dist
npm run preview                      # preview production build locally
npm run lint                         # ESLint
node scripts/importar-catalogo.mjs   # one-time import of TSV catalog (~500 products) to Firestore
```

## Environment

Requires a `.env` at the root with Firebase credentials:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

In CI/CD (`.github/workflows/deploy.yml`), these are injected from GitHub repository secrets on every push to `main`.

## Architecture

### Entry point & routing

`src/App.jsx` is the central coordinator: Firebase auth state, active list selection, URL param `?lista=<id>` for shared list joining, and routing between `Login` and `Home` screens. There is no router library and no global state — everything flows via props.

### Real-time data hooks

All Firestore reads use `onSnapshot` listeners inside custom hooks:

- `src/hooks/useLista.js` — items in the active list (`listas/{listaId}/lista/`). Exposes `adicionarItem`, `toggleComprado`, `removerItem`.
- `src/hooks/useCatalogo.js` — global product catalog (`catalogo/`), auto-sorted pt-BR.
- `src/hooks/useSugestoes.js` — product suggestions + two-admin approval flow. Exposes `aprovar`, `rejeitar`, `atualizar`, `deletar`.
- `src/hooks/useTema.js` — light/dark/system theme; persists to localStorage and injects CSS variables on `document.root`.

### Firestore schema

```js
catalogo/{produtoId}
  ├── nome, categoria, subcategoria, grupoSubstituicao[], receitas[]
  └── historico[]         # price records: mercado, preco, data, observacao, listaAtiva

listas/{listaId}          # listaId == uid of the list owner
  ├── criadaPor, participantes[]
  └── lista/{itemId}      # subcollection: items on this list
      ├── produtoId        # referência ao catalogo/{produtoId}
      └── comprado, compradoEm, adicionadoEm
      # nome, categoria, subcategoria, grupoSubstituicao são lidos do catálogo em tempo de renderização via produtoId

usuarios/{uid}
  ├── nome, email, listaAtiva
  └── listas[]            # array of listaIds the user belongs to

sugestoes/{sugestaoId}
  ├── nome, categoria, subcategoria, sugeridoPor, listaAtiva
  ├── status: 'pendente' → 'aprovado'
  └── aprovadores[]       # uid of the admin who approved
```

### Firestore operations outside hooks

`src/config/lista.js` contains non-realtime list operations (create, join, switch active list, leave) used by `Menu.jsx` and `App.jsx`.

### Pages

- `src/pages/Home.jsx` — main screen after login. Two-tab UI (lista / catálogo), search, category filter (`FiltroCategoria`), product detail modal (`DetalhesProduto`), admin suggestions panel, and `Menu` bottom sheet.
- `src/pages/Login.jsx` — Google sign-in via `signInWithPopup`.
- `src/pages/Catalogo.jsx` — stub/unused.

### Key components

- `Menu.jsx` — bottom-sheet with profile, theme toggle, list management (share/switch/leave), suggestion form, admin access, and sign-out.
- `ProdutoItem.jsx` — single product card. Behavior differs by `contexto` prop: `'lista'` toggles `comprado`; `'catalogo'` adds/removes from active list.
- `CategoriaGrupo.jsx` — collapsible category section; auto-expands when `busca` is non-empty.
- `DetalhesProduto.jsx` — product detail modal with price history, price registration form (list context only), and admin attribute/name/category editing.
- `FiltroCategoria.jsx` — multi-select category filter modal with optional `botoesExtras` slot.
- `AdminPanel.jsx` — toggle for admin edit mode.

### Design tokens & styling

All components use **inline styles only** — no CSS modules, no Tailwind. Constants come from:

- `src/utils/estilos.js` — `FONTE`, `RAIO`, `COR`, `TIPOGRAFIA`, `BOTAO_PRIMARIO`, `BOTAO_SECUNDARIO`
- `src/utils/categorias.js` — `COR_CATEGORIA` (19 categories with hex colors), `ORDEM_CATEGORIAS`, `corDaCategoria()`, `textoParaCor()`
- `src/index.css` — CSS custom properties (`--text`, `--bg`, `--card`, `--amarelo`, `--laranja`, `--verde`, etc.); dark mode overrides these at runtime via `useTema`.

### Admins

Defined by email in `src/config/admins.js` (`isAdmin(email)` helper). One admin approval is enough for a suggestion to enter the catalog.

### Key behaviors

- **List sharing**: `?lista=<id>` adds that list to the user's `listas[]` after an in-app confirmation.
- **Offline**: Firestore SDK caches locally; the Service Worker (via `vite-plugin-pwa`, `registerType: 'autoUpdate'`) caches assets. Writes made offline are queued and synced on reconnect.
- **Base path**: `vite.config.js` sets `base: '/quequefalta/'` — required for GitHub Pages and the PWA manifest's `start_url`.
