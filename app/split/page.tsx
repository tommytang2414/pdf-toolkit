"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { extractPages } from "@/lib/pdf-operations";
import { renderAllPages } from "@/lib/pdf-renderer";
import PdfDropzone from "@/components/pdf/PdfDropzone";
import { Download, ChevronLeft } from "lucide-react";

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

export default function SplitPage() {
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [rangeInput, setRangeInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: PdfFile[]) => {
    if (!files[0]) return;
    const f = files[0];
    setPdfFile(f);
    setSelected(new Set());
    setResultUrl(null);
    setError(null);
    setLoading(true);
    try {
      const thumbs = await renderAllPages(f.bytes, 160, 4);
      setPages(thumbs);
    } catch (e) {
      setError("Could not render PDF pages.");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const parseRanges = (input: string): [number, number][] => {
    const results: [number, number][] = [];
    for (const part of input.split(",").map((s) => s.trim())) {
      if (!part) continue;
      if (part.includes("-")) {
        const [a, b] = part.split("-").map((s) => parseInt(s.trim()));
        if (!isNaN(a) && !isNaN(b) && a <= b) results.push([a, b]);
      } else {
        const n = parseInt(part);
        if (!isNaN(n)) results.push([n, n]);
      }
    }
    return results;
  };

  const handleExtract = async (mode: "selected" | "range") => {
    if (!pdfFile) return;
    setLoading(true);
    setError(null);
    try {
      let indices: number[];
      if (mode === "selected") {
        indices = Array.from(selected).sort((a, b) => a - b);
      } else {
        const ranges = parseRanges(rangeInput);
        if (ranges.length === 0) {
          setError("Invalid range format. Use: 1-3, 5, 7-9");
          setLoading(false);
          return;
        }
        indices = [];
        for (const [s, e] of ranges) {
          for (let i = s - 1; i <= e - 1 && i < pdfFile.pageCount; i++) indices.push(i);
        }
      }

      if (indices.length === 0) {
        setError("No pages selected.");
        setLoading(false);
        return;
      }

      const bytes = await extractPages(pdfFile.bytes, indices);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      setResultUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError("Failed to extract pages.");
    } finally {
      setLoading(false);
    }
  };

  const selectAll = () => setSelected(new Set(pages.map((p) => p.pageIndex)));
  const selectNone = () => setSelected(new Set());

  return (
    <div style={{ minHeight: "100vh", padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <Link href="/" style={{ color: "var(--text-muted)", display: "flex" }}>
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Split PDF</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Upload a PDF, click pages to select, then extract.
          </p>
        </div>
      </div>

      {/* Dropzone */}
      <PdfDropzone multiple={false} onFiles={handleFiles} />

      {/* Loading state */}
      {loading && !pdfFile && (
        <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-muted)" }}>
          Rendering pages...
        </div>
      )}

      {/* Page grid */}
      {pages.length > 0 && (
        <div style={{ marginTop: 24 }}>
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
                {pages.length} pages total
              </p>
              <span style={{ color: "var(--border)" }}>·</span>
              <button onClick={selectAll} style={linkBtn}>Select all</button>
              <button onClick={selectNone} style={linkBtn}>Clear</button>
              {selected.size > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-geist-mono)",
                    color: "var(--accent)",
                    background: "rgba(124,58,237,0.12)",
                    border: "1px solid rgba(124,58,237,0.25)",
                    borderRadius: 6,
                    padding: "2px 10px",
                  }}
                >
                  {selected.size} selected
                </span>
              )}
            </div>

            {/* Range input */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                placeholder="e.g. 1-3, 5, 7-9"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "var(--text)",
                  fontSize: 13,
                  fontFamily: "var(--font-geist-mono)",
                  outline: "none",
                  width: 180,
                }}
                onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--accent)")}
                onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--border)")}
              />
              <button
                onClick={() => handleExtract("range")}
                disabled={!rangeInput.trim() || loading}
                style={{
                  ...actionBtn,
                  opacity: !rangeInput.trim() || loading ? 0.5 : 1,
                  cursor: !rangeInput.trim() || loading ? "not-allowed" : "pointer",
                }}
              >
                Extract range
              </button>
            </div>
          </div>

          {/* Page grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: 12,
            }}
          >
            {pages.map((page) => {
              const isSelected = selected.has(page.pageIndex);
              return (
                <div
                  key={page.pageIndex}
                  onClick={() => toggleSelect(page.pageIndex)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: `${page.width} / ${page.height}`,
                      borderRadius: 6,
                      overflow: "hidden",
                      border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                      boxShadow: isSelected ? "0 0 0 3px rgba(124,58,237,0.2)" : "0 2px 8px rgba(0,0,0,0.4)",
                      background: "#18181b",
                      position: "relative",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                  >
                    <img
                      src={page.dataUrl}
                      alt={`Page ${page.pageIndex + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
                    />
                    {isSelected && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(124,58,237,0.15)" }} />
                    )}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 3,
                        right: 3,
                        background: "rgba(0,0,0,0.75)",
                        borderRadius: 4,
                        padding: "1px 5px",
                        fontSize: 10,
                        fontFamily: "var(--font-geist-mono)",
                        color: isSelected ? "var(--accent)" : "#fafafa",
                      }}
                    >
                      {page.pageIndex + 1}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Extract selected */}
          {selected.size > 0 && (
            <button
              onClick={() => handleExtract("selected")}
              disabled={loading}
              style={{
                marginTop: 20,
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Extracting..." : `Extract ${selected.size} selected page${selected.size > 1 ? "s" : ""}`}
              <Download size={15} />
            </button>
          )}

          {error && (
            <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>{error}</p>
          )}
        </div>
      )}

      {/* Result */}
      {resultUrl && (
        <div
          style={{
            marginTop: 24,
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
            <p style={{ margin: 0, fontWeight: 600 }}>Extraction complete!</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              {selected.size > 0 ? `${selected.size} pages` : rangeInput} extracted
            </p>
          </div>
          <a
            href={resultUrl}
            download={`extracted-${Date.now()}.pdf`}
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

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontSize: 13,
  cursor: "pointer",
  padding: "2px 4px",
};

const actionBtn: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 14px",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 500,
};