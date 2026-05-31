"use client";

import { useState, useCallback } from "react";
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
import { rotatePages, deletePages, reorderPages, type Rotation } from "@/lib/pdf-operations";
import { renderAllPages } from "@/lib/pdf-renderer";
import { useBlobUrl } from "@/hooks/useBlobUrl";
import PdfDropzone from "@/components/pdf/PdfDropzone";
import { Download, ChevronLeft, RotateCw, RotateCcw, Trash2, RotateCw as RotateCwIcon } from "lucide-react";

interface PdfFile {
  file: File;
  bytes: Uint8Array;
  name: string;
  pageCount: number;
}

interface PageThumb {
  pageIndex: number;
  dataUrl: string;
  width: number;
  height: number;
}

function SortablePage({
  thumb,
  rotationDeg,
  onRotateCW,
  onRotateCCW,
  onDelete,
}: {
  thumb: PageThumb;
  rotationDeg: number;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: thumb.pageIndex });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 10 : 1,
        position: "relative",
      }}
      {...attributes}
      {...listeners}
    >
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
            transform: `rotate(${rotationDeg}deg)`,
            transition: "transform 0.3s ease",
            position: "relative",
          }}
        >
          <img
            src={thumb.dataUrl}
            alt={`Page ${thumb.pageIndex + 1}`}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
          />
          {/* Drag dots */}
          <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2, opacity: 0.35 }}>
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
              color: rotationDeg ? "var(--accent)" : "#fafafa",
            }}
          >
            {thumb.pageIndex + 1}{rotationDeg ? `↻${rotationDeg}°` : ""}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 3 }}>
          <button onClick={(e) => { e.stopPropagation(); onRotateCW(); }} title="Rotate 90° CW" style={actionBtn}>
            <RotateCwIcon size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRotateCCW(); }} title="Rotate 90° CCW" style={actionBtn}>
            <RotateCcw size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Remove page" style={{ ...actionBtn, color: "#f87171" }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  padding: "4px 6px",
  color: "var(--text-muted)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  transition: "background 0.15s",
};

export default function ToolkitPage() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [rotations, setRotations] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [mergedBytes, setMergedBytes] = useState<Uint8Array | null>(null);
  const { create: createUrl, revoke: revokeUrl } = useBlobUrl();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reset = useCallback(() => {
    setFiles([]);
    setPages([]);
    setOrder([]);
    setRotations(new Map());
    setResultUrl(null);
    setError(null);
    setMergedBytes(null);
    revokeUrl();
  }, [revokeUrl]);

  const handleFiles = useCallback(async (newFiles: PdfFile[]) => {
    setFiles(newFiles);
    setPages([]);
    setOrder([]);
    setRotations(new Map());
    setResultUrl(null);
    setError(null);
    setMergedBytes(null);
    revokeUrl();
    setLoading(true);

    try {
      const { mergePdfs } = await import("@/lib/pdf-operations");
      const merged = await mergePdfs(newFiles.map((f) => f.bytes));
      setMergedBytes(merged);
      const thumbs = await renderAllPages(merged, 160, 4);
      setPages(thumbs);
      setOrder(thumbs.map((t) => t.pageIndex));
    } catch {
      setError("Failed to load PDFs.");
    } finally {
      setLoading(false);
    }
  }, [revokeUrl]);

  const handleRotateCW = (pageIndex: number) => {
    setRotations((prev) => {
      const next = new Map(prev);
      const current = (next.get(pageIndex) ?? 0);
      next.set(pageIndex, (current + 90) % 360);
      return next;
    });
  };

  const handleRotateCCW = (pageIndex: number) => {
    setRotations((prev) => {
      const next = new Map(prev);
      const current = (next.get(pageIndex) ?? 0);
      next.set(pageIndex, (current - 90 + 360) % 360);
      return next;
    });
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

      // 1. Delete pages not in order
      const deletedOriginalIndices = new Set(
        pages.map((p) => p.pageIndex).filter((idx) => !order.includes(idx))
      );
      if (deletedOriginalIndices.size > 0) {
        bytes = await deletePages(bytes, Array.from(deletedOriginalIndices));
      }

      // 2. Reorder — build correct index mapping after deletion
      const survivingOriginalIndices = pages
        .map((p) => p.pageIndex)
        .filter((idx) => !deletedOriginalIndices.has(idx));

      // originalIdx → newIdx in the post-deletion document
      const originalToNewIdx = new Map<number, number>();
      survivingOriginalIndices.forEach((orig, newIdx) => originalToNewIdx.set(orig, newIdx));

      // current visual order → indices in the post-deletion doc
      const newOrder = order
        .map((orig) => originalToNewIdx.get(orig))
        .filter((n): n is number => n !== undefined);

      if (newOrder.length > 0) {
        bytes = await reorderPages(bytes, newOrder);
      }

      // 3. Rotate (on the post-reorder document, indices are 0..N-1)
      const deleteCount = new Map<number, number>();
      deletedOriginalIndices.forEach((orig) => {
        deleteCount.set(orig, (deleteCount.get(orig) ?? 0) + 1);
      });

      const rotMap = new Map<number, Rotation>();
      rotations.forEach((deg, origIdx) => {
        if (!deletedOriginalIndices.has(origIdx) && deg !== 0) {
          // After deletion, the original index shifts down by the number of deleted pages before it
          let shift = 0;
          deletedOriginalIndices.forEach((d) => { if (d < origIdx) shift++; });
          rotMap.set(origIdx - shift, deg as Rotation);
        }
      });

      if (rotMap.size > 0) {
        bytes = await rotatePages(bytes, rotMap);
      }

      const url = createUrl(bytes);
      setResultUrl(url);
    } catch {
      setError("Failed to process PDF.");
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
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>PDF Toolkit</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Drag to reorder · Rotate CW / CCW · Delete pages · Download when ready
          </p>
        </div>
        {pages.length > 0 && (
          <button onClick={reset} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
            Reset
          </button>
        )}
      </div>

      <PdfDropzone multiple onFiles={handleFiles} />

      {loading && files.length > 0 && pages.length === 0 && (
        <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          Loading & rendering pages...
        </div>
      )}

      {pages.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
              {order.length} page{order.length !== 1 ? "s" : ""} · Drag to reorder
            </p>
            <span style={badge}>{files.length} file{files.length !== 1 ? "s" : ""}</span>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 4 }}>
                {order.map((pageIdx) => {
                  const thumb = pages.find((p) => p.pageIndex === pageIdx);
                  if (!thumb) return null;
                  return (
                    <SortablePage
                      key={pageIdx}
                      thumb={thumb}
                      rotationDeg={rotations.get(pageIdx) ?? 0}
                      onRotateCW={() => handleRotateCW(pageIdx)}
                      onRotateCCW={() => handleRotateCCW(pageIdx)}
                      onDelete={() => handleDelete(pageIdx)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

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

          {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</p>}
        </div>
      )}

      {resultUrl && (
        <div style={{ marginTop: 28, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Done!</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Your edited PDF is ready.
            </p>
          </div>
          <a
            href={resultUrl}
            download={`toolkit-${Date.now()}.pdf`}
            style={{ background: "#22c55e", color: "#052e16", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <Download size={15} /> Download PDF
          </a>
        </div>
      )}
    </div>
  );
}

const badge: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-geist-mono)",
  color: "var(--accent)",
  background: "rgba(124,58,237,0.12)",
  border: "1px solid rgba(124,58,237,0.25)",
  borderRadius: 6,
  padding: "2px 10px",
};