"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { mergePdfs, rotatePages, deletePages, reorderPages, type Rotation } from "@/lib/pdf-operations";
import { renderAllPages } from "@/lib/pdf-renderer";
import PdfDropzone from "@/components/pdf/PdfDropzone";
import { Download, ChevronLeft, RotateCw, Trash2, FileText } from "lucide-react";

interface PdfFile {
  file: File;
  bytes: Uint8Array;
  name: string;
  pageCount: number;
}

interface PageThumb {
  pageIndex: number;       // original index across all merged PDFs
  fileId: number;          // which source file
  dataUrl: string;
  width: number;
  height: number;
}

function SortablePage({
  thumb,
  rotations,
  onRotate,
  onDelete,
}: {
  thumb: PageThumb;
  rotations: Map<number, number>;
  onRotate: (idx: number) => void;
  onDelete: (idx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: thumb.pageIndex });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: "relative",
  };

  const rot = rotations.get(thumb.pageIndex) ?? 0;
  const rotDeg = rot * 90;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        style={{
          width: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          cursor: isDragging ? "grabbing" : "grab",
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            width: 120,
            height: 160,
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            background: "#18181b",
            transform: `rotate(${rotDeg}deg)`,
            transition: "transform 0.3s ease",
            position: "relative",
          }}
        >
          <img
            src={thumb.dataUrl}
            alt={`Page ${thumb.pageIndex + 1}`}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
          />
          {/* Drag handle indicator */}
          <div
            style={{
              position: "absolute",
              top: 4,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 2,
              opacity: 0.4,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: 999, background: "#fff" }} />
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              background: "rgba(0,0,0,0.75)",
              borderRadius: 4,
              padding: "1px 6px",
              fontSize: 10,
              fontFamily: "var(--font-geist-mono)",
              color: rotDeg ? "var(--accent)" : "#fafafa",
            }}
          >
            {thumb.pageIndex + 1}{rotDeg ? `↻${rotDeg}°` : ""}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onRotate(thumb.pageIndex); }}
            title="Rotate 90° CW"
            style={actionBtn}
          >
            <RotateCw size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(thumb.pageIndex); }}
            title="Remove page"
            style={{ ...actionBtn, color: "#f87171" }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ToolkitPage() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [rotations] = useState<Map<number, number>>(new Map()); // pageIndex → rot count (0-3)
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergedBytes, setMergedBytes] = useState<Uint8Array | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFiles = useCallback(async (newFiles: PdfFile[]) => {
    setFiles(newFiles);
    setPages([]);
    setOrder([]);
    setResultUrl(null);
    setError(null);
    setMergedBytes(null);
    setLoading(true);

    try {
      const bytes = await mergePdfs(newFiles.map((f) => f.bytes));
      setMergedBytes(bytes);
      const thumbs = await renderAllPages(bytes, 160, 4);
      const ordered = thumbs.map((t, i) => ({ ...t, fileId: i })); // simplified fileId
      setPages(ordered);
      setOrder(thumbs.map((t) => t.pageIndex));
    } catch (e) {
      setError("Failed to load PDFs.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRotate = (pageIndex: number) => {
    const newRot = new Map(rotations);
    newRot.set(pageIndex, ((newRot.get(pageIndex) ?? 0) + 1) % 4);
    rotations.set(pageIndex, newRot.get(pageIndex)!);
    rotations; // trigger re-render
    setPages([...pages]); // shallow copy to force re-render
  };

  const handleDelete = (pageIndex: number) => {
    setOrder((prev) => prev.filter((i) => i !== pageIndex));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as number);
      const newIdx = prev.indexOf(over.id as number);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleDownload = async () => {
    if (!mergedBytes) return;
    setLoading(true);
    setError(null);
    try {
      let bytes = mergedBytes;

      // Apply deletions
      const deletedSet = new Set(
        pages.map((p) => p.pageIndex).filter((idx) => !order.includes(idx))
      );
      if (deletedSet.size > 0) {
        bytes = await deletePages(bytes, Array.from(deletedSet));
      }

      // Build new order relative to remaining pages
      // After delete, the pages in `order` refer to original indices that are still in bytes
      // We need to map them to new (post-deletion) indices
      const deleted = new Set(Array.from(deletedSet));
      const remainingOriginalIndices = pages.map((p) => p.pageIndex).filter((i) => !deleted.has(i));
      const originalToNew = new Map<number, number>();
      remainingOriginalIndices.forEach((orig, newIdx) => originalToNew.set(orig, newIdx));
      const newOrder = order.map((orig) => originalToNew.get(orig) ?? orig).filter((n) => n >= 0);

      if (newOrder.length > 0) {
        bytes = await reorderPages(bytes, newOrder);
      }

      // Apply rotations
      const rotMap = new Map<number, Rotation>();
      rotations.forEach((count, pageIdx) => {
        if (count > 0 && !deletedSet.has(pageIdx)) {
          rotMap.set(pageIdx, (count * 90) as Rotation);
        }
      });
      if (rotMap.size > 0) {
        bytes = await rotatePages(bytes, rotMap);
      }

      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      setResultUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError("Failed to process PDF. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/" style={{ color: "var(--text-muted)", display: "flex" }}>
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>PDF Toolkit</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Drag to reorder pages · Click rotate or delete · Download when ready
          </p>
        </div>
      </div>

      {/* Dropzone */}
      <PdfDropzone multiple onFiles={handleFiles} />

      {/* Loading */}
      {loading && (files.length > 0 && pages.length === 0) && (
        <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          Loading & rendering pages...
        </div>
      )}

      {/* Page grid with DnD */}
      {pages.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
              {order.length} page{order.length !== 1 ? "s" : ""} · Drag to reorder
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-geist-mono)",
                  color: "var(--accent)",
                  background: "rgba(124,58,237,0.12)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: 6,
                  padding: "2px 10px",
                }}
              >
                {files.length} file{files.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  padding: 4,
                }}
              >
                {order.map((pageIdx) => {
                  const thumb = pages.find((p) => p.pageIndex === pageIdx);
                  if (!thumb) return null;
                  return (
                    <SortablePage
                      key={pageIdx}
                      thumb={thumb}
                      rotations={rotations}
                      onRotate={handleRotate}
                      onDelete={handleDelete}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={loading || order.length === 0}
            style={{
              marginTop: 28,
              background: order.length === 0 ? "var(--bg-secondary)" : "var(--accent)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "14px 28px",
              fontSize: 16,
              fontWeight: 600,
              cursor: loading || order.length === 0 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: loading ? 0.7 : 1,
              width: "100%",
              maxWidth: 400,
              margin: "28px auto 0",
            }}
          >
            {loading ? "Processing..." : `Download ${order.length} pages`}
            <Download size={17} />
          </button>

          {error && (
            <p style={{ color: "#f87171", fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</p>
          )}
        </div>
      )}

      {/* Result */}
      {resultUrl && (
        <div
          style={{
            marginTop: 28,
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 12,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Done!</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Your edited PDF is ready.
            </p>
          </div>
          <a
            href={resultUrl}
            download={`toolkit-${Date.now()}.pdf`}
            style={{
              background: "#22c55e",
              color: "#052e16",
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <Download size={15} /> Download PDF
          </a>
        </div>
      )}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  padding: "4px 7px",
  color: "var(--text-muted)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  transition: "background 0.15s",
};