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
import { Download, ChevronLeft, RotateCw, RotateCcw, Trash2 } from "lucide-react";

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

const actionBtn: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  padding: "4px 6px",
  color: "var(--text-muted)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  transition: "border-color 0.15s, color 0.15s",
};

function SortablePage({
  thumb, rotationDeg, onRotateCW, onRotateCCW, onDelete,
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
      <div style={{ width: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: isDragging ? "grabbing" : "grab" }}>
        {/* Thumbnail */}
        <div style={{
          width: 120, height: 160, borderRadius: 10, overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          background: "#111116",
          transform: `rotate(${rotationDeg}deg)`,
          transition: "transform 0.3s ease",
          position: "relative",
        }}>
          <img src={thumb.dataUrl} alt={`Page ${thumb.pageIndex + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
          {/* Drag dots */}
          <div style={{ position: "absolute", top: 5, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2, opacity: 0.3 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: 999, background: "#fff" }} />)}
          </div>
          <div style={{
            position: "absolute", bottom: 4, right: 4,
            background: "rgba(0,0,0,0.75)", borderRadius: 4,
            padding: "1px 6px", fontSize: 10, fontFamily: "var(--font-mono)",
            color: rotationDeg ? "var(--accent)" : "#f0ede6",
          }}>
            {thumb.pageIndex + 1}{rotationDeg ? `↻${rotationDeg}°` : ""}
          </div>
        </div>
        {/* Actions */}
        <div style={{ display: "flex", gap: 3 }}>
          <button onClick={(e) => { e.stopPropagation(); onRotateCW(); }} title="Rotate CW" style={actionBtn}><RotateCw size={11} /></button>
          <button onClick={(e) => { e.stopPropagation(); onRotateCCW(); }} title="Rotate CCW" style={actionBtn}><RotateCcw size={11} /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Remove page" style={{ ...actionBtn, color: "#ef4444" }}><Trash2 size={11} /></button>
        </div>
      </div>
    </div>
  );
}

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
    setFiles([]); setPages([]); setOrder([]); setRotations(new Map());
    setResultUrl(null); setError(null); setMergedBytes(null);
    revokeUrl();
  }, [revokeUrl]);

  const handleFiles = useCallback(async (newFiles: PdfFile[]) => {
    setFiles(newFiles); setPages([]); setOrder([]); setRotations(new Map());
    setResultUrl(null); setError(null); setMergedBytes(null); revokeUrl();
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
      next.set(pageIndex, ((next.get(pageIndex) ?? 0) + 90) % 360);
      return next;
    });
  };

  const handleRotateCCW = (pageIndex: number) => {
    setRotations((prev) => {
      const next = new Map(prev);
      const cur = (next.get(pageIndex) ?? 0);
      next.set(pageIndex, (cur - 90 + 360) % 360);
      return next;
    });
  };

  const handleDelete = (pageIndex: number) => setOrder((prev) => prev.filter((i) => i !== pageIndex));

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

      const deletedOriginal = new Set(pages.map((p) => p.pageIndex).filter((idx) => !order.includes(idx)));
      if (deletedOriginal.size > 0) {
        bytes = await deletePages(bytes, Array.from(deletedOriginal));
      }

      const surviving = pages.map((p) => p.pageIndex).filter((idx) => !deletedOriginal.has(idx));
      const origToNew = new Map<number, number>();
      surviving.forEach((orig, newIdx) => origToNew.set(orig, newIdx));
      const newOrder = order.map((orig) => origToNew.get(orig)).filter((n): n is number => n !== undefined);

      if (newOrder.length > 0) bytes = await reorderPages(bytes, newOrder);

      const rotMap = new Map<number, Rotation>();
      rotations.forEach((deg, origIdx) => {
        if (!deletedOriginal.has(origIdx) && deg !== 0) {
          let shift = 0;
          deletedOriginal.forEach((d) => { if (d < origIdx) shift++; });
          rotMap.set(origIdx - shift, deg as Rotation);
        }
      });
      if (rotMap.size > 0) bytes = await rotatePages(bytes, rotMap);

      const url = createUrl(bytes);
      setResultUrl(url);
    } catch {
      setError("Failed to process PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ambient-bg" style={{ minHeight: "100vh", padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <Link href="/" style={{ color: "var(--text-muted)", display: "flex", padding: 6 }}>
          <ChevronLeft size={22} />
        </Link>
        <img src="/images/icon-toolkit.jpeg" alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>PDF Toolkit</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>Drag to reorder · Rotate CW/CCW · Delete · Download when ready</p>
        </div>
        {pages.length > 0 && (
          <button onClick={reset} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }}>Reset</button>
        )}
      </div>

      <PdfDropzone multiple onFiles={handleFiles} />

      {loading && files.length > 0 && pages.length === 0 && (
        <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading & rendering pages...</div>
      )}

      {pages.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{order.length} page{order.length !== 1 ? "s" : ""} · Drag to reorder</p>
            <span className="score-badge">{files.length} file{files.length !== 1 ? "s" : ""}</span>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div className="toolkit-grid">
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

          <button onClick={handleDownload} disabled={loading || order.length === 0} className="btn-primary" style={{ marginTop: 28, width: "100%", maxWidth: 400, marginLeft: "auto", marginRight: "auto", display: "flex" }}>
            {loading ? "Processing..." : `Download ${order.length} pages`}
            <Download size={17} />
          </button>

          {error && <p className="error-text" style={{ marginTop: 12, textAlign: "center" }}>{error}</p>}
        </div>
      )}

      {resultUrl && (
        <div className="result-banner" style={{ marginTop: 28 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Done!</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>Your edited PDF is ready.</p>
          </div>
          <a href={resultUrl} download={`toolkit-${Date.now()}.pdf`} className="btn-secondary" style={{ background: "#22c55e", color: "#052e16", border: "none" }}>
            <Download size={15} /> Download PDF
          </a>
        </div>
      )}
    </div>
  );
}