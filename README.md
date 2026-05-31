# PDF Toolkit — by tommytang

**Live**: https://pdf-toolkit-hazel.vercel.app
**Source**: https://github.com/tommytang2414/pdf-toolkit

A browser-based PDF tool. No upload. No tracking. No sign-up. Everything runs locally in your browser.

---

## Features

| Tool | Route | What it does |
|------|-------|-------------|
| **Merge PDFs** | `/merge` | Drop multiple PDFs, reorder, combine into one |
| **Split PDF** | `/split` | Click pages or type a range like `1-3, 5, 7-9` to extract |
| **Full Toolkit** | `/toolkit` | Merge + reorder + rotate + delete — all in one session |

All operations are 100% client-side. Files never leave your browser.

---

## Quick Start

```bash
git clone https://github.com/tommytang2414/pdf-toolkit.git
cd pdf-toolkit
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

To deploy to Vercel:

```bash
npx vercel --prod
```

---

## Tech Stack

| Layer | Library | Purpose |
|-------|---------|---------|
| Framework | Next.js 16 + Turbopack | App Router, static export |
| PDF manipulation | `pdf-lib` | merge, split, rotate, reorder, delete |
| PDF rendering | `pdfjs-dist` | page thumbnails as JPEG data URLs |
| Drag & drop | `@dnd-kit` | drag-to-reorder pages in toolkit |
| Styling | Tailwind CSS v4 + CSS variables | dark + amber gold design system |
| Icons | `lucide-react` | UI icons |
| Icons / images | MiniMax `image-01` | tool card icons (generated) |

---

## Design System

**Aesthetic**: Dark + Amber Gold — personal maker project, not corporate SaaS.

### Color Palette

```css
--bg: #07070a          /* near-black background */
--bg-secondary: #111116 /* card / input backgrounds */
--bg-card: #0f0f14     /* elevated surfaces */
--border: #1f1f28      /* subtle borders */
--text: #f0ede6        /* off-white text */
--text-muted: #7a746e  /* secondary text */
--accent: #d97706      /* amber */
--accent-light: #f59e0b/* gold */
--accent-glow: rgba(217,119,6,0.15)
```

### Key CSS Classes

| Class | Purpose |
|-------|---------|
| `.ambient-bg` | Radial amber glow on page backgrounds |
| `.card-glow:hover` | Amber border + glow on card hover |
| `.dropzone` | Drag-and-drop upload area |
| `.btn-primary` | Amber CTA buttons |
| `.btn-secondary` | Ghost/outline buttons |
| `.result-banner` | Green success banner |
| `.page-grid` | Page thumbnail grid (split page) |
| `.toolkit-grid` | Flex wrap page grid (toolkit) |
| `.score-badge` | Amber mono badge |

### Typography

- **Sans**: Inter (via `next/font/google`)
- **Mono**: JetBrains Mono (via `next/font/google`)
- Font variables: `--font-sans`, `--font-mono`

---

## Project Structure

```
pdf-toolkit/
├── app/
│   ├── layout.tsx          # Root layout, metadata, fonts
│   ├── page.tsx            # Home — feature cards + hero
│   ├── globals.css         # Design system, CSS variables, all classes
│   ├── merge/page.tsx      # Merge PDFs
│   ├── split/page.tsx      # Split PDF
│   └── toolkit/page.tsx    # All-in-one: merge + rotate + reorder + delete
├── components/pdf/
│   └── PdfDropzone.tsx     # Drag-and-drop upload zone (50MB soft / 100MB hard limit)
├── hooks/
│   └── useBlobUrl.ts       # Blob URL management with auto-cleanup
├── lib/
│   ├── pdf-operations.ts   # pdf-lib wrappers: merge, split, rotate, reorder, delete
│   └── pdf-renderer.ts     # pdfjs-dist: render pages to JPEG data URLs
├── public/
│   ├── favicon.svg         # Custom amber-gold PDF favicon
│   └── images/             # MiniMax-generated tool icons
│       ├── icon-merge.jpeg
│       ├── icon-split.jpeg
│       └── icon-toolkit.jpeg
└── CLAUDE.md               # Development notes
```

---

## PDF Operations (`lib/pdf-operations.ts`)

All functions accept `Uint8Array`, return `Uint8Array`. No network calls.

```typescript
mergePdfs(pdfs: Uint8Array[]): Promise<Uint8Array>
extractPages(pdf: Uint8Array, pageIndices: number[]): Promise<Uint8Array>
rotatePages(pdf: Uint8Array, rotations: Map<number, Rotation>): Promise<Uint8Array>
reorderPages(pdf: Uint8Array, newOrder: number[]): Promise<Uint8Array>
deletePages(pdf: Uint8Array, toDelete: number[]): Promise<Uint8Array>

// Rotation type: 0 | 90 | 180 | 270
```

`lib/pdf-renderer.ts`:

```typescript
renderPage(pdf: Uint8Array, pageIndex: number, maxPx?: number): Promise<PageRender>
renderAllPages(pdf: Uint8Array, maxPx?: number, concurrency?: number): Promise<PageRender[]>

interface PageRender {
  pageIndex: number;  // 0-indexed
  dataUrl: string;    // JPEG base64 data URL
  width: number;      // physical width in points
  height: number;     // physical height in points
}
```

---

## File Size Limits

| Limit | Value | Behaviour |
|-------|-------|-----------|
| Soft limit | 50 MB | Warning in browser console |
| Hard limit | 100 MB | Upload rejected, error message shown |

Enforced in `components/pdf/PdfDropzone.tsx`.

---

## Environment Variables

```
MINIMAX_API_KEY=...   # For icon generation (not needed for runtime)
```

Runtime requires no server-side environment variables — all processing is client-side.

---

## Changelog

### 2026-05-31 — Maker Identity + Dark/Amber Gold Redesign
- `7ac4c40` — Full UI redesign: dark + amber gold aesthetic with ambient glow effects
- Custom SVG favicon (amber-gold PDF icon)
- "by tommytang" badge + maker credit on every page
- GitHub "View source" links in all page footers
- Updated metadata: "PDF Toolkit — by tommytang"
- MiniMax image-01 generated tool icons
- Softer, more personal copy throughout

### 2026-05-31 — Initial Launch
- `daf9f53` — feat: full UI redesign (first major release)
- `e90ce60` — fix: critical bugs (deletePages, reorderPages, rotation index mapping)
- `e7b9904` — docs: add README with full function spec
- `321e10c` — Initial commit: PDF Toolkit with merge, split, toolkit pages
- Deployed to: https://pdf-toolkit-hazel.vercel.app

---

## Build & Deploy

```bash
# Build locally
npm run build

# Deploy to Vercel (preview)
npx vercel

# Deploy to Vercel (production)
npx vercel --prod

# Run dev server
npm run dev
```

Build requires Node.js 24 LTS. All routes are statically prerendered — no serverless functions used.