"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";

interface PdfFile {
  file: File;
  bytes: Uint8Array;
  name: string;
  pageCount: number;
}

interface Props {
  onFiles(files: PdfFile[]): void;
  multiple?: boolean;
}

const SOFT_LIMIT = 50 * 1024 * 1024; // 50 MB — warn only
const HARD_LIMIT = 100 * 1024 * 1024; // 100 MB — block

export default function PdfDropzone({ onFiles, multiple = true }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFiles = useCallback(
    async (raw: FileList | File[]) => {
      setError(null);
      const files = Array.from(raw).filter((f) => f.type === "application/pdf");

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
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(bytes);
        results.push({ file, bytes, name: file.name, pageCount: doc.getPageCount() });
      }

      onFiles(results);
    },
    [multiple, onFiles]
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
      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "#f87171", textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}