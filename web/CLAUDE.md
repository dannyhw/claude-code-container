# Web UI

React + Vite + Tailwind v4 app. Builds to `dist/` and is served by the server.

## Component library: Base UI

We use **@base-ui/react** for base components. Docs: https://base-ui.com

- Components are unstyled and composable — we style them with Tailwind classes
- All components are in a single package, tree-shaken at build time
- **Add components only as needed** — don't preemptively import components we aren't using yet
- When adding a new Base UI component, refer to its markdown docs at `https://base-ui.com/react/components/<name>.md` for API and composition patterns

### Components currently in use

_(Update this list as you adopt new Base UI components)_

- **Collapsible** — Expand/collapse in `ToolGroup.tsx` (nested: outer group + inner tool details)
- **Popover** — Dev server command input in `DevServerPanel.tsx`
- **Tooltip** — Icon button labels in `DevServerPanel.tsx`, `Sidebar.tsx`, `App.tsx`

### Setup notes

- `#root` has `isolation: isolate` for proper popover/dialog stacking
- `body` has `position: relative` for iOS Safari backdrop compatibility
- Both are set in `src/app.css`

## Styling

Tailwind v4 via `@tailwindcss/vite` plugin. Custom theme tokens defined in `src/app.css` under `@theme`.

Key color tokens: `root`, `surface`, `elevated`, `hovr`, `bdr`, `bdr-light`, `tx`, `tx-2`, `tx-3`, `ok`, `err`, `blu`.

Fonts: DM Sans (sans), JetBrains Mono (mono) — loaded from Google Fonts in `index.html`.
