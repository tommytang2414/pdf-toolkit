"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { mergePdfs } from "@/lib/pdf-operations";
import { useBlobUrl } from "@/hooks/useBlobUrl";
import PdfDropzone from "@/components/pdf/PdfDropzone";
import { Download, ChevronLeft } from "lucide-react";

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
    <div className="ambient-bg" style={{ minHeight: "100vh", padding: "32px 24px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
        <Link href="/" style={{ color: "var(--text-muted)", display: "flex", padding: 6 }}>
          <ChevronLeft size={22} />
        </Link>
        <img src="/images/icon-merge.jpeg" alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Merge PDFs</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>Combine multiple PDFs. Files merge top to bottom.</p>
        </div>
      </div>

      <PdfDropzone multiple onFiles={handleFiles} />

      {files.length > 0 && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 4px" }}>
            {files.length} file{files.length > 1 ? "s" : ""} — arrow buttons to reorder merge sequence
          </p>
          {files.map((f, idx) => (
            <div key={`${f.name}-${idx}`} className="file-row">
              <span className="score-badge">{idx + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{f.pageCount} page{f.pageCount > 1 ? "s" : ""}</p>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => moveFile(idx, idx - 1)} disabled={idx === 0} className="icon-btn">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                </button>
                <button onClick={() => moveFile(idx, idx + 1)} disabled={idx === files.length - 1} className="icon-btn">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
                </button>
              </div>
              <button onClick={() => removeFile(idx)} className="icon-btn danger">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}

          <button onClick={handleMerge} disabled={files.length < 2 || loading} className="btn-primary" style={{ marginTop: 8 }}>
            {loading ? "Merging..." : `Merge ${files.length} files`}
            {!loading && <Download size={16} />}
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>
      )}

      {resultUrl && (
        <div className="result-banner" style={{ marginTop: 24 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Merge complete!</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{files.length} files combined</p>
          </div>
          <a href={resultUrl} download={`merged-${Date.now()}.pdf`} className="btn-secondary" style={{ background: "#22c55e", color: "#052e16", border: "none" }}>
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