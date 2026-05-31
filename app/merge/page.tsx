"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { mergePdfs } from "@/lib/pdf-operations";
import { useBlobUrl } from "@/hooks/useBlobUrl";
import PdfDropzone from "@/components/pdf/PdfDropzone";
import { Download, ChevronLeft, RotateCw } from "lucide-react";

interface PdfFile {
  file: File;
  bytes: Uint8Array;
  name: string;
  pageCount: number;
}

export default function MergePage() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { create: createUrl, revoke: revokeUrl } = useBlobUrl();
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleFiles = useCallback((newFiles: PdfFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setResultUrl(null);
    setError(null);
    revokeUrl();
  }, [revokeUrl]);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setResultUrl(null);
    setError(null);
    revokeUrl();
  };

  const moveFile = (from: number, to: number) => {
    if (to < 0 || to >= files.length) return;
    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const bytes = await mergePdfs(files.map((f) => f.bytes));
      const url = createUrl(bytes);
      setResultUrl(url);
    } catch {
      setError("Failed to merge PDFs. Make sure all files are valid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <Link href="/" style={{ color: "var(--text-muted)", display: "flex" }}>
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Merge PDFs</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Combine multiple PDFs into one. Files merge in order from top to bottom.
          </p>
        </div>
      </div>

      {/* Dropzone */}
      <PdfDropzone multiple onFiles={handleFiles} />

      {/* File list */}
      {files.length > 0 && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 4px" }}>
            {files.length} file{files.length > 1 ? "s" : ""} loaded — drag rows to reorder merge order
          </p>
          {files.map((f, idx) => (
            <div
              key={`${f.name}-${idx}`}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 11,
                  color: "var(--accent)",
                  background: "rgba(124,58,237,0.12)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  minWidth: 28,
                  textAlign: "center",
                }}
              >
                {idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {f.name}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                  {f.pageCount} page{f.pageCount > 1 ? "s" : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => moveFile(idx, idx - 1)}
                  disabled={idx === 0}
                  style={{ ...arrowBtn, opacity: idx === 0 ? 0.3 : 1 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => moveFile(idx, idx + 1)}
                  disabled={idx === files.length - 1}
                  style={{ ...arrowBtn, opacity: idx === files.length - 1 ? 0.3 : 1 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </button>
              </div>
              <button onClick={() => removeFile(idx)} style={{ ...arrowBtn, color: "#f87171" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Merge button */}
          <button
            onClick={handleMerge}
            disabled={files.length < 2 || loading}
            style={{
              marginTop: 8,
              background: files.length < 2 ? "var(--bg-secondary)" : "var(--accent)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "12px 24px",
              fontSize: 15,
              fontWeight: 600,
              cursor: files.length < 2 || loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Merging..." : `Merge ${files.length} files`}
            {!loading && <Download size={16} />}
          </button>

          {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}
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
            <p style={{ margin: 0, fontWeight: 600 }}>Merge complete!</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              {files.length} files combined
            </p>
          </div>
          <a
            href={resultUrl}
            download={`merged-${Date.now()}.pdf`}
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

const arrowBtn: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 5,
  color: "var(--text-muted)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};