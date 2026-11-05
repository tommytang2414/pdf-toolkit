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

const MAX_BATCH_PAGES = 200;
const MAX_THUMBNAIL_PX = 512;
const MAX_CONCURRENCY = 4;
const MAX_BATCH_DATA_URL_CHARS = 16 * 1024 * 1024;

async function loadPdfDocument(pdf: Uint8Array) {
  const loadingTask = pdfjsLib.getDocument({ data: pdf });
  try {
    return await loadingTask.promise;
  } catch (error) {
    await loadingTask.destroy();
    throw error;
  }
}

function validateMaxPx(maxPx: number): void {
  if (!Number.isFinite(maxPx) || maxPx <= 0 || maxPx > MAX_THUMBNAIL_PX) {
    throw new RangeError(`maxPx must be a finite positive number no greater than ${MAX_THUMBNAIL_PX}`);
  }
}

function validateConcurrency(concurrency: number): void {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_CONCURRENCY) {
    throw new RangeError(`concurrency must be a positive integer no greater than ${MAX_CONCURRENCY}`);
  }
}

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

type LoadedPdfDocument = Awaited<ReturnType<typeof loadPdfDocument>>;

async function renderDocumentPage(
  doc: LoadedPdfDocument,
  pageIndex: number,
  maxPx: number
): Promise<PageRender> {
  const page = await doc.getPage(pageIndex + 1);
  let canvas: HTMLCanvasElement | null = null;

  try {
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(maxPx / viewport.width, maxPx / viewport.height, 1);
    const scaledViewport = page.getViewport({ scale });

    canvas = document.createElement("canvas");
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
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    page.cleanup();
  }
}

/**
 * Get the number of pages in a PDF without rendering anything.
 */
export async function getPageCount(pdf: Uint8Array): Promise<number> {
  const doc = await loadPdfDocument(pdf);
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
  validateMaxPx(maxPx);
  const doc = await loadPdfDocument(pdf);
  try {
    return await renderDocumentPage(doc, pageIndex, maxPx);
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
  validateMaxPx(maxPx);
  validateConcurrency(concurrency);

  const doc = await loadPdfDocument(pdf);
  try {
    const numPages = doc.numPages;
    if (numPages > MAX_BATCH_PAGES) {
      throw new RangeError(`PDF has more than ${MAX_BATCH_PAGES} pages`);
    }

    const results: PageRender[] = [];
    let encodedChars = 0;

    for (let start = 0; start < numPages; start += concurrency) {
      const tasks = Array.from(
        { length: Math.min(concurrency, numPages - start) },
        (_, offset) => renderDocumentPage(doc, start + offset, maxPx)
      );
      const settled = await Promise.allSettled(tasks);
      const batchResults: PageRender[] = [];
      let batchFailed = false;
      let batchError: unknown;

      for (const result of settled) {
        if (result.status === "rejected") {
          if (!batchFailed) {
            batchFailed = true;
            batchError = result.reason ?? new Error("PDF page rendering failed");
          }
          continue;
        }

        encodedChars += result.value.dataUrl.length;
        if (encodedChars > MAX_BATCH_DATA_URL_CHARS) {
          if (!batchFailed) {
            batchFailed = true;
            batchError = new RangeError(
              `Rendered thumbnails exceed the ${MAX_BATCH_DATA_URL_CHARS} character batch limit`
            );
          }
          continue;
        }

        batchResults.push(result.value);
      }

      if (batchFailed) {
        throw batchError;
      }
      results.push(...batchResults);
    }

    return results;
  } finally {
    await doc.destroy();
  }
}
