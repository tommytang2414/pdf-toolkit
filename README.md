# PDF Toolkit

**URL**: https://pdf-toolkit-hazel.vercel.app

A browser-based PDF manipulation tool. All processing happens entirely in your browser — files are never uploaded to any server.

---

## Overview

PDF Toolkit provides three focused tools for working with PDF documents. The application requires no sign-up, no account, and no data leaves your device.

| Tool | Route | Description |
|------|-------|-------------|
| **Merge PDFs** | `/merge` | Combine multiple PDFs into a single file, with full control over merge order |
| **Split PDF** | `/split` | Extract specific pages or page ranges into a new PDF document |
| **Full Toolkit** | `/toolkit` | Merge multiple files, then reorder, rotate, and delete pages — all in one session |

---

## User Requirements

### Supported Operations

| Operation | Description | Supported On |
|-----------|-------------|-------------|
| **Merge** | Combine 2 or more PDF files into a single document | `/merge`, `/toolkit` |
| **Split by selection** | Click individual pages to select and extract them | `/split` |
| **Split by range** | Extract a specific range, e.g. `1-3, 5, 7-9` | `/split` |
| **Reorder pages** | Drag pages into a new sequence | `/toolkit` |
| **Rotate pages** | Rotate individual pages by 90° clockwise | `/toolkit` |
| **Delete pages** | Remove pages from the document | `/toolkit` |

### File Requirements

- **Format**: `.pdf` files only
- **Size**: No explicit limit; browser memory is the practical constraint
- **Number of files**: Any number for merge and toolkit operations
- **Input method**: Drag and drop onto the dropzone, or click to open the file picker
- **Output**: Downloadable `.pdf` file, processed entirely in-browser

### Browser Compatibility

PDF Toolkit is compatible with all modern browsers that support:
- WebAssembly (required by `pdfjs-dist`)
- `Uint8Array` and `Blob` APIs
- HTML5 Drag and Drop API

Tested in Chrome, Edge, Firefox, and Safari (latest versions).

---

## Function Specification

### Architecture

```
pdf-toolkit/
├── app/
│   ├── layout.tsx              # Root layout (fonts, metadata)
│   ├── page.tsx                 # Home: three feature cards
│   ├── merge/page.tsx           # Merge PDFs tool
│   ├── split/page.tsx           # Split PDF tool
│   └── toolkit/page.tsx         # All-in-one toolkit
├── components/pdf/
│   ├── PdfDropzone.tsx          # Drag-and-drop file upload zone
│   ├── PageCard.tsx             # Single page thumbnail card
│   └── ToolCard.tsx             # Home page feature card component
├── lib/
│   ├── pdf-operations.ts        # pdf-lib wrappers (merge, split, rotate, reorder, delete)
│   └── pdf-renderer.ts          # pdfjs-dist page-to-thumbnail rendering
└── CLAUDE.md                    # Internal development notes
```

### Technology Stack

| Layer | Library | Version | Purpose |
|-------|---------|---------|---------|
| Framework | Next.js | 16 | App Router, server components |
| PDF manipulation | `pdf-lib` | 1.17.1 | Read, merge, split, rotate, reorder PDF pages |
| PDF rendering | `pdfjs-dist` | 4.10.38 | Render PDF pages to JPEG data URLs for thumbnails |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` | 10.0.0 | Drag-to-reorder page sequence |
| Icons | `lucide-react` | 0.475.0 | UI iconography |

### Key Functions (`lib/pdf-operations.ts`)

All functions accept `Uint8Array` and return `Uint8Array`. All processing is synchronous in the browser.

```typescript
// Merge multiple PDFs into one document
async mergePdfs(pdfs: Uint8Array[]): Promise<Uint8Array>

// Extract specific pages (0-indexed) into a new PDF
async extractPages(pdf: Uint8Array, pageIndices: number[]): Promise<Uint8Array>

// Rotate pages by angle (0, 90, 180, 270)
// pageIndices is 0-indexed; angle is degrees
async rotatePages(
  pdf: Uint8Array,
  pageIndices: number[],
  angle: 0 | 90 | 180 | 270
): Promise<Uint8Array>

// Reorder pages into a new sequence (0-indexed indices)
// newOrder[i] = original index of the page to place at position i
async reorderPages(pdf: Uint8Array, newOrder: number[]): Promise<Uint8Array>

// Delete specific pages (0-indexed)
async deletePages(pdf: Uint8Array, toDelete: number[]): Promise<Uint8Array>

// Apply all operations (delete → reorder → rotate) in sequence
async applyAllOperations(
  pdf: Uint8Array,
  ops: {
    newOrder?: number[];
    toDelete?: number[];
    rotations?: Map<number, 0 | 90 | 180 | 270>;
  }
): Promise<{ bytes: Uint8Array; pageCount: number }>
```

### Key Functions (`lib/pdf-renderer.ts`)

```typescript
// Render a single PDF page to a JPEG data URL
async renderPage(
  pdf: Uint8Array,
  pageIndex: number,
  maxPx?: number
): Promise<PageRender>

// Render all pages of a PDF in parallel batches
async renderAllPages(
  pdf: Uint8Array,
  maxPx?: number,
  concurrency?: number
): Promise<PageRender[]>
```

`PageRender` interface:
```typescript
interface PageRender {
  pageIndex: number;   // 0-indexed
  dataUrl: string;    // JPEG base64 data URL
  width: number;      // Physical page width in points
  height: number;     // Physical page height in points
}
```

### Page Flow

#### `/merge` — Merge PDFs
1. User drops multiple PDF files onto the dropzone
2. Each file is read as `Uint8Array` and page count extracted via `pdf-lib`
3. File list shown with drag-order arrows to reorder merge sequence
4. User clicks **Merge N files** → `mergePdfs()` → result as Blob → download link

#### `/split` — Split PDF
1. User drops a single PDF file
2. All pages rendered as thumbnails via `renderAllPages()`
3. User clicks pages to toggle selection, or enters a range string (e.g. `1-3, 5`)
4. User clicks **Extract** → `extractPages()` → result as Blob → download link

#### `/toolkit` — Full Toolkit
1. User drops multiple PDFs → `mergePdfs()` → combined document loaded
2. All pages rendered as draggable thumbnail grid via `@dnd-kit`
3. Per-page toolbar: Rotate CW, Delete
4. User drags to reorder, clicks action buttons to modify
5. User clicks **Download** → operations applied in order → result as Blob → download

### Data Privacy

All PDF processing occurs client-side using `pdf-lib` and `pdfjs-dist` running in the browser. No file data is ever transmitted over a network. This is verified by design — there are no API routes, no serverless functions, and no database connections in this application.

---

## Deployment

The application is deployed on Vercel and uses the standard Next.js deployment pipeline.

- **Live URL**: https://pdf-toolkit-hazel.vercel.app
- **Build command**: `npm run build`
- **Node.js version**: 24 LTS
- **Framework**: Next.js 16 with Turbopack

To deploy your own instance:

```bash
# Clone the repository
git clone https://github.com/tommytang2414/pdf-toolkit.git
cd pdf-toolkit

# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Vercel
npx vercel --prod
```

---

## Changelog

### 2026-05-31 — Initial release
- `321e10c` — PDF Toolkit launched with Merge, Split, and Full Toolkit pages
- All PDF operations (merge, split, rotate, reorder, delete) implemented client-side
- Deploy to Vercel: https://pdf-toolkit-hazel.vercel.app
- Repository: https://github.com/tommytang2414/pdf-toolkit