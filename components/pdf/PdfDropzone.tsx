"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

interface PdfFile {
  file: File;
  bytes: Uint8Array;
  name: string;
  pageCount: number;
}

interface Props {
  onFiles(files: PdfFile[]): void;
  onSelectionStart?(): void;
  multiple?: boolean;
}

const SOFT_LIMIT = 50 * 1024 * 1024; // 50 MB — warn only
const HARD_LIMIT = 100 * 1024 * 1024; // 100 MB — block

export default function PdfDropzone({ onFiles, onSelectionStart, multiple = true }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ignoredFiles, setIgnoredFiles] = useState<string[]>([]);
  const selectionId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; selectionId.current++; };
  }, []);

  const processFiles = useCallback(
    async (raw: FileList | File[]) => {
      if (!mounted.current) return;
      const selection = ++selectionId.current;
      onSelectionStart?.();
      setError(null);
      const selected = Array.from(raw);
      const files = selected.filter((f) => f.type === "application/pdf");
      setIgnoredFiles(selected.filter((f) => f.type !== "application/pdf").map((f) => f.name));

      if (files.length === 0) {
        setError("Please drop PDF files only.");
        return;
      }
      if (!multiple && files.length > 1) {
        setError("Please drop only one PDF file.");
        return;
      }

      // Size checks
      for (const file of files) {
        if (file.size > HARD_LIMIT) {
          setError(`"${file.name}" exceeds the 100 MB file size limit.`);
          return;
        }
        if (file.size > SOFT_LIMIT) {
          // Non-fatal — pass through but we could show a warning
          console.warn(`[PdfDropzone] Large file warning: "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
        }
      }

      const results: PdfFile[] = [];
      try {
        for (const file of files) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (selection !== selectionId.current) return;
          const { PDFDocument } = await import("pdf-lib");
          const doc = await PDFDocument.load(bytes);
          if (selection !== selectionId.current) return;
          results.push({ file, bytes, name: file.name, pageCount: doc.getPageCount() });
        }
        if (selection === selectionId.current) onFiles(results);
      } catch {
        if (selection === selectionId.current) setError("Failed to read PDF files. Please choose valid PDFs.");
      }
    },
    [multiple, onFiles, onSelectionStart]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        processFiles(e.dataTransfer.files);
      }}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".pdf";
        input.multiple = multiple;
        input.onchange = () => {
          if (input.files) processFiles(input.files);
        };
        input.click();
      }}
      style={{
        border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 12,
        padding: "48px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        background: dragging ? "rgba(124,58,237,0.05)" : "transparent",
        transition: "all 0.2s",
        userSelect: "none",
      }}
    >
      <Upload size={40} color={dragging ? "var(--accent)" : "var(--text-muted)"} />
      <p style={{ margin: 0, fontSize: 16, color: "var(--text-muted)", textAlign: "center" }}>
        {dragging ? "Drop here" : "Click or drag & drop PDF files here"}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "#52525b" }}>
        {multiple ? "Multiple files supported" : "Single file only"} · Max 100 MB
      </p>
      {ignoredFiles.length > 0 && (
        <div role="status" aria-live="polite" style={{ maxWidth: "100%", fontSize: 13, color: "var(--accent-light)", overflowWrap: "anywhere" }}>
          <p style={{ margin: 0 }}>Ignored files (not recognised as PDF):</p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
            {ignoredFiles.map((name, index) => <li key={index}>{name}</li>)}
          </ul>
        </div>
      )}
      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "#f87171", textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}
