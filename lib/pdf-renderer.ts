/**
 * PDF page renderer — renders PDF pages to data URLs for thumbnail previews.
 * Uses pdfjs-dist (v4+).
 */

import * as pdfjsLib from "pdfjs-dist";

// Worker is loaded from the pdfjs-dist package itself.
// Vite-friendly: use a CDN worker URL instead of a file path.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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
  return doc.numPages;
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
  const page = await doc.getPage(pageIndex + 1); // pdfjs is 1-indexed

  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxPx / viewport.width, maxPx / viewport.height, 1);
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(scaledViewport.width);
  canvas.height = Math.round(scaledViewport.height);

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  return {
    pageIndex,
    dataUrl: canvas.toDataURL("image/jpeg", 0.85),
    width: viewport.width,
    height: viewport.height,
  };
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
  const doc = await pdfjsLib.getDocument({ data: pdf }).promise;
  const numPages = doc.numPages;

  const tasks: Promise<PageRender>[] = [];
  for (let i = 0; i < numPages; i++) {
    const task = doc.getPage(i + 1).then(async (page) => {
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(maxPx / viewport.width, maxPx / viewport.height, 1);
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(scaledViewport.width);
      canvas.height = Math.round(scaledViewport.height);

      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

      return {
        pageIndex: i,
        dataUrl: canvas.toDataURL("image/jpeg", 0.85),
        width: viewport.width,
        height: viewport.height,
      };
    });
    tasks.push(task);
  }

  // Process in batches to avoid overwhelming the browser
  const results: PageRender[] = new Array(numPages);
  for (let i = 0; i < numPages; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const settled = await Promise.all(batch);
    settled.forEach((page) => {
      results[page.pageIndex] = page;
    });
  }

  return results;
}