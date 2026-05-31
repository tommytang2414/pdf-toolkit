/**
 * PDF operations — pure browser-side using pdf-lib.
 * All functions accept Uint8Array and return Uint8Array.
 */

import { PDFDocument, degrees } from "pdf-lib";

export type Rotation = 0 | 90 | 180 | 270;

/**
 * Merge multiple PDFs into a single PDF.
 * Pages are appended in order — file 1, then file 2, etc.
 */
export async function mergePdfs(pdfs: Uint8Array[]): Promise<Uint8Array> {
  const dest = await PDFDocument.create();
  for (const src of pdfs) {
    const doc = await PDFDocument.load(src);
    const indices = doc.getPageIndices();
    const pages = await dest.copyPages(doc, indices);
    pages.forEach((p) => dest.addPage(p));
  }
  return dest.save();
}

/**
 * Split a PDF — extract a single range of pages into a new PDF.
 * Ranges are 1-indexed (user-facing), converted to 0-indexed internally.
 * e.g. [1, 3] means pages 1 through 3.
 */
export async function splitPdf(
  pdf: Uint8Array,
  ranges: [start: number, end: number][]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const dest = await PDFDocument.create();

  for (const [start, end] of ranges) {
    const indices: number[] = [];
    for (let i = start - 1; i <= end - 1 && i < doc.getPageCount(); i++) {
      indices.push(i);
    }
    const pages = await dest.copyPages(doc, indices);
    pages.forEach((p) => dest.addPage(p));
  }

  return dest.save();
}

/**
 * Extract selected page indices (0-indexed) into a new PDF.
 */
export async function extractPages(
  pdf: Uint8Array,
  pageIndices: number[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const dest = await PDFDocument.create();
  const pages = await dest.copyPages(doc, pageIndices);
  pages.forEach((p) => dest.addPage(p));
  return dest.save();
}

/**
 * Rotate specific pages.
 * pageIndices: 0-indexed
 * rotation: 0 | 90 | 180 | 270
 */
export async function rotatePages(
  pdf: Uint8Array,
  rotations: Map<number, Rotation>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const pages = doc.getPages();

  pages.forEach((page, idx) => {
    const rot = rotations.get(idx);
    if (rot !== undefined) {
      page.setRotation(degrees(rot));
    }
  });

  return doc.save();
}

/**
 * Reorder pages by new index order (0-indexed).
 * newOrder: array of page indices in desired order.
 * e.g. [1, 0, 2] moves page 2 to front.
 */
export async function reorderPages(
  pdf: Uint8Array,
  newOrder: number[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const dest = await PDFDocument.create();

  for (const idx of newOrder) {
    const [page] = await dest.copyPages(doc, [idx]);
    dest.addPage(page);
  }

  return dest.save();
}

/**
 * Delete specified page indices (0-indexed).
 */
export async function deletePages(
  pdf: Uint8Array,
  toDelete: number[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const deleteSet = new Set(toDelete);
  const indices = doc.getPageIndices().filter((i) => !deleteSet.has(i));
  const dest = await PDFDocument.create();
  const pages = await dest.copyPages(doc, indices);
  pages.forEach((p) => dest.addPage(p));
  return dest.save();
}

/**
 * Apply all operations: reorder, rotate, delete.
 * Returns the final PDF bytes and the new page count.
 */
export async function applyAllOperations(
  pdf: Uint8Array,
  ops: {
    newOrder?: number[]; // if provided, reorder to this order
    rotations?: Map<number, Rotation>;
    toDelete?: number[];
  }
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  let bytes = pdf;

  if (ops.toDelete && ops.toDelete.length > 0) {
    bytes = await deletePages(bytes, ops.toDelete);
  }

  if (ops.newOrder && ops.newOrder.length > 0) {
    // Renumber indices after deletions
    const deleted = new Set(ops.toDelete ?? []);
    const renumbered = ops.newOrder
      .map((oldIdx) => {
        let count = 0;
        for (const d of deleted) {
          if (d < oldIdx) count++;
        }
        return oldIdx - count;
      })
      .filter((n) => n >= 0);
    bytes = await reorderPages(bytes, renumbered);
  }

  if (ops.rotations && ops.rotations.size > 0) {
    bytes = await rotatePages(bytes, ops.rotations);
  }

  const doc = await PDFDocument.load(bytes);
  return { bytes, pageCount: doc.getPageCount() };
}