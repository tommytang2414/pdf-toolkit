# CLAUDE.md — PDF Toolkit

## Project Overview

**Type**: Personal tool / browser-based PDF app
**Live**: https://pdf-toolkit-hazel.vercel.app
**GitHub**: https://github.com/tommytang2414/pdf-toolkit

Browser-based PDF manipulation — merge, split, rotate, reorder, delete. 100% client-side, no server.

---

## Key Decisions

### No Server-Side Processing
Everything runs in the browser. No API routes, no serverless functions. All 6 routes are statically prerendered.

### pdf-lib vs Alternatives
Chose `pdf-lib` over `jspdf` because it can read existing PDFs (merge/split) rather than only creating new ones.

### Rotation: CW + CCW
Toolkit supports both clockwise AND counter-clockwise rotation (90° increments). Each direction stores a signed offset, combined at download time: `((cur - 90 + 360) % 360)` for CCW.

### Page Indices: 0-based internally, 1-based in UI
All `pdf-lib` calls use 0-based indices. User-facing display (in badges/labels) shows 1-based. Conversion happens at the UI layer only.

### Rotation + Deletion Index Mapping
When pages are deleted before rotation is applied, the rotation target index shifts. The toolkit handles this by computing `originalToNewIdx` before applying rotation — deleting first changes the document structure, so rotation targets must map to post-deletion indices.

---

## Gotchas

### Blob URL Memory Leak
Never create Blob URLs without tracking them. `hooks/useBlobUrl.ts` manages a single URL ref with auto-revoke on create/revoke. If using multiple result URLs simultaneously, extend the hook to use a Set.

### pdfjs-dist v4 Breaking Changes
`getPage()` returns a page proxy. Dimensions come from `getViewport()` not `page.get()`.

### Tailwind v4 PostCSS Config
Must be `postcss.config.cjs` (CommonJS), not `.mjs` (ESM). Next.js PostCSS loader doesn't support ESM config.

### Next.js 16 Turbopack Root Warning
If `package-lock.json` exists at `C:\Users\User\`, Next.js picks that as root. Set `turbopack.root` in `next.config.ts` to silence.

### .env.local Never Committed
Contains `MINIMAX_API_KEY`. Always in `.gitignore`.

### MiniMax Image Generation (not required for runtime)
API base: `https://api.minimax.chat` (NOT `minimaxi.chat`). Model: `image-01`. Used for tool card icons in `public/images/`.

### Vercel Deploy: GitHub Remote Order
Vercel deploy CLI checks git author against linked account. If `origin` remote is set before `npx vercel --prod`, auth fails. Fix: `git remote remove origin && npx vercel --prod --yes && git remote add origin ...`

---

## Design System

**Aesthetic**: Dark + Amber Gold — personal maker project feel, not corporate.

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#07070a` | near-black background |
| `--accent` | `#d97706` | primary amber |
| `--accent-light` | `#f59e0b` | gold highlights |
| `--text` | `#f0ede6` | off-white |
| `--text-muted` | `#7a746e` | secondary text |
| `--border` | `#1f1f28` | subtle borders |

Key CSS classes: `.ambient-bg` (radial amber glow), `.card-glow:hover` (amber glow border), `.btn-primary` (amber CTA).

---

## Vercel Deployment

```bash
npx vercel --prod
```

All routes statically prerendered — no serverless compute used.

---

## File Size Limits

Enforced in `components/pdf/PdfDropzone.tsx`:
- **Soft limit: 50MB** → console.warn only
- **Hard limit: 100MB** → upload rejected with error message

---

## Changelog

### 2026-05-31 — Maker Identity + Amber Gold Redesign
- `7ac4c40` — Full UI redesign: dark + amber gold aesthetic, custom favicon, "by tommytang" badge, GitHub links in footers
- `daf9f53` — feat: full UI redesign (amber gold first deploy)
- `e90ce60` — fix: critical bugs (deletePages, reorderPages variable order, rotation index mapping)
- `e7b9904` — docs: add README with full function spec
- `321e10c` — Initial commit: merge + split + toolkit pages, pdf-lib + pdfjs-dist integration

---

## Dependencies

```json
{
  "next": "16.2.6",
  "pdf-lib": "^1.17.1",
  "pdfjs-dist": "4.10.38",
  "@dnd-kit/core": "^10.0.0",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.0",
  "lucide-react": "^0.475.0"
}
```