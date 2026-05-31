# PDF Toolkit

Browser-based PDF manipulation app — no server, all processing happens in the browser.

## Stack
- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- `pdf-lib` — PDF manipulation (merge, split, rotate, reorder, delete)
- `pdfjs-dist` — Render PDF pages to thumbnails
- `@dnd-kit/core` + `@dnd-kit/sortable` — Drag-and-drop page reordering
- `lucide-react` — Icons

## Pages

| Route | Feature |
|-------|---------|
| `/` | Home — feature cards |
| `/merge` | Upload multiple PDFs → merge into one |
| `/split` | Upload PDF → multi-select or range extract pages |
| `/toolkit` | Upload PDFs → reorder + rotate + delete pages in one flow |

## Key Libraries

- **pdf-lib**: Pure PDF operations — merge, split, rotate, reorder, delete. All functions accept `Uint8Array`, return `Uint8Array`.
- **pdfjs-dist**: Renders PDF pages to JPEG data URLs for thumbnail grid.
- **@dnd-kit**: Drag-and-drop reorder for the toolkit page.

## Design

- Dark mode (zinc `#09090b` background)
- Accent: violet `#7c3aed`
- Font: Geist Sans + Geist Mono
- All inline styles (no external CSS framework) for portability

## Changelog

### 2026-05-31 — Initial build
- Scaffold Next.js project with TypeScript + Tailwind v4
- Home page with 3 feature cards
- Merge, Split, and All-in-One Toolkit pages
- Client-side PDF ops via pdf-lib + pdfjs-dist
- Drag-to-reorder via @dnd-kit