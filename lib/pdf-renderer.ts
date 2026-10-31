/**
 * PDF page renderer — renders PDF pages to data URLs for thumbnail previews.
 * Uses pdfjs-dist (v4+).
 */

import * as pdfjsLib from "pdfjs-dist";

// Bundle the matching installed worker; local PDF bytes never depend on runtime CDN code.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface PageRender {
  /** 0-indexed page number */
  pageIndex: number;
  /** Thumbnail data URL (JPEG, base64) */
  dataUrl: string;
  /** Physical page width in points */
  width: number;
  /** Physical page height in points */
  height: number;
}

/**
 * Get the number of pages in a PDF without rendering anything.
 */
export async function getPageCount(pdf: Uint8Array): Promise<number> {
  const doc = await pdfjsLib.getDocument({ data: pdf }).promise;
  try {
    return doc.numPages;
  } finally {
    await doc.destroy();
  }
}

/**
 * Render a single PDF page to a JPEG data URL.
 * maxPx = max pixel dimension (width or height) for the thumbnail.
 */
export async function renderPage(
  pdf: Uint8Array,
  pageIndex: number,
  maxPx = 200
): Promise<PageRender> {
  const doc = await pdfjsLib.getDocument({ data: pdf }).promise;
  try {
    const page = await doc.getPage(pageIndex + 1); // pdfjs is 1-indexed

    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(maxPx / viewport.width, maxPx / viewport.height, 1);
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(scaledViewport.width);
    canvas.height = Math.round(scaledViewport.height);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not create a 2D rendering context");
    }
    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

    return {
      pageIndex,
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      width: viewport.width,
      height: viewport.height,
    };
  } finally {
    await doc.destroy();
  }
}

/**
 * Render all pages of a PDF in parallel (up to `concurrency` at a time).
 * Useful for initial thumbnail grid on page load.
 */
export async function renderAllPages(
  pdf: Uint8Array,
  maxPx = 200,
  concurrency = 4
): Promise<PageRender[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive integer");
  }
  const doc = await pdfjsLib.getDocument({ data: pdf }).promise;
  try {
    const numPages = doc.numPages;

    const results: PageRender[] = [];
    // Create work only when a batch has capacity; slicing started promises is not a limit.
    for (let start = 0; start < numPages; start += concurrency) {
      const tasks = Array.from({ length: Math.min(concurrency, numPages - start) }, async (_, offset) => {
        const i = start + offset;
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(maxPx / viewport.width, maxPx / viewport.height, 1);
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(scaledViewport.width);
        canvas.height = Math.round(scaledViewport.height);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not create a 2D rendering context");
        }
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

        return {
          pageIndex: i,
          dataUrl: canvas.toDataURL("image/jpeg", 0.85),
          width: viewport.width,
          height: viewport.height,
        };
      });
      results.push(...await Promise.all(tasks));
    }

    return results;
  } finally {
    await doc.destroy();
  }
}
