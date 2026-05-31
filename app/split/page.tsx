"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { extractPages } from "@/lib/pdf-operations";
import { renderAllPages } from "@/lib/pdf-renderer";
import { useBlobUrl } from "@/hooks/useBlobUrl";
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
  const [rangeInput, setRangeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const { create: createUrl, revoke: revokeUrl } = useBlobUrl();

  const handleFiles = useCallback(async (files: PdfFile[]) => {
    if (!files[0]) return;
    const f = files[0];
    setPdfFile(f);
    setSelected(new Set());
    setResultUrl(null);
    setError(null);
    revokeUrl();
    setLoading(true);
    try {
      const thumbs = await renderAllPages(f.bytes, 160, 4);
      setPages(thumbs);
    } catch {
      setError("Could not render PDF pages.");
    } finally {
      setLoading(false);
    }
  }, [revokeUrl]);

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const parseRanges = (input: string): [number, number][] => {
    const results: [number, number][] = [];
    for (const part of input.split(",").map((s) => s.trim())) {
      if (!part) continue;
      const dashIdx = part.indexOf("-");
      if (dashIdx > 0) {
        const a = parseInt(part.slice(0, dashIdx).trim());
        const b = parseInt(part.slice(dashIdx + 1).trim());
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
          setError('Invalid range. Use: 1-3, 5, 7-9');
          setLoading(false);
          return;
        }
        indices = [];
        for (const [s, e] of ranges) {
          for (let i = s - 1; i <= e - 1 && i < pdfFile.pageCount; i++) indices.push(i);
        }
      }
      if (indices.length === 0) {
        setError("No pages in that range.");
        setLoading(false);
        return;
      }
      const bytes = await extractPages(pdfFile.bytes, indices);
      const url = createUrl(bytes);
      setResultUrl(url);
    } catch {
      setError("Failed to extract pages.");
    } finally {
      setLoading(false);
    }
  };

  const selectAll = () => setSelected(new Set(pages.map((p) => p.pageIndex)));
  const selectNone = () => setSelected(new Set());

  const rangeCount = rangeInput.trim()
    ? parseRanges(rangeInput).reduce((s, [a, b]) => s + (b - a + 1), 0)
    : 0;

  return (
    <div className="ambient-bg" style={{ minHeight: "100vh", padding: "32px 24px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
        <Link href="/" style={{ color: "var(--text-muted)", display: "flex", padding: 6 }}>
          <ChevronLeft size={22} />
        </Link>
        <img src="/images/icon-split.jpeg" alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Split PDF</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>Click pages to select, then extract into a new PDF</p>
        </div>
      </div>

      <PdfDropzone multiple={false} onFiles={handleFiles} />

      {loading && !pdfFile && (
        <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Rendering pages...</div>
      )}

      {pages.length > 0 && (
        <div style={{ marginTop: 24 }}>
          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{pages.length} pages total</p>
              <span style={{ color: "var(--border)" }}>·</span>
              <button onClick={selectAll} className="btn-ghost">Select all</button>
              <button onClick={selectNone} className="btn-ghost">Clear</button>
              {selected.size > 0 && <span className="score-badge">{selected.size} selected</span>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleExtract("range")}
                placeholder="e.g. 1-3, 5, 7-9"
                className="range-input"
                style={{ width: 176 }}
              />
              <button onClick={() => handleExtract("range")} disabled={!rangeInput.trim() || loading} className="btn-secondary" style={{ padding: "7px 14px", fontSize: 13 }}>
                Extract range
              </button>
            </div>
          </div>

          {/* Page grid */}
          <div className="page-grid">
            {pages.map((page) => {
              const isSelected = selected.has(page.pageIndex);
              return (
                <div key={page.pageIndex} className="page-thumb-wrap">
                  <div
                    className={`page-thumb ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleSelect(page.pageIndex)}
                    style={{ aspectRatio: `${page.width} / ${page.height}`, minHeight: 80 }}
                  >
                    <img src={page.dataUrl} alt={`Page ${page.pageIndex + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
                    <div className={`page-badge ${isSelected ? "active" : ""}`}>{page.pageIndex + 1}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {selected.size > 0 && (
            <button onClick={() => handleExtract("selected")} disabled={loading} className="btn-primary" style={{ marginTop: 20, width: "100%", maxWidth: 360 }}>
              {loading ? "Extracting..." : `Extract ${selected.size} page${selected.size > 1 ? "s" : ""}`}
              <Download size={15} />
            </button>
          )}

          {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {resultUrl && (
        <div className="result-banner" style={{ marginTop: 24 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Extraction complete!</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              {selected.size > 0 ? `${selected.size} pages` : rangeCount > 0 ? `${rangeCount} pages` : ""} extracted
            </p>
          </div>
          <a href={resultUrl} download={`extracted-${Date.now()}.pdf`} className="btn-secondary" style={{ background: "#22c55e", color: "#052e16", border: "none" }}>
            <Download size={15} /> Download PDF
          </a>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}>
        <a href="https://github.com/tommytang2414/pdf-toolkit" target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)", fontSize: 11, textDecoration: "none", fontFamily: "var(--font-mono)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          by tommytang
        </a>
      </div>
    </div>
  );
}